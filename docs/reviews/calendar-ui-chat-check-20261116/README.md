# Calendar UI Chat Check — November 16, 2026

**Verdict: YES, the approved Calendar redesign is present in the current local website.** Review only: no application code, native bundle, production backend or user task records changed.

The user explicitly selected `http://127.0.0.1:8034/#calendar`. Reviewed exact TEST commit `ca0a00e5e20da741498a63397b760b3961b6f3ea`, remote-verified before submission. The existing [Repository Overview conversation](https://chatgpt.com/g/g-p-6addac00e55c8191a3f6db4456733345-duck-plan/c/6addacc2-3bc4-83e8-8f06-cdbedefe067c) returned a completed source/design review. See [returned response](chat-response.txt). It directly inspected source and historical verification documents, not localhost or fresh runtime tests.

## Present and checked

- Calendar default, unified left Tasks/right timetable on desktop/iPad and compact toolbar.
- Phone full-width Calendar, initially collapsed Tasks sheet, summary/Add and bottom navigation. Phone Week has seven day selectors and one selected day's timetable.
- Full24-hour grid. Timed deadlines are compact exact-minute diamonds, separate from duration work. Only date-only deadlines are in the top band. A task can have work and deadline representations without duplicating the saved record.
- Compact task preview opens first, with Edit/Reschedule actions and existing completion support. Fresh checks opened the deadline preview and closed it without modifying data; completion was not invoked in this read-only review.
- Separate icon Due and Work task-card rows, Past deadline and Work after deadline pills. Personal/no-class work is light yellow, custom class colors remain and the old colored left stripe is absent.
- Nearby deadlines group into a complete list; selecting an entry opens the correct task. Their individual minute anchors remain distinct.

## Current findings

1. **P2, adjacent Tasks-page inconsistency:** `landing/app.js` `renderAllTasks()` filters Today using only `task.dueDate === nowKey()`. Work scheduled today but due later is absent from that separate filter. Calendar uses its own correct grouping. Before changing this, confirm whether Today should mean due today, planned today or both; this review does not change its semantics.
2. **P2, density/polish observation, not a confirmed interaction failure:** a deadline/work collision reserves annotation space and can narrow Week work blocks. Actual835px fixture had a56px block; full title/time remained in its accessible label, grouped deadlines and task previews worked, and no page-level overflow occurred. Phone fixture retained160px. Truncation remains visible in busy Week columns; changing the responsive design is not required by this review.
3. **Retracted stale finding:** the first chat response suggested renaming “Due, not scheduled.” The current exact source already says “Due this day” at `index.html:109`; the final response explicitly corrects that earlier observation. No further label fix is required.

The requested standalone task-date stylesheet name was imprecise; the actual shared task-card CSS is in `calendar-date-clarity.css`, with markup in `app.js`. Older documentation that puts every deadline in the top strip is superseded by the later exact-time-marker requirement. Recommend Schedule remains a separate plan, not a missing Calendar redesign requirement.

## Fresh evidence and limits

- **PASS:** eight actual Chromium157 local browser cases: Day/Week at1280,835,390,320px. Explicit17:00 and18:15 anchors match exact grid geometry; one date-only item alone occupies the top band.24hours, appropriate column count, phone seven-day strip, desktop/iPad side-by-side panels, default/custom fills, no stripe/page overflow, Due/Work rows/warnings and compact preview actions pass. Task JSON stays unchanged. [Runtime results](runtime-results.json), [reproducible script](runtime.js), screenshots.
- **PASS:** two actual crowded-deadline cases at835/390px:17:00/17:05/17:10 anchors, all three entries in the group list, correct task details after selection, accessible work range and no page-level overflow. [Dense results](dense-results.json), [script](dense-runtime.js).
- **PASS:** existing in-app user preview refreshed from its previous default-yellow script keys to latest native-template-fallback source keys, with Calendar/Day/November16 and Tasks collapsed. Its displayed4 remaining tasks are retained. It was not used for synthetic task mutations.
- **Environment correction:**8034 was stopped at the start. The restarted plain Python test server dropped concurrent uncached asset requests, causing cascading missing-module startup errors. Restarted only the owned server with HTTP/1.1, a larger request queue and file logging. Fresh browser loads then had zero failed requests/page errors. No application-source fix was needed. One initial harness helper name was also corrected to read the actual CSS hour-height variable and source selectors before final runs.
- **NOT RUN:** fresh signed-in/cloud, native WKWebView, physical iPhone/iPad, Safari/Firefox, installed PWA, completion mutations, or all retained feature CRUD. This is a focused local design review, not a new release/full-platform baseline. Previously recorded tests are historical evidence only.

The local preview server remains available. The established chat review tab is retained as a deliverable. Only isolated browser contexts were closed. No site was publicly published/deployed or main branch updated during Chat Check.
