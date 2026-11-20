# Remove the extra hard fold-edge segment

November17,2026, based on1e4a6e1. Removed the legacy bottom border from the shared date-header/corner selector. This removes the short solid segment under the blank time-label corner and leaves the existing continuous fold shadow as the boundary. Header height and time positions are unchanged. CSS fold-edge-20261117/cache77.

PASS: four existing PWA tests and four actual Chromium local Day cases (785/390px, light/dark). Both corner and date-row bottom borders are0, fold shadow remains,24hour cells remain and saved task JSON is unchanged. Evidence: runtime-results.json, tests.txt, header.png. Existing user preview reloaded the new CSS while retaining the Dashboard page the user had navigated to; no task records changed.

NOT RUN: fresh offline/cache-hash checks, signed-in backend, native/physical/Safari and installed PWA. Local website/TEST backup only; no main merge, native sync or deployment.
