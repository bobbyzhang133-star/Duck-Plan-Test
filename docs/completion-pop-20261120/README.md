# Task into check completion — November 20, 2026

Follow-up to the completion cleanup, baseline `16a855d`. The user requested a larger yellow checkmark and an effect where the task pops into it. Local website only; assets `completion-pop-20261120`, service-worker cache v115. No public deployment, remote push or native app update.

The yellow circle is now72px, up from32px, with a44px check instead of24px. The task's completion card contracts and fades toward its center; the check grows at that same center, overshoots slightly, settles and fades. Card contraction and check bounce use transform/opacity on separate layers over700ms. The decorative wrapper is removed at740ms. The existing bounded particle burst starts at180ms at the same landing point, with shorter650ms particles/750ms cleanup. Overdue/ordinary captions remain in the initial card; no calendar/clock icons are copied. Motion-off and reduced motion continue to skip the animation.

## Verification

Playwright MCP, Chromium157.0.8103.79, isolated synthetic local data. [Browser harness](check-browser.js) and [phase results](browser-results.json) cover14 overdue/future completion cases at1280,835,390 and320px, dark mode, reduced motion and explicit motion off.

- **PASS:** rendered samples at0/180/322/434/550ms show the card narrowing and fading, then a single72px check circle overshooting to83.52px, settling to68.4px and returning to72px. Its center stays aligned within1px of the original card center. SVG base width44px, no extra icons/controls or page overflow, decorative/inert semantics retained.
- **PASS:** actual user checkbox completion, finite cleanup, saved completed state after reload and no replay on reload. Dark/reduced/motion-off cases produce no page errors.
- **PASS:** ordinary live-timing samples from desktop Calendar, phone Calendar task sheet and Dashboard show the card gone and check visible at360ms, then correct completed state. [Additional results](additional-results.json).
- **PASS, fixture-backed:** actual signed-in checkbox completion against the real loopback Cloudflare Worker/D1 fixture at8798, followed by reload, retains the completed task and shows one large check. No mocked transport or production account/data.
- **PASS:** JS syntax checks, `git diff --check`, and both existing `tests/service-worker-cache.test.cjs` tests. No store/API behavior changed, so unrelated suites were not repeated.
- **NOT RUN:** native WKWebView, installed PWA and physical Safari/device motion/performance. Native checkout remains unchanged under the user's “Publish to public” gate. Prior persistence-aware success/Undo/entry-point review recommendations remain outside this visual follow-up.

Phase screenshots were sampled by pausing the two browser animations and setting their WAAPI current times, then rendering frames. They establish the specified motion shapes/phase ordering, not a frame-rate or physical-device smoothness claim. Separate live-timing checks cover completion/cleanup. Only synthetic contexts created for the checks were closed; the user's browser data was untouched.
