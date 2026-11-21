# Fields blend with their sections — November 20, 2026

Local website follow-up to 3259224. The user superseded the white-field request with matching the background. Task-editor inputs/selects/textareas now use transparent backgrounds: Work fields blend with blue, Due fields with pink/red, and other fields with the form. Focus indicators and field geometry remain intact; both light and dark themes follow their surrounding materials. Cache v105, CSS key blended-fields-20261120.

PASS: Playwright MCP Chromium 157.0.8103.79, isolated local contexts at desktop 1156×746 and touch-emulated phone 390×844. All 17 non-checkbox fields are transparent in both themes; computed painted ancestor colors match their intended section. Zero form overflow. Screenshots show expanded Work plus Due. Offline reloads retained the blended fields with cache v105 at both widths. Existing four PWA tests and git diff --check pass. No behavior/storage/API changes or new tests for this CSS adjustment.

No public deployment or native app update. Physical devices, installed PWA, native WKWebView and other browser engines NOT RUN for this presentation-only change.
