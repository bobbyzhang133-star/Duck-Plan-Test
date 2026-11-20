# Midnight grid marking

November18,2026. Local CSS-only change on `codex/midnight-grid-line-20261118`, based on `76516ec`.

Added a1pxhour rule at the start of each timetable column. The repeating hourly grid previously drew its first line at the end of the first hour, leaving midnight unmarked. The new background layer uses the existing hour-line material, with no border, size or coordinate changes. The12:00AMtext stays hidden; its62pxhour and accessible00:00slot remain. The hour gutter receives no extra segment.

- **PASS:**4existing PWA/cache tests and diff checks; no new product test for this small paint change.
- **PASS:**8isolated Chromium157.0.8103.79 local Day/Week light/dark cases at1280×950 and390×844.24hours, hidden first label, midnight slot top0,01:00top62, border-top0, no overflow/record changes. Actual00:00slot click opens the correct scheduled-time field on desktop and phone viewport. `runtime.js`, `runtime-results.json`.
- **PASS:**visual inspection of `after.png`; an isolated before/after comparison disables only the new layer. Midnight pixel changes from255/251/228to238/233/217; the gutter is pixel-identical. PNG comparison used the Python standard library because Pillow is unavailable; an initially overstrict whole-image-diff assertion also picked up minor existing-line edge rendering differences. No geometry change was introduced to satisfy it.
- **PASS:**actual service-worker cache82 contains current byte-identical CSS.
- **NOT RUN:**fresh signed-in, native WKWebView/install, physical Safari/devices and installed-PWA acceptance. Phone result is emulation, not a hardware claim.

Local preview: http://127.0.0.1:8034/#calendar. User data and existing preview retained; QA contexts closed. TEST backup only, no main merge, public deployment or native/app update.
