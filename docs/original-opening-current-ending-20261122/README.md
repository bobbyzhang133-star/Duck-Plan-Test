# Original opening, current ending

November 22 clarification: the initiating animation uses the original buggy version; only the ending uses the most current version. Local original-preview checkout only. No public or native release.

Acceptance: the card instantly changes to the original standalone layout, then uses the original 0–35% keyframes (150.5 ms, ease, scale 1→1.012, translateY 0→−2px, opacity .96→.9). During the last 279.5 ms, retain the newest fade-only ending: peak transform remains fixed as opacity falls to zero. Keep immediate particles, held source geometry until exit, instant list repositioning and the delayed v11 full-body duck approval.

The original clone was laid out outside its task-panel ancestors, which changed typography/grid immediately. Restore that mechanism rather than a 2× wrapper zoom. Keep calendar/clock graphics removed. Allow the copy's box to grow to its new content height, and fit the box/lift within the viewport, so the old overflow defect does not return. A shorter viewport can reduce base scale; the relative lift stays 1.2%. The render-hold safety timeout is 550 ms for the combined 430 ms opening/ending; animationend normally releases it.

## Verification

PASS: Playwright MCP Chromium 157.0.8103.79 in isolated local-mode contexts. Revisited the exact original at port 8043 and compared it with the updated port 8042, with matching 1156×1000 viewport and fixture task. At 0, 75 and 150.5 ms, the opening scale and opacity samples match exactly; translation also matches when the updated viewport-fit offset is zero. Original keyframes and sampled transforms are in browser-results.json. Opening screenshots at 75 ms provide rendered-frame evidence; their icon/overflow differences are intentional corrections, not an exact full-appearance match.

PASS: updated desktop Calendar, phone Calendar/Tasks, 835px Dashboard and reduced-motion phone Calendar. Echo remains within viewport and contains its content; no date-icon graphics; final fade holds its peak transform. Source geometry is held until echo exits; duck reaction appears, temporary elements clean up, the task leaves active lists and remains completed after reload.

PASS: JavaScript syntax check, eight existing render-hold/service-worker tests, git diff --check. Cache v127 and both changed asset query versions updated.

NOT RUN: native app, installed PWA, physical devices, WebKit/Firefox, signed-in/hosted mutation checks. This presentation-only change does not alter persistence/API/native behavior; it does not establish parity on those runtimes.

Reproduce by passing check-browser.js to Playwright MCP browser_run_code_unsafe. Frame sampling uses actual rendered frames plus exact animation-time probes; probes restore elapsed time afterward.
