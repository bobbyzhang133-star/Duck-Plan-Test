async page => {
  const browser = page.context().browser(), results = [];
  for (const config of [
    { view: "calendar", width: 1156 }, { view: "calendar", width: 390 },
    { view: "tasks", width: 390 }, { view: "home", width: 1156 },
    { view: "tasks", width: 390, last: true },
    { view: "tasks", width: 390, reduced: true },
    { view: "tasks", width: 390, slowSave: true }
  ]) {
    const c = await browser.newContext({ viewport: { width: config.width, height: 900 }, serviceWorkers: "block", reducedMotion: config.reduced ? "reduce" : "no-preference" });
    try {
      const p = await c.newPage(), errors = [], origin = config.slowSave ? "http://127.0.0.1:8798" : "http://127.0.0.1:8042";
      p.on("pageerror", error => errors.push(error.message));
      if (config.slowSave) {
        const auth = await c.request.post(origin + "/api/auth/sign-up", { headers: { Origin: origin }, data: { email: `particle-${Date.now()}@example.test`, password: "Synthetic particle lifecycle fixture" } });
        if (!auth.ok()) throw Error("Fixture account failed");
        await p.route(origin + "/**", async route => {
          const url = new URL(route.request().url());
          if (url.pathname.startsWith("/api/") || url.pathname === "/cloud-config.js") return route.continue();
          return route.fulfill({ response: await c.request.get("http://127.0.0.1:8042" + url.pathname + url.search) });
        });
      }
      await p.goto(origin + "/#" + config.view);
      await p.waitForFunction(cloud => typeof store !== "undefined" && (cloud ? store.mode === "cloud" : store.listItems().length), Boolean(config.slowSave));
      await p.evaluate(async config => {
        const date = Model.todayKey();
        const fixtures = ["12111111-1111-4111-8111-111111111111", "12111111-1111-4111-8111-222222222222"].slice(0, config.last ? 1 : 2).map((id, i) => ({ id, title: "Particle timing " + (i + 1), dueDate: date, dueTime: "17:00", scheduledStart: date + "T09:00", durationMinutes: 45, priority: "High", completed: false, schemaVersion: 2 }));
        if (config.slowSave) for (const task of fixtures) await store.upsertItem(task);
        else localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify(fixtures));
      }, config);
      if (!config.slowSave) await p.reload();
      if (config.view === "tasks") await p.locator('[data-filter="today"]').click();
      if (config.view === "calendar" && config.width === 390) await p.locator("#phone-task-summary").click();
      if (config.slowSave) await p.route("**/api/items/*", async route => {
        if (route.request().method() === "PATCH") await new Promise(resolve => setTimeout(resolve, 700));
        return route.continue();
      });
      const area = config.view === "calendar" ? "#daily-task-panel" : config.view === "home" ? "#view-home" : "#view-tasks";
      await p.evaluate(() => {
        window.particleObservations = [];
        document.addEventListener("change", event => {
          if (!event.target.matches('input[data-task-id="12111111-1111-4111-8111-111111111111"]')) return;
          window.particleObservations.push({ particles: document.querySelectorAll(".completion-particle").length, batches: document.querySelector("#completion-effects").children.length, echo: Boolean(document.querySelector(".task-completion-echo")) });
        });
      });
      await p.locator(area + ' input[data-task-id="12111111-1111-4111-8111-111111111111"]:visible').click();
      const immediate = await p.evaluate(() => window.particleObservations[0]);
      const expected = config.reduced ? 0 : config.last ? 22 : 10;
      if (immediate.particles !== expected || (!config.reduced && immediate.batches !== 1)) throw Error("Particles must exist within the checkbox change event");
      if (!config.reduced && !immediate.echo) throw Error("Particles and original pop-out must start together");
      await p.waitForTimeout(550);
      const mid = await p.evaluate(() => ({ echoes: document.querySelectorAll(".task-completion-echo").length, batches: document.querySelector("#completion-effects").children.length }));
      if (mid.echoes || (!config.reduced && mid.batches !== 1)) throw Error("No duplicate burst after the pop-out");
      await p.waitForTimeout(700);
      const after = await p.evaluate(() => ({ particles: document.querySelectorAll(".completion-particle").length, completed: store.listItems().find(t => t.id === "12111111-1111-4111-8111-111111111111").completed }));
      if (after.particles || !after.completed || errors.length) throw Error("Cleanup, persistence or runtime failed");
      results.push({ config, immediate, mid, after });
    } catch (error) { return { runtime: browser.version(), results, failedConfig: config, error: error.message }; }
    finally { await c.close(); }
  }
  return { runtime: browser.version(), results };
}
