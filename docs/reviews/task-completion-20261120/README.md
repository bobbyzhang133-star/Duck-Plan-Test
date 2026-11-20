# Task completion Chat Check — November 20, 2026

Review requested by the user; no completion-effect implementation change or public deployment is authorized by this review. Application source baseline: `63c269b5800e31f2d30768d02cfa8e9aa53da890`, remotely verified on TEST `codex/axis-first-import-completion-20261120` before submission.

## Completed external review

Sent to the established [Repository Overview conversation](https://chatgpt.com/g/g-p-6addac00e55c8191a3f6db4456733345-duck-plan/c/6addacc2-3bc4-83e8-8f06-cdbedefe067c) in Chrome after the conversation connector could not retrieve it. The reviewer completed a source/design review of remotely verified TEST commit `baef51d8663f343302e9be1209021e025ed8ab6f`, which adds only this evidence directory to the source baseline. The reviewer inspected the exact-commit screenshots and source; it did not rerun tests, access localhost or verify native runtime performance.

Its prioritized findings and recommended sequence:

1. **P1, visually verified:** detached completion cards lose their ancestor-dependent styling. Fix the snapshot's CSS/layout inheritance first, keeping the existing 430ms exit and ten-particle ordinary burst. Give it self-contained card/date styling, preserving source geometry, 14px icons, inert/hidden semantics and cleanup. Compare mid-animation frames at the same desktop/phone sizes before motion tuning.
2. **Source-level persistence concern:** the checkbox observer checks optimistic state in a zero-delay timer rather than the persistence result. A delayed failed cloud save can be acknowledged prematurely. Keep the checkbox responsive, but associate success effects with a confirmed user operation. Validate owner/view/geometry before using an old card location after a slow save. A real signed-in failure was not exercised in this review.
3. **Source-level entry-point inconsistency:** Calendar preview calls the store directly rather than emitting the checkbox change observed by the effects layer. Share a presentation-only completion coordinator across entry points, using an appropriate local effect rather than inventing a checkbox event. Do not celebrate ordinary reloads, remote updates or automatic Axis imports.
4. **Further robustness:** add an explicit Undo action through the existing toast action API; guard per-task operation generations, reopening, route/account changes and stale timers. Broaden focus testing beyond the basic case and validate final-task notice placement against phone navigation. These are source recommendations and untested edge-case risks, not all demonstrated runtime failures.
5. **Preserve restraint:** keep finite effects, reduced-motion/motion-off behavior, approved Sigma artwork and the small dismissible final-task note. Dashboard mascot changes are not necessarily visible from Calendar/Tasks; optional local feedback should not become a large permanent overlay. Smoothness/low-powered-device parity needs rendered-frame and native checks, not the supplied static screenshots.

The full response and acceptance matrix remain in the linked conversation. No review recommendations were implemented during this Chat Check.

## Fresh local observations

Playwright MCP, ordinary Chromium browser, isolated local-mode demo data at `http://127.0.0.1:8034/`. Desktop 1280×900 Calendar task panel and phone 390×844 Tasks page. The user's preview storage and real records were untouched.

- Completing a task produces a cloned outgoing card, ten particles, and the completed task in its new group. The echo and particles are removed after the effect. No desktop page errors were observed.
- **FAIL:** the copied card loses scoped Due/Work layout styling when appended directly to `document.body`. The desktop screenshot shows oversized calendar/clock icons and overlapping text. In the phone echo, the Due SVG measures approximately 249×249px. Intended live card icon styling is 14×14px under `.motion-preview :is(#daily-task-panel,#view-home,#view-tasks) .task-date-icon` in `calendar-date-clarity.css`.
- **PASS:** local completion survives reload. Desktop undo followed by reload returns the task to incomplete. With reduced motion, completion persists and no echo or particles are created.
- **Source observation, not yet a runtime pass/fail:** `duck-interactions.js` observes checkbox `change`; Calendar compact-preview completion directly calls the store. Review whether this produces inconsistent feedback, and whether asynchronous optimistic mutation/rollback can cause a false success celebration.
- **NOT RUN:** new native WKWebView, physical devices, signed-in latency/failure, keyboard-focus lifecycle, rapid toggles, final-task celebration. The source review must not label these tested.

Additional checks completed after the request was sent: Chromium **157.0.8103.79**, phone Tasks page in reduced motion. Space completion retained focus on the task checkbox; completing the final unfinished task displayed the note; reopening it hid the note. These are narrow local-mode passes, not full keyboard/notification-positioning coverage. The earlier NOT RUN exclusions describe the evidence originally supplied to the external reviewer; native, physical-device, signed-in failure and rapid-toggle checks remain NOT RUN.

Existing `node --test tests/calendar-task-preview.test.cjs tests/planner-store.test.cjs`: **24 passed, 0 failed**. These unit checks cover preview/store behavior, including preview failure/owner handling, and do not exercise the actual browser completion animation or establish native parity.

Screenshots show synthetic built-in demo tasks during the animation, rather than the settled screen. The timed screenshot is a single rendered sample, not a smoothness or frame-rate measurement. An initial phone harness navigation changed the URL hash without triggering application routing; it was corrected to click the actual Tasks navigation button before testing.

## Review focus

Compare the current completion effect against the repository's approved presentation-only completion design: short card exit, bounded golden particles, Sigma duck reaction, meaningful final-task congratulations, undo, reduced-motion support, keyboard focus and accurate saved state. Ask for prioritized source-level causes and concrete implementation/acceptance steps; review only.
