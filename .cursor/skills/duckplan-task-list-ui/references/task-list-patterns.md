# Task-list patterns researched November 22, 2026

Primary sources; these are design inputs, not permission to import assets, create accounts or modify another service. Product features can change; revisit relevant examples in future work.

| Product / official example | Useful pattern | DuckPlan adaptation |
| --- | --- | --- |
| [TickTick: Lists](https://help.ticktick.com/articles/7055782283059396608), [Group & Sort](https://help.ticktick.com/articles/7056594711640801280), [Features](https://ticktick.com/features?language=en_us) | Smart lists separate attention filters from regular lists; show-if-not-empty reduces clutter. Grouping and sorting have distinct purposes. | Keep filters separate from grouping; hide empty active categories; support Plan/Class/Priority grouping. |
| [Todoist: Today](https://www.todoist.com/help/todoist/get-started/plan-your-day-with-the-today-view-UVUXaiSs) | Overdue section, explicit bulk action, grouping/sorting and visible completed-task access. | Keep overdue clearly named and retain Complete all overdue; offer view grouping. |
| [Things: Today, Upcoming, Anytime, Someday](https://culturedcode.com/things/support/articles/4001304/) | Actionable work, future plans and inbox are distinguishable; start dates and deadlines have different roles. | Preserve independent Due/Work metadata and a visible unscheduled backlog. Do not add Things-specific states. |
| [Linear: Display options](https://linear.app/docs/display-options) | Filter, order and grouping have separate purposes; groups carry counts. | Plan/Class/Priority changes only presentation; counts match visible records. |
| [Asana: Sections](https://help.asana.com/s/article/sections) | Named sections organize a list and can be collapsed. | Give every Calendar category a consistent disclosure rather than static text. |
| [Microsoft To Do: Organize lists](https://support.microsoft.com/en-us/todo/organize-your-lists) | Groups make navigation through many lists manageable. | Use concise headers; avoid adding a second navigation hierarchy inside the task panel. |
| [Any.do: My Day](https://support.any.do/en/articles/8609724-getting-started-with-my-day) | A focused daily view reduces backlog pressure. | Keep Calendar's selected-day scope; do not reset or hide tasks automatically. |
| [Notion: Views, filters, sorts and groups](https://www.notion.com/help/views-filters-and-sorts) | Group by a property; collapse/hide empty groups independently of filtering. | View-only grouping, explicit group controls and no empty-category walls. |
| [Apple Reminders: Organize a list](https://support.apple.com/en-qa/guide/iphone/iph82596cb20/ios) | Official indexed description shows one section expanded and others collapsed. | Supplemental inspiration only: direct article access returned HTTP 429, so no rendered-match claim. |

## Evidence limits

TickTick Lists, TickTick Group & Sort, TickTick Features, Todoist Today and Things' article were opened with Playwright before implementation. Group & Sort, Todoist Today and Things were revisited after implementation at 1280×960, including TickTick's Desktop documentation tab. Todoist/Things expose official app screenshots; TickTick's feature illustration remained a lazy placeholder in that runtime, so it cannot establish a live app visual match. TickTick help content is accessible. Other sources were read through web browsing; Apple direct fetch was blocked. No signed-in competitor account or live task data was edited.

Chosen implementation checks: compact headers with chevrons/counts, hide empty groups, distinguish plan/class/priority grouping from filters, keep Due/Work and every task action. These choices adapt the examples to DuckPlan rather than reproducing an entire competitor.
