# DuckPlan clarity redesign and main integration

The dashboard now prioritizes today's work, schedule, and deadlines. Page titles remain visible on mobile; task titles use 16px text, metadata uses 14px text, and primary controls have clear labels and comfortable click targets. The original duck remains small, and the Progress Pond is a secondary completion indicator.

## Quick planning

- Add a task from the page header. Task name and due date appear first; class, priority, due time, reminders, scheduled work, and logged time remain available through disclosures.
- Validation explains missing task names or incomplete work schedules without discarding entered values. Editing an undated task preserves its blank deadline.
- Today's focus is the first task. Open its details or complete it directly. In **Today's schedule → Plan your day**, optionally select a different focus task for today.
- **Daily progress → Change daily target** sets a target of 1–20 tasks. Focus and target preferences are browser-local UI settings, independent of task storage. Progress uses real tasks due or scheduled today, including deadlines whose work block is on another date.
- The weekly recap shows completed tasks and upcoming deadlines for tasks planned this week. It does not invent historical streaks or focus-time statistics.

## Shared-main integration

The UI branch was based on an older main, so integration preserved the newer store-based application and all shared backend changes. Cloudflare code, authentication, planner-store persistence, API contracts, Axis integration, reminder-domain/ledger code, and browser-notification logic remain unchanged from the fetched main.

The shared pure calendar helpers retain the filename `landing/planner-ui.js`. The UI/theme/dashboard script is now `landing/planner-presentation.js`. Task cards and dashboard summaries use live `classId` lookups instead of the old hard-coded class-name table. Task forms retain per-task reminders and actual minutes. Calendar dragging, keyboard rescheduling, Undo, auto-scroll, and the mobile task drawer remain available. Native dialog transitions replace the previous glass popup effect as part of the requested visual redesign.

The tests' presentation assertions were updated for the new sidebar markup; behavioral calendar assertions and all shared tests remain in place. `AGENTS.md` is preserved.

## Local preview and checks

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory landing
node --test tests/*.test.cjs tests/*.test.mjs
```

The static preview uses local mode. Cloud sync uses the existing `cloudflare/` Worker and configuration described in `cloudflare/README.md`. There is no frontend build step.

All **189 Node tests passed**, including the shared Cloudflare, planner store, reminder, parser, and calendar tests. Browser verification checks task creation/editing/deletion, live class IDs, reminder choices, logged time, goal/focus persistence, calendar keyboard rescheduling and Undo, settings, mobile drawers, reduced motion, and document overflow across 320, 390, 768, 1024, and 1440 pixels. Accessibility audit output is recorded separately; automated checks are not a full accessibility certification.

## Evidence

- `before-dashboard.png`: dashboard before the clarity iteration, captured on November 2.
- `after-dashboard.png`, `after-mobile.png`, `after-calendar.png`, `after-tasks.png`, and `after-dark.png`: current integration screenshots. Relative demo dates reflect their capture date.
- `accessibility-audit.json`: automated checks on the current dashboard.
- The earlier yellow-design presentation is retained in `../yellow-redesign/presentation/`; it documents that earlier design iteration.

## Design references

The user supplied Duolingo's official articles on [interface consistency](https://blog.duolingo.com/core-tabs-redesign/), [product principles](https://blog.duolingo.com/product-principles/), and [readable illustration](https://blog.duolingo.com/shape-language-duolingos-art-style/). DuckPlan applies consistent hierarchy, labeled actions, progressive disclosure, and restrained character placement while keeping its own visual identity.

Goals & Habits and Notes remain clearly labeled frontend previews requiring future persistence. No manual production deployment or database migration is included in this GitHub update.
