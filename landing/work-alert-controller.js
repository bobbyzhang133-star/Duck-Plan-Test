(function workAlertControllerFactory(root, factory) {
  const domain = typeof module === "object" && module.exports ? require("./work-alerts.js") : root?.DuckWorkAlerts;
  const api = factory(domain);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckWorkAlertController = api;
})(typeof window !== "undefined" ? window : globalThis, function buildWorkAlertController(Domain) {
  "use strict";

  function create({ store, alarms, notifications, timeZone, now = Date.now, timers = globalThis, storage = null, onForeground = () => {}, onError = () => {} }) {
    let queue = Promise.resolve(), owner = null, generation = 0, contextKey = "", destroyed = false;
    const applied = new Map(), foreground = new Map();
    const scope = () => store.user?.id || "local";
    const identity = () => `${store.mode}:${scope()}`;
    const zone = () => typeof timeZone === "function" ? timeZone() : timeZone;
    const current = operation => !destroyed && operation.owner === identity() && operation.generation === generation;
    function capture() {
      const next = identity();
      if (next !== owner) { owner = next; generation += 1; contextKey = ""; applied.clear(); foreground.clear(); }
      return { owner, generation, scope: scope() };
    }
    function enqueue(operation, run) {
      const result = queue.then(() => current(operation) ? run() : undefined);
      queue = result.catch(() => {});
      return result;
    }
    function wallTime(record, timeZone = zone()) {
      if (!Number.isFinite(record?.fire_at)) return null;
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).formatToParts(new Date(record.fire_at)).map(part => [part.type, part.value]));
      return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
    }
    function preferences(task) {
      const alarm = alarms?.get(task.id), notification = notifications?.get(task.id);
      return Domain.preferences(task, {
        timeZone: zone(), legacyAlarmAt: wallTime(alarm), legacyNotificationAt: wallTime(notification),
        legacySound: alarm?.sound, legacySnoozeMinutes: alarm?.snoozeMinutes,
      });
    }
    function legacyPreferences(task) {
      if (task.workAlerts != null || task.completed || task.deleted || task.deleted_at) return null;
      const records = Object.fromEntries([["alarm", alarms], ["notification", notifications]].map(([channel, provider]) => [channel, provider?.native ? provider.get?.(task.id) : null]));
      const valid = record => record?.item_id === task.id && Number.isFinite(record.fire_at) && record.fire_at % 60000 === 0 && record.fire_at >= now() + Domain.MIN_AHEAD_MS && record.fire_at <= now() + Domain.MAX_AHEAD_MS;
      const first = [records.alarm, records.notification].find(valid);
      if (!first) return null;
      try {
        const prefs = Domain.defaults({ timeZone: first.time_zone || first.timeZone || zone() });
        // Import only channels that actually existed on this device. Initializing
        // normal defaults here would silently turn on a previously absent channel.
        prefs.alarm.enabled = false;
        prefs.notification.enabled = false;
        let count = 0;
        for (const channel of ["alarm", "notification"]) {
          const record = records[channel];
          if (!valid(record)) continue;
          const value = { enabled: true, mode: "manual", at: wallTime(record, prefs.timeZone) };
          if (channel === "alarm") Object.assign(value, { sound: record.sound ?? "system", snoozeMinutes: record.snoozeMinutes ?? 5 });
          let candidate;
          try { candidate = Domain.normalize({ ...prefs, [channel]: value }); }
          catch { continue; }
          const delivery = Domain.deliveries({ ...task, workAlerts: candidate }, { now: now() })[channel];
          // A repeated DST wall time cannot always encode the original instant.
          // Leave that legacy request intact instead of migrating a different time.
          if (!delivery.eligible || delivery.fireAt !== record.fire_at) continue;
          prefs[channel] = candidate[channel]; count += 1;
        }
        return count ? prefs : null;
      } catch { return null; }
    }
    async function establish(operation, { refresh = false } = {}) {
      if (!current(operation)) return false;
      const tasks = store.listItems(), ids = tasks.filter(task => !task.completed).map(task => task.id).sort();
      const key = `${operation.owner}:${JSON.stringify(ids)}`;
      if (contextKey !== key) {
        for (const provider of [alarms, notifications]) {
          await provider?.setContext?.(operation.scope, tasks);
          if (!current(operation)) return false;
        }
        contextKey = key;
        refresh = true;
      }
      if (refresh) {
        for (const provider of [alarms, notifications]) {
          await provider?.refresh?.();
          if (!current(operation)) return false;
        }
      }
      return true;
    }
    function deliveredKey(operation) { return `duckplan-work-delivered-v1:${operation.owner}`; }
    function wasDelivered(operation, id, fireAt) {
      try { return JSON.parse(storage?.getItem(deliveredKey(operation)) || "{}")[id] === fireAt; } catch { return false; }
    }
    function markDelivered(operation, id, fireAt) {
      try {
        const entries = JSON.parse(storage?.getItem(deliveredKey(operation)) || "{}");
        entries[id] = fireAt;
        storage?.setItem(deliveredKey(operation), JSON.stringify(Object.fromEntries(Object.entries(entries).slice(-1000))));
      } catch { /* A live page still retires the occurrence if browser storage is unavailable. */ }
    }
    async function synchronizeTask(task, operation) {
      if (!current(operation) || !task.workAlerts) return [];
      const desired = Domain.deliveries(task, { now: now() }), errors = [];
      for (const channel of ["alarm", "notification"]) {
        if (!current(operation)) return errors;
        const provider = channel === "alarm" ? alarms : notifications, delivery = desired[channel];
        const key = `${task.id}:${channel}`;
        if (channel === "notification" && !provider?.available && !provider?.native && provider?.foregroundEnabled !== false) {
          if (delivery.eligible && !wasDelivered(operation, task.id, delivery.fireAt)) foreground.set(task.id, { task, delivery, operation });
          else if (!(delivery.status === "past" && foreground.get(task.id)?.delivery.fireAt === delivery.fireAt && now() - delivery.fireAt <= 60000)) foreground.delete(task.id);
        } else if (channel === "notification") foreground.delete(task.id);
        if (!provider?.canSave?.()) continue;
        const signature = JSON.stringify(delivery.eligible ? [delivery.fireAt, task.title, delivery.sound, delivery.snoozeMinutes] : [null]);
        const record = provider.get?.(task.id);
        if (applied.get(key) === signature && (!delivery.eligible || record?.fire_at === delivery.fireAt)) continue;
        try {
          await provider.save(task.id, delivery.eligible ? delivery.wallTime : "", {
            title: task.title, timeZone: delivery.timeZone, scope: operation.scope,
            sound: delivery.sound, snoozeMinutes: delivery.snoozeMinutes,
          });
          if (current(operation)) applied.set(key, signature);
        } catch (error) {
          if (current(operation)) errors.push({ channel, error });
        }
      }
      return errors;
    }
    async function reconcile({ refresh = false } = {}) {
      const operation = capture();
      return enqueue(operation, async () => {
        if (!await establish(operation, { refresh })) return;
        const tasks = store.listItems(), active = new Set(tasks.filter(task => !task.completed).map(task => task.id));
        for (const id of foreground.keys()) if (!active.has(id)) foreground.delete(id);
        for (const task of tasks) {
          if (!current(operation)) return;
          let candidate = task;
          if (store.mode === "cloud" && store.supportsSettingsAdoption && task.workAlerts == null) {
            const prefs = legacyPreferences(task);
            if (prefs) {
              try {
                const result = await store.adoptItemSettings(task.id, { workAlerts: prefs });
                if (!current(operation)) return;
                candidate = result.item || task;
              } catch (error) {
                if (current(operation)) onError(new Error(`Saved alert times for ${task.title} could not sync: ${error.message}`));
                continue;
              }
            }
          }
          const errors = await synchronizeTask(candidate, operation);
          if (!current(operation)) return;
          for (const item of errors) onError(new Error(`${item.channel === "alarm" ? "Ringing alarm" : "Notification"} for ${task.title}: ${item.error.message}`));
        }
      });
    }
    async function save(task) {
      const operation = capture();
      // Load legacy channel records before initializing preferences, preserving custom times.
      await enqueue(operation, () => establish(operation));
      if (!current(operation)) throw new Error("Your account changed. Please try again.");
      const next = { ...task, workAlerts: preferences(task) };
      const saved = await store.upsertItem(next);
      if (!current(operation)) return saved;
      const errors = await enqueue(operation, async () => {
        if (!await establish(operation)) return [];
        const latest = store.listItems().find(item => item.id === saved.id);
        return latest ? synchronizeTask(latest, operation) : [];
      });
      if (errors?.length && current(operation)) {
        const message = errors.map(item => `${item.channel === "alarm" ? "ringing alarm" : "notification"}: ${item.error.message}`).join("; ");
        const error = new Error(`Task saved, but alerts need attention (${message}).`);
        error.savedTask = saved;
        throw error;
      }
      return saved;
    }
    function tick() {
      const operation = capture();
      for (const [id, item] of foreground) {
        if (!current(item.operation)) { foreground.delete(id); continue; }
        if (notifications?.available || notifications?.foregroundEnabled === false) { foreground.delete(id); continue; }
        if (item.delivery.fireAt > now()) continue;
        foreground.delete(id);
        const task = store.listItems().find(candidate => candidate.id === id && !candidate.completed);
        if (!task || now() - item.delivery.fireAt > 60000 || wasDelivered(operation, id, item.delivery.fireAt)) continue;
        const currentDelivery = Domain.deliveries(task, { now: now() }).notification;
        if (currentDelivery.fireAt !== item.delivery.fireAt || !["past", "too-soon", "ready"].includes(currentDelivery.status)) continue;
        markDelivered(operation, id, item.delivery.fireAt);
        onForeground(task);
      }
    }
    const timer = timers.setInterval?.(tick, 1000);
    timer?.unref?.();
    return {
      preferences, save, reconcile, tick,
      refresh() { const operation = capture(); return enqueue(operation, () => establish(operation, { refresh: true })); },
      async detach() {
        generation += 1; contextKey = ""; applied.clear(); foreground.clear();
        await Promise.all([alarms?.detach?.(), notifications?.detach?.()]);
      },
      destroy() { destroyed = true; generation += 1; foreground.clear(); timers.clearInterval?.(timer); },
    };
  }
  return { create };
});
