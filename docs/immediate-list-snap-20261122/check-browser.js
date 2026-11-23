async page => {
  const browser = page.context().browser(), results = [];
  for (const config of [
    { width: 1156, view: "calendar" }, { width: 390, view: "tasks" },
    { width: 390, view: "calendar" }, { width: 835, view: "home" },
    { width: 1156, view: "calendar", rapid: true },
    { width: 390, view: "tasks", cloud: true },
    { width: 390, view: "tasks", cloud: true, fail: true }
  ]) {
    const c = await browser.newContext({ viewport: { width: config.width, height: 1000 }, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = [], origin = config.cloud ? "http://127.0.0.1:8798" : "http://127.0.0.1:8042";
      p.on("pageerror", e => errors.push(e.message));
      if (config.cloud) {
        const signup = await c.request.post(origin + "/api/auth/sign-up", { timeout: 10000, headers: { Origin: origin }, data: { email: `immediate-snap-${Date.now()}@example.test`, password: "Synthetic immediate snap fixture" } });
        if (!signup.ok()) throw Error("Local fixture sign-up failed");
        await p.route(origin + "/**", async route => { const u = new URL(route.request().url()); if (u.pathname.startsWith("/api/") || u.pathname === "/cloud-config.js") return route.continue(); return route.fulfill({ response: await c.request.get("http://127.0.0.1:8042" + u.pathname + u.search) }); });
      }
      await p.goto(origin + "/" + (config.cloud ? "" : "?demo=completion-20261122-6") + "#" + config.view);
      await p.waitForFunction(cloud => typeof store !== "undefined" && (cloud ? store.mode === "cloud" : store.listItems().length === 8), Boolean(config.cloud));
      let ids = ["completion-20261122-6-1", "completion-20261122-6-2"];
      if (config.cloud) {
        ids = await p.evaluate(async () => { const date = Model.todayKey(), ids = [crypto.randomUUID(), crypto.randomUUID()]; for (const [i, id] of ids.entries()) await store.upsertItem({ id, title: "Immediate snap fixture " + i, dueDate: date, dueTime: "23:59", scheduledStart: date + "T" + (i ? "10" : "09") + ":00", durationMinutes: 45, completed: false, schemaVersion: 2 }); return ids; });
        await p.route("**/api/items/*", async route => {
          if (route.request().method() !== "PATCH") return route.continue();
          await new Promise(resolve => setTimeout(resolve, config.fail ? 150 : 650));
          return config.fail ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Synthetic save failure" }) }) : route.continue();
        });
      }
      await p.waitForTimeout(500);
      const area = config.view === "calendar" ? "#daily-task-panel" : config.view === "tasks" ? "#view-tasks" : "#view-home";
      const input = p.locator(area + ' input[data-task-id="' + ids[0] + '"]:visible');
      await input.scrollIntoViewIfNeeded();
      await p.evaluate(({ area, ids, rapid }) => {
        const root = document.querySelector(area), source = root.querySelector('input[data-task-id="' + ids[0] + '"]').closest(".daily-task-card,.all-task-row");
        const next = () => root.querySelector('input[data-task-id="' + ids[1] + '"]')?.closest(".daily-task-card,.all-task-row");
        const y = () => { const e = next(); return e ? e.getBoundingClientRect().top - root.getBoundingClientRect().top : null; };
        window.immediateBefore = y(); window.immediateFrames = [];
        document.addEventListener("change", () => {
          const start = performance.now();
          if (rapid) setTimeout(() => root.querySelector('input[data-task-id="' + ids[1] + '"]').click(), 75);
          const frame = () => {
            immediateFrames.push({ time: performance.now() - start, y: y(), sourcePresent: source.isConnected, echoes: document.querySelectorAll(".task-completion-echo").length, duck: Boolean(document.querySelector(".completion-duck-reaction")), animations: next()?.getAnimations().filter(a => a.effect.getKeyframes().some(k => "transform" in k || "height" in k)).length || 0 });
            if (performance.now() - start < 2300) requestAnimationFrame(frame);
          }; requestAnimationFrame(frame);
        }, { once: true });
      }, { area, ids, rapid: config.rapid });
      await input.focus(); await input.press("Space");
      await p.waitForTimeout(350);
      const focusBeforeAck = await p.evaluate(() => document.activeElement?.dataset.taskId);
      await p.waitForTimeout(2450);
      const state = await p.evaluate(({ area, ids }) => ({ before: immediateBefore, frames: immediateFrames, completed: store.listItems().find(t => t.id === ids[0]).completed, second: store.listItems().find(t => t.id === ids[1]).completed, visible: [...document.querySelectorAll(area + ' input[data-task-id="' + ids[0] + '"]')].some(e => e.checkVisibility()), artifacts: document.querySelectorAll(".task-completion-echo,.completion-exit-source,.completion-duck-reaction").length, focused: document.activeElement?.dataset.taskId }), { area, ids });
      if (errors.length || state.artifacts) throw Error("Cleanup/page error " + JSON.stringify({ config, errors, state }));
      const first = state.frames.find(f => f.echoes);
      if (!first || first.sourcePresent || Math.abs(first.y - state.before) < 10) throw Error("List did not snap while echo was still animating " + JSON.stringify({ config, state }));
      if (config.fail) {
        if (state.completed || !state.visible || state.frames.some(f => f.duck)) throw Error("Save failure must restore task without duck success");
      } else {
        if (!state.completed || state.visible || !state.frames.some(f => f.duck)) throw Error("Completion/duck failed");
        if (!config.rapid && state.frames.some(f => Math.abs(f.y - first.y) > 1 || f.animations)) throw Error("Remaining list must stay snapped without a slide");
        if (config.rapid && !state.second) throw Error("Rapid completion lost");
        if (config.cloud && (!focusBeforeAck || focusBeforeAck !== state.focused)) throw Error("Delayed save lost keyboard focus");
        await p.reload(); await p.waitForFunction(id => typeof store !== "undefined" && store.listItems().some(t => t.id === id && t.completed), ids[0]);
      }
      results.push({ config, status: "PASS", ...state, frames: state.frames.filter((f, i) => i < 3 || i % 8 === 0) });
    } finally { await c.close(); }
  }
  return { runtime: browser.version(), results };
}
