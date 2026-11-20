# Foldable date-only Due row

November18,2026. Local website on `codex/folding-due-row-20261118`, based on `e592335`. The user explicitly selected the **Due row above the timetable**, rather than task-panel groups or task-card details.

## Behavior

The row starts folded, with a neutral flag/count in each day containing date-only deadlines. The left-gutter Due button has a disclosure chevron and an exact accessible count. Click Due or any day's count to expand the row; click Due again to fold it. Every control has a44pxtouch target; the compact band is45pxincluding its existing lower border.

Expanded content retains the existing three-item preview and per-day “more/fewer” controls. Longer lists scroll within their bounded area, and the final item remains reachable. Date-only tasks open the existing compact preview. Counts exclude completed/deleted tasks and timed deadlines. Timed deadlines stay at their exact minutes in the24-hour grid; their Work/Due representations and task records are unchanged. A visible range with no date-only deadlines has no Due row.

Folding preserves horizontal/vertical scroll where valid and moves focus to the replacement Due toggle with preventScroll. Expansion stays through ordinary rerenders/date/view changes during the current session, resets folded on reload or account-context change, and does not create a stored/account preference. Keyboard Space/Enter, hover/press/focus and lightweight local-action semantics follow the existing button rules. The fold shadow and timetable-only spring keep both header rows fixed.

This implements the user's clarified disclosure request. The earlier saved chat plan explicitly left the Due strip's expansion interaction unchanged, so this is a new functional addition rather than a claim that the original shadow plan already specified an accordion.

## Verification

- **PASS:**564full Node tests, including2new substantive folded/expanded row tests.40focused calendar presentation/integration/selection/viewport/elastic/PWA cases pass. Actual rendering fixtures now include the real date-only task/state rather than a dead helper stub. JS syntax and diff checks pass.
- **PASS:**12isolated Chromium157.0.8103.79 cases at1280×950,835×1100,390×844 and320×568: light Day/dark Week, folded count5excluding a timed task,45pxband, keyboard Space/Enter, focus and scroll retention, all5overflow deadlines, exact17:00pin geometry, count-click expansion, correct deadline preview, no data changes/overflow/page exceptions. Completing the last visible date-only tasks removes the band and survives reload. `runtime.js` and `runtime-results.json`.
- **PASS:**6additional checks at835/390px: closed/expanded Due rows remain fixed during timetable stretch; last overflow item opens the correct preview. No artificial stretch is applied to the deadline-list scroller.
- **PASS:**actual service worker activatesv81; cached app/presentation/CSS texts exactly match served source; an offline reload retains date-only data and can expand the Due row. This is a browser tab/service-worker result, not an installed-PWA launch.
- **PASS:**visually inspected folded835px and expanded390px screenshots. Expanded overflow remains a bounded inner scroller; it is not a promise that all entries fit simultaneously. Screenshots are synthetic records, not user data.
- **NOT RUN:**fresh authenticated backend, native WKWebView/install, physical Safari/iPhone/iPad/macOS trackpad and installed PWA acceptance. This presentation-only feature does not change persistence/schema/API/native transport; no platform-parity claim is made.

Browser harness corrections: account for the existing1pxrowborder; measure the exact-time pin relative to its column rather than reading its grouped relative top; seed local fixtures only once so reload tests do not overwrite saved completions. These corrections required no application workaround. All owned browser contexts closed;8034preview retained and user records untouched.

Review http://127.0.0.1:8034/#calendar after refreshing. Local site/TEST feature backup only; no public deployment, shared-main merge, remote migration, iOS bundle sync or installed-app update.
