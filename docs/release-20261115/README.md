# Website and iPhone app release — November 15, 2026

The user authorized uploading the latest website to the shared main GitHub repository and updating the existing app version. The website input is `f74879969db4a0ed33d55915c45697a227e48923`, including the task pop-out crossfade, current Due/Work task cards and exact-time deadline markers. The release also updates a stale calendar-selection test fixture to provide the current date presenter and explicit date-only deadline content, and verifies that an empty band remains omitted. No application behavior changed for that test correction.

## GitHub and app sources

The website release was published as a fast-forward update of [shared main](https://github.com/m-mcnicholas/group-project-michael-bobby-priya/tree/main), preserving all newer website history. The matching native source is published separately on [`codex/ios-main-release-20261115`](https://github.com/m-mcnicholas/group-project-michael-bobby-priya/tree/codex/ios-main-release-20261115), retaining the native transport and its six bounded web overlays. The portable app branch removes personal development-team selections; the user's existing local Xcode project retains them.

The local app project is `/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-iOS/ios/DuckPlan.xcodeproj`. Its117 canonical website files plus `native-cloud.js` are synchronized. Native code, original signing configuration, icon and alarm/notification implementation match their pre-sync hashes. The app branch and website branch intentionally use different `landing/` configurations; copying one over the other without the documented sync overlays loses the native account transport.

## Verification and limitations

- **PASS:**532 website tests and537 app tests, including compiled native boundaries. The first complete run exposed the stale calendar-selection fixture; both complete suites pass after its correction.
- **PASS:**six isolated Chromium157 browser clients: desktop, phone and iPad, each in local and real signed-in localhost Worker modes. Checks cover template create/edit/Schedule/desktop drag/Add independent copy/retention/reload, task CRUD/invalid save, real503/retry, class/resources, notes, goals, habits/check-ins, deletion/cascade, navigation and layout. Browser touch emulation is labeled; it does not establish physical Safari or native touch behavior.
- **PASS:**unsigned Debug Simulator and Release generic-iPhone app/widget builds. Both built bundles match all118 native web files byte for byte. See `build-manifest.json` and the native checkout’s `native-sync.json` for exact identities and protected-file checks.
- **BLOCKED:**fresh iPhone and iPad simulator functional baseline. Both installed apps loaded actual WKWebView and reported startup with the real native bridge and loopback API. Their following native permission-status probe did not complete within180seconds; CRUD/relaunch cases were not reached. Initial simulator termination also timed out. The fresh simulator run exhausted temporary disk space. Only the two newly created test devices were removed afterwards, and collector/QA backend processes were stopped. This does not establish a product-code cause or a native feature pass. Actual reports are in `verification.json`.
- **REUSED, bounded:**the unchanged native implementation’s prior account-device-sync/OS-boundary evidence remains available. The immediately preceding website motion release’s sampled animation, interruption, focus, dark/reduced-motion and SW66 offline checks remain valid because their application inputs are unchanged. This is not a substitute for the blocked current native baseline.
- **NOT RUN:**physical-phone installation, physical alarm delivery/sound/Stop/Snooze, APNs delivery, installed-PWA release baseline, Safari and Firefox. The default Personal Team build remains foreground-only for new cross-device changes. No production server deployment, migration or account/signing change was performed by this GitHub/source upload.

All test accounts and planner records were synthetic. Your existing simulator and preview8034 were preserved. `verification.json`, the browser baseline scripts/results and test summaries provide the specific runtime/mode outcomes.

## Update the installed iPhone app

Open the existing local Xcode project, choose your connected iPhone as the run destination and click Run. Xcode installs the rebuilt app over the existing installation. A source synchronization, GitHub push or unsigned build alone does not update the installed phone. Test device-specific permissions and delivery after installation. Server-backed features additionally require the matching owner-deployed backend/schema described in `docs/account-device-sync/OWNER-ACTIVATION.md`.

Portable app export: based on native source commit `132844ec0731225b769bfcecb46f3b61ca6d44a2`. The only project-setting export difference is clearing four personal `DEVELOPMENT_TEAM` selections. The existing local Xcode checkout retains all four original selections.
