# Continuous Calendar date header

November17,2026, based onb3f8941. Removed left borders between all day tabs. Replaced separate corner/day fold shadows with one noninteractive full-width shadow extending across the blank time-label corner, eliminating its overlapping shadow seam. Bright surfaces, date selection/counts, stationary headers and the timetable grid remain unchanged. CSS unified-header-20261117/cache76.

PASS:9 existing viewport/PWA tests and16 actual Chromium local Day/Week light/dark cases at1280/785/390/320px. Verify identical header/corner/tab fills, no vertical tab borders, one full-width fold shadow, clear-at-top behavior, with/without date-only rows,24hour geometry and no page overflow/storage writes. Screenshots and runtime.js/results retained. Actual cache76 hashes match source; offline count/task persistence passes. Existing user preview refreshed with prior Day/November17 mode restored; no user record edits.

The first pseudo-element shadow box was too thin for the existing negative spread and rendered weakly; visual inspection caught it. Its final12px transparent box preserves the original shadow without adding layout height, and the16 cases were rerun.

Native, signed-in backend, Safari/physical devices and installed PWA NOT RUN for this local CSS change. TEST feature backup only; no main merge, native sync or public deployment.
