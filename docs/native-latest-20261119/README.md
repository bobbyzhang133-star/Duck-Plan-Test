# Native update for the new Cloudflare site

Prepared November 19–20, 2026. User requested the latest website in the existing app and explicitly selected the new site’s separate accounts/data.

## Inputs and preserved native features

- Canonical website `DuckPlan-motion-preview` commit `fb93ff7` (application source `c5b5aed`, service-worker cache v95).
- Native starting commit `9780f0ae4a56c5eb9b9a6e01e98b1b0e88a641e5`; working branch `codex/native-latest-site-20261119`.
- Native API default is now `https://duckplan-latest.ocs-learning.workers.dev/api`. The old origin is explicitly rejected by the compiled transport boundary test. Cookies are host-scoped; device fallback templates remain API/account-scoped. Old-server data and guest storage were not deleted or migrated.
- The bounded web sync retained six native overlays plus `native-cloud.js`; all 119 resulting landing files match both built app bundles. Current calendar styling/folding, immediate spring, task features and request backoff are included.
- Native alarm, normal notification and sync engines, approved v11 icon, sounds, Xcode project signing and free Personal Team configuration are preserved. The only native application source change is the approved API URL. `sync-result.json` records protection before/after the web copy; `built-bundle-verification.json` verifies the explicit endpoint-only native change afterward.

## Build and automated verification

PASS: 580 Node tests; compiled native URL destination/method/body/redirect boundary; 14 compiled notification/ownership scenarios; native sync Swift boundary scenarios within the Node suite. Both Debug app/widget simulator and generic iOS builds succeeded unsigned under Xcode 27.2. `verify-built-bundle.py` checks the successful products, API constant in the native debug image, full landing hashes and preserved native assets/signing.

Reproduce from the native checkout:

```sh
node --test tests/
node ios/scripts/test-cloud-boundary.mjs
node ios/scripts/test-notification-boundary.mjs
xcodebuild -project ios/DuckPlan.xcodeproj -scheme DuckPlan -configuration Debug -sdk iphonesimulator -derivedDataPath /private/tmp/duckplan-latest-sim-build CODE_SIGNING_ALLOWED=NO build
xcodebuild -project ios/DuckPlan.xcodeproj -scheme DuckPlan -configuration Debug -destination generic/platform=iOS -derivedDataPath /private/tmp/duckplan-latest-device-build CODE_SIGNING_ALLOWED=NO build
python3 docs/native-latest-20261119/verify-built-bundle.py
```

## Actual native runtime checks

Runtime results are recorded separately from builds. QA uses a copy of the successful simulator product with only a separate bundle ID (`com.duckplan.latestqa20261119`, matching widget suffix) and test JS added. Native URLSession, AlarmKit, UNUserNotifications and account/store transports are real and unmocked. Test actions are scripted DOM interactions inside actual iOS 27.2 Simulator WKWebView, not trusted physical taps. Only dedicated synthetic accounts on the approved new server are used. Credentials/command files remain private under `/private/tmp/duckplan-latest-native-qa`; none are committed.

The first fresh-simulator run reached the native API but timed out under first-boot load/storage pressure. Only the two newly created disposable devices were removed; existing user app installations were not overwritten. Verification continued with a separate QA app ID on existing simulators. The iPad’s first app launch/termination commands also timed out during startup; a direct launch completed the same baseline successfully before the remaining checks continued.

An initial cloud-preference test crossed midnight at the end of November19. Its helper advanced the time without advancing the scheduled date, causing an incorrect expectation. The harness now moves both date and time and has an explicit next-day midnight mode; production app code was not changed for that test defect. Original diagnostic rows are retained.

PASS: all 32 required native mode runs (18 iPhone and 14 iPad modes) completed. Both actual WKWebViews passed local and live signed-in task/class/resource/template/note/goal/habit CRUD, visible unscheduled copies, template Schedule with retained settings, independent copies/source retention, Day/Week/Month and midnight/late-night work edits, exact-minute deadlines, default yellow/template color equality, linked/manual alert preferences and relaunch persistence. The phone additionally passed explicit midnight preference changes/relaunch and native foreground-status UI. Both passed sign-out/second-owner isolation and native stale-owner rejection.

PASS: independent same-account native containers performed iPhone create → iPad read/edit → iPhone relaunch/read, preserving exact manual alarm and normal-notification times, logged minutes and reminder choice while moving only scheduled work. Delivery was deliberately disabled; this is foreground metadata sync, not closed-app delivery evidence.

PASS: installed QA app native debug images and all 119 production web files match the successful simulator build, allowing only the separate QA identifiers and script injection. See `installed-qa-verification.json`. Native UI screenshots in this directory show dedicated synthetic records only.

See `runtime-summary.json` and the credential-filtered `phone-native-results.jsonl` / `ipad-native-results.jsonl` for per-run assertions, initial diagnostics and explicit unrun capabilities. The summary’s completion flag covers this stated native test matrix, not the separately listed physical/PWA/input/delivery limits.

## Installation and limits

The existing `DuckPlan-iOS/ios/DuckPlan.xcodeproj` is the installable source. Select your connected iPhone/iPad and Run. A successful unsigned build, TEST backup or web deployment does not install the physical app. The physical iPhone/iPad were unavailable during preparation.

NOT RUN: physical-device install, alarm/normal notification delivery/Stop/Snooze, physical Safari/PWA and trusted-touch/OS drag-layer behavior. Existing channels are preserved and their metadata/boundaries tested; simulator persistence does not establish physical delivery. Free Personal Team APNs background sync remains disabled, and the new server has no native APNs credentials. VAPID browser notifications on the new website are a separate channel.

No original-server deployment, new website deployment, signing/team change, secret rotation or physical-device data reset was performed for this app update.
