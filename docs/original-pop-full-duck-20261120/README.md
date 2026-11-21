# Original pop-out and full-body thumbs-up — November 20, 2026

Follow-up to `896af67`. User explicitly requested the original buggy version's pop-out motion and a full-body duck giving a thumbs-up, replacing the profile image plus separate thumb. Local website only. Cache v117; `original-pop-full-duck-20261120` presentation assets and `full-duck-thumbsup-20261120` mascot module. No remote push, public deployment or native bundle update.

## Motion reference

Inspected the actual original preview at `http://127.0.0.1:8042/`, exported from `76bffd7`, before editing. Its outgoing task uses430ms `ease` with transforms `scale(1)` at0%, `scale(1.012) translateY(-2px)` at35%, and `scale(.99) translateY(1px)` at100%.

The new completion copy uses those exact transforms, offsets, duration and easing. The earlier stronger1.035/-6px substitute bounce is removed. The original early opacity fade is deliberately extended for the user's requested pause, duck reveal and shared fade; this is a match of the requested pop-out motion, not a claim that the entire original effect, including its disappearing content/bug, is unchanged.

Returned to the original preview and compared it against8034 through Playwright MCP with matched390×844 viewport, synthetic task data and checkbox input. [Comparison harness](compare-original.js) and [results](comparison-results.json) record equal rendered transform matrices within0.0001 at0/75/150.5/300/430ms, plus equal430ms duration/`ease`. Matched peak screenshots are `reference-8042-peak.png` and `reference-8034-peak.png`. The old preview still shows the known oversized Due/Work icons; the current effect does not copy them.

## Full-body drawing

Added a `thumbsup` pose to the existing code-native Sigma SVG mascot system. It keeps the established broad-necked face/head and rounded plain body, orange bill and webbed feet, and adds a connected raised wing with an integrated thumbs-up. The popup now contains one complete duck SVG; there is no profile bitmap or floating hand SVG. The canonical profile/app-icon raster artwork is untouched.

Other poses keep the new wing hidden. `mount`/`setState` can switch happy→thumbsup→happy while preserving the head markup and restoring the original pose. Existing pond side-profile behavior is unchanged. The completion card still settles, holds, reveals the duck and fades both layers through their common parent, with existing reduced-motion/motion-off and stale-card cleanup.

## Verification

Chromium157.0.8103.79 via Playwright MCP, isolated synthetic contexts and loopback previews.

- **PASS:** matched original/current motion comparison described above, including rendered peak captures. These paused browser-frame samples establish the transform curve; they are not a physical-device frame-rate claim.
- **PASS:**14 overdue/future completion cases at1156,835,390,320px, dark mode, reduced motion and motion off. [Harness](check-animation.js), [phase results](animation-results.json). Full body/feet/wing present; no profile images, date icons or copied controls. Text fits, bounds stay inside the viewport, no page errors, finite cleanup and completed state survives reload.
- **PASS:** live keyboard Space completion in desktop Calendar, phone Calendar sheet, Dashboard and priority matrix; full duck appears, reopening clears the card. Happy→thumbsup→happy hides/shows/hides the wing and preserves head markup. [Additional results](additional-results.json).
- **PASS, fixture-backed:** real signed-in checkbox completion against the loopback Worker/D1 fixture8798, full duck feedback and completed state after reload. No mocked transport or production account data.
- **PASS:** both existing service-worker cache tests; syntax checks for changed JS and `git diff --check`. Existing deadline layout/behavior is unchanged by this follow-up, so the preceding38-test deadline suite was not repeated.
- **NOT RUN:** native WKWebView, installed PWA, physical Safari/device smoothness, delayed cloud failure or end-to-end owner-race behavior. Native app remains frozen until “Publish to public.” Existing persistence-aware celebration/Undo review recommendations remain separate.

The SVG pose extends the established code-native drawing system, so no raster artwork generation or replacement was needed. Screenshots are rendered application views; the user's preview storage and records were untouched.
