# Copy-ready completion prompt

```text
Continue and finish the Trao Interview Studio assignment in:
C:\Users\Harish\OneDrive\Desktop\development 2.0\Trao

Read docs/TESTING_HANDOFF.md end to end first, then README.md, IMPLEMENTATION_PLAN.md, docs/VERIFICATION.md, docs/SUBMISSION_CHECKLIST.md, docs/WALKTHROUGH.md and the assignment PDF. Inspect current Git state and preserve unrelated user files.

Gemini, MongoDB Atlas and Tavily are already configured in the ignored .env. Do not overwrite it, print secrets or ask me to provide the same keys again. Live generation, five-case CLI (183.669 seconds), Atlas application persistence and real browser editing/regeneration have passed; see docs/VERIFICATION.md and docs/TEST_RESULTS.md. The baseline is 56 passing tests, a passing typecheck/build, and zero production dependency audit findings. Never infer public deployment from local success or the fictional demo.

Execute the complete testing handoff: automated checks, real five-case benchmark under 15 minutes including retries, schema/reference and generated-content review, Atlas persistence/restart behavior, real browser user flows, inline editing and protected regeneration, concurrency/save conflicts, flashcards, schedules, research, owner isolation, controlled failure handling, accessibility and mobile layout. Fix confirmed defects, add meaningful regression coverage, and retest affected flows. Do not substitute sample content for failed generation or weaken requirements to pass a test.

Use Node 22+ and the documented Windows runtime if needed. Check existing project processes before starting or stopping servers. Use controlled mocks for failure/abuse cases rather than exhausting provider quotas or probing real private endpoints. Do not create paid resources, broaden network access or publish sensitive data. Preserve the existing free Atlas cluster and keep secrets server-side. Deployment/account actions must respect the user's authorization and any required confirmations.

Maintain docs/TEST_RESULTS.md with exact commands, timestamps, expected/actual results, elapsed time, sanitized evidence and PASS/FAIL/BLOCKED/NOT RUN states. Keep raw outputs in ignored output/verification/. Update outdated verification and submission docs. Complete all work that is possible without missing external access; identify concrete blockers only after investigating them.

Prepare the source repository and deployment configuration, and verify the public application if an authorized hosting destination is available. If it isn't, report that exact missing input without claiming deployment. Prepare the walkthrough so I can explain the design myself. Do not record fake outcomes or submit the hiring form for me.

Finish with a concise report: what changed, what actually passed, real five-case timing/results, remaining issues, and usable local/public links. The objective is a strong, honestly verified submission; do not promise selection.
```
