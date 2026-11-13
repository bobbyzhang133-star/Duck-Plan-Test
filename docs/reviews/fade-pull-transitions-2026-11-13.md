# Fading directional pull — Chat Check

November13,2026. Review completed and returned before implementation; application unchanged. The user now finds the whole-page slide too physically literal and asks for a fading slide/pull into place, referring to the feel of Apple's unlock transition. This supersedes the earlier full-viewport/no-fade acceptance criteria.

Subsequent approval: the user asked to apply this review to the website. See the [local implementation](../fade-pull/README.md). The review below describes the pre-implementation source and proposed acceptance criteria.

## Source submitted

Current application is the5c6134f tree, included unchanged in TEST reliability commitd07bb2b. `landing/view-transitions.js` captures the whole workspace and sets `--page-height` to its actual height. `landing/page-stack.css` keeps old/new opacity at1 and moves both by that full height. Thus the recorded physical page motion is expected behavior of the current code, but no longer the user's intended visual treatment. `docs/page-stack/README.md` and its recordings document that earlier implementation; they are not approval of the new direction.

## Revised review criteria

- Keep directional meaning from sidebar order: lower destination means outgoing content moves slightly up and destination arrives slightly from below; upper destination reverses those signs. Suggest directional continuity rather than literal transport of adjoining full pages.
- Outgoing content fades away while incoming content fades and pulls into its settled position. Review short bounded translation first; optional very subtle depth/scale may be assessed separately. Avoid a visible traveling page seam, large blank regions, prolonged double text or an overt zoom.
- Keep the sidebar/navigation and the outer workspace frame stationary. Include all intended content/header in one consistent motion treatment. Preserve existing Calendar/task/phone layouts and data.
- Keep route commits responsive and retain current single-commit/latest-route/owner guards, focus/popup settlement, scroll behavior, failures and cleanup. The current coarse/touch path is instant; explicitly review its scope and safe alternatives rather than claiming phone motion exists.
- Give this route effect its own tuning tokens rather than changing the global480ms layout token used by sidebar geometry. Prefer transform/opacity initially; do not introduce animated blur/refraction as an unrequested redesign.
- Replace the old full-height shared-edge visual acceptance with actual normal-speed forward/reverse recordings, short displacement across viewport sizes, fade/overlap legibility, stable background/frame, final text sharpness and interruption/accessibility/input tests.

Candidate discussion values such as20px outgoing,28–36px incoming and320–400ms are local design hypotheses, not implementation, user-approved settings or Apple measurements. Ask the reviewer to recommend and explain initial values; actual playback remains necessary.

## Apple references and limits

Official references for the review:

- [HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion/) — purposeful, restrained and responsive motion/accessibility.
- [WWDC26 Principles of great design](https://developer.apple.com/videos/play/wwdc2026/250/?time=364) — familiar metaphors without excessive literalness; responsiveness.
- [WWDC18 Designing Fluid Interfaces](https://developer.apple.com/videos/play/wwdc2018/803/) — immediate response, interruption and spatial continuity.
- [WWDC25 Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/?time=631) — material/depth continuity, including lock/unlock references. This does not mean DuckPlan needs Liquid Glass or refraction.

No exact iOS27 unlock transform/duration/easing specification or direct measured unlock recording was obtained. Treat the user's example as a qualitative reference; do not call proposed CSS an exact Apple clone. Require the reviewer to state which exact source it can access, distinguish source findings from visual observation, and rank design acceptance failures separately from operational defects.

## Result

Sent to and completed in the established [Duck Plan — Repository Overview](https://chatgpt.com/g/g-p-6addac00e55c8191a3f6db4456733345-duck-plan/c/6addacc2-3bc4-83e8-8f06-cdbedefe067c) conversation. Exact reviewed TEST commit: [`ad6f21aedd8c0d12ee521ca83f3a9de23ade2ec2`](https://github.com/bobbyzhang133-star/Duck-Plan-Test/tree/ad6f21aedd8c0d12ee521ca83f3a9de23ade2ec2), verified against the remote branch before submission. The reviewer reports exact-source access, including the current controller/CSS/tests and revised brief. It did not independently play the previous recording or observe a replacement animation.

The review agrees that full-height travel, fixed opacity1 and shared480ms sidebar timing explain the perceived physical page slide. It treats this as a revised design acceptance mismatch; no new operational defect requiring a controller rewrite was confirmed. Keep the existing capture/lifecycle architecture and change its visual choreography primarily in `page-stack.css`.

Recommended first comparison:

- Balanced: outgoing20px, incoming32px,360ms; lower destination exits up/enters from below, upper destination reverses both signs.
- Subtle: outgoing12px, incoming24px,320ms, with the same directional meaning.
- Use dedicated route motion tokens and retain the sidebar's480ms layout token and existing popup/button timings.
- Fade the outgoing content mostly away by about the first half and bring the incoming content nearly opaque before motion ends. Example opacity samples were illustrative design curves, not observed frames or approved constants.
- Start with translation and opacity. Evaluate optional incoming.99→1 scale only afterward if needed; text softening and moving edges may make it worse. No initial blur/refraction.

The principal visual risks are overlapping readable text, background brightness pulses and exposed bands. The fixed, matching backing and intended stationary frame must be verified in actual snapshot paint; a fixed underlying live DOM alone does not establish that captured frame edges remain stationary. Keep complete snapshot registration while preserving layouts. The current `any-pointer: coarse` fallback also includes hybrid devices and remains instant in this recommended first iteration; no phone animation is implied.

Retain single capture-time route commit, sequence/owner guards, rapid/reversed navigation, keyboard/focus and popup settlement, scroll state, reduced motion, unsupported/failure fallback and cleanup. Replace full-height shared-edge visual assertions with bounded travel, fade legibility and final sharpness. Compare normal-speed forward/reverse playback in light/dark themes, including desktop1280, tablet-sized835,390fine-pointer plus390/320coarse input, expanded sidebar, long/scrolled content, early controls, account changes and failed snapshots. Touch/browser emulation must be labeled accurately.

The reviewer supplied a concrete implementation prompt; [full response](fade-pull-chat-response-2026-11-13.txt) is retained as evidence. Local code inspection independently confirms the key current-source findings. Motion tuning still requires local playback and user review; neither historical full-height evidence nor passing lifecycle tests approves the proposed fade.

Only review documentation and the project work record changed. No new application tests were necessary for this documentation-only review. No implementation, public deployment, migration or native app synchronization is included.
