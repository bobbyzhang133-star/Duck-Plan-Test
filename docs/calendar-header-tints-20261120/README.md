# Calendar header/list cleanup — local checkpoint

November 20, 2026. Website branch `codex/calendar-deadline-editor-20261120`, parent `90e675a`. Web cache 101 and affected asset key `due-header-tints-20261120`. This checkpoint implements browser comments 1–2; comment 3's Google Calendar task-editor redesign is pending reference access.

Follow-up: reference access was recovered through the existing signed-in Chrome connection. The shared task-editor redesign and final comparison are completed in [the compact editor checkpoint](../task-editor-google-20261120/README.md), cache v103. The BLOCKED section below records the earlier checkpoint's state.

## Implemented

- Removed the duplicate date-only Due row from the timetable render, including its row-expansion state and click handler. Header/body now meet directly in one header grid row. Date-only deadlines are still counted and listed by the date header's Due button, retain End of day, and never receive an invented clock position. Timed deadlines stay at their exact schedule times. Task-list due details and Month entries remain available.
- Work summary list rows have blue surfaces and neutral text. Due summary and grouped timed-deadline list rows have red surfaces and neutral text. Hover/pressed/dark surfaces preserve the same coding. Header Work/Due controls retain their approved coding; class colors on work blocks/templates are unchanged.
- The old pure date-row presentation helper remains exported for compatibility; the app no longer renders or controls that row. Tests assert actual timetable markup has no duplicate band while retaining Due-list access and exact-time markers.

## Google Calendar task editor — BLOCKED

Requested reference: `https://calendar.google.com/calendar/u/0/r`, Add Task/create-task interaction, including the shared editor reached from the Tasks page. Playwright MCP opened that exact URL on November 20; it redirected to Google Accounts and displayed “Google Calendar - Sign in to Access & Edit Your Schedule.” The available browser does not have the user's signed-in Calendar session. Native Chrome computer-control tools are unavailable in this turn.

Per `.cursor/rules/reference-site-comparison.mdc`, dependent implementation/comparison remains pending rather than guessing from memory or treating another page as a verified match. A request for access to the signed-in Calendar tab was sent while the independent calendar changes proceeded. Next: inspect the actual create-task editor, define observable layout/interaction checks, redesign DuckPlan's shared Add/Edit form without losing work/deadline/alarm/details functions, then return to the same reference and compare after every revision. Add Task form markup and editor functions are unchanged in this checkpoint; see `editor-unchanged.json`.

## Verification

PASS: 35 focused calendar selection/timed-deadline/preview/viewport/PWA tests, all 594 website tests, JavaScript syntax and diff checks. Existing integration assertions were updated to reflect the explicitly removed strip and to retain header Due-list accessibility and template-drop/date separation coverage. See test logs.

PASS: Playwright MCP, Chromium 157.0.8103.79, isolated real local store, 1156×746 (matching the browser comment), 835×1000, 390×844 and 320×568; Day/Week, light/dark, touch emulation on tablet/phone and reduced motion at 320px. All 32 popup cases passed: no duplicate row, header/body gap 0, column alignment within 0.11px, correct Work/Due membership, date-only access, neutral text and expected background colors, viewport clamping, read-only viewing and reload. Six screenshots show desktop/phone results. See `runtime.js` and `browser-results.json`.

PASS: grouped exact-time deadline lists use matching red rows and neutral text in both themes (`grouped-results.json`). Final fresh cache 101 offline reload also retains date-only Due access, red rows and no duplicate band (`offline-results.json`). No uncaught page errors or page overflow were observed.

NOT RUN: signed-in data mutations, installed PWA standalone mode, Safari/Firefox and physical/native runtime checks. This is a presentation/rendering change with no storage/API/native-bridge modifications. Prior signed-in/storage behavior is not relabeled as newly tested here.

## Native release gate

The existing native checkpoint remains `2f4311a`, bundled cache 100. No native app source, project, build or installation was changed. These newer web changes are pending native synchronization until the user says **“Publish to public”**, per `mobile-app-release-gate.mdc`. No public deployment or GitHub push occurred.

## Reproduction

Run `node --test tests/timed-deadline-integration.test.cjs tests/calendar-selection.test.cjs tests/calendar-task-preview.test.cjs tests/calendar-viewport.test.cjs tests/pwa-app.test.cjs`. Playwright MCP accepts this directory's `runtime.js` filename against the loopback preview on 8034. Its fixtures exist only in fresh isolated contexts and do not overwrite the user's sample tasks.
