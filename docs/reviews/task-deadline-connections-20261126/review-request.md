# Chat Check: showing the link between work and a deadline

Review/design recommendations only. Do not implement changes, publish a website, change a database, update native bundles or delete tasks.

Inspect the exact current commit provided with this request in https://github.com/bobbyzhang133-star/Duck-Plan-Test. The application source baseline is `62323ce90e30811eec1b863bbbd4308c3a8e304d`; the review checkpoint adds only this request/evidence documentation. Compare the code and screenshots with AGENTS.md, plans.md and the acceptance criteria below. Confirm the exact commit and which files/evidence you could access; distinguish source observations, visual evidence and behavior you actually ran. Do not substitute the older public site for this local source.

## User's question and confirmed model

How should DuckPlan show the connection between a task's scheduled work and its deadline, when both exist?

One assignment has one saved ID and can have a work start/end, a deadline, both or neither. A deadline-only Axis assignment offers Add work time; a work-only assignment offers Add due date. These update the same assignment, without creating a duplicate. The editor reveals only existing or explicitly added timing sections. Scheduling work must not invent a deadline, and adding a deadline must not move work. Work duration and exact timed deadline markers are different visual concepts.

Current implementation/evidence:
- landing/app.js: calendar rendering, task cards, editor, work drag and scheduling, source preservation.
- landing/calendar-date-presentation.js: work/due counts, date-only summaries, exact-minute deadlines and grouped deadlines.
- landing/calendar-task-preview.js/.css: details first, Edit/Reschedule, independent Add work/Add due actions, work/deadline/task-card materials.
- landing/planner-model.js and planner-store.js: same-ID date/work model, persistence and synchronization.
- landing/task-editor.js/.css, work-time-range.js and popup-motion.js: optional controls, start/end ranges, focus and reversible transitions.
- docs/optional-task-timing-20261126/README.md, browser-results.json, motion-calendar-results.json and screenshots: completed local/signed-in fixture checks for independent dates and ranges.
- docs/d1-read-budget-20261126/README.md: read amplification investigation and local correction; avoid new polling/full-planner scans or unbounded work with around10,000 tasks.

Fresh prior verification:695 automated tests passed; local-mode phone320×568,390×844,844×390, iPad835×1112 and desktop1280×900, plus signed-in local Worker/D1 phone/iPad/desktop flows passed. These are supplied evidence, not tests the external reviewer has independently run. Physical Safari, installed PWA, native WKWebView and the public site with these changes are NOT RUN. Native remains frozen between releases.

## Review focus

1. What currently lets a user identify the same assignment in its work block, deadline marker and details? Identify concrete mismatches and source-level causes, with severity and file/function references.
2. Recommend an understandable, restrained connection design. Consider matching identity markers, a compact Due/Work label, highlighting linked representations on selection/keyboard focus, a Jump to work / Jump to deadline action, and only-on-demand connector lines. Compare tradeoffs; do not presume permanent lines are the answer.
3. Define behavior when the other representation is outside the visible day/week, across multiple days, date-only, grouped with nearby deadlines, overlapping work, completed, unscheduled, missing a deadline or deleted. Keep exact timed deadlines at their real times and date-only deadlines date-only.
4. Keep phone full-width calendar/expandable task sheet/bottom navigation and its seven-day selector/single-day Week schedule. Preserve the desktop/iPad task-column plus calendar layout. Touch cannot depend on hover. Dark mode, color-vision differences, keyboard/screen-reader use and reduced motion need usable alternatives.
5. Specify how Add work/Add due, Edit, Reschedule, drag, Undo, completion/reopen and live updates affect the visual relationship while preserving the same ID and unrelated fields. Guard stale selection, account/view changes and offscreen/missing targets.
6. Avoid clutter or a persistent SVG/DOM node per task. Recommend bounded rendering for visible/selected items, no continuous animation/repeated whole-list scans/network polling, and layout/update triggers that remain practical with10,000 tasks. Do not regress the prepared D1/large-list fixes.

## Acceptance criteria for the proposed next change

- Users can identify whether an assignment has work, a deadline, both or neither, and recognize the linked pair without relying on color alone.
- Selecting either representation can reveal the other's meaningful date/time and navigation action, including an offscreen destination. Do not imply a missing date exists or fabricate a time for date-only deadlines.
- Work blocks and deadline markers retain distinct meanings/materials. Relationship cues do not create duplicated records or alter dates just by viewing.
- Dense week/day views remain readable; inactive tasks do not create a web of lines. Touch, keyboard, focus, close/cancel and reduced-motion paths are specified.
- All affected open/close/selection transitions work both ways and retain focus/data integrity. Proposed tests cover the required phone portrait/landscape sizes, iPad/desktop, local and signed-in modes, saved-state reload, remote changes and10,000-task performance.

Return: a brief verdict; prioritized concrete findings; one recommended initial design with rejected alternatives/tradeoffs; an implementation plan with source touchpoints; and a test/acceptance matrix. Mark inaccessible source/runtime checks BLOCKED or NOT RUN. This Chat Check authorizes a TEST repository upload and review request only, not implementation or deployment.
