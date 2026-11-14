# Layered spring navigation

This records the `6814b34` snapshot-based baseline. The subsequent [smooth-navigation follow-up](../smooth-navigation/README.md) retains its directional spring while making incoming controls live and interactive.

Local implementation of the [latest review recommendation](../reviews/layered-spring-2026-11-13.md), extending baseline `26c1bf9` on `codex/layered-spring-navigation-20261113`.

The default entrance coordinates three semantic roles: title at 48px, controls at 56px and content at 64px. Their delays are 0/30/60ms; each moves over 440ms, so the last group settles at 500ms. A dedicated sampled spring peaks at 1.058697, producing a 2.82–3.76px bounce. Incoming opacity reaches one over 160ms after its delay. Outgoing content moves 32px over 180ms and fades away in 140ms. Lower sidebar destinations lift outgoing content and enter from below; upper destinations reverse direction. No scale or blur is used.

The backing surface normally moves 16px while the independent semantic captures move farther. When no incoming content root can be captured safely, the bounded backing carries the content's 64px spring and 60ms delay instead. Long task lists therefore retain a visible entrance without allocating a list-height texture. The sidebar, body backing and outer clip remain stationary; route-specific panel borders may move. Existing sidebar layout timing remains 480ms and other controls retain their timing. Engines without sampled `linear()` easing use a monotonic easing fallback.

## Capture and routing

Calendar uses at most six disjoint roots: title; Today, stepper and view controls; task pane and calendar. Other pages use the shared topbar title/actions and active view. Outgoing and incoming names are distinct, preventing geometry interpolation between different pages. Names are assigned transiently, and their previous inline values/priorities are restored on every completion, cancellation and failure path.

Hidden, inert, offscreen and overlapping roots are skipped. Roots larger than 1.5 times the visible workspace dimension remain in its bounded backing capture, avoiding a named texture as tall as a long task list. Individual capture groups allow overflow for the short movement; one fixed outer workspace clip limits paint.

The route still commits once in the native capture callback, rather than waiting for animation completion. Latest-route and owner guards, reentrant navigation, popup/input settlement, focus, scroll, resize and API-failure fallbacks remain. Reduced motion, coarse/touch input, unsupported APIs and unsafe interaction contexts navigate immediately. Touch snapshots have not been newly enabled.

Prototype A disables semantic groups through a test-only `getLayers: () => []` injection and uses one 60px spring entrance. Prototype B is the default layered composition. There is no shipped comparison/tuning interface.

## Verification

`node --test tests/`: **333 passed, zero failed**, including 19 controller lifecycle cases. Seven new regressions cover semantic name uniqueness/caps, inline value/priority restoration, viewport clipping, hidden/offscreen/oversized/nested exclusions, long-content backing, visual-selection failures and stale/reentrant/owner cleanup. PWA/cache checks, JavaScript syntax checks and `git diff --check` pass. No formatter/linter/build pipeline is configured for this static site.

Fresh native Chromium verification and normal-speed recordings are in [the runner](qa.js) and [results](results.json). The runner uses isolated signed-out local fixture contexts, blocks all API/external traffic and closes every context. Its owner check simulates the controller token; it is not an authenticated account test.

The final matrix passes 25 cases, plus six [capture-bound checks](capture-bounds-results.json). It covers forward/reverse at 1280/835px, folded/expanded navigation, every retained route, dense task lists, popup/keyboard/focus interruptions, rapid clicks, resize/preference changes, dark Calendar scroll retention, owner cancellation and immediate reduced/touch/API-failure fallbacks. Touch 390/320px taps still open Add Task and the Tasks sheet. No page errors or API/external requests were observed.

Dense Tasks is 3300/3631px tall and Settings 1427/1469px in the measured desktop/tablet layouts. Their named content roots are omitted; viewport-sized workspace backing carries the 64px content spring. Calendar's separate roots remain bounded. Actual normal incoming overshoot is about 2.807px for title, 3.260px for controls and 3.740px for the backing content; final text is unscaled and sharp. The B comparison has a clearer sequence than A while avoiding whole-height flipping. Brief outgoing/incoming overlap is intentional; zero ghosting is not claimed.

Timing evidence is deliberately scoped. The recorder's first RAF trace could outlive its own transition and record the next capture; those cross-route samples were invalid. Its lifetime is now bounded to its own transition. Heavy video plus per-frame pseudo-style inspection still introduces 150–300ms Settings gaps. A separate fresh [RAF-only runner](timing-smoke.js), with no recording or per-frame style reads, exercises A/B and all four comparison routes at both sizes: maximum active RAF gap 16.8ms, median 16.7ms; B Settings ready capture 22.7/23.8ms ([results](timing-smoke-results.json)). This does not reproduce an active application stall and points to instrumentation overhead. It is synthetic Chromium evidence, not a general frame-rate or device guarantee. Five solid dark-rail pixels also remain identical before/start/mid/after ([media inspection](media-results.json)); this bounded sample does not establish pixel identity across changing page panels.

Normal-speed comparisons: [1280px B](playback-1280-layered.webm), [1280px A](playback-1280-page.webm), [835px B](playback-835-layered.webm), [835px A](playback-835-page.webm). Held samples share one elapsed timeline, including each group's delay, rather than incorrectly sampling every animation at the same individual percentage.

The actual user preview was checked for an open editor before reload, then verified to load the new 440ms/30ms assets. Calendar→Tasks and Tasks→Calendar were exercised, with one active view and no remaining transient names/transition state. Its prior November Month view was restored without editing planner records. User-context screenshots stay in private temporary storage rather than this repository.

Scope is the current local website. Cache v42 and versioned CSS/controller URLs refresh the shell assets. No backend/storage schema, native bundle, signing or artwork changes are included. Approved transparent and opaque icon hashes remain unchanged. Safari/Firefox, installed PWA and physical iPhone/iPad/native runtime checks were not run for this presentation-only change. Emulated touch results do not establish physical-device parity. No public deployment or shared-main publication is included.

Separate existing layout observation: the synthetic 31-task stress fixture with long upcoming titles compresses Dashboard's Today column at 835px in both A and B after settlement. It is unrelated to the animation and remains a layout follow-up; this motion acceptance does not claim every possible content layout was repaired.
