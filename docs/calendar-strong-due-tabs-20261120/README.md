# Stronger Due date tabs — November 20, 2026

Following 6da0646, local website only. Increased header Due tint from 10% to 24% of the existing calendar deadline accent and added a 2px solid red border to its list buttons. Light outline #c45949 and dark outline #ef9b85 match the existing timed-deadline accent in each theme. Work tab styling, dimensions, counts and list actions are unchanged. CSS asset strong-due-tabs-20261120; service-worker cache v107.

PASS: Playwright MCP Chromium 157.0.8103.79, isolated local fixtures, Day/Week × light/dark × 1156/390/320px (12 cases). Checked settled 2px red border, deeper fill, unchanged blue Work fill/zero border, correct Due-list task, Escape close, unchanged task records and no page overflow. The initial harness read during the existing 240ms theme color transition; it now waits for settled paint before asserting the exact border color. Reviewed desktop/phone screenshots. Existing calendar-selection/PWA suites: 6 passed; git diff --check passed. No new implementation-mirroring tests for this styling change.

No public deployment or native sync. Physical devices, native runtime, installed PWA and other engines NOT RUN for this presentation-only change.
