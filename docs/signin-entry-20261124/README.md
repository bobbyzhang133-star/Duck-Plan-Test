# Visible account entry — November 24, 2026

Local website work on `codex/visible-signin-20261124`, based on `bfbd9be`. Website cache: v150. The public Worker and frozen native app were not updated.

## Result

- Added an explicit Sign in control at the top right of Calendar and the headers of the other planner pages.
- The sidebar footer opens the same account window; its avatar remains visible, focusable and clickable when folded. After authentication, the controls use the current account's name/initials, with full accessible labels for truncated names.
- The window reuses the existing account form element and its event handlers, moving it back to Settings only after the closing animation finishes. Google, email, recovery, account creation and account-management controls remain accessible. Settings and Axis remain available.
- Reused `DuckPopupMotion` for expansion from the actual launcher, reverse closing and rapid reversal. The window traps Tab/Shift+Tab, restores focus, respects reduced motion and keeps its close control above the scrolling form.
- Phone Calendar keeps its seven-day selector, selected-day schedule, Add Task and task summary/sheet. The duplicate toolbar Tasks toggle gives its position to Sign in; the task sheet remains accessible through its visible summary.

## Reference comparison

Inspected the actual homepage/login interaction on [Linear](https://linear.app/) and [Notion](https://www.notion.com/) through Playwright MCP before implementation and repeated it after the revisions at matched 1440px and 390px widths. See `reference-comparison.json` and the `linear-header-*` / `notion-header-*` screenshots.

Linear keeps a labeled Log in link visible at both widths and puts Google prominently on its login page. Notion's desktop header uses a 44px account/login icon; its tested phone header did not expose that same shortcut. DuckPlan adopts a persistent, explicitly labeled signed-out entry on phones and an identity/avatar shortcut after sign-in, with a minimum 44px target. Its yellow identity and launcher transitions remain DuckPlan's own design; the reference sites navigate to dedicated login pages.

Acceptance checks: visible account access without entering Settings, an available folded-sidebar shortcut, current-user identity after login, a prominent existing Google method, one shared form root, reversible launcher motion and usable phone layouts.

## Verification

Chromium 158.0.8127.38 via Playwright MCP. Actual isolated local Worker/D1 at `http://127.0.0.1:8788`; static preview at `http://127.0.0.1:8799`. Synthetic accounts and an isolated database under `/tmp/duckplan-account-entry-20261124`; no production records or credentials used.

| Check | Result | Evidence |
| --- | --- | --- |
| 320×568, 390×844 portrait; 844×390 landscape, emulated touch/keyboard | PASS | `final-layout-results.json`, matching calendar/account/dashboard PNGs |
| 1024×768 tablet and 1440×900 desktop, mouse/keyboard | PASS | Same results; folded/expanded sidebar interactions and screenshots |
| Phone Week selector, task-sheet open/close and Add Task at all three phone sizes | PASS | `phone-task-sheet-results.json`; seven day selectors and existing task access preserved |
| Open/close, create-account/recovery panels, restored Settings element and launcher focus | PASS | Layout results; one account root maintained |
| Real local email account creation, wrong-password error, sign-in, sign-out and session after refresh | PASS | `account-actions-results.json`, 390px and 1440px; long account names verified |
| Google button event reaches the existing endpoint | PASS, routing only | Stubbed provider-readiness/destination check in account actions; no Google token exchange |
| Hover, held press, Tab cycle, Enter, close button, rapid reversal | PASS | `interaction-results.json`; opening/closing frame PNGs sample actual WAAPI motion paused at 100ms |
| Dark appearance and short 390×420 form viewport | PASS | `account-dark-390.png`, `recovery-keyboard-viewport-390.png`; close control remains in bounds without field overlap |
| Reduced motion and honest static-preview readiness | PASS | Interaction results; local-only explanation and disabled unconfigured Google method |
| Updated service-worker cache, controlled reload and both new assets | PASS | `reference-comparison.json`, v150, final CSS confirmed |
| Focused Node suite / JS syntax / diff whitespace | PASS | 38 tests: planner UI, popup motion and button interactions; `node --check` on both changed scripts |
| Physical Safari/phone, real on-screen keyboard, installed PWA and native app | NOT RUN | Browser emulation and viewport resizing do not establish these runtime passes |
| Fresh production Google OAuth login with this new UI | NOT RUN | Local UI work only; the Google routing test is not an authentication pass |

Initial checks found a wrapping phone entry, an old sidebar selector hiding/intercepting the folded avatar, Tab leaving the dialog, and a close control overlapping (then scrolling above) the form. These defects were corrected and affected checks repeated. A final cold 320px local navigation exceeded its original seven-second timeout; the same case passed on rerun with a longer navigation allowance.

Unrelated pre-existing auth-hardening drafts in `cloudflare/src/http.js` and migration `0009_oauth_transactions.sql` remain uncommitted and excluded from the UI checkpoint. Migration 0009 was applied only to the disposable local test database; it was not applied remotely.
