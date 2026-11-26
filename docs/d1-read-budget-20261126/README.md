# D1 row-read exhaustion: diagnosis and local correction

Prepared November 26, 2026. Website source: `d23fb66` plus the changes in this checkpoint; cache 159. Canonical checkout: DuckPlan-original-duck-preview. Public remains cache 153; this report does not claim a deployment. Native stays at its previous release checkpoint.

## Production observations (read-only)

The warning is the account-wide D1 rows-read allowance, not a user or request count. A query returning 10,000 tasks can scan about 20,000 rows, including indexed lookups. An index alone cannot make a complete 10,000-row response cheap.

Wrangler Query Insights, requested November 26:

- Seven-day account-wide insights: DuckPlan's full item SELECT ran 496 times and accounted for 4,725,850 reported row reads. The leading other database query in the returned top 20 accounted for 4,238. DuckPlan dominates the returned expensive-query samples.
- Latest 24h DuckPlan insights: 32 full item SELECTs accounted for 698,132 reported reads, averaging 21,816 per query. Axis's existing-item SELECT added 51,544 reads across 5 runs; its missing-marker UPDATE added 45,764 across 4 runs.
- Alarm cleanup was 1,322 reads across 1,465 runs in the 24h result. Session/authentication and class reads were also small relative to the task snapshots. WebSocket pings and the foreground work-alert timer do not query D1.
- Query Insights is sampled/estimated. These rolling-window numbers identify the expensive path; they do not reconstruct the email's exact UTC daily 5 million total. The screenshot's reset time is not proof the current window is exhausted. No production planner rows were read for disposable QA or modified during this investigation.

Sources: [Cloudflare metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/), [find expensive queries](https://developers.cloudflare.com/d1/observability/find-expensive-queries/), [indexes](https://developers.cloudflare.com/d1/best-practices/use-indexes/). `query-insights-summary.json` preserves the returned aggregate measurements without bound parameters or task contents.

## Read amplification in the old version

1. `/api/planner` always selects every active task and the other planner collections. Initial activation, WebSocket catch-up, focus/visibility refresh, reconnect and reload messages all reach that endpoint.
2. Axis UID regeneration grew the same account's task list with repeated assignments. The already-prepared identity correction in `aace1fe`/migration 0011 stops further copies; it has not been deployed. Existing duplicate tasks are preserved.
3. Bulk completion broadcasts a full reload for each 200-task chunk. A second open client can repeatedly download the whole growing list. The initiating client's coalescing does not protect other tabs.
4. Axis previously broadcast a reload even when an import changed nothing.

## Changes prepared

- Migration 0012 creates one owner-scoped version row, backfills existing users and installs INSERT/UPDATE/DELETE triggers covering all 9 planner collections. Old API writers, Axis and cascades invalidate the version. Item revision triggers increment it once per item update. Failed transactions roll back their version changes. User deletion does not resurrect the version row.
- The client sends its last **accepted** snapshot version. If unchanged, the API reads just the small version row and returns a no-store, owner-authenticated response. No collections are scanned or recopied and the interface is not redrawn. Versions are held in the current backend instance, never shared between owners or persisted as application data.
- Full snapshots compare versions before/after reading collections. An interleaved write returns no cacheable version. A snapshot discarded because of an intervening edit never advances the client's token. Gaps in live messages and pending writes still use authoritative revalidation.
- Bulk completion broadcasts compact IDs/revisions. Updated clients patch only known consecutive revisions, preserving notes/schedule/alerts and ignoring stale duplicates. Missing tasks or revision gaps reload safely. The `reload:true` fallback remains for older clients.
- Axis sends reload broadcasts only for actual planner changes, rather than unchanged imports.
- Retries of cached template adoption still run on unchanged responses. Successful adoption invalidates the token so a removed device overlay cannot resurrect a remotely deleted template. Older servers without version support retain the existing full-response fallback.
- Client cache 159 and a new planner-store asset key make the updated script available on the next authorized release.

The counter adds bounded database work/writes to real mutations. This trades a small per-change cost for eliminating repeated whole-planner scans. Initial loads, changed snapshots, imports and old clients still incur reads. This is not a guarantee against every future quota issue; monitor daily reads/writes after rollout. Future changes to snapshot capabilities must bump the version-format prefix.

## Local real D1 measurement

Isolated loopback Wrangler/workerd, real local D1, migrations0001–0008 and 0010–0012, 10,000 synthetic tasks. No production account/session or data was used. Wrangler 4.157.0; Chromium 158.0.8127.38. Measurements include API authentication.

| Request | D1 rows read | JSON bytes |
| --- | ---: | ---: |
| Full planner snapshot |20,011|5,719,220|
| Unchanged version check |3|79|
|50 unchanged checks combined |150|3,950|

Per-query D1 `meta.rows_read` was available for every measured query. Editing a task then checking the old token returned all10,000 records with the correct new completion state and a changed token. More than 99.9% of row reads are avoided for unchanged refreshes. Initial/changed snapshot cost is intentionally not represented as 3 reads.

## Verification

- **PASS:** 690 automated tests against a clean source stage with only owned changes. This excludes the unrelated `http.js` and untracked0009 OAuth drafts. Regression cases cover 10,000 tasks / 50 checks, all collection mutations, old writers, rollback, migration backfill, owner isolation/cascade, interleaved database writes, rejected-snapshot acknowledgement races, newer edits versus stale completion messages, revision gaps, device adoption and 28 rotating Axis feed UIDs without new copies/reloads.
- **PASS:** Full browser baseline in local-storage and real local signed-in modes at 1280×900,390×844 and835×1112. Tasks, classes/resources, template create/edit/Schedule/copy/desktop drag, note/goal/habit/check-in persistence, failure/retry, live peers and deletion/cascade assertions pass.
- **PASS:** Affected signed-in checks at 320×568,390×844,844×390,835×1112 and1280×900. Ten unchanged refreshes per viewport retain the open details dialog/focus. A second client completes/reopens a task without an extra planner GET for compact completion; reload confirms durable state. Touch is emulated on phone/iPad sizes. Screenshots show wrapped long titles, reachable scrolling actions, visible bottom navigation and no horizontal overflow. Opening and closing were exercised. Initial browser harness failed by dereferencing a dialog already removed after closing; corrected its null check and reran all 5 cases successfully.
- **PASS:** Local deployment dry-run: 135 assets; Worker 130.44KiB, 31.71KiB gzip. No deploy was performed.
- **NOT RUN:** Physical Safari, installed PWA, on-screen keyboard, native WKWebView/device alarms and production signed-in behavior with this new schema. Native synchronization remains gated by the user's release instruction. Browser results do not establish native/physical-device parity.

Evidence: tests.log, dry-run.log, read-probe-results.json, baseline-{local,cloud}-results.json, browser-results.json and associated screenshots/scripts. Read-probe and QA bindings are isolated localhost-only harnesses; they are not the production entrypoint.

## Reviewed rollout still required

The public website still uses the old client/backend. Prepare the latest website release including the pending Axis duplicate-prevention and large-list fixes; apply only additive migrations 0011 and0012, then deploy the clean website/Worker. Migration 0012 must precede the new API. Exclude unrelated OAuth drafts, docs/QA bindings and native assets. Verify production capability/version checks after activation. Refresh older browser tabs after rollout; the frozen native copy remains a legacy client and can still request full snapshots.

Do not delete the existing duplicates as part of this rollout. A separate reviewed cleanup would need to retain independently edited assignments, work/alert preferences, notes, relationships and user data. No billing upgrade or production cleanup was performed.

Public deployment and remote migrations remain pending explicit user approval under AGENTS.md: “Local implementation and preview do not authorize public deployment.”
