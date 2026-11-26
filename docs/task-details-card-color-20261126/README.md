# Task details follow task-card colors — November 26, 2026

User correction: details opened from Tasks should match the actual task card, whose color represents status rather than class. The same rule now applies to Calendar's task column. Shared palette variables supply both card and details backgrounds for neutral, scheduled, due today, overdue and completed states, in light/dark themes. The existing canonical status classifier updates an open details window after completion, without reading transient hover colors. Class information stays available in the metadata. Calendar work-block class colors and deadline-marker red surfaces retain their previous behavior.

Details still open before Edit. When completion removes the original row from the Active filter, closing details focuses the visible Add task action; a regression covers that fallback. Other sources retain their existing focus restoration. Cache157 and changed asset query keys prevent stale local assets.

## Verification

- PASS: 679 complete Node tests in a clean export of baseline81e5b86 with the seven files in source-manifest.json overlaid. Unrelated HTTP/0009 drafts excluded. The focused preview/grouping/date-card suite passes33 tests, and both changed scripts pass syntax checks.
- PASS: Chromium158.0.8127.38, isolated local storage, mouse on desktop and touchscreen emulation elsewhere. Sizes320×568,390×844,844×390,835×1112,1280×900, plus390×844 dark theme. All five card/details fills match exactly in every case. Completion updates the open tone, filtered-source focus is preserved, Edit/save/reload works, and Calendar's task column also matches. Long-title/notes screenshots were visually inspected across all affected sizes/themes; short/narrow dialogs remain scrollable with actions reachable. See browser-results.json and screenshots.
- PASS: real local Worker/D1 signed-in phone fixture, matching overdue card/details color and Edit/save/reload. PASS: offline browser-tab reload with cache157, matching card/details and saved edit/reload. See cloud-offline-results.json. No production account or task writes occurred.
- PASS: actual browser opening/closing states preserve the task-card tint in the morph surface, keep closing content mounted/inert and restore source focus. See motion-results.json and frame screenshots. The shared motion helper is unchanged.
- NOT RUN: physical Safari/device, standalone installed PWA, native WKWebView. Native source/build/installation remains at its frozen release checkpoint.

Harness corrections: the first loop expected a completed task to remain in Active; it was revised to assert the supported focus fallback after filtering. A later harness selector used `active` where the existing filter key is `all`; the corrected rerun passes. One signed-in color sample initially differed during startup; sampling after the initial rendering settles matches the shared material. Final signed-in and offline results both pass.

No public deployment, remote migration, GitHub push or native synchronization was performed. Local preview:http://127.0.0.1:8798/#tasks. Earlier prepared lag/Axis fixes remain local pending publication approval.
