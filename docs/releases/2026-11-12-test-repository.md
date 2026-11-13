# Latest website and iPhone version for test GitHub

Destination: https://github.com/bobbyzhang133-star/Duck-Plan-Test, default branch `main`.

The user requested the latest version and confirmed inclusion of both the website and native iPhone app.

## Included

- Current shared-main website baseline (`02289e0`), the reviewed Calendar homepage, task-popup/sidebar behavior, full-body Sigma poses and sideways Daily progress duck.
- Latest phone/iPad layout fixes, dark Calendar contrast and v13 application-shell cache. Screenshots and the 126-state layout review are in `docs/mobile-layout/`.
- The iPhone project's native alarm appearance changes: centered task over a blurred planner, yellow Stop/Snooze controls, cream/yellow Live Activity, ringing-state handling and accessible/scrollable presentation. The four Swift files are copied from the existing iPhone checkout.
- Portable Xcode project settings with no personal development team. The original iPhone checkout and its signing settings are preserved.

## Verification and publication scope

All 214 Node tests, changed JavaScript syntax and diff checks pass. An unsigned generic-iPhone Debug build verifies the combined website/native source and embedded web resources. These checks do not claim physical-device alarm delivery.

The test repository's previous `main` (`242434b`) is an ancestor of this source, allowing a normal fast-forward upload that preserves its history and Chat Check guidance. No force push, shared-main update, public website deployment, database change or phone installation is part of this upload.
