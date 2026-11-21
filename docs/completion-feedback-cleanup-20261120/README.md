# Completion feedback cleanup — November 20, 2026

Local website change following the user's request to remove the confusing calendar/clock imagery during task completion. Baseline `76bffd72ebe833686f597ecc0548d33c9b43569a`; web cache v114, completion assets `completion-check-20261120`. No public deployment, remote push or native bundle update.

## Behavior

The calendar and clock symbols on ordinary task cards describe **Due** and **Work**, respectively. They were unintentionally enlarged in the outgoing completion clone because it lost page-scoped layout styles. They were not intended as completion symbols.

Completion now renders a separate, self-contained, inert decorative card with one bounded 24px checkmark, plain-text task title and either “Completed” or “Overdue task completed.” Both use the same positive yellow treatment; the caption distinguishes the original overdue state without adding another icon. It uses the source position/width with a compact height capped at88px, a small lift/settle and a430ms fade. Existing finite particles, Sigma reactions, final-task note and motion preferences remain.

The ordinary task cards retain their Due/Work fields. The outgoing element contains no copied SVG date icons, form controls, IDs or event handlers. Checkbox completion from the priority matrix uses the same presentation. Service-worker and asset versions changed together.

This is the requested visual cleanup, not an implementation of every item in the earlier Chat Check. Persistence-aware success coordination, preview-entry-point parity and explicit Undo remain separate review recommendations. The existing optimistic observer/save behavior was not changed; a successful local/cloud completion test does not establish behavior under a delayed failed write.

## Verification

Playwright MCP, Chromium157.0.8103.79; separate synthetic contexts, with no changes to the user's preview storage or real records. See [reproducible browser checks](check-browser.js), [16 detailed local results](browser-results.json) and [signed-in result](cloud-result.json).

| Case | Result |
| --- | --- |
| Tasks at1280×900,835×1112,390×844 and320×740 | PASS: overdue and future tasks each produce one check, correct caption, no duplicate date icons/controls and no page overflow. |
| Dark mode390×844 | PASS: bounded check and matching card treatment. |
| Reduced motion and explicit motion off | PASS: no outgoing animation; completion still saves and survives reload. |
| Priority matrix835×1112 | PASS: both completion captions, bounded single check, cleanup and persisted completed state. |
| Keyboard Space in standard task lists | PASS: completion works; focused-task identity recorded in results. Matrix keyboard coverage not claimed. |
| Effect lifetime | PASS: outgoing card and particles removed after another second; reload does not replay the completion effect. |
| Calendar desktop task panel, Dashboard, phone Calendar task sheet | PASS: one icon, correct overdue caption, compact height under90px including animated scale, completed store state. |
| Real loopback Cloudflare Worker/D1 fixture at8798, signed-in390px | PASS: created a synthetic UUID task, completed it through the actual checkbox, observed one check/overdue caption and verified completed state after reload. No mocked transport or production account. |
| Syntax and diff checks | PASS: `node --check` on changed JS and `git diff --check`. |
| Existing focused Node tests | PASS:37 tests,0 failures across service-worker cache, planner store, priority matrix and calendar preview. |
| Native WKWebView, installed PWA, physical Safari/iPhone/iPad | NOT RUN. Native checkpoint intentionally frozen until “Publish to public”; viewport checks are responsive Chromium evidence. |
| Delayed cloud failure/concurrency/remote owner changes | NOT RUN in this presentation change; pre-existing feedback concerns remain documented in the Chat Check. |

The Node command was `node --test tests/service-worker-cache.test.cjs tests/planner-store.test.cjs tests/task-matrix.test.cjs tests/calendar-task-preview.test.cjs`. No unrelated full suite or native build was needed for this presentation change.

The first browser harness attempts encountered hidden duplicate matrix/list controls and a collapsed Needs classification section; the final harness selects visible inputs and opens the section through its summary. An initial signed-in fixture used a non-UUID ID and was correctly rejected by the backend; the final actual-backend check used `crypto.randomUUID()`. These setup failures are not feature failures or passes.

Screenshots are mid-animation rendered samples, not frame-rate measurements. Final captures include desktop, tablet,320/390px phone, dark and matrix cases. The phone image shows the compact confirmation rather than the former oversized calendar/clock symbols.
