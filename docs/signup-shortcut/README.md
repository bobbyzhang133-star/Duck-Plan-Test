# Task notification signup shortcut

The Start-work notification section of the task editor now includes a **Sign up** button when a web guest needs an account. The local preview opens the existing hosted account form at `https://duckplan.duckplan-cloudflare.workers.dev/#settings`; that form provides both Sign in and Create account. A cloud-enabled copy links to its own Settings account form. The link opens in a new tab with `noopener noreferrer` and an accessible new-tab label. It does not submit or serialize the unsaved task.

The shortcut is hidden for signed-in users and the native iPhone AlarmKit flow. It does not enable notifications on the static local preview. Existing account-change privacy rules still apply after an account session changes.

Verification: all 17 focused button/navigation/PWA/native/web-alarm tests pass; app syntax and diff checks pass. Browser checks at 835×747 and 390×844 show the button beside the help message without horizontal overflow. Clicking the link reached the actual hosted account form and its Create account action, while the original editor and unsaved title remained open. Keyboard Tab focus and Enter activation also pass with reduced motion. Synthetic signed-in/native checks hide the shortcut. Screenshots: [835px](835.png), [390px](390.png).

Included the final account-UI review follow-up: a delayed action error from an old account is now suppressed after an owner change. The reusable product-feedback privacy harness passes every success, stale-result and stale-failure case without real auth/API requests.

Cache version is v25. This is a local implementation/review-branch backup; no public deployment, production account creation or iPhone bundle update was performed.
