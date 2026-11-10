# DuckPlan UI cleanup and planner design

This iteration stays on `feature/duckplan-ui` and builds on the earlier frontend redesign. Existing uncommitted work and `AGENTS.md` were preserved. Nothing was committed, pushed, merged, or deployed.

## Preview

```sh
python3 -m http.server 8000 --directory landing
```

Open http://localhost:8000. No dependency installation or build is needed. Settings → Appearance offers light, dark, or system themes.

## What changed

- **Dashboard:** a personalized welcome using the existing profile label, today's tasks ordered by priority, expandable completed tasks, live completion progress, overdue reminder, upcoming deadlines, and a compact clickable week. All counts and task content use the existing task model and data.
- **Navigation:** Dashboard, Calendar, All tasks, Classes, Settings, and two explicitly labeled preview pages. Calendar is now a separate page; the dashboard no longer embeds the full timeline. The mobile drawer and desktop rail remain accessible. Navigation click handling now targets sidebar buttons instead of accidentally matching the body's page-state attribute.
- **Calendar:** preserved daily, weekly, and monthly behavior, clearer weekend shading and time labels, named month-view task indicators, and completed-task styling in the month view. Select a date to update the daily plan, or use Day/Week/Month to change the calendar view.
- **Tasks and forms:** category tags, High/Medium/Low badges, clearer search labeling, existing task filters, and optional work scheduling behind a keyboard-accessible disclosure. Editing a scheduled task or selecting a calendar slot opens scheduling automatically.
- **Consistency:** calm neutral/lavender surfaces, consistent cards and controls, light/dark presentation, visible keyboard focus, responsive layouts, and reduced-motion support. No mascot assets or fur rendering are loaded by the planner.

## Frontend previews and integration needs

| Page | Available now | Needed from teammates |
| --- | --- | --- |
| Goals & habits | Clearly marked sample goal, adjustable preview progress, seven-day sample habit grid, and weekly sample count. Changes reset on reload. | Persisted goal definitions/targets and dated habit check-ins; authenticated ownership and timezone rules; real progress and streak calculations. |
| Notes | Empty title/category/body editor, live text preview, and word count. Draft remains while navigating but disappears on reload. | Persistent note records, ownership, categories, save/update/delete behavior, and note-search integration. |

These previews do not write to task storage or call APIs. There is no pretend Save action or real streak claim. Global search continues to search tasks only. Existing Axis integration and reminder prototype behavior remain unchanged.

## Files changed

- `landing/index.html`: dashboard/page structure, navigation, labeled previews, and scheduling disclosure.
- `landing/app.js`: presentation markup, page navigation, scheduling-disclosure state, and a `planner:render` event so dashboard summaries follow existing task updates. The task model, persistence routines, scheduling algorithms, and API behavior are unchanged.
- `landing/planner-ui.js`: dashboard rendering and shortcuts, preview interactions, icons, and the existing theme controls.
- `landing/planner-ui.css`: responsive component styling and interaction/accessibility refinements.
- `docs/ui-cleanup/`: this handoff and before/after evidence.

Coordinate frontend edits to these files, especially navigation and task-render markup. If teammates replace the task data layer later, connect the dashboard summaries to that layer and preserve equivalent refresh notifications. `landing/planner-model.js` and the existing tests were not modified.

## Verification

All 17 existing tests passed with `node --test tests/*.test.cjs`. JavaScript syntax and `git diff --check` passed. Chrome checks covered task creation/editing/completion/deletion and reload persistence, search and filters, live dashboard counts/progress, calendar views/date navigation/slot creation, scheduling disclosure, preview interactions and note reset on reload, class cards, theme persistence, keyboard modal dismissal, and reduced motion. All six checked pages fit document widths of 320, 390, 768, 1024, and 1440 pixels without overflow. Wide calendar grids scroll within their own panel. No uncaught browser errors occurred.

## Screenshot evidence

`before-dashboard.png` and `after-dashboard.png` use the same 1440 × 1000 viewport and existing demo data. Additional images show the full dashboard, weekly/monthly calendars, task organization, task editor, dark mode, mobile layouts, and the clearly labeled Goals & Habits and Notes previews. `after-calendar-month-full.png` includes the entire calendar panel; its timeline/grid retains independent scrolling.
