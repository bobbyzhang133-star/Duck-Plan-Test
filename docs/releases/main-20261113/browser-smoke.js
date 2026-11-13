// Run with Playwright MCP browser_run_code_unsafe.filename while the isolated release serves port8036.
// Disposable contexts only; account/API and nonlocal requests are blocked and must remain absent.
async (page) => {
  const origin = "http://127.0.0.1:8036";
  const evidenceRoot = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-main-release-20261113/docs/releases/main-20261113/";
  const cases = [];
  for (const { name, width, height } of [{ name: "desktop", width: 1280, height: 900 }, { name: "ipad", width: 835, height: 1112 }, { name: "phone", width: 390, height: 844 }]) {
    const context = await page.context().browser().newContext({ viewport: { width, height }, timezoneId: "America/Los_Angeles", serviceWorkers: "block" });
    const p = await context.newPage();
    const pageErrors = [], consoleErrors = [], blocked = [], checks = {};
    const check = (value, message) => { if (!value) throw new Error(`${name}: ${message}`); };
    p.on("pageerror", error => pageErrors.push(error.message));
    p.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin || url.pathname.startsWith("/api/")) { blocked.push(url.href); return route.abort(); }
      return route.continue();
    });
    const fits = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    const navigate = async view => {
      if (width <= 700) {
        await p.locator("#phone-more-button").click();
        await p.locator(`#phone-more-dialog [data-view="${view}"]`).click();
        await p.waitForFunction(() => !document.querySelector("#phone-more-dialog").open);
      } else await p.locator(`#planner-sidebar [data-view="${view}"]`).click();
      await p.waitForFunction(view => document.body.dataset.view === view, view);
    };
    const idle = async () => {
      await p.locator(".view.active").evaluate(element => Promise.all(element.getAnimations({ subtree: true }).filter(animation => animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
      await p.waitForFunction(() => getComputedStyle(document.querySelector("#toast")).opacity === "0");
    };
    try {
      await p.goto(`${origin}/?qa=main-release-${name}-20261113`);
      await p.waitForFunction(() => store.listItems().length > 0 && document.body.dataset.view === "calendar");
      const taskCount = await p.evaluate(() => store.listItems().length);
      check(await fits(), "Calendar has horizontal page overflow");
      if (width > 700) {
        check(await p.evaluate(() => { const a = document.querySelector("#daily-task-panel").getBoundingClientRect(), b = document.querySelector(".calendar-main-panel").getBoundingClientRect(); return Math.abs(a.top - b.top) < 2 && a.right <= b.left + 2; }), "Tasks and Calendar are not side by side");
      } else {
        check(await p.locator(".phone-bottom-nav .phone-nav-button").count() === 5 && await p.locator(".phone-bottom-nav").isVisible(), "Phone bottom navigation is unavailable");
        check(await p.evaluate(() => !document.body.classList.contains("task-panel-open") && document.querySelector("#daily-task-panel").inert), "Phone Tasks sheet did not start closed");
      }
      await idle();
      await p.screenshot({ path: `${evidenceRoot}calendar-${name}.png` });
      if (width <= 700) {
        await p.locator("#phone-task-summary").click();
        await p.waitForFunction(() => document.body.classList.contains("task-panel-open"));
      }
      await p.locator("#calendar-templates-tab").click();
      check(await p.evaluate(() => !document.querySelector("#calendar-assignment-templates").hidden && !document.querySelector("#calendar-assignment-templates").inert && document.querySelector("#calendar-tasks-panel").hidden), "Templates tab is unreachable");
      check(await p.locator('#calendar-assignment-templates [data-library-action="new-template"]').count() === 1, "Templates New action is missing or duplicated");
      if (width <= 700) {
        check(await p.evaluate(() => document.querySelector(".phone-bottom-nav").inert), "Open Tasks sheet did not isolate navigation");
        await p.locator(".calendar-library-toolbar [data-close-task-panel]").click();
        check(await p.evaluate(() => !document.body.classList.contains("task-panel-open") && !document.querySelector(".phone-bottom-nav").inert && document.activeElement.id === "phone-task-summary"), "Tasks sheet did not restore navigation/launcher");
      }
      checks.calendarTemplatesAndNavigation = true;

      await navigate("notes");
      check((await p.locator("#open-task-modal").innerText()).includes("Add note"), "Notes Add action is still Add task");
      await p.locator("#open-task-modal").click();
      const note = p.locator("dialog.personal-note-dialog[open]");
      await note.locator('[name="title"]').fill(`Release QA ${name} note`);
      await note.locator('[name="body"]').fill("A disposable note created through the release Notes Add action.");
      await note.getByRole("button", { name: "Save note", exact: true }).click();
      await note.waitFor({ state: "detached" });
      await p.waitForFunction(() => store.listNotes().length === 1);
      check(await fits(), "Notes has horizontal page overflow");
      await p.reload();
      await p.waitForFunction(() => store.listNotes().length === 1 && document.body.dataset.view === "notes");
      check(await p.locator(".personal-note-card").count() === 1 && await p.evaluate(() => store.listItems().length) === taskCount, "Note failed reload or created a task");
      if (name === "desktop") { await idle(); await p.screenshot({ path: `${evidenceRoot}notes-desktop.png` }); }
      checks.noteCreateReloadCorrectType = true;

      await navigate("goals");
      check((await p.locator("#open-task-modal").innerText()).includes("Add goal / habit"), "Goals Add action is still Add task");
      await p.locator("#open-task-modal").click();
      await p.locator('#personal-goals-dialog [data-pg-choice="goal"]').click();
      const goal = p.locator("#personal-goals-dialog");
      await goal.locator('[name="title"]').fill(`Release QA ${name} goal`);
      await goal.locator('[name="targetCount"]').fill("3");
      await goal.locator('[name="currentCount"]').fill("1");
      await goal.locator('[name="unit"]').fill("sessions");
      await goal.getByRole("button", { name: "Save goal", exact: true }).click();
      await goal.waitFor({ state: "detached" });
      await p.waitForFunction(() => store.listGoals().length === 1);
      await p.locator("#open-task-modal").click();
      await p.locator('#personal-goals-dialog [data-pg-choice="habit"]').click();
      const habit = p.locator("#personal-goals-dialog");
      await habit.locator('[name="title"]').fill(`Release QA ${name} habit`);
      for (const input of await habit.locator('[name="repeatDays"]').all()) await input.setChecked(["1", "3", "5"].includes(await input.getAttribute("value")));
      await habit.getByRole("button", { name: "Save habit", exact: true }).click();
      await habit.waitFor({ state: "detached" });
      await p.waitForFunction(() => store.listHabits().length === 1);
      check(await fits(), "Goals and Habits have horizontal page overflow");
      await p.reload();
      await p.waitForFunction(() => store.listGoals().length === 1 && store.listHabits().length === 1 && document.body.dataset.view === "goals");
      const counts = await p.evaluate(() => ({ tasks: store.listItems().length, notes: store.listNotes().length, goals: store.listGoals().length, habits: store.listHabits().length, goal: store.listGoals()[0], habit: store.listHabits()[0] }));
      check(counts.tasks === taskCount && counts.notes === 1 && counts.goals === 1 && counts.habits === 1 && counts.goal.targetCount === 3 && counts.goal.currentCount === 1 && JSON.stringify(counts.habit.repeatDays) === "[1,3,5]", "Personal types or fields failed reload or created tasks");
      check(await fits(), "Reloaded Goals and Habits have horizontal page overflow");
      if (name === "desktop") { await idle(); await p.screenshot({ path: `${evidenceRoot}goals-habits-desktop.png` }); }
      checks.goalHabitCreateReloadCorrectTypes = true;
      check(!pageErrors.length && !consoleErrors.length && !blocked.length, "Browser errors or API/nonlocal requests occurred");
      cases.push({ name, width, height, passed: true, checks, counts: { tasks: counts.tasks, notes: counts.notes, goals: counts.goals, habits: counts.habits }, pageErrors, consoleErrors, blocked });
    } catch (error) {
      cases.push({ name, width, height, passed: false, error: error.message, checks, pageErrors, consoleErrors, blocked });
    } finally { await context.close(); }
  }
  return { origin, cases, passed: cases.every(item => item.passed), userContextsTouched: false };
}
