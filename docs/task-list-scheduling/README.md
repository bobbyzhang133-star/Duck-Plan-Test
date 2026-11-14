# Task List checkpoint

Local work from `e304c2c` on `codex/task-list-scheduling-20261113`. The user confirmed removing the rectangular row click flash and drag scheduling from both the standalone Tasks page and Calendar's task column.

Task-title clicks open the existing prefilled editor. Pointer feedback no longer draws the inset rectangle; keyboard focus remains visible. Incomplete tasks drag onto calendar times without creating copies. Holding over Calendar navigation for 400ms opens the timetable. Validated placement preserves the same ID, class/color, deadline, duration, notes and device preferences. Success follows persistence; Undo restores only the previous schedule while preserving subsequent edits. Owner checks, fresh-record reads and cancellation guards protect active drags. Templates retain their separate copy behavior. Touch and keyboard users can schedule through the task editor.

## Verification

- PASS: 61 focused Node tests, including 16 task-drag cases, routing/spring, calendar helpers, panels and PWA checks; syntax and diff checks.
- PASS: all 27 cases in `runtime-results.json`, using `runtime.js`, Chromium 157.0.8103.78, disposable local fixtures and an actual isolated signed-in Worker/D1/Durable Object with migrations 0001–0005. `backend-setup.json` records versions and feature hashes. This does not test production accounts.
- Trusted drags from both lists preserve the same ID/count, fields and exact class color after reload. The standalone case starts without a deadline or work time. Undo retains newer notes; Escape cancels; a fresh click after cancellation works. Both prefilled editors, independent checkboxes, keyboard Enter/focus, normal/reduced row feedback, template copy/source persistence and normal-motion cross-route dragging pass.
- Cloud offline failure shows feedback, rolls back and retains the original persisted schedule after reconnection/reload. The two failed offline requests are expected; there are no page exceptions or unexpected failed requests.
- Touch editor scheduling and reload pass at 320/390/768px without horizontal overflow. These are browser-emulation checks, not physical-device verification.
- The actual in-app Tasks preview loaded eight incomplete draggable rows among 12 existing records. An existing title opened the correct editor, then Cancel closed it without saving. Four completed records and scroll 0 were preserved. Actual user screenshots remain in private temporary storage.

Runtime testing caught and fixed stationary Calendar arrival needing an extra dragover, suppression of a genuinely new click after canceled dragging, and a later reduced-motion selector restoring the press rectangle. Tests now cover dragenter, fresh pointer presses and the reduced-motion visual result. Harness corrections target the visible collapsed-navigation icon, wait for persistence and read fresh DOM after cloud rerenders.

Browser functional evidence used cache v48. The final checkpoint changes only the cache label to v49 so intermediate local clients refresh; final PWA tests pass with v49. The new module is included in the offline shell. `docs/platform-testing/README.md` now includes task-list scheduling acceptance checks.

NOT RUN: production accounts/backend, installed PWA, physical Safari/iPhone/iPad and native WKWebView. No native synchronization or phone update is claimed. The isolated 8796 Worker was stopped; 8034 remains the local preview. No main merge, public deployment or remote migration.

The separate completed sliding-performance review is recorded in `docs/reviews/sliding-lag-2026-11-13.md`. It recommends phase timing and traces of cold preparation while preserving the approved pieces and bounce. No additional sliding redesign was implemented.

Safe stop: implementation and verification complete; documentation and feature-branch backup form this checkpoint. Resume with user review or a new instruction rather than deploying automatically.
