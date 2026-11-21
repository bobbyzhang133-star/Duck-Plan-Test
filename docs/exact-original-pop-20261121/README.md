# Restore the complete original animation — November 21, 2026

Follow-up to `6b34968`. The repeated request was to use the buggy version's original bounce animation. The complete original `task-finish` keyframes and `430ms ease both` declaration are now copied directly from `76bffd7`, including its opacity fade tozero. The separate240ms contraction and the substitute softened/held fade are removed. This latest restoration supersedes the preceding extra shrink stage.

The task snapshot still removes calendar/clock icons, preserves resolved layout and remains inert. The visible list still waits for the original `task-finish` animation-end before reflow, with a500ms fallback. The separate full-body duck starts alongside the task; its overlay/wing timeline now fits the same430ms window without changing the task transform, size or opacity. Existing confirmed-save handling, cancellation, focus and placeholders remain.

Local website only: cache v120, presentation assets `original-bug-pop-20261121`. No public deployment, remote push or native app update.

## Direct reference verification

Inspected the actual original preview8042 before editing, then returned to it after implementation and compared with8034 through Playwright MCP at390×844, same synthetic tasks and checkbox input. [Comparison script](compare-original.js), [results](comparison-results.json), and `reference-8042.png` / `reference-8034.png`.

**PASS:** identical animation name, all keyframes (including opacity), offsets,430ms duration and`ease`. Rendered samples at0/75/150.5/300/420ms have equal transform matrices and opacity within0.0001. This comparison now covers the complete original fade as well as its movement; the earlier versions only matched the movement while deliberately modifying the fade. The original reference's giant date/time icons remain excluded from the current task snapshot.

## Functional checks

- **PASS:**11 actual local completion cases across desktop/tablet/phone Calendar, Tasks1156/390/320px, Dashboard, matrix, dark, reduced motion and motion off. Neighbor geometry remains fixed during the original exit, closes afterward, keyboard focus is retained and completion/other task fields survive reload. [Harness](check-browser.js), [results](browser-results.json).
- **PASS:**9 lifecycle cases: rapid completion, reopen, filter/navigation, reduced motion during exit, real loopback Worker/D1 signed-in success, injected early/late503 failures and sign-out during a pending response. No stuck rows, stale owner content or failed-save success celebration. Failure/delay injection is at the transport boundary; durable account/task state and reload use the actual fixture backend. [Harness](check-edge-cases.js), [results](edge-results.json).
- **PASS:** a live animation-end/MutationObserver check verifies list mutation occurs after the original task animation completes. [Timing sample](render-order.json), not a universal performance guarantee.
- **PASS:**8 focused Node tests (render-hold lifecycle and service-worker cache), JS syntax and diff checks. [Log](node-tests.txt). No store/schema behavior changed, so unrelated suites were not repeated.
- **NOT RUN:** native WKWebView, installed PWA, physical Safari/device performance and full release baseline. Native checkout remains frozen until “Publish to public.”

Motion reference frames use paused browser animation times and rendered captures; they establish the curve/fade rather than physical-device frame rate. Functional geometry/lifecycle checks use ordinary live execution. All fixtures use isolated contexts, preserving the user's preview and records.
