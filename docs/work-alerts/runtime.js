// Isolated website fixtures and real current/legacy local Workers. Never use user planner data.
async (page) => {
  const browser = page.context().browser(), contexts = new Set(), cases = [], errors = [], failed = [];
  const out = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/work-alerts/";
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 15000 });
  let stage = "setup", diagnostic = null;
  async function setup(origin, width = 1280, touch = false, zone = "America/Los_Angeles") {
    const c = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: touch, isMobile: touch && width < 700, timezoneId: zone, reducedMotion: "reduce", serviceWorkers: "block" }); contexts.add(c);
    await c.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    if (origin.endsWith("8796") || origin.endsWith("8797")) {
      const r = await c.request.post(origin + "/api/auth/sign-up", { headers: { Origin: origin }, data: { email: `work-alerts-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`, password: `Fixture-${Date.now()}-OnlyLocalQA` } });
      check(r.status() === 201, "Fixture signup failed " + r.status());
    }
    const p = await c.newPage(); p.setDefaultTimeout(15000); p.setDefaultNavigationTimeout(60000);
    p.on("pageerror", e => errors.push({ origin, width, message: e.message }));
    p.on("requestfailed", r => failed.push({ origin, width, path: new URL(r.url()).pathname, error: r.failure()?.errorText }));
    await p.goto(origin + "/?qa=work-alerts#calendar", { waitUntil: "domcontentloaded" }); await p.bringToFront();
    await wait(p, cloud => typeof store !== "undefined" && typeof workAlerts !== "undefined" && workAlertContextReady && (cloud ? store.mode === "cloud" && store.user : store.mode === "local"), !origin.endsWith("8034"));
    const date = await p.evaluate(() => { selectedDate = Model.addDays(nowKey(), 2); calendarView = "day"; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); return selectedDate; });
    return { c, p, origin, width, touch, zone, date, mode: origin.endsWith("8034") ? "local browser storage" : origin.endsWith("8797") ? "real legacy local Worker / device-only preferences" : "real current local Worker" };
  }
  async function close(f) { await f.c.close(); contexts.delete(f.c); }
  const act = (f, locator) => f.touch ? locator.tap() : locator.click();
  async function panel(f) {
    if (f.width < 700 && !await f.p.evaluate(() => document.body.classList.contains("task-panel-open"))) await act(f, f.p.locator("#phone-task-summary"));
    await act(f, f.p.locator("#calendar-tasks-tab"));
  }
  async function section(f, selector) {
    if (!await f.p.locator(selector).evaluate(e => e.open)) await act(f, f.p.locator(selector + " > summary"));
  }
  async function fields(f) {
    return f.p.locator("#task-form").evaluate(e => ({ alarmEnabled: e.elements.alarmEnabled.checked, notificationEnabled: e.elements.notificationEnabled.checked,
      alarmAt: e.elements.alarmAt.value, notificationAt: e.elements.notificationAt.value, start: e.elements.scheduledTime.value,
      alarmStatus: document.querySelector("#alarm-link-status").textContent, notificationStatus: document.querySelector("#notification-link-status").textContent,
      storageWarning: !document.querySelector("#task-alert-storage-help").hidden }));
  }
  async function save(f) {
    await act(f, f.p.locator("#save-task"));
    try { await wait(f.p, () => !document.querySelector("#task-modal").open); }
    catch (error) { diagnostic = await f.p.evaluate(() => ({ taskError: document.querySelector("#task-form-error")?.textContent, alertError: document.querySelector("#task-alarm-save-error")?.textContent, provider: { canSave: DuckTaskNotifications.canSave(), available: DuckTaskNotifications.available }, status: document.querySelector("#task-notification-status")?.textContent })); throw error; }
  }
  async function openTask(f, id) {
    await panel(f);
    await act(f, f.p.locator(`#daily-task-panel .task-select[data-edit-task="${id}"]`));
    await f.p.locator("#task-modal").waitFor({ state: "visible" }); await section(f, "#task-alarm-options");
  }
  const snapshot = (f, id) => f.p.evaluate(id => structuredClone(store.listItems().find(t => t.id === id)), id);
  async function notificationRecord(f, id, expected) {
    if (f.origin.endsWith("8034")) return null;
    try { await wait(f.p, ({ id, expected }) => expected === null ? !DuckTaskNotifications.get(id) : DuckTaskNotifications.get(id)?.fire_at === expected, { id, expected }); }
    catch (error) { diagnostic = await f.p.evaluate(({ id, expected }) => ({ id, expected, providerRecord: DuckTaskNotifications.get(id), canSave: DuckTaskNotifications.canSave(), available: DuckTaskNotifications.available, task: store.listItems().find(t => t.id === id), status: document.querySelector("#task-notification-status")?.textContent, toast: document.querySelector("#toast-message")?.textContent }), { id, expected }); throw error; }
    const r = await f.c.request.get(f.origin + "/api/alarms"); check(r.ok(), "Alarm API read failed");
    const data = await r.json(), record = data.alarms.find(a => a.item_id === id);
    if (expected === null) check(!record, "Disabled notification still has server schedule");
    else check(record?.fire_at === expected, "Server notification time does not match linked preference");
    return record ? { item_id: record.item_id, fire_at: record.fire_at } : null;
  }
  async function resolved(f, id) { return f.p.evaluate(id => DuckWorkAlerts.deliveries(store.listItems().find(t => t.id === id)), id); }
  async function create(f) {
    await panel(f); await act(f, f.p.locator("#plan-selected-date")); await f.p.locator("#task-modal").waitFor({ state: "visible" });
    const title = `Alert QA ${f.width} ${f.zone}`;
    await f.p.locator('#task-form [name="title"]').fill(title); await section(f, "#task-schedule-options");
    await f.p.locator('[name="scheduledDate"]').fill(f.date); await f.p.locator('[name="scheduledTime"]').fill("10:15"); await f.p.locator('[name="scheduledTime"]').press("Tab");
    await section(f, "#task-alarm-options"); const defaults = await fields(f);
    check(defaults.alarmEnabled && defaults.notificationEnabled && defaults.alarmAt === f.date + "T10:15" && defaults.notificationAt === defaults.alarmAt, "New scheduled task does not default both channels to work start " + JSON.stringify(defaults));
    check(defaults.alarmStatus === "Follows work start" && defaults.notificationStatus === "Follows alarm time", "Default link modes unclear");
    check((await f.p.locator("#task-alarm-help").textContent()).includes("iPhone app"), "Web UI promises a ringing browser alarm");
    check(await f.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Task form horizontal overflow");
    await f.p.screenshot({ path: out + (f.origin.endsWith("8034") ? "local" : f.origin.endsWith("8797") ? "legacy" : "signed") + "-" + f.width + "-defaults.png" });
    await save(f); const task = await f.p.evaluate(title => store.listItems().find(t => t.title === title), title);
    if (!(task && task.workAlerts?.alarm.mode === "work" && task.workAlerts.notification.mode === "alarm")) {
      diagnostic = await f.p.evaluate(title => ({ task: store.listItems().find(t => t.title === title), supports: store.supportsWorkAlerts, mode: store.mode, toast: document.querySelector("#toast-message").textContent, extraKeys: Object.keys(localStorage).filter(k => k.includes("extra")), extras: Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.includes("extra"))) }), title);
      throw new Error("Saved default preferences missing");
    }
    const delivery = await resolved(f, task.id), record = await notificationRecord(f, task.id, delivery.notification.fireAt);
    cases.push({ test: "scheduled-work-defaults-two-enabled-linked-channels", mode: f.mode, width: f.width, zone: f.zone, status: "PASS", defaults, record });
    return task;
  }
  async function editChain(f, task) {
    await openTask(f, task.id);
    await f.p.locator('[name="alarmAt"]').fill(f.date + "T11:30"); await f.p.locator('[name="alarmAt"]').press("Tab");
    let state = await fields(f); check(state.alarmStatus === "Custom time" && state.notificationAt === state.alarmAt, "Notification did not follow manual alarm");
    await f.p.locator('[name="scheduledTime"]').fill("12:00"); await f.p.locator('[name="scheduledTime"]').press("Tab");
    state = await fields(f); check(state.alarmAt === f.date + "T11:30" && state.notificationAt === state.alarmAt, "Work edit overrode custom alarm");
    await f.p.locator('[name="notificationAt"]').fill(f.date + "T13:45"); await f.p.locator('[name="notificationAt"]').press("Tab");
    await f.p.locator('[name="alarmAt"]').fill(f.date + "T14:00"); await f.p.locator('[name="alarmAt"]').press("Tab");
    state = await fields(f); check(state.notificationAt === f.date + "T13:45" && state.notificationStatus === "Custom time", "Alarm edit overrode manual normal notification");
    await save(f); await f.p.reload(); await wait(f.p, id => typeof store !== "undefined" && workAlertContextReady && store.listItems().some(t => t.id === id), task.id);
    await f.p.evaluate(date => { selectedDate = date; calendarView = "day"; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); }, f.date);
    await openTask(f, task.id); state = await fields(f);
    check(state.alarmAt === f.date + "T14:00" && state.notificationAt === f.date + "T13:45" && state.start === "12:00", "Custom times did not survive reload");
    if (f.origin.endsWith("8797")) check(state.storageWarning && await f.p.evaluate(() => !store.supportsWorkAlerts), "Legacy device-only storage is not disclosed");
    await act(f, f.p.locator('[data-follow-alert="alarm"]')); await act(f, f.p.locator('[data-follow-alert="notification"]'));
    state = await fields(f); check(state.alarmAt === f.date + "T12:00" && state.notificationAt === state.alarmAt, "Follow buttons did not restore chain");
    await f.p.locator('[name="alarmEnabled"]').uncheck(); await save(f);
    let stored = await snapshot(f, task.id); check(!stored.workAlerts.alarm.enabled && stored.workAlerts.notification.enabled, "Alarm off switch disabled normal notification");
    let deliveries = await resolved(f, task.id); await notificationRecord(f, task.id, deliveries.notification.fireAt);
    await openTask(f, task.id); await f.p.locator('[name="notificationEnabled"]').uncheck(); await f.p.locator('[name="alarmEnabled"]').check(); await save(f);
    stored = await snapshot(f, task.id); check(stored.workAlerts.alarm.enabled && !stored.workAlerts.notification.enabled, "Normal off switch disabled alarm intent");
    await notificationRecord(f, task.id, null);
    await openTask(f, task.id); await f.p.locator('[name="notificationEnabled"]').check(); await save(f);
    cases.push({ test: "manual-overrides-follow-restoration-independent-switches-reload", mode: f.mode, width: f.width, zone: f.zone, status: "PASS", taskId: task.id });
  }
  async function invalidTimes(f, task) {
    await openTask(f, task.id); const before = await snapshot(f, task.id);
    const yesterday = await f.p.evaluate(() => Model.addDays(nowKey(), -1));
    for (const [at, pattern] of [[yesterday + "T10:00", /future|past/i], ["2027-03-14T02:30", /does not exist|time zone|daylight/i]]) {
      await f.p.locator('[name="alarmAt"]').fill(at); await f.p.locator('[name="alarmAt"]').press("Tab"); await act(f, f.p.locator("#save-task"));
      await wait(f.p, () => document.querySelector("#task-modal").open && Boolean(document.querySelector("#task-alarm-save-error").textContent));
      const error = await f.p.locator("#task-alarm-save-error").textContent(); diagnostic = { at, error };
      check(pattern.test(error), "Manual invalid-time feedback missing " + error);
      check(JSON.stringify(await snapshot(f, task.id)) === JSON.stringify(before), "Invalid manual time changed saved task");
    }
    await act(f, f.p.locator("#cancel-task")); await wait(f.p, () => !document.querySelector("#task-modal").open);
    cases.push({ test: "manual-past-and-DST-gap-rejected-without-task-mutation", mode: f.mode, status: "PASS" });
  }
  async function keyboardAndUndo(f, task) {
    if (f.width < 700) return;
    await f.p.evaluate(date => { selectedDate = date; calendarView = "day"; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); }, f.date);
    const source = f.p.locator(`[data-calendar-drag-task="${task.id}"]`); await source.press("Alt+ArrowDown");
    await wait(f.p, id => store.listItems().find(t => t.id === id)?.scheduledStart.endsWith("T12:15"), task.id);
    await wait(f.p, () => /moved|scheduled/i.test(document.querySelector("#toast-message").textContent));
    let delivery = await resolved(f, task.id); await notificationRecord(f, task.id, delivery.notification.fireAt);
    await act(f, f.p.locator("#toast-action")); await wait(f.p, id => store.listItems().find(t => t.id === id)?.scheduledStart.endsWith("T12:00"), task.id);
    await wait(f.p, () => /undone|previous time/i.test(document.querySelector("#toast-message").textContent));
    delivery = await resolved(f, task.id); await notificationRecord(f, task.id, delivery.notification.fireAt);
    cases.push({ test: "keyboard-reschedule-and-Undo-reconcile-linked-notification", mode: f.mode, width: f.width, status: "PASS" });
  }
  async function clearAndRelink(f, task) {
    await openTask(f, task.id); await f.p.locator('[name="alarmAt"]').fill(""); await f.p.locator('[name="alarmAt"]').press("Tab");
    const cleared = await fields(f);
    check(!cleared.alarmEnabled && cleared.notificationEnabled && cleared.alarmAt === "" && cleared.notificationAt === "", "Clearing alarm invented an independent normal notification time");
    await save(f); const stored = await snapshot(f, task.id);
    check(!stored.workAlerts.alarm.enabled && stored.workAlerts.alarm.at === null && stored.workAlerts.notification.enabled && stored.workAlerts.notification.mode === "alarm", "Cleared alarm preferences did not save");
    await notificationRecord(f, task.id, null);
    await openTask(f, task.id); await act(f, f.p.locator('[data-follow-alert="alarm"]'));
    check((await fields(f)).notificationAt === f.date + "T12:00", "Use work start did not restore normal notification link");
    await f.p.locator('[name="alarmEnabled"]').check();
    await save(f); const delivery = await resolved(f, task.id); await notificationRecord(f, task.id, delivery.notification.fireAt);
    cases.push({ test: "clear-alarm-cancels-job-without-inventing-time-and-relink-restores-chain", mode: f.mode, width: f.width, status: "PASS" });
  }
  try {
    for (const [origin, width, touch, zone] of [
      ["http://127.0.0.1:8034", 1280, false, "America/Los_Angeles"],
      ["http://127.0.0.1:8796", 1280, false, "America/Los_Angeles"],
      ["http://127.0.0.1:8797", 835, false, "America/Los_Angeles"],
      ["http://127.0.0.1:8034", 390, true, "America/Los_Angeles"],
      ["http://127.0.0.1:8796", 768, true, "UTC"],
    ]) {
      stage = `${origin} ${width} setup`; const f = await setup(origin, width, touch, zone);
      try {
        stage = `${f.mode} ${width} defaults`; const task = await create(f);
        stage = `${f.mode} ${width} link chain`; await editChain(f, task);
        stage = `${f.mode} ${width} clear and relink`; await clearAndRelink(f, task);
        if (width === 1280) { stage = `${f.mode} validation`; await invalidTimes(f, task); }
        stage = `${f.mode} keyboard`; await keyboardAndUndo(f, task);
      } finally { await close(f); }
    }
    return { runtime: browser.version(), cases, errors, failed, allSyntheticContextsClosed: contexts.size === 0,
      scope: "Real local store/current+legacy local Workers. Notification API acceptance is not OS delivery; ringing is unavailable on web. Touch emulation is not native or physical Safari acceptance." };
  } catch (error) { return { runtime: browser.version(), stage, error: error.message, diagnostic, cases, errors, failed }; }
  finally { for (const c of contexts) await c.close(); }
}
