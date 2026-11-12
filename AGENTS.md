# Repository Guidelines

## Clarifying Requests

For all DuckPlan work, ask a concise clarification question when the intended version, page, behavior or scope has materially different plausible interpretations. Reuse confirmed answers and continue safe independent investigation while waiting. See `.cursor/rules/clarify-ambiguous-requests.mdc`. Calendar is the confirmed default opening page; retain Dashboard and the other sections.

The default Calendar uses the original public site's unified task-column/calendar layout and compact toolbar on iPad and desktop. Confirmed November 12, 2026: phones use a full-width calendar with tasks initially collapsed in an expandable sheet, a visible task summary, an Add Task action and bottom navigation. Phone Week view uses a seven-day selector and the selected day's schedule; preserve iPad's existing layout. See `plans.md` for implementation and verification records.

Use the original white Sigma duck identity for mascot artwork, preserving the current UI's mascot placements, pose states and reactions. The current profile/app-icon master is `landing/assets/duckplan-sigma-head-v4.png`, with the thicker neck requested November 12. Full-body mascot drawings retain their approved proportions unless separately requested.
Animated poses use a complete duck body and visible orange webbed feet on land. Front views have a plain body outline with no visible tail or feather/wing lines on the chest; a lifted wing appears only to wave. Keep the head-only original for the brand icon.
The Daily progress pond uses a right-facing side-profile swimming duck; other mascot placements retain their front-facing poses.

## Project Structure & Module Organization

DuckPlan is a student planner built with plain HTML, CSS, and JavaScript. The deployable site lives in `landing/`:

- `index.html`, `styles.css`, and `app.js` define the planner interface and interactions.
- `planner-model.js` contains calendar helpers, task migration, and grouping logic; it supports both browser globals and CommonJS tests.
- `fur-material.js` and `button-interactions.js` implement the interactive button material. Use `fur-lab.html` and `fur-lab.js` for its tuning interface, with details in `FUR_MATERIAL.md`.
- `assets/` holds mascot and texture images.

Automated tests live in `tests/`. `netlify.toml` publishes `landing/` and configures response headers. `plans.md` contains project planning notes.

## Build, Test, and Development Commands

- `python3 -m http.server 8000 --directory landing`: serve the site locally at `http://localhost:8000`; open `/fur-lab.html` to inspect the material lab.
- `node --test tests/*.test.cjs`: run all automated tests using Node’s built-in test runner.
- `node --test tests/planner-model.test.cjs`: run planner model tests independently.

There is no package manifest, dependency installation step, or build pipeline; Netlify serves the static files directly.

## Coding Style & Naming Conventions

Follow the existing two-space indentation, double-quoted JavaScript strings, and semicolons. Use `camelCase` for functions and variables, `UPPER_SNAKE_CASE` for constants, and lowercase hyphenated filenames. Keep calendar and task rules in `planner-model.js` and DOM behavior in `app.js`. No formatter or linter is configured; match nearby code and avoid unrelated formatting changes.

## Testing Guidelines

Tests use `node:test` with `node:assert/strict`. Name files `*.test.cjs` and give tests descriptive behavior-based names. Add regression tests for changes to date handling, task migration, grouping, or material calculations. No coverage threshold is configured. For interface changes, also check desktop and narrow-screen layouts, task editing, calendar navigation, and affected button interactions in a browser.

## Commit & Pull Request Guidelines

Recent commits favor short, imperative subjects such as “Hide navigation sidebar by default.” Use that style and keep commits focused. Pull requests should explain the change, describe validation, link relevant issues when available, and include screenshots for visible interface changes. Call out changes to locally stored task data or migration behavior.
