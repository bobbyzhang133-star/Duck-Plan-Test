const Model = window.DuckPlannerModel;
const PlannerUI = window.DuckPlannerUI;
const CALENDAR_START_HOUR = PlannerUI.TIMELINE_START_HOUR;
const CALENDAR_END_HOUR = PlannerUI.TIMELINE_END_HOUR;
const CALENDAR_HOURS = CALENDAR_END_HOUR - CALENDAR_START_HOUR;
const CALENDAR_COMPACT_BLOCK_HEIGHT = 48;
const ReminderDomain = window.DuckReminderDomain;
const ReminderLedger = window.DuckReminderLedger;
const BrowserNotifications = window.DuckBrowserNotifications;
const DEFAULT_CLASSES = [
  { id: "calculus", name: "Calculus", color: "#538fc5", code: "M", teacher: "Ms. Nguyen", period: "Period 2" },
  { id: "english", name: "English", color: "#d96f63", code: "E", teacher: "Mr. Ramirez", period: "Period 4" },
  { id: "physics", name: "Physics", color: "#7d6fbd", code: "P", teacher: "Dr. Shah", period: "Period 5" },
  { id: "computer-science", name: "Computer Science", color: "#3e946d", code: "CS", teacher: "Ms. Chen", period: "Period 7" },
  { id: "personal", name: "Personal", color: "#d2a31f", code: "★", teacher: "Personal", period: "Anytime" },
];
const nowKey = () => Model.todayKey();
const relativeDate = (amount) => Model.addDays(nowKey(), amount);
const schedule = (dayOffset, time) => `${relativeDate(dayOffset)}T${time}`;
const defaultTasks = () => [
  { id: "calculus-practice", title: "Finish calculus practice set", classId: "calculus", dueDate: relativeDate(0), dueTime: "17:00", scheduledStart: schedule(0, "15:30"), durationMinutes: 60, priority: "High", completed: false },
  { id: "english-response", title: "Submit reading response", classId: "english", dueDate: relativeDate(0), dueTime: "20:00", scheduledStart: null, durationMinutes: 45, priority: "Medium", completed: false },
  { id: "physics-notes", title: "Organize lab notes", classId: "physics", dueDate: relativeDate(1), dueTime: "09:00", scheduledStart: schedule(1, "07:45"), durationMinutes: 45, priority: "Medium", completed: false },
  { id: "cs-wireframe", title: "Review app wireframe", classId: "computer-science", dueDate: relativeDate(2), dueTime: "14:15", scheduledStart: schedule(1, "16:00"), durationMinutes: 60, priority: "Low", completed: false },
  { id: "english-vocab", title: "Study vocabulary cards", classId: "english", dueDate: relativeDate(3), dueTime: "16:00", scheduledStart: null, durationMinutes: 30, priority: "Medium", completed: false },
  { id: "physics-quiz", title: "Complete motion quiz", classId: "physics", dueDate: relativeDate(-1), dueTime: "12:30", scheduledStart: null, durationMinutes: 45, priority: "High", completed: false },
  { id: "backpack", title: "Pack materials for Monday", classId: "personal", dueDate: relativeDate(0), dueTime: "20:00", scheduledStart: null, durationMinutes: 30, priority: "Low", completed: true },
];
const completionDemo = window.DuckCompletionDemo?.configure({ location, storage: localStorage, cloud: window.DUCKPLAN_CLOUD || {} });
const store = window.DuckPlannerStore.createPlannerStore({
  storage: completionDemo?.storage || localStorage,
  model: Model,
  defaultClasses: () => DEFAULT_CLASSES,
  defaultTasks: completionDemo?.enabled ? () => [] : defaultTasks,
  config: window.DUCKPLAN_CLOUD || {},
  redirectPath: location.pathname,
});
let tasks = [];
let renderedPlannerOwner = "local";
let plannerOwnerVersion = 0;
let overdueCompletion = null;
const REMINDER_KEY = "duckplan-deadline-reminders-v1";
const reminderSettings = loadReminderSettings();
const reminderLedger = ReminderLedger.createLedger({ storage: localStorage });
const reminderToggle = document.querySelector("#reminders-enabled");
const reminderLead = document.querySelector("#reminder-lead");
const reminderList = document.querySelector("#reminder-list");
const reminderEmpty = document.querySelector("#reminders-empty");
const notificationPermissionStatus = document.querySelector("#notification-permission-status");
const notificationPermissionButton = document.querySelector("#enable-device-notifications");
const notificationPermissionHelp = document.querySelector("#notification-permission-help");
reminderToggle.checked = reminderSettings.enabled;
reminderLead.value = String(reminderSettings.lead);
let selectedDate = nowKey();
const phonePlannerQuery = window.matchMedia("(max-width: 700px), (max-width: 960px) and (max-height: 500px) and (pointer: coarse)");
let calendarView = phonePlannerQuery.matches ? "day" : "week";
let currentFilter = "all";
let searchTerm = "";
let selectedTaskId = null;
let editingTaskId = null;
let pendingTaskDraft = null;
let taskLayout = "list";
let axisStatus = { connected: false, lastSyncedAt: null, lastError: null };
let localImportCount = 0;
let accountStateVersion = 0;
let collapsed = { overdue: false, scheduled: false, backlog: false, unscheduled: false, completed: true };
let taskGrouping = "plan";
const collapsedTaskGroups = new Set();
let foldCompletedAfterFinish = false;
let toastTimer;
let notificationConstructorFailed = false;
let observedToday = nowKey();
let calendarFocusSlot = { date: selectedDate, time: "09:00" };
let calendarUserScrolled = false;
let calendarProgrammaticScroll = false;
let calendarDrag = null;
let templateDrag = null;
let suppressCalendarEventClickUntil = 0;
let taskAlertPreferences = null;
let taskAlertEditorVersion = 0;
let taskAlertHydration = Promise.resolve();
let taskAlertHydrationError = null;
let workAlertContextReady = false;
const expandedDeadlineDates = new Set();
const taskAlertTimeChanges = new Set();
const taskAlertTouchedFields = new Set();
const workAlerts = window.DuckWorkAlertController.create({
  store, alarms: window.DuckTaskAlarms, notifications: window.DuckTaskNotifications,
  timeZone: () => ReminderDomain.browserTimeZone(), storage: localStorage,
  onError: reportError,
  onForeground: task => {
    showToast(`Time to start: ${task.title}`);
    displayBrowserNotification({ title: task.title, options: {
      body: "It's time to start this task.", tag: `work:${store.user?.id || "local"}:${task.id}`,
      data: { taskId: task.id, view: "calendar" },
    } }, task.id).catch(reportError);
  },
});

function saveTaskWithAlerts(task) { return workAlerts.save(task); }

const els = {
  navItems: [...document.querySelectorAll("[data-view]")],
  views: [...document.querySelectorAll(".view")],
  pageTitle: document.querySelector("#page-title"), pageEyebrow: document.querySelector("#page-eyebrow"),
  taskCount: document.querySelector("#task-count"), search: document.querySelector("#global-search"),
  allList: document.querySelector("#all-task-list"), taskEmpty: document.querySelector("#task-empty"),
  classGrid: document.querySelector("#class-grid"), calendar: document.querySelector("#planner-calendar"),
  calendarRange: document.querySelector("#calendar-range"), modal: document.querySelector("#task-modal"),
  phoneWeekStrip: document.querySelector("#phone-week-strip"),
  phoneTaskSummary: document.querySelector("#phone-task-summary"),
  phoneTaskSummaryCopy: document.querySelector("#phone-task-summary-copy"),
  calendarPanel: document.querySelector(".calendar-main-panel"),
  phoneNavigation: document.querySelector(".phone-bottom-nav"),
  form: document.querySelector("#task-form"), modalTitle: document.querySelector("#modal-title"),
  modalKicker: document.querySelector("#modal-kicker"), deleteTask: document.querySelector("#delete-task"),
  saveTask: document.querySelector("#save-task"), toast: document.querySelector("#toast"),
  toastMessage: document.querySelector("#toast-message"), toastAction: document.querySelector("#toast-action"),
  calendarStatus: document.querySelector("#calendar-status"), taskPanel: document.querySelector("#daily-task-panel"),
  taskPanelToggle: document.querySelector("#toggle-task-panel"), taskPanelScrim: document.querySelector(".task-panel-scrim"),
  accountSettings: document.querySelector("#account-settings"), axisSettings: document.querySelector("#axis-settings"),
  syncCopy: document.querySelector(".sync-copy"), syncInfo: document.querySelector("#sync-info"), resetDemo: document.querySelector("#reset-demo"),
  selectedDayLabel: document.querySelector("#selected-day-label"), selectedDateHeading: document.querySelector("#selected-date-heading"),
  dailyProgressCopy: document.querySelector("#daily-progress-copy"), completionPercent: document.querySelector("#completion-percent"),
  completionRing: document.querySelector("#completion-ring"), dailyEmpty: document.querySelector("#daily-empty"),
  dailyPanelDate: document.querySelector("#daily-panel-date"), dailyPanelProgress: document.querySelector("#daily-panel-progress"),
  lists: {
    overdue: document.querySelector("#overdue-task-list"), scheduled: document.querySelector("#scheduled-task-list"),
    backlog: document.querySelector("#backlog-task-list"),
    unscheduled: document.querySelector("#unscheduled-task-list"), completed: document.querySelector("#completed-task-list"),
  },
  counts: {
    overdue: document.querySelector("#overdue-count"), scheduled: document.querySelector("#scheduled-count"),
    backlog: document.querySelector("#backlog-count"),
    unscheduled: document.querySelector("#unscheduled-count"), completed: document.querySelector("#completed-count"),
  },
};

const calendarViewport = window.DuckCalendarViewport?.create({ calendar: els.calendar });

const calendarDates = window.DuckCalendarDatePresentation.create({
  model: Model, classInfo, safeText, formatTime, formatLongDate, nowKey,
  selectedTaskId: () => selectedTaskId,
});
const calendarTaskPreview = window.DuckCalendarTaskPreview.create({
  store, model: Model, classInfo, formatLongDate, formatShortDate, formatTime,
  getOwnerVersion: () => plannerOwnerVersion,
  getView: () => document.body.dataset.view || "calendar",
  getDeadlineGroup: (key, date) => calendarDates.timedDeadlineGroups(tasks, date).find(group => group.key === key),
  onSelectTask: id => { if (selectedTaskId !== id) selectTask(id); },
  openTask: options => openModal(options), showToast, reportError,
  setupButtons: setupButtonMaterial, motion: window.DuckPopupMotion,
});

const taskLibrary = window.DuckPlanLibrary?.create({
  store, getSelectedDate: () => selectedDate, showToast, reportError,
  setupButtons: setupButtonMaterial,
  onTaskAdded: revealAddedTask,
  saveTask: saveTaskWithAlerts,
  openTask: (options) => openModal({ ...options, id: options.id || options.task?.id || null }),
});
const calendarLibraryTabs = window.DuckCalendarLibraryTabs?.create({
  getOwner: () => `${store.mode}:${store.user?.id || "local"}`,
  onChange: () => {
    window.DuckTaskCompletion?.cancel();
    taskLibrary?.closeTemplateMenu?.();
    updatePrimaryAction(document.body.dataset.view || "calendar");
  },
});
const taskMatrix = window.DuckTaskMatrix?.create({
  store, getToday: nowKey, showToast, reportError,
  setupButtons: setupButtonMaterial, openTask: openModal,
});
const personalGoals = window.DuckPersonalGoals?.create({
  store, root: document.querySelector("#personal-goals-root"), getToday: nowKey,
  showToast, reportError, setupButtons: setupButtonMaterial,
});
const personalNotes = window.DuckPersonalNotes?.create({
  store, root: document.querySelector("#personal-notes-root"),
  showToast, reportError, setupButtons: setupButtonMaterial,
});
let classEditor = null;

const sidebarToggles = [...document.querySelectorAll("[data-open-navigation]")];
const sidebarScrim = document.querySelector(".sidebar-scrim");
const sidebar = document.querySelector(".sidebar");
const workspace = document.querySelector(".workspace");
const viewTransitions = window.DuckViewTransitions.create({
  window, workspace,
  order: [...sidebar.querySelectorAll(".nav-item[data-view]")].map((item) => item.dataset.view),
  getOwner: () => `${store.mode}:${store.user?.id || "local"}`,
});
const taskListDrag = window.DuckTaskListDrag?.create({
  window, document,
  getOwner: () => `${store.mode}:${store.user?.id || "local"}`,
  getTask: id => store.listItems().find(task => task.id === id && !task.completed),
  getPlacement: (event, task) => {
    if (!event.target.closest("#planner-calendar")) return null;
    const placement = templateCalendarPlacement(event, task);
    return placement ? { ...placement, pointerX: event.clientX, pointerY: event.clientY } : null;
  },
  showPreview: (task, placement) => {
    if (!templateDrag) beginCalendarDropPreview(task);
    syncCalendarDropPreview(task);
    updateTemplatePreview({ target: placement.source, clientX: placement.pointerX, clientY: placement.pointerY });
  },
  showFreePreview: (task, event) => {
    if (!templateDrag) beginCalendarDropPreview(task, event);
    syncCalendarDropPreview(task);
    updateTemplatePreview(event);
  },
  clearPreview: clearTemplateDrag,
  schedule: scheduleListTask,
  openCalendar: () => {
    if (document.body.dataset.view !== "calendar") setView("calendar", true);
    setTaskPanel(false, false);
  },
});
const compactPlannerQuery = window.matchMedia("(max-width: 1000px)");
let taskPanelLauncher = null;

function setSidebar(open) {
  viewTransitions.settle();
  const wasOpen = document.body.classList.contains("sidebar-open");
  document.body.classList.toggle("sidebar-open", open);
  sidebar.inert = false;
  sidebar.setAttribute("aria-hidden", "false");
  workspace.inert = false;
  sidebarScrim.hidden = true;
  const profile = sidebar.querySelector(".profile-card");
  profile.inert = !open;
  profile.setAttribute("aria-hidden", String(!open));
  sidebarToggles.forEach((toggle) => toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation"));
  sidebarScrim.tabIndex = -1;
  const railToggle = sidebar.querySelector(".sidebar-rail-toggle");
  railToggle.title = open ? "Fold navigation" : "Expand navigation";
  railToggle.querySelector("[data-sidebar-glyph]").textContent = open ? "‹" : "›";
  sidebarToggles.forEach((toggle) => toggle.setAttribute("aria-expanded", String(open)));
  if (open) document.querySelector(".sidebar .nav-item.active")?.focus({ preventScroll: true });
  else if (wasOpen) railToggle.focus({ preventScroll: true });
  requestAnimationFrame(() => setupButtonMaterial());
}


function setTaskPanel(open, moveFocus = true, source = null) {
  if (!open) window.DuckTaskCompletion?.cancel();
  const phone = phonePlannerQuery.matches;
  const compact = phone || (compactPlannerQuery.matches && !document.body.classList.contains("motion-preview"));
  const wasOpen = document.body.classList.contains("task-panel-open");
  const nextOpen = compact && open;
  if (!nextOpen) taskLibrary?.closeTemplateMenu?.();
  if (nextOpen && !wasOpen) taskPanelLauncher = source || document.activeElement;
  document.body.classList.toggle("task-panel-open", nextOpen);
  els.taskPanelToggle.setAttribute("aria-expanded", String(nextOpen));
  els.phoneTaskSummary?.setAttribute("aria-expanded", String(nextOpen));
  // Keep the phone backdrop mounted so its opacity can animate in both directions.
  els.taskPanelScrim.hidden = phone ? false : !nextOpen;
  els.taskPanelScrim.inert = !nextOpen;
  els.taskPanelScrim.tabIndex = -1;
  els.taskPanelScrim.setAttribute("aria-hidden", "true");
  if (els.calendarPanel) els.calendarPanel.inert = phone && nextOpen;
  if (els.phoneNavigation) els.phoneNavigation.inert = phone && nextOpen;
  if (phone) {
    els.taskPanel.setAttribute("role", "dialog");
    els.taskPanel.setAttribute("aria-modal", "true");
  } else {
    els.taskPanel.removeAttribute("role");
    els.taskPanel.removeAttribute("aria-modal");
  }
  if (compact) {
    els.taskPanel.inert = !nextOpen;
    els.taskPanel.setAttribute("aria-hidden", String(!nextOpen));
  } else {
    els.taskPanel.inert = false;
    els.taskPanel.removeAttribute("aria-hidden");
  }
  if (moveFocus && compact && nextOpen) document.querySelector("[data-close-task-panel]")?.focus({ preventScroll: true });
  else if (moveFocus && compact && !nextOpen && wasOpen) {
    const fallback = phone ? els.phoneTaskSummary : els.taskPanelToggle;
    const target = taskPanelLauncher?.isConnected ? taskPanelLauncher : fallback;
    target?.focus({ preventScroll: true });
  }
}

function loadReminderSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(REMINDER_KEY));
    return {
      enabled: saved?.enabled === true,
      lead: [15, 60, 1440].includes(saved?.lead) ? saved.lead : 60,
    };
  } catch {
    return { enabled: false, lead: 60 };
  }
}

function saveReminderSettings() {
  localStorage.setItem(REMINDER_KEY, JSON.stringify(reminderSettings));
}

function notificationCapability() {
  return BrowserNotifications.capability(window.Notification, {
    isSecureContext: window.isSecureContext,
    constructorFailed: notificationConstructorFailed,
    serviceWorkerAvailable: Boolean(window.DuckPlanApp?.serviceWorkerSupported),
  });
}

function updateNotificationPermission() {
  const state = notificationCapability();
  const copy = BrowserNotifications.settingsCopy(state);
  notificationPermissionStatus.textContent = copy.label;
  notificationPermissionStatus.dataset.state = state;
  notificationPermissionButton.textContent = copy.action;
  notificationPermissionButton.disabled = copy.disabled;
  notificationPermissionHelp.textContent = state === "granted"
    ? "DuckPlan can submit alerts through the installed app while it remains open or backgrounded. Browser acceptance does not confirm that your device displayed one."
    : state === "granted-unusable"
      ? "Permission is allowed, but this browser cannot use DuckPlan's open-page delivery method. In-app reminders still work."
    : state === "denied"
      ? "Allow notifications for this site in your browser settings, then return to DuckPlan. In-app reminders still work."
      : state === "unsupported"
        ? "This browser cannot create DuckPlan device notifications; in-app reminders still work."
        : "Your browser will ask before DuckPlan can notify you.";
  return state;
}

function focusReminderTask(task) {
  requestAnimationFrame(() => {
    const card = [...document.querySelectorAll("[data-task-card]")]
      .find((item) => item.dataset.taskCard === String(task.id));
    if (!card) {
      els.calendarStatus.textContent = `${task.title} is selected, but its task card is not available in this view.`;
      return;
    }
    card.tabIndex = -1;
    card.scrollIntoView({ block: "center", inline: "nearest" });
    card.focus({ preventScroll: true });
    els.calendarStatus.textContent = `${task.title} selected from a deadline reminder.`;
  });
}

function revealAddedTask(task) {
  if (document.body.dataset.view !== "calendar") return;
  const current = store.listItems().find(item => item.id === task.id && !item.completed);
  if (!current) return;
  tasks = store.listItems();
  selectTask(current.id);
  calendarLibraryTabs?.select("tasks");
  setTaskPanel(true, false);
  const control = [...els.lists.backlog.querySelectorAll(".task-select")]
    .find(item => item.dataset.editTask === String(current.id));
  if (!control) return;
  const panel = els.taskPanel, row = control.getBoundingClientRect(), frame = panel.getBoundingClientRect();
  panel.scrollTop += row.top - frame.top - Math.max(0, (panel.clientHeight - row.height) / 2);
  control.focus({ preventScroll: true });
  els.calendarStatus.textContent = `${current.title} added to Unscheduled.`;
}

function openNotificationTarget(taskId = null, view = "settings") {
  window.focus();
  if (taskId) {
    const target = BrowserNotifications.resolveTaskTarget(tasks, taskId);
    if (target.status === "found") {
      selectedTaskId = target.task.id;
      if (target.date) selectedDate = target.date;
      setView("calendar");
      setTaskPanel(true, false);
      renderAll({ autoScrollCalendar: true });
      focusReminderTask(target.task);
      return;
    }
    setView("settings");
    document.querySelector("#reminders-heading").focus();
    showToast("That reminder's task is no longer available.");
    return;
  }
  setView(view);
  if (view === "settings") document.querySelector("#reminders-heading").focus();
}

async function displayBrowserNotification(payload, taskId = null) {
  if (notificationCapability() !== "granted") return { status: "unavailable" };
  const registration = await window.DuckPlanApp?.ready?.catch(() => null);
  const result = await BrowserNotifications.submitNotification(window.Notification, payload, { registration });
  if (result.status !== "submitted") {
    notificationConstructorFailed = true;
    updateNotificationPermission();
    return result;
  }
  if (result.notification) result.notification.onclick = () => {
    openNotificationTarget(taskId, payload.options?.data?.view || "settings");
    result.notification.close();
  };
  return result;
}

function notifyForTask(task, occurrence) {
  const icon = new URL("./assets/duckplan-sigma-icon-v11-transparent-512.png", location.href).href;
  return displayBrowserNotification(
    BrowserNotifications.taskNotification({ ...task, className: classInfo(task).name }, occurrence, { icon }),
    task.id,
  );
}

window.addEventListener("duckplan:notification-open", (event) => {
  if (event.detail?.scope && event.detail.scope !== (store.user?.id || "local")) return;
  openNotificationTarget(event.detail?.taskId || null, event.detail?.view || "home");
});

const taskReminderChoices = ["default", "off", "15", "60", "1440"];

function taskReminderLead(choice) {
  if (choice === "off") return null;
  if (choice && taskReminderChoices.includes(choice) && choice !== "default") return Number(choice);
  return reminderSettings.enabled ? reminderSettings.lead : null;
}

function reminderOccurrences(now = Date.now()) {
  const timeZone = ReminderDomain.browserTimeZone();
  return tasks.map((task) => {
    const lead = taskReminderLead(task.reminderChoice);
    const occurrence = ReminderDomain.calculateOccurrence({
      taskId: task.id,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      leadMinutes: lead,
      enabled: lead !== null,
      completed: task.completed,
      deleted: task.deleted === true,
      evaluationTime: now,
      timeZone,
    });
    return { task, occurrence };
  }).sort((left, right) => (left.occurrence.deadlineAt || Infinity) - (right.occurrence.deadlineAt || Infinity));
}

async function announceReminders(dueSoon, now) {
  if (!dueSoon.length || els.modal.open) return;
  const claimed = (await Promise.all(dueSoon.map(async (entry) => ({
    ...entry,
    token: await reminderLedger.claim(entry.occurrence.occurrenceId, now, { forceRetry: !document.hidden }),
  })))).filter((entry) => entry.token);
  if (!claimed.length) return;

  if (!document.hidden) {
    showToast(claimed.length === 1
      ? `${claimed[0].occurrence.status === "missed" ? "Missed reminder" : "Due soon"}: ${claimed[0].task.title}`
      : `${claimed.length} deadline reminders are ready. Check Settings for details.`);
    await Promise.all(claimed.map((entry) => reminderLedger.finish(
      entry.occurrence.occurrenceId,
      entry.token,
      "acknowledged",
      { channel: "in-app" },
      now,
    )));
    return;
  }

  await Promise.all(claimed.map(async (entry) => {
    const result = await notifyForTask(entry.task, entry.occurrence);
    if (result.status === "submitted") {
      await reminderLedger.finish(entry.occurrence.occurrenceId, entry.token, "submitted", { channel: "browser" }, now);
    } else {
      await reminderLedger.finish(entry.occurrence.occurrenceId, entry.token, "failed", { channel: "browser", reason: result.reason || result.status }, now);
    }
  }));
}

function refreshReminders({ announce = false, now = Date.now() } = {}) {
  const occurrences = reminderOccurrences(now);
  const activeIds = occurrences
    .filter(({ occurrence }) => ["pending", "due", "missed"].includes(occurrence.status))
    .map(({ occurrence }) => occurrence.occurrenceId);
  reminderLedger.prune(activeIds, now);
  const dueSoon = occurrences.filter(({ occurrence }) => occurrence.eligible);
  reminderLead.disabled = !reminderSettings.enabled;
  reminderEmpty.textContent = dueSoon.length
    ? "Active open-page reminders"
    : "No tasks are currently inside their reminder window.";
  reminderList.replaceChildren(...dueSoon.map(({ task, occurrence }) => {
    const item = document.createElement("li");
    const due = new Date(occurrence.deadlineAt).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    item.textContent = `${occurrence.status === "missed" ? "Missed reminder · " : ""}${task.title} · Due ${due}`;
    return item;
  }));
  if (announce) void announceReminders(dueSoon, now);
}

function classInfo(task) { return store.classById(task.classId); }
function reportError(error) { console.error(error); showToast(error.message || "Something went wrong. Try again."); }
function safeText(value) { const span = document.createElement("span"); span.textContent = value ?? ""; return span.innerHTML; }
function safeAttribute(value) { return safeText(value).replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function dateObject(value) { return Model.fromDateKey(value); }
function formatLongDate(value) { return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(dateObject(value)); }
function formatShortDate(value) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(dateObject(value)); }
function formatTime(value) {
  if (!value) return "Anytime";
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2020, 0, 1, hour, minute));
}
function dayRelationship(value) {
  if (value === nowKey()) return "Today";
  if (value === Model.addDays(nowKey(), 1)) return "Tomorrow";
  if (value === Model.addDays(nowKey(), -1)) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(dateObject(value));
}
function taskScheduleText(task) {
  const parts = Model.scheduledParts(task);
  const end = Model.scheduledEndAt(task);
  return parts ? `${formatTime(parts.time)}–${formatTime(end?.slice(11, 16) || Model.scheduledEnd(task))}${end && end.slice(0, 10) !== parts.date ? ` (${formatShortDate(end.slice(0, 10))})` : ""}` : "Not scheduled";
}

function taskCardDateText(value, { relative = false } = {}) {
  const date = dateObject(value);
  if (!date || !Number.isFinite(date.getTime()) || Model.toDateKey(date) !== value) return "Date unavailable";
  if (relative && value === nowKey()) return "Today";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", ...(value.slice(0, 4) !== nowKey().slice(0, 4) ? { year: "numeric" } : {}) }).format(date);
}

function taskDateIcon(kind) {
  const drawing = kind === "due"
    ? '<rect x="2" y="3.5" width="12" height="10.5" rx="2"/><path d="M5 2v3M11 2v3M2 7h12"/>'
    : '<circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/>';
  return `<svg class="task-date-icon" aria-hidden="true" focusable="false" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${drawing}</svg>`;
}

function taskDateMarkup(task, { showDue = true } = {}) {
  const timing = Model.taskTiming(task);
  const scheduled = Model.scheduledParts(task);
  const dueTime = task.dueTime ? /^([01]\d|2[0-3]):[0-5]\d$/.test(task.dueTime) ? formatTime(task.dueTime) : "Time unavailable" : "End of day";
  const due = task.dueDate ? `${taskCardDateText(task.dueDate)} · ${dueTime}` : "No deadline";
  const work = scheduled ? `${taskCardDateText(scheduled.date, { relative: true })} · ${taskScheduleText(task)}` : "Not scheduled";
  const showWork = Boolean(scheduled || !showDue || !task.dueDate);
  const warningIcon = '<svg class="task-status-icon" aria-hidden="true" focusable="false" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2 14 13H2L8 2Z"/><path d="M8 6v3M8 11h.01"/></svg>';
  return `<span class="task-date-stack">${showDue ? `<span class="task-date-line task-date-due"${task.dueDate ? " data-has-deadline" : ""}>${taskDateIcon("due")}<span class="task-date-label">Due</span><span class="task-date-value">${safeText(due)}</span></span>` : ""}${showWork ? `<span class="task-date-line task-date-work">${taskDateIcon("work")}<span class="task-date-label">Work</span><span class="task-date-value">${safeText(work)}</span></span>` : ""}</span>${timing.overdue || timing.plannedAfterDeadline ? `<span class="task-timing-badges">${timing.overdue ? `<span class="task-overdue-label">${warningIcon}Past deadline</span>` : ""}${timing.plannedAfterDeadline ? `<span class="task-plan-warning">${warningIcon}Work after deadline</span>` : ""}</span>` : ""}`;
}

function taskRescheduleMarkup(task) {
  return Model.taskTiming(task).plannedAfterDeadline
    ? `<button class="text-link task-reschedule" type="button" data-button-icon="calendar-plus" data-reschedule-task="${safeAttribute(task.id)}" aria-label="Reschedule work for ${safeAttribute(task.title)}">Reschedule work</button>` : "";
}

function priorityBadge(task) {
  const priority = ["High", "Medium", "Low"].includes(task.priority) ? task.priority : "Medium";
  return `<span class="priority-tag priority-${priority.toLowerCase()}">${priority}</span>`;
}

function taskStatusTone(task, timing = Model.taskTiming(task)) {
  if (task.completed) return "completed";
  if (timing.overdue) return "overdue";
  if (Model.scheduledParts(task)) return "scheduled";
  return task.dueDate === nowKey() ? "due" : "neutral";
}

function taskCardMarkup(task, mode = "daily") {
  const info = classInfo(task);
  const timing = Model.taskTiming(task);
  return `<article class="daily-task-card ${task.completed ? "completed" : ""} ${task.id === selectedTaskId ? "selected" : ""}${timing.overdue ? " is-overdue" : ""}${timing.plannedAfterDeadline ? " is-work-after-deadline" : ""}" style="--course-color:${info.color};--course-soft:${info.soft}" data-task-card="${safeAttribute(task.id)}" data-task-tone="${taskStatusTone(task, timing)}">
    <input class="task-check" type="checkbox" data-task-id="${safeAttribute(task.id)}" ${task.completed ? "checked" : ""} aria-label="Mark ${safeAttribute(task.title)} complete" />
    <button class="task-select" type="button" data-edit-task="${safeAttribute(task.id)}" ${task.completed ? "" : `draggable="true" data-drag-task="${safeAttribute(task.id)}"`} aria-describedby="task-scheduling-instructions"><span class="task-title">${safeText(task.title)}</span><span class="task-meta"><span class="category-tag"><span class="course-dot"></span>${safeText(info.name)}</span>${priorityBadge(task)}${Number.isInteger(task.actualMinutes) ? ` · ${task.actualMinutes} min spent` : ""}</span>${taskDateMarkup(task)}</button>
    <button class="task-edit" type="button" data-edit-task="${safeAttribute(task.id)}" aria-label="Edit ${safeAttribute(task.title)}">•••</button>
    ${taskRescheduleMarkup(task)}
  </article>`;
}

function unfinishedOverdueTasks() {
  return store.listItems().filter(task => !task.deleted && !task.deleted_at && Model.taskTiming(task).overdue);
}

function renderOverdueActions() {
  const count = unfinishedOverdueTasks().length;
  document.querySelectorAll("[data-complete-overdue]").forEach(button => {
    button.hidden = count === 0 && !overdueCompletion;
    button.disabled = Boolean(overdueCompletion) || count === 0;
    button.textContent = overdueCompletion ? "Completing overdue…" : "Complete all overdue";
    button.setAttribute("aria-busy", String(Boolean(overdueCompletion)));
    button.setAttribute("aria-label", `Complete all ${count} overdue ${count === 1 ? "task" : "tasks"}`);
    button.title = "Complete all unfinished tasks whose deadlines have passed, across all dates and classes.";
  });
}

async function completeAllOverdue(source) {
  if (overdueCompletion) return;
  const ids = [...new Set(unfinishedOverdueTasks().map(task => task.id))];
  if (!ids.length) { renderOverdueActions(); return; }
  const owner = `${store.mode}:${store.user?.id || "local"}`, ownerVersion = plannerOwnerVersion;
  const currentOwner = () => ownerVersion === plannerOwnerVersion && owner === `${store.mode}:${store.user?.id || "local"}`;
  const operation = overdueCompletion = {};
  let completed = 0;
  renderOverdueActions();
  try {
    // Use the normal persisted completion path, one request at a time. Recheck
    // each original task so a moved deadline or account switch cannot broaden it.
    for (const id of ids) {
      if (!currentOwner()) return;
      if (!unfinishedOverdueTasks().some(task => task.id === id)) continue;
      await store.toggleComplete(id, true);
      completed += 1;
    }
    if (currentOwner()) showToast(`Completed ${completed} overdue ${completed === 1 ? "task" : "tasks"}.`, { duration: 5000 });
  } catch (error) {
    if (currentOwner()) reportError(new Error(`Completed ${completed} overdue ${completed === 1 ? "task" : "tasks"} before stopping. ${error.message || "Could not save the next task."} Remaining tasks are still open; try again.`));
  } finally {
    if (overdueCompletion === operation) overdueCompletion = null;
    renderOverdueActions();
    if (currentOwner() && source?.isConnected && source.hidden && document.activeElement === source) {
      (source.closest("#overdue-section")?.querySelector("[data-collapse]") || document.querySelector('[data-filter="all"]'))?.focus({ preventScroll: true });
    }
  }
}

function renderDailyPlan() {
  window.DuckExpansionMotion?.settleWithin(els.taskPanel);
  renderOverdueActions();
  const groups = Model.groupForDate(tasks, selectedDate, nowKey());
  const todayItems = tasks.filter(task => task.dueDate === selectedDate || Model.scheduledParts(task)?.date === selectedDate);
  const completed = todayItems.filter((task) => task.completed).length;
  const percent = todayItems.length ? Math.round((completed / todayItems.length) * 100) : 0;
  els.selectedDayLabel.textContent = dayRelationship(selectedDate);
  document.querySelector("#daily-plan-heading").textContent = dayRelationship(selectedDate);
  els.selectedDateHeading.textContent = formatLongDate(selectedDate);
  els.dailyProgressCopy.textContent = todayItems.length ? `${completed} of ${todayItems.length} tasks completed` : "No tasks planned yet";
  els.dailyPanelDate.textContent = formatLongDate(selectedDate);
  els.dailyPanelProgress.textContent = todayItems.length ? `${completed} of ${todayItems.length} completed` : "No tasks planned yet";
  const categoryProgress = document.querySelector("#task-category-progress");
  categoryProgress.setAttribute("aria-valuenow", String(percent));
  categoryProgress.setAttribute("aria-valuetext", `${completed} of ${todayItems.length} tasks completed`);
  categoryProgress.querySelector("span").style.width = `${percent}%`;
  const remaining = new Set([...groups.overdue, ...groups.scheduled, ...groups.unscheduled, ...groups.backlog].map((task) => task.id)).size;
  const overdueCount = [...groups.overdue, ...groups.scheduled, ...groups.unscheduled].filter(task => Model.taskTiming(task).overdue).length;
  if (els.phoneTaskSummaryCopy) els.phoneTaskSummaryCopy.textContent = `${remaining} remaining${overdueCount ? ` · ${overdueCount} overdue` : ""}${groups.backlog.length ? ` · ${groups.backlog.length} unscheduled` : ""}`;
  if (els.phoneTaskSummary) els.phoneTaskSummary.setAttribute("aria-label", `Open tasks for ${formatLongDate(selectedDate)}, ${remaining} remaining`);
  els.taskPanelToggle.textContent = phonePlannerQuery.matches ? `Tasks (${remaining})` : "Tasks";
  els.completionPercent.textContent = `${percent}%`;
  els.completionRing.style.setProperty("--completion", `${percent * 3.6}deg`);
  for (const name of Object.keys(els.lists)) {
    els.counts[name].textContent = groups[name].length;
    els.lists[name].innerHTML = groups[name].map((task) => taskCardMarkup(task, ["scheduled", "backlog"].includes(name) ? name : "daily")).join("");
    els.lists[name].hidden = collapsed[name] || groups[name].length === 0;
    els.lists[name].closest(".task-section").classList.toggle("is-empty", groups[name].length === 0);
  }
  els.dailyEmpty.hidden = groups.overdue.length + todayItems.length + groups.backlog.length > 0;
  document.querySelectorAll("[data-collapse]").forEach((button) => {
    button.setAttribute("aria-expanded", String(!collapsed[button.dataset.collapse]));
    button.closest(".task-section").classList.toggle("collapsed", collapsed[button.dataset.collapse]);
  });
  document.dispatchEvent(new Event("planner:render"));
}

function allTaskMarkup(task) {
  const info = classInfo(task);
  const timing = Model.taskTiming(task);
  return `<article class="all-task-row ${task.completed ? "completed" : ""}${timing.overdue ? " is-overdue" : ""}${timing.plannedAfterDeadline ? " is-work-after-deadline" : ""}" style="--course-color:${info.color};--course-soft:${info.soft}" data-task-tone="${taskStatusTone(task, timing)}">
    <input class="task-check" type="checkbox" data-task-id="${safeAttribute(task.id)}" ${task.completed ? "checked" : ""} aria-label="Mark ${safeAttribute(task.title)} complete" />
    <button class="task-select" type="button" data-edit-task="${safeAttribute(task.id)}" ${task.completed ? "" : `draggable="true" data-drag-task="${safeAttribute(task.id)}"`} aria-describedby="task-scheduling-instructions"><span class="task-title">${safeText(task.title)}</span><span class="task-meta"><span class="category-tag"><span class="course-dot"></span>${safeText(info.name)}</span>${task.axisMissing ? " · No longer in Axis" : ""}${priorityBadge(task)}${Number.isInteger(task.actualMinutes) ? ` · ${task.actualMinutes} min spent` : ""}</span>${taskDateMarkup(task, { showDue: false })}</button>
    <span class="task-due"${task.dueDate ? " data-has-deadline" : ""}><strong>${task.dueDate ? formatShortDate(task.dueDate) : "No due date"}</strong><small>${task.dueDate ? task.dueTime ? formatTime(task.dueTime) : "End of day" : ""}</small></span>
    <button class="task-edit" type="button" data-edit-task="${safeAttribute(task.id)}" aria-label="Edit ${safeAttribute(task.title)}">•••</button>
    ${taskRescheduleMarkup(task)}
  </article>`;
}
function renderAllTasks() {
  window.DuckExpansionMotion?.settleWithin(els.allList);
  const sorted = [...tasks].sort((a, b) => `${a.dueDate || "9999"}${a.dueTime || "99"}`.localeCompare(`${b.dueDate || "9999"}${b.dueTime || "99"}`));
  const searched = sorted.filter(task => !searchTerm || `${task.title} ${classInfo(task).name}`.toLowerCase().includes(searchTerm));
  const matches = (task, filter) => {
    const workDate = Model.scheduledParts(task)?.date;
    if (filter === "today") return (task.dueDate === nowKey() || workDate === nowKey()) && !task.completed;
    if (filter === "upcoming") return (task.dueDate > nowKey() || workDate > nowKey()) && !task.completed;
    if (filter === "done") return task.completed;
    return !task.completed;
  };
  const filtered = searched.filter(task => matches(task, currentFilter));
  document.querySelectorAll("[data-task-filter-count]").forEach(element => {
    element.textContent = searched.filter(task => matches(task, element.dataset.taskFilterCount)).length;
  });
  const groups = window.DuckTaskListGroups.groupTasks(filtered, {
    mode: taskGrouping, today: nowKey(), isOverdue: task => Model.taskTiming(task).overdue, classInfo
  });
  els.allList.innerHTML = groups.map((group, index) => {
    const key = `${taskGrouping}:${group.key}`, open = !collapsedTaskGroups.has(key), id = `task-browser-group-${index}`;
    return `<section class="task-section task-browser-group" data-category-tone="${group.tone}"><button class="task-section-heading" type="button" data-task-group-toggle="${safeAttribute(key)}" aria-expanded="${open}" aria-controls="${id}"><span><span class="status-dot"></span>${safeText(group.label)}</span><strong>${group.tasks.length}</strong></button><div class="daily-task-list" id="${id}" ${open ? "" : "hidden"}>${group.tasks.map(allTaskMarkup).join("")}</div></section>`;
  }).join("");
  const groupingLabels = { plan: "plan", class: "class", priority: "priority" };
  document.querySelector("#task-category-summary").textContent = `${filtered.length} ${currentFilter === "done" ? "completed" : "active"} ${filtered.length === 1 ? "task" : "tasks"}${taskLayout === "list" ? ` · Grouped by ${groupingLabels[taskGrouping]}` : ""}`;
  document.querySelector("#task-group-control").hidden = taskLayout !== "list";
  els.allList.hidden = taskLayout !== "list";
  els.taskEmpty.hidden = taskLayout !== "list" || filtered.length > 0;
  const matrixRoot = document.querySelector("#task-matrix-root");
  matrixRoot.hidden = taskLayout !== "matrix";
  if (taskLayout === "matrix") taskMatrix?.render(filtered.filter((task) => currentFilter === "done" || !task.completed));
  document.querySelectorAll("[data-task-layout]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.taskLayout === taskLayout)));
  els.taskCount.textContent = tasks.filter((task) => !task.completed).length;
}

function renderClasses() {
  els.classGrid.innerHTML = store.listClasses().map((info) => {
    const classTasks = tasks.filter((task) => task.classId === info.id);
    const open = classTasks.filter((task) => !task.completed).length;
    const details = [info.teacher, info.period].filter(Boolean).join(" · ") || (info.axisKey ? "Imported from Axis" : "Class details");
    return `<article class="class-card" style="--course-color:${info.color};--course-soft:${info.soft}"><div class="class-card-head"><span class="class-card-icon">${safeText(info.code)}</span></div><h2>${safeText(info.name)}</h2><p>${safeText(details)}</p><div class="class-stats"><div><strong>${open}</strong><span>Open tasks</span></div><div><strong>${classTasks.length}</strong><span>Total items</span></div></div><button class="class-resources-button" type="button" data-open-class="${info.id}">Assignments &amp; resources</button></article>`;
  }).join("");
}

function renderClassOptions() {
  const select = els.form.elements.classId;
  const current = select.value;
  select.innerHTML = `${store.listClasses({ includeArchived: true }).map((info) => `<option value="${info.id}">${safeText(info.name)}${info.archived ? " (archived)" : ""}</option>`).join("")}<option value="">No class</option>`;
  select.value = current;
}

function relativeSyncTime(value) {
  if (!value) return "Not synced yet";
  const minutes = Math.round((Date.now() - Date.parse(value)) / 60000);
  if (minutes < 1) return "Synced just now";
  if (minutes < 60) return `Synced ${minutes} min ago`;
  return `Synced ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value))}`;
}
function replaceSettings(container, markup) {
  container.innerHTML = markup;
  setupButtonMaterial(container);
}
let accountMode = "sign-in";
let shownRecoveryCode = null;
let accountPanelAnimation = null;
function settleAccountPanelHeight() { accountPanelAnimation?.cancel(); accountPanelAnimation = null; }
window.addEventListener("resize", settleAccountPanelHeight);
matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", settleAccountPanelHeight);
const passwordInput = (name, label, autocomplete) => `<label><span>${label}</span><input name="${name}" type="password" required minlength="8" maxlength="200" autocomplete="${autocomplete}" placeholder="${autocomplete === "new-password" ? "At least 8 characters" : "Your password"}" /></label>`;
const emailInput = `<label><span>Email address</span><input name="email" type="email" required autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="you@school.org" /></label>`;
const connectionFeedback = `<p class="connection-feedback" data-connection-feedback role="alert" hidden></p>`;
const accountPanel = (name, content, active) => `<div class="account-form-panel" data-account-panel="${name}" ${active === name ? "" : "hidden"}>${content}</div>`;
function accountHeading(title, copy, signedIn = false) {
  return `<header class="connection-card-heading"><span class="connection-card-symbol account-symbol" aria-hidden="true"><img src="./assets/duckplan-sigma-head-v11-transparent.png" alt="" /></span><div><p class="connection-eyebrow">Your DuckPlan account</p><h2 id="account-heading">${title}</h2><p>${copy}</p></div>${signedIn ? '<span class="connection-badge">Signed in</span>' : ""}</header>`;
}
function signedOutAccount() {
  const mode = ["sign-up", "recover"].includes(accountMode) ? accountMode : "sign-in";
  const googleReady = store.configured && store.providers.google;
  const googleHelp = !store.configured ? "Sign-in is available in the online planner." : googleReady ? "Use your Google account, or continue with email." : "Google sign-in isn’t available on this preview yet. You can use email below.";
  const signIn = `<form class="settings-form account-form" id="sign-in-form">${emailInput}${passwordInput("password", "Password", "current-password")}<div class="account-form-tools"><button type="button" class="connection-text-button" id="show-recover">Forgot password?</button></div><button type="submit" class="secondary-button connection-primary" data-action="sign-in" data-button-icon="login" data-pending-label="Signing in…">Sign in</button></form>`;
  const signUp = `<form class="settings-form account-form" id="sign-up-form">${emailInput}${passwordInput("password", "Create a password", "new-password")}<p class="connection-note">Use at least 8 characters. You’ll receive a recovery code to save after creating your account.</p><button type="submit" class="secondary-button connection-primary" data-action="sign-up" data-button-icon="plus" data-pending-label="Creating account…">Create account</button></form>`;
  const recover = `<form class="settings-form account-form" id="recover-form"><div class="account-form-intro"><h3>Reset your password</h3><p>Enter the recovery code you saved when you created your account.</p></div>${emailInput}<label><span>Recovery code</span><input name="recoveryCode" type="text" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" /></label>${passwordInput("newPassword", "New password", "new-password")}<button type="submit" class="secondary-button connection-primary" data-button-icon="check" data-pending-label="Resetting password…">Reset password</button><button type="button" class="connection-text-button" id="show-sign-in">Back to sign in</button></form>`;
  return `${accountHeading("Welcome to DuckPlan", "Keep your tasks, calendar and classes together across your devices.")}
    ${!store.configured ? `<p class="connection-local-note">Your planner is currently saved on this device. <a href="https://duckplan-latest.ocs-learning.workers.dev/#settings" target="_blank" rel="noopener noreferrer">Open online DuckPlan<span class="sr-only"> (opens in a new tab)</span></a> to sign in and sync.</p>` : ""}
    <button type="button" class="google-signin-button" id="google-sign-in" aria-label="Sign in with Google" aria-describedby="google-sign-in-help" ${googleReady ? "" : "disabled"}><img src="./assets/google-signin.svg" alt="" width="180" height="40" /></button>
    <p class="connection-provider-help" id="google-sign-in-help">${googleHelp}</p>
    <div class="account-method-divider"><span>or use email</span></div>
    <div class="account-mode-switch" role="group" aria-label="Account action"><button type="button" data-account-mode="sign-in" aria-pressed="${mode === "sign-in"}">Sign in</button><button type="button" data-account-mode="sign-up" aria-pressed="${mode === "sign-up"}">Create account</button></div>
    <fieldset class="account-fields" ${store.configured ? "" : "disabled"}><legend class="sr-only">Email account</legend><div class="account-form-stage">${accountPanel("sign-in", signIn, mode)}${accountPanel("sign-up", signUp, mode)}${accountPanel("recover", recover, mode)}</div></fieldset>${connectionFeedback}`;
}
function signedInAccount(user) {
  const { name, initials } = PlannerUI.accountIdentity(user);
  const mode = ["change-password", "recovery-code"].includes(accountMode) ? accountMode : "summary";
  const summary = `<div class="account-identity-summary"><span class="account-identity-avatar" aria-hidden="true">${safeText(initials)}</span><div><strong>${safeText(name)}</strong><span>${safeText(user.email || "")}</span></div></div><p class="connection-note">Your planner is linked to this account. You can connect your Axis calendar alongside it.</p><div class="settings-actions account-management-actions"><button type="button" class="secondary-button" id="show-change-password" data-button-icon="pen">${user.hasPassword ? "Change password" : "Add a password"}</button>${user.hasPassword ? `<button type="button" class="secondary-button" id="show-recovery-code" data-button-icon="plus">New recovery code</button>` : ""}<button type="button" class="connection-text-button" id="sign-out">Sign out</button></div>`;
  const password = `<form class="settings-form account-form" id="password-form"><h3>${user.hasPassword ? "Change password" : "Add a password"}</h3>${user.hasPassword ? passwordInput("currentPassword", "Current password", "current-password") : ""}${passwordInput("newPassword", "New password", "new-password")}<button type="submit" class="secondary-button connection-primary" data-button-icon="check">Save password</button><button type="button" class="connection-text-button" id="cancel-account-form" data-account-cancel>Cancel</button></form>`;
  const recovery = `<form class="settings-form account-form" id="recovery-code-form"><h3>Make a new recovery code</h3><p class="connection-note">Your previous recovery code will stop working.</p>${passwordInput("password", "Current password", "current-password")}<button type="submit" class="secondary-button connection-primary" data-button-icon="check">Make a new code</button><button type="button" class="connection-text-button" data-account-cancel>Cancel</button></form>`;
  return `${accountHeading("Your planner, everywhere.", "Tasks and classes sync when this device is online.", true)}<div class="account-form-stage">${accountPanel("summary", summary, mode)}${accountPanel("change-password", password, mode)}${user.hasPassword ? accountPanel("recovery-code", recovery, mode) : ""}</div>${connectionFeedback}`;
}
function renderAccountIdentity() {
  const identity = PlannerUI.accountIdentity(store.user);
  document.querySelector("#profile-name").textContent = identity.name;
  document.querySelector("#profile-initials").textContent = identity.initials;
  document.querySelector("#profile-status").textContent = identity.signedIn ? "Signed in" : "Local planner";
  const card = document.querySelector(".profile-card");
  const label = identity.signedIn ? `Open ${identity.name}'s settings` : "Open account settings";
  card.setAttribute("aria-label", label);
  card.title = label;
}
function renderAccount() {
  renderAccountIdentity();
  const user = store.user;
  accountPanelAnimation?.cancel();
  accountPanelAnimation = null;
  window.DuckExpansionMotion?.settleWithin(els.accountSettings);
  const body = user ? signedInAccount(user) : signedOutAccount();
  const recovery = user && shownRecoveryCode ? `<div class="settings-row recovery-row" id="recovery-row"><div><h2>Save your recovery code</h2><p>This code is the only way to reset a forgotten password. Store it in a password manager.</p><p class="recovery-code"><code>${safeText(shownRecoveryCode)}</code></p></div><div class="settings-actions"><button type="button" class="secondary-button" id="copy-recovery" data-button-icon="copy">Copy code</button><button type="button" class="secondary-button" id="dismiss-recovery" data-button-icon="check" data-button-tone="quiet">I saved it</button></div></div>` : "";
  const offer = localImportCount ? `<div class="settings-row"><div><h2>Bring your local planner</h2><p>Copy this browser's saved tasks, templates, class resources, goals, habits, notes and preferences into your account?</p></div><div class="settings-actions"><button type="button" class="secondary-button" id="import-local" data-button-icon="upload">Import local planner</button><button type="button" class="secondary-button" id="dismiss-import" data-button-tone="quiet">Not now</button></div></div>` : "";
  replaceSettings(els.accountSettings, `<section class="connection-card account-card" aria-labelledby="account-heading">${body}</section>${recovery}${offer}`);
  els.resetDemo.closest(".settings-row").hidden = store.mode === "cloud";
}
function setAccountMode(mode, { focus = true } = {}) {
  accountMode = mode;
  const activeMode = store.user ? mode || "summary" : mode || "sign-in";
  const to = els.accountSettings.querySelector(`[data-account-panel="${activeMode}"]`);
  const stage = to?.parentElement;
  if (!to || !stage) { renderAccount(); return; }
  const oldHeight = stage.getBoundingClientRect().height;
  accountPanelAnimation?.cancel();
  window.DuckExpansionMotion?.settleWithin(stage);
  const from = stage.querySelector(":scope > [data-account-panel]:not([hidden])");
  if (!from) { renderAccount(); return; }
  const email = from.querySelector("input[name=email]")?.value;
  if (email && to.querySelector("input[name=email]") && !to.querySelector("input[name=email]").value) to.querySelector("input[name=email]").value = email;
  const apply = () => {
    [...stage.children].forEach(panel => { panel.hidden = panel !== to; panel.inert = panel !== to; });
    els.accountSettings.querySelectorAll("[data-account-mode]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.accountMode === activeMode)));
    const feedback = els.accountSettings.querySelector("[data-connection-feedback]");
    if (feedback) { feedback.hidden = true; feedback.textContent = ""; }
  };
  if (from !== to) {
    if (window.DuckExpansionMotion) window.DuckExpansionMotion.swapPanels(from, to, apply); else apply();
    const newHeight = to.getBoundingClientRect().height;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches && stage.animate && oldHeight && newHeight) {
      const animation = stage.animate([{ height: `${oldHeight}px` }, { height: `${newHeight}px` }], { duration: window.DuckMotion?.duration.control || 240, easing: window.DuckMotion?.easing || "ease-out" });
      accountPanelAnimation = animation;
      animation.finished.catch(() => {}).finally(() => { if (accountPanelAnimation === animation) accountPanelAnimation = null; });
    }
  }
  if (focus) requestAnimationFrame(() => { if (!to.hidden) (to.querySelector("input,button") || els.accountSettings.querySelector("[data-account-mode]"))?.focus({ preventScroll: true }); });
}
let nativeAccountSyncState = null;
let nativeSyncStatusRequest = 0;
let nativeSnapshotRefresh = null;
function renderAccountSyncStatus() {
  const row = document.querySelector("#account-sync-settings");
  if (!row) return;
  row.hidden = store.mode !== "cloud";
  const pending = store.listItems().some(task => task.workAlertsDeviceOnly || task.taskDetailsDeviceOnly);
  document.querySelector("#account-sync-copy").textContent = store.settingsSyncError
    ? "Some settings could not finish syncing. Your device copy is preserved. Refresh while online to retry."
    : !store.supportsWorkAlerts || !store.supportsTaskDetails
      ? "Tasks sync, but some alarm and reminder settings stay on this device until the account server is updated."
      : pending ? "Some older settings are waiting to upload. Keep this device online while they finish syncing."
        : "Task details, alarm settings, logged time and reminder choices are shared with devices signed into this account. Alarm and notification access is allowed separately on each device.";
  const native = document.querySelector("#native-background-sync-status");
  native.hidden = !window.DuckNativeSync;
  native.textContent = nativeAccountSyncState
    ? `${nativeAccountSyncState.reason || (nativeAccountSyncState.enabled && nativeAccountSyncState.registered ? "Background updates are enabled; iOS controls their delivery." : "Background updates are not active on this device.")}${Number.isFinite(nativeAccountSyncState.lastSyncAt) ? ` Last account refresh: ${new Date(nativeAccountSyncState.lastSyncAt).toLocaleString()}.` : ""}`
    : "Checking this device's background sync…";
}
async function readNativeAccountSyncStatus(action = "status") {
  if (!window.DuckNativeSync) return;
  const ownerVersion = plannerOwnerVersion, request = ++nativeSyncStatusRequest;
  try {
    const result = await window.DuckNativeSync.request({ action });
    if (ownerVersion !== plannerOwnerVersion || request !== nativeSyncStatusRequest) return;
    nativeAccountSyncState = result;
  } catch {
    if (ownerVersion !== plannerOwnerVersion || request !== nativeSyncStatusRequest) return;
    nativeAccountSyncState = { reason: "This device could not check background sync. Open DuckPlan while online to retry." };
  }
  renderAccountSyncStatus();
}
document.querySelector("#refresh-account-sync").addEventListener("click", event => runAction(event.currentTarget, async () => {
  const ownerVersion = plannerOwnerVersion;
  if (window.DuckNativeSync) await readNativeAccountSyncStatus("refresh");
  if (ownerVersion !== plannerOwnerVersion) return;
  await store.refresh();
  if (ownerVersion !== plannerOwnerVersion) return;
  await workAlerts.reconcile({ refresh: true });
  if (ownerVersion === plannerOwnerVersion) { renderAccountSyncStatus(); showToast("Checked for account updates."); }
}));
window.addEventListener("duckplan:native-sync-updated", () => {
  if (!window.DuckNativeSync || document.hidden || nativeSnapshotRefresh) return;
  const ownerVersion = plannerOwnerVersion;
  nativeSnapshotRefresh = (async () => {
    await store.refresh();
    if (ownerVersion === plannerOwnerVersion) await readNativeAccountSyncStatus();
  })().catch(reportError).finally(() => { nativeSnapshotRefresh = null; });
});
window.addEventListener("duckplan:native-sync-status", () => { readNativeAccountSyncStatus(); });
function renderAxis() {
  const signedIn = store.mode === "cloud", connected = signedIn && axisStatus.connected;
  const badge = connected ? axisStatus.lastError ? "Needs attention" : "Connected" : "Not connected";
  const heading = `<header class="connection-card-heading"><span class="connection-card-symbol axis-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-14 5h3m4 0h3"/></svg></span><div><p class="connection-eyebrow">School calendar</p><h2 id="axis-heading">${connected ? "Axis is linked." : "Bring Axis into your plan."}</h2><p>Your school assignments, right beside your own plans.</p></div></header><span class="connection-badge axis-connection-badge ${axisStatus.lastError && connected ? "needs-attention" : ""}">${badge}</span>`;
  let body;
  if (!signedIn) body = `<div class="axis-locked-state"><div class="connection-step"><span aria-hidden="true">1</span><div><strong>Sign in to DuckPlan</strong><p>Keep imported classes and assignments in your account.</p></div></div><div class="connection-step"><span aria-hidden="true">2</span><div><strong>Link your Axis calendar</strong><p>Paste your private calendar feed link after signing in.</p></div></div><button type="button" class="secondary-button connection-primary" id="connect-axis" data-button-icon="login" ${store.configured ? "" : "disabled"}>Sign in to link Axis</button></div>`;
  else if (!connected) body = `<form class="settings-form account-form axis-connect-form" id="axis-form"><label><span>Private Axis calendar link</span><input name="icalUrl" type="url" required autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="axis-feed-help" placeholder="webcal://…/iCal.aspx?z=…" /></label><p class="connection-note" id="axis-feed-help">Use your calendar subscription link, not your Axis password. Your feed link stays private.</p><button type="submit" class="secondary-button connection-primary" data-button-icon="link" data-pending-label="Linking Axis…">Connect Axis</button></form><details class="axis-guide"><summary>Where do I find my calendar link?</summary><div><ol><li>Open your school’s Axis calendar.</li><li>Look for its iCal or calendar subscription option. Your school may name this differently.</li><li>Copy the private feed link and paste it above. It usually contains <code>iCal.aspx</code>.</li></ol></div></details><div class="axis-import-note"><strong>About your first import</strong><p>Newly imported, already-overdue assignments are marked complete on your first import. Assignments due today or later stay open.</p></div>`;
  else body = `<div class="axis-connected-state"><p class="axis-last-sync">${safeText(relativeSyncTime(axisStatus.lastSyncedAt))}</p><p class="connection-note">New assignments sync automatically. You can also check for updates now.</p>${axisStatus.lastError ? `<p class="connection-feedback" role="alert">${safeText(axisStatus.lastError)}</p>` : ""}<div class="settings-actions axis-connected-actions"><button type="button" class="secondary-button connection-primary" id="axis-sync-now" data-button-icon="refresh" data-pending-label="Syncing…">Sync now</button><button type="button" class="connection-text-button" id="axis-disconnect">Disconnect Axis</button></div><p class="connection-note">Disconnecting stops future imports. Your imported assignments stay in DuckPlan.</p></div>`;
  replaceSettings(els.axisSettings, `<section class="connection-card axis-card" aria-labelledby="axis-heading">${heading}${body}${connectionFeedback}</section>`);
  els.syncCopy.textContent = !signedIn ? "Not signed in" : connected ? (axisStatus.lastError ? "Needs attention" : relativeSyncTime(axisStatus.lastSyncedAt)) : "Not connected";
  els.syncInfo.setAttribute("aria-label", connected ? "Sync Axis now" : "Set up Axis sync");
}
async function refreshAccountState() {
  const version = ++accountStateVersion;
  try {
    const next = await Promise.all([store.axisStatus(), store.localImportOffer()]);
    if (version !== accountStateVersion) return;
    [axisStatus, localImportCount] = next;
  } catch (error) {
    if (version !== accountStateVersion) return;
    console.error(error);
  }
  renderAccount(); renderAxis();
}
async function runAction(button, action) {
  const ownerVersion = plannerOwnerVersion;
  const authForm = button.closest("#sign-in-form, #sign-up-form, #recover-form");
  const signingInAs = authForm?.elements.email.value.trim().toLowerCase();
  const feedback = button.closest("#account-settings, #axis-settings")?.querySelector("[data-connection-feedback]");
  if (feedback) { feedback.hidden = true; feedback.textContent = ""; }
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try { await action(); }
  catch (error) {
    if (ownerVersion === plannerOwnerVersion || (signingInAs && store.user?.email?.toLowerCase() === signingInAs)) {
      if (feedback?.isConnected) { feedback.textContent = error.message || "Something went wrong. Please try again."; feedback.hidden = false; }
      reportError(error);
    }
  }
  finally { if (button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); } }
}
function axisCompletionNotice(result) {
  const count = result.autoCompleted;
  return Number.isSafeInteger(count) && count > 0 ? ` ${count} overdue assignment${count === 1 ? "" : "s"} marked complete.` : "";
}
async function syncAxisNow() {
  const result = await store.syncAxisNow();
  showToast(`Axis synced: ${result.added} new, ${result.updated} updated.${axisCompletionNotice(result)}`);
  await refreshAccountState();
}
function showRecoveryCode(code) {
  if (!code) return;
  shownRecoveryCode = code;
  accountMode = null;
  renderAccount();
  els.accountSettings.querySelector("#recovery-row")?.scrollIntoView({ block: "nearest" });
}

function rangeLabel(dates) {
  if (calendarView === "month") return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(dateObject(selectedDate));
  if (dates.length === 1) return formatLongDate(dates[0]);
  const first = formatShortDate(dates[0]);
  const lastDate = dateObject(dates.at(-1));
  const last = new Intl.DateTimeFormat(undefined, { month: dateObject(dates[0]).getMonth() === lastDate.getMonth() ? undefined : "short", day: "numeric", year: dates[0].slice(0, 4) === dates.at(-1).slice(0, 4) ? undefined : "numeric" }).format(lastDate);
  return `${first}–${last}`;
}
function deadlineControlAtPointer(event) {
  if (!(event.detail > 0) || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
  const column = event.target.closest("#planner-calendar .timeline-column");
  if (!column) return null;
  const receivingAnchor = event.target.closest(".timed-deadline-anchor");
  if (!receivingAnchor) return null;
  const receivingBounds = receivingAnchor.getBoundingClientRect();
  const gutter = Number.parseFloat(getComputedStyle(receivingAnchor).getPropertyValue("--timed-deadline-gutter")) || 0;
  // Only the transparent diamond gutter can expose another cluster's pin.
  // A diamond behind an opaque label must not steal that label's activation.
  if (event.clientX < receivingBounds.left || event.clientX > receivingBounds.left + gutter) return null;
  // A cluster's transparent tail can share a gutter with the next label. The
  // visible diamond belongs to its own deadline even when that label receives
  // the pointer event. Keyboard activation continues to use the focused button.
  const points = [...column.querySelectorAll(".timed-deadline-diamond")].map(element => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom)
    .sort((a, b) => Math.abs(event.clientY - (a.rect.top + a.rect.bottom) / 2) - Math.abs(event.clientY - (b.rect.top + b.rect.bottom) / 2));
  return points[0]?.element.closest(".timed-deadline-anchor")?.querySelector(".timed-deadline-marker,.timed-deadline-group-trigger") || null;
}
function layoutEvents(dayTasks, { hourHeight = 62 } = {}) {
  const sorted = dayTasks.map((task) => {
    const start = Model.scheduledParts(task).minutes;
    const end = start + Number(task.durationMinutes || 45);
    return { task, start, end, top: start * hourHeight / 60, height: Math.max(30, (end - start) * hourHeight / 60), lane: 0 };
  }).sort((a, b) => a.start - b.start || b.end - a.end || String(a.task.id).localeCompare(String(b.task.id)));
  const clusters = [];
  for (const event of sorted) {
    let cluster = clusters.at(-1);
    if (!cluster || event.top >= cluster.bottom) {
      cluster = { bottom: event.top + event.height, events: [] };
      clusters.push(cluster);
    }
    cluster.events.push(event);
    cluster.bottom = Math.max(cluster.bottom, event.top + event.height);
  }
  for (const cluster of clusters) {
    const active = [];
    let lanes = 1, crowdedHeadings = false;
    for (const event of cluster.events) {
      for (let index = active.length - 1; index >= 0; index -= 1) if (active[index].top + active[index].height <= event.top) active.splice(index, 1);
      // Keep the title and start time exposed before layering the next block.
      crowdedHeadings ||= active.some(other => event.top - other.top < (other.height < CALENDAR_COMPACT_BLOCK_HEIGHT ? 30 : 42));
      const used = new Set(active.map(item => item.lane));
      while (used.has(event.lane)) event.lane += 1;
      active.push(event);
      lanes = Math.max(lanes, event.lane + 1);
    }
    cluster.events.forEach((event, index) => {
      event.lanes = lanes;
      event.overlapping = cluster.events.length > 1;
      event.stack = index + 1;
      // Like Calendar: close headings share overlapping columns; otherwise a
      // small inset preserves nearly the entire width and earlier headings.
      event.left = crowdedHeadings ? event.lane * 100 / lanes : Math.min(index * 5, 40);
      event.width = crowdedHeadings ? Math.min(100 - event.left, 170 / lanes) : 100 - event.left;
    });
  }
  return sorted;
}
function renderTimeline(dates) {
  const startHour = CALENDAR_START_HOUR;
  const endHour = CALENDAR_END_HOUR;
  const hourHeight = 62;
  if (!dates.includes(calendarFocusSlot.date)) calendarFocusSlot = { date: selectedDate, time: calendarFocusSlot.time || "09:00" };
  const headers = dates.map((date) => { const summary = calendarDates.daySummary(tasks, date); return `<div role="group" class="calendar-date-button calendar-day-heading ${[0, 6].includes(dateObject(date).getDay()) ? "weekend" : ""} ${date === selectedDate ? "selected" : ""} ${date === nowKey() ? "today" : ""}" data-date="${date}" aria-label="${safeText(summary.label).replaceAll('"', "&quot;")}" ${date === nowKey() ? ' aria-current="date"' : ""}><span>${new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(dateObject(date))}</span><strong>${dateObject(date).getDate()}</strong>${summary.markup}</div>`; }).join("");
  const timeLabels = Array.from({ length: endHour - startHour }, (_, index) => `<span><span class="time-axis-label">${formatTime(`${String(startHour + index).padStart(2, "0")}:00`)}</span></span>`).join("");
  let hasTimedDeadlineWorkOverlap = false;
  const columns = dates.map((date) => {
    const current = new Date();
    const currentMinutes = current.getHours() * 60 + current.getMinutes();
    const currentTimeLine = date === nowKey() && currentMinutes >= startHour * 60 && currentMinutes < endHour * 60
      ? `<div class="current-time-line" style="top:${((currentMinutes - startHour * 60) / 60) * hourHeight}px" aria-hidden="true"><span></span></div>`
      : "";
    const scheduled = tasks.filter((task) => Model.scheduledParts(task)?.date === date && !task.completed);
    const deadlineGroups = calendarDates.timedDeadlineGroups(tasks, date, { hourHeight });
    const workEvents = layoutEvents(scheduled, { hourHeight });
    const overlapsDeadline = (event, group) => event.top < group.bottom + 2 && event.top + event.height > group.top - 2;
    const events = workEvents.map(({ task, top, height, left, width, stack, overlapping }) => {
      const info = classInfo(task);
      const timing = Model.taskTiming(task);
      return `<button type="button" class="calendar-event-block ${height < CALENDAR_COMPACT_BLOCK_HEIGHT ? "is-short " : ""}${task.id === selectedTaskId ? "selected" : ""}" data-select-task="${task.id}" data-edit-task="${task.id}" data-calendar-kind="work" data-calendar-drag-task="${task.id}" data-overlapping-work="${overlapping}" aria-label="${safeText(`Work session: ${task.title}. ${taskScheduleText(task)}${timing.plannedAfterDeadline ? ". Work ends after deadline" : ""}`).replaceAll('"', "&quot;")}" aria-describedby="calendar-drag-instructions" style="--course-color:${info.color};--course-soft:${info.soft};--course-default-fill:${info.defaultWorkFill || 'initial'};--work-stack:${stack};top:${top}px;height:${height}px;left:${left}%;width:${width}%"><strong>${safeText(task.title)}</strong><small>${formatTime(Model.scheduledParts(task).time)}</small>${timing.plannedAfterDeadline ? '<span class="calendar-work-warning" aria-hidden="true">!</span>' : ""}</button>`;
    }).join("");
    const timedDeadlines = deadlineGroups.map(group => {
      const overlapsWork = workEvents.some(event => overlapsDeadline(event, group));
      hasTimedDeadlineWorkOverlap ||= overlapsWork;
      return calendarDates.timedDeadlineMarker(group, { overlapsWork });
    }).join("");
    const slots = Array.from({ length: endHour - startHour }, (_, index) => {
      const time = `${String(startHour + index).padStart(2, "0")}:00`;
      const isFocusSlot = calendarFocusSlot.date === date && calendarFocusSlot.time === time;
      return `<button type="button" class="calendar-slot" tabindex="${isFocusSlot ? "0" : "-1"}" data-slot-date="${date}" data-slot-time="${time}" aria-label="Plan work on ${formatLongDate(date)} at ${formatTime(time)}"></button>`;
    }).join("");
    return `<div class="timeline-column ${[0, 6].includes(dateObject(date).getDay()) ? "weekend" : ""} ${date === selectedDate ? "selected-day" : ""}" data-column-date="${date}" style="--timeline-height:${(endHour - startHour) * hourHeight}px">${slots}${currentTimeLine}<div class="calendar-work-layer">${events}</div>${timedDeadlines}</div>`;
  }).join("");
  return `<div class="timeline-calendar${hasTimedDeadlineWorkOverlap ? " has-timed-deadline-work-overlap" : ""}" style="--day-count:${dates.length};--hour-count:${endHour - startHour};--hour-height:${hourHeight}px"><div class="calendar-header-viewport"><div class="calendar-header-grid"><div class="timeline-corner" aria-hidden="true"></div><div class="timeline-days">${headers}</div></div></div><div class="calendar-timeline-scroller" role="region" aria-label="Hourly schedule" tabindex="0"><div class="calendar-body-grid"><div class="time-axis">${timeLabels}</div><div class="timeline-columns">${columns}</div></div></div></div>`;
}
function renderMonth(dates) {
  return calendarDates.month(tasks, dates, selectedDate);
}
function relevantCalendarMinutes(dates) {
  const work = tasks
    .filter((task) => dates.includes(Model.scheduledParts(task)?.date) && !task.completed)
    .map((task) => Model.scheduledParts(task))
    .filter(Boolean);
  const deadlines = dates.flatMap(date => calendarDates.timedDeadlineGroups(tasks, date)
    .flatMap(group => group.entries.map(entry => ({ date, minutes: entry.minutes }))));
  const scheduled = [...work, ...deadlines].sort((a, b) => a.date.localeCompare(b.date) || a.minutes - b.minutes);
  const selected = scheduled.filter((parts) => parts.date === selectedDate);
  const candidates = selected.length ? selected : scheduled;
  if (candidates.length) {
    if (selectedDate === nowKey()) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      return (candidates.find((parts) => parts.minutes >= nowMinutes - 30) || candidates[0]).minutes;
    }
    return candidates[0].minutes;
  }
  if (selectedDate === nowKey()) {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
  return 9 * 60;
}

function calendarScrollElement() {
  return window.DuckCalendarViewport?.scroller(els.calendar) || els.calendar;
}

function scrollCalendarToRelevant(dates) {
  if (calendarView === "month" || calendarUserScrolled) return;
  requestAnimationFrame(() => {
    const column = els.calendar.querySelector("[data-column-date]");
    const headerOffset = column ? column.getBoundingClientRect().top - calendarScrollElement().getBoundingClientRect().top + calendarScrollElement().scrollTop - calendarScrollElement().clientTop : 114;
    calendarProgrammaticScroll = true;
    calendarScrollElement().scrollTop = PlannerUI.timelineScrollTop({
      targetMinutes: relevantCalendarMinutes(dates),
      headerOffset,
      viewportHeight: calendarScrollElement().clientHeight,
      scrollHeight: calendarScrollElement().scrollHeight,
    });
    requestAnimationFrame(() => { calendarProgrammaticScroll = false; });
  });
}

function renderPhoneWeekStrip(dates) {
  const strip = els.phoneWeekStrip;
  if (!strip) return;
  strip.hidden = !phonePlannerQuery.matches || calendarView !== "week";
  if (strip.hidden) return;
  const week = dates.join(",");
  if (strip.dataset.week !== week) {
    strip.innerHTML = dates.map((date) => `<div class="phone-week-day" role="group" data-phone-date="${date}"><button type="button" class="phone-week-date" data-date="${date}" aria-label="${safeAttribute(`Select ${formatLongDate(date)}`)}"><span>${new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(dateObject(date))}</span><strong>${dateObject(date).getDate()}</strong></button><span class="calendar-day-counts"></span></div>`).join("");
    strip.dataset.week = week;
  }
  strip.querySelectorAll(".phone-week-day").forEach((button) => {
    const date = button.dataset.phoneDate;
    const summary = calendarDates.daySummary(tasks, date);
    button.setAttribute("aria-label", summary.label);
    const counts = button.querySelector(".calendar-day-counts");
    const key = `${summary.workCount}:${summary.dueCount}`;
    if (counts && counts.dataset.counts !== key) {
      counts.outerHTML = summary.markup.replace('<span class="calendar-day-counts', `<span data-counts="${key}" class="calendar-day-counts`);
    }
    button.classList.toggle("selected", date === selectedDate);
    const dateButton = button.querySelector(".phone-week-date");
    dateButton.setAttribute("aria-pressed", String(date === selectedDate));
    if (date === nowKey()) dateButton.setAttribute("aria-current", "date");
    else dateButton.removeAttribute("aria-current");
  });
}

function renderCalendar({ autoScroll = false } = {}) {
  const previousScroll = calendarScrollElement();
  const position = { top: previousScroll.scrollTop, left: previousScroll.scrollLeft };
  const dates = Model.datesForView(calendarView, selectedDate);
  const singleDayWeek = phonePlannerQuery.matches && calendarView === "week";
  const visibleDates = singleDayWeek ? [selectedDate] : dates;
  els.calendarRange.textContent = phonePlannerQuery.matches && calendarView === "day"
    ? new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(dateObject(selectedDate))
    : rangeLabel(dates);
  els.calendar.className = `planner-calendar ${calendarView}-view${singleDayWeek ? " phone-single-day" : ""}`;
  els.calendar.innerHTML = calendarView === "month" ? renderMonth(dates) : renderTimeline(visibleDates);
  renderPhoneWeekStrip(dates);
  calendarScrollElement().scrollTop = position.top;
  calendarScrollElement().scrollLeft = position.left;
  calendarViewport?.refresh();
  document.querySelectorAll("[data-calendar-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.calendarView === calendarView)));
  els.calendarStatus.textContent = `${calendarView[0].toUpperCase()}${calendarView.slice(1)} view, ${els.calendarRange.textContent}`;
  if (autoScroll) {
    calendarUserScrolled = false;
    if (calendarView === "month") {
      calendarScrollElement().scrollTop = 0;
      calendarScrollElement().scrollLeft = 0;
    }
    scrollCalendarToRelevant(visibleDates);
  }
}

// Native labels remain sharp; lightweight CSS glass replaces live fur canvases.
function setupButtonMaterial(root = document) {
  const contentControls = ".sidebar-scrim,.task-panel-scrim,.calendar-slot,[data-day-list],.calendar-event-block,.deadline-chip,.deadline-overflow,.deadline-row-toggle,.deadline-day-summary,.timed-deadline-marker,.timed-deadline-group-trigger,.month-day,.month-date-button,.month-entry,.month-overflow,.calendar-agenda-item,.phone-week-date,.task-select,.task-section-heading";
  root.querySelectorAll("button, a.secondary-button, a.nav-open-button").forEach(button => {
    button.classList.toggle("glass-button", !button.matches(contentControls));
  });
}
function renderAll({ autoScrollCalendar = false } = {}) {
  const unfinishedBefore = new Set(tasks.filter(task => !task.completed).map(task => task.id));
  tasks = store.listItems();
  if (tasks.some(task => task.completed && unfinishedBefore.has(task.id))) foldCompletedAfterFinish = true;
  if (window.DuckTaskCompletion?.deferRender(() => renderAll({ autoScrollCalendar }))) return;
  const restoreCompletionFocus = window.DuckTaskCompletion?.preserveFocus();
  if (foldCompletedAfterFinish) {
    collapsed.completed = true;
    const dashboardCompleted = document.querySelector(".dashboard-completed");
    if (window.DuckExpansionMotion) window.DuckExpansionMotion.setExpanded(dashboardCompleted, false);
    else dashboardCompleted.open = false;
    foldCompletedAfterFinish = false;
  }
  renderAccountIdentity(); renderDailyPlan(); renderAllTasks(); renderClasses(); renderClassOptions();
  renderCalendar({ autoScroll: autoScrollCalendar });
  taskLibrary?.render();
  calendarLibraryTabs?.render();
  personalGoals?.render(); personalNotes?.render();
  calendarTaskPreview.sync();
  renderAccountSyncStatus();
  updatePrimaryAction(document.body.dataset.view || "calendar");
  if (els.modal.open) taskLibrary?.renderTaskResources(els.form.elements.classId.value);
  refreshReminders();
  requestAnimationFrame(() => setupButtonMaterial());
  restoreCompletionFocus?.();
}

function updatePrimaryAction(view) {
  const button = document.querySelector("#open-task-modal");
  const labels = { goals: "Add goal / habit", notes: "Add note", classes: "Add class" };
  if (view === "calendar" && calendarLibraryTabs?.selected === "templates") labels.calendar = "New template";
  button.textContent = labels[view] || "Add task";
  button.hidden = view === "settings";
  button.disabled = (["goals", "notes"].includes(view) && store.supportsPersonal === false)
    || (view === "calendar" && calendarLibraryTabs?.selected === "templates" && (store.supportsTemplates ?? store.supportsOrganization) === false);
  button.setAttribute("aria-haspopup", "dialog");
  els.search.closest(".search-box").hidden = !["calendar", "home", "tasks"].includes(view);
}

function openPrimaryAction(source) {
  const view = document.body.dataset.view;
  if (view === "goals") personalGoals?.openAddChooser({ source });
  else if (view === "calendar" && calendarLibraryTabs?.selected === "templates") taskLibrary?.openNewTemplate?.({ source });
  else if (view === "notes") personalNotes?.openNote({ source });
  else if (view === "classes") openClassEditor(source);
  else if (view !== "settings") openModal({ source, dueDate: view === "calendar" ? selectedDate : nowKey() });
}

function openClassEditor(source) {
  viewTransitions.settle();
  if (classEditor) { classEditor.querySelector("input")?.focus(); return; }
  const dialog = document.createElement("dialog");
  dialog.className = "personal-note-dialog";
  dialog.tabIndex = -1;
  dialog.setAttribute("aria-labelledby", "class-editor-heading");
  dialog.innerHTML = '<form novalidate><div class="personal-note-dialog-heading"><h2 id="class-editor-heading">New class</h2><button type="button" class="close-button" data-close-class aria-label="Close class editor">×</button></div><p class="personal-note-error" role="alert" hidden></p><label>Class name<input name="name" required maxlength="120" placeholder="e.g. Biology" /></label><label>Short code<input name="code" maxlength="4" placeholder="e.g. BIO" /></label><label>Teacher<input name="teacher" maxlength="120" /></label><label>Period<input name="period" maxlength="60" /></label><label>Color<input name="color" type="color" value="#6c9cc4" /></label><div class="personal-note-dialog-actions"><button type="button" class="secondary-button" data-close-class data-button-tone="quiet">Cancel</button><button type="submit" class="primary-button" data-button-icon="check">Save class</button></div></form>';
  classEditor = dialog;
  const ownerVersion = plannerOwnerVersion;
  const anchor = DuckPopupMotion.capture(source);
  let busy = false, closing = false;
  const current = () => classEditor === dialog && ownerVersion === plannerOwnerVersion;
  const close = () => {
    if (!current() || busy || closing) return;
    closing = true; dialog.inert = true;
    DuckPopupMotion.close(dialog, anchor, () => {
      if (!current()) return;
      dialog.close(); dialog.remove(); classEditor = null;
      (source?.isConnected ? source : document.querySelector("#open-task-modal"))?.focus({ preventScroll: true });
    });
  };
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  dialog.addEventListener("click", event => {
    if (event.target.closest("[data-close-class]")) close();
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  });
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const controls = [...dialog.querySelectorAll("button,input")].filter(control => !control.disabled);
    const first = controls[0], last = controls.at(-1);
    if (!first) { event.preventDefault(); dialog.focus(); return; }
    if (event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last || !controls.includes(document.activeElement)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    }
  });
  dialog.querySelector("form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!current() || busy || closing) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const errorBox = dialog.querySelector(".personal-note-error");
    if (!data.name.trim()) { errorBox.textContent = "Give your class a name."; errorBox.hidden = false; dialog.querySelector('[name="name"]').focus(); return; }
    busy = true; dialog.setAttribute("aria-busy", "true"); errorBox.hidden = true;
    dialog.querySelectorAll("input,button").forEach(control => { control.disabled = true; });
    try {
      await store.upsertClass({ ...data, name: data.name.trim(), code: data.code.trim() || data.name.trim().slice(0, 4).toUpperCase() });
      if (!current()) return;
      busy = false; close(); showToast("Class saved.");
    } catch (error) {
      if (!current()) return;
      errorBox.textContent = error.message || "Could not save your class. Please try again."; errorBox.hidden = false;
    } finally {
      if (current()) {
        busy = false; dialog.removeAttribute("aria-busy");
        dialog.querySelectorAll("input,button").forEach(control => { control.disabled = false; });
        if (!closing) dialog.querySelector('button[type="submit"]').focus();
      }
    }
  });
  document.body.append(dialog); setupButtonMaterial(dialog); dialog.showModal();
  DuckPopupMotion.open(dialog, anchor, () => { if (current() && !closing) dialog.querySelector("input").focus(); });
}

function applyView(name, preserveDrawer = false) {
  window.DuckTaskCompletion?.cancel();
  const requested = name === "today" ? "home" : name;
  const next = els.views.find((view) => view.id === `view-${requested}`) || document.querySelector("#view-calendar");
  const normalized = next.id.replace("view-", "");
  if (normalized !== "calendar") calendarTaskPreview.close({ immediate: true, restoreFocus: false });
  document.body.dataset.view = normalized;
  els.views.forEach((view) => view.classList.toggle("active", view === next));
  els.navItems.forEach((item) => { const active = item.dataset.view === normalized; item.classList.toggle("active", active); active ? item.setAttribute("aria-current", "page") : item.removeAttribute("aria-current"); });
  els.pageTitle.textContent = next.dataset.pageTitle;
  els.pageEyebrow.textContent = next.dataset.eyebrow;
  updatePrimaryAction(normalized);
  history.replaceState(null, "", `#${normalized}`);
  if (normalized !== "calendar") setTaskPanel(false, false);
  if (!preserveDrawer) setSidebar(false);
  workspace.scrollTo({ top: 0, left: 0, behavior: "instant" });
  window.scrollTo({ top: 0, behavior: "instant" });
  // Routing reuses already-normalized controls; only renders need a new scan.
}

function setView(name, preserveDrawer = false) {
  viewTransitions.cancel();
  applyView(name, preserveDrawer);
}

function navigateView(name, preserveDrawer = false, source = null) {
  const previous = document.body.dataset.view;
  const moveFocus = els.views.find((view) => view.id === `view-${previous}`)?.contains(document.activeElement);
  const requested = name === "today" ? "home" : name;
  const next = els.views.find((view) => view.id === `view-${requested}`) || document.querySelector("#view-calendar");
  const current = next.id.replace("view-", "");
  viewTransitions.navigate({ from: previous, to: current, source, update: () => {
    applyView(current, preserveDrawer);
    if (previous !== current && moveFocus) workspace.focus({ preventScroll: true });
  } });
}
function hideToast() {
  clearTimeout(toastTimer);
  els.toast.classList.remove("show");
  els.toastAction.hidden = true;
  els.toastAction.onclick = null;
}
function showToast(message, { actionLabel = "", onAction = null, duration = 2600 } = {}) {
  clearTimeout(toastTimer);
  els.toastMessage.textContent = message;
  els.toastAction.hidden = !actionLabel;
  els.toastAction.textContent = actionLabel;
  els.toastAction.onclick = actionLabel && onAction ? () => { hideToast(); onAction(); } : null;
  els.toast.classList.add("show");
  toastTimer = setTimeout(hideToast, duration);
}
function selectDate(date) { window.DuckTaskCompletion?.cancel(); calendarTaskPreview.close({ immediate: true, restoreFocus: false }); selectedDate = date; selectedTaskId = null; calendarFocusSlot = { date, time: calendarFocusSlot.time }; renderDailyPlan(); renderCalendar({ autoScroll: true }); requestAnimationFrame(() => setupButtonMaterial()); }
function selectTask(id) {
  window.DuckTaskCompletion?.cancel();
  selectedTaskId = selectedTaskId === id ? null : id;
  renderDailyPlan();
  // Keep the launcher attached so popup motion and focus use its real calendar bounds.
  els.calendar.querySelectorAll("[data-select-task]").forEach((control) => {
    control.classList.toggle("selected", control.dataset.selectTask === selectedTaskId);
  });
  setupButtonMaterial();
}

function focusMovedCalendarTask(taskId) {
  requestAnimationFrame(() => {
    const target = [...els.calendar.querySelectorAll("[data-calendar-drag-task]")]
      .find((item) => item.dataset.calendarDragTask === taskId);
    target?.focus({ preventScroll: true });
  });
}

function moveCalendarTask(task, drop, { focus = false } = {}) {
  const owner = `${store.mode}:${store.user?.id || "local"}`;
  const ownerVersion = plannerOwnerVersion;
  const currentOwner = () => ownerVersion === plannerOwnerVersion && owner === `${store.mode}:${store.user?.id || "local"}`;
  const previousStart = task.scheduledStart;
  const previousSelectedDate = selectedDate;
  const nextStart = `${drop.date}T${drop.time}`;
  if (nextStart === previousStart) {
    if (focus) focusMovedCalendarTask(task.id);
    return false;
  }
  selectedDate = drop.date;
  selectedTaskId = task.id;
  saveTaskWithAlerts({ ...task, scheduledStart: nextStart, scheduledEnd: null }).catch(error => { if (currentOwner()) reportError(error); });
  const destination = `${formatLongDate(drop.date)} at ${formatTime(drop.time)}`;
  els.calendarStatus.textContent = `${task.title} moved to ${destination}.`;
  showToast(`Moved to ${destination}.`, {
    actionLabel: "Undo",
    duration: 5000,
    onAction: () => {
      if (!currentOwner()) return;
      const current = store.listItems().find(item => item.id === task.id);
      if (!current || current.scheduledStart !== nextStart) { showToast("This task has changed since it was moved."); return; }
      selectedDate = previousStart?.slice(0, 10) || previousSelectedDate;
      selectedTaskId = task.id;
      saveTaskWithAlerts({ ...current, scheduledStart: previousStart, scheduledEnd: null }).catch(error => { if (currentOwner()) reportError(error); });
      els.calendarStatus.textContent = `${task.title} returned to its previous time.`;
      showToast("Calendar move undone.");
      if (focus) focusMovedCalendarTask(task.id);
    },
  });
  if (focus) focusMovedCalendarTask(task.id);
  return true;
}

async function scheduleListTask(task, drop) {
  const owner = `${store.mode}:${store.user?.id || "local"}`;
  const ownerVersion = plannerOwnerVersion;
  const currentOwner = () => ownerVersion === plannerOwnerVersion && owner === `${store.mode}:${store.user?.id || "local"}`;
  const previousStart = task.scheduledStart || null, previousEnd = task.scheduledEnd || null;
  const scheduledStart = `${drop.date}T${drop.time}`;
  if (previousStart === scheduledStart) return;
  selectedDate = drop.date; selectedTaskId = task.id;
  try {
    await saveTaskWithAlerts({ ...task, scheduledStart, scheduledEnd: null });
    if (!currentOwner()) return;
    const destination = `${formatLongDate(drop.date)} at ${formatTime(drop.time)}`;
    els.calendarStatus.textContent = `${task.title} scheduled for ${destination}.`;
    showToast(`Scheduled for ${destination}.`, {
      actionLabel: "Undo", duration: 5000,
      onAction: async () => {
        if (!currentOwner()) return;
        const current = store.listItems().find(item => item.id === task.id);
        if (!current || current.scheduledStart !== scheduledStart) {
          showToast("This task has changed since it was scheduled."); return;
        }
        try {
          await saveTaskWithAlerts({ ...current, scheduledStart: previousStart, scheduledEnd: previousEnd });
          if (currentOwner()) showToast("Task scheduling undone.");
        } catch (error) { if (currentOwner()) reportError(error); }
      },
    });
  } catch (error) { if (currentOwner()) reportError(error); }
}

function calendarColumnAt(clientX) {
  return [...els.calendar.querySelectorAll(".timeline-column")].find((column) => {
    const rect = column.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right;
  }) || null;
}

function updateCalendarDragPosition(clientX, clientY) {
  if (!calendarDrag?.started) return;
  calendarDrag.lastPointer = { x: clientX, y: clientY };
  const column = calendarColumnAt(clientX);
  calendarDrag.targetColumn?.classList.remove("calendar-drop-target");
  calendarDrag.targetColumn = column;
  if (!column) {
    calendarDrag.drop = null;
    calendarDrag.ghost.hidden = true;
    return;
  }
  const rect = column.getBoundingClientRect();
  const durationMinutes = Number(calendarDrag.task.durationMinutes || 45);
  const hourHeight = rect.height / CALENDAR_HOURS;
  const drop = PlannerUI.snapCalendarDrop({
    date: column.dataset.columnDate,
    pointerY: clientY - calendarDrag.offsetY,
    columnTop: rect.top,
    hourHeight,
    durationMinutes,
  });
  const top = rect.top + ((drop.minutes - CALENDAR_START_HOUR * 60) / 60) * hourHeight;
  calendarDrag.drop = drop;
  column.classList.add("calendar-drop-target");
  calendarDrag.ghost.hidden = false;
  const layer = column.querySelector(".calendar-work-layer");
  if (layer && calendarDrag.ghost.parentElement !== layer) layer.append(calendarDrag.ghost);
  const layerRect = layer?.getBoundingClientRect();
  calendarDrag.ghost.style.left = layer ? "0px" : `${rect.left + 3}px`;
  calendarDrag.ghost.style.top = `${top - (layerRect?.top || 0)}px`;
  calendarDrag.ghost.style.width = `${layerRect?.width || Math.max(32, rect.width - 6)}px`;
  calendarDrag.ghost.querySelector("small").textContent = formatTime(drop.time);
  const viewport = calendarScrollElement().getBoundingClientRect();
  const edge = 52;
  calendarDrag.scrollVelocity = clientY < viewport.top + edge ? -12 : clientY > viewport.bottom - edge ? 12 : 0;
}

function runCalendarDragAutoscroll() {
  if (!calendarDrag?.started) return;
  if (!currentCalendarDrag()) return;
  if (calendarDrag.scrollVelocity) {
    const before = calendarScrollElement().scrollTop;
    calendarScrollElement().scrollTop += calendarDrag.scrollVelocity;
    if (calendarScrollElement().scrollTop !== before) {
      updateCalendarDragPosition(calendarDrag.lastPointer.x, calendarDrag.lastPointer.y);
    }
  }
  calendarDrag.raf = requestAnimationFrame(runCalendarDragAutoscroll);
}

function startCalendarDragPreview() {
  const ghost = calendarDrag.source.cloneNode(true);
  ghost.classList.add("calendar-drag-ghost");
  ghost.classList.remove("selected", "interaction-pressed", "interaction-released");
  ghost.removeAttribute("data-select-task");
  ghost.removeAttribute("data-edit-task");
  ghost.removeAttribute("data-calendar-drag-task");
  ghost.removeAttribute("aria-describedby");
  ghost.setAttribute("aria-hidden", "true");
  ghost.tabIndex = -1;
  ghost.style.height = `${calendarDrag.sourceRect.height}px`;
  document.body.append(ghost);
  calendarDrag.ghost = ghost;
  calendarDrag.started = true;
  calendarDrag.source.classList.add("is-drag-source");
  document.body.classList.add("is-calendar-dragging");
  calendarDrag.raf = requestAnimationFrame(runCalendarDragAutoscroll);
}

function clearCalendarDrag() {
  if (!calendarDrag) return;
  cancelAnimationFrame(calendarDrag.raf);
  calendarDrag.targetColumn?.classList.remove("calendar-drop-target");
  calendarDrag.source?.classList.remove("is-drag-source");
  calendarDrag.ghost?.remove();
  document.body.classList.remove("is-calendar-dragging");
  calendarDrag = null;
}

function cancelCalendarDrag({ announce = false } = {}) {
  if (!calendarDrag?.started) { calendarDrag = null; return; }
  suppressCalendarEventClickUntil = performance.now() + 650;
  clearCalendarDrag();
  if (announce) showToast("Calendar move cancelled.");
}

function currentCalendarDrag() {
  if (!calendarDrag) return false;
  if (calendarDrag.owner !== `${store.mode}:${store.user?.id || "local"}` || calendarDrag.source.isConnected === false) {
    cancelCalendarDrag(); return false;
  }
  return true;
}

let modalAnchor = null;
let modalClosing = false;
let cancelModalFocus = () => {};
function openTaskEditorWithFocus(reschedule, editorVersion, ownerVersion) {
  cancelModalFocus();
  let cancelled = false, interacted = false, armed = false;
  const intent = () => { interacted = true; };
  const focused = () => { if (armed) interacted = true; };
  const cleanup = () => {
    if (cancelled) return;
    cancelled = true;
    for (const type of ["pointerdown", "keydown", "input"]) els.modal.removeEventListener(type, intent, true);
    els.modal.removeEventListener("focusin", focused, true);
    if (cancelModalFocus === cleanup) cancelModalFocus = () => {};
  };
  for (const type of ["pointerdown", "keydown", "input"]) els.modal.addEventListener(type, intent, true);
  els.modal.addEventListener("focusin", focused, true);
  cancelModalFocus = cleanup;
  DuckPopupMotion.open(els.modal, modalAnchor, () => {
    if (cancelled) return;
    const untouched = !interacted;
    cleanup();
    if (!untouched || modalClosing || !els.modal.open || editorVersion !== taskAlertEditorVersion || ownerVersion !== plannerOwnerVersion) return;
    const active = document.activeElement;
    if (!els.modal.contains(active) || active === els.modal || active === els.form || active === els.form.elements.title || active?.id === "close-task-modal") {
      const target = reschedule ? els.form.elements.scheduledDate : els.form.elements.title;
      target.focus({ preventScroll: true });
      if (modalClosing || !els.modal.open || editorVersion !== taskAlertEditorVersion || ownerVersion !== plannerOwnerVersion || document.activeElement !== target) return;
      const form = els.form, bounds = form.getBoundingClientRect?.(), field = target.getBoundingClientRect?.();
      if (!bounds || !field || !(form.clientHeight > 0)) return;
      const top = bounds.top + (form.clientTop || 0), bottom = top + form.clientHeight;
      const inset = Math.min(8, Math.max(0, (form.clientHeight - (field.bottom - field.top)) / 2));
      const delta = field.top < top + inset ? field.top - top - inset : field.bottom > bottom - inset ? field.bottom - bottom + inset : 0;
      const next = Math.max(0, Math.min(form.scrollHeight - form.clientHeight, form.scrollTop + delta));
      if (delta && next !== form.scrollTop) form.scrollTop = next;
    }
  });
  // showModal focuses a native default control synchronously. Later focus changes
  // represent a user's chosen control and must survive the animation finishing.
  armed = true;
}
function taskAlertDraft() {
  const form = els.form.elements;
  return { ...(tasks.find(task => task.id === editingTaskId) || pendingTaskDraft || {}),
    scheduledStart: form.scheduledDate.value && form.scheduledTime.value ? `${form.scheduledDate.value}T${form.scheduledTime.value}` : null,
    workAlerts: taskAlertPreferences };
}
function renderTaskAlertFields() {
  if (!taskAlertPreferences) return;
  const domain = window.DuckWorkAlerts, draft = taskAlertDraft(), times = domain.resolve(draft, taskAlertPreferences);
  for (const channel of ["alarm", "notification"]) {
    const pref = taskAlertPreferences[channel], field = els.form.elements[`${channel}At`];
    els.form.elements[`${channel}Enabled`].checked = pref.enabled;
    field.value = times[`${channel}At`] || "";
    field.disabled = !pref.enabled;
    document.querySelector(`#${channel}-link-status`).textContent = pref.mode === "manual" ? "Custom time" : channel === "alarm" ? "Follows work start" : "Follows alarm time";
    document.querySelector(`[data-follow-alert="${channel}"]`).disabled = pref.mode !== "manual";
  }
  els.form.elements.alarmSound.value = taskAlertPreferences.alarm.sound;
  els.form.elements.alarmSnooze.value = String(taskAlertPreferences.alarm.snoozeMinutes);
  document.querySelector("#task-alarm-help").textContent = window.DuckTaskAlarms.native
    ? "Rings on this iPhone. Alarm permission is separate from normal notifications."
    : "Ringing alarms are available in the iPhone app. This preference is saved for it.";
  document.querySelector("#task-notification-help").textContent = window.DuckTaskNotifications.native
    ? "Shows a normal banner, separately from the ringing alarm. Allow notifications on this device."
    : window.DuckTaskNotifications.canSave()
      ? "Enable notifications on this device to receive a banner while DuckPlan is closed. Delivery depends on device and connection settings."
      : "Local reminders appear while this page is open. Enable notifications for browser banners; sign in on the hosted app for closed-page delivery.";
  const deliveries = domain.deliveries(draft), pending = Object.values(deliveries).filter(item => !["disabled", "unconfigured"].includes(item.status));
  document.querySelector("#task-alert-time-help").textContent = !times.alarmAt && !times.notificationAt
    ? "Choose a work start or custom alert time. Enabled alerts will follow it."
    : pending.some(item => ["past", "too-soon"].includes(item.status))
      ? "Past start times are kept on the calendar; their alerts are not scheduled."
      : pending.some(item => item.status === "too-far") ? "Device alerts can be scheduled up to one year ahead." : "Each alert can be turned off or given its own time.";
  const current = tasks.find(task => task.id === editingTaskId);
  document.querySelector("#task-alert-storage-help").hidden = !(store.mode === "cloud" && (store.supportsWorkAlerts === false || current?.workAlertsDeviceOnly));
  document.querySelector("#task-actual-time-help").textContent = store.mode === "cloud" && store.supportsTaskDetails && !current?.taskDetailsDeviceOnly
    ? "Log the total time you worked on this task. It is saved with your account and shared across your devices."
    : "Log the total time you worked on this task. It is saved on this device.";
  document.querySelector("#task-alarm-account").hidden = Boolean(store.user) || Boolean(window.DuckTaskAlarms.native);
  document.querySelector("#task-alarm-signup").href = store.configured ? new URL("#settings", location.href).href : "https://duckplan-latest.ocs-learning.workers.dev/#settings";
}
function validateEditedTaskAlerts(task) {
  const prefs = window.DuckWorkAlerts.normalize(task.workAlerts);
  const alarmChanged = taskAlertTimeChanges.has("alarm"), notificationChanged = taskAlertTimeChanges.has("notification");
  if (!alarmChanged) {
    prefs.alarm = { ...prefs.alarm, enabled: false, mode: "work", at: null };
    if (prefs.notification.mode === "alarm") prefs.notification.enabled = false;
  }
  if (!notificationChanged && !(alarmChanged && prefs.notification.mode === "alarm")) prefs.notification.enabled = false;
  window.DuckWorkAlerts.validate({ ...task, workAlerts: prefs });
}
function hydrateTaskAlertEditor(values, editorVersion, ownerVersion) {
  return workAlerts.refresh().then(() => {
    if (editorVersion !== taskAlertEditorVersion || ownerVersion !== plannerOwnerVersion || !els.modal.open || modalClosing) return;
    const hydrated = workAlerts.preferences({ ...values, scheduledStart: taskAlertDraft().scheduledStart });
    for (const field of taskAlertTouchedFields) {
      const [channel, key] = field.split(".");
      hydrated[channel][key] = taskAlertPreferences[channel][key];
    }
    taskAlertPreferences = hydrated;
    renderTaskAlertFields();
  });
}
els.form.addEventListener("input", event => {
  if (["scheduledDate", "scheduledTime"].includes(event.target.name)) renderTaskAlertFields();
});
els.form.addEventListener("change", event => {
  if (!taskAlertPreferences) return;
  const name = event.target.name;
  for (const channel of ["alarm", "notification"]) {
    if (name === `${channel}At`) {
      taskAlertPreferences = window.DuckWorkAlerts.editTime(taskAlertPreferences, channel, event.target.value);
      taskAlertTouchedFields.add(`${channel}.mode`); taskAlertTouchedFields.add(`${channel}.at`);
      if (!event.target.value) taskAlertTouchedFields.add(`${channel}.enabled`);
      taskAlertTimeChanges.add(channel);
    }
    if (name === `${channel}Enabled`) {
      const previous = taskAlertPreferences[channel];
      taskAlertPreferences = window.DuckWorkAlerts.setEnabled(taskAlertPreferences, channel, event.target.checked);
      taskAlertTouchedFields.add(`${channel}.enabled`);
      if (event.target.checked && previous.mode === "manual" && previous.at === null) {
        taskAlertTouchedFields.add(`${channel}.mode`); taskAlertTouchedFields.add(`${channel}.at`);
      }
      if (event.target.checked) taskAlertTimeChanges.add(channel); else taskAlertTimeChanges.delete(channel);
    }
  }
  if (name === "alarmSound") { taskAlertPreferences.alarm.sound = event.target.value; taskAlertTouchedFields.add("alarm.sound"); }
  if (name === "alarmSnooze") { taskAlertPreferences.alarm.snoozeMinutes = Number(event.target.value); taskAlertTouchedFields.add("alarm.snoozeMinutes"); }
  renderTaskAlertFields();
});
els.form.addEventListener("click", event => {
  const button = event.target.closest("[data-follow-alert]");
  if (!button || !taskAlertPreferences) return;
  taskAlertTouchedFields.add(`${button.dataset.followAlert}.mode`); taskAlertTouchedFields.add(`${button.dataset.followAlert}.at`);
  taskAlertPreferences = window.DuckWorkAlerts.follow(taskAlertPreferences, button.dataset.followAlert);
  taskAlertTimeChanges.add(button.dataset.followAlert);
  renderTaskAlertFields();
});
function openModal(prefill = {}) {
  cancelModalFocus();
  calendarTaskPreview.close({ immediate: true, restoreFocus: false });
  viewTransitions.settle();
  const source = prefill.source || (document.activeElement?.matches("button,[role='button'],a")
    ? document.activeElement : document.querySelector("#open-task-modal"));
  modalAnchor = DuckPopupMotion.capture(source);
  modalClosing = false;
  els.modal.inert = false;
  editingTaskId = prefill.id || null;
  const { id: ignoredDraftId, ...draft } = prefill.draft || {};
  pendingTaskDraft = editingTaskId ? null : draft;
  els.form.reset();
  const task = editingTaskId ? tasks.find((item) => item.id === editingTaskId) : null;
  const values = task || pendingTaskDraft || {};
  const scheduled = Model.scheduledParts(values);
  els.modalTitle.textContent = task ? "Edit task" : "Add task";
  els.modalKicker.textContent = task ? "Task details" : "Plan your work";
  els.saveTask.textContent = task ? "Save changes" : "Add to DuckPlan";
  els.saveTask.disabled = false;
  els.deleteTask.hidden = !task;
  els.form.elements.title.value = values.title || "";
  els.form.elements.classId.value = values.classId !== undefined ? values.classId || "" : store.listClasses()[0]?.id || "";
  els.form.elements.priority.value = values.priority || "Medium";
  els.form.elements.dueDate.value = task ? task.dueDate || "" : prefill.dueDate ?? values.dueDate ?? selectedDate;
  els.form.elements.dueTime.value = values.dueTime || prefill.dueTime || "";
  els.form.elements.notes.value = values.notes || "";
  els.form.elements.importance.value = values.importance || "";
  els.form.elements.urgency.value = values.urgency || "auto";
  els.form.elements.scheduledDate.value = scheduled?.date || prefill.scheduledDate || "";
  els.form.elements.scheduledTime.value = scheduled?.time || prefill.scheduledTime || "";
  const duration = String(values.durationMinutes || prefill.durationMinutes || 45);
  els.form.elements.durationMinutes.querySelectorAll("[data-custom-duration]").forEach((option) => option.remove());
  if (![...els.form.elements.durationMinutes.options].some((option) => option.value === duration)) {
    const option = new Option(`${duration} min`, duration);
    option.dataset.customDuration = "true";
    els.form.elements.durationMinutes.add(option);
  }
  els.form.elements.durationMinutes.value = duration;
  const choice = values.reminderChoice;
  els.form.elements.reminderChoice.value = taskReminderChoices.includes(choice) ? choice : "default";
  els.form.elements.actualMinutes.value = task?.actualMinutes ?? "";
  const editorVersion = ++taskAlertEditorVersion;
  const ownerVersion = plannerOwnerVersion;
  taskAlertHydrationError = null;
  taskAlertTimeChanges.clear();
  taskAlertTouchedFields.clear();
  taskAlertPreferences = workAlerts.preferences({ ...values, scheduledStart: els.form.elements.scheduledDate.value && els.form.elements.scheduledTime.value ? `${els.form.elements.scheduledDate.value}T${els.form.elements.scheduledTime.value}` : null });
  renderTaskAlertFields();
  taskAlertHydration = workAlertContextReady ? hydrateTaskAlertEditor(values, editorVersion, ownerVersion).catch(error => {
    if (editorVersion !== taskAlertEditorVersion || ownerVersion !== plannerOwnerVersion || !els.modal.open || modalClosing) return;
    taskAlertHydrationError = error;
    reportError(error);
  }) : Promise.resolve();
  document.querySelector('#task-alarm-save-error').textContent='';
  document.querySelector("#task-alarm-options").open = false;
  // Set this before synchronous reduced-motion focus measures the form; the
  // clarity observer applies the same state after the dialog opens.
  document.querySelector("#task-detail-options").open = Boolean(editingTaskId);
  document.querySelector("#task-schedule-options").open = Boolean(els.form.elements.scheduledDate.value || prefill.reschedule);
  document.querySelector("#actual-time-options").open = Boolean(task && Number.isInteger(task.actualMinutes));
  taskLibrary?.renderTaskResources(els.form.elements.classId.value);
  DuckPopupMotion.mark(modalAnchor, "fields");
  openTaskEditorWithFocus(Boolean(prefill.reschedule), editorVersion, ownerVersion);
}
function closeModal() {
  if (!els.modal.open || modalClosing) return;
  cancelModalFocus();
  modalClosing = true;
  els.modal.inert = true;
  DuckPopupMotion.close(els.modal, modalAnchor, () => {
    els.modal.close();
    els.modal.inert = false;
    modalClosing = false;
    const returnTarget = modalAnchor?.element?.isConnected ? modalAnchor.element : document.querySelector(".view.active button");
    returnTarget?.focus({ preventScroll: true });
    refreshReminders({ announce: true });
  });
}
els.modal.addEventListener("cancel", (event) => { event.preventDefault(); closeModal(); });
els.modal.addEventListener("close", () => {
  if (els.modal.open) return;
  cancelModalFocus();
  DuckPopupMotion.reset(els.modal);
  editingTaskId = null;
  pendingTaskDraft = null;
});
DuckPopupMotion.schedulePrepare(els.modal);

// Button-origin motion belongs to popout dialogs, not page or calendar changes.
function commitMaterialAction(source, update, event) {
  update();
  setupButtonMaterial();
}

document.addEventListener("click", (event) => {
  if (performance.now() < suppressCalendarEventClickUntil && event.target.closest(".calendar-event-block")) {
    suppressCalendarEventClickUntil = 0;
    event.preventDefault();
    return;
  }
  const drawerDismiss = event.target.closest(".drawer-close,.sidebar-scrim"); if (drawerDismiss) setSidebar(false);
  const viewButton = event.target.closest(".nav-item[data-view]"); if (viewButton?.matches("button")) navigateView(viewButton.dataset.view, sidebar.contains(viewButton), viewButton);
  const goButton = event.target.closest("[data-go]"); if (goButton) { event.preventDefault(); navigateView(goButton.dataset.go, sidebar.contains(goButton), goButton); }
  const completeOverdue = event.target.closest("[data-complete-overdue]");
  if (completeOverdue) { void completeAllOverdue(completeOverdue); return; }
  const dayList = event.target.closest("#view-calendar [data-day-list]");
  if (dayList) { calendarTaskPreview.openDayList(dayList.dataset.summaryDate, dayList.dataset.dayList, dayList); return; }
  const deadlinePointerControl = deadlineControlAtPointer(event);
  const deadlineGroup = deadlinePointerControl
    ? deadlinePointerControl.matches("[data-timed-deadline-group]") ? deadlinePointerControl : null
    : event.target.closest("#planner-calendar [data-timed-deadline-group]");
  if (deadlineGroup) {
    const group = calendarDates.timedDeadlineGroups(tasks, deadlineGroup.dataset.deadlineDate)
      .find(item => item.key === deadlineGroup.dataset.timedDeadlineGroup);
    if (group) calendarTaskPreview.openDeadlineGroup(group, deadlineGroup);
    return;
  }
  const calendarItem = deadlinePointerControl
    ? deadlinePointerControl.matches("[data-select-task]") ? deadlinePointerControl : null
    : event.target.closest("#planner-calendar [data-select-task]");
  if (calendarItem) {
    const taskId = calendarItem.dataset.selectTask;
    if (selectedTaskId !== taskId) selectTask(taskId);
    openModal({ id: taskId, source: calendarItem });
    return;
  }
  const overflow = event.target.closest("[data-deadline-overflow]");
  if (overflow) {
    const date = overflow.dataset.deadlineOverflow;
    if (expandedDeadlineDates.has(date)) expandedDeadlineDates.delete(date); else expandedDeadlineDates.add(date);
    renderCalendar({ autoScroll: false }); setupButtonMaterial(els.calendar);
    [...els.calendar.querySelectorAll("[data-deadline-overflow]")].find(control => control.dataset.deadlineOverflow === date)?.focus({ preventScroll: true });
    return;
  }
  const openDay = event.target.closest("[data-calendar-open-day]");
  if (openDay) { calendarView = "day"; selectDate(openDay.dataset.calendarOpenDay); return; }
  const reschedule = event.target.closest("[data-reschedule-task]");
  if (reschedule) { openModal({ id: reschedule.dataset.rescheduleTask, source: reschedule, reschedule: true }); return; }
  const dateButton = event.target.closest("[data-date]"); if (dateButton?.matches("button,.month-day")) selectDate(dateButton.dataset.date);
  const slot = event.target.closest("[data-slot-date]"); if (slot) { calendarFocusSlot = { date: slot.dataset.slotDate, time: slot.dataset.slotTime }; openModal({ source: slot, scheduledDate: slot.dataset.slotDate, scheduledTime: slot.dataset.slotTime, dueDate: slot.dataset.slotDate }); }
  const select = event.target.closest("[data-select-task]"); if (select) selectTask(select.dataset.selectTask);
  const edit = event.target.closest("[data-edit-task]"); if (edit) openModal({ source: edit, id: edit.dataset.editTask });
  const classButton = event.target.closest("[data-open-class]");
  if (classButton) {
    taskLibrary?.selectClass(classButton.dataset.openClass);
    document.querySelector("#class-library")?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    document.querySelector("#library-class-select")?.focus({ preventScroll: true });
  }
  const collapse = event.target.closest("[data-collapse]");
  if (collapse) {
    const name = collapse.dataset.collapse;
    window.DuckTaskCompletion?.cancel();
    collapsed[name] = !collapsed[name];
    const button = document.querySelector(`[data-collapse="${name}"]`);
    button.closest(".task-section").classList.toggle("collapsed", collapsed[name]);
    window.DuckExpansionMotion.setExpanded(els.lists[name], !collapsed[name], { trigger: button });
  }
  const groupToggle = event.target.closest("[data-task-group-toggle]");
  if (groupToggle) {
    const key = groupToggle.dataset.taskGroupToggle;
    window.DuckTaskCompletion?.cancel();
    const button = [...els.allList.querySelectorAll("[data-task-group-toggle]")].find(element => element.dataset.taskGroupToggle === key);
    if (!button) return;
    const open = button.getAttribute("aria-expanded") !== "true";
    if (open) collapsedTaskGroups.delete(key); else collapsedTaskGroups.add(key);
    window.DuckExpansionMotion.setExpanded(document.getElementById(button.getAttribute("aria-controls")), open, { trigger: button });
  }
});
document.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-task-id]");
  if (!checkbox) return;
  const task = tasks.find((item) => item.id === checkbox.dataset.taskId); if (!task) return;
  const completed = checkbox.checked, owner = plannerOwnerVersion;
  const feedback = window.DuckTaskCompletion?.forCheckbox(checkbox);
  store.toggleComplete(task.id, completed).then(() => {
    if (owner !== plannerOwnerVersion || feedback?.saved() === false) return;
    showToast(completed ? "Task completed. Nice work!" : "Task returned to your plan.");
  }, error => {
    feedback?.failed();
    if (owner === plannerOwnerVersion) reportError(error);
  });
});
document.querySelectorAll(".filter-chip").forEach((chip) => chip.addEventListener("click", () => {
  window.DuckTaskCompletion?.cancel();
  document.querySelectorAll(".filter-chip").forEach((item) => { item.classList.toggle("active", item === chip); item.setAttribute("aria-pressed", String(item === chip)); });
  currentFilter = chip.dataset.filter; renderAllTasks(); setupButtonMaterial();
}));
document.querySelector("#task-grouping").addEventListener("change", event => {
  window.DuckTaskCompletion?.cancel();
  taskGrouping = ["plan", "class", "priority"].includes(event.target.value) ? event.target.value : "plan";
  renderAllTasks(); setupButtonMaterial();
});
document.querySelectorAll("[data-task-layout]").forEach((button) => button.addEventListener("click", () => {
  window.DuckTaskCompletion?.cancel();
  taskLayout = button.dataset.taskLayout;
  renderAllTasks(); setupButtonMaterial();
}));
els.form.elements.classId.addEventListener("change", () => taskLibrary?.renderTaskResources(els.form.elements.classId.value));

function templateCalendarPlacement(event, template) {
  const target = event.target.closest("[data-slot-date], [data-date], [data-deadline-date]");
  const column = event.target.closest("[data-column-date]");
  const date = target?.dataset.slotDate || target?.dataset.date || target?.dataset.deadlineDate || column?.dataset.columnDate;
  if (!date || !template) return null;
  const rect = column?.getBoundingClientRect();
  const hourHeight = rect ? rect.height / CALENDAR_HOURS : 62;
  const drop = PlannerUI.snapTemplateDrop({ date, pointerY: rect ? event.clientY : (9 - CALENDAR_START_HOUR) * hourHeight, columnTop: rect?.top ?? 0, hourHeight, durationMinutes: template.durationMinutes });
  return drop ? { ...drop, column, rect, hourHeight, source: target || column } : null;
}

function hideTemplatePreview() {
  if (!templateDrag) return;
  templateDrag.preview.hidden = true;
  clearTemplateTarget();
}

function clearTemplateTarget() {
  if (!templateDrag) return;
  templateDrag.target?.classList.remove("calendar-drop-target");
  templateDrag.column = null; templateDrag.target = null; templateDrag.velocity = 0;
}

function clearTemplateDrag() {
  if (!templateDrag) return;
  hideTemplatePreview(); cancelAnimationFrame(templateDrag.raf);
  templateDrag.preview.remove(); templateDrag.nativeImage?.remove(); templateDrag = null;
}

function syncCalendarDropPreview(item) {
  if (!templateDrag) return;
  templateDrag.template = item;
  const title = templateDrag.preview.querySelector("strong");
  if (title.textContent !== item.title) title.textContent = item.title;
  const info = classInfo(item);
  const color = info.color;
  templateDrag.preview.style.setProperty("--course-default-fill", info.defaultWorkFill || "initial");
  const value = /^#[0-9a-f]{6}$/i.test(color) ? color : "#8f8a7d";
  if (templateDrag.preview.style.getPropertyValue("--course-color") !== value) templateDrag.preview.style.setProperty("--course-color", value);
}

function refreshCalendarDropItem() {
  if (!templateDrag) return false;
  if (templateDrag.owner !== `${store.mode}:${store.user?.id || "local"}`) { clearTemplateDrag(); return false; }
  const item = templateDrag.libraryId ? taskLibrary?.draftForTemplate(templateDrag.libraryId)
    : store.listItems().find(task => task.id === templateDrag.template.id && !task.completed);
  if (!item) { clearTemplateDrag(); return false; }
  syncCalendarDropPreview(item);
  return true;
}

function showFreeCalendarPreview(clientX, clientY, time = null) {
  if (!templateDrag || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
  clearTemplateTarget();
  const preview = templateDrag.preview;
  if (preview.parentElement !== document.body) document.body.append(preview);
  const columnRect = els.calendar.querySelector(".timeline-column")?.getBoundingClientRect();
  const width = Math.min(180, Math.max(88, columnRect?.width > 6 ? columnRect.width - 6 : 148));
  const height = Math.min(156, Math.max(30, Number(templateDrag.template.durationMinutes || 45) * 62 / 60));
  const left = Math.max(4, Math.min(window.innerWidth - width - 4, clientX + 12));
  const top = Math.max(4, Math.min(window.innerHeight - height - 4, clientY + 12));
  Object.assign(preview.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`, clipPath: "none" });
  preview.classList.toggle("is-short", height < CALENDAR_COMPACT_BLOCK_HEIGHT);
  preview.dataset.dragPlacement = "free";
  preview.querySelector("small").textContent = `${time ? `${formatTime(time)} · ` : ""}${templateDrag.template.durationMinutes} min`;
  preview.hidden = false;
}

function fitCalendarDropPreview({ left, top, width, height }, mode) {
  const preview = templateDrag.preview, viewport = calendarScrollElement().getBoundingClientRect();
  const layer = mode === "timeline" ? templateDrag.column?.querySelector(".calendar-work-layer") : null;
  const parent = layer || document.body;
  if (preview.parentElement !== parent) parent.append(preview);
  const layerRect = layer?.getBoundingClientRect();
  Object.assign(preview.style, {
    left: layer ? "0px" : `${left}px`, top: `${top - (layerRect?.top || 0)}px`, width: `${layerRect?.width || width}px`, height: `${height}px`,
    clipPath: layer ? "none" : `inset(${Math.max(0, viewport.top - top)}px ${Math.max(0, left + width - viewport.right)}px ${Math.max(0, top + height - viewport.bottom)}px ${Math.max(0, viewport.left - left)}px)`,
  });
  preview.dataset.dragPlacement = mode;
  preview.classList.toggle("is-short", height < CALENDAR_COMPACT_BLOCK_HEIGHT);
  preview.hidden = false;
}

function updateTemplatePreview(event) {
  if (!templateDrag) return null;
  if (templateDrag.owner !== `${store.mode}:${store.user?.id || "local"}`) { clearTemplateDrag(); return null; }
  templateDrag.pointer = { x: event.clientX, y: event.clientY };
  const placement = event.target.closest("#planner-calendar") && templateCalendarPlacement(event, templateDrag.template);
  clearTemplateTarget();
  if (!placement) { showFreeCalendarPreview(event.clientX, event.clientY); return null; }
  const { minutes, time } = placement;
  const preview = templateDrag.preview;
  preview.querySelector("small").textContent = `${formatTime(time)} · ${templateDrag.template.durationMinutes} min`;
  const monthDay = placement.source.closest(".month-day");
  if (monthDay) {
    const rect = monthDay.getBoundingClientRect(), top = rect.top + 34;
    monthDay.classList.add("calendar-drop-target"); templateDrag.target = monthDay;
    fitCalendarDropPreview({ left: rect.left + 5, top, width: Math.max(24, rect.width - 10), height: Math.max(24, Math.min(46, rect.bottom - top - 5)) }, "month");
    return placement;
  }
  const column = placement.column || [...els.calendar.querySelectorAll(".timeline-column")].find(item => item.dataset.columnDate === placement.date);
  if (!column) { showFreeCalendarPreview(event.clientX, event.clientY, time); return placement; }
  const rect = column.getBoundingClientRect(), hourHeight = rect.height / CALENDAR_HOURS;
  const top = rect.top + (minutes - CALENDAR_START_HOUR * 60) * hourHeight / 60;
  const height = Math.max(30, templateDrag.template.durationMinutes * hourHeight / 60);
  const viewport = calendarScrollElement().getBoundingClientRect();
  // Date/deadline headers keep their existing 09:00 default. If that time is
  // offscreen, show an honest labeled block by the pointer rather than a false slot.
  if (!placement.column && (top + height <= viewport.top || top >= viewport.bottom)) {
    showFreeCalendarPreview(event.clientX, event.clientY, time); return placement;
  }
  column.classList.add("calendar-drop-target"); templateDrag.column = column; templateDrag.target = column;
  fitCalendarDropPreview({ left: rect.left + 3, top, width: Math.max(32, rect.width - 6), height }, "timeline");
  if (placement.column) templateDrag.velocity = event.clientY < viewport.top + 52 ? -12 : event.clientY > viewport.bottom - 52 ? 12 : 0;
  return placement;
}

function scrollTemplatePreview() {
  if (!templateDrag) return;
  if (templateDrag.owner !== `${store.mode}:${store.user?.id || "local"}` || templateDrag.source?.isConnected === false) {
    const movingTask = !templateDrag.libraryId;
    clearTemplateDrag();
    if (movingTask) taskListDrag?.cancel();
    return;
  }
  if (templateDrag.velocity) {
    const previous = calendarScrollElement().scrollTop;
    calendarScrollElement().scrollTop += templateDrag.velocity;
    if (previous !== calendarScrollElement().scrollTop) {
      const { x, y } = templateDrag.pointer;
      const target = document.elementFromPoint(x, y);
      if (target) updateTemplatePreview({ target, clientX: x, clientY: y });
    }
  }
  if (templateDrag) templateDrag.raf = requestAnimationFrame(scrollTemplatePreview);
}

function beginCalendarDropPreview(template, event = null) {
  clearTemplateDrag();
  const preview = document.createElement("div");
  preview.className = "calendar-event-block calendar-drag-ghost template-drop-preview";
  preview.setAttribute("aria-hidden", "true"); preview.hidden = true;
  preview.innerHTML = `<strong>${safeText(template.title)}</strong><small></small>`;
  document.body.append(preview);
  // The browser's immutable source bitmap would otherwise be a second, larger
  // drag image. Keep a transparent bitmap attached for the whole native gesture.
  let nativeImage = null;
  if (typeof event?.dataTransfer?.setDragImage === "function") {
    nativeImage = document.createElement("canvas"); nativeImage.width = 1; nativeImage.height = 1;
    nativeImage.className = "calendar-native-drag-image"; nativeImage.setAttribute("aria-hidden", "true");
    document.body.append(nativeImage);
    try { event.dataTransfer.setDragImage(nativeImage, 0, 0); } catch { nativeImage.remove(); nativeImage = null; }
  }
  templateDrag = { template, preview, nativeImage, source: event?.target?.closest?.('[draggable="true"]') || event?.target || null, owner: `${store.mode}:${store.user?.id || "local"}`, target: null, column: null, velocity: 0, pointer: null, raf: requestAnimationFrame(scrollTemplatePreview) };
  syncCalendarDropPreview(template);
  if (event) showFreeCalendarPreview(event.clientX, event.clientY);
}
document.addEventListener("dragstart", event => {
  const id = taskLibrary?.readTemplateDrop(event.dataTransfer);
  const template = id && taskLibrary.draftForTemplate(id);
  if (!template || event.defaultPrevented) return;
  beginCalendarDropPreview(template, event);
  templateDrag.libraryId = id;
});
document.addEventListener("dragend", clearTemplateDrag);
window.addEventListener("blur", clearTemplateDrag);
window.addEventListener("pagehide", clearTemplateDrag);

function updateNativeTemplateDrag(event) {
  if (![...(event.dataTransfer?.types || [])].includes(window.DuckPlanLibrary?.TEMPLATE_MIME)) return;
  if (!refreshCalendarDropItem()) return;
  const placement = updateTemplatePreview(event);
  if (event.target.closest("#planner-calendar, #all-task-list, #daily-task-panel") && !event.target.closest("#calendar-assignment-templates")) {
    event.preventDefault();
    event.dataTransfer.dropEffect = templateDrag && event.target.closest("#planner-calendar") && !placement ? "none" : "copy";
  }
}
document.addEventListener("dragenter", updateNativeTemplateDrag);
document.addEventListener("dragover", updateNativeTemplateDrag);
document.addEventListener("drag", event => {
  if (!templateDrag || (!event.clientX && !event.clientY)) return;
  if (!refreshCalendarDropItem()) return;
  const target = document.elementFromPoint(event.clientX, event.clientY);
  if (target) updateTemplatePreview({ target, clientX: event.clientX, clientY: event.clientY });
});
document.addEventListener("drop", (event) => {
  const templateId = taskLibrary?.readTemplateDrop(event.dataTransfer);
  if (!templateId) { clearTemplateDrag(); return; }
  if (!templateDrag || templateDrag.libraryId !== templateId || templateDrag.owner !== `${store.mode}:${store.user?.id || "local"}`) {
    event.preventDefault(); clearTemplateDrag(); return;
  }
  const calendar = event.target.closest("#planner-calendar");
  if (calendar) {
    event.preventDefault();
    const template = taskLibrary.draftForTemplate(taskLibrary.readTemplateDrop(event.dataTransfer));
    const placement = templateCalendarPlacement(event, template);
    if (placement) taskLibrary.handleTemplateDrop(event, placement);
    else if (template) showToast(template.durationMinutes > CALENDAR_HOURS * 60 ? "This template does not fit the visible day. Choose Schedule to set a work time." : "Drop onto a calendar day or time to schedule this template.");
  } else if (event.target.closest("#all-task-list, #daily-task-panel") && !event.target.closest("#calendar-assignment-templates")) {
    event.preventDefault();
    taskLibrary.addToTasks(taskLibrary.readTemplateDrop(event.dataTransfer));
  }
  clearTemplateDrag();
});
document.querySelectorAll("[data-calendar-view]").forEach((button) => button.addEventListener("click", (event) => commitMaterialAction(button,() => { calendarView = button.dataset.calendarView; renderCalendar({ autoScroll: true }); },event)));
sidebarToggles.forEach((toggle) => toggle.addEventListener("click", event => { event.preventDefault(); const nextOpen = !document.body.classList.contains("sidebar-open"); setTaskPanel(false, false); setSidebar(nextOpen); }));
els.taskPanelToggle.addEventListener("click", (event) => setTaskPanel(!document.body.classList.contains("task-panel-open"), true, event.currentTarget));
els.phoneTaskSummary?.addEventListener("click", (event) => setTaskPanel(!document.body.classList.contains("task-panel-open"), true, event.currentTarget));
document.querySelectorAll("[data-close-task-panel]").forEach((button) => button.addEventListener("click", () => setTaskPanel(false)));
compactPlannerQuery.addEventListener("change", () => setTaskPanel(false, false));
phonePlannerQuery.addEventListener("change", () => {
  const wasOpen = document.body.classList.contains("task-panel-open");
  setTaskPanel(false, false);
  if (wasOpen && !phonePlannerQuery.matches) document.querySelector(calendarLibraryTabs?.selected === "templates" ? "#calendar-templates-tab" : "#plan-selected-date").focus({ preventScroll: true });
  renderDailyPlan();
  renderCalendar({ autoScroll: true });
  setupButtonMaterial();
});
document.addEventListener("keydown", (event) => {
  if (els.modal.open || document.querySelector("dialog[open]")) return;
  if (event.key === "Tab" && phonePlannerQuery.matches && document.body.classList.contains("task-panel-open")) {
    const controls = [...els.taskPanel.querySelectorAll("button,input,select,textarea,a[href],[tabindex='0']")]
      .filter((control) => !control.disabled && control.tabIndex >= 0 && !control.closest("[hidden], [inert]") && control.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  if (event.key !== "Escape") return;
  if (templateDrag) { clearTemplateDrag(); return; }
  if (calendarDrag?.started) cancelCalendarDrag({ announce: true });
  else if (document.body.classList.contains("task-panel-open")) setTaskPanel(false);
  else if (document.body.classList.contains("sidebar-open")) setSidebar(false);
});
window.addEventListener("hashchange", () => { if (location.hash === "#planner-sidebar") setSidebar(true); });
document.querySelector("#calendar-previous").addEventListener("click", () => selectDate(Model.shiftView(calendarView, selectedDate, -1)));
document.querySelector("#calendar-next").addEventListener("click", () => selectDate(Model.shiftView(calendarView, selectedDate, 1)));
document.querySelector("#calendar-today").addEventListener("click", () => selectDate(nowKey()));
const calendarSwipe = window.DuckCalendarSwipe?.create({
  roots: [els.calendar, els.phoneWeekStrip], getScroller: calendarScrollElement,
  enabled: () => window.matchMedia("(any-pointer: coarse)").matches && document.body.dataset.view === "calendar"
    && !document.querySelector("dialog[open]") && !document.body.matches(".task-panel-open,.sidebar-open") && !calendarDrag && !templateDrag,
  getContext: () => `${store.mode}:${store.user?.id || "local"}:${calendarView}:${selectedDate}:${phonePlannerQuery.matches}`,
  ignoreTarget: target => Boolean(target.closest("input,select,textarea,a,[contenteditable]")
    || (!phonePlannerQuery.matches && target.closest("[data-calendar-drag-task]"))),
  navigate: direction => selectDate(Model.shiftView(calendarView, selectedDate, direction)),
});
window.addEventListener("blur", () => calendarSwipe?.cancel());
window.addEventListener("pagehide", () => calendarSwipe?.cancel());
els.calendar.addEventListener("scroll", event => {
  if (event.target === calendarScrollElement() && !calendarProgrammaticScroll) calendarUserScrolled = true;
}, { passive: true, capture: true });
els.calendar.addEventListener("pointerdown", (event) => {
  const source = event.target.closest("[data-calendar-drag-task]");
  if (!source || event.button !== 0 || event.isPrimary === false || calendarView === "month") return;
  if (phonePlannerQuery.matches && event.pointerType === "touch") return;
  const task = tasks.find((item) => item.id === source.dataset.calendarDragTask);
  if (!task) return;
  const sourceRect = source.getBoundingClientRect();
  calendarDrag = {
    owner: `${store.mode}:${store.user?.id || "local"}`,
    pointerId: event.pointerId,
    source,
    sourceRect,
    task,
    startX: event.clientX,
    startY: event.clientY,
    offsetY: event.clientY - sourceRect.top,
    lastPointer: { x: event.clientX, y: event.clientY },
    scrollVelocity: 0,
    started: false,
    drop: null,
    ghost: null,
    targetColumn: null,
    raf: 0,
  };
  source.setPointerCapture?.(event.pointerId);
});
els.calendar.addEventListener("pointermove", (event) => {
  if (!calendarDrag || event.pointerId !== calendarDrag.pointerId) return;
  if (!currentCalendarDrag()) return;
  const distance = Math.hypot(event.clientX - calendarDrag.startX, event.clientY - calendarDrag.startY);
  if (!calendarDrag.started && distance < 5) return;
  event.preventDefault();
  if (!calendarDrag.started) startCalendarDragPreview();
  updateCalendarDragPosition(event.clientX, event.clientY);
});
els.calendar.addEventListener("pointerup", (event) => {
  if (!calendarDrag || event.pointerId !== calendarDrag.pointerId) return;
  if (!currentCalendarDrag()) return;
  if (!calendarDrag.started) { calendarDrag = null; return; }
  event.preventDefault();
  const { drop } = calendarDrag;
  const task = store.listItems().find(item => item.id === calendarDrag.task.id && !item.completed);
  suppressCalendarEventClickUntil = performance.now() + 650;
  clearCalendarDrag();
  if (drop && task) moveCalendarTask(task, drop);
});
els.calendar.addEventListener("pointercancel", (event) => {
  if (calendarDrag && event.pointerId === calendarDrag.pointerId) cancelCalendarDrag();
});
els.calendar.addEventListener("keydown", (event) => {
  const scheduledEvent = event.target.closest("[data-calendar-drag-task]");
  if (scheduledEvent && event.altKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    const task = tasks.find((item) => item.id === scheduledEvent.dataset.calendarDragTask);
    const parts = task && Model.scheduledParts(task);
    if (!task || !parts) return;
    event.preventDefault();
    const duration = Number(task.durationMinutes || 45);
    const minimum = CALENDAR_START_HOUR * 60;
    const maximum = CALENDAR_END_HOUR * 60 - duration;
    let date = parts.date;
    let minutes = parts.minutes;
    if (event.key === "ArrowUp") minutes -= 15;
    if (event.key === "ArrowDown") minutes += 15;
    if (event.key === "ArrowLeft") date = Model.addDays(date, -1);
    if (event.key === "ArrowRight") date = Model.addDays(date, 1);
    minutes = Math.max(minimum, Math.min(maximum, minutes));
    moveCalendarTask(task, { date, minutes, time: Model.timeFromMinutes(minutes) }, { focus: true });
    return;
  }
  const slot = event.target.closest(".calendar-slot");
  if (!slot || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const dates = phonePlannerQuery.matches && calendarView === "week" ? [selectedDate] : Model.datesForView(calendarView, selectedDate);
  const next = PlannerUI.nextSlot({ date: slot.dataset.slotDate, time: slot.dataset.slotTime }, event.key, dates);
  const target = els.calendar.querySelector(`[data-slot-date="${next.date}"][data-slot-time="${next.time}"]`);
  if (!target) return;
  slot.tabIndex = -1;
  target.tabIndex = 0;
  calendarFocusSlot = next;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
});
document.querySelector("#plan-selected-date").addEventListener("click", event => openModal({ source: event.currentTarget, dueDate: selectedDate }));
document.querySelector("#phone-add-task")?.addEventListener("click", event => openModal({ source: event.currentTarget, dueDate: selectedDate }));
document.querySelector("#open-task-modal").addEventListener("click", event => openPrimaryAction(event.currentTarget));
document.querySelector("#close-task-modal").addEventListener("click", closeModal);
document.querySelector("#cancel-task").addEventListener("click", closeModal);
els.modal.addEventListener("click", event => {
  if (event.target !== els.modal) return;
  const box=els.modal.getBoundingClientRect();
  if(event.clientX<box.left || event.clientX>box.right || event.clientY<box.top || event.clientY>box.bottom)closeModal();
});
els.search.addEventListener("input", () => { window.DuckTaskCompletion?.cancel(); searchTerm = els.search.value.trim().toLowerCase(); if (searchTerm) setView("tasks"); renderAllTasks(); });
els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (els.saveTask.disabled) return;
  const hydrationEditorVersion = taskAlertEditorVersion, hydrationOwnerVersion = plannerOwnerVersion;
  const currentHydration = () => hydrationEditorVersion === taskAlertEditorVersion && hydrationOwnerVersion === plannerOwnerVersion && els.modal.open && !modalClosing;
  els.saveTask.disabled = true;
  await taskAlertHydration;
  if (!currentHydration()) return;
  els.saveTask.disabled = false;
  if (taskAlertHydrationError) {
    document.querySelector("#task-alarm-save-error").textContent = "Couldn't load your saved alert settings. Close this editor and try again.";
    return;
  }
  const form = new FormData(els.form); const title = form.get("title").trim(); if (!title) return;
  const wasEditing = Boolean(editingTaskId);
  const scheduledDate = form.get("scheduledDate"); const scheduledTime = form.get("scheduledTime");
  const existing = editingTaskId ? tasks.find((task) => task.id === editingTaskId) : null;
  const next = { ...pendingTaskDraft, ...existing, title, classId: form.get("classId") || null, priority: form.get("priority"), dueDate: form.get("dueDate"), dueTime: form.get("dueTime"), scheduledStart: scheduledDate && scheduledTime ? `${scheduledDate}T${scheduledTime}` : null, scheduledEnd: null, durationMinutes: Number(form.get("durationMinutes") || 45), notes: String(form.get("notes") || ""), importance: form.get("importance") || null, urgency: form.get("urgency") || "auto", schemaVersion: 2 };
  const reminderChoice = form.get("reminderChoice");
  next.reminderChoice = taskReminderChoices.includes(reminderChoice) ? reminderChoice : "default";
  const loggedMinutes = form.get("actualMinutes");
  next.actualMinutes = loggedMinutes === "" ? null : Number(loggedMinutes);
  next.workAlerts = window.DuckWorkAlerts.normalize(taskAlertPreferences);
  try { validateEditedTaskAlerts(next); }
  catch (error) { document.querySelector("#task-alarm-save-error").textContent = error.message; els.form.elements[error.field]?.focus(); return; }
  els.saveTask.disabled=true;
  const saveOwnerVersion = plannerOwnerVersion, saveEditorVersion = taskAlertEditorVersion;
  const currentSave = () => saveOwnerVersion === plannerOwnerVersion && saveEditorVersion === taskAlertEditorVersion && els.modal.open && !modalClosing;
  let taskWasSaved = false;
  try {
    const saved=await saveTaskWithAlerts(next);
    if (!currentSave()) return;
    taskWasSaved = true;
    editingTaskId=saved.id;
    closeModal();
    showToast(wasEditing ? "Task and alert settings updated." : "Task and alert settings saved.");
  } catch(error) {
    if (!currentSave()) return;
    if (error.savedTask) { editingTaskId = error.savedTask.id; pendingTaskDraft = null; }
    if (taskWasSaved || error.savedTask || error.taskSaved) document.querySelector('#task-alarm-save-error').textContent = error.message;
    else {
      const message = document.querySelector("#task-form-error");
      message.hidden = false; message.textContent = error.message || "Couldn't save this task. Please try again.";
    }
  } finally { if (currentSave()) els.saveTask.disabled=false; }
});
els.deleteTask.addEventListener("click", () => {
  if (!editingTaskId) return;
  const deletedTask = tasks.find((task) => task.id === editingTaskId);
  if (!deletedTask) return;
  closeModal();
  store.deleteItem(deletedTask.id).then(() => showToast("Task deleted."), reportError);
});
document.querySelector("#notification-button").addEventListener("click", () => {
  setView("settings");
  refreshReminders();
  document.querySelector("#reminders-heading").focus();
});
notificationPermissionButton.addEventListener("click", async () => {
  const state = notificationCapability();
  if (state === "granted") {
    const icon = new URL("./assets/duckplan-sigma-icon-v11-transparent-512.png", location.href).href;
    const result = await displayBrowserNotification(BrowserNotifications.testNotification({ icon }));
    showToast(result.status === "submitted"
      ? "Test submitted to your browser; device display is not confirmed."
      : "The browser could not submit the test. In-app reminders still work.");
    return;
  }
  if (state !== "default") return;
  notificationPermissionButton.disabled = true;
  try {
    await window.Notification.requestPermission();
  } catch {
    showToast("The browser could not open notification permission settings.");
  } finally {
    const nextState = updateNotificationPermission();
    if (nextState !== "default") {
      showToast(nextState === "granted"
        ? "Device notifications enabled."
        : "Device notifications were not enabled. In-app reminders will still work.");
    }
  }
});
reminderToggle.addEventListener("change", () => {
  reminderSettings.enabled = reminderToggle.checked;
  saveReminderSettings();
  refreshReminders({ announce: true });
});
reminderLead.addEventListener("change", () => {
  reminderSettings.lead = Number(reminderLead.value);
  saveReminderSettings();
  refreshReminders({ announce: true });
});
els.accountSettings.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const submitter = event.submitter || form.querySelector('button[type="submit"]');
  if (!submitter || submitter.disabled) return;
  const data = new FormData(form);
  const value = (name) => String(data.get(name) || "");
  if (form.id === "sign-in-form" || form.id === "sign-up-form") {
    const email = value("email").trim();
    if (form.id === "sign-up-form") runAction(submitter, async () => { accountMode = null; showRecoveryCode(await store.signUp(email, value("password"))); showToast("Account created. Save your recovery code."); });
    else runAction(submitter, async () => { accountMode = null; await store.signIn(email, value("password")); showToast(`Signed in as ${email}.`); });
  }
  if (form.id === "recover-form") runAction(submitter, async () => { accountMode = null; showRecoveryCode(await store.recoverAccount(value("email").trim(), value("recoveryCode"), value("newPassword"))); showToast("Password reset. Save your new recovery code."); });
  const ownerVersion = plannerOwnerVersion;
  if (form.id === "password-form") runAction(submitter, async () => {
    const code = await store.changePassword(value("currentPassword"), value("newPassword"));
    if (ownerVersion !== plannerOwnerVersion) return;
    setAccountMode(null, { focus: false }); showRecoveryCode(code); showToast("Password saved.");
  });
  if (form.id === "recovery-code-form") runAction(submitter, async () => {
    const code = await store.newRecoveryCode(value("password"));
    if (ownerVersion !== plannerOwnerVersion) return;
    showRecoveryCode(code); showToast("New recovery code created.");
  });
});
els.accountSettings.addEventListener("click", (event) => {
  const button = event.target.closest("button"); if (!button) return;
  if (button.id === "google-sign-in") runAction(button, () => store.signInWithGoogle());
  if (button.dataset.accountMode) setAccountMode(button.dataset.accountMode);
  if (button.id === "show-recover") setAccountMode("recover");
  if (button.id === "show-sign-in") setAccountMode("sign-in");
  if (button.id === "show-change-password") setAccountMode("change-password");
  if (button.id === "show-recovery-code") setAccountMode("recovery-code");
  if (button.hasAttribute("data-account-cancel")) { setAccountMode(null, { focus: false }); els.accountSettings.querySelector("#show-change-password")?.focus(); }
  if (button.id === "copy-recovery") runAction(button, async () => { await navigator.clipboard.writeText(shownRecoveryCode); showToast("Recovery code copied."); });
  if (button.id === "dismiss-recovery") { shownRecoveryCode = null; renderAccount(); }
  if (button.id === "sign-out") runAction(button, async () => { shownRecoveryCode = null; accountMode = "sign-in"; await workAlerts.detach(); await store.signOut(); showToast("Signed out. Showing local tasks."); });
  if (button.id === "dismiss-import") { store.dismissLocalImport(); refreshAccountState(); }
  if (button.id === "import-local") runAction(button, async () => { await store.importLocalTasks(); showToast("Local planner data imported."); await refreshAccountState(); });
});
els.axisSettings.addEventListener("submit", (event) => {
  if (event.target.id !== "axis-form") return;
  event.preventDefault();
  const submitter = event.submitter || event.target.querySelector('button[type="submit"]');
  if (!submitter || submitter.disabled) return;
  const input = event.target.elements.icalUrl;
  let link;
  input.removeAttribute("aria-invalid");
  try { link = window.DuckAxisIcal.normalizeFeedUrl(input.value); }
  catch (error) {
    const feedback = els.axisSettings.querySelector("[data-connection-feedback]");
    feedback.textContent = error.message; feedback.hidden = false;
    input.setAttribute("aria-invalid", "true");
    showToast(error.message); input.focus(); return;
  }
  runAction(submitter, async () => {
    showToast("Connecting to Axis…");
    const result = await store.connectAxis(link);
    showToast(`Axis connected: ${result.added} assignments and ${result.classesAdded} classes imported.${axisCompletionNotice(result)}`);
    await refreshAccountState();
  });
});
els.axisSettings.addEventListener("click", (event) => {
  const button = event.target.closest("button"); if (!button) return;
  if (button.id === "connect-axis") { setAccountMode("sign-in"); els.accountSettings.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }
  if (button.id === "axis-sync-now") runAction(button, syncAxisNow);
  if (button.id === "axis-disconnect") runAction(button, async () => { await store.disconnectAxis(); showToast("Axis disconnected. Imported assignments remain."); await refreshAccountState(); });
});
els.syncInfo.addEventListener("click", () => {
  if (store.mode === "cloud" && axisStatus.connected) runAction(els.syncInfo, syncAxisNow);
  else { setView("settings"); showToast(store.mode === "cloud" ? "Paste your Axis feed link to connect." : "Sign in to connect Axis."); }
});
els.resetDemo.addEventListener("click", () => { store.resetLocalDemo().then(() => { selectedDate = nowKey(); showToast("Demo tasks reset."); }, reportError); });

function refreshDateBoundary() {
  const nextToday = nowKey();
  if (nextToday === observedToday) return;
  if (selectedDate === observedToday) selectedDate = nextToday;
  observedToday = nextToday; renderAll({ autoScrollCalendar: true });
}
function refreshPlannerClock() {
  refreshDateBoundary();
  refreshReminders({ announce: true });
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshPlannerClock(); });
window.addEventListener("focus", () => { updateNotificationPermission(); refreshPlannerClock(); });
window.addEventListener("duckplan:work-alert-capability", () => {
  if (workAlertContextReady) workAlerts.reconcile({ refresh: true }).catch(reportError);
});
setInterval(refreshPlannerClock, 60000);

const requestedView = location.hash.replace("#", "");
renderAll({ autoScrollCalendar: true });
renderAccount();
renderAxis();
setView(requestedView);
setTaskPanel(false, false);

refreshReminders({ announce: true });
updateNotificationPermission();


store.subscribe(({ reason }) => {
  if (reason === "context") window.DuckExpansionMotion?.settleWithin();
  if (["context", "error"].includes(reason)) window.DuckTaskCompletion?.cancel({ flush: false });
  if (reason === "context") { taskListDrag?.cancel(); cancelCalendarDrag(); clearTemplateDrag(); hideToast(); calendarTaskPreview.close({ immediate: true, restoreFocus: false }); expandedDeadlineDates.clear(); }
  const owner = store.user?.id || "local";
  if (owner !== renderedPlannerOwner) {
    calendarTaskPreview.close({ immediate: true, restoreFocus: false }); expandedDeadlineDates.clear();
    viewTransitions.cancel();
    renderedPlannerOwner = owner;
    nativeAccountSyncState = null; nativeSyncStatusRequest += 1;
    taskListDrag?.cancel();
    clearTemplateDrag();
    plannerOwnerVersion += 1;
    accountStateVersion += 1;
    shownRecoveryCode = null;
    accountMode = store.user ? null : "sign-in";
    axisStatus = { connected: false, lastSyncedAt: null, lastError: null };
    localImportCount = 0;
    if (classEditor) { DuckPopupMotion.cancel(classEditor); classEditor.close(); classEditor.remove(); classEditor = null; }
    if (els.modal.open) els.modal.close();
    els.form.reset();
    editingTaskId = null; pendingTaskDraft = null;
    renderAccount();
    renderAxis();
  }
  renderAll();
  if (["load", "auth"].includes(reason)) workAlertContextReady = true;
  if (workAlertContextReady && ["load", "auth", "remote", "persisted", "context"].includes(reason)) workAlerts.reconcile({ refresh: ["load", "auth"].includes(reason) }).catch(reportError);
  if (reason === "load" || reason === "auth") refreshAccountState();
  if (["load", "auth", "context"].includes(reason)) readNativeAccountSyncStatus();
});
store.init().then(async () => {
  const sampleCount = await window.DuckCompletionDemo?.seed({ demo: completionDemo, store, model: Model, alerts: window.DuckWorkAlerts });
  if (completionDemo?.enabled) {
    selectDate(nowKey());
    if (document.body.dataset.view === "calendar") setTaskPanel(true, false);
    if (sampleCount) showToast(`${sampleCount} sample tasks added.`);
  }
  workAlertContextReady = true;
  workAlerts.reconcile({ refresh: true }).catch(reportError);
  const alarmTarget=new URL(location.href).searchParams.get('alarmTask');
  if(alarmTarget) { openNotificationTarget(alarmTarget,'home'); const url=new URL(location.href); url.searchParams.delete('alarmTask'); history.replaceState(null,'',url); }
  const problem = store.takeAuthError();
  if (problem) showToast(problem);
}).catch(reportError);
