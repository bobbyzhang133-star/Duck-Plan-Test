# Task-completion feedback Chat Check — November 20, 2026

User request: “Chat check: Improve the click finish task feedback affect.” Review and implementation plan only; no application changes, deployment or native bundle update.

Application source baseline: `4ccfd0fe981c327de8c23c330fac98ea9fee019e`, branch `codex/calendar-deadline-editor-20261120`, pushed and remotely verified on `bobbyzhang133-star/Duck-Plan-Test` before this review. The subsequent evidence commit adds only this directory. Destination: the established [Repository Overview conversation](https://chatgpt.com/g/g-p-6addac00e55c8191a3f6db4456733345-duck-plan/c/6addacc2-3bc4-83e8-8f06-cdbedefe067c).

## Fresh rendered evidence

Playwright MCP, isolated Chromium contexts with built-in synthetic local-mode data, preview `http://127.0.0.1:8034/`. Desktop Calendar task panel at 1280×900; phone Tasks page at 390×844. The user's browser data was untouched.

| Check | Desktop | Phone |
| --- | --- | --- |
| Live Due icon before completion | 14×14px | 14×14px |
| Outgoing echo icon about 90ms after click | approximately 128×128px | approximately 248×248px |
| Ordinary completion particles | 10 | 10 |
| Echo/particle cleanup after another second | 0 / 0 | 0 / 0 |

**FAIL:** detached completion cards still lose the ancestor-scoped Due/Work layout. See [desktop frame](desktop-mid-animation.png) and [phone frame](phone-mid-animation.png). These are timed rendered samples, not frame-rate measurements. The original defect remains present at this newer source baseline.

**PASS:** ordinary effects are finite and their elements are cleaned up in these two local cases. This narrow pass does not establish saved-state correctness, cloud failure behavior, accessibility or native parity.

Harness note: an initial phone navigation selector used `data-go` instead of the actual `data-view`. Another attempt used a dynamic `:not(:checked)` locator with Playwright `check()`, which re-resolved to another row after application rendering. Those attempts are excluded. The final run captured one stable task ID, clicked that exact checkbox once and recorded the results above in a fresh context.

## Source findings to review

- `landing/duck-interactions.js`: the capturing checkbox observer clones `.daily-task-card` / `.all-task-row` and appends the echo to `document.body`. Date-row/icon styles in `landing/calendar-date-clarity.css` depend on ancestors inside Calendar, Dashboard or Tasks. The echo loses that context.
- The same observer checks optimistic task state in a zero-delay timer. Confirmed persistence is handled separately by the app's `store.toggleComplete` promise; review the risk of celebrating a failed or stale operation. A real signed-in delayed failure has not been exercised in this evidence run.
- `landing/calendar-task-preview.js` completes tasks through the store directly, while ordinary effects observe checkbox changes. Review feedback consistency across the Calendar preview, both task lists, Dashboard and priority matrix without synthesizing checkbox events.
- `landing/app.js` already provides actionable toasts, but its checkbox completion toast has no explicit Undo action. Review a shared confirmed-completion acknowledgement, reversible feedback and predictable keyboard focus.
- Preserve the approved Sigma duck, restrained finite motion, reduced-motion/motion-off support, accessible status updates and final-task-only celebration. Do not celebrate refreshes, remote account sync or automatic Axis completion.

## Requested output and acceptance criteria

Return a concrete review first: prioritized mismatches, exact source-level causes, recommended interaction sequence, small implementation steps and a proportionate test matrix. Distinguish demonstrated defects, source risks and optional polish. Compare with the earlier [task-completion review](../task-completion-20261120/README.md) and the repository's completion design in `docs/yellow-redesign/README.md`.

The desired feedback should feel immediate, clear, satisfying and restrained: checked state responds immediately; outgoing cards retain their typography/geometry; success remains truthful; Undo is easy; Calendar preview completion receives equivalent acknowledgement; rapid toggles and owner/view changes cannot leave stale effects; reduced motion remains useful.

Not run in this evidence pass: signed-in completion, delayed persistence failure, rapid toggles, keyboard focus lifecycle, native WKWebView, physical phone/iPad, PWA, performance profiling or final-task note placement. Previous narrower passes are documented in the earlier review and must not be promoted to a new platform pass. Native source remains frozen until the user says “Publish to public.”

## Completed external response

The review was sent to the established Repository Overview conversation through its signed-in Chrome page after the conversation connector reported no readable match. TEST commit `79ea6f85f77c193e55e4dbcf6da8cd8901010177` was verified with `git ls-remote` before submission. The reviewer completed its response against that exact commit and reported inspecting the brief, both screenshots, relevant source and earlier design/review. The [submitted request](request.txt) and [response text](response.txt) are preserved here; the conversation also contains its proposed interaction concept. That concept is a simulation, not a DuckPlan implementation or test.

Recommended sequence:

1. **P1, freshly demonstrated:** repair the outgoing snapshot's full layout inheritance, retaining the live card's geometry, typography, wrapping, theme variables and 14px icons. Avoid a global SVG-size rule. Keep the decorative copy inert, hidden from assistive technology, pointer-transparent and finite.
2. **Persistence risk, established by source rather than a fresh failing cloud test:** acknowledge the checkbox immediately, but make particles, success messages and final-task celebration depend on the existing persistence promise and a still-current user operation. No extra network requests. If geometry becomes stale during a slow save, skip the old floating-card exit.
3. **Entry-point inconsistency, established by source:** use a presentation-only completion coordinator across checkbox paths and Calendar compact preview. Priority matrix cards need appropriate source-specific feedback. Do not manufacture checkbox events, celebrate remote refresh/Axis imports or issue repeated bursts for Complete all overdue.
4. **Usability and robustness:** use the existing actionable-toast API for a guarded Undo, protect against stale per-task operations and route/account changes, preserve keyboard focus, and suppress success after failure. A final-task note should accurately refer to today's plan and include Undo/Dismiss.
5. **Optional visual polish:** retain restrained individual-piece motion and approved Sigma artwork. The proposed immediate checkmark, short fading card exit and small confirmed golden burst are a design proposal, not measured timing/performance requirements. Its suggested green checkmark is optional; no approved palette change has been made. Reduced-motion/motion-off must retain useful status and Undo without animation.

The requested acceptance matrix includes desktop/phone icon geometry, effect cleanup, immediate checked state, confirmed save and delayed failure, entry-point consistency, rapid reopen/Undo/reload, batch completion, remote/Axis updates, focus, reduced motion, dark mode and actual native/device performance. These are future implementation checks, not tests performed by the external reviewer. This review did not access localhost or establish native/PWA/physical-device parity.

Local source inspection corroborated the three main causes and the existing toast action API. Review artifacts are the only repository changes. No recommendations have been implemented, no public deployment occurred, and the native app was not updated.
