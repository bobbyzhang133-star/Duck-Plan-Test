async page => {
  const browser = page.context().browser(), results = [];
  for (const config of [{ width: 1280 }, { width: 390 }, { width: 390, reduced: true }]) {
    const c = await browser.newContext({ viewport: { width: config.width, height: 1000 }, serviceWorkers: "block", reducedMotion: config.reduced ? "reduce" : "no-preference" });
    try {
      const p = await c.newPage(), errors = [], observations = [];
      p.setDefaultTimeout(7000); p.on("pageerror", e => errors.push(e.message));
      await p.goto("http://127.0.0.1:8042/?demo=completion-20261122-12#tasks");
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length === 8);
      await p.waitForTimeout(500);
      async function cycle(button, root, native = false) {
        await button.scrollIntoViewIfNeeded();
        const initiallyOpen = await root.evaluate(e => DuckExpansionMotion.isExpanded(e));
        if (initiallyOpen) { await button.click(); await p.waitForTimeout(450); }
        const closed = await root.evaluate(e => e.getBoundingClientRect().height);
        await button.focus(); await button.press("Space"); await p.waitForTimeout(65);
        const opening = await root.evaluate(e => ({ height: e.getBoundingClientRect().height, state: e.dataset.uiExpansion, open: e.tagName === "DETAILS" ? e.open : !e.hidden }));
        await p.waitForTimeout(400);
        const full = await root.evaluate(e => e.getBoundingClientRect().height);
        await button.press("Enter"); await p.waitForTimeout(65);
        const closing = await root.evaluate(e => ({ height: e.getBoundingClientRect().height, state: e.dataset.uiExpansion, open: e.tagName === "DETAILS" ? e.open : !e.hidden }));
        await p.waitForTimeout(400);
        const end = await root.evaluate(e => ({ open: e.tagName === "DETAILS" ? e.open : !e.hidden, state: e.dataset.uiExpansion, animations: e.getAnimations().length }));
        if (end.open || end.state || end.animations) throw Error("Disclosure did not settle closed");
        if (!config.reduced && (opening.state !== "opening" || closing.state !== "closing" || !closing.open || opening.height <= closed || closing.height >= full || closing.height <= closed)) throw Error("Missing reversible height transition " + JSON.stringify({ native, closed, opening, full, closing }));
        if (config.reduced && (opening.state || closing.state || closing.open)) throw Error("Reduced motion did not settle immediately");
        await button.click(); await p.waitForTimeout(40); await button.click(); await p.waitForTimeout(40); await button.click(); await p.waitForTimeout(450);
        if (!await root.evaluate(e => DuckExpansionMotion.isExpanded(e))) throw Error("Rapid reversal lost requested open state");
        observations.push({ native, closed, opening, full, closing, end, rapidReversal: "PASS" });
      }
      const group = p.locator('[data-task-group-toggle="plan:scheduled"]');
      const controlled = await group.getAttribute("aria-controls");
      await cycle(group, p.locator("#" + controlled));
      await cycle(p.locator("#assignment-templates summary"), p.locator("#assignment-templates details"), true);
      await p.locator("#open-task-modal").click(); await p.waitForTimeout(450);
      for (const id of ["task-schedule-options", "task-detail-options", "actual-time-options", "task-alarm-options"]) await cycle(p.locator("#" + id + " > summary"), p.locator("#" + id), true);
      await p.locator("#close-task-modal").click(); await p.waitForTimeout(450);
      await p.evaluate(async () => { await store.upsertTemplate({ title: "Motion check template", durationMinutes: 45, classId: null, priority: "Medium", notes: "Transition fixture", reminderChoice: "off" }); });
      const shelf = p.locator("#assignment-templates details");
      if (!await shelf.evaluate(e => e.open)) { await p.locator("#assignment-templates summary").click(); await p.waitForTimeout(450); }
      const manage = p.locator('#assignment-templates [data-library-action="template-menu"]');
      await manage.scrollIntoViewIfNeeded(); await manage.click(); await p.waitForTimeout(65);
      const menuOpening = await p.locator(".library-template-menu").evaluate(e => e.getAnimations().length);
      await p.keyboard.press("Escape"); await p.waitForTimeout(65);
      const menuClosing = await p.locator(".library-template-menu").count();
      await p.waitForTimeout(400);
      if (await p.locator(".library-template-menu").count() || !config.reduced && (!menuOpening || !menuClosing)) throw Error("Menu exit was removed before animation");
      await manage.click(); await p.getByRole("menuitem", { name: "Details Motion check template" }).click(); await p.waitForTimeout(450);
      const library = p.locator(".library-dialog");
      await library.locator("[data-library-close]").first().click(); await p.waitForTimeout(65);
      const libraryClosing = await library.evaluate(e => ({ open: e.open, inert: e.inert } )).catch(() => null);
      await p.waitForTimeout(450);
      if (await library.count() || !config.reduced && (!libraryClosing?.open || !libraryClosing.inert)) throw Error("Library dialog did not animate its exit");
      if (config.width < 700) {
        await p.locator(".phone-nav-button[data-view=calendar]").click(); await p.waitForTimeout(500);
        if (!await p.evaluate(() => document.body.classList.contains("task-panel-open"))) await p.locator("#phone-task-summary").click();
        await p.waitForTimeout(400);
      } else { await p.locator('aside [data-view="calendar"]').click(); await p.waitForTimeout(500); }
      await cycle(p.locator("#daily-task-panel [data-collapse=scheduled]"), p.locator("#scheduled-task-list"));
      await p.locator("#calendar-templates-tab").click(); await p.waitForTimeout(65);
      const swapping = await p.evaluate(() => ({ old: document.querySelector("#calendar-tasks-panel").dataset.uiExpansion, next: document.querySelector("#calendar-assignment-templates").dataset.uiExpansion }));
      await p.waitForTimeout(400); await p.locator("#calendar-tasks-tab").click(); await p.waitForTimeout(400);
      if (!config.reduced && (swapping.old !== "closing" || swapping.next !== "opening")) throw Error("Panel switch missing one direction");
      if (errors.length) throw Error(errors.join("; "));
      const leftovers = await p.locator("[data-ui-expansion]").count();
      if (leftovers) throw Error("Animation state leaked");
      results.push({ config, status: "PASS", observations, menuOpening, menuClosing, libraryClosing, swapping, errors });
    } catch (error) { return { runtime: browser.version(), results, failed: config, error: error.message }; }
    finally { await c.close(); }
  }
  return { runtime: browser.version(), results };
}
