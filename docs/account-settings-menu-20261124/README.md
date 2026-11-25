# Combined account and Settings menu

Local website checkpoint on `codex/account-settings-menu-20261124`, based on `c9eea1d`; cache v151. No public deployment, GitHub upload or native bundle synchronization.

The user confirmed one profile menu containing Settings and Sign in. The folded/expanded sidebar and responsive header controls now open that same menu. Signed-in users see their own name/email and Your account. Settings remains an in-page route. The sign-in dialog reuses the existing forms; it expands and closes through the calendar popup's nine-slice shell while native form text stays at its final size. Folded-sidebar motion captures the visible avatar rather than the clipped full-width row. Closing completes before either menu or dialog is hidden.

## Reference and acceptance

Exact Codex app comparison: **BLOCKED**. The native computer-use entry point rejected access to `com.openai.codex`. No alternative tool was used to bypass that restriction. The user then explicitly confirmed the behavioral specification above. The implementation passes that specification; a pixel/motion match to Codex is not claimed.

Acceptance: one profile entry containing both actions; Settings remains accessible; current identity after authentication/sign-out; viewport-clamped menus; launcher-based opening/reverse closing; crisp sign-in content; keyboard and pointer/touch dismissal; no hidden/clipped required actions; preserved phone calendar and tablet task-column layout.

## Verification

Runtime: Playwright MCP, Chromium **158.0.8127.38**. Screenshots in this directory were visually inspected. Phone cases use emulated touch, tablet/desktop use mouse, and all use keyboard checks. Backend tests use only synthetic accounts in isolated local Worker/D1 storage at `/tmp/duckplan-account-entry-20261124`; no production accounts/data/secrets are used.

| Check | Result | Evidence |
| --- | --- | --- |
| 320x568 and 390x844 portrait; 844x390 landscape | PASS | `layout-results.json`, matching `menu-*`, `signin-*`, `settings-*` frames |
| 1024x768 tablet and 1440x900 desktop; folded/expanded sidebar | PASS | `layout-results.json`, `folded-menu-*`, `expanded-menu-*` |
| Menu Settings/Sign in routes, Arrow/Home/End/Escape/Tab and outside dismissal, focus restoration | PASS | `check-layout.js`, `check-interactions.js` and JSON results |
| Hover, held press, rapid menu/dialog reversal and focus trapping | PASS | `interaction-results.json` |
| Both shell-motion directions, nine rendered slices, fields without scale | PASS | `opening-frame-*`, `closing-frame-*`; paused WAAPI/compositor frames at 35% for desktop and 390px resized mouse context |
| Sign-in/create/recovery panel changes and return of the same forms to Settings | PASS | `layout-results.json` |
| Real email creation, invalid-password error, sign-in/out, session after reload | PASS | `account-actions-results.json`, `signin-error-*` |
| Signed-in long names/email, matching identity, Your account action | PASS | `signed-in-menu-390.png`, `signed-in-menu-1440.png`, real session assertions |
| Dark/reduced motion and short 390x420 recovery viewport, field/close reachability | PASS | `menu-dark-390.png`, `signin-dark-390.png`, `short-viewport-recovery-390.png` |
| Shared task editor and calendar day-list preview opening/closing | PASS | `interaction-results.json` |
| Google button reaches existing auth endpoint | PASS, routing only | Provider readiness/destination stubbed in `check-account-actions.js`; real Google OAuth NOT RUN |
| Static local-mode explanation and disabled unconfigured provider | PASS | `interaction-results.json` |
| v151 controlled cache hashes match source; offline menu/dialog and closing | PASS | `cache-results.json` |
| Focused Node suites | PASS, 39/39 | `node --test tests/planner-ui.test.cjs tests/popup-motion.test.cjs tests/button-interactions.test.cjs` |
| Changed JavaScript syntax and diff whitespace | PASS | `node --check` for app/account-entry/popup-motion; `git diff --check` |
| Physical Safari, actual phone keyboard, installed PWA/native app | NOT RUN | Emulation/resized viewport is not a device pass; native release gate preserved |

An initial tablet timing assertion sampled after a transition could already complete. It was replaced with a synchronous native-cancel event observation; all five final layout cases pass. The first shared-preview smoke used an absent legacy selector; the final smoke exercises the current calendar day-list launcher and passes. The narrow phone Account label and initially offscreen focus target were corrected and the full layout matrix repeated.

## Reproduction and scope

`check-layout.js`, `check-account-actions.js`, `check-interactions.js` and `check-cache.js` are Playwright MCP `browser_run_code_unsafe` functions. Layout/auth checks require the isolated local Worker on port8788; static/cache checks use the existing landing preview on port8799. Never run these synthetic-account actions against production. The owned QA Worker was stopped after verification; the preexisting static preview remains available.

Preexisting `cloudflare/src/http.js` and `cloudflare/migrations/0009_oauth_transactions.sql` authentication drafts remain outside this UI checkpoint. No credentials, backend schema, public Google configuration or native files were changed by this work.
