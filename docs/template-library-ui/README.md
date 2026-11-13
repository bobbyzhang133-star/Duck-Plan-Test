# Dedicated template library — November 13, 2026

Implemented the user's latest recommendations from [Duck Plan — Repository Overview](https://chatgpt.com/g/g-p-6addac00e55c8191a3f6db4456733345-duck-plan/c/6addacc2-3bc4-83e8-8f06-cdbedefe067c). The later Tasks / Templates concept supersedes the earlier proposal to keep an inner template drawer underneath task groups. The subsequent Schedule recommendation keeps that function, with quieter desktop styling and more emphasis on phones.

## Result

- Calendar opens with Tasks selected. A visible Tasks / Templates tab strip separates real assignments from reusable templates in the same left column. Phones have the same tabs inside the existing expandable Tasks sheet; the full-width Calendar and bottom navigation remain.
- Templates has a saved count and compact New action. Calendar's global Add action becomes New template when this tab is selected. The separate template shelf on the Tasks page remains accessible.
- Each template keeps its calendar-matched class color and duration scale, with a 60px minimum preview for two title lines and metadata. The actual saved duration never changes. Schedule and Add to tasks stay visible in one row; Details, Edit and Delete are under a labeled management menu. Details exposes the entire title and every reusable setting. Delete retains its confirmation.
- New-template and Schedule workflows preserve existing store and editor behavior. A valid calendar drop still creates one scheduled copy immediately, with saved title, class, duration, priority, notes and reminder choice. It opens no editor, leaves the template reusable and does not infer a deadline or alarm. Add to tasks creates an independent unscheduled copy.
- Desktop/iPad retain a 260–280px task column beside the timetable. Week keeps seven real dates, scrolling horizontally inside the calendar with sticky time labels. Phones retain their selected-day Week presentation and seven-date selector.
- Tabs support roving keyboard focus, arrows and Home/End; inactive content is hidden and inert. Each tab retains its scroll position. Account changes return to Tasks and clear prior scroll state. Menus support arrows, Home/End, Escape, Tab, outside dismissal and focus return; they stay anchored during scrolling and use shared popup motion with a reduced-motion bypass.

The final browser checks found and fixed two related resize cases: a body-level menu could outlive a closed phone sheet, and a window resize target could be passed to `Node.contains()`. Closing the parent now dismisses its menu, and viewport handling distinguishes DOM nodes from the Window. The integrated regression exercises both ordinary resizing with an open menu and the desktop-to-phone transition.

## Verification

All **303 Node tests pass**. New meaningful coverage verifies tab visibility/inert state, keyboard navigation, per-tab scroll, owner reset, contextual template creation, full Details settings and parent-sheet menu cleanup. JavaScript syntax and diff checks pass. The approved v11 duck SHA256 remains `7714bd8afc68d05399841291712d57cfcb62ad729eec3cd58e570670156501f5`.

[library-ui-qa.js](library-ui-qa.js) is a saved, passing isolated Playwright MCP browser regression. Run it through `browser_run_code_unsafe.filename` with the local server on port 8034. It covers zero and ten templates, tab keyboard/focus/scroll behavior, an actual native HTML5 drop at 10:15, independent unscheduled copies, full long-title Details, owner cleanup, the menu resize regression, exact light/dark color parity and phone sheet focus restoration. It reports zero page errors, console errors or external/API requests. Existing user storage is untouched.

Separate focused menu checks verify Edit persistence, Delete Cancel/confirmation, the separate Tasks shelf, keyboard and outside dismissal, repeated scroll anchoring, and normal 240ms versus zero reduced-motion opening animations. Schedule still opens the prefilled task editor.

Layout verification covers 24 desktop/iPad combinations (1280/1024/820/768px, folded/expanded sidebar, Day/Week/Month) and 24 phone/coarse-landscape combinations (390/320/800×390/960×500, modes and sheet states). No page, frame or toolbar overflow was observed. The ten-template library additionally fits all three action controls on one row at 1280/820/390/320px, with 44px phone targets. These are Chromium checks, not physical Safari/iPhone/iPad certification.

A fresh service-worker context activates cache v31 with both new tab assets and the updated library. Offline reload, Templates selection and opening New template pass without page errors.

## Screenshots

- [Desktop Templates](templates-desktop.png)
- [iPad Templates](templates-ipad.png)
- [Phone Templates](templates-phone.png)
- [Small phone, dark mode](templates-phone-small-dark.png)
- [Management menu](library-1280.png)
- [iPad Tasks and Week, folded rail](ipad-820-week-folded.png)
- [iPad Tasks and Week, expanded rail](ipad-820-week-expanded.png)
- [Phone landscape Calendar](phone-800-week-calendar.png)

Local preview: `http://127.0.0.1:8034/?v=template-library-20261113#calendar`.

Website implementation and TEST review-branch backup only. No public deployment, database migration, main merge or native iPhone bundle update.
