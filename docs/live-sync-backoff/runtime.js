async page => {
  const browser = page.context().browser(), results = [];
  const check = (value, message) => { if (!value) throw Error(message); };
  const until = async (predicate, message) => {
    for (let n = 0; n < 150; n++) {
      try { if (await predicate()) return; } catch (error) { if (!/Execution context was destroyed/.test(error.message)) throw error; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw Error(message);
  };
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }, { width: 835, height: 1100 }]) {
    for (const signedIn of [false, true]) {
      const c = await browser.newContext({ viewport, hasTouch: viewport.width < 1000,
        isMobile: viewport.width < 600, serviceWorkers: "block", reducedMotion: "reduce" });
      try {
        const p = await c.newPage(), errors = [], sockets = [], snapshots = [];
        p.on("pageerror", error => errors.push(error.message));
        let user = signedIn ? { id: "isolated-fixture", email: "fixture@example.test" } : null;
        const rows = [{ id: "qa-task", title: "Connection test", class_id: null, priority: "medium", completed: false,
          due_date: "2026-11-18", due_time: "17:00", scheduled_start: "2026-11-17T15:00", duration_minutes: 45 }];
        await c.route("**/cloud-config.js", route => route.fulfill({ contentType: "text/javascript", body: "window.DUCKPLAN_CLOUD={apiUrl:'/api'};" }));
        await c.route("**/api/**", async route => {
          const request = route.request(), path = new URL(request.url()).pathname;
          let data = {};
          if (path === "/api/session") data = { user, providers: { password: true } };
          else if (path === "/api/auth/sign-out") user = null;
          else if (path === "/api/planner") {
            snapshots.push({ path });
            data = { classes: [], items: rows, templates: [], resources: [], organization: {},
              goals: [], habits: [], habit_checkins: [], notes: [], work_alerts_supported: true, task_details_supported: true };
          } else if (path.startsWith("/api/items/")) {
            const id = decodeURIComponent(path.split("/").at(-1)), body = request.postDataJSON();
            const index = rows.findIndex(row => row.id === id);
            if (request.method() === "DELETE") rows.splice(index, 1);
            else if (index >= 0) rows[index] = { ...rows[index], ...body, id };
            else rows.push({ ...body, id });
          } else if (path === "/api/alarms") data = { alarms: [] };
          else if (path === "/api/push/config") data = { enabled: false };
          await route.fulfill({ json: data });
        });
        await p.routeWebSocket("**/api/live", socket => { sockets.push(socket); });
        await p.clock.install({ time: new Date("2026-11-17T12:00:00-08:00") });
        await p.clock.pauseAt(new Date("2026-11-17T12:00:01-08:00"));
        await p.addInitScript(() => { Math.random = () => 1; });
        await p.goto("http://127.0.0.1:8034/?qa=live-sync-backoff#calendar");
        await until(() => p.evaluate(() => typeof store !== "undefined" && workAlertContextReady), "Planner not initialized");
        let reconnectSnapshots = 0;
        if (signedIn) {
          await until(() => sockets.length === 1 && snapshots.length === 2, "First socket did not catch up");
          for (const delay of [2000, 4000, 8000, 16000, 30000]) {
            const count = sockets.length;
            await p.clock.runFor(1000);
            sockets.at(-1).close({ code: 1012, reason: "Isolated connection failure" });
            // Give the real browser WebSocket close event a turn before advancing its clock.
            await p.evaluate(() => new Promise(resolve => queueMicrotask(resolve)));
            await new Promise(resolve => setTimeout(resolve, 40));
            await p.clock.runFor(delay - 1);
            check(sockets.length === count, "Reconnect happened before backoff elapsed");
            await p.clock.runFor(1);
            await until(() => sockets.length === count + 1, "Backed-off reconnect missing");
          }
          check(snapshots.length <= 4, "Catch-up request flood during five short disconnects");
          reconnectSnapshots = snapshots.length;
          const remote = { ...rows[0], title: "Live update received" }; rows[0] = remote;
          sockets.at(-1).send(JSON.stringify({ table: "items", row: remote }));
          await until(() => p.evaluate(() => store.listItems()[0]?.title === "Live update received"), "Live row was throttled");
        } else check(sockets.length === 0 && snapshots.length === 0, "Signed-out guest connected to private sync");

        // Persistence actions use the shipped store and app, not an alternate test implementation.
        const savedId = await p.evaluate(async () => (await store.upsertItem({ title: "Saved through current store", classId: null,
          scheduledStart: "2026-11-17T15:00", dueDate: "2026-11-18", dueTime: "17:00", durationMinutes: 45 })).id);
        await p.evaluate(async id => { await store.toggleComplete(id, true); await store.toggleComplete(id, false); }, savedId);
        await p.reload();
        await until(() => p.evaluate(() => typeof store !== "undefined" && workAlertContextReady), "Reload not initialized");
        check(await p.evaluate(id => store.listItems().some(task => task.id === id && !task.completed && task.dueTime === "17:00"), savedId), "Task save/reload lost fields");
        if (signedIn) {
          const retired = sockets.at(-1);
          retired.close({ code: 1012, reason: "Pending retry during sign-out" });
          await new Promise(resolve => setTimeout(resolve, 40));
          await p.evaluate(() => store.signOut());
          const socketCount = sockets.length, snapshotCount = snapshots.length;
          await p.clock.runFor(120000);
          check(sockets.length === socketCount && snapshots.length === snapshotCount, "Signed-out client kept retrying");
          check(await p.evaluate(() => store.mode === "local" && !store.listItems().some(task => task.title === "Saved through current store")), "Cloud owner data leaked to guest");
        }
        check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Document overflow");
        check(!errors.length, errors.join("; "));
        results.push({ viewport, mode: signedIn ? "signed-in API/WebSocket fault-injection fixture" : "local guest",
          status: "PASS", handshakes: sockets.length, snapshotRequests: snapshots.length, reconnectSnapshots, errors });
      } finally { await c.close(); }
    }
  }
  return { runtime: browser.version(), note: "Real Chromium WebSocket events and full app; API responses are isolated fixtures, not production/D1 or native evidence.", results };
}
