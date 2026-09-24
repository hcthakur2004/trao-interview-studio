import type { Kit, KitRecord } from './contracts';
import { allocateSchedule } from './deterministic';
// Hand-authored example for exploring the interface. Never used by the generation pipeline.
export function exampleKit(): KitRecord {
  const requirements: Kit['role']['requirements'] = [
    {
      id: 'r1',
      text: 'Build accessible interfaces with React and TypeScript',
      kind: 'technical',
      priority: 'must',
      evidence: 'Strong experience building accessible applications with React and TypeScript.',
    },
    {
      id: 'r2',
      text: 'Design maintainable frontend architecture',
      kind: 'technical',
      priority: 'must',
      evidence: 'You will own frontend architecture and collaborate on API design.',
    },
    {
      id: 'r3',
      text: 'Diagnose and improve web performance',
      kind: 'technical',
      priority: 'must',
      evidence: 'Experience measuring and improving web performance is required.',
    },
    {
      id: 'r4',
      text: 'Mentor engineers and communicate trade-offs',
      kind: 'behavioural',
      priority: 'must',
      evidence: 'Mentor junior engineers and clearly communicate technical trade-offs.',
    },
    {
      id: 'r5',
      text: 'Experience working on developer tools',
      kind: 'domain',
      priority: 'nice',
      evidence: 'Bonus: experience building tools for developers.',
    },
  ];
  const rows: [string, string, string, Kit['questions'][number]['category'], number][] = [
    [
      'r1',
      'How would you build an accessible command palette?',
      'Start with the interaction contract: keyboard navigation, focus management, an accessible combobox pattern, and announcing results. Separate query state from selection. Test with keyboard-only use and a screen reader. Explain when to reuse an established primitive.',
      'technical',
      2,
    ],
    [
      'r1',
      'When would you choose a discriminated union over optional props?',
      'Model mutually exclusive states explicitly. Use a discriminant such as status to narrow data safely. Demonstrate loading, success and error states, and explain exhaustive checking with never. Avoid invalid combinations of independent booleans.',
      'technical',
      2,
    ],
    [
      'r3',
      'A dashboard becomes slow as its data grows. Where do you start?',
      'Measure before optimizing: establish interaction latency and a performance trace. Separate network, JavaScript and rendering costs. Check list size, expensive derived state and unnecessary renders. Compare virtualization, pagination and memoization, then measure the result.',
      'technical',
      3,
    ],
    [
      'r2',
      'Design a collaborative editor that preserves unsaved changes.',
      'Clarify collaboration and offline requirements. Define stable document IDs, local draft state and persisted revisions. Discuss optimistic updates, conflict handling and retry semantics. Start with version checks; justify when operational transforms or CRDTs become necessary.',
      'system-design',
      3,
    ],
    [
      'r4',
      'Tell me about a time you helped an engineer make a difficult decision.',
      'Use a specific situation. Explain the constraints, how you helped compare options, and what you left for the engineer to own. Describe the result and what both of you learned. Distinguish coaching from simply providing the answer.',
      'behavioural',
      2,
    ],
    [
      'r5',
      'How would you learn whether a developer workflow is actually improving?',
      'Identify the task and users first. Combine interviews with measures such as time to first successful action, failure rate and repeat usage. Explain why clicks or time spent alone may be misleading. Describe how you would validate a change with a small cohort.',
      'company-fit',
      2,
    ],
  ];
  const questions = rows.map(([r, prompt, answer_outline, category, difficulty], i) => ({
    id: `q${i + 1}`,
    requirement_ids: [r],
    prompt,
    answer_outline,
    category,
    difficulty,
    meta: { origin: 'generated' as const, edited: false, pinned: false },
  }));
  const kit: Kit = {
    source: {
      company: 'Northstar',
      company_url: 'https://example.com',
      role: 'Senior Frontend Engineer',
      location: 'Remote',
      jd_chars: 542,
      researched_at: '2026-09-23T08:00:00Z',
      pages_used: [],
    },
    company_brief: {
      summary:
        'Northstar is a fictional developer-tools company used in this example kit. Its team is looking for an engineer who combines thoughtful interface design with strong technical fundamentals.',
      what_they_do:
        'This sample explores a developer workspace with collaborative editing, accessible interfaces, and performance-sensitive dashboards. These are example details, not researched company facts.',
      sources: [],
    },
    role: {
      title: 'Senior Frontend Engineer',
      seniority: 'Senior',
      responsibilities: [
        'Own thoughtful, accessible product experiences',
        'Make frontend architecture decisions with the team',
        'Help other engineers grow through feedback and mentoring',
      ],
      requirements,
    },
    questions,
    flashcards: questions.map((q, i) => ({
      id: `f${i + 1}`,
      front: q.prompt,
      back: q.answer_outline,
      requirement_ids: q.requirement_ids,
    })),
    schedule: allocateSchedule(requirements, questions, 7),
    coverage: { uncovered_requirement_ids: [], passes: 1 },
    warnings: [
      'Illustrative sample. No live research or AI generation was performed for this kit.',
    ],
    trace: [],
    deleted_prompts: [],
    research: { hiring_pages: [], discussion_sources: [], discussion_summary: '' },
  };
  return {
    id: 'example',
    owner: 'example',
    kit,
    revision: 1,
    created_at: '2026-09-23T08:00:00Z',
    updated_at: '2026-09-23T08:00:00Z',
    practice: {},
  };
}
