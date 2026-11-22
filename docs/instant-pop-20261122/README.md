# Instant enlarged pop — November 22, 2026

Scope: the selected 8042 original preview, starting at `a377177`. The user requested immediate enlargement or an extremely fast expansion.

The task now starts at its screen-fit enlarged pose on its first rendered frame; there is no growth tween. Hold that pose for the first 45ms, then shrink/fade through the remaining 255ms. Total CSS duration is 300ms instead of 430ms. Reduce the render-hold safety fallback from 500 to 400ms; the animation-end event still releases the held geometry normally. The section fade, 400ms list movement, immediate particles, v11 head and later duck reaction are unchanged. The duck still waits 90ms after the task exit and successful persistence. Cache advances to v122.

[Updated sample preview](http://127.0.0.1:8042/?demo=completion-20261122&v=instant-pop-20261122#calendar). Existing sample progress and real planner records are preserved.

Verification: Playwright MCP Chromium 157.0.8103.79, isolated local sample data. [Script](check-browser.js), [results](browser-results.json).

- **PASS:** 1156px desktop, 835px tablet, 390px phone, rapid double completion and reduced motion. The checkbox event observes the full target scale immediately (2× desktop/tablet; 1.10× phone). The first two keyframes have the same transform, confirming no expansion tween. Actual keyframe duration is 300ms; observed normal animation-end events arrive around 343–352ms after the change event, including initial rendering. Completion remains saved after reload, pending rows disappear, temporary artifacts clear, section removal fades and the duck follows the exit.
- **PASS:** inspected the [first rendered pose at animation time zero](first-frame-835.png): scale 2, opacity 0.96 and the complete box within the viewport.
- **PASS:** 11 focused render-hold/list-motion/service-worker tests, changed-JS syntax and diff checks. No persistence/API/native changes.
- **NOT RUN:** new signed-in tests for this timing-only revision, installed PWA, Safari/WebKit/Firefox, native WKWebView and physical devices. No app synchronization, remote push or public deployment.
