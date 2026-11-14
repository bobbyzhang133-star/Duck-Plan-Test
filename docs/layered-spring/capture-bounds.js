// Focused actual capture geometry checks for oversized local Tasks/Settings.
async (page) => {
  const browser = page.context().browser(), origin = "http://127.0.0.1:8034", contexts = new Set(), cases = [], pageErrors = [], blocked = [];
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  try {
    for (const width of [1280, 835]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" }); contexts.add(context);
      await context.route("**/*", route => { const u = new URL(route.request().url()); if (u.origin !== origin || u.pathname.startsWith("/api/")) { blocked.push(u.origin + u.pathname); return route.abort(); } return route.continue(); });
      await context.addInitScript(() => {
        window.__boundsQA = [];
        const native = document.startViewTransition.bind(document);
        document.startViewTransition = update => {
          const transition = native(update); window.__boundsQA.push(transition);
          transition.ready.then(() => document.getAnimations().filter(a => /duck-(workspace|route-)/.test(a.effect?.pseudoElement || "")).forEach(a => a.pause()), () => {});
          return transition;
        };
      });
      try {
        const p = await context.newPage(); p.setDefaultTimeout(5000); p.setDefaultNavigationTimeout(10000); p.on("pageerror", error => pageErrors.push(error.message));
        await p.goto(`${origin}/?qa=layered-capture-bounds-${width}#calendar`);
        await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length > 0, null, { timeout: 5000 });
        await p.evaluate(async () => { for (let i = 0; i < 24; i++) await store.upsertItem({ id: `bounds-${i}`, title: `Long isolated task ${i}: draft an extended response and review the assignment carefully`, classId: null, type: "task", priority: "Medium", dueDate: "2026-11-15", durationMinutes: 45, completed: false, schemaVersion: 2 }); });
        for (const route of ["tasks", "settings", "calendar"]) {
          await p.locator(`.sidebar .nav-item[data-view="${route}"]`).click();
          await p.waitForFunction(() => document.documentElement.dataset.pageTransitionPhase === "animate", null, { timeout: 5000 });
          const captured = await p.evaluate(() => {
            const root = document.documentElement, w = document.querySelector(".workspace").getBoundingClientRect();
            const animations = document.getAnimations().filter(a => /duck-(workspace|route-)/.test(a.effect?.pseudoElement || ""));
            const names = [...new Set(animations.map(a => a.effect.pseudoElement.match(/\(([^)]+)\)/)?.[1]).filter(Boolean))];
            const groups = names.map(name => { const s = getComputedStyle(root, `::view-transition-group(${name})`); return { name, width: parseFloat(s.width), height: parseFloat(s.height), transform: s.transform }; });
            const named = [...document.querySelectorAll("[style]")].filter(e => e.style.viewTransitionName.startsWith("duck-route-new-")).map(e => ({ name: e.style.viewTransitionName, tag: e.id || e.className, rect: e.getBoundingClientRect().toJSON() }));
            const backing = getComputedStyle(root, "::view-transition-new(duck-workspace)");
            return { workspace: w.toJSON(), activeRoute: document.body.dataset.view, composition: root.dataset.pageTransitionComposition, contentMode: root.dataset.pageTransitionBacking, clip: getComputedStyle(root, "::view-transition").clipPath, groups, named, backing: { animationName: backing.animationName, duration: backing.animationDuration, delay: backing.animationDelay, timing: backing.animationTimingFunction, distance: backing.getPropertyValue("--route-enter-distance") }, routeRect: document.querySelector(`.view.active`).getBoundingClientRect().toJSON() };
          });
          check(captured.activeRoute === route && captured.composition === "layered", "Route failed under dense capture");
          check(captured.groups.every(g => g.width <= captured.workspace.width * 1.5 + 1 && g.height <= captured.workspace.height * 1.5 + 1), `A named snapshot was oversized: ${JSON.stringify(captured)}`);
          if (captured.routeRect.height > captured.workspace.height * 1.5) check(!captured.named.some(e => e.name.includes("content")), "Oversized route was independently captured");
          if (captured.routeRect.height > captured.workspace.height * 1.5) check(captured.contentMode === "content" && captured.backing.distance.trim() === "64px" && captured.backing.delay === "0.06s, 0.06s", "Oversized route lost its content spring fallback");
          cases.push({ width, route, ...captured });
          await p.evaluate(async () => { document.getAnimations().filter(a => /duck-(workspace|route-)/.test(a.effect?.pseudoElement || "")).forEach(a => a.finish()); await window.__boundsQA.at(-1).finished; });
          await p.waitForFunction(() => !document.documentElement.dataset.pageTransition && ![...document.querySelectorAll("[style]")].some(e => e.style.viewTransitionName.startsWith("duck-route-")), null, { timeout: 5000 });
        }
      } finally { await context.close(); contexts.delete(context); }
    }
    check(!blocked.length && !pageErrors.length, "Unexpected external/API request or page error");
    return { runtime: browser.version(), mode: "isolated local dense-task fixture", cases, blocked, pageErrors, allSyntheticContextsClosed: true };
  } finally { for (const context of contexts) await context.close(); }
}
