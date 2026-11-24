# Sign-in and Axis connections · November 23, 2026

Prepared locally on `codex/signin-axis-ui-20261123`, based on the newest canonical website checkout, `DuckPlan-original-duck-preview` at `80f7ed8` (the November23 public-release source). The user clarified that “all places” means desktop, phone and iPad **website layouts, locally first**. No public deployment, native source sync/build, real user account or school calendar was changed.

## Result

- Account and Axis cards now lead Settings, side by side on desktop and stacked below 1000px. App installation, sync status, notifications and all other settings remain accessible.
- Sign-in and account creation have separate forms, persistent visible field labels, password recovery, inline errors and busy feedback. The account summary uses the existing authenticated identity helper, preserving provider display names and safe email fallback. A missing submit button is resolved to the form's default submit control, including programmatic/assistive submissions; duplicate submissions on a busy submit control are ignored.
- Account modes crossfade in both directions while their shared stage changes height. Existing disclosure motion handles Axis help opening/closing, including rapid reversal, keyboard access and reduced motion. Account/owner changes cancel old presentation immediately so previous-owner content cannot remain visible.
- Axis has a signed-out guide, private-feed form, expandable instructions, first-import explanation, linked/error status, Sync now and Disconnect. Disconnecting retains imported tasks. Validation and server errors retain the feed input for retry. No Axis password or new school login mechanism is introduced.
- The Google sign-in button uses the existing server-side OAuth/PKCE flow and provider capability. It remains visible but disabled with an explanation when Google is unavailable. It is **not falsely enabled** on an unconfigured server. Existing password and recovery methods remain usable. Static account shortcuts now point consistently to the newest online planner; a configured server continues to use its own account route.
- Added the account stylesheet and Google artwork to the service-worker shell and advanced web cache from v145 to v146. Native files remain at their authorized prior release checkpoint.

## Google activation is deferred

The user has an existing OAuth client and explicitly deferred providing its configuration until tomorrow. No credential search, new client creation, credential installation or Google account consent was performed. Actual Google sign-in is **BLOCKED by deferred configuration**, not a completed authentication test.

When resumed, use the existing Web application OAuth client, the exact callback URL of the chosen local Worker (for example `http://127.0.0.1:8787/api/auth/google/callback`), and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in the gitignored `cloudflare/.dev.vars`. The server already derives the callback from its request origin. Restart the local Worker and reload the page; `/api/session` must report `providers.google: true` before the button enables. Then test the actual Google redirect, callback, correct account identity and session restoration. Do not put secrets in chat, tracked files or command arguments. Hosted activation remains a separate authorized release/configuration action.

References: [existing backend setup](../../cloudflare/README.md), [Google's web-server OAuth instructions](https://developers.google.com/identity/protocols/oauth2/web-server), [official branding assets and guidelines](https://developers.google.com/identity/branding-guidelines). `google-signin.svg` uses the official light square Android/Web vector asset with text converted to paths. Only its outer background/border paths are omitted because the responsive HTML button supplies that surface; the G, lettering and their proportions are preserved. No external font or identity SDK is needed for this existing redirect flow.

## Verification

| Case | Runtime/mode | Result |
| --- | --- | --- |
| Automated website suite | Node, final website source | **PASS — 633 tests**; [log](automated-tests.txt). |
| Account creation and recovery-code display | Chromium158, real loopback Worker/D1, synthetic local account | **PASS** using normal Playwright form fill/click; recovery code displayed after persistence. |
| Bad Axis feed, inline error, retained input and retry; connect, Sync now and reload | Same runtime, synthetic upstream calendar | **PASS**; correct account and durable linked status restored. No real Axis feed was accessed. |
| Account mode motion, help open/close, rapid reversal, recovery-code regeneration/dismissal, wrong-password retry, reset, sign-out privacy and durable sign-in | Same real Worker/D1 with DOM-driven acceptance harness | **PASS — 24 assertions**, [reproducible harness](browser-qa.js), [results](browser-results.json). The harness includes a deliberate no-explicit-submitter form submission. |
| Keyboard Enter sign-in | Chromium158, normal Playwright keyboard input | **PASS**; restored the same synthetic account with its new password. |
| Responsive layout | Chromium158 at1280×900,835×1000,390×844,320×568 | **PASS**; cards within viewport, no horizontal overflow, visible inputs48px. [Results](layout-results.json). Emulated sizes do not establish physical Safari/iPad testing. |
| Dark320px, reduced motion and hover | Same browser; actual theme selector, media emulation and pointer hover | **PASS**; no clipping, immediate reduced-motion state changes, help closes immediately, primary hover changes yellow from rgb255/217/61 to255/223/112. |
| Provider UI branch | Temporary in-memory capability simulation only | **PASS for enable/disable rendering only**; restored the actual unavailable state. This does not establish Google authentication. |
| Offline asset readiness | Actual v146 service-worker cache in the QA origin | **PASS**; new CSS and Google SVG are present. Authentication and Axis require network access. |
| Actual Google account/consent/callback | Existing owner client not configured locally | **BLOCKED — user deferred setup**. |
| Public deployment, installed PWA, physical Safari, native iPhone/iPad, real production account/Axis feed | Outside this local website change | **NOT RUN**. No app or public update is claimed. |

During acceptance testing, the prior null-submitter behavior was exposed and fixed. An initial rerun used a stale development service-worker copy; only the isolated QA origin's cache/registration was cleared, followed by an explicit document reload and verification of the new source. No user planner storage or public cache was cleared.

The local fixture in [server.mjs](server.mjs) serves the actual Worker/API and all eight real schema migrations in a disposable database under `/private/tmp/duckplan-signin-axis-db-20261123`. It only accepts loopback requests and intercepts one synthetic upstream host. The test account and password strings in the harness are synthetic and have no production access. The fixture configuration is not used by either public Wrangler configuration.

Screenshots: [desktop](desktop.png), [tablet](tablet.png), [phone](phone.png), [narrow phone](narrow-phone.png), [dark narrow phone](dark-narrow-phone.png).
