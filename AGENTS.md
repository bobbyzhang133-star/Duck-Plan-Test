# Repository Guidelines

## Approved DuckPlan Icon

The user approved v11 on November 12, 2026 as DuckPlan's profile picture and app icon. Preserve `landing/assets/duckplan-sigma-head-v11.png`, its matching web exports and the identical opaque 1024px native `AppIcon.png` unless the user requests a change. Keep the approved outer contour and the complete facial group's proportions intact; preserve native code and signing.

## iPhone Website Updates

The Xcode project bundles this repository's `landing/` directory. It does not automatically use the separate website preview checkout or GitHub main. Before telling the user to Run an updated app, sync the intended latest web files into this directory, preserve existing native alarm code and signing settings, run matching web tests and verify the bundled files in a successful iPhone build. Installing the update on a physical phone remains a separate step.

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
