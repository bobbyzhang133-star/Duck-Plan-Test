# Native build verification — November 15, 2026

All three unsigned app-and-widget builds passed against the synchronized working tree in `/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-iOS`, branch `codex/ios-cross-device-sync-20261115`. Each bundle contains the same 118 web files, matching the native checkout byte for byte. Source files stayed unchanged during these checks.

The [configuration manifest](native-build-configurations.json) records exact command arguments, resolved Xcode settings, source and executable hashes, build-log hashes, bundle flags and widget identity. The separate [default Simulator manifest](native-build-manifest.json) identifies the preserved QA candidate.

## Configuration results

- Default Release, generic iOS: **PASS**. `DuckPlanBackgroundSyncEnabled=NO`, API environment `production`, and `CODE_SIGN_ENTITLEMENTS` is empty. Existing signing-team selections are preserved.
- Optional push Debug, arm64 Simulator: **PASS**. `DuckPlanBackgroundSyncEnabled=YES`, API environment `sandbox`, configured entitlement `development` through `App/DuckPlan.entitlements`.
- Optional push Release, generic iOS: **PASS**. `DuckPlanBackgroundSyncEnabled=YES`, API environment `production`, configured entitlement `production` through `App/DuckPlan.entitlements`.

The user's free Personal Team remains on the default configuration. The optional xcconfigs are explicit opt-ins for a future eligible signing setup and backend activation. Every command below disables signing; these results verify compilation and configuration, **not signed APNs entitlements, provisioning, registration or delivery**. Apple documents that [available capabilities depend on program membership](https://developer.apple.com/help/account/capabilities/capabilities-overview).

The preserved default Simulator executable remains:

```text
c53d4e93402fcd0b81b657664b8ae6e5ed38b099636273faeb63fa82158d89a2
```

## Exact build commands

Working directory: `/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-iOS`.

```sh
xcodebuild -project ios/DuckPlan.xcodeproj -scheme DuckPlan -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath /private/tmp/duckplan-native-sync-default-release-device -jobs 2 ARCHS=arm64 ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build

xcodebuild -project ios/DuckPlan.xcodeproj -scheme DuckPlan -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /private/tmp/duckplan-native-sync-push-debug-simulator -jobs 2 -xcconfig ios/Config/Push-Debug.xcconfig ARCHS=arm64 ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build

xcodebuild -project ios/DuckPlan.xcodeproj -scheme DuckPlan -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath /private/tmp/duckplan-native-sync-push-release-device -jobs 2 -xcconfig ios/Config/Push-Release.xcconfig ARCHS=arm64 ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
```

Full logs are at each derived-data path plus `.log`. Resolved settings are at the same path plus `-settings.json`; their exact read commands are in the manifest. Builds ran sequentially with two jobs outside the filesystem sandbox so Xcode's compiler services could run. No device was installed by this audit, and the existing user Simulator was untouched.

## Runtime boundaries

Build success does not establish feature parity or physical alarm delivery. The coordinated runtime ledger and native QA evidence are separate from this build record. No Apple portal, provisioning profile, production migration, APNs key or public deployment was changed here.

Snapshot ACK means the authenticated planner snapshot was consumed, including when an OS channel reports that it needs attention. Foreground/manual refresh retries native reconciliation even for unchanged snapshots. There is no dedicated closed-app OS-registration retry after that ACK; a transient failure can remain pending until another planner change or the next foreground/manual refresh.

Background updates remain best effort: Apple may delay or discard them, and force-quitting prevents the ordinary automatic wake path. The default build's foreground synchronization and already scheduled local alerts remain separate from APNs. [Apple background-update documentation](https://developer.apple.com/documentation/usernotifications/pushing-background-updates-to-your-app)
