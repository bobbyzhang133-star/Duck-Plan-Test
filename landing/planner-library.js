(function plannerLibraryFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckPlanLibrary = api;
})(typeof window !== "undefined" ? window : globalThis, function buildPlannerLibrary() {
  "use strict";

  const TEMPLATE_MIME = "application/x-duckplan-template";
  const PRIORITIES = ["High", "Medium", "Low"];
  const REMINDERS = ["default", "off", "15", "60", "1440"];
  const REMINDER_LABELS = { default: "Use Settings default", off: "No reminder", "15": "15 minutes before", "60": "1 hour before", "1440": "1 day before" };

  function invalid(field, message) {
    const error = new Error(message);
    error.field = field;
    return error;
  }

  function text(value, field, maximum, required = false) {
    const result = String(value ?? "").trim();
    if (required && !result) throw invalid(field, `Enter ${field === "title" ? "a title" : field}.`);
    if (result.length > maximum) throw invalid(field, `${field[0].toUpperCase()}${field.slice(1)} must be ${maximum} characters or fewer.`);
    return result;
  }

  function identifier(value) {
    return value == null || value === "" ? null : text(value, "class", 128);
  }

  function normalizeTemplate(item = {}) {
    const durationMinutes = Number(item.durationMinutes ?? 45);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 1440) {
      throw invalid("durationMinutes", "Duration must be a whole number from 5 to 1440 minutes.");
    }
    const priority = item.priority ?? "Medium";
    if (!PRIORITIES.includes(priority)) throw invalid("priority", "Choose High, Medium or Low priority.");
    const reminderChoice = String(item.reminderChoice ?? "default");
    if (!REMINDERS.includes(reminderChoice)) throw invalid("reminderChoice", "Choose a valid deadline reminder.");
    return {
      ...(item.id ? { id: String(item.id) } : {}),
      title: text(item.title, "title", 80, true),
      classId: identifier(item.classId),
      durationMinutes,
      priority,
      notes: text(item.notes, "notes", 5000),
      reminderChoice,
    };
  }

  function safeResourceUrl(value) {
    const input = String(value ?? "").trim();
    if (!input || input.length > 2048 || /[\u0000-\u0020\u007f]/.test(input)) return null;
    try {
      const url = new URL(input);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
      return url.href.length <= 2048 ? url.href : null;
    } catch { return null; }
  }

  function normalizeResource(item = {}) {
    const classId = identifier(item.classId);
    if (!classId) throw invalid("classId", "Choose a class for this resource.");
    const url = safeResourceUrl(item.url);
    if (!url) throw invalid("url", "Enter a complete http:// or https:// link without a username or password.");
    const sortOrder = Number(item.sortOrder ?? 0);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
      throw invalid("sortOrder", "Resource order must be a whole number from 0 to 10000.");
    }
    return {
      ...(item.id ? { id: String(item.id) } : {}),
      classId,
      title: text(item.title, "title", 120, true),
      url,
      description: text(item.description, "description", 2000),
      category: text(item.category, "category", 60),
      sortOrder,
    };
  }

  function templateDraft(item) {
    const { id, ...fields } = normalizeTemplate(item);
    return { ...fields, type: "assignment" };
  }

  function templateDetails(item, classLabel = "No class") {
    const template = normalizeTemplate(item);
    return [
      ["Assignment", template.title], ["Class", classLabel],
      ["Duration", `${template.durationMinutes} minutes`], ["Priority", template.priority],
      ["Deadline reminder", REMINDER_LABELS[template.reminderChoice]], ["Notes", template.notes || "No notes."],
    ];
  }

  function instantiateTemplate(item, { makeId = () => globalThis.crypto.randomUUID() } = {}) {
    return {
      ...templateDraft(item),
      id: makeId(),
      dueDate: "",
      dueTime: "",
      scheduledStart: null,
      scheduledEnd: null,
      completed: false,
      source: "manual",
      schemaVersion: 2,
    };
  }

  function instantiateScheduledTemplate(item, { date, time, makeId } = {}) {
    const template = normalizeTemplate(item);
    const day = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
    if (!day || !Number.isFinite(day.getTime()) || Number(date.slice(0, 4)) < 1 || day.toISOString().slice(0, 10) !== date) throw invalid("scheduledDate", "Drop onto a calendar day.");
    if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw invalid("scheduledTime", "Choose a valid work time.");
    const [hour, minute] = time.split(":").map(Number);
    if (hour * 60 + minute < 7 * 60 || hour * 60 + minute + template.durationMinutes > 22 * 60) throw invalid("durationMinutes", "This template does not fit the visible day. Choose Schedule to set a work time.");
    return { ...instantiateTemplate(template, { makeId }), scheduledStart: `${date}T${time}` };
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function create(host) {
    const doc = host.document || document;
    const store = host.store;
    let selectedClassId = null;
    let selectedTab = "assignments";
    let dialog = null;
    let dialogBusy = false;
    let dialogSource = null;
    let dialogSourceKey = "";
    let taskClassId = null;
    let templateMenu = null;
    let ownerKey = currentOwnerKey();
    let ownerGeneration = 0;
    let destroyed = false;
    let activeDrag = null;
    const pending = new Map();
    const find = selector => doc.querySelector(selector);
    const classes = () => store.listClasses({ includeArchived: true });
    const templates = () => store.listTemplates();
    const resources = classId => store.listResources(classId ? { classId } : undefined);
    const className = id => classes().find(item => item.id === id)?.name || "No class";
    const available = () => store.supportsOrganization !== false;
    const organizationAction = action => action === "template-menu" || action.endsWith("template") || action.endsWith("resource");
    const unavailableNotice = () => available() ? "" : '<p class="library-unavailable" role="status">Templates and resources are not available on this server yet. Your saved local library stays safe on this device.</p>';
    const button = (action, id, label, { primary = false, context = "", extra = "" } = {}) => `<button type="button" class="${primary ? "primary-button" : "secondary-button"} library-button" data-library-action="${action}" data-library-id="${escapeHtml(id)}" data-library-focus="${context}:${action}:${escapeHtml(id)}" ${!available() && organizationAction(action) ? "disabled" : ""} ${pending.has(id) && action === "add-template" ? 'aria-disabled="true" aria-busy="true"' : ""} ${extra}>${label}</button>`;

    function currentOwnerKey() { return `${store.mode}:${store.user?.id || "local"}`; }
    function captureOwner() { return { key: ownerKey, generation: ownerGeneration }; }
    function isCurrentOwner(owner) { return !destroyed && owner.key === ownerKey && owner.generation === ownerGeneration && owner.key === currentOwnerKey(); }
    function isCurrentDialog(current, owner) { return current === dialog && isCurrentOwner(owner); }

    function detachDialog() {
      const current = dialog;
      dialog = null;
      dialogBusy = false;
      dialogSource = null;
      dialogSourceKey = "";
      if (current?.open) current.close();
      current?.remove();
    }

    function syncOwner() {
      const next = currentOwnerKey();
      if (next === ownerKey) return;
      ownerKey = next;
      ownerGeneration += 1;
      detachDialog();
      selectedClassId = null;
      selectedTab = "assignments";
      taskClassId = null;
      pending.clear();
      closeTemplateMenu();
    }

    function fail(error) {
      if (host.reportError) host.reportError(error);
      else host.showToast?.(error.message || "Could not save. Please try again.");
    }

    function refreshButtons(target) {
      host.setupButtons?.(target);
    }

    function replace(target, markup) {
      if (!target) return;
      if (templateMenu && target.contains(templateMenu.trigger)) closeTemplateMenu({ restoreFocus: templateMenu.element.contains(doc.activeElement) });
      const active = doc.activeElement;
      const key = target.contains(active) ? active?.dataset.libraryFocus : null;
      target.innerHTML = markup;
      refreshButtons(target);
      if (key && !dialog?.open) {
        [...target.querySelectorAll("[data-library-focus]")].find(item => item.dataset.libraryFocus === key)?.focus({ preventScroll: true });
      }
    }

    function templateCards(items, context) {
      if (!items.length) return '<p class="library-empty">No templates yet. Save a repeatable assignment to use it again.</p>';
      return `<div class="library-template-grid">${items.map(item => {
        const info = classes().find(value => value.id === item.classId);
        const color = /^#[0-9a-f]{6}$/i.test(info?.color || "") ? info.color : "#8f8a7d";
        const minutes = Number.isFinite(Number(item.durationMinutes)) && Number(item.durationMinutes) > 0 ? Number(item.durationMinutes) : 45;
        const height = Math.min(156, Math.max(60, Math.round(minutes * 62 / 60)));
        const label = className(item.classId);
        return `<article class="library-template-card">
          <div class="library-template-block" draggable="${available()}" data-library-template="${escapeHtml(item.id)}" role="group" aria-label="${escapeHtml(item.title)}, ${minutes} minute template" style="--course-color:${color};--template-block-height:${height}px">
            <div class="library-template-block-heading"><h3 title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3><span class="library-drag-hint" aria-hidden="true" title="Drag onto a calendar time">⠿</span></div>
            <p class="library-template-block-meta"><span class="library-template-duration">${minutes} min</span><span aria-hidden="true">·</span><span class="library-template-class" title="${escapeHtml(label)}">${escapeHtml(label)}</span></p>
          </div>
          <div class="library-actions library-template-actions">${button("schedule-template", item.id, "Schedule", { context, extra: `aria-label="Schedule ${escapeHtml(item.title)}"` })}${button("add-template", item.id, "Add to tasks", { context, extra: `aria-label="Add ${escapeHtml(item.title)} to tasks"` })}${button("template-menu", item.id, '<span aria-hidden="true">⋯</span>', { context, extra: `aria-label="Manage ${escapeHtml(item.title)}" aria-haspopup="menu" aria-expanded="false" aria-controls="template-management-menu"` })}</div>
        </article>`;
      }).join("")}</div>`;
    }

    function closeTemplateMenu({ restoreFocus = false } = {}) {
      const current = templateMenu;
      if (!current) return;
      templateMenu = null;
      current.animation?.cancel();
      current.trigger.setAttribute("aria-expanded", "false");
      current.element.remove();
      if (restoreFocus && current.trigger.isConnected) current.trigger.focus({ preventScroll: true });
    }

    function openTemplateMenu(trigger) {
      if (templateMenu?.trigger === trigger) { closeTemplateMenu({ restoreFocus: true }); return; }
      closeTemplateMenu();
      const item = findTemplate(trigger.dataset.libraryId);
      if (!item || !available()) return;
      const element = doc.createElement("div");
      element.id = "template-management-menu";
      element.className = "library-template-menu";
      element.setAttribute("role", "menu");
      element.setAttribute("aria-label", `Manage ${item.title}`);
      element.innerHTML = ["Details", "Edit", "Delete"].map(label => `<button type="button" role="menuitem" tabindex="-1" data-template-menu-action="${label.toLowerCase()}" aria-label="${label} ${escapeHtml(item.title)}">${label}</button>`).join("");
      const state = templateMenu = { element, trigger, id: item.id, owner: captureOwner() };
      trigger.setAttribute("aria-expanded", "true");
      doc.body.append(element);
      positionTemplateMenu(state);
      const controls = [...element.querySelectorAll("button")];
      element.addEventListener("keydown", event => {
        if (["Escape", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (event.key === "Escape") { closeTemplateMenu({ restoreFocus: true }); return; }
          const index = controls.indexOf(doc.activeElement);
          const next = event.key === "Home" ? 0 : event.key === "End" ? controls.length - 1 : (index + (event.key === "ArrowDown" ? 1 : controls.length - 1)) % controls.length;
          controls[next].focus({ preventScroll: true });
        } else if (event.key === "Tab") closeTemplateMenu({ restoreFocus: true });
      });
      element.addEventListener("click", event => {
        const control = event.target.closest("[data-template-menu-action]");
        if (!control || templateMenu !== state) return;
        const action = control.dataset.templateMenuAction;
        const latest = isCurrentOwner(state.owner) && findTemplate(state.id);
        closeTemplateMenu();
        if (latest) openDialog({ kind: "template", item: latest, source: trigger, deleting: action === "delete", viewing: action === "details" });
      });
      refreshButtons(element);
      controls[0].focus({ preventScroll: true });
      const view = doc.defaultView;
      if (element.animate && !view?.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        state.animation = element.animate([{ opacity: 0, transform: "scale(.92,.86)" }, { opacity: 1, transform: "scale(1)" }], {
          duration: view?.DuckMotion?.duration.popupOpen || 240,
          easing: view?.DuckMotion?.easing || "cubic-bezier(.2,.8,.2,1)",
        });
        const animation = state.animation;
        animation.finished.then(() => { if (state.animation === animation) state.animation = null; }, () => {});
      }
    }

    function positionTemplateMenu({ element, trigger }) {
      const bounds = trigger.getBoundingClientRect();
      const menuBounds = { width: element.offsetWidth, height: element.offsetHeight };
      const view = doc.defaultView;
      const width = view?.innerWidth || doc.documentElement.clientWidth;
      const height = view?.innerHeight || doc.documentElement.clientHeight;
      element.style.left = `${Math.max(8, Math.min(bounds.right - menuBounds.width, width - menuBounds.width - 8))}px`;
      element.style.top = `${Math.max(8, Math.min(bounds.bottom + menuBounds.height + 6 <= height - 8 ? bounds.bottom + 6 : bounds.top - menuBounds.height - 6, height - menuBounds.height - 8))}px`;
      const left = parseFloat(element.style.left);
      const top = parseFloat(element.style.top);
      element.style.transformOrigin = `${Math.max(0, Math.min(bounds.left + bounds.width / 2 - left, menuBounds.width))}px ${top >= bounds.bottom ? 0 : menuBounds.height}px`;
    }

    function onOutsideMenuPointer(event) {
      if (templateMenu && !templateMenu.element.contains(event.target) && !templateMenu.trigger.contains(event.target)) closeTemplateMenu();
    }

    function onMenuViewportChange(event) {
      if (templateMenu && !(event.target?.nodeType && templateMenu.element.contains(event.target))) positionTemplateMenu(templateMenu);
    }

    function renderTemplates() {
      const items = templates();
      for (const [id, context, calendar] of [["assignment-templates", "shelf", false], ["calendar-assignment-templates", "calendar-shelf", true]]) {
        const target = find(`#${id}`);
        if (!target) continue;
        const open = Boolean(target.querySelector("details")?.open);
        const headingId = `${id}-heading`;
        const newButton = button("new-template", "", calendar ? "New" : "New template", { context, extra: 'aria-label="New assignment template"' });
        if (calendar) {
          replace(target, `<section class="library-calendar-template-library" aria-label="Saved assignment templates"><div class="library-template-library-header"><span class="library-template-saved-count">${items.length} saved</span>${newButton}</div>${unavailableNotice()}${items.length ? '<p class="library-template-instruction"><span class="library-template-desktop-hint">Drag a block onto the calendar.</span><span class="library-template-phone-hint">Tap Schedule to choose a time.</span></p>' : ""}${templateCards(items, context)}</section>`);
        } else {
          replace(target, `<details class="library-template-shelf" ${open ? "open" : ""}><summary data-library-focus="${context}:summary">Assignment templates <span>${items.length}</span></summary><section class="library-section" aria-labelledby="${headingId}"><div class="library-heading"><div><h2 id="${headingId}">Assignment templates</h2><p>Each use creates a separate task.</p></div>${newButton}</div>${unavailableNotice()}${templateCards(items, context)}${items.length ? '<p class="library-footnote">Drag a block onto the calendar to schedule a copy. Your template stays here.</p>' : ""}</section></details>`);
        }
      }
    }

    function resourceCards(items, editable = true) {
      if (!items.length) return '<p class="library-empty">No resources saved for this class. Add links to handouts, textbooks or study guides.</p>';
      return `<ul class="library-resource-list">${items.map(item => {
        const url = safeResourceUrl(item.url);
        return `<li class="library-resource-card"><div class="library-resource-copy">${item.category ? `<span class="library-category">${escapeHtml(item.category)}</span>` : ""}<h3>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" data-library-focus="${editable ? "class" : "task"}:resource:${escapeHtml(item.id)}">${escapeHtml(item.title)}<span class="library-external" aria-hidden="true"> ↗</span><span class="library-sr-only"> (opens in a new tab)</span></a>` : escapeHtml(item.title)}</h3>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}${url ? `<span class="library-resource-host">${escapeHtml(new URL(url).hostname)}</span>` : '<span class="library-resource-host">Link unavailable</span>'}</div>${editable ? `<div class="library-card-tools">${button("edit-resource", item.id, "Edit", { context: "resources" })}${button("delete-resource", item.id, "Delete", { context: "resources" })}</div>` : ""}</li>`;
      }).join("")}</ul>`;
    }

    function renderClassLibrary() {
      const target = find("#class-library");
      if (!target) return;
      const allClasses = classes();
      if (!allClasses.some(item => item.id === selectedClassId)) selectedClassId = allClasses.find(item => !item.archived)?.id || allClasses[0]?.id || null;
      const selected = allClasses.find(item => item.id === selectedClassId);
      const classTasks = store.listItems().filter(item => item.classId === selectedClassId);
      const classTemplates = templates().filter(item => item.classId === selectedClassId);
      const classResources = selected ? resources(selectedClassId) : [];
      let content = '<p class="library-empty">Create a class to keep its assignments and resources together.</p>';
      if (selected && selectedTab === "assignments") {
        content = `<div class="library-subheading"><h3>Assignments</h3>${button("new-class-task", selected.id, "Add assignment", { primary: true, context: "class" })}</div>${classTasks.length ? `<ul class="library-assignment-list">${classTasks.map(item => `<li><button type="button" class="library-assignment-link ${item.completed ? "is-complete" : ""}" data-library-action="open-task" data-library-id="${escapeHtml(item.id)}" data-library-focus="class:task:${escapeHtml(item.id)}"><strong>${escapeHtml(item.title)}</strong><span>${item.completed ? "Completed" : item.dueDate ? `Due ${escapeHtml(item.dueDate)}` : "No deadline"}${item.durationMinutes ? ` · ${Number(item.durationMinutes)} min` : ""}</span></button></li>`).join("")}</ul>` : '<p class="library-empty">No assignments in this class yet.</p>'}<div class="library-subheading"><h3>Reusable templates</h3>${button("new-template", selected.id, "New template", { context: "class" })}</div>${templateCards(classTemplates, "class")}`;
      } else if (selected && selectedTab === "resources") {
        content = `<div class="library-subheading"><h3>Class resources</h3>${button("new-resource", selected.id, "Add resource", { primary: true, context: "class" })}</div>${resourceCards(classResources)}`;
      } else if (selected) {
        const incomplete = classTasks.filter(item => !item.completed).length;
        content = `<h3 class="library-overview-name">${escapeHtml(selected.name)}</h3><dl class="library-overview">${selected.teacher ? `<div><dt>Teacher</dt><dd>${escapeHtml(selected.teacher)}</dd></div>` : ""}${selected.period ? `<div><dt>Period</dt><dd>${escapeHtml(selected.period)}</dd></div>` : ""}<div><dt>Open assignments</dt><dd>${incomplete}</dd></div><div><dt>Completed assignments</dt><dd>${classTasks.length - incomplete}</dd></div><div><dt>Saved templates</dt><dd>${classTemplates.length}</dd></div><div><dt>Resources</dt><dd>${classResources.length}</dd></div></dl>${selected.archived ? '<p class="library-footnote">This class is archived.</p>' : ""}`;
      }
      replace(target, `<section class="library-section" aria-labelledby="library-class-heading"><div class="library-heading"><div><h2 id="library-class-heading">Class library</h2><p>Assignments and useful links, organized by class.</p></div><label class="library-class-picker">Class<select id="library-class-select" data-library-focus="class:select" ${allClasses.length ? "" : "disabled"}>${allClasses.length ? allClasses.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === selectedClassId ? "selected" : ""}>${escapeHtml(item.name)}${item.archived ? " (archived)" : ""}</option>`).join("") : '<option>No classes yet</option>'}</select></label></div>${unavailableNotice()}<div class="library-tabs" role="tablist" aria-label="Class library sections">${["assignments", "resources", "overview"].map(tab => `<button type="button" id="library-tab-${tab}" role="tab" aria-controls="library-class-panel" aria-selected="${selectedTab === tab}" tabindex="${selectedTab === tab ? "0" : "-1"}" data-library-tab="${tab}" data-library-focus="class:tab:${tab}">${tab[0].toUpperCase() + tab.slice(1)}</button>`).join("")}</div><div id="library-class-panel" class="library-tab-panel" role="tabpanel" aria-labelledby="library-tab-${selectedTab}" tabindex="0">${content}</div></section>`);
    }

    function renderTaskResources(classId) {
      taskClassId = classId || null;
      const target = find("#task-class-resources");
      if (!target) return;
      const items = taskClassId ? resources(taskClassId) : [];
      const open = Boolean(target.querySelector("details")?.open);
      target.hidden = !items.length;
      replace(target, items.length ? `<details class="library-task-resources" ${open ? "open" : ""}><summary data-library-focus="task:resources-summary">Resources for ${escapeHtml(className(taskClassId))} <span>${items.length}</span></summary>${resourceCards(items, false)}</details>` : "");
    }

    function render() {
      syncOwner();
      renderTemplates();
      renderClassLibrary();
      renderTaskResources(taskClassId);
    }

    function selectClass(id) {
      selectedClassId = id;
      renderClassLibrary();
    }

    function findTemplate(id) { return templates().find(item => item.id === id); }

    function scheduleTemplate(id, { source = null, date = host.getSelectedDate?.() || "", time = "09:00" } = {}) {
      if (!available()) { host.showToast?.("Templates are not available on this server yet."); return false; }
      const item = findTemplate(id);
      if (!item) { host.showToast?.("That template is no longer available."); return false; }
      host.openTask({ source, draft: templateDraft(item), dueDate: "", scheduledDate: date, scheduledTime: time });
      return true;
    }

    function readTemplateDrop(dataTransfer) {
      try {
        const id = dataTransfer?.getData(TEMPLATE_MIME) || "";
        return activeDrag?.id === id && !isCurrentOwner(activeDrag.owner) ? "" : id;
      } catch { return ""; }
    }

    function handleTemplateDrop(event, { date, time } = {}) {
      const id = readTemplateDrop(event.dataTransfer);
      if (!id) return false;
      event.preventDefault();
      event.stopPropagation();
      return addTemplate(id, { date, time });
    }

    function closeDialog() {
      if (dialogBusy) return;
      const current = dialog;
      if (!current) return;
      current.close();
      current.remove();
      dialog = null;
      const replacement = dialogSourceKey && [...doc.querySelectorAll("[data-library-focus]")].find(item => item.dataset.libraryFocus === dialogSourceKey);
      const fallback = dialogSourceKey.startsWith("calendar") ? find('#calendar-assignment-templates [data-library-action="new-template"]') || find("#calendar-templates-tab") : /^(class|resources):/.test(dialogSourceKey) ? find("#library-class-select") : find('#assignment-templates [data-library-action="new-template"]');
      const source = dialogSource?.isConnected ? dialogSource : replacement || fallback;
      source?.focus({ preventScroll: true });
      dialogSource = null;
      dialogSourceKey = "";
    }

    function classOptions(value, required = false) {
      return `${required ? '<option value="">Choose a class</option>' : '<option value="">No class</option>'}${classes().map(item => `<option value="${escapeHtml(item.id)}" ${item.id === value ? "selected" : ""}>${escapeHtml(item.name)}${item.archived ? " (archived)" : ""}</option>`).join("")}`;
    }

    function openDialog({ kind, item = {}, source, deleting = false, viewing = false }) {
      if (dialogBusy) return;
      if (dialog) closeDialog();
      const isTemplate = kind === "template";
      const noun = isTemplate ? "template" : "resource";
      const heading = viewing ? "Template details" : `${deleting ? "Delete" : item.id ? "Edit" : "New"} ${noun}`;
      dialogSource = source;
      dialogSourceKey = source?.dataset.libraryFocus || "";
      dialog = doc.createElement("dialog");
      dialog.className = "library-dialog";
      dialog.id = "planner-library-dialog";
      dialog.tabIndex = -1;
      dialog.setAttribute("aria-labelledby", "library-dialog-heading");
      dialog.innerHTML = `<form novalidate><div class="library-dialog-heading"><h2 id="library-dialog-heading">${heading}</h2><button type="button" class="close-button" data-library-close aria-label="Close ${noun} editor">×</button></div><p class="library-form-error" role="alert" hidden></p>${deleting ? `<p class="library-delete-copy">Delete <strong>${escapeHtml(item.title)}</strong>? ${isTemplate ? "Tasks already created from it will stay in your plan." : "This removes the saved link. It does not change the linked website."}</p>` : isTemplate ? `<label>Assignment name<input name="title" value="${escapeHtml(item.title)}" maxlength="80" required /></label><div class="library-form-grid"><label>Class<select name="classId">${classOptions(item.classId)}</select></label><label>Duration (minutes)<input name="durationMinutes" type="number" inputmode="numeric" min="5" max="1440" step="1" value="${escapeHtml(item.durationMinutes ?? 45)}" required /></label><label>Priority<select name="priority">${["Medium", "High", "Low"].map(value => `<option ${value === item.priority ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>Deadline reminder<select name="reminderChoice">${[["default", "Use Settings default"], ["off", "No reminder"], ["15", "15 minutes before"], ["60", "1 hour before"], ["1440", "1 day before"]].map(([value, label]) => `<option value="${value}" ${value === (item.reminderChoice || "default") ? "selected" : ""}>${label}</option>`).join("")}</select></label></div><label>Notes <span class="library-optional">Optional</span><textarea name="notes" rows="4" maxlength="5000">${escapeHtml(item.notes)}</textarea></label><p class="library-footnote">Templates have no deadline or work date. Add or schedule a copy whenever you need one.</p>` : `<label>Resource title<input name="title" value="${escapeHtml(item.title)}" maxlength="120" required /></label><label>Link<input name="url" type="url" inputmode="url" value="${escapeHtml(item.url)}" placeholder="https://…" maxlength="2048" required /></label><div class="library-form-grid"><label>Class<select name="classId" required>${classOptions(item.classId || selectedClassId, true)}</select></label><label>Category <span class="library-optional">Optional</span><input name="category" value="${escapeHtml(item.category)}" maxlength="60" placeholder="e.g. Study guide" /></label></div><label>Description <span class="library-optional">Optional</span><textarea name="description" rows="4" maxlength="2000">${escapeHtml(item.description)}</textarea></label><p class="library-footnote">Keep a link to a handout, textbook or study guide for this class.</p>`}<div class="library-dialog-actions"><button type="button" class="secondary-button" data-library-close>Cancel</button><button type="submit" class="${deleting ? "danger-button" : "primary-button"}">${deleting ? "Delete" : "Save " + noun}</button></div></form>`;
      if (viewing) {
        const info = classes().find(value => value.id === item.classId);
        const label = info ? `${info.name}${info.archived ? " (archived)" : ""}` : "No class";
        dialog.innerHTML = `<div class="library-template-detail-content"><div class="library-dialog-heading"><h2 id="library-dialog-heading">${heading}</h2><button type="button" class="close-button" data-library-close aria-label="Close template details">×</button></div><dl class="library-template-detail-list">${templateDetails(item, label).map(([name, value]) => `<div><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl><p class="library-footnote">Each use creates a separate task. This template stays in your library.</p><div class="library-dialog-actions"><button type="button" class="secondary-button" data-library-close>Close</button></div></div>`;
      }
      doc.body.append(dialog);
      const current = dialog;
      const dialogOwner = captureOwner();
      const dismiss = () => { if (isCurrentDialog(current, dialogOwner)) closeDialog(); };
      current.querySelectorAll("[data-library-close]").forEach(control => control.addEventListener("click", dismiss));
      current.addEventListener("cancel", event => { event.preventDefault(); dismiss(); });
      current.addEventListener("keydown", event => {
        if (event.key !== "Tab") return;
        const controls = [...current.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')]
          .filter(control => !control.disabled && !control.hidden && control.getClientRects().length);
        if (!controls.length) { event.preventDefault(); current.focus({ preventScroll: true }); return; }
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!controls.includes(doc.activeElement) || event.shiftKey && doc.activeElement === first || !event.shiftKey && doc.activeElement === last) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus({ preventScroll: true });
        }
      });
      current.addEventListener("click", event => {
        if (event.target !== current) return;
        const bounds = current.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dismiss();
      });
      current.querySelector("form")?.addEventListener("submit", async event => {
        event.preventDefault();
        if (!isCurrentDialog(current, dialogOwner)) { render(); return; }
        if (dialogBusy) return;
        const errorBox = current.querySelector(".library-form-error");
        if (!available()) {
          errorBox.textContent = "Templates and resources are not available on this server yet. Close this editor and try again when they are available.";
          errorBox.hidden = false;
          return;
        }
        errorBox.hidden = true;
        let next;
        try {
          if (!deleting) {
            const values = Object.fromEntries(new FormData(event.currentTarget));
            next = isTemplate ? normalizeTemplate({ ...values, id: item.id }) : normalizeResource({ ...values, id: item.id, sortOrder: item.sortOrder ?? Math.min(resources(values.classId).length, 10000) });
          }
        } catch (error) {
          errorBox.textContent = error.message;
          errorBox.hidden = false;
          current.querySelector(`[name="${error.field}"]`)?.focus();
          return;
        }
        dialogBusy = true;
        current.setAttribute("aria-busy", "true");
        current.querySelectorAll("button,input,select,textarea").forEach(control => { control.disabled = true; });
        current.focus({ preventScroll: true });
        try {
          if (deleting) await (isTemplate ? store.deleteTemplate(item.id) : store.deleteResource(item.id));
          else await (isTemplate ? store.upsertTemplate(next) : store.upsertResource(next));
          if (!isCurrentDialog(current, dialogOwner)) return;
          dialogBusy = false;
          closeDialog();
          render();
          host.showToast?.(`${isTemplate ? "Template" : "Resource"} ${deleting ? "deleted" : "saved"}.`);
        } catch (error) {
          if (!isCurrentDialog(current, dialogOwner)) return;
          errorBox.textContent = error.message || "Could not save. Please try again.";
          errorBox.hidden = false;
          fail(error);
        } finally {
          if (isCurrentDialog(current, dialogOwner)) {
            dialogBusy = false;
            current.removeAttribute("aria-busy");
            current.querySelectorAll("button,input,select,textarea").forEach(control => { control.disabled = false; });
            if (current.isConnected && current.open) current.querySelector('button[type="submit"]')?.focus({ preventScroll: true });
          }
        }
      });
      refreshButtons(current);
      current.showModal();
      (deleting || viewing ? current.querySelector("[data-library-close]") : current.querySelector("input,select"))?.focus();
    }

    async function addTemplate(id, schedule = null) {
      if (pending.has(id) || !available()) return;
      const item = findTemplate(id);
      if (!item) { host.showToast?.("That template is no longer available."); return; }
      const operationOwner = captureOwner();
      pending.set(id, operationOwner);
      render();
      try {
        const task = schedule ? instantiateScheduledTemplate(item, schedule) : instantiateTemplate(item);
        await store.upsertItem(task);
        if (isCurrentOwner(operationOwner)) host.showToast?.(schedule ? "Task scheduled. The template is ready to use again." : "Added a new task. The template is ready to use again.");
        return task;
      } catch (error) { if (isCurrentOwner(operationOwner)) fail(error); }
      finally {
        if (pending.get(id) === operationOwner) pending.delete(id);
        if (isCurrentOwner(operationOwner)) render();
      }
    }

    function onClick(event) {
      const tab = event.target.closest("[data-library-tab]");
      if (tab) { selectedTab = tab.dataset.libraryTab; renderClassLibrary(); find(`#library-tab-${selectedTab}`)?.focus({ preventScroll: true }); return; }
      const control = event.target.closest("[data-library-action]");
      if (!control || control.disabled || control.getAttribute("aria-disabled") === "true") return;
      const { libraryAction: action, libraryId: id } = control.dataset;
      if (action === "template-menu") { openTemplateMenu(control); return; }
      if (organizationAction(action) && !available()) return;
      if (action === "add-template") { addTemplate(id); return; }
      if (action === "schedule-template") { scheduleTemplate(id, { source: control }); return; }
      if (action === "new-class-task") { host.openTask({ source: control, draft: { classId: id, type: "assignment" }, dueDate: "" }); return; }
      if (action === "open-task") {
        const task = store.listItems().find(item => item.id === id);
        if (task) host.openTask({ source: control, id: task.id });
        return;
      }
      if (action.endsWith("template")) {
        const item = action === "new-template" ? { classId: id || null } : findTemplate(id);
        if (item) openDialog({ kind: "template", item, source: control, deleting: action === "delete-template" });
      } else if (action.endsWith("resource")) {
        const item = action === "new-resource" ? { classId: id || selectedClassId } : resources().find(item => item.id === id);
        if (item) openDialog({ kind: "resource", item, source: control, deleting: action === "delete-resource" });
      }
    }

    function onChange(event) {
      if (event.target.id === "library-class-select") selectClass(event.target.value);
    }

    function onKeyDown(event) {
      const tab = event.target.closest("[data-library-tab]");
      if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const tabs = ["assignments", "resources", "overview"];
      const index = tabs.indexOf(selectedTab);
      selectedTab = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[2] : tabs[(index + (event.key === "ArrowRight" ? 1 : 2)) % 3];
      renderClassLibrary();
      find(`#library-tab-${selectedTab}`)?.focus({ preventScroll: true });
    }

    function onDragStart(event) {
      const card = event.target.closest("[data-library-template]");
      if (!card) return;
      if (!available() || pending.has(card.dataset.libraryTemplate) || event.target.closest("button,a,input,select,textarea") || !event.dataTransfer) { event.preventDefault(); return; }
      activeDrag = { id: card.dataset.libraryTemplate, owner: captureOwner() };
      event.dataTransfer.setData(TEMPLATE_MIME, card.dataset.libraryTemplate);
      event.dataTransfer.effectAllowed = "copy";
    }

    function onDragEnd() { activeDrag = null; }

    doc.addEventListener("pointerdown", onOutsideMenuPointer, true);
    doc.addEventListener("scroll", onMenuViewportChange, true);
    doc.defaultView?.addEventListener("resize", onMenuViewportChange);
    doc.addEventListener("click", onClick);
    doc.addEventListener("change", onChange);
    doc.addEventListener("keydown", onKeyDown);
    doc.addEventListener("dragstart", onDragStart);
    doc.addEventListener("dragend", onDragEnd);
    render();
    return {
      render, renderTaskResources, selectClass, scheduleTemplate, handleTemplateDrop, readTemplateDrop, closeTemplateMenu,
      openNewTemplate({ source = null } = {}) {
        if (!available() || destroyed) return false;
        openDialog({ kind: "template", source });
        return true;
      },
      addToTasks: id => addTemplate(id),
      draftForTemplate(id) { const item = available() && findTemplate(id); return item ? templateDraft(item) : null; },
      destroy() {
        destroyed = true;
        ownerGeneration += 1;
        pending.clear();
        closeTemplateMenu();
        detachDialog();
        doc.removeEventListener("pointerdown", onOutsideMenuPointer, true);
        doc.removeEventListener("scroll", onMenuViewportChange, true);
        doc.defaultView?.removeEventListener("resize", onMenuViewportChange);
        doc.removeEventListener("click", onClick);
        doc.removeEventListener("change", onChange);
        doc.removeEventListener("keydown", onKeyDown);
        doc.removeEventListener("dragstart", onDragStart);
        doc.removeEventListener("dragend", onDragEnd);
      },
    };
  }

  return { create, TEMPLATE_MIME, normalizeTemplate, normalizeResource, safeResourceUrl, templateDraft, templateDetails, instantiateTemplate, instantiateScheduledTemplate, escapeHtml };
});
