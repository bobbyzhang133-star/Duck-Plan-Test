# Assignment details first — November 26, 2026

## Prepared locally

Assignment work blocks, individual deadlines and task-list primary controls now open the existing read-only Task details window. Edit opens the task editor only after the details window closes through the approved source transition. A grouped deadline opens its list, then the selected assignment's details, then Edit. Explicit Reschedule and matrix Edit actions remain available. Labels and scheduling instructions describe the new behavior.

The source finder now restores focus and editor animation to the matching task-list launcher after a rerender, scoped to the current view/owner. Opening details does not save or complete a task. Completion behavior, plaintext notes, source-owned dates and all existing editor fields are preserved. Cache156 includes the changed script and stylesheet references.

## Confirmed background colors

The user confirmed that the whole details window follows the launcher type. Work details share the saved block/template class-fill rules, including the default Personal material and existing dark-theme variants. Single deadline details share the calendar deadline's red surface and foreground tokens. The entire rounded surface retains this material throughout opening, closing and the settled state; the Edit form keeps its established material. No copying of transient hover/pressed colors or unrelated calendar redesign is involved.

## Evidence

- PASS: 678 Node tests on a clean export of aace1fe with only the nine changed files in source-manifest.json overlaid; unrelated HTTP/0009 drafts excluded. Focused motion/preview/date-card/drag checks passed 73 tests before the tint addition; the final full suite covers the completed source. The revised grouped-deadline regression requires details before Edit; the added list-rerender regression preserves the original launcher. Both changed scripts also pass syntax checks.
- PASS: Chromium 158.0.8127.38 in isolated local browser-storage contexts at 320×568, 390×844, 844×390, 835×1112, 1280×900, plus 390×844 dark/reduced motion. Emulated touchscreen taps on phone/iPad cases; mouse/Enter/Escape on desktop. Work→details→Edit→save/reload, single deadline, grouped deadlines→details, list launch/dismiss/focus and unchanged task count/status pass. Every work/Personal/deadline background exactly equals its rendered calendar source surface. Metadata text contrast ranges from 5.74:1 to 8.53:1. See browser-results.json and work/deadline screenshots. Rendered screenshots were visually inspected across the required phone sizes, iPad/desktop and dark theme. Scrollable content and footer actions remain reachable on short/narrow screens.
- PASS: real local Worker/D1 signed-in desktop and phone checks for details-before-Edit, both tints, a synthetic 503 save failure/retry, save/reload and completion/reload, preserving two fixture task IDs and notes. See cloud-results.json and cloud-qa.js. Production accounts and data were not used.
- PASS: actual opening and closing frames for green work and red deadlines preserve the same tint, inert closing content and source-focus restoration. Four rendered frame screenshots were inspected; see motion-offline-results.json. Existing motion helper is unchanged. Earlier routing-only Escape reversal/rapid reopen evidence is retained in before-tints-motion-results.json.
- PASS: offline browser-tab reload uses cache156; both work and deadline details retain their matching fills and task count. See motion-offline-results.json. Earlier cache155 routing-only evidence is clearly named before-tints-offline-results.json. Standalone PWA lifecycle was not tested.
- NOT RUN: physical Safari/devices, installed PWA and native WKWebView. No API/schema/storage formats changed in this UI pass. Native checkpoint remains frozen.

Initial checks found the first tint version did not share the calendar's dark-theme work override; that mismatch was corrected by extending the existing material selector and rerunning all six cases. Harness diagnostics were corrected separately: a pre-action scroll could encounter a bootstrap-replaced node (the actual click/tap now retries through its locator), and an initial motion fixture placed two deadlines at the same time, creating a group instead of the intended single marker. Final signed-in and motion/offline runs pass with the corrected harnesses.

No deployment, GitHub push, native synchronization/build/installation or production task modification occurred. The separate large-list and Axis fixes still await publication approval. Local preview remains http://127.0.0.1:8798/#calendar.
