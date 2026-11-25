/* One account surface, reachable without leaving the planner. */
(() => {
  "use strict";
  const dialog = document.querySelector("#account-dialog");
  const account = document.querySelector("#account-settings");
  const content = dialog?.querySelector(".account-dialog-content");
  if (!dialog || !account || !content) return;

  // Move the existing forms so there is one set of IDs, listeners and drafts.
  const home = document.createComment("Account settings return here after closing");
  account.before(home);
  let phase = "closed";
  let launcher = null;
  let anchor = null;

  function expanded(value) {
    document.querySelectorAll("[data-open-account]").forEach(button => {
      button.setAttribute("aria-expanded", String(value));
    });
  }
  function focusAccount() {
    const target = dialog.querySelector("#google-sign-in:enabled, input:enabled, .connection-local-note a, #sign-out");
    (target || dialog.querySelector("[data-close-account]")).focus({ preventScroll: true });
  }
  function open(source) {
    if (dialog.open && phase !== "closing") { focusAccount(); return; }
    if (!dialog.open) {
      launcher = source || document.activeElement;
      anchor = window.DuckPopupMotion?.capture(launcher);
      content.append(account);
      if (!store.user) setAccountMode("sign-in", { focus: false });
      setupButtonMaterial(dialog);
      dialog.showModal();
    }
    phase = "opening";
    dialog.inert = false;
    expanded(true);
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
    expanded(false);
    const target = launcher?.isConnected && launcher.getClientRects().length ? launcher :
      [...document.querySelectorAll("[data-open-account]")].find(button => button.getClientRects().length);
    target?.focus({ preventScroll: true });
  });
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-open-account]");
    if (button) open(button);
  });
  window.addEventListener("hashchange", close);
  window.DuckAccountEntry = { open, close };
})();
