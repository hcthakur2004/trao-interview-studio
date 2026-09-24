import express from 'express';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApi } from '../server/api';
import { digest } from '../server/auth';
import { FileStore } from '../server/store';
import { exampleKit } from '../src/core/example';
import type { Model } from '../src/core/llm';
let directory: string;
let store: FileStore;
let app: express.Express;
let cookie: string;
const origin = 'http://localhost:3000';
beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'trao-tests-'));
  store = await new FileStore(path.join(directory, 'store.json')).init();
  app = express();
  app.use('/api', createApi(store));
  app.use((e: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) =>
    res.status(400).json({ error: { message: e.message } }),
  );
  const response = await request(app)
    .post('/api/auth/register')
    .set('Origin', origin)
    .send({ email: 'a@example.com', name: 'User A', password: 'correct-horse-42' });
  cookie = response.headers['set-cookie'][0].split(';')[0];
  const record = exampleKit();
  record.owner = digest('a@example.com');
  await store.insert('kits', record);
});
afterAll(async () => {
  await store.close();
  if (!path.resolve(directory).startsWith(path.join(path.resolve(tmpdir()), 'trao-tests-')))
    throw new Error('Unsafe test cleanup path');
  await rm(directory, { recursive: true, force: true });
});
describe('authentication and ownership', () => {
  it('rejects signed-out access', async () => {
    expect((await request(app).get('/api/kits')).status).toBe(401);
  });
  it('rejects foreign origins before processing a write', async () => {
    expect(
      (await request(app).post('/api/auth/login').set('Origin', 'https://evil.example').send({}))
        .status,
    ).toBe(403);
  });
  it('serves only owned kits', async () => {
    const a = await request(app).get('/api/kits/example').set('Cookie', cookie);
    expect(a.status).toBe(200);
    const b = await request(app)
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ email: 'b@example.com', password: 'correct-horse-42' });
    const cookieB = b.headers['set-cookie'][0].split(';')[0];
    expect((await request(app).get('/api/kits/example').set('Cookie', cookieB)).status).toBe(404);
    expect((await request(app).get('/api/kits').set('Cookie', cookieB)).body.kits).toEqual([]);
  });
  it('rejects stale edits and marks changed questions as protected', async () => {
    const a = (await request(app).get('/api/kits/example').set('Cookie', cookie)).body;
    a.kit.questions[0].prompt = 'My custom question';
    const saved = await request(app)
      .put('/api/kits/example')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ revision: a.revision, kit: a.kit });
    expect(saved.status).toBe(200);
    expect(saved.body.kit.questions[0].meta.edited).toBe(true);
    const stale = await request(app)
      .put('/api/kits/example')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ revision: a.revision, kit: a.kit });
    expect(stale.status).toBe(409);
  });
  it('allows deterministic schedule regeneration and preserves edited question text', async () => {
    const a = (await request(app).get('/api/kits/example').set('Cookie', cookie)).body;
    const result = await request(app)
      .post('/api/kits/example/regenerate')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ revision: a.revision, section: 'schedule' });
    expect(result.status).toBe(200);
    expect(result.body.kit.questions[0].prompt).toBe('My custom question');
  });
  it('does not overwrite an edit arriving during generation', async () => {
    let release!: () => void;
    let started!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const delayed: Model = {
      async json(_task, data, schema) {
        started();
        await barrier;
        const requirements = (data as { requirements: { id: string; text: string }[] })
          .requirements;
        return schema.parse({
          questions: requirements.map((r) => ({
            requirement_ids: [r.id],
            category: 'technical',
            prompt: `Discuss ${r.text}`,
            answer_outline: 'Explain the decision and trade-offs.',
            difficulty: 2,
          })),
        });
      },
    };
    const raceApp = express();
    raceApp.use('/api', createApi(store, undefined, delayed));
    const before = (await request(app).get('/api/kits/example').set('Cookie', cookie)).body;
    const generating = request(raceApp)
      .post('/api/kits/example/regenerate')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ revision: before.revision, section: 'technical' })
      .then((r) => r);
    await entered;
    before.kit.company_brief.summary = 'A concurrent user edit that must survive.';
    const edited = await request(app)
      .put('/api/kits/example')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ revision: before.revision, kit: before.kit });
    release();
    expect(edited.status).toBe(200);
    expect((await generating).status).toBe(409);
    const after = (await request(app).get('/api/kits/example').set('Cookie', cookie)).body;
    expect(after.kit.company_brief.summary).toBe('A concurrent user edit that must survive.');
  });
  it('marks changed flashcards as protected even when the client omits the edited flag', async () => {
    const before = (await request(app).get('/api/kits/example').set('Cookie', cookie)).body;
    before.kit.flashcards[0].front = 'My own study card';
    before.kit.flashcards[0].meta = { origin: 'generated', edited: false, pinned: false };
    const saved = await request(app)
      .put('/api/kits/example')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ revision: before.revision, kit: before.kit });
    expect(saved.status).toBe(200);
    expect(saved.body.kit.flashcards[0].meta.edited).toBe(true);
  });
  it('persists confidence and invalidates a logged-out session', async () => {
    const rated = await request(app)
      .post('/api/kits/example/practice')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ card_id: 'f1', confidence: 2 });
    expect(rated.status).toBe(200);
    expect(rated.body.practice.f1.confidence).toBe(2);
    await request(app).post('/api/auth/logout').set('Origin', origin).set('Cookie', cookie);
    expect((await request(app).get('/api/kits').set('Cookie', cookie)).status).toBe(401);
  });
});
