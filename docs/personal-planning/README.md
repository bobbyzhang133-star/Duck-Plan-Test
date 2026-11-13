# Saved personal planning

Goals, habits and standalone notes start empty. The local planner saves them in one `duckplan-demo-personal-v1` localStorage record, so a habit and its check-ins change atomically. The legacy task-demo reset leaves these saved personal records intact; use their explicit Delete actions to remove them. Signed-in accounts use D1 tables added by `0005_personal_planning.sql`. No remote migration or deployment is performed by this implementation.

## Store contract

- `listGoals()`, `upsertGoal(goal)`, `deleteGoal(id)`: `{ id, title, notes, targetCount, currentCount, unit, deadlineDate }`. Defaults are target 5, progress 0 and unit `sessions`. Targets allow 1–100000 and progress allows 0–100000; progress may exceed the target. Title is limited to 100 characters, notes 5000 and a nonblank unit 30. Deadline is optional and must be a real `YYYY-MM-DD` date.
- `listHabits()`, `upsertHabit(habit)`, `deleteHabit(id)`: `{ id, title, notes, repeatDays }`. Title allows 100 characters and notes 2000. Repeat days are a nonempty, unique, sorted integer array from 0 (Sunday) through 6 (Saturday), defaulting to every day.
- `listHabitCheckins({ habitId } = {})`, `setHabitCheckin(habitId, date, completed)`: `{ habitId, date, completed }`. Each habit/date pair has at most one active check-in. False removes it, and deleting a habit removes its active check-ins. Dates must be real calendar dates; the API imposes no server-time future-date restriction.
- `listNotes()`, `upsertNote(note)`, `deleteNote(id)`: `{ id, title, category, body, createdAt, updatedAt }`. Title allows 100 characters, category 60 (default `Personal`) and body 5000. Body whitespace is preserved. Creation time remains stable through edits; cloud timestamps are server-owned.
- `supportsPersonal` distinguishes this capability from the older organization/template/resource capability. Unsupported servers expose empty personal lists and reject personal writes/imports without discarding local records.

All mutations use the existing optimistic rollback and account-generation guards. Account changes clear personal state immediately; retired responses and live callbacks cannot repopulate another account's planner.

Cloud refreshes also share a per-account synchronization queue. It waits for pending writes and rejects snapshots invalidated by a later mutation, live row or refresh request, then reloads a fresh snapshot. The first socket connection catches the gap after the bootstrap snapshot. Import and Axis updates participate in the same guarded flow. Failed mutations roll back their unchanged optimistic rows without discarding unrelated successful updates. These races are covered by the personal-store regressions and the final two-context browser checks in `docs/contextual-add/README.md`.

## API and synchronization

`GET /api/planner` retains existing fields and adds `goals`, `habits`, `habit_checkins` and `notes` row arrays. Goals use `target_count`, `current_count` and `deadline_date`; habits store `repeat_days` as JSON; check-ins use `habit_id` and `date`; note timestamps use `created_at` and `updated_at`.

- `PUT/DELETE /api/goals/:id` returns `{ goal }`.
- `PUT/DELETE /api/habits/:id` returns `{ habit }`.
- `PUT/DELETE /api/notes/:id` returns `{ note }`.
- `PUT /api/habit-checkins/:habitId/:date` accepts `{ completed: boolean }` and returns `{ checkin }`.

IDs are UUIDs. Deletes are soft deletes; absent deletes return a null singular envelope. Goals, habits and notes cannot be resurrected through PUT. Check-ins can be checked again while their owned habit is active. Live row messages use the table names above; check-in rows are identified by habit/date rather than an independent ID. Ownership is enforced in both queries and schema triggers.

`POST /api/import` additionally accepts `goalRows`, `habitRows`, `habitCheckinRows` and `noteRows`. The client assigns fresh entity IDs and remaps check-ins to their new habit IDs. All rows and their receipt commit in one transaction. Personal import responses/receipts add `goalsAdded`, `habitsAdded`, `habitCheckinsAdded` and `notesAdded`; older payload/receipt shapes remain compatible. Empty personal datasets preserve earlier import fingerprints, while saved personal data participates in the fingerprint.

Behavioral verification is in `tests/personal-store.test.cjs` and `tests/personal-api.test.mjs`, alongside the existing organization, account, import and alarm suites.
