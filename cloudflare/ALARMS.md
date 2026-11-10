# Task alarm activation

## Product distinction: notifications versus Clock-style alarms

The current web implementation delivers scheduled notifications. The user clarified
that the requested alarm means Apple Clock behavior: a system alarm presentation,
ringing sound, Stop/Snooze, and delivery while the app is closed. Do not describe
the current push implementation as that native alarm feature.

Apple's AlarmKit (iOS/iPadOS 26+) is the native implementation path. It supports
user-authorized alarms that break through Silent mode and Focus, alarm titles,
stop/snooze, and custom bundled sounds. The native implementation is now in `ios/`:
AlarmManager scheduling, task-based IDs, completion/deletion cancellation,
permission feedback, sound selection and an ActivityKit snooze widget extension.
See `ios/README.md` for build steps, scope and the physical-device test checklist.
The web planner continues using push notifications as a separate delivery option.

Reference: https://developer.apple.com/documentation/AlarmKit/scheduling-an-alarm-with-alarmkit
and https://developer.apple.com/videos/play/wwdc2025/230/ . The current machine
still has Command Line Tools only (no iPhone SDK). Native compilation, signing,
installation and physical-device alarm testing remain pending; generated project
and JavaScript tests do not establish that iPhone ringing works.

The task editor saves an absolute alarm instant plus its IANA time zone. Editing
an alarm replaces its delivery receipts. Completion and deletion suppress dispatch.
Each opted-in device receives its own delivery. The scheduler checks every minute;
this is a device notification, not an exact-time full-screen alarm or silent-mode override.

## Production owner steps

1. Generate an ECDSA P-256 key pair with Web Crypto. Export the public key in
   uncompressed raw form, base64url encoded (`VAPID_PUBLIC_KEY`), and export the
   private key as a JSON Web Key (`VAPID_PRIVATE_JWK`). Keep the same pair across deployments.
2. Set these via Wrangler secrets on the owning Cloudflare account:
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_JWK`, `VAPID_SUBJECT` (a maintained `mailto:` contact).
   Do not commit keys or paste the private key into chat. Rotate only with device re-enrollment.
3. Apply migration 0003 to the intended environment, then deploy the approved branch.
   Production: `npx wrangler d1 migrations apply duckplan-prod --remote --env production`
   and `npm run deploy:prod`. This needs explicit publication approval and the D1 owner.
4. Sign in on an HTTPS deployment. On iPhone, install on the Home Screen first.
   In Settings → Task alarms, enable each device. Create a task with an alarm
   a few minutes ahead; close DuckPlan and verify the task name appears on the
   device screen. Tap it and verify the task is selected. Repeat with the device
   locked, and check completion, deletion, rescheduling and device disable.

## Delivery behavior

The server sends a payload-free RFC 8030 push authenticated with RFC 8292 VAPID.
On wake, the service worker fetches the task text using the user's same-origin
session and device endpoint, then displays a system notification. This avoids
shipping task names to the push provider. An expired session or failed fetch
shows a generic “Open DuckPlan” alert instead of private task details.

Dispatch claims expire after two minutes for retry. A push-service acceptance
is recorded separately from service-worker display submission. Neither confirms
that a user saw the notification. Offline pushes expire after 15 minutes; old
alarms are not replayed indefinitely. OS focus/silent settings may suppress sound
or presentation. Sign-out disables this browser's subscription first.

Known capacity: 100 due alarm/device pairs per minute per Worker dispatch.
Web Push requires connectivity and browser/OS support. Physical-device delivery
must be verified after activation; automated tests exercise the scheduler and
API but do not prove Apple/Google/Mozilla acceptance or lock-screen presentation.
