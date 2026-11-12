# Approved Calendar homepage and Sigma mascot release

The user approved the local version for publication on November 11, 2026, then requested an owner deployment handoff because this Mac's Cloudflare account cannot access the existing production database.

## Result

- Calendar is the default opening page, using the original site's unified task column and full-height calendar. Tasks remain immediately visible on narrow screens; Dashboard and the other sections remain available.
- Task popups open and return to the actual clicked calendar task. The navigation rail continues to reshape the workspace.
- All six mascot poses use the white Sigma duck face and complete body. Resting front views have a plain outline with no visible tail or chest feather lines. The original Sigma logo and existing reactions remain.
- Includes the account-name fix already proposed in PR #17. There are no backend, database-schema, runtime-binding or native iPhone-app changes relative to shared main.

Current mascot preview: [front-view poses](../sigma-mascot/front-view-states.png).

## Validation

- Fetched shared `main` at `f2b34266fb4b5a9e16ff8df32eb00e3561b31f76`; the release contains that revision without conflicts.
- All 214 Node tests pass; changed JavaScript syntax and whitespace checks pass.
- Production Wrangler dry-run passes with the existing `duckplan-prod`, `PlannerLive`, static-assets and runtime-variable bindings. Worker bundle: 59.55 KiB, 16.14 KiB gzip; 67 static assets, approximately 7.1 MiB on disk.
- Local browser checks cover desktop and phone layouts, Calendar Day/Week/Month, visible task panel, navigation, task add/edit and Escape/focus restoration, popup anchoring, all mascot states and reduced motion. No page errors or horizontal page overflow in the checked layouts.

## Deploy from the owning Cloudflare account

Use the release pull request's head branch/commit. Check that `wrangler whoami` selects the account owning **duckplan-cloudflare**. The production Worker is **duckplan**, serving **https://duckplan.duckplan-cloudflare.workers.dev**. The existing database is **duckplan-prod**, ID **c9841e56-286e-4cb4-b42e-8e0939ae2884**.

From the repository root:

```sh
node --test tests/
cd cloudflare
npm ci
npx wrangler whoami
npx wrangler d1 info duckplan-prod --env production
npx wrangler deployments list --env production --json > /tmp/duckplan-before-release.json
npm run check
npm run deploy:prod
```

This release requires no D1 migration, secret update or new resource. Preserve the current Worker origin, database ID, Durable Object binding, cron schedules and secrets. The deploy command must run under the account that already owns production; this Mac's Bobby account returned D1 error 7404 for that database and showed no production deployment history. No production deploy was attempted from the wrong account.

## Verify and recover

After deployment, open the existing public URL at desktop and phone widths. An empty URL should open Calendar with the task panel visible. Check Dashboard navigation, the Sigma logo, a focused duck in Add task, and open/close behavior for a calendar task. Check `/api/session` and `/cloud-config.js` on the same origin, and verify `service-worker.js` contains `duckplan-app-motion-preview-v11`. Do not create a production test account or task unless separately authorized; anonymous UI/API checks do not prove signed-in or cross-device behavior.

Record the new Worker version ID and the prior version from `/tmp/duckplan-before-release.json`. If a serious regression appears, use the prior version ID with:

```sh
npx wrangler rollback PRIOR_VERSION_ID --env production
```

Recheck the public site after rollback. No schema change is introduced by this release.
