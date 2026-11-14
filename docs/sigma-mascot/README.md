# Sigma mascot

**Approved profile picture and app icon:** the user selected v11 on November 12, 2026. Keep this design as DuckPlan's default icon unless a change is requested. The website and existing Xcode project use the same approved artwork.

November13 follow-up: the user requested removal of the exterior background for website branding/profile. Ordinary website icons now use the [transparent v11 derivative](../transparent-web-icon/README.md), with the white duck and original facial/contour artwork preserved. The opaque source/native icon and platform maskable/Apple-touch exports remain available. The reproduction/history below describes the approved opaque master, not a new drawing.

The app profile, sidebar and favicon use `landing/assets/duckplan-sigma-head-v11.png` and its 192/512px exports. The user's latest screenshot restores the earlier Sigma face found in [the existing v3 image](../../landing/assets/duckplan-sigma-head-v3.png): both curved eyebrows, half-lidded eyes and the rounded orange bill. V11 copies the entire facial group together under one uniform affine scale, preserving the relative proportions and placement of its features. It does not stretch individual eyes/brows/bill or generate new facial artwork. This selection supersedes the human-photo and larger oval-eye interpretations from v7–v10. The approved copied original outer contour remains protected. The native icon copies the opaque 1024px master directly. Previous images remain available.

The byte-identical original is [source/original-duck-reference.png](source/original-duck-reference.png). Following the user's copy-and-paste instruction, the compositor rotates its actual pixels 45.0187 degrees clockwise, then applies one uniform scale and crop. The crop stops before the screenshot's clipped contour endpoints, so no neck extension is invented.

The retained [v6 rotated baseline](v6-preservation/rotated-original.png), [facial mask](v6-preservation/facial-edit-mask.png) and [preservation report](v6-preservation/preservation-report.json) document the approved outline. V11 writes its own [rotated baseline](v11-preservation/rotated-original.png), [facial edit mask](v11-preservation/facial-edit-mask.png) and [preservation report](v11-preservation/preservation-report.json). The compositor requires zero changed outline pixels and zero changes outside the permitted facial mask. The bill intentionally changes because the complete earlier face, including its rounded bill, is restored. The current facial source is the existing v3 raster; there is no new image-generation prompt or replacement feature layer for v11.

V10 history retains its [baseline](v10-preservation/rotated-original.png), [mask](v10-preservation/facial-edit-mask.png) and [report](v10-preservation/preservation-report.json), using the earlier [v9 feature layer](source/duck-eye-features-v9.png) and its [prompt](source/duck-eye-features-v9-prompt.txt).

V9 history retains its [baseline](v9-preservation/rotated-original.png), [mask](v9-preservation/facial-edit-mask.png) and [report](v9-preservation/preservation-report.json), along with its larger duck-eye/brow placement.

V8 history retains its [baseline](v8-preservation/rotated-original.png), [mask](v8-preservation/facial-edit-mask.png), [report](v8-preservation/preservation-report.json) and [narrow-expression feature source](source/narrow-expression-features-v8.png).

V7 history retains its [baseline](v7-preservation/rotated-original.png), [mask](v7-preservation/facial-edit-mask.png), [report](v7-preservation/preservation-report.json) and [raised-brow feature source](source/raised-brow-features-v7.png). That earlier mode protected both the original outline and beak.

Rebuild from the repository root on macOS:

```sh
xcrun swiftc -O -module-cache-path /private/tmp/duckplan-icon-module-cache tools/build-original-outline-icon.swift -o /private/tmp/duckplan-build-original-icon
/private/tmp/duckplan-build-original-icon --restore-sigma-face
```

V11 verification on November 12, 2026: independent pixel comparison confirms zero edits outside the facial mask and an unchanged original contour. All five facial features use the same scale/translation; 126,330 checked feature-interior pixels match v3 after the shared transform and color conversion. All 215 tests pass in both checkouts, local branding loads without errors, and the existing iPhone build succeeds. All 92 bundled web files match source and its native icon equals the opaque master; eight native Swift/project/plist files remain unchanged. [profile-v11-sidebar.png](profile-v11-sidebar.png) shows the local rendering. No physical-phone installation or production deployment was performed.

V10 verification on November 12, 2026: independent decoded-pixel comparison confirms zero edits outside the facial mask, a byte-identical rotated baseline, and unchanged original contour, v9 brows and v8 bill. Visible eye bounds are 151×122 and 137×81 pixels, giving a 1.51 height ratio. All 215 tests pass in both checkouts; local branding loads without errors. The existing iPhone project builds successfully, all 89 bundled web files match source, and its native icon matches the opaque master. Eight native Swift/project/plist files remain unchanged. [profile-v10-sidebar.png](profile-v10-sidebar.png) shows the local rendering. No physical-phone installation or production deployment was performed.

Use `--reference-eye-proportions` to reproduce v10, `--duck-eyes` for v9, `--compact-expression` for v8, `--raised-brow` for v7, or omit all expression flags for v6. The source geometry, facial-group crop/placement and earlier generation prompts are recorded in `landing/assets/duckplan-sigma-head-notes.md`.

V9 verification on November 12, 2026: the compositor records zero changed original-outline pixels and zero changes outside the facial-edit mask. All 215 Node tests pass; local branding loads without errors. The existing iPhone project builds successfully, all 86 bundled web files match source, and the native icon equals the opaque master. Eight native Swift/project/plist files remain unchanged. [profile-v9-sidebar.png](profile-v9-sidebar.png) shows the local rendering. No physical-phone installation or production deployment was performed.

V8 verification on November 12, 2026: the compositor reports zero changed original-outline pixels and zero changes outside its facial-edit mask. The original bill intentionally changes with the authorized 82% width/85% height transform and 20px downward shift. All 215 Node tests pass; the local browser loads v8 branding without errors. The existing iPhone project builds successfully, all 83 bundled web files match source, and the native icon matches the opaque master. Eight native Swift/project/plist files remain unchanged. [profile-v8-sidebar.png](profile-v8-sidebar.png) shows the local rendering. No physical-phone installation or production deployment was performed.

V7 verification on November 12, 2026: independent PNG comparison found 43,014 facial pixels changed and zero changes outside the facial-edit mask. The v7 rotated baseline is byte-identical to v6. All 215 Node tests pass; the local browser loads the v7 brand/favicon without errors. The existing iPhone project builds successfully, all 80 bundled web files match source, and its native icon matches the opaque master. Eight Swift/project/plist files remain unchanged. [profile-v7-sidebar.png](profile-v7-sidebar.png) shows the local brand rendering. No physical-phone installation or production deployment was performed.

Full-body UI poses remain native SVG markup in `landing/duck-mascot.js`, styled by `landing/duck-theme.css`, using the earlier `landing/assets/duckplan-sigma-head-v3.png` as their visual reference. Their drawings, placements and reactions are unchanged by the app-profile edit.

`front-view-states.png` is the current preview: happy, sleepy, focused, encouraging, celebrating and swimming. Front views have a plain rounded body outline, scaled Sigma head and webbed feet, with no visible tail or feather/wing lines on the chest. A lifted wing appears during greeting/celebration reactions. Swimming hides the feet under the water. `full-body-states.png` and `states.png` retain the previous versions for comparison. All existing mascot containers and interaction hooks remain in use. The previous yellow mascot preview remains in `docs/yellow-redesign/mascot-states.png` for comparison.

The Daily progress pond alone uses a right-facing side-profile duck, including its visible side wing, tail and orange bill. It retains the progress-position movement, swimming state, ripples and reduced-motion handling. `daily-progress-side.png` shows the updated local card. Other placements keep the clean front view.

Full-body pose references researched at the user's request: [Cheems examples](https://knowyourmeme.com/editorials/guides/who-was-cheems-the-meme-famous-shiba-inu-dog-that-recently-passed-away-the-history-of-the-dog-sometimes-mistaken-for-doge-explained) and [walking-duck artwork](https://www.redbubble.com/i/tote-bag/Happy-walking-duck-meme-by-rozdolf/91490710.A9G4R). These are visual references only; the application continues to draw its own SVG character and does not load third-party artwork.

Verified on November 11, 2026: 214 Node tests, JavaScript syntax and diff checks; browser checks at 390 and 1280 px for all seven placements, six state transitions, task modal, Dashboard/Calendar navigation and reduced-motion behavior.
