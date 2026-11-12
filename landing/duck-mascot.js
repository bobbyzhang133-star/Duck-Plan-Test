/* Sigma duck poses, matching the original white, black-outline brand drawing. */
(() => {
  "use strict";
  const states = new Set(["happy", "sleepy", "focused", "encouraging", "celebrating", "swimming"]);

  function sideMarkup(mood) {
    return `<svg class="duck-character duck-sigma duck-side-profile duck-${mood}" data-mood="${mood}" data-profile="side" viewBox="0 0 180 170" fill="none" aria-hidden="true" focusable="false">
      <path class="duck-body" d="M95 50c-1-15 8-26 23-24 16 2 26 13 24 27l-3 20c6 14 9 31-1 47-10 18-36 24-64 19-26-3-43-18-39-38-9-3-15-12-16-21 15 8 26 6 40 7 9-9 22-14 35-12Z" fill="#FFFEFA" stroke="#111113" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M141 52c13-4 28-1 31 6 2 6-11 12-26 11l-10-4" fill="#FFB475" stroke="#111113" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M146 61c7 2 14 2 21-1" stroke="#111113" stroke-width="2.2" stroke-linecap="round"/>
      <g class="duck-open-eyes"><g class="duck-pupils"><path d="M118 50c0 12 12 12 12 0Z" fill="#111113"/></g><path d="M114 49h19" stroke="#111113" stroke-width="3.5" stroke-linecap="round"/></g>
      <path d="M113 40c8-4 13 5 20 3" stroke="#111113" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M72 99c-14-6-25 3-19 14 8 15 35 19 53 6" stroke="#111113" stroke-width="3.2" stroke-linecap="round"/>
      <g class="duck-water" stroke="#80B8BC" stroke-width="2.5" stroke-linecap="round"><path d="M26 143c28 8 91 9 127-1m-110 10c24 5 62 5 88-1"/></g>
    </svg>`;
  }

  function markup(state = "happy", profile = "front") {
    const mood = states.has(state) ? state : "happy";
    if (profile === "side") return sideMarkup(mood);
    return `<svg class="duck-character duck-sigma duck-${mood}" data-mood="${mood}" viewBox="0 0 180 170" fill="none" aria-hidden="true" focusable="false">
      <ellipse class="duck-ground" cx="89" cy="162" rx="46" ry="4" fill="#29251F" opacity=".1"/>
      <g class="duck-feet" fill="#FFB475" stroke="#111113" stroke-width="3" stroke-linejoin="round"><path d="m65 143-3 11-9 6 15 3 9-3 8-1-8-5-1-11Z"/><path d="m103 143 1 11-8 6 14 3 8-3 10-1-11-6-2-10Z"/></g>
      <g class="duck-body-group">
        <path class="duck-body" d="M62 83c-15 6-26 23-22 40 4 17 23 26 48 26 26 0 45-9 49-26 4-18-9-34-21-40" fill="#FFFEFA" stroke="#111113" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <g class="duck-head">
        <g transform="translate(31 2) scale(.64)">
        <path d="M48 128c1-9 2-15-1-24C32 83 33 59 47 38 60 18 79 9 99 13c25 4 42 25 44 50 2 17-3 29-11 42-2 9 0 15 1 23" fill="#FFFEFA" stroke="#111113" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
        <g class="duck-brows" stroke="#111113" stroke-width="4.8" stroke-linecap="round"><path d="M59 43c7-5 15 6 23 5m18 0c9 1 17-10 24-5"/></g>
        <g class="duck-open-eyes">
          <g class="duck-pupils" fill="#111113"><path d="M64 60c0 15 15 15 15 0Zm41 0c0 15 15 15 15 0Z"/></g>
          <path d="M60 59h22m19 0h22" stroke="#111113" stroke-width="4.8" stroke-linecap="round"/>
        </g>
        <g class="duck-closed-eyes" stroke="#111113" stroke-width="4" stroke-linecap="round"><path d="M62 63q9-11 18 0m24 0q9-11 18 0"/></g>
        <g class="duck-sleep-eyes" stroke="#111113" stroke-width="4" stroke-linecap="round"><path d="M62 61q9 8 18 0m24 0q9 8 18 0"/></g>
        <path d="M91 79c-12-12-29-5-29 7 0 8 7 11 13 13 6 15 27 16 34 0 7-2 13-7 13-14 0-12-18-17-31-6Z" fill="#FFB475" stroke="#111113" stroke-width="5" stroke-linejoin="round"/>
        <g class="duck-glasses" stroke="#111113" stroke-width="3"><rect x="54" y="52" width="33" height="23" rx="7" fill="#FFFFFF" fill-opacity=".2"/><rect x="97" y="52" width="33" height="23" rx="7" fill="#FFFFFF" fill-opacity=".2"/><path d="M87 58q5-4 10 0m-48-2 5 3m76 0 5-3"/></g>
        </g>
      </g>
      <g class="duck-wing"><path d="M44 113c-14-1-24-13-20-20 5-8 14 5 23 8" fill="#FFFEFA" stroke="#111113" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>
      <g class="duck-check-flag"><path d="m131 139 12-43" stroke="#111113" stroke-width="3" stroke-linecap="round"/><path d="m143 96 27 5-4 22-28-7Z" fill="#FFF1B5" stroke="#111113" stroke-width="2.5" stroke-linejoin="round"/><path d="m146 108 4 5 9-7" stroke="#397459" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>
      <g class="duck-sparkles" fill="#FFD93D"><path d="m26 36 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/><path d="m156 33 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/></g>
      <g class="duck-snooze" stroke="#111113" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M150 35h9l-9 10h9m2-26h7l-7 8h7"/></g>
      <g class="duck-water" stroke="#80B8BC" stroke-width="2.5" stroke-linecap="round"><path d="M35 143c21 7 83 9 111 0m-96 9c20 4 57 4 77 0"/></g>
    </svg>`;
  }
  function mount(element, state = "happy") {
    if (!element) return;
    element.innerHTML = element.classList.contains("brand-mark")
      ? '<img class="duck-brand-image" src="./assets/duckplan-sigma-icon-v3-192.png" alt="" aria-hidden="true" width="192" height="192" />'
      : markup(state, element.classList.contains("pond-duck") ? "side" : "front");
  }
  function setState(element, state) {
    const svg = element?.querySelector(".duck-character");
    if (!svg || !states.has(state)) return;
    svg.classList.replace(`duck-${svg.dataset.mood}`, `duck-${state}`);
    svg.dataset.mood = state;
  }
  window.DuckPlanMascot = Object.freeze({ markup, mount, setState });
})();
