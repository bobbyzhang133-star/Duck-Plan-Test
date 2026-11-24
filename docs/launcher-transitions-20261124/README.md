# Restore launcher transitions — November 24, 2026

Website checkout: `DuckPlan-original-duck-preview`, branch `codex/restore-launcher-transitions-20261124`, based on `8bd8d22`. Local review and TEST backup only. No public deployment or native bundle synchronization/build.

## Cause and correction

The November23 changes `5b701e4` and `4daaddb` deliberately routed calendar work/deadline activation through `fade: true`. The first sought to avoid stretching a wide Day work bar into a compact editor; the second applied the exception in all calendar views and grouped deadline handoffs. Actual baseline activation produced a320ms, opacity0.6→1, translateY6px→0 animation with no morph surface. This bypassed the established launcher expansion rule. The November24 mobile layout patch did not introduce that exception.

Removed the exception at both calendar entry points, from the editor capture call and from the shared helper. Calendar blocks still open the editor directly; their window now uses the same original nine-part shell/source crossfade and reverse closing path as other task-editor launchers. Existing reduced-motion, focus/cancellation, data saving and compact editor behavior remain.

The dialog opener inventory found existing shared capture/open/close calls for class, note, goal/habit, template/resource and phone More windows. Template management alone used a separate scale-only opening and generic fade/scale closing. It now captures its own trigger and uses the shared anchored open/close helper, including rapid cancellation and focus return. Inline disclosures retain their reversible height transitions and the navigation sidebar retains its workspace-resizing motion. OS-owned permission/install surfaces remain platform-owned.

The button rule now explicitly forbids fade-only/pop-in exceptions for app-owned window openers, including calendar blocks, grouped handoffs and management menus. Cachev148 and versioned script URLs carry the correction into browser offline assets. The two November23 documents describe historical behavior superseded by this change.

## Verification ledger

Runtime: Playwright MCP, Chromium158.0.8127.38 on macOS. Dedicated browser contexts, isolated local demo data at `http://127.0.0.1:8799/?demo=completion-20261124-*#calendar`; no production accounts or user records. Phone/tablet inputs use `hasTouch`/`isMobile` emulation and are not physical Safari or native results.

| Check | Status | Evidence |
| --- | --- | --- |
| Work blocks open directly using launcher geometry in Day/Week/Month, then close with focus restoration | PASS |18 view cases across1280×950,320×568,390×844,844×390,835×1112 and390×844 reduced motion; `calendar-results.json` |
| Quick Escape/reopen and task save/reload, no application exceptions | PASS |Six viewport configurations in `calendar-results.json`; fixtures discarded with contexts |
| Add task/class/note, goal chooser, goal/habit editor, new template, template management menu and phone More | PASS |17 desktop/phone opener cases, `openers-results.json`; captured launcher transforms, final bounds and closing/focus/menu cancellation |
| Single deadline, Work summary, grouped deadlines and group→editor handoff | PASS |Desktop1280 and touch390; synchronous open trace records real captured bounds, morph stage and no fade exception; `deadline-results.json` |
| Rendered opening and closing frames | PASS |`open-1280-*.png`, `open-390-*.png`, `close-390-*.png`. Animations paused at recorded timeline points for reproducible inspection; closing remains mounted/inert, returns to the source and restores focus; `closing-results.json` |
| Focused automated checks | PASS |64 tests in `automated-tests.txt`: popup lifecycle/geometry/reversal, calendar previews/group handoff, library and PWA installation. New regression prevents legacy fade options from skipping launcher capture |
| JavaScript syntax and whitespace | PASS |`node --check` on app, popup-motion, calendar-task-preview and planner-library; `git diff --check` |
| Actual updated browser/cache contents | PASS |Existing preview registration updated to v148; active helper, cached popup/app and menu code match correction; old cache removed |
| Signed-in backend, physical Safari, real device keyboard, installed PWA and native WKWebView | NOT RUN |No backend or native changes; browser emulation is not physical-device verification |

Run `check-calendar.js` and `check-openers.js` through Playwright MCP's `browser_run_code_unsafe` with the loopback preview running. Some initial assertions raced the end of an animation or used an incorrect Month/template selector; corrected harnesses use the rendered controls and synchronous animation-entry traces. Final results above are from successful runs. No new implementation change was made to accommodate those timing-only harness failures.
