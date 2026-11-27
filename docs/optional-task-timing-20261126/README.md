# Independent work time and deadline controls

November 26, 2026. Base website checkpoint `2d9b5cf`; this UI uses cache 160. Prepared locally in DuckPlan-original-duck-preview. No public deployment, database migration or native sync is part of this change.

## Confirmed behavior

The user confirmed that work time and deadline belong to the same assignment, and that missing editor sections should be revealed through Add controls. “Access” was understood as Axis.

- Deadline-only details, including Axis assignments, offer **Add work time**. This opens the existing task editor with the work section expanded and its start-date field focused.
- Work-only details offer **Add due date**. This opens the same editor with the deadline section expanded and focused. Existing work stays intact.
- Details retain Edit, completion and existing-work Reschedule. Missing dates no longer display an implied duration/work session. Add controls use ordinary non-navigation hover/press feedback.
- In the editor, existing timing sections open; absent sections are collapsed **Add work time** / **Add due date** controls. Opening a section does not invent or save a date.
- Clear work time and Remove due date animate the relevant section closed and clear only those fields. Saving preserves the other component. Cancel persists neither draft change.
- New task entry points start without dates. Clicking a timetable slot explicitly prefills work start/end, with no implied deadline. Existing template scheduling retains its explicit independent range behavior.
- Start/end controls, color materials, same-ID persistence, notes, class/source and unrelated alert preferences retain their existing models and API contracts. There is no new task type, duplicate task record or backend polling.

## Sizing and motion correction

A reusable popup could previously retain a prepared frame measured from a much larger editor. After optional sections closed or a new blank editor opened, that left a large empty area. Task editors now opt into flexible sizing: the current small form is measured at entrance, the existing launcher morph is retained, then temporary bounds are released. Disclosures resize the natural form, and closing uses its current bounds. Other dialogs keep their previous behavior. At 1280×900, the empty editor measures 442px, expanding the deadline measures 590px, and reopening empty returns to 442px.

Both directions reuse the reversible expansion helper. Focus/aria/inert states, early user focus choices, cancellation, reduced motion and responsive resize remain supported. Normal-motion screenshots and recorded heights show intermediate expansion; the reduced-motion run resolves immediately. This adds one form geometry measurement at entrance, without reading the task list or querying D1.

## Verification

- **PASS:** 695 automated tests from the clean isolated stage, excluding the unrelated http.js / untracked 0009 OAuth drafts. New regression assertions cover same-ID preview handoff after closing, independent Add actions, updated missing-component controls, deadline focus/early-focus preservation, independent summary state and refreshing/releasing a stale prepared editor frame. Existing persistence/range/live/read-budget tests remain passing.
- **PASS:** Eight Chromium 158.0.8127.38 browser scenarios: local mode at 320×568,390×844,844×390,835×1112 and1280×900; real signed-in local Worker/D1 at 390×844,835×1112 and1280×900. Touch is emulated on small/phone/landscape/iPad sizes; desktop uses mouse/keyboard. All cover empty default sections, Add work, Add due, exact preserved metadata, same-ID/task-count assertions, independent removal, cancellation, rapid reversal and reload persistence. Signed-in fixtures connect an isolated synthetic Axis feed and exercise failed-save 503/retry. No production user data is involved.
- **PASS:** Calendar-specific flows on 390×844,320×568 dark/reduced-motion and1280×900: date-only Due summary → assignment details → Add work; unique work block plus retained date-only deadline; timetable-slot creation without a deadline; work block → Add due → save with original work retained. Keyboard Enter opens/closes disclosures; frames and geometry record both directions and stable final bounds.
- **PASS:** New untimed task saved and persisted after reload with neither date nor work start. Dashboard's visible Add task opens the same empty optional editor. The retained legacy dashboard button is hidden and was not presented as a user-accessible workflow.
- **PASS:** Rendered phone portrait/landscape, iPad and desktop screenshots inspected for alignment, wrapping, reachable controls, sticky header/footer, bottom navigation and excessive blank space. Long titles remain ordinary single-line editor inputs; details wrap their text.
- **NOT RUN:** Physical Safari, installed PWA, physical on-screen keyboard and native WKWebView/device. Browser emulation does not establish those passes. Native files remain at their frozen release checkpoint.

Initial calendar harness attempts assumed a standalone date-only chip/band in Day view; the approved Day view exposes these through the Due summary list. Corrected the harness to use that actual interaction and all three cases passed. The first visual pass found the stale frame defect above; corrected it and repeated all eight browser scenarios. Later checks of the last Dashboard entry-point change use its visible primary Add action, because the retained legacy button is hidden.

Evidence: browser-results.json, motion-calendar-results.json, untimed-results.json, slot-results.json, dashboard-results.json, source-manifest.json, tests.log, reproducible scripts and screenshots in this directory. Source/backend/runtime/mode labels identify fixture-backed results; they do not claim production or native parity.
