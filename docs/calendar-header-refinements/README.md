# Due red, Week divisions and neutral Day timetable

November18,2026. Local CSS-only change on `codex/calendar-header-refinements-20261118`, based on `d2e0142`.

## Requested changes

- Date-only Due counts and expanded cards now use a red outline and matching red flag, sharing the exact-time deadline accent tokens in light/dark themes. Focus/selection also use that accent. Existing disclosure, overflow and task actions remain; work-block class colors are untouched.
- Subtle1pxseparators divide adjacent Week date headings and phone Week selector cells. These are pointer-transparent inset strokes, not boxed tiles; no heading width, border or hit area changes.
- Day timetable, hour gutter and scroll surface are white in light mode, neutral in dark mode. The whole-column yellow selection wash is removed only in Day. Week retains selected-day context; Personal/no-class work blocks stay light yellow and custom classes retain their colors. The decorative stretch continuation inherits the new lane color.

## Google and older bounce reference

The supplied signed-in URL redirected to Google sign-in in the available reader; no private account/calendar was accessed. Consulted Google's official [Calendar web design announcement](https://workspaceupdates.googleblog.com/2024/10/new-look-and-feel-and-dark-mode-google-calendar.html), and visually inspected its public light-mode screenshot in an isolated browser. That image is an October2024design example, not proof of the user's current account UI. The article's decorative hero URL returned403; the actual public Calendar screenshot rendered normally.

Also opened the unauthenticated [US Holidays Google Calendar Week embed](https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles&mode=WEEK). Its public time surface used native scrolling (`overscroll-behavior:auto`, no computed transform): top outward wheel input left scrollTop/child geometry unchanged, ordinary inward input scrolled180px. These DOM metrics do not establish physical OS compositor/rubber-band physics or timing, and the embedded UI is not the signed-in full application.

Git history confirms Calendar before `b3f8941` allowed native browser boundary behavior. The custom61sample440msspring came from the older approved `6814b34` navigation and was already installed in the current timetable. The user asked to use Google as the reference after being asked which old profile to match. Given the reference limits, no invented “Google spring” or undocumented timing change was applied. The current bouncy return, fixed headers, drag recovery and top-line continuation remain and were retested. Reference work is complete; exact physical Google bounce equivalence is not claimed.

## Verification

- **PASS:**4existing PWA/cache tests and final diff checks. No assertion-only product tests were added for these CSS changes.
- **PASS:**16isolated Chromium157.0.8103.79 cases, Day/Week and light/dark at1156×900,835×1100,390×844 and320×568. Red borders/flags match in collapsed and expanded Due controls; keyboard Space/Enter still folds; all6Week separators render at the appropriate desktop/phone headings; light Day is255/255/255, dark Day matches the neutral gutter; Week keeps its wash; custom work remains#538fc5 and light Personal work remains255/243/191.24hours, continuation material, no overflow or record changes. `runtime.js`, `runtime-results.json`.
- **PASS:**6current native-browser animation-sampling cases, both edges at1280/835/390px: unchanged2.81635pxrebound and fixed headers. These are Chromium browser animations, not the installed native app.
- **PASS:**actual service worker activatesv85, caches byte-identical CSS, and offline reload keeps the white Day timetable.
- **PASS:**visually inspected `week-1156.png` and `day-390.png` synthetic examples.
- **NOT RUN:**the user's signed-in Google Calendar, physical Google/DuckPlan bounce, native WKWebView/install, installed PWA launch, physical Safari/iPhone/iPad and fresh authenticated DuckPlan backend acceptance. Phone/iPad results are emulation.

User data and existing preview retained; owned browser contexts closed. Local review: http://127.0.0.1:8034/?v=calendar-header-refinements-20261118#calendar . TEST feature backup only, no shared-main merge, public deployment, migration, native bundle sync or installed-app update.
