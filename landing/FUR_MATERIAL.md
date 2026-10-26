# DuckPlan interactive fur material

## Architecture

`fur-material.js` renders short duck-down-inspired fibers with native WebGL2. Each fiber is an instanced tapered strand with a fixed root, natural length/orientation variation, dynamic bend vector, compression/depression state, and spring velocity. A surface uses one draw call rather than one DOM node per fiber.

Pointer movement adds localized directional impulses with distance falloff. Each event sweeps a continuous segment from the previous pointer position, so fast motion cannot leave untouched gaps between sparse browser events. Every disturbed fiber owns its own hold timer; activity in one region no longer postpones recovery elsewhere. A press uses a three-zone contact profile: the center shortens, broadens, darkens, and moves inward; a continuous transition ring folds and splays; the outer pile fades smoothly to neutral. After each fiber's short hold, stored targets decay at seed-varied rates to approximate friction and entanglement. The frame-rate-independent overdamped spring then returns each state channel and explicitly snaps tiny residual values to neutral.

## Source-level causes and fixes

- **Blurry words:** the earlier single-resolution binary canvas sample aliased at glyph edges, and long translucent label strands crossed those edges. Labels now use a 1–3× canvas, a signed-distance field, bilinear sampling, a tunable transition width, shorter/narrower dark strands, and a dense uniform root grid. The ordinary DOM label remains the accessible name but is visually transparent when WebGL succeeds.
- **Stuck recovery:** the old surface-wide recovery countdown was reset by every brush event, so unrelated fibers could be held indefinitely and animation could stop with residual state. Recovery is now per fiber, active press ownership is explicitly released on every input interruption, meaningful deformation keeps the frame loop alive, and state/velocity/targets are zeroed only inside the documented tolerance.
- **Press looked like dispersal:** the previous model primarily bent `xy` outward and shortened strands. State now includes a separate depression channel. Central fibers retain geometry, gain width and root occlusion while shortening, transition fibers splay smoothly, and depth-dependent shading communicates an inward surface impression without cutting a circular hole.

## JavaScript → shader data layout

| Buffer | JS stride | Vertex attribute | Meaning |
| --- | ---: | --- | --- |
| `rootSeeds` | 6 floats | `a_root.xy`, `a_seed.xyzw` | normalized root x/y; length variation; initial orientation; appearance variation; recovery variation |
| `state` | 4 floats | `a_state.xyzw` | bend x/y; compression; depression |
| `materialMask` | 2 floats | `a_material.xy` | signed-distance label membership; silhouette-edge membership |

`roots` is a CPU-side two-float copy used for interaction distance queries. `velocity` and `pressTargets` mirror the four-state layout but are not uploaded as vertex attributes. `recoveryHold` and `activePress` are per-fiber CPU arrays. The lab's live strand diagnostic exposes bend, compression, depression, and hold time for the strand nearest the pointer.

## Physical references

- Matthew Fuller's University of Leeds research on duck, goose, and eider down describes branching barbules that occupy space efficiently and reports excellent compressibility and compression recovery: <https://etheses.whiterose.ac.uk/id/eprint/9268/>
- Experiments on indentation of hairy surfaces attribute loading–unloading hysteresis to friction between fibers and between the pile and the indenter. DuckPlan approximates that effect with delayed, varied target decay rather than a perfectly simultaneous release: <https://doi.org/10.1016/j.triboint.2014.11.009>

The vertex shader changes the projected strand geometry. The fragment shader provides darker roots, cream-colored tips, orientation-dependent lighting, and compression-dependent occlusion. The approved PNG is used only when WebGL2 is unavailable or a context is lost.

Production buttons use a fur-only silhouette mode. A rounded-rectangle distance field removes corner fibers without drawing a CSS border, while longer boundary strands lean outward to make a soft natural edge. A high-DPI signed-distance glyph field assigns consistent label membership to the uniform fiber grid; short, narrow, dark-brown strands form the visible words at production scale. The original HTML label remains in the accessibility tree but is visually transparent, and keyboard focus keeps its separate high-contrast outline.

## Integration choice

The app is buildless, and this material does not need Three.js scene management, cameras, loaders, or a general-purpose object graph. Native WebGL2 keeps the production payload dependency-free. DuckPlan creates renderers only for `.primary-button` and `.dark-button` controls, rather than every button.

Each selected surface currently owns a small WebGL context. This is appropriate for the three visible/available production surfaces and keeps clipping and stacking reliable. If the material expands to many simultaneous controls, replace these contexts with a shared atlas/scissor renderer.

## Performance and lifecycle

- Low, medium, and high quality levels centralize pixel density, strand density, and fiber caps.
- Production buttons use medium quality and generally render roughly 5,000–8,000 fibers, depending on their area, to keep fur-built lettering legible.
- The lab's high-quality surface renders up to 30,000 fibers in one instanced draw call, while production controls use a denser medium-quality profile sized to their area.
- Rendering stops when the spring reaches rest, the surface leaves the viewport, or the document becomes hidden.
- Performance is displayed live in the material lab so high-density tuning can be checked on the current device. The 30,000-fiber surface sustained 60 FPS during a held-press test on the development machine.
- Low-power devices reduce device-pixel ratio automatically.
- A 2× glyph field is the production default. Moving to 3× increases CPU-side mask construction cost but does not increase the GPU draw-call count.

## Accessibility and fallback

The canvas is decorative, `aria-hidden`, and cannot receive pointer events. Native HTML buttons retain their focus, keyboard, disabled, and click behavior. Reduced Motion disables brushing physics and uses an immediate static press state. Context loss and missing WebGL2 switch the surface to the static approved texture.

Fur-enabled controls do not scale, translate, or darken as a whole while hovered or pressed. Press feedback comes exclusively from localized strand deformation so the underlying surface remains physically stationary. Pointer-down immediately imprints most of the local depression, then the spring simulation completes the compression and recovery.

## Material lab

Open `fur-lab.html` from a local server or use Settings → Interactive fur lab. It provides a large inspection surface; 1×, 2×, and production-size lettering comparisons; quality, density, fiber length, label sharpness, radius, recovery, spring, press-depth, compression, splay, and transition controls; a neutral-state reset; and live renderer/strand diagnostics. Recovery delay is adjustable from 0–5,000 ms and defaults to a more plausible 280 ms. The default stiffness and damping are intentionally overdamped for a controlled, non-bouncy return.

Automated Node regression tests cover the three-zone profile, independent recovery holds, interrupted input, repeated rapid gestures, and complete rest. Rest is accepted only when each target is within `0.0015`, state within `0.0015`, and velocity within `0.002`.

## Known limitations

This is a stylized real-time strand model, not a physically based 3D hair solver or photorealistic feather simulation. Depression is encoded per strand rather than through a tessellated mesh height field; self-shadowing and occlusion are shader approximations; and fibers are screen-facing tapered quads rather than volumetric cylinders. These limits keep one instanced draw call per surface and preserve button responsiveness. Final realism and the smallest glyph sizes still require visual verification on each target display.
