# Partial-height date dividers

November 19, 2026. Local website branch `codex/calendar-date-dividers-20261119`, based on `98f8973`.

The Week header's existing six separators were very faint (line color at 60% opacity) and nearly full height. They now span the middle half of each date heading and use an opaque, slightly stronger neutral color. The phone Week selector uses the same treatment. They remain 1px, pointer-transparent and without layout footprint. No line precedes the first date, no gutter/header seam is added, and Day view has no extra divider. Header background and the quicker 220ms rebound are unchanged.

The user clarified that Google Calendar does rebound on the first upward scroll in their browser. That observation is accepted; the earlier public Chromium embed's native clamp was limited evidence and does not disprove the user's OS/browser rebound.

Verification:

- **PASS:** four PWA/cache Node tests and diff checks.
- **PASS:** eight actual local Chromium cases at 1156/835/390/320px, light and dark. Six centered half-height strokes at each visible Week selector; first date unseparated, 1px width, full opacity, pointer-transparent, date selection works, no Day leak/page overflow/record edits/page errors.
- **PASS:** inspected desktop and phone screenshots in this folder. They show short neutral dividers within one continuous date header.
- **PASS:** service-worker v88 caches byte-identical current CSS. Stylesheet key is `half-date-dividers-20261119`.
- **NOT RUN:** physical Safari/iPhone/iPad, native WKWebView/installed app, installed PWA or fresh signed-in backend acceptance. Browser phone/tablet viewports are emulation. No native sync, data/API change or public deployment.

Detailed browser/cache evidence: `runtime-results.json`; reproducible layout check: `runtime.js`.

Preview: `http://127.0.0.1:8034/?v=half-date-dividers-20261119#calendar`.
