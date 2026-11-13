# Calendar-style templates and immediate scheduling — November 13, 2026

The user requested template tasks that look like scheduled calendar blocks and can be dragged straight onto the schedule. They explicitly confirmed that dropping should **schedule immediately with saved settings**, superseding the earlier editor-first drop behavior.

Both template shelves now show a compact class-colored block with the same tinted fill, left accent and corner shape as a calendar event. The block shows the real duration and class; only this block is draggable, so its native drag image excludes management controls. Preview height follows the 62px/hour calendar scale with a readable 44px minimum and a 156px cap for long templates; the true duration is always displayed and never shortened. Details retains priority/notes, and Schedule, Add to tasks, Edit and Delete remain available outside the block.

Dropping onto a valid calendar day/time creates one fresh scheduled assignment immediately. The title, class, duration, priority, notes and deadline-reminder preference remain unchanged. Deadlines stay blank; no alarm is inferred. The original template stays in the shelf for reuse. A live calendar placement preview shows the snapped time and full scheduled duration, with automatic scrolling at the calendar edges. Escape, drag end, blur, dropping and account changes clear the preview.

Schedule still opens the normal prefilled editor for touch/keyboard users to choose a work time. Add to tasks and drops onto task lists create an unscheduled copy. Per-template pending and owner-generation guards prevent duplicate pending drops and stale account gestures while permitting later deliberate copies.

Undated gutter/corner drops cannot create an accidental task. Calendar drops stay on the 15-minute grid, including a 35-minute task at the bottom boundary (21:15). A template longer than the visible 07:00–22:00 day is left intact and directs the user to Schedule rather than shortening its duration. The existing scheduled-task drag helper is unchanged.

## Verification

All **297 Node tests pass**, including fresh-copy/metadata preservation, direct-drop versus editor behavior, duplicate/pending/owner guards, dated target selection, invalid gutters, strict dates/geometry and duration boundaries. JavaScript syntax and diff checks pass.

Isolated Chromium checks used actual native HTML5 mouse dragging with stepped pointer movement. A 35-minute Calculus template dropped onto Monday at 10:30 created one task immediately with no editor; a second Tuesday at 09:00 use had a different ID, and both survived reload. All saved fields matched the original template. Month drops use the target date and 09:00 default. Escape canceled without a task or orphan preview, edge dragging scrolled the schedule, and invalid/1440-minute boundary checks created no task or altered template duration. The phone Schedule editor preserved its 35-minute custom duration, notes, reminder and blank deadline.

Visual checks at 320/390/820/1280px cover light/dark modes, class-color parity with real calendar blocks, archived class lookup, readable duration scaling, long text and no horizontal overflow or overlapping controls. Invalid CSS colors fall back safely, and title/class/notes text is escaped. Shelf open/closed state remains stable. PWA cache v29 contains the current library, styles, placement helper and app code.

Screenshots: [Calendar shelf](templates-calendar.png), [desktop shelves](templates-desktop.png), [phone shelf](templates-phone.png), [dark shelf](templates-dark.png), [live drop preview](drop-preview.png).

This changes the local website and its TEST review branch. No public deployment, migration, native iPhone bundle update or phone installation was performed. Physical Safari/iPhone/iPad dragging was not tested; touch users retain the Schedule action.
