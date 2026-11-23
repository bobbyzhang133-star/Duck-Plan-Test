# Task card status colors

The user clarified that status color belongs on each task card, and requested removal of the category-header tints. Both Calendar's task panel and the Tasks list now use restrained background/border tints: blue scheduled, red overdue, coral due today, gray unscheduled, green completed. Existing class dots, class/calendar block colors, yellow actions, card formatting and completion effects remain unchanged. Category headers return to their earlier transparent treatment and existing count badges.

Status precedence is completed, overdue, scheduled work, due today, neutral. Status is derived per record when rendered, so changing the Tasks grouping to Class or Priority cannot change its color. No records or persistence schema change. Light and dark surfaces use the same status accents blended into the current card surface.

PASS: Chromium 157 local isolated contexts, 1280px Calendar, 390px Tasks and 835px Calendar dark theme. Checked distinct status fills, transparent category headers, class dots, stable colors across Plan/Class/Priority grouping, real editor opening/closing, checkbox completion, green completed card and persisted completion after reload. Category opening/closing transitions remain active. No page errors. Title contrast exceeds 4.5:1 in the captured states. Saved screenshots and computed values accompany this record.

PASS: JavaScript syntax, six focused grouping/cache tests and git diff whitespace check. The first browser run stopped on an incorrect test-only close-button selector; it was corrected to the actual existing button and all three contexts passed on rerun.

NOT RUN: signed-in transport, installed PWA and native WKWebView/physical devices. This is a local website presentation change; the Xcode bundle and public sites were not updated.
