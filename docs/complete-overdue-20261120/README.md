# One-click completion of overdue tasks — local checkpoint

November 20, 2026. Website branch `codex/complete-overdue-20261120` (parent `523bf94`); existing app branch `codex/native-complete-overdue-20261120` (parent `f8c50fd`). Cache 100; app/styles asset key `complete-overdue-20261120`.

## Behavior

“Complete all overdue” appears beneath Calendar's Overdue heading and above the Tasks list. One click completes every currently unfinished past-deadline task across dates/classes, independent of the selected calendar date, search or task filter. Timed deadlines earlier today qualify. Date-only tasks due today remain open until their existing end-of-day deadline passes. No-deadline, future, completed and deleted tasks are excluded. Notes, work times, due dates, classes and other task details are preserved.

The action uses the existing persisted completion path sequentially, with both buttons disabled while saving. It snapshots candidate IDs and rechecks each deadline before writing, excludes tasks added mid-operation and stops queued work on account changes. A failed save stops further requests, keeps successful completions and reports the saved count; remaining tasks can be retried. The button disappears when no overdue tasks remain. No new backend endpoint/schema or storage migration was introduced.

## Verification

PASS: 594 website tests and 599 native tests. Six new regression cases cover deadline/date-only semantics, unrelated field preservation, serial writes, duplicate-click exclusion, changed/deleted/completed candidates, new-task exclusion, account changes, partial failure and retry. See `website-tests.txt`, `native-tests.txt`, `focused-tests.txt` and `tests/complete-overdue.test.cjs`.

PASS: actual Chromium 157.0.8103.79 through Playwright MCP, local Calendar and Tasks at 1280×900, 835×1000, 390×844 and 320×568, plus real signed-in loopback Worker/D1 at 1280×900 and 390×844. One-click writes, preserved unrelated details, 44px control height, responsive access, reload persistence and page overflow passed. Signed-in 503 injection on the second PATCH confirmed rollback, stopped queue and successful retry. Success paths used the real backend; no successful transport was mocked. Evidence is summarized in `browser-results.json`; reusable harness `runtime.js` creates only isolated synthetic records/accounts.

PASS: final cache 100 readiness, offline reload, local bulk completion and second offline reload persistence. This is browser/offline evidence, not an installed PWA pass.

PASS: all eight native setup/relaunch cases run in separate disposable QA app identifiers on actual iOS 27.2 iPhone 18 Pro/iPad WKWebViews, with local and real signed-in loopback Worker/D1 setup and relaunch cases. See device JSONL, screenshots and `native-verification.json` for completed outcomes, 119-file source/build/installed SHA parity and unchanged protected Swift/signing/artwork/sound inputs. The QA injection exists only in disposable bundle copies. The production API default remains unchanged.

The real QA backend is the existing local-only Axis fixture entry/config with current Worker/D1 code and its eight migrations, persisted under `/private/tmp/duckplan-axis-first-import-qa`, port 8798. Synthetic tasks use ordinary item PUT/PATCH endpoints. No Axis upstream connection or production records were used for this action.

## Environment interruptions

The screenshot-writing browser run hit ENOSPC. Automatic review rejected another screenshot-heavy matrix; the safer functional run omitted screenshot writes and passed. Only obsolete temporary generated build outputs/compiler caches were removed, preserving source, user data, signing and verified app products. A later interruption stopped the local processes; the preview/QA backend/collectors were restored. The replacement Python preview's small connection backlog caused asset resets; restarting its loopback server with a 128-request queue restored complete page/cache loading. These were environment/harness fixes, not product changes. The native runs before restoration returned no final record and are not counted as passes. The final successful runs are recorded separately in device evidence.

NOT RUN: physical iPhone/iPad installation, physical alarms/notification delivery, installed PWA mode, Safari/Firefox and production-account mutation. This local feature/source checkpoint does not deploy the site, push GitHub, activate the pending Axis backend release or update a physical phone.

## Reproduction

Run `node --test tests/complete-overdue.test.cjs tests/planner-model.test.cjs tests/task-panel.test.cjs tests/pwa-app.test.cjs`. Playwright MCP accepts `runtime.js` as a filename; local preview 8034 and isolated Worker/D1 on 8798 must be running. `run-native.py` expects current simulator build products under `/private/tmp/duckplan-overdue-native-build`, dedicated simulator IDs defined there, and loopback collectors 8898/8899. It uses separate QA bundle identifiers and private temporary command files. Never point QA setup at production. `verify-native.py` compares the 119-file build/installed bundles and protected native inputs.
