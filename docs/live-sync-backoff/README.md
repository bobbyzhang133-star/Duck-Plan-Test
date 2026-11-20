# Live-sync reconnect fix — November 17, 2026

The user authorized repairing the confirmed reconnect weakness even if it was not the cause of the reported Cloudflare “too many requests” warning. This is a local website fix on `codex/live-sync-backoff-20261117`, based on `fb865cd`. The incident's actual cause remains unconfirmed: no provider error code, time window or request analytics was supplied.

## Changed behavior

- Keep exponential retry history through brief successful handshakes. Reset only after a connection remains open for 30 seconds.
- Retry with 75–100% jitter of the 2/4/8/16/30-second ceiling, capped at 30 seconds. Devices do not all receive the same fixed retry delay.
- Start reconnect-driven full-planner catch-up at most once per 30 seconds per active watcher. Preserve the immediate first catch-up, queue a delayed catch-up on a still-open replacement connection, and cancel that delayed work when disconnected. Live row messages remain immediate; explicit refresh, writes and server reload messages retain their existing semantics.
- Ignore retired sockets and duplicate close events; cancel retry, stability, heartbeat and catch-up timers when the watcher retires on sign-out/account change. Constructor failures also back off.
- Use elapsed monotonic browser time for catch-up spacing, with a Date fallback for runtimes without performance timing.

No task representation, persistence schema, authentication endpoint, Worker/cron configuration, native bridge, artwork or layout changed. Existing snapshot/write revision guards remain intact. There is no new perpetual HTTP polling timer. Catch-up can be delayed by up to 30 seconds; unstable transports also retain retry delay. Already-open healthy sockets continue their immediate row updates.

The script URL is `planner-store.js?v=live-sync-backoff-20261117`; service-worker cache is `duckplan-app-motion-preview-v78`.

## Verification ledger

- **PASS:** 8 deterministic regressions execute the entire shipped store in a VM with injected sockets/clock. They cover flapping, jitter, stable reset/heartbeats, constructor failures, initial/missed-data catch-up, immediate rows, retired events, duplicate closes, HTTP429 snapshot failure without spinning or data loss, and sign-out cleanup. Simulated one-second flapping across a day stays below 3,700 handshake attempts and 2,900 snapshot reads at either jitter endpoint. These are isolated simulation bounds, not production measurements or quota guarantees.
- **PASS:** full Node suite, including existing Worker-handler/API, organization, personal-planning, owner-isolation, alert and native-boundary regressions. See final test summary in this checkpoint's project log. Worker tests use the repository's fake Cloudflare/D1 environment, not a deployed D1 instance.
- **PASS:** negative control against the unchanged `fb865cd` store: short-connection backoff and retired-socket isolation regressions fail. Those regressions pass with this change. No working file was reverted during that check.
- **PASS:** six isolated full-app Chromium157.0.8103.79 cases: local guest and signed-in fixtures at 1280×900,390×844 and835×1100. Real browser WebSocket open/close events were fault-injected with Playwright routing and controlled time. Five disconnects retained increasing delays; live row updates, save/complete/reopen/reload, sign-out cancellation, owner-data clearing and document overflow checks passed, with zero page exceptions. Browser API responses are synthetic fixtures, not authenticated production/backend acceptance. `runtime.js` reproduces these cases; `runtime-results.json` records the final run.
- **PASS:** real service worker in an isolated Chromium tab: v78 activated, its cached store text exactly matched the current served store, and a local task survived offline reload. This is browser/service-worker evidence, not an installed PWA launch.
- **PASS:** JavaScript syntax and final diff whitespace checks.
- **BLOCKED:** Cloudflare incident attribution and authenticated hosted Worker/D1 compatibility: exact warning/analytics and authorized test-account access are unavailable. Fresh local Wrangler/D1 acceptance was not run because Wrangler dependencies are absent. There was no production test traffic in this implementation task.
- **NOT RUN:** physical Safari/iPhone/iPad, installed PWA and native WKWebView acceptance. Neither the separate iOS bundle nor installed app was changed. No platform parity claim is made.

Initial browser harness navigation-context errors were corrected by removing page evaluation from API interception; the final isolated run completed cleanly. All owned test contexts were closed; the user's existing local preview and data were preserved.

## Release boundary

Local preview: http://127.0.0.1:8034/#calendar. A TEST feature-branch backup is not a public release. The production site was previously observed serving cachev13; this task does not update it or the installed iPhone app. Apply the existing release/platform procedure and owner deployment handoff before publishing. No shared-main merge, remote migration, account/security/billing change or production deployment was performed.
