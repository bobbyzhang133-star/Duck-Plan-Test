# DuckPlan

11th Grade Software Engineering group project — Michael, Bobby, and Priya.

DuckPlan is a digital planner for students that combines a calendar and task list, syncs with Axis, and sorts everything by class — with subtle duck theming throughout.

## Production update needed

The hosted server is behind the website and app source, causing missing template/resource features. **The Cloudflare owner can deploy the repair from `main`: [deployment handoff and exact instructions](DEPLOYMENT.md).** It includes the account-access blocker, database migration/deployment commands and web/mobile verification. Publishing these instructions does not deploy the live service.

## Latest website and app source

The latest verified website is on `main`; the matching Xcode app is on [`codex/ios-main-release-20261120`](https://github.com/m-mcnicholas/group-project-michael-bobby-priya/tree/codex/ios-main-release-20261120). The app branch keeps the required native web transport configuration. See [release and installation details](docs/main-release-20261120/README.md).

The separate latest site is [duckplan-latest.ocs-learning.workers.dev](https://duckplan-latest.ocs-learning.workers.dev/#calendar), with its own accounts/data. The original deployment and its owner instructions remain in [DEPLOYMENT.md](DEPLOYMENT.md).
