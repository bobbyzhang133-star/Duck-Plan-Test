# DuckPlan interactive fur material

## Architecture

`fur-material.js` renders short duck-down-inspired fibers with native WebGL2. Each fiber is an instanced tapered strand with a fixed root, natural length/orientation variation, dynamic bend vector, compression value, and spring velocity. A surface uses one draw call rather than one DOM node per fiber.

Pointer movement adds localized directional impulses with distance falloff. Each event sweeps a continuous segment from the previous pointer position, so fast motion cannot leave untouched gaps between sparse browser events. Hover-brushed and pressed drags both store their swept targets, preserving continuous physical trails that share the configurable recovery delay. A press uses a two-part contact profile: fibers in the center compress almost straight down while the surrounding ring bends outward. After the delay, the frame-rate-independent spring–damper simulation returns each strand to rest. The default spring uses an overdamped response, so fibers lift progressively with little to no overshoot instead of snapping back or bouncing.

The vertex shader changes the projected strand geometry. The fragment shader provides darker roots, cream-colored tips, orientation-dependent lighting, and compression-dependent occlusion. The approved PNG is used only when WebGL2 is unavailable or a context is lost.

## Integration choice

The app is buildless, and this material does not need Three.js scene management, cameras, loaders, or a general-purpose object graph. Native WebGL2 keeps the production payload dependency-free. DuckPlan creates renderers only for `.primary-button` and `.dark-button` controls, rather than every button.

Each selected surface currently owns a small WebGL context. This is appropriate for the three visible/available production surfaces and keeps clipping and stacking reliable. If the material expands to many simultaneous controls, replace these contexts with a shared atlas/scissor renderer.

## Performance and lifecycle

- Low, medium, and high quality levels centralize pixel density, strand density, and fiber caps.
- Production buttons use medium quality and generally render roughly 1,000–2,000 fibers, depending on their area.
- The lab's high-quality surface renders up to 30,000 fibers in one instanced draw call, while production controls use a denser medium-quality profile sized to their area.
- Rendering stops when the spring reaches rest, the surface leaves the viewport, or the document becomes hidden.
- Performance is displayed live in the material lab so high-density tuning can be checked on the current device. The 30,000-fiber surface sustained 60 FPS during a held-press test on the development machine.
- Low-power devices reduce device-pixel ratio automatically.

## Accessibility and fallback

The canvas is decorative, `aria-hidden`, and cannot receive pointer events. Native HTML buttons retain their focus, keyboard, disabled, and click behavior. Reduced Motion disables brushing physics and uses an immediate static press state. Context loss and missing WebGL2 switch the surface to the static approved texture.

Fur-enabled controls do not scale, translate, or darken as a whole while hovered or pressed. Press feedback comes exclusively from localized strand deformation so the underlying surface remains physically stationary. Pointer-down immediately imprints most of the local depression, then the spring simulation completes the compression and recovery.

## Material lab

Open `fur-lab.html` directly or use Settings → Interactive fur lab. It provides a large inspection surface, a production-size button, quality controls, density, fiber length, stiffness, damping, interaction radius, recovery delay, reset, and live renderer statistics. Recovery delay is adjustable from 0–5,000 ms and defaults to 2,000 ms. The default stiffness and damping are intentionally overdamped for a slower, non-bouncy return after the impression has lingered.

## Known limitations

This is a stylized real-time strand model, not a physically based 3D hair solver or photorealistic feather simulation. Self-shadowing and occlusion are shader approximations, and fibers are screen-facing tapered quads rather than volumetric cylinders. The model prioritizes tactile local deformation, responsiveness, and button-scale readability.
