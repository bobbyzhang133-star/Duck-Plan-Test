# Latest website sync — November 13, 2026

Synced the existing iPhone checkout from the canonical website release at `ad784be952a80dc39c9d029da185fb65e1e8145d` (`DuckPlan-main-release-20261113`). Work is on `codex/ios-latest-site-20261113`, based on the clean native checkpoint `f9a7246`. The later full-page carousel proposal remains unimplemented, as requested.

The final update includes the merged Calendar dark-mode rules, the `release-dark-mode-20261113` stylesheet key and service-worker cache v36, with shared template/calendar colors retained.

The phone contains all 104 canonical web files. Of those, 98 are byte-identical; six retain the existing native account integration:

- `cloud-config.js`: enables the injected native transport.
- `index.html`: loads `native-cloud.js` before configuration and store startup.
- `app.js`: disables browser WebSockets in native mode and refreshes account data every 30 seconds while foregrounded.
- `planner-store.js`: hides and rejects browser Google redirect sign-in in native mode.
- `app-install.js`: retains the native account/alarm explanation.
- `service-worker.js`: includes the native transport in the shell list; native builds still do not register a service worker.

The additional `native-cloud.js` remains byte-identical to the previous phone checkpoint. No canonical files are missing. The native configuration/transport and every existing native/backend/documentation/MJS-test file recorded before the sync remain unchanged.

## Verification

- All **244 frontend/native transport tests pass**: 32 matching canonical frontend CJS files, a new synthetic native feature-transport test, and the retained native-cloud MJS tests. The two newer backend-specific CJS suites remain in the canonical website checkout; no backend or MJS test files were copied or changed.
- The synthetic native transport test exercises classes, templates, resources, matrix preferences, goals, habits, check-ins and notes through the actual frontend store/transport, without external requests. Native Google sign-in remains disabled.
- Compiled native boundary checks pass for destination, scheme, port, userinfo, fragment, API path, OAuth/live exclusion, methods, body limits and redirects.
- Unsigned generic-iPhone Debug build succeeds using the checked-in project. Every one of the **105 bundled `landing/` files** matches this checkout's source byte-for-byte.
- All **22 files under `ios/`** match the pre-sync SHA256 baseline, including native alarm code, project/signing, plists, widget, sounds and icon. `git diff --exit-code -- ios` passes.
- The native icon and approved v11 master retain SHA256 `7714bd8afc68d05399841291712d57cfcb62ad729eec3cd58e570670156501f5`.
- JavaScript syntax and diff checks pass.

Commands run from this checkout:

```sh
node --test tests/*.test.cjs tests/native-cloud.test.mjs
node ios/scripts/test-cloud-boundary.mjs
xcodebuild -project ios/DuckPlan.xcodeproj -scheme DuckPlan -configuration Debug -destination 'generic/platform=iOS' -derivedDataPath /private/tmp/DuckPlanLatestSite20261113Build CODE_SIGNING_ALLOWED=NO build
git diff --exit-code -- ios
```

Logs: `/private/tmp/duckplan-ios-latest-web-tests.log`, `/private/tmp/duckplan-ios-latest-boundary.log`, `/private/tmp/duckplan-ios-latest-build.log`. The native/backend preservation baseline is `/private/tmp/duckplan-ios-latest-native-before.json`.

No Xcode project regeneration, public deployment, database migration, simulator/phone installation or physical AlarmKit test was performed. The sync has been reviewed and is ready in the iPhone backup branch. Installing it on the iPhone remains a separate Xcode Run step.
