# Product feedback verification — November 12, 2026

The implementation scope and source are recorded in [the product feedback notes](../product-feedback-2026-11-12.md).

## Automated checks

All **259 Node tests pass** (`node --test tests`), along with JavaScript syntax and `git diff --check`. The suite covers planner behavior and existing alarms, plus new template/resource validation, matrix classification, account ownership, import remapping, transaction rollback, duplicate/concurrent import receipts, live updates, storage failures, old-server compatibility and account-switch races. Development and production Wrangler bundles pass with `--dry-run`; they do not publish.

## Browser checks

Local-only browser contexts were used; real accounts and existing user data were untouched.

- Template creation/edit/cancel/delete/reload; fresh task IDs per use; custom 20-minute duration, notes and reminder preference preserved; Schedule opens an unsaved draft with a blank deadline.
- Template calendar drops on Week Due bands/headers/timed slots and Month dates. Work date/time follows the target, independently of the selected day, while the deadline stays blank. A saved 35-minute draft creates exactly one new task and preserves notes/class/reminder metadata. The Week Due-band defect found during review is fixed and covered by a regression test.
- Class resources, class selection and task links; safe escaped text and HTTP(S) URL validation; keyboard focus, Escape/backdrop and busy/error behavior.
- Matrix classification, explicit Move, native desktop dragging, reload, deadline-driven Auto urgency, missing-deadline classification, completion and Done/undo. The task ID, class, notes, reminder, scheduled time and logged time remain intact.
- Layouts at 320, 390, 820 and 1280 CSS pixels, including dark mode. No horizontal document/workspace/component overflow was found. The phone template shelf starts collapsed so actual tasks remain on the first screen.
- A real local Wrangler Worker with an isolated temporary D1 database: synthetic account creation, local planner import, template creation, adding a task, matrix classification and urgency preference updates. A second independent browser context received resource, task classification and preference changes live. Re-importing the same local planner from the fresh context kept five classes and seven original items, rather than duplicating them. Adding one template copy produced exactly one additional task with no invented deadline or scheduled start.
- PWA cache v24 contains all five new library/matrix/integration assets. After switching an isolated phone-sized context offline and reloading, the local task matrix opened without page errors. Account/API requests remain online-only; this does not claim offline cloud synchronization.
- The reusable [account UI privacy regression](account-ui-privacy-qa.js) passes in an isolated context with synthetic store owners and deferred results. Switching owners clears recovery/password UI, settings caches and open task drafts; late recovery/password or Axis/import results stay hidden, including leaving and returning to the same owner. A newer same-owner settings refresh wins over an older response. The harness makes no real auth/API/nonlocal requests and closes its context afterward.

The local Worker uses `/private/tmp/duckplan-product-feedback-local-v2`, separate from user data and all remote databases. The website preview is [http://127.0.0.1:8034/](http://127.0.0.1:8034/); the isolated cloud QA Worker uses port 8788.

## Screenshots

- [Phone Tasks, collapsed templates](library-templates-390.png)
- [Phone templates expanded](library-templates-expanded-390.png)
- [Desktop templates](library-templates-1280.png)
- [320px template editor](library-template-editor-320.png)
- [iPad template editor](library-template-editor-820.png)
- [Desktop class library](library-classes-desktop.png)
- [Phone resources](library-resources-390.png)
- [iPad resources](library-resources-820.png)
- [Dark phone resources](library-resources-dark-390.png)
- [Resources in task details](library-task-resources-desktop.png)
- [Desktop matrix](matrix-desktop.png)
- [Phone matrix](matrix-phone.png)
- [Dark phone matrix](matrix-phone-dark.png)
- [Live cloud matrix synchronization](cloud-matrix-sync.png)

## Limits

Responsive checks used Chromium viewport emulation, not physical iPhone/iPad or Safari testing. Production deployment/migration, native iPhone bundle changes, phone installation and AI organization are outside this local website change. Existing native alarm code, signing and approved icon artwork are unchanged.
