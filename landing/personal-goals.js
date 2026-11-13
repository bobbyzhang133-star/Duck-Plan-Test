(function personalGoalsFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckPersonalGoals = api;
})(typeof window !== "undefined" ? window : globalThis, function buildPersonalGoals() {
  "use strict";
  const DAYS = [1, 2, 3, 4, 5, 6, 0];
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function invalid(field, message) { return Object.assign(new Error(message), { field }); }
  function limitedText(value, field, maximum, required = false) {
    const result = String(value ?? "").trim();
    if (required && !result) throw invalid(field, `Enter ${field === "title" ? "a name" : "a " + field}.`);
    if (result.length > maximum) throw invalid(field, `${field[0].toUpperCase() + field.slice(1)} must be ${maximum} characters or fewer.`);
    return result;
  }
  function wholeNumber(value, field, minimum, maximum, fallback) {
    const result = Number(value ?? fallback);
    if (!Number.isInteger(result) || result < minimum || result > maximum) throw invalid(field, `${field === "targetCount" ? "Target" : "Progress"} must be a whole number from ${minimum} to ${maximum}.`);
    return result;
  }
  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    if (year < 1) return false;
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(0, 0, 0, 0);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  function dateObject(value) {
    if (!validDate(value)) throw invalid("date", "Choose a valid date.");
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(12, 0, 0, 0);
    return date;
  }
  function dateKey(date) { return `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`; }
  function addDays(value, amount) { const date = dateObject(value); date.setUTCDate(date.getUTCDate() + amount); return dateKey(date); }
  function weekStart(value) { const day = dateObject(value).getUTCDay(); return addDays(value, -((day + 6) % 7)); }
  function weekDates(value) { const start = weekStart(value); return DAYS.map((_, index) => addDays(start, index)); }

  function normalizeGoal(item = {}) {
    const deadlineDate = String(item.deadlineDate || "");
    if (deadlineDate && !validDate(deadlineDate)) throw invalid("deadlineDate", "Choose a valid deadline or leave it blank.");
    return {
      ...(item.id ? { id: String(item.id) } : {}),
      title: limitedText(item.title, "title", 100, true),
      notes: limitedText(item.notes, "notes", 5000),
      targetCount: wholeNumber(item.targetCount, "targetCount", 1, 100000, 5),
      currentCount: wholeNumber(item.currentCount, "currentCount", 0, 100000, 0),
      unit: limitedText(item.unit ?? "sessions", "unit", 30, true),
      deadlineDate,
    };
  }
  function normalizeHabit(item = {}) {
    const repeatDays = item.repeatDays ?? [...DAYS];
    if (!Array.isArray(repeatDays) || !repeatDays.length || repeatDays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw invalid("repeatDays", "Choose at least one day of the week.");
    return {
      ...(item.id ? { id: String(item.id) } : {}),
      title: limitedText(item.title, "title", 100, true),
      notes: limitedText(item.notes, "notes", 2000),
      repeatDays: [...new Set(repeatDays)].sort((a, b) => a - b),
    };
  }
  function goalProgress(goal) {
    const target = Number(goal.targetCount), current = Number(goal.currentCount);
    const percent = target > 0 && Number.isFinite(current) ? Math.max(0, Math.min(100, Math.round(current / target * 100))) : 0;
    return { percent, remaining: Math.max(0, target - current), reached: target > 0 && current >= target };
  }
  function canCheckIn(habit, date, today) {
    return validDate(date) && validDate(today) && date <= today && habit.repeatDays.includes(dateObject(date).getUTCDay());
  }
  function habitWeekSummary(habit, checkins, date, today) {
    const plannedDates = weekDates(date).filter(day => canCheckIn(habit, day, today));
    const saved = new Map(checkins.filter(item => item.habitId === habit.id).map(item => [item.date, Boolean(item.completed)]));
    return { planned: plannedDates.length, completed: plannedDates.filter(day => saved.get(day)).length };
  }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }

  function create(host) {
    const mount = typeof host.root === "string" ? document.querySelector(host.root) : host.root;
    if (!mount) throw new Error("Goals and habits need a page container.");
    const doc = mount.ownerDocument;
    const win = doc.defaultView;
    const store = host.store;
    const today = () => host.getToday();
    const ownerKey = () => `${store.mode}:${store.user?.id || "local"}`;
    let currentOwner = ownerKey(), generation = 0, destroyed = false;
    let observedToday = today();
    let selectedWeek = weekStart(today());
    let dialog = null;
    let checkinError = "";
    const pending = new Map();
    const available = () => store.supportsPersonal !== false;
    const captureOwner = () => ({ key: currentOwner, generation });
    const activeOwner = owner => !destroyed && owner.key === currentOwner && owner.key === ownerKey() && owner.generation === generation;
    const activeDialog = state => state === dialog && activeOwner(state.owner);
    const motion = () => win.DuckPopupMotion;
    const button = (action, id, label, primary = false) => `<button type="button" class="${primary ? "primary-button" : "secondary-button"} pg-button" data-pg-action="${action}" data-pg-id="${escapeHtml(id)}" data-pg-focus="${action}:${escapeHtml(id)}" ${!available() ? "disabled" : ""}>${label}</button>`;
    const formatDate = (value, options = {}) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC", ...options }).format(dateObject(value));

    function report(error) { if (host.reportError) host.reportError(error); else host.showToast?.(error.message || "Could not save. Please try again."); }
    function forceClose() {
      const state = dialog;
      dialog = null;
      if (!state) return;
      motion()?.cancel?.(state.element);
      if (state.element.open) state.element.close();
      state.element.remove();
    }
    function syncOwner() {
      const next = ownerKey();
      if (next === currentOwner) return;
      currentOwner = next; generation += 1;
      forceClose(); pending.clear(); checkinError = "";
      selectedWeek = weekStart(today());
      observedToday = today();
    }
    function restoreFocus(state) {
      if (!activeOwner(state.owner) || dialog) return;
      const replacement = [...mount.querySelectorAll("[data-pg-focus]")].find(item => item.dataset.pgFocus === state.focusKey);
      const source = state.source?.isConnected ? state.source : replacement || mount.querySelector("[data-pg-action]");
      source?.focus({ preventScroll: true });
    }
    function closeDialog(state = dialog, { restore = true, afterClose } = {}) {
      if (!state || !activeDialog(state) || state.busy || state.closing) return;
      state.closing = true; state.element.inert = true;
      const finish = () => {
        if (!activeDialog(state)) return;
        if (state.element.open) state.element.close();
        state.element.remove(); dialog = null;
        afterClose?.();
        if (restore) restoreFocus(state);
      };
      if (motion()?.close && state.anchor) motion().close(state.element, state.anchor, finish);
      else finish();
    }
    function makeDialog(title, content, source) {
      syncOwner();
      if (!available() || destroyed) { host.showToast?.("Goals and habits are not available on this server yet."); return null; }
      if (dialog?.busy) return null;
      forceClose();
      const element = doc.createElement("dialog");
      element.id = "personal-goals-dialog"; element.className = "pg-dialog"; element.tabIndex = -1;
      element.setAttribute("aria-labelledby", "pg-dialog-title");
      element.innerHTML = `<div class="pg-dialog-heading"><h2 id="pg-dialog-title">${title}</h2><button type="button" class="close-button" data-pg-close aria-label="Close">×</button></div>${content}`;
      const state = dialog = { element, source, focusKey: source?.dataset.pgFocus || "", owner: captureOwner(), busy: false, closing: false, anchor: source && motion()?.capture ? motion().capture(source) : null };
      doc.body.append(element);
      const dismiss = () => closeDialog(state);
      element.querySelectorAll("[data-pg-close]").forEach(control => control.addEventListener("click", dismiss));
      element.addEventListener("cancel", event => { event.preventDefault(); dismiss(); });
      element.addEventListener("click", event => {
        if (event.target !== element) return;
        const box = element.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dismiss();
      });
      element.addEventListener("keydown", event => {
        if (event.key !== "Tab" || state.closing) return;
        const controls = [...element.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter(control => !control.disabled && control.getClientRects().length);
        if (!controls.length) { event.preventDefault(); element.focus({ preventScroll: true }); return; }
        if (!controls.includes(doc.activeElement) || event.shiftKey && doc.activeElement === controls[0] || !event.shiftKey && doc.activeElement === controls.at(-1)) {
          event.preventDefault(); (event.shiftKey ? controls.at(-1) : controls[0]).focus({ preventScroll: true });
        }
      });
      host.setupButtons?.(element);
      element.showModal();
      const focus = () => {
        if (activeDialog(state) && !state.closing) (state.busy ? element : element.querySelector("input,textarea,[data-pg-choice]") || element.querySelector("button"))?.focus({ preventScroll: true });
      };
      if (motion()?.open && state.anchor) motion().open(element, state.anchor, focus); else focus();
      return state;
    }
    function showFormError(state, error) {
      const target = state.element.querySelector(".pg-form-error");
      target.textContent = error.message || "Could not save. Please try again.";
      target.hidden = false;
    }
    function handleSubmit(state, read, save, success) {
      state.element.querySelector("form").addEventListener("submit", async event => {
        event.preventDefault();
        if (!activeDialog(state) || state.busy || state.closing) return;
        if (!available()) { showFormError(state, new Error("Goals and habits are not available on this server yet.")); return; }
        state.element.querySelector(".pg-form-error").hidden = true;
        let item;
        try { item = read(new FormData(event.currentTarget)); }
        catch (error) {
          showFormError(state, error);
          state.element.querySelector(`[name="${error.field}"]`)?.focus();
          return;
        }
        state.busy = true; state.element.setAttribute("aria-busy", "true");
        state.element.querySelectorAll("button,input,select,textarea").forEach(control => { control.disabled = true; });
        state.element.focus({ preventScroll: true });
        try {
          await save(item);
          if (!activeDialog(state)) return;
          state.busy = false;
          closeDialog(state, { afterClose: () => { render(); host.showToast?.(success); } });
        } catch (error) {
          if (!activeDialog(state)) return;
          showFormError(state, error); report(error);
        } finally {
          if (activeDialog(state) && !state.closing) {
            state.busy = false; state.element.removeAttribute("aria-busy");
            state.element.querySelectorAll("button,input,select,textarea").forEach(control => { control.disabled = false; });
            state.element.querySelector('button[type="submit"]')?.focus({ preventScroll: true });
          }
        }
      });
    }
    const actions = label => `<p class="pg-form-error" role="alert" hidden></p><div class="pg-dialog-actions"><button type="button" class="secondary-button" data-pg-close>Cancel</button><button type="submit" class="primary-button">${label}</button></div>`;

    function openGoal({ id, source } = {}) {
      syncOwner();
      const item = id ? store.listGoals().find(goal => goal.id === id) : {};
      if (!item) { host.showToast?.("That goal is no longer available."); return; }
      const state = makeDialog(id ? "Edit goal" : "Add goal", `<form novalidate>
        <label>Goal name<input name="title" required maxlength="100" value="${escapeHtml(item.title)}" placeholder="e.g. Finish five study sessions" /></label>
        <div class="pg-form-grid"><label>Target<input name="targetCount" type="number" inputmode="numeric" min="1" max="100000" step="1" value="${escapeHtml(item.targetCount ?? 5)}" required /></label><label>Progress so far<input name="currentCount" type="number" inputmode="numeric" min="0" max="100000" step="1" value="${escapeHtml(item.currentCount ?? 0)}" required /></label><label>Unit<input name="unit" maxlength="30" value="${escapeHtml(item.unit ?? "sessions")}" placeholder="e.g. sessions, pages" required /></label><label>Deadline <span class="pg-optional">Optional</span><input name="deadlineDate" type="date" value="${escapeHtml(item.deadlineDate)}" /></label></div>
        <label>Notes <span class="pg-optional">Optional</span><textarea name="notes" maxlength="5000" rows="4">${escapeHtml(item.notes)}</textarea></label><p class="pg-help">Update your count as you make progress toward this goal.</p>${actions("Save goal")}</form>`, source);
      if (state) handleSubmit(state, data => normalizeGoal({ ...Object.fromEntries(data), id }), goal => store.upsertGoal(goal), "Goal saved.");
    }
    function openHabit({ id, source } = {}) {
      syncOwner();
      const item = id ? store.listHabits().find(habit => habit.id === id) : {};
      if (!item) { host.showToast?.("That habit is no longer available."); return; }
      const selected = item.repeatDays || DAYS;
      const state = makeDialog(id ? "Edit habit" : "Add habit", `<form novalidate>
        <label>Habit name<input name="title" required maxlength="100" value="${escapeHtml(item.title)}" placeholder="e.g. Read for 20 minutes" /></label>
        <fieldset class="pg-repeat"><legend>Repeat on</legend><div class="pg-repeat-days">${DAYS.map(day => `<label><input name="repeatDays" type="checkbox" value="${day}" ${selected.includes(day) ? "checked" : ""} /><span>${DAY_NAMES[day].slice(0, 3)}</span><span class="pg-sr-only">${DAY_NAMES[day]}</span></label>`).join("")}</div></fieldset>
        <label>Notes <span class="pg-optional">Optional</span><textarea name="notes" maxlength="2000" rows="4">${escapeHtml(item.notes)}</textarea></label><p class="pg-help">Check in on your chosen days. Dates follow your device’s local calendar.</p>${actions("Save habit")}</form>`, source);
      if (state) handleSubmit(state, data => normalizeHabit({ id, title: data.get("title"), notes: data.get("notes"), repeatDays: data.getAll("repeatDays").map(Number) }), habit => store.upsertHabit(habit), "Habit saved.");
    }
    function openAddChooser({ source } = {}) {
      const state = makeDialog("What would you like to add?", `<div class="pg-add-choices"><button type="button" class="pg-add-choice" data-pg-choice="goal"><strong>Add goal</strong><span>Work toward a measurable target.</span></button><button type="button" class="pg-add-choice" data-pg-choice="habit"><strong>Add habit</strong><span>Build a routine on chosen days.</span></button></div>`, source);
      state?.element.querySelectorAll("[data-pg-choice]").forEach(control => control.addEventListener("click", () => closeDialog(state, { restore: false, afterClose: () => control.dataset.pgChoice === "goal" ? openGoal({ source }) : openHabit({ source }) })));
    }
    function confirmDelete(kind, id, source) {
      const item = (kind === "goal" ? store.listGoals() : store.listHabits()).find(row => row.id === id);
      if (!item) return;
      const state = makeDialog(`Delete ${kind}`, `<form novalidate><p class="pg-delete-copy">Delete <strong>${escapeHtml(item.title)}</strong> and its ${kind === "goal" ? "progress" : "saved check-ins"}?</p>${actions(`Delete ${kind}`)}</form>`, source);
      if (state) {
        state.element.querySelector('button[type="submit"]').className = "danger-button";
        handleSubmit(state, () => id, value => kind === "goal" ? store.deleteGoal(value) : store.deleteHabit(value), `${kind === "goal" ? "Goal" : "Habit"} deleted.`);
      }
    }

    function goalMarkup(goal) {
      const progress = goalProgress(goal);
      const overdue = goal.deadlineDate && goal.deadlineDate < today() && !progress.reached;
      return `<article class="pg-goal-card"><div class="pg-card-heading"><h3>${escapeHtml(goal.title)}</h3>${progress.reached ? '<span class="pg-reached">Reached</span>' : ""}</div>
        <p class="pg-goal-count"><strong>${Number(goal.currentCount).toLocaleString()}</strong><span>of ${Number(goal.targetCount).toLocaleString()} ${escapeHtml(goal.unit)}</span></p>
        <div class="pg-progress-track" role="progressbar" aria-label="${escapeHtml(goal.title)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}" aria-valuetext="${Number(goal.currentCount)} of ${Number(goal.targetCount)} ${escapeHtml(goal.unit)}"><span style="width:${progress.percent}%"></span></div>
        ${goal.deadlineDate ? `<p class="pg-deadline ${overdue ? "is-overdue" : ""}">Due ${formatDate(goal.deadlineDate, { year: "numeric" })}${overdue ? " · Overdue" : ""}</p>` : '<p class="pg-help">No deadline</p>'}
        ${goal.notes ? `<details class="pg-card-notes" data-pg-notes="goal:${escapeHtml(goal.id)}"><summary data-pg-focus="goal-notes:${escapeHtml(goal.id)}">Notes</summary><p>${escapeHtml(goal.notes)}</p></details>` : ""}
        <div class="pg-card-actions">${button("edit-goal", goal.id, "Update progress")}${button("delete-goal", goal.id, "Delete")}</div></article>`;
    }
    function habitMarkup(habit, dates, checkins) {
      const summary = habitWeekSummary(habit, checkins, selectedWeek, today());
      const saved = new Map(checkins.filter(item => item.habitId === habit.id).map(item => [item.date, Boolean(item.completed)]));
      return `<article class="pg-habit-card"><div class="pg-card-heading"><h3>${escapeHtml(habit.title)}</h3></div>
        ${habit.notes ? `<details class="pg-card-notes" data-pg-notes="habit:${escapeHtml(habit.id)}"><summary data-pg-focus="habit-notes:${escapeHtml(habit.id)}">Notes</summary><p>${escapeHtml(habit.notes)}</p></details>` : ""}
        <div class="pg-habit-days" role="group" aria-label="${escapeHtml(habit.title)} weekly check-ins">${dates.map(date => {
          const scheduled = habit.repeatDays.includes(dateObject(date).getUTCDay());
          const future = date > today();
          const complete = scheduled && !future && Boolean(saved.get(date));
          const key = `${habit.id}:${date}`;
          const label = `${habit.title}, ${formatDate(date, { weekday: "long", year: "numeric" })}: ${!scheduled ? "not scheduled" : future ? "future date" : complete ? "completed, select to undo" : "not completed, select to check in"}`;
          return `<button type="button" class="pg-checkin${date === today() ? " is-today" : ""}${complete ? " is-complete" : ""}" data-pg-action="checkin" data-pg-id="${escapeHtml(habit.id)}" data-pg-date="${date}" data-pg-focus="checkin:${escapeHtml(key)}" aria-label="${escapeHtml(label)}" aria-pressed="${complete}" ${!scheduled || future || !available() ? "disabled" : ""} ${pending.has(key) ? 'aria-disabled="true" aria-busy="true"' : ""}><span>${DAY_NAMES[dateObject(date).getUTCDay()].slice(0, 3)}</span><strong>${Number(date.slice(-2))}</strong><span class="pg-check-symbol" aria-hidden="true">${complete ? "✓" : scheduled ? "○" : "–"}</span></button>`;
        }).join("")}</div><p class="pg-week-summary">${summary.planned ? `${summary.completed} of ${summary.planned} planned check-ins${selectedWeek === weekStart(today()) ? " so far this week" : " this week"}` : "No check-ins planned up to today."}</p><div class="pg-card-actions">${button("edit-habit", habit.id, "Edit habit")}${button("delete-habit", habit.id, "Delete")}</div></article>`;
    }
    function render() {
      if (destroyed) return;
      syncOwner();
      if (observedToday !== today()) {
        if (selectedWeek === weekStart(observedToday)) selectedWeek = weekStart(today());
        observedToday = today();
      }
      const focused = mount.contains(doc.activeElement) ? doc.activeElement.dataset.pgFocus : "";
      const openNotes = new Set([...mount.querySelectorAll("[data-pg-notes][open]")].map(item => item.dataset.pgNotes));
      const goals = store.listGoals(), habits = store.listHabits(), checkins = store.listHabitCheckins();
      const dates = weekDates(selectedWeek);
      mount.innerHTML = `${!available() ? '<p class="pg-unavailable" role="status">Saved goals and habits are not available on this server yet. Your local data stays safe on this device.</p>' : ""}<div class="pg-dashboard">
        <section class="pg-panel" aria-labelledby="pg-goals-heading"><div class="pg-section-heading"><div><h2 id="pg-goals-heading">Goals</h2><p>Choose a target. Track your progress.</p></div>${button("add-goal", "", "Add goal", true)}</div><div class="pg-goal-list">${goals.length ? goals.map(goalMarkup).join("") : '<div class="pg-empty"><h3>What would you like to work toward?</h3><p>Add a goal with a target you can measure.</p></div>'}</div></section>
        <section class="pg-panel" aria-labelledby="pg-habits-heading"><div class="pg-section-heading"><div><h2 id="pg-habits-heading">Habits</h2><p>Small routines, one day at a time.</p></div>${button("add-habit", "", "Add habit", true)}</div><div class="pg-week-toolbar"><button type="button" class="secondary-button" data-pg-action="previous-week" data-pg-focus="previous-week" aria-label="Previous week">‹</button><div><strong>${formatDate(dates[0])}–${formatDate(dates[6], { year: "numeric" })}</strong><button type="button" class="pg-current-week" data-pg-action="current-week" data-pg-focus="current-week">This week</button></div><button type="button" class="secondary-button" data-pg-action="next-week" data-pg-focus="next-week" aria-label="Next week" ${selectedWeek >= weekStart(today()) ? "disabled" : ""}>›</button></div>${checkinError ? `<p class="pg-inline-error" role="alert">${escapeHtml(checkinError)}</p>` : ""}<div class="pg-habit-list">${habits.length ? habits.map(habit => habitMarkup(habit, dates, checkins)).join("") : '<div class="pg-empty"><h3>Start with one small habit</h3><p>Add a routine and choose which days to practice it.</p></div>'}</div></section></div>`;
      for (const disclosure of mount.querySelectorAll("[data-pg-notes]")) disclosure.open = openNotes.has(disclosure.dataset.pgNotes);
      host.setupButtons?.(mount);
      if (focused && !dialog?.element.open) [...mount.querySelectorAll("[data-pg-focus]")].find(item => item.dataset.pgFocus === focused)?.focus({ preventScroll: true });
    }
    async function toggleCheckin(id, date) {
      const habit = store.listHabits().find(item => item.id === id);
      const key = `${id}:${date}`;
      if (!habit || !available() || !canCheckIn(habit, date, today()) || pending.has(key)) return;
      const owner = captureOwner();
      const completed = !store.listHabitCheckins({ habitId: id }).some(item => item.date === date && item.completed);
      pending.set(key, owner); checkinError = ""; render();
      try {
        await store.setHabitCheckin(id, date, completed);
        if (activeOwner(owner)) host.showToast?.(completed ? "Check-in saved." : "Check-in removed.");
      } catch (error) {
        if (activeOwner(owner)) { checkinError = error.message || "Could not save this check-in. Try again."; report(error); }
      } finally {
        if (pending.get(key) === owner) pending.delete(key);
        if (activeOwner(owner)) render();
      }
    }
    function onClick(event) {
      const control = event.target.closest("[data-pg-action]");
      if (!control || !mount.contains(control) || control.disabled || control.getAttribute("aria-disabled") === "true") return;
      const { pgAction: action, pgId: id } = control.dataset;
      if (action === "add-goal" || action === "edit-goal") openGoal({ id: id || undefined, source: control });
      else if (action === "add-habit" || action === "edit-habit") openHabit({ id: id || undefined, source: control });
      else if (action === "delete-goal" || action === "delete-habit") confirmDelete(action === "delete-goal" ? "goal" : "habit", id, control);
      else if (action === "checkin") toggleCheckin(id, control.dataset.pgDate);
      else {
        if (action === "previous-week") selectedWeek = addDays(selectedWeek, -7);
        if (action === "next-week") selectedWeek = addDays(selectedWeek, 7);
        if (action === "current-week") selectedWeek = weekStart(today());
        render();
      }
    }
    mount.addEventListener("click", onClick);
    render();
    return { render, openGoal, openHabit, openAddChooser, destroy() { destroyed = true; generation += 1; pending.clear(); forceClose(); mount.removeEventListener("click", onClick); } };
  }
  return { create, normalizeGoal, normalizeHabit, goalProgress, validDate, addDays, weekStart, weekDates, canCheckIn, habitWeekSummary };
});
