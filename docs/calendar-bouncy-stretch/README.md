# Bouncy timetable stretch

November18,2026. Local follow-up on `codex/calendar-bouncy-stretch-20261118`, based on `b225574`. The user clarified that the edge stretch must rebound like the earlier versions, rather than simply easing back into place.

## Historical reference and change

Reviewed Git history, not only the current implementation:

- Before `b3f8941`, Calendar's `planner-motion.css` used `overscroll-behavior: contain`, leaving boundary bounce to the browser/OS. That native behavior also pulled the sticky header and was subsequently disabled. No deterministic custom Calendar spring existed there to copy, and no physical old-version trackpad recording was available.
- `6814b34:landing/page-stack.css` contains the earlier approved underdamped spring: damping .67, frequency7.1,440ms,61samples and a smooth tail. Verified all61numbers in the new timetable curve exactly equal that historical source.
- `b225574` used the shared critically damped400msrelease, which never crossed its resting position. Replaced only the timetable return with explicit native transform keyframes from the historical spring. At48pxpull the measured rebound is2.81635pxpastrest, then it settles tozero. Bottom pulls mirror this behavior. Explicit keyframes retain the bounce without requiring CSS `linear()` easing support.

The48pxresistant pull, renewed-gesture continuity, opposite header compensation, full red dot, normal scrolling, reduced-motion path, drag/lifecycle cleanup and data semantics remain. Button, popup and navigation curves are unchanged. Source key is `bouncy-edge-stretch-20261118`; service-worker cache is80.

## Verification

- **PASS:**15focused Node elastic/viewport/PWA tests and JS syntax/diff checks. The new regression requires a bounded rebound past zero at both edges, a resting tail, and equal opposite header motion at every sample. Interruption checks cover both positive return and negative rebound positions.
- **PASS:**6real Chromium157.0.8103.79 animation-sampling cases at1280×950,835×1100 and390×844, top/bottom. Native animations sampled at0/150/210/264/350/430ms show the signed rebound and a stationary header at every phase, with cleanup and unchanged records. See `runtime.js` and `runtime-results.json`.
- **PASS:**13existing isolated full-app browser cases rerun on this source: light Day/dark Week, both limits, normal scrolling, matched axis/body motion, phone trusted Chromium touch, reduced motion,01:00slot editing/cancel and Month. Four viewports include320px. Zero page exceptions and no record changes. The harness now waits for actual animation cleanup, bounded at2s, rather than its older550msfixed sleep; that sleep initially failed after increasing the return duration. No production code change was needed for the harness timing.
- **PASS:**actual service worker activatedv80, cached viewport text matched current served source exactly, and the module remained available after offline reload. This is tab/service-worker evidence, not an installed-PWA launch.
- **NOT RUN:**physical macOS trackpad, physical Safari/iPhone/iPad, native WKWebView/install and fresh signed-in/backend acceptance. Browser viewport/touch emulation is not native or hardware smoothness evidence. The previous dot/drag implementation is unchanged; no new physical-platform claim is made.

All QA contexts closed; the existing HTTP preview and user data remain. Review http://127.0.0.1:8034/#calendar after refreshing. Local website and TEST feature backup only; no public deployment, shared-main merge, native bundle sync or phone update.
