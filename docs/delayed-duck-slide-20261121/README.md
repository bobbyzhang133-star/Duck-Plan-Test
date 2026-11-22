# Smooth list reflow and delayed duck approval — November 21, 2026

Scope: the user's selected [original preview on port 8042](http://127.0.0.1:8042/?v=delayed-duck-slide-20261121#calendar), starting from `f03f1de`. Canonical 8034, hosted sites and native files are unchanged.

## Requested behavior

1. Particles begin on the completion click, as approved in the previous revision.
2. Keep the original task's `task-finish 430ms ease both` pop/fade, retaining source geometry until it ends. Remove date icons from this outgoing clone. The duck is now a separate reaction rather than fading inside that short task animation.
3. Remaining cards slide upward into their new positions over 400ms using `cubic-bezier(.25,.1,.25,1)`. Matrix cards retain their appropriate horizontal reflow. A controlled refresh 80ms into the old slide reproduced an interruption: the refresh replaced the animated DOM, ending the slide early. While cards are moving, queue/coalesce refreshes until the animations finish; retain task keyboard focus when applying the queued refresh. Writes still happen immediately.
4. Once the exit has finished and completion has saved successfully, wait 90ms, then show the full-body Sigma duck. It pops in, raises its existing wing into the thumbs-up pose after 260ms, holds, and fades at the end of its own 1500ms sequence. Clamp it within the viewport. The approved mascot face/body is unchanged. This independent reaction does not hold up list movement.
5. Remove the reaction on navigation, account changes, reopening, failed saves or reduced motion. No second particle burst, stale account overlay or stuck source row. Cache version is `duckplan-app-original-duck-preview-v117`.

## Verification

Playwright MCP Chromium 157.0.8103.79; isolated synthetic browser fixtures. Rendered position samples establish movement in this browser, not physical-device performance.

- **PASS — 12 layout/motion cases:** desktop/tablet/phone Calendar, desktop/phone Tasks including 320px, Dashboard, matrix, an injected refresh during the slide, dark mode, reduced motion and motion off. [Script](check-browser.js), [results](browser-results.json). Frames show source space held until the task exit ends, intermediate positions throughout the upward slide, then the separate duck remaining visible before fading. The refresh case retains the slide and keyboard focus. Completion and other task details survive reload.
- **PASS — 9 lifecycle cases:** rapid completions, reopen, filter, navigation, reduced motion during exit, signed-in success, early/late failed saves and sign-out while a save is pending. [Script](check-edge-cases.js), [results](edge-results.json). Actual loopback Worker/D1 backend at 8798 with static assets proxied from 8042 and the fixture's actual dynamic cloud config. Synthetic 503 responses/delays are injected at the transport boundary; no production records are used.
- **PASS — additional interruption checks:** navigation while the duck is visible, reduced motion while the duck is visible, and a real loopback cloud PATCH delayed 650ms so its acknowledgment lands during list movement. [Results](additional-results.json). The late-save case maintains intermediate upward positions through the full slide; all overlays and held rows clean up.
- **PASS — rendered artwork:** full body/feet, visible raised wing, opacity 1 during the hold, no task echo remaining, 1500ms reaction duration and bounds inside both 390px and 835px viewports. [Results](visual-results.json), [phone frame](thumb-hold-390.png), [tablet frame](thumb-hold-835.png). The original task pop keyframes/duration/easing were not edited.
- **PASS — 11 focused Node tests:** render hold, service-worker asset versioning, and the new queued-refresh tests (latest refresh only, account cancellation discards stale work, navigation flushes once). Changed-JS syntax and `git diff --check` pass.
- **NOT RUN:** Safari/WebKit, Firefox, installed PWA, native WKWebView and physical devices. Responsive viewport evidence does not claim installed-app parity. No app sync/build/install or public release was requested.

No remote push, public deployment, native synchronization or signing changes.
