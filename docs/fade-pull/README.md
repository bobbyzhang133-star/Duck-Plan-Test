# Fading directional pull

Implemented locally November13,2026 from the [completed Chat Check](../reviews/fade-pull-transitions-2026-11-13.md), following the user's approval to apply it to the website. This replaces the opaque full-height page movement while retaining the existing native snapshot controller and route behavior.

## Motion

The initial balanced setting uses20px outgoing travel,32px incoming travel and360ms movement. Lower sidebar destinations lift the outgoing content up and bring the destination from slightly below; upper destinations reverse both signs. Skipping sections uses the same bounded displacement. No scale, blur, refraction or live layout animation is added.

`page-stack.css` gives route motion independent duration/distance/easing tokens. Spatial movement uses `cubic-bezier(.2,.8,.2,1)`; both opacity curves use `cubic-bezier(.4,0,.6,1)`. The outgoing opacity completes1→0 over55% of the route duration (198ms), and incoming opacity completes0→1 over70% (252ms). Each fade holds its endpoint while the movement finishes. These are elapsed fade durations, not percentages of eased spatial displacement. The sidebar retains its existing480ms timing; popup/button timings are unchanged.

The named whole-workspace snapshots retain matching bounds and a fixed clip. The sidebar/navigation is excluded. Transparent snapshot margins keep the existing live body/theme backing, including its subtle gradient, instead of inserting a different flat background during capture. Route-specific panels/card borders move with their content; no shared card frame is invented across different sections.

## Behavior preserved

Route state still commits exactly once in the native capture callback. Sequence/owner guards, latest-route handling, cancellation, focus/popup settlement, scroll rules, resize, failed APIs and cleanup are retained. The controller no longer writes viewport height as a motion distance.

Coarse/touch input (including matching hybrid devices), reduced motion, unsupported APIs and unsafe interaction contexts still navigate immediately. This change does not claim to animate a physical phone or iPad. Deep links, startup, search and notification navigation remain immediate. Page source/cache keys and PWA cachev39 include the new CSS/controller.

## Verification

- `node --test tests/`:326passed,0failed ([output](node-tests.txt)). The existing capture/owner/rapid-navigation/failure/focus lifecycle tests still pass. Updated the previous height-state expectation and PWA cache version. Twenty-one focused motion/cache checks passed before the full suite; no backend/storage/native implementation changed.
- [Browser runner](qa.js), [results](qa-results.json):22cases pass in Chromium157.0.8103.78, with no page errors or API/external requests. Only fresh isolated contexts were used and all were closed. Held native snapshots verify forward/reverse signs, bounded20/32px travel, scale1 and fixed clipped registration at1280/835/390px plus expanded835 navigation and distant routes. At144ms, forward outgoing y−18.0673/opacity.16087 and incoming y+3.09233/opacity.617726; there is no traveling full-height boundary.
- Both variants have normal, unpaused forward/reverse/distant-route recordings: [balanced1280](playback-1280-balanced.webm), [subtle1280](playback-1280-subtle.webm), [balanced835](playback-835-balanced.webm), [subtle835](playback-835-subtle.webm). Subtle12/24px/320ms overrides exist only in test contexts; no tuning UI is shipped. Keep the balanced version as the reviewed starting point. Decoded filmstrips and real opacity/transform traces support inspection; they are not user visual approval.
- Actual sampled balanced RAF gaps peak at16.8ms for1280/835px, with monotonic movement and no scale/blur. A subtle835 sample includes a33.5ms gap. This is bounded desktop-runtime evidence, not a general frame-rate or physical-device claim. [Inspection summary](inspection-summary.json), [media/pixel results](media-results.json), [reproducible decoder](media-inspection.js).
- Both snapshots exceed10% opacity together for about83ms in the recorded samples. Brief expected text overlap is visible in intermediate frames; the outgoing layer is gone by198ms and the destination fully opaque by252ms. Decoded frames show no full-height seam or large uncovered band. Final text is unscaled and sharp. No zero-ghosting claim is made.
- Eight margin pixels per theme show intermediate channel excursions at most1 beyond the before/after endpoint range. Before→after differences reach11(light)/5(dark) because different page panels/shadows occupy the scene. The sample supports no large backing flash; it does not establish identical pixels across different pages.
- Touch390/320, reduced-motion, unsupported and throwing snapshot API fallbacks navigate immediately; Add Task and the phone Tasks sheet work. Rapid/reversed navigation, resize/preference settlement, keyboard/focus popup opening, dark Calendar scroll retention and final cleanup pass. Existing owner-cancellation unit coverage is retained.
- The actual open835×747 local preview was checked for unsaved editing before reload. It loaded360ms/20px/32px route tokens with the sidebar still480ms. Calendar→Tasks and the return to Calendar settled with one task form and no remaining transition phase; existing planner records were not edited. Screenshots of this user context remain private temporary evidence rather than being published to the TEST repository.

This is Chromium browser evidence, including emulated touch and tablet-sized viewports. Safari/Firefox, installed-PWA launch and physical iPhone/iPad/native runtime behavior were not rerun for this bounded website presentation change. The PWA asset/cache regressions passed. The preceding feature baseline remains separate historical evidence for unchanged data/API layers, not proof that the hosted backend has been updated.

Scope: canonical local website checkout only. No backend change, production deployment, native-project synchronization or physical-phone update is included.
