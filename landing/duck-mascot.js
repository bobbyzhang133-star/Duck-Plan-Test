/* Sigma duck poses, matching the original white, black-outline brand drawing. */
(() => {
  "use strict";
  const states = new Set(["happy", "sleepy", "focused", "encouraging", "celebrating", "swimming", "thumbsup"]);
  const profileArtwork = "./assets/duckplan-sigma-head-v11-transparent.png";
  let headSerial = 0;

  function frontHead() {
    const key = `duck-profile-${++headSerial}`;
    // Use the approved pixels under one uniform scale, including their original contour and complete face.
    // Separate eye/brow windows preserve the existing blink, gaze and expression hooks.
    return `<g class="duck-head" data-head-art="v11">
      <svg class="duck-profile-head" x="43" y="2" width="92" height="71.875" viewBox="0 0 1024 800" overflow="hidden">
        <defs>
          <image id="${key}" href="${profileArtwork}" width="1024" height="1024"/>
          <mask id="${key}-face" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="800">
            <rect width="1024" height="800" fill="white"/>
            <rect x="240" y="280" width="550" height="212" fill="black"/>
          </mask>
        </defs>
        <rect x="240" y="280" width="550" height="212" fill="#F8F8F4"/>
        <use href="#${key}" mask="url(#${key}-face)"/>
        <g class="duck-brows"><svg x="240" y="280" width="550" height="120" viewBox="240 280 550 120" overflow="hidden"><use href="#${key}"/></svg></g>
        <g class="duck-open-eyes"><g class="duck-pupils"><svg x="240" y="400" width="550" height="92" viewBox="240 400 550 92" overflow="hidden"><use href="#${key}"/></svg></g></g>
        <g class="duck-closed-eyes" stroke="#111113" stroke-width="28" stroke-linecap="round"><path d="M292 453q62-65 124 0m209 0q62-65 124 0"/></g>
        <g class="duck-sleep-eyes" stroke="#111113" stroke-width="28" stroke-linecap="round"><path d="M292 432q62 55 124 0m209 0q62 55 124 0"/></g>
        <path class="duck-smile" d="M370 601Q515 725 660 601" stroke="#111113" stroke-width="24" stroke-linecap="round" fill="none"/>
        <g class="duck-glasses" stroke="#111113" stroke-width="20"><rect x="232" y="394" width="264" height="120" rx="35" fill="#FFFFFF" fill-opacity=".12"/><rect x="544" y="394" width="264" height="120" rx="35" fill="#FFFFFF" fill-opacity=".12"/><path d="M496 420q24-25 48 0m-345-6 33 16m576 0 32-16"/></g>
      </svg>
    </g>`;
  }

  function sideMarkup(mood) {
    return `<svg class="duck-character duck-sigma duck-side-profile duck-${mood}" data-mood="${mood}" data-profile="side" data-head-art="v11-side" viewBox="0 0 180 170" fill="none" aria-hidden="true" focusable="false">
      <path class="duck-body" d="M89 67c-6-21 2-43 22-45 23-2 37 19 34 40l-3 16c9 17 10 37-5 52-13 13-36 14-63 9-26-3-43-18-39-38-9-3-15-12-16-21 15 8 26 6 40 7 9-9 18-16 30-20Z" fill="#F8F8F4" stroke="#111113" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M143 54c13-4 26-1 29 6 2 6-11 12-26 11l-9-5" fill="#FFC590" stroke="#111113" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M146 61c7 2 14 2 21-1" stroke="#111113" stroke-width="2.2" stroke-linecap="round"/>
      <g class="duck-open-eyes"><svg x="113" y="34" width="18" height="16.435" viewBox="560 280 230 210" overflow="hidden"><image href="${profileArtwork}" width="1024" height="1024"/></svg></g>
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
        <path class="duck-body" d="M56.3 73.8C55 89 35 96 39 122c4 18 24 27 49 27 26 0 46-9 50-27 4-26-15-33-16.4-48.2" fill="#F8F8F4" stroke="#111113" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      ${frontHead()}
      <g class="duck-wing"><path d="M44 113c-14-1-24-13-20-20 5-8 14 5 23 8" fill="#F8F8F4" stroke="#111113" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></g>
      <g class="duck-thumbs-up-wing" fill="#F8F8F4" stroke="#111113" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M129 112c6-1 10-5 12-10l4-8 1-13c0-5 6-5 8-1l1 12h10c5 0 7 4 6 8l-4 15c-1 4-4 6-9 6h-13l-9-3c-4 0-7-2-7-6Z"/>
        <path d="M156 101h13m-15 8h13" fill="none" stroke-width="2.5"/>
      </g>
      <g class="duck-check-flag"><path d="m131 139 12-43" stroke="#111113" stroke-width="3" stroke-linecap="round"/><path d="m143 96 27 5-4 22-28-7Z" fill="#FFF1B5" stroke="#111113" stroke-width="2.5" stroke-linejoin="round"/><path d="m146 108 4 5 9-7" stroke="#397459" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>
      <g class="duck-sparkles" fill="#FFD93D"><path d="m26 36 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/><path d="m156 33 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/></g>
      <g class="duck-snooze" stroke="#111113" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M150 35h9l-9 10h9m2-26h7l-7 8h7"/></g>
      <g class="duck-water" stroke="#80B8BC" stroke-width="2.5" stroke-linecap="round"><path d="M35 143c21 7 83 9 111 0m-96 9c20 4 57 4 77 0"/></g>
    </svg>`;
  }
  function mount(element, state = "happy") {
    if (!element) return;
    element.innerHTML = element.classList.contains("brand-mark")
      ? '<img class="duck-brand-image" src="./assets/duckplan-sigma-icon-v11-transparent-192.png" alt="" aria-hidden="true" width="192" height="192" />'
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
