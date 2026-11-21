# Restore field highlights in matching hues

November 20, 2026, following 2526898. User confirmed subtly filled input highlights using stronger pink within Due and blue within Work. Scoped inherited field colors restore input/select/textarea fills in those hues; remaining fields use the form's neutral surface token. Dark mode uses matching blue/red surfaces. Title underline, focus indicators, layout and behavior remain unchanged. Cache v106; CSS key section-tinted-fields-20261120.

PASS: Playwright MCP Chromium 157.0.8103.79 isolated local browser contexts at 1156×746 and touch-emulated 390×844. Expanded all disclosures, verified all 16 non-title fields have the appropriate section color in light/dark, transparent title, zero form overflow, visible keyboard focus, and offline reopening with the new tint/cache v106. Rendered screenshots reviewed at both widths. All four existing PWA tests and git diff --check pass. No new tests for this small CSS adjustment.

Local website only; no public deployment or native sync. Native/physical devices, other engines and installed-PWA surface NOT RUN; mobile app remains at the release-gated checkpoint.
