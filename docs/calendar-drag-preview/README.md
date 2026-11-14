# Single calendar drag preview — November 14, 2026

Local work on `codex/calendar-drag-preview-20261114`, based on `e49cf20`. The user confirmed that dragging changes scheduled work time while preserving the deadline.

## Result

Tasks and templates now have one live calendar-shaped block from drag start. A retained transparent 1×1 canvas supplies the native drag image, replacing the browser's large frozen source bitmap. The same DOM block follows free movement and snaps into the calendar column at the chosen quarter-hour, with live time, exact duration height, class color and column width. Fitted previews have no scale, saturation shift or halo. Month/header drops retain the existing 09:00 convention; an offscreen header time is labeled honestly by the pointer. Autoscroll updates and clips the same block.

The existing task work-time save was already correct; the frozen source bitmap made its time/text misleading. Tests explicitly verify the new work time in the saved record and Task List metadata, with the deadline unchanged. Task drops retain the same ID/count and other fields; template drops create independent copies and retain the source. Existing Calendar pointer drags also use an unscaled preview and current records. Undo checks owner/current schedule and retains later edits.

Cleanup covers cancellation, owner/context changes and sources detached by ordinary rerendering. Native dragend on a detached source does not necessarily bubble to the document; a preview RAF/source-connectivity check now removes its canvas/block and retires pending task hover. A matching active preview is required for the root native template drop. Cross-route Task dragging retains its connected source and 400ms Calendar hover behavior.

## Template controls and reference

Read the earlier interactive Calendar/task-list demo in [Repository Overview](https://chatgpt.com/g/g-p-6addac00e55c8191a3f6db4456733345-duck-plan/c/6addacc2-3bc4-83e8-8f06-cdbedefe067c) in Chrome, including its actual Schedule interaction. No new message was sent. Its compact dark rounded Schedule button and outlined Add to tasks button are now reflected in the local template controls, with a quiet overflow action and at least 44px height on coarse pointers. Light/dark contrast and keyboard focus remain.

The user confirmed on November 14, 2026: change button styling only. Preserve the existing prefilled Schedule editor and Add to tasks behavior; do not add the demo’s inline time picker. The earlier tab/layout decisions and newer mascot remain intact.

## Verification

- PASS: 80 focused Node tests covering library actions, tabs, task-drag lifecycle, calendar placement, panels, route motion and PWA handling; JavaScript syntax and diff checks.
- PASS: `runtime-results.json` contains 10 core cases, rerun against the final behavior. `runtime-extra-results.json` contains 9 passes plus 1 NOT RUN. `runtime-touch-results.json` contains 11 passes: **30 browser checks pass** in Chromium 157.0.8103.78. Reusable runners and exact feature/backend/schema hashes are alongside them in this directory.
- Local fixtures use port8034. Signed-in fixtures use the real unchanged Worker, isolated D1/Durable Object, password session and migrations0001–0005 on8796. Requests use the real local backend and disposable accounts; no production account or remote migration was involved. The isolated Worker was stopped afterward;8034 remains available.
- Trusted task/template gestures verify one attached transparent canvas, a real `setDragImage` call, RGBA alpha0 and one identical custom node through free→09:00→10:00→free→drop. Saved fields/color/ID rules and reload persistence pass. Calendar navigation hover, Escape, source detachment, context/sign-out, Month/header, autoscroll, clipping and existing pointer-event rescheduling also pass. Explicitly dispatched DOM blur cleanup passes; an actual native-window blur was not emitted by the headless runtime and is NOT RUN.
- 320/390px phones and768px tablet touch emulation pass light/dark pill geometry, ≥44px actions, contrast, focus, no overlap/overflow, Schedule→prefilled editor→save and Add to tasks→independent unscheduled copy→reload. These are layout/input checks, not physical iPhone/iPad acceptance.
- The actual open in-app browser loaded all four new versioned assets and showed the dark/outlined 999px-radius controls. Its Tasks view, List/All, Calendar Tasks tab, selected November14 Week, 12 records/four complete and scroll0 were preserved. No user record was dragged or saved. Actual screenshots and the chat reference remain in private temporary storage; committed screenshots contain synthetic fixtures.

Native operating-system drag-bitmap absence cannot be established from a page screenshot alone. Evidence verifies the actual browser API call with a fully transparent attached bitmap plus the single DOM preview; it does not claim separate native-screen capture proof. Physical Safari/iPhone/iPad, installed PWA and native WKWebView are NOT RUN. The native app bundle was not synchronized.

Final assets use `calendar-drag-preview-20261114` keys and cachev50. Functional feature hashes remain unchanged after the metadata-only cache bump; final PWA checks pass. The ongoing platform-testing procedure now includes the single-preview/time/deadline and cleanup contract. No shared-main merge, public deployment or native update.
