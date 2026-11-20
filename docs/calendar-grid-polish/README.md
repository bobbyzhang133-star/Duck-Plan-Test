# Calendar gutter, selected-day surface and current-time dot

November 16, 2026. Current local website, based on `5503c1e`. The user asked to follow the latest Repository Overview Calendar layout plan, specifically the red dot, gutter boundary and yellow highlighting. They clarified that the dot belongs at the **left edge of today's column only**, rather than the left edge of the whole Week timetable. The relevant chat plan is retained in `chat-plan.txt`.

## Change

- Centre the 8px red dot exactly on today's column boundary, with the line extending across that column. It remains at its original minute coordinate; selecting another day does not move 'now'. Raise the indicator above the sticky time gutter but below the date/deadline headers so its gutter-side half remains a whole circle.
- Allow that intentional 4px half-dot in the viewport guard. Measure the observer's left inset from the inner root edge, avoiding the previous extra border pixel. Retain the existing full-label/dot cutoff and stale-callback/lifecycle guards.
- Remove the doubled vertical gutter separator from the hour rail, header corner, Due label and first day cells. Preserve the other day and hour grid lines.
- Use the same neutral card surface for ordinary day columns, weekend columns and unselected date headers. Only the selected column/header receives the pale yellow wash. Existing task/default/class colors and today's date badge remain intact.
- Cache71 includes the changed CSS/controller and updated version keys. No task model, API, alert settings, native source or signing changes.

## Verification

- **PASS:**38 focused Node tests covering viewport lifecycle/stale callbacks, PWA cache registration, exact deadline presentation and task preview behavior. `tests.txt`; controller syntax and final diff checks also pass.
- **PASS:**20 actual Chromium157.0.8103.78 presentation cases, isolated local mode, frozen Wednesday10:05, Day/Week and light/dark at1280x1000,835x1000,390x844,320x568 and844x390. `runtime.js` / `runtime-results.json` and `after-*` screenshots. Checks cover neutral ordinary/weekend fills, a unique selected highlight, gutter borders, dot centre/line alignment, whole visible hour labels, no page overflow, sticky-edge hide/restore, middle-of-week horizontal scroll, changing selection and unchanged task JSON through reload. Browser emulation is not an actual iPad/iPhone runtime pass.
- **PASS:**actual cache71 hashes for CSS, controller and index match final source; offline browser reload retains task JSON. `cache-results.json` / `source.json`. This is browser service-worker evidence, not an installed-PWA claim.
- **PASS:**existing in-app local preview loaded both new asset keys; its prior Week/Sunday November22 selection and collapsed4-task summary were restored through visible controls after reload. No user task records were edited.
- **BLOCKED:**a fresh signed-in localhost Worker check: Wrangler is absent from this checkout and the offline npm cache returned ENOTCACHED. No backend/account/storage code changed, no production account was used and the prior signed-in evidence is not relabeled as a fresh pass.
- **NOT RUN:**native bundle/WKWebView, physical iPhone/iPad, Safari/Firefox, installed PWA and production. This bounded change is the current local website; it is not an installed-app update or a release.

The first browser check exposed a real one-pixel observer root-border error for the newly boundary-centred dot; it was corrected and the final cases pass. Two harness assumptions were corrected separately: another selected day in Day view correctly has no current-time line, and the small phone/landscape cases must position the indicator within their actual visible timetable height before asserting visibility. These corrections do not alter product dates or layout.

Local preview: <http://127.0.0.1:8034/#calendar>. No public deployment, shared-main merge, remote migration or native synchronization is included. Synthetic browser contexts were closed; the user's preview remains open.
