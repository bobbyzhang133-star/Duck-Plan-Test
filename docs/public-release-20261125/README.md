# DuckPlan public release · November 25, 2026

The approved website source `edd60c4` is live at [DuckPlan](https://duckplan-latest.ocs-learning.workers.dev/#calendar), cache153, Worker version `3633265e-9405-470a-925c-a84f66f8c0d0`. Rollback: `cb22f5ca-f4f3-4803-9f3c-23bfdb9d3826`. Six assets uploaded;123.79KiB Worker/30.04KiB gzip. Existing D1 bindings, cron triggers, variables, Google/GitHub IDs and secrets were preserved with keep_vars. No database migration or billing change was needed. The unrelated HTTP and0009 OAuth drafts were excluded using a clean committed export.

The release includes batched overdue completion: one local task-array save/final render; owner-scoped signed-in batches capped at200rows; revision/deadline guards; partial-save retry and account-switch handling; bounded section/surface motion. The10000-task capacity test passed completion/persistence, but phone emulation still had a noticeable pause. See `../bulk-overdue-10000-20261125` for limits; this release does not claim that every large planner is instant or battery-free.

## Verified website evidence

- Clean-source automated suite:665/665 PASS, `web-tests.log`.
- Release dry run and provider deployment passed: `dry-run.log`, `deploy.log`.
- Playwright MCP Chromium158.0.8127.38 public guest checks passed320×568,390×844,844×390 landscape,835×1112 iPad and1280×900 desktop. Mouse/emulated touch completed19overdue tasks, retained the future task, verified saved state/reload and cleaned up closing motion without page errors/overflow. `live-smoke-results.json`, `live-*.png`. Screenshots were visually inspected, including the scrolled phone sheet beneath its sticky toolbar and separate bottom navigation.
- Public password/Google/GitHub readiness all true. Six published client asset hashes exactly match the approved source. This is provider readiness, not a new completed OAuth round trip.
- Offline browser-tab reload came from service worker cache153 and retained a new isolated guest task: `offline-result.json`. Standalone installed PWA and physical Safari are NOT RUN.
- Full local/signed-in desktop,phone,iPad browser baselines,250-row real local Worker/D1 partial failure/retry/live-peer tests, and10,000-task local checks reuse exact-source evidence in `../bulk-overdue-performance-20261124` and `../bulk-overdue-10000-20261125`. Runtime assets have not changed since those checks; live hashes establish the deployed client identity. This is not a production-account mutation pass. No production account was used as a fixture.

## Existing iPhone/iPad app

“Publish to public” explicitly opened the mobile release gate. The existing `DuckPlan-iOS/ios/DuckPlan.xcodeproj` now has the approved web source with its bounded native overlays. Native alarm/notification/sync source, signing settings, production API and approved icon are protected by unchanged before/after hashes. The native copy's preexisting invalid `duck-theme.csswx3` service-worker reference was backed up and replaced by the approved cache manifest; the backup remains in native release documentation.

Both Xcode27.2 Debug builds (iOS27.2 simulator and generic iOS device) passed unsigned. All133 landing files match the native source in both built products, and both include the alarm widget. A verified temporary source copy avoids the earlier Documents file-coordination stalls. The native app retains email/password login; Google/GitHub browser redirects are disabled in its restricted file-based shell, while both remain enabled on the public website.

All16 required native modes passed (8iPhone,8iPad), using real simulator WKWebViews with scripted DOM actions and isolated signed-in/local accounts. The first iPad save stalled beyond the runner allowance; warmed reruns passed, but first-launch latency on a physical iPad remains unverified. Native runtime evidence and remaining platform limits are finalized in the matching native checkout's `docs/public-release-20261125/README.md` and `runtime-summary.json`. An actual simulator WKWebView pass is distinct from a physical device, trusted touch or delivered alarm. No physical phone was updated or erased. No GitHub main or portable app-branch upload was included.
