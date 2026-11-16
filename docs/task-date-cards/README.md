# Due and Work task cards

The user confirmed task cards only, keeping the exact-time deadline markers. The local website follows the supplied [task-card reference](REFERENCE.md): rounded white cards, quiet class metadata, separate calendar-icon Due and clock-icon Work rows, and warm warning pills.

## Behavior

- Due dates show weekday/month/day and the explicit time, or End of day when no time is supplied. Other-year dates retain their year. Invalid legacy values use an unavailable label rather than inventing a time.
- Work shows Today only for the actual current day, otherwise the weekday/date and work range. Overnight work retains its end-date information. Due-only unscheduled cards omit the empty Work row; inbox cards and the All Tasks Work row can still say Not scheduled.
- Past deadline and Work after deadline remain distinct, based on actual task timing. Completed tasks have no urgency state. Only actual overdue cards receive the pale rose tint.
- Class, priority, logged minutes including0, task IDs and saved fields remain intact. Checkbox, title editing, Edit, Reschedule and dragging retain their handlers. All Tasks keeps its separate Due column without duplicating Due inside its task body.
- The compact Calendar/Dashboard card uses a24px checkbox column and full-width metadata, with Edit positioned above the body. Only the title reserves Edit space. This fixes excessive date wrapping observed in the initial835px check without changing the outer task panel or calendar.

## Verification

All103 affected Node checks pass, including nine new date/card cases plus the existing calendar marker, preview, model, startup, focus, drag and PWA checks. Final inputs are recorded in [verification.json](verification.json) and [runtime-source.json](runtime-source.json).

[Eight final browser combinations](runtime-final.json) pass in Chromium157 at1280/835/390/320px, local and signed-in against an isolated real Worker. They cover Calendar, Dashboard and All Tasks; light/dark/reduced motion; date-only/unscheduled/overnight/completed cases; controls, persistence, escaped text, old marker geometry and layout bounds. Initial functional checks preceded the internal card-width correction; final visual checks were rerun after it. See the [runtime ledger](runtime-ledger.json).

[SW65 offline/reconnect](runtime-sw.json) passes: index/app/card stylesheet cache hashes match the final source, offline card editing preserves task identity and reconnect/reload retains due/work fields, logged0 and manual alert settings. This is an ordinary browser-tab check, not an installed-PWA launch pass. Physical Safari, native WKWebView and physical phones/iPads are NOT RUN for this website-only change. No backend or native project source was changed.

The [clean phone](reference-task-cards-phone.png) and [tablet](reference-task-cards-tablet.png) screenshots contain synthetic test records. All owned test contexts and Worker8796 were stopped; existing preview8034 was preserved. No credentials or personal user records are serialized in the evidence.

## Local preview and scope

[Open the local Calendar](http://127.0.0.1:8034/#calendar). The actual user preview was refreshed and restored to Week, November9–15, selected Sunday15, with the Tasks sheet open as it was before refresh. Four remaining tasks and the existing records were preserved, without opening an editor or changing any saved task.

Branch `codex/task-date-cards-20261115`, based on `c304e49`. Final app/stylesheet keys are `task-date-cards-20261115-final2`; service-worker cache isv65. The timetable, exact-time markers, task grouping, progress calculations, phone navigation/sheet and desktop/iPad frame remain in place. Local website/TEST feature backup only; no public deployment, shared-main merge, native source sync or installed-phone update.
