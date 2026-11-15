# Safe checkpoint — November 14, 2026

Historical pause record. The user resumed on November 15; subsequent corrections and verification are recorded in [the follow-up](RESUME-2026-11-15.md).

Stopped at the user's explicit request. Implementation and evidence are preserved on `codex/calendar-date-clarity-20261114`, based on `567d6c2cd59c177460849607bea7ee46d19c5578`. This is a local website checkpoint and TEST feature-branch backup, not a release certification.

## Completed

- Applied the newer Calendar due/work clarity recommendations: exclusive primary task groups, both dates, exact work-end/deadline warnings, deadline overflow and distinct Month occurrences with completed items retained.
- Applied the user's confirmed compact Calendar preview with Edit, Reschedule and Complete/reopen actions, and removed the colored work-block stripe while preserving class fills and selected-day shading.
- Preserved the existing 24-hour calendar, phone Tasks sheet, desktop/iPad unified layout, motion, approved artwork, saved task IDs/deadlines and manual alert preferences. Recommend Schedule remains a separate rule-based implementation plan.

## Verification at stop

- PASS: full Node suite, 456 tests; 47 landing JavaScript syntax checks.
- PASS: 37 focused tests after the final narrow-gutter label change. Exact source hashes and distinction between full-suite/final-source runs are in `verification.json`.
- PASS: eight affected Chromium browser cases, four local and four signed into a real isolated local Worker/D1 (schema 0001–0006), across desktop/tablet/phone sizes, light/dark and motion preferences. These are automated action/layout/persistence checks, not unconditional visual approval; see `runtime.json` and `runtime-ledger.json`.
- PASS: actual existing in-app browser preview opened read-only and closed; Week restored, no open dialog, seven saved unfinished tasks retained and no real task edits/completions.
- OPEN visual follow-up: busy-day flag/clock markers slightly crowd or bleed into an adjacent Month cell at 320px. Page-overflow assertions pass, but this intra-cell issue still needs correction. Evidence: `month-local-320.png`.
- NOT RUN: service-worker v56 offline/reload acceptance for the four new assets; precise phone Due-gutter bounds and Reschedule keyboard-focus smoke. No new checks started after the stop request.
- NOT RUN: native WKWebView, physical iPhone/iPad/Safari, installed PWA and the full unrelated platform baseline. No app source sync or phone installation occurred.

## Cleanup and resume

All eight synthetic browser contexts are closed. The owned QA Worker on port 8796 is stopped; the user's existing local preview on port 8034 remains running. User planner data, sibling checkouts, backend/schema and native signing are unchanged. No main merge, public deployment or remote migration occurred.

When the user resumes, start with the recorded 320px Month-cell visual issue and pending affected checks. Reuse the confirmed interaction choices; do not repeat or extend completed checks without a change or unresolved concern. Keep the local publication boundary and platform evidence labels.
