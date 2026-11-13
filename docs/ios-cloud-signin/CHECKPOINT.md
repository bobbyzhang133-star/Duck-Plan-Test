# iPhone sign-in checkpoint — November 12, 2026

**Resumed and completed November 13, 2026.** See [verification and remaining physical-device step](README.md). The pending items below describe the earlier stopping point, not the final verification status.

Stopped at the user's request. Work is saved locally in `DuckPlan-iOS`, on the existing `codex/account-profile-name` checkout. It is not ready to call fully verified or installed on the physical phone.

## Implemented

- Bundled main-frame-only `duckCloud` message handler and a native URLSession client in `ios/App/PlannerWebView.swift`.
- Production endpoint is `https://duckplan.duckplan-cloudflare.workers.dev/api`. Only same-endpoint API requests and supported methods are allowed. Redirects are rejected; no session cookies/response headers are returned to JavaScript. HTTPS/certificate checks and the public Worker's origin policy remain unchanged.
- Debug simulator builds alone accept a `DUCKPLAN_NATIVE_API_URL` environment override restricted to HTTP `127.0.0.1` with path `/api`, for isolated testing. Physical-device and Release builds use production.
- `landing/native-cloud.js` adapts existing JSON fetch calls to the native transport. `cloud-config.js` enables accounts only when the injected native bridge exists; ordinary static browser copies remain local-only.
- Native foreground refresh replaces browser WebSockets at 30-second intervals; visibility restoration uses the existing store refresh. Email/password sign-in and account actions use the existing backend. Google redirect sign-in is hidden/rejected for native builds.
- New transport regression tests, cache-shell inclusion, and updated app Settings copy. Existing local task import remains an explicit user choice.

## Verified

- All **219 Node tests passed**, including native transport + real Worker/SQLite sign-up, wrong-password rejection, sign-in, task persistence, session restoration and sign-out. This automated test uses a simulated native transport; actual URLSession was additionally exercised below.
- Unsigned Debug generic iPhone build succeeded at `/private/tmp/DuckPlanNativeCloudBuild`; unsigned Debug simulator build succeeded at `/private/tmp/DuckPlanNativeCloudSimBuild`. Neither logged warnings/errors.
- Installed/launched the simulator build on iPhone 18 Pro (`E8481E77-386B-4C54-BE35-BC1293ECE255`) against an isolated local Wrangler database at port 8792. Actual simulator sign-in succeeded using the repository's fictional seeded demo account. Settings visibly showed **Demo Duck / demo@duckplan.test** and cloud syncing. Worker logs confirm sign-in 200, planner 200 and Axis status 200 through native URLSession.
- The existing native app, alarm store, widget, metadata, Info.plists, Xcode project/signing configuration and approved v11 icon match their pre-task hashes. Only PlannerWebView.swift was changed in native source.
- The production anonymous `/api/session` endpoint returns password sign-in enabled and Google disabled. No production credentials/account/data were used or changed.

## Resume here

1. The simulator app was terminated/relaunched to test session persistence, but its post-relaunch identity was **not inspected** before stopping. Recheck this; do not claim it passed yet. Also verify sign-out in the actual simulator and a task save (automated Worker tests already cover those).
2. `cloud-config.js` was adjusted after the initial build and `app-install.js` copy was updated afterward. **Rebuild both targets and compare all bundled landing files to source** before telling the user to Run on their phone. Initial successful builds do not establish byte-for-byte verification of the final source.
3. Re-run relevant tests after any changes, syntax/diff checks, and inspect the final transport implementation. Add/execute native boundary tests for foreign URL/redirect rejection if needed.
4. Native cookies use URLSession's shared HTTPCookieStorage. Validate retention after process relaunch (and sign-out clearing). Do not expose cookies to JavaScript or loosen server CORS to work around a failure.
5. Physical-device installation/sign-in remains pending. Use the existing Xcode project and signing, not a new app or bundle identity. Native AlarmKit behavior was preserved but no ringing test was performed in this task.

## Local state and logs

- Isolated test database: `/private/tmp/duckplan-native-cloud-fixture` (migrations and repository seed only; no hosted changes).
- Tests: `/private/tmp/duckplan-native-cloud-all-tests.log` and `duckplan-native-cloud-tests.log`.
- Build logs: `/private/tmp/duckplan-native-cloud-build.log` and `duckplan-native-cloud-simulator-build.log`.
- Startup diagnostic: `/private/tmp/duckplan-native-cloud-runtime.log`.
- Before-task preservation hashes: `/private/tmp/duckplan-cloud-preserved.sha256`.
- This checkout already contained numerous uncommitted layout/artwork/native-alarm changes before this task. Preserve them; do not reset or commit them as though they were authored for sign-in. No implementation commit/push, main merge, public deployment, remote migration or phone installation was performed.
