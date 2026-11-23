# Task-list categorization

Scope confirmed: Calendar task panel and separate Tasks page in the local original-preview checkout. Research and reusable guidance live in `.cursor/skills/duckplan-task-list-ui/`.

Acceptance: clear consistent collapsible headers, truthful category counts, empty groups suppressed, quieter Completed, distinct filter/group controls on Tasks, view-only Plan/Class/Priority grouping, preserved task membership/actions and Due/Work meanings. Keep desktop/iPad unified frame, phone sheet, templates and approved completion feedback.

Public official documentation is the reference; no competitor live account modifications. Before/after Playwright evidence and functional results will be recorded here. No public or native release is authorized by this work.

## Implementation

- Calendar retains its date-scoped model groups with consistent disclosure chevrons, aligned tinted counts, all-group keyboard collapse, suppressed empty categories and a slim day-completion track. Completed remains folded until opened.
- Tasks separates Active/Today/Upcoming/Done filters from Plan/Class/Priority grouping. Filter/group counts reflect the current search; view controls do not mutate task records. Today and Upcoming also consider scheduled work dates, preventing work planned today with a later deadline from disappearing from Today.
- Task titles, class colors, separate Due/Work meanings, editor, template access and priority matrix stay accessible. New category headers join completion's existing 400ms survivor slide; disappearing category labels fade during the pop. The current smaller pop, larger particles and happy-eyes duck with unlined bill are preserved.
- New view-only grouping helper is covered by focused membership/order/no-mutation tests. Cache v134 includes new helper/CSS; every changed script has a new query version.

## Reference comparison

Reviewed nine product sources (eight directly readable plus Apple's indexed excerpt, whose direct article returned HTTP 429). Primary design examples: TickTick Lists/Group & Sort, Todoist Today and Things' Today/Upcoming article. Playwright inspected them before implementation, then returned to the same public examples after implementation at 1280×960. TickTick's Desktop help tab was exercised; reference screenshots and DuckPlan screenshots are alongside this file. Official rendered examples confirm clear named groups, concise hierarchy and separation of filter/group concepts. DuckPlan adapts those patterns to its approved calendar frame and task metadata; no pixel-perfect or signed-in competitor parity claim. Details and all source links are in the skill's references/task-list-patterns.md.

## Verification

- PASS: 28 focused Node tests (group membership/order/mutation invariants, planner dates/groups, list-motion/render-hold and cache), changed JavaScript syntax and git diff --check.
- PASS: Playwright MCP Chromium 157.0.8103.79 in isolated local contexts. Tasks at 1280/390/320px; Calendar at 1280/835/390px. Every group/filter combination, truthful counts, no duplicates/omissions, keyboard disclosure, long title, 44px controls and no document overflow. Selected-day Calendar groups match the existing model.
- PASS: real UI edit, completion, Done undo and reload persistence. Actual native HTML drag from Calendar backlog to 13:15 and from Tasks via Calendar-navigation hover to 17:15, preserving the empty deadline and eight-task count. Touch-emulated creation without dates then editor scheduling at 18:30, preserving no deadline. Priority matrix/list and phone sheet/Templates tab access retained.
- PASS: search result/count alignment; when the final Due-today task finishes, the disappearing header fades and the following group header/cards slide together after the echo.
- PASS: signed-in phone Tasks against real local Worker/D1 at port 8798 with updated static frontend from port 8042. Synthetic fixture accounts/records; 650ms PATCH delay preserves slide/focus and persistent completion; injected 150ms HTTP503 restores unchecked task and cancels success effects. No hosted-account mutation.
- PASS: skill YAML parsed by Ruby's standard YAML parser with frontmatter/name/description/line bounds checked. The bundled Python quick validator could not import optional PyYAML; no dependency installation was needed. The skill was read and used for this implementation.
- NOT RUN: actual native app, physical iPhone/iPad, installed PWA/offline installation, WebKit/Firefox and hosted mutation checks. Responsive Chromium views are not native-runtime parity. App source remains at its existing checkpoint per release gate.

Reproduce core UI checks with Playwright MCP browser_run_code_unsafe and check-browser.js; signed-in completion checks use check-cloud-completion.js and the existing local fixture. Supplemental manual action assertions and frame records are in browser-results.json. Browser harness setup errors (wrong date-helper signature and treating hash-only navigation as page navigation / offscreen inert controls as open) were corrected; final user-action checks pass without changing unrelated navigation code.
