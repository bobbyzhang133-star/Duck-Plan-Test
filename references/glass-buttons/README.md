# Glass planner buttons — 2026-11-01

Fur checkpoint: git tag `checkpoint/fur-texture-2026-11-01`, commit `073ef53` on Duck-Plan-Test. This preserves both the approved fur and the experimental curved renderer, tunings, labs, Blender reference and comparison recordings. The labs remain available in the current checkout; no reset or deletion is needed to revisit them.

The main planner now uses lightweight CSS glass buttons with native text/icons, translucent white/yellow fills, blurred backgrounds, edge lighting, immediate press compression and a short release highlight centered at pointer contact. Keyboard contact is centered. Dense calendar cells/task rows keep their existing lightweight feedback. The planner no longer imports fur rendering, formation or workspace transition scripts and creates zero decorative canvases. Navigation is immediate; only popout windows use button-origin transitions (see below). This is a web interpretation, not Apple's native Liquid Glass renderer.

Guidance: https://developer.apple.com/design/human-interface-guidelines/materials

Shared three-stage feedback remains required; the current default material in the project rule is glass. Dedicated fur labs remain opt-in. Reduced motion removes movement while preserving a static release tint; reduced transparency/greater contrast use solid fills; unsupported backdrop-filter has an opaque fallback; disabled controls suppress interaction effects. Small controls alone receive blur, not every calendar time slot.

Local preview: http://127.0.0.1:4208/index.html#home

No public deployment or shared group repository modification. TEST feature-branch backup only.

Verification: all102 Node regressions pass; changed JS syntax and whitespace checks pass. Event-level checks exercised held press → release → cleanup, pointer contact coordinates, centered keyboard input, cancellation and disabled suppression. Browser checked Day/Week selection, navigation/settings and keyboard dialog cancellation; actual hover/release computed styles use12px blur and glass-release; zero canvases/scripts for fur; no console warnings/errors. At390px, document scroll width equals viewport width. OS reduced-motion/transparency preferences were not emulated; their CSS overrides were inspected. Saved `home.jpg` and `dialog.jpg` show the local result.


## Button-origin transitions — 2026-11-01

Only popout windows (task dialogs) grow from the triggering button's measured center and dimensions and close toward that saved launcher. The sidebar slides in/out over220ms while taking layout space and reframing the main panel at the same depth. Page and calendar switching stays immediate, without button-origin scaling. Use Add task or an edit menu to review the popout effect locally.

The shared `popup-motion.js` uses native Web Animations with transform/opacity only, using the shared damped timing profile (currently240ms opening,300ms closing). Dialog backdrop fades alongside the surface. Native semantic dialog stays open until closing ends; Cancel, close button, backdrop, Escape, save and delete share the same path. Focus returns to the launcher (or a surviving control when the original was replaced). Animated reopening samples the interrupted transform and cancels stale close callbacks. Resize/hidden-page/motion-preference changes finish pending work and remove animation state. Reduced motion completes synchronously without scaling. No fur or extra canvas is loaded.

Verification:107 Node tests pass, including launcher geometry, disconnected source fallback, deferred close, interrupted reopening, reduced motion and resize cleanup. Browser observed opening/closing transforms, no retained animation phase after close, dialog Escape and focus return, drawer return, Day selection, mobile-width resize settlement, zero canvases and no console errors. OS reduced-motion preference behavior is covered by mocked lifecycle tests, not an OS preference toggle. `popup-open.jpg` is a captured live frame, not a recording of the full motion. Full performance benchmarking and user visual approval remain pending. Local-only review; no public deployment.

Scope correction: restored the original CSS sidebar slide at user request and removed button-origin motion from regular pages and calendar views. Browser confirmed sidebar has a220ms transform transition with no popup animation state, settings/classes switch without popup state, and dialog still enters opening/closing phases. Screenshot: `sidebar-slide.jpg`.107 tests remain passing.


## Docked sidebar — 2026-11-01

The sidebar now shares a grid row with the workspace instead of floating above it. Its opening track grows from0 to250px with the same shared damped easing as its slide; the main column shrinks to the remaining width and its contents respond to that column's size. Closing reverses the reframe. Removed the dimming/blur scrim and workspace inert state: users can operate the main page while navigation is open. Escape closes navigation unless a native dialog is above it. The sidebar has no cast shadow over the workspace.

Container queries reflow task/calendar and class/header content to the available main width. At1280px, the open sidebar ends at250px and the main panel occupies the remaining1030px with no horizontal overflow. At390px, navigation becomes a76px labeled rail and content occupies314px with no horizontal document/workspace overflow. Closing restored the measured main width to390px. Actual phone hardware is not benchmarked. Screenshots: `sidebar-docked-desktop.jpg`, `sidebar-docked-mobile.jpg`, `sidebar-docked-classes.jpg`.

107 regressions pass; JS syntax and whitespace checks pass. Browser checked main-panel interaction while docked, popout Escape leaving navigation open, close-to-full-width behavior, desktop task/calendar layout, mobile rail/close control separation, and no console errors. Popup-origin animation remains limited to native task dialogs. No public deployment or shared repository edits.


## Edge toggle and shared damping — 2026-11-01

Navigation now uses one persistent glass handle on the left edge, vertically centered. Opened, it follows the sidebar/workspace seam; the same button closes it. Removed header hamburger copies and the separate sidebar X. Its visible tab is28×64px with a transparent extension to its pointer hit area; native button semantics, expanded state, directional glyph, keyboard focus and Escape remain. The header no longer reserves a toggle column.

`landing/motion-tokens.js` defines a normalized critically damped step response `1−(1+9t)exp(−9t)` and samples it into a61-point CSS `linear()` easing. This is a motion-design curve, not a running spring solver. It accelerates then settles monotonically, without overshoot/repeated bounce. Older engines receive a monotonic cubic fallback. CSS transitions, button release, popup Web Animations and backdrop fades consume shared tokens. Layout/sidebar/handle480ms; control transitions240ms; immediate press80ms; release400ms; popup open240ms/close300ms. Sidebar track, slide and handle stay synchronized. Button release no longer overshoots scale1. Switches, toast, progress and other existing animated planner surfaces share the timing response. Page/calendar switching remains immediate as previously requested; no new page-origin effect or artificial typing/scroll delays. Fur labs remain unchanged.

A keyboard fix tracks the originally pressed control across focus changes, preventing Enter-opened navigation from leaving the handle stuck pressed. Reduced motion bypasses popup movement and suppresses transition/release movement while retaining state feedback.

112 tests pass, including monotonic response endpoints/bounds, easing fallback, shared popup token consumption, and keyboard release after focus moves. Changed JS syntax/diff checks pass. Browser confirmed480ms matching sidebar/track/handle timing with supported sampled easing, seam alignment (handle center250px with main start250px), persistent keyboard open/close, popout Escape leaving navigation open, mobile390px closed main width390px/no document overflow, and no console errors. OS preference toggling and physical-device performance are not separately benchmarked. Screenshots: `edge-toggle-mobile.jpg`, `edge-toggle-desktop.jpg`.

2026-11-02 — Popout opening shortened from380ms to240ms at user request. The damped curve now uses61 samples for finer interpolation; response shape, sidebar/control/closing durations and reduced-motion behavior remain. Focused motion/popup suite:9 tests pass. Browser confirmed240ms token and61 samples, opening/dismissal works and no console warnings/errors. Local screenshot `popup-fast.jpg`; no public deployment.
