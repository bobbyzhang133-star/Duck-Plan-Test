# Axis duplicate prevention — November 25, 2026

## Diagnosis and scope

Read-only aggregate queries against the latest public database found 9,685 Axis rows with 9,685 distinct UIDs, 9,339 marked missing, and 28 successful syncs totaling 9,685 inserts. Grouping by owner, class, title, type, due date/time and notes found 347 repeated groups containing 9,337 extra copies; the largest had 28 copies. No task contents, identities, credentials or feed links were returned. Both queries reported zero writes. This supports regenerated Axis UIDs bypassing the existing `(user_id, axis_uid)` constraint; the exact upstream feed was not downloaded or compared.

The local correction adds owner-scoped UID aliases and SHA-256 fingerprints of complete source snapshots (class section, title, type, date, time and description). No fuzzy/title-only matching is used. Separate occurrence slots preserve simultaneous identical feed entries. Known UID aliases take precedence and continue tracking source revisions. Source snapshots survive manual task edits, completion and soft deletion; existing source-owned field update rules stay in place. Work schedule, duration, priority and alert metadata remain user-owned. First-import completion/history behavior remains unchanged.

Migration 0011 adds an identity table, owner checks and an index; it never deletes or merges existing tasks. Legacy exact matches acquire keys only when selected by the incoming feed. The write transaction checks keys again to handle concurrent imports with different UIDs, resolves concurrently created class IDs and reports actual inserted task/class counts. Failed transactions roll back aliases and task writes together.

## Limits

If both the UID and source snapshot change together, with no previously known alias, the importer cannot prove identity and retains separate tasks. Legacy rows edited before identity tracking may also lack an exact original snapshot. Identical assignments appearing at different times without a stable provider identity are inherently ambiguous; only simultaneous feed multiplicity can be established. Existing duplicate copies are preserved for a separately reviewed cleanup, rather than deleting schedules or completion choices automatically.

## Verification

- PASS: 677 Node tests in a clean committed-source export with only this correction overlaid. Unrelated `http.js` and pending0009 drafts were excluded. Eight new integration regressions cover 28 UID rotations, saved work/status/deletion, simultaneous identical assignments, distinct class/date/notes, source revisions/aliases, owner isolation, concurrency, actual counts and rollback/retry. A 9,716-row synthetic legacy backlog stops growing without deletion.
- PASS:real local Worker/D1/DO with migrations0001–0008,0010,0011. Chromium 158.0.8127.38, signed-in disposable accounts at 320×568, 390×844, 844×390, 835×1112 and 1280×900. Connect imports 4 including 2 identical simultaneous entries; 3 syncs with regenerated UIDs and disconnect/reconnect add 0; stable task IDs/count and completion survive reload. Phone/tablet input is touch emulation; screenshots were visually inspected. See browser-results.json and five screenshots.
- PASS: 6 broader desktop/phone/iPad local-storage and real signed-in local API baselines, covering task CRUD/failure/retry, classes/resources, templates/schedule/desktop drag, notes/goals/habits, persistence and cross-client refresh. See baseline-*-results.json. Legacy API behavior reuses prior unchanged evidence; it was not re-executed here.
- PASS:production-profile Worker dry-run and final diff checks. No production deployment or remote migration occurred.
- Initial QA diagnostics:the first harness changed only the URL fragment, but this app only handles the sidebar fragment dynamically; task navigation timed out after otherwise successful sync flows. The harness now uses a full task-route load. A second run had one landscape response timeout without a page error; its exact timing cause was not established. The final complete five-layout rerun passes. These diagnostics do not establish a persistent application failure.
- NOT RUN:physical Safari, standalone PWA and native WKWebView for this correction. The existing native checkout remains frozen at its authorized release checkpoint. No alarm delivery claim is made.

Source baseline:b64bdaf plus the correction in source-manifest.json. Landing remains cache 154, including the separately prepared large-list responsiveness fix. Native source/build/installation was not changed.

## Publication boundary

Both fixes are local only. Public site remains cache 153 / Worker 3633265e-9405-470a-925c-a84f66f8c0d0. The earlier attempt to publish the separate large-list correction was rejected by automatic approval review because the prior release authorization predated that correction. Root AGENTS.md says “Local implementation and preview do not authorize public deployment.” Explicit approval is still required for publishing these concrete website changes and applying additive 0011. Do not include the unrelated HTTP/0009 drafts. Apply 0011 before activating the new backend; an old backend rollback can leave the additive table in place.
