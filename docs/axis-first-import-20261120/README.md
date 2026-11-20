# Axis overdue completion on first connection

User confirmed November20,2026: **first connection only**, rather than every sync.

## Behavior and safeguards

The first successful Axis import marks only newly inserted, already-overdue assignments complete. Date-only tasks due today remain open for their entire local due day. Timed deadlines use the account IANA zone and existing DST resolver; equality is not overdue. Invalid dates/zones remain open conservatively.

Existing imported/manual/deleted/completed tasks are not bulk changed. Reopened work keeps its chosen status. Later manual/cron syncs and reconnects leave newly appearing overdue assignments open. A successful empty import consumes the first-import behavior; a failed transaction does not. Existing Axis rows also protect older accounts whose historical run log is absent.

The completion update targets freshly generated IDs and the signed-in owner, inside the same D1 transaction as the import. Its successful-run guard is evaluated inside that transaction, so concurrent initial imports cannot both consume the behavior. `completed_at` and update timestamps are set normally; device refreshes see the saved completion status. No schema migration or new polling is required.

The API returns `autoCompleted`. Real D1 testing found that `meta.changes` counted revision/native-sync triggers (6 changes for2 completed rows). The corrected query uses `RETURNING id` and counts returned assignment rows. A regression test deliberately inflates D1 metadata to preserve this distinction. The Connect/Sync toast reports the actual count; older servers without that response field retain their original notice. The connect form explains the first-import behavior.

## Scope and versions

Website baseline `7ca5240` on branch `codex/axis-first-import-completion-20261120`. Native baseline `8951ee6` on branch `codex/native-axis-first-import-20261120`. Cache v96 and app script key `axis-first-import-20261120` contain only the new connection explanation/notice; the backend contains the completion rule.

The native checkout receives a bounded patch of affected files, preserving its six web overlays, native providers, API default, icon, sounds and local signing. `native-bounded-patch.json` records protected hashes. The successful simulator build contains119 matching landing files (`native-built-manifest.json`). This source preparation does not install a physical phone app.

## Verification

PASS:584 complete website Node tests and589 native-checkout Node tests, including9 new import/deadline/transaction/concurrency cases. PASS:unsigned native app/widget simulator build and production-profile Worker dry-run.

PASS — real local Worker/D1/DO with all8 migrations and a controlled synthetic upstream: desktop1280, phone390 and iPad835 Chromium layouts. Connect failure writes no tasks; first success imports4/completes2; Done displays them; manual reopening persists across reload; later sync adds1 overdue task open; reconnect does not repeat completion; no page errors/overflow. See `browser-results.json` and screenshots. Touch emulation does not establish physical Safari behavior.

PASS:actual iPhone/iPad iOS27.2 WKWebViews each pass first connection/Done/manual reopening and relaunch/later sync/reconnect. Both reach the real local API using URLSession, import4/complete2, preserve due-today/future work, and leave later new overdue work open. `runtime-summary.json` and the native JSONL files record these4 runs; installed QA native code and all119 production web files match the build (`installed-qa-verification.json`). The QA app uses a separate bundle ID (`com.duckplan.axisqa20261120`) and only test-script injection; its unmodified native transport reaches the isolated real local API through the existing Debug-simulator override. Production native API remains `https://duckplan-latest.ocs-learning.workers.dev/api`. Command credentials stay under private `/private/tmp/duckplan-axis-native-qa`, never in committed evidence.

The loopback-only `server.mjs` / `wrangler.qa.jsonc` acceptance harness is **not** a production entrypoint. It substitutes only the upstream feed and evaluation clock, not the client/native transport or database. Synthetic stages and cooldown resets affect only its isolated local D1. No student feed or production records are used. Initial browser harness module access and checkbox-rerender assumptions were corrected; initial native harness feedback assertions overlapped pending sign-in and Connect callbacks; the corrected harness waits for completed sign-in and import feedback. Both earlier diagnostics are retained separately from the passing product-state/persistence checks.

## Activation

The new rule runs on the server. Updating GitHub or rebuilding the phone alone does not enable it on the hosted account service. Public deployment of the reviewed backend/new site awaits explicit approval under the project release rule; no public deployment, production data change, migration or secret rotation is part of local implementation/testing.

After approval, deploy the existing `cloudflare/wrangler.latest.jsonc` profile to the user-selected separate site. Preserve its existing DB/LIVE bindings, secrets and original-site isolation. Test all current-version response/asset identities afterward; real student Axis feeds remain outside disposable QA. Physical alarm delivery, unrelated PWA lifecycle behavior and trusted OS gestures are not claimed by these affected-flow checks.
