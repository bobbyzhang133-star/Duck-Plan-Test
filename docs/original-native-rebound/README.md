# Restore the original native timetable rebound

The user clarified on November 19 that the correct reference is the old version where the whole calendar stretched. The unwanted part was that the date tabs stretched too. This supersedes the later custom JavaScript spring and Google-inspired approximation for this element.

Historical reference: `b5bbeaa81f9f7931ece4ff3840c177470db58066`, immediately before `b3f8941` disabled native elasticity on November 17. Its `landing/` snapshot is served locally at `http://127.0.0.1:8038/#calendar`. The two November 18 custom demos at 8035/8036 are not this reference.

Acceptance criteria were behavioral: use the original browser-native timetable scrolling, leave date/Due headers outside its elastic surface, preserve normal input/scheduling and the newer approved design. Do not tune another JavaScript animation to resemble it.

## Implementation

- Separate fixed date/Due header and native hourly scroller inside the existing logical calendar root. All timetable pieces, including hour labels, grid lines, work blocks, deadline markers and the red current-time line, remain together in the native scrolling surface.
- Restore `overscroll-behavior: contain` on the hourly scroller. Remove custom wheel accumulation, synthetic transforms and rebound animation. The browser determines elasticity; reduced motion uses `none`.
- Only the header receives cancellable wheel/touch adapters. It can pan the timetable programmatically, clamped at boundaries, without initiating a header rebound. No new cancellable timetable/document/ancestor wheel or touch handlers sit in the native scrolling path.
- Keep horizontal header/body positions aligned, preserve scroll through rerenders and Due folding, and target the actual scroller for drop clipping/autoscroll and relevant-time navigation. Month retains its original scrolling container.
- Refresh all three changed asset URLs and offline cache v92. No task/storage/API/schema change or native bundle synchronization.

## Playwright MCP reference loop

`capture.js` captures historical → restored → historical at each boundary, then separately gestures over the restored header. It uses PNG screencasts, not DOM transforms, to measure native compositor movement. Captures ran after the final application changes. `comparison.json`, `acceptance.json` and the named PNGs contain the actual results.

Runtime: Chromium 157.0.8103.79 on macOS, 1280×950, synthesized mouse scroll 240px at 1800px/s. Both historical captures and the restoration reached 21px at the top and −21px at the bottom. Peak-aligned sampled return paths differ by approximately 1px or less; observed returns after the last input were 521–531ms across runs. This is sampled browser-native behavior, not a hard-coded duration or an exact physical-trackpad guarantee.

The historical header moves with the old calendar: 21px on the top capture and about 11–12px on the bottom capture. The restored header moves 0px. A boundary gesture directly over the restored header moves neither timetable nor header (0px). The restoration has no synthetic grid transform or active rebound animation at rest.

The browser's native rebound moves content without changing its DOM rectangles. Pixel evidence is essential; a `scrollTop === 0` assertion alone would miss it.

## Verification

- **PASS:** 565 Node tests, including seven native-header/scroll-target lifecycle regressions and five existing viewport clipping tests. Thirteen obsolete custom-physics tests were retired along with the removed custom controller. Syntax and diff checks pass.
- **PASS:** 27 actual local browser cases in `runtime.json`: Day/Week, light/dark, desktop/iPad/phone/short landscape layouts; fixed header, 24 hours, normal header panning, Due folding, rerender position, Month fallback; task drop at 03:00 preserving 18:00 deadline; template drop at 05:00 preserving duration/class and source; reload persistence.
- **PASS:** six additional actual browser cases in `extra.json`: horizontal alignment with 211px of real horizontal overflow; trusted touch scrolling of timetable and header; 01:00 slot editor/cancel; existing work-block reschedule; reduced-motion clamp; actual v92 cache/source equality for all three changed assets and offline reload/task/slot interaction.
- **PASS:** seven rendered reference/header captures described above. Inspected top and bottom peak screenshots; retained current-time dot, bright header, half-height date dividers, exact-time deadlines, date-only Due controls and approved materials.
- **NOT RUN:** signed-in backend, installed PWA, physical Safari/trackpad/touch hardware and native WKWebView. Browser touch emulation is not native iPhone acceptance. The separate Xcode checkout and installed apps are unchanged.

Test-fixture corrections: the first layout harness used an arbitrary 70px minimum; the established short-landscape layout exposes 66.9px, which fits a complete 62px hour. The check now explicitly requires one full hour. Drag checks initially selected a hidden duplicate Tasks-page row; they now select the visible daily panel. The work-block drag waits for the editor's closing animation to finish and preserves the pointer's grab offset. These were harness corrections, not application fixes. A first capture-saving attempt failed because dynamic Node imports are unavailable in the Playwright VM; final captures returned compact frame data through MCP and were saved separately.

Local preview: `http://127.0.0.1:8034/?v=original-native-rebound-20261119#calendar`. Feature-branch TEST backup only; no main merge or public deployment.
