# Interview Studio

A researched, editable interview preparation workspace. Paste a job description, supply a company website and choose a timeline. The application extracts evidenced requirements, discovers company/hiring pages, searches public interview discussion, generates category-specific questions, repairs coverage gaps and builds a deterministic schedule.

Source: [GitHub repository](https://github.com/hcthakur2004/trao-interview-studio). Public app: [interview-studio](https://interview-studio-sxvl.onrender.com). The free hosting tier may need a cold start after inactivity.

The builder preserves user work during regeneration. Practice sessions prioritize unseen and lower-confidence flashcards. The readiness view connects each requirement to its JD evidence, questions and self-reported confidence.

## Run locally

Requires **Node.js 22+** and npm. Use the committed lockfile.

```sh
npm ci
cp .env.example .env
npm run dev
```

On PowerShell, use `Copy-Item .env.example .env` instead of `cp` if desired. Open http://localhost:3000. `/demo` is an explicitly labeled, hand-authored fictional sample. It is never used as an AI fallback and changes there last only for the current visit.

Without credentials, registration, local persistence, the example workspace and deterministic tests work. **Real generation requires GEMINI_API_KEY.** Public interview research requires TAVILY_API_KEY; without it, the kit explicitly reports that search was unavailable. Production requires MongoDB; the development JSON store is intentionally rejected in production.

For local MongoDB, run `docker compose up -d` and set `MONGODB_URI=mongodb://127.0.0.1:27017`. Otherwise create a MongoDB Atlas database and configure its connection URI. Local file accounts do not automatically migrate to MongoDB.

## Credentials and configuration

Never put credentials in chat, source control or browser code. Put them in the ignored `.env` file locally and your hosting provider's secret environment settings in production.

| Variable              | Purpose                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------- |
| GEMINI_API_KEY        | Server-only key from Google AI Studio                                                     |
| GEMINI_MODEL          | Defaults to `gemini-3.5-flash-lite`; verify model availability and your account quota     |
| TAVILY_API_KEY        | Public discussion search; one basic query per kit                                         |
| MONGODB_URI           | Required production persistence connection                                                |
| MONGODB_DATABASE      | Database name, default `trao_interview_studio`                                            |
| APP_ORIGIN            | Exact browser origin, including scheme and development port; required HTTPS in production |
| PORT                  | HTTP port, default 3000                                                                   |
| LLM_MIN_INTERVAL_MS   | Minimum interval between serialized provider requests, default 4500                       |
| LLM_TOKENS_PER_MINUTE | Estimated token budget per rolling minute, default 60000; adjust to your quota            |
| PIPELINE_TIMEOUT_MS   | Per-case total time budget, default 165000 ms                                             |
| EVALUATE_ALLOW_LOCAL  | CLI-only local fixture access; defaults true in evaluation, ignored by web fetches        |
| TRUST_PROXY           | Set to `1` only behind one trusted reverse proxy; otherwise leave `0`                     |

Verified provider documentation on 23 September 2026: [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) lists a free tier for Gemini 3.5 Flash-Lite; [Gemini quotas](https://ai.google.dev/gemini-api/docs/rate-limits) depend on the account/model. [Tavily](https://docs.tavily.com/documentation/api-credits) documents 1,000 free monthly credits without a credit card. These are external policies, not guarantees made by this application. Keep billing disabled if only using free tiers. Review provider data-use terms before submitting confidential job descriptions.

## Exact batch entry point

```sh
npm run evaluate -- --input examples/cases.json --output output/kits.json
```

The command needs no running web server, database, account or build step. It invokes **the same `runPipeline` function used by web jobs**. Environment variables are loaded from `.env`. All logs go to stderr; one JSON file is written atomically after processing all cases.

Input is an array of `{id, jd, company_url, days}`. Output is `{version:"1.0", generated_at, kits:[{id,status,kit,error}]}`. Successful entries have `status:"ok"` and `error:null`; failed entries have `status:"failed"`, `kit:null` and a structured error. A failed case never aborts subsequent cases. Missing research alone is not failure.

To use the local cases in `examples/cases.json`, start the fixture website in another terminal:

```sh
npx tsx scripts/fixture-site.ts
```

Local addresses are accepted only by the CLI's explicit evaluation policy. The public API always rejects private/loopback addresses, independent of this environment setting. The per-case 165-second budget leaves approximately 75 seconds of margin across five sequential cases for file I/O. **Successful five-case live throughput must be measured with the configured provider; a timeout is a failure, not a substitute for that benchmark.**

## Architecture and stack

TypeScript throughout; Next.js App Router and Tailwind CSS for the UI, Express for HTTP and MongoDB for production persistence. An Express custom server serves Next.js and the API on the same origin, simplifying secure cookies and CSRF checks. The container is a conventional long-lived Node process, not a serverless function.

```text
Next.js UI → Express /api → persisted job worker ─┐
                                                ├→ runPipeline → validated kit
evaluate CLI ────────────────────────────────────┘

src/core/contracts.ts      Exact Appendix A schema + relationship checks
src/core/retrieval.ts      DNS validation, bounded fetch, robots, link discovery, search
src/core/llm.ts            Structured Gemini output, shared queue, pacing, retries
src/core/pipeline.ts       Extraction, research, category generation, coverage repair
src/core/deterministic.ts  Coverage, schedules, protected merges, practice ordering
server/                   Authentication, API, storage, durable jobs
src/components/           Workspace and builder interaction boundaries
tests/                    Behavioral, pipeline, retrieval and API tests
```

## Research and generation sequence

1. Extract requirements from the pasted JD, including exact evidence quotes. Assign stable hashed IDs. Reject evidence absent from the source. Preserve explicit alternatives and must/nice priority. Unknown metadata remains empty; company pages cannot become JD requirements.
2. Fetch robots.txt and the supplied entry page. Parse real links and rank hiring/interview/handbook/careers/about context. Follow relative links through up to three discovery levels, with at most nine visited URLs and six accepted pages. Paths are discovered, not guessed.
3. Search public interview discussion using Tavily. Keep source URLs and clearly label third-party reports as anecdotal. Record missing credentials, no results or search failure honestly.
4. Generate questions separately by relevant category, using the actual hiring research. Behavioural prompts use past-experience/STAR guidance; architecture requirements use system-design guidance.
5. Compute coverage as a set difference in code. Generate only for missing requirements and recheck, with at most two repair rounds beyond the first draft. Record actual pass counts and gap IDs. Uncovered must-have requirements cause an explicit failure after the repair budget.
6. Write a company brief only from retrieved sources. With no pages, return an honest unavailable-research brief.
7. Derive flashcards from question/answer pairs rather than spend an extra LLM call on the same information.
8. Allocate the schedule in code; validate the entire kit's shape and references before persistence/export.

Retrieved material and JD text are untrusted prompt data. The model receives no tools and no application secrets. Structured output is validated with Zod; malformed/incomplete output receives bounded repair attempts. Exact evidence matching reduces fabrication but cannot prove that the model's paraphrase is semantically faithful; this remains a limitation to examine during live evaluation.

Sources used by a real kit appear in `source.pages_used`, `company_brief.sources`, and the research panel. Tests use local fictional sites. The sample UI is explicitly fictional. A bounded HTML crawler will not fully research JavaScript-only websites or pages hidden behind authentication, and conservatively skips origins when robots policy cannot be established.

## Editing and regeneration

Each question has a stable ID and metadata: `origin`, `edited`, and `pinned`. Manual, edited and pinned questions are protected. The server independently detects changed question content; a client cannot accidentally erase protection by forgetting an edited flag. Deletion tombstones prevent exact deleted prompts from being recreated. Regeneration replaces only untouched generated content in the chosen category; other sections stay intact except dependent schedule-reference repair.

Writes use a monotonically increasing kit revision and compare-and-swap in MongoDB. Regeneration works against a revision snapshot and refuses a stale commit. If another tab edits during generation, its saved work wins and the generated result is discarded with an actionable conflict message. The UI temporarily disables builder fields during its own regeneration and debounces edits, showing saving/failure states. Unsaved navigation is blocked until a flush succeeds.

Schedule references to removed questions are removed; new questions are allocated into a low-load day. Explicit deletions may create coverage gaps, which remain visible rather than silently recreating deleted questions. The coverage field is always recomputed before save. User-edited kits may be incomplete; freshly generated kits must cover every must-have.

## Deterministic schedule and practice

Questions sort by must-have priority, then difficulty, then stable ID. Contiguous balanced partitions distribute initial exposure across the requested days. Difficulty maps to 10/20/30 minutes for initial work. If there are more days than questions, later days revisit existing material at half the initial effort. One day contains all material with an honest total. An empty extraction yields exactly the requested days with zero allocated minutes and a clarification focus.

Practice prioritizes unseen cards, then lower confidence, then older reviews. Ratings are persisted separately from generated content in the kit record. This is intentionally simple and explainable rather than a spaced-repetition model requiring more history. The readiness view is self-reported confidence, not a hiring probability.

## Reliability and security

- scrypt password hashing, random opaque server-side sessions, HttpOnly/SameSite cookies and Secure cookies in production; session expiry and logout invalidation.
- Exact-origin checks on writes, ownership checks for kits/jobs/practice, request and auth rate limits, and bounded JSON bodies.
- HTTP(S)-only fetching, credential URL rejection, all-answer DNS checks, pinned validated addresses per connection, redirect revalidation, type/byte/time limits, and robots policy.
- Provider requests serialized with minimum spacing and estimated token budgeting; bounded backoff and Retry-After handling; each case has a total deadline.
- Durable queued/running jobs and checkpoints. Restart requeues interrupted jobs; extraction/research/completed question rounds can resume.
- Identical owner/input/day/model-version requests reuse an existing active/completed job. User data is never deduplicated across accounts.
- Structured operational logs include request/job IDs and timings, without prompts, passwords, API keys or connection strings.

**Deployment boundary:** one application instance owns the in-process queue. This is a deliberate take-home scope choice. Horizontal scaling needs database-backed leases, distributed rate limits and a shared provider budget. The development file store is not production infrastructure. Browser sessions have a fixed seven-day lifetime. There is no email verification or password reset, as these are out of scope.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

Tests cover schema/reference integrity; 1/5/7/60-day schedules; priority ordering; honest empty extraction; real second-pass orchestration with an injected deterministic model; unrepairable coverage; nested relative hiring discovery; robots exclusions; unsafe addresses/types/sizes; protected regeneration; ownership isolation; stale writes; confidence persistence; and logout.

Injected test models are used only in tests. Live verification with Gemini, Tavily and Atlas is recorded in `docs/VERIFICATION.md`, including the five-case benchmark, real browser editing and public Render deployment.

## Production deployment

The supplied Dockerfile builds and runs the complete frontend/backend in one container as a non-root user. Set `MONGODB_URI`, `GEMINI_API_KEY`, `TAVILY_API_KEY` and `APP_ORIGIN` as host secrets; do not bake them into the image. Expose port 3000, use HTTPS, and route health checks to `/api/health`. Set `TRUST_PROXY=1` only if exactly one trusted proxy sits in front of the process. Build with `docker build -t interview-studio .`.

For a Node web-service host, use Node 22+, build command `npm ci && npm run build`, and start command `npm start`. Configure `APP_ORIGIN` to its final HTTPS URL. Keep one instance. Free hosts may sleep; durable jobs resume when the process restarts, but the user's generation can be delayed. Check current plan limits and verify a complete generation on the public deployment before submitting.


