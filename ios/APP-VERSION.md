# Current native app version

Synced November 19 and verified November 20, 2026 from website commit `fb93ff7` (application source `c5b5aed`, cache v95). The existing local Xcode project includes the latest calendar folding, deadline styling, whole-timetable immediate spring rebound and request backoff changes.

The app now connects to **https://duckplan-latest.ocs-learning.workers.dev/api**, as explicitly requested. This is the separate new site’s accounts/data. Original-server accounts and records are not migrated or deleted; use the account created on the new site. Device guest data is preserved, and account/API-scoped fallback templates remain isolated from the new server.

Open the existing `DuckPlan-iOS/ios/DuckPlan.xcodeproj`, choose your connected iPhone/iPad and press Run to install. Existing local signing settings, native alarms/normal notifications, approved icon and sounds are preserved. Source synchronization or a build does not update an installed physical app.

See `docs/native-latest-20261119/README.md` for exact source/build/runtime evidence and limitations. Free Personal Team background push remains disabled; this update does not add closed-app cross-device APNs sync.
