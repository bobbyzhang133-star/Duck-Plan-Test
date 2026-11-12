(() => {
  "use strict";

  const query = window.matchMedia("(max-width: 700px), (max-width: 960px) and (max-height: 500px) and (pointer: coarse)");
  const moreButton = document.querySelector("#phone-more-button");
  const dialog = document.querySelector("#phone-more-dialog");
  const closeButton = document.querySelector("#phone-more-close");
  const secondaryViews = new Set(["goals", "notes", "settings"]);
  let anchor = null;
  let closing = false;

  window.DuckPlanPhoneNavigation = Object.freeze({ query });

  function reflectSection() {
    const secondary = secondaryViews.has(document.body.dataset.view);
    moreButton.classList.toggle("active", secondary);
    if (secondary) moreButton.setAttribute("aria-current", "page");
    else moreButton.removeAttribute("aria-current");
  }

  function finishClose(restoreFocus) {
    if (dialog.open) dialog.close();
    dialog.inert = false;
    closing = false;
    moreButton.setAttribute("aria-expanded", "false");
    if (restoreFocus && query.matches) moreButton.focus({ preventScroll: true });
  }

  function closeMore({ immediate = false, restoreFocus = true } = {}) {
    if (!dialog.open || closing && !immediate) return;
    closing = true;
    dialog.inert = true;
    moreButton.setAttribute("aria-expanded", "false");
    if (immediate) {
      window.DuckPopupMotion.cancel(dialog);
      finishClose(restoreFocus);
    } else {
      window.DuckPopupMotion.close(dialog, anchor, () => finishClose(restoreFocus));
    }
  }

  moreButton.addEventListener("click", () => {
    if (!query.matches || dialog.open) return;
    anchor = window.DuckPopupMotion.capture(moreButton);
    closing = false;
    dialog.inert = false;
    moreButton.setAttribute("aria-expanded", "true");
    dialog.showModal();
    window.DuckPopupMotion.open(dialog, anchor, () => {
      if (dialog.open && !closing) closeButton.focus({ preventScroll: true });
    });
  });
  closeButton.addEventListener("click", () => closeMore());
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeMore();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || closing) return;
    const buttons = [...dialog.querySelectorAll("button:not(:disabled)")];
    const first = buttons[0];
    const last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target.closest(".nav-item[data-view]")) {
      closeMore();
      return;
    }
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeMore();
  });
  dialog.addEventListener("close", () => {
    window.DuckPopupMotion.cancel(dialog);
    dialog.inert = false;
    closing = false;
    moreButton.setAttribute("aria-expanded", "false");
  });
  query.addEventListener("change", () => {
    if (!query.matches) closeMore({ immediate: true, restoreFocus: false });
  });
  window.addEventListener("pagehide", () => closeMore({ immediate: true, restoreFocus: false }));
  new MutationObserver(reflectSection).observe(document.body, { attributes: true, attributeFilter: ["data-view"] });
  reflectSection();
})();
