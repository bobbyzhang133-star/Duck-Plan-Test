# DuckPlan ringing alarms for iPhone

This is a native iOS/iPadOS 26+ app, using AlarmKit for system ringing alarms.
It bundles the current DuckPlan calendar/task UI in a persistent WKWebView and
adds an origin-restricted native alarm bridge. It does not simulate ringing with
web audio or silently replace alarms with notifications.

## Implemented

- Native AlarmKit authorization with clear denied-permission feedback.
- Task alarm date/time independent of the deadline and scheduled work.
- System alarm sound, original Gentle chime, or original Bright bells.
- Stop and optional 5/10/15-minute Snooze in the system alarm presentation.
- Live Activity widget extension for snooze countdowns (required by AlarmKit).
- Device-local scheduling, stable task alarm IDs and persistent metadata.
- Edit/replacement with restoration of the previous alarm on failure.
- Cancellation on task completion/deletion, account-context change and sign-out.
- Permission refresh when returning to the app; no success message on native failure.
- The approved duck app icon; locally bundled planner works without a web deployment.

Native alarm times are absolute instants. Changing a work session does not silently
move an alarm; edit the alarm explicitly. Once scheduled, iOS handles the alarm
while DuckPlan is closed or offline. The user can revoke alarm permission at any time.

## Build and run

Requires macOS compatible with Xcode 26+, Xcode's iOS SDK and an iPhone/iPad on iOS 26+.
Xcode 26–26.3 support macOS Sequoia 15.6+; consult Apple's requirements for later releases.

The generated `DuckPlan.xcodeproj` is checked in, so XcodeGen is not needed to open it.
In Xcode, select the DuckPlan app and widget targets, set your development team,
choose a unique bundle identifier for both targets, attach your iPhone, and Run.
If Xcode shows its license or signing/account prompts, the device/account owner
must complete them. For distribution, use normal TestFlight/App Store signing.

To regenerate source assets/project after editing the build specification:

```sh
node ios/scripts/prepare.mjs
xcodegen generate --spec ios/project.yml
xcodebuild -project ios/DuckPlan.xcodeproj -scheme DuckPlan -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

The native app currently bundles the local planner. Browser/PWA storage is separate
from native app storage; existing website tasks are not automatically imported.
Remote-account/cloud-native sync and remote completion cancellation while this app
is closed are not implemented. The web version retains its separate push-notification
feature. No production cloud migration or VAPID key is required for local AlarmKit alarms.

## Mandatory physical-device verification before calling this finished

1. Allow alarm permission. Add a task with an alarm two minutes ahead.
2. Select each sound and verify an actual audible alarm with the phone locked,
   DuckPlan closed, Silent mode/Focus enabled, and Wi-Fi/cellular disabled.
3. Verify Stop and every supported Snooze duration; check the snooze Live Activity.
4. Edit an alarm: only the new time should ring. Cancel it, complete its task,
   delete its task and sign out: each must cancel the corresponding device alarm.
5. Deny/revoke permission and verify the app reports failure rather than claiming
   the alarm was scheduled. Relaunch/reboot and verify saved system alarms persist.
6. Check replacement failures, multiple alarms and task titles on the lock screen.

Current verification (November 10, 2026): Xcode 27.2 on macOS 27.2.1 successfully
compiled the app and alarm widget for both iOS Simulator and physical iPhone
using the iOS 27.2 SDK, with `CODE_SIGNING_ALLOWED=NO`. Corrected the iPad
orientation declaration found by the device build; the rebuilt device target has
no warnings or errors. All eight focused native-alarm adapter and PWA tests pass,
as do project/plist and diff checks. The owner accepted the Xcode agreement and
first-launch onboarding is complete. Simulator runtime components are downloading;
the Xcode account sign-in prompt is open and no physical device was connected at
the last check. Signed installation, native runtime behavior, audible ringing and
lock-screen/Stop/Snooze behavior still require testing and are not claimed verified.

## Apple references

- https://developer.apple.com/documentation/AlarmKit/scheduling-an-alarm-with-alarmkit
- https://developer.apple.com/videos/play/wwdc2025/230/
- https://developer.apple.com/xcode/system-requirements
