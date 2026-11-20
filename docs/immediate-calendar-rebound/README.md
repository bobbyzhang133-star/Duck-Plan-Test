# Start the whole-timetable rebound immediately

The user confirmed the whole-calendar rebound technique but reported a pause before returning. The copied first spring contained a deliberate90ms wheel-idle timeout. Remove that wait without changing the complete timetable backing surface, its copied spring shape, resistance, overshoot,440ms duration or fixed date/Due header.

Wheel handling now paints the pull and starts its return in the same input event. Continued wheel input samples the displayed return position, cancels the superseded animation and starts the next return there. No wheel-idle timer remains. Touch keeps its existing distinction: hold the stretch under a held finger and start the same spring immediately on lift/cancel. Reduced motion, drag/lifecycle cleanup and Month behavior remain intact.

Only the viewport script key and service-worker cache changed (v95); no layout, task-data/API/schema or native-bundle change.

## Reference check and latency

Acceptance: create the return within the input event with no idle timer or deferred paint, preserve the historical61keyframes/440ms curve and whole-surface composition, keep the header fixed and keep held-touch behavior.

Playwright MCP inspected `e592335` at local8039 and the current copy before implementation: both held the pull without an active return immediately after wheel input. After removing the timeout, `reference.js` performs historical → current → historical top/bottom checks in matched1156×746 Chromium157.0.8103.79 contexts.

Measured event-to-`Element.animate` scheduling was92.4/91.9ms for the historical top captures and0.5ms for the current top capture; bottom was91.3/91.7ms versus0.5ms. Those are application scheduling measurements, not claims of sub-millisecond physical display latency. Per-frame computed transforms verify the moving return and signed overshoot. Keyframes remain byte-equivalent to the historical reference; the intentional difference is the removed wait.

Both current±42px pulls still overshoot by about2.46px and clean up to rest. Header movement is0px and tasks remain unchanged. `reference.json` contains the captured curves, input timestamps and samples. `preview.png` shows the timetable16ms into its return, paused for the screenshot.

## Verification

- **PASS:**575 Node tests. The new no-delay regression fails against2779074 with no active return before advancing its clock, and passes the updated source. Continued-input cancellation and stale-completion safety are covered.
- **PASS:**27 actual responsive/layout/Due/Month/task/template drag/reload cases, using the prior `../copied-working-spring/runtime.js` harness against this source (`layout-and-drag.json`).
- **PASS:**six final actual browser horizontal/touch/slot/work-block/reduced-motion/v95cache/offline cases (`extra.js`, `extra.json`).
- **PASS:**five continuous trusted-wheel and touch hold/lift cases at1280/835/390px (`input.js`, `input.json`): one bounded active return during wheel bursts, no return while touch is held, return active immediately after lift and clean settlement.
- **PASS:**existing user IABtab14 reloaded with `calendar-viewport.js?v=immediate-working-spring-20261119`. Native scroll input/read-only sampling observed−48px through+2.80844px to `none`; the header remained94px across110samples. No user task was changed. This establishes the actual preview is updated, separately from isolated browser tests.
- **NOT RUN:**physical trackpad/Safari/native WKWebView/installed PWA/real signed-in backend. Synthesized touch/browser evidence is not native-iPhone acceptance. Separate native source and installed apps remain unchanged.

Syntax and final diff checks pass. Local website and TEST feature-branch backup only; no main merge/public deployment. The user's existing tab was refreshed in place.
