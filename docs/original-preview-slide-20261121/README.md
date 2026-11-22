# Completion followed by a smooth list reflow — November 21, 2026

This changes only the selected original preview at [port 8042](http://127.0.0.1:8042/?v=original-preview-slide-20261121#calendar), in `DuckPlan-original-duck-preview`, starting at `807a456`. The canonical 8034 checkout, native app and hosted sites are unchanged.

## Acceptance and implementation

- Keep the approved original `task-finish 430ms ease both`, including its complete transform/opacity curve and the full-body thumbs-up duck inside the cloned task.
- Save completion immediately, but hold the list's rendering and outgoing row's geometry until that pop/fade ends. Rapid completions retain every held source until the final exit ends.
- Measure surviving task positions before rendering. After rendering the updated list, animate from those positions into their new positions over 260ms with `cubic-bezier(.2,.8,.2,1)`. This also handles horizontal matrix reflow. Content-sized list frames animate their height so their lower border closes smoothly.
- Cancel safely on reopening, errors, filters, navigation, owner changes, resize or reduced motion. Preserve keyboard focus and do not delay persistence or change task details. Reduced motion and the existing motion-off preference bypass presentation delays.

`completion-render-hold.js` and the existing app/controller coordination are reused from the canonical checkout. `completion-list-motion.js` provides the remaining-card movement. The original clone and in-clone duck are retained in this variant; no newer pop-out/shrink choreography was copied. Cache version is `duckplan-app-original-duck-preview-v115`.

## Verification

Playwright MCP Chromium 157.0.8103.79, isolated synthetic fixtures; no user preview data was changed.

- **PASS — 11 local browser cases:** Calendar at 1156/835/390px; Tasks at 1156/390/320px; Dashboard; matrix; dark mode; reduced motion; motion off. [Script](check-browser.js), [results](browser-results.json). Frame-by-frame samples verify that surviving cards stay fixed while the echo exists, then pass through intermediate slide positions after the echo disappears. Reload preserves completion and other task details. Keyboard focus survives, and no held source/echo remains.
- **PASS — 9 lifecycle cases:** rapid completion, reopen, filter, navigation, switching to reduced motion, signed-in success, early/late save failure and sign-out during a pending request. [Script](check-edge-cases.js), [results](edge-results.json). Signed-in cases use the actual loopback Worker/D1 fixture at 8798 with a static-file proxy to this 8042 variant; API and dynamic cloud configuration come from the fixture. Only 503 failure responses/delays are injected. This does not test a deployed backend.
- **PASS — original reference comparison:** matched 390x900 viewport, checkbox trigger and rendered animation samples at 0/75/150.5/300/420ms, comparing the approved 807a456 controller against the updated 8042 controller. Name, duration, easing, all keyframes, rendered opacity/transforms and single duck match exactly. [Results](comparison-results.json), [original rendered frame](reference-pop.png), [updated frame](updated-pop.png). The intended difference is the list remaining stationary underneath the pop-out.
- **PASS — 8 focused Node tests:** completion render ordering/cancellation/focus plus service-worker asset versioning; changed JS syntax and `git diff --check` pass.
- **NOT RUN:** Safari/WebKit, Firefox, installed PWA, native WKWebView or physical devices. Phone/tablet browser viewports establish responsive web behavior, not native runtime parity. Native synchronization remains gated on the user's request to Publish to public.

No remote push, public deployment, native synchronization, signing changes or production-account mutations.

## Immediate particles follow-up

The user's next request moves the confetti burst from the deferred, saved completion reaction into the checkbox change event itself. The original task echo, 430ms pop-out and following 260ms list slide are unchanged. The burst starts once alongside the echo, uses the existing larger burst for the last unfinished task, and retains the existing reduced-motion preference. Reopening, cancellation or save failure removes that operation's particle batch; a successful save does not trigger a second burst. Account/day completion messaging still waits for successful persistence. Cache advances to `duckplan-app-original-duck-preview-v116`.

- **PASS:** 7 Playwright MCP cases, Chromium 157.0.8103.79: desktop/phone Calendar, phone Tasks, Dashboard, last task, reduced motion and a signed-in loopback save delayed 700ms. A listener on the same checkbox event observes the particles and original task echo together, before the exit finishes; exactly one batch remains after the pop-out, and it cleans up. [Script](check-immediate-particles.js), [results](immediate-particles-results.json).
- **PASS:** the 9 lifecycle cases rerun, including reopen, rapid completion, navigation, reduced motion during exit, early/late failed saves and sign-out while saving. [Results](immediate-particles-edge-results.json). The actual loopback API is used; injected failures remain labeled above.
- **PASS:** the 8 focused Node tests, JavaScript syntax and diff checks rerun. Native/PWA/physical devices remain NOT RUN and unchanged.
