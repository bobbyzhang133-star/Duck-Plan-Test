(function completionDemoFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckCompletionDemo = api;
})(typeof window !== "undefined" ? window : globalThis, function buildCompletionDemo() {
  "use strict";
  function configure({ location, storage, cloud = {} }) {
    const tag = new URLSearchParams(location.search).get("demo") || "";
    const enabled = ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname)
      && /^completion-\d{8}(?:-\d+)?$/.test(tag) && !cloud.apiUrl && !cloud.native;
    if (!enabled) return { enabled: false, storage };
    const prefix = `duckplan-preview:${tag}:`;
    return { enabled: true, tag, storage: {
      getItem: key => storage.getItem(prefix + key),
      setItem: (key, value) => storage.setItem(prefix + key, value),
      removeItem: key => storage.removeItem(prefix + key)
    } };
  }
  async function seed({ demo, store, model, alerts }) {
    if (!demo?.enabled || store.mode !== "local" || store.user) return 0;
    const date = model.todayKey(), classes = store.listClasses();
    const specs = [
      ["Finish a short warm-up", "Physics", model.addDays(date, -1), null],
      ["Calculus practice", "Calculus", date, "09:00"],
      ["Review physics notes", "Physics", date, "10:00"],
      ["Sketch an app wireframe", "Computer Science", date, "11:00"],
      ["Practice vocabulary", "English", date, "14:00"],
      ["Send the reading response", "English", date, null],
      ["Plan tomorrow's reading", "Personal", "", null],
      ["Choose a project topic", "Personal", "", null]
    ];
    let added = 0;
    for (const [index, [title, className, dueDate, time]] of specs.entries()) {
      if (store.mode !== "local" || store.user) break;
      const id = `${demo.tag}-${index}`;
      if (store.listItems().some(task => task.id === id)) continue;
      const workAlerts = alerts.defaults();
      workAlerts.alarm.enabled = false; workAlerts.notification.enabled = false;
      await store.upsertItem({ id, title: `Sample: ${title}`, classId: classes.find(item => item.name === className)?.id || null,
        dueDate, dueTime: dueDate ? "23:59" : "", scheduledStart: time ? `${date}T${time}` : null,
        durationMinutes: index % 2 ? 45 : 30, priority: index === 0 ? "High" : "Medium", completed: false,
        reminderChoice: "off", workAlerts, schemaVersion: 2 });
      added += 1;
    }
    return added;
  }
  return Object.freeze({ configure, seed });
});
