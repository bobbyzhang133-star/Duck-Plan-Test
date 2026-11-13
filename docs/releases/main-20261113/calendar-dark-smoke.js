// Focused verification of release ad784be on port8036: shared Calendar dark surfaces and template parity.
// Disposable contexts; no external/API requests or existing user data.
async (page) => {
  const origin = "http://127.0.0.1:8036";
  const evidenceRoot = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-main-release-20261113/docs/releases/main-20261113/";
  const cases = [];
  for (const [width, height] of [[835, 1112], [390, 844]]) {
    const context = await page.context().browser().newContext({ viewport: { width, height }, timezoneId: "America/Los_Angeles", serviceWorkers: "block" });
    const p = await context.newPage(), errors = [], consoleErrors = [], blocked = [];
    const check = (pass, message) => { if (!pass) throw new Error(`${width}px: ${message}`); };
    p.on("pageerror", error => errors.push(error.message));
    p.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
    await context.route("**/*", route => { const url = new URL(route.request().url()); if (url.origin !== origin || url.pathname.startsWith("/api/")) { blocked.push(url.href); return route.abort(); } return route.continue(); });
    try {
      await p.goto(`${origin}/?qa=main-release-dark-${width}-ad784be#calendar`);
      await p.waitForFunction(() => store.listItems().length > 0);
      const ids = await p.evaluate(async () => {
        document.documentElement.dataset.theme = "dark";
        const template = await store.upsertTemplate({ title: "Release QA Personal template", classId: "personal", durationMinutes: 45, priority: "Medium", notes: "Disposable dark-style comparison.", reminderChoice: "off" });
        const copy = DuckPlanLibrary.instantiateScheduledTemplate(template, { date: selectedDate, time: "10:00" });
        await store.upsertItem(copy);
        return { template: template.id, copy: copy.id };
      });
      if (width <= 700) await p.locator("#phone-task-summary").click();
      await p.locator("#calendar-templates-tab").click();
      await p.mouse.move(0, 0);
      const parity = await p.evaluate(ids => {
        const template = document.querySelector(`#calendar-assignment-templates [data-library-template="${ids.template}"]`), copy = document.querySelector(`.calendar-event-block[data-select-task="${ids.copy}"]`);
        const read = (element, title, meta) => ({ fill: getComputedStyle(element).backgroundColor, accent: getComputedStyle(element).borderLeftColor, title: getComputedStyle(element.querySelector(title)).color, secondary: getComputedStyle(element.querySelector(meta)).color });
        const a = read(template, "h3", ".library-template-block-meta"), b = read(copy, "strong", "small");
        return { template: a, calendar: b, exact: JSON.stringify(a) === JSON.stringify(b) };
      }, ids);
      check(parity.exact, "Template and scheduled Personal colors differ in dark mode");
      if (width <= 700) await p.locator(".calendar-library-toolbar [data-close-task-panel]").click();
      const modes = [];
      for (const mode of ["week", "day", "month"]) {
        await p.locator(`[data-calendar-view="${mode}"]`).click();
        await p.locator(".view.active").evaluate(element => Promise.all(element.getAnimations({ subtree: true }).filter(animation => animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
        await p.waitForFunction(() => getComputedStyle(document.querySelector("#toast")).opacity === "0");
        const colors = await p.evaluate(mode => {
          const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1; const context = canvas.getContext("2d");
          const rgba = color => { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
          const background = element => { const chain = []; for (let current = element; current; current = current.parentElement) chain.push(rgba(getComputedStyle(current).backgroundColor)); let result = [255, 255, 255]; for (const color of chain.reverse()) { const alpha = color[3] / 255; result = result.map((value, index) => color[index] * alpha + value * (1 - alpha)); } return result; };
          const luminance = color => color.slice(0, 3).map(value => { const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
          const contrast = element => { const foreground = luminance(rgba(getComputedStyle(element).color)), back = luminance(background(element)); return (Math.max(foreground, back) + .05) / (Math.min(foreground, back) + .05); };
          const board = document.querySelector(mode === "month" ? ".month-calendar" : ".timeline-calendar");
          const sampleSelectors = ["#calendar-heading", "#calendar-range", mode === "month" ? ".month-day strong" : ".time-axis span"];
          return { mode, width: innerWidth, pageFits: document.documentElement.scrollWidth <= innerWidth, boardLuminance: luminance(background(board)), sampleContrast: sampleSelectors.map(selector => ({ selector, contrast: contrast(document.querySelector(selector)) })), weekSelectorDays: mode === "week" && innerWidth <= 700 ? document.querySelectorAll(".phone-week-day").length : null };
        }, mode);
        check(colors.pageFits && colors.boardLuminance < .25 && colors.sampleContrast.every(sample => sample.contrast >= 3), `${mode} dark surfaces/labels or horizontal overflow regressed`);
        if (width <= 700 && mode === "week") check(colors.weekSelectorDays === 7, "Phone Week selector changed");
        await p.screenshot({ path: `${evidenceRoot}calendar-dark-${width}-${mode}.png` });
        modes.push(colors);
      }
      check(!errors.length && !consoleErrors.length && !blocked.length, "Browser errors or external/API requests occurred");
      cases.push({ width, height, passed: true, parity, modes, errors, consoleErrors, blocked });
    } catch (error) { cases.push({ width, height, passed: false, error: error.message, errors, consoleErrors, blocked }); }
    finally { await context.close(); }
  }
  return { checkedCommit: "ad784be", origin, passed: cases.every(item => item.passed), cases, userContextsTouched: false };
}
