import express, { type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  categories,
  InputCase,
  Kit,
  validateKit,
  type Job,
  type KitRecord,
  type Research,
} from '../src/core/contracts';
import { allocateSchedule, coverage, mergeCategory, reconcileKit } from '../src/core/deterministic';
import { GeminiModel, PipelineError, type Model } from '../src/core/llm';
import { categoryFor, generateBrief, generateCategory } from '../src/core/pipeline';
import { crawlCompany } from '../src/core/retrieval';
import {
  authenticate,
  createSession,
  digest,
  hashPassword,
  sessionId,
  verifyPassword,
  type User,
} from './auth';
import { JobWorker } from './jobs';
import type { Store } from './store';

export function createApi(
  store: Store,
  worker = new JobWorker(store),
  model: Model = new GeminiModel(),
) {
  const api = express.Router();
  api.use(express.json({ limit: '1mb' }));
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  api.use((req, res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin !== (process.env.APP_ORIGIN || 'http://localhost:3000')
    ) {
      res
        .status(403)
        .json({ error: { code: 'ORIGIN_REJECTED', message: 'Request origin is not allowed.' } });
      return;
    }
    next();
  });
  api.get('/health', (_req, res) =>
    res.json({
      status: 'ok',
      generation_configured: Boolean(process.env.GEMINI_API_KEY),
      research_configured: Boolean(process.env.TAVILY_API_KEY),
      storage: process.env.MONGODB_URI ? 'mongodb' : 'development-file',
    }),
  );
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Try again later.' },
    },
  });
  const Credentials = z.object({
    email: z
      .string()
      .email()
      .max(254)
      .transform((s) => s.toLowerCase().trim()),
    password: z.string().min(10).max(128),
    name: z.string().trim().min(1).max(80).optional(),
  });
  api.post('/auth/register', authLimit, async (req, res) => {
    const input = Credentials.parse(req.body);
    const user: User = {
      id: digest(input.email),
      email: input.email,
      name: input.name || input.email.split('@')[0],
      password: await hashPassword(input.password),
    };
    if (!(await store.insert('users', user))) {
      res.status(409).json({
        error: {
          code: 'ACCOUNT_EXISTS',
          message: 'An account with this email already exists. Sign in instead.',
        },
      });
      return;
    }
    await createSession(store, res, user.id);
    res.status(201).json({ user: { name: user.name, email: user.email } });
  });
  api.post('/auth/login', authLimit, async (req, res) => {
    const input = Credentials.parse(req.body);
    const user = await store.get<User>('users', digest(input.email));
    const fallback = '00000000000000000000000000000000:' + '00'.repeat(64);
    const valid = await verifyPassword(input.password, user?.password || fallback);
    if (!user || !valid) {
      res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' },
      });
      return;
    }
    const old = sessionId(req);
    if (old) await store.remove('sessions', old);
    await createSession(store, res, user.id);
    res.json({ user: { name: user.name, email: user.email } });
  });
  api.post('/auth/logout', async (req, res) => {
    const id = sessionId(req);
    if (id) await store.remove('sessions', id);
    res.clearCookie('studio_session', { path: '/' });
    res.json({ ok: true });
  });
  api.use(authenticate(store));
  api.get('/auth/me', (_req, res) => {
    const user: User = res.locals.user;
    res.json({ user: { name: user.name, email: user.email } });
  });
  api.get('/kits', async (_req, res) => {
    const records = await store.list<KitRecord>('kits', { owner: res.locals.user.id });
    res.json({
      kits: records
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((r) => ({
          id: r.id,
          title: r.kit.role.title,
          company: r.kit.source.company,
          questions: r.kit.questions.length,
          days: r.kit.schedule.days_available,
          reviewed: Object.keys(r.practice).length,
          cards: r.kit.flashcards.length,
          updated_at: r.updated_at,
        })),
    });
  });
  const owned = async (res: Response, id: string) => {
    const record = await store.get<KitRecord>('kits', id);
    if (!record || record.owner !== res.locals.user.id) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kit not found.' } });
      return null;
    }
    return record;
  };
  api.get('/kits/:id', async (req, res) => {
    const record = await owned(res, String(req.params.id));
    if (record) res.json(record);
  });
  api.put('/kits/:id', async (req, res) => {
    const record = await owned(res, String(req.params.id));
    if (!record) return;
    const input = z.object({ revision: z.number().int(), kit: Kit }).parse(req.body);
    if (input.revision !== record.revision) {
      res.status(409).json({
        error: {
          code: 'REVISION_CONFLICT',
          message: 'This kit changed elsewhere. Reload the latest version before saving.',
        },
      });
      return;
    }
    // Editing metadata is authoritative on the server, not a promise from the browser.
    input.kit.questions = input.kit.questions.map((q) => {
      const old = record.kit.questions.find((x) => x.id === q.id);
      return {
        ...q,
        meta: {
          origin: old?.meta?.origin || (old ? 'generated' : 'manual'),
          edited: Boolean(
            old?.meta?.edited ||
            !old ||
            JSON.stringify({ ...old, meta: undefined }) !==
              JSON.stringify({ ...q, meta: undefined }),
          ),
          pinned: Boolean(q.meta?.pinned),
        },
      };
    });
    input.kit.deleted_prompts = [
      ...new Set([
        ...record.kit.deleted_prompts,
        ...record.kit.questions
          .filter((q) => !input.kit.questions.some((n) => n.id === q.id))
          .map((q) => q.prompt),
      ]),
    ];
    const kit = validateKit(reconcileKit(input.kit), false);
    const next = {
      ...record,
      kit,
      revision: record.revision + 1,
      updated_at: new Date().toISOString(),
    };
    if (!(await store.put('kits', next, record.revision))) {
      res.status(409).json({
        error: {
          code: 'REVISION_CONFLICT',
          message: 'Another edit arrived while saving. Reload and retry.',
        },
      });
      return;
    }
    res.json(next);
  });
  const regenLocks = new Set<string>();
  const generationLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    keyGenerator: (_req, res) => res.locals.user.id,
    message: {
      error: { code: 'RATE_LIMITED', message: 'Generation limit reached. Please try again later.' },
    },
  });
  api.post('/kits/:id/regenerate', generationLimit, async (req, res) => {
    const record = await owned(res, String(req.params.id));
    if (!record) return;
    const { section, revision } = z
      .object({
        section: z.enum(['company_brief', 'schedule', ...categories]),
        revision: z.number().int(),
      })
      .parse(req.body);
    if (revision !== record.revision || regenLocks.has(record.id)) {
      res.status(409).json({
        error: {
          code: 'REVISION_CONFLICT',
          message: 'Save your latest changes or wait for the current regeneration.',
        },
      });
      return;
    }
    regenLocks.add(record.id);
    try {
      const controller = new AbortController();
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(165000)]);
      const cancel = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.on('close', cancel);
      let kit = structuredClone(record.kit);
      if (section === 'schedule')
        kit.schedule = allocateSchedule(
          kit.role.requirements,
          kit.questions,
          kit.schedule.days_available,
        );
      else if (section === 'company_brief') {
        const research = await crawlCompany(kit.source.company_url, { signal });
        kit.company_brief = await generateBrief(model, research, signal);
        kit.warnings = [...new Set([...kit.warnings, ...research.warnings])];
      } else {
        const priorIds = new Set(
          kit.questions.filter((q) => q.category === section).flatMap((q) => q.requirement_ids),
        );
        const relevant = kit.role.requirements.filter(
          (r) => categoryFor(r) === section || priorIds.has(r.id),
        );
        const incoming = await generateCategory(
          model,
          section,
          relevant,
          kit.research as Research,
          signal,
        );
        kit = mergeCategory(kit, section, incoming);
        for (let pass = 0; pass < 2; pass++) {
          const gaps = coverage(relevant, kit.questions);
          if (!gaps.length) break;
          const repaired = await generateCategory(
            model,
            section,
            relevant.filter((r) => gaps.includes(r.id)),
            kit.research,
            signal,
          );
          incoming.push(...repaired);
          kit = mergeCategory(record.kit, section, incoming);
        }
        if (
          relevant.some(
            (r) => r.priority === 'must' && coverage(relevant, kit.questions).includes(r.id),
          )
        ) {
          throw new PipelineError(
            'COVERAGE_INCOMPLETE',
            'This regeneration left required topics uncovered. Your existing kit is unchanged; please retry.',
          );
        }
      }
      res.removeListener('close', cancel);
      kit = validateKit(kit, false);
      const next = {
        ...record,
        kit,
        revision: record.revision + 1,
        updated_at: new Date().toISOString(),
      };
      if (!(await store.put('kits', next, revision))) {
        res.status(409).json({
          error: {
            code: 'REVISION_CONFLICT',
            message:
              'You edited this kit during generation. Your edits are safe; regenerate again from the saved version.',
          },
        });
        return;
      }
      res.json(next);
    } finally {
      regenLocks.delete(record.id);
    }
  });
  api.post('/kits/:id/practice', async (req, res) => {
    const record = await owned(res, String(req.params.id));
    if (!record) return;
    const { card_id, confidence } = z
      .object({ card_id: z.string(), confidence: z.number().int().min(1).max(3) })
      .parse(req.body);
    if (!record.kit.flashcards.some((f) => f.id === card_id)) {
      res
        .status(400)
        .json({ error: { code: 'INVALID_CARD', message: 'This flashcard no longer exists.' } });
      return;
    }
    const next: KitRecord = {
      ...record,
      revision: record.revision + 1,
      practice: {
        ...record.practice,
        [card_id]: {
          confidence,
          reviewed_at: new Date().toISOString(),
          reviews: (record.practice[card_id]?.reviews || 0) + 1,
        },
      },
    };
    if (!(await store.put('kits', next, record.revision))) {
      res
        .status(409)
        .json({ error: { code: 'REVISION_CONFLICT', message: 'Kit changed. Retry your rating.' } });
      return;
    }
    res.json(next);
  });
  api.get('/jobs', async (_req, res) => {
    const jobs = await store.list<Job>('jobs', { owner: res.locals.user.id });
    res.json({
      jobs: jobs
        .map(({ checkpoint: _c, input: _i, ...j }) => j)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    });
  });
  api.post('/jobs', generationLimit, async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        error: {
          code: 'LLM_NOT_CONFIGURED',
          message:
            'Generation needs a Gemini API key. Add GEMINI_API_KEY to the server .env and restart.',
        },
      });
      return;
    }
    const input = InputCase.parse({ ...req.body, id: req.body.id || randomUUID() });
    const job = await worker.enqueue(res.locals.user.id, input);
    res.status(202).json({ id: job.id, status: job.status, kit_id: job.kit_id });
  });
  api.post('/jobs/:id/retry', generationLimit, async (req, res) => {
    const job = await store.get<Job>('jobs', String(req.params.id));
    if (!job || job.owner !== res.locals.user.id) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job not found.' } });
      return;
    }
    if (job.status !== 'failed') {
      res.status(409).json({
        error: { code: 'JOB_ACTIVE', message: 'This job is already active or complete.' },
      });
      return;
    }
    await worker.retry(job);
    res.json({ id: job.id });
  });
  return api;
}
