# Template action reference — November 14, 2026

The user's supplied screenshot supersedes the earlier chat demo's dark Schedule button and outlined Add to tasks button. Schedule now has a light outline, pill shape and calendar-plus icon; Add to tasks is plain muted text, alongside the quiet overflow control. This is the confirmed styling-only change: Schedule still opens the existing prefilled editor and Add to tasks still creates an independent unscheduled copy. No inline time picker was added.

Scoped styles override the generic glass background, shine and shadow while preserving press/release feedback, disabled behavior and visible keyboard focus. Compact padding keeps all three controls on one row at the narrow 768px tablet layout: 223.53px of controls fit inside 227px. Coarse-pointer controls retain at least 44px height. Template colors, dragging, storage, backend and native code are unchanged.

## Verification

- PASS: all 16 existing library/PWA Node tests; JavaScript syntax and diff checks.
- PASS: 20 browser action/layout cases in Chromium 157.0.8103.78, local storage with disposable fixtures. Eighteen ran against final CSS; two 390px functional cases were reused from the same behavior implementation before the padding-only correction. The matrix covers 320/390/768/835px, light/dark, normal/reduced motion, focus, interaction feedback and overflow. Functional checks cover trusted clicks on the icon opening the prefilled editor, Cancel without mutation, Add creating an independent copy, reload persistence and preserving the template.
- PASS: three fresh idle screenshots at 320px light/dark and 835px light, captured before any hover/press. See `runtime-results.json`, `runtime.js` and the PNGs alongside this record. No page exceptions or failed requests; synthetic contexts closed afterward.
- PASS: actual current in-app browser at `http://127.0.0.1:8034/#calendar` refreshed and visually checked. New asset keys, outlined icon button and plain Add action were confirmed. Templates tab, selected November 14 Week and calendar scroll 423px were preserved. No user task or template was saved, dragged or added.
- NOT RUN for this presentation-only patch: signed-in Worker, physical Safari/iPhone/iPad, native WKWebView and installed PWA. The previous drag feature's broader evidence remains in `../calendar-drag-preview/`; it is not a fresh platform pass for these styles.

Final library asset keys use `template-action-reference-20261114`; service-worker cache is v52 (v51 was an intermediate local preview). Local changes and TEST feature backup only: no public deployment, shared-main merge, native bundle sync or installed-phone update.
