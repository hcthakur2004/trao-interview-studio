# Verification record

Verified locally on 24–25 September 2026 with Node 24.19.0 on Windows. This record distinguishes executed checks from submission work that still needs an external host or the candidate.

| Check | Result |
| --- | --- |
| TypeScript (`npm run typecheck`) | Passed, 25 September |
| Behavioral tests (`npm test`) | 56 passed across 5 files, 25 September |
| Production bundle (`npm run build`) | Passed, Next.js 16.3.6, 25 September |
| Production dependency audit (`npm audit --omit=dev --audit-level=high`) | 0 vulnerabilities reported, 24 September |
| Gemini live structured generation | HTTP 200 with `gemini-3.5-flash-lite`; provider-side unsupported JSON-schema bounds removed, local Zod checks retained |
| Tavily live search | HTTP 200; actual discussion links used for public-company cases |
| Five-case CLI | Five successful kits, no failed entries in 183.669 seconds on 25 September |
| Export contract | `validateKit` accepted all five; exact day counts, unique/reference consistency, complete must-have coverage and JD-contained evidence quotes checked |
| Atlas integration | Authentication and ping, concurrent duplicate-account rejection, owner isolation, session TTL and unique indexes, stale revision rejection, and independent-connection persistence passed |
| Browser UI | Real GitLab kit generated and saved in Atlas. Editing, pinning, moving category, adding manual question and category regeneration exercised; protected questions survived a new browser session. Real flashcard confidence persisted across reload. Earlier demo pass covered one-day plan and mobile navigation. No browser console errors observed in the final local check. |

The live CLI cases cover a public frontend role, a public backend role, a deliberately thin description, a 60-day plan with no hiring page, and a relative-link nested hiring page. Their exported kits contain respectively 6/5/0/4/5 extracted requirements, 6/5/0/4/5 questions and 6/6/1/1/3 retrieved pages. A thin JD produced zero invented requirements. The frontend case honestly reported no public interview discussion; the backend case used four discussion links. The no-hiring and nested-fixture cases explicitly report that public discussion search was skipped because no identifiable public company was supplied. All generated kits had zero uncovered requirement IDs and one genuine pass; deterministic pipeline tests demonstrate the second-pass repair mechanism and the unresolved-gap failure case.

Tests cover schema and reference integrity, scheduling edge cases, coverage repair and failure, protected regeneration, ownership, stale writes, provider retries/cancellation, retrieval limits, relative-link discovery and robots checks before redirect destinations are fetched. Controlled provider tests are distinct from the live five-case run. The initial configured model (`gemini-2.5-flash-lite`) returned HTTP 404 for generation on this account; switching to `gemini-3.5-flash-lite` and simplifying the provider response schema resolved that failure.

## Still required before submission

- Deploy the Node application with MongoDB and HTTPS; run a complete account/generation/edit/practice flow on the public URL. The local passing build is not a deployed service.
- Publish a reviewed repository that excludes `.env`, local outputs and user documents.
- Have the candidate record the 3–4 minute walkthrough using `docs/WALKTHROUGH.md`, then add the real URLs to the README and submit them through the supplied form.
- Rotate credentials shared in chat before public deployment and set them as host-side secrets. The development `.env` remains ignored.

Docker execution has not been verified because Docker is unavailable on this machine. The dependency audit is a point-in-time registry check, not a claim that the application is vulnerability-free.
