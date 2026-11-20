# Recover timetable stretch after interrupted drags

November18,2026. Local fix on `codex/stretch-recovery-20261118`, based on `20e184f`.

The user reported that stretch had disappeared again. Git inspection confirms the midnight patch changed CSS painting only; the bouncy controller was still present, and six fresh normal top/bottom spring cases passed before this fix. The local8034preview was not responding, with its temporary server script/log absent; recreated the same loopback-only server. These facts do not establish the original user tab's cache, media preference or event history, which could not be inspected with the available browser tools.

Found and reproduced a separate real defect: elastic drag protection set `dragging=true` on drag entry but only released it on a later drop/dragend. An external or interrupted drag without those events could disable all subsequent edge pulls. An isolated injected dragenter→blur sequence followed by real wheel input produced0pxoffset. Two new regression tests failed against the original source.

The controller now releases stale drag protection on leaving the calendar, blur/pagehide/route change, Escape, or a new pointer/touch gesture. Movement between calendar descendants and ordinary viewport refresh still preserve active-drag protection. No spring samples, stretch bounds, fold/material/midnight styling, task fields, APIs or storage changed. New viewport key `stretch-recovery-20261118`, cache83.

Verification:

- **PASS:**17focused elastic/viewport/PWA tests, including2new regressions; JS syntax and diff checks.
- **PASS:**8isolated Chromium157.0.8103.79 recovery cases at835/390px. Injected blur/drag exit/Escape/new-pointer interruptions plus real wheel input recover the stretch without moving the header or changing records. Injection reproduces state handling; it is not proof those events occurred in the original user tab.
- **PASS:**13existing local responsive light/dark Day/Week, normal scroll, return cleanup, trusted Chromium touch, reduced-motion, slot-click/cancel and Month regressions rerun on final source.
- **PASS:**real mouse task-list drag to03:00keeps its18:00deadline; a second real native drag cancelled with Escape leaves a working42pxedge pull.
- **PASS:**actual service worker activatedv83 and cached byte-identical corrected viewport source.
- **NOT RUN:**actual original in-app tab state, native/physical Safari/iPhone/iPad, installed PWA launch and fresh signed-in/backend acceptance. Do not infer the original user's exact cause or physical-device parity from these checks.

Evidence: `runtime.js` and `runtime-results.json`. All owned QA contexts closed; user data preserved and8034preview retained. Fresh URL: http://127.0.0.1:8034/?v=stretch-recovery-20261118#calendar . TEST feature backup only; no main merge, public deployment, remote migration, native sync or installed-phone update.
