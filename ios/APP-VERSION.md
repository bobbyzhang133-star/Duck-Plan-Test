# Current native app version

The latest website lives on this repository’s `main` branch. The matching portable iPhone/iPad project is published on [`codex/ios-main-release-20261115`](https://github.com/m-mcnicholas/group-project-michael-bobby-priya/tree/codex/ios-main-release-20261115).

The app branch includes the native account transport and six documented web overlays. Keeping those on the app branch preserves the website configuration and the app’s existing native behavior. Open `ios/DuckPlan.xcodeproj` from that branch, select your own development team and connected iPhone, then Run to install. Personal signing settings are excluded from the portable project.

The existing local project at `DuckPlan-iOS/ios/DuckPlan.xcodeproj` is already synchronized and retains its original signing settings. A GitHub push or successful unsigned build does not install an update on the phone.

See `docs/release-20261115/README.md` for verified source/build identities and runtime limitations. Production backend activation remains the account owner’s separate deployment step.
