// Run with Playwright MCP browser_run_code_unsafe.filename while preview8034 serves the checkout.
// Every fixture is confined to a fresh browser context; no account/API or external request is permitted.
async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "America/Los_Angeles", serviceWorkers: "block" });
  const p = await context.newPage();
  const pageErrors = [], consoleErrors = [], prohibitedRequests = [], evidence = {};
  p.on("pageerror", error => pageErrors.push(error.message));
  p.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:8034" || url.pathname.startsWith("/api/")) { prohibitedRequests.push(url.href); return route.abort(); }
    return route.continue();
  });
  const check = (pass, message) => { if (!pass) throw new Error(message); };
  const tasksTab = p.locator("#calendar-tasks-tab"), templatesTab = p.locator("#calendar-templates-tab");
  const templates = p.locator("#calendar-assignment-templates");
  const fixture = { title: "QA Calculus review: derivatives, integrals, and mixed exam practice questions", classId: "calculus", durationMinutes: 60, priority: "High", notes: "Review the saved worked examples before doing mixed questions.", reminderChoice: "60" };
  const checkPane = async selected => check(await p.evaluate(selected => {
    const active = document.querySelector(selected === "tasks" ? "#calendar-tasks-panel" : "#calendar-assignment-templates");
    const inactive = document.querySelector(selected === "tasks" ? "#calendar-assignment-templates" : "#calendar-tasks-panel");
    const selectedTab = document.querySelector(`[data-calendar-library-tab="${selected}"]`);
    return !active.hidden && !active.inert && inactive.hidden && inactive.inert && selectedTab.tabIndex === 0 && selectedTab.getAttribute("aria-selected") === "true";
  }, selected), `Incorrect tabpanel visibility/focus state for ${selected}`);
  const openPhoneSheet = async () => {
    if (!await p.evaluate(() => document.body.classList.contains("task-panel-open"))) await p.locator("#phone-task-summary").click();
    await p.waitForFunction(() => document.body.classList.contains("task-panel-open"));
    await templatesTab.click();
  };
  try {
    await p.goto("http://127.0.0.1:8034/?qa=template-library-ui-20261113#calendar");
    await p.waitForFunction(() => store.listItems().length > 0 && typeof calendarLibraryTabs !== "undefined");
    await checkPane("tasks");
    await tasksTab.focus(); await p.keyboard.press("ArrowRight"); await checkPane("templates");
    check(await p.evaluate(() => document.activeElement.id) === "calendar-templates-tab", "Arrow key did not focus selected Templates tab");
    check(await templates.locator("[data-library-template]").count() === 0, "Disposable context did not start with an empty library");
    check(await templates.locator('[data-library-action="new-template"]').count() === 1, "Empty library must have one clear New action");
    check(!/drag/i.test(await templates.innerText()), "Empty library shows irrelevant drag instructions");
    await p.keyboard.press("Home"); await checkPane("tasks");
    await p.keyboard.press("End"); await checkPane("templates");
    evidence.tabsKeyboardAndEmpty = true;
    const templateId = await p.evaluate(async fixture => { const saved = await store.upsertTemplate(fixture); return saved.id; }, fixture);
    for (let index = 1; index < 10; index += 1) await p.evaluate(async index => store.upsertTemplate({ title: `Reusable reading ${index}`, classId: index % 2 ? "english" : "physics", durationMinutes: [35, 45, 90][index % 3], priority: "Medium", notes: "A repeatable local QA fixture.", reminderChoice: "off" }), index);
    await checkPane("templates");
    check(await templates.locator("[data-library-template]").count() === 10, "Ten-template library did not render");
    const block = templates.locator(`[data-library-template="${templateId}"]`);
    const card = block.locator("..");
    const currentTemplate = await p.evaluate(id => store.listTemplates().find(item => item.id === id), templateId);
    const countBeforeDrop = await p.evaluate(() => store.listItems().length);
    const date = await p.evaluate(() => selectedDate);
    const target = p.locator(`[data-slot-date="${date}"][data-slot-time="10:00"]`);
    await target.scrollIntoViewIfNeeded(); await block.scrollIntoViewIfNeeded();
    await block.dragTo(target, { targetPosition: { x: 20, y: 20 } });
    await p.waitForFunction(count => store.listItems().length === count + 1, countBeforeDrop);
    const copy = await p.evaluate(title => store.listItems().find(item => item.title === title), fixture.title);
    for (const field of ["title", "classId", "durationMinutes", "priority", "notes", "reminderChoice"]) check(copy[field] === currentTemplate[field], `Native drop changed saved ${field}`);
    check(copy.id !== templateId && copy.scheduledStart.startsWith(`${date}T`) && !copy.dueDate && !copy.dueTime && !copy.completed, "Native drop changed identity/scheduling/deadline semantics");
    check(await p.evaluate(() => !document.querySelector("#task-modal").open && store.listTemplates().length === 10), "Native drop opened editor or consumed source");
    await checkPane("templates");
    evidence.nativeDropImmediateAndSavedSettings = { id: copy.id, scheduledStart: copy.scheduledStart, durationMinutes: copy.durationMinutes };
    const countBeforeAdd = await p.evaluate(() => store.listItems().length);
    await card.locator('[data-library-action="add-template"]').click();
    await p.waitForFunction(count => store.listItems().length === count + 1, countBeforeAdd);
    const copies = await p.evaluate(title => store.listItems().filter(item => item.title === title), fixture.title);
    check(copies.length === 2 && copies.some(item => !item.scheduledStart && !item.dueDate), "Add to tasks did not create an independent unscheduled copy");
    evidence.addToTasksUnscheduled = true;
    await p.mouse.move(0, 0);
    evidence.colorParity = {};
    for (const mode of ["light", "dark"]) {
      evidence.colorParity[mode] = await p.evaluate(({ mode, id, copyId }) => {
        document.documentElement.dataset.theme = mode;
        const t = document.querySelector(`#calendar-assignment-templates [data-library-template="${id}"]`);
        const event = document.querySelector(`.calendar-event-block[data-select-task="${copyId}"]`);
        const read = (element, title, meta) => ({ background: getComputedStyle(element).backgroundColor, accent: getComputedStyle(element).borderLeftColor, title: getComputedStyle(element.querySelector(title)).color, secondary: getComputedStyle(element.querySelector(meta)).color });
        const template = read(t, "h3", ".library-template-block-meta"), calendar = read(event, "strong", "small");
        return { template, calendar, exact: JSON.stringify(template) === JSON.stringify(calendar) };
      }, { mode, id: templateId, copyId: copy.id });
      check(evidence.colorParity[mode].exact, `Template/calendar colors differ in ${mode}`);
    }
    await p.evaluate(() => { document.documentElement.dataset.theme = "light"; document.querySelector("#daily-task-panel").scrollTop = 280; });
    const templateScroll = await p.locator("#daily-task-panel").evaluate(element => element.scrollTop);
    await tasksTab.click(); await p.locator("#daily-task-panel").evaluate(element => { element.scrollTop = 90; });
    const taskScroll = await p.locator("#daily-task-panel").evaluate(element => element.scrollTop);
    await templatesTab.click();
    check(Math.abs(await p.locator("#daily-task-panel").evaluate(element => element.scrollTop) - templateScroll) < 2, "Templates scroll position was lost");
    await tasksTab.click();
    check(Math.abs(await p.locator("#daily-task-panel").evaluate(element => element.scrollTop) - taskScroll) < 2, "Tasks scroll position was lost");
    await templatesTab.click();
    await card.locator('[data-library-action="schedule-template"]').focus();
    await p.evaluate(() => calendarLibraryTabs.select("tasks"));
    check(await p.evaluate(() => document.activeElement.id) === "calendar-tasks-tab", "Programmatic tab change left focus in hidden content");
    await templatesTab.click();
    evidence.perTabScrollAndFocusReturn = { templateScroll, taskScroll };

    await block.scrollIntoViewIfNeeded();
    await card.locator('[data-library-action="template-menu"]').click();
    await p.locator('#template-management-menu [data-template-menu-action="details"]').click();
    const details = p.locator("#planner-library-dialog");
    await details.waitFor({ state: "visible" });
    check((await details.innerText()).includes(fixture.title) && (await details.innerText()).includes(fixture.notes), "Details did not expose the full long title and saved notes");
    await details.locator("[data-library-close]").first().click();
    await details.waitFor({ state: "detached" });
    check(await p.evaluate(() => document.activeElement?.dataset.libraryAction) === "template-menu", "Long-title Details did not return focus to Manage");
    evidence.longTitleDetailsAndFocus = true;

    await card.locator('[data-library-action="template-menu"]').click();
    const ownerReset = await p.evaluate(() => {
      const descriptor = Object.getOwnPropertyDescriptor(store, "user");
      Object.defineProperty(store, "user", { get: () => ({ id: "isolated-qa-owner" }), configurable: true });
      try {
        taskLibrary.render(); calendarLibraryTabs.render();
        return { selected: calendarLibraryTabs.selected, menu: Boolean(document.querySelector("#template-management-menu")), hidden: document.querySelector("#calendar-assignment-templates").hidden, inert: document.querySelector("#calendar-assignment-templates").inert, scrollTop: document.querySelector("#daily-task-panel").scrollTop };
      } finally { Object.defineProperty(store, "user", descriptor); taskLibrary.render(); calendarLibraryTabs.render(); }
    });
    check(ownerReset.selected === "tasks" && !ownerReset.menu && ownerReset.hidden && ownerReset.inert && ownerReset.scrollTop === 0, "Owner change retained Templates, menu or the previous scroll position");
    evidence.ownerReset = ownerReset;

    await templatesTab.click();
    await card.locator('[data-library-action="template-menu"]').click();
    await p.setViewportSize({ width: 1200, height: 900 });
    check(await p.locator("#template-management-menu").count() === 1, "An in-layout resize should keep the management menu anchored");
    await p.setViewportSize({ width: 390, height: 844 });
    check(await p.locator("#template-management-menu").count() === 0 && await p.locator("#daily-task-panel").evaluate(element => element.inert), "A management menu outlived its closed phone Tasks sheet after resize");
    evidence.resizeMenuCleanup = true;

    const screenshotRoot = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/template-library-ui/";
    evidence.layouts = [];
    for (const [width, height, theme, screenshot] of [[1280, 900, "light", "templates-desktop.png"], [820, 1180, "light", "templates-ipad.png"], [390, 844, "light", "templates-phone.png"], [320, 740, "dark", "templates-phone-small-dark.png"]]) {
      await p.setViewportSize({ width, height });
      await p.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      if (width <= 700) await openPhoneSheet(); else await templatesTab.click();
      await p.locator("#daily-task-panel").evaluate(element => { element.scrollTop = 0; });
      await p.mouse.move(0, 0);
      await p.waitForFunction(() => getComputedStyle(document.querySelector("#toast")).opacity === "0");
      await p.locator("#daily-task-panel").evaluate(element => Promise.all(element.getAnimations({ subtree: true }).filter(animation => animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
      const layout = await p.evaluate(() => {
        const frame = document.querySelector("#daily-task-panel").getBoundingClientRect();
        const calendar = document.querySelector(".calendar-main-panel").getBoundingClientRect();
        const rows = [...document.querySelectorAll("#calendar-assignment-templates .library-template-actions")].map(row => {
          const buttons = [...row.querySelectorAll("button")], bounds = buttons.map(button => button.getBoundingClientRect());
          return { fit: row.scrollWidth <= row.clientWidth && buttons.every(button => button.scrollWidth <= button.clientWidth), sameRow: bounds.every(rect => Math.abs(rect.top - bounds[0].top) < 1), minHeight: Math.min(...bounds.map(rect => rect.height)) };
        });
        const title = document.querySelector("#calendar-assignment-templates .library-template-block h3");
        return { width: innerWidth, pageFits: document.documentElement.scrollWidth <= innerWidth, rowCount: rows.length, actionRowsFit: rows.every(row => row.fit && row.sameRow), minActionHeight: Math.min(...rows.map(row => row.minHeight)), titleClamp: getComputedStyle(title).webkitLineClamp, sideBySide: Math.abs(frame.top - calendar.top) < 2 && frame.right <= calendar.left + 2, phoneSheet: document.body.classList.contains("task-panel-open"), toolbarTop: document.querySelector("#calendar-library-toolbar").getBoundingClientRect().top };
      });
      check(layout.pageFits && layout.actionRowsFit && layout.rowCount === 10 && layout.titleClamp === "2", `Template layout/action row regression at ${width}px`);
      check(width <= 700 ? layout.phoneSheet && layout.minActionHeight >= 44 : layout.sideBySide, `Calendar composition/touch targets regressed at ${width}px`);
      await p.screenshot({ path: screenshotRoot + screenshot });
      evidence.layouts.push(layout);
    }
    await p.emulateMedia({ reducedMotion: "reduce" });
    await tasksTab.click(); await checkPane("tasks");
    await templatesTab.click(); await checkPane("templates");
    await p.keyboard.press("Escape");
    check(await p.evaluate(() => !document.body.classList.contains("task-panel-open") && !document.querySelector(".calendar-main-panel").inert && document.activeElement.id === "phone-task-summary"), "Phone Tasks sheet no longer closes/restores its launcher");
    evidence.reducedMotionTabsAndOuterSheet = true;
    check(!pageErrors.length && !consoleErrors.length && !prohibitedRequests.length, "Browser errors or nonlocal/API requests occurred");
    return { evidence, pageErrors, consoleErrors, prohibitedRequests };
  } finally { await context.close(); }
}
