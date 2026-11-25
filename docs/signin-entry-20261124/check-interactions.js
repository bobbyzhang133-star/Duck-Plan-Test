async page => {
  const browser = page.context().browser();
  const base = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/signin-entry-20261124/";
  const results = [];
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
  const p = await context.newPage();
  try {
    await p.goto("http://127.0.0.1:8788/#calendar");
    const avatar = p.locator(".profile-card .avatar");
    const before = await avatar.evaluate(e => getComputedStyle(e).backgroundColor);
    await avatar.hover(); await p.waitForTimeout(220);
    assert(before !== await avatar.evaluate(e => getComputedStyle(e).backgroundColor), "folded account hover is visible");
    const rect = await avatar.boundingBox();
    await p.mouse.move(rect.x + 22, rect.y + 22); await p.mouse.down(); await p.waitForTimeout(120);
    assert(await avatar.evaluate(e => getComputedStyle(e).transform !== "none"), "folded account press is visible");
    await p.mouse.up(); await p.waitForTimeout(340);
    const dialog = p.locator("#account-dialog");
    for (let index = 0; index < 14; index++) {
      await p.keyboard.press("Tab");
      assert(await dialog.evaluate(e => e.contains(document.activeElement)), "native dialog traps keyboard focus");
    }
    await p.keyboard.press("Escape");
    await p.evaluate(() => window.DuckAccountEntry.open(document.querySelector(".profile-card")));
    await p.waitForTimeout(350);
    assert(await dialog.evaluate(e => e.open && !e.inert), "rapid close/open reversal stays usable");
    await p.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
    await p.locator(".calendar-account-entry").focus(); await p.keyboard.press("Enter");
    await p.waitForTimeout(350);
    assert(await dialog.evaluate(e => e.open), "Enter opens account window");
    await p.locator("[data-close-account]").click(); await dialog.waitFor({ state: "hidden" });
    await p.evaluate(() => window.DuckAccountEntry.open(document.querySelector(".calendar-account-entry")));
    await p.waitForTimeout(50);
    await p.evaluate(() => document.querySelector("#account-dialog").getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 100; }));
    await p.screenshot({ path: base + "opening-frame-1440.png" });
    await p.evaluate(() => document.querySelector("#account-dialog").getAnimations().forEach(animation => animation.finish()));
    await p.waitForTimeout(50);
    await p.evaluate(() => window.DuckAccountEntry.close());
    await p.evaluate(() => document.querySelector("#account-dialog").getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 100; }));
    await p.screenshot({ path: base + "closing-frame-1440.png" });
    await p.evaluate(() => document.querySelector("#account-dialog").getAnimations().forEach(animation => animation.finish()));
    await dialog.waitFor({ state: "hidden" });
    results.push({ status: "PASS", mode: "mouse + keyboard", actions: ["folded icon hover", "held press", "keyboard focus trap", "Enter", "close-button dismissal", "rapid reversal", "rendered opening/closing frames paused at 100ms"] });
    await p.setViewportSize({ width: 390, height: 844 });
    await p.evaluate(() => document.documentElement.dataset.theme = "dark");
    await p.locator(".calendar-account-entry").click(); await p.waitForTimeout(350);
    await p.screenshot({ path: base + "account-dark-390.png" });
    await p.setViewportSize({ width: 390, height: 420 });
    await dialog.locator("#show-recover").scrollIntoViewIfNeeded();
    await dialog.locator("#show-recover").click(); await p.waitForTimeout(350);
    const email = dialog.locator('#recover-form [name="email"]');
    await email.evaluate(e => e.scrollIntoView({ block: "start" }));
    const close = await p.locator("[data-close-account]").boundingBox();
    const field = await email.boundingBox();
    const overlaps = close.x < field.x + field.width && close.x + close.width > field.x && close.y < field.y + field.height && close.y + close.height > field.y;
    const closeVisible = close.x >= 0 && close.y >= 0 && close.x + close.width <= 390 && close.y + close.height <= 420;
    await p.screenshot({ path: base + "recovery-keyboard-viewport-390.png" });
    results.push({ mode: "resized viewport 390x420; physical on-screen keyboard NOT RUN", status: overlaps || !closeVisible ? "FAIL" : "PASS", closeOverlapsField: overlaps, closeVisible, close, field });
  } catch (error) { results.push({ status: "FAIL", error: error.message }); }
  finally { await context.close(); }
  const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", serviceWorkers: "block" });
  const q = await reduced.newPage();
  try {
    await q.goto("http://127.0.0.1:8799/#calendar");
    await q.locator(".calendar-account-entry").click();
    assert(await q.locator("#account-dialog").evaluate(e => e.open && e.getAnimations().length === 0), "reduced motion opens without animation");
    assert(await q.locator(".connection-local-note").isVisible(), "static preview explains local-only mode");
    assert(await q.locator("#google-sign-in").isDisabled(), "static preview does not fake Google readiness");
    await q.keyboard.press("Escape"); await q.locator("#account-dialog").waitFor({ state: "hidden" });
    results.push({ mode: "static preview + reduced motion", status: "PASS", actions: ["instant accessible open/close", "local-only explanation", "disabled unconfigured Google method"] });
  } catch (error) { results.push({ mode: "reduced motion", status: "FAIL", error: error.message }); }
  finally { await reduced.close(); }
  return { runtime: browser.version(), results };
}
