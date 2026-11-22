# Stronger task pop-out and completion diagnosis — November 21, 2026

Scope: selected [8042 local preview](http://127.0.0.1:8042/?v=stronger-completion-20261121#calendar), starting from `202f9e4`. Canonical 8034, native app and public sites are unchanged.

The user requested a larger expansion and reported that a task sometimes does not disappear after one click. The larger expansion is implemented. The broader reported disappearance issue remains **pending clarification/reproduction**; it is not claimed fixed.

## Changes made

- Increase the peak from 1.012 to up to 1.12, lift by 6px, and preserve the existing 430ms pop/fade timing, immediate particles, subsequent list slide and delayed v11 thumbs-up duck. Clamp peak width/position to an 8px screen margin, giving 1.10 on the narrow phone Calendar and 1.12 in the other tested layouts. This intentionally changes the formerly preserved original peak at the user's request.
- Fix a reproduced checkbox appearance defect: the computed-style snapshot froze the checkbox's first, still-white transition frame. Its checked value was true, but its white check mark on white background looked empty. Let the cloned checked checkbox use the actual checked colors immediately, bypassing that color transition. Text/layout snapshots remain intact.
- Do not change completed-task display/filter semantics while the clarification is unanswered. Calendar currently moves completed tasks into its expanded Completed group; Tasks → All includes checked tasks, while Tasks → Today excludes them. These are distinct from a failed save or an unchecked task remaining in an active group.

The pending question asks whether the task that remains has an empty checkbox or a checked checkbox. Changes that depend on that answer have not been made.

## Verification

Playwright MCP Chromium 157.0.8103.79, isolated synthetic local fixtures; [script](check-browser.js), [results](browser-results.json).

- **PASS — larger pop:** Calendar 1156/835/390px, Tasks 390px and Tasks → Today 320px. Actual rendered peak is 1.10–1.12, fits the screen margins, retains 430ms timing and does not overflow its text frame. The checkbox is visibly checked immediately (green `rgb(70, 118, 93)`, zero transition duration).
- **PASS — one-click saves in these fixtures:** all five cases complete with one checkbox click, remove the task from the unfinished Calendar groups/Today filter, clean up the echo/source/duck, and preserve completion after reload. Calendar's checked completed copy and Tasks → All's checked row remain visible by their current display rules. Six earlier consecutive Calendar completion checks also saved successfully, but this does not reproduce the user's unspecified intermittent failure.
- **PASS:** 11 focused completion-render, list-motion and service-worker tests, syntax and diff checks. No store/API/schema changes.
- **PENDING:** user-observed task disappearance diagnosis; awaiting checked-versus-unchecked detail. Do not label the reported bug resolved from the passing synthetic cases.
- **NOT RUN:** new cloud mutation checks, installed PWA, native WKWebView, physical devices, Safari/WebKit/Firefox. Native synchronization remains gated on Publish to public.

No remote push, public release, native synchronization or signing changes.
