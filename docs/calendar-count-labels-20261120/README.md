# Work/Due date-header counts — November 20, 2026

The user selected **Work/Due counts beneath each calendar date**, using Google Calendar as the visual reference. The left task-panel counts and task-completion effect are separate work. Website baseline `05eb7d0`; native baseline `a6c0712`. Cache **97**, three asset keys `day-count-labels-20261120`.

## Result and acceptance

Counts use quiet filled labels, normal-weight tabular numbers and explicit Work/Due words when the columns have room. Due is softly red to agree with deadlines; work remains neutral. Narrow columns and phone selectors retain clock/flag plus numbers. Two-digit pairs stack within the existing phone date slot, with a gap under the date; large values visually cap at99+ while accessible labels retain exact totals.

These are decorative summaries within the existing date button, not extra controls. Zero categories remain hidden. The66px desktop/iPad heading,48px phone Day heading and56px seven-day selector retain their height. Day selection, date-only Due folding, exact-time deadlines, grid lines, current-time marker and elastic timetable controller are untouched. Shared count calculation and task data are unchanged. The phone refresh stamp now also applies when a summary has its dense-layout class, retaining the existing date buttons/focus across updates.

## Reference comparison

Exact page: <https://calendar.google.com/calendar/u/0/r/week>. Inspected the signed-in Chrome page's **4 pending tasks** label before implementation and returned after each visual revision, including the final phone spacing revision. The reference has a low-contrast blue-gray fill,6px corners,12px/500 text and22px height. A cropped rendered capture confirmed the count's appearance. No reference tasks/events were modified or copied into repository evidence.

**Tool limitation:** Playwright MCP's separate context redirected to Google sign-in. The exact private page was available in the user's existing Chrome tab, inspected through CUA's Playwright locators, computed styles and tightly cropped screenshot. DuckPlan was verified through Playwright MCP. This is an actual Chrome fallback comparison, not a claim that MCP gained that authenticated session or that a public embed replaced the reference.

The accepted adaptation uses18px/11px desktop labels with5px corners to fit DuckPlan's fixed date headers, with smaller numeric summaries on phones. Google does not expose DuckPlan's independent Work/Due date-header pair; this copies its quiet summary treatment, not its pending-task popup or a pixel-identical calendar. Reference window dimensions were not recorded/no override was applied; DuckPlan's explicit tested dimensions are below. No Google event screenshots or personal task titles are retained.

## Verification

- **PASS:**15 browser cases in Chromium157.0.8103.79, isolated local storage:1280×900,835×1000,390×844,375×812,320×568. Light/dark Week, single/double-digit and110-item counts, no count/date-column or page overflow, unchanged header height, stationary header while timetable scrolls, correct independent Work/Due calculation, overnight start-only count, completion, scheduling, deadline edit, deletion and reload. Phone date focus remains on the existing button. Day renders also pass. See `runtime.js`, `browser-results.json` and screenshots.
- **PASS:** keyboard Enter/date selection remains functional and no summary contains a nested button. Browser startup has no page errors in the matrix.
- **PASS:** actual signed-in local Worker/D1: one created scheduled-and-due task shows1/1; completion shows0/0 and remains completed after reload. The real API/transport is used, not a mocked response. See `signed-in-browser.json`. This is the isolated loopback QA server/schema0001–0008, not the deployed public account service.
- **PASS:** ordinary browser service-worker cache97, offline reload, current labels and saved task/count state. See `offline-browser.json`. This is not an installed-PWA launch.
- **PASS:**584 website and589 native-checkout Node tests; syntax and final diff checks. The existing pinned cache expectation was updated from96 to97. No new implementation-mirroring tests were added for this presentation change.
- **PASS:** actual iPhone/iPad iOS27.2 WKWebViews: eight functional runs cover local/signed-in creation, completion, rescheduling, due-date editing and relaunch. After the final CSS-only spacing revision, four additional local/signed-in relaunch/layout runs pass on the same saved fixtures, including strict date/count separation, light/dark and stationary headers. The functional JavaScript remains unchanged between those rounds. `native-verification.json` proves both installed QA bundles match all119 final built web files and compiled native code. The QA apps use a separate bundle ID and only a QA script/index tag; cloud mode uses the real existing native URLSession bridge to the isolated local Worker/D1. Production API default, native providers, signing, icons and sounds are preserved. The native patch is bounded to five web inputs plus the existing cache test and version documentation. See the two native JSONL logs, `native-built-manifest.json` and `native-protected-result.json`.
- **NOT RUN:** physical iPhone/iPad installation, physical Safari, Firefox and installed PWA lifecycle. Physical notification/alarm delivery and full unrelated-feature regression are outside this presentation patch. No public deployment, remote migration or main-branch publication is included.

## Harness corrections

The first835px render exposed label crowding; words now hide in narrow Week columns while numeric summaries remain. The first reload assertion compared a forced Week fixture against the phone's normal Day startup; the harness now selects Week before comparing saved data. The first native cloud header check retained a DOM node across a cloud rerender; it now rereads the actual header after settlement, matching the browser check. Diagnostics are retained rather than labeled product passes. Native rendered frames also prompted explicit phone date/label line heights and spacing.

The initial sandbox build could not access simulator services/Swift macro plugins; the unchanged native project built successfully outside the sandbox with simulator arm64 and signing disabled. The existing loopback QA Worker was verified before reuse after a duplicate start found its port occupied. All test account/command credentials remain in private temporary files and are removed by the runner; no production accounts or feeds are used.

The protected-file inventory excludes intentional `ios/APP-VERSION.md` documentation and generated Xcode user-interface state. A workspace UI-state hash changed during testing and is retained as found, not restored over the user's state. Native source, project/signing settings, approved artwork and sounds match their pre-patch hashes.

Local preview: <http://127.0.0.1:8034/?v=day-count-labels-20261120#calendar>. The public website and physical phone retain their separately installed versions until explicitly published/installed.
