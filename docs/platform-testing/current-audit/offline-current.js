// Current-cache replay of docs/contextual-add/offline-qa.js. Fresh Chromium browser tab, not an installed PWA. No account/API operations.
async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, timezoneId: "America/Los_Angeles", reducedMotion: "reduce", hasTouch: true, isMobile: true });
  const target = await context.newPage();
  target.setDefaultTimeout(5000); target.setDefaultNavigationTimeout(10000);
  await context.route("**/*", route => { const url=new URL(route.request().url()); return url.origin === "http://127.0.0.1:8034" && !url.pathname.startsWith("/api/") ? route.continue() : route.abort(); });
  const errors = [];
  target.on("pageerror", error => errors.push(error.message));
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  try {
    await target.goto("http://127.0.0.1:8034/?qa=personal-offline#notes");
    await target.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error("Service worker readiness timeout")), 10000))]));
    await target.waitForFunction(() => Boolean(navigator.serviceWorker.controller), {}, { timeout: 10000 });
    const cache = await target.evaluate(async () => {
      const name = "duckplan-app-motion-preview-v38";
      const cache = await caches.open(name);
      const assets = ["personal-notes.js", "personal-notes.css", "personal-goals.js", "personal-goals.css", "planner-store.js"];
      const entries = await Promise.all(assets.map(asset => cache.match(new URL(asset, location.href))));
      return { name, allAssets: entries.every(Boolean), guardedStore: Boolean(entries[4] && (await entries[4].text()).includes("createSynchronization")) };
    });
    check(cache.allAssets && cache.guardedStore, "Current offline assets were not precached");
    await context.setOffline(true);
    await target.reload();
    await target.locator("#open-task-modal").click();
    await target.locator('.personal-note-dialog [name="title"]').fill("Offline study note");
    await target.locator('.personal-note-dialog [name="body"]').fill("Saved locally while the network is unavailable.");
    await target.locator(".personal-note-dialog").getByRole("button", { name: "Save note", exact: true }).click();
    await target.locator(".personal-note-dialog").waitFor({ state: "detached" });

    await target.evaluate(() => setView("goals"));
    await target.locator("#open-task-modal").click();
    await target.locator('[data-pg-choice="habit"]').click();
    await target.locator('.pg-dialog [name="title"]').fill("Read a page offline");
    await target.locator(".pg-dialog").getByRole("button", { name: "Save habit", exact: true }).click();
    await target.locator(".pg-dialog").waitFor({ state: "detached" });
    const today = await target.evaluate(() => nowKey());
    await target.locator(`[data-pg-action="checkin"][data-pg-date="${today}"]`).click();

    await target.locator("#open-task-modal").click();
    await target.locator('[data-pg-choice="goal"]').click();
    await target.locator('.pg-dialog [name="title"]').fill("Finish three chapters");
    await target.locator('.pg-dialog [name="targetCount"]').fill("3");
    await target.locator('.pg-dialog [name="currentCount"]').fill("1");
    await target.locator('.pg-dialog [name="unit"]').fill("chapters");
    await target.locator(".pg-dialog").getByRole("button", { name: "Save goal", exact: true }).click();
    await target.locator(".pg-dialog").waitFor({ state: "detached" });
    await target.reload();
    await target.getByRole("heading", { name: "Finish three chapters", exact: true }).waitFor();
    const saved = await target.evaluate(() => ({
      mode: store.mode,
      counts: [store.listGoals().length, store.listHabits().length, store.listHabitCheckins().length, store.listNotes().length],
      goalProgress: store.listGoals()[0]?.currentCount, noteBody: store.listNotes()[0]?.body,
      tasks: store.listItems().length, overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    check(saved.mode === "local" && saved.counts.every(count => count === 1), "Offline personal records did not survive reload");
    check(saved.goalProgress === 1 && saved.tasks === 7 && !saved.overflow && errors.length === 0, "Offline UI or task separation failed");
    await target.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
    await target.screenshot({ path: "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/platform-testing/current-audit/offline-current-390.png", fullPage: true });
    return { runtime:await page.context().browser().version(), cache, offlineCrudAndReload: true, saved, pageErrors: errors, surface:"fresh Chromium browser tab with service worker and touch emulation; not installed PWA", productionWrites:false };
  } finally {
    await context.close();
  }
}
