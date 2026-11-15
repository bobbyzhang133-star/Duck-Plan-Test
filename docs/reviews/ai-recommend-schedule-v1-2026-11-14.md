# AI recommended schedule first version plan

Status: proposed implementation plan for Chat Check. Product source remains at `7c76aa616b831bda00401ce3e46160d8b2c260d7`. This planning branch changes documentation only. The existing [Repository Overview conversation](https://chatgpt.com/g/g-p-6addac00e55c8191a3f6db4456733345-duck-plan/c/6addacc2-3bc4-83e8-8f06-cdbedefe067c) is the review destination.

## User experience

Add **Recommend schedule** to Calendar, beside the existing task actions without crowding the phone toolbar. A phone sheet and desktop/iPad side panel use the same steps:

1. **Choose work.** Select unfinished, unscheduled tasks. Show each saved duration and deadline; allow editing an estimate before planning. Existing scheduled work remains fixed.
2. **Choose available time.** Select Today or a date range, available hours for each day, break spacing and a daily work limit. Propose seven days as the initial range; this is a design recommendation, not a confirmed user requirement. Do not infer availability from free-text class periods. The 24-hour timetable remains available.
3. **Generate a proposal.** Fit selected tasks around all existing scheduled items. Show proposed blocks in their existing class colors, clearly marked Suggested, with a short factual placement reason. Suggestions remain separate from saved tasks and scheduled alert requests.
4. **Review.** Accept or exclude individual suggestions, adjust planning preferences and regenerate. Explain tasks that do not fit rather than dropping them or silently shortening their duration. Cancel changes nothing.
5. **Apply selected.** Save the accepted work times to the same task IDs. Preserve deadlines, durations, class/color, notes, completion state and manual alert choices. Offer a guarded Undo for this applied batch.

Preserve the approved Calendar homepage, desktop/iPad task column, collapsed phone Tasks sheet, bottom navigation, existing spring transitions and v11 duck artwork. V1 does not create a separate AI task list.

## Scheduling rules

- Treat existing calendar blocks as occupied; V1 does not move them automatically.
- Place complete tasks in one contiguous block, within explicitly chosen availability and the planning horizon, with no overlap or placement in the past. Overnight availability must be normalized correctly across dates and time-zone/DST boundaries.
- Keep the saved duration. A task that needs more contiguous time than is available remains unplaced with an explanation.
- Honor feasible deadlines using existing date-only deadline semantics. Explain overdue/impossible deadlines and offer a clearly identified recovery proposal after explicit selection; never change the original deadline to make a proposal look feasible.
- Order work using deadline pressure and the existing priority/importance/urgency fields. Missing importance stays unknown. Define tie-breaking deterministically so unchanged inputs yield stable proposals.
- Count already scheduled work when enforcing a selected daily cap. Treat configurable breaks as unavailable spacing, not new tasks or invented alarms.
- Revalidate each edited/regenerated proposal. A snapshot changed by another tab, account switch, task completion, deletion or a newly occupied interval invalidates the old proposal.

## AI and a reliable baseline

Build one deterministic constraint planner and validator first. This provides a testable baseline and a usable local/offline fallback. Label that fallback as a rule-based recommendation, rather than claiming a model was used.

The proposed AI enhancement ranks eligible task IDs and explains tradeoffs through an authenticated server endpoint. The constraint planner still determines and validates the actual legal time slots. A model response cannot directly write tasks, bypass availability, invent task IDs or alter deadlines. Reject malformed, stale or infeasible output and keep the last valid preview intact.

External AI is explicitly opt-in. Show the fields being sent and the chosen provider before enabling it. Send only the minimum scheduling metadata; task titles are optional, and private notes, resources, account details, tokens and unrelated habits/goals are excluded. Keep API keys on the server, add bounded requests/rate limits and handle timeouts without creating tasks. Provider/model, budget and the precise data-sharing choice need confirmation before implementing this external path; no credentials or model service are currently configured.

## Reuse and required foundations

- `landing/planner-store.js:34–51` maps one `scheduledStart` and `durationMinutes` per task. V1 therefore keeps one block per task; splitting a task into multiple sessions requires a separate model change.
- `landing/planner-ui.js` already exposes the full 24-hour schedule. Reuse its calendar geometry and class-color presentation for the preview.
- `landing/app.js:93` routes task writes through `saveTaskWithAlerts`. The new batch integration must preserve that controller's work→alarm→notification links, independent switches, legacy/manual choices and owner guards. Preview generation must not schedule alerts.
- `cloudflare/src/planner.js` currently supports per-item writes. A reliable whole-plan Apply requires a dedicated validated batch operation, an idempotency key and an atomic stale-snapshot check. Expose version/revision metadata to the client; include changes to occupied blocks, not only the selected tasks, in conflict detection. Do not call a loop of existing PUTs atomic.
- For cloud Apply, commit the calendar changes together, then reconcile device alarms/notifications independently. An OS alert failure reports saved work plus the affected alert errors; it must not claim the task batch failed or retry by duplicating tasks.
- For local Apply, validate first and persist the entire changed item collection once with rollback on storage failure. Undo restores only fields this batch changed, only while the task/owner versions still match; preserve later user edits.
- Availability/break/cap preferences need an owner-scoped persistence contract and migration where cloud sync is supported. Free-text class periods and device-only `actualMinutes` do not establish class meeting times or cross-device learned estimates.
- Add the new batch/AI requests to the existing restricted native transport contract and tests as needed; retain its origin, authentication, body-size and method limits. An older backend should explain which actions are unavailable without losing the preview or task data.

## Implementation sequence

1. Confirm the small V1 scope and proposed defaults against the earlier conversation; define planning input/output and owner/version contracts.
2. Implement the pure free-time/constraint planner with deterministic fixtures, including impossible inputs and deadline recovery.
3. Add the Calendar selection/preferences/preview flow and accessible touch/keyboard alternatives. Keep previews read-only.
4. Implement guarded local batch Apply/Undo and the matching atomic cloud endpoint, then integrate independent alert reconciliation.
5. Add the optional authenticated AI ranking/explanation path after the validated planner is working, with explicit consent, server-only credentials and honest fallback labels.
6. Verify actual website and native runtimes, synchronize the intended web bundle into the existing iPhone project, and record exact build/source/platform evidence before release claims.

## Acceptance checks

- No overlapping, past or out-of-availability suggestions; correct midnight, late-night, DST, date-only and impossible-deadline behavior; unchanged task duration and deterministic ties.
- Preview/regenerate/cancel cause zero task or alert writes. Applying creates no task copies and preserves IDs, deadlines, colors and unrelated metadata.
- Local storage failure and cloud atomic rejection preserve the prior calendar. Retry is idempotent; stale previews, new occupied slots, double clicks, account/editor changes and safe Undo are covered.
- Linked alarms and banners follow approved starts; manual times and off/paused states remain unchanged. Report partial OS alert failures accurately.
- Local/signed-in/offline/reconnect modes, another client changing the plan, old backend compatibility and optional AI timeout/invalid-output/denied-consent paths have separate evidence.
- Use the required platform procedure for desktop, phone/iPad browser layouts, installed PWA and actual WKWebView. A Chromium viewport or successful build is not a physical-device or native-runtime pass. The existing native iPad launch and OS-delivery blockers remain blockers until tested successfully.

## Deferred beyond V1

Automatic background rescheduling, moving existing commitments, recurring-task generation, multi-session task splitting, external calendar imports and learned duration predictions are separate follow-ups. This plan does not deploy a website, migrate a production database, call a model with user task data or update the installed physical app.

## Review request

Ask Repository Overview to reconcile this proposal with its earlier AI scheduling advice, distinguish confirmed user requirements from suggested defaults, inspect the exact TEST planning commit, and identify concrete scope gaps, unsafe assumptions, source causes and priority changes. Request a compact implementation order and acceptance list; return the first plan before product implementation.

Relevant earlier local requirement: `docs/product-feedback-2026-11-12.md:37–39` calls for opt-in suggestions, explanations, user confirmation and a deterministic baseline before AI organization.
