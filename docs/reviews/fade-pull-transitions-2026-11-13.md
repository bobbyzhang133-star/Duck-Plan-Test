# Fading directional pull — Chat Check request

November13,2026. Review requested; application unchanged. The user now finds the whole-page slide too physically literal and asks for a fading slide/pull into place, referring to the feel of Apple's unlock transition. This supersedes the earlier full-viewport/no-fade acceptance criteria. Return the review before implementing a replacement, following the established Chat Check workflow.

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

Pending the external review in the established Duck Plan **Repository Overview** conversation. No implementation, public deployment, migration or native app synchronization is included.
