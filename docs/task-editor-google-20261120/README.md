# Compact shared Task editor — November 20, 2026

Local website checkpoint on `codex/calendar-deadline-editor-20261120`, following `590758b`. Final shell cache: `duckplan-app-motion-preview-v103`; editor/app/motion asset key: `compact-editor-20261120-final`. This change completes the editor portion of the user's three browser comments. The duplicate Due strip removal and Work/Due list tints were committed separately in `590758b`.

## Reference access and acceptance

**PASS for the requested compact task-entry structure.** The isolated Playwright MCP browser still redirects the supplied Google Calendar URL to sign-in. An alternate route through the installed browser-control connection successfully reached the user's existing signed-in Chrome tab at `https://calendar.google.com/calendar/u/0/r`. It used the connection's documented Playwright API through Node REPL, without copying cookies, credentials or browser profiles, changing browser security settings, or installing anything.

The exact Create → Task interaction was inspected before implementing and repeated after the revisions. Both reference and local desktop used a 1470×745 viewport with mouse/keyboard. Final reference check returned to that same tab and interaction, then closed the empty draft and reloaded; no Google task was saved. `google-task-controls.jpg` contains only the blank editor's upper controls, excluding account details and calendar events.

Acceptance checks defined before tuning: a compact approximately 448px panel, 28px corners, prominent 22px title, an icon-aligned row hierarchy, independent Work and Deadline controls, optional details expanded in place, pill-shaped Save action, an undimmed calendar behind it, and a usable bounded scrolling editor on small screens. Preserve DuckPlan's yellow actions, fields, defaults, data behavior and existing source-to-window motion rather than copy unrelated Google features.

Observed reference: initial panel 448×488px, corners 28px, title 22px/400, compact approximately 40px controls, 40px Save pill with 20px radius. Expanding Work and adding a deadline produced a 448×574px panel, separate start/end controls and due date, with no stack of nested fieldset cards. Google has Event/Appointment/repeat/attachment controls outside the scope of this change.

Final DuckPlan: initial desktop panel 448×502px, corners 28px, title 22px/400, compact icon rows, 40px desktop Save pill and transparent backdrop. The additional 14px and explicit deadline helper support DuckPlan's existing deadline/time fields and extra features. Work has a blue tint; Due has a red tint. Other optional details, logged minutes and alarms expand without nested cards. On touch layouts, actions/inputs are at least 44px and inputs use 16px text. The existing prepared animation frame remains bounded while details scroll; DuckPlan intentionally retains its approved pop-out animation and yellow brand colors. This is a verified adaptation of the requested structure, not an exact copy of every Google feature or a claim about Google mobile/native behavior.

Representative rendered evidence: `1470-745-local-initial.png`, `390-844-local-initial.png`, `phone-work-expanded.png`, `390-844-local-dark.png`, `320-568-local-initial.png`, `835-1000-local-initial.png`, and `844-390-local-initial.png`.

## Implementation

- The same `#task-form` serves Calendar and Tasks Add/Edit. Field names, IDs, validation and saving remain intact; Work appears before Due, and Due time sits beside Due date.
- `task-editor.css` supplies the compact hierarchy, light/dark materials, responsive grids, scroll padding, sticky heading/footer, and visible errors outside collapsed disclosures.
- `task-editor.js` only reads form fields and updates plain-text summaries. It does not write planner data or request the API. It handles reset timing and late programmatic alert hydration.
- Existing alarm/notification preferences remain intact while their disclosure starts collapsed. Editing work still follows the previously confirmed linked-alert rules.
- The popup's early-click fallback and resize radius use the new dimensions; its existing source crossfade/content transition stays in place.
- Both new assets are precached and versioned. No storage, API, backend schema, signing or native bridge changes were made.

## Verification

**PASS:** 598 Node tests (`node-tests.txt`), including four new read-only summary tests. After final asset-version freeze, 42 focused editor-focus, popup-motion, summary and PWA tests passed (`focused-tests.txt`); syntax checks and `git diff --check` passed. The final metadata-only cache bump does not change the behavior covered by the full run.

**PASS:** `runtime.js` through Playwright MCP, Chromium 157.0.8103.79, isolated contexts, Los Angeles timezone, final assets. Eight cases in `runtime-results.json`: local 1470×745, 1156×746, touch-emulated 835×1000, 390×844, 320×568/reduced motion, 844×390 landscape; signed-in desktop 1470×745 and touch-emulated phone 390×844. Signed-in tests use dedicated synthetic accounts against the actual current loopback Worker/D1 at port 8798 with the existing migration fixture, not mocked successful saves or production accounts. The harness asserts actual account mode.

Each case exercised initial title focus; Calendar Add; invalid title and partial work rejection; separate work/due date/time; class, priority, notes, reminder and logged-minute persistence; linked alarm defaults and a manually overridden notification; saving/reloading; Tasks editing and rescheduling without changing deadline/manual notification; cancel/Escape without writes; Tasks Add using the same blank editor; light/dark bounds; reachable footer; deletion/reload and no JavaScript page errors. Date-only deadlines still work through an empty Due time. The saved records remain exactly one task throughout editing.

**PASS:** `failure-runtime.js`, signed-in current loopback backend with one deliberately intercepted PUT returning 503. The mobile editor kept the draft, displayed the failure outside the closed alarm disclosure, enabled retry, and saved exactly once after retry/reload (`failure-results.json`, `phone-save-error.png`). Successful writes use the real Worker.

**PASS:** `offline-runtime.js`, ordinary Chromium browser tab with service worker. Cache v103 contains both new assets; an offline reload retained the compact style and live summary; offline Add and a second reload preserved exactly one saved task (`offline-results.json`). This is not installed-PWA evidence.

Two initial harness setup mistakes (a nonexistent test helper and choosing a hidden landscape launcher) were corrected before the final eight-case run; these were not application changes.

## Release boundary / remaining platform checks

Local website only. Preview: `http://127.0.0.1:8034/#calendar`. No GitHub push or public deployment.

The native repository remains clean at `2f4311a`, cache v100. **NOT RUN:** native bundle sync/build/install and native WKWebView checks, intentionally deferred until the user's instruction **“Publish to public.”** No claim that the installed app contains this editor. Also NOT RUN: physical phone/iPad, Safari/WebKit, Firefox, installed PWA, physical notification/alarm delivery and production-backend writes. Responsive browser emulation and loopback signed-in persistence do not establish those platforms.
