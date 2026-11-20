# Distinct Calendar header band

November 16, 2026. Current local website, based on `8ddab9f`. The user asked for the top Calendar header to be visually separated from the timetable, following the existing Repository Overview plan.

The chat's actual rendered SVG concept was read and retained unmodified as `chat-reference.svg`: a neutral `#FAF8F4` date header above a white grid, with selected-day yellow confined to the timetable. The implementation follows that material hierarchy while preserving the existing responsive controls and date-only deadline row.

## Change

- One neutral surface across date headers, the corner, date-only deadline cells and the Due label. The selected header retains its date badge without tinting the full header cell yellow.
- A subtle horizontal edge under date-only deadlines separates the header band from the hour grid. Existing header heights, sticky offsets, gutter treatment, red-dot boundary and scheduled/deadline coordinates remain unchanged.
- Theme-aware dark header surface; default/class task colors are unchanged.
- CSS version `header-band-20261116`, service-worker cache72.

## Verification

- **PASS:**8 existing focused PWA and viewport lifecycle tests; `tests.txt`. Final diff check passes. No new test merely mirrors these CSS declarations.
- **PASS:**20 actual Chromium157.0.8103.78 local-mode presentation cases, Day/Week and light/dark, at1280x1000,835x1000,390x844,320x568 and844x390. `runtime.js` / `runtime-results.json` and `after-*` screenshots. Every date header has the same neutral band, distinct from the timetable surface; date-only rows match. Selected-column color, neutral weekends, dot centring, full time-label bounds, no page overflow, sticky-edge hide/restore, horizontal scrolling and unchanged task JSON/reload assertions pass.
- **PASS:**cache72 CSS/index hashes match final source, with offline browser reload and unchanged task data (`cache-results.json`, `source.json`). Browser SW evidence is not an installed-PWA launch claim.
- **PASS:**existing user preview loaded the new CSS key; computed light header250/248/244 versus white timetable255/255/255. Current Day/November16 selection, collapsed Tasks summary and4 remaining tasks were retained; no user task records were edited.
- **NOT RUN:**fresh signed-in backend checks, actual native WKWebView/build/installation, physical phones/iPads, Safari/Firefox and installed PWA. This bounded CSS-only local website change does not alter account/storage/API behavior. The previous task documented unavailable offline Wrangler tooling; no prior signed-in result is claimed as a new pass.

No native synchronization, shared-main merge, public deployment or remote migration. Synthetic test contexts were closed; the local preview remains at <http://127.0.0.1:8034/#calendar>.
