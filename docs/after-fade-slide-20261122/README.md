# Slide up after completion fade

November 22 request: retain the current completion transition and restore upward list sliding after the completed card fades. Supersedes the immediate list snap. Local original-preview checkout only, cache v130.

Restore the 400 ms list-motion coordinator from commit 58f7327 and reconnect its capture/play/cancellation and deferred-render hooks. Keep the current uniformly scaled snapshot, 430 ms opening/fade, particles and delayed v11 full-body duck unchanged. Saving still begins immediately; only rendering waits until outgoing echoes finish. Capture survivor positions before re-render, then animate from those positions to the new list layout. Late acknowledgements coalesce until the slide completes. Motion cancellation and save failures continue to restore the current data promptly. Existing section fade/collapse support returns with the coordinator.

PASS: Playwright MCP Chromium 157.0.8103.79, isolated local desktop Calendar, phone Calendar/Tasks, 835px Dashboard and rapid two-task completion. Actual rendered-frame positions remain fixed while the outgoing echo exists, then show intermediate upward positions with an active geometry animation, settling at the final layout. Tasks leave active lists and remain completed after reload; all temporary artifacts clean up.

PASS: signed-in phone Tasks, actual local Worker/D1 fixture at port 8798 with updated port 8042 static assets. Synthetic dedicated accounts/records only. Injected 650 ms PATCH delay verifies slide continuity, persistent completion and keyboard focus across delayed acknowledgement. Injected 150 ms HTTP 503 verifies rollback to visible unchecked task, effect cancellation and no duck success. Fixture fault injection does not establish production behavior.

PASS: JavaScript syntax, 11 focused list-motion/render-hold/cache tests and git diff --check. The checked opening/typography implementation is unchanged from uniform-card-scale-20261122; reuse those source/copy formatting checks rather than claiming a new native test. Browser evidence and reproduction script are alongside this file.

NOT RUN: native app, physical devices, installed PWA, WebKit/Firefox or hosted mutations. No public deployment/app synchronization; mobile release gate remains unchanged.
