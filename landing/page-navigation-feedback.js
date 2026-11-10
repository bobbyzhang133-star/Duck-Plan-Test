(() => {
  "use strict";

  if (window.__duckPlanPageNavigationInstalled) return;
  window.__duckPlanPageNavigationInstalled = true;

  const SELECTOR = "a[data-page-navigation]";
  let sequence = 0;
  let pending = null;
  let replaying = null;

  function restore() {
    sequence += 1;
    pending = null;
    document.querySelectorAll(SELECTOR).forEach((link) => link.removeAttribute("data-activated"));
  }

  function bypassFeedback(event, link) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return true;
    if (replaying === link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return true;
    if (link.getAttribute("aria-disabled") === "true" || link.closest("[inert]")) return true;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin) return true;
    return destination.pathname === location.pathname && destination.search === location.search && Boolean(destination.hash);
  }

  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest(SELECTOR) : null;
    if (!link || bypassFeedback(event, link)) return;

    event.preventDefault();
    if (pending === link) return;
    restore();
    const ticket = sequence;
    pending = link;
    link.dataset.activated = "true";

    const navigate = () => {
      if (ticket !== sequence || !link.isConnected) return;
      pending = null;
      replaying = link;
      try {
        link.click();
      } finally {
        replaying = null;
      }
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      navigate();
      return;
    }

    requestAnimationFrame(() => {
      if (ticket !== sequence) return;
      const waves = typeof link.getAnimations === "function"
        ? link.getAnimations({ subtree: true }).filter((animation) => animation.animationName === "duckplan-page-wave")
        : [];
      if (waves.length) Promise.allSettled(waves.map((animation) => animation.finished)).then(navigate);
      else setTimeout(navigate, 350);
    });
  }, true);

  window.addEventListener("pageshow", (event) => { if (event.persisted) restore(); });
  window.addEventListener("popstate", restore);
})();
