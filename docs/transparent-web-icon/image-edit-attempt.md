# Background extraction — original artwork preserved

The built-in image-editing tool was used in `background-extraction` mode with `transparent_background: true` and the approved `landing/assets/duckplan-sigma-head-v11.png` as the edit target. No CLI/API fallback or new credentials were used.

Exact prompt:

> Use case: background-extraction. Edit target: the attached approved DuckPlan duck icon, 1024x1024. Remove ONLY the exterior off-white rectangular background, making the pixels outside the duck's outer black contour genuinely transparent (alpha zero). Preserve the exact original white/off-white fill INSIDE the duck, the entire broad black outline with its existing slightly soft hand-drawn texture, both eyebrows, half-lidded eyes, orange bill, their positions, scale, proportions, colors and expression. Keep the exact original square canvas, alignment and crop, including where the neck/outline meets the bottom left and right edges. Do not straighten, redraw, simplify, smooth, recolor, restyle, move, enlarge, or invent any part of the duck. Remove the outside background all around the top and sides and the small outside areas at the bottom corners. Keep original antialiased outline edges without an off-white halo. Output a clean transparent PNG cutout, not a checkerboard drawn into an opaque image. This is background removal only, not a new illustration.

The candidate had a real alpha channel but a1254×1254 canvas rather than the original1024×1024. It was rejected rather than resizing/replacing the approved drawing. The candidate remains at its normal generated-image location and is not referenced by the website.

The final project asset instead adds an exterior alpha matte to the existing approved source through a native Swift export. It does not copy generated replacement facial/outline pixels. Pixel-preservation evidence, new asset paths and browser verification are linked from [README.md](README.md).
