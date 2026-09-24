import type { Flashcard, Kit, Practice, Question, Requirement } from './contracts';

export function coverage(requirements: Requirement[], questions: Question[]) {
  const covered = new Set(
    questions.filter((q) => q.prompt.trim()).flatMap((q) => q.requirement_ids),
  );
  return requirements.filter((r) => !covered.has(r.id)).map((r) => r.id);
}

export function allocateSchedule(
  requirements: Requirement[],
  questions: Question[],
  days: number,
): Kit['schedule'] {
  if (!Number.isInteger(days) || days < 1 || days > 60)
    throw new Error('Days must be an integer from 1 to 60');
  const must = new Set(requirements.filter((r) => r.priority === 'must').map((r) => r.id));
  const sorted = [...questions].sort(
    (a, b) =>
      Number(b.requirement_ids.some((r) => must.has(r))) -
        Number(a.requirement_ids.some((r) => must.has(r))) ||
      b.difficulty - a.difficulty ||
      a.id.localeCompare(b.id),
  );
  const schedule: Kit['schedule'] = {
    days_available: days,
    days: Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      focus: 'Clarify the role and revisit your preparation notes',
      question_ids: [],
      minutes: 0,
    })),
  };
  // Contiguous balanced partitions preserve priority order across first exposure.
  const activeDays = Math.min(days, sorted.length);
  sorted.forEach((q, i) => {
    const day = schedule.days[Math.floor((i * activeDays) / sorted.length)];
    day.question_ids.push(q.id);
    day.minutes += q.difficulty * 10;
  });
  for (let i = 0; i < days; i++) {
    const day = schedule.days[i];
    if (!day.question_ids.length && sorted.length) {
      const q = sorted[(i - activeDays) % sorted.length];
      day.question_ids = [q.id];
      day.minutes = q.difficulty * 5;
      day.focus = `Review: ${q.category.replace('-', ' ')}`;
    } else if (day.question_ids.length) {
      const cats = new Set(
        day.question_ids.map((id) =>
          questions.find((q) => q.id === id)!.category.replace('-', ' '),
        ),
      );
      day.focus = [...cats].join(' + ');
    }
  }
  return schedule;
}

export const isProtected = (q: Question) =>
  q.meta?.origin === 'manual' || q.meta?.edited || q.meta?.pinned;
export function mergeCategory(kit: Kit, category: Question['category'], incoming: Question[]): Kit {
  const next = structuredClone(kit);
  const protectedQuestions = kit.questions.filter((q) => q.category === category && isProtected(q));
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const excluded = new Set(
    [...protectedQuestions.map((q) => q.prompt), ...kit.deleted_prompts].map(normalize),
  );
  const replacements = incoming.filter((q) => !excluded.has(normalize(q.prompt)));
  const first = next.questions.findIndex((q) => q.category === category && !isProtected(q));
  next.questions = next.questions.filter((q) => q.category !== category || isProtected(q));
  next.questions.splice(
    first < 0 ? next.questions.length : Math.min(first, next.questions.length),
    0,
    ...replacements,
  );
  return reconcileKit(next);
}
export function reconcileKit(kit: Kit): Kit {
  const next = structuredClone(kit);
  next.coverage.uncovered_requirement_ids = coverage(next.role.requirements, next.questions);
  const valid = new Set(next.questions.map((q) => q.id));
  next.schedule.days.forEach((d) => {
    d.question_ids = d.question_ids.filter((id) => valid.has(id));
  });
  const scheduled = new Set(next.schedule.days.flatMap((d) => d.question_ids));
  for (const q of next.questions.filter((q) => !scheduled.has(q.id))) {
    const day = [...next.schedule.days].sort((a, b) => a.minutes - b.minutes || a.day - b.day)[0];
    day.question_ids.push(q.id);
    day.minutes += q.difficulty * 10;
  }
  return next;
}
export function practiceOrder(cards: Flashcard[], practice: Practice) {
  return [...cards].sort(
    (a, b) =>
      (practice[a.id]?.confidence ?? 0) - (practice[b.id]?.confidence ?? 0) ||
      (practice[a.id]?.reviewed_at ?? '').localeCompare(practice[b.id]?.reviewed_at ?? '') ||
      a.id.localeCompare(b.id),
  );
}
