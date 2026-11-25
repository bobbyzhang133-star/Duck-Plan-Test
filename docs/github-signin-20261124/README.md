# GitHub sign-in integration

Local branch `codex/github-signin-20261124`, based on `c76de01`; website cache v152. GitHub integration is implemented and locally verified. The user approved registration and GitHub confirmed the new DuckPlan OAuth application4052699 and its exact registered callbacks. Client-secret configuration and end-to-end GitHub authentication remain pending. No production code/schema deployment, GitHub push or native synchronization is authorized or performed by this checkpoint.

## Behavior and security

- The account dialog offers Google, GitHub and email. GitHub remains disabled when credentials or migration0010 are unavailable. The static preview remains local-only.
- New GitHub users are resolved by GitHub's immutable numeric account ID after a server-side code exchange and authenticated profile/email lookup. Only a verified email is accepted; browser-provided email/identity claims are ignored.
- Requests use state plus S256 PKCE. The browser receives a separate opaque ten-minute HttpOnly cookie; verifier/state hash/return path/intent/session binding remain in D1. DELETE RETURNING consumes the transaction once, including cancellation/failure. Cross-provider/ambiguous cookies, expiry, replay and changed sessions fail closed.
- No provider tokens are persisted or sent to the client. Provider failures are sanitized. Production uses HTTPS; HTTP is limited to loopback previews. Auth/session responses are no-store.
- Email equality cannot attach GitHub to an existing account. The user signs in through the existing method and chooses Connect GitHub. A same-origin authenticated POST binds this explicit link to that original session/user. The session is checked again atomically after provider verification, ownership conflicts are rejected, saved user IDs/data stay intact, and the current session is rotated.
- Google lookup now also rejects email-only attachment to a different identity (including a newly created GitHub account), and re-reads raced inserts by Google subject. Existing Google/password sign-in tests pass.
- Migration0010 adds github_sub/its unique index and a separate GitHub transaction table. It neither rebuilds users nor depends on the pending Google migration0009. Preexisting http.js/0009 drafts remain outside this checkpoint.

Provider behavior was checked against GitHub's current primary documentation: [authorization flow/state/PKCE and identity lookup](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) and [verified email API and user:email scope](https://docs.github.com/en/rest/users/emails#list-email-addresses-for-the-authenticated-user). Implemented permissions are `read:user user:email`; repository permissions are not requested.

## Configuration prepared

GitHub OAuth app name: **DuckPlan**. Homepage: https://duckplan-latest.ocs-learning.workers.dev/.

Exact callbacks prepared in the registration form:

- https://duckplan-latest.ocs-learning.workers.dev/api/auth/github/callback
- http://127.0.0.1:8788/api/auth/github/callback

Wildcard redirects and device flow are off. Expiring user tokens remain on (the integration only needs an immediate identity lookup and does not persist refresh tokens).

Environment names: `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. The latter belongs only in Cloudflare's Secret storage or an ignored local `.dev.vars` file. Never paste it into chat, source, screenshots or evidence. Existing Google settings must remain intact. The example file contains names only. Match the actual local port with its registered callback.

The user confirmed ‘Register the DuckPlan GitHub OAuth app’. Registration completed at https://github.com/settings/applications/4052699. The page explicitly shows DuckPlan, client ID `Ov23lijR5sDGw4LqDgq0`, both exact callback URLs, wildcard redirects off and device flow off. The new-window control initially returned blank content; opening the same settings page beside Cloudflare in the main window made its details readable. No duplicate OAuth app was created.

Cloudflare's existing duckplan-latest Production settings have an unsaved two-variable form prepared: GITHUB_CLIENT_ID is filled with the matching public ID, and GITHUB_CLIENT_SECRET is marked Secret with an empty focused Value field. The user was asked to generate the first GitHub client secret, paste it directly into Cloudflare and submit the configuration. This credential-entry handoff is required by the computer-use policy. No secret has been read, printed or entered by the agent. Configuration save is pending user confirmation; no code/schema deployment or real GitHub user authorization has occurred. Registration and secret configuration are separate from a completed user login to DuckPlan.

Public activation remains a separate release decision: use a clean committed checkout (no unrelated http.js or0009 drafts), inspect pending migration list, apply only the reviewed additive schema and deploy the approved source with existing dashboard variables preserved (`--keep-vars`, including GOOGLE_CLIENT_ID and GITHUB_CLIENT_ID) to the intended Worker after authorization. Existing public site/auth settings and the frozen native bundle are preserved meanwhile. Do not run all migrations from the dirty development checkout against production.

## Verification evidence

Playwright MCP Chromium **158.0.8127.38**. UI screenshots were visually inspected. Touch is emulated, not a physical Safari/device pass. Local backend: real Worker/D1 with disposable synthetic email accounts and **dummy** GitHub OAuth values; the external provider destination is intercepted for routing tests.

| Check | Result | Evidence |
| --- | --- | --- |
| Full existing automated suite plus initial GitHub coverage | PASS647/647 | `full-tests.log` (before the final current-location return-path refinement and4 additional auth regressions) |
| Final auth/Worker focused suite | PASS32/32 | `focused-tests.log`, `tests/github-auth.test.mjs`, `tests/cloudflare-worker.test.mjs` |
| State, PKCE, verified identity/email, bad/expired/denied/replayed callbacks, conflicts and revocation during exchange | PASS, provider API mocked | SQLite-backed final focused suite; not real GitHub OAuth |
| Clean exported source without preexisting HTTP/0009 drafts | PASS32/32 | `clean-checkpoint-tests.log` (includes corrected fixture teardown) |
| Existing-data migration, stable IDs, GitHub A/B owner isolation and explicit linking | PASS | Populated migration0010 fixture, full and focused suites |
| 320x568,390x844 portrait;844x390 landscape touch | PASS | `layout-results.json`, corresponding menu/signin/settings frames |
| 1024x768 tablet,1440x900 desktop; folded/expanded sidebar | PASS | `layout-results.json` and sidebar frames |
| Existing forms, open/close transitions, focus and menu keyboard actions | PASS | `check-layout.js`, JSON results |
| Real local server redirect/PKCE cookie/cancel, explicit link POST, cancelled link retains account, email session reload | PASS, dummy client/provider destination intercepted | `account-actions-results.json`, `connect-*`, `cancelled-*` |
| Google/email regression | PASS, Google token response mocked | Existing Worker suite; no real Google login performed in this task |
| GitHub hover/held press, dark/390x420 resized viewport recovery, close reachability | PASS | `interaction-results.json`, `github-pressed-1440.png`, `recovery-short-dark-390.png` |
| Reduced-motion/static unconfigured provider behavior | PASS | `account-actions-results.json`, `static-disabled-320.png` |
| Controlled v152 source hashes/offline menu/dialog | PASS | `cache-results.json`; all six hashes match source |
| Worker bundle dry run | PASS |122.51KiB /29.68KiB gzip,133 assets; no deployment |
| Syntax and whitespace | PASS | Changed JS node --check and git diff --check |
| Real GitHub consent/token exchange in browser | BLOCKED | OAuth registration/client ID verified; secret configuration, public code/schema activation and controlled user sign-in still required |
| Production activation and native/PWA/physical Safari/keyboard | NOT RUN | Release/device gates preserved |

An initial routing fixture tried to intercept only the external URL of a302 chain; Playwright routed only the initial URL. Final routing checks fetch the real local authorization response without following redirects, preserve its cookie and render a neutral destination, then exercise real callback cancellation. The independent clean-checkpoint run exposed a test fixture that unconditionally dropped the uncommitted Google table; it now uses DROP TABLE IF EXISTS so the same suite runs without that draft. One pointer-test release dismissed the dialog outside its bounds; the final test explicitly dismisses then reopens for recovery. A cold8s navigation timeout was increased to25s; the final interaction check passes. None of these fixture changes alter production login behavior.

The scripts in this directory are Playwright MCP browser_run_code_unsafe functions. Run only against the isolated local Worker on8788 and static preview8799. Never run synthetic account actions against production. The tests use no production credentials/data.

The owned dummy-credential QA Worker was stopped after verification. The preexisting static preview on8799 remains available; its GitHub button is honestly unavailable until a real configured backend is used.
