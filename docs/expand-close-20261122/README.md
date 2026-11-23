# Opening and closing motion audit

November 22 scope confirmed: every expandable section, menu and drawer across the current local website. A persistent rule is added to workspace AGENTS.md, this checkout's AGENTS.md and `.cursor/rules/ui-transition-requirement.mdc`, and the task-list UI skill. Public deployment and native synchronization remain outside this task.

Shared reversible motion covers task categories and native details, including dynamically rendered template/resource shelves, dashboard Completed, editor fields and goal/habit notes. Native details retain `open` through closing; lists retain layout until exit, with inert/focus handling. Rapid reversal starts from current rendered geometry. Reduced motion settles immediately. Library menu closing and library dialogs now retain their surface until exit completes; Calendar Tasks/Templates panels crossfade. Existing task/class/goal/habit/note/day-preview/More popups and sidebar/task-sheet transitions are retained.

Browser evidence and audit results will be recorded alongside this file. Browser-owned select/date pickers use their platform behavior; data updates and explicit instant actions are not blanket-animated. Context teardown/reduced motion may settle immediately.

## Verification completed

PASS: Playwright MCP Chromium 157.0.8103.79, isolated local desktop 1280×1000, phone-sized 390×1000 and reduced-motion phone contexts. Seven disclosure families per context: Tasks category, assignment shelf, four task-editor field sections, Calendar category. Observed intermediate heights in both directions; closing elements remain mounted/open/inert, settle without inline-style leftovers, and reverse correctly on repeated clicks. Template menu and library-dialog closing remain present until their exit. Tasks/Templates panels animate both sides and survive repeated reversal.

PASS: existing desktop sidebar grid transitions (76→144→268px opening, 268→200→76 closing), phone task sheet rendered Y positions in both directions, and More dialog closing. Actual template creation through UI still saves and closes; goal/habit note details animate, Goal and Note dialogs retain their existing close motion. Closing notes remain closed when a progress save re-renders the Goals view. Native disclosure opacity reverses from its sampled live value rather than flashing opaque. Resize cleanup is verified; visibility/page/context teardown hooks were source-audited.

PASS: real local signed-in Worker/D1 fixture at port 8798 with updated port 8042 assets: delayed PATCH preserves completion slide and focus, while injected HTTP503 restores the task and cancels success effects. Synthetic fixture accounts only. This does not claim hosted parity.

PASS: 56 focused Node tests covering library, Calendar library tabs, goal/note models, popup geometry/lifecycle, motion tokens and service-worker cache; changed JS syntax, rule/skill YAML frontmatter, git diff --check. Goal-note rendering reads the controller's requested open state so a refresh cannot reopen an in-progress close. Final assets use `expand-close-final-20261123`, cache v137.

Existing Class editor and Calendar task/day/deadline previews were source-audited to retain shared opening and closing callbacks; their shared popup engine has passing tests. Additional direct UI runs for those unchanged variants were NOT RUN. Native app/WKWebView, physical devices, installed PWA/offline install, WebKit/Firefox and hosted-account mutations are NOT RUN. No bundle sync/build/public deploy.

The workspace-level parent AGENTS.md was updated in place outside this isolated checkout's commit; the checkout AGENTS.md, always-applied .mdc and task-list skill are tracked here. Reproduce core checks using Playwright MCP browser_run_code_unsafe with check-browser.js. Browser-results.json records runtime/mode and supplemental probes. The first resize probe sampled before the asynchronous resize event; the final probe waits for that event's settled state and passes.
