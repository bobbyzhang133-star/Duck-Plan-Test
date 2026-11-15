# DuckPlan ringing alarms for iPhone

This is a native iOS/iPadOS 26+ app, using AlarmKit for system ringing alarms.
It bundles the current DuckPlan calendar/task UI in a persistent WKWebView and
adds an origin-restricted native alarm bridge. It does not simulate ringing with
web audio or silently replace alarms with notifications.

## Implemented

- Native AlarmKit authorization with clear denied-permission feedback.
- Separate ringing-alarm and normal-notification switches, both on by default.
- Alarm time follows scheduled work; normal notification time follows the alarm until each is customized. Deadlines stay independent.
- System alarm sound, original Gentle chime, or original Bright bells.
- Stop and optional 5/10/15-minute Snooze in the system alarm presentation.
- Live Activity widget extension for snooze countdowns (required by AlarmKit).
- Device-local scheduling, stable task alarm IDs and persistent metadata.
- Edit/replacement with restoration of the previous alarm on failure.
- Cancellation on task completion/deletion, account-context change and sign-out.
- Permission refresh when returning to the app; no success message on native failure.
- The approved duck app icon; locally bundled planner works without a web deployment.

Scheduled native requests use absolute instants. While their follow links are active, changing the work start updates the alarm and its linked normal notification. A manually chosen time stays fixed until the user restores its follow link. Once scheduled, iOS handles requests while DuckPlan is closed or offline. AlarmKit and normal-notification permissions are independent and can be revoked in Settings.

## Cross-device settings

The compatible account backend shares alarm/notification preferences, logged minutes and reminder choices. The default free Personal Team build refreshes these while the app is open. Receiving new changes while closed needs the separate push-enabled configuration, compatible provisioning and activated APNs server; iOS controls delivery. See the [implementation and verification record](../docs/account-device-sync/README.md) and [owner activation guide](../docs/account-device-sync/OWNER-ACTIVATION.md). Source synchronization or a successful build does not update an installed phone.

## Duck alarm appearance

- System alerts use duck-yellow accents and a dark Snooze label for contrast.
- Snooze Live Activities use a warm cream card with the task centered, plus yellow
  accents in the Dynamic Island. iOS retains control of the actual system alert layout.
- While the app is active, actual AlarmKit `alerting` updates present a centered
  task card over a blurred planner. The card uses the bundled duck mascot and
  provides Stop and the task's configured Snooze duration via AlarmManager.
- Stopping an alarm does not mark its task completed. Multiple ringing tasks are
  shown in order; handling one reveals the next. Failed actions keep controls visible.
- The card scrolls for long titles, landscape and larger text; Reduce Transparency
  replaces the blur with an opaque cream background.

For a silent visual preview in a Debug simulator build, launch with
`-duckplan-alarm-preview`. This never schedules an alarm or changes saved tasks.
Use `-duckplan-alarm-no-snooze` to inspect the Stop-only layout. The optional
`DUCKPLAN_ALARM_PREVIEW_TITLE` environment variable supplies a long sample title.
These preview controls are excluded from physical-device and Release builds.
Existing scheduled system alarms retain their saved appearance; edit and save an
alarm again to apply the new tint. Rebuild and run on the iPhone to install changes.

Theme verification (November 11, 2026): the app and widget compile in Debug for
iPhone 17 Simulator and Release for generic iOS, with signing disabled. The four
native-alarm adapter tests and project/diff checks pass. Silent simulator previews
were inspected for the centered card, a long task title, and the Stop-only card
at the largest accessibility text size. These previews do not
verify real AlarmKit delivery, sound, system-alert appearance, or Stop/Snooze on a
physical device; exercise those on the iPhone after installing this build.

## Build and run

The test-repository version prepared on November 12, 2026 includes the latest
Calendar homepage, Sigma mascot poses, sideways Daily progress duck, phone/iPad
layout fixes and native alarm appearance changes. The Xcode project bundles this
checkout's `landing/` folder directly. Personal development-team settings remain
local to the existing iPhone project and are not included in the test upload.

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
Xcode sign-in is confirmed with a free Personal Team (zero provisioned devices),
and no physical device was connected at the last check. The project is open in
Xcode. Signed installation, native runtime behavior, audible ringing and
lock-screen/Stop/Snooze behavior still require testing and are not claimed verified.

## Apple references

- https://developer.apple.com/documentation/AlarmKit/scheduling-an-alarm-with-alarmkit
- https://developer.apple.com/videos/play/wwdc2025/230/
- https://developer.apple.com/xcode/system-requirements

## Separate message notifications

The native app now exposes a second device-local channel through `DuckNativeNotifications`, independent of AlarmKit's permission, ringing, Stop and Snooze. It uses Apple's [User Notifications scheduling API](https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app) and a launch-installed [notification-center delegate](https://developer.apple.com/documentation/usernotifications/unusernotificationcenterdelegate) for foreground banners/sound and task taps. Time defaults and on/off controls belong to the bundled web coordinator; this native source addition alone does not update the installed app or enable notifications.

The bundled main frame may call `request({action, ...})`. Supported actions are `status`/`authorize` → `{permission}`, `list` → `{notifications:[{item_id,title,fire_at,time_zone}]}`, `context` with `{scope,activeTaskIDs}`, `schedule` with `{scope?,taskID,title,fireAt}` → `{notification}`, `cancel` with `{scope?,taskID}` and `cancelAll` with `{scope?}`. `fireAt`/`fire_at` are milliseconds since the epoch. New callers should supply `scope` on operations; mismatched owners are rejected. Notifications use stable scoped task identifiers. Same-identifier replacement does not cancel the previous pending request before adding its replacement, so a failed add retains the previous request. Completing/deleting tasks or changing accounts cancels this channel's pending/delivered requests.

A tap waits for a confirmed matching planner context and active task, then dispatches `duckplan:notification-open` with `{taskId,scope}`. The bundled JavaScript must also check the scope when consuming that event. Native cloud cookies and destination restrictions stay in their existing protected transport. Both notification and alarm saves capture and revalidate scope/active task ownership across authorization or scheduling waits.

Run `node ios/scripts/test-notification-boundary.mjs` for 12 compiled Swift boundary scenarios using a fake notification center and in-memory persistence—no device requests or user defaults are changed. These cover replacement failure, relaunch/recovery, task/owner cancellation, permission/add races, queued taps, denied/invalid requests, channel-only cancellation and account changes during a prior alarm’s restoration. The simulator build verifies app/widget compilation. Actual WKWebView action/persistence checks and physical permission/delivery/lock-screen/sound checks remain separate acceptance gates.
