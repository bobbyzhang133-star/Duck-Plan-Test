# Side-only task status colors

User requested TickTick-like side color cues rather than full-card status tints. Both task lists keep the approved per-record status palette, represented by a 3px strip on the left edge. Backgrounds and full outlines return to neutral theme surfaces. Class dots, category headers, layout, task data, calendar colors and transitions remain unchanged. The strip uses a background gradient, so it takes no layout space and is retained by the completion effect's computed-style snapshot.

Reference inspected before implementation in Playwright at 1280×1000: [TickTick Group & Sort](https://help.ticktick.com/articles/7056594711640801280), its official phone Next 7 Days illustration (356ce82033fcd98fae830e9fe76f4cc5.png). It shows neutral task surfaces with fine colored strips along the left side. DuckPlan adapts that placement while retaining its approved status meanings and existing cards. No signed-in TickTick account was modified.

After implementation, revisited the same article/illustration with the same viewport and scrolling interaction. Before/after reference captures and DuckPlan screenshots are included. PASS for the requested treatment: side-only colored marks and neutral task bodies; DuckPlan keeps separate rounded cards and uses a 3px strip rather than reproducing TickTick's whole list layout. This is a public illustrated reference comparison, not a signed-in app interaction comparison.

PASS: Chromium 157 local browser contexts at 1280px Calendar, 390px Tasks and 835px Calendar dark theme. Every task's background and outline match the neutral theme tokens; the colored gradient ends at 3px. Checked all five status colors, unchanged class dots, transparent category headers, stable colors under Class/Priority grouping, editor open/close, checkbox completion and persistence after reload, and category opening/closing transitions. No page errors. Two cache tests and git diff whitespace check passed. The first verification sampled the dark theme during its color transition; rerunning after it settled passed.

NOT RUN: native app, installed PWA, physical devices and signed-in transport. No public or native release performed.
