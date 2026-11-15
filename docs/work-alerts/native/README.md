# Native work-alert verification

The existing app is `DuckPlan-iOS/ios/DuckPlan.xcodeproj`. Its bundled website is synchronized from `DuckPlan-motion-preview`, retaining the actual app's native cloud transport, alarm appearance, approved v11 icon and personal signing settings. No physical phone, user simulator data, public backend or hosted website was changed.

## Version and packaging evidence

- `sync-manifest.json`: all 114 native landing files; six bounded native overlays; native source/artwork/project hashes before and after synchronization.
- `build-manifest.json`: exact landing source/build SHA256 parity for the frozen source. Debug Simulator app+widget build succeeds. The simulator test app is a separate temporary copy, with only `index.html` and `native-functional-qa.js` instrumented. OS signing experiments apply only to that temporary copy.
- `native-unit-summary.txt`: 438 native-checkout Node tests pass. Compiled Swift notification-boundary tests separately pass 12 cases; compiled native cloud security boundary tests pass. They do not establish OS delivery.
- `runtime-results.json`: sanitized actual WKWebView stage/assertion records. Private collector commands and disposable local account credentials remain outside the repository.

The native bundle intentionally differs in `app.js` (native refresh/WebSocket handling), `app-install.js`, `cloud-config.js`, `index.html`, `planner-store.js` (native authentication providers) and `service-worker.js`. `native-cloud.js` remains the existing native-only transport. No configuration, secrets, signing or provisioning files are copied from the website.

## Test environment and limits

Disposable QA devices use the installed iOS 27.2 runtime: iPhone 18 Pro `BE0EB000-07DE-48B6-B694-0D44CB864396` and iPad Pro 11 M5 `480153F4-90AF-42F0-A703-D124E76671BA`. Only one QA device is booted at a time. The pre-existing user simulator `E8481E77-386B-4C54-BE35-BC1293ECE255` is left untouched.

The runtime harness uses actual task/personal/template UI handlers, native WK message bridges, the real local Worker at `http://127.0.0.1:8796/api` and its migrations 1–6. It uses **scripted DOM actions, not trusted touch input**. Root CUA handles any actual OS permission controls. Fixture-backed signed-in results do not establish the production backend's migration state.

OS notification/alarm delivery, sounds, lock-screen appearance and Stop/Snooze on a physical iPhone are **NOT RUN**. PWA/browser and hosted-backend evidence belong to the parent change's ledger, not these native results.

## Native OS permission investigation

On the QA phone, an actual system notification authorization prompt was granted using CUA. The native API subsequently reported `notification.permission = authorized`, but actual `UNUserNotificationCenter.add` rejected the request with `Repository could not save notification. Source is not authorized.` AlarmKit reported `permission = denied`; no AlarmKit authorization prompt appeared. The app retained the task/settings and displayed that alerts need attention, rather than claiming they were scheduled.

The initial harness Save timeout occurred while waiting for the system permission prompt. A manually ad-hoc signed temporary QA copy, using the correct bundle identifier, did not resolve the OS rejection. No TCC, permission database or security workaround was used. The normal Xcode Sign to Run Locally Simulator build also succeeds, but its actual add request returns the same Source is not authorized rejection with authorized status. Native OS scheduling is therefore BLOCKED on this runtime; no further permission or signing experiments were performed.

## Runtime case statuses

Phone local mode: task create/edit, class/resource create/edit, template create and Add-to-tasks revealing the unscheduled copy, note/goal/habit creation and date-specific check-in **PASS**. Those saved records survive process relaunch **PASS**. The 402px phone view has no horizontal overflow. These baseline actions ran before the final late-owner UI guard; their unchanged normal-owner paths are explicitly reused. Additional native actions are recorded individually in `runtime-results.json`, rather than inferred from compilation.

The harness includes late-night/midnight touch scheduling, template editing/deletion, task invalid-save/complete/reopen/delete, note search/edit/delete, goal progress/deletion, habit uncheck/cascade, and resource deletion. Each is a **NOT RUN** case until its matching `extended-pass` assertion appears. Desktop operating-system drag-layer behavior and real touch gesture behavior are not established by scripted DOM actions.

The preferences-only flow checks default-on switches, work→alarm→notification linked times, independent manual overrides, clearing a linked source, restoring follow behavior and relaunch persistence with delivery switched off. It uses one controlled aged-record setup to check switching an already-past manual alert off. It does not relabel disabled delivery as successful native scheduling.

## Final native outcomes

All eleven prepared iPhone modes PASS: local and signed-in baseline/persistence, linked/manual alert preferences and relaunch, extended CRUD/touch-Schedule flows, and account isolation. The final owner check waits for the restored task snapshot, verifies both native bridges reject a previous owner, ignores the stale notification-open event, and restores the original owner’s saved preferences. Historical harness selector/readiness errors are retained in raw evidence and were corrected before those passes; they are not unresolved application failures.

The extended passes establish Day/Week/Month access, midnight and 23:30 touch scheduling, template edit/Schedule/delete retaining the independent copy, task invalid-save/complete/reopen/delete, note edit/search/delete, goal progress/delete, habit uncheck/cascade, and resource deletion. They do not establish genuine pointer/touch drag-layer behavior or external resource navigation.

The one prepared iPad attempt is **BLOCKED before WK assertions**: boot completed in 59 seconds, installation took over two minutes, then `simctl launch` exceeded its 45-second timeout. No iPad feature pass is inferred, and the environment was not repeatedly restarted. Physical-device delivery remains **NOT RUN**. `ledger.json` contains the exact per-mode outcomes and remaining limits.

Both final Simulator and unsigned physical-iPhone app/widget builds succeed. All 114 landing files exactly match source in both built bundles. Native signing/team/bundle setting lines, the opaque v11 icon, `native-cloud.js` and the native Swift cloud security/Debug-loopback client match original native commit 8334d6e. Only approved feature integration and guarded native restoration were added. See `original-native-preservation.json`.
