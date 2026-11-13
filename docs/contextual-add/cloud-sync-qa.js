// Manual Playwright MCP regression: browser_run_code_unsafe({ filename: absolutePath }).
// Creates synthetic data only in the isolated local Worker at port 8790.
async (page) => {
  const browser = page.context().browser();
  const contexts = [];
  const check = (value, message) => { if (!value) throw new Error(message); };
  const seed = `Personal sync ${Date.now()}`;
  const createContext = async viewport => {
    const context = await browser.newContext({ viewport, serviceWorkers: "block", timezoneId: "America/Los_Angeles" });
    contexts.push(context);
    await context.addInitScript(() => {
      window.__personalSyncQA = { rows: [], opened: 0, errors: [] };
      window.addEventListener("error", event => __personalSyncQA.errors.push(event.message));
      const NativeWebSocket = window.WebSocket;
      window.WebSocket = class extends NativeWebSocket {
        constructor(...args) {
          super(...args);
          this.addEventListener("open", () => { __personalSyncQA.opened += 1; });
          this.addEventListener("message", event => {
            try {
              const message = JSON.parse(event.data);
              if (message.table) __personalSyncQA.rows.push({ table: message.table, id: message.row?.id, habitId: message.row?.habit_id, date: message.row?.date });
            } catch { /* Only application row messages matter here. */ }
          });
        }
      };
    });
    return context;
  };
  const waitFor = (target, predicate, argument) => target.waitForFunction(predicate, argument, { timeout: 10000 });
  try {
    const desktop = await createContext({ width: 1280, height: 1000 });
    const a = await desktop.newPage();
    await a.goto("http://127.0.0.1:8790/?qa=personal-cloud-verification#settings");
    await a.locator('#sign-in-form [name="email"]').fill(`personal-sync-${Date.now()}@example.test`);
    await a.locator('#sign-in-form [name="password"]').fill("Isolated personal sync QA password 2026");
    await a.locator('#sign-in-form [data-action="sign-up"]').click();
    await a.locator("#sign-out").waitFor();
    await a.locator("#dismiss-recovery").click();
    await waitFor(a, () => __personalSyncQA.opened > 0 && store.supportsPersonal);

    const phone = await createContext({ width: 390, height: 844 });
    await phone.addCookies(await desktop.cookies());
    const b = await phone.newPage();
    await b.goto("http://127.0.0.1:8790/?qa=personal-phone-verification#goals");
    await waitFor(b, () => store.user && store.supportsPersonal && __personalSyncQA.opened > 0);
    await a.evaluate(() => setView("goals"));

    // Exercise the contextual toolbar and real goal editor before testing the live store.
    await a.locator("#open-task-modal").click();
    await a.locator('[data-pg-choice="goal"]').click();
    await a.locator('.pg-dialog [name="title"]').fill(`${seed} goal`);
    await a.locator('.pg-dialog [name="targetCount"]').fill("8");
    await a.locator('.pg-dialog [name="currentCount"]').fill("3");
    await a.locator(".pg-dialog").getByRole("button", { name: "Save goal", exact: true }).click();
    await a.locator(".pg-dialog").waitFor({ state: "detached" });
    await waitFor(b, title => store.listGoals().some(item => item.title === title), `${seed} goal`);
    const goal = await a.evaluate(title => store.listGoals().find(item => item.title === title), `${seed} goal`);

    const habit = await a.evaluate(title => store.upsertHabit({ title, repeatDays: [0, 1, 2, 3, 4, 5, 6], notes: "One page each day." }), `${seed} habit`);
    await waitFor(b, id => store.listHabits().some(item => item.id === id), habit.id);
    const date = await a.evaluate(() => nowKey());
    await a.evaluate(({ id, date }) => store.setHabitCheckin(id, date, true), { id: habit.id, date });
    await waitFor(b, ({ id, date }) => store.listHabitCheckins().some(item => item.habitId === id && item.date === date), { id: habit.id, date });
    await b.locator(`[data-pg-action="checkin"][data-pg-id="${habit.id}"][data-pg-date="${date}"][aria-pressed="true"]`).waitFor();

    const note = await a.evaluate(title => store.upsertNote({ title, category: "Ideas", body: "First line\n\nKeep saved writing intact." }), `${seed} note`);
    await waitFor(b, id => store.listNotes().some(item => item.id === id), note.id);
    await b.evaluate(() => setView("notes"));
    await b.locator(`[data-note-card="${note.id}"]`).waitFor();

    await b.evaluate(({ id }) => store.upsertNote({ ...store.listNotes().find(item => item.id === id), title: "Synced note edit", body: "Updated from the phone-sized context." }), { id: note.id });
    await waitFor(a, id => store.listNotes().find(item => item.id === id)?.title === "Synced note edit", note.id);
    await a.evaluate(id => store.upsertGoal({ ...store.listGoals().find(item => item.id === id), currentCount: 7 }), goal.id);
    await waitFor(b, id => store.listGoals().find(item => item.id === id)?.currentCount === 7, goal.id);
    await a.evaluate(id => store.upsertHabit({ ...store.listHabits().find(item => item.id === id), notes: "Edited routine." }), habit.id);
    await waitFor(b, id => store.listHabits().find(item => item.id === id)?.notes === "Edited routine.", habit.id);

    await b.evaluate(({ id, date }) => store.setHabitCheckin(id, date, false), { id: habit.id, date });
    await waitFor(a, id => store.listHabitCheckins({ habitId: id }).length === 0, habit.id);
    await b.evaluate(({ id, date }) => store.setHabitCheckin(id, date, true), { id: habit.id, date });
    await waitFor(a, id => store.listHabitCheckins({ habitId: id }).length === 1, habit.id);

    await b.reload();
    await waitFor(b, () => store.user && store.listGoals().length === 1 && store.listHabits().length === 1 && store.listNotes().length === 1 && __personalSyncQA.opened > 0);
    await b.evaluate(() => setView("goals"));
    await b.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
    await b.screenshot({ path: "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/contextual-add/cloud-sync-390.png", fullPage: true });

    await a.evaluate(id => store.deleteHabit(id), habit.id);
    await waitFor(b, id => !store.listHabits().some(item => item.id === id) && store.listHabitCheckins({ habitId: id }).length === 0, habit.id);
    await b.evaluate(id => store.deleteNote(id), note.id);
    await waitFor(a, id => !store.listNotes().some(item => item.id === id), note.id);
    await a.evaluate(id => store.deleteGoal(id), goal.id);
    await waitFor(b, id => !store.listGoals().some(item => item.id === id), goal.id);

    const results = {};
    for (const [name, target] of [["desktop", a], ["phone", b]]) {
      results[name] = await target.evaluate(async () => {
        const response = await fetch("/api/planner");
        const data = await response.json();
        return {
          liveTables: [...new Set(__personalSyncQA.rows.map(item => item.table))], pageErrors: __personalSyncQA.errors,
          clientCounts: [store.listGoals().length, store.listHabits().length, store.listHabitCheckins().length, store.listNotes().length],
          databaseCounts: [data.goals.length, data.habits.length, data.habit_checkins.length, data.notes.length], tasks: data.items.length,
        };
      });
      check(results[name].pageErrors.length === 0, `${name} page errors`);
      check(results[name].clientCounts.every(count => count === 0) && results[name].databaseCounts.every(count => count === 0), `${name} deletion state mismatch`);
      check(["goals", "habits", "habit_checkins", "notes"].every(table => results[name].liveTables.includes(table)), `${name} missed a live table`);
      check(results[name].tasks === 0, "Personal actions created an unintended task");
    }
    return { twoContextLiveCrud: true, reloadAndCascade: true, ...results };
  } finally {
    for (const context of contexts) await context.close();
  }
}
