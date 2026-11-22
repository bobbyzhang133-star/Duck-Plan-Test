# Immediate rebound without the peak pause — November 22, 2026

Scope: selected 8042 original preview, starting at `414482f`. The user requested removing the delay before bounce-back.

Remove the first 150.5ms hold entirely. Use only the previous return segment: enlarged scale/position and opacity 0.9 → original endpoint, with the same `ease` curve and exactly 279.5ms duration (`430 × 0.65`). The task therefore appears big and begins returning immediately; its return movement itself is not accelerated. The safety fallback is 400ms, with normal cleanup still driven by animation end. Cache advances to v124. List slide, section fade, immediate particles, saved completion, approved duck and its later reaction remain.

[Updated sample preview](http://127.0.0.1:8042/?demo=completion-20261122&v=immediate-rebound-20261122#calendar).

Verification: Playwright MCP Chromium 157.0.8103.79 in isolated local contexts. [Script](check-browser.js), [results](browser-results.json).

- **PASS:** five desktop/tablet/phone/rapid/reduced-motion cases. Immediate enlarged pose, two distinct endpoint keyframes without a hold, 279.5ms duration, task removal, section fade, later duck reaction, cleanup and reload persistence. Rapid checkbox activation uses a native DOM click 75ms after the first change so the two exits actually overlap, without automation transport timing affecting the case.
- **PASS:** [rendered samples](rendered-frames.json) at 0/16/60/150/270ms show scale shrinking already at 16ms and continuing at 60ms, rather than remaining on a plateau.
- **PASS:** 11 focused render-hold/list-motion/service-worker tests, changed-JS syntax and diff checks. No store/API/native changes.
- **NOT RUN:** new signed-in tests for this timing-only revision, native WKWebView, installed PWA, physical devices and other engines. No public deployment, native synchronization or GitHub push.
