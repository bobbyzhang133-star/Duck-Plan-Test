# Full-day calendar — November 14, 2026

Local work on `codex/full-day-calendar-20261114`, based on `aaa6b34`. The user requested all 24 hours instead of the former morning/evening range.

Day and Week now contain 24 hourly slots from 00:00 through 23:00, covering the full day through midnight. The time axis, event/current-time positioning, relevant-time scroll, task/template drag previews, pointer rescheduling and keyboard boundaries use the full-day range. Shared exported bounds keep grid and interaction calculations aligned. Date/deadline/Month drops retain the usual 09:00 default, while actual time-column drops use their selected time. Templates can fit up to their existing 1440-minute duration limit without being shortened. Task work-time changes continue to preserve deadlines.

The page remains scrollable at its existing hour scale. Desktop/iPad retain the adjacent task column; phones retain the full-width calendar, selected-day Week behavior and collapsed task sheet. Asset keys use `full-day-calendar-20261114`; service-worker cache is v53. No storage, schema, backend or native bridge changes.

## Verification

- PASS: 57 focused Node tests across planner UI/model/library, calendar selection/tabs, task-list dragging and PWA handling. Tests cover every hourly keyboard slot, midnight/late snapping, duration-fit/overflow, 24-slot rendering, preserved deadline/source fields and unchanged 09:00 header placement. JavaScript syntax and diff checks pass.
- PASS: 21 isolated Chromium 157.0.8103.78 browser checks in `runtime-results.json`. Day/Week have 24 labels/slots and matching 1488px columns. Trusted task/template native drags at 00:00 and 23:00 retain the single fitted preview, exact geometry/color, task identity or independent copy, deadlines/settings and reload persistence. Keyboard edges/editor, 00:30/23:30 current-time lines and long-day autoscroll/cancel pass.
- PASS: six additional local/signed-in browser cases in `runtime-extra-results.json` move existing calendar blocks through the pointer path to 00:00 and 23:15, check exact ghost position and saved identity/deadline after reload, and clamp Alt+Arrow movement at 23:15 for a 45-minute task. **27 browser cases pass in total.** The harness centers source blocks below sticky date headers before starting a gesture.
- PASS: included 390px phone and 768px tablet touch-emulation Schedule flows at 00:00/23:00 save and reload without horizontal overflow or lost template settings. Committed PNGs contain synthetic fixtures.
- Local fixtures use port8034. Signed-in fixtures use the real unchanged local Worker on8796 with isolated D1/Durable Object state and migrations0001–0005. Saves wait for durable success before reload. Zero page exceptions or failed requests in the final runners; synthetic contexts are closed and the owned Worker is stopped afterward. Backend/schema identities are recorded alongside the runners.
- PASS: actual current in-app preview refreshed, confirmed all four new asset keys and seven 24-slot/1488px columns. Keyboard movement clamps at midnight and 23:00. The selected November14 Week and Templates tab remain; preview is left at late-night hours for review. No user task/template was edited, added or dragged. Actual private screenshots are outside the repository.
- NOT RUN: production accounts/backend, physical Safari/iPhone/iPad, installed PWA and native WKWebView. Touch emulation is layout/input evidence, not physical/native acceptance. The native app bundle was not synchronized.

Local review and TEST feature backup only; no shared-main merge, public deployment, remote migration or installed-phone update. The Calendar testing procedure now explicitly covers full-day edges and alignment.
