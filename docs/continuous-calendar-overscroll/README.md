# Continuous timetable edge stretch

Implemented November 18, 2026 on `codex/continuous-calendar-overscroll-20261118`, based on `26e8f73`. Local website only; viewport asset key `continuous-overscroll-20261118`, service-worker cache v86.

The first movement crossing either timetable boundary now scrolls to the limit and converts its remaining travel into stretch. Continued wheel or finger movement meets progressive resistance, approaching a 48px maximum. The exposed edge remains part of the same gesture. Reversing input unwinds the visible pull before handing remaining travel back to ordinary scrolling. Native non-cancelable wheel/touch bursts paint only at the boundary, without doubling in-range travel.

The timetable moves as one painted surface while date headings and the Due band counter-move to remain fixed. The existing 61-sample, 440ms spring return is retained, with a small proportional overshoot. Wheel release starts after 90ms idle; touch holds until lift/cancel. Frame-coalesced transforms, reduced-motion support, horizontal scrolling, drag guards, cleanup and the upper grid continuation remain intact. No storage/API/schema/native-project changes.

## Reference

Used the [public Google Calendar Week embed](https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles&mode=WEEK) and [Google's public Calendar design announcement](https://workspaceupdates.googleblog.com/2024/10/new-look-and-feel-and-dark-mode-google-calendar.html) as qualitative references. The embed showed bounded native scrolling (`overscroll-behavior:auto`), with no DOM transform in the tested Chromium runtime. It does not expose an exact OS rubber-band curve. The private account URL required sign-in; no private events were inspected. DuckPlan's explicit resistance (`48 * .55 * distance / (48 + .55 * abs(distance))`) and existing spring provide consistent fixed-header behavior; exact Google/native physics equivalence is not claimed.

## Verification

- **PASS:** 20 focused Node elastic/viewport/PWA tests and all 569 Node tests. New crossing-limit and continuous-edge cases failed before the implementation; existing lifecycle, spring-resume and drag-recovery coverage remains passing. Syntax and diff checks pass.
- **PASS:** seven real Chromium wheel/CDP-touch cases at 1156, 835 and 390px: first crossing, continued pull over the exposed gap, reverse unwind, normal-scroll handoff, bottom return, held touch and release. Fixed headers and unchanged records verified.
- **PASS:** 13 existing browser cases cover Day/Week, light/dark, 1280/835/390/320px, normal scrolling, trusted touch, reduced motion, correct slot editor/cancel and Month. Six sampled spring cases confirm proportional overshoot and fixed headers at both ends across desktop/tablet/phone viewports. The historical harness now checks rebound proportionally to the variable pull instead of requiring a fixed pixel overshoot.
- **PASS:** actual mouse Task List drag after stretching schedules the isolated task at 03:00, retains its 18:00 deadline, and survives reload. An initial QA rerun incorrectly reseeded its fixture on reload; guarding the fixture corrected that harness issue. No application persistence change was needed.
- **PASS:** actual service-worker v86 caches byte-identical viewport code; offline reload stretches on the first crossing movement, with no page errors. This is browser-tab service-worker evidence, not an installed PWA launch.
- **PASS:** inspected `phone-held-pull.png`; the date heading and bottom controls remain fixed and the timeline has a continuous backing during the pull. The touch-active slot outline is transient input feedback.
- **NOT RUN:** Safari/Firefox, physical Mac trackpad/iPhone/iPad, installed PWA, native WKWebView/installed app and fresh signed-in backend workflows. Chromium responsive/touch emulation does not establish native or exact OS physics parity. Native bundle and public deployment are unchanged.

Detailed values: `runtime-results.json`. New gesture harness: `runtime.js`; existing regression/spring harnesses are in `../calendar-edge-stretch/` and `../calendar-bouncy-stretch/`.

Preview: `http://127.0.0.1:8034/?v=continuous-overscroll-20261118#calendar`.
