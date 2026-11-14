# Independent Calendar outline

The rounded Calendar border and its existing shadow are a separate decorative spring piece. The task panel, title, toolbar controls and calendar grid keep their individual animations from `f145e86`. No parent layout is transformed and the existing task-column separator already moves with the task panel.

A single `.calendar-outline` span is a sibling after the planner grid inside `#view-calendar`. It is hidden from assistive technology and ignores pointer input. This places it outside the grid's overflow clip, so its border/shadow can move independently. The grid retains its original transparent 1px border for layout; its background and geometry stay unchanged. The view is the positioning anchor, leaving the grid static so the phone Tasks drawer does not acquire a different containing block.

The new `outline` role permits one extra root, with its own 64px entrance, 60ms delay, 440ms spring and opacity effects. The six existing Calendar roots, their timings, role limits and real DOM hitboxes remain unchanged. Outgoing capture selectors include the outline; cancellation and cleanup use the existing lifecycle. Light/dark border color, 24px desktop/18px phone radii and the original theme shadows are retained, including short coarse-pointer landscape layouts.

The existing independent header divider and all other sections retain their behavior. Cache v46 and versioned CSS/controller URLs refresh the new markup and decoration together.

## Verification

`node --test tests/view-transitions.test.cjs tests/pwa-app.test.cjs`: **32 passed**, zero failed. The new two-direction outline regression covers the missing-token 64px fallback, finite timing, independent effects, one-outline limit, preserved content slots and inline priority restoration. Syntax and diff checks pass.

The [resting baseline](rest-baseline.json) records the previous frame, pane, toolbar and grid geometry/colors at 835/1280px and a 390px phone viewport in light and dark mode. Browser evidence in this directory uses isolated signed-out demo fixtures with API/external requests blocked. Checks cover independent motion, unchanged resting geometry, Day/Week/Month, themes, phone drawer behavior and trusted moving-control input. Contexts are closed after verification.

The final [combined matrix](results.json) passes **19 checks** in Chromium 157: six light/dark resting comparisons, six held Day/Week/Month cases at 835/1280px, two outgoing captures, phone Tasks-sheet behavior, reduced/coarse fallbacks and two [trusted moving-control cases](input-results.json). The outline has its own two effects alongside the existing six roots; the parent grid's transform stays `none`. Resting border color, radius, shadow and rectangles match the baseline, including the phone pane's containing block. Initial phone measurements waited for its pre-existing CSS sheet transition to settle before exact comparison. An early input-harness wait was superseded by the focused staged runner; no application workaround was needed.

The calendar slot test opens the exact selected November 9, 07:00 editor after a trusted 100ms hold, and the checkbox test changes only the chosen demo task. No errors, failed requests or API/external traffic were observed. [Normal three-route playback](calendar-outline-835.webm) and [filmstrip](filmstrip-835.png) were visually reviewed separately from timing assertions. The recording includes a brief pre-ready load and is not a startup benchmark; short coarse-pointer landscape uses the matched existing media condition but was not separately exercised.

The actual in-app preview loaded the new controller/CSS, completed Calendar→Tasks→Calendar and confirmed one 1px decorative outline, 24px radius, no pointer handling and a transparent untransformed grid border. The user's November 9–15 Week view, zero calendar scroll and task-panel scroll were preserved. No editor or user record was changed; its screenshot remains private temporary evidence.

Scope: canonical local website, based on `f145e86`, on `codex/calendar-outline-20261113`. No native bundle/signing, backend, user planner data or public deployment changes. Installed PWA, physical iPhone/iPad, other browser engines and signed-in backend parity are not inferred from Chromium viewport/input checks.
