/* One account surface, reachable without leaving the planner. */
(() => {
  "use strict";
  const dialog = document.querySelector("#account-dialog");
  const account = document.querySelector("#account-settings");
  const content = dialog?.querySelector(".account-dialog-content");
  const menu = document.querySelector("#account-menu");
  if (!dialog || !account || !content || !menu) return;

  // Move the existing forms so there is one set of IDs, listeners and drafts.
  const home = document.createComment("Account settings return here after closing");
  account.before(home);
  let phase = "closed";
  let launcher = null;
  let anchor = null;
  let menuPhase = "closed";
  let menuLauncher = null;
  let menuAnchor = null;

  function expanded(value) {
    document.querySelectorAll("[data-open-account-menu]").forEach(button => {
      button.setAttribute("aria-expanded", String(value));
    });
  }
  function visibleSource(source) {
    return source?.matches(".profile-card") && !document.body.classList.contains("sidebar-open")
      ? source.querySelector(".avatar") : source;
  }
  function menuItems() { return [...menu.querySelectorAll('[role="menuitem"]:enabled')]; }
  function positionMenu() {
    const rect = visibleSource(menuLauncher)?.getBoundingClientRect();
    if (!rect) return;
    menu.style.width = `${Math.min(260, innerWidth - 24)}px`;
    const box = menu.getBoundingClientRect();
    const left = menuLauncher.closest(".sidebar") ? rect.left : rect.right - box.width;
    const top = innerHeight - rect.bottom >= box.height + 20 ? rect.bottom + 8 : rect.top - box.height - 8;
    menu.style.left = `${Math.max(12, Math.min(left, innerWidth - box.width - 12))}px`;
    menu.style.top = `${Math.max(12, Math.min(top, innerHeight - box.height - 12))}px`;
  }
  function openMenu(source) {
    menuLauncher = source;
    menuAnchor = window.DuckPopupMotion?.capture(visibleSource(source));
    menuPhase = "opening";
    menu.hidden = false; menu.inert = false;
    if (menu.showPopover && !menu.matches(":popover-open")) menu.showPopover();
    positionMenu();
    expanded(true);
    const settings = menu.querySelector('[data-account-menu-action="settings"]');
    if (document.body.dataset.view === "settings") settings.setAttribute("aria-current", "page");
    else settings.removeAttribute("aria-current");
    setupButtonMaterial(menu);
    menu.focus({ preventScroll: true });
    const finish = () => {
      if (menuPhase !== "opening") return;
      menuPhase = "open";
      menuItems()[0]?.focus({ preventScroll: true });
    };
    if (window.DuckPopupMotion) window.DuckPopupMotion.open(menu, menuAnchor, finish);
    else finish();
  }
  function closeMenu({ restoreFocus = true, focusSettings = false } = {}) {
    if (menuPhase === "closed" || menuPhase === "closing") return;
    menuPhase = "closing";
    menu.inert = true;
    expanded(false);
    const finish = () => {
      if (menuPhase !== "closing") return;
      if (menu.hidePopover && menu.matches(":popover-open")) menu.hidePopover();
      menu.hidden = true;
      menuPhase = "closed";
      if (focusSettings && document.body.dataset.view === "settings") document.querySelector(".workspace")?.focus({ preventScroll: true });
      if (restoreFocus && menuLauncher?.isConnected && menuLauncher.getClientRects().length) menuLauncher.focus({ preventScroll: true });
    };
    if (window.DuckPopupMotion) window.DuckPopupMotion.close(menu, menuAnchor, finish);
    else finish();
  }
  function focusAccount() {
    const target = dialog.querySelector("#google-sign-in:enabled, input:enabled, .connection-local-note a, #sign-out");
    const bounds = target?.getBoundingClientRect(), viewport = content.getBoundingClientRect();
    const visible = bounds && bounds.top >= viewport.top && bounds.bottom <= viewport.bottom;
    (visible ? target : dialog.querySelector("[data-close-account]")).focus({ preventScroll: true });
  }
  function open(source) {
    if (dialog.open && phase !== "closing") { focusAccount(); return; }
    if (!dialog.open) {
      launcher = source || document.activeElement;
      anchor = window.DuckPopupMotion?.capture(visibleSource(launcher));
      content.append(account);
      if (!store.user) setAccountMode("sign-in", { focus: false });
      setupButtonMaterial(dialog);
      dialog.showModal();
    }
    phase = "opening";
    dialog.inert = false;
    const finish = () => {
      if (phase !== "opening") return;
      phase = "open";
      focusAccount();
    };
    if (window.DuckPopupMotion) window.DuckPopupMotion.open(dialog, anchor, finish);
    else finish();
  }
  function close() {
    if (!dialog.open || phase === "closing") return;
    phase = "closing";
    dialog.inert = true;
    const finish = () => { if (phase === "closing") dialog.close(); };
    if (window.DuckPopupMotion) window.DuckPopupMotion.close(dialog, anchor, finish);
    else finish();
  }

  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Tab" || phase === "closing") return;
    const controls = [...dialog.querySelectorAll('button:enabled, input:enabled, a[href], [tabindex="0"]')]
      .filter(element => element.getClientRects().length && !element.closest("[hidden],[inert]"));
    const first = controls[0], last = controls.at(-1);
    if (!first) { event.preventDefault(); dialog.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });
  dialog.addEventListener("click", event => {
    if (event.target.closest("[data-close-account]")) { close(); return; }
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  });
  dialog.addEventListener("close", () => {
    window.DuckPopupMotion?.cancel(dialog);
    phase = "closed";
    dialog.inert = false;
    home.after(account);
    account.querySelectorAll('input[type="password"]').forEach(input => { input.value = ""; });
    const target = launcher?.isConnected && launcher.getClientRects().length ? launcher :
      [...document.querySelectorAll("[data-open-account-menu]")].find(button => button.getClientRects().length);
    target?.focus({ preventScroll: true });
  });
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-open-account-menu]");
    if (button) {
      if (button === menuLauncher && ["open", "opening"].includes(menuPhase)) closeMenu();
      else openMenu(button);
      return;
    }
    const action = event.target.closest("[data-account-menu-action]");
    if (!action) return;
    closeMenu({ restoreFocus: false, focusSettings: action.dataset.accountMenuAction === "settings" });
    if (action.dataset.accountMenuAction === "sign-in") open(menuLauncher);
  });
  menu.addEventListener("keydown", event => {
    const items = menuItems();
    const index = items.indexOf(document.activeElement);
    if (["Escape", "Tab"].includes(event.key)) {
      event.preventDefault(); event.stopPropagation(); closeMenu();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 :
        (index + (event.key === "ArrowUp" ? items.length - 1 : 1)) % items.length;
      items[next]?.focus({ preventScroll: true });
    }
  });
  document.addEventListener("pointerdown", event => {
    if (menuPhase !== "closed" && !menu.contains(event.target) && !event.target.closest("[data-open-account-menu]")) closeMenu({ restoreFocus: false });
  }, true);
  window.addEventListener("resize", () => { if (menuPhase !== "closed") positionMenu(); });
  window.addEventListener("hashchange", () => closeMenu({ restoreFocus: false }));
  window.addEventListener("hashchange", close);
  window.DuckAccountEntry = { open, close, openMenu, closeMenu };
})();
