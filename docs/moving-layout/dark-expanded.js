// Targeted dark/expanded layout sampling; isolated local fixture only.
async (page) => {
  const c = await page.context().browser().newContext({ viewport: { width: 835, height: 746 }, serviceWorkers: "block" }), errors = [];
  try {
    await c.route("**/*", r => { const u = new URL(r.request().url()); return u.origin === "http://127.0.0.1:8034" && !u.pathname.startsWith("/api/") ? r.continue() : r.abort(); });
    const p = await c.newPage(); p.setDefaultTimeout(5000); p.on("pageerror", e => errors.push(e.message));
    await p.goto("http://127.0.0.1:8034/?qa=moving-layout-dark-expanded#calendar", { timeout: 10000 }); await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length > 0);
    await p.evaluate(() => document.documentElement.dataset.theme = "dark"); await p.locator(".sidebar-rail-toggle").click(); await p.waitForFunction(() => !document.querySelector(".unified-shell").getAnimations().some(a => a.playState === "running"));
    await p.locator('.sidebar [data-view="home"]').click(); await p.waitForFunction(() => document.documentElement.dataset.pageTransitionPhase === "animate");
    const result = await p.evaluate(async () => {
      document.getAnimations().filter(a => a.id.startsWith("duck-route-live") || /duck-(workspace|route-)/.test(a.effect?.pseudoElement || "")).forEach(a => { a.pause(); a.currentTime = 320; }); await new Promise(requestAnimationFrame);
      const h = document.querySelector(".compact-topbar"), v = document.querySelector(".view.active"), hs = getComputedStyle(h);
      return { theme: document.documentElement.dataset.theme, expanded: document.body.classList.contains("sidebar-open"), headerY: new DOMMatrixReadOnly(hs.transform).m42, bodyY: new DOMMatrixReadOnly(getComputedStyle(v).transform).m42, lineColor: hs.borderBottomColor, lineY: h.getBoundingClientRect().bottom - .5, mainWidth: document.querySelector(".workspace").getBoundingClientRect().width, rootCount: document.getAnimations().filter(a => a.id.startsWith("duck-route-live") && a.id.endsWith("move")).length, horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
    });
    await p.screenshot({ path: "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/moving-layout/dark-expanded-bounce-835.png" });
    await p.evaluate(() => document.getAnimations().filter(a => a.id.startsWith("duck-route-live") || /duck-(workspace|route-)/.test(a.effect?.pseudoElement || "")).forEach(a => a.finish())); await p.waitForFunction(() => !document.documentElement.dataset.pageTransition);
    return { runtime: page.context().browser().version(), result, errors, allSyntheticContextsClosed: true };
  } finally { await c.close(); }
}
