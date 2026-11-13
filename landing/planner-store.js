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
  const NO_CLASS = { id: null, name: "No class", color: "#8f8a7d", soft: "#efede7", code: "•", teacher: "", period: "", archived: false };

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
    return {
      id: row.id, title: row.title, classId: row.class_id || null, type: row.type, notes: row.notes || "",
      priority: capitalize(row.priority) || "Medium", dueDate: row.due_date || "", dueTime: row.due_time ? row.due_time.slice(0, 5) : "",
      scheduledStart: row.scheduled_start ? row.scheduled_start.slice(0, 16) : null, scheduledEnd: null,
      durationMinutes: Number(row.duration_minutes || 45), completed: Boolean(row.completed), source: row.source || "manual",
      axisMissing: Boolean(row.axis_missing), schemaVersion: 2,
      importance: row.importance || null, urgency: row.urgency || "auto",
    };
  }
  function taskToRow(task) {
    return {
      id: task.id, class_id: task.classId || null, type: task.type || "task", title: task.title, notes: task.notes || "",
      priority: String(task.priority || "Medium").toLowerCase(), due_date: task.dueDate || null, due_time: task.dueTime || null,
      scheduled_start: task.scheduledStart || null, duration_minutes: Number(task.durationMinutes || 45), completed: Boolean(task.completed),
      importance: task.importance || null, urgency: task.urgency || "auto",
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

  // Live updates over a WebSocket to the user's PlannerLive Durable Object. Reconnects with backoff
  // and reloads after a reconnect, so anything missed while offline still arrives.
  function openLiveSocket({ url, WebSocketImpl, onMessage, onReconnect, timers = globalThis }) {
    if (!WebSocketImpl || !url) return () => {};
    let socket = null;
    let closed = false;
    let attempts = 0;
    let retryTimer = null;
    let pingTimer = null;
    function connect() {
      socket = new WebSocketImpl(url);
      socket.onopen = () => {
        if (closed) { socket.close(1000); return; }
        // Catch writes committed between the initial snapshot and this connection too.
        onReconnect();
        attempts = 0;
        pingTimer = timers.setInterval(() => { try { socket.send("ping"); } catch { /* reconnecting */ } }, 30_000);
      };
      socket.onmessage = (event) => {
        if (closed || event.data === "pong") return;
        try { onMessage(JSON.parse(event.data)); } catch { /* ignore malformed messages */ }
      };
      socket.onclose = () => {
        timers.clearInterval(pingTimer);
        if (closed) return;
        attempts += 1;
        retryTimer = timers.setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5)));
      };
    }
    connect();
    return () => { closed = true; timers.clearTimeout(retryTimer); timers.clearInterval(pingTimer); try { socket.close(1000); } catch { /* already closed */ } };
  }

  function createCloudBackend({ api, user, liveUrl, WebSocketImpl }) {
    return {
      mode: "cloud",
      user,
      async load() {
        const { classes, items, templates, resources, organization, goals, habits, habit_checkins, notes } = await api("GET", "/planner");
        return { classes: classes.map(rowToClass), tasks: items.map(rowToTask), templates: (templates || []).map(rowToTemplate), resources: (resources || []).map(rowToResource), organization: organizationPreferences(organization || {}), organizationAvailable: Array.isArray(templates) && Array.isArray(resources) && Boolean(organization),
          goals: (goals || []).map(rowToGoal), habits: (habits || []).map(rowToHabit), habitCheckins: (habit_checkins || []).map(rowToHabitCheckin), notes: (notes || []).map(rowToNote), personalAvailable: [goals, habits, habit_checkins, notes].every(Array.isArray) };
      },
      saveTask: (task) => api("PUT", `/items/${encodeURIComponent(task.id)}`, taskToRow(task)),
      setCompleted: (id, completed) => api("PATCH", `/items/${encodeURIComponent(id)}`, { completed }),
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
    let providers = { password: true, google: false };
    const importedAccounts = new Set();
    function hasImportMarker(userId) {
      if (importedAccounts.has(userId)) return true;
      try { return Boolean(storage.getItem(`${IMPORTED_KEY}:${userId}`)); } catch { return false; }
    }
    function rememberImport(userId, value) {
      importedAccounts.add(userId);
      try { storage.setItem(`${IMPORTED_KEY}:${userId}`, value); } catch { /* Server receipt and this session still prevent duplicate imports. */ }
    }

    function readDeviceExtras() {
      try { return JSON.parse(storage.getItem(DEVICE_EXTRAS_KEY)) || {}; }
      catch { return {}; }
    }
    function writeDeviceExtras(task) {
      const extras = readDeviceExtras();
      extras[task.id] = {
        reminderChoice: task.reminderChoice || "default",
        actualMinutes: Number.isInteger(task.actualMinutes) ? task.actualMinutes : null,
      };
      try { storage.setItem(DEVICE_EXTRAS_KEY, JSON.stringify(extras)); } catch { /* storage unavailable */ }
    }
    function hydrateDeviceExtras(next) {
      const extras = readDeviceExtras();
      return { ...next, tasks: next.tasks.map((task) => ({ ...task, ...(extras[task.id] || {}) })) };
    }

    function notify(reason) { listeners.forEach((listener) => listener({ reason, mode: backend.mode })); }
    function replaceState(next) { state = { templates: [], resources: [], organization: { urgencyDays: 2 }, organizationAvailable: true, goals: [], habits: [], habitCheckins: [], notes: [], personalAvailable: true, ...next }; }
    function cloudFor(user) { return createCloudBackend({ api, user, liveUrl: liveSocketUrl(apiUrl, locationRef), WebSocketImpl }); }
    function createSynchronization() { return { revision: 0, pendingWrites: 0, writeWaiters: new Set(), reloadRequested: false, reloadPromise: null }; }
    function wakeWrites(context) { for (const resolve of context.writeWaiters) resolve(); context.writeWaiters.clear(); }
    function waitForWrites(context) { return context.pendingWrites ? new Promise((resolve) => context.writeWaiters.add(resolve)) : Promise.resolve(); }
    async function persistCloudChange(context, work) {
      context.revision += 1;
      context.pendingWrites += 1;
      try { return await work(); }
      finally { context.pendingWrites -= 1; if (!context.pendingWrites) wakeWrites(context); }
    }

    async function activate(nextBackend) {
      const generation = ++backendGeneration;
      wakeWrites(synchronization);
      const context = synchronization = createSynchronization();
      unwatch();
      backend = nextBackend;
      replaceState({ classes: [], tasks: [], organizationAvailable: nextBackend.mode === "local", personalAvailable: nextBackend.mode === "local" });
      notify("context");
      const next = await nextBackend.load();
      if (generation !== backendGeneration) return;
      if (!context.revision && !context.pendingWrites) replaceState(hydrateDeviceExtras(next));
      unwatch = nextBackend.mode === "local"
        ? nextBackend.watch((value) => { if (generation === backendGeneration) { replaceState(value); notify("remote"); } })
        : nextBackend.watch({ onRow: (table, row) => { if (generation === backendGeneration) applyRowChange(table, row); }, onReload: () => { if (generation === backendGeneration) reloadCloud(); } });
      if (nextBackend.mode === "cloud" && (context.revision || context.pendingWrites)) await reloadCloud();
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
            replaceState(hydrateDeviceExtras(next)); notify("remote");
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
        state = { ...state, [key]: row.deleted_at ? others : [...others, convert(row)] };
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

    // A failed Google sign-in comes back with ?sign_in_error=…, read once and removed from the address bar.
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
      if (generation === backendGeneration) providers = { password: true, google: Boolean(session.providers?.google) };
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
      get supportsPersonal() { return state.personalAvailable !== false; },
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
      classById(id) { return state.classes.find((item) => item.id === id) || NO_CLASS; },
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
        if (!this.supportsOrganization) throw new Error("Templates aren't available on this server yet. Your local templates are safe.");
        const next = normalizeTemplate(item);
        if (next.classId && !state.classes.some((info) => info.id === next.classId)) throw new Error("Choose a class from your planner.");
        await mutate((current) => ({ ...current, templates: [...current.templates.filter((value) => value.id !== next.id), next] }), (current, target) => target.saveTemplate(next, current));
        return next;
      },
      async deleteTemplate(id) {
        if (!this.supportsOrganization) throw new Error("Templates aren't available on this server yet.");
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
        const next = { completed: false, importance: null, urgency: "auto", ...task, id: task.id || newId(), schemaVersion: 2 };
        if (![null, "important", "not_important"].includes(next.importance) || !["auto", "urgent", "not_urgent"].includes(next.urgency)) throw new Error("Choose valid importance and urgency settings.");
        if (!this.supportsOrganization && (next.importance || next.urgency !== "auto")) throw new Error("Task organization isn't available on this server yet.");
        writeDeviceExtras(next);
        return mutate((current) => ({ ...current, tasks: [...current.tasks.filter((item) => item.id !== next.id), next] }), (current, target) => target.saveTask(next, current)).then(() => next);
      },
      toggleComplete(id, completed) {
        return mutate((current) => ({ ...current, tasks: current.tasks.map((task) => (task.id === id ? { ...task, completed } : task)) }), (current, target) => target.setCompleted(id, completed, current));
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

  return { NO_CLASS, attachClassIds, classToRow, createPlannerStore, planLocalImport, localImportFingerprint, rowToClass, rowToTask, softColor, taskInRange, taskToRow, rowToTemplate, templateToRow, rowToResource, resourceToRow, normalizeTemplate, normalizeResource, organizationPreferences, rowToGoal, goalToRow, rowToHabit, habitToRow, rowToHabitCheckin, habitCheckinToRow, rowToNote, noteToRow, normalizeGoal, normalizeHabit, normalizeNote };
});
