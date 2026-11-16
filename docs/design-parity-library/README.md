# Shared design, default yellow and library diagnosis — November 15, 2026

The user confirmed light yellow for Personal/no-class tasks while retaining custom class colors, and identified the installed iPhone/iPad app as the affected runtime. This change applies to the canonical website and the existing native project.

## Changes

- Personal/no-class work blocks use `#fff3bf` with a gold identity color. Original built-in Personal classes, including imported UUID-remapped copies with their original metadata, resolve to this material without rewriting saved class records. User-defined/customized class colors retain their own material.
- Templates now resolve class presentation through the same store helper as saved work blocks. A shared optional default-fill variable makes the template, fitted drag preview and scheduled copy exactly equal in light mode; the existing shared dark recipe remains aligned. This fixes the default-color disagreement without changing custom-class fills.
- Added `.cursor/rules/website-app-design-parity.mdc`, matching AGENTS guidance in the workspace, website and native checkouts, and a testing-procedure clause. It requires the approved responsive layouts, exact-time mobile deadlines, shared materials and independent canonical/bundled/installed/backend version checks. It forbids hiding a capability warning or redirecting accounts to a replacement server.
- Synced the intended web files into the existing Xcode project with its six native overlays. Native code, signing and icon files match their pre-sync hashes. Cache version67 and four `default-yellow-20261115` asset keys invalidate the changed assets.

## Findings and remaining owner steps

The current source already contains exact-time Day/Week deadline markers on phones; only date-only deadlines remain in the top band. Read-only inspection of the user's existing simulator app found `duckplan-app-native-cloud-v1` without that renderer. This is evidence of a stale simulator installation, not a physical-phone version inspection. The updated native QA build shows the correct exact-minute schedule markers and compact/grouped previews. Install the latest build on the physical phone with Xcode Run.

Templates/resources are disabled when the actual account API lacks their planner contract. The public host remains at cache version13 and its library module is absent. The current Cloudflare login cannot find the existing production database (error7404). No authenticated production test account was used, and no remote data changed. A new app alone cannot enable missing server routes/schema. Per the user's earlier choice, prepare the update for the existing site's owner rather than creating a replacement service. [OWNER-DEPLOY.md](OWNER-DEPLOY.md) gives the exact review/migration/deployment/verification procedure.

## Verification

- **PASS:**534 complete website tests and539 complete native-checkout tests, including compiled Swift boundaries. New regressions cover unchanged stored Personal data, UUID-remapped built-ins and custom class colors.
- **PASS:**four affected actual Chromium157 clients,390/835px in isolated local and real localhost signed-in modes. Light/dark template/saved/drag fills match; custom blue stays distinct. Timed deadlines at15:15/17:00/20:00 are in the schedule, while one date-only task alone is in the top strip. Template creation/Schedule/copy/reload works. Evidence: `runtime.js`, `runtime-results.json` and screenshots.
- **PASS:**the complete desktop/phone/iPad browser feature baseline in local and real signed-in modes, six clients. Includes task/template/class/resource/personal CRUD, touch Schedule, desktop drag, source/copy retention, real503/retry and reload. Evidence: `browser-baseline-*.json`.
- **PASS:**real SW67 cache byte-matches all four changed modules/styles; offline yellow-template creation, reload and reconnect retain the record. This is a browser service-worker check, not an installed-PWA claim.
- **PASS:**unsigned Debug Simulator and Release iPhone app/widget builds, both matching all118 native web files. See `build-manifest.json` and native `native-sync.json`.
- **PASS:**eight actual iPhone27.2 WKWebView QA modes using real native URLSession and a compatible isolated backend: local/cloud baseline, relaunch, extended CRUD and presentation. Exact deadline minutes and grouped-list→task preview work; native template and calendar fills match. The temporary QA app uses its own bundle ID/sandbox on the existing already-running simulator. No mock transport or original-user data was used. Actions are scripted DOM, not trusted touch. Evidence: `native-runtime.json` and the credential-free harness.
- **Harness correction:**the first presentation assertion expected a single17:00 marker even though existing deadlines correctly formed a group. The corrected check follows the actual grouped list into the selected task preview; no product change was needed for that diagnostic.
- **NOT RUN:**current native iPad instance, physical phone installation/touch, actual OS permission/delivery/Stop/Snooze/APNs, Safari/Firefox and installed-PWA release baseline. The optional direct OS permission-status probe from the prior release was omitted from these UI checks; no OS-delivery claim is made.
- **BLOCKED:**production library enablement/deployment, because the current account cannot access the existing database. Production capability/schema and live same-account library behavior need the owner's verification after activation.

Only the separate QA app/collectors and isolated Worker are removed/stopped. The original simulator app remains installed with its original bundle/data; the existing local8034 preview is refreshed to the new assets and remains available. No production migration/deployment or physical-phone update occurred.
