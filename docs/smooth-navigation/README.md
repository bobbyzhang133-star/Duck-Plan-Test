# Smoother directional navigation

Local follow-up to the approved up/down layered spring, starting from `6814b34` on `codex/smoother-navigation-20261113`. The direction, 48/56/64px entrances, 0/30/60ms sequence, 440ms spring and gentle bounce are retained.

## Findings and changes

The baseline normally delivered 16.7ms RAF intervals in isolated Chromium; poor frame rate was not reproduced by that measure. A separate, definite interruption was reproduced: moving the mouse from the sidebar into content ended the transition at about 143–161ms instead of allowing its full entrance. The controller deliberately did this because native captured content is excluded from hit-testing.

Simply removing that hover guard was tested and rejected: the first click on a painted task checkbox could be swallowed by the snapshot. The final implementation captures only the outgoing page, then animates the incoming title, controls and content as real DOM. Moving controls now have real transformed hitboxes. There is no synthetic click forwarding, input blocking or navigation delay. The incoming frame stays in place rather than moving a separate background backing; the approved semantic movement is retained.

Incoming transform/opacity effects are prepared paused inside the route update and start at native readiness. Cleanup waits for both the native exit and live entrance; cancellation, owner changes, errors, popups, resize, keyboard and scrolling restore every effect/style. Pointer hover only records coordinates. Pressing a moving control freezes its current hitbox through down/up/click, then resumes the held effects on the next frame. Pointer-caused focus does not finish the animation mid-gesture. Already-finished fades are never replayed, and a second press before the deferred resume preserves the hold.

Layer geometry/style reads are collected before capture names are written, avoiding repeated read/write flushes. Outgoing captures remain bounded. Long incoming content uses its actual clipped view instead of a list-height named snapshot; there is no permanent `will-change`, and no claim of a universal GPU memory bound. Navigation also stops rescanning every document button twice; startup and actual render/dialog paths retain normalization.

The root, workspace and incoming semantic capture names remain suppressed during new capture so incoming content stays live. This follows the [W3C old-state capture and activation lifecycle](https://www.w3.org/TR/css-view-transitions-1/#capture-the-old-state). Native snapshot hit forwarding is not assumed.

## Verification

`node --test tests/`: **341 passed, zero failed**, including 27 controller cases. Added coverage includes batching, exact semantic directions/timing, paused preparation, native/live completion in either order, pointer holds/focus/release, finished-fade protection, repeated presses, owner cleanup and native/live failure paths. PWA cache v43 and source URLs include the updated controller/app/CSS. JavaScript syntax and diff checks pass.

Browser scripts/results in this directory use isolated signed-out local fixtures and block API/external traffic. Baseline source is frozen in the comparison harness. Timing uses RAF-only samples scoped to the controller's own lifetime, with native completion reported separately from the longer live entrance. Heavy per-frame pseudo-style/video measurement is not used to infer frame rate. Trusted input tests target the actual painted checkbox or Calendar slot and verify the exact intended task/date/time; merely checking an editor screenshot is insufficient.

- [Baseline](baseline-results.json) and [final comparison](candidate-results.json): all 20 normal transitions and two pointer-entry cases passed. The final native old-page exit ends around 208–212ms, while the live entrance continues to around 527ms overall; hover at about 130–145ms no longer aborts it. Maximum measured active RAF gap is 16.8ms. The baseline already delivered similar RAF intervals, so this is not a claim of improved frame rate.
- Calendar/Tasks switching drops from about 17 layouts to 11–13 per route in the measured comparison. Some Classes/Settings routes perform more style/layout work with live DOM (about 38 versus 13–17), without a reproduced RAF stall. This is a scoped tradeoff, not an across-the-board rendering-cost reduction.
- [Trusted moving-input results](live-painted-input-results.json): all eight cases passed at 835/1280px. Quick checkbox clicks use about 110ms of entrance; 100ms holds on tiny checkboxes start around 220ms, still within the live spring. Calendar-slot quick and held clicks start around 110ms. Actual down/up/click targets are trusted and match the intended input/button; only the chosen task toggles and the editor uses the chosen November 9, 07:00 slot.
- [Five fallback cases](fallback-results.json) pass: touch 390/320px navigation, Add Task and the Tasks sheet; reduced motion; unsupported and throwing native transition APIs. Immediate Tasks→Calendar navigation leaves no residual effects/styles.
- [Three targeted interruption cases](interruption-results.json) pass: rapid reversal/latest-route handling, keyboard focus/search and resize cleanup. [Normal-speed forward/reverse playback](final-playback-835.webm) was recorded separately from timing measurement.

The first fallback run hit local `ERR_CONNECTION_RESET` failures while fetching unrelated startup assets, so those attempts were not passes. The task-owned loopback preview was restarted with the same Python `ThreadingHTTPServer` and `request_queue_size = 128`. A specific retry then loaded the assets with HTTP 200 and passed all three previously blocked fallbacks, with no page errors, failed requests or API attempts. This is a local development-server change, not a hosted application or notification-code change.

An intermediate tiny-checkbox test sampled a coordinate that became stale before trusted pointerdown during peak motion. These are explicitly distinguished from event dispatch failures; final input checks record the actual down target and use an active, slower part of the same entrance for held tiny controls. The checkbox/slot interactions use disposable isolated records, never user planner data.

Scope: current local website only. Reduced/coarse/unsupported contexts retain immediate navigation. Native project synchronization, installed-PWA/physical Safari/iPhone/iPad acceptance, signed-in backend parity and public deployment are not part of this presentation/performance change. These unavailable or untested runtimes are not reported as passes.

The actual open in-app preview loaded the new versioned controller/app/CSS, completed Calendar→Tasks→Calendar and opened/closed an empty Add Task form. The user's November 13 Day calendar was restored, with no open editor or remaining transition attributes. No user records were edited; its screenshot remains in private temporary storage.
