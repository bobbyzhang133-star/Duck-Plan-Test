# Task/deadline connections Chat Check — November 26, 2026

Status: completed external source/design review. No application changes or deployment were authorized or performed during this Chat Check.

## Version and destination

- Source baseline: `62323ce90e30811eec1b863bbbd4308c3a8e304d` (independent work/deadline controls, cache 160).
- Immutable reviewed TEST checkpoint: [`4e7c9d91e40c8ba76d3858792b6af20d11728dce`](https://github.com/bobbyzhang133-star/Duck-Plan-Test/commit/4e7c9d91e40c8ba76d3858792b6af20d11728dce).
- TEST branch: `codex/task-deadline-connections-chat-check-20261126`. Remote-ref verification and GitHub connector retrieval confirmed the upload before submission. Subsequent branch commits add review records only; the source reviewed remains the checkpoint above.
- [Committed full review brief](https://github.com/bobbyzhang133-star/Duck-Plan-Test/blob/4e7c9d91e40c8ba76d3858792b6af20d11728dce/docs/reviews/task-deadline-connections-20261126/review-request.md).
- Completed response: Duck Plan project, [Review Task Deadline Connections](https://chatgpt.com/g/g-p-6addac00e55c8191a3f6db4456733345-duck-plan/c/6b08e6d5-9fec-83e8-a02f-fadd3df2c8af).

The initial request was posted to the established Repository Overview conversation after the user resumed access. ChatGPT rejected generation because that conversation had reached its maximum length. The request was then sent successfully in a fresh chat within the same Duck Plan project. The response was visibly complete and all sections, including the acceptance matrix and limitations, were read through the browser UI. No duplicate review was requested in another project.

## Review outcome

The recommendation is to present **one assignment with two optional time representations**, using shared identity, contextual highlighting and navigation. Keep the different work-block and deadline materials; avoid a permanent web of connector lines.

Initial design proposed:

1. Add a compact counterpart hint, such as a flag with Due Sat, only where a work block has sufficient room. Preserve the title and do not enlarge short blocks or invent a unique color/symbol for every assignment.
2. Extend the existing same-ID selection infrastructure consistently across visible work, deadline, month/agenda and grouped representations. Keep the actual keyboard focus ring distinct from the secondary linked outline. Do not dim unrelated tasks.
3. Add contextual Jump to deadline / Jump to work actions inside the existing details timing rows. From a task list, Show work / Show deadline can be available together. Missing counterparts retain the approved Add work time / Add due date actions.
4. Use a dedicated relationship-navigation path that preserves task identity across a date change, rather than globally changing the ordinary selectDate behavior that clears selection. Resolve the current owner/task/revision before and after asynchronous close/render; reveal grouped or collapsed destinations, focus the appropriate control and announce arrival. Viewing or jumping never writes task data.
5. Defer connectors. If later testing demonstrates a need, consider one selected-task overlay only when both endpoints are visible. Avoid persistent nodes per assignment or continuous geometry updates.

## Prioritized source findings

These are reviewer-assigned design priorities and source-level risks, not independently reproduced visual/runtime failures.

- **High:** counterpart discovery is weak directly on work blocks: `app.js` work markup presents the title/work start but not an explicit deadline hint. The details already contain both timings.
- **High:** `selectDate()` clears selection and closes preview, so counterpart Jump needs its own guarded navigation path.
- **High:** grouped timed-deadline triggers show aggregate counts/ranges. Add a containing-group selection cue and identify the actual task in its list; do not imply that every group member belongs to the selected assignment.
- **High, performance hypothesis:** repeated date filtering/sorting in `sortedDeadlines`, `sortedWork`, `deadlineRow` and month rendering could amplify new relationship work. Profile before attributing measured lag to these paths. Build task-ID/date indexes at accepted snapshot/change boundaries, rather than scanning all tasks on every focus/selection.
- **Medium:** selection coverage differs across individual chips/markers/work/month entries versus agenda/group triggers. Existing selectedTaskId and data-select-task already provide a useful shared foundation; do not replace it with a second persistent relationship model.
- **Medium:** class colors identify a class, not a unique task. Use IDs for matching and explicit labels/outline/icon cues for users.
- **Medium:** accessible names primarily describe the current representation; include meaningful counterpart timing and navigation feedback without implying missing dates exist.

## Recommended edge handling and acceptance

Preserve exact timed deadline anchors; date-only deadlines navigate to a Due summary/strip and never become midnight events. Cross-day/week Jump retains the assignment's identity; grouped deadlines reveal and focus the matching entry. Overnight work, overlapping lanes and Work after deadline warnings retain their existing meanings/geometry. Duplicate titles never cross-highlight. Completion/reopen, drag/Reschedule, Undo and saved remote changes recompute from the same task; cancel never persists draft values. Deletion, account/view changes and stale navigation generations clear transient state safely.

The proposed acceptance matrix covers all four timing combinations; same-ID/no-duplicate integrity; both Jump directions across day/week/month boundaries; date-only/exact-minute/midnight/23:59/grouped deadlines; dense/short/overlapping/long-title layouts; Add/Edit/Cancel/drag/Undo/completion; live revision/account changes; keyboard/screen reader/theme/color-independent cues; both motion directions, reversal/cancel and reduced motion; local/signed-in persistence/failure/reload; and 10,000-task bounded rendering with no relationship-driven network requests. Viewports include 320×568,390×844,844×390 landscape,835×1112 iPad and1280×900 desktop. These next-change checks are **NOT RUN**, because no implementation was requested.

## Evidence and limits

The reviewer verified the exact GitHub commit and its one-document difference from 62323ce, read the full brief and AGENTS.md, inspected relevant app/date-presentation/preview source and portions of plans.md, and read the optional-timing and D1 evidence reports. Model/store/editor/CSS inspection was partial. Screenshots were **BLOCKED: not retrieved or visually inspected**. Browser-result JSON files were not independently inspected. Branch-head identity was verified by this agent before submission, not independently by the reviewer.

The supplied 695-test and fixture browser passes belong to the prior completed local implementation. The reviewer did not rerun them, access localhost, test physical Safari/PWA/native WKWebView, or verify this version on production. The review is a source/design recommendation, not a new visual, performance, accessibility or cross-platform pass.

No UI/source implementation, shared-main update, public deployment, remote migration, task deletion or native bundle sync occurred in this Chat Check. Unrelated OAuth drafts remain uncommitted and excluded. Proposed implementation remains pending a user request.
