# Brighter raised header and stationary scroll boundaries

November17,2026. Local website based on `b5bbeaa`. The user requested that the top date tab stay stationary during edge pulls and look brighter than the timetable beneath it, using Material3 as guidance.

## Change and reference

- Raised header surface is opaque white in light mode, including date-only deadlines and the header corner. It is no darker than ordinary white columns and brighter than the selected yellow column. In dark mode, a neutral12%white mix above the existing card tone makes the header brighter than both ordinary and selected columns. Existing readable ink/counts, date badges and fold shadow are retained.
- Calendar `overscroll-behavior` changes from `contain` to `none`. `contain` prevents chaining but still allows the native overscroll affordance to move the entire scroll container, including its sticky descendants. `none` disables that boundary bounce while retaining ordinary vertical/horizontal scrolling. No JS wheel/touch cancellation or custom elastic transform is introduced.
- No task dates, stored records, counts, hit targets,24-hour geometry or midnight-label visibility change. Cache75 and the CSS version key ensure the updated surface/boundary behavior loads.

Primary design reference: Google's [Material3 documentation, Elevation](https://developer.android.com/develop/ui/compose/designsystems/material3#elevation), which describes tonal differentiation together with shadows and customizable surfaces. Brightening the light-theme header is the user's palette choice, not a claim that M3 universally requires every elevated surface to become lighter. The [M3 handbook elevation URL](https://m3.material.io/styles/elevation/overview) required JavaScript in the text reader and failed certificate validation in the browser; that warning was not bypassed. Google's official Android documentation provided the accessible M3 reference.

Primary boundary reference: [CSS Overscroll Behavior specification](https://www.w3.org/TR/css-overscroll-1/), distinguishing `contain` from `none`. The current editor's draft was also read; it documents that `none` suppresses both chaining and local overscroll affordances. This fix addresses browser boundary bounce, rather than implementing the separate proposed timetable-only elastic effect.

## Verification

- **PASS:**9 existing viewport/PWA tests (`tests.txt`) and final diff checks. This bounded CSS fix does not need a new assertion-only CSS unit test or full unrelated suite.
- **PASS:**20 actual Chromium157.0.8103.79 local-mode cases: Day/Week, light/dark at1280x1000,785x900,390x844,320x568 and844x390. `runtime.js` / `runtime-results.json` and `after-*` screenshots. Browser wheel input at top/bottom leaves the header/toolbar stationary; ordinary wheel scrolling and fold shadow continue. Header luminance is at least that of every underlying column;24hour cells, hidden midnight label and task JSON remain unchanged. No page errors.
- **PASS:**actual cache75 hashes for all six shared web inputs match source; offline reload retains a task and the count/fold behavior. `cache-runtime.js`, `cache-results.json` and `source.json`. This is browser SW evidence, not an installed-PWA test.
- **PASS:**existing in-app preview refreshed to `raised-header-20261117`; computed header is white and overscroll is `none`. Prior Day/TuesdayNovember17 was restored after reload. No user task records were edited.
- **NOT RUN:**physical macOS trackpad/iOS rubber-band rendering, native WKWebView/build/install, Safari/Firefox, signed-in backend and installed PWA. Browser wheel and computed-style checks verify the implementation in the tested runtime; they do not prove every OS compositor's edge gesture behavior. No all-platform claim is made.

Synthetic browser contexts closed; local8034 preview retained. No public deployment, shared-main merge, remote migration or native/app update.
