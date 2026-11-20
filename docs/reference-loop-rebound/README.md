# Completed reference correction loop: calendar rebound

November19,2026. Branch `codex/reference-loop-rebound-finish-20261119`, based on `fffbdfb`. Final viewport source SHA256`350277672973920c4d8d0e7119c210a487a20ed48a8322cf6e7b387c49f79bd8`, asset key `reference-loop-rebound-final-20261119`, service-worker v91.

## Requirement and result

The user clarified that “reference” means implement the requested element, check it with Playwright MCP, correct differences and continue until the requirements pass. Updated the always-applied reference rule plus repository/workspace AGENTS guidance accordingly. Review-only requests remain review only. Acceptance criteria were written in `acceptance.json` **before tuning and were not loosened**.

**PASS:** three final upper-edge comparisons and three final lower-edge comparisons. Every sequence visits the authorized [public Google Calendar Week reference](https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles&mode=WEEK), tests DuckPlan, then returns to that same Google page. Matching Week view,1280×950, macOS Chromium157.0.8103.79,240px synthesized mouse gesture at1800px/s. Both sites are measured using rendered hour rules and compositor frame timestamps; input-relative first paint avoids conflating the tool command's delivery time with application response.

Final six comparisons (`final-comparison.json`):

- Peak difference at most1px; DuckPlan12px, reference11–12px depending on the sampled frame.
- Maximum release-aligned path difference about1px, below the predeclared1.5px raster/interpolation limit.
- Return timing difference at most16.67ms, within one60Hzframe. Five final comparisons have effectively the same sampled return duration; one reference rounds/rests a frame earlier.
- First painted movement difference at most2.72ms after the received wheel input, below the one-frame limit.
- No added opposite-direction oscillation. Fixed date/Due headings are checked independently; the prior requested half-height date dividers remain.

These are passing matches at the declared rendered-pixel/frame precision for the authorized public reference. They do **not** establish private-account or physical-trackpad equivalence. Google moves its native backing; DuckPlan intentionally keeps its header stationary, preserving the user's earlier design requirement.

## Corrections made and checked

1. Paint the first boundary pull immediately; subsequent updates still coalesce through requestAnimationFrame.
2. Start every return layer at the same current document timeline time, removing the extra WAAPI pending-start frame and keeping header compensation synchronized.
3. Use a24msquiet interval so an active60Hzwheel gesture can accumulate its full native-sized pull. A trial that backdated return during an8msinterval interrupted active input and failed the stretch check; a full backdated24msreturn overcorrected the path. Those failures were corrected rather than reported as completion.
4. The initial fractional return passed upper-edge comparisons, but the mirrored lower-edge check still failed timing. Match Chrome's published rounded-pixel wheel motion: wheel paint and return samples now use whole pixels, with step interpolation between fine-grained return samples. Touch retains its smooth resistant held pull and releases on finger lift. This removed the remaining lower-edge tail discrepancy.
5. Repeat both directions three times on the final source; all six pass the unchanged criteria. No further motion changes followed those captures.

Earlier failed/intermediate comparison records are retained, including the lower-edge failure that prompted the pixel-rounding correction. A baseline screencast missed its settled frame; no passing timing claim is made from that partial capture. Final capture validation rejects an incomplete return and retains a separately identified settled screenshot. This does not turn a dropped frame into evidence of a faster return.

## Regression verification

- **PASS:** all571Node tests on the final motion source. The new immediate-first-paint/shared-start-frame regression fails on the original source and passes after the fix. Existing tests now account for native whole-pixel accumulation and tail rounding.
- **PASS:**21final actual Chromium cases cover1280/835/390/320px, light Day/dark Week, both limits, stationary headings, trusted touch hold/release, reduced motion, the correct01:00slot editor/cancel, Month, unchanged records and no page errors. `runtime-results.json`.
- **PASS:** actual mouse Task List drag after rebound,03:00schedule and18:00deadline survive reload. Realv91service-worker cache matches canonical viewport bytes; offline reload executes the synchronized pixel-rounded return. Initial offline-harness assertion rejected CSSOM's canonical `steps(1)` spelling; accepting its equivalent `steps(1,end)` behavior corrected the harness, with no product change.
- **PASS:** final cache/PWA checks, JavaScript/harness syntax and diff review. Inspected upper/lower peak screenshots; date separators and timetable boundaries stay intact. Other animation families, task persistence, deadlines, templates and backend APIs were not modified.
- **NOT RUN:** physical Mac trackpad/iPhone/iPad, Safari/Firefox, installed PWA, native WKWebView/installed app, private Google account or fresh signed-in backend workflows. Browser emulation/synthesis is not evidence that those runtimes passed. No native bundle sync, main merge or public deployment.

## Reproduction

`capture.js` and `capture-bottom.js` run the before→DuckPlan→after process through Playwright MCP with PNG screencasts. Save each returned case as `<phase>/<case>/frames.json` under `/private/tmp/duckplan-reference-loop`, then run `python3 docs/reference-loop-rebound/evaluate.py <phase>`. The shared Swift bitmap reader extracts line positions; the evaluator checks `acceptance.json`. `drag-cache.js` checks real task drag/persistence and offline cache behavior. Representative final screenshots and compact comparison records are retained; raw full PNG streams remain temporary.

Local preview: `http://127.0.0.1:8034/?v=reference-loop-rebound-final-20261119#calendar`.
