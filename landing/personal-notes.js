(function personalNotesFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckPersonalNotes = api;
})(typeof window !== "undefined" ? window : globalThis, function buildPersonalNotes() {
  "use strict";
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  function normalizeNote(value = {}) {
    const title = String(value.title || "").trim();
    const category = String(value.category || "Personal").trim();
    const body = String(value.body ?? "");
    const invalid = (message, field) => { const error = new Error(message); error.field = field; throw error; };
    if (!title || title.length > 100) invalid("Give your note a title of up to 100 characters.", "title");
    if (!category || category.length > 60) invalid("Choose a category of up to 60 characters.", "category");
    if (body.length > 5000) invalid("Keep your note within 5,000 characters.", "body");
    return { ...(value.id ? { id: value.id } : {}), title, category, body };
  }

  function wordCount(value) { return String(value || "").trim().match(/\S+/g)?.length || 0; }
  function filterNotes(items, query) {
    const term = String(query || "").trim().toLocaleLowerCase();
    return items.filter(item => !term || [item.title, item.category, item.body].some(value => String(value || "").toLocaleLowerCase().includes(term)))
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")) || a.title.localeCompare(b.title));
  }

  function create(host) {
    const root = host.root || document.querySelector("#personal-notes-root");
    if (!root) return null;
    const store = host.store;
    const doc = root.ownerDocument;
    let owner = "", generation = 0, query = "", dialog = null, destroyed = false;
    const ownerKey = () => `${store.mode}:${store.user?.id || "local"}`;
    const available = () => store.supportsPersonal !== false && typeof store.upsertNote === "function";
    const notes = () => store.listNotes?.() || [];
    root.innerHTML = '<div class="personal-notes-toolbar"><div><h2>Your notes</h2><p class="personal-notes-summary" role="status"></p></div><button type="button" class="secondary-button" data-note-action="new">＋ Add note</button></div><label class="personal-notes-search">Search notes<input type="search" placeholder="Search titles, categories or writing" autocomplete="off" /></label><p class="personal-notes-availability" role="status" hidden></p><div class="personal-notes-list"></div>';

    function discardDialog({ restoreFocus = false } = {}) {
      const current = dialog;
      if (!current) return;
      dialog = null;
      doc.defaultView.DuckPopupMotion?.cancel(current.element);
      current.element.close(); current.element.remove();
      if (restoreFocus) {
        const replacement = [...root.querySelectorAll('[data-note-action="open"]')].find(item => item.dataset.noteId === current.id);
        (current.source?.isConnected ? current.source : replacement || root.querySelector('[data-note-action="new"]'))?.focus({ preventScroll: true });
      }
    }

    function render() {
      if (destroyed) return;
      if (owner !== ownerKey()) {
        owner = ownerKey(); generation += 1; query = "";
        root.querySelector('input[type="search"]').value = "";
        discardDialog();
      }
      const list = notes();
      const filtered = filterNotes(list, query);
      root.querySelector(".personal-notes-summary").textContent = `${list.length} saved ${list.length === 1 ? "note" : "notes"}${store.mode === "local" ? " · On this device" : " · Account synced"}`;
      root.querySelector('[data-note-action="new"]').disabled = !available();
      const notice = root.querySelector(".personal-notes-availability");
      notice.hidden = available();
      notice.textContent = "Notes are not available on this connection yet. Try again after the site is updated.";
      const active = doc.activeElement;
      const focusId = root.contains(active) ? active.dataset.noteId : null;
      const focusAction = root.contains(active) ? active.dataset.noteAction : null;
      root.querySelector(".personal-notes-list").innerHTML = filtered.length ? filtered.map(item => `<article class="personal-note-card" data-note-card="${escape(item.id)}"><span class="category-badge">${escape(item.category)}</span><h3><button type="button" class="personal-note-open" data-note-action="open" data-note-id="${escape(item.id)}">${escape(item.title)}</button></h3><p class="personal-note-excerpt">${escape(item.body || "No writing yet.")}</p><div class="personal-note-footer"><span>${wordCount(item.body)} ${wordCount(item.body) === 1 ? "word" : "words"}</span><div><button type="button" class="secondary-button" data-note-action="open" data-note-id="${escape(item.id)}"${available() ? "" : " disabled"}>Open note</button><button type="button" class="secondary-button" data-note-action="delete" data-note-id="${escape(item.id)}" aria-label="Delete ${escape(item.title)}"${available() ? "" : " disabled"}>Delete</button></div></div></article>`).join("") : `<div class="personal-notes-empty"><h3>${query ? "No matching notes" : "A little room for your next idea"}</h3><p>${query ? "Try another word or category." : "Add a note to save class ideas, plans or everyday thoughts."}</p></div>`;
      host.setupButtons?.(root);
      if (focusId && focusAction) [...root.querySelectorAll("[data-note-action]")].find(item => item.dataset.noteId === focusId && item.dataset.noteAction === focusAction)?.focus({ preventScroll: true });
    }

    function openEditor({ id = null, source = doc.activeElement, deleting = false } = {}) {
      render();
      if (!available()) { host.showToast?.("Notes are not available on this connection yet."); return; }
      if (dialog) { dialog.element.querySelector("input,textarea,button")?.focus(); return; }
      const item = id ? notes().find(note => note.id === id) : null;
      if (id && !item) { host.showToast?.("That note is no longer available."); return; }
      const element = doc.createElement("dialog");
      element.className = "personal-note-dialog";
      element.tabIndex = -1;
      element.setAttribute("aria-labelledby", "personal-note-dialog-heading");
      const categories = [...new Set(["Personal", "Class notes", "Ideas", item?.category].filter(Boolean))];
      element.innerHTML = `<form novalidate><div class="personal-note-dialog-heading"><h2 id="personal-note-dialog-heading">${deleting ? "Delete note" : item ? "Edit note" : "New note"}</h2><button type="button" class="close-button" data-note-close aria-label="Close note editor">×</button></div><p class="personal-note-error" role="alert" hidden></p>${deleting ? `<p>Delete <strong>${escape(item.title)}</strong>? This removes the saved note.</p>` : `<label>Title<input name="title" maxlength="100" value="${escape(item?.title)}" placeholder="Give your thought a title" required /></label><label>Category<select name="category">${categories.map(value => `<option ${value === (item?.category || "Personal") ? "selected" : ""}>${escape(value)}</option>`).join("")}</select></label><label>Your note<textarea name="body" rows="10" maxlength="5000" placeholder="Start writing here…">${escape(item?.body)}</textarea></label><p class="personal-note-word-count" role="status">${wordCount(item?.body)} words · Saved when you choose Save note</p>`}<div class="personal-note-dialog-actions"><button type="button" class="secondary-button" data-note-close>Cancel</button><button type="submit" class="${deleting ? "secondary-button" : "primary-button"}">${deleting ? "Delete note" : "Save note"}</button></div></form>`;
      const context = { element, id, source, generation, busy: false, closing: false, anchor: doc.defaultView.DuckPopupMotion?.capture(source) };
      dialog = context;
      const current = () => !destroyed && dialog === context && generation === context.generation && owner === ownerKey();
      const finishClose = () => { if (current()) discardDialog({ restoreFocus: true }); };
      const close = () => {
        if (!current() || context.busy || context.closing) return;
        context.closing = true; element.inert = true;
        if (doc.defaultView.DuckPopupMotion) doc.defaultView.DuckPopupMotion.close(element, context.anchor, finishClose);
        else finishClose();
      };
      element.addEventListener("cancel", event => { event.preventDefault(); close(); });
      element.addEventListener("click", event => {
        if (event.target.closest("[data-note-close]")) close();
        if (event.target !== element) return;
        const bounds = element.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      });
      element.addEventListener("keydown", event => {
        if (event.key !== "Tab") return;
        const controls = [...element.querySelectorAll("button,input,select,textarea")].filter(control => !control.disabled && control.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (!first) { event.preventDefault(); element.focus(); return; }
        if (event.shiftKey && doc.activeElement === first || !event.shiftKey && doc.activeElement === last || !controls.includes(doc.activeElement)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        }
      });
      element.querySelector("textarea")?.addEventListener("input", event => {
        element.querySelector(".personal-note-word-count").textContent = `${wordCount(event.target.value)} words · Saved when you choose Save note`;
      });
      element.querySelector("form").addEventListener("submit", async event => {
        event.preventDefault();
        if (!current() || context.busy || context.closing) return;
        const errorBox = element.querySelector(".personal-note-error");
        errorBox.hidden = true;
        let next;
        try {
          if (!available()) throw new Error("Notes are not available on this connection yet.");
          if (!deleting) next = normalizeNote({ ...Object.fromEntries(new FormData(event.currentTarget)), id });
        } catch (error) {
          errorBox.textContent = error.message; errorBox.hidden = false;
          element.querySelector(`[name="${error.field || "title"}"]`)?.focus(); return;
        }
        context.busy = true;
        element.setAttribute("aria-busy", "true");
        element.querySelectorAll("button,input,select,textarea").forEach(control => { control.disabled = true; });
        try {
          if (deleting) await store.deleteNote(id); else await store.upsertNote(next);
          if (!current()) return;
          context.busy = false; close(); render(); host.showToast?.(deleting ? "Note deleted." : "Note saved.");
        } catch (error) {
          if (!current()) return;
          errorBox.textContent = error.message || "Could not save your note. Please try again."; errorBox.hidden = false;
          host.reportError?.(error);
        } finally {
          if (current()) {
            context.busy = false; element.removeAttribute("aria-busy");
            element.querySelectorAll("button,input,select,textarea").forEach(control => { control.disabled = false; });
            if (!context.closing) element.querySelector('button[type="submit"]')?.focus();
          }
        }
      });
      doc.body.append(element); host.setupButtons?.(element); element.showModal();
      const focus = () => { if (current() && !context.closing) (deleting ? element.querySelector("[data-note-close]") : element.querySelector("input"))?.focus(); };
      if (doc.defaultView.DuckPopupMotion) doc.defaultView.DuckPopupMotion.open(element, context.anchor, focus); else focus();
    }

    const click = event => {
      const button = event.target.closest("[data-note-action]");
      if (!button || !root.contains(button)) return;
      const action = button.dataset.noteAction;
      openEditor({ id: action === "new" ? null : button.dataset.noteId, source: button, deleting: action === "delete" });
    };
    const search = event => { if (event.target.matches('input[type="search"]')) { query = event.target.value; render(); } };
    root.addEventListener("click", click); root.addEventListener("input", search);
    render();
    return {
      render, openNote: openEditor,
      destroy() { destroyed = true; generation += 1; discardDialog(); root.removeEventListener("click", click); root.removeEventListener("input", search); },
    };
  }

  return { create, normalizeNote, wordCount, filterNotes };
});
