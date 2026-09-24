import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  categories,
  Extracted,
  InputCase,
  Question,
  validateKit,
  type Category,
  type Kit,
  type PipelineCheckpoint,
  type Research,
  type Trace,
} from './contracts';
import { allocateSchedule, coverage } from './deterministic';
import { GeminiModel, PipelineError, type Model } from './llm';
import { crawlCompany, searchDiscussion } from './retrieval';

export const PIPELINE_VERSION = '1.1';
export function fingerprint(input: InputCase) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        input.jd.trim(),
        input.company_url.trim(),
        input.days,
        PIPELINE_VERSION,
        process.env.GEMINI_MODEL,
      ]),
    )
    .digest('hex');
}
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12);
const normalized = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
export type PipelineOptions = {
  model?: Model;
  allowLocal?: boolean;
  signal?: AbortSignal;
  checkpoint?: Partial<PipelineCheckpoint>;
  onCheckpoint?: (checkpoint: Partial<PipelineCheckpoint>) => Promise<void>;
  onTrace?: (entry: Trace) => Promise<void>;
  research?: (input: InputCase, company: string, signal: AbortSignal) => Promise<Research>;
};
const QuestionOutput = z.object({
  questions: z.array(Question.omit({ id: true, meta: true })).max(80),
});
export async function generateCategory(
  model: Model,
  category: Category,
  requirements: Extracted['requirements'],
  research: Research | Kit['research'],
  signal: AbortSignal,
) {
  if (!requirements.length) return [];
  const result = await model.json(
    `Generate interview questions in the ${category} category ONLY. Cover each supplied requirement with at least one genuinely relevant question. Reference only supplied requirement IDs. Difficulty 1=foundational, 2=applied, 3=advanced. Use the discovered hiring process to choose practical exercises versus discussion. Do not claim these are actual company questions. ${category === 'behavioural' ? 'Ask for specific past experiences and use STAR answer outlines.' : category === 'system-design' ? 'Ask about architecture, constraints, failure modes and trade-offs.' : category === 'company-fit' ? 'Connect role/domain requirements to evidenced company work; avoid invented company claims.' : 'Ask concrete technical questions with specific answer outlines.'}`,
    { requirements, research },
    QuestionOutput,
    signal,
  );
  const ids = new Set(requirements.map((r) => r.id));
  return result.questions
    .map((q) => ({
      ...q,
      category,
      id: `q_${randomUUID()}`,
      requirement_ids: [...new Set(q.requirement_ids.filter((id) => ids.has(id)))],
      meta: { origin: 'generated' as const, edited: false, pinned: false },
    }))
    .filter((q) => q.requirement_ids.length);
}
export function categoryFor(r: Extracted['requirements'][number]): Category {
  if (r.kind === 'behavioural') return 'behavioural';
  if (r.kind === 'domain') return 'company-fit';
  if (/architect|system design|distributed|scalab|high.availability/i.test(r.text))
    return 'system-design';
  return 'technical';
}
export async function generateBrief(
  model: Model,
  research: Research,
  signal: AbortSignal,
): Promise<Kit['company_brief']> {
  if (!research.pages.length)
    return {
      summary:
        'Company research was unavailable. Review the job description and verify company details before your interview.',
      what_they_do: 'Not established from retrieved sources.',
      sources: [],
    };
  const schema = z.object({
    summary: z.string(),
    what_they_do: z.string(),
    sources: z.array(z.string()),
  });
  const brief = await model.json(
    'Write a concise company brief from these retrieved pages only. Explain what the company does and relevant interview-process facts only if supported. State uncertainty. Use only supplied source URLs.',
    research.pages.map((p) => ({ url: p.url, title: p.title, text: p.text.slice(0, 5000) })),
    schema,
    signal,
  );
  const actual = new Set(research.pages.map((p) => p.url));
  return { ...brief, sources: brief.sources.filter((s) => actual.has(s)) };
}

export async function runPipeline(raw: InputCase, options: PipelineOptions = {}): Promise<Kit> {
  const input = InputCase.parse(raw);
  const signal = AbortSignal.any([
    AbortSignal.timeout(Number(process.env.PIPELINE_TIMEOUT_MS || 165000)),
    ...(options.signal ? [options.signal] : []),
  ]);
  const model = options.model ?? new GeminiModel();
  const trace: Trace[] = [];
  const warnings: string[] = [];
  const checkpoint = { ...options.checkpoint };
  async function log(stage: string, message: string) {
    const entry = { stage, message, at: new Date().toISOString() };
    trace.push(entry);
    await options.onTrace?.(entry);
  }
  async function save(part: Partial<PipelineCheckpoint>) {
    Object.assign(checkpoint, part);
    await options.onCheckpoint?.(checkpoint);
  }
  await log('extract', 'Extracting requirements and supporting job-description evidence');
  let extracted = checkpoint.extracted;
  if (!extracted) {
    const output = await model.json(
      'Extract the role and ALL explicitly stated skills, qualifications AND concrete duties as preparation requirements. A concrete duty belongs BOTH in responsibilities and requirements: e.g. "Mentor junior engineers" is a behavioural must, "Design scalable systems" is a technical must, and "Build accessible interfaces" is a technical must. Do not omit duties just because they lack the word required. Vague generic duties such as "help build useful software" do not establish specific requirements. Separate technical, behavioural and domain requirements. Required/essential qualifications and concrete duties are must; bonus/preferred/desirable are nice. Split independent skills when appropriate but preserve explicit OR alternatives as one requirement. Never infer unstated technologies, years, seniority, location or company. Each requirement MUST include an exact contiguous evidence quote from the original JD. A two-line stub should yield few or no requirements. Before returning, check every JD sentence for a concrete duty or qualification that is missing from requirements. Unknown values are empty strings.',
      { jd: input.jd },
      Extracted,
      signal,
    );
    const seen = new Set<string>();
    const requirements = output.requirements
      .filter((r) => {
        if (!normalized(input.jd).includes(normalized(r.evidence))) {
          warnings.push(`Excluded an ungrounded requirement: ${r.text}`);
          return false;
        }
        const key = normalized(r.text);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((r) => ({ ...r, id: `r_${hash(`${normalized(r.evidence)}:${normalized(r.text)}`)}` }));
    extracted = { ...output, requirements };
    await save({ extracted });
  }
  if (extracted.requirements.length < 3)
    warnings.push(
      'This description contains limited requirements. Add detail to make the preparation more specific.',
    );
  await log('research', 'Discovering company pages and public interview discussion');
  let research = checkpoint.research;
  if (!research) {
    if (options.research) research = await options.research(input, extracted.company, signal);
    else {
      research = await crawlCompany(input.company_url, {
        allowLocal: options.allowLocal,
        signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]),
      });
      let hostname = '';
      try {
        hostname = new URL(input.company_url).hostname;
      } catch {
        /* invalid URL is nonfatal */
      }
      const discussion = await searchDiscussion(extracted.company, hostname, signal);
      research.discussion_sources = discussion.sources;
      research.discussion_summary = discussion.summary;
      if (discussion.warning) research.warnings.push(discussion.warning);
    }
    await save({ research });
  }
  warnings.push(...research.warnings);
  await log(
    'research',
    `Read ${research.pages.length} company pages; found ${research.hiring_pages.length} hiring pages and ${research.discussion_sources.length} discussion sources`,
  );
  const context = {
    hiring_pages: research.hiring_pages,
    discussion_sources: research.discussion_sources,
    discussion_summary: research.discussion_summary,
    pages: research.pages.map((p) => ({ url: p.url, text: p.text.slice(0, 2500) })),
  };
  let questions = checkpoint.questions ?? [];
  let passes = checkpoint.passes ?? 0;
  if (!passes) {
    for (const category of categories) {
      const requirements = extracted.requirements.filter((r) => categoryFor(r) === category);
      if (!requirements.length) continue;
      await log(
        'questions',
        `Generating ${category} questions for ${requirements.length} requirements`,
      );
      questions.push(...(await generateCategory(model, category, requirements, context, signal)));
    }
    passes = 1;
    await save({ questions, passes });
  }
  let gaps = coverage(extracted.requirements, questions);
  await log(
    'coverage',
    `Pass ${passes}: ${gaps.length} uncovered requirements${gaps.length ? ` (${gaps.join(', ')})` : ''}`,
  );
  while (gaps.length && passes < 3) {
    for (const category of categories) {
      const missing = extracted.requirements.filter(
        (r) => gaps.includes(r.id) && categoryFor(r) === category,
      );
      if (!missing.length) continue;
      await log('repair', `Repairing ${missing.length} missing ${category} requirements`);
      questions.push(...(await generateCategory(model, category, missing, context, signal)));
    }
    passes++;
    gaps = coverage(extracted.requirements, questions);
    await save({ questions, passes });
    await log('coverage', `Pass ${passes}: ${gaps.length} uncovered requirements`);
  }
  if (extracted.requirements.some((r) => r.priority === 'must' && gaps.includes(r.id)))
    throw new PipelineError(
      'COVERAGE_INCOMPLETE',
      'Required topics remain uncovered after two repair rounds. Retry this generation.',
    );
  await log('brief', 'Writing an evidence-grounded company brief');
  const brief = await generateBrief(model, research, signal);
  await log('flashcards', 'Creating review cards from the generated questions');
  // Deterministic derivation avoids an additional quota-consuming call and keeps cards grounded.
  const flashcards = questions.map((q) => ({
    id: `f_${hash(q.id)}`,
    front: q.prompt,
    back: q.answer_outline,
    requirement_ids: q.requirement_ids,
    meta: { origin: 'generated' as const, edited: false, pinned: false },
  }));
  await log('schedule', `Allocating material across exactly ${input.days} days`);
  const kit: Kit = {
    source: {
      company: extracted.company,
      company_url: input.company_url,
      role: extracted.title,
      location: extracted.location,
      jd_chars: input.jd.length,
      researched_at: new Date().toISOString(),
      pages_used: research.pages.map((p) => p.url),
    },
    company_brief: brief,
    role: {
      title: extracted.title,
      seniority: extracted.seniority,
      responsibilities: extracted.responsibilities,
      requirements: extracted.requirements,
    },
    questions,
    flashcards,
    schedule: allocateSchedule(extracted.requirements, questions, input.days),
    coverage: { uncovered_requirement_ids: gaps, passes },
    warnings,
    trace,
    research: {
      hiring_pages: research.hiring_pages,
      discussion_sources: research.discussion_sources,
      discussion_summary: research.discussion_summary,
    },
    deleted_prompts: [],
  };
  await log('validate', 'Validating structure, references, requirement coverage, and schedule');
  return validateKit(kit);
}
