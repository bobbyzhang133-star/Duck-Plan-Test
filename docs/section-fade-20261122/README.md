# Sample tasks, fading sections and a larger jump — November 22, 2026

Scope: the selected original local preview on 8042, starting at `91b6f8e`. The user requested multiple tasks to try the list movement, fading removal of empty sections, and a much larger expansion. They confirmed that the complete box should stay visible on a phone.

[Open the eight-task sample preview](http://127.0.0.1:8042/?demo=completion-20261122&v=section-fade-20261122#calendar).

## Behavior

- The pop-out targets 2× size instead of the old 1.12 cap. Clamp its uniform scale to available screen width and height, then shift the peak inside 8px horizontal/16px vertical margins. Normal phone cards already fill most of the width, so they use the screen-fit amount; the upward jump increases to 20px. Preserve the 430ms pop/fade, immediate particles and delayed full-body v11 thumbs-up reaction. Oversized source cards can fit down at peak rather than extending outside the viewport.
- Capture visible task sections and completion controls before rendering. When a section such as Due this day becomes empty, temporarily retain its old space, make it inert, and animate opacity, height, margins, padding and borders to zero over 400ms. Following content moves with that collapse; it does not receive a second translation for the same space. The Complete all overdue control fades/collapses when its last task is finished. Newly appearing empty states fade in.
- Restore scroll positions after restoring the temporary space, avoiding an initial scroll-limit jump. Measure final panel heights before restoring exiting elements, so the panel border does not snap at the end. Cancel/reduced-motion/navigation/failure paths restore original styles and inert state. Late refreshes still wait for the movement to finish.
- The sample URL uses a separate local planner data namespace. Ordinary URLs keep the original storage object. The demo is disabled on non-loopback sites and cloud/native configurations, and seeding refuses signed-in accounts. Existing tasks/classes/templates/planner records are not reset or overwritten. UI theme preferences remain shared.
- Samples include one overdue task, four scheduled tasks, one Due this day task and two unscheduled tasks. Each title starts with Sample. Their alarms, normal notifications and deadline reminders are off. Reloads preserve completion and do not duplicate/reopen samples. Changing the numeric demo batch in the URL creates an independent set.
- The phone task sheet opens for this demo URL so the sample list is immediately visible. The normal homepage/responsive layout remains unchanged. Cache version is `duckplan-app-original-duck-preview-v121`.

## Verification

Playwright MCP Chromium 157.0.8103.79, isolated fixtures.

- **PASS — 8 sample/motion cases:** Due-section removal at 1156/835/390/320px; disappearing overdue control; Tasks empty state; navigation during a section collapse; reduced motion. [Script](check-browser.js), [results](browser-results.json). Rendered frames show a retained section during the task exit, then intermediate opacity/height values before removal. The final panel-height frames have no end-of-collapse jump. Eight records persist without reset/duplication; normal planner data stays byte-identical and remains accessible after leaving the demo URL. Sample reminders are disabled.
- **PASS — 9 normal/signed-in regressions:** Calendar desktop/tablet/phone, Tasks Active/Today, Dashboard, matrix, signed-in phone Calendar/Tasks using the actual loopback Worker/D1 fixture on 8798. [Script](check-core-actions.js), [results](core-actions-results.json). Static assets are proxied from this 8042 checkout; the fixture supplies the real API and dynamic cloud config. Delayed 650ms PATCH responses retain correct completion, archive access, reopening and reload persistence.
- **PASS — failure while fading:** inject a 503 PATCH response at 650ms on the real signed-in loopback fixture, after the section collapse has begun. [Results](rollback-results.json). The task returns unfinished/visible, styles and inert state restore, temporary overlays clear, and error feedback is shown.
- **PASS — rendered peak and fade:** [results](visual-results.json), [835px peak](larger-peak-835.png), [390px peak](larger-peak-390.png), [835px heading fade](heading-fade-835.png), [390px heading fade](heading-fade-390.png). Actual peak scale is 2 at 835px and 1.10 at 390px; the box stays inside the viewport. The sampled heading has intermediate opacity 0.439 and shrinking height rather than disappearing instantly.
- **PASS — 15 focused Node tests:** preview guards/isolation/idempotence/no signed-in seeding, render hold, list-motion refresh coordination and service-worker versioning. Changed-JS syntax and diff checks pass. The store implementation, API/schema and native bridge are unchanged; only the opt-in local preview selects an isolated storage adapter.
- **NOT RUN:** installed PWA, native WKWebView, physical devices, Safari/WebKit/Firefox and deployed API mutations. Responsive browser sizes do not establish installed-app parity. Native synchronization remains gated on Publish to public.

No public release, GitHub push, native synchronization or signing changes. The canonical 8034 and native checkouts are untouched.
