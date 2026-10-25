# DuckPlan interactive fur material

## Architecture

`fur-material.js` renders short duck-down-inspired fibers with native WebGL2. Each fiber is an instanced tapered strand with a fixed root, natural length/orientation variation, dynamic bend vector, compression value, and spring velocity. A surface uses one draw call rather than one DOM node per fiber.

Pointer movement adds localized directional impulses with distance falloff. Pressing creates a persistent local compression target and bends nearby strands away from the contact point. A frame-rate-independent spring–damper simulation returns each strand to its resting state after release.

The vertex shader changes the projected strand geometry. The fragment shader provides darker roots, cream-colored tips, orientation-dependent lighting, and compression-dependent occlusion. The approved PNG is used only when WebGL2 is unavailable or a context is lost.

## Integration choice

The app is buildless, and this material does not need Three.js scene management, cameras, loaders, or a general-purpose object graph. Native WebGL2 keeps the production payload dependency-free. DuckPlan creates renderers only for `.primary-button` and `.dark-button` controls, rather than every button.

Each selected surface currently owns a small WebGL context. This is appropriate for the three visible/available production surfaces and keeps clipping and stacking reliable. If the material expands to many simultaneous controls, replace these contexts with a shared atlas/scissor renderer.

## Performance and lifecycle

- Low, medium, and high quality levels centralize pixel density, strand density, and fiber caps.
- Production buttons use medium quality and generally render a few hundred fibers.
- The lab's high-quality surface renders up to 9,000 fibers in one instanced draw call.
- Rendering stops when the spring reaches rest, the surface leaves the viewport, or the document becomes hidden.
- On the development machine, the 9,000-fiber lab surface sustained 60 FPS during a held press.
- Low-power devices reduce device-pixel ratio automatically.

## Accessibility and fallback

The canvas is decorative, `aria-hidden`, and cannot receive pointer events. Native HTML buttons retain their focus, keyboard, disabled, and click behavior. Reduced Motion disables brushing physics and uses an immediate static press state. Context loss and missing WebGL2 switch the surface to the static approved texture.

## Material lab

Open `fur-lab.html` directly or use Settings → Interactive fur lab. It provides a large inspection surface, a production-size button, quality controls, density, fiber length, stiffness, damping, interaction radius, reset, and live renderer statistics.

## Known limitations

This is a stylized real-time strand model, not a physically based 3D hair solver or photorealistic feather simulation. Self-shadowing and occlusion are shader approximations, and fibers are screen-facing tapered quads rather than volumetric cylinders. The model prioritizes tactile local deformation, responsiveness, and button-scale readability.
