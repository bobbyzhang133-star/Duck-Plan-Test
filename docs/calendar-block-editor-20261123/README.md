# Direct editing from calendar blocks

An individual work or deadline block opens the prefilled editor on the first activation in Day, Week and Month. This includes Month agenda entries on phones. The editor uses the fade introduced for wide Day work bars. A grouped deadline marker opens its chooser, then the selected task opens in the editor after the chooser closes. Calendar date counts still open their Work or Due lists.

PASS in Chromium 157.0.8103.79 with isolated local demo data. Checked work and deadline activation in all three views at 1440px desktop, 390px emulated phone touch and 835px with reduced motion. Confirmed keyboard activation, Escape and focus return, the grouped deadline handoff, and persistence after editing from Month. No browser errors. The browser script and results are included here.

PASS for 101 focused calendar, popup, editor, drag and cache checks. Local preview uses cache v144. NOT RUN for signed-in accounts, installed PWA, physical devices and native app.
