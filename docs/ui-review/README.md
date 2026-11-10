# DuckPlan frontend redesign

Implemented on `feature/duckplan-ui`. No commit, push, merge, deployment, backend, API, authentication, or planner-model changes were made.

## Preview

From the repository root:

```sh
python3 -m http.server 8000 --directory landing
```

Open http://localhost:8000. Select **Settings → Appearance** for System, Light, or Dark. The site remains static and needs no build or dependency installation.

## Changes

- Updated `landing/index.html`: planner branding without mascots, consistent navigation labels, visible dashboard header, accessible skip link, and appearance selector. Removed the planner's fur renderer and material-lab link.
- Updated `landing/app.js`: the existing sidebar remains accessible when displayed as a desktop rail; mobile retains its drawer behavior. Task storage, model rules, and calendar logic are unchanged.
- Added `landing/planner-ui.css`: scoped presentation overrides for typography, cards, controls, calendar views, task states, modals, responsive layouts, dark mode, focus indicators, and reduced motion. The original stylesheet remains preserved.
- Added `landing/planner-ui.js`: consistent inline SVG navigation icons, a browser-local theme preference, and responsive navigation updates.
- Added `landing/assets/plan-mark.svg`: a simple calendar favicon.

The original mascot assets and independent fur-lab files remain on disk to preserve teammates' work; the redesigned planner neither displays nor loads them. The legacy lab is still directly accessible at its old URL. Coordinate any deletion or retirement of those legacy files separately.

## Verification

All 17 existing tests passed with `node --test tests/*.test.cjs`; JavaScript syntax checks passed. Chrome browser checks covered task creation/editing/completion/filtering/deletion, search, class cards, day/week/month calendars, date navigation, calendar-slot task creation, modal dismissal, theme persistence, mobile drawer navigation, and reduced motion. No uncaught browser errors or document overflow appeared at 320, 390, 768, 1024, and 1440 pixels.

## Screenshots

- `before-desktop.png` and `after-desktop.png`: the same homepage at 1440 × 1000, using the existing demo tasks.
- `after-dark.png`: the desktop dashboard in dark mode.
- `after-mobile.png`: the mobile dashboard at 390 pixels wide.

No backend coordination is required. Teammates editing navigation, page markup, or theme styles should review the new UI files and the small sidebar change in `app.js`. Existing demo task data and prototype Axis/reminder behavior are preserved.
