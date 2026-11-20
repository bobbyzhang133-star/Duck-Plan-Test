# Reduce native rebound scroll overhead

The user reported that the restored original rebound felt a little laggy. Keep that browser-native movement and the fixed date tabs; optimize application work rather than changing its physics again.

## Findings and change

Profiling the previous `b4db5d8` implementation found that every timetable scroll repeatedly queried the same header/scroller nodes and read horizontal content width even during purely vertical scrolling. Fold painting also repeatedly searched the calendar and called the ancestor class setter while its state was unchanged.

The header adapter now caches its current rendered nodes. Width measurement runs on render/resize refresh; horizontal alignment remains immediate on scroll. Fold painting caches its timeline and only changes the fold class when crossing the edge. Intersection callbacks skip unchanged clipping state. Rerender/resize invalidates and refreshes the caches, and destroy still releases listeners. Native input, CSS elasticity, movement/duration, full timetable composition and header isolation are unchanged. No new animation loop or input delay was added.

## Measured evidence

`profile.js` runs three identical inward/over-limit gesture pairs in isolated local Chromium 157.0.8103.79 contexts at 1280×950, with normal and 4× CPU throttling. DevTools tracing and the same lightweight instrumentation were used before and after. Raw summaries are `before.json` and `after.json`.

- Calendar-root lookups during the measured scroll sequence: 832 → 103 at normal CPU; 832 → 104 at 4× slowdown (about 88% fewer).
- Total scroll-dispatch time: 20.35 → 17.34ms at normal CPU; 67.70 → 52.57ms at 4× slowdown (about 15% and 22% lower in these runs).
- No 50ms long tasks in either version. Frame p95 remains about 16.7ms; three ~33ms frame intervals occur in both versions. These measurements establish reduced application overhead, not proof that the user's exact physical-browser hesitation was reproduced or that every device is now free of dropped frames. Do not attribute all perceived lag to these lookups or advertise an FPS improvement unsupported by the measurements.

## Reference and regressions

Acceptance: preserve the original native first-gesture stretch/rebound and stationary header while eliminating repeated vertical-scroll geometry work. The reference remains the pre–November17 historical `b5bbeaa` snapshot at `http://127.0.0.1:8038/#calendar`, selected by the user in the preceding task.

After the revision, `reference.js` runs Playwright MCP historical → local → historical for both limits, plus a direct header gesture. Rendered PNG samples in `reference.json` show the same ±21px peak at both limits; restored header travel remains 0px versus the moving old header. Representative peaks were inspected/saved. Browser-native timing remains unchanged rather than replaced by another guessed spring. The public Google approximation and November18 custom demos are not the reference for this task.

- **PASS:** 567 Node tests; focused syntax/diff checks. Two new regressions reject the original source (100 repeated queries and five redundant fold writes in their fixtures), pass the optimized source, and verify that refresh still updates changed geometry.
- **PASS:** 27 actual browser cases from the preceding runtime harness rerun against this source (`browser.json`): responsive Day/Week light/dark layouts, fixed headers, 24-hour schedule, Due folding/scroll preservation, Month, task/template drag times, unchanged deadlines, independent copies and reload persistence.
- **PASS:** six final browser cases (`runtime.js`, `extra.json`): real horizontal overflow/header alignment; trusted synthesized body/header touch panning; slot/cancel/work-block drag; reduced motion; actual v93 viewport-cache equality, offline reload and saved schedule/slot interaction.
- **NOT RUN:** physical hardware/trackpad, Safari, installed PWA, native WKWebView and real signed-in backend. Browser touch emulation and CPU throttling are distinct from those runtimes. Separate native source/bundles and user records were not changed.

Only the viewport script URL and offline cache (v93) changed besides the controller/tests. Local preview: `http://127.0.0.1:8034/?v=smooth-native-rebound-20261119#calendar`. TEST feature-branch backup only; no main merge, public deployment or phone installation.
