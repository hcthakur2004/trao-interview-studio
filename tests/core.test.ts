import { describe, expect, it } from 'vitest';
import { validateKit } from '../src/core/contracts';
import {
  allocateSchedule,
  coverage,
  mergeCategory,
  practiceOrder,
} from '../src/core/deterministic';
import { exampleKit } from '../src/core/example';

describe('Appendix A contracts', () => {
  it('accepts the complete example with valid relationships', () => {
    expect(validateKit(exampleKit().kit).questions).toHaveLength(6);
  });
  it.each([
    'duplicate',
    'dangling-question',
    'dangling-requirement',
    'wrong-days',
    'fractional-minutes',
    'out-of-range-difficulty',
    'stale-coverage',
  ])('rejects %s', (kind) => {
    const kit = exampleKit().kit;
    if (kind === 'duplicate') kit.questions[1].id = kit.questions[0].id;
    if (kind === 'dangling-question') kit.schedule.days[0].question_ids.push('missing');
    if (kind === 'dangling-requirement') kit.questions[0].requirement_ids.push('missing');
    if (kind === 'wrong-days') kit.schedule.days.pop();
    if (kind === 'fractional-minutes') kit.schedule.days[0].minutes = 4.5;
    if (kind === 'out-of-range-difficulty') kit.questions[0].difficulty = 4;
    if (kind === 'stale-coverage') kit.coverage.uncovered_requirement_ids = ['r1'];
    expect(() => validateKit(kit)).toThrow();
  });
  it('allows user-created gaps only with honest coverage metadata', () => {
    const kit = exampleKit().kit;
    kit.questions = kit.questions.filter((q) => !q.requirement_ids.includes('r1'));
    kit.schedule = allocateSchedule(kit.role.requirements, kit.questions, 7);
    kit.coverage.uncovered_requirement_ids = ['r1'];
    expect(() => validateKit(kit)).toThrow();
    expect(validateKit(kit, false).coverage.uncovered_requirement_ids).toEqual(['r1']);
  });
});
describe('deterministic allocation', () => {
  it.each([1, 5, 7, 60])('allocates all must requirements across exactly %i days', (days) => {
    const kit = exampleKit().kit;
    kit.schedule = allocateSchedule(kit.role.requirements, kit.questions, days);
    expect(validateKit(kit).schedule.days).toHaveLength(days);
    expect(kit.schedule.days.every((d) => Number.isInteger(d.minutes))).toBe(true);
    expect(kit.schedule).toEqual(allocateSchedule(kit.role.requirements, kit.questions, days));
  });
  it('puts harder must-have topics ahead of optional topics', () => {
    const kit = exampleKit().kit;
    const plan = allocateSchedule(kit.role.requirements, kit.questions, 6);
    expect(plan.days[0].question_ids).toEqual(['q3']);
    expect(plan.days[5].question_ids).toEqual(['q6']);
  });
  it('uses honest zero-minute days for an empty extraction', () => {
    expect(
      allocateSchedule([], [], 60).days.every((d) => d.minutes === 0 && !d.question_ids.length),
    ).toBe(true);
  });
  it('rejects invalid days', () => {
    expect(() => allocateSchedule([], [], 0)).toThrow();
    expect(() => allocateSchedule([], [], 1.5)).toThrow();
  });
  it('checks exact requirement ids rather than keywords', () => {
    const kit = exampleKit().kit;
    const questions = kit.questions.map((q) => ({ ...q, requirement_ids: [] }));
    expect(coverage(kit.role.requirements, questions)).toHaveLength(5);
  });
});
describe('regeneration merge', () => {
  it('preserves edited, pinned, manual and other-category questions', () => {
    const kit = exampleKit().kit;
    kit.questions[0].meta!.edited = true;
    kit.questions[1].meta!.pinned = true;
    kit.questions[2].meta!.origin = 'manual';
    const before = structuredClone(kit.questions);
    const result = mergeCategory(kit, 'technical', [
      {
        ...kit.questions[0],
        id: 'new',
        prompt: 'A fresh technical question',
        meta: { origin: 'generated', edited: false, pinned: false },
      },
    ]);
    for (const q of before) expect(result.questions).toContainEqual(q);
    expect(result.questions.some((q) => q.id === 'new')).toBe(true);
    expect(validateKit(result)).toBeDefined();
  });
  it('replaces only untouched generated content and repairs schedule references', () => {
    const kit = exampleKit().kit;
    const result = mergeCategory(kit, 'technical', [
      { ...kit.questions[0], id: 'replacement', requirement_ids: ['r1', 'r3'] },
    ]);
    expect(result.questions.some((q) => q.id === 'q1')).toBe(false);
    expect(result.questions.some((q) => q.id === 'q4')).toBe(true);
    expect(result.schedule.days.flatMap((d) => d.question_ids)).not.toContain('q1');
    expect(validateKit(result)).toBeDefined();
  });
  it('updates generated cards and removes deleted question time during regeneration', () => {
    const kit = exampleKit().kit;
    kit.schedule = allocateSchedule(kit.role.requirements, kit.questions, 1);
    const oldPrompt = kit.questions[0].prompt;
    const result = mergeCategory(kit, 'technical', [
      {
        ...kit.questions[0],
        id: 'replacement',
        prompt: 'Replacement technical prompt',
        answer_outline: 'Replacement outline',
        requirement_ids: ['r1', 'r3'],
      },
    ]);
    expect(result.flashcards.some((card) => card.front === oldPrompt)).toBe(false);
    expect(
      result.flashcards.some(
        (card) =>
          card.front === 'Replacement technical prompt' && card.back === 'Replacement outline',
      ),
    ).toBe(true);
    expect(result.schedule.days[0].minutes).toBe(
      result.questions.reduce((sum, question) => sum + question.difficulty * 10, 0),
    );
    expect(validateKit(result)).toBeDefined();
  });
  it('preserves a user-edited flashcard while regenerating its question', () => {
    const kit = exampleKit().kit;
    const card = kit.flashcards[0];
    card.front = 'My own study prompt';
    card.meta = { origin: 'generated', edited: true, pinned: false };
    const result = mergeCategory(kit, 'technical', [
      {
        ...kit.questions[0],
        id: 'replacement',
        prompt: 'New prompt',
        requirement_ids: ['r1', 'r3'],
      },
    ]);
    expect(
      result.flashcards.some((item) => item.id === card.id && item.front === 'My own study prompt'),
    ).toBe(true);
    expect(result.flashcards.some((item) => item.front === 'New prompt')).toBe(true);
  });
  it('does not restore explicitly deleted prompts', () => {
    const kit = exampleKit().kit;
    kit.deleted_prompts.push('Do not restore');
    const result = mergeCategory(kit, 'technical', [
      { ...kit.questions[0], id: 'new', prompt: 'Do not restore' },
    ]);
    expect(result.questions.some((q) => q.id === 'new')).toBe(false);
  });
});
describe('practice', () => {
  it('orders unseen cards first, then lower confidence and oldest reviews', () => {
    const record = exampleKit();
    const order = practiceOrder(record.kit.flashcards.slice(0, 3), {
      f1: { confidence: 3, reviews: 1, reviewed_at: '2026-01-01' },
      f2: { confidence: 1, reviews: 1, reviewed_at: '2026-01-02' },
    });
    expect(order.map((f) => f.id)).toEqual(['f3', 'f2', 'f1']);
  });
});
