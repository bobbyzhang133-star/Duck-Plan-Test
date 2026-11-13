# Production-owner release handoff

Prepared locally on November13,2026. **Not executed.** This is the concrete hosted repair for the native Templates warning, subject to explicit approval under `.cursor/rules/local-first-release.mdc`. It must run in the account that owns the existing `duckplan` Worker and `duckplan-prod` D1, preserving the existing production origin and user data. The currently signed-in account cannot access those resources. Do not create a replacement database or point the app to dev.

## Reviewed release

Use already-published shared main commit **`50d7fdbb4fa0462cc9fa5e833787314e20e772d1`**, [PR22](https://github.com/m-mcnicholas/group-project-michael-bobby-priya/pull/22), which contains the v36 website/native-compatible feature set. This avoids accidentally publishing later local sidebar motion/brand revisions. Its `cloudflare/` source and migrations are identical to those audited here. The native app at4973cb7 already contains the matching feature modules.

Prepare a clean detached worktree of that exact shared commit, verify `git rev-parse HEAD`, then from its `cloudflare/` directory install its lockfile with `npm ci` and run `npm run check`. Do not regenerate the iOS project or change signing for this backend repair.

## Read-only owner preflight

From the pinned release's `cloudflare/`, after the owner signs into the correct account normally:

```sh
npx wrangler whoami
npx wrangler deployments list --env production
npx wrangler d1 migrations list duckplan-prod --remote --env production
npx wrangler d1 execute duckplan-prod --remote --env production --command "SELECT name FROM d1_migrations ORDER BY id;"
npx wrangler d1 time-travel info duckplan-prod --env production
```

Verify configured Worker `duckplan`, existing DB `duckplan-prod` (`c9841e56-286e-4cb4-b42e-8e0939ae2884`) and production URL `https://duckplan.duckplan-cloudflare.workers.dev`. Record the actually active Worker version and a fresh D1 recovery bookmark privately. Do not reuse an old deployment UUID from project history as if verified now. If IDs, ownership or migration history differ, stop and reconcile before changing anything.

## Approved change sequence

The new Worker loads the new tables unconditionally. **Migrate first, deploy second.** If0004 and0005 are pending, Wrangler's tracked migration command applies0004 before0005:

```sh
npm run db:migrate:prod
npx wrangler d1 migrations list duckplan-prod --remote --env production
npm run deploy:prod
```

Confirm all tracked migrations0001–0005 succeeded before deploy. If0004/0005 are already recorded, do not replay raw SQL: their `ALTER TABLE` statements are not idempotent. If an apply fails, inspect the actual schema/history rather than retrying standalone SQL or deploying over missing tables. Use the [D1 tracked migration procedure](https://developers.cloudflare.com/d1/reference/migrations/).

## Post-release acceptance

1. Record the resulting Worker version and deployed source commit. Compare served scripts/styles/manifest/service worker against the pinned release, including library, goals and notes modules and cache v36.
2. Sign in using a dedicated authorized production test account. Run this audit checkout's `tools/check-server-compatibility.mjs` against production with that account's private session file as described in the parent procedure. All required fields must be present; anonymous401 is not a pass. The gate performs GET only and logs no session or records.
3. In the existing iPhone app, refresh/relaunch, sign in normally and run Template create/edit→Schedule→save→relaunch, Add to tasks and repeat-copy/source-retention checks. Verify class/color/duration/notes/reminder settings and actual persisted IDs. Also run Note/Goal/Habit save/check-in/relaunch. A native reinstall is not expected to fix the old-server dependency; do not delete the user's app or local data to troubleshoot it.
4. Repeat browser desktop/phone/iPad task, template, personal-data and second-client synchronization cases against the actual hosted backend with the dedicated account. Confirm existing-account task access remains healthy. Preserve real user records and clean up only the dedicated test records/account through an authorized procedure.
5. Keep physical alarm/notification and any unavailable engine/device cases explicitly pending until actually tested. Update the evidence ledger; only then claim the phone/server feature issue repaired.

## Recovery

If the new Worker fails acceptance, roll back to the **preflight-recorded verified Worker version** using Cloudflare's normal rollback procedure. Worker rollback does not undo D1 migrations. These additive tables/columns should normally remain during a Worker rollback; verify compatibility. Database restoration is a separate owner decision because it can discard subsequent writes. Use the privately recorded bookmark and [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) only after assessing that consequence. No recovery/rollback command has been executed in this task.
