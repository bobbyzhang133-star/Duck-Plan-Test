# Assignment template UI — Chat Check, November 13, 2026

Status: review and recommendations only. The user explicitly requested the review before implementation. Application files, data, deployment and the native app are unchanged.

## Reviewed version and destination

- Repository: `bobbyzhang133-star/Duck-Plan-Test`
- Branch: `codex/template-drawer-colors-20261113`
- Exact source: [`b4974c841f53ad7df25b033319f6763ef5efc27b`](https://github.com/bobbyzhang133-star/Duck-Plan-Test/tree/b4974c841f53ad7df25b033319f6763ef5efc27b)
- Review request and completed response: [Duck Plan — Repository Overview](https://chatgpt.com/g/g-p-6addac00e55c8191a3f6db4456733345-duck-plan/c/6addacc2-3bc4-83e8-8f06-cdbedefe067c)

The reviewer explicitly reported accessing the exact commit, the source/guidance and all five screenshots in `docs/template-drawer/`: desktop, iPad, phone, small phone and dark phone. It was asked to distinguish confirmed issues from hypotheses and preserve the confirmed Calendar layout, matching colors, immediate drop behavior, saved settings, phone sheet, keyboard alternatives and approved duck.

## Main conclusion

Keep the class-colored calendar blocks and the full-width animated drawer. Simplify the content surrounding them. A single compact template currently has a prominent New template button, two action rows, a Details disclosure and repeated instructional copy. These controls dominate the preview, especially at 320px phone width.

The review recommends one recognizable template unit: the colored block, visible Schedule and Add to tasks actions, and one accessible management control containing Details, Edit and Delete. Keep the current delete confirmation. Making management a menu is a proposed interaction change, not an implemented or user-approved design.

## Findings and source checks

1. **Portrait iPad does not retain the required side-by-side workspace.** The 820px screenshot shows tasks above the timetable. This was missed by the preceding no-overflow checks. The review calls this P0 and cites older `planner-clarity.css` rules. Local source inspection corrects the active cause to `landing/planner-motion.css:154–165`: the `workspace` container query at 780px changes every Calendar mode to one column, tasks in row 1 and calendar in row 2. The 76px navigation rail leaves an 820px viewport inside that threshold. The older clarity Day-only rule does not explain Week stacking. This is a high-priority mismatch with the approved layout, not an outage or data-loss defect; P0 operational severity is unsupported.

2. **The template controls overwhelm the calendar-style block.** `landing/planner-library.js:195–202` renders the block and multiple surrounding control groups; `landing/planner-library.css:35–47` lays out separate actions and utility rows. The reviewer rates the density and scattered hierarchy P1 design priorities. Preserve the verified block colors and drag source while consolidating management actions.

3. **The drawer is initially difficult to find.** `landing/index.html:96–102` places it below all task groups. A separate isolated local check found the drawer header below the visible phone Tasks panel on the initial 390×844 demo: header y860.8–914.8 versus panel bottom y764 at scrollTop 0. A minimal option is a collapsed header immediately below the task-panel heading, or a visible Templates-count launcher near that heading. Do not replace the phone Calendar or introduce a second floating sheet.

4. **Long titles and larger libraries need a readable path.** `landing/planner-library.css:26` forces single-line ellipsis. The current Details body repeats class, priority and notes but omits the full title, so touch users must enter Edit to read a truncated name. The reviewer proposes up to two title lines plus full text in Details, and testing 10+ templates before adding search or pagination. Any preview-height adjustment must preserve the real scheduled duration and recognizable calendar-block appearance.

5. **The drawer has excess instructions and weak empty-state hierarchy.** Keep one concise helper where useful, adapt guidance to tapping on phones, make New template quieter, and use one clear creation action when the library is empty. Do not show drag instructions with no templates.

Additional local accessibility/state observations: the sibling Schedule/Add to tasks/Edit/Delete buttons have repeated generic accessible names rather than template-specific names (`planner-library.js:196–201`), and open per-template Details disclosures collapse on unrelated renders because `replace()` rebuilds the markup (`:176–183`, `:257–268`). These should be covered in a future refinement without changing owner isolation.

## Proposed implementation order

1. Restore the approved iPad composition, retaining the seven-day Week timetable. The reviewer suggests a 260–280px task column and horizontal scrolling confined to the calendar; exact geometry needs local verification. Changing iPad Week into the phone day-selector presentation is a separate proposal requiring clarification.
2. Make Templates reachable without scrolling through all task groups.
3. Group each block with two clear quick actions and one accessible management control. Keep drag confined to the block and preserve touch/keyboard Schedule.
4. Reduce repetitive chrome and handle long titles, zero templates and 10+ templates.
5. Verify keyboard/focus/menu dismissal, visible focus, drawer reversals, owner changes, dark colors, reduced motion and scheduling persistence.

Acceptance checks should cover 1280px desktop, 820px iPad and 390/320px phones; no page-level horizontal overflow; immediate valid calendar drops without an editor or modified saved settings; prefilled phone Schedule; readable full titles; no orphan focus/animation; and no loss of template availability or source templates. The existing 297 tests are baseline evidence from the reviewed commit, not tests rerun by this Chat Check. Physical Safari/device behavior remains unverified.

No UI implementation, public deployment, migration, native bundle sync or main merge is part of this review.
