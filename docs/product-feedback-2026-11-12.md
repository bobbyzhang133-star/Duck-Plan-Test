# DuckPlan product feedback implementation

Source: the user's [Repository Overview conversation](https://chatgpt.com/g/g-p-6addac00e55c8191a3f6db4456733345-duck-plan/c/6addacc2-3bc4-83e8-8f06-cdbedefe067c) and its attached `duckplan-product-feedback-2026-11-12.md` planning document, reviewed November 12, 2026. This record summarizes the relevant requirements; it does not reproduce the private conversation.

The user confirmed this was the same review used for the earlier mobile work. This implementation extends the current `DuckPlan-motion-preview` checkout. Calendar remains the default opening page. The existing full-width phone calendar, collapsed Tasks sheet, bottom navigation, desktop/iPad task column and approved v11 Sigma duck are preserved.

## Assignment templates

Tasks and the Calendar task column have an **Assignment templates** shelf, initially closed so existing tasks remain immediately visible. Users can create, edit and delete templates with a title, optional class, duration, priority, notes and deadline-reminder preference.

**Add to tasks** creates one unscheduled task with a fresh ID and leaves the template intact. **Schedule** opens the normal task editor with a selected work date/time; no task is created until Save. Desktop users can also drag a template onto a calendar time or task list. Tap and keyboard controls provide the same actions. A work time never invents a deadline. Custom template durations remain intact in the task editor.

This is manual reuse, as the review recommends before introducing automatic recurrence. There is no recurring-task generator.

## Class resources

Each class has **Assignments**, **Resources** and **Overview** tabs. Resources have a title, HTTP(S) URL, optional description/category and display order. Saved links are also available in a task's advanced details when its class is selected. Archived classes remain available for existing tasks, templates and resources.

Resource text is escaped. Only HTTP(S) links without URL credentials are accepted; external links use `noopener noreferrer`. DuckPlan does not fetch link contents, scrape pages or upload files.

## Priority matrix

Tasks has a **List / Priority matrix** switch. The matrix organizes the same task IDs into Do first, Schedule, Consider delegating and Reconsider. Completion, edits and calendar placement continue to use the existing planner store.

Importance is explicitly chosen and remains separate from High/Medium/Low priority. Auto urgency uses deadlines, including overdue tasks, with a configurable 0–30 day window; the default is two days. Users can override urgency manually. Missing importance or a missing deadline in Auto mode stays in **Needs classification**, rather than silently becoming unimportant or non-urgent.

Desktop users can drag between quadrants. Every task also has classification fields and a Move action for touch and keyboard use. The matrix uses two columns on larger screens and stacked quadrants on phones.

## Persistence and compatibility

All three features use `planner-store.js`, with account-scoped Worker/D1 persistence and live updates when cloud sync is configured. Local copies use the existing local-store backend. No parallel task database or extra task silo is introduced.

Migration `cloudflare/migrations/0004_product_organization.sql` adds task importance/urgency, templates, class resources, per-account urgency preferences and import receipts. Resource/template ownership and class ownership are enforced by the API and database. Deletes remain soft deletes. Local planner imports remap class references, are atomic, and have server-side idempotency receipts to prevent duplicate retries even if the browser cannot save its import marker.

Older backends remain readable. Unsupported organization writes/imports are blocked with explanatory UI rather than discarding new metadata. Local writes report storage failures and roll back. Account changes clear prior data/editors/settings immediately, and delayed requests or retired sockets cannot repopulate another account's UI.

## Deferred recommendation

The source recommends AI organization after these foundations. No AI API, automatic rescheduling or private-data transmission was added. A later implementation should be opt-in, explain suggestions and require user confirmation, with a deterministic baseline considered first.

## Release boundary

This is a local website implementation and review-branch backup. It does not deploy the public Cloudflare Worker, apply a production migration or install an iPhone update. A future approved cloud release must apply migration 0004 before serving the new backend. The separate existing `DuckPlan-iOS/landing/` bundle must be deliberately synced and rebuilt when a phone update is requested.

See [verification evidence](product-feedback/README.md) for checks, screenshots and remaining device-testing limits.
