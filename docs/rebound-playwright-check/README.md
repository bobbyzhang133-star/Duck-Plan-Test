# Fresh Playwright MCP rebound comparison

November19,2026. Audit branch `codex/rebound-playwright-check-20261119`. Application source remains `653941c`; no application behavior, assets/cache, account data or native bundle changed in this check.

**Result: close, not identical.** Completed the requested reference process using Playwright MCP, with three fresh runs. Each run opened the authorized [public Google Calendar Week reference](https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles&mode=WEEK), tested DuckPlan, then returned to that same Google page. Both calendars used Week view,1280×950, macOS Chromium157.0.8103.79 and the same first outward240px synthesized mouse gesture at1800px/s. Nine captures in total.

## Observations

- **Peak stretch:** DuckPlan12px in all three runs; the Google after-check also12px in all three. Google before-checks varied11–12px with frame sampling.
- **Return after the last peak frame:** DuckPlan269–271ms; Google after-check263–266ms. DuckPlan was4–8ms slower in these comparisons.
- **Rendered path:** after release alignment, maximum pixel difference1.24–1.69px; mean difference0.32–0.61px. No opposite-direction oscillation was observed. This is a close raster comparison, not a claim of identical animation.
- **Initial movement:** relative to the Google after-check, DuckPlan's first painted pixel appeared38ms later,10ms later and3ms earlier across the three runs. That variability does not establish a consistent fixed latency or its cause. It includes delivery/frame scheduling and the different tracked pixel markers.
- **Peak plateau:** repeated whole-pixel peak samples lasted13/13/31ms in DuckPlan. Google's before-checks themselves included0/20/21ms plateaus. Raster quantization makes this an imperfect measure of an intentional hold; it should not be treated as proof of a fixed pause.
- **Intentional structural difference:** DuckPlan's date header stays fixed while its timetable moves; Google's native backing moves with its reference page. This preserves the user's fixed-header requirement.

## Evidence and verification

- **PASS:** reference-process execution through `mcp__playwright__browser_run_code_unsafe`, with CDP `Input.synthesizeScrollGesture` and `Page.startScreencast` PNG frames. `capture.js` reproduces each reference→DuckPlan→reference sequence. The first attempt exposed a harness strict-locator error after changing the comparison to Week view; selecting the first timetable column fixed the harness without changing product code.
- **PASS:** actual served viewport script uses `native-reference-rebound-20261119`; SHA256`1c5c8c44767e30e38403055000e970b773b00ca2894db8a1bf176037d6917435` equals the canonical file. Browser contexts blocked service workers for a fresh source read. Task records remain unchanged and no page errors were reported.
- **PASS:** analyzed actual raster motion with the shared `../native-reference-rebound/analyze.swift`; visually inspected the current Week-view peak captures from both sites. `comparison.json`, per-run samples and representative before/peak/settled images retain the evidence. `compare.py` regenerates measurements from the temporary raw frame folders.
- **PASS:** harness syntax and diff checks. Application suites were not rerun for this audit because production code is unchanged; the previous570test pass is historical evidence, not a new result.
- **NOT RUN:** private Google account, physical trackpad, Safari/Firefox, installed PWA/native app or fresh signed-in backend workflows. Synthesized macOS browser gestures do not establish physical input equivalence.

The rule now explicitly names Playwright MCP for available browser reference checks and requires served-version/input/frame evidence. No main merge, deployment or app synchronization.
