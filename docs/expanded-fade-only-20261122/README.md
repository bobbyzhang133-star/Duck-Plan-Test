# Expanded completion fade only

User clarification on November 22: snap large, then fade only. Remove shrink-back from task completion while keeping the fixed expanded pose, immediate particles, delayed duck reaction and instant list repositioning after the fade. Local original-preview checkout only; no canonical website, public deployment or native app update.

Implementation: `task-finish` now changes opacity only. The base expanded transform stays constant. Fade duration remains 279.5 ms. CSS query updated and service-worker cache advanced to v126.

Acceptance and evidence (Chromium 157.0.8103.79, isolated loopback local-mode fixtures, service workers blocked):

- PASS: 1156px Calendar and 390px Tasks begin expanded; every rendered frame has identical transform as opacity decreases. No enlargement or shrink tween.
- PASS: next row holds its position during the fade, then snaps to its final position without layout animation.
- PASS: delayed duck appears, temporary elements clean up, completed task leaves the active list and stays completed after reload.
- PASS: 390px reduced-motion Calendar skips echo; task completes and persists.
- PASS: both existing service-worker cache tests and `git diff --check`.
- NOT RUN: signed-in backend, PWA/offline installation, WebKit/Firefox, physical devices and native app. This isolated opacity-only revision changes no storage/API/native behavior. Earlier instant-list-snap evidence remains applicable to those unchanged boundaries; no new parity claim.

Reproduce with Playwright MCP `browser_run_code_unsafe` using `check-browser.js`. Frame evidence is in `browser-results.json`.
