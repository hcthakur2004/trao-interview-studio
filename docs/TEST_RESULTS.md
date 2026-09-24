# Test results — 25 September 2026

This is the execution record for the [manual test plan](TESTING_HANDOFF.md). The supplied assignment PDF was checked against the implementation and batch contract. Secrets, session tokens and raw user data are absent from this document. Full generated kits are in ignored `output/verification/` and are intentionally excluded from Git.

| Check | Result | Evidence / limit |
| --- | --- | --- |
| TypeScript and optimized Next bundle | PASS | `npm run typecheck`; `npm run build` with Next 16.3.6. |
| Behavioral tests | PASS | Final full suite 59/59 tests across 5 files; provider regression 7/7. |
| Production dependency audit | PASS | `npm audit --omit=dev --audit-level=high` returned zero findings on 24 September. |
| Gemini generation | PASS | `gemini-3.5-flash-lite` returned structured content; the originally configured 2.5 model returned HTTP 404. |
| Atlas connectivity and real data | PASS | Database ping; real GitLab kit generated and saved; duplicate registration rejected; owner-scoped reads/writes/regeneration/practice; stale revision and foreign-origin writes rejected; unique and TTL indexes confirmed; independent connection read; logout invalidation. |
| Browser create/edit/regenerate | PASS | Real GitLab kit in local web app. Edited/pinned/reordered questions, moved a question to another category, added a manual question, regenerated the category and observed all protected questions retained in a new browser session. Rated a real flashcard low confidence and saw 1/3 reviewed after reload; no console errors in final check. |
| Browser sample/practice/responsive | PASS | Fictional demo tested for card reveal/confidence, weak-first order, one-day plan and mobile navigation at 390px. |
| Five-case CLI | PASS | Network-enabled final run completed 5/5 cases in **183.669 seconds**, with 0 failed entries. Each kit passed `validateKit`, JD evidence and requested day counts. |
| Public host and HTTPS flow | PASS | Render Free web service at `https://interview-studio-sxvl.onrender.com`; `/api/health` reported MongoDB plus Gemini/Tavily configured. Disposable account generated and persisted a real PostHog kit with 3 evidenced requirements and complete coverage. Question edit, pin, category regeneration and reload passed. Flashcard and schedule sync fix is under final redeployment check. |
| Docker container | NOT RUN | Docker is unavailable on this computer; production Next build passed. |
| Candidate video and form | NOT RUN | Candidate must present the project and submit the actual URLs. |

The initial 25 September timed rerun ran without provider network access and yielded five `INVALID_MODEL_OUTPUT` errors. A focused diagnostic showed the underlying error was `fetch failed`. The transport path now returns `PROVIDER_UNAVAILABLE` after bounded retries, with a regression test. The subsequent network-enabled run is the successful benchmark above; the failed run is not counted as success.

The five evaluation inputs in `examples/cases.json` cover public frontend and backend companies, a thin JD, a 60-day no-hiring-page case and nested hiring discovery. The final export passed `validateKit` for every kit, exact requested day counts, JD-contained requirement evidence, and must-have question coverage. It produced requirement/question/page counts of 6/6/6, 5/5/6, 0/0/1, 4/4/1 and 5/5/3. All had zero uncovered requirements and one actual coverage pass. The deterministic pipeline suite forces a missing requirement and verifies a second repair pass and explicit failure when repair remains incomplete. Backend search returned four discussion links; frontend search returned none and reported that gap. The local-company cases stated why discussion search was skipped.

Additional manual checks specified in the handoff remain unexecuted unless explicitly marked above. In particular, keyboard-only navigation, slow-generation restart/recovery, invalid file upload, real browser save failure and candidate video recording should not be represented as passed.
