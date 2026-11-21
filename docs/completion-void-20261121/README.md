# Task exit before list reflow — November 21, 2026

Baseline `488d1cb`. User requested the original task-card pop-out without the calendar/clock icons, followed by shrinking into nothing; surrounding tasks must move only after the exit. Clarification: the full-body duck appears at the same time as the bounce and must not affect the task animation. Local website only, cache v119 / assets `completion-void-20261121`. No remote push, public deployment, schema change or native app synchronization.

## Result

- The outgoing object is again the actual task-card content. A one-time snapshot resolves its essential computed layout/material styles before detachment, removing the ancestor-style bug. Date/time SVGs, duplicate IDs, delegated action attributes and interactive behavior are removed from the decorative snapshot. The task title, class, priority, Due/Work text and checked checkbox remain. No generic yellow confirmation card replaces it.
- The original430ms `ease` pop transforms are retained. A separate240ms outer contraction then scales/fades the complete task tozero, centered on its original bounds. The duck is an independently positioned overlay, starts with the bounce and has no influence on the task's layout, size or transform. Its existing full-body Sigma drawing/feet/integrated wing thumbs-up are retained.
- The real source row stays invisible but occupies its original space until the shrink animation ends. Completion is saved immediately through the existing store path; canonical task data and background alert reconciliation are not delayed. A small presentation gate coalesces list redraws until outgoing cards finish, with an animation-end release and740ms fallback. It does not add API requests or defer persistence.
- Multiple quick completions keep all needed placeholders until the shared redraw. Earlier finished cards do not flash back into view. Keyboard focus is sampled just before the final redraw and restored to a visible task/action; a keyboard user who tabs to another task keeps that choice. Folded completed sections are excluded from focus targets.
- Failure, reopen, route/filter/template-tab changes, owner changes, resize and motion-preference changes cancel/retire the presentation rather than leaving a held row. Success particles/final-day celebration wait for both the existing persistence promise and the completed exit. The simultaneous duck gesture is decorative immediate input feedback, not a durable-save acknowledgement.

The Calendar preview's separate completion path and adding an explicit Undo action remain outside this task; the existing checkbox reopening behavior is preserved. Default/class colors and the preceding full-width deadline design are unchanged.

## Reference and phase evidence

Returned to the actual buggy-version preview8042 (exported `76bffd7`) and compared with8034 at390×844 using the same synthetic task/checkbox input. [Comparison harness](compare-original.js), [results](comparison-results.json), and matched peak captures confirm identical first430ms transform matrices, duration and easing. The original early fade-tozero is intentionally extended into the newly requested shrink phase; this is not a claim that the complete old effect, including its icon bug, is unchanged.

Rendered paused-frame checks observed outer scale/opacity1 at430ms,0.796863 at550ms, and0.0446896 at666ms, with the source space still reserved. The outer keyframe ends at scale0/opacity0. `void-shrink-550.png` shows the intermediate contraction. These sampled frames establish phase geometry, not physical-device frame rate.

A separate natural-time observer recorded the shrink's animation-end event at approximately692.7ms and the first task-list DOM mutation at735.2ms after the input: **list redraw occurred after the exit**. See [render-order.json](render-order.json). These are one runtime sample, not fixed performance guarantees.

## Verification

Chromium157.0.8103.79 through Playwright MCP, isolated synthetic contexts. The user's preview storage and real account records were untouched.

| Case | Result |
| --- | --- |
|11 live local cases: desktop/tablet/phone Calendar, Tasks at1156/390/320px, Dashboard, priority matrix, dark, reduced motion, motion off | PASS. Save updates canonical state immediately; neighbor coordinates remain fixed during the exit, then close the gap after it. No date SVGs/duplicate IDs, no overflow, full duck starts with the bounce. Completed state and remaining task fields survive reload. [Harness](check-browser.js), [results](browser-results.json). |
| Keyboard and focus | PASS. Space completion, visible replacement task/action after redraw, Dashboard closed-completed-section handling. A separate live Tab-during-exit check retained the next task before and after redraw. Matrix retains its existing visible heading fallback. |
| Rapid/reopen/filter/navigation/reduced-motion-during-exit | PASS. No lingering placeholders/overlays; rapid completions save both tasks and an earlier finished source stays invisible while another exit runs. [Edge harness](check-edge-cases.js), [results](edge-results.json). |
| Signed-in success | PASS, real loopback Worker/D1 fixture8798. Actual checkbox/save/reload retains completion. |
| Early150ms and late1000ms failed saves | PASS, fixture-backed failure injection.503 responses/delays are injected at the transport boundary; actual fixture backend/reload confirms incomplete state. Error shown, no success particles/final-day celebration and no held rows. |
| Sign-out during delayed completion | PASS. Old owner task does not return after the late response; overlays/holds cleared and stale messages suppressed. Uses actual loopback session/store lifecycle. |
| Switching Calendar Tasks→Templates during exit | PASS. Templates becomes selected and no old overlay/held row remains. |
| Controlled-browser offline reload/completion | PASS. Both new modules are precached in v119; completion and reload work with the context offline. [Offline result](offline-results.json). This is browser service-worker evidence, not an installed-PWA pass. |
| Existing and new Node checks | PASS:43 tests /0 failures across render-hold lifecycle, planner store, matrix, calendar preview and service-worker cache. [Log](node-tests.txt). Changed JS syntax and diff checks also pass. |
| Native WKWebView, installed PWA, physical Safari/device motion/performance, full release baseline | NOT RUN. This is local web work; native checkout is unchanged until “Publish to public.” No all-platform/native parity claim. |

The presentation-gate tests cover latest-render coalescing, overlapping exits, failure, context change, cancellation, and sampling focus immediately before a shared render. No storage/API schema behavior or native bridge was changed.

During implementation, a Dashboard focus check exposed that `getClientRects()` can return a box for a task inside a closed disclosure; the restored target now checks actual visibility. Matrix cards can sit side-by-side, so final layout assertions compare both axes relative to their container rather than requiring a vertical movement. The final11-case run passed after those corrections.
