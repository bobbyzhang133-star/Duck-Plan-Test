# Mobile UI inspection and fixes — November 24, 2026

Local website checkout: `DuckPlan-original-duck-preview`, branch `codex/mobile-ui-fixes-20261124`, based on `d178d2c3d193448f298baaa1eb041badc5e589b9`. This patch updates only CSS, asset/cache handling, one cache regression and review evidence. Public deployment and the native app checkpoint are unchanged.

## Reproduced and corrected

- At 320×568, Dashboard's This week grid had a 254px viewport and 342px scroll width. Saturday/Sunday were offscreen behind a secondary horizontal scroll, although the page itself reported no overflow. All seven dates now fit within the card; small task counts remain available in each date's accessible name. The seven-date row is also checked at 390px and in landscape. Calendar's separate phone day selector is unchanged.
- At 320px, the Tasks List/Priority matrix switch wrapped its second label and stretched the segmented control. Both labels now stay on one line, with 44px button heights and existing hover/press/selected/focus behavior.
- The v147 service worker's unversioned precache initially copied older CSS through the browser HTTP cache. Installation now requests every shell asset with `cache: "reload"`. A real update of the existing cache changed the cached motion/actions CSS from 34,787/11,846 bytes to the current 34,843/12,030 bytes. Versioned HTML links and cache version are updated together.

## Runtime evidence

Playwright MCP, Headless Chromium 158 on macOS; ordinary local browser at `http://127.0.0.1:8799/`. Inspection used an isolated context. Functional touch checks use an additional isolated context with `hasTouch: true` and `isMobile: true`. These are browser emulation results, not physical Safari, installed PWA or native-app results. Test tasks exist only in disposable contexts; user data was not changed.

| Check | Result | Evidence |
| --- | --- | --- |
| Calendar, Dashboard, Tasks, Classes, Goals/Habits, Notes, Settings at 320px; additional 390px/844px landscape bounds inspection | PASS for inspected states | `before-*-320.png`, landscape captures; visual inspection plus descendant bounds checks, not just page overflow |
| Seven visible Dashboard dates and readable Tasks switch at 320×568, 390×844 and 844×390 | PASS | `after-week-*.png`, `after-tasks-*.png`, `touch-tasks-*.png` |
| 835×1112 tablet and 1280×950 desktop calendar/task composition | PASS | `calendar-ipad-835.png`, `calendar-desktop-1280.png`; tablet task column x93–353/calendar x353–818, shared y17/1078px height |
| Touch Sunday navigation, task sheet opening/closing, List/Matrix switching, More opening/closing at each phone size | PASS | `browser-qa.js`: 24 assertions |
| Blank-title rejection, long-title task save/reload, keyboard date focus/Enter, dark narrow layout, reduced-motion Escape and no application exceptions | PASS | `browser-qa.js`: seven further assertions; `long-title-320.png`, `dark-reduced-week-320.png` |
| Updated switcher hover, held press, release and keyboard focus | PASS | At320px with fine pointer: transparent→white hover, held scale0.945, release settles, keyboard Tab/Shift+Tab shows2px outline. Programmatic focus after a pointer click correctly does not claim keyboard focus-visible. |
| Updated service-worker precache and offline reload of corrected week/switcher; offline task save/reload | PASS | Actual v147 CacheStorage contents inspected; `offline-week-320.png`; 254px client/scroll width, seven dates, both switch buttons 44px |
| Focused Node checks, service-worker syntax and diff whitespace | PASS | 14 tests: `pwa-app`, `button-interactions`, `task-matrix`; `node --check landing/service-worker.js`; `git diff --check` |
| Physical phone Safari, real on-screen keyboard, installed PWA and native WKWebView | NOT RUN | No physical/native claims; native release gate preserved |
| Signed-in backend/Google/Axis actions | NOT RUN | Layout-only local mode; previous Google credential setup remains deferred; no account/backend code changed |

Run the saved `browser-qa.js` through Playwright MCP's `browser_run_code_unsafe` with the local server running. The script creates and closes its own disposable mobile context. The initial Python preview briefly reset several asset connections; a clean reload and the isolated final run produced no application exceptions. Those initial incomplete renders were not treated as valid UI evidence.

No new opening/closing behavior was introduced. Existing sheet, task editor and More transitions were preserved and exercised in both directions. No server schema, auth settings, native files, approved artwork or production records changed.
