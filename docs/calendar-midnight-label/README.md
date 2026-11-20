# Hide the midnight axis label

November17,2026. Local website based on185be21. The user requested removing the12AM marking. Only the first hour label is hidden with visibility:hidden; its hour cell, 00:00 scheduling target and24-hour coordinate system remain unchanged. CSS version midnight-label-20261117; cache74.

PASS: four existing PWA tests and eight actual Chromium157 local-mode Day/Week checks at1280/835/390/320px. Midnight label hidden, next label visible,24cells,62px hour scale, midnight target at column offset0 and unchanged task JSON. See runtime-results.json, tests.txt and phone.png. Existing preview refreshed; prior Week/ThuNov19 and collapsed4-task summary retained. Final diff check passes.

Native app, signed-in backend, installed PWA and other browser engines NOT RUN for this CSS-only local change. No native sync, main merge, public deployment or user-record edits.
