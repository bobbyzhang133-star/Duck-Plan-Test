# Cloudflare release preparation — November19

Requested: create a Cloudflare server for the current website. Source is `c5b5aed` with cache95 and the immediate whole-timetable spring. This file records the earlier preflight checkpoint before destination selection. The user later chose and authorized a separate site; current deployment and notification status are in `../cloudflare-latest-20261119/README.md`. At this preflight checkpoint no remote mutations had occurred.

## Account and preserved resources

Wrangler4.157.0 was installed from the repository lockfile and existing npm cache. Existing OAuth authentication is valid for the Mac's Cloudflare account. Read-only account/database checks show the account does not contain the original DuckPlan D1 bindings; its inventory contains one unrelated OCS database, which was not modified. The `duckplan` deployment list in this account is empty. Earlier owner-deployment guidance remains applicable to the original service.

A separate Worker/D1 deployment would have separate accounts/data and must use a separate Wrangler profile, leaving existing production configuration and native API origins untouched. Updating the original address requires its owner's account access, an existing-version/backup preflight and review of the actual pending migrations. Do not silently replace the original backend or redirect native account traffic.

## Concrete prepared source

`source-manifest.json` records hashes for the exact website, backend, migrations and configuration. The existing Worker serves assets directly, with only `/api/*` and `/cloud-config.js` routed through application code. All eight migrations0001–0008 are included. Runtime bindings are D1 `DB` and SQLite Durable Object `LIVE`; cron dispatch supports browser reminders/native-sync requests and Axis synchronization.

Dry-run build: **PASS**,119 reported asset entries, Worker100.86KiB /24.68KiB gzip. Filesystem asset tally118files/15,612,552bytes; largest individual file1,512,264bytes. No pruning/redesign, paid-plan/billing change or package upgrade was performed. Optional Google and push/APNs credentials are not invented/copied from another service; account sign-in works without Google secrets, and notification delivery must remain honestly gated until configured/tested.

## Local release verification

- **PASS:**all eight real D1 migrations against a new isolated temporary local database. Initial sandbox socket binding failed with `EPERM`; rerunning with approved local-server execution succeeded. No remote migration was run.
- **PASS:**575 automated Node tests on the release source.
- **PASS:**actual Cloudflare Worker runtime at127.0.0.1:8796 using that temporary database and actual Durable Object WebSockets. `browser-baseline-cloud.js` creates only a disposable local account. All desktop1280×900, phone390×844 and iPad835×1112 cases passed with no page/API/unexpected-external errors.
- The baseline covers real sign-in/session capability detection, class/resource CRUD, template create/edit/Schedule/Add to tasks/source-copy retention/reload, desktop drag, task invalid/save/failure/retry/edit/complete/delete, note editing/search, goal progress, habit check-ins, deletion/cascades and independent retained task copies. Phone/iPad writes reached the desktop peer through real local live sync.
- **PASS:**signed-in planner exposes templates/resources/goals/habits/check-ins/notes and work-alert/task-detail/settings-adoption support. Browser notification/physical alarm delivery is not inferred from those capability flags.
- The local-only latest-rebound/runtime and offline evidence in `docs/immediate-calendar-rebound` has unchanged application inputs and remains valid for those browser checks. It does not establish a hosted release.
- **PENDING:**destination choice, remote bindings/schema/secrets/deployment and final live authenticated acceptance.
- **NOT RUN:**physical Safari/device, installed PWA/native WKWebView/phone installation. This request does not synchronize or install a new iOS bundle.

After the destination is settled, verify the exact deployment profile, create/reuse only its intended resources, apply migrations within that scope, deploy and test the real returned URL and dedicated-account persistence/sync. Record the provider version/rollback details and remaining notification limits. Do not present the old public URL or a dry run as an updated server.
