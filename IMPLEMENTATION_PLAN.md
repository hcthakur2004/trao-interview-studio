# Trao assessment implementation plan

Based on all 11 pages of software-engineer-assignment.pdf and the supplied email. This is a proposed implementation plan, not an implemented application.

## Deadline and deliverables

- Email timestamp: 22 September 2026, 12:48. Four-day deadline implies 26 September 2026, 12:48 in the email display timezone; confirm timezone before relying on it.
- Email permits late work with deductions, but PDF says the link expires after four days. Plan for the stricter deadline. Target submission on 25 September evening.
- Submit repository with genuine development history, public working deployment, README, and a 3–4 minute walkthrough.
- Submission form could not be inspected with the web tool; fields and availability remain unverified.
- AI assistance is permitted. Candidate must understand, validate, test, and explain the implementation.

## Scoring priorities

| Area | Points | Proof to produce |
| --- | ---: | --- |
| Requirement extraction | 20 | Grounded requirements, correct must/nice labels, thin-JD honesty |
| Coverage and schedule | 15 | Deterministic gap check and repair; exact requested day count |
| Research and sequencing | 10 | Real crawl, hiring discovery, public search, category-specific generation |
| Robustness | 10 | Valid output, bounded retries, partial research handling, passing tests |
| Builder | 15 | Edit/add/delete/reorder/move and regeneration preserving user work |
| Interaction design | 10 | Progress, recoverable failures, responsive layout, keyboard use |
| Code and reasoning | 10 | Shared pipeline, clear boundaries, defensible README |
| Practice and creativity | 10 | Reveal/confidence/coverage/weak-first sessions; optional useful feature |

## Proposed architecture

Use the preferred stack: Next.js, Tailwind, Express, MongoDB, TypeScript. Choose a genuine free-tier LLM and a permitted public-search source only after verifying current availability, quotas, and credentials. Prove five-case throughput early. Do not add an agent framework or vector database without a demonstrated need.

Suggested workspace boundaries:

- apps/web: authentication screens, dashboard, input/import, generation progress, builder, practice.
- apps/api: session/auth checks, owner-scoped endpoints, job lifecycle, persistence.
- packages/core: extraction, retrieval, research, generation, deterministic coverage/scheduling, regeneration merging.
- packages/contracts: Appendix A/B schemas and request validation.
- scripts/evaluate.ts: exact CLI, invoking the same core pipeline.
- tests/fixtures: unseen-style JDs, local company websites, provider responses and failures.

Use a persisted generation-job record with stage, warnings, checkpoints and failure reason. Return a job ID promptly; poll progress initially. A bounded worker resumes durable checkpoints after interruption. Keep evaluate independent of UI, authentication and a running web server; document whether any infrastructure is actually required. Prefer no database dependency for evaluation.

Deploy a minimal frontend/backend/database integration on the first day to discover hosting limitations early. Verify worker lifetime and free-tier constraints before selecting deployment providers. Keep production browser and API same-origin through routing/proxying if practical.

## Exact output contracts

Implement Appendix A as the canonical runtime schema, preserving every listed field:

- source: company, company_url, role, location, jd_chars, researched_at, pages_used.
- company_brief: summary, what_they_do, sources.
- role: title, seniority, responsibilities, requirements.
- requirement: id, text, kind (technical/behavioural/domain), priority (must/nice).
- question: id, requirement_ids, category (technical/behavioural/system-design/company-fit), prompt, answer_outline, difficulty (integer 1–3).
- flashcard: id, front, back, requirement_ids.
- schedule: days_available, days; each day: day, focus, question_ids, minutes (integer).
- coverage: uncovered_requirement_ids, passes.

Validate stable unique IDs, valid references, sequential days, exact day count, and must-have coverage in both questions and schedule. Extensions may carry warnings, evidence, research steps and editing metadata without renaming required fields.

The root command must work exactly:

```sh
npm run evaluate -- --input <cases.json> --output <kits.json>
```

Input: array of {id, jd, company_url, days}. Output: {version: "1.0", generated_at, kits: [{id, status, kit, error}]}. One result per case; success has error:null, failure has kit:null and structured code/message. Isolate individual case failures. Complete five cases in under 15 minutes including retries. Use only documented credentials and install steps from a clean clone.

## Research and generation sequence

1. Validate input, normalize URLs, fingerprint requests, initialize stages and time budget.
2. Extract requirements from the pasted JD. Keep evidence excerpts and deterministic IDs. Separate explicit must-haves and nice-to-haves; do not promote company-page content into JD requirements. Unspecified company/location/seniority stays unknown.
3. Fetch robots.txt and company entry page. Clean HTML; resolve relative URLs using their actual page URL. Rank discovered links by link text, URL and context; prioritize about, hiring, careers, handbook and engineering content. Fixed guessed paths are not the discovery algorithm. Bound pages, depth, bytes and time.
4. Search for public interview-process discussion using an actual permitted search/retrieval path. Record query/source/outcome. Distinguish unofficial reports from company-published facts; no results is a valid outcome.
5. Build an evidence-grounded company brief and interview-process context, recording unavailable sources honestly.
6. Generate questions in separate category-specific calls, receiving relevant requirement IDs and research context. Group related requirements to control token costs; do not generate the whole kit with one prompt.
7. Check coverage in code: extracted IDs minus IDs referenced by valid questions. Reject nonexistent IDs. Record actual gaps and passes.
8. Generate questions specifically for uncovered requirements, then recheck. Start with at most two repair rounds beyond the first draft; tune using measured runtime. Never silently label an uncovered must-have as complete. If the budget is exhausted, retain a diagnosable incomplete job rather than fabricate coverage.
9. Generate grounded flashcards and allocate schedule in code.
10. Validate the full schema and relationships before saving/exporting.

Missing research alone must not fail a case. An unreachable company site can still yield a useful JD-based kit with explicit warnings. Appendix B's COMPANY_UNREACHABLE failure is illustrative; its accompanying text and FAQ reserve failed for inability to produce a kit at all.

## Scheduling policy

- Sort topics by must-have priority and question difficulty, with deterministic tie-breakers.
- Assign integer effort estimates and distribute across exactly the requested number of days, putting difficult/high-priority first exposure earlier.
- Ensure every must-have has at least one scheduled question.
- One day includes all necessary material with an honest total duration, not an invented daily cap.
- For long schedules with little content, reuse question IDs for review; never invent requirements to fill 60 days.
- With no extractable requirements, provide an honest minimal schedule and useful focus text without invented question references; document whether empty days use zero minutes.
- Revalidate references and coverage after question edits, deletion, moving or regeneration; show user-induced gaps visibly instead of secretly reversing a deletion.

## Builder and regeneration policy

Store stable entity IDs, origin (generated/manual), edited flag, pinned flag and revision. Treat manual, edited and pinned questions as protected during category regeneration. Replacing untouched generated questions must preserve protected question order and all other sections.

Generate against a section revision snapshot. Apply a targeted patch only after checking the current revision; if the user edited during generation, merge safely or present a conflict. Never overwrite the whole kit with stale generated data. Keep deletion tombstones where needed so regeneration does not casually restore deleted content.

Use immediate local edits, debounced persistence and visible Saving/Saved/Failed state. Include buttons for keyboard-accessible reordering, even if drag-and-drop is added. Repair stale schedule references when generated question IDs change and disclose any dependent schedule update.

## UX and practice

- Dashboard: user's own kits, resumable generation, empty state, clear failure/retry.
- New kit: JD, company URL, days; JSON multi-case import with row-level errors.
- Progress: concrete stages and source warnings; reload preserves job progress.
- Builder: company brief, role, categorized questions, flashcards, schedule, sources/coverage.
- Inline edits, add/delete, reorder, category moves, section regeneration and protected-state indicator.
- Practice: reveal answer, confidence rating, unseen/reviewed counts, least-confident-first next session with unseen cards prioritized sensibly.
- Responsive laptop/mobile layout, semantic labels, focus management, keyboard flows.
- Optional final feature: evidence-linked readiness view connecting each requirement to questions and practice confidence. Label confidence as self-reported, not a hiring probability.

## Reliability and security

- Hash passwords; secure HttpOnly session cookies; server-side expiry/logout; owner checks on every kit/job/practice endpoint; protect cookie-authenticated writes against CSRF.
- Validate URL scheme, host and resolved addresses before fetching; revalidate redirects and connections against private/loopback targets in production. Bound content types, bytes, time and redirect count.
- Evaluation must support local fixture sites and relative links. Provide an explicit CLI-only local-fetch policy; never expose a public request flag that bypasses production restrictions.
- Treat JD/page content as untrusted data in prompts. No page can grant tools, change policy, or provide executable instructions. Sanitize rendered content.
- Provider queue with token-aware pacing, Retry-After support, exponential backoff with jitter, bounded retries and total budget.
- Validate model JSON; bounded structured repair rather than infinite retries. Never conceal fabricated output behind a successful status.
- Cache public retrieval with TTL; deduplicate identical in-flight requests using normalized input, days and pipeline/model version. Keep user edits and private outputs isolated across users.
- Document all environment variables, source limitations and deployment constraints; never commit credentials.

## Milestones and acceptance gates

### 23 September: contract and working pipeline

Schema, exact evaluate CLI, extraction, discovery crawler, public search, category generation, gap repair and deterministic scheduling. Establish tests as these modules are built. Deploy skeleton early. Gate: one real case and one thin local-fixture case produce valid kits; missing hiring page is nonfatal.

### 24 September: full application and builder

Authentication, persistence, jobs/progress, input/import, builder editing and safe regeneration. Gate: create/reopen/edit a kit, regenerate its category, and prove edited/manual/pinned items survive; cross-user access fails.

### 25 September: practice, hardening and submission

Practice mode, mobile/keyboard pass, fault tests, clean-clone batch benchmark, documentation and video. Add readiness feature only if mandatory gates pass. Target submission that evening.

### 26 September before 12:48: contingency only

Deployment or submission recovery; no new scope. Confirm actual deadline timezone.

## Required verification matrix

- Schema: missing fields, enum errors, fractional minutes, difficulty bounds, duplicate IDs, dangling references.
- Extraction: mixed must/nice, technical/behavioural/domain requirements, two-line stub, no invented seniority/skills.
- Coverage: deliberate first-pass omission triggers real repair; no fake gap staged solely for the demo.
- Schedule: 1/5/60 days, must coverage, earlier hard topics, valid references, deterministic results, empty requirements.
- Crawl: relative nested links, unguessable hiring path, no hiring page, robots exclusion, 404, timeout, redirect restrictions, oversized/wrong-type content.
- LLM: invalid JSON, incomplete response, 429/Retry-After, temporary failure, exhausted budget.
- Builder: edit during regeneration, other-section preservation, manual/pinned preservation, deletion and category moves, autosave failure.
- Auth: signed-out access, expired session, user A accessing user B's IDs.
- Batch: one failed case does not stop the others; five diverse cases within 15 minutes from clean clone using real provider; local fixture crawl enabled only in evaluation policy.
- Deployment: registration through practice on public frontend/API, refresh/reopen, no exposed credentials.

## README and demo

README covers stack/setup, exact batch command and file shapes, environment variables/provider/model, architecture, sources/crawl, pipeline steps and repair limit, edited/pinned state, schedule arithmetic, concurrency/retries/deduplication, tests, trade-offs and known limitations.

Suggested 3–4 minute video: input and generation (35 seconds); research trace and genuine repair example (45 seconds); editing/reordering/regeneration preserving work (60 seconds); practice/schedule (40 seconds); optional readiness view and one defensible design choice (30 seconds). Disclose time cuts in long-running generation. Show an actual repair trace or clearly identified reproducible test fixture, never simulated success presented as live behavior.

Do not spend the timebox on CV parsing, job aggregation, job applications, audio/video interviews, payments, team sharing, password reset or email verification. Make meaningful commits as work is completed; do not manufacture history afterward.
