# Separate Cloudflare site — deployed November19

Live URL: https://duckplan-latest.ocs-learning.workers.dev/#calendar

The user explicitly chose a separate site after being told it has separate accounts/data. Created Worker `duckplan-latest` and its separate D1 database in the already authenticated Cloudflare account. The original Worker/D1 configuration, existing hosted service, unrelated OCS resources and native app/API origin were not changed.

The website/backend application inputs are unchanged from the verified `c5b5aed` release (cache95). New deployment configuration lives in `cloudflare/wrangler.latest.jsonc`. All eight migrations were applied to the new empty database; the final remote list reports no pending migrations. The Worker owns its own SQLite Durable Object namespace for live sync and both existing cron schedules. Static files bypass application code except the existing dynamic/API routes. No plan or billing settings were changed.

Initial verified deployment: `92f152ab-8b15-40af-9b73-c87b16ae9817`, Worker version `75697393-6451-4d20-8f1d-523da2ef9c51`. After the user approved notification credentials, active deployment is `25e5bb9d-1296-4f35-bae9-4d17df804a43`, Worker version `70ba52a4-4f47-40da-9c10-ada35d500d25` at100%traffic. Provider startup time2ms; uploaded Worker100.86KiB/24.68KiBgzip and117static assets. `deployment.json` records the first verified healthy version for future rollback reference; no rollback occurred.

## Live acceptance

- **PASS:**real hosted sign-up/session, planner capability flags, signed-in desktop1280×900, phone390×844 and iPad835×1112 browser baselines (`browser-baseline-live-results.json`). Used one newly generated dedicated `.test` release account, never existing user records. Its synthetic retained task copies remain scoped to that account.
- Class/resource CRUD; template create/edit/Schedule/Add to tasks/copy/source retention/desktop drag/reload; task validation/save/edit/complete/delete; notes/search; goals/progress; habits/check-ins/cascades; independent copies; phone/iPad writes received in the desktop client through real live WebSockets all passed. The failure/retry check injects one controlled503 response in the browser; other persistence/sync requests hit the real new Cloudflare backend.
- **PASS:**no page errors, unexpected API statuses or external-origin requests in these baselines. Real planner snapshot exposes all required arrays and work-alert/task-detail/settings-adoption support.
- **PASS:**anonymous session200, anonymous planner401, default Calendar opening, own-origin `/api` config and immediate whole-timetable spring (`live-smoke.json`). The hosted body has one active440ms return immediately after edge input, with the latest versioned viewport asset loaded.
- **PASS:**six key deployed asset hashes equal the local release (`asset-parity.json`). Cloudflare redirects `/index.html` to `/`, so compare the canonical root to local `index.html`. Python's local CA store initially failed certificate verification; system curl verified TLS normally. No TLS bypass or application change was used.
- The575 passing Node tests and actual local Cloudflare full-baseline evidence from `docs/cloudflare-release-20261119` have unchanged application inputs and are reused explicitly.
- **NOT RUN:**physical Safari/trackpad/iPhone/iPad, installed PWA/native WKWebView and real alarm/push delivery. Browser viewport/touch emulation and server support flags are distinct from those runtime/delivery checks. No iOS source sync/build/install was requested or performed here.

## Notification approval boundary

Attempted to provision fresh VAPID browser-notification credentials as a follow-up setup step. Automatic approval review rejected starting that process: the site-creation request did not separately authorize persistent private-credential upload, and deployment could be verified without it. The provisioning script did not run; no key was generated/uploaded and no secret configuration changed. It was not retried or bypassed.

The user subsequently explicitly approved generating the private push key and storing it in this site's Cloudflare secrets. That resolved the approval boundary. Installed exactly three fresh secrets after confirming there were none: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_JWK`, `VAPID_SUBJECT`. The ECDSA P-256 key pair was generated in memory and verified using the actual backend's VAPID signing function before upload. Keys went to Wrangler through stdin, never command arguments or source files; `WRANGLER_WRITE_LOGS=false` prevented persistent CLI debug logs. No key values are committed here. The private key remains in Cloudflare secrets and must not be silently rotated on future deployments.

**PASS:**the secret inventory lists the three intended names. Live signed-in `/api/push/config` reports available with a valid65-byte uncompressed P-256 public key, identical across two independent sessions. Settings no longer says server activation is pending and presents the normal device opt-in action. Through the actual browser notification adapter, a future notification time saved to Cloudflare, appeared in the second session and cancellation removed it there. Test task/notification records were cleaned up; no push devices were enrolled. See `notification-activation-check.js` and `notification-activation-results.json`.

**PASS:**27 focused notification/capability/provider/VAPID/dispatch/ownership tests; reused prior full baseline because application, schema and assets are unchanged. **NOT RUN:**real push subscription/provider acceptance/OS-visible delivery/closed-browser physical lifecycle. These require each device's opt-in and real delivery testing; server activation is not a claim of delivery. No browser permission was granted on the user's device. The settings card explains the iPhone Home Screen/device steps.

Browser notification server activation is now complete. Native APNs background delivery and Google OAuth remain unconfigured; this did not change native credentials, app source or billing.

## Future authorized releases

From `cloudflare/`, use `npm run db:migrate:latest` for intended schema additions and `npm run deploy:latest` for this separate site. Never use the original production profile to update it. Keep the same VAPID pair across future deployments if notification setup is later approved; do not silently rotate enrolled-device credentials.

The deployed site is public and prepared for the user to create a new account in Settings. A new account does not import another server's users or planner data. User permission to deploy this site does not authorize migrating or replacing the original account database, changing native API origins, or publishing future changes automatically.
