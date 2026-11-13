# Upright sigma duck profile

The current outline uses the user's original duck pixels, copied and rotated with
the deterministic Swift compositor. Facial features are composited inside that
protected contour. Earlier generated versions and their prompts are retained below.

Current master: duckplan-sigma-head-v9.png. Current app exports:
duckplan-sigma-icon-v9-192.png and duckplan-sigma-icon-v9-512.png.
Earlier icons are retained for comparison.

## Larger duck-like eyes and eyebrows (v9, November 12, 2026)

The user requested more duck-like eyes and larger eyes/eyebrows. V9 uses simple solid-black oval eyes, one half-lidded, retaining the raised viewer-left brow and the closer eye spacing from v8. In compositor coordinates, eye placement width is 42 instead of 35 (20% larger), and brow placement width is 49 instead of 39 (about 26% larger). The exact approved copied outer contour stays locked.

`tools/build-original-outline-icon.swift --duck-eyes` composites `docs/sigma-mascot/source/duck-eye-features-v9.png` inside the permitted face area. It retains v8's authorized original-bill transform: 82% width, 85% height and a 20px downward shift. Evidence is written to `docs/sigma-mascot/v9-preservation/`; the outline and pixels outside the facial mask must remain unchanged. Original-bill pixels intentionally differ from the rotated original, as authorized for v8. The exact [feature-layer prompt](../../docs/sigma-mascot/source/duck-eye-features-v9-prompt.txt) is saved beside the source. Exports remain opaque 1024px native and 192/512px web icons.

Use `--compact-expression` for v8, `--raised-brow` for v7 or no expression flag for v6. Their sources, proofs and methods remain below.

## Narrower expression and permitted bill adjustment (v8, November 12, 2026)

The user found v7's eyes too wide and permitted changes to the bill/nose to emphasize the expression. V8 keeps the exact approved outer contour, with narrower almond-shaped eyes, closer eye spacing and one raised viewer-left brow. The original bill is intentionally scaled down using a deterministic transform; the earlier promise to preserve every original beak pixel does not apply to this authorized facial edit.

`tools/build-original-outline-icon.swift --compact-expression` uses the retained original screenshot and `docs/sigma-mascot/source/narrow-expression-features-v8.png`. Its permitted facial mask includes the eye/brow changes and the original and transformed bill areas. It writes the master and evidence to `docs/sigma-mascot/v8-preservation/`. The outline and all pixels outside the facial mask must remain unchanged; changed original-bill pixels are expected. Exports remain opaque 1024px native and 192/512px web icons. The exact [expression-feature prompt](../../docs/sigma-mascot/source/narrow-expression-features-v8-prompt.txt) is retained beside the feature source.

The compositor's `--raised-brow` mode reproduces v7; running without either expression flag reproduces v6. Their sources, proofs and methods remain below for history.

## Raised-brow expression inside the approved outline (v7, November 12, 2026)

The user approved v6's copied outline, then supplied a new photo as the facial-expression reference. V7 preserves the exact original rotated contour and beak. Only the facial expression changes: viewer-left eyebrow raised, viewer-left eye more open and the other eye narrower for an asymmetric skeptical look. The reference photo does not supply a new head shape or outline.

`tools/build-original-outline-icon.swift --raised-brow` uses the retained original screenshot and `docs/sigma-mascot/source/raised-brow-features-v7.png`, compositing the expression components only inside the permitted face area. It writes the master and separate preservation evidence to `docs/sigma-mascot/v7-preservation/`, while retaining the v6 source and proof. Guards reject changes to the outline, beak or pixels outside the facial mask. Exports remain opaque 1024px native and 192/512px web icons.

The built-in imagegen tool produced only a transparent eye/brow layer from the user-supplied November 12 expression photo and v6's line-art style. The compositor keeps its generated alpha source intact and composites the black features into the original face. No generated contour is used. The exact [expression-feature prompt](../../docs/sigma-mascot/source/raised-brow-features-v7-prompt.txt) is saved beside that layer.

## Original pixels copied and rotated (v6, November 12, 2026)

The user explicitly requested copying/pasting the actual original outline, straightening it and adding the facial expression inside. This version uses deterministic raster compositing, not image generation. The original screenshot is copied unchanged to `docs/sigma-mascot/source/original-duck-reference.png`; its SHA-256 is `ce8a703ac230a5e754f5178a9f1cdeac2e25d7dcf1c776d8eedcc288949d66a4`.

`tools/build-original-outline-icon.swift` rotates the source 45.0186698039 degrees clockwise around the original eye midpoint, then applies one uniform scale and crop. The 280px square crop ends before either screenshot-clipped neck contour, so no missing outline is reconstructed. The original beak stays intact. Only the old eye components are erased; existing Sigma eyes/brows are composited inside the face, with guards protecting the outline and bill.

The saved rotated-source baseline, facial edit mask and preservation report are in `docs/sigma-mascot/v6-preservation/`. Independent raw-PNG comparison confirms zero changed pixels outside the facial mask; the outline and beak have zero changes relative to the rotated baseline. The master is 1024px RGB without alpha; web exports are 192/512px and the native icon copies the master directly.

## Reference silhouette redraw (v5, November 12, 2026)

The user rejected v4's separate egg-shaped head, cheek bulges and inward taper. Built-in imagegen editing used the original November 9 screenshot as the primary shape reference. The selected result is an upright interpretation with one continuous head/neck contour, broad parallel sides, a lighter outline and the Sigma expression. It is not an exact tracing. Full-body SVG drawings remain unchanged. Native and web exports retain the existing 1024/512/192px sizes.

Selected silhouette prompt:

+ Create the corrected DuckPlan app icon from this original duck reference. The essential correction is the OUTER SHAPE. Draw ONE continuous thin black outline shaped like a softly rounded arch with two almost-vertical sides continuing all the way to the bottom edge. This is a broad white column with a rounded top, NOT a separate bulb-shaped head plus a neck. On a 1254×1254 square: the arch's apex is around (625,175); its sides reach about (215,540) and (1035,540), then continue gently downward near x=215 and x=1035 to the bottom edge. Width at y=800, y=1000 and the bottom must remain about 820px, the same as at the sides of the head. Absolutely no inward-curving waist, cheek lobes, narrowing below the mouth or small stalk. Keep the lines gently hand-drawn and slightly asymmetric like the supplied reference, with lighter stroke thickness about 18–22px, not the thick heavy outline of previous versions. Put the reference duck's simple warm-orange bill and a restrained confident Sigma expression (half-lidded eyes and inward-raised eyebrows) inside the upper part of this ONE broad shape. Keep the duck upright with level eyes. Flat white fill and flat off-white opaque background, no gradients or shading. Crop the broad neck through the bottom edge without a closing horizontal line. No body, shoulders, wings, feet, tail, border, text, screenshot UI or extra objects. One square app icon.

Final outline-legibility prompt:

+ Precise single-change edit of this app icon. Keep the existing outer contour PATH, width, proportions, broad continuous arch and straight sides EXACTLY unchanged. Keep all face features, orange bill shape, expression, positions, colors and background exactly unchanged. Change ONLY the thickness of the outer black silhouette line: make it match the black line thickness around the orange bill, approximately 18–20 pixels on this 1254px square, roughly 1.5–1.8 times the current thin outer contour. Keep the stroke centered on the same path. Do not reshape the figure, introduce cheek bulges or taper the sides. The only visible difference should be a slightly stronger, still simple and lighter-than-the-previous-icon exterior outline for legibility at app-icon sizes. Opaque background, same square canvas.

## Thicker app profile (v4, November 12, 2026)

Created with built-in imagegen editing, using the user's original November 9 tilted duck screenshot as the broad-neck reference. Retains the upright Sigma face while widening and smoothing the lower outer contour. Full-body SVG mascot poses remain unchanged. The native app icon is exported at 1024×1024; website/PWA icons are exported at 192×192 and 512×512.

Final edit prompt:

+ Use case: precise-object-edit. Image 1 is the DuckPlan app-icon edit target. Image 2 is the user's original duck reference for its broad continuous neck. Keep the FACE FEATURES of image 1 exactly unchanged: eyes, eyebrows, orange bill, positions, expression and scale. Correct only the EXTERIOR OUTLINE OF THE LOWER CHEEKS AND NECK. The lower-cheek contour IS allowed to change starting halfway down the image. Delete both pointed inward nicks at the cheek-to-neck junction. Redraw the outside silhouette as a smooth uninterrupted arch continuing into two broad nearly vertical sides, like a thick inverted U: the rounded upper head remains, the widest cheeks flow smoothly downward into the full-width neck, with no inward step, waist, corner or notch. From approximately image y=600 to the bottom at y=1254, the outer left contour should remain near x=210–220 and the right near x=1030–1040, with smooth gentle curvature only. The neck should be at least as wide as the head, clearly thick and stout as in the original reference. Do not preserve the old notched outline. Preserve all interior face artwork and the upper head arch. Same thick black outline, white duck, orange bill, opaque off-white background, upright orientation and square canvas. No shoulders, wings, torso, feet, tail, clothing, text or decorative elements. Return one polished square app icon.

## Broad reference neck correction (v3, built-in image editing)

Edit image 1 (current upright sigma duck) using image 2 (user's original duck) as the exact reference for the broad neck silhouette. The user rejected image 1 because the neck is STILL TOO NARROW. Keep the face, eyes, eyebrows, orange bill, top of head, drawing style, colors and their positions EXACTLY unchanged. Change ONLY the outer silhouette below the widest part of the head. REMOVE THE INWARD PINCH ENTIRELY. The head should continue into a very broad stout neck, nearly as wide as the head, like the original reference when straightened. Both sides should descend almost straight down from the lower cheeks, with a very slight gentle taper at most. At every point below the orange bill, the neck's outer width must be at least 85–90% of the head's widest outer width. At bottom edge the duck fills about 65–70% of full canvas width. No hourglass curve, no concave waist, no stalk, no narrow base, no flaring shoulders. This is a continuous broad white duck neck that exits the bottom edge, not a floating head or bulb on a stem. Head stays upright with level eyes and unchanged approved sigma expression. Retain bold black organic outlines, warm orange bill and off-white flat background. Same square framing and scale. No other changes.

## Neck correction prompt (built-in image editing)

Precise image edit. Image 1 is the edit target: the upright sigma duck avatar. Image 2 is the user's original duck and is the reference for the OUTER HEAD-TO-NECK SILHOUETTE and art style only. Fix ONLY the lower outside contour / neck shape of image 1. The current target neck is far too skinny and pinched, like a lollipop stem. Make the duck's neck broad and naturally continuous with the head as in image 2, while keeping the head upright and untilted. Widen the neck substantially so its width near the bottom is approximately 55–65 percent of the head's widest width, with gently curved sides and a broad open base exiting through the bottom image edge. Start the gentle taper near the lower cheek, and avoid an hourglass pinch or tiny stalk. Preserve image 1's approved sigma facial expression EXACTLY: same eyebrow positions/shapes, same half-lidded eyes, same orange two-lobed beak, same face size and location. Preserve the rounded top of head, same bold near-black organic outline thickness, same white/off-white duck, same orange color, same off-white background, same square framing. Do not introduce shading, human anatomy, shoulders, wings, feet, torso, clothing, text, badge, frame or decoration. The sole visible change should be a broader, reference-faithful head/neck outline. Single square avatar, face upright.

## Generation prompt

Edit the provided reference duck image into a clean square profile avatar for DuckPlan. Keep exactly this same recognizable white cartoon duck and the same simple hand-drawn art style: very thick near-black slightly organic outline, off-white flat background, white/off-white duck, flat warm pale-orange bill, no shading or gradients. Remove all screenshot/UI remnants. Straighten the head so it is upright with its center axis vertical, no tilted/diagonal head. Show only the head and short neck ending at bottom edge, no body/wings/feet. Center it with generous app-icon-safe margins. Give the duck a humorous sigma-face meme expression inspired by the raised inner eyebrows, confident narrowed/half-lidded eyes and pursed smug 'ooh' mouth of the sigma face/Argenby meme: adapt the expression to this duck's orange bill without adding human lips or human anatomy. Both eyes level, slight inward-raised expressive black eyebrow strokes, restrained funny smug expression. The duck must retain the reference's rounded head and distinctive broad soft two-lobed orange bill, viewed front-on or extremely slight three-quarter view; do not turn it into a side-profile duck with one eye. Minimal linework, bold silhouette readable at tiny app icon size. Single duck, no text, no border, no decorative badge, no watermark, no realistic details. Output a polished 1024x1024 square illustration.
