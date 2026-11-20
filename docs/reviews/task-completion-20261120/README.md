# Task completion Chat Check — November 20, 2026

Review requested by the user; no completion-effect implementation change or public deployment is authorized by this review. Application source baseline: `63c269b5800e31f2d30768d02cfa8e9aa53da890`, remotely verified on TEST `codex/axis-first-import-completion-20261120` before submission.

## Fresh local observations

Playwright MCP, ordinary Chromium browser, isolated local-mode demo data at `http://127.0.0.1:8034/`. Desktop 1280×900 Calendar task panel and phone 390×844 Tasks page. The user's preview storage and real records were untouched.

- Completing a task produces a cloned outgoing card, ten particles, and the completed task in its new group. The echo and particles are removed after the effect. No desktop page errors were observed.
- **FAIL:** the copied card loses scoped Due/Work layout styling when appended directly to `document.body`. The desktop screenshot shows oversized calendar/clock icons and overlapping text. In the phone echo, the Due SVG measures approximately 249×249px. Intended live card icon styling is 14×14px under `.motion-preview :is(#daily-task-panel,#view-home,#view-tasks) .task-date-icon` in `calendar-date-clarity.css`.
- **PASS:** local completion survives reload. Desktop undo followed by reload returns the task to incomplete. With reduced motion, completion persists and no echo or particles are created.
- **Source observation, not yet a runtime pass/fail:** `duck-interactions.js` observes checkbox `change`; Calendar compact-preview completion directly calls the store. Review whether this produces inconsistent feedback, and whether asynchronous optimistic mutation/rollback can cause a false success celebration.
- **NOT RUN:** new native WKWebView, physical devices, signed-in latency/failure, keyboard-focus lifecycle, rapid toggles, final-task celebration. The source review must not label these tested.

Screenshots show synthetic built-in demo tasks during the animation, rather than the settled screen. The timed screenshot is a single rendered sample, not a smoothness or frame-rate measurement. An initial phone harness navigation changed the URL hash without triggering application routing; it was corrected to click the actual Tasks navigation button before testing.

## Review focus

Compare the current completion effect against the repository's approved presentation-only completion design: short card exit, bounded golden particles, Sigma duck reaction, meaningful final-task congratulations, undo, reduced-motion support, keyboard focus and accurate saved state. Ask for prioritized source-level causes and concrete implementation/acceptance steps; review only.
