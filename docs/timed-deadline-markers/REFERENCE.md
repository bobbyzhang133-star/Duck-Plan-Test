# Confirmed deadline reference — November 15, 2026

The user selected Option1: an exact-time deadline marker plus a separate scheduled-work duration block. They asked for the newest specific UI in the existing [Repository Overview conversation](https://chatgpt.com/g/g-p-6addac00e55c8191a3f6db4456733345-duck-plan/c/6addacc2-3bc4-83e8-8f06-cdbedefe067c). The latest response and its rendered conceptual demo were inspected in the user's existing Chrome tab; no message was sent.

The latest recommendation supersedes the earlier recommendation to put every deadline in the top strip:

- An explicit due time belongs at that minute in the hourly grid. The demo shows a small coral diamond at5PM beside a compact, pale warm deadline label, with a separate filled work block at3–4PM.
- The marker is a point in time. It does not occupy an artificial work duration, reserve availability or gain work-drag behavior. There is no full-width deadline rule competing with the current-time indicator.
- A date-only deadline remains above the timetable. Its end-of-day status semantics must not invent a timed visual occurrence.
- Nearby or shared deadlines use compact markers and an expandable list, with the original exact due times retained. Selecting a deadline opens task details.
- Work planned after a deadline keeps its existing warning and reschedule action. Neither date is changed automatically; one task may have separate work/deadline calendar occurrences while retaining one saved identity.

The website implementation is local to `DuckPlan-motion-preview` on `codex/timed-deadline-markers-20261115`, based on the verified account-sync checkpoint `2be920544688b82462edea69430e92f4551b7458`. The native checkout and the public site are separate versions and are not updated by this presentation change.
