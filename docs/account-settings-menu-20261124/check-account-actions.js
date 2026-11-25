async page => {
  const base = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/account-settings-menu-20261124/";
  const results = [];
  for (const width of [390, 1440]) {
    const context = await page.context().browser().newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, hasTouch: width === 390, isMobile: width === 390, serviceWorkers: "block" });
    const p = await context.newPage(); p.setDefaultTimeout(9000);
    const assert = (condition, label) => { if (!condition) throw Error(`${width}: ${label}`); };
    let password;
    const email = `student-with-a-long-account-name-${Date.now()}-${width}@example.test`;
    try {
      await p.goto("http://127.0.0.1:8788/#calendar");
      password = "Local-test!" + await p.evaluate(() => crypto.randomUUID());
      await p.waitForFunction(() => typeof store !== "undefined" && store.configured);
      await p.locator(".calendar-account-entry").click();
      await p.locator('[data-account-menu-action="sign-in"]').click();
      await p.waitForTimeout(320);
      await p.locator('#sign-in-form [name="email"]').fill(email);
      await p.locator('#sign-in-form [name="password"]').fill(password);
      await p.locator('#sign-in-form button[type="submit"]').click();
      await p.locator(".account-dialog .connection-feedback").waitFor({ state: "visible" });
      assert((await p.locator(".account-dialog .connection-feedback").innerText()).includes("don't match"), "real backend login error is visible");
      await p.screenshot({ path: base + `signin-error-${width}.png` });

      await p.locator('[data-account-mode="sign-up"]').click();
      await p.waitForTimeout(320);
      await p.locator('#sign-up-form [name="email"]').fill(email);
      await p.locator('#sign-up-form [name="password"]').fill(password);
      await p.locator('#sign-up-form button[type="submit"]').click();
      await p.waitForFunction(expected => store.user?.email === expected, email);
      await p.locator("#dismiss-recovery").click();
      const expectedName = email.split("@")[0];
      assert(await p.locator("#profile-name").innerText() === expectedName, "sidebar name follows authenticated account");
      assert(await p.locator('.calendar-account-entry [data-account-label]').textContent() === expectedName, "toolbar name follows authenticated account");
      assert((await p.locator('.calendar-account-entry').getAttribute('aria-label')).includes(expectedName), "full long name remains accessible");
      await p.screenshot({ path: base + `signed-in-${width}.png` });
      await p.keyboard.press("Escape");
      await p.locator("#account-dialog").waitFor({ state: "hidden" });
      await p.screenshot({ path: base + `signed-in-toolbar-${width}.png` });
      await p.reload();
      await p.waitForFunction(expected => store.user?.email === expected, email);
      assert(await p.locator('.calendar-account-entry').getAttribute('data-signed-in') === 'true', "real session survives reload");

      await p.locator(".calendar-account-entry").click();
      await p.waitForFunction(()=>!document.querySelector('#account-menu').dataset.popupMotion);
      assert(await p.locator('#account-menu-name').textContent() === expectedName, 'menu follows current name');
      assert(await p.locator('#account-menu-status').textContent() === email, 'menu follows current email');
      assert(await p.locator('#account-menu-sign-in-label').textContent() === 'Your account', 'signed-in menu action');
      await p.screenshot({path:base+`signed-in-menu-${width}.png`});
      await p.locator('[data-account-menu-action="sign-in"]').click();
      await p.waitForTimeout(480);
      await p.locator("#sign-out").click();
      await p.waitForFunction(() => !store.user && store.mode === "local");
      assert(await p.locator("#profile-name").innerText() === "Account", "sign-out clears previous identity");
      await p.locator('#sign-in-form [name="email"]').fill(email);
      await p.locator('#sign-in-form [name="password"]').fill(password);
      await p.locator('#sign-in-form button[type="submit"]').click();
      await p.waitForFunction(expected => store.user?.email === expected, email);
      await p.keyboard.press("Escape");
      await p.locator("#account-dialog").waitFor({ state: "hidden" });
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "long account name does not overflow");
      results.push({ width, mode: "real isolated local Worker/D1", status: "PASS", actions: ["invalid password feedback", "create account in moved form", "matching account name", "long-name layout", "session after refresh", "sign out", "email sign in"] });
    } catch (error) {
      results.push({ width, status: "FAIL", error: error.message });
    } finally { await context.close(); }
  }

  // Provider readiness is the only stub: this checks the moved Google button's
  // existing navigation handler, not Google's authentication or a real token exchange.
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const p = await context.newPage();
  try {
    await p.route("**/api/session", async route => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({ response, json: { ...body, providers: { ...body.providers, google: true } } });
    });
    let reached = false;
    await p.route("**/api/auth/google?**", async route => { reached = true; await route.fulfill({ contentType: "text/html", body: "<h1>Provider navigation test</h1>" }); });
    await p.goto("http://127.0.0.1:8788/#calendar");
    await p.waitForFunction(() => store.providers.google);
    await p.locator(".calendar-account-entry").click();
      await p.locator('[data-account-menu-action="sign-in"]').click();
    await p.waitForTimeout(320);
    await p.locator("#google-sign-in").click();
    await p.getByRole("heading", { name: "Provider navigation test" }).waitFor();
    if (!reached) throw Error("Google handler did not reach the existing endpoint");
    results.push({ mode: "stubbed Google readiness and navigation destination", status: "PASS", action: "moved Google button reaches existing sign-in endpoint", realGoogleOAuth: "NOT RUN" });
  } catch (error) { results.push({ mode: "Google button routing", status: "FAIL", error: error.message }); }
  finally { await context.close(); }
  return { runtime: page.context().browser().version(), results };
}
