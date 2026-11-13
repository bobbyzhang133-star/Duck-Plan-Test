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

The native app bundles the planner and supports DuckPlan email/password accounts
under **More → Settings → Account**. Sign in with the same DuckPlan account as the
website to load its tasks. Apple/Xcode sign-in is separate. Google redirect sign-in
is not offered inside the bundled app.

The bundled main frame uses an endpoint-restricted native URLSession bridge to
`https://duckplan.duckplan-cloudflare.workers.dev/api`. Session cookies stay in native
cookie storage and are not returned to JavaScript. No server CORS relaxation or
public deployment is required. The local planner remains available without sign-in;
copying its tasks into an account requires the existing explicit Import action.

Native account data refreshes on returning to the app and every 30 seconds while
foregrounded. Browser/PWA local storage is separate from native local storage.
Ringing alarms stay device-local: signing in does not copy website notifications
into AlarmKit alarms. Remote task completion can cancel alarms after the app next
refreshes, but cannot cancel them while the app is closed. The web version retains
its separate push-notification feature. No VAPID key is required for local AlarmKit alarms.

For isolated simulator testing only, Debug builds accept
`DUCKPLAN_NATIVE_API_URL=http://127.0.0.1:8792/api`. The port may vary; only that
loopback host and `/api` path are accepted. Physical-device and Release builds
ignore this override and use the production HTTPS endpoint. Native destination,
method, body and redirect boundaries can be tested without network calls using:

```sh
node ios/scripts/test-cloud-boundary.mjs
```

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
