# Rebound rebuilt from rendered public references

November 19, 2026. Branch `codex/native-reference-rebound-20261119`, based on `efab58d`. Website asset `native-reference-rebound-20261119`, service-worker v89.

The user authorized other reference pages after the private Google Calendar URL required sign-in. Inspected the actual [public Google Calendar Week page](https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles&mode=WEEK), then **returned to that same page after the final implementation**. The earlier DOM-only probes were insufficient: rendered frames show native compositor movement even with scrollTop 0 and no CSS transform. The user's first-upward-scroll rebound observation was correct.

## What changed

The old wheel effect stretched much farther and used an unrelated route-animation spring with a slow start and an extra oscillation. Small wheel pulls now approach Chrome's native 1/20 displacement ratio. A tanh bound keeps unusually large pulls within the existing 48px painted continuation. Touch retains its stronger resistant pull and holds until finger release.

Return now decays immediately using the non-Android exponential rate 20/1.6 documented in [Chromium's current overscroll implementation](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/platform/widget/input/elastic_overscroll_controller_exponential.cc), ending at the half-pixel rounding threshold. There is no added opposite-direction oscillation. Each pull's duration follows its displacement; the tested 240px wheel input produced a roughly 253ms animation. Wheel idle delay is 8ms, reduced from 50ms after frame capture exposed the remaining plateau. Finger release starts return directly. This browser implementation uses a zero-release-velocity return; it does not have Chrome's internal momentum-phase data and does not claim to reproduce all native velocity states.

Date/Due headers remain fixed by existing counter-transforms; the timetable, hour labels and current-time line move together. Half-height date dividers, responsive layouts, class colors, deadline semantics, reduced-motion and drag guards remain. No route/button motion, saved task data, API/backend or native-project changes.

## Rendered comparison

Same macOS Chromium157.0.8103.79, viewport1280×950, first outward synthesized mouse gesture240px at1800px/s. Captured Page screencast PNG frames, rather than interpreting DOM coordinates as painted movement. Tracked Google's white card edge and DuckPlan's hour rule; subtracting each marker's baseline measures translation despite different layouts.

- Before implementation: Google stretched12px, then returned toward rest without visible extra oscillation (`google-before-samples.json`).
- After implementation, returned to Google: measured peak11px versus DuckPlan12px. Different frame/input scheduling makes this a raster-tolerance comparison, not frame-perfect timing equivalence.
- After aligning the last peak/release frame, linearly interpolated10ms samples differ by at most1.25px (mean0.74px). Observed return to baseline267ms DuckPlan versus245ms Google. Full values: `paint-comparison.json`.
- Google moves its native page backing; DuckPlan intentionally keeps its date header fixed, as previously requested. This is a documented structural difference.

**PASS for the measured public-reference gesture within the documented raster tolerance. NOT VERIFIED for private-account Google Calendar or physical trackpad equivalence.** The public page is now an explicitly authorized alternative, not a silently substituted equivalent. The rule now records that distinction and requires the same return-and-compare process for approved alternate sources.

## Verification

- **PASS:** all570Node tests;21focused elastic/viewport/PWA checks are included. Two new reference expectations fail on the old implementation (excessive pull and extra oscillation), then pass with this change. Syntax and diff checks pass.
- **PASS:**21real browser cases at1280/835/390/320px, Day/light and Week/dark, both limits, fixed headings, bounded first wheel pull and no oscillation. Trusted Chromium touch holds and releases; reduced motion, correct01:00slot editor/cancel, Month and unchanged task records pass. `runtime.js`, `runtime-results.json`.
- **PASS:** actual mouse task drag after rebound,03:00scheduled time and18:00deadline survive reload. Actualv89cache contains byte-identical viewport code and offline reload executes the new~253msreturn.
- **PASS:** visually inspected Google before/pull images and DuckPlan peak image; kept representative before/peak/settled PNGs for the comparison.
- **NOT RUN:** physical Mac trackpad/iPhone/iPad, Safari/Firefox, installed PWA, native WKWebView/installed app, private Google account and fresh signed-in DuckPlan backend workflows. Responsive/touch emulation does not establish these passes. No public deployment or app synchronization.

`capture.js` captures DuckPlan and then revisits Google. Save each returned frame set as `frames.json` and run `swift -module-cache-path /private/tmp/duckplan-swift-modulecache analyze.swift <folder>` to derive painted coordinates and representative PNGs. Raw full frame streams are temporary; compact samples and representative frames are retained here.

Local preview: `http://127.0.0.1:8034/?v=native-reference-rebound-20261119#calendar`.
