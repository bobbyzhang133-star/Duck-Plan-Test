/* Original DuckPlan character. No image downloads, canvas, or animation library. */
(() => {
  "use strict";
  let instance = 0;
  const states = new Set(["happy", "sleepy", "focused", "encouraging", "celebrating", "swimming"]);

  function markup(state = "happy") {
    const mood = states.has(state) ? state : "happy";
    const id = `duckplan-character-${++instance}`;
    return `<svg class="duck-character duck-${mood}" data-mood="${mood}" viewBox="0 0 180 170" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${id}-body" x1="57" y1="82" x2="119" y2="145" gradientUnits="userSpaceOnUse"><stop stop-color="#FFEC83"/><stop offset=".5" stop-color="#FFD847"/><stop offset="1" stop-color="#F4B823"/></linearGradient>
        <radialGradient id="${id}-head" cx="0" cy="0" r="1" gradientTransform="translate(91 43) rotate(48) scale(65 63)" gradientUnits="userSpaceOnUse"><stop stop-color="#FFF4B8"/><stop offset=".55" stop-color="#FFE56A"/><stop offset="1" stop-color="#F6C333"/></radialGradient>
        <linearGradient id="${id}-beak" x1="117" y1="75" x2="132" y2="91" gradientUnits="userSpaceOnUse"><stop stop-color="#FFB459"/><stop offset="1" stop-color="#EF8938"/></linearGradient>
        <linearGradient id="${id}-wing" x1="56" y1="96" x2="96" y2="131" gradientUnits="userSpaceOnUse"><stop stop-color="#FFE985"/><stop offset="1" stop-color="#F5C42E"/></linearGradient>
      </defs>
      <ellipse class="duck-ground" cx="88" cy="153" rx="49" ry="6" fill="#BD9131" opacity=".13"/>
      <g class="duck-feet" fill="#F29A3D" stroke="#DF8531" stroke-width="1.4" stroke-linejoin="round"><path d="M65 138 62 149 69 148 72 152 77 147 83 147 79 138Z"/><path d="m101 139 1 10 7-1 4 3 4-4 7-1-10-9Z"/></g>
      <g class="duck-body-group">
        <path d="M47 102c-13 0-20-8-21-18 11 2 17 0 22-4l11 17" fill="#FFDF60" stroke="#E5AE2C" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M43 111c0-24 21-39 47-37 27 1 45 21 44 42-1 22-22 32-47 30-28-2-44-12-44-35Z" fill="url(#${id}-body)" stroke="#E5AE2C" stroke-width="1.5"/>
        <path d="M92 101c17 0 30 13 29 25-1 9-14 15-28 13" fill="#FFF2A6" opacity=".45"/>
        <g class="duck-wing"><path d="M56 105c3-10 16-12 29-4 9 6 13 16 8 22-7 9-28 1-36-7" fill="url(#${id}-wing)" stroke="#E4B238" stroke-width="1.5" stroke-linecap="round"/><path d="M63 107c5-2 13 0 19 5" stroke="#FFF2AB" stroke-width="2.5" stroke-linecap="round"/></g>
        <g class="duck-far-wing"><path d="M128 104c10-7 16-5 17-1 1 6-7 13-13 14" fill="#FFD34B" stroke="#E5AE2C" stroke-width="1.5" stroke-linecap="round"/></g>
      </g>
      <g class="duck-head">
        <path d="M85 29c-7-10-2-17 2-20 0 8 7 8 9 14 0-10 6-13 11-13-4 6 0 10-1 17" fill="#FFDD5B" stroke="#E5AE2C" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M64 65c0-25 15-42 39-42 25 0 43 16 43 40 0 23-19 39-42 39-24 0-40-14-40-37Z" fill="url(#${id}-head)" stroke="#E5AE2C" stroke-width="1.5"/>
        <path d="M75 52c2-10 9-17 19-19" stroke="#FFF9D9" stroke-width="4" stroke-linecap="round" opacity=".8"/>
        <ellipse cx="86" cy="77" rx="8" ry="4.5" fill="#F5AB57" opacity=".38"/><ellipse cx="137" cy="77" rx="6" ry="4" fill="#F5AB57" opacity=".32"/>
        <g class="duck-open-eyes"><g class="duck-pupils"><ellipse cx="98" cy="62" rx="4.3" ry="6.2" fill="#39322D"/><ellipse cx="128" cy="62" rx="4.1" ry="6" fill="#39322D"/><circle cx="99.2" cy="60" r="1.4" fill="white"/><circle cx="129.2" cy="60" r="1.3" fill="white"/></g></g>
        <g class="duck-closed-eyes" stroke="#4B382A" stroke-width="2.8" stroke-linecap="round"><path d="M92 64q6-6 12 0m18 0q6-6 12 0"/></g>
        <g class="duck-sleep-eyes" stroke="#4B382A" stroke-width="2.6" stroke-linecap="round"><path d="M92 63q6 6 12 0m18 0q6 6 12 0"/></g>
        <g class="duck-brows" stroke="#9B782C" stroke-width="2" stroke-linecap="round"><path d="m91 51 11-3m22 0 10 4"/></g>
        <path d="M110 78c4-5 12-6 18-3l10 5c3 2 1 6-3 8-8 4-19 1-25-3-3-2-3-4 0-7Z" fill="url(#${id}-beak)" stroke="#DF8F36" stroke-width="1.3"/>
        <path d="M112 82c7 3 14 3 21 0" stroke="#C87930" stroke-width="1.5" stroke-linecap="round"/><path d="m115 77 5-1" stroke="#FFCE8B" stroke-width="2" stroke-linecap="round"/>
        <g class="duck-glasses" stroke="#3D4B47" stroke-width="2.5"><rect x="84" y="53" width="25" height="21" rx="7" fill="#F6FFFB" fill-opacity=".2"/><rect x="118" y="53" width="25" height="21" rx="7" fill="#F6FFFB" fill-opacity=".2"/><path d="M109 59q5-4 9 0m-38-3 4 3"/></g>
      </g>
      <g class="duck-check-flag"><path d="m131 136 12-40" stroke="#A87836" stroke-width="2.5" stroke-linecap="round"/><path d="m143 96 27 5-4 22-28-7Z" fill="#FFFEF3" stroke="#E6C873" stroke-width="1.5" stroke-linejoin="round"/><path d="m146 108 4 5 9-7" stroke="#558873" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>
      <g class="duck-sparkles" fill="#F4B400"><path d="m35 39 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/><path d="m156 33 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/></g>
      <g class="duck-snooze" fill="#A18D5B"><path d="M150 35h9l-9 10h9M161 19h7l-7 8h7" stroke="#A18D5B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g>
      <g class="duck-water" stroke="#80B8BC" stroke-width="1.7" stroke-linecap="round"><path d="M35 143c21 7 83 9 111 0m-96 9c20 4 57 4 77 0"/></g>
    </svg>`;
  }
  function mount(element, state = "happy") {
    if (!element) return;
    element.innerHTML = markup(state);
  }
  function setState(element, state) {
    const svg = element?.querySelector(".duck-character");
    if (!svg || !states.has(state)) return;
    svg.classList.replace(`duck-${svg.dataset.mood}`, `duck-${state}`);
    svg.dataset.mood = state;
  }
  window.DuckPlanMascot = Object.freeze({ markup, mount, setState });
})();
