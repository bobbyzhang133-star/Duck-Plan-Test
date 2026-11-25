# Bulk overdue completion — local performance fix

Scope: canonical `DuckPlan-original-duck-preview`, branch `codex/bulk-overdue-performance-20261124`, parent `af53ce7`, cache153. Local website only. No public deployment, GitHub upload, native bundle sync/build or installed-app update. Preserve the unrelated HTTP/0009 OAuth drafts.

The old action scanned all tasks again for every item, saved the entire local task array per item, and published local/persisted notifications per item. Each notification rebuilt the planner; persisted notifications also reconciled work alerts. The new store operation captures the original selection, commits local tasks once, and publishes one completion notification. The signed-in path sends serial chunks of at most200 IDs/deadlines/revisions to a completion-only, owner-scoped SQL update. Compact acknowledgements exclude notes/settings. The indexed ID restriction bounds each statement's candidate rows; JSON binding stays below D1's100-variable limit. One live reload invalidation per batch replaces individual row broadcasts. Own-tab reloads wait for the operation and coalesce.

The batch endpoint is additive and requires no new migration. A planner capability advertises support. Older servers retain serial PATCH fallback, one final client merge/notification and coalesced live echoes; that fallback still needs one HTTP request per task and cannot provide the new server's conditional revision guard. Stale/skipped rows and ambiguous network failures request a fresh snapshot. Failed batches retain acknowledged successes; account switches stop queued writes and discard old-owner acknowledgements. Other task fields, date-only/timed deadline semantics, reminders and native outbox triggers remain intact.

Calendar completion animates whole sections, retains the original list mounted until closing finishes, and clears it afterward. It avoids card cloning, per-card geometry/style reads, particles and per-card animations. The Tasks page fades its one surface out before replacing groups, then back in. These presentation transitions begin after persistence; they never delay saving. Both honor reduced motion, cancellation, focus and late refresh coalescing. Keyboard focus moves to Add task in Calendar or Active in Tasks when the bulk button disappears.

## Measured browser results

Playwright MCP Chromium158.0.8127.38 on the local Mac, isolated synthetic browser storage. Same1280×900 viewport,100 identical overdue tasks, reduced motion:

| Work | Before | After |
| --- | ---: | ---: |
| Action duration | 13,472ms | 27.3ms |
| Full task-array writes | 100 | 1 |
| Planner renders | 200 | 1 |
| Serialized characters written | 2,313,050 | 23,081 |

Evidence: `benchmark-before.json`, `browser-bulk-results.json`. Additional local tests:1000tasks79.3ms and2000tasks151.4ms, each with one write/render. Emulated390×844 phone with1000tasks and normal motion:216.9ms action, two section animations, one write/render; a251ms long task was still observed. These are individual local browser samples, not physical-phone benchmarks, direct CPU/GPU measurements or a guarantee of zero frame drops for arbitrarily large planners. Initial list loading/rendering is outside the measured action.

## Verification

| Check/runtime/mode | Result | Evidence |
| --- | --- | --- |
| Automated model/store/API/motion/security regressions | PASS665/665 | `automated-tests.log` |
| Bulk persistence:2000rows, quota failure/retry, deadline boundaries, deduplication, owner change, concurrent edit, partial success, legacy fallback | PASS | `tests/bulk-overdue-store.test.cjs` and related suites |
| Real SQL owner isolation, CAS/deadline guard, replay,200-row limits, CSRF/auth, field/revision preservation | PASS | `tests/cloudflare-worker.test.mjs`; SQLite runs actual migrations/queries/triggers |
| Real local Worker/D1 signed-in bulk250 + one future task, second batch503 + retry, reload and live peer | PASS | `browser-bulk-cloud-results.json`; requests200,50(failed),50(retry),1(reopened task from Tasks page) |
| Calendar bulk UI, touch/focus, long title, completed section open/close, task sheet close/reopen | PASS | `browser-bulk-results.json`, before/closing/after/completed-open screenshots |
| Tasks bulk UI, saved state before closing, retained old rows, reopening surface, future row retained, focus | PASS | `browser-bulk-tasks-results.json`, `tasks-*` screenshots |
| Full core functional baseline: local/signed-in desktop1280×900,phone390×844,iPad835×1112 | PASS6cases | `baseline-*-results.json` and `baseline-*` screenshots |
| Physical Safari, installed PWA, native WKWebView | NOT RUN | Native checkpoint frozen; touch evidence is Chromium emulation |
| Public deployment of this fix | NOT RUN | Local review only |

Affected rendered layouts:320×568 and390×844 portrait,844×390 landscape,835×1112 iPad,1280×900 desktop. Touch is emulated on phone/tablet; desktop bulk completion also uses keyboard Enter. Visually inspected Calendar before/during/after, expanded completed long-title state, Tasks remaining long-title state, desktop/iPad composition and error/peer screenshots. The content can scroll beneath its existing sticky toolbar; controls remain reachable and the phone bottom navigation stays separate. Form/keyboard behavior is additionally covered by the six full core baseline cases. No new form was introduced here.

The copied baseline runners execute only against isolated localhost8788, with third-party traffic blocked. Their existing legacy-server reference covers unchanged non-bulk features; bulk legacy behavior has its own regression test. The final Calendar-only node-retention optimization and Tasks-only bulk fade do not run during these baseline's ordinary CRUD operations, so that full-baseline evidence is reused; both changed bulk paths were then tested in their final rendered form. Early QA selector failures (ambiguous close button, landscape breakpoint guessed by the runner, mistakenly assuming the second entry was Dashboard) were corrected in the runners. Final results above are passing reruns, not those failed attempts.

The test Worker used `/tmp/duckplan-bulk-overdue-source-20261124` (clean export plus this change, excluding HTTP/0009 drafts) and disposable database `/tmp/duckplan-bulk-overdue-db-20261124`, with migrations0001–0008 and0010. The preexisting static preview on8799 serves the canonical checkout. No user planner data or provider secrets were read or changed. No public account fixtures were created.
