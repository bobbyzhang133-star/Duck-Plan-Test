# Latest site and existing Xcode project — November 13, 2026

The user authorized publishing the current local site to shared GitHub `main` and updating the existing Xcode project. The whole-page transition review remains deferred: its proposed replacement is not implemented in this release.

## Source and integration

- Website source: `DuckPlan-motion-preview` at `9d5c044` (application code last changed in `3a351ce`).
- Shared destination: `m-mcnicholas/group-project-michael-bobby-priya`, branch `main`.
- Refreshed shared baseline: `df702c2`, including the production/dev deployment record from PR #19.
- Isolated integration branch: `codex/latest-site-main-20261113`. Merge `55877ce` preserves both sets of `plans.md` history. Its `landing/` tree is byte-identical to the current local preview.
- The stale shared checkout and its untracked mascot images are untouched.

This release includes the approved v11 profile/app artwork, phone Calendar/task sheet and bottom navigation, iPad task/calendar frame, dedicated Calendar Tasks/Templates library with matching scheduling colors, contextual Add actions and saved Goals/Habits/Notes, assignment organization/class resources/priority matrix, signup shortcut, and square folded navigation controls. It retains the current small directional entrance effect; the later full-page stack proposal is documented separately and remains pending.

## Validation

- All 312 canonical Node tests passed, including organization/personal backend, store concurrency, native alarm adapter, routing, motion, popup, persistence and PWA coverage.
- Wrangler development and production dry-run bundles passed: 105 static files, 81.45 KiB Worker source / 20.40 KiB gzip. Existing Worker names, D1 bindings and runtime configuration are preserved.
- Application/backend/native/test diff checks passed.
- Browser and native-build evidence is recorded in the final completion entry below.

## Existing iPhone project

The active Xcode project is `DuckPlan-iOS/ios/DuckPlan.xcodeproj`. It bundles its own `DuckPlan-iOS/landing/` folder. Synchronize the final intended website into that copy while retaining its native account transport/configuration, foreground refresh, OAuth restrictions, alarm integration and personal signing. Do not regenerate the project from the portable blank-team specification.

The checked-in portable `ios/` project in shared GitHub and this existing personal Xcode checkout are separate copies. Publishing GitHub does not install an app on the phone. A verified Xcode build must embed the new files; select the connected iPhone and Run to install that bundle.

## Hosted backend release remains separate

This GitHub/Xcode publication does not deploy either Cloudflare Worker or run a remote database migration. The current source adds `0004_product_organization.sql` and `0005_personal_planning.sql`. The account owner must apply the appropriate pending migrations before a separately authorized hosted deployment; do not deploy this backend over the old schema. New cloud-backed templates/resources/preferences and Goals/Habits/Notes need the matching backend, while local device data remains local.

For that future hosted release, use the existing Worker names, database IDs, origins and owner deployment workflow. Record the current provider version and a verified recovery plan before changing it; rolling back Worker code does not undo additive database migrations. Do not create replacement resources or change the public origin as part of this source publication.
