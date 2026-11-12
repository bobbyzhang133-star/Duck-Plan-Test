# Sigma mascot

The sidebar and favicon reuse the original `landing/assets/duckplan-sigma-icon-v3-192.png`. The matching UI poses are native SVG markup in `landing/duck-mascot.js`, styled by `landing/duck-theme.css`, using `landing/assets/duckplan-sigma-head-v3.png` as the visual reference. No generated bitmap replacement or new rendering dependency is needed.

`front-view-states.png` is the current preview: happy, sleepy, focused, encouraging, celebrating and swimming. Front views have a plain rounded body outline, scaled Sigma head and webbed feet, with no visible tail or feather/wing lines on the chest. A lifted wing appears during greeting/celebration reactions. Swimming hides the feet under the water. `full-body-states.png` and `states.png` retain the previous versions for comparison. All existing mascot containers and interaction hooks remain in use. The previous yellow mascot preview remains in `docs/yellow-redesign/mascot-states.png` for comparison.

The Daily progress pond alone uses a right-facing side-profile duck, including its visible side wing, tail and orange bill. It retains the progress-position movement, swimming state, ripples and reduced-motion handling. `daily-progress-side.png` shows the updated local card. Other placements keep the clean front view.

Full-body pose references researched at the user's request: [Cheems examples](https://knowyourmeme.com/editorials/guides/who-was-cheems-the-meme-famous-shiba-inu-dog-that-recently-passed-away-the-history-of-the-dog-sometimes-mistaken-for-doge-explained) and [walking-duck artwork](https://www.redbubble.com/i/tote-bag/Happy-walking-duck-meme-by-rozdolf/91490710.A9G4R). These are visual references only; the application continues to draw its own SVG character and does not load third-party artwork.

Verified on November 11, 2026: 214 Node tests, JavaScript syntax and diff checks; browser checks at 390 and 1280 px for all seven placements, six state transitions, task modal, Dashboard/Calendar navigation and reduced-motion behavior.
