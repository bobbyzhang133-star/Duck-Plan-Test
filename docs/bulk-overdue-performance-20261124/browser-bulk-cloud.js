// Disposable account and real local Worker/D1 only; no public/user records.
async (page) => {
  const browser = page.context().browser(), origin = "http://127.0.0.1:8788";
  const evidence = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/bulk-overdue-performance-20261124/";
  const contexts = [], result = { runtime: browser.version(), mode: "dedicated local signed-in fixture", origin, requests: [], errors: [] };
  const assert = (v, message) => { if (!v) throw Error(message); };
  try {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", serviceWorkers: "block" }); contexts.push(c);
    const account = { email: `bulk-${Date.now()}@example.test`, password: `Fixture-${Date.now()}-${Math.random()}` };
    const signup = await c.request.post(origin + "/api/auth/sign-up", { data: account, headers: { Origin: origin } }); assert(signup.status() === 201, "Fixture signup failed");
    const items = Array.from({ length: 251 }, (_, i) => ({ id: crypto.randomUUID(), title: `Bulk task ${i}`, notes: "Preserve these notes", due_date: i === 250 ? "2027-12-01" : "2026-01-01", due_time: "12:00", duration_minutes: 45 }));
    const imported = await c.request.post(origin + "/api/import", { data: { itemRows: items }, headers: { Origin: origin } }); assert(imported.ok(), "Fixture import failed");
    const p = await c.newPage(); p.on("pageerror", e => result.errors.push(e.message));
    await p.goto(origin + "/#calendar", { timeout: 25000 });
    await p.waitForFunction(() => typeof store !== "undefined" && store.mode === "cloud" && store.listItems().length === 251 && workAlertContextReady);
    const peer = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: "reduce", serviceWorkers: "block" }); contexts.push(peer); await peer.addCookies(await c.cookies());
    const p2 = await peer.newPage(); await p2.goto(origin + "/#calendar", { timeout: 25000 }); await p2.waitForFunction(() => typeof store !== "undefined" && store.listItems().length === 251);
    let requests = 0;
    await p.route("**/api/items/complete-overdue", async route => {
      const body = route.request().postDataJSON(); result.requests.push(body.items.length); requests++;
      if (requests === 2) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporary test outage. Please retry." }) });
      return route.continue();
    });
    const button = p.locator("#overdue-section [data-complete-overdue]"); await button.click();
    await p.waitForFunction(() => overdueCompletion === null && store.listItems().filter(t=>t.completed).length === 200);
    await p2.waitForFunction(() => store.listItems().filter(t=>t.completed).length === 200);
    assert(await button.isEnabled(), "Retry action stayed disabled");
    await p.screenshot({ path: evidence + "cloud-partial-error.png" });
    result.partialCommitAndPeer = true;
    await button.click(); await p.waitForFunction(() => overdueCompletion === null && store.listItems().filter(t=>t.completed).length === 250);
    await p2.waitForFunction(() => store.listItems().filter(t=>t.completed).length === 250);
    assert(result.requests.join() === "200,50,50", "Unbounded requests or retry resent committed tasks");
    const snapshot = await (await c.request.get(origin + "/api/planner")).json();
    assert(snapshot.items.filter(t=>t.completed).length === 250, "Server completion count is wrong");
    assert(snapshot.items.every(t=>t.notes === "Preserve these notes" && t.duration_minutes === 45), "Unrelated task fields changed");
    assert(!snapshot.items.find(t=>t.id === items[250].id).completed, "Future task was completed");
    await p.reload(); await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().filter(t=>t.completed).length === 250);
    await p.screenshot({ path: evidence + "cloud-after-reload.png" });
    await p2.screenshot({ path: evidence + "cloud-phone-peer.png" });
    result.savedCount = 250; result.retryPersistencePeerAndFutureScope = true;
    // Exercise the second entry point on the Tasks page against the same backend.
    await p.evaluate(async id => { await store.toggleComplete(id, false); navigateView("tasks"); }, items[0].id);
    await p.waitForFunction(() => document.body.dataset.view === "tasks" && !store.listItems().find(t=>t.title === "Bulk task 0").completed);
    await p.locator('#view-tasks [data-complete-overdue]').click();
    await p.waitForFunction(() => overdueCompletion === null && store.listItems().filter(t=>t.completed).length === 250);
    result.tasksEntryAndReopen = true;
    assert(!result.errors.length, result.errors.join("; ")); result.passed = true;
  } catch (error) { result.passed = false; result.error = error.message; }
  finally { for (const c of contexts) await c.close(); }
  return result;
}
