# Transparent website duck icon

November13,2026: removed the exterior off-white rectangle from the user-marked sidebar duck and the website profile/favicon. The approved v11 artwork remains the source; there is no new face, reshaping, scaling or repositioning in the1024px master.

## Assets and scope

- [Transparent1024px master](../../landing/assets/duckplan-sigma-head-v11-transparent.png)
- [Transparent192px web export](../../landing/assets/duckplan-sigma-icon-v11-transparent-192.png)
- [Transparent512px web export](../../landing/assets/duckplan-sigma-icon-v11-transparent-512.png)

The sidebar, favicon, ordinary manifest `any` icons/shortcuts and web notification artwork use these derivatives. Explicit `maskable` entries retain the original opaque exports because the platform supplies their icon plate. The existing Apple touch/native exports remain opaque and byte-identical; the account profile's initials and full-body mascot poses are unchanged. This request updates only the local website checkout, not the independent Xcode bundle or a hosted deployment.

## Pixel preservation

The [native Swift exporter](../../tools/export-transparent-icon.swift) verifies the exact approved source SHA before working. It uses the existing source's dark contour as a barrier for exterior flood fill, seeded from the top/sides rather than the white neck at the bottom. Enclosed artwork is copied with its original RGB and full opacity. Only exterior-connected antialias pixels receive an alpha matte/neutral edge cleanup, avoiding an off-white or blue fringe. The192/512exports use high-quality premultiplied-alpha resampling.

The built-in image-editing tool was tried first, but its1254px result changed the canvas dimensions and was rejected. Its prompt/mode are retained in [image-edit-attempt.md](image-edit-attempt.md). No generated facial/outline pixels are used in the final files; the existing native asset-export workflow preserves the original drawing.

[Export report](../sigma-mascot/transparent-v11/export-report.json), [independent decoded-pixel report](../sigma-mascot/transparent-v11/independent-pixel-qa.json), [protected interior mask](../sigma-mascot/transparent-v11/protected-interior-mask.png) and [independent validator](../sigma-mascot/transparent-v11/validate.swift) establish:

- 1024×1024canvas retained;369,061clear exterior pixels and25,587partial antialias pixels.
- 653,928opaque pixels have zero RGB changes.
- 340,400central face/body pixels remain fully opaque with zero RGB changes.
- 145,300very-dark core pixels (maximum RGB channel below60) retain RGB and opacity.
- All four exterior corners are transparent; the white body/neck remains opaque.
- The original opaque master/native icon retain SHA `7714bd8afc68d05399841291712d57cfcb62ad729eec3cd58e570670156501f5`.

Final derivative SHAs: master `8964decdb6dc2448a21beb1ea5fa92ebc979cd1f7c2eb19b61e1320e70eb78db`;192px `cd6c62abeb39b3e03d4e78c3aa60b933780a1aaa5572bc8caeeb57739fb8a220`;512px `b27878a0f5f7fbc9be4891b294f8b5eff2155a7990e2df200e938fe06db443fb`.

To reproduce on macOS from this repository root:

```sh
xcrun swiftc -O -module-cache-path /private/tmp/duckplan-transparent-modules tools/export-transparent-icon.swift -o /private/tmp/duckplan-export-transparent-icon
/private/tmp/duckplan-export-transparent-icon
xcrun swiftc -O -module-cache-path /private/tmp/duckplan-transparent-qa-modules docs/sigma-mascot/transparent-v11/validate.swift -o /private/tmp/duckplan-transparent-icon-qa
/private/tmp/duckplan-transparent-icon-qa landing/assets/duckplan-sigma-head-v11.png landing/assets/duckplan-sigma-head-v11-transparent.png
```

## Verification

Thirteen existing PWA/cache/notification checks pass. Script syntax, manifest JSON and diff checks pass. No persistence, authentication, backend or motion behavior changed.

[Browser runner](qa.js) and [results](results.json): four fresh Chromium157.0.8103.78 workflows pass, covering light/dark835px folded/expanded sidebar,390px layout/favicon and browser service-worker offline reload. Brand navigation still opens Calendar; mark/image geometry stays36×36 with no wrapper border/backing/shadow or overflow. Actual canvas decoding confirms clear exterior and opaque body for both web sizes, while the old platform exports remain opaque. Manifest `any`/`maskable` references are separated correctly.

The final run verifies served192/512SHAs against the final files, including after cachev40offline reload. Zero page errors, missing assets or API/external requests were recorded; all isolated contexts closed. These are Chromium/emulated-phone and browser-cache checks, not installed-PWA, physical-device or notification-delivery claims.

The user's actual open local Calendar was checked for an unsaved dialog/editor before refresh. It now loads the transparent sidebar/favicon paths, retains the360ms route motion and existing planner data. A small screenshot of that user context remains private temporary evidence; the committed light/dark screenshots use isolated fixture data. No public deployment, shared-main change, native synchronization or physical-phone install occurred.
