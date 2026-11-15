# Calendar due dates and planned work

**Safe checkpoint:** stopped at the user's request. See [checkpoint and remaining checks](CHECKPOINT.md). Eight automated affected browser cases passed; 320px Month marker crowding remains an open visual follow-up, and the offline-cache smoke was not run. This is not a completed platform release baseline.

Implemented in the local `DuckPlan-motion-preview` website on `codex/calendar-date-clarity-20261114`, from `567d6c2`. Source: the user's newer [Repository Overview conversation](https://chatgpt.com/g/g-p-6addac00e55c8191a3f6db4456733345-duck-plan/c/6addacc2-3bc4-83e8-8f06-cdbedefe067c), its [returned recommendations](review-source.txt) and [visible generated mockup](reference-mockup.jpg). The image is a captured reference, not an imported replacement UI or new mascot asset.

The user confirmed two interaction choices: Calendar items open a compact preview first, with Edit, Reschedule and Complete actions; remove the colored left stripe on work blocks, while retaining the selected-day shading and class-color fills.

## Implemented behavior

- Each saved task appears in one primary selected-day task section: scheduled work on that day, then due on that day, then remaining overdue work, then the undated/unscheduled backlog. Completed items stay separate. A task due today but planned tomorrow remains visible. Distinct task IDs with identical titles remain separate saved tasks.
- Due and Work metadata appear together on Calendar task cards. Overdue is a status, independent of the task's section. A full session end is compared with the precise deadline, including overnight rollover; date-only deadlines retain23:59 semantics. Late work offers Reschedule work without changing either date automatically.
- Selected-day progress uses unique due-date OR work-date relevance; global overdue/backlog items do not inflate it. Phone remaining/overdue counts include statuses on scheduled/due cards without rendering duplicate checkboxes.
- Deadlines use flag/time markers in a sticky Due strip above the time grid. More than three have an explicit expand/collapse control; the expanded list scrolls within a bounded area. Deadline markers remain milestones, not occupied time slots. The narrow gutter says Due, with the accessible name Deadlines.
- Month view separates work and deadline occurrences, including two representations of one task on the same day. Accessible counts distinguish occurrence kinds and unique task IDs. Larger screens have short labeled items plus explicit overflow into Day view. Phones have distinct counts/markers and a selected-day agenda inside Month. Completed Month items remain available with muted checked status; Day/Week still show unfinished work/deadlines.
- Calendar items open a compact, text-safe preview showing class, priority, duration, both dates, warnings and notes. Edit/Reschedule lead to the existing editor; task-list titles still open that editor directly. Complete/reopen shows pending/errors and updates the same task. Escape/backdrop/Close restore focus, live changes update the preview, and task deletion/account/route changes retire it. Delayed completions cannot affect another owner's or newer dialog's UI.
- Removed the work-block stripe from the matching template and drag-preview surfaces as well, preserving their shared class colors. Improved time/event legibility and hour/half-hour hierarchy; retained24hours, sticky dates, the current-time indicator, the unified desktop/iPad layout, phone Tasks sheet/bottom navigation, existing motion and approved v11 artwork.

## Implementation and verification

Pure task grouping/timing helpers live in `landing/planner-model.js`; separate rendering and preview controllers live in `calendar-date-presentation.js` and `calendar-task-preview.js`. Root integration stays in `app.js`, with scoped styles in the two new CSS files. Initial scrolling measures the actual timeline header/deadline offset rather than assuming114px. Versioned assets and PWA cachev56 include all four new renderer/preview assets.

`verification.json` records the full456-test Node pass,47 JavaScript syntax checks, final focused checks and exact source hashes. Browser action/layout/persistence outcomes are recorded by the affected-feature runtime harness in this directory. These are affected-feature checks for a frontend change, not a new full-platform release baseline.

The actual existing in-app browser was refreshed, its new preview was opened read-only and closed, and Calendar Week was restored. Its saved unfinished task count remained seven; no real user task was edited or completed. Synthetic fixture contexts cover mutation tests instead.

## Scope

This changes the local website and its TEST feature-branch backup. Backend, schema, stored task records and native Xcode source are unchanged. No public deployment, remote migration or installed-phone update occurred. Native WKWebView, physical devices and the installed-PWA surface are not established by Chromium touch emulation or a browser-tab service worker check; record them as NOT RUN for this change.

The review's P0 labels identify priority UI fixes, not proven duplicate saved records or an operational outage. The compact preview replaces Calendar's old direct-editor first click only after the user's explicit choice. A separate Agenda route and new display filters remain follow-ups. The confirmed rule-based Recommend Schedule feature remains a separate implementation plan.
