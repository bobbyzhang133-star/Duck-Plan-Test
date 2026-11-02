# Glass planner buttons — 2026-11-01

Fur checkpoint: git tag `checkpoint/fur-texture-2026-11-01`, commit `073ef53` on Duck-Plan-Test. This preserves both the approved fur and the experimental curved renderer, tunings, labs, Blender reference and comparison recordings. The labs remain available in the current checkout; no reset or deletion is needed to revisit them.

The main planner now uses lightweight CSS glass buttons with native text/icons, translucent white/yellow fills, blurred backgrounds, edge lighting, immediate press compression and a short release highlight centered at pointer contact. Keyboard contact is centered. Dense calendar cells/task rows keep their existing lightweight feedback. The planner no longer imports fur rendering, formation or workspace transition scripts and creates zero decorative canvases. Navigation updates immediately. This is a web interpretation, not Apple's native Liquid Glass renderer.

Guidance: https://developer.apple.com/design/human-interface-guidelines/materials

Shared three-stage feedback remains required; the current default material in the project rule is glass. Dedicated fur labs remain opt-in. Reduced motion removes movement while preserving a static release tint; reduced transparency/greater contrast use solid fills; unsupported backdrop-filter has an opaque fallback; disabled controls suppress interaction effects. Small controls alone receive blur, not every calendar time slot.

Local preview: http://127.0.0.1:4208/index.html#home

No public deployment or shared group repository modification. TEST feature-branch backup only.

Verification: all102 Node regressions pass; changed JS syntax and whitespace checks pass. Event-level checks exercised held press → release → cleanup, pointer contact coordinates, centered keyboard input, cancellation and disabled suppression. Browser checked Day/Week selection, navigation/settings and keyboard dialog cancellation; actual hover/release computed styles use12px blur and glass-release; zero canvases/scripts for fur; no console warnings/errors. At390px, document scroll width equals viewport width. OS reduced-motion/transparency preferences were not emulated; their CSS overrides were inspected. Saved `home.jpg` and `dialog.jpg` show the local result.
