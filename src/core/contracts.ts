import { z } from 'zod';

export const categories = ['technical', 'behavioural', 'system-design', 'company-fit'] as const;
export const Category = z.enum(categories);
const id = z.string().min(1).max(120);
const text = z.string().max(20000);
const webUrl = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), 'Expected an HTTP(S) URL');
export const EditMeta = z.object({
  origin: z.enum(['generated', 'manual']).default('generated'),
  edited: z.boolean().default(false),
  pinned: z.boolean().default(false),
});
export const Requirement = z.object({
  id,
  text: text.min(1),
  kind: z.enum(['technical', 'behavioural', 'domain']),
  priority: z.enum(['must', 'nice']),
  evidence: z.string().optional(),
});
export const Question = z.object({
  id,
  requirement_ids: z.array(id),
  category: Category,
  prompt: text.min(1),
  answer_outline: text,
  difficulty: z.number().int().min(1).max(3),
  meta: EditMeta.optional(),
});
export const Flashcard = z.object({
  id,
  front: text.min(1),
  back: text,
  requirement_ids: z.array(id),
  meta: EditMeta.optional(),
});
export const Schedule = z.object({
  days_available: z.number().int().min(1).max(60),
  days: z.array(
    z.object({
      day: z.number().int().min(1),
      focus: text,
      question_ids: z.array(id),
      minutes: z.number().int().min(0),
    }),
  ),
});
export const Trace = z.object({
  stage: z.string(),
  message: z.string(),
  at: z.string(),
  duration_ms: z.number().optional(),
});
export const Kit = z.object({
  source: z.object({
    company: text,
    company_url: text,
    role: text,
    location: text,
    jd_chars: z.number().int().min(0),
    researched_at: text,
    pages_used: z.array(webUrl),
  }),
  company_brief: z.object({
    summary: text,
    what_they_do: text,
    sources: z.array(webUrl),
  }),
  role: z.object({
    title: text,
    seniority: text,
    responsibilities: z.array(text),
    requirements: z.array(Requirement),
  }),
  questions: z.array(Question).max(300),
  flashcards: z.array(Flashcard).max(300),
  schedule: Schedule,
  coverage: z.object({ uncovered_requirement_ids: z.array(id), passes: z.number().int().min(1) }),
  warnings: z.array(z.string()).default([]),
  trace: z.array(Trace).default([]),
  research: z
    .object({
      hiring_pages: z.array(z.string()),
      discussion_sources: z.array(z.string()),
      discussion_summary: z.string(),
    })
    .optional(),
  deleted_prompts: z.array(z.string()).default([]),
});
export type Kit = z.infer<typeof Kit>;
export type Question = z.infer<typeof Question>;
export type Requirement = z.infer<typeof Requirement>;
export type Flashcard = z.infer<typeof Flashcard>;
export type Category = z.infer<typeof Category>;
export type Trace = z.infer<typeof Trace>;
export const InputCase = z.object({
  id: z.string().min(1).max(120),
  jd: z.string().trim().min(5).max(30000),
  company_url: z.string().max(2048),
  days: z.number().int().min(1).max(60),
});
export type InputCase = z.infer<typeof InputCase>;
export type Practice = Record<string, { confidence: number; reviewed_at: string; reviews: number }>;
export type KitRecord = {
  id: string;
  owner: string;
  kit: Kit;
  revision: number;
  created_at: string;
  updated_at: string;
  practice: Practice;
};
export type Job = {
  id: string;
  owner: string;
  input: InputCase;
  fingerprint: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stage: string;
  trace: Trace[];
  warnings: string[];
  kit_id?: string;
  error?: { code: string; message: string };
  created_at: string;
  updated_at: string;
  checkpoint?: Partial<PipelineCheckpoint>;
};
export type PipelineCheckpoint = {
  extracted: Extracted;
  research: Research;
  questions: Question[];
  passes: number;
};
export type Page = {
  url: string;
  title: string;
  text: string;
  links: { url: string; text: string }[];
};
export type Research = {
  pages: Page[];
  hiring_pages: string[];
  discussion_sources: string[];
  discussion_summary: string;
  warnings: string[];
};
export const Extracted = z.object({
  company: z.string(),
  title: z.string(),
  seniority: z.string(),
  location: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z
    .array(Requirement.omit({ id: true }).extend({ evidence: z.string().min(1) }))
    .max(40),
});
export type Extracted = Omit<z.infer<typeof Extracted>, 'requirements'> & {
  requirements: Requirement[];
};

export function validateKit(value: unknown, requireComplete = true): Kit {
  const kit = Kit.parse(value);
  const reqs = new Set(kit.role.requirements.map((r) => r.id));
  const qs = new Set(kit.questions.map((q) => q.id));
  if (
    reqs.size !== kit.role.requirements.length ||
    qs.size !== kit.questions.length ||
    new Set(kit.flashcards.map((f) => f.id)).size !== kit.flashcards.length
  )
    throw new Error('Duplicate entity ID');
  for (const item of [...kit.questions, ...kit.flashcards])
    if (item.requirement_ids.some((r) => !reqs.has(r)))
      throw new Error('Unknown requirement reference');
  if (kit.schedule.days.length !== kit.schedule.days_available)
    throw new Error('Schedule day count mismatch');
  kit.schedule.days.forEach((day, i) => {
    if (day.day !== i + 1 || day.question_ids.some((q) => !qs.has(q)))
      throw new Error('Invalid schedule reference or day');
  });
  const covered = new Set(kit.questions.flatMap((q) => q.requirement_ids));
  const gaps = kit.role.requirements.filter((r) => !covered.has(r.id)).map((r) => r.id);
  if (
    JSON.stringify([...gaps].sort()) !==
    JSON.stringify([...kit.coverage.uncovered_requirement_ids].sort())
  )
    throw new Error('Coverage metadata is stale');
  const scheduledIds = new Set(kit.schedule.days.flatMap((d) => d.question_ids));
  const scheduledRequirements = new Set(
    kit.questions.filter((q) => scheduledIds.has(q.id)).flatMap((q) => q.requirement_ids),
  );
  if (
    requireComplete &&
    kit.role.requirements.some(
      (r) => r.priority === 'must' && (!covered.has(r.id) || !scheduledRequirements.has(r.id)),
    )
  )
    throw new Error('Must-have requirement is uncovered or unscheduled');
  return kit;
}
