# Pop-out formatting and matching profile artwork — November 21, 2026

Scope: the selected [local original preview on port 8042](http://127.0.0.1:8042/?v=profile-mascots-20261121#calendar), starting at `5d8542f`. No canonical 8034, hosted or native files are changed.

## Task snapshot formatting

Moving the cloned card out of the task list removed ancestor-scoped styles from `calendar-date-clarity.css` and the list layouts. The date rows, badges and child controls could change layout, spilling words outside the card. Freeze the source card's computed layout/typography/borders and child offsets before moving the snapshot. Empty hidden spacers replace the removed date icons, preserving the date grid's tracks without restoring the unwanted graphics. Preserve fractional widths without rounding below a text run's width, which otherwise wrapped the last letter of a class name. Clip the outer frame as a final paint boundary.

The existing original 430ms task pop-out, immediate particles, 400ms upward list slide and delayed 1500ms duck reaction are unchanged. The snapshot is inert/aria-hidden with copied IDs removed; actual task data and original controls are untouched.

## One approved duck identity

The profile icon already used v11, but the animated SVGs retained a separately drawn v3-style head. The shared mascot renderer now embeds the existing `duckplan-sigma-head-v11-transparent.png` under a uniform scale for every front-facing head. Its copied contour, eyebrows, eyes and bill come from the approved source pixels. Separate clipped source windows retain the expression/blink/gaze hooks; sleepy/celebrating eyes and focused glasses remain pose-specific overlays. A connected rounded SVG body, orange feet, waving wing and thumbs-up wing remain; no head-only torso or detached thumb is introduced. Sleepy tilt applies to the whole duck to avoid opening a neck seam.

All existing placements use this renderer: Dashboard companion, empty states, task editor, complete-day note and the duck that follows one completed task. The progress pond stays right-facing: its side silhouette/bill use matching broad-neck styling and white/orange material, with the visible eye and brow sampled together from the approved v11 artwork. The brand icon and both opaque/transparent masters are unchanged. Cache v118 includes the reused transparent master so the SVG head does not require an uncached extra asset offline.

Unchanged master SHA-256:

- Opaque v11: `7714bd8afc68d05399841291712d57cfcb62ad729eec3cd58e570670156501f5`.
- Transparent v11: `8964decdb6dc2448a21beb1ea5fa92ebc979cd1f7c2eb19b61e1320e70eb78db`.

## Verification

Playwright MCP Chromium 157.0.8103.79, isolated synthetic browser fixtures.

- **PASS — 9 formatting cases:** Calendar at 1156/835/390px; Tasks at 1156/390/320px; Dashboard; matrix; dark Tasks. Long titles, logged minutes, priority/category labels, due/work rows and both warning badges. [Script](check-formatting.js), [results](formatting-results.json). Every text run has the same line count as the actual source card, positions differ by at most 0.015625px, and no run extends outside the snapshot. The frame retains the source height, date graphics stay absent and the animation remains 430ms. Rendered screenshots accompany each case.
- **PASS — mascot identity/poses:** actual existing placements and the completion reaction at 390/835px, plus all seven front states and the side-profile swimmer. [Script](check-mascots.js), [results](mascot-results.json). Approved source references and SVG ID references resolve; front head scale is identical in both axes (0.08984375). Full-body/feet/thumb, bounds, no remaining task echo, sleepy/normal eyes and focused glasses pass. Inspected [pose sheet](approved-poses.png), [phone completion](completion-390.png) and [tablet completion](completion-835.png).
- **PASS — 11 focused Node tests:** render hold, list-motion refresh coordination and service-worker versioning. Changed-JS syntax and `git diff --check` pass. No persistence, API or schema logic changes.
- **NOT RUN:** new signed-in/API mutation checks for this presentation-only revision, installed PWA, Safari/WebKit/Firefox, native WKWebView and physical devices. Responsive web evidence does not claim installed-app parity. Native synchronization remains gated on Publish to public.

No image-generation replacement, raster-master edits, remote push, deployment, app synchronization or signing changes.
