# Task category header color coding

Approved November 23: blue Scheduled, red Overdue, lighter coral Due today, gray Unscheduled and green Completed. Apply subtle fills to category headers and matching count badges in both Calendar and Tasks. Keep labels dark, class colors within rows unchanged and primary actions yellow. Existing priority grouping retains its restrained priority material.

Only presentation CSS, CSS query version and cache v138 change. Disclosure height/opacity and hover transitions remain, including reduced-motion behavior. No data or native bundle changes. Browser verification results are recorded alongside this file.

Verification: PASS in isolated local Chromium 157 contexts: 1280px Calendar, 390px Tasks, and 835px Calendar with dark theme. Visible labels and count badges exceed 4.5:1 contrast; disclosure closing/opening states remain animated, class metadata remains unchanged, and no page errors were observed. Screenshots and computed colors are saved here. Service-worker cache tests: 2 passed. Native app, physical phones/tablets, installed PWA and signed-in transport: NOT RUN for this CSS-only local change.
