# GitHub sign-in integration

Local branch `codex/github-signin-20261124`, based on `c76de01`; website cache v152. GitHub integration is implemented and locally verified. The user approved registration and GitHub confirmed the new DuckPlan OAuth application4052699 and its exact registered callbacks. Cloudflare client-ID/secret configuration is verified; public code/schema activation and end-to-end GitHub authentication remain pending. The user subsequently approved public website-only activation: migration0010 and the tested website are deployed. No GitHub main upload or native synchronization was performed.

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

The user reported ‘done, secret deployed’. The Cloudflare Production settings table now visibly lists the matching GITHUB_CLIENT_ID and a GITHUB_CLIENT_SECRET entry showing Value encrypted. No secret value was read or printed. The credential-entry handoff is complete. This proves configuration presence, not a matching-secret token exchange or a completed GitHub login.

Public activation was separately approved; future activations must also use a clean committed checkout (no unrelated http.js or0009 drafts), inspect pending migration list, apply only the reviewed additive schema and deploy the approved source with existing dashboard variables preserved (`--keep-vars`, including GOOGLE_CLIENT_ID and GITHUB_CLIENT_ID) to the intended Worker after authorization. Existing Google settings and the frozen native bundle are preserved. Do not run all migrations from the dirty development checkout against production.

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
| Real GitHub consent/token exchange in browser | BLOCKED | OAuth registration/client ID, encrypted secret presence and public activation verified; user-owned consent/callback still pending |
| Production website activation | PASS | User-approved migration0010 and versioncb22f5ca deployed; live checks below |
| Native/PWA/physical Safari/keyboard | NOT RUN | Website-only scope and native checkpoint preserved |

An initial routing fixture tried to intercept only the external URL of a302 chain; Playwright routed only the initial URL. Final routing checks fetch the real local authorization response without following redirects, preserve its cookie and render a neutral destination, then exercise real callback cancellation. The independent clean-checkpoint run exposed a test fixture that unconditionally dropped the uncommitted Google table; it now uses DROP TABLE IF EXISTS so the same suite runs without that draft. One pointer-test release dismissed the dialog outside its bounds; the final test explicitly dismisses then reopens for recovery. A cold8s navigation timeout was increased to25s; the final interaction check passes. None of these fixture changes alter production login behavior.

The scripts in this directory are Playwright MCP browser_run_code_unsafe functions. Run only against the isolated local Worker on8788 and static preview8799. Never run synthetic account actions against production. The tests use no production credentials/data.

The owned dummy-credential QA Worker was stopped after verification. The preexisting static preview on8799 remains available; its GitHub button is honestly unavailable until a real configured backend is used.

## Verified activation candidate after credential save

- `activation-candidate.json` records the clean source b23a920, staging directory, exact migration hash and rollback version7f3a3da4-c9a7-4aca-8922-f9ff96f670f2 (the user's credential-config deployment). No HTTP/0009 drafts are present in the source export.
- Anonymous public session response still reports password/Google only; public HTML has neither the combined Account menu nor GitHub UI version. `public-status-before-activation.json` contains capabilities only, without user data.
- Read-only D1 metadata confirms migrations0001–0008 are applied, github_sub/transaction table are absent, and rows_written=0. No production account rows were queried.
- A separate `cloudflare/wrangler.github-activation.jsonc` in the staging directory sets keep_vars=true and points at a migration directory containing **only0010**. It retains the same Worker/database/bindings/assets. This preserves GOOGLE_CLIENT_ID/GITHUB_CLIENT_ID and existing secrets and prevents accidentally applying draft0009. Final clean-export dry run passes with121.50KiB/29.54KiB gzip and133 assets; nothing published.
- Final clean-source automated run: **651/651 PASS**, `release-full-tests.log`. The isolated export initially lacked two non-runtime test fixtures and two Swift domain-test source files; those committed inputs were added and the entire suite repeated successfully. This was not an Xcode/native-app build or source sync.
- Six Playwright MCP Chromium158.0.8127.38 full-core baseline cases pass: signed-in and local browser-storage modes at desktop1280x900, phone390x844 and iPad835x1112. `release-browser-cloud-results.json` and `release-browser-local-results.json` cover class/resource actions, template create/edit/Schedule/drop/Add/reload, task validation/failed-save retry/edit/complete/reopen/delete, note/goal/habit persistence/deletion, type isolation, native desktop drag and signed-in live-peer updates. Screenshots were visually inspected. The historical runner was adapted to the current Done filter: click completion, inspect persisted state, open Done to reopen, then return to Active. No application code changed for this fixture update.
- This browser baseline does not establish physical Safari/keyboard/PWA/native delivery, real GitHub/Google OAuth, alarm delivery or an installed-app update. Existing focused phone320/390/844-landscape, popup-motion and cache evidence remains applicable because runtime source did not change.

The user explicitly approved ‘Activate public website only’. The approved action is to publish the current tested website (including the combined Account/Settings menu and GitHub control) to the existing duckplan-latest public site and apply only0010. Native synchronization and GitHub main upload are outside this website-only activation. After approval, verify runtime provider readiness, real user-owned GitHub consent/callback/session and preserved planner ownership; credential presence alone is not a successful OAuth pass.

## Approved public activation

The user explicitly approved **Activate public website only**. Only migration0010 was applied (5 SQL commands, success), using the isolated migration directory. The existing pre-migration D1 Time Travel bookmark and code rollback version are recorded in activation-candidate.json; no user records were exported.

Published clean source b23a920 to https://duckplan-latest.ocs-learning.workers.dev as Worker version **cb22f5ca-f4f3-4803-9f3c-23bfdb9d3826**.13 changed assets uploaded;121.50KiB Worker/29.54KiB gzip;1ms startup. The dashboard-variable difference notice was expected: keep_vars=true plus --keep-vars preserved the existing Google/GitHub IDs, and provider readiness was verified afterward. Existing secrets were not read/replaced. deployed-activation-config.json records the exact non-secret config.

Live checks through Playwright MCP Chromium158.0.8127.38:

- /api/session returns password=true,google=true,github=true. Both sign-in methods are enabled, and the combined Account/Settings menu and cachev152 are published.
- Five signed-out rendered layouts320x568,390x844,844x390,835x1112,1440x900 pass bounds, button readiness, opening/closing and focus restoration without page errors. Phone/iPad touch is emulated. See live-ui-results.json and live-signin-* screenshots. No production account fixture was created.
- All six changed client source hashes match the tested source exactly (live-asset-hashes.json).
- Google and GitHub authorization-start routes return302 to their correct provider with correct public callbacks and S256 PKCE. GitHub uses the dedicated client and read:user user:email scopes and an HttpOnly transient cookie. Google client/secret availability remains intact. This checks starts, not completed consent/token exchanges.
- A controlled anonymous GitHub cancellation round trip consumes/clears its transient transaction/cookie and leaves an anonymous session. No business/account records were created or modified by that check.

The normal Chrome profile has an existing signed-in DuckPlan account. The user was asked to open Your account → Connect GitHub, review the intended GitHub identity/permissions and authorize DuckPlan themselves, then report callback success/error. Native window focus switches during agent interaction, so the final user-owned consent flow is handed over rather than claiming it was completed. **Real GitHub linking/token exchange remains pending**, and an enabled provider button is not that pass. Do not query unrelated production accounts or treat their records as disposable fixtures.
