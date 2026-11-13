# Square folded sidebar buttons — November 13, 2026

The folded sidebar previously clipped full-width navigation buttons: Calendar remained 239×50px and Tasks 215×50px even though only a 32px icon was painted. Their geometric centers landed over the workspace, and selection tools exposed the hidden expanded rectangle.

Sidebar navigation buttons now become actual **50×50px rounded squares** when folded and animate back to full width when expanded. Non-icon labels/counts leave the folded grid flow while retaining accessible names. Selection, hover, press and keyboard focus paint the button itself, with no nested icon highlight. The existing sidebar clip/grid animation and icon positions remain intact.

Validation: all 11 focused button/page-navigation/PWA/routing tests and diff checks pass. Isolated browser checks verify all seven folded buttons are 50×50px with working center hit targets; Calendar/Tasks route correctly using ordinary center clicks. Expanded rows retain 215/239px widths. Tab/Enter and visible keyboard focus pass. At 820px, normal and dark/reduced-motion folded buttons stay square; reduced motion uses zero-duration transitions. Phone bottom navigation and the 310×54px More links retain their layouts, with no horizontal overflow.

Screenshots: [folded desktop](folded-1446.png), [expanded desktop](expanded-1446.png), [folded iPad width](folded-820.png), [dark/reduced-motion iPad width](folded-dark-820.png).

The stylesheet URL and PWA cache advance to the new release (v28). Local website/review-branch backup only; no public deployment or native iPhone bundle update.
