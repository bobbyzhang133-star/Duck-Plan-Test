(() => {
  "use strict";
  if (!window.DuckNativeNotifications) return;
  const records = new Map();
  const copy = document.querySelector("#task-notification-status");
  const enable = document.querySelector("#enable-task-notifications");
  const disable = document.querySelector("#disable-task-notifications");
  let queue = Promise.resolve(), generation = 0, scope = "local", permission = "notDetermined";
  let knownTasks = new Map(), contextKnown = false;
  const deviceChoices = new Map();
  function deviceEnabled() {
    try { const saved = window.localStorage?.getItem(`duckplan.native.normal-device-enabled.v1:${scope}`); if (saved === "off") return false; if (saved === "on") return true; } catch { /* Session choice remains available. */ }
    return deviceChoices.get(scope) !== false;
  }
  function setDeviceEnabled(enabled) {
    deviceChoices.set(scope, enabled);
    try { window.localStorage?.setItem(`duckplan.native.normal-device-enabled.v1:${scope}`, enabled ? "on" : "off"); } catch { /* Session preference still applies. */ }
  }
  const capabilityChanged = () => window.dispatchEvent?.(new Event("duckplan:work-alert-capability"));
  const current = token => token === generation;
  const stale = () => new Error("The notification context changed. Try again in the current account.");
  const allowed = () => ["authorized", "provisional", "ephemeral"].includes(permission);
  const enqueue = (token, work) => {
    const operation = queue.then(() => { if (!current(token)) throw stale(); return work(); });
    queue = operation.catch(() => {}); return operation;
  };
  const call = body => window.DuckNativeNotifications.request(body);
  function render() {
    if (copy) copy.textContent = !deviceEnabled() ? "Normal notifications are paused on this device. Your saved task notification settings stay unchanged."
      : allowed() ? "Normal task notifications are allowed. iOS can show a banner and notification sound while DuckPlan is closed."
      : permission === "denied" ? "Normal notification permission is off. Allow DuckPlan notifications in iPhone Settings. Ringing alarm permission is separate."
        : "Allow normal task notifications separately from ringing alarms.";
    if (enable) { enable.hidden = deviceEnabled() && allowed(); enable.disabled = false; enable.textContent = deviceEnabled() ? "Allow normal notifications" : "Resume normal notifications"; }
    if (disable) { disable.hidden = !deviceEnabled() || records.size === 0; disable.textContent = "Pause normal notifications on this device"; }
  }
  async function refreshNow(token) {
    const status = await call({ action: "status" });
    if (!current(token)) return;
    permission = status.permission;
    const result = await call({ action: "list" });
    if (!current(token)) return;
    records.clear();
    for (const record of result.notifications || []) {
      const task = knownTasks.get(record.item_id);
      if (!contextKnown || task && !task.completed && !task.deleted && !task.deleted_at) records.set(record.item_id, record);
    }
    render();
  }
  const refresh = () => { const token = generation; return enqueue(token, () => refreshNow(token)); };
  enable?.addEventListener("click", async () => {
    const token = generation;
    try { await enqueue(token, async () => { await call({ action: "authorize", scope, deviceEnabled: true }); if (current(token)) { setDeviceEnabled(true); await refreshNow(token); capabilityChanged(); } }); }
    catch (error) { if (current(token) && copy) copy.textContent = String(error.message || error); }
  });
  disable?.addEventListener("click", async () => {
    const token = ++generation;
    setDeviceEnabled(false); records.clear(); render();
    try { await enqueue(token, async () => { await call({ action: "cancelAll", scope, deviceEnabled: false }); if (current(token)) { records.clear(); await refreshNow(token); } }); }
    catch (error) { if (current(token) && copy) copy.textContent = String(error.message || error); }
    finally { if (current(token)) capabilityChanged(); }
  });
  window.DuckTaskNotifications = {
    native: true,
    get available() { return deviceEnabled() && allowed(); },
    get foregroundEnabled() { return deviceEnabled(); },
    get permission() { return permission; },
    canSave: () => deviceEnabled(),
    get: id => records.get(id), refresh,
    async setContext(nextScope, tasks = []) {
      if (nextScope !== scope) { scope = String(nextScope); generation += 1; records.clear(); }
      const token = generation;
      knownTasks = new Map(tasks.map(task => [String(task.id), task])); contextKnown = true;
      const activeTaskIDs = tasks.filter(task => !task.completed && !task.deleted && !task.deleted_at).map(task => String(task.id));
      return enqueue(token, async () => {
        await call({ action: "context", scope, activeTaskIDs, deviceEnabled: deviceEnabled() });
        if (current(token)) await refreshNow(token);
      });
    },
    async detach() {
      const token = ++generation;
      records.clear(); knownTasks.clear(); contextKnown = false;
      const operation = queue.then(async () => { await call({ action: "cancelAll" }); if (current(token)) render(); });
      queue = operation.catch(() => {}); return operation;
    },
    async save(taskID, wallTime, { title, timeZone: zone = window.DuckReminderDomain.browserTimeZone(), scope: owner = scope } = {}) {
      const token = generation;
      if (owner !== scope) throw stale();
      if (wallTime && !deviceEnabled()) throw new Error("Normal notifications are paused on this device.");
      return enqueue(token, async () => {
        const task = knownTasks.get(String(taskID));
        if (wallTime && task && (task.completed || task.deleted || task.deleted_at)) throw new Error("This task is no longer active.");
        if (!wallTime) { await call({ action: "cancel", taskID }); if (current(token)) records.delete(taskID); return; }
        const resolved = window.DuckReminderDomain.wallTimeToEpoch(wallTime.slice(0, 10), wallTime.slice(11, 16), zone);
        if (!resolved.ok) throw new Error("That notification time does not exist in your time zone.");
        const result = await call({ action: "schedule", scope: owner, taskID, title: title || task?.title || "Task", fireAt: resolved.epoch, timeZone: zone });
        if (!current(token)) throw stale();
        records.set(taskID, result.notification);
        await refreshNow(token);
        return records.get(taskID);
      });
    },
  };
  window.addEventListener("focus", () => {
    const token = generation;
    refresh().catch(error => { if (current(token) && copy) copy.textContent = String(error.message || error); });
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      const token = generation;
      refresh().catch(error => { if (current(token) && copy) copy.textContent = String(error.message || error); });
    }
  });
  render();
})();
