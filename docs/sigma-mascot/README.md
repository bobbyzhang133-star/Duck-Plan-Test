# Sigma mascot

The app profile, sidebar and favicon use `landing/assets/duckplan-sigma-head-v7.png` and its 192/512px exports. The user approved v6's directly copied original outline, then requested the expression from a new photo. V7 changes only the facial features: the viewer-left eyebrow is raised above a more open eye, while the other eye is narrower, producing an asymmetric skeptical expression. The approved rotated outline and original beak remain protected. The native icon copies the opaque 1024px master directly. Previous images remain available.

The byte-identical original is [source/original-duck-reference.png](source/original-duck-reference.png). Following the user's copy-and-paste instruction, the compositor rotates its actual pixels 45.0187 degrees clockwise, then applies one uniform scale and crop. The crop stops before the screenshot's clipped contour endpoints, so no neck extension is invented.

The retained [v6 rotated baseline](v6-preservation/rotated-original.png), [facial mask](v6-preservation/facial-edit-mask.png) and [preservation report](v6-preservation/preservation-report.json) document the approved outline. V7 writes its own [rotated baseline](v7-preservation/rotated-original.png), [facial edit mask](v7-preservation/facial-edit-mask.png) and [preservation report](v7-preservation/preservation-report.json). The compositor rejects any output with changed pixels outside the permitted facial mask or changes to the original outline or beak. The expression-feature source is [source/raised-brow-features-v7.png](source/raised-brow-features-v7.png).

Rebuild from the repository root on macOS:

```sh
xcrun swiftc -O -module-cache-path /private/tmp/duckplan-icon-module-cache tools/build-original-outline-icon.swift -o /private/tmp/duckplan-build-original-icon
/private/tmp/duckplan-build-original-icon --raised-brow
```

Omit `--raised-brow` to reproduce the earlier v6 expression. The source geometry, expression method and earlier generation prompts are recorded in `landing/assets/duckplan-sigma-head-notes.md`.

V7 verification on November 12, 2026: independent PNG comparison found 43,014 facial pixels changed and zero changes outside the facial-edit mask. The v7 rotated baseline is byte-identical to v6. All 215 Node tests pass; the local browser loads the v7 brand/favicon without errors. The existing iPhone project builds successfully, all 80 bundled web files match source, and its native icon matches the opaque master. Eight Swift/project/plist files remain unchanged. [profile-v7-sidebar.png](profile-v7-sidebar.png) shows the local brand rendering. No physical-phone installation or production deployment was performed.

Full-body UI poses remain native SVG markup in `landing/duck-mascot.js`, styled by `landing/duck-theme.css`, using the earlier `landing/assets/duckplan-sigma-head-v3.png` as their visual reference. Their drawings, placements and reactions are unchanged by the app-profile edit.

`front-view-states.png` is the current preview: happy, sleepy, focused, encouraging, celebrating and swimming. Front views have a plain rounded body outline, scaled Sigma head and webbed feet, with no visible tail or feather/wing lines on the chest. A lifted wing appears during greeting/celebration reactions. Swimming hides the feet under the water. `full-body-states.png` and `states.png` retain the previous versions for comparison. All existing mascot containers and interaction hooks remain in use. The previous yellow mascot preview remains in `docs/yellow-redesign/mascot-states.png` for comparison.

The Daily progress pond alone uses a right-facing side-profile duck, including its visible side wing, tail and orange bill. It retains the progress-position movement, swimming state, ripples and reduced-motion handling. `daily-progress-side.png` shows the updated local card. Other placements keep the clean front view.

Full-body pose references researched at the user's request: [Cheems examples](https://knowyourmeme.com/editorials/guides/who-was-cheems-the-meme-famous-shiba-inu-dog-that-recently-passed-away-the-history-of-the-dog-sometimes-mistaken-for-doge-explained) and [walking-duck artwork](https://www.redbubble.com/i/tote-bag/Happy-walking-duck-meme-by-rozdolf/91490710.A9G4R). These are visual references only; the application continues to draw its own SVG character and does not load third-party artwork.

Verified on November 11, 2026: 214 Node tests, JavaScript syntax and diff checks; browser checks at 390 and 1280 px for all seven placements, six state transitions, task modal, Dashboard/Calendar navigation and reduced-motion behavior.
