# Completed tasks leave the active list — November 22, 2026

Scope: the user's selected [8042 local preview](http://127.0.0.1:8042/?v=completed-archive-20261122#calendar), starting at `4404430`. The user confirmed that the task remained **checked**. Saves were succeeding; the visible checked row came from the expanded Calendar Completed group or the Tasks page's All filter.

## Behavior

- Calendar's Completed group starts folded. When an unfinished task becomes completed, fold that group and the Dashboard's completed details during the next permitted UI render. This also works if the user had opened the archive before finishing another active task.
- Detect the completion before the existing render hold, but wait to apply folding until the pop-out ends. Preserve the 10–12% expansion, immediate particles, held task geometry, upward list slide and delayed v11 thumbs-up duck.
- The Tasks page's default filter now shows unfinished tasks and is labeled **Active**. Today/Upcoming keep their unfinished filters; **Done** still shows completed tasks. The original `data-filter="all"` hook remains for existing navigation integrations.
- Finished records are retained. Users can expand Completed or choose Done, then uncheck a task to return it to the active list. No storage/API/schema changes or deletion.
- Cache is `duckplan-app-original-duck-preview-v120`; the app script query is `completed-archive-20261122`.

## Verification

Playwright MCP Chromium 157.0.8103.79, isolated synthetic fixtures. [Browser script](check-browser.js), [results](browser-results.json).

- **PASS — 9 complete/archive/reopen cases:** Calendar 1156/835/390px, Tasks Active 390px, Tasks Today 320px, Dashboard and matrix, plus signed-in phone Calendar/Tasks. Tests deliberately open existing Completed contents first, then finish an active task with one click. Its source space and stronger echo remain during the animation; afterward no checked copy is visible, Completed is folded, and overlays clean up. Explicitly opening Completed/Done reveals the saved task; unchecking it restores the active row. Reopened and untouched completed records survive reload.
- **PASS — signed-in mode:** actual loopback Worker/D1 at 8798, with this 8042 frontend supplied by a static asset proxy while the fixture handles its real API and dynamic cloud configuration. PATCH responses are delayed 650ms. This is not a hosted-backend check.
- **PASS — early/late save failures and reduced motion:** [results](failure-results.json). Injected 503 responses at 150/1000ms restore the unfinished visible row and show the error; the UI does not hide a failed save. Reduced-motion completion removes the active row without lingering animation artifacts.
- **PASS — 11 focused Node tests:** render hold, refresh coordination and service-worker versioning. JavaScript syntax and `git diff --check` pass. The existing task model and persistence implementation are unchanged.
- **NOT RUN:** native WKWebView, installed PWA, physical devices, Safari/WebKit/Firefox or deployed API mutation checks. Phone/tablet viewport tests are responsive web evidence. The native release gate remains in force.

Canonical 8034 and native checkouts remain clean. No GitHub push, public deployment, app synchronization or signing changes.
