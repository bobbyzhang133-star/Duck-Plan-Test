async page => {
  const base = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/signin-entry-20261124/";
  const results = [];
  const cases = globalThis.duckSigninLayoutCases || [[320,568,true],[390,844,true],[844,390,true],[1024,768,false],[1440,900,false]];
  for (const [width, height, touch] of cases) {
    const context = await page.context().browser().newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, serviceWorkers: "block" });
    const p = await context.newPage();
    p.setDefaultTimeout(7000);
    p.setDefaultNavigationTimeout(25000);
    const errors = [];
    p.on("pageerror", error => errors.push(error.message));
    await context.addInitScript(() => {
      window.accountMotionFrames = [];
      const animate = Element.prototype.animate;
      Element.prototype.animate = function(frames, options) {
        if (this.id === "account-dialog") window.accountMotionFrames.push({ frames, options, open: this.open });
        return animate.call(this, frames, options);
      };
    });
    const assert = (condition, label) => { if (!condition) throw Error(`${width}x${height}: ${label}`); };
    const activate = locator => touch ? locator.tap() : locator.click();
    try {
      await p.goto("http://127.0.0.1:8788/#calendar");
      await p.waitForFunction(() => typeof store !== "undefined" && store.configured);
      await p.getByRole("button", { name: "Week", exact: true }).click();
      const entry = p.locator(".calendar-account-entry");
      const bounds = await entry.boundingBox();
      assert(bounds && bounds.width >= 44 && bounds.height >= 44, "visible account touch target");
      assert(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0 && bounds.y + bounds.height <= height, "account entry fits");
      assert(await entry.innerText() === "Sign in", "explicit signed-out label");
      await p.screenshot({ path: base + `calendar-${width}x${height}.png` });
      await activate(entry);
      const dialog = p.locator("#account-dialog");
      await p.waitForFunction(() => document.querySelector("#account-dialog").open && !document.querySelector("#account-dialog").dataset.popupMotion);
      const box = await dialog.boundingBox();
      assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, "dialog fits");
      assert(await p.locator("#account-dialog #account-settings").count() === 1, "existing forms moved into dialog");
      assert(await p.locator("#account-settings").count() === 1, "one account form root");
      assert(await dialog.locator("#google-sign-in").isVisible(), "Google method visible");
      assert(await dialog.locator("#google-sign-in").isDisabled(), "local backend Google readiness is honest");
      const focusInside = await dialog.evaluate(e => e.contains(document.activeElement));
      assert(focusInside, "focus moves into account window");
      const openMotion = await p.evaluate(() => window.accountMotionFrames[0]);
      assert(openMotion.frames.some(frame => /translate\(/.test(frame.transform) && !frame.transform.includes("translate(0px, 0px) scale(1, 1)")), "opening uses launcher geometry");
      await p.screenshot({ path: base + `account-${width}x${height}.png` });
      await activate(dialog.locator('[data-account-mode="sign-up"]'));
      await p.waitForTimeout(320);
      assert(await dialog.locator("#sign-up-form").isVisible(), "create-account panel opens");
      await activate(dialog.locator('[data-account-mode="sign-in"]'));
      await p.waitForTimeout(320);
      await dialog.locator("#show-recover").scrollIntoViewIfNeeded();
      await activate(dialog.locator("#show-recover"));
      await p.waitForTimeout(320);
      assert(await dialog.locator("#recover-form").isVisible(), "recovery panel opens");
      await dialog.locator("#show-sign-in").scrollIntoViewIfNeeded();
      await activate(dialog.locator("#show-sign-in"));
      await p.waitForTimeout(320);
      await p.keyboard.press("Escape");
      assert(await dialog.evaluate(e => e.open && e.dataset.popupMotion === "closing"), "closing stays mounted during motion");
      await dialog.waitFor({ state: "hidden" });
      assert(await p.locator("#view-settings #account-settings").count() === 1, "forms restored to Settings");
      assert(await entry.evaluate(e => document.activeElement === e), "focus returns to launcher");
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no page overflow");
      if (!touch) {
        const avatar = p.locator(".profile-card .avatar");
        assert(await avatar.isVisible(), "folded sidebar retains account shortcut");
        await avatar.click();
        await p.waitForTimeout(320);
        assert(await dialog.evaluate(e => e.open), "folded sidebar account opens");
        await p.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        await p.locator(".sidebar-rail-toggle").click();
        await p.waitForTimeout(420);
        await p.screenshot({ path: base + `sidebar-${width}x${height}.png` });
        await p.locator(".profile-card").click();
        await p.waitForTimeout(320);
        assert(await dialog.evaluate(e => e.open), "expanded sidebar account opens");
        await p.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
      }
      await p.evaluate(() => setView("home"));
      await p.waitForTimeout(500);
      const headerEntry = p.locator(".topbar-title .account-entry");
      assert(await headerEntry.isVisible(), "other pages retain header entry");
      await activate(headerEntry);
      await p.waitForTimeout(320);
      assert(await dialog.evaluate(e => e.open), "header entry opens account");
      await p.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      await p.screenshot({ path: base + `dashboard-${width}x${height}.png` });
      assert(errors.length === 0, errors.join("; "));
      results.push({ viewport: `${width}x${height}`, input: touch ? "emulated touch + keyboard" : "mouse + keyboard", status: "PASS", entry: bounds, dialog: box, launcherMotion: "open + close", forms: "sign in, create account, recovery", focus: "PASS" });
    } catch (error) {
      await p.screenshot({ path: base + `failure-${width}x${height}.png` });
      results.push({ viewport: `${width}x${height}`, status: "FAIL", error: error.message, pageErrors: errors });
    } finally { await context.close(); }
  }
  return { runtime: page.context().browser().version(), origin: "http://127.0.0.1:8788", mode: "signed out, actual isolated local Worker/D1", results };
}
