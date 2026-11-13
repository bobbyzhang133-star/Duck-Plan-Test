# Sigma mascot

The app profile, sidebar and favicon use `landing/assets/duckplan-sigma-head-v6.png` and its 192/512px exports. Following the user's explicit copy-and-paste instruction, this version uses the actual original outline pixels, rotated 45.0187 degrees clockwise, uniformly scaled and cropped. Existing Sigma eyes and brows are composited inside the face. The original outline and beak are preserved; this version does not use a generated approximation. The native icon copies the opaque 1024px master directly. Previous images remain available.

The byte-identical original is [source/original-duck-reference.png](source/original-duck-reference.png). [v6-preservation/rotated-original.png](v6-preservation/rotated-original.png) is the unchanged rotated baseline; [v6-preservation/facial-edit-mask.png](v6-preservation/facial-edit-mask.png) identifies the permitted changes. [The preservation report](v6-preservation/preservation-report.json) and an independent raw-PNG check confirm zero changed pixels outside that mask. The crop stops before the screenshot's clipped contour endpoints, so no neck extension is invented.

Rebuild from the repository root on macOS:

```sh
xcrun swiftc -O -module-cache-path /private/tmp/duckplan-v6-module-cache tools/build-original-outline-icon.swift -o /private/tmp/duckplan-build-original-icon
/private/tmp/duckplan-build-original-icon
```

The source geometry and earlier generation prompts are recorded in `landing/assets/duckplan-sigma-head-notes.md`.

Full-body UI poses remain native SVG markup in `landing/duck-mascot.js`, styled by `landing/duck-theme.css`, using the earlier `landing/assets/duckplan-sigma-head-v3.png` as their visual reference. Their drawings, placements and reactions are unchanged by the app-profile edit.

`front-view-states.png` is the current preview: happy, sleepy, focused, encouraging, celebrating and swimming. Front views have a plain rounded body outline, scaled Sigma head and webbed feet, with no visible tail or feather/wing lines on the chest. A lifted wing appears during greeting/celebration reactions. Swimming hides the feet under the water. `full-body-states.png` and `states.png` retain the previous versions for comparison. All existing mascot containers and interaction hooks remain in use. The previous yellow mascot preview remains in `docs/yellow-redesign/mascot-states.png` for comparison.

The Daily progress pond alone uses a right-facing side-profile duck, including its visible side wing, tail and orange bill. It retains the progress-position movement, swimming state, ripples and reduced-motion handling. `daily-progress-side.png` shows the updated local card. Other placements keep the clean front view.

Full-body pose references researched at the user's request: [Cheems examples](https://knowyourmeme.com/editorials/guides/who-was-cheems-the-meme-famous-shiba-inu-dog-that-recently-passed-away-the-history-of-the-dog-sometimes-mistaken-for-doge-explained) and [walking-duck artwork](https://www.redbubble.com/i/tote-bag/Happy-walking-duck-meme-by-rozdolf/91490710.A9G4R). These are visual references only; the application continues to draw its own SVG character and does not load third-party artwork.

Verified on November 11, 2026: 214 Node tests, JavaScript syntax and diff checks; browser checks at 390 and 1280 px for all seven placements, six state transitions, task modal, Dashboard/Calendar navigation and reduced-motion behavior.
