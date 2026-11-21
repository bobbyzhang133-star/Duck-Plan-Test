# Gentle fade during the original pop — November 20, 2026

User clarification: **“Slight fade, then both fade together.”** Follow-up to `0f3c38c`; local website only, cache v118, stylesheet `original-pop-soft-fade-20261120`. The original430ms pop-out transform curve/easing remains unchanged. Its card now fades from0.96 to0.90 at35%, then0.86 at430ms and holds there during the full-body duck's thumbs-up. The shared parent supplies the later complete fade of both elements. The original version's full early fade tozero is deliberately not copied, following the confirmed choice.

Playwright MCP / Chromium157.0.8103.79, isolated synthetic local contexts:

- **PASS:** desktop1156px, phone390px, phone dark and reduced motion. [Harness](check-browser.js), [results](browser-results.json). Rendered phase samples confirm0.96→0.90→0.86, retained task/duck visibility, common parent fade, no overflow, finite cleanup and completed state after reload.
- **PASS:** returned to the actual original preview8042 and compared against8034 at matched390×844/checkbox input. [Comparison](compare-original.js), [results](comparison-results.json), matched peak captures. Transform matrices,430ms duration and`ease` remain equal. Opacity intentionally differs after35% to retain the card for the duck.
- **PASS:** both existing service-worker cache tests, service-worker syntax and diff checks.
- **NOT RUN:** new native/PWA/physical-device checks or signed-in/failure/concurrency checks; no storage/API/native behavior changed. The preceding full-body change's actual signed-in/local tests remain historical evidence, not new passes. Native app remains unchanged under the public-release gate.

Phase captures use paused browser animations plus rendered frames and do not establish physical-device frame-rate performance. No reference/user task records were changed. No public deployment or remote push.
