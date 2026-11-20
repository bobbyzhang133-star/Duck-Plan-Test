# Interactive Calendar Work/Due summaries — local checkpoint

November 20, 2026. Website branch `codex/calendar-summary-popups-20261120`, based on `49cd554`; native branch `codex/native-summary-popups-20261120`, based on `5ef3ff0`. Final shell cache v99; affected asset keys `day-summary-windows-20261120-final`.

## Result and acceptance checks

- Work summaries are blue; Due summaries retain red. A sole category fills the available summary row. Wide headings show words; narrow paired headings use icons/counts with full accessible names.
- Timetable day headings are nonclickable. The phone's separate seven-day date buttons remain tappable. Work/Due actions in that strip open lists without selecting another day; there are no nested buttons.
- Work/Due buttons open compact anchored lists of unfinished tasks, sorted by their respective times. Work and deadlines remain independent; date-only deadlines say End of day. Opening a list writes nothing. Selecting a row opens the existing task preview, including its normal completion/edit actions.
- Close/Escape restores focus; live changes update membership and empty states; account/view changes invalidate stale handoffs. Resize dismisses the list. High counts and long lists stay inside the viewport.
- Header dividers reach the bottom and align with timetable column boundaries. The Due band's own 1px bottom border joins the scrollport. Existing timed deadlines, drag scheduling, spring scroll, class colors and layouts remain intact.
- Timetable headers are 76px; short coarse landscape headers 44px. Phone date navigation plus independent summary actions uses a 90px strip.

## Reference comparison

Used the exact signed-in `https://calendar.google.com/calendar/u/0/r` Week page at 1470×801. Inspected its pending-task summary interaction before implementation and returned after revisions, including the final label-fitting revision. No reference tasks/events were changed. No private event content is stored here.

Google's compact summary opens a 400px window with 28px corners, three soft shadow layers, no dark backdrop, and an approximately 8px source gap; closing restores launcher focus. DuckPlan uses those surface, anchoring and dismissal characteristics. It preserves the user's blue Work/red Due coding, independent lists and continuous dividers. Google date buttons themselves are clickable; DuckPlan's static timetable headings intentionally follow the user's explicit exception.

Playwright MCP's isolated reference tab required sign-in. The existing authenticated Chrome tab was inspected through computer-use Playwright where available and native accessibility/rendered-frame fallback when the Chrome DOM helper timed out. Final reopening and closing succeeded through the native fallback. DuckPlan comparisons and runtime matrices used Playwright MCP. This is a scoped summary-window comparison, not a claim that every Calendar interaction matches Google.

## Verification

PASS: 588 website and 593 native Node tests (`website-tests.txt`, `native-tests.txt`). Final metadata-only cache99 change additionally passes 25 focused summary/preview/PWA tests; syntax and diff checks pass. Full suites preceded the final label-fitting CSS/container query and cache metadata; the browser matrix and native saved-state runs cover the final CSS, with final cache99 offline/native installation checks afterward.

PASS: `runtime.js` and `browser-results.json` cover six viewports 1470×801,1280×900,835×1000,390×844,320×568 and844×390; both themes, static headings, phone navigation, single-category width, correct list membership/order, read-only open/close, focus, row handoff, completion, live empty state and reload. Chromium 157.0.8103.79; local storage and touch emulation where appropriate. 30 result records.

PASS: `stress-results.json` covers 110 Work / 110 Due counts and phone summary actions. `extra-results.json` covers signed-in real loopback Worker/D1, live list growth, resize dismissal and cache98 offline use. `final-offline.json` repeats fresh-cache offline reload/list opening on final cache99. `divider-results.json` records zero header/body column offsets and continuous border/scrollport junctions with/without a Due band. An initial geometry probe measured scrolled content/child edges instead of the scrollport/parent border; corrected measurement passed without a product change.

PASS: actual iOS 27.2 simulator WKWebViews on iPhone 18 Pro and iPad, separate disposable QA bundle identifiers. `native-runtime.js`, `run-native.py`, device JSONL/screenshots exercise local and real signed-in loopback Worker/D1 setup and relaunch, completion persistence, independent work/deadline dates, phone selection, summary actions, themes and focus. Eight initial functional cases passed; four final-CSS cloud/local saved-state cases passed. Final cache99 local saved-state reinstall checks and all 119 bundled/installed source hashes are recorded in `native-verification.json`. Initial simulator installation timed out; retry succeeded. Production accounts/apps were untouched.

The QA injection exists only in disposable simulator bundle copies, never source/release bundles. Native signing, Swift providers, production API defaults, artwork and sounds are protected and compared against the branch parent. Native app source receives a bounded patch rather than a wholesale bundle replacement.

NOT RUN: physical iPhone/iPad, installed PWA standalone mode, Safari/Firefox, production signed-in backend and physical alert delivery. This feature does not change backend/native APIs or notification scheduling. No public deployment, GitHub push or physical app update was performed. Prior Axis backend activation remains a separate pending deployment.

## Reproduction

Run `node --test tests/calendar-day-summary.test.cjs tests/calendar-task-preview.test.cjs tests/pwa-app.test.cjs`. The Playwright MCP runner accepts `runtime.js` as its filename with the local site on 8034. Native runner requires the documented disposable simulator IDs, current simulator build, the isolated real QA Worker/D1 on 8798 and collectors on 8896/8897. `--layout-only` expects a saved signed-in QA session first; `--local-only` checks existing local fixtures only. Do not point QA setup at production.
