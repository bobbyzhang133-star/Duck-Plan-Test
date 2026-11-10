/* Presentation only: icons, theme preference, and responsive navigation. */
(() => {
  "use strict";
  const paths = {
    home: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    tasks: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
    classes: '<path d="M12 6c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v15"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/>',
    goals: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    notes: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8m-8 4h5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    bell: '<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5Zm5 3h4"/>'
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.querySelector(".nav-icon").innerHTML = icon(button.dataset.view);
  });
  document.querySelectorAll("[data-open-navigation]:not(.sidebar-rail-toggle)").forEach((button) => { button.innerHTML = icon("menu"); });
  document.querySelector("#notification-button").innerHTML = icon("bell");

  const themeControl = document.querySelector("#theme-preference");
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  let theme = "system";
  try { theme = localStorage.getItem("duckplan-ui-theme") || "system"; } catch { /* Storage can be unavailable in private contexts. */ }
  if (!["system", "light", "dark"].includes(theme)) theme = "system";
  const applyTheme = () => {
    const dark = theme === "dark" || (theme === "system" && systemTheme.matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]').content = dark ? "#22221d" : "#FFD93D";
  };
  themeControl.value = theme;
  applyTheme();
  themeControl.addEventListener("change", () => {
    theme = themeControl.value;
    try { localStorage.setItem("duckplan-ui-theme", theme); } catch { /* Keep the current session preference. */ }
    applyTheme();
  });
  systemTheme.addEventListener("change", applyTheme);

  const desktop = window.matchMedia("(min-width: 1001px)");
  desktop.addEventListener("change", () => setSidebar(false));
  setSidebar(false);
  document.querySelectorAll("button[aria-label], a[aria-label]").forEach((control) => {
    if (!control.title) control.title = control.getAttribute("aria-label");
  });

  function openPlanner(view, date = nowKey()) {
    calendarView = view;
    selectDate(date);
    setView("calendar");
  }
  document.addEventListener("click", (event) => {
    const shortcut = event.target.closest("[data-open-planner]");
    if (shortcut) openPlanner(shortcut.dataset.openPlanner, shortcut.dataset.plannerDate || nowKey());
    if (event.target.closest('#view-home [data-go="tasks"]')) {
      document.querySelector('[data-filter="all"]').click();
      els.search.value = "";
      searchTerm = "";
      renderAllTasks();
    }
    if (event.target.closest("[data-open-upcoming]")) {
      setView("tasks");
      document.querySelector('[data-filter="upcoming"]').click();
      els.search.value = "";
      searchTerm = "";
      renderAllTasks();
    }
  });
  document.querySelector("#dashboard-add-task").addEventListener("click", (event) => openModal({ source: event.currentTarget, dueDate: nowKey() }));

  const emptyMessage = (title, copy) => `<div class="compact-empty"><span class="empty-duck" aria-hidden="true">${window.DuckPlanMascot.markup("swimming")}</span><h3>${title}</h3><p>${copy}</p></div>`;
  function renderDashboard() {
    const today = nowKey();
    const groups = Model.groupForDate(tasks, today, today);
    const todayTasks = window.DuckPlanClarity ? window.DuckPlanClarity.todaySummary().unfinished : [...groups.scheduled, ...groups.unscheduled];
    const total = todayTasks.length + groups.completed.length;
    const percent = total ? Math.round(groups.completed.length / total * 100) : 0;
    const high = todayTasks.filter((task) => task.priority === "High").length;
    const identity = PlannerUI.accountIdentity(store.user);
    document.querySelector("#dashboard-date").textContent = formatLongDate(today);
    const hour = new Date().getHours();
    document.querySelector("#dashboard-greeting").textContent = `${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}${identity.signedIn ? `, ${identity.name}` : ""}.`;
    document.querySelector("#dashboard-overview").textContent = todayTasks.length ? `${todayTasks.length} task${todayTasks.length === 1 ? "" : "s"} remaining today. Start with one, then keep going.` : "Your day has some breathing room. Plan something when you’re ready.";
    document.querySelector("#dashboard-task-total").textContent = `${todayTasks.length} remaining`;
    document.querySelector("#dashboard-priority-copy").textContent = high ? `${high} high-priority ${high === 1 ? "task" : "tasks"} first. Everything else can follow.` : "A clear list, one thing at a time.";
    const priorityOrder = { High: 0, Medium: 1, Low: 2 };
    let ordered = [...todayTasks].sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));
    if (window.DuckPlanClarity) ordered = window.DuckPlanClarity.orderTasks(ordered, today);
    document.querySelector("#dashboard-add-task").hidden = ordered.length > 0;
    document.querySelector("#dashboard-task-list").innerHTML = ordered.length ? ordered.map((task, index) => window.DuckPlanClarity ? window.DuckPlanClarity.cardMarkup(task, index) : taskCardMarkup(task).replace("data-select-task=", "data-edit-task=")).join("") : emptyMessage("You’re all caught up for today", "Add a task or enjoy a little space in your day.");
    document.querySelector("#dashboard-completed-label").textContent = `Completed today · ${groups.completed.length}`;
    document.querySelector("#dashboard-completed-list").innerHTML = groups.completed.map((task) => taskCardMarkup(task)).join("") || '<p class="section-helper">Completed tasks will appear here.</p>';
    document.querySelector("#dashboard-percent").textContent = `${percent}%`;
    document.querySelector("#dashboard-progress-copy").textContent = total ? `${groups.completed.length} of ${total} tasks completed today.` : "Your progress will appear when you plan a task.";
    const progress = document.querySelector("#dashboard-progress-bar");
    progress.setAttribute("aria-valuenow", String(percent));
    progress.firstElementChild.style.width = `${percent}%`;
    const overdue = groups.overdue.length;
    const upcoming = tasks.filter((task) => !task.completed && task.dueDate > today).sort((a, b) => `${a.dueDate}${a.dueTime || "99"}`.localeCompare(`${b.dueDate}${b.dueTime || "99"}`)).slice(0, 3);
    const overdueMarkup = overdue ? `<button type="button" class="overdue-notice" data-go="tasks"><span class="status-dot overdue-dot" aria-hidden="true"></span><strong>${overdue} overdue ${overdue === 1 ? "task" : "tasks"}</strong><span>Review →</span></button>` : "";
    document.querySelector("#dashboard-upcoming-list").innerHTML = overdueMarkup + (upcoming.length ? upcoming.map((task) => `<button type="button" class="upcoming-item" data-edit-task="${task.id}"><span class="upcoming-date"><strong>${dateObject(task.dueDate).getDate()}</strong><small>${new Intl.DateTimeFormat(undefined, {month:"short"}).format(dateObject(task.dueDate))}</small></span><span class="upcoming-copy"><strong>${safeText(task.title)}</strong><small>${safeText(classInfo(task).name)} · ${formatTime(task.dueTime)}</small></span><span aria-hidden="true">↗</span></button>`).join("") : '<p class="section-helper">No upcoming deadlines. You have room to plan ahead.</p>');
    const week = Model.datesForView("week", today);
    document.querySelector("#dashboard-week-strip").innerHTML = week.map((date) => {
      const dayTasks = tasks.filter((task) => task.dueDate === date || Model.scheduledParts(task)?.date === date);
      const remaining = dayTasks.filter((task) => !task.completed).length;
      const weekday = new Intl.DateTimeFormat(undefined, {weekday:"short"}).format(dateObject(date));
      const weekend = [0, 6].includes(dateObject(date).getDay());
      return `<button type="button" class="week-preview-day ${date === today ? "is-today" : ""} ${weekend ? "is-weekend" : ""}" data-open-planner="day" data-planner-date="${date}" ${date === today ? 'aria-current="date"' : ""} aria-label="Open ${formatLongDate(date)}: ${remaining} remaining tasks"><span>${weekday}</span><strong>${dateObject(date).getDate()}</strong><span class="week-preview-dots" aria-hidden="true">${dayTasks.slice(0, 3).map((task) => `<i class="${task.completed ? "is-complete" : ""}"></i>`).join("")}</span><small>${remaining ? `${remaining} to do` : dayTasks.length ? "All done" : "No tasks"}</small></button>`;
    }).join("");
    document.dispatchEvent(new Event("planner:dashboard-render"));
  }
  document.addEventListener("planner:render", renderDashboard);
  renderDashboard();

  const goalRange = document.querySelector("#goal-preview-range");
  goalRange.addEventListener("input", () => {
    document.querySelector("#goal-preview-value").textContent = goalRange.value;
    document.querySelector("#goal-preview-bar").style.width = `${Number(goalRange.value) * 20}%`;
  });
  const habitNames = ["Read for 20 minutes", "Plan tomorrow"];
  const weekdays = ["M", "T", "W", "T", "F", "S", "S"];
  document.querySelector("#habit-preview-grid").innerHTML = '<div class="habit-grid-header"><span>Sample habit</span>' + weekdays.map((day) => `<span>${day}</span>`).join("") + '</div>' + habitNames.map((name, habit) => `<div class="habit-grid-row"><span>${name}</span>${weekdays.map((day, index) => `<label><input type="checkbox" ${index < (habit ? 1 : 2) ? "checked" : ""} aria-label="Sample ${name}: ${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][index]}"/><span aria-hidden="true">✓</span></label>`).join("")}</div>`).join("");
  const habitSummary = () => {
    const count = document.querySelectorAll("#habit-preview-grid input:checked").length;
    document.querySelector("#habit-preview-summary").textContent = `${count} of 14 sample check-ins · ${Math.round(count / 14 * 100)}%`;
  };
  document.querySelector("#habit-preview-grid").addEventListener("change", habitSummary);
  habitSummary();

  const noteTitle = document.querySelector("#note-preview-title");
  const noteBody = document.querySelector("#note-preview-body");
  const noteCategory = document.querySelector("#note-preview-category");
  function renderNotePreview() {
    document.querySelector("#note-preview-heading").textContent = noteTitle.value.trim() || "Your next idea";
    document.querySelector("#note-preview-content").textContent = noteBody.value || "A preview of your note will appear here as you write.";
    document.querySelector("#note-preview-tag").textContent = noteCategory.value;
    const words = noteBody.value.trim() ? noteBody.value.trim().split(/\s+/).length : 0;
    document.querySelector("#note-preview-count").textContent = `${words} ${words === 1 ? "word" : "words"}`;
  }
  [noteTitle, noteBody, noteCategory].forEach((field) => field.addEventListener("input", renderNotePreview));
})();
