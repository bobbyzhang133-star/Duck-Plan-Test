/* UI-only focus/target preferences and guided task entry. The task model is unchanged. */
(() => {
  "use strict";
  function readPreference(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; }
  }
  function writePreference(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }
  let focusPreference = readPreference("duckplan-ui-daily-focus", {});
  if (!focusPreference || typeof focusPreference !== "object" || Array.isArray(focusPreference)) focusPreference = {};
  const savedTarget = readPreference("duckplan-ui-daily-target", 3);
  let dailyTarget = Number.isInteger(savedTarget) && savedTarget >= 1 && savedTarget <= 20 ? savedTarget : 3;

  function todaySummary() {
    const today = nowKey();
    const items = tasks.filter((task) => task.dueDate === today || Model.scheduledParts(task)?.date === today);
    const unfinished = items.filter((task) => !task.completed);
    const completed = items.length - unfinished.length;
    return { unfinished, total: items.length, completed, percent: items.length ? Math.round(completed / items.length * 100) : 0 };
  }
  function orderTasks(ordered, today) {
    if (focusPreference.date !== today) return ordered;
    const focus = ordered.find((task) => task.id === focusPreference.id);
    return focus ? [focus, ...ordered.filter((task) => task !== focus)] : ordered;
  }
  function cardMarkup(task, index) {
    let markup = taskCardMarkup(task).replace("data-select-task=", "data-edit-task=");
    if (index !== 0) return markup;
    return markup.replace('class="daily-task-card ', 'class="daily-task-card is-today-focus ')
      .replace('<span class="task-title">', '<span class="focus-label">Today’s focus</span><span class="task-title">')
      .replace('class="task-edit"', 'class="task-edit focus-open"')
      .replace('>•••</button>', '>Open task <span aria-hidden="true">↗</span></button>');
  }
  window.DuckPlanClarity = Object.freeze({ orderTasks, cardMarkup, todaySummary });

  const focusChoice = document.querySelector("#daily-focus-choice");
  const targetInput = document.querySelector("#daily-target-input");
  targetInput.value = String(dailyTarget);
  function renderPlanningOverview() {
    const today = nowKey();
    const groups = Model.groupForDate(tasks, today, today);
    const summary = todaySummary();
    const pending = summary.unfinished;
    const completed = summary.completed;
    const schedule = document.querySelector("#dashboard-schedule-list");
    schedule.innerHTML = groups.scheduled.length ? groups.scheduled.map((task) => {
      const parts = Model.scheduledParts(task);
      return `<button type="button" class="schedule-item" data-edit-task="${task.id}"><span class="schedule-time"><strong>${formatTime(parts.time)}</strong><small>to ${formatTime(Model.scheduledEnd(task))}</small></span><span class="schedule-title"><strong>${safeText(task.title)}</strong><small>${safeText(classInfo(task).name)} · ${task.durationMinutes} min</small></span><span class="schedule-open" aria-hidden="true">↗</span></button>`;
    }).join("") : '<div class="schedule-empty"><p>No work blocks scheduled today.</p><button class="text-link" type="button" data-open-planner="day">Choose a time in the calendar →</button></div>';
    document.querySelector("#daily-target-copy").textContent = `Daily target: ${completed} of ${dailyTarget} tasks`;
    const targetStatus = document.querySelector("#daily-target-status");
    targetStatus.textContent = completed >= dailyTarget ? "Target reached" : `${dailyTarget - completed} to go`;
    targetStatus.classList.toggle("target-reached", completed >= dailyTarget);
    focusChoice.replaceChildren(new Option("Use task priority", ""), ...pending.map((task) => new Option(task.title, task.id)));
    focusChoice.value = focusPreference.date === today && pending.some((task) => task.id === focusPreference.id) ? focusPreference.id : "";
    focusChoice.disabled = pending.length === 0;
    const week = Model.datesForView("week", today);
    const weekTasks = tasks.filter((task) => week.includes(task.dueDate) || week.includes(Model.scheduledParts(task)?.date));
    const done = weekTasks.filter((task) => task.completed).length;
    const upcoming = tasks.filter((task) => !task.completed && task.dueDate > today && week.includes(task.dueDate)).length;
    document.querySelector("#weekly-recap").innerHTML = `<p><strong>${done}</strong><span>of ${weekTasks.length} tasks completed</span></p><p><strong>${upcoming}</strong><span>upcoming deadlines this week</span></p><span class="recap-context">Based on tasks planned this week.</span>`;
  }
  document.addEventListener("planner:dashboard-render", renderPlanningOverview);
  document.querySelector("#daily-target-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!targetInput.reportValidity()) return;
    const value = Number(targetInput.value);
    if (!Number.isInteger(value) || value < 1 || value > 20) return;
    dailyTarget = value;
    const persisted = writePreference("duckplan-ui-daily-target", value);
    renderPlanningOverview();
    document.querySelector("#daily-target-feedback").textContent = persisted ? "Daily target saved in this browser." : "Target set for this session.";
  });
  focusChoice.addEventListener("change", () => {
    focusPreference = { date: nowKey(), id: focusChoice.value };
    writePreference("duckplan-ui-daily-focus", focusPreference);
    document.dispatchEvent(new Event("planner:render"));
  });
  document.addEventListener("click", (event) => {
    const quickAdd = event.target.closest("[data-quick-add]");
    if (quickAdd) openModal({ source: quickAdd, dueDate: nowKey() });
  });

  // Keep the existing form field names and submit handler, adding UI validation before it runs.
  const form = document.querySelector("#task-form");
  const error = document.querySelector("#task-form-error");
  function clearErrors() {
    error.hidden = true;
    for (const field of form.querySelectorAll("input,select")) {
      field.setCustomValidity(""); field.removeAttribute("aria-invalid"); if (field.getAttribute("aria-describedby") === "task-form-error") field.removeAttribute("aria-describedby");
    }
  }
  new MutationObserver(() => {
    if (!els.modal.open) return;
    clearErrors();
    document.querySelector("#task-detail-options").open = Boolean(editingTaskId);
  }).observe(els.modal, { attributes: true, attributeFilter: ["open"] });
  form.addEventListener("input", (event) => {
    if (event.target.matches("input,select")) {
      event.target.setCustomValidity(""); event.target.removeAttribute("aria-invalid");
      error.hidden = true;
    }
  });
  form.addEventListener("submit", (event) => {
    clearErrors();
    if (!form.elements.title.value.trim()) form.elements.title.setCustomValidity("Enter a task name so you can find it later.");
    const date = form.elements.scheduledDate;
    const time = form.elements.scheduledTime;
    if (date.value && !time.value) time.setCustomValidity("Choose a start time for your scheduled work.");
    if (time.value && !date.value) date.setCustomValidity("Choose a work date for your scheduled work.");
    const invalid = [...form.elements].find((field) => field.willValidate && !field.validity.valid);
    if (!invalid) return;
    event.preventDefault(); event.stopImmediatePropagation();
    for (let parent = invalid.parentElement; parent && parent !== form; parent = parent.parentElement) {
      if (parent.tagName === "DETAILS") parent.open = true;
    }
    error.textContent = invalid.validationMessage;
    error.hidden = false;
    invalid.setAttribute("aria-invalid", "true"); invalid.setAttribute("aria-describedby", "task-form-error");
    invalid.focus();
  }, true);

  // Initialize through the same presentation refresh event used by the existing planner.
  document.dispatchEvent(new Event("planner:render"));
})();
