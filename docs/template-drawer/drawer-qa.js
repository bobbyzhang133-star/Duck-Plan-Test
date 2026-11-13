// Run through Playwright MCP browser_run_code_unsafe.filename with local preview8034.
// Fresh context, local fixture only, no account/API requests or existing browser data.
async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const requestsBlocked = [], pageErrors = [], consoleErrors = [];
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:8034" || url.pathname.startsWith("/api/")) { requestsBlocked.push(url.pathname); return route.abort(); }
    return route.continue();
  });
  const testPage = await context.newPage();
  testPage.on("pageerror", error => pageErrors.push(error.message));
  testPage.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  const check = (value, message) => { if (!value) throw new Error(message); };
  const header = testPage.locator("#calendar-template-drawer-toggle");
  const panel = testPage.locator("#calendar-template-drawer-panel");
  const settled = open => testPage.waitForFunction(open => {
    const panel = document.querySelector("#calendar-template-drawer-panel");
    return panel.hidden === !open && document.querySelector("#calendar-template-drawer-toggle").getAttribute("aria-expanded") === String(open) && panel.getAnimations().length === 0;
  }, open);
  try {
    await testPage.goto("http://127.0.0.1:8034/?v=drawer-regression-20261113#calendar");
    await testPage.waitForFunction(() => store.listItems().length > 0);
    await testPage.evaluate(() => store.upsertTemplate({ title: "Drawer regression fixture", classId: "calculus", durationMinutes: 60, priority: "High", notes: "Fixture for immediate scheduling.", reminderChoice: "60" }));
    check(await panel.evaluate(element => element.hidden && element.inert), "Drawer did not start closed and inert");
    check(await testPage.locator("#assignment-templates > details").count() === 1, "Tasks standalone details shelf changed");
    check(await header.getAttribute("aria-controls") === "calendar-template-drawer-panel" && await panel.getAttribute("role") === "region", "Drawer ARIA relationship missing");
    await header.scrollIntoViewIfNeeded(); await header.focus();
    await testPage.keyboard.press("Enter"); await settled(true);
    await panel.locator('[data-library-action="schedule-template"]').focus();
    await header.evaluate(element => element.click());
    check(await testPage.evaluate(() => document.activeElement.id) === "calendar-template-drawer-toggle", "Closing drawer did not return child focus to its header");
    await settled(false);
    const reversals = [];
    for (let index = 0; index < 5; index += 1) {
      reversals.push(await header.evaluate(element => {
        const panel = document.querySelector("#calendar-template-drawer-panel");
        const before = panel.hidden ? 0 : panel.getBoundingClientRect().height;
        element.click(); return Math.abs(before - panel.getBoundingClientRect().height);
      }));
      await testPage.waitForTimeout(55);
    }
    await settled(true);
    check(reversals.every(difference => difference < 2), "Rapid reversal snapped the live drawer height");
    const count = await testPage.evaluate(() => store.listItems().length);
    const date = await testPage.evaluate(() => selectedDate);
    const target = testPage.locator(`[data-slot-date="${date}"][data-slot-time="10:00"]`);
    await target.scrollIntoViewIfNeeded();
    const block = testPage.locator("#calendar-assignment-templates [data-library-template]");
    await block.scrollIntoViewIfNeeded();
    await block.dragTo(target, { targetPosition: { x: 20, y: 20 } });
    await testPage.waitForFunction(count => store.listItems().length === count + 1, count);
    check(await header.getAttribute("aria-expanded") === "true" && await panel.evaluate(element => !element.hidden && !element.inert), "Immediate drop/save closed the drawer");
    check(await testPage.evaluate(() => !document.querySelector("#task-modal").open && store.listTemplates().length === 1), "Drop opened editor or consumed template");
    for (const [width, height] of [[820, 1180], [390, 844], [320, 740]]) {
      await testPage.setViewportSize({ width, height });
      if (width <= 700 && !await testPage.evaluate(() => document.body.classList.contains("task-panel-open"))) {
        await testPage.locator("#phone-task-summary").click();
        await testPage.waitForFunction(() => document.body.classList.contains("task-panel-open"));
      }
      await header.scrollIntoViewIfNeeded(); await header.focus();
      if (await header.getAttribute("aria-expanded") === "true") { await testPage.keyboard.press("Space"); await settled(false); }
      for (let index = 0; index < 3; index += 1) {
        await testPage.keyboard.press("Tab");
        check(await panel.evaluate(element => !element.contains(document.activeElement)), "Closed drawer entered the Tab sequence");
      }
      await header.focus(); await testPage.keyboard.press("Space"); await settled(true);
      check(await testPage.locator(".library-calendar-drawer").evaluate(element => element.scrollWidth <= element.clientWidth && document.documentElement.scrollWidth <= innerWidth), `Drawer overflow at ${width}px`);
    }
    await testPage.emulateMedia({ reducedMotion: "reduce" });
    await header.evaluate(element => element.click());
    check(await panel.evaluate(element => element.hidden && element.inert && !element.getAnimations().length), "Reduced-motion close was not immediate");
    await header.evaluate(element => element.click());
    check(await panel.evaluate(element => !element.hidden && !element.inert && !element.getAnimations().length), "Reduced-motion open was not immediate");
    await testPage.emulateMedia({ reducedMotion: "no-preference" });
    await header.evaluate(element => element.click()); await settled(false);
    await testPage.evaluate(() => {
      document.querySelector("#calendar-template-drawer-toggle").click();
      window.__drawerOwner = Object.getOwnPropertyDescriptor(store, "user");
      Object.defineProperty(store, "user", { get: () => ({ id: "synthetic-drawer-owner" }), configurable: true });
      taskLibrary.render();
    });
    check(await panel.evaluate(element => element.hidden && element.inert && !element.getAnimations().length), "Owner change retained open drawer or motion");
    await testPage.evaluate(() => { Object.defineProperty(store, "user", window.__drawerOwner); delete window.__drawerOwner; taskLibrary.render(); });
    await testPage.waitForTimeout(400);
    check(await panel.evaluate(element => element.hidden && element.inert && !element.getAnimations().length), "Cancelled animation reopened a new owner's drawer");
    check(!pageErrors.length && !consoleErrors.length && !requestsBlocked.length, "Unexpected browser errors or nonlocal/API request");
    return { keyboardAndAria: true, childFocusReturn: true, rapidReversals: true, nativeDropImmediateSave: true, dropPreservesOpenState: true, phoneOuterSheetAndIpad: true, reducedMotionInstant: true, ownerCleanup: true, realApiRequests: 0, pageErrors, consoleErrors };
  } finally {
    await context.close();
  }
}
