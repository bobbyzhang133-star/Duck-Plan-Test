// Fine-pointer phone-width edge: a transformed Calendar parent must not move the fixed Tasks sheet.
async (page) => {
  const browser = page.context().browser(), c = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const errors = [], failed = []; let stage = "start";
  try {
    await c.route("**/*", r => { const u = new URL(r.request().url()); return u.origin === "http://127.0.0.1:8034" && !u.pathname.startsWith("/api/") ? r.continue() : r.abort(); });
    const p = await c.newPage(); p.setDefaultTimeout(5000); p.setDefaultNavigationTimeout(10000); p.on("pageerror", e => errors.push(e.message)); p.on("requestfailed", r => failed.push(new URL(r.url()).pathname));
    await p.goto("http://127.0.0.1:8034/?qa=moving-layout-fine-phone#tasks"); await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length > 0);
    const measure = () => p.evaluate(() => { const rect = s => document.querySelector(s).getBoundingClientRect().toJSON(); return { phase: document.documentElement.dataset.pageTransitionPhase || null, open: document.body.classList.contains("task-panel-open"), frame: rect(".planner-workspace"), sheet: rect("#daily-task-panel"), summary: rect("#phone-task-summary"), scrim: rect(".task-panel-scrim"), horizontalOverflow: document.documentElement.scrollWidth > innerWidth, coarse: matchMedia("(any-pointer:coarse)").matches }; });
    await p.locator('.phone-bottom-nav [data-view="calendar"]').click(); await p.waitForFunction(() => document.documentElement.dataset.pageTransitionPhase === "animate");
    await p.evaluate(() => { const a = document.getAnimations().filter(a => a.id.startsWith("duck-route-live")); a.forEach(a => { a.pause(); a.currentTime = 160; }); });
    const closedMoving = await measure();
    stage = "moving summary click";
    const point = await p.locator("#phone-task-summary").evaluate(e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, hit: document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.id }; });
    await p.mouse.click(point.x, point.y);
    await p.waitForFunction(() => document.body.classList.contains("task-panel-open"));
    await p.evaluate(() => new Promise(r => setTimeout(r, 600)));
    const openedMoving = await measure();
    await p.evaluate(() => document.getAnimations().filter(a => a.id.startsWith("duck-route-live")).forEach(a => a.finish())); await p.waitForFunction(() => !document.documentElement.dataset.pageTransition);
    const openedAfter = await measure();
    await p.screenshot({ path: "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/moving-layout/fine-phone-sheet.png" });
    return { runtime: browser.version(), stage: "complete", closedMoving, point, openedMoving, openedAfter, sheetJump: { x: openedAfter.sheet.x - openedMoving.sheet.x, y: openedAfter.sheet.y - openedMoving.sheet.y, width: openedAfter.sheet.width - openedMoving.sheet.width, height: openedAfter.sheet.height - openedMoving.sheet.height }, errors, failed, allSyntheticContextsClosed: true };
  } catch (error) { return { runtime: browser.version(), stage, error: error.message, errors, failed }; } finally { await c.close(); }
}
