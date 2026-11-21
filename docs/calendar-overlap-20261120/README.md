# Calendar overlaps — November 20, 2026

Local website change following `6478cf6`, on `codex/calendar-deadline-editor-20261120`. The user confirmed **Due/deadline markers must stay above scheduled work**. Final shell cache v109; app/CSS key `calendar-overlap-20261120-final`.

## Reference comparison

**PASS for the requested overlap treatment.** Inspected the same signed-in Google Calendar tab at `https://calendar.google.com/calendar/u/0/r` before implementation, returned after the revisions, and repeated the final comparison. Used the installed browser-control connection's documented Playwright API through Node REPL because the isolated Playwright MCP browser does not share that Google session. Local comparisons ran through Playwright MCP. Reference viewport 1470×745, actual Chrome on macOS with mouse input; browser version was not exposed by the reference connection. Local Chromium version 157.0.8103.79. No Google events were created, edited, deleted or saved; only existing events' geometry and read-only details were inspected. Private event labels/crops are not committed.

Observed two existing pairs with separated headings: front block left offset was 4.999% of the earlier block's width, front width 94.997%, with z-index 6 above 5. Two same-start pairs instead used overlapping columns: the second block's offset and width were both 58.824% of the first block's width (equivalent to 0/50% left positions and 85/50% widths within the usable day width). A rendered overlap crop confirmed the earlier heading remained exposed. Clicking the front block and the earlier exposed header opened their read-only details. The final return found the same geometry and stacking.

Acceptance defined before implementation: reproduce these staggered/close-heading relationships within 0.3 percentage points, leave exposed headings clickable, keep work titles at the top, keep the requested Due layer above work during hover/focus/dragging, and preserve times, duration, identity and settings. Retain DuckPlan's class colors, point-in-time deadline symbols, responsive layouts and existing pop-out windows.

DuckPlan now uses a 5% inset / 95% front width when headings have enough vertical separation, and overlapping columns for close/simultaneous starts (two columns: 85/50% widths, second offset 50%). Connected groups share their peak column count, including earlier cards. Minimum visual heights are included when finding conflicts, and long chains cap their inset at 40% before resetting after a gap. DuckPlan uses its own title-height threshold (42px for title/time, 28px for a short title), rather than claiming the same typography or every undocumented Google layout case. This is a verified adaptation of the observed cases, not a claim of pixel identity across every event density.

## Changes

- Removed the fixed 56%-wide work reservation beside a deadline. Due labels use the front half of the day when overlapping work; their exact time anchors remain unchanged.
- Put saved work and fitted work/task/template drag previews in one stacking context below Due. Work order stays stable on hover, selection and focus; a focused earlier card cannot permanently block clicking the later one.
- Work headings align at the top and overlapping work has a thin neutral separator. Class fills and the approved absence of a colored left stripe remain intact.
- Fitted drag previews remain beneath Due and the calendar header. Free previews return to the body, Month previews retain their existing treatment, and there is still only one custom drag preview.
- Escape-cancel now suppresses the subsequent mouse-release click so cancelling a pointer drag does not open an unintended task preview.

## Verification

**PASS:** all 603 Node tests (`node-tests.txt`), JavaScript syntax and `git diff --check`. Five added layout tests cover the 5% stagger, consistent peak columns across a connected group, adjacent/minimum-height cards, reused lanes and deterministic ordering, and long-chain bounds/reset. Updated two existing rendering assertions for intentional full-width/overlapping geometry.

**PASS:** `runtime.js`, seven isolated clients: local 1470×745, 1156×746, touch-emulated 835×1000 and 390×844, 320×568/reduced motion; signed-in 1470×745 and touch-emulated 390×844. Each ran Day/Week × light/dark (28 cases), reference proportions, Due hit testing while work is hovered/focused, grouped and single Due previews, both exposed work headings, keyboard move/Undo, reload persistence and unchanged deadlines/alerts/counts. Desktop cases also performed real pointer work moves/Undo. Dedicated synthetic accounts used the actual current loopback Worker/D1 on 8798 with the existing eight-migration QA fixture, never production records. The first attempted replacement test server found the port already in use; the existing fixture served the successful account/API checks and was not stopped.

The static-layout results remain valid after the later drag-preview-host/cancel changes because those paths only run during dragging. Both desktop local and signed-in functional cases were repeated against the final source. A cloud acknowledgement briefly replaced a task DOM node during a test scroll; the harness now reacquires that same locator on a detached-node error and the signed-in repetition passes. `runtime-results.json` records the original matrix plus final passing repetitions. Screenshots: `1470-day.png`, `1156-week.png`, `390-day.png`.

**PASS:** `drag-runtime.js` in local and real signed-in loopback modes: real pointer drag shows one correctly fitted absolute preview within the work layer below Due; rendered `live-drag-under-due.png` confirms the Due label remains visible above it. Escape/release removes the preview without changing records or opening a popup. Synthetic HTML5 DataTransfer checks exercise actual task/template DOM handlers through fit → free → fit → drop, one scheduled task move versus one independent template copy, source template retention, correct work time and preserved deadline. These synthetic transports do not prove absence of the OS drag bitmap; no such claim is made. See `drag-results.json`.

**PASS:** final ordinary browser-tab service-worker/offline checks at 1470 and 390px: v109 loads the new code/styles offline, retains 5%/95% overlap and front Due layer, opens the correct offline task preview and preserves two saved fixture tasks. `offline-results.json`. This is not installed-PWA evidence.

The corrective loop found and fixed vertically centered work headings and focus-driven work promotion, which could hide a later block. Harness fixes selected the exposed heading rather than an intentionally covered center, recognized grouped Due controls correctly, avoided the existing edge-autoscroll trigger for an exact-time drop, supplied valid alert fixture metadata and retried a replaced cloud DOM node. These do not relax the reference ratios, Due priority or persistence checks.

## Release boundary

Local preview: `http://127.0.0.1:8034/#calendar`. No GitHub push, public deployment, production mutation, native source sync, build or installation. Native repository remains clean at `2f4311a`, pending **Publish to public**. Physical phone/iPad, native WKWebView, Safari/WebKit, Firefox, installed-PWA launch and physical alarm/notification delivery are NOT RUN. Existing user records and the signed-in Google Calendar data remain untouched.
