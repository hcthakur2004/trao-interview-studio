import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import type { InputCase, Research } from '../src/core/contracts';
import type { Model } from '../src/core/llm';
import { runPipeline } from '../src/core/pipeline';

const input: InputCase = {
  id: 'case-01',
  jd: 'Software Engineer\nRequired: React and TypeScript.\nMust mentor junior engineers.\nBonus: developer tools experience.',
  company_url: 'http://localhost:8099/acme/',
  days: 5,
};
const research: Research = {
  pages: [],
  hiring_pages: [],
  discussion_sources: [],
  discussion_summary: '',
  warnings: ['No hiring page found.'],
};
class TestModel implements Model {
  calls: string[] = [];
  technical = 0;
  constructor(
    private thin = false,
    private neverCover = false,
  ) {}
  async json<T>(task: string, data: unknown, schema: z.ZodType<T>): Promise<T> {
    this.calls.push(task);
    if (task.startsWith('Extract'))
      return schema.parse({
        company: '',
        title: 'Software Engineer',
        seniority: '',
        location: '',
        responsibilities: [],
        requirements: this.thin
          ? []
          : [
              {
                text: 'React and TypeScript',
                kind: 'technical',
                priority: 'must',
                evidence: 'Required: React and TypeScript.',
              },
              {
                text: 'Mentor junior engineers',
                kind: 'behavioural',
                priority: 'must',
                evidence: 'Must mentor junior engineers.',
              },
              {
                text: 'Developer tools experience',
                kind: 'domain',
                priority: 'nice',
                evidence: 'Bonus: developer tools experience.',
              },
              {
                text: 'Invented Kubernetes requirement',
                kind: 'technical',
                priority: 'must',
                evidence: 'Kubernetes is required.',
              },
            ],
      });
    const requirements = (data as { requirements: { id: string; text: string }[] }).requirements;
    const category = task.match(/in the ([\w-]+) category/)![1];
    if (category === 'technical' && (this.technical++ === 0 || this.neverCover))
      return schema.parse({ questions: [] });
    return schema.parse({
      questions: requirements.map((r) => ({
        requirement_ids: [r.id],
        category,
        prompt: `Explain your approach to ${r.text}.`,
        answer_outline: 'State constraints, give a specific example, and explain the outcome.',
        difficulty: 2,
      })),
    });
  }
}
describe('shared pipeline orchestration', () => {
  it('extracts grounded requirements, generates separately and genuinely repairs a gap', async () => {
    const model = new TestModel();
    const kit = await runPipeline(input, { model, research: async () => research });
    expect(kit.role.requirements).toHaveLength(3);
    expect(kit.role.requirements.find((r) => r.kind === 'domain')?.priority).toBe('nice');
    expect(kit.coverage.passes).toBe(2);
    expect(kit.coverage.uncovered_requirement_ids).toEqual([]);
    expect(kit.trace.some((t) => t.stage === 'repair')).toBe(true);
    expect(kit.trace.some((t) => t.message.includes('Pass 1: 1 uncovered'))).toBe(true);
    expect(kit.warnings.some((w) => w.includes('ungrounded'))).toBe(true);
    expect(kit.schedule.days).toHaveLength(5);
    expect(model.calls.some((t) => t.includes('behavioural category'))).toBe(true);
    expect(model.calls.some((t) => t.includes('company-fit category'))).toBe(true);
  });
  it('does not invent requirements for a thin description or fail on missing research', async () => {
    const model = new TestModel(true);
    const kit = await runPipeline(
      { ...input, jd: 'Engineer wanted. Contact us.', days: 60 },
      { model, research: async () => research },
    );
    expect(kit.role.requirements).toEqual([]);
    expect(kit.questions).toEqual([]);
    expect(kit.schedule.days).toHaveLength(60);
    expect(kit.company_brief.sources).toEqual([]);
    expect(model.calls).toHaveLength(1);
  });
  it('fails explicitly when required coverage cannot be repaired', async () => {
    await expect(
      runPipeline(input, { model: new TestModel(false, true), research: async () => research }),
    ).rejects.toMatchObject({ code: 'COVERAGE_INCOMPLETE' });
  });
});
