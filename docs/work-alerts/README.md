# Linked work alarms and normal notifications

Implemented locally on `codex/task-notification-defaults-20261114`, based on `4dee052`, and synchronized into the existing `DuckPlan-iOS/ios/DuckPlan.xcodeproj`. Public hosting, production databases and the installed physical iPhone app have not been updated.

## Confirmed behavior

Newly saved tasks default to both channels enabled. Without a work start, linked channels have no delivery time. Setting or changing scheduled work moves the linked ringing alarm; the normal notification follows the chosen alarm time, including when the ringing switch is off. Editing either channel's date/time makes only that channel manual. **Use work start** and **Use alarm time** restore its link. Each channel has a separate switch. Clearing a manual date turns that channel off; another channel following a missing source stays pending rather than inventing a time.

Alert preferences loaded from older providers merge only fields the user has not changed. Save waits for that initial load, preserving custom times even when the user edits quickly. The same rules apply through the task editor, template scheduling, task-list/calendar moves and Undo. Deadlines stay independent. Existing tasks without saved work-alert preferences are not activated on load. Existing provider times become manual preferences when the task is edited/saved. Expired work remains on the calendar; past alert occurrences are not newly scheduled. Invalid new manual times and DST gaps show validation feedback, while an unchanged past manual time can be retained or switched off.

Task/settings persistence happens before channel scheduling. A channel failure keeps the saved task and its identity, explains which alert needs attention, and allows retry without creating another task. Device-wide pause remains paused through reconciliation/reload; saved task switches remain intact. Pending responses cannot attach an old task/editor to another account.

## Platform behavior

- The website saves ringing-alarm intent with honest iPhone-app availability text. It does not claim to ring a Clock alarm in a browser. Signed-in normal notifications use the existing `/api/alarms` service; push delivery still depends on actual device registration and server activation. A foreground in-app reminder is available where device delivery is unavailable and not explicitly paused.
- The native app retains AlarmKit for ringing and adds a separate UNUserNotificationCenter bridge for normal banners. Each has separate permission and scoped task records. A normal-notification tap opens only a task in the matching restored planner account. Completion/deletion/sign-out cancel the appropriate device records. Existing native cloud transport, signing, alarm appearance and approved icon are retained.
- The app bundles its website. This source sync and successful build do not update a previously installed phone app. Open the existing Xcode project, select the phone and Run to install the prepared version. Actual physical alert delivery remains a separate acceptance check.

## Persistence and backend compatibility

`items.work_alerts` is nullable versioned JSON, added by `cloudflare/migrations/0006_work_alerts.sql`. It stores the IANA time zone, separate enabled flags, explicit link/manual modes, optional manual wall times, alarm sound and snooze. Compatible planner snapshots declare `work_alerts_supported: true`. Older-client updates that omit the field preserve it; an explicit null clears it. Invalid payloads are rejected. Local import remaps task IDs while retaining validated alert metadata.

An older backend can still save ordinary tasks. Alert preferences are retained in an owner-scoped device cache with a visible device-only notice; this fallback does not claim cross-device preference sync. Import requiring unsupported alert metadata is refused without silently discarding it. The legacy real-Worker/live-update fallback is covered separately from the current backend.

For a later owner-approved hosted release, apply all required additive migrations through0006 to the intended database and deploy the matching Worker. No remote migration, public deployment, production permission change or push secret change was performed here.

## Verification evidence

The frozen browser/source identity, exact runtime versions and individual outcomes are in [runtime-ledger.json](runtime-ledger.json). The current fixture uses real Wrangler4.157 Worker/D1 migrations0001–0006; the legacy fixture uses backend`4dee052` and migrations0001–0005. Accounts and records are synthetic and isolated. Chromium157 desktop and phone/tablet touch emulation are labeled as such.

- **PASS:**37 alert/integration cases covering defaults, links/manual edits, switches, reload, timezone validation, failed/partial requests, real API jobs, drag/Undo, matrix preservation, signup/import/signout/session restoration, account/editor races, late legacy hydration with early edits/submission, and service-worker v55 offline save/reload/reconnect.
- **PASS:** full local and signed-in browser baselines on desktop, phone and tablet viewports, including saved task/template/class/resource/note/goal/habit actions and cloud peer synchronization. See the two `runtime-baseline-*.json` files.
- **PASS:**433 canonical Node tests, JavaScript syntax, diff checks and development/production Wrangler dry-run bundles. These checks do not deploy.
- **PASS:**438 native-checkout Node tests,12 compiled Swift boundary scenarios, final Simulator and unsigned physical-iPhone app/widget builds, and exact114-file source/Simulator/device build parity. These are build/boundary results, not physical installation or delivery.
- Native app/build/file parity and actual WKWebView action evidence are recorded separately in [native/README.md](native/README.md) and its JSON manifests. Simulator notification submission currently returns an OS authorization error despite authorized notification status; AlarmKit reports denied. Those delivery paths are **BLOCKED**, not passes. The separate iPad simulator install took over two minutes and its app launch timed out at45seconds before any WKWebView report; iPad WKWebView action checks are **BLOCKED** rather than inferred from the iPhone or tablet browser results.
- **NOT RUN:** physical iPhone/iPad ringing, banners, lock-screen/sound/Stop/Snooze, installed-PWA surface, Firefox/WebKit browser acceptance and production-backend mutation/migration checks. Browser-tab service-worker/offline testing does not establish installed-PWA or closed-app delivery.

The visual preview was inspected in the actual existing local Calendar, using an unsaved task at10:00. Both channels showed10:00 and their link status; Cancel left the user's seven-task count unchanged. No existing user planner record was edited by the checks.
