# Individual pieces with a separate divider

The subsequent [Calendar-outline change](../calendar-outline/README.md) adds the outer Calendar border as another decorative piece while preserving this individual-piece animation.

The title, controls and content retain the individual spring movement from `4820707`. The user clarified that only the marked header line should gain its own animation; whole-header/page grouping is therefore replaced in this follow-up to `46fa189` on `codex/independent-divider-20261113`.

Non-Calendar sections use four disjoint live roots: title (48px, 0ms delay), controls (56px, 30ms), the decorative divider (64px, 60ms), and active content (64px, 60ms). The divider has its own transform and opacity effects, rather than moving a header parent. The existing 440ms spring/bounce, directional behavior and fading are unchanged. Calendar returns to its previous six individual roots; its surrounding frame is not newly animated.

The real `.topbar-divider` span is decorative (`aria-hidden`, no pointer events). The header retains its original 1px border width/style with transparent color, preserving its height and spacing. A 1px span at `bottom: -1px` paints the exact original border strip using `var(--line)`. The header becomes a positioning anchor with `inset: auto` and `z-index: auto`, so formerly ignored responsive offsets and stacking values do not alter its position. No wrapper, reparenting or animation-engine changes are needed.

This replaces the preceding complete-layout grouping. Other UI styling, the live incoming renderer, real moving hitboxes, pointer holds, owner/sequence guards and interruption cleanup are retained. Cache v45 and versioned controller/CSS URLs refresh the new markup and styling together.

## Verification

`node --test tests/view-transitions.test.cjs tests/pwa-app.test.cjs`: **31 passed**, zero failed. Controller syntax and diff checks pass. No new implementation-mirroring unit test is added for this presentation correction; real browser geometry and motion checks exercise the default selectors and painted divider.

The isolated Chromium [browser matrix](results.json) passes 19 cases. Resting header/title/actions/body rectangles match the saved [baseline](rest-baseline.json) exactly at 835/1280px in light and dark mode. The single 1px divider remains at the original border strip and retains its theme color. Its own live effects move while the header parent stays still; title, controls and content regain their distinct distances and start times. Calendar has six individual roots without a transformed parent. All seven routes, reduced/coarse fallbacks, a trusted held checkbox and a click on moving Add Task pass without errors, failed requests or API/external traffic. Fixtures and contexts are isolated and closed after use.

At shared elapsed 80ms the stationary header has zero displacement, while title/controls/divider/body are at 26.5477/43.5216/61.0682/61.0682px respectively. The divider has two effects of its own; the body has a separate pair. At 320ms their distinct rebounds confirm the stagger: title −2.0306px, controls −3.01628px, divider/body −3.74725px. [Normal forward/reverse playback](independent-divider-835.webm) and [its filmstrip](filmstrip-835.png) were visually reviewed. The recording includes a brief initial pre-ready load; it is motion evidence after startup, not a startup-performance benchmark.

The actual in-app preview loaded the new controller/CSS and real divider, confirmed a single decorative 1px line in the original theme color with the old border transparent, and exercised Tasks→Dashboard→Tasks. The prior Tasks/All view and zero scroll position were restored, with no remaining transition attributes or open editor. No user records were edited; the screenshot remains private temporary evidence.

Scope is the current local website. No native bundle, signing, backend or user planner data changes are included. No public deployment or shared-main merge is authorized here. Installed PWA, physical iPhone/iPad, signed-in backend parity and other browser engines are not inferred from these Chromium checks.
