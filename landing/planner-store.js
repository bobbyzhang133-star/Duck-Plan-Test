(function plannerStoreFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckPlannerStore = api;
})(typeof window !== "undefined" ? window : globalThis, function buildPlannerStore() {
  // The only code that reads or writes planner data. Signed in to the DuckPlan Worker (cloudflare/),
  // data lives in Cloudflare D1; otherwise it stays in localStorage so the demo keeps working.
  const TASKS_KEY = "duckplan-demo-tasks-v1";
  const CLASSES_KEY = "duckplan-demo-classes-v1";
  const IMPORTED_KEY = "duckplan-local-import-v1";
  const DEVICE_EXTRAS_KEY = "duckplan-device-task-extras-v1";
  const TEMPLATES_KEY = "duckplan-demo-templates-v1";
  const RESOURCES_KEY = "duckplan-demo-resources-v1";
  const ORGANIZATION_KEY = "duckplan-demo-organization-v1";
  const PERSONAL_KEY = "duckplan-demo-personal-v1";
  const DEFAULT_TASK_COLOR = "#d2a31f";
  const DEFAULT_TASK_SOFT = "#fff3bf";
  const NO_CLASS = { id: null, name: "No class", color: DEFAULT_TASK_COLOR, soft: DEFAULT_TASK_SOFT, defaultWorkFill: DEFAULT_TASK_SOFT, code: "•", teacher: "", period: "", archived: false };

  // Resolve the original built-in Personal material without rewriting saved class
  // records. Imported built-ins retain the original metadata after UUID remapping.
  function presentedClass(item) {
    if (!item) return NO_CLASS;
    const builtInPersonal = item.id === "personal" || (item.name === "Personal" && item.code === "★" && item.teacher === "Personal" && item.period === "Anytime");
    if (builtInPersonal && ["#c48b34", DEFAULT_TASK_COLOR].includes(item.color?.toLowerCase())) {
      return { ...item, color: DEFAULT_TASK_COLOR, soft: DEFAULT_TASK_SOFT, defaultWorkFill: DEFAULT_TASK_SOFT };
    }
    return item;
  }

  function newId() { return globalThis.crypto.randomUUID(); }
  function softColor(hex) {
    const match = /^#([0-9a-f]{6})$/i.exec(hex || "");
    if (!match) return NO_CLASS.soft;
    const value = parseInt(match[1], 16);
    const mix = (channel) => Math.round(channel + (255 - channel) * 0.84).toString(16).padStart(2, "0");
    return `#${mix(value >> 16)}${mix((value >> 8) & 255)}${mix(value & 255)}`;
  }
  function capitalize(value) { return value ? value[0].toUpperCase() + value.slice(1) : value; }

  function rowToClass(row) {
    return { id: row.id, name: row.name, teacher: row.teacher || "", period: row.period || "", color: row.color, soft: softColor(row.color), code: row.code || row.name.slice(0, 1).toUpperCase(), axisKey: row.axis_key || null, archived: Boolean(row.archived) };
  }
  function classToRow(item) {
    return { id: item.id, name: item.name, teacher: item.teacher || null, period: item.period || null, color: item.color, code: item.code || null, archived: Boolean(item.archived) };
  }
  function rowToTask(row) {
    const details = row.task_details != null ? normalizeTaskDetails(row.task_details) : null;
    return {
      id: row.id, title: row.title, classId: row.class_id || null, type: row.type, notes: row.notes || "",
      priority: capitalize(row.priority) || "Medium", dueDate: row.due_date || "", dueTime: row.due_time ? row.due_time.slice(0, 5) : "",
      scheduledStart: row.scheduled_start ? row.scheduled_start.slice(0, 16) : null, scheduledEnd: null,
      durationMinutes: Number(row.duration_minutes || 45), completed: Boolean(row.completed), source: row.source || "manual",
      axisMissing: Boolean(row.axis_missing), schemaVersion: 2,
      ...(row.deleted_at ? { deleted_at: row.deleted_at } : {}),
      importance: row.importance || null, urgency: row.urgency || "auto",
      ...(row.work_alerts != null ? { workAlerts: normalizeWorkAlerts(row.work_alerts) } : {}),
      ...(details ? { taskDetails: details, actualMinutes: details.actualMinutes, reminderChoice: details.reminderChoice } : {}),
      ...(Number.isSafeInteger(row.sync_revision) && row.sync_revision >= 0 ? { syncRevision: row.sync_revision } : {}),
    };
  }
  function taskToRow(task) {
    const details = taskDetailsForTask(task);
    return {
      id: task.id, class_id: task.classId || null, type: task.type || "task", title: task.title, notes: task.notes || "",
      priority: String(task.priority || "Medium").toLowerCase(), due_date: task.dueDate || null, due_time: task.dueTime || null,
      scheduled_start: task.scheduledStart || null, duration_minutes: Number(task.durationMinutes || 45), completed: Boolean(task.completed),
      importance: task.importance || null, urgency: task.urgency || "auto",
      ...(Object.hasOwn(task, "workAlerts") && task.workAlerts !== undefined ? { work_alerts: task.workAlerts === null ? null : JSON.stringify(normalizeWorkAlerts(task.workAlerts)) } : {}),
      ...(details !== undefined ? { task_details: details === null ? null : JSON.stringify(details) } : {}),
    };
  }
  function rowToTemplate(row) {
    return { id: row.id, classId: row.class_id || null, title: row.title, durationMinutes: Number(row.duration_minutes || 45), priority: capitalize(row.priority) || "Medium", notes: row.notes || "", reminderChoice: String(row.reminder_choice || "default") };
  }
  function templateToRow(item) {
    return { id: item.id, class_id: item.classId || null, title: item.title, duration_minutes: Number(item.durationMinutes || 45), priority: String(item.priority || "Medium").toLowerCase(), notes: item.notes || "", reminder_choice: item.reminderChoice || "default" };
  }
  function rowToResource(row) {
    return { id: row.id, classId: row.class_id, title: row.title, url: row.url, description: row.description || "", category: row.category || "", sortOrder: Number(row.sort_order || 0) };
  }
  function resourceToRow(item) {
    return { id: item.id, class_id: item.classId, title: item.title, url: item.url, description: item.description || "", category: item.category || "", sort_order: Number(item.sortOrder || 0) };
  }
  function rowToGoal(row) {
    return { id: row.id, title: row.title, notes: row.notes || "", targetCount: Number(row.target_count ?? 5), currentCount: Number(row.current_count ?? 0), unit: row.unit || "sessions", deadlineDate: row.deadline_date || "" };
  }
  function goalToRow(item) {
    return { id: item.id, title: item.title, notes: item.notes || "", target_count: item.targetCount ?? 5, current_count: item.currentCount ?? 0, unit: item.unit || "sessions", deadline_date: item.deadlineDate || null };
  }
  function rowToHabit(row) {
    let repeatDays;
    try { repeatDays = typeof row.repeat_days === "string" ? JSON.parse(row.repeat_days) : row.repeat_days; } catch { repeatDays = []; }
    return { id: row.id, title: row.title, notes: row.notes || "", repeatDays: Array.isArray(repeatDays) ? [...repeatDays] : [0, 1, 2, 3, 4, 5, 6] };
  }
  function habitToRow(item) { return { id: item.id, title: item.title, notes: item.notes || "", repeat_days: [...(item.repeatDays || [0, 1, 2, 3, 4, 5, 6])] }; }
  function rowToHabitCheckin(row) { return { habitId: row.habit_id, date: row.date, completed: Boolean(row.completed) }; }
  function habitCheckinToRow(item) { return { habit_id: item.habitId, date: item.date, completed: Boolean(item.completed) }; }
  function rowToNote(row) { return { id: row.id, title: row.title, category: row.category || "Personal", body: row.body || "", createdAt: row.created_at, updatedAt: row.updated_at }; }
  function noteToRow(item) { return { id: item.id, title: item.title, category: item.category || "Personal", body: item.body || "" }; }
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    const [year, month, day] = value.split("-").map(Number);
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0); date.setUTCFullYear(year, month - 1, day);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  function normalizeWorkAlerts(value) {
    const invalid = () => { throw new Error("Choose valid work alarm and notification settings."); };
    if (value === null) return null;
    if (typeof value === "string") {
      if (value.length > 2048) invalid();
      try { value = JSON.parse(value); } catch { invalid(); }
    }
    const keys = (item, allowed) => {
      if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).some(key => !allowed.includes(key)) || allowed.some(key => !Object.hasOwn(item, key))) invalid();
    };
    const time = at => {
      if (at === null) return null;
      if (typeof at !== "string" || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(at) || !validDate(at.slice(0, 10))) invalid();
      return at;
    };
    keys(value, ["version", "timeZone", "alarm", "notification"]);
    if (value.version !== 1 || typeof value.timeZone !== "string" || value.timeZone.length > 100) invalid();
    try { new Intl.DateTimeFormat("en", { timeZone: value.timeZone }).format(0); } catch { invalid(); }
    keys(value.alarm, ["enabled", "mode", "at", "sound", "snoozeMinutes"]);
    keys(value.notification, ["enabled", "mode", "at"]);
    const { alarm, notification } = value;
    if (typeof alarm.enabled !== "boolean" || !["work", "manual"].includes(alarm.mode) || !["system", "gentle", "bright"].includes(alarm.sound) || ![0, 5, 10, 15].includes(alarm.snoozeMinutes)) invalid();
    if (typeof notification.enabled !== "boolean" || !["alarm", "manual"].includes(notification.mode)) invalid();
    const alarmAt = time(alarm.at), notificationAt = time(notification.at);
    if ((alarm.mode === "work" && alarmAt !== null) || (alarm.mode === "manual" && alarm.enabled && alarmAt === null)) invalid();
    if ((notification.mode === "alarm" && notificationAt !== null) || (notification.mode === "manual" && notification.enabled && notificationAt === null)) invalid();
    return { version: 1, timeZone: value.timeZone,
      alarm: { enabled: alarm.enabled, mode: alarm.mode, at: alarmAt, sound: alarm.sound, snoozeMinutes: alarm.snoozeMinutes },
      notification: { enabled: notification.enabled, mode: notification.mode, at: notificationAt } };
  }
  function normalizeTaskDetails(value) {
    const invalid = () => { throw new Error("Choose valid logged time and deadline reminder settings."); };
    if (value === null) return null;
    if (typeof value === "string") { if (value.length > 512) invalid(); try { value = JSON.parse(value); } catch { invalid(); } }
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 3 || value.version !== 1 || !Object.hasOwn(value, "actualMinutes") || !Object.hasOwn(value, "reminderChoice")) invalid();
    if (value.actualMinutes !== null && (!Number.isInteger(value.actualMinutes) || value.actualMinutes < 0 || value.actualMinutes > 10080)) invalid();
    if (!["default", "off", "15", "60", "1440"].includes(value.reminderChoice)) invalid();
    return { version: 1, actualMinutes: value.actualMinutes, reminderChoice: value.reminderChoice };
  }
  function taskDetailsForTask(task) {
    if (task.taskDetails === null) return null;
    if (task.taskDetails === undefined && !Object.hasOwn(task, "actualMinutes") && !Object.hasOwn(task, "reminderChoice")) return undefined;
    const base = task.taskDetails === undefined ? { version: 1, actualMinutes: null, reminderChoice: "default" } : normalizeTaskDetails(task.taskDetails);
    return normalizeTaskDetails({ ...base, ...(Object.hasOwn(task, "actualMinutes") ? { actualMinutes: task.actualMinutes ?? null } : {}), ...(Object.hasOwn(task, "reminderChoice") ? { reminderChoice: task.reminderChoice } : {}) });
  }
  function normalizeGoal(item) {
    const targetCount = Number(item.targetCount ?? 5), currentCount = Number(item.currentCount ?? 0);
    if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 100000) throw new Error("Goal target must be a whole number from 1 to 100000.");
    if (!Number.isInteger(currentCount) || currentCount < 0 || currentCount > 100000) throw new Error("Goal progress must be a whole number from 0 to 100000.");
    const deadlineDate = item.deadlineDate || "";
    if (deadlineDate && !validDate(deadlineDate)) throw new Error("Choose a valid goal deadline.");
    return { id: item.id || newId(), title: limitedText(item.title, 100, "Goal title", true), notes: limitedText(item.notes, 5000, "Notes"), targetCount, currentCount, unit: limitedText(item.unit ?? "sessions", 30, "Unit", true), deadlineDate };
  }
  function normalizeHabit(item) {
    const repeatDays = item.repeatDays ?? [0, 1, 2, 3, 4, 5, 6];
    if (!Array.isArray(repeatDays) || !repeatDays.length || !repeatDays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) || new Set(repeatDays).size !== repeatDays.length) throw new Error("Choose one or more different days of the week.");
    return { id: item.id || newId(), title: limitedText(item.title, 100, "Habit title", true), notes: limitedText(item.notes, 2000, "Notes"), repeatDays: [...repeatDays].sort((a, b) => a - b) };
  }
  function normalizeNote(item, previous) {
    const body = String(item.body ?? "");
    if (body.length > 5000) throw new Error("Note body must be 5000 characters or fewer.");
    const now = new Date().toISOString();
    return { id: item.id || newId(), title: limitedText(item.title, 100, "Note title", true), category: limitedText(item.category, 60, "Category") || "Personal", body, createdAt: previous?.createdAt || now, updatedAt: now };
  }
  function organizationPreferences(value = {}) {
    const days = Number(value.urgencyDays ?? value.urgency_days ?? 2);
    if (!Number.isInteger(days) || days < 0 || days > 30) throw new Error("Choose an urgency window from 0 to 30 days.");
    return { urgencyDays: days };
  }
  function limitedText(value, max, label, required = false) {
    const text = String(value ?? "").trim();
    if (required && !text) throw new Error(`${label} is required.`);
    if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
    return text;
  }
  function normalizeTemplate(item) {
    const durationMinutes = Number(item.durationMinutes ?? 45);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 1440) throw new Error("Duration must be between 5 minutes and 24 hours.");
    const priority = item.priority || "Medium";
    if (!["High", "Medium", "Low"].includes(priority)) throw new Error("Choose a valid priority.");
    const reminderChoice = String(item.reminderChoice ?? "default");
    if (!["default", "off", "15", "60", "1440"].includes(reminderChoice)) throw new Error("Choose a valid reminder.");
    return { id: item.id || newId(), classId: item.classId || null, title: limitedText(item.title, 80, "Template name", true), durationMinutes, priority, notes: limitedText(item.notes, 5000, "Notes"), reminderChoice };
  }
  function normalizeResource(item) {
    let url;
    try { url = new URL(String(item.url || "").trim()); } catch { throw new Error("Enter a full http:// or https:// resource link."); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.href.length > 2048) throw new Error("Use an http:// or https:// link without a username or password.");
    const sortOrder = Number(item.sortOrder ?? 0);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) throw new Error("Resource order must be between 0 and 10000.");
    return { id: item.id || newId(), classId: item.classId || null, title: limitedText(item.title, 120, "Resource title", true), url: url.href, description: limitedText(item.description, 2000, "Description"), category: limitedText(item.category, 60, "Category"), sortOrder };
  }
  function taskInRange(task, range = {}) {
    if (!range.from && !range.to) return true;
    const dates = [task.dueDate, task.scheduledStart?.slice(0, 10)].filter(Boolean);
    return dates.some((date) => (!range.from || date >= range.from) && (!range.to || date <= range.to));
  }

  // Legacy tasks name their class; newer ones point at a class id.
  function attachClassIds(tasks, classes) {
    const byName = new Map(classes.map((item) => [item.name.toLowerCase(), item.id]));
    return tasks.map((task) => {
      // A modern No class choice must not inherit the legacy Personal default.
      const noClass = task.classId === null || task.classId === "";
      const classId = noClass ? null : classes.some((item) => item.id === task.classId) ? task.classId : byName.get(String(task.className || "").toLowerCase()) || null;
      const { className, ...rest } = task;
      return { ...rest, classId };
    });
  }

  // Maps local classes onto the account's classes (matching by name) and gives every local task a fresh
  // UUID. Tasks keep their own scheduledStart; nothing is scheduled from a due time.
  function planLocalImport({ localTasks, localClasses, cloudClasses, localTemplates = [], localResources = [], localOrganization, localGoals = [], localHabits = [], localHabitCheckins = [], localNotes = [], makeId = newId }) {
    const cloudByName = new Map(cloudClasses.map((item) => [item.name.toLowerCase(), item.id]));
    const classIdMap = new Map();
    const classRows = [];
    localClasses.forEach((item) => {
      const existing = cloudByName.get(item.name.toLowerCase());
      if (existing) { classIdMap.set(item.id, existing); return; }
      const id = makeId();
      classIdMap.set(item.id, id);
      cloudByName.set(item.name.toLowerCase(), id);
      classRows.push(classToRow({ ...item, id }));
    });
    const itemRows = localTasks.map((task) => taskToRow({ ...task, id: makeId(), classId: classIdMap.get(task.classId) || null }));
    const templateRows = localTemplates.map((item) => templateToRow({ ...item, id: makeId(), classId: classIdMap.get(item.classId) || null }));
    const resourceRows = localResources.map((item) => resourceToRow({ ...item, id: makeId(), classId: classIdMap.get(item.classId) || null }));
    const organization = localOrganization ? { urgency_days: organizationPreferences(localOrganization).urgencyDays } : undefined;
    const goalRows = localGoals.map((item) => goalToRow({ ...item, id: makeId() }));
    const habitIds = new Map();
    const habitRows = localHabits.map((item) => { const id = makeId(); habitIds.set(item.id, id); return habitToRow({ ...item, id }); });
    const habitCheckinRows = localHabitCheckins.filter((item) => item.completed).map((item) => {
      const habitId = habitIds.get(item.habitId);
      if (!habitId) throw new Error("A saved habit check-in has no matching habit. Review your local habits before importing.");
      return habitCheckinToRow({ ...item, habitId });
    });
    const noteRows = localNotes.map((item) => noteToRow({ ...item, id: makeId() }));
    return { classRows, itemRows, templateRows, resourceRows, goalRows, habitRows, habitCheckinRows, noteRows, ...(organization ? { organization } : {}) };
  }

  async function localImportFingerprint(localState) {
    const byId = (items) => [...items].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const ordered = (value) => Array.isArray(value) ? value.map(ordered) : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, ordered(value[key])])) : value;
    const snapshot = ordered({
      classes: byId(localState.classes), tasks: byId(localState.tasks),
      templates: byId(localState.templates), resources: byId(localState.resources),
      ...([localState.goals, localState.habits, localState.habitCheckins, localState.notes].some((items) => items?.length) ? {
        goals: byId(localState.goals || []), habits: byId(localState.habits || []),
        habitCheckins: [...(localState.habitCheckins || [])].sort((a, b) => `${a.habitId}:${a.date}`.localeCompare(`${b.habitId}:${b.date}`)), notes: byId(localState.notes || []),
      } : {}),
      organization: localState.organizationConfigured ? localState.organization : null,
    });
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(snapshot)));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function createLocalBackend({ storage, model, defaultClasses, defaultTasks }) {
    function read(key) { try { return JSON.parse(storage.getItem(key)); } catch { return null; } }
    function write(key, value, required = false) {
      try { storage.setItem(key, JSON.stringify(value)); }
      catch { if (required) throw new Error("Couldn't save your changes in this browser. Check available storage and try again."); }
    }
    function load() {
      const storedClasses = read(CLASSES_KEY);
      const classes = Array.isArray(storedClasses) ? storedClasses : structuredClone(defaultClasses());
      const storedTasks = read(TASKS_KEY);
      const source = Array.isArray(storedTasks) ? storedTasks : structuredClone(defaultTasks());
      const tasks = attachClassIds(model.migrateTasks(source), classes);
      write(CLASSES_KEY, classes); write(TASKS_KEY, tasks);
      const templates = read(TEMPLATES_KEY), resources = read(RESOURCES_KEY), preferences = read(ORGANIZATION_KEY);
      const personal = read(PERSONAL_KEY) || {};
      let organization;
      try { organization = organizationPreferences(preferences || {}); } catch { organization = { urgencyDays: 2 }; }
      return { classes: classes.map((item) => ({ ...item, soft: softColor(item.color) })), tasks, templates: Array.isArray(templates) ? templates : [], resources: Array.isArray(resources) ? resources : [], organization, organizationConfigured: Boolean(preferences), organizationAvailable: true,
        goals: Array.isArray(personal.goals) ? personal.goals : [], habits: Array.isArray(personal.habits) ? personal.habits : [], habitCheckins: Array.isArray(personal.habitCheckins) ? personal.habitCheckins : [], notes: Array.isArray(personal.notes) ? personal.notes : [], personalAvailable: true };
    }
    function savePersonal(state) { write(PERSONAL_KEY, { goals: state.goals, habits: state.habits, habitCheckins: state.habitCheckins, notes: state.notes }, true); }
    return {
      mode: "local",
      load: async () => load(),
      saveTask: async (task, state) => write(TASKS_KEY, state.tasks, true),
      setCompleted: async (id, completed, state) => write(TASKS_KEY, state.tasks, true),
      saveCompletions: (state) => write(TASKS_KEY, state.tasks, true),
      deleteTask: async (id, state) => write(TASKS_KEY, state.tasks, true),
      saveClass: async (item, state) => write(CLASSES_KEY, state.classes.map(({ soft, ...rest }) => rest), true),
      saveTemplate: async (item, state) => write(TEMPLATES_KEY, state.templates, true),
      deleteTemplate: async (id, state) => write(TEMPLATES_KEY, state.templates, true),
      saveResource: async (item, state) => write(RESOURCES_KEY, state.resources, true),
      deleteResource: async (id, state) => write(RESOURCES_KEY, state.resources, true),
      saveOrganization: async (value) => write(ORGANIZATION_KEY, value, true),
      saveGoal: async (item, state) => savePersonal(state), deleteGoal: async (id, state) => savePersonal(state),
      saveHabit: async (item, state) => savePersonal(state), deleteHabit: async (id, state) => savePersonal(state),
      saveHabitCheckin: async (habitId, date, completed, state) => savePersonal(state),
      saveNote: async (item, state) => savePersonal(state), deleteNote: async (id, state) => savePersonal(state),
      reset() { [TASKS_KEY, CLASSES_KEY, TEMPLATES_KEY, RESOURCES_KEY, ORGANIZATION_KEY].forEach((key) => storage.removeItem(key)); return load(); },
      watch(onRemoteChange) {
        if (typeof window === "undefined") return () => {};
        const listener = (event) => { if ([TASKS_KEY, CLASSES_KEY, TEMPLATES_KEY, RESOURCES_KEY, ORGANIZATION_KEY, PERSONAL_KEY].includes(event.key)) onRemoteChange(load()); };
        window.addEventListener("storage", listener);
        return () => window.removeEventListener("storage", listener);
      },
    };
  }

  // Talks to the DuckPlan Worker (cloudflare/). Auth is an HttpOnly session cookie on the same
  // origin, so requests only need credentials: "same-origin".
  function createApi({ apiUrl, fetchImpl }) {
    return async function api(method, path, body) {
      let response;
      try {
        response = await fetchImpl(`${apiUrl}${path}`, {
          method, credentials: "same-origin",
          headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch { throw new Error("Couldn't reach DuckPlan. Check your connection and try again."); }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || `DuckPlan answered with status ${response.status}.`);
        error.status = response.status;
        throw error;
      }
      return data;
    };
  }

  // A brief successful handshake must not reset an outage's backoff. Catch-up snapshots
  // are also bounded across flapping connections; individual live rows remain immediate.
  function openLiveSocket({ url, WebSocketImpl, onMessage, onReconnect, timers = globalThis, random = Math.random, now = () => globalThis.performance?.now?.() ?? Date.now() }) {
    if (!WebSocketImpl || !url) return () => {};
    let socket = null;
    let closed = false;
    let attempts = 0;
    let retryTimer = null;
    let pingTimer = null;
    let stableTimer = null;
    let reloadTimer = null;
    let lastReload = -Infinity;
    const stableAfter = 30_000;
    const reloadInterval = 30_000;
    function clearConnectionTimers() {
      timers.clearInterval(pingTimer);
      timers.clearTimeout(stableTimer);
      timers.clearTimeout(reloadTimer);
      pingTimer = stableTimer = reloadTimer = null;
    }
    function retry() {
      if (closed) return;
      attempts = Math.min(attempts + 1, 5);
      const ceiling = Math.min(30_000, 1000 * 2 ** attempts);
      // 75–100% jitter spreads clients out without exceeding the 30-second cap.
      retryTimer = timers.setTimeout(connect, ceiling * (0.75 + random() * 0.25));
    }
    function catchUp(connection) {
      const run = () => {
        reloadTimer = null;
        if (closed || socket !== connection) return;
        lastReload = now();
        onReconnect();
      };
      const remaining = reloadInterval - (now() - lastReload);
      if (remaining > 0) reloadTimer = timers.setTimeout(run, remaining);
      else run(); // Includes the first snapshot-to-socket gap.
    }
    function connect() {
      retryTimer = null;
      if (closed) return;
      let connection;
      try { connection = new WebSocketImpl(url); }
      catch { retry(); return; }
      socket = connection;
      let opened = false;
      connection.onopen = () => {
        if (closed || socket !== connection) { connection.close(1000); return; }
        if (opened) return;
        opened = true;
        stableTimer = timers.setTimeout(() => { if (!closed && socket === connection) attempts = 0; }, stableAfter);
        pingTimer = timers.setInterval(() => { try { connection.send("ping"); } catch { /* reconnecting */ } }, 30_000);
        catchUp(connection);
      };
      connection.onmessage = (event) => {
        if (closed || socket !== connection || event.data === "pong") return;
        try { onMessage(JSON.parse(event.data)); } catch { /* ignore malformed messages */ }
      };
      connection.onclose = () => {
        if (closed || socket !== connection) return;
        socket = null;
        clearConnectionTimers();
        retry();
      };
    }
    connect();
    return () => {
      closed = true;
      timers.clearTimeout(retryTimer);
      clearConnectionTimers();
      try { socket?.close(1000); } catch { /* already closed */ }
      socket = null;
    };
  }

  function createCloudBackend({ api, user, liveUrl, WebSocketImpl }) {
    return {
      mode: "cloud",
      user,
      async load() {
        const { classes, items, templates, resources, organization, goals, habits, habit_checkins, notes, work_alerts_supported, task_details_supported, settings_adoption_supported, bulk_completion_supported } = await api("GET", "/planner");
        return { classes: classes.map(rowToClass), tasks: items.map(rowToTask), templates: (templates || []).map(rowToTemplate), resources: (resources || []).map(rowToResource), organization: organizationPreferences(organization || {}), organizationAvailable: Array.isArray(templates) && Array.isArray(resources) && Boolean(organization),
          goals: (goals || []).map(rowToGoal), habits: (habits || []).map(rowToHabit), habitCheckins: (habit_checkins || []).map(rowToHabitCheckin), notes: (notes || []).map(rowToNote), personalAvailable: [goals, habits, habit_checkins, notes].every(Array.isArray), workAlertsAvailable: work_alerts_supported === true, taskDetailsAvailable: task_details_supported === true, settingsAdoptionAvailable: settings_adoption_supported === true, bulkCompletionAvailable: bulk_completion_supported === true };
      },
      saveTask: (task, state) => {
        const row = taskToRow(task);
        if (state.workAlertsAvailable !== true) delete row.work_alerts;
        if (state.taskDetailsAvailable !== true) delete row.task_details;
        return api("PUT", `/items/${encodeURIComponent(task.id)}`, row);
      },
      adoptSettings: (id, body) => api("POST", `/items/${encodeURIComponent(id)}/adopt-settings`, body),
      setCompleted: (id, completed) => api("PATCH", `/items/${encodeURIComponent(id)}`, { completed }),
      completeOverdue: (items, before) => api("POST", "/items/complete-overdue", { items, before }),
      // Soft delete on the server, so the deletion reaches every device.
      deleteTask: (id) => api("DELETE", `/items/${encodeURIComponent(id)}`),
      saveClass: (item) => api("PUT", `/classes/${encodeURIComponent(item.id)}`, classToRow(item)),
      saveTemplate: (item) => api("PUT", `/task-templates/${encodeURIComponent(item.id)}`, templateToRow(item)),
      deleteTemplate: (id) => api("DELETE", `/task-templates/${encodeURIComponent(id)}`),
      saveResource: (item) => api("PUT", `/class-resources/${encodeURIComponent(item.id)}`, resourceToRow(item)),
      deleteResource: (id) => api("DELETE", `/class-resources/${encodeURIComponent(id)}`),
      saveOrganization: (value) => api("PUT", "/organization-preferences", { urgency_days: value.urgencyDays }),
      saveGoal: (item) => api("PUT", `/goals/${encodeURIComponent(item.id)}`, goalToRow(item)),
      deleteGoal: (id) => api("DELETE", `/goals/${encodeURIComponent(id)}`),
      saveHabit: (item) => api("PUT", `/habits/${encodeURIComponent(item.id)}`, habitToRow(item)),
      deleteHabit: (id) => api("DELETE", `/habits/${encodeURIComponent(id)}`),
      saveHabitCheckin: (habitId, date, completed) => api("PUT", `/habit-checkins/${encodeURIComponent(habitId)}/${encodeURIComponent(date)}`, { completed }),
      saveNote: (item) => api("PUT", `/notes/${encodeURIComponent(item.id)}`, noteToRow(item)),
      deleteNote: (id) => api("DELETE", `/notes/${encodeURIComponent(id)}`),
      watch({ onRow, onReload }) {
        return openLiveSocket({
          url: liveUrl, WebSocketImpl,
          onMessage: (message) => (message.reload ? onReload() : message.table && message.row && onRow(message.table, message.row)),
          onReconnect: onReload,
        });
      },
      importRows: (plan) => api("POST", "/import", plan),
    };
  }

  function liveSocketUrl(apiUrl, locationRef) {
    if (!locationRef?.href) return null;
    const url = new URL(`${apiUrl}/live`, locationRef.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.href;
  }

  function createPlannerStore({
    storage, model, defaultClasses, defaultTasks, config = {}, redirectPath = "/",
    fetchImpl = globalThis.fetch?.bind(globalThis), WebSocketImpl = globalThis.WebSocket,
    locationRef = globalThis.location, historyRef = globalThis.history, documentRef = globalThis.document,
  }) {
    const local = createLocalBackend({ storage, model, defaultClasses, defaultTasks });
    const listeners = new Set();
    const apiUrl = String(config.apiUrl || "").replace(/\/+$/, "");
    const configured = Boolean(apiUrl);
    const api = configured ? createApi({ apiUrl, fetchImpl }) : null;
    let backend = local;
    let backendGeneration = 0;
    let synchronization = createSynchronization();
    let state = { classes: [], tasks: [], templates: [], resources: [], organization: { urgencyDays: 2 }, organizationAvailable: true, goals: [], habits: [], habitCheckins: [], notes: [], personalAvailable: true };
    let unwatch = () => {};
    let authError = null;
    let settingsSyncError = null;
    let templateSyncError = null;
    let providers = { password: true, google: false, github: false };
    let deviceAlertSequence = 0;
    const deviceAlertCommits = new Map();
    const deviceAlertAttempts = new Map();
    const importedAccounts = new Set();
    function hasImportMarker(userId) {
      if (importedAccounts.has(userId)) return true;
      try { return Boolean(storage.getItem(`${IMPORTED_KEY}:${userId}`)); } catch { return false; }
    }
    function rememberImport(userId, value) {
      importedAccounts.add(userId);
      try { storage.setItem(`${IMPORTED_KEY}:${userId}`, value); } catch { /* Server receipt and this session still prevent duplicate imports. */ }
    }

    function readObject(key) {
      try { const value = JSON.parse(storage.getItem(key)); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
      catch { return {}; }
    }
    // A signed-in native fallback is separate from both guest data and other
    // accounts/API origins. Never discard the outbox until the server acknowledges it.
    function nativeTemplateOwner(target = backend) {
      return config.native === true && target.mode === "cloud" && target.user?.id;
    }
    function deviceTemplatesKey(target = backend) {
      const origin = new URL(apiUrl, locationRef?.href || "https://duckplan.invalid/").href;
      return `duckplan-device-templates-v1:${encodeURIComponent(origin)}:${encodeURIComponent(target.user.id)}`;
    }
    function readDeviceTemplates(target = backend) {
      if (!nativeTemplateOwner(target)) return {};
      const raw = storage.getItem(deviceTemplatesKey(target));
      if (raw == null) return {};
      try {
        const value = JSON.parse(raw);
        if (value?.version !== 1 || !Array.isArray(value.entries)) throw new Error();
        const entries = {};
        for (const entry of value.entries) {
          if (!entry?.item?.id || !entry.revision || !["new", "importing", "linked"].includes(entry.phase)) throw new Error();
          const item = normalizeTemplate(entry.item);
          if (entries[item.id] || (entry.phase !== "new" && (!/^[a-f0-9]{64}$/.test(entry.importKey || "") || !entry.importRow))) throw new Error();
          entries[item.id] = { ...entry, item };
        }
        return entries;
      } catch { throw new Error("Saved device templates could not be read. They have been kept safely; please contact support before resetting app data."); }
    }
    function writeDeviceTemplates(entries, target = backend) {
      storage.setItem(deviceTemplatesKey(target), JSON.stringify({ version: 1, entries: Object.values(entries) }));
    }
    function hydrateDeviceTemplates(next) {
      if (!nativeTemplateOwner()) return next;
      try {
        const entries = readDeviceTemplates();
        const ids = new Set(Object.keys(entries));
        return { ...next, templates: [...(next.templates || []).filter(item => !ids.has(item.id)), ...Object.values(entries).filter(entry => !entry.deleted).map(entry => entry.item)] };
      } catch (error) { templateSyncError = error.message; return next; }
    }
    function cacheTemplate(item, deleted = false) {
      const entries = readDeviceTemplates(), previous = entries[item.id];
      if (deleted && (!previous || previous.phase === "new")) delete entries[item.id];
      else entries[item.id] = { ...(previous || { phase: "new" }), item, deleted, revision: crypto.randomUUID() };
      // Commit first: a full/unavailable device store must never report success.
      writeDeviceTemplates(entries);
      synchronization.revision += 1;
      state = { ...state, templates: [...state.templates.filter(value => value.id !== item.id), ...(deleted ? [] : [item])] };
      templateSyncError = null;
      notify("persisted");
      if (state.organizationAvailable !== false) void reloadCloud();
    }
    async function adoptDeviceTemplates() {
      if (!nativeTemplateOwner() || state.organizationAvailable === false) return false;
      const target = backend, generation = backendGeneration, context = synchronization;
      const current = () => generation === backendGeneration && target === backend;
      if (context.templateAdoption) return context.templateAdoption;
      const run = async () => {
        let changed = false;
        try {
          await waitForWrites(context);
          if (!current()) return false;
          const ids = Object.keys(readDeviceTemplates(target));
          for (const id of ids) {
            if (!current()) break;
            let entry = readDeviceTemplates(target)[id];
            if (!entry) continue;
            if (entry.phase === "new") {
              // Persist an immutable retry plan before sending. Server import receipts
              // prevent a lost response from duplicating or reviving a deleted row.
              entry = { ...entry, phase: "importing", importKey: (crypto.randomUUID() + crypto.randomUUID()).replaceAll("-", ""), importRow: templateToRow(entry.item) };
              const entries = readDeviceTemplates(target);
              entries[id] = entry;
              writeDeviceTemplates(entries, target);
            }
            if (entry.phase === "importing") {
              await persistCloudChange(context, () => target.importRows({ classRows: [], itemRows: [], templateRows: [entry.importRow], resourceRows: [], idempotencyKey: entry.importKey }));
              changed = true;
              // Retain edits/deletions made while the request was in flight.
              const entries = readDeviceTemplates(target);
              if (!entries[id]) continue;
              entries[id] = { ...entries[id], phase: "linked" };
              writeDeviceTemplates(entries, target);
              entry = entries[id];
            }
            if (!current()) break;
            const revision = entry.revision;
            if (entry.deleted) {
              try { await persistCloudChange(context, () => target.deleteTemplate(id)); }
              catch (error) { if (error.status !== 404) throw error; }
            } else if (JSON.stringify(templateToRow(entry.item)) !== JSON.stringify(entry.importRow)) {
              await persistCloudChange(context, () => target.saveTemplate(entry.item));
            }
            const entries = readDeviceTemplates(target);
            if (entries[id]?.revision === revision) {
              delete entries[id];
              writeDeviceTemplates(entries, target);
            }
            changed = true;
          }
          if (current()) templateSyncError = null;
        } catch (error) { if (current()) templateSyncError = `Templates remain on this device. Sync will retry when the planner refreshes. ${error.message}`; return false; }
        return changed;
      };
      const pending = run().finally(() => { if (context.templateAdoption === pending) context.templateAdoption = null; });
      context.templateAdoption = pending;
      return pending;
    }

    function deviceDetailsKey(target = backend) { return `${DEVICE_EXTRAS_KEY}:task-details:${target.mode}:${target.user?.id || "local"}`; }
    function readDeviceExtras(target = backend, tasks = []) {
      const values = readObject(deviceDetailsKey(target));
      // Old releases used one id-keyed map. Claim only ids found in this owner's
      // loaded planner; never offer another account's cached settings for adoption.
      const legacy = readObject(DEVICE_EXTRAS_KEY), claims = readObject(`${DEVICE_EXTRAS_KEY}:claims`);
      const owner = `${target.mode}:${target.user?.id || "local"}`;
      for (const task of tasks) {
        if (Object.hasOwn(values, task.id) || !Object.hasOwn(legacy, task.id) || (claims[task.id] && claims[task.id] !== owner)) continue;
        try {
          const details = taskDetailsForTask(legacy[task.id]);
          if (!details) continue;
          storage.setItem(`${DEVICE_EXTRAS_KEY}:claims`, JSON.stringify({ ...claims, [task.id]: owner }));
          claims[task.id] = owner;
          storage.setItem(deviceDetailsKey(target), JSON.stringify({ ...values, [task.id]: details }));
          values[task.id] = details;
        } catch { /* Keep legacy data intact when it cannot be safely claimed. */ }
      }
      return values;
    }
    function deviceAlertsKey(target = backend) { return `${DEVICE_EXTRAS_KEY}:work-alerts:${target.mode}:${target.user?.id || "local"}`; }
    function readDeviceAlerts(target = backend) {
      return readObject(deviceAlertsKey(target));
    }
    function persistDeviceAlerts(task, target, available) {
      const values = readDeviceAlerts(target);
      if (!available && task.workAlerts != null) values[task.id] = task.workAlerts;
      else {
        if (!Object.hasOwn(values, task.id)) return;
        delete values[task.id];
      }
      storage.setItem(deviceAlertsKey(target), JSON.stringify(values));
    }
    function writeDeviceExtras(task, target, available) {
      const extras = readDeviceExtras(target), details = taskDetailsForTask(task);
      if (details === undefined) return;
      if (available && !Object.hasOwn(extras, task.id) && !Object.hasOwn(readObject(DEVICE_EXTRAS_KEY), task.id)) return;
      // A null tombstone also prevents the unscoped legacy entry from returning.
      extras[task.id] = !available ? details : null;
      storage.setItem(deviceDetailsKey(target), JSON.stringify(extras));
    }
    function hydrateDeviceExtras(next) {
      const extras = readDeviceExtras(backend, next.tasks);
      const alerts = backend.mode === "cloud" ? readDeviceAlerts() : {};
      return { ...next, tasks: next.tasks.map((task) => {
        let fallback, details;
        if (task.workAlerts != null && alerts[task.id] != null) { try { persistDeviceAlerts(task, backend, true); } catch { /* Canonical settings still win. */ } }
        if (task.taskDetails != null && extras[task.id] != null) { try { writeDeviceExtras(task, backend, true); } catch { /* Canonical settings still win. */ } }
        try { if (task.workAlerts == null && alerts[task.id] != null) fallback = normalizeWorkAlerts(alerts[task.id]); } catch { /* Invalid local metadata must not hide the rest of the account. */ }
        try { if (task.taskDetails == null && extras[task.id] != null) details = normalizeTaskDetails(extras[task.id]); } catch { /* Preserve other valid settings. */ }
        return { ...task, ...(details ? { taskDetails: details, actualMinutes: details.actualMinutes, reminderChoice: details.reminderChoice, ...(backend.mode === "cloud" ? { taskDetailsDeviceOnly: true } : {}) } : {}), ...(fallback ? { workAlerts: fallback, workAlertsDeviceOnly: true } : {}) };
      }) };
    }

    function notify(reason) { listeners.forEach((listener) => listener({ reason, mode: backend.mode })); }
    function replaceState(next) { next = hydrateDeviceTemplates(next); state = { templates: [], resources: [], organization: { urgencyDays: 2 }, organizationAvailable: true, goals: [], habits: [], habitCheckins: [], notes: [], personalAvailable: true, workAlertsAvailable: backend.mode === "local", taskDetailsAvailable: backend.mode === "local", settingsAdoptionAvailable: false, ...next }; }
    function cloudFor(user) { return createCloudBackend({ api, user, liveUrl: liveSocketUrl(apiUrl, locationRef), WebSocketImpl }); }
    function createSynchronization() { return { revision: 0, pendingWrites: 0, writeWaiters: new Set(), reloadRequested: false, reloadPromise: null, adoptions: new Map() }; }
    function wakeWrites(context) { for (const resolve of context.writeWaiters) resolve(); context.writeWaiters.clear(); }
    function waitForWrites(context) { return context.pendingWrites ? new Promise((resolve) => context.writeWaiters.add(resolve)) : Promise.resolve(); }
    async function persistCloudChange(context, work) {
      context.revision += 1;
      context.pendingWrites += 1;
      try { return await work(); }
      finally { context.pendingWrites -= 1; if (!context.pendingWrites) wakeWrites(context); }
    }
    async function adoptItemSettings(id, settings = {}) {
      const target = backend, generation = backendGeneration, context = synchronization;
      const current = () => generation === backendGeneration && target === backend && context === synchronization;
      const run = (context.adoptions.get(id) || Promise.resolve()).catch(() => {}).then(async () => {
        await waitForWrites(context);
        if (!current()) throw new Error("Your account changed. Please try again.");
        if (target.mode !== "cloud" || !state.settingsAdoptionAvailable) throw new Error("This server hasn't added task settings sync yet. Your settings remain on this device.");
        const task = state.tasks.find(item => item.id === id);
        if (!task) return { item: null, adopted: false };
        const body = { expected_revision: task.syncRevision };
        if (!Number.isSafeInteger(body.expected_revision) || body.expected_revision < 0) throw new Error("Refresh your planner before syncing saved task settings.");
        if (state.workAlertsAvailable && Object.hasOwn(settings, "workAlerts") && (task.workAlerts == null || task.workAlertsDeviceOnly)) {
          const value = normalizeWorkAlerts(settings.workAlerts);
          if (value != null) body.work_alerts = value;
        }
        if (state.taskDetailsAvailable && Object.hasOwn(settings, "taskDetails") && (task.taskDetails == null || task.taskDetailsDeviceOnly)) {
          const value = normalizeTaskDetails(settings.taskDetails);
          if (value != null) body.task_details = value;
        }
        if (!Object.hasOwn(body, "work_alerts") && !Object.hasOwn(body, "task_details")) return { item: task, adopted: false };
        const revision = context.revision + 1;
        const result = await persistCloudChange(context, () => target.adoptSettings(id, body));
        if (!current()) return { item: result.item ? rowToTask(result.item) : null, adopted: result.adopted === true };
        if (!result.item || result.item.id !== id) throw new Error("The server could not confirm the saved task settings. Refresh and try again.");
        const canonical = rowToTask(result.item);
        // Clear only the exact candidate acknowledged by this response. A newer
        // device save must retain its own pending values until that save commits.
        if (canonical.workAlerts != null && Object.hasOwn(body, "work_alerts")) {
          const cached = readDeviceAlerts(target)[id];
          if (JSON.stringify(cached) === JSON.stringify(body.work_alerts)) persistDeviceAlerts({ id }, target, true);
        }
        if (canonical.taskDetails != null && Object.hasOwn(body, "task_details")) {
          const cached = readDeviceExtras(target)[id];
          if (JSON.stringify(cached) === JSON.stringify(body.task_details)) writeDeviceExtras({ id, taskDetails: canonical.taskDetails }, target, true);
        }
        if (context.revision === revision && !context.pendingWrites) {
          state = { ...state, tasks: canonical.deleted_at ? state.tasks.filter(item => item.id !== id) : state.tasks.map(item => item.id === id ? hydrateDeviceExtras({ tasks: [canonical] }).tasks[0] : item) };
        } else {
          // A live row or a user's edit arrived while CAS was pending. Reload
          // after writes settle rather than replacing that newer task locally.
          context.reloadRequested = true;
          Promise.resolve().then(() => { if (current()) reloadCloud(); });
        }
        settingsSyncError = null;
        notify("persisted");
        return { item: canonical, adopted: result.adopted === true };
      });
      context.adoptions.set(id, run);
      try { return await run; }
      finally { if (context.adoptions.get(id) === run) context.adoptions.delete(id); }
    }
    async function adoptCachedSettings() {
      if (backend.mode !== "cloud" || !state.settingsAdoptionAvailable) return;
      const generation = backendGeneration;
      for (const task of [...state.tasks]) {
        if (generation !== backendGeneration) return;
        if ((state.workAlertsAvailable && task.workAlertsDeviceOnly) || (state.taskDetailsAvailable && task.taskDetailsDeviceOnly)) {
          try { await adoptItemSettings(task.id, { ...(state.workAlertsAvailable && task.workAlertsDeviceOnly ? { workAlerts: task.workAlerts } : {}), ...(state.taskDetailsAvailable && task.taskDetailsDeviceOnly ? { taskDetails: task.taskDetails } : {}) }); }
          catch (error) { if (generation === backendGeneration) settingsSyncError = error.message; }
        }
      }
    }

    async function activate(nextBackend) {
      const generation = ++backendGeneration;
      wakeWrites(synchronization);
      const context = synchronization = createSynchronization();
      unwatch();
      backend = nextBackend;
      settingsSyncError = null;
      templateSyncError = null;
      replaceState({ classes: [], tasks: [], organizationAvailable: nextBackend.mode === "local", personalAvailable: nextBackend.mode === "local" });
      notify("context");
      const next = await nextBackend.load();
      if (generation !== backendGeneration) return;
      if (!context.revision && !context.pendingWrites) replaceState(hydrateDeviceExtras(next));
      unwatch = nextBackend.mode === "local"
        ? nextBackend.watch((value) => { if (generation === backendGeneration) { replaceState(value); notify("remote"); } })
        : nextBackend.watch({ onRow: (table, row) => { if (generation === backendGeneration) { if (context.bulkCompletion) reloadCloud(); else applyRowChange(table, row); } }, onReload: () => { if (generation === backendGeneration) reloadCloud(); } });
      if (nextBackend.mode === "cloud" && (context.revision || context.pendingWrites)) await reloadCloud();
      if (generation !== backendGeneration) return;
      await adoptCachedSettings();
      if (generation !== backendGeneration) return;
      if (await adoptDeviceTemplates()) await reloadCloud();
      if (generation !== backendGeneration) return;
      notify("load");
    }
    async function reloadCloud() {
      if (backend.mode !== "cloud") return;
      const activeBackend = backend, generation = backendGeneration, context = synchronization;
      const current = () => generation === backendGeneration && context === synchronization;
      context.reloadRequested = true;
      if (context.reloadPromise) return context.reloadPromise;
      const run = async () => {
        while (current() && context.reloadRequested) {
          await waitForWrites(context);
          if (!current()) return;
          context.reloadRequested = false;
          const revision = context.revision;
          try {
            const next = await activeBackend.load();
            if (!current()) return;
            if (context.pendingWrites || revision !== context.revision || context.reloadRequested) {
              context.reloadRequested = true;
              continue;
            }
            replaceState(hydrateDeviceExtras(next));
            await adoptCachedSettings();
            if (current() && await adoptDeviceTemplates()) context.reloadRequested = true;
            if (current()) notify("remote");
          } catch (error) {
            if (!current()) return;
            if (error.status === 401) { await activate(local); notify("auth"); return; }
          }
        }
      };
      const pending = run().finally(() => { if (context.reloadPromise === pending) context.reloadPromise = null; });
      context.reloadPromise = pending;
      return pending;
    }
    function applyRowChange(table, row) {
      synchronization.revision += 1;
      if (table === "items") {
        const others = state.tasks.filter((task) => task.id !== row.id);
        state = { ...state, tasks: row.deleted_at ? others : [...others, hydrateDeviceExtras({ tasks: [rowToTask(row)] }).tasks[0]] };
      } else if (table === "classes") {
        const others = state.classes.filter((item) => item.id !== row.id);
        state = { ...state, classes: [...others, rowToClass(row)] };
      } else if (table === "task_templates" || table === "class_resources") {
        const key = table === "task_templates" ? "templates" : "resources";
        const convert = table === "task_templates" ? rowToTemplate : rowToResource;
        const others = state[key].filter((item) => item.id !== row.id);
        state = hydrateDeviceTemplates({ ...state, [key]: row.deleted_at ? others : [...others, convert(row)] });
      } else if (table === "planner_preferences") {
        state = { ...state, organization: organizationPreferences(row) };
      } else if (["goals", "habits", "notes"].includes(table)) {
        const convert = { goals: rowToGoal, habits: rowToHabit, notes: rowToNote }[table];
        const others = state[table].filter((item) => item.id !== row.id);
        state = { ...state, [table]: row.deleted_at ? others : [...others, convert(row)] };
        if (table === "habits" && row.deleted_at) state = { ...state, habitCheckins: state.habitCheckins.filter((item) => item.habitId !== row.id) };
      } else if (table === "habit_checkins") {
        const others = state.habitCheckins.filter((item) => item.habitId !== row.habit_id || item.date !== row.date);
        state = { ...state, habitCheckins: row.deleted_at || !row.completed ? others : [...others, rowToHabitCheckin(row)] };
      }
      notify("remote");
    }
    function rollbackMutation(previous, applied) {
      const next = { ...state };
      for (const key of Object.keys(applied)) {
        if (previous[key] === applied[key]) continue;
        if (!Array.isArray(applied[key])) {
          if (state[key] === applied[key]) next[key] = previous[key];
          continue;
        }
        const identify = (item) => key === "habitCheckins" ? `${item.habitId}:${item.date}` : item.id;
        const before = new Map(previous[key].map((item) => [identify(item), item]));
        const after = new Map(applied[key].map((item) => [identify(item), item]));
        next[key] = state[key].flatMap((item) => {
          const id = identify(item);
          if (before.get(id) === after.get(id) || item !== after.get(id)) return [item];
          return before.has(id) ? [before.get(id)] : [];
        });
        // A concurrent change may own an absent row. A fresh snapshot restores failed
        // deletions instead of guessing and resurrecting another write's deletion.
      }
      state = next;
    }
    async function mutate(apply, persist) {
      const activeBackend = backend, generation = backendGeneration, context = synchronization;
      const previous = state;
      const applied = state = apply(state);
      const revision = ++context.revision;
      context.pendingWrites += 1;
      notify("local");
      let failure = null;
      try { await persist(state, activeBackend); } catch (error) { failure = error; }
      finally { context.pendingWrites -= 1; if (!context.pendingWrites) wakeWrites(context); }
      if (failure) {
        const error = failure;
        if (generation !== backendGeneration) throw error;
        if (context.revision === revision) state = previous;
        else rollbackMutation(previous, applied);
        context.revision += 1;
        notify("error");
        if (activeBackend.mode === "cloud") await reloadCloud();
        throw error;
      }
      if (generation === backendGeneration) notify("persisted");
    }

    async function completeOverdue(ids, { onProgress, reference = new Date() } = {}) {
      const target = backend, generation = backendGeneration, context = synchronization;
      const current = () => generation === backendGeneration && context === synchronization;
      const selected = new Set(ids), initial = new Map(state.tasks.filter(task => selected.has(task.id)).map(task => [task.id, task]));
      const eligible = task => task && !task.deleted && !task.deleted_at && model.taskTiming(task, reference).overdue;
      const before = `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, "0")}-${String(reference.getDate()).padStart(2, "0")}T${String(reference.getHours()).padStart(2, "0")}:${String(reference.getMinutes()).padStart(2, "0")}:${String(reference.getSeconds()).padStart(2, "0")}.${String(reference.getMilliseconds()).padStart(3, "0")}`;
      let completed = 0, dirty = false, failure = null, needsReload = false;
      await waitForWrites(context);
      if (!current()) return { completed: 0 };
      context.pendingWrites += 1;
      context.revision += 1;
      try {
        if (target.mode === "local") {
          const changed = new Set(state.tasks.filter(task => initial.get(task.id) === task && eligible(task)).map(task => task.id));
          if (changed.size) {
            const next = { ...state, tasks: state.tasks.map(task => changed.has(task.id) ? { ...task, completed: true } : task) };
            // localStorage is synchronous: commit once before publishing any state.
            // A quota failure leaves both memory and saved tasks untouched.
            target.saveCompletions(next);
            state = next;
            completed = changed.size; dirty = true;
          }
        } else {
          const acknowledgements = new Map(), candidates = [...initial.values()].filter(eligible);
          const batchSize = state.bulkCompletionAvailable ? 200 : 1;
          let indexedTasks = null, byId;
          const latest = id => {
            if (indexedTasks !== state.tasks) { indexedTasks = state.tasks; byId = new Map(indexedTasks.map(task => [task.id, task])); }
            return byId.get(id);
          };
          try {
            for (let offset = 0; offset < candidates.length; offset += batchSize) {
              if (!current()) break;
              const batch = candidates.slice(offset, offset + batchSize).filter(task => latest(task.id) === task && eligible(task));
              if (!batch.length) continue;
              let saved;
              if (batchSize > 1) {
                if (batch.some(task => !Number.isSafeInteger(task.syncRevision))) throw new Error("Refresh your planner before completing overdue tasks.");
                const result = await target.completeOverdue(batch.map(task => ({ id: task.id, expected_revision: task.syncRevision, due_date: task.dueDate, due_time: task.dueTime || null })), before);
                saved = result.completed;
                if (saved.length < batch.length) needsReload = true;
              } else {
                // Older servers remain usable without flooding them with parallel
                // PATCH requests. Coalesce their live echoes into one reload.
                const result = await target.setCompleted(batch[0].id, true);
                saved = [{ id: batch[0].id, sync_revision: result?.item?.sync_revision }];
              }
              if (!current()) break;
              const sent = new Set(batch.map(task => task.id));
              for (const row of saved) if (sent.has(row.id) && !acknowledgements.has(row.id)) { acknowledgements.set(row.id, row); completed += 1; }
              onProgress?.(completed, candidates.length);
            }
          } finally {
            if (current() && acknowledgements.size) {
              // One linear merge, preserving edits/deletions made while saving.
              state = { ...state, tasks: state.tasks.map(task => {
                const row = acknowledgements.get(task.id);
                return row && initial.get(task.id) === task ? { ...task, completed: true, ...(Number.isSafeInteger(row.sync_revision) ? { syncRevision: row.sync_revision } : {}) } : task;
              }) };
              dirty = true;
            }
          }
        }
      } catch (error) { failure = error; }
      finally {
        context.pendingWrites -= 1;
        if (!context.pendingWrites) wakeWrites(context);
        if (current() && dirty) { context.revision += 1; notify("bulk-completed"); }
        if (current() && needsReload) reloadCloud();
      }
      if (failure) {
        failure.completed = completed;
        // A lost response can follow a successful server commit. Reconcile once
        // rather than optimistically undoing saved work or blindly retrying it.
        if (current() && target.mode === "cloud") reloadCloud();
        throw failure;
      }
      return { completed };
    }

    // A failed provider sign-in comes back with ?sign_in_error=…, consumed once.
    function consumeSignInParams() {
      if (!locationRef?.href) return;
      const url = new URL(locationRef.href);
      const error = url.searchParams.get("sign_in_error");
      if (!error) return;
      url.searchParams.delete("sign_in_error");
      historyRef?.replaceState?.(historyRef.state, "", `${url.pathname}${url.search}${url.hash}`);
      authError = error.slice(0, 200);
    }
    async function sessionUser(generation = backendGeneration) {
      const session = await api("GET", "/session");
      if (generation === backendGeneration) providers = { password: true, google: Boolean(session.providers?.google), github: Boolean(session.providers?.github) };
      return session.user || null;
    }

    async function accountCall(path, body) {
      if (!configured) throw new Error("Cloud sync isn't set up on this site yet.");
      return api("POST", path, body);
    }
    async function signedIn(user, expectedGeneration) {
      if (expectedGeneration !== backendGeneration) throw new Error("Your account changed. Please try again.");
      const activeBackend = cloudFor(user);
      const activation = activate(activeBackend), generation = backendGeneration;
      await activation;
      if (generation !== backendGeneration || activeBackend !== backend) throw new Error("Your account changed. Please try again.");
      notify("auth");
    }

    // Another tab may have signed in or out, and a sleeping laptop may have missed live updates.
    async function refreshOnFocus() {
      if (!configured || documentRef?.hidden) return;
      let generation = backendGeneration;
      try {
        const user = await sessionUser(generation);
        if (generation !== backendGeneration) return;
        if ((user?.id || null) !== (backend.user?.id || null)) {
          const activation = activate(user ? cloudFor(user) : local);
          generation = backendGeneration;
          await activation;
          if (generation === backendGeneration) notify("auth");
        }
        else if (backend.mode === "cloud") await reloadCloud();
      } catch { /* offline: keep what we have */ }
    }

    return {
      NO_CLASS,
      get mode() { return backend.mode; },
      get configured() { return configured; },
      get user() { return backend.user || null; },
      get supportsOrganization() { return state.organizationAvailable !== false; },
      get supportsTemplates() { return state.organizationAvailable !== false || Boolean(nativeTemplateOwner()); },
      get templatesDeviceOnly() { return Boolean(nativeTemplateOwner()) && state.organizationAvailable === false; },
      get templateSyncError() { return templateSyncError; },
      get supportsPersonal() { return state.personalAvailable !== false; },
      get supportsWorkAlerts() { return backend.mode === "local" || state.workAlertsAvailable === true; },
      get supportsTaskDetails() { return backend.mode === "local" || state.taskDetailsAvailable === true; },
      get supportsSettingsAdoption() { return backend.mode === "cloud" && state.settingsAdoptionAvailable === true; },
      get settingsSyncError() { return settingsSyncError; },
      adoptItemSettings,
      // Which sign-in methods the Worker has set up (Google needs its client id and secret).
      get providers() { return providers; },
      // A sign-in problem from the last redirect (a cancelled Google sign-in), shown once.
      takeAuthError() { const message = authError; authError = null; return message; },

      async init() {
        let generation = backendGeneration;
        if (configured) {
          try {
            consumeSignInParams();
            const user = await sessionUser(generation);
            if (generation !== backendGeneration) return;
            const activation = activate(user ? cloudFor(user) : local);
            generation = backendGeneration;
            await activation;
            if (generation !== backendGeneration) return;
            documentRef?.addEventListener?.("visibilitychange", refreshOnFocus);
            return;
          } catch (error) {
            if (generation !== backendGeneration) return;
            console.warn("DuckPlan is using local data:", error.message);
          }
        }
        if (generation !== backendGeneration) return;
        await activate(local);
      },
      subscribe(onChange) { listeners.add(onChange); return () => listeners.delete(onChange); },
      refresh: refreshOnFocus,

      listItems(range) { return state.tasks.filter((task) => taskInRange(task, range)); },
      listClasses({ includeArchived = false } = {}) { return state.classes.filter((item) => includeArchived || !item.archived); },
      classById(id) { return presentedClass(state.classes.find((item) => item.id === id)); },
      listTemplates() { return [...state.templates]; },
      listResources({ classId } = {}) { return state.resources.filter((item) => !classId || item.classId === classId); },
      organizationPreferences() { return { ...state.organization }; },
      listGoals() { return [...state.goals]; },
      listHabits() { return state.habits.map((item) => ({ ...item, repeatDays: [...item.repeatDays] })); },
      listHabitCheckins({ habitId } = {}) { return state.habitCheckins.filter((item) => !habitId || item.habitId === habitId); },
      listNotes() { return [...state.notes]; },
      async upsertGoal(item) {
        if (!this.supportsPersonal) throw new Error("Saved goals aren't available on this server yet.");
        const next = normalizeGoal(item);
        await mutate((current) => ({ ...current, goals: [...current.goals.filter((value) => value.id !== next.id), next] }), (current, target) => target.saveGoal(next, current));
        return next;
      },
      async deleteGoal(id) {
        if (!this.supportsPersonal) throw new Error("Saved goals aren't available on this server yet.");
        return mutate((current) => ({ ...current, goals: current.goals.filter((item) => item.id !== id) }), (current, target) => target.deleteGoal(id, current));
      },
      async upsertHabit(item) {
        if (!this.supportsPersonal) throw new Error("Saved habits aren't available on this server yet.");
        const next = normalizeHabit(item);
        await mutate((current) => ({ ...current, habits: [...current.habits.filter((value) => value.id !== next.id), next] }), (current, target) => target.saveHabit(next, current));
        return next;
      },
      async deleteHabit(id) {
        if (!this.supportsPersonal) throw new Error("Saved habits aren't available on this server yet.");
        return mutate((current) => ({ ...current, habits: current.habits.filter((item) => item.id !== id), habitCheckins: current.habitCheckins.filter((item) => item.habitId !== id) }), (current, target) => target.deleteHabit(id, current));
      },
      async setHabitCheckin(habitId, date, completed) {
        if (!this.supportsPersonal) throw new Error("Habit check-ins aren't available on this server yet.");
        if (!state.habits.some((item) => item.id === habitId)) throw new Error("Choose a habit from your planner.");
        if (!validDate(date)) throw new Error("Choose a valid check-in date.");
        if (typeof completed !== "boolean") throw new Error("Choose whether the habit is completed.");
        const next = { habitId, date, completed };
        await mutate((current) => ({ ...current, habitCheckins: [...current.habitCheckins.filter((item) => item.habitId !== habitId || item.date !== date), ...(completed ? [next] : [])] }), (current, target) => target.saveHabitCheckin(habitId, date, completed, current));
        return next;
      },
      async upsertNote(item) {
        if (!this.supportsPersonal) throw new Error("Saved notes aren't available on this server yet.");
        const next = normalizeNote(item, state.notes.find((value) => value.id === item.id));
        await mutate((current) => ({ ...current, notes: [...current.notes.filter((value) => value.id !== next.id), next] }), (current, target) => target.saveNote(next, current));
        return next;
      },
      async deleteNote(id) {
        if (!this.supportsPersonal) throw new Error("Saved notes aren't available on this server yet.");
        return mutate((current) => ({ ...current, notes: current.notes.filter((item) => item.id !== id) }), (current, target) => target.deleteNote(id, current));
      },

      async upsertTemplate(item) {
        if (!this.supportsTemplates) throw new Error("Templates aren't available on this server yet. Your local templates are safe.");
        const next = normalizeTemplate(item);
        if (next.classId && !state.classes.some((info) => info.id === next.classId)) throw new Error("Choose a class from your planner.");
        if (nativeTemplateOwner() && (state.organizationAvailable === false || readDeviceTemplates()[next.id])) {
          cacheTemplate(next);
          return next;
        }
        await mutate((current) => ({ ...current, templates: [...current.templates.filter((value) => value.id !== next.id), next] }), (current, target) => target.saveTemplate(next, current));
        return next;
      },
      async deleteTemplate(id) {
        if (!this.supportsTemplates) throw new Error("Templates aren't available on this server yet.");
        if (nativeTemplateOwner() && (state.organizationAvailable === false || readDeviceTemplates()[id])) {
          const item = state.templates.find(value => value.id === id) || readDeviceTemplates()[id]?.item;
          if (item) cacheTemplate(item, true);
          return;
        }
        return mutate((current) => ({ ...current, templates: current.templates.filter((item) => item.id !== id) }), (current, target) => target.deleteTemplate(id, current));
      },
      async upsertResource(item) {
        if (!this.supportsOrganization) throw new Error("Class resources aren't available on this server yet. Your local resources are safe.");
        const next = normalizeResource(item);
        if (!state.classes.some((info) => info.id === next.classId)) throw new Error("Choose a class from your planner.");
        await mutate((current) => ({ ...current, resources: [...current.resources.filter((value) => value.id !== next.id), next] }), (current, target) => target.saveResource(next, current));
        return next;
      },
      async deleteResource(id) {
        if (!this.supportsOrganization) throw new Error("Class resources aren't available on this server yet.");
        return mutate((current) => ({ ...current, resources: current.resources.filter((item) => item.id !== id) }), (current, target) => target.deleteResource(id, current));
      },
      async saveOrganizationPreferences(value) {
        if (!this.supportsOrganization) throw new Error("Matrix settings aren't available on this server yet.");
        const next = organizationPreferences(value);
        await mutate((current) => ({ ...current, organization: next }), (current, target) => target.saveOrganization(next));
        return next;
      },

      async upsertItem(task) {
        const activeBackend = backend, generation = backendGeneration, available = this.supportsWorkAlerts, detailsAvailable = this.supportsTaskDetails;
        const existing = state.tasks.find(item => item.id === task.id);
        const next = { completed: false, importance: null, urgency: "auto", ...task, id: task.id || newId(), schemaVersion: 2 };
        if (task.taskDetails === undefined && existing?.taskDetails != null) next.taskDetails = existing.taskDetails;
        if (!Object.hasOwn(task, "workAlerts") && existing?.workAlerts !== undefined) next.workAlerts = existing.workAlerts;
        if (taskDetailsForTask(task) === undefined && existing?.taskDetails !== undefined) {
          next.taskDetails = existing.taskDetails;
          next.actualMinutes = existing.actualMinutes;
          next.reminderChoice = existing.reminderChoice;
        }
        if (next.workAlerts !== undefined) next.workAlerts = normalizeWorkAlerts(next.workAlerts);
        const details = taskDetailsForTask(next);
        if (details !== undefined) {
          next.taskDetails = details;
          if (details) Object.assign(next, { actualMinutes: details.actualMinutes, reminderChoice: details.reminderChoice });
          else { delete next.actualMinutes; delete next.reminderChoice; }
        }
        if (activeBackend.mode === "cloud") { delete next.syncRevision; if (existing?.syncRevision !== undefined) next.syncRevision = existing.syncRevision; }
        delete next.workAlertsDeviceOnly;
        delete next.taskDetailsDeviceOnly;
        if (activeBackend.mode === "cloud" && !available && next.workAlerts != null) next.workAlertsDeviceOnly = true;
        if (activeBackend.mode === "cloud" && !detailsAvailable && details != null) next.taskDetailsDeviceOnly = true;
        if (![null, "important", "not_important"].includes(next.importance) || !["auto", "urgent", "not_urgent"].includes(next.urgency)) throw new Error("Choose valid importance and urgency settings.");
        if (!this.supportsOrganization && (next.importance || next.urgency !== "auto")) throw new Error("Task organization isn't available on this server yet.");
        const sequence = ++deviceAlertSequence;
        const commitKey = `${deviceAlertsKey(activeBackend)}:${next.id}`;
        deviceAlertAttempts.set(commitKey, sequence);
        // Old servers can still save tasks. Their new preferences remain account-scoped
        // on this device, but only after a durable task save and without stale writes.
        return mutate((current) => ({ ...current, tasks: [...current.tasks.filter((item) => item.id !== next.id), next] }), async (current, target) => {
          if (target.mode === "cloud" && !available && next.workAlerts != null) {
            // Fail before sending the task if its device-only preferences cannot persist.
            const key = `${deviceAlertsKey(target)}:check`;
            try { storage.setItem(key, JSON.stringify({ ...readDeviceAlerts(target), [next.id]: next.workAlerts })); }
            catch { throw new Error("This server hasn't added work alert sync yet, and this device couldn't save the alert settings. Try again after freeing browser storage."); }
            finally { try { storage.removeItem(key); } catch { /* No settings were activated from the temporary write check. */ } }
          }
          if (target.mode === "cloud" && !detailsAvailable && details != null) {
            const key = `${deviceDetailsKey(target)}:check`;
            try { storage.setItem(key, JSON.stringify({ ...readDeviceExtras(target), [next.id]: details })); }
            catch { throw new Error("This server hasn't added task detail sync yet, and this device couldn't retain your logged time and reminder settings. Free browser storage and try again."); }
            finally { try { storage.removeItem(key); } catch { /* Temporary storage check only. */ } }
          }
          const saveResult = await target.saveTask(next, current);
          if (generation === backendGeneration && activeBackend === backend && saveResult?.item && state.tasks.find(item => item.id === next.id) === next) {
            state = { ...state, tasks: state.tasks.map(item => item === next ? { ...next, ...rowToTask(saveResult.item) } : item) };
          }
          if (activeBackend.mode === "cloud" && sequence >= (deviceAlertCommits.get(commitKey) || 0)) {
            try {
              if (Object.hasOwn(next, "workAlerts")) persistDeviceAlerts(next, activeBackend, available);
              if (details !== undefined) writeDeviceExtras(next, activeBackend, detailsAvailable);
            }
            catch {
              const error = new Error("Task saved, but this device couldn't retain its work alert or task detail settings. Free browser storage and save it again.");
              error.taskSaved = true;
              error.savedTask = saveResult?.item ? { ...next, ...rowToTask(saveResult.item) } : next;
              throw error;
            }
            deviceAlertCommits.set(commitKey, sequence);
            if ((!available || !detailsAvailable) && generation === backendGeneration && activeBackend === backend && deviceAlertAttempts.get(commitKey) === sequence) {
              // The server's live echo can arrive before this device-only cache commit.
              // Restore only metadata, retaining canonical row fields and newer saves.
              state = { ...state, tasks: state.tasks.map(item => {
                if (item.id !== next.id) return item;
                const restored = { ...item };
                if (!available && Object.hasOwn(next, "workAlerts")) {
                  restored.workAlerts = next.workAlerts;
                  if (next.workAlerts != null) restored.workAlertsDeviceOnly = true;
                  else delete restored.workAlertsDeviceOnly;
                }
                if (!detailsAvailable && details !== undefined) {
                  restored.taskDetails = details;
                  if (details) Object.assign(restored, { actualMinutes: details.actualMinutes, reminderChoice: details.reminderChoice, taskDetailsDeviceOnly: true });
                  else delete restored.taskDetailsDeviceOnly;
                }
                return restored;
              }) };
            }
          }
        }).then(() => next);
      },
      toggleComplete(id, completed) {
        return mutate((current) => ({ ...current, tasks: current.tasks.map((task) => (task.id === id ? { ...task, completed } : task)) }), (current, target) => target.setCompleted(id, completed, current));
      },
      completeOverdue(ids, options) {
        const context = synchronization;
        if (context.bulkCompletion) return context.bulkCompletion;
        const pending = completeOverdue(ids, options).finally(() => { if (context.bulkCompletion === pending) context.bulkCompletion = null; });
        context.bulkCompletion = pending;
        return pending;
      },
      deleteItem(id) {
        return mutate((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== id) }), (current, target) => target.deleteTask(id, current));
      },
      upsertClass(item) {
        const next = { archived: false, ...item, id: item.id || newId() };
        next.soft = softColor(next.color);
        return mutate((current) => {
          const exists = current.classes.some((existing) => existing.id === next.id);
          return { ...current, classes: exists ? current.classes.map((existing) => (existing.id === next.id ? next : existing)) : [...current.classes, next] };
        }, (current, target) => target.saveClass(next, current)).then(() => next);
      },
      async resetLocalDemo() {
        if (backend.mode !== "local") return;
        replaceState(local.reset());
        notify("load");
      },

      // Accounts --------------------------------------------------------------
      // Email + password. Nothing is ever emailed: the email is just the login name. Sign-up and
      // recovery return a one-time recovery code that the person must save to reset a forgotten password.
      async signUp(email, password) {
        const generation = backendGeneration;
        const { user, recoveryCode } = await accountCall("/auth/sign-up", { email, password });
        await signedIn(user, generation);
        return recoveryCode;
      },
      async signIn(email, password) {
        const generation = backendGeneration;
        await signedIn((await accountCall("/auth/sign-in", { email, password })).user, generation);
      },
      async recoverAccount(email, recoveryCode, newPassword) {
        const generation = backendGeneration;
        const { user, recoveryCode: nextCode } = await accountCall("/auth/recover", { email, recoveryCode, newPassword });
        await signedIn(user, generation);
        return nextCode;
      },
      // Returns a recovery code only when the account didn't have one yet (a Google account's first password).
      async changePassword(currentPassword, newPassword) {
        const activeBackend = backend, generation = backendGeneration;
        const { recoveryCode } = await accountCall("/auth/password", { currentPassword, newPassword });
        if (generation !== backendGeneration || activeBackend !== backend) throw new Error("Your account changed. Please try again.");
        if (activeBackend.user) activeBackend.user.hasPassword = true;
        return recoveryCode || null;
      },
      async newRecoveryCode(password) {
        const activeBackend = backend, generation = backendGeneration;
        const { recoveryCode } = await accountCall("/auth/recovery-code", { password });
        if (generation !== backendGeneration || activeBackend !== backend) throw new Error("Your account changed. Please try again.");
        return recoveryCode;
      },
      async signInWithGoogle() {
        if (!configured) throw new Error("Cloud sync isn't set up on this site yet.");
        locationRef.assign(`${apiUrl}/auth/google?next=${encodeURIComponent(redirectPath)}`);
      },
      async signInWithGitHub() {
        if (!configured || !providers.github) throw new Error("GitHub sign-in isn't connected on this copy of DuckPlan yet.");
        locationRef.assign(`${apiUrl}/auth/github?next=${encodeURIComponent(redirectPath)}`);
      },
      async connectGitHub() {
        if (!configured || !providers.github || !backend.user) throw new Error("Sign in to DuckPlan before connecting GitHub.");
        const generation = backendGeneration, userId = backend.user.id;
        const current = locationRef?.href ? new URL(locationRef.href) : null;
        const result = await accountCall("/auth/github", { next: current ? `${current.pathname}${current.search}${current.hash}` : redirectPath });
        if (generation !== backendGeneration || backend.user?.id !== userId) throw new Error("Your account changed. Please try again.");
        const destination = new URL(result.url);
        if (destination.origin !== "https://github.com" || destination.pathname !== "/login/oauth/authorize") throw new Error("GitHub sign-in couldn't start. Please try again.");
        locationRef.assign(destination.href);
      },
      async signOut() {
        if (!configured) return;
        await api("POST", "/auth/sign-out");
        await activate(local);
        notify("auth");
      },

      // First sign-in: offer to copy this browser's local tasks into the account.
      async localImportOffer() {
        if (backend.mode !== "cloud" || hasImportMarker(backend.user.id)) return 0;
        const localState = await local.load();
        return localState.tasks.length + localState.templates.length + localState.resources.length + Number(localState.organizationConfigured) + localState.goals.length + localState.habits.length + localState.habitCheckins.length + localState.notes.length;
      },
      dismissLocalImport() { if (backend.user) rememberImport(backend.user.id, "dismissed"); },
      async importLocalTasks() {
        if (backend.mode !== "cloud") throw new Error("Sign in first.");
        const activeBackend = backend, generation = backendGeneration, context = synchronization;
        const localState = await local.load();
        if (generation !== backendGeneration) throw new Error("Your account changed. Please start the import again.");
        const organizationTasks = localState.tasks.some((task) => task.importance || (task.urgency && task.urgency !== "auto"));
        if (!this.supportsWorkAlerts && localState.tasks.some(task => task.workAlerts != null)) throw new Error("This server can't import your work alarm and notification settings yet. They will stay safely in this browser.");
        if (!this.supportsTaskDetails && localState.tasks.some(task => taskDetailsForTask(task) != null)) throw new Error("This server can't import your logged time and deadline reminder settings yet. They will stay safely in this browser.");
        if (!this.supportsPersonal && (localState.goals.length || localState.habits.length || localState.habitCheckins.length || localState.notes.length)) throw new Error("This server can't import your saved goals, habits and notes yet. They will stay safely in this browser.");
        if (!this.supportsOrganization && (localState.templates.length || localState.resources.length || organizationTasks || localState.organizationConfigured)) throw new Error("This server can't import your organization data yet. It will stay safely in this browser.");
        const plan = planLocalImport({ localTasks: localState.tasks, localClasses: localState.classes, cloudClasses: state.classes, localTemplates: localState.templates, localResources: localState.resources, localOrganization: localState.organizationConfigured ? localState.organization : undefined, localGoals: localState.goals, localHabits: localState.habits, localHabitCheckins: localState.habitCheckins, localNotes: localState.notes });
        const userId = activeBackend.user.id;
        const idempotencyKey = await localImportFingerprint(localState);
        if (generation !== backendGeneration) throw new Error("Your account changed. Please start the import again.");
        await persistCloudChange(context, () => activeBackend.importRows({ ...plan, idempotencyKey }));
        rememberImport(userId, new Date().toISOString());
        if (generation === backendGeneration) {
          await reloadCloud();
          if (generation === backendGeneration) notify("load");
        }
        return plan.itemRows.length;
      },

      // Axis ------------------------------------------------------------------
      async axisStatus() {
        if (backend.mode !== "cloud") return { connected: false, lastSyncedAt: null, lastError: null };
        const status = await api("GET", "/axis");
        return { connected: Boolean(status.connected), lastSyncedAt: status.lastSyncedAt || null, lastError: status.lastError || null };
      },
      async connectAxis(icalUrl) { return this.invokeAxis({ mode: "connect", icalUrl }); },
      async syncAxisNow() { return this.invokeAxis({ mode: "sync" }); },
      async invokeAxis(body) {
        if (backend.mode !== "cloud") throw new Error("Sign in to connect Axis.");
        const activeBackend = backend, generation = backendGeneration, context = synchronization;
        const result = await persistCloudChange(context, () => api("POST", "/axis", body));
        if (generation !== backendGeneration || activeBackend !== backend) throw new Error("Your account changed. Please try again.");
        await reloadCloud();
        if (generation !== backendGeneration || activeBackend !== backend) throw new Error("Your account changed. Please try again.");
        notify("load");
        return result;
      },
      async disconnectAxis() {
        if (backend.mode !== "cloud") return;
        await api("DELETE", "/axis");
      },
    };
  }

  return { NO_CLASS, DEFAULT_TASK_COLOR, DEFAULT_TASK_SOFT, attachClassIds, classToRow, createPlannerStore, planLocalImport, localImportFingerprint, rowToClass, rowToTask, softColor, taskInRange, taskToRow, rowToTemplate, templateToRow, rowToResource, resourceToRow, normalizeTemplate, normalizeResource, organizationPreferences, rowToGoal, goalToRow, rowToHabit, habitToRow, rowToHabitCheckin, habitCheckinToRow, rowToNote, noteToRow, normalizeGoal, normalizeHabit, normalizeNote, normalizeWorkAlerts, normalizeTaskDetails };
});
