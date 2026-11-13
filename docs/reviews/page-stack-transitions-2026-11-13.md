# Whole-page sidebar transitions — Chat Check, November 13, 2026

Status: completed review, returned before implementation in keeping with the user's earlier Chat Check preference. This record clarifies the desired behavior; application source still implements the prior incoming-only entrance. No website deployment or native app update is included.

Later follow-up: the user approved implementing this plan. See the [local implementation and verification](../page-stack/README.md). The findings below describe the exact earlier reviewed commit, not the replacement.

## Reviewed source and destination

- TEST repository: `bobbyzhang133-star/Duck-Plan-Test`
- Branch: `codex/directional-sidebar-transitions-20261113`
- Exact reviewed commit: [`3a351cef5777d3dd0e8f08e2bb3475d02d65e492`](https://github.com/bobbyzhang133-star/Duck-Plan-Test/tree/3a351cef5777d3dd0e8f08e2bb3475d02d65e492), verified against the remote branch before sending.
- Request and completed response: [Duck Plan — Repository Overview](https://chatgpt.com/g/g-p-6addac00e55c8191a3f6db4456733345-duck-plan/c/6addacc2-3bc4-83e8-8f06-cdbedefe067c).

The reviewer reported accessing the exact source, navigation integration, layout CSS, project plan, transition documentation and tests. It explicitly did not run local playback or independently reproduce the prior browser checks. Its diagrams are concepts, not observed application frames.

## Clarified acceptance criteria

This supersedes the earlier direction/travel interpretation in `docs/directional-navigation/README.md` and the corresponding implementation plan entry.

Sections are conceptually stacked in sidebar order: Calendar, Dashboard, Tasks, Classes, Goals & habits, Notes, Settings. Selecting a lower item moves the outgoing whole content page **up** and brings the destination **from below**. Selecting an upper item moves the outgoing page **down** and brings the destination **from above**.

For visible workspace height H and shared animation progress p:

- Lower destination: outgoing y = -pH; incoming y = (1-p)H.
- Upper destination: outgoing y = +pH; incoming y = -(1-p)H.

Both representations move together in one fixed, clipped content viewport, without fading. The sidebar and phone bottom navigation remain stationary. Include each page's topbar when present, and preserve existing internal Calendar/task/phone layouts, features and stored data. Skipping intermediate sidebar sections uses the same paired movement, not a series of intermediate navigations.

## Confirmed source mismatches

1. `landing/view-transitions.js:30–49` animates only the incoming live section. It uses 48px travel and opacity 0→1, with a negative starting offset for a lower destination. That is the opposite physical direction and a different transition model from the clarified request.
2. `landing/app.js:853–878` calls `setView()` before starting the entrance. The outgoing `.active` class is removed immediately; `landing/styles.css:166–167` then hides it. Increasing travel alone cannot make the outgoing page move.
3. The shared topbar in `landing/index.html:53–64` is outside `.view`. Calendar hides it through `planner-motion.css`, so animating only `.view` cannot represent the entire page.
4. Calendar overrides rail/sidebar widths to 76/268px, compared with the general 64/232px values. Workspace padding, overflow and topbar also differ. Transition geometry must remain stable across these changes, without permanently replacing each page's internal layout.
5. `tests/view-transitions.test.cjs` and the saved browser QA intentionally assert the old incoming-only 48px behavior. Their passing results remain evidence for the previous implementation, not approval of the newly clarified movement.

The reviewer labeled the first three items P0. Treat them here as high-priority acceptance/design failures, not evidence of an outage, security problem or data-loss defect.

One source correction: the review describes non-Calendar pages as auto-height. `landing/styles.css:599` already gives the general `.unified-workspace` a 100dvh constrained scrolling viewport. The confirmed problem is differing screen-space geometry, padding, rail width, topbar and overflow rules, not a blanket absence of fixed viewport height outside Calendar.

## Recommended next implementation

Use two synchronized visual representations of the entire `.unified-workspace`. Investigate native same-document View Transitions first: painted snapshots avoid duplicated live forms/IDs and preserve outgoing paint before route-specific CSS changes. Keep modal overlays and navigation outside the animated surface. Use an invariant clip rectangle, constant opacity and the same duration/easing for both surfaces; initially reuse the shared 480ms layout token.

The [official Chrome reference](https://developer.chrome.com/docs/web-platform/view-transitions/same-document) describes capturing the old state, invoking the DOM update, and capturing the new state. The eventual controller must guard asynchronous updates as well as animation completion: a skipped or stale transition must never commit an older requested route. Preserve direct `setView()` routing for startup, deep links, search and notifications.

The review recommends immediate functional navigation when snapshots are unsupported or fail, rather than retaining the old contradictory fade. Reduced motion should also be immediate. Rapid/reversed clicks, resize, page exit and owner changes need cleanup for both representations.

Early touch interaction requires particular care: snapshot paint can be somewhere other than the underlying live control. Making a snapshot ignore pointer events does not prove correct targeting. Test a visibly moving button; use a safe immediate-settle or motion-free touch fallback if it cannot activate the intended action reliably. Preserve sidebar keyboard focus and move focus out of outgoing content without exposing hidden controls. Settle or correctly measure live popup launchers before opening dialogs.

## Acceptance evidence needed after implementation

- At 1280/835/390/320px, verify Calendar→Tasks, Tasks→Calendar, Calendar→Settings and Settings→Dashboard, including expanded/folded navigation, dark theme, long Tasks content and a previously scrolled Calendar.
- Observe both full page surfaces in intermediate frames. Verify equal/opposite offsets, a continuous shared boundary and stable clipping, with no horizontal jump, stretched content, stale header or stationary content remnant.
- Sample actual geometry or rendered snapshot transforms across the animation. A halfway displacement corresponds to **50% eased progress**, not necessarily half the elapsed duration with the shared nonlinear easing. Do not require half-height travel at 240ms merely because duration is 480ms.
- Test rapid and reversed navigation, latest-route ownership, reduced motion and runtime preference changes, unsupported/failed snapshot APIs, keyboard/focus, early touch activation, popup anchors, scroll state and cleanup.
- Inspect normal-speed recordings as well as intermediate frames. Static screenshots and source keyframes alone cannot approve the motion.

No new application tests were run for this documentation-only review. The previous implementation's test results are historical baseline evidence. No local UI replacement, main merge, public deployment or native synchronization was performed.
