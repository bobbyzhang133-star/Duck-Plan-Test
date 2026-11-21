async (page) => {
  const browser = page.context().browser(), results = [];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  for (const kind of ["rapid", "reopen", "filter", "navigate", "reduce-during-exit", "success", "early-failure", "late-failure", "sign-out-pending"]) {
    const cloud = ["success", "early-failure", "late-failure", "sign-out-pending"].includes(kind);
    const c = await browser.newContext({ viewport: { width: 390, height: 900 } });
    try {
      const p = await c.newPage(), origin = cloud ? "http://127.0.0.1:8798" : "http://127.0.0.1:8034";
      if (cloud) {
        const auth = await c.request.post(origin + "/api/auth/sign-up", { headers: { Origin: origin }, data: { email: `void-${kind}-${Date.now()}@example.test`, password: "Synthetic exit lifecycle fixture password" } });
        assert(auth.ok(), "Local fixture account available");
      }
      await p.goto(origin + "/#tasks");
      await p.waitForFunction(cloud => typeof store !== "undefined" && (cloud ? store.mode === "cloud" && store.user : store.listItems().length), cloud);
      const ids = await p.evaluate(async cloud => {
        const date = Model.todayKey(), ids = [crypto.randomUUID(), crypto.randomUUID()];
        const tasks = ids.map((id, i) => ({ id, title: "Synthetic exit lifecycle " + (i + 1), dueDate: date, dueTime: "17:00", scheduledStart: date + "T09:00", durationMinutes: 45, priority: "High", completed: false, schemaVersion: 2 }));
        if (cloud) { for (const task of tasks) await store.upsertItem(task); }
        else localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify(tasks));
        return ids;
      }, cloud);
      if (!cloud) await p.reload();
      await p.waitForFunction(id => store.listItems().some(t => t.id === id), ids[0]);
      await p.locator('[data-filter="today"]').click();
      if (kind.includes("failure") || kind === "sign-out-pending") {
        await p.route("**/api/items/*", async route => {
          if (route.request().method() !== "PATCH") return route.continue();
          await new Promise(resolve => setTimeout(resolve, kind === "early-failure" ? 150 : 1000));
          if (kind === "sign-out-pending") return route.continue();
          return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Synthetic delayed completion failure" }) });
        });
      }
      const source = p.locator('#view-tasks input[data-task-id="' + ids[0] + '"]:visible');
      await source.focus(); await source.press("Space");
      await p.waitForTimeout(kind === "rapid" ? 120 : 80);
      let mid = null;
      if (kind === "rapid") {
        await p.locator('#view-tasks input[data-task-id="' + ids[1] + '"]:visible').click();
        await p.waitForTimeout(340);
        mid = await p.evaluate(() => ({ held: document.querySelectorAll(".completion-exit-source").length,
          invisible: [...document.querySelectorAll(".completion-exit-source")].every(e => getComputedStyle(e).opacity === "0"), echoes: document.querySelectorAll(".task-completion-echo").length }));
        assert(mid.held === 2 && mid.invisible, "Earlier completed task must not reappear while a second exit is active");
      }
      if (kind === "reopen") await source.press("Space");
      if (kind === "filter") await p.locator('[data-filter="all"]').click();
      if (kind === "navigate") await p.locator('.nav-item[data-view="calendar"]:visible').first().click();
      if (kind === "reduce-during-exit") await p.emulateMedia({ reducedMotion: "reduce" });
      if (kind === "sign-out-pending") await p.evaluate(() => store.signOut());
      await p.waitForTimeout(1700);
      const after = await p.evaluate(ids => ({
        first: store.listItems().find(t => t.id === ids[0])?.completed,
        second: store.listItems().find(t => t.id === ids[1])?.completed,
        echoes: document.querySelectorAll(".task-completion-echo,.task-completion-gesture").length,
        held: document.querySelectorAll(".completion-exit-source").length,
        particles: document.querySelectorAll(".completion-particle").length,
        toast: document.querySelector("#toast-message").textContent,
        note: !document.querySelector("#completion-note").hidden,
        signedIn: Boolean(store.user)
      }), ids);
      assert(!after.echoes && !after.held, "Exit must release every held row and overlay");
      if (kind === "reopen" || kind.includes("failure")) assert(after.first === false, "Reopen or failed save must restore the incomplete task");
      else if (kind === "sign-out-pending") assert(after.first === undefined && !after.signedIn, "Old account task must not leak back after a delayed response");
      else assert(after.first === true, "Completion must remain saved");
      if (kind === "rapid") assert(after.second === true, "Rapid completion saves both tasks");
      if (kind.includes("failure")) assert(after.toast.includes("Synthetic delayed completion failure") && !after.particles && !after.note, "Failed save must show an error without a success celebration");
      if (cloud && kind !== "sign-out-pending") {
        await p.reload();
        await p.waitForFunction(id => store.mode === "cloud" && store.listItems().some(t => t.id === id), ids[0]);
        const actual = await p.evaluate(id => store.listItems().find(t => t.id === id).completed, ids[0]);
        assert(actual === (kind === "success"), "Actual fixture backend must retain the confirmed state after reload");
      }
      results.push({ kind, mode: cloud ? "signed-in loopback Worker/D1 fixture" : "local", mid, after });
    } catch (error) { return { runtime: browser.version(), results, failedCase: kind, error: error.message }; }
    finally { await c.close(); }
  }
  return { runtime: browser.version(), results, note: "503 failures and delays are injected at the transport boundary; account/task storage and reload use the actual loopback Worker/D1 fixture." };
}
