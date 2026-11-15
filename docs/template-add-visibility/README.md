# Add to tasks visibility — investigation checkpoint

November 14, 2026, based on `75c6914`, branch `codex/template-add-visibility-20261114`.

The reported Calendar template button saves successfully, but its result is hidden. A new template copy has neither a deadline nor scheduled work. Calendar stays on Templates after saving, and its Tasks grouping excludes undated/unscheduled records. The full Tasks page contains the saved copies. Existing user copies were not removed or changed.

PASS reproduction: an isolated trusted 835px Add click saved exactly one independent copy, retained the source template and survived reload, while producing no visible Calendar task row. See `runtime-baseline.js` and `runtime-baseline-results.json`. The actual current user page was inspected read-only: enabled Add control, success toast, increased task badge, empty Calendar unscheduled list and no browser errors. No actual user button was clicked or record mutated.

The user has been asked where successful Add copies should appear: Calendar's Tasks tab with a new Unscheduled section, or the full Tasks page. That choice remains pending at this checkpoint; no destination-specific UI or grouping change has been made.

Prepared common implementation: an optional host `onTaskAdded(task)` notification runs after an unscheduled copy is durably saved and pending/render cleanup completes, only for the current owner/generation. It does not run for scheduled drops, failed saves, pending duplicate clicks or obsolete owners/destroyed views. All 16 library tests pass, including three added regressions for these guarantees. Syntax and diff checks pass. This callback alone does not fix the visibility issue; the confirmed host reveal still needs implementation and actual runtime verification.

Any prepared post-fix browser runner is NOT RUN acceptance evidence until the user chooses a destination and the corresponding source is implemented. No release, public deployment, native sync, source-cache update or installed-app claim is made. TEST checkpoint only.
