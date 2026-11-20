# Required return to the named reference

November 19, 2026. Branch `codex/reference-comparison-rule-20261119`, based on `ef1034d`.

Added `.cursor/rules/reference-site-comparison.mdc` and linked it from the repository and workspace AGENTS guidance. It requires inspection of the exact reference before implementation and a return to the same site after every implementation/revision. Record actual interaction/runtime evidence and remaining differences; an embed, earlier visit or failed reproduction in another runtime does not establish a match or disprove the user's observation.

## Rebound redo: pending reference evidence

The requested full URL is `https://calendar.google.com/calendar/u/0/r`. Opened it in an isolated Playwright browser before writing the rule and returned to that same URL after the rule changes. Both attempts landed at `https://accounts.google.com/v3/signin/identifier`, titled “Google Calendar - Sign in to Access & Edit Your Schedule.” Only the access gate was inspected; the rebound was not available.

**BLOCKED:** actual Google Calendar first-upward-scroll comparison. The previously tested public embed is not accepted as a replacement. User's report that the actual page rebounds remains accepted. A short recording showing the first upward boundary scroll and release, ideally alongside the current local DuckPlan behavior, is needed to compare the requested motion without another unsupported timing guess. No credentials are requested.

**DONE:** persistent rule and required access recheck. **PENDING:** dependent rebound redesign and before/after motion comparison. No application code, current 220ms rebound, half-height date dividers, cache, user data or native bundle changed in this checkpoint.

Validation: reviewed the new rule and both AGENTS sections for the before/after requirement, exact-source distinction and honest BLOCKED handling; `git diff --check` passes. No application tests rerun for documentation-only work. Feature-branch TEST backup only; no main merge or deployment.

Follow-up November19: the user explicitly authorized other reference pages. The public Google Calendar page was then reproduced using rendered-frame capture, and the rebound rebuilt and compared before/after. See `../native-reference-rebound/README.md`. The private-page comparison remains unavailable; it is distinguished from the completed authorized public-reference work.
