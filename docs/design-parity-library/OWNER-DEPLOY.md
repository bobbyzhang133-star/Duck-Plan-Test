# Owner action required for Templates and matching hosted UI

This is a prepared update for the owner of the existing `duckplan.duckplan-cloudflare.workers.dev` service. No production deployment or migration was performed by this preparation. Keep the existing Worker, D1 database, account records, sessions and secrets. Do not create a replacement database or change the app's API URL.

Current observations: the public service-worker cache is version13 and the library script is absent. The current local release is version67. The logged-in account on the development Mac cannot access the production D1 binding (`7404: database not found`), so the owner account must perform the update. The installed simulator's older app resources also lack the exact-time deadline renderer; this is separate from the physical phone, which was not inspected.

## Review and deploy from the owner account

Use the accompanying source archive, or the latest verified source branch in GitHub. It contains `landing/`, `cloudflare/src/`, every tracked migration0001–0008 and the existing production bindings. It contains no credentials, private environment files or QA database data.

1. In `cloudflare/`, run `npm ci` and `npx wrangler whoami`. Select the account that owns the existing Worker and D1 database.
2. Inspect `npx wrangler d1 migrations list duckplan-prod --remote --env production`. Take an owner-managed private database backup before applying missing migrations. On the known old baseline the missing group is0004–0008; inspect the actual list first.
3. After owner review/approval, run `npm run db:migrate:prod`, then `npm run deploy:prod`. These are production mutations. Preserve the existing configuration and secrets. Do not seed, reset, recreate or drop user data.
4. Verify the deployed cache is version67 and its scripts include `calendar-date-presentation.js`, the new library and default-yellow asset keys. An anonymous asset check is not enough to verify database capability.
5. Sign into a dedicated owner-authorized test account. Confirm `/api/planner` returns arrays for `templates`, `resources`, `goals`, `habits`, `habit_checkins` and `notes`, an `organization` object and true `work_alerts_supported`, `task_details_supported`, `settings_adoption_supported` flags. Do not publish session cookies or planner contents. Use the repository's read-only compatibility tool if desired.
6. On web and the updated native app, create/edit a template, Add to tasks, Schedule, reload/relaunch, and confirm the source template and independent copies persist on the same account. Verify a resource and the existing tasks/personal features. Timed deadlines belong at exact schedule minutes; date-only deadlines remain date-only. Check Personal/no-class light-yellow fills and preserved custom class colors.

The source and local compatible backend pass the current browser/native UI tests. That evidence does not establish that the old production server is fixed before this owner step. Native APNs activation and physical alarm delivery remain separate; the free Personal Team build is unchanged.

## Install the matching iPhone app

The existing local project is `DuckPlan-iOS/ios/DuckPlan.xcodeproj`. Its latest synchronized web bundle has been built and verified, preserving signing and native alarm/account customizations. Select the connected iPhone and Run in Xcode to install that build. Rebuilding/pushing source does not update an installed physical phone by itself. Keep the app on the same production API origin; an app reinstall alone cannot enable missing server-side library routes.
