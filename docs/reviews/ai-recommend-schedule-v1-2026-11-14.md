# Recommend schedule first version plan

Status: first implementation proposal refined after the completed Chat Check. Product source remains at `7c76aa616b831bda00401ce3e46160d8b2c260d7`. This planning branch changes documentation only. Review completed in the existing [Repository Overview conversation](https://chatgpt.com/g/g-p-6addac00e55c8191a3f6db4456733345-duck-plan/c/6addacc2-3bc4-83e8-8f06-cdbedefe067c); [returned review](ai-schedule-chat-response-2026-11-14.txt).

Confirmed November 14, 2026: the user selected **Rule-based scheduler first; add AI next**. The first usable release includes scheduling, preview, explicit Apply and guarded Undo. External model integration is a later milestone.

## User experience

Add **Recommend schedule** to Calendar, beside the existing task actions without crowding the phone toolbar. Use the existing phone Tasks-sheet interaction pattern and the existing desktop/iPad task-column area, without a permanent third column. Both use the same steps:

1. **Choose work.** Select unfinished, unscheduled tasks. Show each saved duration and deadline. Use saved durations in V1; if an estimate needs changing, use the existing task editor first and generate a fresh proposal afterward. Existing scheduled work remains fixed.
2. **Choose available time.** Select Today or a date range, available hours for each day, break spacing and a daily work limit. Propose seven days as the editable initial range, not a hard limit; this is a design recommendation, not a confirmed user requirement. Keep availability session-only initially. Do not infer it from free-text class periods. The 24-hour timetable remains available.
3. **Generate a proposal.** Fit selected tasks around all existing scheduled items. Show proposed blocks in their existing class colors, clearly marked Suggested, with a short factual placement reason. Suggestions remain separate from saved tasks and scheduled alert requests.
4. **Review.** Accept or exclude individual suggestions, adjust planning preferences and regenerate. Explain tasks that do not fit rather than dropping them or silently shortening their duration. Cancel changes nothing.
5. **Apply selected.** Save the accepted work times to the same task IDs. Preserve deadlines, durations, class/color, notes, completion state and manual alert choices. Offer a guarded Undo for this applied batch.

Preserve the approved Calendar homepage, desktop/iPad task column, collapsed phone Tasks sheet, bottom navigation, existing spring transitions and v11 duck artwork. V1 does not create a separate AI task list.

## Scheduling rules

- Treat existing calendar blocks as occupied; V1 does not move them automatically.
- Place complete tasks in one contiguous block, within explicitly chosen availability and the planning horizon, with no overlap or placement in the past. Overnight availability must be normalized correctly across dates and time-zone/DST boundaries.
- Keep the saved duration. A task that needs more contiguous time than is available remains unplaced with an explanation.
- Honor an explicit due time when present, and use the existing end-of-day semantics for date-only deadlines. Explain overdue/impossible deadlines and offer a clearly identified recovery proposal after explicit selection; never change the original deadline to make a proposal look feasible.
- Order work using deadline pressure and the existing priority/importance/urgency fields. Missing importance stays unknown. Define tie-breaking deterministically so unchanged inputs yield stable proposals.
- Count already scheduled work when enforcing a selected daily cap. Treat configurable breaks as unavailable spacing, not new tasks or invented alarms.
- Revalidate each edited/regenerated proposal. A snapshot changed by another tab, account switch, task completion, deletion or a newly occupied interval invalidates the old proposal.

## Rule-based V1 and later AI assistance

V1 uses a deterministic constraint planner and validator, with local/offline recommendations. Label it **Recommend schedule** or **Rule-based recommendation**, rather than claiming a model was used. V1 requires no model provider, API key, AI request or model-service data sharing.

The later AI enhancement can rank eligible task IDs and explain tradeoffs through an authenticated server endpoint. The constraint planner will still determine and validate the actual legal time slots. A model response cannot directly write tasks, bypass availability, invent task IDs or alter deadlines. Reject malformed, stale or infeasible output and keep the last valid preview intact.

That later external AI path must be explicitly opt-in. Show the fields being sent and the chosen provider before enabling it. Send only the minimum scheduling metadata; task titles are optional, and private notes, resources, account details, tokens and unrelated habits/goals are excluded. Keep API keys on the server, add bounded requests/rate limits and handle timeouts without creating tasks. Provider/model, budget and data-sharing choices belong to that later milestone and do not block rule-based V1.

## Reuse and required foundations

- `landing/planner-store.js:34–51` maps one `scheduledStart` and `durationMinutes` per task. V1 therefore keeps one block per task; splitting a task into multiple sessions requires a separate model change.
- `landing/planner-ui.js` already exposes the full 24-hour schedule. Reuse its calendar geometry and class-color presentation for the preview.
- `landing/app.js:93` routes task writes through `saveTaskWithAlerts`. The new batch integration must preserve that controller's work→alarm→notification links, independent switches, legacy/manual choices and owner guards. Preview generation must not schedule alerts.
- `cloudflare/src/planner.js` currently supports per-item writes. A reliable whole-plan Apply requires a dedicated validated batch operation, an idempotency key and an atomic stale-snapshot check. Expose version/revision metadata to the client; include changes to occupied blocks, not only the selected tasks, in conflict detection. Do not call a loop of existing PUTs atomic.
- For cloud Apply, commit the calendar changes together, then reconcile device alarms/notifications independently. An OS alert failure reports saved work plus the affected alert errors; it must not claim the task batch failed or retry by duplicating tasks.
- Before that commit, use the current alert controller's legacy-loading/default preparation logic for each selected task and persist the prepared alert preferences with its new work start atomically. Calling per-task Save would break atomicity; changing only starts then calling reconciliation would miss tasks whose preferences were previously absent. Preparation happens during Apply, with current-owner guards, and a failed legacy read aborts Apply without overwriting unknown settings. Keep the pre-batch preference presence/values and applicable legacy provider state for Undo; restore or cancel resulting device requests explicitly, since ordinary reconciliation skips tasks with absent preferences.
- For local Apply, validate first and persist the entire changed item collection once with rollback on storage failure. A single localStorage write does not provide cross-tab compare-and-swap: define a shared owner-scoped lock/revision protocol for all participating task writers, or a transactional storage strategy, before promising conflict-safe local Apply. Test the supported fallback explicitly. Undo restores only fields this batch changed, only while the task/owner versions still match; preserve later user edits.
- Cloud Undo is a separate owner-scoped, idempotent atomic operation with expected post-Apply versions. Reject a conflicting Undo as a batch, rather than restoring a subset through individual PUTs. Never roll back a later edit or recreate an expired/delivered alert while restoring calendar state.
- If a later Save availability option is added, its break/cap preferences need an owner-scoped persistence contract and migration where cloud sync is supported. Session-only V1 inputs avoid silently persisting preferences. Free-text class periods and device-only `actualMinutes` do not establish class meeting times or cross-device learned estimates.
- Add the new batch requests to the existing restricted native transport contract and tests as needed; retain its origin, authentication, body-size and method limits. An older backend should explain which actions are unavailable without losing the preview or task data. AI transport is deferred with the later model integration.

## Implementation sequence

1. Use the confirmed rule-based V1 scope; define planning input/output, proposed defaults and owner/version contracts.
2. Implement the pure free-time/constraint planner with deterministic fixtures, including impossible inputs and deadline recovery.
3. Add the Calendar selection/preferences/preview flow and accessible touch/keyboard alternatives. Keep previews read-only.
4. Implement guarded local batch Apply/Undo and the matching atomic cloud endpoint, then integrate independent alert reconciliation.
5. Verify actual website and native runtimes, synchronize the intended web bundle into the existing iPhone project, and record exact build/source/platform evidence before release claims. Plan the separate optional AI milestone after this first usable version.

## Acceptance checks

- No overlapping, past or out-of-availability suggestions; correct midnight, late-night, DST, date-only and impossible-deadline behavior; unchanged task duration and deterministic ties.
- Preview/regenerate/cancel cause zero task or alert writes. Applying creates no task copies and preserves IDs, deadlines, colors and unrelated metadata.
- Local storage failure and cloud atomic rejection preserve the prior calendar. Retry is idempotent; stale previews, new occupied slots, double clicks, account/editor changes and safe Undo are covered.
- Linked alarms and banners follow approved starts; manual times and off/paused states remain unchanged. Report partial OS alert failures accurately.
- Local/signed-in/offline/reconnect modes, another client changing the plan and old backend compatibility have separate evidence. Verify V1 makes no external model requests; AI timeout/invalid-output/consent tests belong to the later integration.
- Use the required platform procedure for desktop, phone/iPad browser layouts, installed PWA and actual WKWebView. A Chromium viewport or successful build is not a physical-device or native-runtime pass. The existing native iPad launch and OS-delivery blockers remain blockers until tested successfully.

## Deferred beyond V1

External AI ranking/explanations, automatic background rescheduling, moving existing commitments, recurring-task generation, multi-session task splitting, external calendar imports and learned duration predictions are separate follow-ups. This plan does not deploy a website, migrate a production database, call a model with user task data or update the installed physical app.

## Chat Check outcome

Repository Overview reports inspecting exact TEST planning commit `bd7f03e0abcf270389bdfa1de517adb2d1bdf06f`, the product feedback and current task/store/alert source. It supports the proposed user journey and confirms its earlier recommendation was an Organize my day/schedule-suggestion action with understandable changes and user confirmation. The detailed V1 constraints and seven-day default remain proposals, not historical user approvals. The review did not independently execute runtime tests.

The review's main gates are atomic Apply/Undo, calendar-wide conflict revisions and separate post-commit alert reconciliation. Its P0 labels mean prerequisites for the proposed new capability; they do not establish a P0 incident in today's application. The revised plan also resolves duration editing, explicit due times, local cross-tab concurrency and legacy alert initialization/preservation.

The reviewer recommends a rule-based first usable release, then optional model ranking. The user confirmed that direction on November 14, 2026. Scheduling, preview, conflict-safe persistence, alerts and Undo form the V1 scope; actual model integration follows later.

Relevant earlier local requirement: `docs/product-feedback-2026-11-12.md:37–39` calls for opt-in suggestions, explanations, user confirmation and a deterministic baseline before AI organization.

The original draft reviewed externally is TEST commit `bd7f03e0abcf270389bdfa1de517adb2d1bdf06f`. Duration/alert/Undo clarifications follow the independent source review, and the final release scope reflects the user's subsequent choice. A completed rule-based V1 must not be reported as completed AI integration.
