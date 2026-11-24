async page => {
  const results = [];
  const base = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/launcher-transitions-20261124/";
  for (const width of [1280, 390]) {
    const context = await page.context().browser().newContext({ viewport: { width, height: 950 }, hasTouch: width === 390, isMobile: width === 390, reducedMotion: "no-preference", serviceWorkers: "block" });
    await context.addInitScript(() => {
      window.motionCalls = [];
      const animate = Element.prototype.animate;
      Element.prototype.animate = function(frames, options) {
        if (this.matches('dialog,.library-template-menu,.popup-morph-tile')) window.motionCalls.push({ className: this.className, open: this.open, frames, options });
        return animate.call(this, frames, options);
      };
    });
    const p = await context.newPage(); p.setDefaultTimeout(8000);
    const errors = []; p.on("pageerror", e => errors.push(e.message));
    const activate = element => width === 390 ? element.tap() : element.click();
    const route = async view => { await p.locator(`.primary-nav [data-view="${view}"]`).evaluate(e => e.click()); await p.waitForTimeout(500); };
    const assert = (ok, message) => { if (!ok) throw Error(`${width}: ${message}`); };
    async function windowCheck(label, button, selector) {
      await p.evaluate(() => window.motionCalls = []);
      await activate(button);
      const popup = p.locator(selector);
      const motion = await popup.evaluate(e => ({
        open: e.open, morph: !!e.querySelector(".popup-morph-surface"),
        frames: e.getAnimations().filter(a => a.effect.target === e).flatMap(a => a.effect.getKeyframes().map(f => f.transform)),
        calls: window.motionCalls,
      }));
      assert(motion.open, `${label} opens`);
      assert(motion.morph || motion.calls.some(c => c.className === "popup-morph-tile") || motion.frames.concat(motion.calls.flatMap(c => c.frames.map(f => f.transform))).some(t => /translate\(/.test(t) && !t.includes("translate(0px, 0px) scale(1, 1)")), `${label} uses launcher geometry: ${JSON.stringify(motion)}`);
      await p.waitForTimeout(450);
      const bounds = await popup.boundingBox();
      assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y >= 0 && bounds.y + bounds.height <= 951, `${label} fits viewport`);
      await p.screenshot({ path: base + `${label}-${width}.png` });
      await p.keyboard.press("Escape");
      assert(await p.evaluate(() => window.motionCalls.some(c => c.open || c.className === "popup-morph-tile")), `${label} animates while mounted`);
      await popup.waitFor({ state: "hidden" });
      results.push({ width, label, status: "PASS", motion });
    }
    try {
      await p.goto("http://127.0.0.1:8799/?demo=completion-20261124-6#calendar");
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length === 8);
      if (width === 390 && await p.locator(".task-panel-close-button").isVisible()) await activate(p.locator(".task-panel-close-button"));
      await route("tasks");
      await windowCheck("add-task", p.locator("#open-task-modal"), "#task-modal");
      await route("classes");
      await windowCheck("add-class", p.locator("#open-task-modal"), ".personal-note-dialog[open]");
      await route("notes");
      await windowCheck("add-note", p.locator('[data-note-action="new"]'), ".personal-note-dialog[open]");
      await route("goals");
      await windowCheck("goal-choice", p.locator("#open-task-modal"), "#personal-goals-dialog");
      await windowCheck("add-goal", p.locator('[data-pg-action="add-goal"]'), "#personal-goals-dialog");
      await windowCheck("add-habit", p.locator('[data-pg-action="add-habit"]'), "#personal-goals-dialog");
      await route("tasks");
      await p.locator("#assignment-templates summary").click();
      await p.waitForTimeout(300);
      await windowCheck("new-template", p.locator('[data-library-action="new-template"]').filter({ visible: true }).first(), ".library-dialog[open]");
      await p.evaluate(async () => { await store.upsertTemplate({ id: "launcher-test-template", title: "Launcher test template", durationMinutes: 45, priority: "Medium", notes: "" }); });
      const trigger = p.locator('[data-library-action="template-menu"]').filter({ visible: true }).first();
      await activate(trigger);
      const menu = p.locator("#template-management-menu");
      const menuFrames = await menu.evaluate(e => e.getAnimations().flatMap(a => a.effect.getKeyframes().map(f => f.transform)));
      assert(menuFrames.some(t => /translate\(/.test(t)), "Template menu expands from trigger");
      await p.waitForTimeout(450);
      await p.screenshot({ path: base + `template-menu-${width}.png` });
      await p.keyboard.press("Escape");
      assert(await p.locator(".library-template-menu").evaluate(e => e.isConnected && e.dataset.popupMotion === "closing"), "Template menu waits for closing");
      await p.locator(".library-template-menu").waitFor({ state: "detached" });
      assert(await trigger.evaluate(e => document.activeElement === e), "Template menu restores focus");
      await activate(trigger); await p.waitForTimeout(40); await p.keyboard.press("Escape");
      await p.locator(".library-template-menu").waitFor({ state: "detached" });
      results.push({ width, label: "template-menu", status: "PASS", menuFrames, quickCancel: "PASS", focus: "PASS" });
      if (width === 390) await windowCheck("more-navigation", p.locator("#phone-more-button"), "#phone-more-dialog");
      assert(errors.length === 0, errors.join("; "));
    } finally { await context.close(); }
  }
  return { runtime: page.context().browser().version(), mode: "isolated local demo, real local template storage", results };
}
