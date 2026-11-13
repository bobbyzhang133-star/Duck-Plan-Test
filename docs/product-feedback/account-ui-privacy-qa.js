// Manual Playwright MCP regression. Run with browser_run_code_unsafe's filename input.
// Uses a new context and synthetic store owners/deferred results; no real auth or API calls.
async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const blocked = [];
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname.startsWith("/api/")) {
      blocked.push(url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  const testPage = await context.newPage();
  const pageErrors = [];
  testPage.on("pageerror", error => pageErrors.push(error.message));
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  try {
    await testPage.goto("http://127.0.0.1:8034/?v=account-ui-privacy-regression-20261112#settings");
    await testPage.waitForFunction(() => store.mode === "local" && store.listItems().length > 0);
    await testPage.evaluate(async () => {
      const q = window.__accountUIQA = { mode: "cloud", user: { id: "synthetic-owner-A", name: "Synthetic A", email: "synthetic-a@example.test", hasPassword: true }, axis: [], imports: [] };
      q.changeOwner = async id => {
        q.mode = id ? "cloud" : "local";
        q.user = id ? { id: `synthetic-owner-${id}`, name: `Synthetic ${id}`, email: `synthetic-${id.toLowerCase()}@example.test`, hasPassword: true } : null;
        await store.resetLocalDemo();
      };
      q.finishCurrent = () => {
        for (const request of q.axis.filter(item => item.owner === q.user?.id)) request.resolve({ connected: false, lastSyncedAt: null, lastError: null });
        for (const request of q.imports.filter(item => item.owner === q.user?.id)) request.resolve(0);
      };
      for (const [name, get] of [["mode", () => q.mode], ["user", () => q.user], ["configured", () => true]]) Object.defineProperty(store, name, { get, configurable: true });
      store.axisStatus = () => q.mode !== "cloud" ? Promise.resolve({ connected: false, lastSyncedAt: null, lastError: null }) : new Promise((resolve, reject) => q.axis.push({ owner: q.user.id, resolve, reject }));
      store.localImportOffer = () => q.mode !== "cloud" ? Promise.resolve(0) : new Promise((resolve, reject) => q.imports.push({ owner: q.user.id, resolve, reject }));
      window.DuckTaskAlarms.refresh = async () => {};
      await store.resetLocalDemo();
      q.axis[0].resolve({ connected: true, lastSyncedAt: new Date().toISOString(), lastError: "Synthetic A sync detail" });
      q.imports[0].resolve(13);
    });
    await testPage.waitForSelector("#axis-disconnect");
    await testPage.waitForSelector("#import-local");
    await testPage.evaluate(() => {
      const q = __accountUIQA;
      q.code = crypto.randomUUID();
      showRecoveryCode(q.code);
      setAccountMode("change-password");
      q.oldRefresh = refreshAccountState();
      openModal({ draft: { title: "Synthetic A private draft", notes: "Synthetic A private notes" }, dueDate: "" });
    });
    check(await testPage.locator("#recovery-row").count() === 1, "Synthetic recovery baseline was not displayed");
    await testPage.evaluate(() => __accountUIQA.changeOwner("B"));
    const immediateClear = await testPage.evaluate(() => !document.querySelector("#recovery-row") && !document.querySelector("#password-form") && !document.querySelector("#import-local") && !axisStatus.connected && accountMode === null && !els.modal.open && els.form.elements.title.value === "");
    check(immediateClear, "Owner switch retained old account UI or task draft");
    await testPage.evaluate(async () => {
      const q = __accountUIQA;
      q.finishCurrent();
      q.axis[1].resolve({ connected: true, lastSyncedAt: new Date().toISOString(), lastError: "Synthetic A stale sync detail" });
      q.imports[1].resolve(99);
      await q.oldRefresh;
    });
    const oldRefreshIgnored = await testPage.evaluate(() => !document.body.textContent.includes(__accountUIQA.code) && !document.querySelector("#recovery-row") && !document.querySelector("#password-form") && !document.querySelector("#import-local") && !axisStatus.connected && localImportCount === 0 && !document.querySelector("#axis-settings").textContent.includes("Synthetic A"));
    check(oldRefreshIgnored, "Delayed old Axis/import result restored previous-owner UI");

    await testPage.locator("#show-recovery-code").click();
    await testPage.locator('#recovery-code-form [name="password"]').evaluate(input => { input.value = crypto.randomUUID(); });
    await testPage.evaluate(() => { store.newRecoveryCode = () => new Promise(resolve => { __accountUIQA.resolveRecovery = resolve; }); });
    await testPage.locator('#recovery-code-form button[type="submit"]').click();
    await testPage.evaluate(async () => {
      const q = __accountUIQA;
      await q.changeOwner("C");
      q.finishCurrent();
      q.lateCode = crypto.randomUUID();
      q.resolveRecovery(q.lateCode);
    });
    await testPage.waitForTimeout(30);
    const lateRecoveryIgnored = await testPage.evaluate(() => store.user.id === "synthetic-owner-C" && !document.querySelector("#recovery-row") && !document.body.textContent.includes(__accountUIQA.lateCode));
    check(lateRecoveryIgnored, "Delayed recovery-code action displayed a previous-owner code");

    await testPage.locator("#show-change-password").click();
    await testPage.locator('#password-form input[type="password"]').evaluateAll(inputs => inputs.forEach(input => { input.value = crypto.randomUUID(); }));
    await testPage.evaluate(() => { store.changePassword = () => new Promise(resolve => { __accountUIQA.resolvePassword = resolve; }); });
    await testPage.locator('#password-form button[type="submit"]').click();
    await testPage.evaluate(async () => {
      const q = __accountUIQA;
      await q.changeOwner("D"); q.finishCurrent();
      await q.changeOwner("C"); q.finishCurrent();
      q.latePasswordCode = crypto.randomUUID();
      q.resolvePassword(q.latePasswordCode);
    });
    await testPage.waitForTimeout(30);
    const returnedOwnerGuarded = await testPage.evaluate(() => store.user.id === "synthetic-owner-C" && !document.querySelector("#recovery-row") && !document.body.textContent.includes(__accountUIQA.latePasswordCode) && accountMode === null);
    check(returnedOwnerGuarded, "An old password result leaked after leaving and returning to the same owner");

    await testPage.evaluate(async () => {
      const q = __accountUIQA;
      const first = refreshAccountState();
      const oldAxis = q.axis.at(-1), oldImport = q.imports.at(-1);
      const second = refreshAccountState();
      q.axis.at(-1).resolve({ connected: false, lastSyncedAt: null, lastError: null });
      q.imports.at(-1).resolve(0);
      await second;
      oldAxis.resolve({ connected: true, lastSyncedAt: new Date().toISOString(), lastError: "Synthetic stale same-owner detail" });
      oldImport.resolve(777);
      await first;
    });
    const newerRefreshWins = await testPage.evaluate(() => !axisStatus.connected && localImportCount === 0 && !document.querySelector("#import-local"));
    check(newerRefreshWins, "Older same-owner refresh replaced newer account state");
    await testPage.evaluate(() => __accountUIQA.changeOwner(null));
    await testPage.waitForSelector("#sign-in-form");
    const localReset = await testPage.evaluate(() => accountMode === "sign-in" && !shownRecoveryCode && !axisStatus.connected && localImportCount === 0 && !document.querySelector("#recovery-row"));
    check(localReset, "Cloud-to-local switch retained old account UI");
    check(blocked.length === 0, "Harness attempted a nonlocal or API request");
    check(pageErrors.length === 0, "Page errors occurred during account privacy regression");
    return { syntheticOnly: true, immediateClear, oldRefreshIgnored, lateRecoveryIgnored, returnedOwnerGuarded, newerRefreshWins, localReset, realAuthRequests: 0, pageErrors };
  } finally {
    await context.close();
  }
}
