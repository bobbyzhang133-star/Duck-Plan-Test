# Owner activation guide

This is a prepared release procedure, not a record of deployment. It changes production only when the owner explicitly authorizes and performs those steps. Keep the existing public origin, D1 database, accounts and native signing identity; do not create a replacement database to work around an account mismatch.

## 1. Review the prepared inputs

Review [README.md](README.md), [runtime-source.json](runtime-source.json), [native-source-sync.json](native-source-sync.json) and [native-build-manifest.json](native-build-manifest.json). [The public static v13 probe](public-source-readonly.json) does not prove authenticated schema readiness. The Cloudflare login must own the existing `duckplan` Worker and `duckplan-prod` database.

From the canonical checkout, run the checks for the exact release being activated:

```sh
node --test tests/
cd cloudflare
npm ci
npm run check
npx wrangler whoami
npx wrangler d1 migrations list duckplan-prod --remote --env production
```

The test/dependency/dry-run commands prepare and check local inputs. The last two commands inspect the selected account/database. Keep any production backup/export private and outside the repository. Obtain an owner-managed D1 backup before applying missing migrations.

## 2. Activate the compatible backend and website

The release needs all tracked migrations through `0008`. On the previously recorded production baseline, the missing group is `0004–0008`: organization/library, personal planning, work-alert metadata, shared task details/revisions and native background-sync registration/outbox. Inspect the actual remote migration list rather than assuming that baseline is still current.

After owner approval, from `cloudflare/`:

```sh
npm run db:migrate:prod
npm run deploy:prod
```

These are production mutations. Use the existing `wrangler.jsonc` bindings. Do not seed production, reset D1 or delete existing planner records. Preserve the deployed version and backup information for rollback; additive data migrations should not be reversed by dropping user columns/tables.

With a dedicated authorized test account on the deployed origin, verify `/api/planner` returns `work_alerts_supported`, `task_details_supported` and `settings_adoption_supported`, all `true`. Confirm returned items include read-only integer `sync_revision` and that non-null metadata validates. Avoid printing planner contents, cookies or session tokens in shared logs.

`tools/check-server-compatibility.mjs` can verify the general planner contract with a private session file, but its current baseline check alone does **not** verify these three new flags. Also check authenticated `/api/native-sync/status`: absent APNs secrets should honestly report disabled/awaiting activation rather than pretending closed-app updates are active.

Use two isolated browser sessions on the same test account. Save distinct work/alarm/normal-notification times, logged minutes and a reminder choice; verify exact peer live updates and reload. Check a legacy device's cached settings auto-adopt without a full task rewrite, canonical cloud settings win, and completed history syncs while staying completed. Test deletion and account switching with a request pending. Follow the full [platform baseline](../platform-testing/README.md) for the release; do not use real users' tasks as fixtures.

## 3. Keep free signing usable; opt into native push separately

The default native Debug/Release configurations keep `DUCKPLAN_BACKGROUND_SYNC_ENABLED=NO` and an empty push-entitlements setting so the existing free Personal Team workflow remains usable. Do not turn on a push entitlement for that team. Foreground sync and already scheduled local OS alarms are separate from receiving new remote changes while the app is closed.

To activate closed-app background hints, the owner needs a push-capable Apple Developer Program team, an App ID/provisioning profile with Push Notifications, and an APNs token-signing key. Review [Apple's capability/membership guidance](https://developer.apple.com/help/account/reference/supported-capabilities-ios) and [APNs token setup](https://developer.apple.com/help/account/capabilities/communicate-with-apns-using-authentication-tokens/).

In the existing `DuckPlan-iOS/ios/DuckPlan.xcodeproj`:

1. Preserve the App/Widget bundle IDs, icons, AlarmKit setup and existing local native customizations. Select the intended paid team/profiles for a separate push-enabled build.
2. Use the prepared `ios/Config/Push-Debug.xcconfig` or `Push-Release.xcconfig` as an explicit build override/base configuration. They include the ordinary configuration and opt in to `App/DuckPlan.entitlements` plus `DUCKPLAN_BACKGROUND_SYNC_ENABLED=YES`. Keep the ordinary configurations available.
3. Verify Push Notifications provisioning and the `remote-notification` background mode. Match Debug's development entitlement to the `sandbox` API environment; distribution uses production for both. Check the built app's actual entitlements and Info.plist, not just Xcode UI settings.
4. Build and install that reviewed configuration on each intended physical iPhone/iPad. The existing default Simulator build manifest is unsigned and push-disabled; it is not this activation build.

Do not put APNs keys, device tokens, passwords or production cookies into source, screenshots, chat or test artifacts.

## 4. Configure the Worker's APNs environment

The Worker accepts these secret names:

- Shared: `APNS_TEAM_ID`, `APNS_TOPIC` (the app's exact bundle identifier).
- Development/sandbox: `APNS_SANDBOX_KEY_ID`, `APNS_SANDBOX_PRIVATE_KEY`.
- Distribution/production: `APNS_KEY_ID`, `APNS_PRIVATE_KEY`.

Use the selected owner account and `npx wrangler secret put NAME --env production` for each required value, supplying values privately through its prompt. Activate only environments matching the actual builds being tested. The server JWT signer needs the valid APNs private key; key IDs alone do not enable delivery. Browser Web Push uses separate VAPID setup described in [cloudflare/ALARMS.md](../../cloudflare/ALARMS.md); VAPID is not an APNs key or an AlarmKit requirement.

Keep the existing per-minute Worker cron active. Native updates use the account outbox, coalescing, one accepted hint per device per 20 minutes, bounded transient-error retries and acknowledgments from snapshot consumption. An APNs 200 means accepted, not delivered; missing credentials remain an activation blocker.

## 5. Validate actual phones and iPads before claiming completion

1. Install the intended native bundle on both devices, sign into the same dedicated account, open each once and explicitly allow the separate ringing-alarm and normal-notification permissions. Confirm any local device pause choices and Settings' account/background-sync status.
2. Change a task on one device. Verify exact fields on the other while both are foregrounded, after relaunch, and after a refresh/reconnect. Check task/template CRUD, Schedule/touch actions, resources and personal sections using the full baseline.
3. With the receiving app backgrounded/suspended normally and network available, change a future task from the other client. Verify native background snapshot consumption and actual OS requests on that installation; then verify real delivery, Stop/Snooze and cancellation after remote edit/completion/deletion. Repeat both directions and on iPad.
4. Test denied permissions, a paused device, expired/sign-out sessions, account switches and failed/retried requests. A background fetch must not request authorization or hydrate another account. For an OS scheduling failure, verify `needsAttention` and then foreground/manual-refresh retry; a consumed-snapshot acknowledgment does not prove OS registration. There is no dedicated closed-app OS retry after that acknowledgment, and persistent permission denial must not trigger endless pushes.
5. Record the exact source/build/backend versions and PASS/FAIL/BLOCKED/NOT RUN results. Simulator injection, compilation, accepted APNs responses and visible metadata alone do not pass physical delivery.

Background updates are best effort and can be delayed or suppressed. User-force-quit apps are not automatically relaunched for these updates; open the app to refresh. Choose test times with adequate lead time for the 20-minute rate policy and OS scheduling. A task scheduled very soon on another device cannot be promised to ring there before its app receives the change. See [Apple's background update guidance](https://developer.apple.com/documentation/usernotifications/pushing-background-updates-to-your-app).

Only after these checks should the owner report a public rollout or an installed-phone update. A source sync, GitHub push or successful Simulator build is not an installed physical-device update.
