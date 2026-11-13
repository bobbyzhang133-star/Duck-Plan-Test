# Calendar template drawer and matching colors — November 13, 2026

The user confirmed that “Assignments dropdown” means **Assignment templates in the Calendar task panel**. That section now uses a full-width drawer header with a stack icon, saved-template count and rotating chevron. Its connected body expands inline using the existing 340ms sheet timing and easing. The separate Tasks page keeps its existing template disclosure.

The template preview and scheduled calendar block share fill, accent, title and secondary-text colors. The existing calendar palette is preserved in both themes; the template no longer mixes its fill against the dark card background. For the Calculus class, computed browser styles match exactly in light and dark mode: fill `color(srgb 0.898823 0.934118 0.965882)`, accent `rgb(83, 143, 197)`, title `rgb(41, 50, 65)` and secondary text `rgb(77, 86, 102)`.

The drawer uses a native button inside a heading, `aria-expanded`, `aria-controls` and a labeled region. Closed content is hidden and inert; closing while a child has focus returns focus to the header. Rapid reversals begin at the live panel height. Reduced motion settles immediately. Store rerenders retain the intended open state, while account/mode changes and destruction close it and cancel motion.

The semantic structure follows the [W3C accordion pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/) and [disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/), implemented within DuckPlan’s existing interaction system.

## Verification

- All 257 CommonJS and 40 module tests pass (297 total), including template copy/drop, owner guards, calendar targeting, button interactions and PWA behavior.
- JavaScript syntax and diff whitespace checks pass.
- A fresh isolated service-worker context activates cache v30, contains the new drawer and shared color rules, reloads offline, and opens the drawer with no page errors.
- Browser color comparison checks the actual template and scheduled Calculus block in each theme, including the new open drawer.
- Actual native drag from the drawer creates one immediate scheduled copy with saved duration/reminder settings, opens no editor, retains the source template and keeps the drawer open after the store rerender.
- Enter activation, the region/control relationship, child-focus restoration and five rapid open/close reversals pass. The final open panel returns to natural height without a retained animation.
- Space activation and closed-content Tab exclusion pass. Reduced-motion toggles settle synchronously with zero animations. An owner change during opening cancels the old animation and leaves the next owner's drawer closed and inert after the previous timing has elapsed.
- Layout checks pass at desktop 1280×900, iPad 820×1180 and phone 390×844/320×740, including dark mode and the existing outer phone Tasks sheet. The 54px drawer header spans the task column; there is no horizontal page overflow or browser console/page error.

Screenshots: [desktop](desktop-open.png), [iPad](ipad-open.png), [phone](phone-open.png), [small phone](phone-small-open.png) and [phone dark mode](phone-dark.png). Run [drawer-qa.js](drawer-qa.js) through Playwright MCP's `browser_run_code_unsafe.filename` with the local preview running on port 8034. Fixtures use isolated browser storage; existing user data is untouched. These are Chromium checks, not physical iPhone/iPad or Safari certification.

Local preview: `http://127.0.0.1:8034/?v=template-drawer-20261113#calendar`.

Local website/review-branch changes only. No public deployment, database migration or native iPhone bundle update.
