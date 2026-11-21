# Duck graphic in the original preview — November 21, 2026

The user selected the complete original buggy preview at8042 and asked to replace the time/calendar graphics with a thumbs-up duck **in that version**. This isolated checkout/branch (`codex/original-preview-duck-20261121`) starts at `76bffd7`. The newer8034 checkout is untouched.

Only the cloned completion pop-out substitutes its date SVGs: the first slot becomes one full-body Sigma thumbs-up duck, and any second date icon is removed. Ordinary task cards retain their Due/Work icons and text. The existing Sigma SVG system gains the approved full-body pose (rounded white body, unchanged face, orange feet, connected raised wing/thumb), with the new wing hidden in other poses. A144px-wide/136px-high illustration fits the existing graphic slot rather than adding another animation or overlay. Small warning SVGs in the clone are bounded to12px so the old ancestor-styling defect cannot create a second giant triangle.

The **original `task-finish 430ms ease both` and all original keyframes remain unchanged**, including opacity0.96→0.9→0 and scale1→1.012→0.99. The old immediate list redraw, cleanup, particles and other original behavior remain; none of the newer render holds/shrink stages from8034 were carried over. This is the requested graphic substitution, not a full refactor of the old clone layout or persistence behavior.

## Preview and source

[Original preview with duck](http://127.0.0.1:8042/?v=original-preview-duck-20261121#calendar). The existing8042 loopback server's landing path is now a symlink to this checkout's `landing/`, so the reviewed source and served files stay together. Its prior temporary directory was retained at `/private/tmp/duckplan-original-completion-76bffd7/landing-duck-mirror-backup`; pristine source remains in Git at `76bffd7`.

Variant cache: `duckplan-app-original-duck-preview-v114`. The three presentation assets have `original-preview-duck-20261121` query versions. The main8034 source, native checkout and public deployments were not changed.

## Verification

Playwright MCP, Chromium157.0.8103.79, isolated local-mode contexts. [Browser script](check-browser.js) and [results](browser-results.json).

- **PASS:**7 cases: desktop/tablet/phone Calendar, phone Tasks390/320px, dark and reduced motion. Ordinary date icons remain; animated clone has zero date icons and exactly one full-body duck, visible thumb/feet, inert/hidden semantics, original animation name/duration/easing/keyframes, finite cleanup and completion after reload.
- **PASS:** inspected the actual8042 animation before substitution and returned after each visual revision. Rendered peak captures show the replacement graphic inside the original pop-out; its timing/opacity definition is unchanged. Screenshots sample rendered animation states and do not establish physical-device frame rate.
- **PASS:** both existing service-worker cache tests, changed-JS syntax and diff checks. Original animation/keyframe source was not edited.
- **NOT RUN:** new signed-in/backend tests, native WKWebView, installed PWA or physical devices. This is the selected old local preview, with no storage/API/native changes. Its pre-existing optimistic completion and ancestor-dependent clone layout behavior remain outside the graphic substitution.

No profile/app-icon raster artwork was edited. The user's preview storage/records were not used as fixtures. No push, publication or app synchronization.
