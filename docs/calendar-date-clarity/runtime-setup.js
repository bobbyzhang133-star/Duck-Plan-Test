// Preflight only: disposable fixture transport/setup. Not acceptance of the new UI.
async (page) => {
  const browser = page.context().browser(), contexts = [], results = [];
  let fixturePrefix = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  const id = n => `${fixturePrefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const base = { classId: id(90), priority: "Medium", durationMinutes: 60, notes: "Keep deadline and work time independent", completed: false, source: "manual", schemaVersion: 2 };
  const manualAlerts = { version: 1, timeZone: "America/Los_Angeles", alarm: { enabled: true, mode: "manual", at: "2026-11-21T16:30", sound: "gentle", snoozeMinutes: 10 }, notification: { enabled: true, mode: "manual", at: "2026-11-21T17:15" } };
  const rows = [
    { title: "Overdue but working today", dueDate: "2026-11-19", dueTime: "18:00", scheduledStart: "2026-11-20T14:00" },
    { title: "Overdue with future work", dueDate: "2026-11-19", dueTime: "17:00", scheduledStart: "2026-11-21T15:00" },
    { title: "Due today with future work", dueDate: "2026-11-20", dueTime: "17:00", scheduledStart: "2026-11-21T10:00" },
    { title: "Work and due on same day", dueDate: "2026-11-20", dueTime: "16:00", scheduledStart: "2026-11-20T10:00" },
    { title: "Work finishes after same-day deadline", dueDate: "2026-11-20", dueTime: "09:00", scheduledStart: "2026-11-20T08:30", durationMinutes: 90 },
    { title: "Overnight work crosses deadline", dueDate: "2026-11-21", dueTime: "00:15", scheduledStart: "2026-11-20T23:30", durationMinutes: 60 },
    { title: "Drag keeps manual alerts and deadline", dueDate: "2026-11-22", dueTime: "17:00", scheduledStart: "2026-11-20T16:00", workAlerts: manualAlerts },
    { title: "Unscheduled backlog", dueDate: "", dueTime: "", scheduledStart: null },
    { title: "Due today without work slot", dueDate: "2026-11-20", dueTime: "19:00", scheduledStart: null },
    { title: "Completed work and due today", dueDate: "2026-11-20", dueTime: "18:00", scheduledStart: "2026-11-20T11:00", completed: true },
    { title: "Overdue without work", dueDate: "2026-11-18", dueTime: "17:00", scheduledStart: null },
    { title: 'Quoted" data-fixture-injected="yes <img src=x onerror="1"> & extra-long name', dueDate: "2026-11-20", dueTime: "20:00", scheduledStart: null },
    { title: "Overflow deadline five", dueDate: "2026-11-20", dueTime: "21:00", scheduledStart: null },
    { title: "Overflow deadline six", dueDate: "2026-11-20", dueTime: "22:00", scheduledStart: null },
    { title: "Date-only overflow deadline", dueDate: "2026-11-20", dueTime: "", scheduledStart: null },
  ].map((t, i) => ({ ...base, dueDate: "", dueTime: "", scheduledStart: null, ...t, id: id(i + 1) }));
  const classes = [{ id: id(90), name: "Fixture Science", color: "#39896f", code: "QA", teacher: "Fixture", period: "2", archived: false }];
  try {
    for (const origin of ["http://127.0.0.1:8034", "http://127.0.0.1:8796"]) {
      const cloud = origin.endsWith("8796"), c = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "America/Los_Angeles", locale: "en-US", reducedMotion: "reduce", serviceWorkers: "block" }); contexts.push(c);
      await c.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
      const p = await c.newPage(); p.setDefaultTimeout(15000); p.setDefaultNavigationTimeout(60000); await p.clock.install({ time: new Date("2026-11-20T12:00:00-08:00") });
      if (cloud) {
        const account = await c.request.post(origin + "/api/auth/sign-up", { headers: { Origin: origin }, data: { email: `calendar-clarity-${Date.now()}@example.test`, password: `Fixture-${Date.now()}-OnlyLocalQA` } }); if (account.status() !== 201) throw new Error("Fixture signup failed");
      } else await c.addInitScript(({ rows, classes }) => { localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify(rows)); localStorage.setItem("duckplan-demo-classes-v1", JSON.stringify(classes)); }, { rows, classes });
      await p.goto(origin + "/?qa=calendar-date-clarity-preflight#calendar", { waitUntil: "domcontentloaded" }); await p.bringToFront();
      await p.waitForFunction(cloud => typeof store !== "undefined" && workAlertContextReady && store.mode === (cloud ? "cloud" : "local"), cloud, { timeout: 15000 });
      if (cloud) await p.evaluate(async ({ rows, classes }) => { for (const item of classes) await store.upsertClass(item); for (const row of rows) await store.upsertItem(row); }, { rows, classes });
      const fixture = await p.evaluate(() => ({ count: store.listItems().length, currentDate: nowKey(), mode: store.mode, supportsWorkAlerts: store.supportsWorkAlerts, supportsOrganization: store.supportsOrganization }));
      if (fixture.count !== rows.length || fixture.currentDate !== "2026-11-20") throw new Error("Fixture setup mismatch");
      results.push({ origin, setup: "PASS", fixture, acceptance: "NOT RUN — waiting for SOURCE_READY" });
      await c.close(); contexts.splice(contexts.indexOf(c), 1);
    }
    return { runtime: browser.version(), results, productionWrites: false, contextsClosed: contexts.length === 0 };
  } finally { for (const c of contexts) await c.close(); }
}
