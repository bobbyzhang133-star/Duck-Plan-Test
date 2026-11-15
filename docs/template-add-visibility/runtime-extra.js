// Dedicated signed-in local QA accounts. Success uses the real Worker; failures are explicit injected cases.
async (page) => {
  const browser = page.context().browser(), contexts = new Set(), cases = [], errors = [], failed = [];
  const origin = "http://127.0.0.1:8796";
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 7000 });
  async function bounded(promise) { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Held request did not reach the real Worker")), 7000); })]); } finally { clearTimeout(timer); } }
  let stage = "setup";
  async function setup() {
    const context = await browser.newContext({ viewport: { width: 835, height: 900 }, timezoneId: "America/Los_Angeles", serviceWorkers: "block", reducedMotion: "reduce" }); contexts.add(context);
    await context.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    const response = await context.request.post(origin + "/api/auth/sign-up", { headers: { Origin: origin }, data: { email: `template-visibility-guard-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`, password: `Fixture-${Date.now()}-LocalQA` } });
    check(response.status() === 201, "Local signup failed");
    const p = await context.newPage(); p.setDefaultTimeout(7000);
    p.on("pageerror", e => errors.push(e.message)); p.on("requestfailed", r => failed.push({ path: new URL(r.url()).pathname, error: r.failure()?.errorText }));
    await p.goto(origin + "/?qa=template-add-guards#calendar"); await p.bringToFront();
    await wait(p, () => typeof store !== "undefined" && store.mode === "cloud" && store.user && store.supportsOrganization);
    const fixture = await p.evaluate(async () => {
      const template = await store.upsertTemplate({ id: crypto.randomUUID(), title: "Pending Add visibility QA", classId: null, durationMinutes: 45, priority: "Medium", notes: "Guard source", reminderChoice: "off" });
      selectedDate = "2026-11-14"; calendarUserScrolled = true; setView("calendar", true); renderAll({ autoScrollCalendar: false });
      return { template, ids: store.listItems().map(t => t.id) };
    });
    await p.locator("#calendar-templates-tab").click();
    return { context, p, ...fixture };
  }
  async function close(f) { await f.context.close(); contexts.delete(f.context); }
  const add = f => f.p.getByRole("button", { name: "Add Pending Add visibility QA to tasks", exact: true });
  async function assertShown(f) {
    await wait(f.p, () => document.querySelector("#calendar-tasks-tab").getAttribute("aria-selected") === "true" && /Added/.test(document.querySelector("#toast-message").textContent));
    const copies = await f.p.evaluate(ids => store.listItems().filter(t => !ids.includes(t.id)), f.ids);
    check(copies.length === 1 && !copies[0].dueDate && !copies[0].scheduledStart, "Wrong copy count/fields after success");
    const row = f.p.locator(`#backlog-task-list .task-select[data-edit-task="${copies[0].id}"]`); check(await row.isVisible(), "Saved copy not visible in Unscheduled");
    return copies[0];
  }
  async function holdRealSave(f) {
    let begin, release, finished, puts = 0;
    const begun = new Promise(resolve => { begin = resolve; }), gate = new Promise(resolve => { release = resolve; }), done = new Promise(resolve => { finished = resolve; });
    const handler = async route => {
      if (route.request().method() !== "PUT") { await route.continue(); return; }
      puts += 1; const response = await route.fetch(); check(response.ok(), "Real delayed save failed"); begin();
      await gate; await route.fulfill({ response }); finished();
    };
    await f.p.route("**/api/items/*", handler);
    return { begun, release, done, handler, puts: () => puts };
  }
  try {
    stage = "real pending save duplicate guard";
    const pending = await setup(); try {
      const hold = await holdRealSave(pending);
      await add(pending).click(); await bounded(hold.begun);
      check(await add(pending).getAttribute("aria-disabled") === "true" && await add(pending).getAttribute("aria-busy") === "true", "Pending button state missing");
      check(await pending.p.locator("#calendar-templates-tab").getAttribute("aria-selected") === "true", "Revealed before durable success");
      const box = await add(pending).boundingBox(); await pending.p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await pending.p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      check(hold.puts() === 1, "Repeated pending activation wrote another task");
      hold.release(); await bounded(hold.done); const copy = await assertShown(pending);
      await pending.p.unroute("**/api/items/*", hold.handler);
      await pending.p.reload(); await wait(pending.p, id => typeof store !== "undefined" && store.listItems().some(t => t.id === id), copy.id);
      check(await pending.p.evaluate(({ ids, template }) => store.listItems().filter(t => !ids.includes(t.id)).length === 1 && store.listTemplates().some(t => t.id === template), { ids: pending.ids, template: pending.template.id }), "Pending save/reload duplicated copy or lost template");
      cases.push({ test: "real-delayed-save-reveals-after-success-and-blocks-repeat-clicks", status: "PASS", requests: hold.puts(), taskId: copy.id });
    } finally { await close(pending); }

    stage = "failed save does not reveal; retry works";
    const failure = await setup(); try {
      let rejected = 0;
      const reject = async route => { if (route.request().method() !== "PUT") return route.continue(); rejected += 1; await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Visibility QA save rejected" }) }); };
      await failure.p.route("**/api/items/*", reject); await add(failure).click();
      await wait(failure.p, () => document.querySelector("#toast-message").textContent.includes("Visibility QA save rejected"));
      check(await failure.p.locator("#calendar-templates-tab").getAttribute("aria-selected") === "true", "Failed save switched away from Templates");
      check(await failure.p.evaluate(ids => store.listItems().length === ids.length, failure.ids), "Failed optimistic copy was not rolled back");
      check(await add(failure).getAttribute("aria-disabled") !== "true", "Failed save left Add disabled");
      await failure.p.unroute("**/api/items/*", reject); await add(failure).click(); const copy = await assertShown(failure);
      cases.push({ test: "injected-503-rolls-back-without-reveal-and-real-retry-succeeds", status: "PASS", expectedInjectedFailures: rejected, taskId: copy.id });
    } finally { await close(failure); }

    stage = "old owner save cannot reveal into signed-out planner";
    const owner = await setup(); try {
      const hold = await holdRealSave(owner); await add(owner).click(); await bounded(hold.begun);
      const old = await owner.p.evaluate(ids => store.listItems().find(t => !ids.includes(t.id))?.id, owner.ids); check(old, "Old owner optimistic copy missing");
      await owner.p.evaluate(() => store.signOut()); await wait(owner.p, () => store.mode === "local" && !store.user);
      hold.release(); await bounded(hold.done);
      await owner.p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      check(await owner.p.evaluate(id => store.mode === "local" && !store.user && !store.listItems().some(t => t.id === id) && selectedTaskId !== id && !document.querySelector("#toast-message").textContent.includes("Added a new task"), old), "Old owner success leaked into next planner");
      check(await owner.p.locator(`[data-edit-task="${old}"]`).count() === 0, "Old owner row became visible after sign-out");
      cases.push({ test: "old-owner-delayed-success-does-not-select-reveal-or-toast-in-next-planner", status: "PASS" });
    } finally { await close(owner); }
    return { runtime: browser.version(), mode: "real signed-in local Worker / dedicated fixtures", cases, errors, failed, allSyntheticContextsClosed: contexts.size === 0, scope: "Successful requests use real API. One503 response is deliberately injected to test rollback/feedback. No production data or user browser used." };
  } catch (error) { return { runtime: browser.version(), stage, error: error.message, cases, errors, failed }; }
  finally { for (const context of contexts) await context.close(); }
}
