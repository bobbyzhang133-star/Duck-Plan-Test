# Direct editor for Day work blocks

Historical note: the fade-only transition described here was superseded by the restored launcher expansion on November24. See [current transition correction](../launcher-transitions-20261124/README.md). Direct editing remains.

This change treats “day bar” as the scheduled work block in the calendar's Day mode. Clicking or keyboard-activating it opens the existing, prefilled Edit task dialog directly. The editor fades in at its own width and fades out on close. Reduced motion uses native immediate open and close. The Week work preview and the calendar list and deadline routes are outside this change.

On baseline `98704f9` in local Chromium, a 926×31px Day work bar opened a 520px-wide preview. The source paint shrank to 56% width while stretching to 10.9× height, and the snapshot of the bar overhung the moving shell. The new route uses opacity and a 6px vertical movement, keeping the 448px editor width throughout its animation.

PASS in Chromium 157.0.8103.79 at 1440px desktop, 390px emulated phone touch and 1280px desktop with reduced motion. The first activation exposed the correct task and its editable fields, and Escape returned focus to the work bar. Desktop keyboard reopening, changing the title, saving it and verifying the original work time and due date after reload passed. Week still opened the preview in the desktop browser. Browser checks used isolated demo data and captured no page errors.

PASS for 63 popup, editor focus, calendar preview, task card and cache checks. Local preview uses cache v143. NOT RUN for signed-in, installed PWA, native and physical-device browsers.
