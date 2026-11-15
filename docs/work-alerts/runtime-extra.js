// Controlled negative paths and foreground delivery in disposable browser contexts only.
async (page) => {
  const browser = page.context().browser(), contexts = new Set(), cases = [], errors = [], failed = [];
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 15000 });
  const bound = async promise => { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Held fixture response did not arrive")), 10000); })]); } finally { clearTimeout(timer); } };
  let stage = "start", diagnostic = null;
  async function setup(cloud = true, clock = false) {
    const origin = cloud ? "http://127.0.0.1:8796" : "http://127.0.0.1:8034";
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "America/Los_Angeles", serviceWorkers: "block", reducedMotion: "reduce" }); contexts.add(c);
    await c.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    if (!cloud) await c.grantPermissions([], { origin });
    if (cloud) {
      const r = await c.request.post(origin + "/api/auth/sign-up", { headers: { Origin: origin }, data: { email: `work-alert-guard-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`, password: `Fixture-${Date.now()}-OnlyLocalQA` } }); check(r.status() === 201, "Signup failed");
    }
    const p = await c.newPage(); p.setDefaultTimeout(15000); p.setDefaultNavigationTimeout(60000);
    p.on("pageerror", e => errors.push({ origin, message: e.message })); p.on("requestfailed", r => failed.push({ origin, path: new URL(r.url()).pathname, error: r.failure()?.errorText }));
    if (clock) await p.clock.install({ time: new Date("2026-11-20T09:59:00-08:00") });
    await p.goto(origin + "/?qa=work-alert-guards#calendar", { waitUntil: "domcontentloaded" }); await p.bringToFront();
    await wait(p, cloud => typeof store !== "undefined" && workAlertContextReady && (cloud ? store.mode === "cloud" && store.user : store.mode === "local"), cloud);
    const date = await p.evaluate(clock => { selectedDate = clock ? nowKey() : Model.addDays(nowKey(), 2); calendarView = "day"; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); return selectedDate; }, clock);
    return { c, p, origin, date, cloud };
  }
  async function close(f) { await f.c.close(); contexts.delete(f.c); }
  async function draft(f, title, time = "10:00", normal = true) {
    await f.p.locator("#calendar-tasks-tab").click(); await f.p.locator("#plan-selected-date").click();
    await f.p.locator('#task-form [name="title"]').fill(title);
    if (!await f.p.locator("#task-schedule-options").evaluate(e => e.open)) await f.p.locator("#task-schedule-options > summary").click();
    await f.p.locator('[name="scheduledDate"]').fill(f.date); await f.p.locator('[name="scheduledTime"]').fill(time); await f.p.locator('[name="scheduledTime"]').press("Tab");
    if (!await f.p.locator("#task-alarm-options").evaluate(e => e.open)) await f.p.locator("#task-alarm-options > summary").click();
    if (!normal) await f.p.locator('[name="notificationEnabled"]').uncheck();
  }
  async function save(f) { await f.p.locator("#save-task").click(); await wait(f.p, () => !document.querySelector("#task-modal").open); }
  async function data(f, title) { return f.p.evaluate(title => structuredClone(store.listItems().find(t => t.title === title)), title); }
  try {
    stage = "local permission-denied foreground and dedup";
    const local = await setup(false, true);
    try {
      const permission = await local.p.evaluate(() => Notification.permission); check(permission === "denied", "Fixture did not deny browser notifications: " + permission);
      await draft(local, "Foreground reminder QA", "10:00"); await save(local);
      await draft(local, "Disabled reminder QA", "10:00", false); await save(local);
      const active = await data(local, "Foreground reminder QA"), muted = await data(local, "Disabled reminder QA");
      await local.p.reload(); await wait(local.p, id => typeof store !== "undefined" && workAlertContextReady && store.listItems().some(t => t.id === id), active.id);
      await local.p.clock.fastForward(61000); await wait(local.p, () => document.querySelector("#toast-message").textContent === "Time to start: Foreground reminder QA");
      check(!await local.p.evaluate(() => document.querySelector("#toast-message").textContent.includes("Disabled reminder")), "Disabled task showed foreground reminder");
      check((await local.p.locator("#task-notification-status").textContent()).includes("permission is off"), "Permission denial is not explained");
      await local.p.reload(); await wait(local.p, () => typeof store !== "undefined" && workAlertContextReady); await local.p.clock.fastForward(5000);
      check(!await local.p.evaluate(() => document.querySelector("#toast-message").textContent.startsWith("Time to start:")), "Reload duplicated a delivered reminder");
      cases.push({ test: "local-permission-denied-foreground-reminder-disabled-switch-and-reload-dedup", mode: "local browser storage, controlled browser clock", status: "PASS", permission, activeTaskId: active.id, mutedTaskId: muted.id });
    } finally { await close(local); }

    stage = "real task save failure and retry";
    const failure = await setup();
    try {
      await draft(failure, "Failed task retry QA");
      await failure.c.route("**/api/items/*", route => route.request().method() === "PUT" ? route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Injected task save failure"}' }) : route.continue(), { times: 1 });
      await failure.p.locator("#save-task").click();
      try { await wait(failure.p, () => !document.querySelector("#task-form-error").hidden && /Injected/.test(document.querySelector("#task-form-error").textContent)); }
      catch (error) { diagnostic = await failure.p.evaluate(() => ({ taskError: document.querySelector("#task-form-error").textContent, hidden: document.querySelector("#task-form-error").hidden, alertError: document.querySelector("#task-alarm-save-error").textContent, modal: document.querySelector("#task-modal").open, disabled: document.querySelector("#save-task").disabled, tasks: store.listItems(), toast: document.querySelector("#toast-message").textContent })); throw error; }
      check(!await data(failure, "Failed task retry QA"), "Failed task remained in store");
      await save(failure); const task = await data(failure, "Failed task retry QA");
      const backend = await failure.c.request.get(failure.origin + "/api/planner"); const records = await backend.json();
      check(records.items.filter(t => t.title === task.title).length === 1, "Retry duplicated task");
      cases.push({ test: "task-PUT-503-rollback-and-real-retry", mode: "real current local Worker; explicit negative-response injection", status: "PASS", taskId: task.id });
    } finally { await close(failure); }

    stage = "alert partial failure retains task ID";
    const partial = await setup();
    try {
      let deny = true;
      await partial.c.route("**/api/alarms/*", route => deny && route.request().method() === "PUT" ? route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Injected notification save failure"}' }) : route.continue());
      await draft(partial, "Partial alert retry QA"); await partial.p.locator("#save-task").click();
      await wait(partial.p, () => document.querySelector("#task-modal").open && /Task saved/.test(document.querySelector("#task-alarm-save-error").textContent));
      const first = await data(partial, "Partial alert retry QA"); check(first?.id && await partial.p.evaluate(id => editingTaskId === id, first.id), "Partial save lost new task identity");
      deny = false; await save(partial);
      const backend = await partial.c.request.get(partial.origin + "/api/planner"); const records = await backend.json();
      check(records.items.filter(t => t.title === first.title).length === 1 && records.items[0].id === first.id, "Partial retry duplicated task");
      const alarms = await (await partial.c.request.get(partial.origin + "/api/alarms")).json(); check(alarms.alarms.some(a => a.item_id === first.id), "Real retry did not schedule notification");
      cases.push({ test: "notification-PUT-503-partial-save-retry-keeps-new-task-ID", mode: "real current local Worker; explicit negative-response injection", status: "PASS", taskId: first.id });
    } finally { await close(partial); }

    stage = "unchanged old manual time and explicit opt-out";
    const oldManual = await setup(false);
    try {
      await draft(oldManual, "Old manual alert QA"); await save(oldManual);
      const task = await data(oldManual, "Old manual alert QA");
      const past = await oldManual.p.evaluate(async id => {
        const task = store.listItems().find(t => t.id === id), past = Model.addDays(nowKey(), -2) + "T10:00";
        task.workAlerts.alarm = { ...task.workAlerts.alarm, enabled: true, mode: "manual", at: past };
        await store.upsertItem(task); return past;
      }, task.id);
      await oldManual.p.reload(); await wait(oldManual.p, () => typeof store !== "undefined" && workAlertContextReady);
      await oldManual.p.locator('#planner-sidebar [data-view="tasks"]').click();
      await oldManual.p.locator(`#all-task-list .task-select[data-edit-task="${task.id}"]`).click();
      await oldManual.p.locator('#task-form [name="title"]').fill("Old manual alert renamed QA"); await save(oldManual);
      check((await data(oldManual, "Old manual alert renamed QA")).workAlerts.alarm.at === past, "Title-only edit overwrote old manual preference");
      await oldManual.p.locator(`#all-task-list .task-select[data-edit-task="${task.id}"]`).click();
      if (!await oldManual.p.locator("#task-alarm-options").evaluate(e => e.open)) await oldManual.p.locator("#task-alarm-options > summary").click();
      await oldManual.p.locator('[name="alarmEnabled"]').uncheck(); await oldManual.p.locator('[name="notificationEnabled"]').uncheck(); await save(oldManual);
      const saved = await data(oldManual, "Old manual alert renamed QA");
      check(!saved.workAlerts.alarm.enabled && !saved.workAlerts.notification.enabled && saved.workAlerts.alarm.at === past, "Opt-out was blocked or altered historical manual preference");
      cases.push({ test: "old-past-manual-time-allows-untouched-title-edit-and-opt-out", mode: "local browser storage; synthetic preexisting preference", status: "PASS" });
    } finally { await close(oldManual); }

    stage = "same-owner old save cannot replace reopened editor";
    const reopened = await setup();
    try {
      let release, received;
      const ready = new Promise(resolve => { received = resolve; });
      await reopened.c.route("**/api/items/*", async route => {
        if (route.request().method() !== "PUT") return route.continue();
        const response = await route.fetch(); received();
        await new Promise(resolve => { release = resolve; }); await route.fulfill({ response });
      }, { times: 1 });
      await draft(reopened, "Closed editor save QA"); await reopened.p.locator("#save-task").click(); await bound(ready);
      await reopened.p.locator("#cancel-task").click(); await wait(reopened.p, () => !document.querySelector("#task-modal").open);
      await draft(reopened, "New editor retained QA", "11:00");
      const finished = reopened.p.waitForResponse(r => r.url().includes("/api/items/") && r.request().method() === "PUT"); release(); await finished;
      await wait(reopened.p, () => !document.querySelector("#save-task").disabled);
      const editor = await reopened.p.evaluate(() => ({ open: document.querySelector("#task-modal").open, editingTaskId, title: document.querySelector('#task-form [name="title"]').value }));
      check(editor.open && editor.editingTaskId === null && editor.title === "New editor retained QA", "A closed save replaced the reopened editor");
      await save(reopened);
      check(Boolean(await data(reopened, "Closed editor save QA")) && Boolean(await data(reopened, "New editor retained QA")), "Reopened editor did not save independently");
      cases.push({ test: "same-owner-late-save-cannot-replace-new-editor", mode: "real current local Worker; held real successful response", status: "PASS" });
    } finally { await close(reopened); }

    stage = "old-owner committed save response after signout";
    const owner = await setup();
    try {
      let release, received, committed;
      const ready = new Promise(resolve => { received = resolve; });
      await owner.c.route("**/api/items/*", async route => {
        if (route.request().method() !== "PUT") return route.continue();
        const response = await route.fetch(); committed = await response.json(); received();
        await new Promise(resolve => { release = resolve; }); await route.fulfill({ response });
      }, { times: 1 });
      await draft(owner, "Old-owner reminder QA"); await owner.p.locator("#save-task").click(); await bound(ready);
      await owner.p.locator("#cancel-task").click(); await wait(owner.p, () => !document.querySelector("#task-modal").open);
      await owner.p.locator('#planner-sidebar [data-view="settings"]').click(); await owner.p.locator("#sign-out").click();
      await wait(owner.p, () => store.mode === "local" && !store.user);
      const finished = owner.p.waitForResponse(r => r.url().includes("/api/items/") && r.request().method() === "PUT"); release(); await finished;
      await owner.p.waitForLoadState("networkidle", { timeout: 15000 });
      diagnostic = await owner.p.evaluate(id => ({ mode: store.mode, hasOldTask: store.listItems().some(t => t.id === id), modal: document.querySelector("#task-modal").open, editingTaskId,
        title: document.querySelector('#task-form [name="title"]').value, toast: document.querySelector("#toast-message").textContent }), committed.item.id);
      check(!diagnostic.hasOldTask && !diagnostic.modal && !diagnostic.title, "Old owner task leaked into guest UI");
      check(diagnostic.editingTaskId === null, "Old save rebound the guest task editor to previous account ID");
      cases.push({ test: "committed-old-owner-save-cannot-rebind-or-schedule-guest", mode: "real current local Worker, held real success response", status: "PASS" });
    } finally { await close(owner); }
    return { runtime: browser.version(), cases, errors, failed, allSyntheticContextsClosed: contexts.size === 0,
      scope: "Foreground HTML reminder verified; no OS delivery claim. All positive cloud writes use real isolated Worker; 503 responses are explicit failure injections." };
  } catch (error) { return { runtime: browser.version(), stage, error: error.message, diagnostic, cases, errors, failed }; }
  finally { for (const c of contexts) await c.close(); }
}
