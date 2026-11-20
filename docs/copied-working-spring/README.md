# Copy the working spring back into the current calendar

The user reported that the native-restoration version had no visible rebound and explicitly requested copying the earlier working code. The preceding interpretation of the desired version as pre–November17 OS-native elasticity was insufficient in the actual in-app preview. This task restores the explicit first spring from `e592335` (November18, 10:54), previously offered at port8035, rather than tuning another native approximation.

## What was copied

`edgeSpring` and `createElastic` come directly from `e592335:landing/calendar-viewport.js`. All 61 samples, 440ms return, 90ms wheel idle, .35 resistance, 48px maximum pull, resumed-gesture sampling, touch hold and lifecycle/drag cleanup are preserved. `source-proof.json` verifies equality with that historical source after excluding comments/whitespace and adapting its moving-surface selector.

That selector now names `.calendar-body-grid`. The whole hourly backing surface still moves together: axis, lines, blocks, deadline markers and current-time dot. The date/Due header is already structurally outside it, so it needs no counter-animation and remains stationary. Controller attachment follows the actual hourly scroller; rerender destroys the old instance and attaches to the replacement, while resize resets the current effect. Month has no spring controller. Recent scroll-handler caching remains intact.

The hourly scroller uses `overscroll-behavior: none` to avoid doubling this explicit spring with browser-native rubber-banding. Reduced motion continues to disable the custom effect. Both modified asset URLs and service-worker cache v94 are refreshed. Task data, deadline semantics, responsive structure and native bundles are unchanged.

## Actual user-tab verification

Computer Use selected the user's existing in-app tab14 at the smooth-native URL, inspected its DOM/styles, then reloaded it after the source change. It now loads `calendar-viewport.js?v=copied-working-spring-20261119`. Native scroll input over the bottom edge produced −48px of stretch, returned through zero and overshot to approximately +2.80647px. Read-only sampling across 110 observations kept the date header at94px throughout. See `actual-preview.json`. No task was created/edited and no user records were exported.

This is direct evidence of the requested rebound in the user's preview, beyond the previous isolated native/compositor comparison. It is not a physical-trackpad, Safari or native-iOS guarantee.

## Historical comparison

Acceptance: copy the historical algorithm, reproduce its first pull and signed overshoot at both edges, keep the current header stationary, and preserve scheduling actions/persistence.

Playwright MCP inspected the historical first-spring preview before implementation. A −120px wheel gesture produced42px of pull and a61-keyframe/440ms return there. After copying, the same input produces the same effect in the current site. `reference.js` returns to the historical version before and after each local top/bottom comparison, and also checks835/390/320px layouts.

The historical files are served on8039 with an HTTP/1.1, enlarged-backlog local comparison server. They are the same `e592335` files originally offered on8035; the old low-backlog server intermittently missed startup dependencies during a repeated automated comparison, so that failed run was not treated as application acceptance.

Final `reference.json`: both historical/local/returned-historical top and bottom keyframe arrays match exactly; rendered transform samples at0/150/210/264/350/430ms differ by less than.001px. First pulls are±42px for120px input; the curve crosses rest by about2.46px at that amplitude. Header position stays fixed at every sampled phase. Screenshots capture the held pull and overshoot; the focused `rebound-preview.png` shows the restored surface while pulled.

## Checks

- **PASS:**573 Node tests, including the six historical spring regressions restored with the body-only header arrangement. Syntax and diff checks pass.
- **PASS:**27 current-runtime responsive Day/Week/theme, fixed-header, Due fold, scroll-preservation, Month, task/template drag, deadline-preservation and reload cases (`runtime.json`).
- **PASS:**six final horizontal-alignment, real synthesized touch, slot/cancel/work-block scheduling, reduced-motion and actual v94 cache/offline cases (`extra.json`).
- **PASS:**eight historical/responsive spring cases (`reference.json`).
- **PASS:**12 successive full calendar renders leave exactly one body spring; rendering during its return removes the detached animation/inline transform. Actual user-tab effect verified separately above.
- **NOT RUN:**real signed-in backend, installed PWA, Safari, physical touch/trackpad hardware and native WKWebView. Browser touch emulation does not establish native app parity. The separate Xcode checkout and installed app were not updated.

Local website/TEST feature-branch backup only. No main merge, public deployment or user-data mutation. The existing user tab was refreshed in place instead of opening another duplicate.
