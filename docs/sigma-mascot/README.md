# Sigma mascot

The app profile, sidebar and favicon use `landing/assets/duckplan-sigma-head-v5.png` and its 192/512px icon exports. The November 12 redraw uses the user's original duck screenshot for a continuous head-to-neck silhouette, without cheek bulges or an inward neck pinch. Its outline is lighter than v4, with the upright Sigma expression retained. This is a cleaned upright interpretation of the reference, not an exact tracing. The native icon exports this master at 1024px. The selected built-in imagegen prompts are recorded in `landing/assets/duckplan-sigma-head-notes.md`; previous images remain available.

Full-body UI poses remain native SVG markup in `landing/duck-mascot.js`, styled by `landing/duck-theme.css`, using the earlier `landing/assets/duckplan-sigma-head-v3.png` as their visual reference. Their drawings, placements and reactions are unchanged by the app-profile edit.

`front-view-states.png` is the current preview: happy, sleepy, focused, encouraging, celebrating and swimming. Front views have a plain rounded body outline, scaled Sigma head and webbed feet, with no visible tail or feather/wing lines on the chest. A lifted wing appears during greeting/celebration reactions. Swimming hides the feet under the water. `full-body-states.png` and `states.png` retain the previous versions for comparison. All existing mascot containers and interaction hooks remain in use. The previous yellow mascot preview remains in `docs/yellow-redesign/mascot-states.png` for comparison.

The Daily progress pond alone uses a right-facing side-profile duck, including its visible side wing, tail and orange bill. It retains the progress-position movement, swimming state, ripples and reduced-motion handling. `daily-progress-side.png` shows the updated local card. Other placements keep the clean front view.

Full-body pose references researched at the user's request: [Cheems examples](https://knowyourmeme.com/editorials/guides/who-was-cheems-the-meme-famous-shiba-inu-dog-that-recently-passed-away-the-history-of-the-dog-sometimes-mistaken-for-doge-explained) and [walking-duck artwork](https://www.redbubble.com/i/tote-bag/Happy-walking-duck-meme-by-rozdolf/91490710.A9G4R). These are visual references only; the application continues to draw its own SVG character and does not load third-party artwork.

Verified on November 11, 2026: 214 Node tests, JavaScript syntax and diff checks; browser checks at 390 and 1280 px for all seven placements, six state transitions, task modal, Dashboard/Calendar navigation and reduced-motion behavior.
