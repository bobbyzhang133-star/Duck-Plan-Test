async (page) => {
  const assert = {
    equal(actual, expected, message = "Unexpected value") { if (actual !== expected) throw new Error(`${message}: ${JSON.stringify({ actual, expected })}`); },
    ok(value, message = "Check failed") { if (!value) throw new Error(message); },
    deepEqual(actual, expected) { this.equal(JSON.stringify(actual), JSON.stringify(expected)); },
  };
  const path = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/directional-navigation";
  const browser = page.context().browser();
  const results = [];
  const errors = [];
  const prohibitedRequests = [];
  const order = ["calendar", "home", "tasks", "classes", "goals", "notes", "settings"];
  async function finish(p) {
    await p.evaluate(async () => {
      const animations = [...document.querySelectorAll(".view")].flatMap(v => v.getAnimations());
      animations.forEach(a => a.finish());
      await Promise.allSettled(animations.map(a => a.finished));
    });
  }
  async function measure(p, expected) {
    const values = await p.evaluate(async () => {
      const view = document.querySelector(".view.active");
      const animation = view.getAnimations()[0];
      if (!animation) return { direction: view.dataset.viewMotion, samples: [] };
      animation.pause();
      const samples = [];
      for (const time of [0, 120, 480]) {
        animation.currentTime = time;
        await new Promise(requestAnimationFrame);
        const style = getComputedStyle(view);
        samples.push({ top: view.getBoundingClientRect().top, opacity: Number(style.opacity) });
      }
      return { direction: view.dataset.viewMotion, samples, focus: document.activeElement.dataset.view, active: document.querySelectorAll(".view.active").length };
    });
    assert.equal(values.direction, expected);
    assert.equal(values.active, 1);
    assert.equal(values.samples[0].opacity, 0);
    assert.equal(values.samples[2].opacity, 1);
    const [a,b,c] = values.samples.map(s => s.top);
    assert.ok(expected === "down" ? a < b && b < c : a > b && b > c, JSON.stringify(values));
    await finish(p);
    assert.equal(await p.locator("[data-view-motion]").count(), 0);
    return values;
  }

  for (const width of [1280, 835, 390, 320]) {
    for (const reduced of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height: 820 }, hasTouch: width <= 700, isMobile: width <= 700, serviceWorkers: "block", reducedMotion: reduced ? "reduce" : "no-preference" });
      try {
        await context.route("**/*", route => {
          const url = new URL(route.request().url());
          if (url.origin !== "http://127.0.0.1:8034" || url.pathname.startsWith("/api/")) { prohibitedRequests.push(url.href); return route.abort(); }
          return route.continue();
        });
        const p = await context.newPage();
        p.on("pageerror", e => errors.push(e.message));
        await p.goto("http://127.0.0.1:8034/#calendar");
        await p.waitForFunction(() => document.body.dataset.view === "calendar");
        assert.equal(await p.locator("[data-view-motion]").count(), 0, "Startup is immediate");
        const selector = width > 700 ? ".sidebar" : ".phone-bottom-nav";
        const visit = async (name) => p.locator(`${selector} .nav-item[data-view="${name}"]`).click();
        await visit("tasks");
        assert.equal(await p.evaluate(() => location.hash), "#tasks", "Route commits before animation finishes");
        if (reduced) assert.equal(await p.locator("[data-view-motion]").count(), 0);
        else await measure(p, "down");
        await visit("calendar");
        if (reduced) assert.equal(await p.locator("[data-view-motion]").count(), 0);
        else await measure(p, "up");
        await visit("calendar");
        assert.equal(await p.locator("[data-view-motion]").count(), 0, "Same-route click never replays motion");

        if (width > 700 && !reduced) {
          for (let i = 1; i < order.length; i++) { await visit(order[i]); await measure(p, "down"); }
          for (let i = order.length - 2; i >= 0; i--) { await visit(order[i]); await measure(p, "up"); }
          // Real keyboard activation retains focus on the clicked navigation item.
          const tasks = p.locator('.sidebar .nav-item[data-view="tasks"]');
          await tasks.focus(); await tasks.press("Enter");
          assert.equal(await tasks.evaluate(el => el === document.activeElement), true, `Keyboard nav focus at ${width}px`);
          await measure(p, "down");
          // Interrupt in the same task, before old animation.finished callbacks run.
          await p.evaluate(() => {
            for (const name of ["calendar", "notes", "classes", "settings", "tasks", "home", "calendar"]) {
              document.querySelector(`.sidebar .nav-item[data-view="${name}"]`).click();
            }
          });
          assert.equal(await p.evaluate(() => document.body.dataset.view), "calendar");
          await measure(p, "up");
          await visit("home"); await finish(p);
          const shortcut = p.locator('#view-home [data-go="tasks"]').first();
          await shortcut.focus(); await shortcut.press("Enter");
          assert.equal(await p.evaluate(() => document.activeElement.id), "main-content", "Content shortcuts leave focus in the destination");
          await finish(p);
          await p.evaluate(() => { setView("settings"); document.querySelector('.sidebar .nav-item[data-view="notes"]').click(); });
          await p.emulateMedia({ reducedMotion: "reduce" });
          await p.waitForFunction(() => !document.querySelector("[data-view-motion]"));
          assert.equal(await p.locator("[data-view-motion]").count(), 0, "Preference change cancels a running slide");
          await p.emulateMedia({ reducedMotion: "no-preference" });
          await p.waitForTimeout(50);
          await p.evaluate(() => setView("calendar"));
          assert.equal(await p.locator("[data-view-motion]").count(), 0, "Programmatic routes stay immediate");
          await p.locator('.sidebar-rail-toggle').click();
          await p.waitForTimeout(500);
          await visit("tasks"); await measure(p, "down");
          await visit("calendar"); await finish(p);
        }

        if (width <= 700 && !reduced) {
          // Enter Calendar then open the fixed Tasks sheet before its slide ends.
          await visit("tasks"); await finish(p); await visit("calendar");
          const summary = p.locator(".phone-task-summary");
          const box = await summary.boundingBox();
          await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
          assert.equal(await p.locator("[data-view-motion]").count(), 0, "Content pointer settles popup anchors first");
          await p.waitForTimeout(400);
          assert.equal(await p.evaluate(() => document.body.classList.contains("task-panel-open")), true, `Phone Tasks sheet opens at ${width}px`);
          await p.keyboard.press("Escape");
          await p.waitForTimeout(400);
        }
        await finish(p);
        const settled = await p.evaluate(() => ({
          transform: getComputedStyle(document.querySelector(".view.active")).transform,
          overflow: document.documentElement.scrollWidth > innerWidth,
          active: document.querySelectorAll(".view.active").length,
        }));
        assert.equal(settled.transform, "none"); assert.equal(settled.overflow, false); assert.equal(settled.active, 1);
        results.push({ width, reduced, passed: true });
        if (!reduced) await p.screenshot({ path: `${path}/navigation-${width}.png` });
      } finally { await context.close(); }
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(prohibitedRequests, []);
  return { results, errors, prohibitedRequests };
}
