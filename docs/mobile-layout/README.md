# Phone and iPad layout review

## November 12: drawer polish

Removed the extra square edge below the phone task summary by matching the Calendar clipping wrapper and frame to 18px corners and removing the clipped frame shadow. The task button's intended rounded border and keyboard focus remain.

The phone Tasks sheet now uses a dedicated 340ms transform curve and a coordinated 220ms backdrop fade. The transparent closed backdrop remains mounted but inert, so opening/closing can reverse smoothly; it does not block the calendar. Blur is constant rather than animated. Desktop/iPad layout timing is unchanged. Versioned the changed assets and advanced the app cache to v15.

Verified 390px and the reported 484px width, cold/warm opening, 4× CPU throttling, five rapid reversals without position/opacity jumps, Escape/focus return, task editing, reduced motion and resizing during opening to iPad. Chromium measurements showed no long tasks or frame gaps above 25ms; physical-device smoothness was not measured. All 215 automated tests pass.

Current screenshots: [clean phone corners](drawer-polish-closed.png) and [expanded drawer](drawer-polish-open.png).

Current local preview: http://127.0.0.1:8034/?v=drawer-polish-20261112#calendar.

## November 12: phone Calendar and Tasks sheet

Applied the user's review feedback after reading the open Chrome conversation and inspecting its two conceptual phone layouts and attached phone/iPad screenshots. The user explicitly chose a full-width phone Calendar with Tasks initially collapsed into a sheet. The iPad workspace remains intact.

- Phones have Calendar, Home, Tasks, Classes and More in bottom navigation; Goals & habits, Notes and Settings remain available through More.
- Day opens by default. Week uses seven date buttons above one selected day's schedule. Month fits the available width and opens at the top.
- A visible Add Task button and task summary open the existing editor and task list. The sheet scrolls, traps focus, supports Escape/backdrop dismissal and restores its launcher. Resizing to iPad restores the inline task panel.
- Calendar has one schedule scroller; route changes reset the workspace scroll. The landscape toolbar is condensed so the schedule retains usable height.
- Selected tasks use restrained tint and an inset border, while outer rings remain for keyboard focus. Fixed CSS specificity that incorrectly gave repeated calendar controls elevated button hover/press effects.
- Preserved the Sigma artwork, existing task data, Cloudflare/PWA notifications and native AlarmKit behavior. Advanced the offline cache to v14 and included both new navigation assets.

Verification: all 215 Node tests pass. Chromium touch/mobile checks covered eight phone/iPad sizes and three Calendar modes, plus all seven routes at 320×568 and 844×390. Task add/edit/delete, sheet/editor focus return, keyboard wrapping, reduced motion, dark mode, Month scroll reset and return from scrolled Settings passed. The existing form remains scrollable with all options expanded at 390×430; that is reduced-height emulation, not a physical software keyboard test. No physical-device or Safari/WebKit verification was performed.

Synced all 68 website files into the existing `DuckPlan-iOS/landing` copy. Its unsigned generic-iPhone build succeeded; every bundled website file matches the reviewed source, and native Swift/signing files are unchanged. Installing on the physical phone remains separate.

Current screenshots: [Phone Calendar](phone-calendar-20261112.png), [expanded Tasks](phone-tasks-20261112.png), [phone Week](phone-week-20261112.png), [phone landscape](phone-landscape-20261112.png), [iPad Calendar](ipad-calendar-20261112.png).

Current local preview: http://127.0.0.1:8034/?v=phone-planner-20261112#calendar.

## Earlier November 11 review

Reviewed locally on November 11, 2026, on `codex/mobile-layout-cleanup`, based on shared main `02289e0`. Included in the user's requested test GitHub upload on November 12 alongside the native iPhone alarm changes. This upload does not deploy the website or update shared GitHub main.

## Fixes

- The short landscape Calendar task panel previously showed only its header. Wider short screens now use task/calendar columns; narrower short screens can scroll the overall planner while retaining usable panel heights.
- Compact task headings place the date and completion copy across the available width. Calendar mode changes keep a consistent toolbar arrangement on narrow phones.
- Touch calendar controls have 44 px minimum heights, with larger day/time labels.
- The Dashboard week strip scrolls horizontally on small screens instead of squeezing seven date buttons below their content width. Keyboard focus scrolls the final day into view.
- Settings reminder controls and narrow Dashboard task/schedule cards reflow within the workspace when navigation is expanded.
- Dark Calendar panels, counters and time axis now follow the selected theme; pale panel backgrounds no longer conflict with light text.
- Versioned the stylesheet and advanced the PWA cache to v13.

## Verification

Chromium browser touch/mobile emulation was used, with isolated local demo data. No physical iPhone/iPad or Safari/WebKit run was performed.

Phone viewports: 320×568, 390×844, 430×932, 667×375 and 844×390. iPad viewports: 768×1024, 820×1180, 1024×768 and 1180×820.

All seven sections were checked at each size with navigation folded and expanded: 126 layout states, with no horizontal page/workspace overflow. Calendar Week/Month and the narrow Dashboard week/habits widgets retain intentional internal horizontal scrolling.

Further interaction checks:

- Calendar Day/Week/Month retain visible tasks and a usable calendar viewport on phones and tablets.
- Task dialogs fit, expose all expanded options through internal scrolling, and restore focus after dismissal.
- An 80-character task name was saved, reopened and deleted in the isolated QA browser. A 390×430 reduced-height viewport checked dialog sizing while open; this emulates reduced space, not an actual software keyboard.
- Dark mode uses dark panel/axis surfaces with readable text; reduced motion remains respected.
- The final browser checks recorded no page errors.
- All 214 Node tests, changed JavaScript syntax and `git diff --check` pass.

## Screenshots

- [Phone Calendar](phone-calendar.png)
- [iPad portrait Calendar](ipad-portrait-calendar.png)
- [iPad landscape Calendar](ipad-landscape-calendar.png)
- [Phone landscape Calendar](phone-landscape-calendar.png)
- [Phone dark Calendar](phone-dark-calendar.png)

Current local preview: http://127.0.0.1:8031/?v=mobile-layout#calendar.
