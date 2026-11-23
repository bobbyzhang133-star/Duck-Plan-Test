# Instant expanded pose and instant list reflow — November 22, 2026

Scope: the selected latest 8042 preview, starting at `58f7327`. The user explicitly requested removing the task list's upward slide and returning to a snap, while keeping the initial expansion instantaneous.

[Fresh sample preview](http://127.0.0.1:8042/?demo=completion-20261122-2&v=instant-list-snap-20261122#calendar). This separate sample batch preserves prior sample progress and normal records.

## Changes

- Set the pop-out's base pose to the enlarged transform and explicitly disable its CSS transitions. Its 0% animation pose is also enlarged. There is no growth tween; the approved 279.5ms return/fade remains.
- Remove the list-motion module, its script/precache entries and obsolete unit tests. No surviving-card translation, animated panel height or section-height collapse runs. Hold the outgoing task's geometry until its pop-out finishes, then render the new list in one step. Completed records remain accessible through Completed/Done.
- Preserve disappearing-heading and overdue-control fades, but play their opacity-only fades during the outgoing task's animation. Cancelling those fades and rendering the final list occur in the same turn, so labels do not flash and no faded section reserves space afterward. This preserves the fade request without reintroducing gradual list movement.
- Preserve task keyboard focus across completion-owned rerenders, including acknowledgments arriving after the pop-out. The later full-body v11 duck and immediate particles remain.
- Cache version is `duckplan-app-original-duck-preview-v125`.

## Verification

Playwright MCP Chromium 157.0.8103.79, isolated sample/loopback fixtures. [Script](check-browser.js), [results](browser-results.json).

- **PASS — 8 functional/motion cases:** Calendar at 1156/835/390px, Tasks phone, Dashboard, signed-in phone Tasks, rapid completion and reduced motion. Initial rendered transform equals the configured peak (2× desktop/tablet; screen-fit phone scale), with zero CSS transition duration. Next-row positions remain fixed during the outgoing task, then are already at their final positions on every post-exit frame; no geometry animations or intermediate positions occur. At the bottom of a scroller the footer can remain anchored instead of moving, so that case checks stable final geometry and removed section layout rather than requiring a particular displacement.
- **PASS:** the last Due-this-day heading has intermediate opacity during the task pop-out. Completed tasks leave the active view, overlays clear, and completion survives reload. Rapid activations save both tasks. Reduced motion bypasses effects normally.
- **PASS — real signed-in loopback:** 8798 Worker/D1 supplies API/cloud config, with static assets proxied from the current 8042 checkout. A PATCH acknowledgment delayed 650ms preserves keyboard focus after the list has snapped.
- **PASS — failed save during the fade:** [results](rollback-results.json). An injected 503 at 150ms restores the unfinished visible row and heading opacity 1, clears temporary effects and shows the error; no unhandled page errors occur.
- **PASS — 12 focused Node tests:** demo guards/isolation, completion render hold/focus and service-worker versioning. Changed-JS syntax, absence of active list-motion references and diff checks pass. No storage/API/schema changes.
- **NOT RUN:** installed PWA, native WKWebView/physical devices, Safari/WebKit/Firefox or deployed API mutation checks. No app synchronization, GitHub push or public release.
