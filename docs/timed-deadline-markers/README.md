# Exact-time deadline markers

The local Calendar follows the user's confirmed [new ChatGPT reference](REFERENCE.md): explicit due times appear as compact coral diamond markers in the hourly grid, beside a lightly tinted label. Scheduled work remains a separate class-colored duration block. Date-only deadlines remain above the grid; an empty date-only row is omitted.

## Behavior

- Every timed deadline retains its exact minute coordinate. Only its44px label and boundary artwork are contained inside the day at midnight/23:59. Date-only deadlines never acquire an invented23:59 visual occurrence.
- Nearby deadlines share a counted label and open a list with every task's full title and exact due time. Selecting an entry opens the existing compact task preview. Edit, Reschedule, completion, Escape and focus restoration retain their existing behavior and account guards.
- Work that visually meets a deadline uses the left56% of the day, with the deadline annotation on the right. Connected overlapping work cards share that horizontal area consistently. Collision days have a112px minimum column width with contained horizontal scrolling; other days retain the existing layout. These are display bounds, not reserved availability or new work durations.
- Each diamond still belongs to its own group when transparent hit rectangles meet. Pointer resolution is limited to the receiving label's transparent gutter, so a hidden diamond cannot steal an opaque label's activation. Keyboard activation uses the focused control.
- The existing work/deadline warnings, task identity, saved dates, duration, class colors and manual alert preferences remain intact. Deadline selection and list expansion make no item/import writes. Existing provider reconciliation requests are separate.
- Initial scrolling considers timed deadlines, including a deadline-only day. Month's distinct work/deadline occurrences and completed-item behavior remain unchanged.

## Verification

[verification.json](verification.json) records the final source hashes, `timed-deadline-20261115` asset keys and cachev62. All94 affected Node checks pass: presentation/group geometry, preview lifecycle, real timeline integration, task model, startup, editor focus, drag handling and PWA configuration. Changed JavaScript syntax and diff checks pass.

The actual Chromium157 browser matrix passes eight local/signed-in combinations at1280,835,390 and320px, including dark/reduced-motion variants. Checks cover exact minute anchors, boundary bounds, shared timestamps, task details/Edit/Escape/focus, no item writes, overlapping work, drag/Undo preservation, Month, reload and owner cleanup. Signed-in tests use a disposable real Worker with migrations0001–0008. These phone/tablet results are viewport and touch emulation, not physical Safari or native-app verification.

The eight matrix flows precede a bounded receiving-gutter guard. Their unchanged inputs are reused explicitly; four final-source mouse/touch checks verify both the exposed earlier diamond and the later opaque label. See [runtime-final.json](runtime-final.json) and [runtime-pin-hit-final.json](runtime-pin-hit-final.json). Earlier harness diagnostics are retained separately: an incorrect drag grab offset, an overly broad write assertion that included provider maintenance, and startup readiness did not establish product failures.

The [runtime ledger](runtime-ledger.json) records the separate browser service-worker/offline check, screenshots and fixture cleanup. [SW62 offline/reconnect](runtime-sw.json) passes: cached hashes for all five affected assets plus index match the final source, offline reload serves them from the service worker, deadline-group/details actions work and reconnect preserves the data. The [clean phone reference](reference-demo-phone.png) is an actual screenshot with one synthetic task worked at3PM and due at5PM. An ordinary browser offline reload is not an installed-PWA launch pass. Physical iPhone/iPad, Safari/WebKit, installed PWA and the native app are NOT RUN for this website-only change.

## Scope and preview

[Local Calendar preview](http://127.0.0.1:8034/#calendar). The existing user preview was refreshed and restored to Week, November9–15, selected Sunday15, with Tasks collapsed and no dialog. The same four remaining tasks and user records were preserved.

This is the canonical website branch `codex/timed-deadline-markers-20261115`, based on `2be9205`. No backend/schema change, native source sync, installed-phone update, shared-main merge or public deployment is part of this work. See [the testing procedure](../platform-testing/README.md) for the added timed-deadline acceptance cases.
