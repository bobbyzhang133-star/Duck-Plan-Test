# Timetable edge stretch

November18,2026. Local website on `codex/calendar-edge-stretch-20261118`, based on `a2db71c`. The user requested restoring the timetable's overscroll/stretch after reaching a scroll limit. Preserve the earlier requirement that the raised date header must remain stationary.

## Behavior

Outward vertical wheel and single-finger pulls at the top/bottom move the timetable with resistance, capped at48px. The hours, work blocks, timed deadlines and red current-time indicator move together. After wheel input stops for90ms, or the finger lifts, the existing400ms shared release curve settles back. A renewed gesture resumes the displayed return position rather than jumping to an old offset. Ordinary scrolling, horizontal gestures, zoom, scheduled-block touch drags and Month remain native/unchanged. Reduced motion disables the added stretch.

Native whole-scroller bounce remains suppressed. The existing grid moves as one compositor surface while its sticky header pieces receive equal opposite motion, keeping both the day/date row and optional date-only deadline row stationary. Initial separate axis/column transforms were rejected after visual inspection showed the red dot's gutter-side half disappearing behind the axis. The final shared surface preserves that stacking relationship; `dot-during-stretch.png` shows the complete dot during a paused48px pull.

Wheel paints coalesce through requestAnimationFrame; release uses native transform animations, with no spring frame loop or layout animation. Rerender, resize refresh, drag entry/start, keyboard/pointer interaction, route changes, blur and destruction reset temporary motion. Destroy releases timers, animations and listeners and restores prior inline transforms. There are no storage, account, backend or native-project changes.

## Verification

- **PASS:**561full Node tests, including5new elastic gesture/lifecycle regressions and existing viewport, drag, popup, account and PWA coverage.14focused elastic/viewport/PWA tests also pass. JavaScript syntax and final diff checks pass.
- **PASS:**13isolated Chromium157.0.8103.79 cases in `runtime.js`:1280×950,835×1100,390×844 and320×568; light Day/dark Week; outward top/bottom wheel pulls, stationary header/toolbar, matched hours/body displacement, normal scrolling, return cleanup, no document overflow or record changes. Includes trusted Chromium touch input at390px, reduced motion, opening/canceling the correct01:00slot editor, and Month. Zero page exceptions. These are browser/emulation results, not physical iPad/iPhone/Safari evidence.
- **PASS:**additional785px date-only header/current-dot visual check, with header tops unchanged at134/200px and a complete8pxdot throughout the48px pull. The screenshot was paused before capture to avoid comparing different spring frames.
- **PASS:**trusted mouse work-block drag after the stretch settles, from01:00to03:00, preserving task ID and18:00deadline;03:00work time survived reload. Isolated local data only.
- **PASS:**actual service-worker cachev79 contains byte-identical current viewport code; offline reload retains records and the stretch works offline (35px measured pull). This is service-worker/tab evidence, not an installed PWA launch.
- **NOT RUN:**fresh signed-in/backend checks, installed PWA launch, physical macOS trackpad/iOS Safari and native WKWebView/build/install. No cross-platform hardware smoothness or native update is claimed.

The previous preview server was stopped; restarted the same loopback-only8034server. All owned browser QA contexts closed. The user's existing file-based page and records were not modified. Review the HTTP preview at http://127.0.0.1:8034/#calendar; reload to load the new `edge-stretch-20261118` viewport/CSS keys and cache79.

TEST feature-branch backup only. No public deployment, shared-main merge, remote migration, iOS bundle sync or installed-app update.
