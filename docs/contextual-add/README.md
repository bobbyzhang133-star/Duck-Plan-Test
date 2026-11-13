# Contextual Add actions and saved personal planning

Completed locally on November 13, 2026, after resuming the [November 12 checkpoint](CHECKPOINT.md). The user confirmed that Goals, Habits and Notes should become working saved features.

The main Add action now follows the current section:

- Calendar, Dashboard and Tasks: **Add task**.
- Goals & habits: **Add goal / habit**, opening a choice of the two editors. Each section also has its own Add button.
- Notes: **Add note**.
- Classes: **Add class**.
- Settings: no unrelated Add action. Task search is also hidden outside the task/calendar/dashboard sections; Notes has its own saved-content search.

Goals save a target, manual progress, unit, optional deadline and notes. Habits save their repeat days and dated weekly check-ins. Notes save title, category and writing, with editing, deletion and search. These are real records, with empty states rather than hard-coded sample data. All use the existing planner store's local/account backends; personal actions do not create tasks. The existing task-demo reset preserves saved personal data.

## Final verification

All **290 Node tests pass**, including six added refresh/concurrency regressions. JavaScript syntax and diff checks pass. Development and production Wrangler bundles pass with `--dry-run`; nothing was published.

The resumed sync checks found and fixed a same-account stale-snapshot race: a refresh begun before a save or live row could later replace the newer UI state. Refreshes now share a per-account queue, wait for pending writes, discard invalidated snapshots and revalidate. Import and Axis writes use the same flow. First WebSocket connection also catches changes made between the bootstrap snapshot and connection. A failed write preserves unrelated successful updates during recovery.

The completed browser checks include:

- Goals/Habits/Notes CRUD, cancellation, validation, progress calculations, repeat days, weekly check-ins and reload persistence. Class creation persists without creating a task.
- Keyboard focus/trapping/Escape, source focus restoration, pending-save/error handling, 320/390/820/1280px layouts, dark mode and long titles/units. No horizontal overflow was found.
- Synthetic Goals/Habits owner changes during opening, drafting, saves and check-ins, including reused IDs, leaving and returning to the same account, mode changes and destruction. Old results cannot alter new-owner UI, errors or busy states. Notes owner-switch cleanup was checked as well.
- A stable real local Worker and isolated D1 database with two independent desktop/phone-sized browser contexts. Both received actual WebSocket row messages for goals, habits, check-ins and notes. Create, edit, delete, check-in undo/recheck, habit deletion cascade and reload all passed. Client and database state agreed at the end; no task was created.
- PWA cache **v27** contains all new personal-planning assets and the guarded store. With the network disabled, the local app created and reloaded one goal, habit, check-in and note while preserving the seven existing demo tasks, without page errors or horizontal overflow.

Reusable manual MCP Playwright checks: [cloud live sync](cloud-sync-qa.js), [Goals/Habits owner isolation](goals-owner-qa.js), [local PWA offline](offline-qa.js). Run them with `browser_run_code_unsafe`'s absolute `filename` argument. Each uses a new isolated browser context and closes it afterward. The cloud script targets only the loopback test Worker at port 8790 and synthetic accounts; the privacy script makes no real API/account requests.

Screenshots: [phone goals](goals-390.png), [phone habits](habits-390.png), [phone notes](notes-390.png), [iPad goals](goals-820.png), [iPad notes](notes-820.png), [goal chooser](goals-chooser-390.png), [320px goal editor](goals-dialog-320.png), [habit editor](habit-dialog-390.png), [dark goals](goals-dark-390.png), [dark notes](notes-dark-390.png), [live cloud state](cloud-sync-390.png), [offline state](offline-390.png).

## Release boundary

The preview is [http://127.0.0.1:8034/](http://127.0.0.1:8034/). Only the isolated local QA database received migrations. A future approved cloud release must apply the ordered migrations, including 0004 and 0005, before deploying this backend. [Personal-planning contracts](../personal-planning/README.md) describe the schema/API/store changes.

No public deployment, remote migration, main-branch merge, iPhone bundle sync or installation was performed. The approved v11 duck master is byte-identical. Responsive checks used Chromium viewport emulation; physical Safari/iPhone/iPad testing remains unperformed. Offline checks cover the local planner, not offline account/API synchronization.
