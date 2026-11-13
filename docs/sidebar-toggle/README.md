# Sidebar fold button geometry — November 13, 2026

The user marked `.sidebar-rail-toggle`, whose folded geometry was still a hidden expanded rectangle. The earlier square-button change covered the navigation items but missed this separate control. In the user's actual 835px preview, it measured 239×40px, and the center of that rectangle did not hit the toggle because it lay beyond the clipped rail.

The toggle now has a real 50×50px rounded-square border box when folded. It expands to the available sidebar row width using the existing 480ms layout motion. The hidden label leaves the folded grid flow, the chevron stays centered on the navigation-icon column, and hover/held/release/focus feedback paints the actual button. The inner chevron no longer receives a second highlight or focus ring. Press feedback keeps its 80ms transform timing without shortening the width transition. Reduced motion removes movement while retaining color and keyboard focus.

## Verification

- The actual open 835px preview reports 50×50px folded, 239×50px expanded and 50×50px after folding again. Center clicks and `elementFromPoint()` hit the toggle in every state. The page is left folded with its corrected stylesheet loaded.
- Isolated checks at 820/835/1446px cover Calendar and Dashboard, folded/expanded and normal/reduced motion. Expanded widths are 239px in Calendar and 215px in Dashboard. Chevron/navigation-icon centers align, and workspace sample points do not hit the toggle.
- Eight rapid reversals sampled over 64 frames preserve the workspace boundary, settle folded and leave no pressed/released classes. Enter and Space work, and Tab/Shift+Tab expose a 2px outline on the button with no nested glyph outline.
- Phone 390px and coarse-pointer 800×390 layouts retain the hidden sidebar, existing bottom navigation and no horizontal overflow or toggle interception.
- All 11 focused button/page-navigation/PWA/routing tests and diff checks pass. No JavaScript behavior, planner data or native app changes were needed.

Screenshots: [before](before-835-folded.png), [folded](835-calendar-folded.png), [expanded](835-calendar-expanded.png).

The stylesheet cache key and PWA cache v34 deliver the change. Local website and TEST review-branch backup only; no public deployment or native bundle update.
