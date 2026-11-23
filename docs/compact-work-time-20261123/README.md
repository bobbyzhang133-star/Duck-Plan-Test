# Purple task tints and compact calendar times

Both task lists tint their cards by status, with purple for unscheduled tasks. Scheduled work blocks use compact title and start-time lines when they are under 48px tall. The matching preview uses the same layout. Calendar block height still follows duration, and calendar block color still follows class.

The reported bug was reproduced on commit `87502bd` in local Chromium 157.0.8103.79. Dragging a 30-minute task to 2:00 PM showed that time in the preview and saved it. The saved block contained the same label, but the short-block stylesheet hid it.

The local web change uses cache v141. PASS in Chromium 157.0.8103.79: 1280px desktop and 835px dark Calendar layouts, plus a 390px touch-emulated phone layout. The phone flow scheduled an unscheduled task through the editor, updated its card tint, and showed the 2:15 PM start after a reload. Full-card colors were distinct and changing the Tasks grouping preserved them.

PASS for desktop drag and drop using trusted pointer input. Open the local demo, drag the unscheduled 30-minute task onto 12:00 PM in Day view, then drag a 45-minute template onto 12:15 PM in Week view. The previews and both saved blocks show the intended start times. The template produces one new task and both times remain visible after reload. In the tested Week overlap the narrower time label fits its available 46px. See `desktop-drag-results.json`.

PASS: 35 time layout, drag, task grouping and cache checks. The separate calendar selection suite reproduced a pre-existing mock error on the baseline because its fixture lacks `window`. The suite's template-drop case passed.

NOT RUN: signed-in backend, installed PWA, native app and physical devices.
