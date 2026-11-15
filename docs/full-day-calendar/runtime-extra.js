// Existing scheduled-block pointer/keyboard rescheduling at the expanded day edges.
async (page) => {
  const browser = page.context().browser(), contexts = new Set(), cases = [], errors = [], failed = [];
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 7000 });
  let stage = "setup", activePage = null, taskId = null;
  try {
    for (const origin of ["http://127.0.0.1:8034", "http://127.0.0.1:8796"]) {
      const cloud = origin.endsWith("8796"), c = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "America/Los_Angeles", serviceWorkers: "block", reducedMotion: "reduce" }); contexts.add(c);
      await c.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
      if (cloud) { const r = await c.request.post(origin + "/api/auth/sign-up", { headers: { Origin: origin }, data: { email: `full-day-pointer-${Date.now()}@example.test`, password: `Fixture-${Date.now()}-LocalQA` } }); check(r.status() === 201, "Signup failed"); }
      const p = await c.newPage(); activePage = p; p.setDefaultTimeout(7000); p.on("pageerror", e => errors.push(e.message)); p.on("requestfailed", r => failed.push({ path: new URL(r.url()).pathname, error: r.failure()?.errorText }));
      await p.goto(origin + "/?qa=full-day-pointer#calendar"); await p.bringToFront(); await wait(p, mode => typeof store !== "undefined" && store.mode === mode && (mode !== "cloud" || store.user), cloud ? "cloud" : "local");
      const task = await p.evaluate(async () => {
        const task = await store.upsertItem({ id: crypto.randomUUID(), title: "Existing full day block", classId: null, type: "task", dueDate: "2026-11-14", dueTime: "18:30", scheduledStart: "2026-11-14T12:00", scheduledEnd: null, durationMinutes: 45, priority: "High", notes: "Preserve existing block", completed: false, reminderChoice: "off" });
        selectedDate = "2026-11-14"; calendarView = "day"; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); return task;
      });
      taskId = task.id;
      for (const time of ["00:00", "23:15"]) {
        stage = `${cloud ? "cloud" : "local"} existing-pointer ${time}`;
        await p.evaluate(async id => { const task = store.listItems().find(t => t.id === id); await store.upsertItem({ ...task, scheduledStart: "2026-11-14T12:00" }); hideToast(); renderAll({ autoScrollCalendar: false }); }, task.id);
        // Let the signed-in fixture's real WebSocket catch-up snapshot settle before
        // acquiring the source element; a setup rerender can legitimately detach it.
        if (cloud) await p.waitForLoadState("networkidle");
        const source = p.locator(`[data-calendar-drag-task="${task.id}"]`); await source.scrollIntoViewIfNeeded();
        // Browser scrollIntoView may consider a block under sticky date headers
        // visible. Center it in the scroller before trusted pointer acquisition.
        await source.evaluate(e => { const v = e.closest("#planner-calendar"); v.scrollTop += e.getBoundingClientRect().top - v.getBoundingClientRect().top - v.clientHeight / 2; });
        const b = await source.boundingBox();
        await p.evaluate(({ x, y }) => { window.__pointerStart = { x, y, hit: document.elementFromPoint(x, y)?.outerHTML.slice(0, 500), scroll: document.querySelector("#planner-calendar").scrollTop }; }, { x: b.x + 30, y: b.y + 10 });
        stage += " start"; await p.mouse.move(b.x + 30, b.y + 10); await p.mouse.down(); await p.mouse.move(b.x + 42, b.y + 16, { steps: 6 }); await wait(p, () => !!document.querySelector(".calendar-drag-ghost"));
        await p.evaluate(time => { const v = document.querySelector("#planner-calendar"); v.scrollTop = time === "00:00" ? 0 : v.scrollHeight; }, time);
        const column = await p.locator('.timeline-column[data-column-date="2026-11-14"]').boundingBox(), minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3)), targetY = column.y + minutes * column.height / 1440;
        await p.mouse.move(column.x + column.width / 2, targetY + 10, { steps: 14 });
        const q = await p.locator(".calendar-drag-ghost").evaluate(e => ({ top: e.getBoundingClientRect().top, caption: e.querySelector("small").textContent, height: e.getBoundingClientRect().height }));
        check(Math.abs(q.top - targetY) < .2 && q.caption === (time === "00:00" ? "12:00 AM" : "11:15 PM"), "Existing pointer preview still has old range " + JSON.stringify(q));
        const response = cloud ? p.waitForResponse(r => r.request().method() === "PUT" && new URL(r.url()).pathname === "/api/items/" + task.id && r.status() === 200) : Promise.resolve(null);
        stage += " release"; await p.mouse.up(); await response; stage += " saved"; await wait(p, ({ id, time }) => store.listItems().find(t => t.id === id)?.scheduledStart === "2026-11-14T" + time, { id: task.id, time });
        const saved = await p.evaluate(id => store.listItems().find(t => t.id === id), task.id); check(saved.dueDate === task.dueDate && saved.dueTime === task.dueTime && saved.notes === task.notes && saved.durationMinutes === task.durationMinutes, "Existing pointer edit changed other fields");
        stage += " reload"; await p.reload(); await wait(p, ({ id, time }) => typeof store !== "undefined" && store.listItems().find(t => t.id === id)?.scheduledStart === "2026-11-14T" + time, { id: task.id, time });
        cases.push({ test: "existing-block-pointer-edge-reschedule-reload", mode: cloud ? "signed-in real local Worker" : "local browser storage", time, status: "PASS", preview: q, deadline: [saved.dueDate, saved.dueTime] });
      }
      stage = "existing block keyboard edge constraints";
      await p.evaluate(() => { selectedDate = "2026-11-14"; calendarView = "day"; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); });
      const source = p.locator(`[data-calendar-drag-task="${task.id}"]`); await source.focus();
      await source.press("Alt+ArrowDown"); await wait(p, id => store.listItems().find(t => t.id === id)?.scheduledStart === "2026-11-14T23:15", task.id);
      const after = await p.evaluate(id => store.listItems().find(t => t.id === id), task.id); check(after.scheduledStart === "2026-11-14T23:15", "Keyboard exceeded midnight duration fit");
      cases.push({ test: "existing-block-keyboard-duration-aware-midnight-bound", mode: cloud ? "signed-in real local Worker" : "local browser storage", status: "PASS", latestTime: "23:15", duration: 45 });
      await c.close(); contexts.delete(c);
    }
    return { runtime: browser.version(), cases, errors, failed, allSyntheticContextsClosed: contexts.size === 0 };
  } catch (error) { return { runtime: browser.version(), stage, error: error.message, diagnostic: activePage && !activePage.isClosed() ? await activePage.evaluate(id => ({ pointerStart: window.__pointerStart, drag: typeof calendarDrag !== "undefined" && calendarDrag && { started: calendarDrag.started, connected: calendarDrag.source?.isConnected, drop: calendarDrag.drop }, task: store.listItems().find(t => t.id === id), toast: document.querySelector("#toast-message").textContent, error: document.querySelector("#task-error")?.textContent }), taskId) : null, cases, errors, failed }; }
  finally { for (const c of contexts) await c.close(); }
}
