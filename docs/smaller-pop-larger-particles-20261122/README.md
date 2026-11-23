# Smaller completion pop, larger particles

November 22 request: reduce the task pop-out size and enlarge the particle effect. Local original-preview change only, cache v131.

Reduce the enlargement above normal size by 55% after viewport fitting: desktop base scale 2→1.45; phone enlargement also decreases rather than retaining the old viewport-limited scale. Preserve the original 1.2% lift, formatting, fade, duck and after-fade slide timing. Ordinary particles 10→16, final-day completion particles 22→30; rectangles 6×9→9×13px, circles 5→8px. Ordinary radial spread 36–60→70–106px, celebration spread 82–106→118–154px; upward bias 28→40px. Emission remains immediate, lifetime unchanged.

PASS: Playwright MCP Chromium 157.0.8103.79, isolated local Calendar at 1156×1000 and 390×1000, last-task-of-day celebration and phone reduced motion. Verified live base scale, immediate particle counts, actual computed sizes and radial spread, preserved duck/after-fade slide, completion and cleanup. Reduced motion suppresses both effects. Browser evidence and reproduction script are alongside this file. The final harness uses keyboard Space, avoiding locator.check's post-action verification of a checkbox that reduced-motion rendering immediately replaces.

PASS: interaction-script syntax, two existing service-worker cache tests and git diff --check. No timing/storage/native/API changes.

NOT RUN: native, physical devices, PWA install, WebKit/Firefox or signed-in/hosted mutations. Public deployment and app synchronization remain out of scope.
