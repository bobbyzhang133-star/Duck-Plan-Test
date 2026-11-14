# Move complete page layouts

Local correction of the stationary divider reported on Dashboard, starting from `4820707` on `codex/moving-layout-20261113`.

The marked line is the bottom border of `.compact-topbar`, defined in `landing/planner-ui.css`. The previous transition animated `.topbar-title` and `.topbar-actions` independently while leaving their parent and its border still. Calendar similarly animated selected inner pieces while leaving the surrounding frame still.

The default motion groups now follow complete layout surfaces:

- Dashboard, Tasks, Classes, Goals & habits, Notes and Settings: the complete `.compact-topbar` and active view are two disjoint roots in the same content phase.
- Calendar: the complete `.planner-workspace` moves once, including its rounded frame, shadow, task-column divider, toolbar, timeline/grid and task pane.

Both generic siblings use the same 64px entrance, 60ms delay, 440ms spring and opacity timing. Their relative spacing remains constant through entry, overshoot and settlement. Children inherit that movement rather than receiving additional transforms. This deliberately replaces the title/control stagger so borders and their associated content stay aligned. Sidebar navigation, viewport/backing and system overlays remain outside page motion.

The live incoming renderer, outgoing-only snapshots, pointer-hold hitboxes, privacy/owner guards and interruption cleanup are unchanged. No wrappers or DOM reparenting are introduced. Cache v44 and a versioned controller URL refresh the changed asset.

## Verification

`node --test tests/view-transitions.test.cjs tests/pwa-app.test.cjs`: **31 passed**, zero failed. Controller syntax and diff checks pass. This is a selector/presentation correction; the data/API/native implementation is unchanged.

Browser evidence in this directory uses isolated signed-out local fixtures with API/external traffic blocked. The baseline selector map is frozen independently of the current source. Verification compares the actual header border position with its title/search controls and the active view, checks complete Calendar frame/grid motion, and exercises every route in both directions without nested transforms.

[The main browser matrix](results.json) passes 16 cases in Chromium 157. At a shared 80ms elapsed time, the baseline divider stays at zero displacement while the page body moves 61.068px. With the corrected grouping, the divider, header/title/search and body all move +61.068px forward or −61.068px backward. Their spacing remains equal through the spring's overshoot, with measured registration error below 0.00002px. Calendar's frame, task pane and grid inherit one translation rather than moving twice. Visible borders are covered across all seven sections; trusted held-checkbox and Calendar clicks, reduced motion and coarse touch pass without page errors or failed requests.

[Normal forward/reverse playback](moving-layout-835.webm) and [its filmstrip](filmstrip-835.png) were visually inspected separately from held-frame assertions. All contexts use disposable demo fixtures and are closed after verification.

[Dark mode with expanded 835px navigation](dark-expanded-results.json) also keeps header/divider/body together at −3.74725px overshoot, without horizontal overflow. A [390px fine-pointer follow-up](fine-phone-sheet-results.json) checks the transformed Calendar frame's fixed-position drawer: the closed pane remains outside its clip, and opening Tasks during the live entrance already settles the route through the existing focus flow. The sheet has zero position/size jump after settlement; no extra application workaround was needed.

The actual in-app preview loaded the updated controller, completed Calendar→Dashboard→Calendar and showed the marked 1px divider on Dashboard. Its prior November 13 Day calendar and exact 465px calendar scroll position were restored through the UI. No editor was open and no planner record was edited. That user-context screenshot stays in private temporary storage rather than this repository.

Scope is the current local website. Responsive/coarse/reduced-motion behavior is checked proportionately; no native-project synchronization, installed app update, signed-in backend acceptance or public deployment is included. Physical iPhone/iPad, installed PWA and other browser engines are not inferred from Chromium tests.
