// Legacy-task editor hydration races against actual isolated current Worker APIs.
async (page) => {
  const browser = page.context().browser(), contexts = new Set(), cases = [], errors = [];
  const origin = "http://127.0.0.1:8796", zone = "America/Los_Angeles";
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 15000 });
  let stage = "setup", diagnostic = null;
  function epoch(wall) {
    const target = Date.parse(wall + ":00Z"); let at = target;
    for (let i = 0; i < 4; i++) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(at)).map(p => [p.type, p.value]));
      at += target - Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    }
    return at;
  }
  async function setup() {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: zone, reducedMotion: "reduce", serviceWorkers: "block" }); contexts.add(c);
    await c.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    const signup = await c.request.post(origin + "/api/auth/sign-up", { headers: { Origin: origin }, data: { email: `work-alert-hydration-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`, password: `Fixture-${Date.now()}-OnlyLocalQA` } }); check(signup.status() === 201, "Fixture signup failed");
    const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), tasks = [];
    for (const [index, normal] of [[1, "09:00"], [2, "09:30"]]) {
      const id = `71000000-0000-4000-8000-${String(Date.now() + index).slice(-12).padStart(12, "0")}`;
      const title = `Legacy hydration task ${index}`;
      const item = await c.request.put(origin + `/api/items/${id}`, { headers: { Origin: origin }, data: { title, scheduled_start: date + "T10:00", duration_minutes: 45 } }); check(item.ok(), "Legacy item fixture failed");
      const fireAt = epoch(date + "T" + normal);
      const alarm = await c.request.put(origin + `/api/alarms/${id}`, { headers: { Origin: origin }, data: { fireAt, timeZone: zone } }); check(alarm.ok(), "Legacy notification fixture failed");
      tasks.push({ id, title, normal: date + "T" + normal, fireAt });
    }
    let released = false, waiters = [], held = 0, firstHeld;
    const firstRead = new Promise(resolve => { firstHeld = resolve; });
    await c.route("**/api/alarms", async r => {
      if (r.request().method() !== "GET" || released) return r.continue();
      const response = await r.fetch();
      if (released) return r.fulfill({ response });
      held += 1; firstHeld();
      await new Promise(resolve => waiters.push(resolve)); await r.fulfill({ response });
    });
    const p = await c.newPage(); p.setDefaultTimeout(15000); p.setDefaultNavigationTimeout(60000); p.on("pageerror", e => errors.push(e.message));
    await p.goto(origin + "/?qa=legacy-hydration#tasks", { waitUntil: "domcontentloaded" }); await p.bringToFront();
    await wait(p, () => typeof store !== "undefined" && workAlertContextReady && store.mode === "cloud");
    await p.locator(`#all-task-list .task-select[data-edit-task="${tasks[0].id}"]`).waitFor();
    let timer;
    try { await Promise.race([firstRead, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Real legacy GET was not held")), 15000); })]); }
    finally { clearTimeout(timer); }
    // The real response body has been read, but has not reached the provider cache.
    await p.waitForFunction(() => typeof DuckTaskNotifications !== "undefined");
    return { c, p, date, tasks, release() { released = true; for (const resolve of waiters) resolve(); waiters = []; }, held: () => held };
  }
  async function open(f, id) {
    await f.p.locator(`#all-task-list .task-select[data-edit-task="${id}"]`).click();
    if (!await f.p.locator("#task-alarm-options").evaluate(e => e.open)) await f.p.locator("#task-alarm-options > summary").click();
  }
  async function read(f, id) {
    const data = await (await f.c.request.get(origin + "/api/planner")).json(); return data.items.find(t => t.id === id);
  }
  async function close(f) { f.release(); await f.c.close(); contexts.delete(f.c); }
  try {
    stage = "save waits for legacy hydration and preserves untouched normal channel"; const f = await setup();
    try {
      await open(f, f.tasks[0].id);
      check(!await f.p.evaluate(id => DuckTaskNotifications.get(id), f.tasks[0].id), "Fixture had already hydrated legacy notification");
      await f.p.locator('[name="alarmAt"]').fill(f.date + "T11:30"); await f.p.locator('[name="alarmAt"]').press("Tab");
      await f.p.locator("#save-task").click();
      check((await read(f, f.tasks[0].id)).work_alerts === null, "Save committed stale defaults before legacy hydration completed");
      f.release(); await wait(f.p, () => !document.querySelector("#task-modal").open);
      const saved = JSON.parse((await read(f, f.tasks[0].id)).work_alerts);
      diagnostic = saved;
      check(saved.alarm.mode === "manual" && saved.alarm.at === f.date + "T11:30", "Hydration replaced user's ringing edit");
      check(saved.notification.mode === "manual" && saved.notification.at === f.tasks[0].normal, "Untouched legacy notification time was replaced by linked defaults");
      const alarms = await (await f.c.request.get(origin + "/api/alarms")).json(); check(alarms.alarms.find(a => a.item_id === f.tasks[0].id)?.fire_at === f.tasks[0].fireAt, "Hydration changed the actual legacy notification schedule");
      cases.push({ test: "save-during-real-held-legacy-refresh-merges-untouched-channel-and-keeps-edited-channel", status: "PASS", heldReads: f.held() });
    } finally { await close(f); }

    stage = "late legacy refresh respects newer editor and its edited channel"; const newer = await setup();
    try {
      await open(newer, newer.tasks[0].id); await newer.p.locator('[name="alarmAt"]').fill(newer.date + "T11:30"); await newer.p.locator('[name="alarmAt"]').press("Tab");
      await newer.p.locator("#cancel-task").click(); await wait(newer.p, () => !document.querySelector("#task-modal").open);
      await open(newer, newer.tasks[1].id); await newer.p.locator('[name="alarmAt"]').fill(newer.date + "T12:45"); await newer.p.locator('[name="alarmAt"]').press("Tab");
      newer.release();
      await wait(newer.p, at => document.querySelector('[name="notificationAt"]').value === at, newer.tasks[1].normal);
      check(await newer.p.locator('[name="alarmAt"]').inputValue() === newer.date + "T12:45", "Old hydration replaced new editor's manual alarm");
      await newer.p.locator("#save-task").click(); await wait(newer.p, () => !document.querySelector("#task-modal").open);
      check((await read(newer, newer.tasks[0].id)).work_alerts === null, "Cancelled editor was saved by late hydration");
      const saved = JSON.parse((await read(newer, newer.tasks[1].id)).work_alerts);
      check(saved.alarm.at === newer.date + "T12:45" && saved.notification.at === newer.tasks[1].normal, "New editor lost channel-local preferences");
      cases.push({ test: "late-legacy-hydration-cannot-replace-new-editor-or-its-channel-edit", status: "PASS" });
    } finally { await close(newer); }

    stage = "switch-only edit preserves that channel's legacy manual time"; const toggle = await setup();
    try {
      await open(toggle, toggle.tasks[0].id); await toggle.p.locator('[name="notificationEnabled"]').uncheck();
      await toggle.p.locator("#save-task").click(); toggle.release(); await wait(toggle.p, () => !document.querySelector("#task-modal").open);
      const saved = JSON.parse((await read(toggle, toggle.tasks[0].id)).work_alerts);
      check(!saved.notification.enabled && saved.notification.mode === "manual" && saved.notification.at === toggle.tasks[0].normal, "Switch-only edit lost that same channel's legacy manual time");
      const alarms = await (await toggle.c.request.get(origin + "/api/alarms")).json(); check(!alarms.alarms.some(a => a.item_id === toggle.tasks[0].id), "Disabled legacy normal notification was not canceled");
      cases.push({ test: "switch-only-edit-retains-legacy-time-within-the-same-channel", status: "PASS" });
    } finally { await close(toggle); }

    stage = "late legacy refresh respects expired session and new guest editor"; const owner = await setup();
    try {
      await open(owner, owner.tasks[0].id); await owner.p.locator("#cancel-task").click(); await wait(owner.p, () => !document.querySelector("#task-modal").open);
      stage = "old GET held during expired-session refresh";
      // UI Sign out intentionally drains provider writes first. A separate client
      // can invalidate the same session while this editor's read is pending.
      await owner.c.request.post(origin + "/api/auth/sign-out", { headers: { Origin: origin } });
      await owner.p.evaluate(() => store.refresh());
      try { await wait(owner.p, () => store.mode === "local" && !store.user); }
      catch (error) { diagnostic = await owner.p.evaluate(() => ({ mode: store.mode, hasUser: Boolean(store.user), toast: document.querySelector("#toast-message").textContent, signoutDisabled: document.querySelector("#sign-out")?.disabled })); throw error; }
      stage = "new guest editor awaiting old GET release";
      await owner.p.locator('#planner-sidebar [data-view="tasks"]').click(); await owner.p.locator("#open-task-modal").click(); await owner.p.locator('#task-form [name="title"]').fill("Guest editor retained QA");
      owner.release(); await owner.p.waitForLoadState("networkidle", { timeout: 15000 });
      diagnostic = await owner.p.evaluate(() => ({ mode: store.mode, title: document.querySelector('#task-form [name="title"]').value, open: document.querySelector("#task-modal").open, editingTaskId, notificationMode: taskAlertPreferences.notification.mode, notificationAt: taskAlertPreferences.notification.at }));
      check(diagnostic.mode === "local" && diagnostic.open && diagnostic.editingTaskId === null && diagnostic.title === "Guest editor retained QA" && diagnostic.notificationMode === "alarm" && diagnostic.notificationAt === null, "Old owner hydration contaminated guest editor");
      await owner.p.locator("#save-task").click(); await wait(owner.p, () => !document.querySelector("#task-modal").open);
      const guest = await owner.p.evaluate(() => store.listItems().find(t => t.title === "Guest editor retained QA"));
      check(guest.workAlerts.alarm.enabled && guest.workAlerts.alarm.mode === "work" && guest.workAlerts.notification.enabled && guest.workAlerts.notification.mode === "alarm" && guest.workAlerts.notification.at === null, "New guest Save lost default linked preferences or imported old manual time");
      cases.push({ test: "late-legacy-hydration-cannot-contaminate-new-guest-editor-or-Save-after-session-expiry", status: "PASS" });
    } finally { await close(owner); }
    return { runtime: browser.version(), origin, cases, errors, allSyntheticContextsClosed: contexts.size === 0, scope: "Actual current Worker API with synthetic pre-metadata tasks and existing real ordinary notification records. Only response timing is controlled; no native/OS delivery claim." };
  } catch (error) { return { runtime: browser.version(), stage, error: error.message, diagnostic, cases, errors }; }
  finally { for (const c of contexts) await c.close(); }
}
