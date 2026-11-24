async (page) => {
  const context = await page.context().browser().newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1,
  });
  const p = await context.newPage();
  const checks = [];
  const errors = [];
  p.on("pageerror", error => errors.push(error.message));
  const check = (condition, name) => {
    if (!condition) throw new Error(name);
    checks.push({ name, status: "PASS" });
  };
  const settle = () => p.waitForTimeout(450);
  const evidence = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/mobile-ui-20261124/";
  try {
    await p.goto("http://127.0.0.1:8799/#calendar");
    await p.waitForFunction(() => document.body.classList.contains("motion-preview"));
    await settle();
    for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await p.setViewportSize(size);
      await p.getByRole("button", { name: "Home", exact: true }).tap();
      await settle();
      await p.locator(".dashboard-week").scrollIntoViewIfNeeded();
      check(await p.locator(".dashboard-week-strip").evaluate(e => {
        const bounds = e.getBoundingClientRect();
        return e.children.length === 7 && [...e.children].every(day => {
          const r = day.getBoundingClientRect();
          return r.left >= bounds.left - 1 && r.right <= bounds.right + 1;
        });
      }), `All seven dates visible ${size.width}`);
      await p.locator(".week-preview-day").last().tap();
      await settle();
      check(await p.locator("#view-calendar").evaluate(e => e.classList.contains("active")), `Sunday touch navigation ${size.width}`);
      await p.locator("#phone-task-summary").tap();
      await settle();
      check(await p.locator("#toggle-task-panel").getAttribute("aria-expanded") === "true", `Sheet opens ${size.width}`);
      await p.locator("#daily-task-panel [data-close-task-panel]").tap();
      await settle();
      check(await p.locator("#toggle-task-panel").getAttribute("aria-expanded") === "false", `Sheet closes ${size.width}`);
      await p.getByRole("button", { name: "Tasks", exact: true }).filter({ visible: true }).tap();
      await settle();
      const matrix = p.getByRole("button", { name: "Priority matrix", exact: true });
      await matrix.tap();
      check(await matrix.getAttribute("aria-pressed") === "true", `Matrix switch ${size.width}`);
      await p.getByRole("button", { name: "List", exact: true }).tap();
      check(await p.getByRole("button", { name: "List", exact: true }).getAttribute("aria-pressed") === "true", `List switch ${size.width}`);
      await p.locator("#phone-more-button").tap();
      await settle();
      check(await p.locator("#phone-more-dialog").evaluate(e => e.open), `More opens ${size.width}`);
      await p.locator("#phone-more-close").tap();
      await settle();
      check(await p.locator("#phone-more-dialog").evaluate(e => !e.open), `More closes ${size.width}`);
      await p.screenshot({ path: evidence + `touch-tasks-${size.width}.png` });
    }
    await p.setViewportSize({ width: 320, height: 568 });
    await p.getByRole("button", { name: "Calendar", exact: true }).filter({ visible: true }).tap();
    await settle();
    await p.locator("#phone-add-task").tap();
    await settle();
    await p.locator("#save-task").tap();
    check(await p.locator("#task-modal").evaluate(e => e.open), "Invalid blank title keeps editor open");
    const title = "Mobile review: prepare the very long science presentation and practice together";
    await p.locator("#task-form [name=title]").fill(title);
    await p.locator("#save-task").tap();
    await settle();
    check(await p.locator("#task-modal").evaluate(e => !e.open), "Long-title task saves");
    await p.reload();
    await settle();
    await p.getByRole("button", { name: "Tasks", exact: true }).filter({ visible: true }).tap();
    await settle();
    check(await p.locator("#view-tasks").innerText().then(text => text.includes(title)), "Task persists after reload");
    await p.getByText(title, { exact: true }).first().scrollIntoViewIfNeeded();
    await p.screenshot({ path: evidence + "long-title-320.png" });
    await p.getByRole("button", { name: "Home", exact: true }).tap();
    await settle();
    await p.locator(".dashboard-week").scrollIntoViewIfNeeded();
    const firstDate = p.locator(".week-preview-day").first();
    await firstDate.focus();
    check(await firstDate.evaluate(e => e === document.activeElement), "Week date keyboard focus");
    await p.keyboard.press("Enter");
    await settle();
    check(await p.locator("#view-calendar").evaluate(e => e.classList.contains("active")), "Week date Enter navigation");
    await p.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await p.evaluate(() => document.documentElement.dataset.theme = "dark");
    await p.getByRole("button", { name: "Home", exact: true }).tap();
    await settle();
    await p.locator(".dashboard-week").scrollIntoViewIfNeeded();
    await p.screenshot({ path: evidence + "dark-reduced-week-320.png" });
    await p.locator("#phone-more-button").tap();
    await p.keyboard.press("Escape");
    await settle();
    check(await p.locator("#phone-more-dialog").evaluate(e => !e.open), "Reduced-motion More Escape");
    check(errors.length === 0, "No application exceptions");
    return { runtime: await p.evaluate(() => navigator.userAgent), mode: "local signed-out; isolated Chromium mobile/touch emulation", checks, errors };
  } finally {
    await context.close();
  }
}
