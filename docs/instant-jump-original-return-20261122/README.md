# Instant jump, original return speed — November 22, 2026

The user clarified that only the initial enlargement should be instant; the return should retain its original speed. Scope is the selected original 8042 preview, starting at `4237856`.

Restore `task-finish 430ms ease both` and the prior 35% peak/100% endpoint. Only the 0% transform changes from normal size to the already-enlarged pose. This preserves the earlier return segment exactly: 150.5ms through 430ms, including its opacity curve, translation and scale interpolation. Restore the render-hold fallback to 500ms. Sections, particles, list movement and delayed duck retain their existing behavior. Cache is v123.

[Sample preview](http://127.0.0.1:8042/?demo=completion-20261122&v=instant-jump-original-return-20261122#calendar).

Verification in Playwright MCP Chromium 157.0.8103.79, isolated local contexts:

- **PASS — exact return comparison:** [script](compare-return.js). Compare the pre-speedup `a377177` keyframes with the current keyframes at matched 835/390px viewports and checkbox triggers. Rendered transforms/opacity at 150.5, 200, 300 and 420ms match exactly; duration remains 430ms and easing remains ease. At 0ms the updated pose is already enlarged (2×/1.10×), while the prior version started at scale 1.
- **PASS — five functional cases:** desktop/tablet/phone, rapid completion and reduced motion. [Script](check-browser.js), [results](browser-results.json). Immediate enlarged pose, 430ms timing, completed-task removal, section fade, subsequent duck, cleanup and reload persistence pass.
- **PASS — 11 focused render-hold/list-motion/service-worker tests**, JS syntax and diff checks.
- **NOT RUN:** new signed-in checks for this timing-only revision, native WKWebView, installed PWA, physical devices and other engines. No storage, API, native project, deployment or GitHub changes.
