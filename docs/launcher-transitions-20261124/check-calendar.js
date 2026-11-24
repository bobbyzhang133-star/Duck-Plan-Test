async page => {
  const results = [];
  const output = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/launcher-transitions-20261124/";
  for (const config of [
    { width: 1280, height: 950 }, { width: 320, height: 568, touch: true },
    { width: 390, height: 844, touch: true }, { width: 844, height: 390, touch: true },
    { width: 835, height: 1112, touch: true }, { width: 390, height: 844, touch: true, reduced: true },
  ]) {
    const context = await page.context().browser().newContext({
      viewport: config, hasTouch: !!config.touch, isMobile: !!config.touch,
      reducedMotion: config.reduced ? "reduce" : "no-preference", serviceWorkers: "block",
    });
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    const errors = [];
    p.on("pageerror", e => errors.push(e.message));
    const assert = (ok, message) => { if (!ok) throw Error(`${config.width}: ${message}`); };
    const activate = locator => config.touch ? locator.tap() : locator.click();
    try {
      await p.goto("http://127.0.0.1:8799/?demo=completion-20261124-5#calendar");
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length === 8);
      if (await p.locator(".task-panel-close-button").isVisible()) await activate(p.locator(".task-panel-close-button"));
      const taskId = "completion-20261124-5-2";
      for (const view of ["day", "week", "month"]) {
        if (view === "month") await p.evaluate(async id => {
          const task = store.listItems().find(t => t.id === id), date = Model.addDays(nowKey(), 2);
          await store.upsertItem({ ...task, dueDate: date, dueTime: "15:00", scheduledStart: date + "T10:00" });
        }, taskId);
        await activate(p.locator(`[data-calendar-view="${view}"]`));
        const phone = await p.evaluate(() => window.DuckPlanPhoneNavigation.query.matches);
        if (view === "month" && phone) {
          const date = await p.evaluate(() => Model.addDays(nowKey(), 2));
          await activate(p.locator(`.month-date-button[data-date="${date}"]`));
        }
        const work = view === "month"
          ? p.locator(`${phone ? ".calendar-agenda-item" : ".month-entry"}[data-calendar-kind="work"][data-select-task="${taskId}"]`)
          : p.locator(`.calendar-event-block[data-select-task="${taskId}"]`);
        await work.scrollIntoViewIfNeeded();
        await activate(work);
        const modal = p.locator("#task-modal");
        const opening = await modal.evaluate(e => ({
          open: e.open, stage: e.dataset.popupStage,
          tiles: e.querySelectorAll(".popup-morph-tile").length,
          title: e.querySelector("[name=title]").value,
          animations: e.getAnimations({ subtree: true }).length,
        }));
        assert(opening.open && opening.title === "Sample: Review physics notes", `${view} correct task`);
        assert(config.reduced || opening.tiles === 9 && opening.stage === "morph", `${view} expands from launcher`);
        if (view === "day" && !config.reduced && [1280, 390].includes(config.width)) {
          for (const time of [0, 160, 300]) {
            await modal.evaluate((e, t) => e.getAnimations({ subtree: true }).forEach(a => { a.pause(); a.currentTime = t; }), time);
            await p.screenshot({ path: output + `open-${config.width}-${time}.png` });
          }
          await modal.evaluate(e => e.getAnimations({ subtree: true }).forEach(a => a.play()));
        }
        await p.waitForTimeout(450);
        const bounds = await modal.boundingBox();
        assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= config.width + 1 && bounds.y + bounds.height <= config.height + 1, `${view} final bounds`);
        await p.keyboard.press("Escape");
        if (!config.reduced) assert(await modal.evaluate(e => e.open && e.inert && e.dataset.popupMotion === "closing"), `${view} remains mounted for closing`);
        await modal.waitFor({ state: "hidden" });
        await p.waitForFunction(id => document.activeElement?.dataset.selectTask === id, taskId);
        results.push({ viewport: config, view, opening, closing: "PASS", focus: "PASS" });
      }
      await p.evaluate(async id => {
        const task = store.listItems().find(t => t.id === id);
        await store.upsertItem({ ...task, dueDate: nowKey(), scheduledStart: nowKey() + "T10:00" });
        selectDate(nowKey());
      }, taskId);
      await activate(p.locator('[data-calendar-view="day"]'));
      const bar = p.locator(`[data-calendar-drag-task="${taskId}"]`).first();
      await bar.scrollIntoViewIfNeeded();
      await activate(bar);
      await p.keyboard.press("Escape");
      await p.locator("#task-modal").waitFor({ state: "hidden" });
      await activate(bar);
      await p.waitForTimeout(450);
      await p.locator('#task-form [name="title"]').fill("Launcher transition verified");
      await activate(p.locator("#save-task"));
      await p.locator("#task-modal").waitFor({ state: "hidden" });
      await p.reload();
      await p.waitForFunction(id => typeof store !== "undefined" && store.listItems().some(t => t.id === id && t.title === "Launcher transition verified"), taskId);
      assert(errors.length === 0, errors.join("; "));
      results.push({ viewport: config, quickCancelReopen: "PASS", saveReload: "PASS", errors });
    } catch (error) {
      throw Error(`${config.width}×${config.height} ${config.reduced ? "reduced" : "motion"}: ${error.message}; state=${await p.evaluate(() => JSON.stringify({ classes: document.body.className, dialogs: [...document.querySelectorAll('dialog[open]')].map(e => e.id) }))}`);
    } finally { await context.close(); }
  }
  return { runtime: page.context().browser().version(), mode: "isolated local demo; phone/tablet touch emulation", results };
}
