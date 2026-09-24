import { randomUUID } from 'node:crypto';
import type { InputCase, Job, KitRecord } from '../src/core/contracts';
import { PipelineError } from '../src/core/llm';
import { fingerprint, runPipeline } from '../src/core/pipeline';
import type { Store } from './store';

export class JobWorker {
  private running = false;
  private stopping = false;
  private controller = new AbortController();
  private enqueueTail: Promise<unknown> = Promise.resolve();
  constructor(private store: Store) {}
  async recover() {
    for (const job of await this.store.list<Job>('jobs', { status: 'running' })) {
      job.status = 'queued';
      job.stage = 'Resuming saved progress';
      await this.store.put('jobs', job);
    }
    void this.pump();
  }
  async enqueue(owner: string, input: InputCase): Promise<Job> {
    const operation = this.enqueueTail.then(() => this.createJob(owner, input));
    this.enqueueTail = operation.catch(() => undefined);
    return operation;
  }
  private async createJob(owner: string, input: InputCase) {
    const key = fingerprint(input);
    const previous = (await this.store.list<Job>('jobs', { owner, fingerprint: key })).find((j) =>
      ['queued', 'running', 'completed'].includes(j.status),
    );
    if (previous) return previous;
    const now = new Date().toISOString();
    const job: Job = {
      id: randomUUID(),
      owner,
      input,
      fingerprint: key,
      status: 'queued',
      stage: 'Queued',
      trace: [],
      warnings: [],
      created_at: now,
      updated_at: now,
    };
    await this.store.insert('jobs', job);
    void this.pump();
    return job;
  }
  async retry(job: Job) {
    const next: Job = {
      ...job,
      status: 'queued',
      error: undefined,
      updated_at: new Date().toISOString(),
    };
    if (job.error?.code === 'COVERAGE_INCOMPLETE' && next.checkpoint) {
      next.checkpoint = {
        extracted: next.checkpoint.extracted,
        research: next.checkpoint.research,
      };
    }
    await this.store.put('jobs', next);
    void this.pump();
    return next;
  }
  async stop() {
    this.stopping = true;
    this.controller.abort(new Error('Server shutting down'));
  }
  private async pump() {
    if (this.running || this.stopping) return;
    this.running = true;
    try {
      while (!this.stopping) {
        const job = (await this.store.list<Job>('jobs', { status: 'queued' })).sort((a, b) =>
          a.created_at.localeCompare(b.created_at),
        )[0];
        if (!job) break;
        job.status = 'running';
        await this.store.put('jobs', job);
        const started = Date.now();
        try {
          const kit = await runPipeline(job.input, {
            signal: this.controller.signal,
            checkpoint: job.checkpoint,
            allowLocal: false,
            onTrace: async (entry) => {
              job.trace.push(entry);
              job.stage = entry.message;
              job.updated_at = entry.at;
              await this.store.put('jobs', job);
            },
            onCheckpoint: async (checkpoint) => {
              job.checkpoint = checkpoint;
              await this.store.put('jobs', job);
            },
          });
          const now = new Date().toISOString();
          const record: KitRecord = {
            id: job.id,
            owner: job.owner,
            kit,
            revision: 1,
            created_at: now,
            updated_at: now,
            practice: {},
          };
          await this.store.put('kits', record);
          job.status = 'completed';
          job.kit_id = record.id;
          job.warnings = kit.warnings;
          job.stage = 'Your preparation kit is ready';
          console.info(
            JSON.stringify({
              event: 'generation_completed',
              job_id: job.id,
              duration_ms: Date.now() - started,
              requirements: kit.role.requirements.length,
              passes: kit.coverage.passes,
            }),
          );
        } catch (error) {
          job.status = this.stopping ? 'queued' : 'failed';
          job.error = {
            code: error instanceof PipelineError ? error.code : 'GENERATION_FAILED',
            message: error instanceof Error ? error.message : 'Generation failed. Try again.',
          };
          console.error(
            JSON.stringify({
              event: 'generation_failed',
              job_id: job.id,
              code: job.error.code,
              duration_ms: Date.now() - started,
            }),
          );
        }
        job.updated_at = new Date().toISOString();
        await this.store.put('jobs', job);
      }
    } finally {
      this.running = false;
    }
  }
}
