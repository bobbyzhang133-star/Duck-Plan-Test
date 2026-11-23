# Uniform task-card scaling

November 22 request: preserve the whole task's formatting and change only its scale. Supersedes the preceding standalone-layout reflow. Source snapshot now freezes ancestor-dependent grid, typography, wrapping, spacing and box dimensions before moving to the body. Calendar/clock icons remain removed with equally sized invisible spacers, per the earlier request.

The card instantly scales as one unit, up to 2× as previously requested, limited to the viewport with room for the 1.2% opening lift. Opening timing (150.5 ms), fade-only ending (279.5 ms), particles, delayed full-body duck and list snap remain unchanged. There is no detached hidden measurement or reformatting step. Cache v128; changed interaction-script URL updated.

PASS: Playwright MCP Chromium 157.0.8103.79, isolated loopback local mode, service workers blocked, desktop Calendar 1156×1000, phone Tasks and Calendar 390×1000, Dashboard 835×1000. Compared the original card with its transformed copy: unscaled box dimensions, child positions/sizes, font/line heights and text rectangle counts remain the same (subpixel geometry tolerance .15px; grid tolerance .05px for browser serialization). Every tested title and Due/Work value retains its wrapping. Sampled scale/opacity confirm original small opening lift, fixed-scale fade and no shrink-back. Task completes, leaves active list after exit, persists on reload, retains duck reaction and releases temporary elements.

PASS: interaction-script syntax, eight render-hold/cache tests, git diff --check. Initial strict grid-string equality was corrected to allow .016px serialization rounding; actual wraps and typography were unchanged. An earlier bounded cleanup sample failed intermittently under browser load; the complete rerun passed all cases without a product change.

NOT RUN: native, physical devices, PWA install, signed-in/hosted mutation, WebKit/Firefox. These presentation-only checks do not claim native or backend parity. Mobile app release gate remains in effect; no source sync or public deploy.

Reproduce with Playwright MCP browser_run_code_unsafe using check-browser.js. Detailed source/copy geometry and rendered-frame evidence are in browser-results.json.
