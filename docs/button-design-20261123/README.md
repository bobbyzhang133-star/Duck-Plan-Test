# DuckPlan button redesign for review

The local preview uses a consistent set of action icons and four visual roles. Main actions such as Add and Save use DuckPlan yellow. Routine actions use a softly filled pill. Less prominent actions such as Cancel and repeated Edit use a quiet surface. Delete and Reset use a distinct red treatment. The icon accompanies a visible action label, and existing icon-only controls keep their accessible names.

Calendar, Tasks, Priority matrix, the task editor, Templates, class resources, Goals, Habits, Notes and Settings use the new treatments. Template Schedule keeps its existing calendar glyph. The 44px Today control keeps its compact word label in the phone toolbar. No formal skill has been created.

## Handbooks reviewed

| Source | Takeaway applied |
| --- | --- |
| [Apple Human Interface Guidelines — Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) and [Icons](https://developer.apple.com/design/human-interface-guidelines/icons) | Use recognizable symbols and keep prominent actions sparse. |
| [Material Design 3 — Buttons](https://m3.material.io/components/buttons/guidelines) and [Google's maintained component guide](https://github.com/material-components/material-components-android/blob/master/docs/components/CommonButton.md) | Separate filled, tonal and quiet action emphasis. |
| [Fluent 2 — Button](https://fluent2.microsoft.design/components/web/react/core/button/usage) | Match icon and label emphasis and make a selected state legible. |
| [IBM Carbon — Button guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/button/guidelines) | Use one small, action-relevant icon where it helps. |
| [Atlassian — Button usage](https://atlassian.design/components/button/usage) and [live examples](https://atlassian.design/components/button/examples) | Use clear action labels, familiar glyphs and restrained secondary emphasis. |
| [GitHub Primer — Button](https://primer.style/product/components/button/) | Work from distinct primary, default, invisible and danger roles. |
| [Adobe Spectrum — Button](https://spectrum.adobe.com/web/rsp/components/button) | Choose emphasis based on the action's role in the group. |
| [Shopify Polaris — Button](https://shopify.dev/docs/api/app-home-ui-extension/latest/web-components/actions/button) | Keep visual variant, accessibility label and disabled state distinct. |
| [GOV.UK — Button](https://design-system.service.gov.uk/components/button/) and [USWDS — Button](https://designsystem.digital.gov/components/button/) | Distinguish dangerous actions and retain a visible focus and pressed state. |
| [W3C — Button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/), [accessible names](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/) and [target sizing](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Retain the native button or link, its usable name, and generous touch targets. |

Planner examples reviewed included [TickTick Add Tasks](https://help.ticktick.com/articles/7055782422935240704), [Things Magic Plus](https://culturedcode.com/things/features/#magic-plus), [Todoist Quick Add](https://www.todoist.com/help/todoist/features/use-task-quick-add-in-todoist-va4Lhpzz), [Microsoft To Do](https://support.microsoft.com/en-us/education/student-help-center/track-the-moving-parts-with-microsoft-to-do) and [Google Calendar Tasks](https://support.google.com/calendar/answer/9901136?co=GENIE.Platform%3DDesktop&hl=en-in). They informed the contextual Add action, retaining labels for editing or saving, and reducing ornament in compact toolbars.

## Rendered comparison

Revisited the same public Fluent, Primer, Atlassian and GOV.UK pages through Playwright at 1280×900. Primer supplies side-by-side emphasis variants. Atlassian demonstrates a single icon before or after a label. GOV.UK pairs a filled default with understated secondary buttons and an explicit warning variant. Fluent documents the relationship between button appearance, icon and state. DuckPlan uses the same distinctions with its own colors, glyphs and spacing.

## Local verification

PASS in Chromium 157.0.8103.79 with isolated demo data at 1440px desktop, 835px dark theme, 390px emulated touch, and 320px emulated touch with reduced motion. Checked the Calendar actions, task editor, Save and reload, Tasks list and matrix, and Settings. At 320px and 390px also checked Template menus and scheduling dialogs, Goals and Habits actions, and Notes actions. Cancelling preserved data. There were no page errors or button label clipping. Seventy focused automated checks passed. The local preview uses cache v145.

NOT RUN for signed-in backend actions, installed PWA and native or physical-device runtimes.
