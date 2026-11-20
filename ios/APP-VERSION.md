# Current native app version

Local branch `codex/native-axis-first-import-20261120` adds the first-successful-connection Axis overdue rule and completion feedback (cache v96), based on verified native release `8951ee6`. The affected native UI flows and relaunch/reconnect pass in real iPhone/iPad simulator WKWebViews; all589 native tests and the119-file simulator app/widget build pass. See `docs/axis-first-import-20261120/README.md`.

The production API default remains `https://duckplan-latest.ocs-learning.workers.dev/api` and uses that separate site’s accounts/data. The new server rule is still local pending explicit deployment approval. A GitHub upload or phone rebuild alone cannot activate backend changes.

The latest already-published shared app baseline is `codex/ios-main-release-20261120` (cache95); this new feature is a separate local/TEST checkpoint until published. Existing local signing, native alarm/normal-notification providers, icon, guest data and account/API fallback scopes are preserved.

Open the existing `DuckPlan-iOS/ios/DuckPlan.xcodeproj` and Run on your phone after the server update to install the new interface. No physical phone installation or physical alert-delivery test was performed here. Free Personal Team closed-app APNs sync remains unavailable.
