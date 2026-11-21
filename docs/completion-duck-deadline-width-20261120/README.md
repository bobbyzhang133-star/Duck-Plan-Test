# Completion duck and full-width deadlines — November 20, 2026

Local follow-up to `911c64a`. User direction: return to a task-block pop-out without calendar/clock icons, bounce back, pause, reveal the logo duck giving a thumbs-up, then fade the duck and task together. Also fill the usable calendar day width with each timed deadline, placing its diamond at the block's left edge. No public deployment, remote push or native app update. Web cache v116; completion assets `completion-duck-20261120`, date styles `deadline-full-width-20261120`.

## Implementation

The separate, inert completion block keeps the task title and ordinary/overdue caption. It pops slightly outward, rebounds and settles by450ms, pauses, then reveals the approved v11 transparent logo image with a small code-native thumbs-up gesture. The original logo image/face/contour is unchanged. At1.28s the parent fades both the card and duck together, retiring the effect at1.64s. The previous conversion into a large yellow check is removed. A bounded particle burst follows the gesture. Reopening/deleting the task or changing owner retires a lingering completion block on render; motion-off changes also clear it. No task data is changed by the presentation layer.

The completion block is self-contained rather than cloning the ancestor-scoped Due/Work markup that caused the original oversized icons. Neither the calendar nor clock icon is present in the effect; ordinary task cards keep their date information. Its text column reserves space for the duck, and its bounds are constrained inside the viewport.

Timed deadline anchors retain3px column margins for both ordinary and overlapping deadlines. The red background now fills that whole marker instead of starting after an empty gutter. The10px diamond sits2px inside the block's left edge and remains inside the day column. The existing z-index above scheduled work, exact-time anchoring, grouped markers, keyboard focus and previews are preserved. Day-boundary vertical clamping is unchanged.

## Verification

Playwright MCP, Chromium157.0.8103.79, isolated synthetic data. [Animation harness](check-animation.js), [phase results](animation-results.json), [deadline harness](check-deadlines.js), [deadline results](deadline-results.json) and [additional live checks](additional-results.json).

| Check | Result |
| --- | --- |
|14 overdue/future completion cases at1156,835,390,320px, dark, reduced motion and motion off | PASS: block overshoots, rebounds and holds; duck follows the settled block, gives thumbs-up and shares the parent's fade. Text fits; no copied date icons/controls, overflow or page errors. Completed state survives reload. |
| Approved logo | PASS: actual v11 transparent192px export loads unchanged; no regeneration or alteration of approved facial artwork. |
| Animation lifetime | PASS: effect and particles clean up; reduced/motion-off cases have no echo. |
| Keyboard Space in desktop Calendar, phone Calendar sheet, Dashboard and priority matrix | PASS: correct duck feedback; reopening the task clears the lingering card. |
| Real loopback Cloudflare Worker/D1 fixture8798, signed-in phone viewport | PASS: actual checkbox completion shows the duck and survives reload. No mocked transport or production records. |
|10 Day/Week layout cases across1156,835,390,320px and dark mode | PASS: all single, grouped, overlapping, midnight and23:59 markers fill the usable day width; backgrounds start at0; diamond stays inside the column at the left edge. |
| Deadline previews and grouped lists | PASS: overlapping work does not block the correct preview; grouped deadlines retain both tasks. Opening/closing previews leaves task data unchanged. |
| Existing Node tests | PASS:38 tests in calendar-date-presentation, calendar-task-preview and service-worker-cache. JS syntax and diff checks also pass. |
| Native WKWebView, installed PWA, physical Safari/device performance | NOT RUN. Native app intentionally unchanged until “Publish to public.” Responsive Chromium checks do not establish native parity. |
| Failed cloud save, concurrent remote owner changes | NOT RUN in this visual change. Existing optimistic success coordination/Undo review recommendations remain separate; the new owner guard is not a claim of end-to-end account race coverage. |

Phase captures pause the relevant browser animations and render0/160/304/500/950/1440ms samples. They establish the phase geometry/order and shared fade, not frame-rate or physical-device smoothness. Separate live-time checks verify keyboard actions, reopen cleanup and signed-in persistence. Screenshots show synthetic task/deadline fixtures; the user's preview storage and records were untouched.
