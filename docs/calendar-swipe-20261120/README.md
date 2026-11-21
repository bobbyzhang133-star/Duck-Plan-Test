# Touch calendar navigation — November 20, 2026

Local website on codex/calendar-deadline-editor-20261120, following 8a15b4e. User confirmed mode-dependent navigation: left → next and right → previous day/week/month, matching the arrow buttons. Phone Week changes one week even though its timetable displays a selected day. Final cache v113; JS/CSS/app key calendar-swipe-20261120-final.

## Behavior

calendar-swipe.js delegates one-finger gestures from the calendar and phone week strip, locks direction, requires deliberate horizontal movement and cancels multi-touch, long holds, native ownership and invalidated date/view/account context. Compatibility clicks after swiping are suppressed; a fresh intentional touch clears the guard so immediately tapping still works. It calls the existing date/period navigation without task/store/API writes.

Vertical scrolling and the approved timetable stretch remain intact. Phone touch-action allows vertical pan and pinch. Wide iPad timetables pan normally; a fresh outward swipe at either horizontal edge changes periods. iPad work blocks retain touch dragging; phone swipes may start on work without rescheduling it. Dialogs, open navigation/task drawers and active drags disable swipes. Date buttons and keyboard alternatives remain available.

## Verification

PASS: all 616 Node tests, syntax and git diff --check. Thirteen new tests cover direction/single commit, short gestures and compatibility clicks, immediate next taps, vertical/diagonal intent, multi-touch/cancellation, changed finger/native ownership, changed context/disabled state, ignored targets/long holds, horizontal panning, edge navigation, thresholds and listener cleanup. PWA coverage requires the new asset. node-tests.txt.

PASS: final runtime.js through Playwright MCP, Chromium 157.0.8103.79, native touch input via CDP Input.dispatchTouchEvent rather than DOM-dispatched events. Isolated local storage, Los Angeles timezone. Phone 390×844, 320×568/reduced motion, landscape 844×390 and iPad layout 835×1112 passed left/right in Day/Week/Month, vertical scrolling and tap Add/Cancel, preserving records. Phone-strip swipes follow Week mode; wide iPad panning changes only scroll position. runtime-results.json. The initial short-layout Month checks aimed at a clipped grid's offscreen midpoint; the harness now uses the visible intersection, and those checks pass without a product change.

PASS: work-touch-results.json: native touch swipe from a phone work block changes date only; an iPad touch drag moves work by 30 minutes, preserving its deadline/notes without navigating. No stray popup/ghost. These first-touch inputs are unaffected by the later compatibility-click reset.

PASS: signed-in-results.json: native touch advances the correct period in all modes against a dedicated synthetic account on the existing current loopback Worker/D1 at 8798; task records stay unchanged. No production accounts/data. The only later controller change clears the previous compatibility-click guard on a fresh touch. Final local back-to-back tests and the new unit test cover it, without changing account/context/navigation logic.

PASS: existing vertical rebound with native touch held the body at 23.2388px and returned to none without navigating. rebound-results.json records development cache v112; rebound code is unchanged. Final offline-results.json verifies ordinary browser-tab service worker v113, cached controller, offline swipe, and immediate real touchscreen tap opening Add. This does not establish installed-PWA launch.

## Release boundary

Local preview http://127.0.0.1:8034/#calendar only. No public deployment, GitHub push, backend/schema change, native sync/build or installation. Native repository stays clean at 2f4311a until **Publish to public**. Physical Safari/iPhone/iPad, native WKWebView, other engines and installed PWA are NOT RUN; Chromium touch emulation does not establish those runtimes.
