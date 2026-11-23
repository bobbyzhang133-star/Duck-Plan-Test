# Immediate task-list snap

November 22 request: remaining tasks snap upward as soon as a task is checked. This supersedes retaining the source row until its animation ends. Remove completion's render deferral from app.js and its presentation API. The detached, uniformly scaled completion echo continues its original small opening bounce and current fade ending independently of the live list. The existing timer coordinator still handles echo cleanup/reaction timing, but no longer delays any list render. Particles, duck timing relative to the echo and persistence remain unchanged.

PASS: Playwright MCP Chromium 157.0.8103.79. First rendered frames already show the following task in its final raised position while the outgoing echo is present. No intermediate row positions or geometry animations. Local desktop Calendar, phone Calendar/Tasks, 835px Dashboard, rapid dual completion. Active tasks disappear immediately and remain completed after reload; echoes/duck clean up.

PASS: signed-in phone Tasks against actual local Worker/D1 fixture at port 8798, with updated static assets supplied from port 8042. Synthetic dedicated fixture account and records only. Injected 650 ms PATCH delay: optimistic list snaps before acknowledgement, save persists, keyboard focus survives acknowledgement. Injected 150 ms HTTP 503: task returns unchecked/visible, echo cancels, no success duck. These transport fault injections do not establish production-server behavior.

Browser source is the original-preview checkout with cache v129, app/interaction URL `immediate-list-snap-20261122`. Detailed runtime, frame positions and assertions are in browser-results.json; reproduce via Playwright MCP browser_run_code_unsafe using check-browser.js.

NOT RUN: native app, physical devices, PWA installation, WebKit/Firefox and hosted account mutations. Native release gate remains unchanged; no publication or app sync.
