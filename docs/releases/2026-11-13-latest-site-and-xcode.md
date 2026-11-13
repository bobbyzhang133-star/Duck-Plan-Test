# Latest site and existing Xcode project — November 13, 2026

The user authorized publishing the current local site to shared GitHub `main` and updating the existing Xcode project. The whole-page transition review remains deferred: its proposed replacement is not implemented in this release.

## Source and integration

- Website source: `DuckPlan-motion-preview` at `9d5c044` (application code last changed in `3a351ce`).
- Shared destination: `m-mcnicholas/group-project-michael-bobby-priya`, branch `main`.
- Initial shared baseline: `df702c2`, including the production/dev deployment record from PR #19. Shared main advanced during release preparation to `c0c0d0d` (PR #20 Calendar dark-mode fix and PR #21 deployment record); the release includes that history too.
- Isolated integration branch: `codex/latest-site-main-20261113`. Initial merge `55877ce` preserved both sets of `plans.md` history and the local preview's exact web tree. Final integration `ad784be` also preserves the new shared dark-mode/grid fixes, applies their event palette through the existing shared template/calendar tokens, and advances CSS/PWA cache v36. Internal layouts and the deferred transition proposal are unchanged.
- The stale shared checkout and its untracked mascot images are untouched.

This release includes the approved v11 profile/app artwork, phone Calendar/task sheet and bottom navigation, iPad task/calendar frame, dedicated Calendar Tasks/Templates library with matching scheduling colors, contextual Add actions and saved Goals/Habits/Notes, assignment organization/class resources/priority matrix, signup shortcut, and square folded navigation controls. It retains the current small directional entrance effect; the later full-page stack proposal is documented separately and remains pending.

## Validation

- All 312 canonical Node tests passed on the final integration, including organization/personal backend, store concurrency, native alarm adapter, routing, motion, popup, persistence and PWA coverage. All 51 application/backend/script JavaScript files pass syntax checks.
- Wrangler development and production dry-run bundles passed: 105 static files, 81.45 KiB Worker source / 20.40 KiB gzip. Existing Worker names, D1 bindings and runtime configuration are preserved.
- Application/backend/native/test diff checks passed.
- Isolated browser checks passed at 1280/835/390px: Calendar/Templates, Notes/Goal/Habit contextual creation and reload persistence, unchanged task counts, phone sheet/More/navigation, and no horizontal overflow. Final dark Week/Day/Month checks at 835/390px passed; template and scheduled event fill/accent/title/secondary colors match exactly. The dark board luminance measured .0237 and sampled heading/hour/date text contrast 7.18–12.85. Zero final page/console errors or API/external requests. An initial iPad run lost three HTTP script responses; a fresh isolated retry passed. Scripts and screenshots: [main-20261113](main-20261113/README.md).
- The existing iPhone checkout passed 244 frontend/native transport tests and compiled native boundary checks. Its unsigned generic-iPhone Debug build succeeded; all 105 bundled web files equal its source, all 22 native files/signing remain unchanged, and the approved icon/master hash is preserved. Source sync matches final website `ad784be` except six documented native integration overlays plus the existing native transport file. Backup commit: `4973cb72eeb310cdae243e9b9eaafd29d246f0fb` on TEST branch `codex/ios-latest-site-20261113`.

## Existing iPhone project

The active Xcode project is `DuckPlan-iOS/ios/DuckPlan.xcodeproj`. It bundles its own `DuckPlan-iOS/landing/` folder. Synchronize the final intended website into that copy while retaining its native account transport/configuration, foreground refresh, OAuth restrictions, alarm integration and personal signing. Do not regenerate the project from the portable blank-team specification.

The checked-in portable `ios/` project in shared GitHub and this existing personal Xcode checkout are separate copies. Publishing GitHub does not install an app on the phone. A verified Xcode build must embed the new files; select the connected iPhone and Run to install that bundle.

The updated existing project is open in Xcode; its source editor shows the new v36 bundle and added feature modules. The active run destination remains Any iOS Device, so the user must choose the connected iPhone before Run. No signed installation or physical-device alarm test was performed.

## Hosted backend release remains separate

This GitHub/Xcode publication does not deploy either Cloudflare Worker or run a remote database migration. The current source adds `0004_product_organization.sql` and `0005_personal_planning.sql`. The account owner must apply the appropriate pending migrations before a separately authorized hosted deployment; do not deploy this backend over the old schema. New cloud-backed templates/resources/preferences and Goals/Habits/Notes need the matching backend, while local device data remains local.

For that future hosted release, use the existing Worker names, database IDs, origins and owner deployment workflow. Record the current provider version and a verified recovery plan before changing it; rolling back Worker code does not undo additive database migrations. Do not create replacement resources or change the public origin as part of this source publication.
