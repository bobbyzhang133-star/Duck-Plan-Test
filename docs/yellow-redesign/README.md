# DuckPlan yellow redesign

Implemented on `feature/duckplan-ui`, preserving the existing uncommitted frontend work. No commits, pushes, merges, or deployments were made. Backend code, API contracts, task storage routines, and `planner-model.js` are unchanged.

## Preview

```sh
python3 -m http.server 8000 --directory landing
```

Open http://localhost:8000. No app dependency installation or build is needed. Switch Appearance in Settings to compare light/dark mode. Settings also includes **Mascot motion**; system reduced-motion preferences take priority.

## Visual changes

- Warm cream surfaces, butter-yellow welcome panel, golden primary actions, charcoal text, sage completion states, and a quiet blue-green pond. The existing dashboard, calendar views, task tools, classes, settings, and clearly labeled personal-space previews remain available.
- Original SVG duck artwork with shaded head/body, highlights, orange beak and webbed feet, expressive eyes, wings, glasses, and a checkmark flag. Unique gradient IDs allow multiple character instances without collisions. No downloaded illustrations or animation framework are used.
- Reusable **happy**, **sleepy**, **focused**, **encouraging**, **celebrating**, and **swimming** states. The welcome duck waves briefly, blinks occasionally, and looks toward a fine pointer inside the welcome panel. Evening sessions use the sleepy expression; a busy task list uses encouragement; the task editor includes the focused character.
- **Progress Pond:** the duck's position and progress ring follow today's actual completion percentage. Completion briefly animates water ripples and a gentle swimming motion. The weekly summary is also derived from existing tasks.
- Completion feedback includes a short outgoing-card animation, bounded golden particles, and a happy character reaction. Completing the last unfinished task in today's plan shows a small dismissible congratulations card. Undoing completion hides stale congratulations. Reloading or adjusting a sample goal does not award fake achievements.
- Illustrated empty states, warmer controls/navigation, refined task cards, and short page/modal transitions. Task completion preserves keyboard focus after the app re-renders its task lists.

## Implementation

| File | Responsibility |
| --- | --- |
| `landing/index.html` | Character mounts, welcome composition, pond/ring markup, celebration status region, motion preference, and new asset references. |
| `landing/duck-mascot.js` | Reusable `DuckPlanMascot.markup(state)`, `.mount(element, state)`, and `.setState(element, state)` drawing API. Artwork is decorative; adjacent text and progress semantics provide the information. |
| `landing/duck-interactions.js` | Reads existing planner data and `planner:render` notifications; manages display states, pointer gaze, pond progress, keyboard focus, and bounded completion effects after the existing task-change handler finishes. It never updates tasks or writes to task storage. |
| `landing/duck-theme.css` | Theme tokens, component appearance, SVG state styling, responsive layouts, finite interaction animations, and reduced-motion overrides. |
| `landing/planner-ui.js` | Updated welcome copy, browser theme color, and reusable illustrated dashboard empty state. |
| `landing/assets/duckplan-mark.svg` | Original lightweight duck favicon. |

All character/particle motion is suppressed when reduced motion is requested or mascot motion is disabled. The progress values and success messages still update. The motion preference uses its own `duckplan-ui-mascot-motion` browser-storage key. Timed effects remove their DOM elements; pointer tracking schedules frames only in response to pointer movement. There are no audio effects or focus-stealing celebration dialogs.

## Validation

All **17 existing Node tests passed**. JavaScript syntax checks and `git diff --check` passed. Chrome verification covered:

- Task creation, editing, completion, undo, deletion, reload persistence, and search.
- Calendar day/week/month views, slot-based creation, scheduling disclosure, and keyboard modal dismissal.
- Real 33% → 67% → 100% pond/ring updates, character reactions, particle cleanup, keyboard completion/focus, and celebration dismissal/undo behavior.
- Reduced motion, persistent quiet mode, evening state, unique SVG IDs, and theme persistence. Changing UI preferences leaves task data unchanged.
- Existing class cards and Goals & Habits/Notes preview behavior. Sample goal changes do not trigger real-task celebrations.
- Dashboard, calendar, tasks, classes, goals, notes, and settings at 320, 390, 768, 1024, and 1440 pixels, without document overflow or uncaught browser errors. Calendar grids retain their own horizontal scrolling where needed.

Browser tooling was installed only in a temporary testing directory; the repository gained no package manifest or runtime dependency.

## Screenshots and teammate handoff

`before-dashboard.png` and `after-dashboard.png` use the same 1440 × 1000 viewport and fresh existing demo data. Additional screenshots show the full dashboard, mobile, dark mode, calendars, tasks, editor, illustrated empty state, completion celebration, and a six-state character study. Character-study images demonstrate illustration states; dashboard screenshots use existing task data.

Coordinate edits to the frontend files listed above. The character integration reads the existing global planner model/tasks and listens for `planner:render`; preserve an equivalent update signal if teammates replace that data layer. The Goals & Habits and Notes pages remain explicitly labeled frontend previews requiring future persistence/integration. No timer, drag-and-drop scheduling, achievement storage, or backend feature is fabricated. Earlier mascot assets/material-lab files remain preserved independently.
