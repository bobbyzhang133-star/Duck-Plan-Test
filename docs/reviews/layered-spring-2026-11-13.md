# Latest sliding recommendation

Read November 13, 2026 from the established [Duck Plan review conversation](https://chatgpt.com/g/g-p-6addac00e55c8191a3f6db4456733345/c/6addacc2-3bc4-83e8-8f06-cdbedefe067c). The user requested implementation on the current local website. No new message was sent to the review chat.

The latest feedback asks for a visibly moving, elastic entrance inspired by individual elements rising into an Apple passcode/keyboard interface. Coordinate three semantic groups: identity/title, controls and content. Keep fading and the direction of sidebar navigation. Do not animate every button independently.

The review recommends outgoing travel of 24–36px with a quick fade; incoming 48–72px over 400–500ms; title 40–56px; controls/content 50–70px with 25–40ms stagger; and a restrained 2–4px final bounce. Bring incoming opacity up early enough to see the travel. Compare A (one elastic page) with B (layered spring), with B the recommended starting point.

Preserve capture-time routing, latest-route and account ownership guards, popup/input interruption and cleanup. Keep coarse/touch navigation immediate until separately verified. Inspect normal-speed forward/reverse playback, rapid navigation, dark mode, keyboard and reduced motion. These are qualitative design references, not measurements of Apple's proprietary timing.

## Source correction

The external review inspected the older `codex/fade-pull-chat-check-20261113` branch and described full-height movement. The actual local baseline is `26c1bf9`, which already has 20px outgoing / 32px incoming fading travel over 360ms, plus subsequent icon/neck changes. This implementation extends that newer controller and preserves its safeguards and artwork; it does not restore full-page travel.

## Local implementation

Default B uses a 48px title entrance, 56px controls entrance and 64px content entrance, with 0/30/60ms delays. Each settles in 440ms; the complete sequence ends at 500ms. A dedicated sampled spring has a 5.87% peak, yielding 2.82–3.76px overshoot at those distances. Exit is 32px over 180ms, fading out in 140ms; incoming opacity reaches one in 160ms after each group's delay. No scale/blur or changes to unrelated button/sidebar timing.

Use transient, disjoint native snapshot names with different names for outgoing/incoming groups. Calendar captures at most six visible roots across three roles; other sections capture the shared title/controls and active section. Hidden, inert, offscreen, overlapping and oversized roots stay in the bounded workspace backing. If no incoming content root is captured, that backing uses the 64px content spring and 60ms delay, preserving the stronger entrance on long pages. A test-only `getLayers: () => []` override selects prototype A without shipping a tuning UI.

Native named descendants are excluded from ancestor capture, and groups are flat in the Level 1 transition tree. Apply the invariant workspace clip to the outer overlay, with individual image pairs/groups allowed to overflow for the short entrance. Relevant primary references: [CSSWG capture rendering characteristics](https://drafts.csswg.org/css-view-transitions-1/#capture-rendering-characteristics) and [Chrome clipping explanation](https://developer.chrome.com/docs/css-ui/view-transitions/nested-view-transition-groups). No new nested or scoped transition API is required.

Verification and limitations are recorded in [the implementation evidence](../layered-spring/README.md).
