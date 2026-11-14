// Normal-speed proof; held geometry samples live in qa.js, not this recording.
async (page) => {
  const browser = page.context().browser(), out = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/independent-divider/";
  const c = await browser.newContext({ viewport: { width: 835, height: 746 }, serviceWorkers: "block", recordVideo: { dir: out + "raw-video", size: { width: 835, height: 746 } } });
  const errors = [], failed = [], cases = []; let video;
  try {
    await c.route("**/*", r => { const u = new URL(r.request().url()); return u.origin === "http://127.0.0.1:8034" && !u.pathname.startsWith("/api/") ? r.continue() : r.abort(); });
    const p = await c.newPage(); video = p.video(); p.setDefaultTimeout(5000); p.setDefaultNavigationTimeout(10000);
    p.on("pageerror", e => errors.push(e.message)); p.on("requestfailed", r => failed.push(new URL(r.url()).pathname));
    await p.goto("http://127.0.0.1:8034/?qa=independent-divider-playback#calendar"); await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length > 0);
    for (const route of ["home", "tasks", "home"]) {
      await p.locator(`.sidebar [data-view="${route}"]`).click(); await p.waitForFunction(() => document.documentElement.dataset.pageTransitionPhase === "animate");
      const sample = await p.evaluate(() => ({ direction: document.documentElement.dataset.pageTransition, roots: document.getAnimations().filter(a => a.id.startsWith("duck-route-live") && a.id.endsWith("move")).map(a => ({ id: a.id, target: a.effect.target.className })) }));
      await p.waitForFunction(() => !document.documentElement.dataset.pageTransition); cases.push({ route, ...sample });
    }
    await p.screenshot({ path: out + "dashboard-settled-835.png" });
  } finally { await c.close(); }
  if (video) await video.saveAs(out + "independent-divider-835.webm");
  return { runtime: browser.version(), cases, errors, failed, file: "independent-divider-835.webm", allSyntheticContextsClosed: true, scope: "Normal unpaused Chromium fixture playback, not a performance measurement" };
}
