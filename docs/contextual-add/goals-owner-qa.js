// Manual Playwright MCP regression: pass this file to browser_run_code_unsafe.filename.
// Requires the static preview at 127.0.0.1:8034. Loads only local module/CSS/motion assets.
// All owners, records and pending requests are synthetic; no planner/account APIs are used.
async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const blockedRequests = [];
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    const allowed = url.origin === "http://127.0.0.1:8034" && ["/personal-goals.js", "/personal-goals.css", "/popup-motion.js"].includes(url.pathname);
    if (!allowed) { blockedRequests.push(url.pathname); return route.abort(); }
    return route.continue();
  });
  const testPage = await context.newPage();
  const pageErrors = [], consoleErrors = [];
  testPage.on("pageerror", error => pageErrors.push(error.message));
  testPage.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const dialog = testPage.locator("#personal-goals-dialog");
  const owner = value => testPage.evaluate(value => { __goalsOwnerQA.owner = value; __goalsOwnerQA.ui.render(); }, value);
  const clearMessages = () => testPage.evaluate(() => { __goalsOwnerQA.toasts = []; __goalsOwnerQA.errors = []; });
  const settle = async (index, success = true) => {
    await testPage.evaluate(({ index, success }) => __goalsOwnerQA.finish(index, success), { index, success });
    await testPage.waitForTimeout(30);
  };
  const requestCount = () => testPage.evaluate(() => __goalsOwnerQA.requests.length);
  const noMessages = () => testPage.evaluate(() => !__goalsOwnerQA.toasts.length && !__goalsOwnerQA.errors.length);
  try {
    await testPage.setContent('<!doctype html><html><head><style>:root{--line:#eae5d6;--card:#fff;--canvas:#fffdf5;--ink:#49483f;--ink-deep:#292929;--muted:#756f60;--accent:#85620b;--accent-soft:#fff3b0;--surface:#f6f3e9;--green:#46765d;--green-soft:#e7f0e7}*{box-sizing:border-box}body{margin:12px;font:14px system-ui}button{cursor:pointer}</style></head><body><button id="owner-qa-add" type="button">Add goal / habit</button><div id="personal-goals-root"></div></body></html>');
    await testPage.addStyleTag({ url: "http://127.0.0.1:8034/personal-goals.css" });
    await testPage.addScriptTag({ url: "http://127.0.0.1:8034/popup-motion.js" });
    await testPage.addScriptTag({ url: "http://127.0.0.1:8034/personal-goals.js" });
    await testPage.evaluate(() => {
      const q = window.__goalsOwnerQA = { owner: "A", mode: "cloud", requests: [], toasts: [], errors: [], today: "2026-11-13", data: {} };
      for (const name of ["A", "B", "local"]) q.data[name] = {
        goals: [{ id: "shared-goal", title: `Synthetic owner ${name} goal`, notes: `Synthetic owner ${name} private goal notes`, targetCount: 8, currentCount: 3, unit: "pages", deadlineDate: "" }],
        habits: [{ id: "shared-habit", title: `Synthetic owner ${name} habit`, notes: `Synthetic owner ${name} private habit notes`, repeatDays: [0, 1, 2, 3, 4, 5, 6] }],
        checkins: [],
      };
      const key = () => q.mode === "cloud" ? q.owner : "local";
      const request = (kind, item) => new Promise((resolve, reject) => q.requests.push({ key: key(), kind, item, resolve, reject }));
      q.finish = (index, success) => {
        const pending = q.requests[index];
        if (!success) { pending.reject(new Error("Synthetic previous-owner request failure")); return; }
        const data = q.data[pending.key];
        if (pending.kind === "goal") data.goals = [{ ...pending.item, id: "shared-goal" }];
        if (pending.kind === "habit") data.habits = [{ ...pending.item, id: "shared-habit" }];
        if (pending.kind === "checkin") data.checkins = [...data.checkins.filter(item => item.habitId !== pending.item.habitId || item.date !== pending.item.date), ...(pending.item.completed ? [pending.item] : [])];
        pending.resolve(pending.item);
      };
      q.store = {
        get mode() { return q.mode; }, get user() { return q.mode === "cloud" ? { id: q.owner } : null; }, supportsPersonal: true,
        listGoals: () => structuredClone(q.data[key()].goals), listHabits: () => structuredClone(q.data[key()].habits),
        listHabitCheckins: ({ habitId } = {}) => structuredClone(q.data[key()].checkins.filter(item => !habitId || item.habitId === habitId)),
        upsertGoal: item => request("goal", item), upsertHabit: item => request("habit", item),
        deleteGoal: id => request("delete-goal", id), deleteHabit: id => request("delete-habit", id),
        setHabitCheckin: (habitId, date, completed) => request("checkin", { habitId, date, completed }),
      };
      q.ui = DuckPersonalGoals.create({ store: q.store, root: document.querySelector("#personal-goals-root"), getToday: () => q.today, showToast: message => q.toasts.push(message), reportError: error => q.errors.push(error.message) });
    });

    // Owner changes cancel even a dialog's opening animation and discard its draft.
    await testPage.evaluate(() => {
      const q = __goalsOwnerQA;
      q.ui.openGoal({ id: "shared-goal", source: document.querySelector('[data-pg-action="edit-goal"]') });
      document.querySelector('#personal-goals-dialog [name="title"]').value = "Synthetic A unsaved draft";
      q.owner = "B"; q.ui.render();
      q.ui.openHabit({ id: "shared-habit", source: document.querySelector('[data-pg-action="edit-habit"]') });
    });
    await dialog.locator('[name="title"]').click();
    check(await dialog.locator('[name="title"]').inputValue() === "Synthetic owner B habit", "Old opening animation or draft affected the new owner's editor");
    check(!(await testPage.locator("body").innerText()).includes("Synthetic owner A"), "A's fields remained in the visible B page");
    await owner("A");
    check(await dialog.count() === 0, "Habit draft was retained after changing owner");

    // Old successful goal save must not close or write to a new B editor.
    await testPage.locator('[data-pg-action="edit-goal"]').click();
    await dialog.getByRole("button", { name: "Save goal", exact: true }).click();
    const oldGoalRequest = await requestCount() - 1;
    await owner("B");
    check(await dialog.count() === 0, "Pending goal editor remained after changing owner");
    await testPage.locator('[data-pg-action="edit-goal"]').click();
    await dialog.locator('[name="title"]').fill("Synthetic B untouched draft");
    await settle(oldGoalRequest);
    check(await dialog.locator('[name="title"]').inputValue() === "Synthetic B untouched draft", "Old goal success changed or closed B's draft");
    check(await dialog.getByRole("button", { name: "Save goal", exact: true }).isEnabled(), "Old goal completion changed B's controls");
    check(await noMessages(), "Old goal success emitted a message to the new owner");
    await testPage.keyboard.press("Escape"); await dialog.waitFor({ state: "detached" });

    // Old failed habit save must not release a new owner's busy editor or show its error.
    await testPage.locator('[data-pg-action="edit-habit"]').click();
    await dialog.getByRole("button", { name: "Save habit", exact: true }).click();
    const oldHabitRequest = await requestCount() - 1;
    await owner("A");
    await testPage.locator('[data-pg-action="edit-habit"]').click();
    await dialog.locator('[name="title"]').fill("Synthetic A current save");
    await dialog.getByRole("button", { name: "Save habit", exact: true }).click();
    const currentHabitRequest = await requestCount() - 1;
    await settle(oldHabitRequest, false);
    check(await dialog.getByRole("button", { name: "Save habit", exact: true }).isDisabled(), "Old habit finally cleared the new owner's busy state");
    check(await dialog.locator(".pg-form-error").evaluate(element => element.hidden), "Old habit error appeared in the new owner's editor");
    await testPage.keyboard.press("Escape");
    check(await dialog.evaluate(element => element.open), "Old habit completion allowed dismissal of a pending new save");
    check(await noMessages(), "Old habit failure leaked a toast or error callback");
    await settle(currentHabitRequest); await dialog.waitFor({ state: "detached" });
    check(await testPage.evaluate(() => __goalsOwnerQA.toasts.length === 1 && !__goalsOwnerQA.errors.length), "Current owner's habit result did not complete normally");

    // Identical habit/date IDs across owners must keep independent pending guards.
    await clearMessages();
    const checkin = testPage.locator('[data-pg-action="checkin"][data-pg-date="2026-11-13"]');
    await checkin.click(); const oldCheckinRequest = await requestCount() - 1;
    await owner("B");
    await checkin.click(); const currentCheckinRequest = await requestCount() - 1;
    await settle(oldCheckinRequest, false);
    check(await checkin.getAttribute("aria-busy") === "true", "Old check-in finally cleared the same-ID new owner's pending guard");
    const beforeDuplicate = await requestCount();
    await checkin.dispatchEvent("click");
    check(await requestCount() === beforeDuplicate, "Pending same-ID check-in was submitted twice");
    check(await noMessages(), "Old check-in failure leaked an error or toast");
    await settle(currentCheckinRequest);
    check(await checkin.getAttribute("aria-pressed") === "true", "New owner's check-in did not save");
    check(await testPage.evaluate(() => __goalsOwnerQA.toasts.length === 1 && !__goalsOwnerQA.errors.length), "New owner's check-in did not report its own result");

    // A -> B -> A is still a new UI generation, even when owner/record IDs match.
    await owner("A"); await clearMessages();
    await checkin.click(); const firstARequest = await requestCount() - 1;
    await owner("B"); await owner("A");
    await checkin.click(); const secondARequest = await requestCount() - 1;
    await settle(firstARequest);
    check(await checkin.getAttribute("aria-busy") === "true", "Returned-owner stale completion cleared the new pending guard");
    check(await noMessages(), "Returned-owner stale completion emitted a message");
    await settle(secondARequest);
    check(await testPage.evaluate(() => __goalsOwnerQA.toasts.length === 1 && !__goalsOwnerQA.errors.length), "Returned owner's current operation did not complete");

    // Week selection and mode changes reset private editor state as well.
    await testPage.locator('[data-pg-action="previous-week"]').click();
    check(await testPage.locator('[data-pg-action="next-week"]').isEnabled(), "Prior-week baseline was not selected");
    await owner("B");
    check(await testPage.locator('[data-pg-action="next-week"]').isDisabled(), "Owner change retained the previous owner's selected week");
    await testPage.evaluate(() => __goalsOwnerQA.ui.openAddChooser({ source: document.querySelector("#owner-qa-add") }));
    await testPage.evaluate(() => { __goalsOwnerQA.mode = "local"; __goalsOwnerQA.ui.render(); });
    check(await dialog.count() === 0, "Cloud-to-local change retained the Add chooser");

    // Destroy during a pending save detaches the UI and suppresses its later result.
    await testPage.evaluate(() => { __goalsOwnerQA.mode = "cloud"; __goalsOwnerQA.owner = "B"; __goalsOwnerQA.ui.render(); });
    await clearMessages();
    await testPage.locator('[data-pg-action="edit-goal"]').click();
    await dialog.getByRole("button", { name: "Save goal", exact: true }).click();
    const destroyedRequest = await requestCount() - 1;
    await testPage.evaluate(() => __goalsOwnerQA.ui.destroy());
    await settle(destroyedRequest);
    check(await dialog.count() === 0 && await noMessages(), "Destroyed UI reacted to an old pending result");
    check(blockedRequests.length === 0, "Harness attempted a request outside the local asset allowlist");
    check(pageErrors.length === 0 && consoleErrors.length === 0, "Browser errors occurred during owner regression");
    return { syntheticOnly: true, openingAnimationAndDraftReset: true, oldGoalSuccessSuppressed: true, oldHabitFailureSuppressed: true, newOwnerBusyStatePreserved: true, sameIdCheckinIsolation: true, returnedOwnerGenerationIsolation: true, weekAndModeReset: true, destroySuppressesPendingResult: true, realApiRequests: 0, pageErrors, consoleErrors };
  } finally {
    await context.close();
  }
}
