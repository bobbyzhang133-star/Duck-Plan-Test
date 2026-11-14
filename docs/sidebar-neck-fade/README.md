# Sidebar duck neck fade

November13,2026: softened the user-marked transition between the cropped white neck and the page. A static image-only alpha mask remains opaque through80% and fades to transparent at100%, blending the final7.2px of the36px sidebar artwork into either theme. Both standard and WebKit mask properties are present.

The face/bill remains above the fade. PNG assets, favicon, native artwork, layout, anchor hitbox and keyboard focus styling are unchanged. Existing hover/press opacity still applies. The fade is CSS presentation, not a new drawing or a colored background overlay.

## Verification

- Six existing PWA/cache tests pass; CSS source/cache keys updated to the neck-fade stylesheet and PWA cachev41. Diff and script checks pass.
- Two isolated Chromium157.0.8103.78 theme workflows passed, covering light/dark folded/expanded835px states. The image remains36×36 with no overflow; clicking the faded bottom area and keyboard Enter still open Calendar. All contexts closed, with no page errors or API/external requests. [Results](results.json).
- Actual rendered PNG sampling compares the masked neck against a temporary unmasked test-context baseline. Last-row center contrast against the adjacent sidebar background falls from10→1RGB channel levels in light theme and209→15in dark theme. The sampled face pixel remains identical. This establishes improved blending at those points, not every browser/display.
- Screenshots: [light folded](light-folded.png), [light expanded](light-expanded.png), [dark folded](dark-folded.png), [dark expanded](dark-expanded.png).
- The actual open local preview was refreshed after checking for an open editor. Its prior Month view and selected December13,2026 date were restored through the UI and verified with the new mask. Planner records were not edited. The user-context cropped screenshot remains private temporary evidence.

This bounded website presentation check does not rerun installed-PWA or physical-device tests. No public deployment, shared-main change, native synchronization or PNG regeneration is included.
