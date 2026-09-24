import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import next from 'next';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { PipelineError } from '../src/core/llm';
import { createApi } from './api';
import { JobWorker } from './jobs';
import { createStore } from './store';

const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
Object.assign(process.env, { NODE_ENV: production ? 'production' : 'development' });
const port = Number(process.env.PORT || 3000);
if (production && (!process.env.APP_ORIGIN || !process.env.APP_ORIGIN.startsWith('https://')))
  throw new Error('Production APP_ORIGIN must be the public HTTPS origin.');
const store = await createStore();
const worker = new JobWorker(store);
const web = next({ dev: !production, port });
await web.prepare();
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: production
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use((req, res, next) => {
  res.locals.requestId = randomUUID();
  res.setHeader('X-Request-ID', res.locals.requestId);
  next();
});
app.use('/api', createApi(store, worker));
app.use('/api', (_req, res) =>
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } }),
);
app.use((req, res) => web.getRequestHandler()(req, res));
app.use(
  (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(
      JSON.stringify({
        event: 'request_failed',
        request_id: res.locals.requestId,
        type: error instanceof Error ? error.name : 'unknown',
      }),
    );
    const invalid = error instanceof ZodError;
    res.status(invalid ? 400 : error instanceof PipelineError ? 503 : 500).json({
      error: {
        code: invalid
          ? 'VALIDATION_ERROR'
          : error instanceof PipelineError
            ? error.code
            : 'INTERNAL_ERROR',
        message: invalid
          ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
          : error instanceof PipelineError
            ? error.message
            : 'Something went wrong. Please retry.',
        request_id: res.locals.requestId,
      },
    });
  },
);
const server = app.listen(port, '0.0.0.0', () =>
  console.info(`Interview Studio ready at http://localhost:${port}`),
);
await worker.recover();
async function shutdown() {
  await worker.stop();
  server.close(async () => {
    await store.close();
    await web.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
