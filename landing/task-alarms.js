(() => {
  "use strict";
  const element = id => document.querySelector(id);
  const nativeHost = Boolean(window.DuckNativeAlarms || window.DuckNativeNotifications);
  const normalCopy = element("#task-notification-status");
  const enable = element("#enable-task-notifications");
  const disable = element("#disable-task-notifications");

  if (!window.DuckNativeAlarms) {
    const unavailable = () => {
      const copy = element("#task-alarm-status");
      if (copy) copy.textContent = "Ringing alarms are available in the DuckPlan iPhone app. Normal task notifications can be enabled separately below.";
      const button = element("#enable-task-alarms"); if (button) button.hidden = true;
      const cancel = element("#disable-task-alarms"); if (cancel) cancel.hidden = true;
    };
    window.DuckTaskAlarms = {
      native: false, available: false, canSave: () => false, get: () => undefined,
      refresh: async () => unavailable(), setContext: async () => {}, detach: async () => {}, save: async () => {},
    };
    unavailable();
  }
  if (nativeHost) {
    window.DuckTaskNotifications = {
      native: true, available: false, canSave: () => false, get: () => undefined,
      refresh: async () => {
        if (!window.DuckNativeNotifications && normalCopy) normalCopy.textContent = "This app version does not support normal task notifications yet. Update the iPhone app to enable them.";
      },
      setContext: async () => {}, detach: async () => {},
      save: async (_id, wallTime) => { if (wallTime) throw new Error("Update the iPhone app to enable normal task notifications."); },
    };
    if (enable) enable.disabled = true;
    if (disable) disable.hidden = true;
    return;
  }

  const records = new Map();
  let queue = Promise.resolve(), scope = "local", generation = 0, serverAvailable = false;
  let pushAvailable = false, deviceSubscribed = false;
  let subscriptionGeneration = 0;
  const deviceChoices = new Map();
  function deviceEnabled() {
    try { const saved = window.localStorage?.getItem(`duckplan.normal-device-enabled.v1:${scope}`); if (saved === "off") return false; if (saved === "on") return true; } catch { /* Session choice remains available. */ }
    return deviceChoices.get(scope) !== false;
  }
  function setDeviceEnabled(enabled) {
    deviceChoices.set(scope, enabled);
    try { window.localStorage?.setItem(`duckplan.normal-device-enabled.v1:${scope}`, enabled ? "on" : "off"); } catch { /* Session preference still applies. */ }
  }
  const capabilityChanged = () => window.dispatchEvent?.(new Event("duckplan:work-alert-capability"));
  const local = () => scope === "local" || scope.startsWith("local:");
  const current = token => token === generation;
  const stale = () => new Error("The notification context changed. Try again in the current account.");
  const enqueue = (token, action) => {
    const operation = queue.then(() => { if (!current(token)) throw stale(); return action(); });
    queue = operation.catch(() => {});
    return operation;
  };
  async function api(method, path, body) {
    const response = await fetch(`/api${path}`, {
      method, credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not save the notification.");
    return data;
  }
  async function registration() {
    // .ready can remain pending forever when workers are blocked or not installed.
    // Schedule persistence does not require a worker; only push opt-in does.
    try {
      const serviceWorker = window.navigator?.serviceWorker;
      return typeof serviceWorker?.getRegistration === "function" ? await serviceWorker.getRegistration() : undefined;
    } catch { return undefined; }
  }
  function discoverSubscription(token) {
    const lookup = ++subscriptionGeneration;
    registration().then(worker => worker?.active ? worker.pushManager?.getSubscription?.() : undefined)
      .then(subscription => {
        if (!current(token) || lookup !== subscriptionGeneration) return;
        const changed = deviceSubscribed !== Boolean(subscription);
        deviceSubscribed = Boolean(subscription); render();
        if (changed) capabilityChanged();
      }).catch(() => {
        if (!current(token) || lookup !== subscriptionGeneration) return;
        const changed = deviceSubscribed;
        deviceSubscribed = false; render();
        if (changed) capabilityChanged();
      });
  }
  function render() {
    const permission = window.Notification?.permission;
    if (normalCopy) normalCopy.textContent = !deviceEnabled() ? "Normal notifications are paused on this device. Your saved task notification settings stay unchanged."
      : local()
      ? permission === "granted" ? "Normal notifications are allowed. Local reminders appear while this page is open."
        : permission === "denied" ? "Normal notification permission is off. Local reminders can still appear in DuckPlan while this page is open."
          : "Local reminders appear while this page is open. Allow notifications to also show a normal device banner."
      : !serverAvailable ? "Sign in on the hosted app to schedule notifications while DuckPlan is closed. Local open-page reminders remain available."
        : !pushAvailable ? "Notification delivery is awaiting server activation. Your notification times can be saved now."
          : deviceSubscribed ? "Normal task notifications are enabled on this device. Other devices must opt in separately."
            : "Enable this device to receive normal task notifications, including while DuckPlan is closed. On iPhone, open DuckPlan from your Home Screen first.";
    if (enable) {
      enable.textContent = !deviceEnabled() ? "Resume normal notifications" : local() ? "Allow normal notifications" : "Enable normal notifications";
      enable.hidden = deviceEnabled() && (local() ? permission === "granted" : deviceSubscribed);
      enable.disabled = !window.Notification?.requestPermission || permission === "denied";
    }
    if (disable) { disable.hidden = !deviceEnabled() || !deviceSubscribed && !local(); disable.textContent = "Pause normal notifications on this device"; }
  }
  async function refreshNow(token) {
    if (local() || !window.DUCKPLAN_CLOUD?.apiUrl) {
      if (current(token)) { records.clear(); serverAvailable = false; pushAvailable = false; deviceSubscribed = false; render(); }
      return;
    }
    try {
      const config = await api("GET", "/push/config");
      if (!current(token)) return;
      const data = await api("GET", "/alarms");
      if (!current(token)) return;
      records.clear();
      for (const record of data.alarms || []) records.set(record.item_id, record);
      serverAvailable = true; pushAvailable = Boolean(config.available);
      render(); discoverSubscription(token);
    } catch (error) {
      if (!current(token)) return;
      records.clear(); serverAvailable = false; pushAvailable = false; deviceSubscribed = false; render();
      if (normalCopy && error.message && !/sign in|unauth|session/i.test(error.message)) normalCopy.textContent = error.message;
    }
  }
  async function refresh() {
    const token = generation;
    return enqueue(token, () => refreshNow(token));
  }
  enable?.addEventListener("click", async () => {
    const token = generation;
    enable.disabled = true;
    try {
      if (local()) setDeviceEnabled(true);
      // Keep permission directly inside the user's click, before queued network work.
      if (!window.Notification?.requestPermission || await window.Notification.requestPermission() !== "granted") throw new Error("Allow normal notifications in device settings to receive a banner.");
      if (!current(token)) return;
      if (local() || !window.DUCKPLAN_CLOUD?.apiUrl) { render(); capabilityChanged(); return; }
      await enqueue(token, async () => {
        const config = await api("GET", "/push/config");
        if (!current(token)) return;
        if (!config.available || !config.publicKey) throw new Error("Notification delivery is awaiting server activation. Local open-page reminders remain available.");
        const worker = await registration();
        if (!current(token)) return;
        if (!worker?.active || !worker?.pushManager) throw new Error("Background notifications need an active service worker. Local open-page reminders remain available.");
        const key = Uint8Array.from(atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
        const subscription = await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        if (!current(token)) { await subscription.unsubscribe(); return; }
        try { await api("POST", "/push/devices", { endpoint: subscription.endpoint }); }
        catch (error) { await subscription.unsubscribe(); throw error; }
        if (!current(token)) { await subscription.unsubscribe(); return; }
        setDeviceEnabled(true);
        deviceSubscribed = true;
        await refreshNow(token);
        if (current(token)) capabilityChanged();
      });
    } catch (error) { if (current(token) && normalCopy) normalCopy.textContent = error.message; }
    finally { if (current(token) && enable) enable.disabled = !window.Notification?.requestPermission || window.Notification.permission === "denied"; }
  });
  disable?.addEventListener("click", async () => {
    const token = ++generation;
    setDeviceEnabled(false); render();
    try {
      await enqueue(token, async () => {
        const worker = await registration(), subscription = await worker?.pushManager?.getSubscription?.();
        if (!current(token)) return;
        if (subscription) {
          try { if (!local()) await api("DELETE", "/push/devices", { endpoint: subscription.endpoint }); }
          finally { await subscription.unsubscribe(); }
        }
        if (current(token)) await refreshNow(token);
      });
    } catch (error) { if (current(token) && normalCopy) normalCopy.textContent = error.message; }
    finally { if (current(token)) capabilityChanged(); }
  });
  window.DuckTaskNotifications = {
    native: false,
    get available() { return deviceEnabled() && serverAvailable && pushAvailable && deviceSubscribed && window.Notification?.permission === "granted"; },
    get foregroundEnabled() { return deviceEnabled(); },
    canSave: () => serverAvailable,
    get: id => records.get(id), refresh,
    async setContext(nextScope, tasks = []) {
      if (nextScope !== scope) { scope = String(nextScope); generation += 1; records.clear(); serverAvailable = false; pushAvailable = false; deviceSubscribed = false; }
      const token = generation;
      const active = new Set(tasks.filter(task => !task.completed && !task.deleted && !task.deleted_at).map(task => String(task.id)));
      return enqueue(token, async () => {
        if (!local() && serverAvailable) {
          for (const id of records.keys()) {
            if (!active.has(String(id))) { await api("DELETE", `/alarms/${encodeURIComponent(id)}`); if (!current(token)) return; records.delete(id); }
          }
        }
        await refreshNow(token);
      });
    },
    async detach() {
      const token = ++generation;
      records.clear(); serverAvailable = false; pushAvailable = false; deviceSubscribed = false;
      const operation = queue.then(async () => {
        const worker = await registration(), subscription = await worker?.pushManager?.getSubscription?.();
        if (subscription) {
          try { await api("DELETE", "/push/devices", { endpoint: subscription.endpoint }); }
          finally { await subscription.unsubscribe(); }
        }
        if (current(token)) render();
      });
      queue = operation.catch(() => {}); return operation;
    },
    async save(taskID, wallTime, { timeZone: zone = window.DuckReminderDomain.browserTimeZone(), scope: owner = scope } = {}) {
      const token = generation;
      if (owner !== scope) throw stale();
      if (!serverAvailable) { if (wallTime) throw new Error("Background notifications are unavailable. This task can use an open-page reminder instead."); return; }
      return enqueue(token, async () => {
        if (!wallTime) { await api("DELETE", `/alarms/${encodeURIComponent(taskID)}`); if (current(token)) records.delete(taskID); return; }
        const resolved = window.DuckReminderDomain.wallTimeToEpoch(wallTime.slice(0, 10), wallTime.slice(11, 16), zone);
        if (!resolved.ok) throw new Error("That notification time does not exist in your time zone.");
        const data = await api("PUT", `/alarms/${encodeURIComponent(taskID)}`, { fireAt: resolved.epoch, timeZone: zone });
        if (!current(token)) throw stale();
        records.set(taskID, data.alarm); return data.alarm;
      });
    },
  };
  render();
})();
