// Real local/current API integration checks. Every context and account is disposable.
async (page) => {
  const browser = page.context().browser(), contexts = new Set(), cases = [], errors = [];
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 15000 });
  let stage = "setup", diagnostic = null;
  async function setup(origin, offline = false) {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "America/Los_Angeles", reducedMotion: "reduce", serviceWorkers: offline ? "allow" : "block" }); contexts.add(c);
    const p = await c.newPage(); p.setDefaultTimeout(15000); p.setDefaultNavigationTimeout(60000); p.on("pageerror", e => errors.push(e.message));
    if (!offline) await c.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    await p.goto(origin + "/?qa=work-alert-integrations#calendar", { waitUntil: "domcontentloaded" }); await p.bringToFront();
    await wait(p, () => typeof store !== "undefined" && workAlertContextReady);
    const date = await p.evaluate(() => { selectedDate = Model.addDays(nowKey(), 3); calendarView = "day"; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); return selectedDate; });
    return { c, p, origin, date };
  }
  const nav = (f, name) => f.p.locator(`#planner-sidebar [data-view="${name}"]`).click();
  async function section(f, selector) { if (!await f.p.locator(selector).evaluate(e => e.open)) await f.p.locator(selector + " > summary").click(); }
  async function save(f) { await f.p.locator("#save-task").click(); await wait(f.p, () => !document.querySelector("#task-modal").open); }
  const task = (f, title) => f.p.evaluate(title => structuredClone(store.listItems().find(t => t.title === title)), title);
  async function create(f, title, start = null) {
    await nav(f, "tasks"); await f.p.locator("#open-task-modal").click(); await f.p.locator('#task-form [name="title"]').fill(title);
    await section(f, "#task-schedule-options"); await f.p.locator('[name="scheduledDate"]').fill(start ? f.date : ""); await f.p.locator('[name="scheduledTime"]').fill(start || ""); await f.p.locator('[name="scheduledTime"]').press("Tab");
    await section(f, "#task-detail-options");
    await f.p.locator('[name="dueDate"]').fill(f.date); await f.p.locator('[name="dueTime"]').fill("23:00");
    await f.p.locator('[name="durationMinutes"]').selectOption("60"); await f.p.locator('#task-form [name="notes"]').fill("Retain drag notes and deadline");
    await save(f); return task(f, title);
  }
  async function apiJob(f, id, expected) {
    await wait(f.p, ({ id, expected }) => expected === null ? !DuckTaskNotifications.get(id) : DuckTaskNotifications.get(id)?.fire_at === expected, { id, expected });
    const response = await f.c.request.get(f.origin + "/api/alarms"), data = await response.json(), job = data.alarms.find(a => a.item_id === id);
    assert(expected === null ? !job : job?.fire_at === expected, "Real normal-notification schedule did not reconcile");
  }
  async function drag(f, source, target, hoverCalendar = false) {
    await source.scrollIntoViewIfNeeded(); const a = await source.boundingBox();
    if (!hoverCalendar) await target.scrollIntoViewIfNeeded();
    await f.p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await f.p.mouse.down();
    await f.p.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 });
    if (hoverCalendar) {
      const navBox = await f.p.locator('#planner-sidebar [data-view="calendar"]').boundingBox();
      await f.p.mouse.move(navBox.x + navBox.width / 2, navBox.y + navBox.height / 2, { steps: 10 });
      await wait(f.p, () => document.body.dataset.view === "calendar");
      await target.scrollIntoViewIfNeeded();
    }
    const b = await target.boundingBox(); await f.p.mouse.move(b.x + b.width / 2, b.y + 4, { steps: 15 }); await f.p.mouse.move(b.x + b.width / 2 + 1, b.y + 4);
    await wait(f.p, () => document.querySelector('.template-drop-preview[data-drag-placement="timeline"]:not([hidden])'));
    const visual = await f.p.evaluate(() => {
      const previews = [...document.querySelectorAll(".template-drop-preview:not([hidden])")], preview = previews[0], col = document.querySelector(".timeline-column.calendar-drop-target");
      return { count: previews.length, nativeImageCount: document.querySelectorAll("canvas.calendar-native-drag-image").length, width: preview.getBoundingClientRect().width, expectedWidth: col.getBoundingClientRect().width - 6, transform: getComputedStyle(preview).transform, caption: preview.querySelector("small").textContent };
    });
    assert(visual.count === 1 && visual.nativeImageCount === 1 && Math.abs(visual.width - visual.expectedWidth) < 1, "Drag did not use one fitted calendar block");
    await f.p.mouse.up(); return visual;
  }
  try {
    stage = "account signup/import/session and matrix";
    const f = await setup("http://127.0.0.1:8796");
    try {
      const original = await create(f, "Imported work alert QA", "10:00"), email = `work-alert-import-${Date.now()}@example.test`, password = `Fixture-${Date.now()}-OnlyLocalQA`;
      await nav(f, "settings"); await f.p.locator('#sign-in-form [name="email"]').fill(email); await f.p.locator('#sign-in-form [name="password"]').fill(password); await f.p.locator('#sign-in-form [data-action="sign-up"]').click();
      await wait(f.p, () => store.mode === "cloud" && store.user && workAlertContextReady);
      await f.p.locator("#import-local").click(); await wait(f.p, title => store.listItems().some(t => t.title === title), original.title);
      let imported = await task(f, original.title); assert(imported.id !== original.id && JSON.stringify(imported.workAlerts) === JSON.stringify(original.workAlerts), "Import changed alert preferences or failed to remap task identity");
      const backend = await (await f.c.request.get(f.origin + "/api/planner")).json(); assert(JSON.stringify(JSON.parse(backend.items.find(t => t.id === imported.id).work_alerts)) === JSON.stringify(original.workAlerts), "Import lost authoritative JSON");
      await f.p.locator("#sign-out").click(); await wait(f.p, () => store.mode === "local" && !store.user); assert((await task(f, original.title)).id === original.id, "Signout lost the independent local task");
      await f.p.locator('#sign-in-form [name="email"]').fill(email); await f.p.locator('#sign-in-form [name="password"]').fill(password); await f.p.locator('#sign-in-form [data-action="sign-in"]').click();
      await wait(f.p, id => store.mode === "cloud" && store.listItems().some(t => t.id === id), imported.id);
      await f.p.reload(); await wait(f.p, id => typeof store !== "undefined" && workAlertContextReady && store.mode === "cloud" && store.listItems().some(t => t.id === id), imported.id);
      cases.push({ test: "UI-signup-import-work-alert-JSON-signout-signin-session-restore", mode: "real current local Worker + independent local storage", status: "PASS" });
      stage = "matrix classification preserves linked settings"; await nav(f, "tasks"); await f.p.locator('[data-task-layout="matrix"]').click();
      if (!await f.p.locator(".matrix-unclassified").evaluate(e => e.open)) await f.p.locator(".matrix-unclassified > summary").click();
      const card = () => f.p.locator(`[data-matrix-task-id="${imported.id}"]`);
      await card().locator('[data-matrix-field="destination"]').selectOption("schedule"); await card().locator('[data-matrix-action="move"]').click();
      await wait(f.p, id => store.listItems().find(t => t.id === id)?.importance === "important" && store.listItems().find(t => t.id === id)?.urgency === "not_urgent", imported.id);
      await f.p.locator('.matrix-settings-form [name="urgencyDays"]').fill("9"); await f.p.locator('.matrix-settings-form button[type="submit"]').click();
      await wait(f.p, () => store.organizationPreferences().urgencyDays === 9);
      await f.p.reload(); await wait(f.p, id => typeof store !== "undefined" && workAlertContextReady && store.listItems().find(t => t.id === id)?.importance === "important" && store.organizationPreferences().urgencyDays === 9, imported.id);
      imported = await task(f, original.title); assert(JSON.stringify(imported.workAlerts) === JSON.stringify(original.workAlerts), "Matrix update changed work alerts");
      cases.push({ test: "matrix-move-organization-preference-reload-preserves-alert-JSON", mode: "real current local Worker", status: "PASS" });

      stage = "calendar task-list drag and Undo"; await nav(f, "tasks"); await f.p.locator('[data-task-layout="list"]').click(); const moving = await create(f, "List drag linked alert QA");
      const taskCount = await f.p.evaluate(() => store.listItems().length);
      await nav(f, "calendar"); await f.p.evaluate(date => { selectedDate = date; calendarView = "day"; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); }, f.date); await f.p.locator("#calendar-tasks-tab").click();
      const target = f.p.locator(`[data-slot-date="${f.date}"][data-slot-time="14:00"]`);
      const visual = await drag(f, f.p.locator(`#daily-task-panel .task-select[data-drag-task="${moving.id}"]`), target);
      await wait(f.p, ({ id, at }) => store.listItems().find(t => t.id === id)?.scheduledStart === at, { id: moving.id, at: f.date + "T14:00" });
      let moved = await task(f, moving.title); assert(moved.id === moving.id && moved.dueDate === moving.dueDate && moved.dueTime === moving.dueTime && moved.notes === moving.notes && moved.durationMinutes === moving.durationMinutes, "List drag changed identity/deadline/saved settings");
      let resolved = await f.p.evaluate(id => DuckWorkAlerts.deliveries(store.listItems().find(t => t.id === id)).notification.fireAt, moving.id); await apiJob(f, moving.id, resolved);
      await f.p.locator("#toast-action").click(); await wait(f.p, id => !store.listItems().find(t => t.id === id)?.scheduledStart, moving.id); await apiJob(f, moving.id, null);
      cases.push({ test: "calendar-task-list-native-drag-one-fitted-preview-linked-notification-and-Undo", mode: "real current local Worker, trusted mouse", visual, status: "PASS" });

      stage = "Tasks-list Calendar-hover drag"; await nav(f, "tasks");
      const hoverVisual = await drag(f, f.p.locator(`#all-task-list .task-select[data-drag-task="${moving.id}"]`), target, true);
      await wait(f.p, ({ id, at }) => store.listItems().find(t => t.id === id)?.scheduledStart === at, { id: moving.id, at: f.date + "T14:00" });
      resolved = await f.p.evaluate(id => DuckWorkAlerts.deliveries(store.listItems().find(t => t.id === id)).notification.fireAt, moving.id); await apiJob(f, moving.id, resolved);
      await f.p.reload(); await wait(f.p, ({ id, count }) => typeof store !== "undefined" && workAlertContextReady && store.listItems().length === count && store.listItems().find(t => t.id === id)?.scheduledStart.endsWith("T14:00"), { id: moving.id, count: taskCount });
      cases.push({ test: "Tasks-list-hover-Calendar-native-drag-same-ID-count-and-reload", mode: "real current local Worker, trusted mouse", visual: hoverVisual, status: "PASS" });

      stage = "future template immediate drop defaults"; await nav(f, "calendar"); await f.p.evaluate(date => { selectedDate = date; calendarView = "day"; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); }, f.date); await f.p.locator("#calendar-templates-tab").click();
      await f.p.locator('#calendar-assignment-templates [data-library-action="new-template"]').click(); const dialog = f.p.locator("#planner-library-dialog");
      await dialog.locator('[name="title"]').fill("Future dropped template QA"); await dialog.locator('[name="durationMinutes"]').fill("60"); await dialog.locator('[name="notes"]').fill("Retained template notes"); await dialog.getByRole("button", { name: "Save template", exact: true }).click(); await dialog.waitFor({ state: "detached" });
      const templateId = await f.p.evaluate(() => store.listTemplates().find(t => t.title === "Future dropped template QA").id);
      const targetTemplate = f.p.locator(`[data-slot-date="${f.date}"][data-slot-time="16:00"]`); await targetTemplate.scrollIntoViewIfNeeded();
      await f.p.locator(`#calendar-assignment-templates [data-library-template="${templateId}"]`).dragTo(targetTemplate, { targetPosition: { x: 20, y: 4 } });
      await wait(f.p, title => store.listItems().some(t => t.title === title), "Future dropped template QA");
      const copy = await task(f, "Future dropped template QA"); assert(copy.id !== templateId && copy.scheduledStart === f.date + "T16:00" && copy.workAlerts.alarm.enabled && copy.workAlerts.alarm.mode === "work" && copy.workAlerts.notification.enabled && copy.workAlerts.notification.mode === "alarm", "Immediate template drop did not create linked defaults");
      resolved = await f.p.evaluate(id => DuckWorkAlerts.deliveries(store.listItems().find(t => t.id === id)).notification.fireAt, copy.id); await apiJob(f, copy.id, resolved);
      assert(await f.p.evaluate(id => store.listTemplates().some(t => t.id === id), templateId), "Template drop removed source");
      cases.push({ test: "future-template-native-drop-creates-independent-linked-pair-and-real-job", mode: "real current local Worker, trusted mouse", status: "PASS" });
    } finally { await f.c.close(); contexts.delete(f.c); }

    stage = "browser service-worker shell offline save/reload/reconnect"; const offline = await setup("http://127.0.0.1:8034", true);
    try {
      await offline.p.evaluate(async () => { await DuckPlanApp.ready; }); await wait(offline.p, () => Boolean(navigator.serviceWorker.controller));
      const cache = await offline.p.evaluate(async () => ({ keys: await caches.keys(), files: (await (await caches.open("duckplan-app-motion-preview-v55")).keys()).map(r => new URL(r.url).pathname) }));
      for (const name of ["work-alerts.js", "work-alert-controller.js", "work-alerts.css", "native-task-notifications.js"]) assert(cache.files.includes("/" + name), "Offline shell missed " + name);
      await offline.p.reload(); await wait(offline.p, () => typeof store !== "undefined" && workAlertContextReady);
      await offline.c.setOffline(true); await offline.p.reload({ waitUntil: "domcontentloaded" }); await wait(offline.p, () => typeof store !== "undefined" && workAlertContextReady && store.mode === "local");
      const saved = await create(offline, "Offline linked alert QA", "10:00");
      await offline.p.reload({ waitUntil: "domcontentloaded" }); await wait(offline.p, id => typeof store !== "undefined" && workAlertContextReady && store.listItems().find(t => t.id === id)?.workAlerts.notification.mode === "alarm", saved.id);
      assert((await task(offline, saved.title)).workAlerts.alarm.mode === "work", "Offline reload lost linked preferences");
      await offline.c.setOffline(false); await offline.p.reload(); await wait(offline.p, id => typeof store !== "undefined" && workAlertContextReady && store.listItems().some(t => t.id === id), saved.id);
      cases.push({ test: "v55-registered-browser-shell-new-alert-assets-offline-save-reload-reconnect", mode: "normal browser tab/local storage, actual service worker; NOT installed PWA", cache: cache.keys, status: "PASS" });
    } finally { await offline.c.setOffline(false); await offline.c.close(); contexts.delete(offline.c); }
    return { runtime: browser.version(), cases, errors, allSyntheticContextsClosed: contexts.size === 0, scope: "Actual isolated APIs, trusted desktop input and browser SW. DOM preview evidence does not prove absence of an OS drag bitmap. No installed-PWA or OS notification delivery claim." };
  } catch (error) { return { runtime: browser.version(), stage, error: error.message, diagnostic, cases, errors }; }
  finally { for (const c of contexts) await c.close(); }
}
