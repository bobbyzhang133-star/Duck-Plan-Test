# Phone and iPad layout review

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
