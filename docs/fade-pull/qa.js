// Isolated browser QA for short directional fade/pull navigation.
// Real browser snapshots; no user tabs/storage, hosted accounts or API writes.
async (page) => {
  const browser = page.context().browser(), origin = "http://127.0.0.1:8034";
  const output = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/fade-pull/";
  const cases = [], pageErrors = [], blocked = [];
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const same = (a, b) => ["x", "y", "width", "height"].every(k => Math.abs(a[k] - b[k]) < 1);
  const contexts = new Set();
  const deadline = (promise, label) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(label)), 5000))]);

  async function setup({ width = 1280, height = 900, touch = false, reduced = false, unsupported = false, fail = false, hold = true, variant = "balanced", video = false } = {}) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, reducedMotion: reduced ? "reduce" : "no-preference", serviceWorkers: "block", ...(video ? { recordVideo: { dir: output + "video", size: { width, height } } } : {}) });
    contexts.add(context);
    await context.route("**/*", route => { const u = new URL(route.request().url()); if (u.origin !== origin || u.pathname.startsWith("/api/")) { blocked.push(u.origin + u.pathname); return route.abort(); } return route.continue(); });
    await context.addInitScript(({ hold, unsupported, fail }) => {
      window.__fadeQA = { hold, calls: [] };
      const native = document.startViewTransition?.bind(document);
      if (unsupported) { document.startViewTransition = undefined; return; }
      if (fail) { document.startViewTransition = () => { throw new Error("Isolated snapshot failure"); }; return; }
      if (!native) return;
      document.startViewTransition = update => {
        const transition = native(update), call = { transition, frames: [], readyError: null };
        window.__fadeQA.calls.push(call);
        transition.ready.then(() => {
          const animations = document.getAnimations().filter(a => a.effect?.pseudoElement?.includes("duck-workspace"));
          if (window.__fadeQA.hold) { animations.forEach(a => a.pause()); return; }
          const start = performance.now();
          const trace = now => {
            if (!document.documentElement.dataset.pageTransition || call.frames.length >= 90) return;
            const style = kind => getComputedStyle(document.documentElement, `::view-transition-${kind}(duck-workspace)`);
            const matrix = kind => new DOMMatrixReadOnly(style(kind).transform);
            const old = matrix("old"), next = matrix("new");
            call.frames.push({ elapsed: now - start, oldY: old.m42, newY: next.m42, oldOpacity: Number(style("old").opacity), newOpacity: Number(style("new").opacity), oldScale: old.m11, newScale: next.m11, direction: document.documentElement.dataset.pageTransition });
            requestAnimationFrame(trace);
          };
          requestAnimationFrame(trace);
        }, error => { call.readyError = error.name; });
        return transition;
      };
    }, { hold, unsupported, fail });
    const p = await context.newPage();
    p.setDefaultTimeout(5000); p.setDefaultNavigationTimeout(10000);
    p.on("pageerror", e => pageErrors.push(e.message));
    await p.goto(`${origin}/?qa=fade-pull-${width}-${touch ? "touch" : "fine"}-${variant}#calendar`);
    await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length > 0 && document.body.dataset.view === "calendar", null, { timeout: 5000 });
    if (variant === "subtle") await p.addStyleTag({ content: ":root { --motion-route-out-distance: 12px; --motion-route-in-distance: 24px; --motion-route-duration: 320ms; }" });
    return { context, p, width, height, touch, variant };
  }
  async function close(context) { await context.close(); contexts.delete(context); }
  const rect = p => p.evaluate(() => { const nav = document.querySelector(innerWidth <= 700 ? ".phone-bottom-nav" : ".sidebar"); return { workspace: document.querySelector(".workspace").getBoundingClientRect().toJSON(), nav: nav.getBoundingClientRect().toJSON(), theme: document.documentElement.dataset.theme, sidebarDuration: getComputedStyle(document.documentElement).getPropertyValue("--motion-layout").trim() }; });
  const visit = (p, width, name) => p.locator(`${width <= 700 ? ".phone-bottom-nav" : ".sidebar"} .nav-item[data-view="${name}"]`).click();
  async function settle(p) {
    await p.evaluate(async () => {
      const call = window.__fadeQA.calls.at(-1);
      const timeout = promise => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("Native settlement timeout")), 5000))]);
      if (call) await timeout(call.transition.ready.catch(() => {}));
      document.getAnimations().filter(a => a.effect?.pseudoElement?.includes("duck-workspace")).forEach(a => a.finish());
      if (call) await timeout(call.transition.finished);
    });
    await p.waitForFunction(() => !document.documentElement.dataset.pageTransition && !document.getAnimations().some(a => a.effect?.pseudoElement?.includes("duck-workspace")), null, { timeout: 5000 });
  }
  async function sample(p, fraction) {
    await p.waitForFunction(() => document.documentElement.dataset.pageTransitionPhase === "animate", null, { timeout: 5000 });
    return p.evaluate(async fraction => {
      const root = document.documentElement, animations = document.getAnimations().filter(a => a.effect?.pseudoElement?.includes("duck-workspace"));
      const moving = animations.filter(a => /::view-transition-(old|new)/.test(a.effect.pseudoElement));
      if (moving.length < 2) throw new Error("Missing old/new native snapshot motion");
      const duration = Math.max(...moving.map(a => Number(a.effect.getTiming().duration)));
      animations.forEach(a => { a.pause(); a.currentTime = Math.min(Number(a.effect.getTiming().duration), duration * fraction); });
      await new Promise(requestAnimationFrame);
      const style = kind => getComputedStyle(root, `::view-transition-${kind}(duck-workspace)`);
      const matrix = kind => new DOMMatrixReadOnly(style(kind).transform);
      const old = matrix("old"), next = matrix("new"), group = style("group"), pair = style("image-pair");
      return { fraction, duration, direction: root.dataset.pageTransition, oldY: old.m42, newY: next.m42, oldX: old.m41, newX: next.m41, oldScale: old.m11, newScale: next.m11, oldOpacity: Number(style("old").opacity), newOpacity: Number(style("new").opacity), groupTransform: group.transform, groupOverflow: group.overflow, pairOverflow: pair.overflow, backing: pair.backgroundColor, live: document.querySelector(".workspace").getBoundingClientRect().toJSON(), activeViews: document.querySelectorAll(".view.active").length, taskForms: document.querySelectorAll("#task-form").length };
    }, fraction);
  }

  try {
    for (const [width, height] of [[1280, 900], [835, 835], [390, 844]]) {
      const f = await setup({ width, height });
      try {
        for (const [name, direction, sign] of [["tasks", "forward", -1], ["calendar", "back", 1]]) {
          const before = await rect(f.p);
          if (width === 1280 && name === "tasks") await f.p.screenshot({ path: output + "light-before.png" });
          await visit(f.p, width, name);
          const frames = [];
          for (const fraction of [0, .2, .4, .55, .7, .999]) {
            const s = await sample(f.p, fraction); frames.push(s);
            check(s.direction === direction && s.oldY * sign >= -.01 && s.newY * sign <= .01, `${width} ${name}: wrong direction`);
            check(Math.abs(s.oldY) <= 20.02 && Math.abs(s.newY) <= 32.02 && s.oldX === 0 && s.newX === 0, `${width} ${name}: travel is not bounded/vertical`);
            check(s.oldScale === 1 && s.newScale === 1, `${width} ${name}: unapproved scaling`);
            check(same(before.workspace, s.live) && s.groupOverflow === "hidden" && s.pairOverflow === "hidden", `${width} ${name}: viewport jumped`);
            check(s.activeViews === 1 && s.taskForms === 1, `${width} ${name}: duplicated live content`);
            if (fraction === .4) await f.p.screenshot({ path: `${output}held-${width}-${direction}.png` });
            if (width === 1280 && name === "tasks" && fraction === 0) await f.p.screenshot({ path: output + "light-held-start.png" });
          }
          check(frames[0].oldOpacity > .99 && frames[0].newOpacity < .01, "Invalid opening opacity");
          check(frames.at(-1).oldOpacity < .01 && frames.at(-1).newOpacity > .99, "Invalid final opacity");
          check(frames.some(s => s.oldOpacity > 0 && s.oldOpacity < 1 && s.newOpacity > 0 && s.newOpacity < 1), "No coordinated fade was painted");
          check(frames.every((s, i) => !i || s.oldOpacity <= frames[i - 1].oldOpacity + .001 && s.newOpacity >= frames[i - 1].newOpacity - .001), "Opacity reverses while settling");
          await settle(f.p); const after = await rect(f.p);
          if (width === 1280 && name === "tasks") await f.p.screenshot({ path: output + "light-after.png" });
          check(same(before.workspace, after.workspace) && same(before.nav, after.nav) && before.sidebarDuration === "480ms" && after.sidebarDuration === "480ms", "Navigation/frame/global timing changed");
          check(await f.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Horizontal overflow");
          cases.push({ test: "held-forward-reverse", width, height, to: name, frames });
        }
        if (width === 835) {
          await f.p.locator(".sidebar-rail-toggle").click();
          await f.p.waitForFunction(() => !document.querySelector(".unified-shell").getAnimations().some(a => a.playState === "running"), null, { timeout: 5000 });
          for (const [name, direction] of [["settings", "forward"], ["home", "back"]]) {
            const before = await rect(f.p); await visit(f.p, width, name); const frame = await sample(f.p, .4);
            check(frame.direction === direction && same(before.workspace, frame.live), "Expanded/distant workspace moved");
            await settle(f.p); check(same(before.nav, (await rect(f.p)).nav), "Expanded navigation moved");
            cases.push({ test: "expanded-distant-835", to: name, frame });
          }
        }
      } finally { await close(f.context); }
    }

    for (const [width, height] of [[1280, 900], [835, 835]]) for (const variant of ["balanced", "subtle"]) {
      const f = await setup({ width, height, hold: false, video: true, variant }); const video = f.p.video();
      try {
        for (const name of ["tasks", "calendar", "settings", "home"]) { await visit(f.p, width, name); await f.p.waitForFunction(() => !document.documentElement.dataset.pageTransition, null, { timeout: 5000 }); }
        const traces = await f.p.evaluate(() => window.__fadeQA.calls.map(c => ({ frames: c.frames, readyError: c.readyError })));
        check(traces.length === 4 && traces.every(t => t.frames.length >= 4 && t.frames.some(s => s.oldOpacity > .01 && s.oldOpacity < .99)), `${variant}: no real intermediate playback`);
        const limit = variant === "subtle" ? 24.02 : 32.02;
        check(traces.every(t => t.frames.every(s => Math.abs(s.oldY) <= limit && Math.abs(s.newY) <= limit && s.oldScale === 1 && s.newScale === 1)), "Normal playback exceeded bounded travel or scaled text");
        cases.push({ test: "normal-playback", variant, width, height, traces });
      } finally { await close(f.context); }
      const videoFile = output + `playback-${width}-${variant}.webm`;
      if (video) await deadline(video.saveAs(videoFile), "Recording finalization timeout");
      cases.push({ test: "recording", variant, width, file: video ? videoFile : null });
    }

    for (const spec of [{ width: 390, height: 844, touch: true }, { width: 320, height: 740, touch: true }, { width: 1280, reduced: true }, { width: 1280, unsupported: true }, { width: 1280, fail: true }]) {
      const f = await setup(spec);
      try {
        for (const name of ["tasks", "calendar"]) { const button = f.p.locator(`${f.width <= 700 ? ".phone-bottom-nav" : ".sidebar"} .nav-item[data-view="${name}"]`); if (spec.touch) await button.tap(); else await button.click(); check(await f.p.evaluate(name => document.body.dataset.view === name && !document.documentElement.dataset.pageTransition, name), "Fallback route not immediate"); }
        check(await f.p.evaluate(() => window.__fadeQA.calls.length === 0), "Fallback captured snapshots");
        if (spec.touch) { await f.p.locator("#phone-add-task").tap(); await f.p.locator("#task-modal input[name=title]").waitFor({ state: "visible" }); await f.p.locator("#close-task-modal").tap(); await f.p.waitForFunction(() => !document.querySelector("#task-modal").open, null, { timeout: 5000 }); await f.p.locator("#phone-task-summary").tap(); check(await f.p.evaluate(() => document.body.classList.contains("task-panel-open")), "Phone Tasks sheet lost tap"); await f.p.keyboard.press("Escape"); }
        cases.push({ test: "immediate-fallback", spec, passed: true });
      } finally { await close(f.context); }
    }

    const edge = await setup();
    try {
      const p = edge.p;
      await p.evaluate(() => { for (const name of ["tasks", "calendar", "settings", "home", "tasks"]) navigateView(name, true, document.querySelector(`.sidebar .nav-item[data-view="${name}"]`)); });
      await sample(p, .4); check(await p.evaluate(() => document.body.dataset.view === "tasks"), "Rapid stale route won"); await settle(p);
      await visit(p, 1280, "calendar"); await sample(p, .2); await p.emulateMedia({ reducedMotion: "reduce" }); await p.waitForFunction(() => !document.documentElement.dataset.pageTransition, null, { timeout: 5000 }); await p.emulateMedia({ reducedMotion: "no-preference" });
      await visit(p, 1280, "tasks"); await sample(p, .4); await p.setViewportSize({ width: 1300, height: 920 }); await p.waitForFunction(() => !document.documentElement.dataset.pageTransition, null, { timeout: 5000 });
      await visit(p, 1300, "calendar"); await settle(p); await visit(p, 1300, "tasks"); await sample(p, .3); await p.locator("#open-task-modal").focus(); await p.waitForFunction(() => !document.documentElement.dataset.pageTransition, null, { timeout: 5000 }); await p.keyboard.press("Enter"); await p.locator("#task-modal input[name=title]").waitFor({ state: "visible" }); await p.locator("#close-task-modal").click(); await p.waitForFunction(() => !document.querySelector("#task-modal").open, null, { timeout: 5000 });
      await p.mouse.move(30, 230); await p.setViewportSize({ width: 1280, height: 900 });
      await p.evaluate(() => { setView("calendar"); document.documentElement.dataset.theme = "dark"; const calendar = document.querySelector("#planner-calendar"); calendar.scrollTop = Math.min(180, calendar.scrollHeight - calendar.clientHeight); });
      const scroll = await p.locator("#planner-calendar").evaluate(e => e.scrollTop); check(scroll > 0, "No actual scrolled Calendar");
      const before = await rect(p); await p.screenshot({ path: output + "dark-before.png" }); await visit(p, 1280, "tasks"); await sample(p, 0); await p.screenshot({ path: output + "dark-held-start.png" }); await sample(p, .4); await p.screenshot({ path: output + "held-dark-forward.png" }); await settle(p); await p.screenshot({ path: output + "dark-after.png" }); await visit(p, 1280, "calendar"); await sample(p, .4); await p.screenshot({ path: output + "held-dark-back.png" }); await settle(p);
      check(await p.locator("#planner-calendar").evaluate(e => e.scrollTop) === scroll && same(before.workspace, (await rect(p)).workspace), "Dark Calendar scroll/frame changed");
      cases.push({ test: "rapid-preference-resize-focus-popup-dark-scroll", passed: true, restoredScrollTop: scroll });
    } finally { await close(edge.context); }
    check(!pageErrors.length && !blocked.length, "Page errors or unexpected external/API requests");
    return { runtime: browser.version(), cases, pageErrors, blocked, allSyntheticContextsClosed: contexts.size === 0, productionWrites: false, limits: ["Chromium only", "Touch is emulation; no physical Safari/iPad/native app claim", "Opaque-frame identity and overlap legibility require visual inspection of actual screenshots/recordings"] };
  } finally { for (const context of contexts) await context.close(); contexts.clear(); }
}
