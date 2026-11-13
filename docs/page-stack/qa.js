// Native page-stack browser QA. Run with Playwright MCP filename on local preview8034.
// New contexts only; no user tabs/storage, APIs or external requests.
async (page) => {
  const browser = page.context().browser(), origin = "http://127.0.0.1:8034";
  const path = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/page-stack/";
  const results = [], errors = [], blocked = [];
  const check = (pass, label) => { if (!pass) throw new Error(label); };
  async function setup({ width = 1280, height = 900, touch = false, reduced = false, unsupported = false, hold = true, video = false } = {}) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, reducedMotion: reduced ? "reduce" : "no-preference", serviceWorkers: "block", ...(video ? { recordVideo: { dir: path + "video", size: { width, height } } } : {}) });
    await context.route("**/*", route => { const u = new URL(route.request().url()); if (u.origin !== origin || u.pathname.startsWith("/api/")) { blocked.push(u.href); return route.abort(); } return route.continue(); });
    await context.addInitScript(({ hold, unsupported }) => {
      window.__stackQA = { hold, calls: [], traces: [] };
      const native = document.startViewTransition?.bind(document);
      if (unsupported) { document.startViewTransition = undefined; return; }
      if (!native) return;
      document.startViewTransition = update => {
        const transition = native(update), record = { transition, frames: [], readyError: null };
        window.__stackQA.calls.push(record);
        transition.ready.then(() => {
          const animations = document.getAnimations().filter(a => a.effect?.pseudoElement?.includes("duck-workspace"));
          if (window.__stackQA.hold) { animations.forEach(a => a.pause()); return; }
          const start = performance.now();
          const trace = now => {
            if (!document.documentElement.dataset.pageTransition || record.frames.length > 90) return;
            const style = kind => getComputedStyle(document.documentElement, `::view-transition-${kind}(duck-workspace)`);
            const y = kind => { const s = style(kind); return s.transform === "none" ? 0 : new DOMMatrixReadOnly(s.transform).m42; };
            const rect = document.querySelector(".workspace").getBoundingClientRect();
            record.frames.push({ elapsed: now - start, oldY: y("old"), newY: y("new"), oldOpacity: style("old").opacity, newOpacity: style("new").opacity, height: rect.height, x: rect.x, width: rect.width, direction: document.documentElement.dataset.pageTransition });
            requestAnimationFrame(trace);
          };
          requestAnimationFrame(trace);
        }, error => { record.readyError = error.name; });
        return transition;
      };
    }, { hold, unsupported });
    try {
      const p = await context.newPage(); p.on("pageerror", e => errors.push(e.message));
      p.setDefaultTimeout(5000); p.setDefaultNavigationTimeout(10000);
      await p.goto(`${origin}/?qa=page-stack-${width}-${touch ? "touch" : "fine"}#calendar`);
      await p.waitForFunction(() => store.listItems().length > 0 && document.body.dataset.view === "calendar");
      return { context, p, width, height, touch };
    } catch (error) { await context.close(); throw error; }
  }
  const rect = p => p.evaluate(() => { const n = document.querySelector(innerWidth <= 700 ? ".phone-bottom-nav" : ".sidebar"); const r = document.querySelector(".workspace").getBoundingClientRect(); return { workspace: r.toJSON(), nav: n.getBoundingClientRect().toJSON(), clip: getComputedStyle(n).clipPath }; });
  const sameBox = (a, b) => ["x", "y", "width", "height"].every(key => Math.abs(a[key] - b[key]) < 1);
  const visit = (p, width, name) => p.locator(`${width <= 700 ? ".phone-bottom-nav" : ".sidebar"} .nav-item[data-view="${name}"]`).click();
  async function finish(p) {
    await p.evaluate(async () => {
      const call = window.__stackQA.calls.at(-1);
      const deadline = promise => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("Native transition settlement exceeded 5s")), 5000))]);
      if (call) await deadline(call.transition.ready.catch(() => {}));
      document.getAnimations().filter(a => a.effect?.pseudoElement?.includes("duck-workspace")).forEach(a => a.finish());
      if (call) await deadline(call.transition.finished);
    });
    await p.waitForFunction(() => !document.documentElement.dataset.pageTransition && !document.getAnimations().some(a => a.effect?.pseudoElement?.includes("duck-workspace")));
  }
  async function held(p, expectedDirection, fraction) {
    await p.waitForFunction(() => document.documentElement.dataset.pageTransitionPhase === "animate");
    return p.evaluate(async ({ expectedDirection, fraction }) => {
      const root = document.documentElement, animations = document.getAnimations().filter(a => a.effect?.pseudoElement?.includes("duck-workspace"));
      const old = animations.find(a => a.effect.pseudoElement.startsWith("::view-transition-old"));
      if (!old || animations.length !== 2) throw new Error("Expected exactly two native workspace snapshot animations");
      const H = parseFloat(root.style.getPropertyValue("--page-height"));
      const style = kind => getComputedStyle(root, `::view-transition-${kind}(duck-workspace)`);
      const matrix = kind => new DOMMatrixReadOnly(style(kind).transform);
      let low = 0, high = Number(old.effect.getTiming().duration);
      for (let step = 0; step < 18; step += 1) {
        const time = (low + high) / 2; animations.forEach(a => { a.pause(); a.currentTime = time; });
        const progress = Math.abs(matrix("old").m42) / H;
        if (progress < fraction) low = time; else high = time;
      }
      animations.forEach(a => { a.currentTime = (low + high) / 2; });
      await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
      const a = matrix("old"), b = matrix("new"), group = style("group"), pair = style("image-pair");
      const seam = expectedDirection === "forward" ? a.m42 + H - b.m42 : a.m42 - H - b.m42;
      return { direction: root.dataset.pageTransition, H, time: old.currentTime, easedProgress: Math.abs(a.m42) / H, oldY: a.m42, newY: b.m42, seam, oldOpacity: style("old").opacity, newOpacity: style("new").opacity, oldX: a.m41, newX: b.m41, width: parseFloat(group.width), height: parseFloat(group.height), groupTransform: group.transform, groupOverflow: group.overflow, pairOverflow: pair.overflow, live: document.querySelector(".workspace").getBoundingClientRect().toJSON(), activeCount: document.querySelectorAll(".view.active").length, formCount: document.querySelectorAll("#task-form").length };
    }, { expectedDirection, fraction });
  }

  for (const [width, height] of [[1280, 900], [835, 835], [390, 844], [320, 740]]) {
    const { context, p } = await setup({ width, height });
    try {
      for (const [name, expectedDirection] of [["tasks", "forward"], ["calendar", "back"]]) {
        const before = await rect(p); await visit(p, width, name);
        const frames = [];
        for (const fraction of [.1, .5, .9]) {
          const frame = await held(p, expectedDirection, fraction); frames.push(frame);
          check(frame.direction === expectedDirection && Math.abs(frame.seam) < .02 && Math.abs(frame.easedProgress - fraction) < .002, `${width}px ${name}: incorrect paired movement/seam`);
          check(frame.oldOpacity === "1" && frame.newOpacity === "1" && frame.oldX === 0 && frame.newX === 0, `${width}px ${name}: fade/horizontal motion`);
          check(frame.groupOverflow === "hidden" && frame.pairOverflow === "hidden" && sameBox(before.workspace, frame.live) && Math.abs(frame.H - before.workspace.height) < 1 && Math.abs(frame.width - before.workspace.width) < 1, `${width}px ${name}: unstable clip geometry`);
          check(frame.activeCount === 1 && frame.formCount === 1, `${width}px ${name}: duplicate live content`);
          if (fraction === .5 && (name === "tasks" || width === 1280)) await p.screenshot({ path: `${path}held-${width}-${expectedDirection}.png` });
        }
        await finish(p); const after = await rect(p);
        check(sameBox(before.workspace, after.workspace) && sameBox(before.nav, after.nav) && before.clip === after.clip, `${width}px ${name}: navigation or workspace jumped`);
        check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: horizontal page overflow`);
        results.push({ test: "paired-native", width, height, to: name, frames });
      }
      if (width === 1280) {
        await p.locator(".sidebar-rail-toggle").click();
        await p.waitForFunction(() => !document.querySelector(".unified-shell").getAnimations().some(a => a.playState === "running"));
        for (const [name, expectedDirection] of [["settings", "forward"], ["home", "back"]]) {
          const before = await rect(p); await visit(p, width, name); const frame = await held(p, expectedDirection, .5);
          check(Math.abs(frame.seam) < .02 && frame.direction === expectedDirection && sameBox(before.workspace, frame.live), "Expanded/distant navigation broke the shared clip");
          await p.screenshot({ path: `${path}held-expanded-${name}.png` }); await finish(p);
          const after = await rect(p); check(sameBox(before.nav, after.nav) && sameBox(before.workspace, after.workspace), "Expanded/distant navigation moved navigation");
          results.push({ test: "expanded-distant", to: name, frame });
        }
      }
      if (width === 835) {
        const layouts = [];
        for (const expanded of [false, true]) {
          if (expanded) { await p.locator(".sidebar-rail-toggle").click(); await p.waitForFunction(() => !document.querySelector(".unified-shell").getAnimations().some(a => a.playState === "running")); }
          for (const name of ["calendar", "home", "tasks", "classes", "goals", "notes", "settings"]) {
            await p.evaluate(name => setView(name, true), name);
            const layout = await p.evaluate(() => ({ view: document.body.dataset.view, expanded: document.body.classList.contains("sidebar-open"), pageFits: document.documentElement.scrollWidth <= innerWidth }));
            check(layout.pageFits && layout.expanded === expanded, `835px ${name}: normalized navigation causes page overflow`); layouts.push(layout);
          }
        }
        results.push({ test: "all-seven-layouts-835", layouts });
      }
    } finally { await context.close(); }
  }

  // Actual elapsed playback: no pausing/seeking; video and RAF trace record the native animation.
  let normal, videoFailure = null;
  try { normal = await setup({ hold: false, video: true }); }
  catch (error) { videoFailure = error.message; normal = await setup({ hold: false }); }
  const normalVideo = normal.p.video();
  try {
    for (const name of ["tasks", "calendar", "settings", "home"]) { await visit(normal.p, 1280, name); await normal.p.waitForFunction(() => !document.documentElement.dataset.pageTransition); }
    const traces = await normal.p.evaluate(() => window.__stackQA.calls.map(call => ({ readyError: call.readyError, frames: call.frames })));
    check(traces.length === 4 && traces.every(trace => trace.frames.length >= 4 && trace.frames.some(frame => Math.abs(frame.oldY) > 1 && Math.abs(frame.oldY) < frame.height - 1)), "Normal playback did not paint multiple intermediate frames");
    check(traces.every(trace => trace.frames.every(frame => Math.abs(frame.direction === "forward" ? frame.oldY + frame.height - frame.newY : frame.oldY - frame.height - frame.newY) < .02 && frame.oldOpacity === "1" && frame.newOpacity === "1")), "Normal playback developed a gap or fade");
    results.push({ test: "normal-elapsed-playback", traces });
  } finally { await normal.context.close(); }
  const videoPath = normalVideo ? await normalVideo.path() : null;

  for (const spec of [{ width: 390, height: 844, touch: true }, { width: 320, height: 740, touch: true }, { width: 1280, height: 900, reduced: true }, { width: 1280, height: 900, unsupported: true }]) {
    const { context, p } = await setup(spec);
    try {
      for (const name of ["tasks", "calendar"]) { const item = p.locator(`${spec.width <= 700 ? ".phone-bottom-nav" : ".sidebar"} .nav-item[data-view="${name}"]`); if (spec.touch) await item.tap(); else await item.click(); check(await p.evaluate(name => document.body.dataset.view === name && !document.documentElement.dataset.pageTransition, name), "Fallback navigation was delayed"); }
      check(await p.evaluate(() => window.__stackQA.calls.length === 0), "Fallback unexpectedly invoked native snapshots");
      if (spec.touch) {
        await p.locator("#phone-add-task").tap(); await p.waitForFunction(() => document.querySelector("#task-modal").open);
        await p.locator("#task-modal input[name=title]").waitFor({ state: "visible" });
        check(await p.locator("#task-modal input[name=title]").isVisible(), "Early phone tap lost the intended Add action");
        await p.locator("#close-task-modal").tap(); await p.waitForFunction(() => !document.querySelector("#task-modal").open);
        await p.locator("#phone-task-summary").tap(); check(await p.evaluate(() => document.body.classList.contains("task-panel-open")), "Phone task sheet tap was lost"); await p.keyboard.press("Escape");
      }
      results.push({ test: "immediate-fallback", spec, calls: 0 });
    } finally { await context.close(); }
  }

  const edge = await setup();
  try {
    const p = edge.p;
    // Same-turn route requests exercise native callbacks that have not committed yet.
    await p.evaluate(() => { for (const name of ["tasks", "calendar", "settings", "home", "tasks"]) navigateView(name, true, document.querySelector(`.sidebar .nav-item[data-view="${name}"]`)); });
    await held(p, "forward", .5); check(await p.evaluate(() => document.body.dataset.view) === "tasks", "Stale route won rapid navigation"); await finish(p);
    await visit(p, 1280, "calendar"); await held(p, "back", .3); await p.emulateMedia({ reducedMotion: "reduce" });
    await p.waitForFunction(() => !document.documentElement.dataset.pageTransition); check(await p.evaluate(() => document.body.dataset.view) === "calendar", "Preference change lost destination"); await p.emulateMedia({ reducedMotion: "no-preference" });
    await visit(p, 1280, "tasks"); await held(p, "forward", .4); await p.setViewportSize({ width: 1300, height: 920 });
    await p.waitForFunction(() => !document.documentElement.dataset.pageTransition); check(await p.evaluate(() => document.body.dataset.view) === "tasks", "Resize lost destination");
    await visit(p, 1300, "calendar"); await finish(p); await visit(p, 1300, "tasks"); await held(p, "forward", .3);
    await p.locator("#open-task-modal").focus(); await p.waitForFunction(() => !document.documentElement.dataset.pageTransition);
    await p.keyboard.press("Enter"); await p.waitForFunction(() => document.querySelector("#task-modal").open);
    await p.locator("#task-modal input[name=title]").waitFor({ state: "visible" });
    check(await p.locator("#task-modal input[name=title]").isVisible(), "Settled content focus lost popup"); await p.locator("#close-task-modal").click(); await p.waitForFunction(() => !document.querySelector("#task-modal").open);
    await p.mouse.move(30, 230);
    await p.evaluate(async () => { setView("calendar"); navigateView("tasks", true, document.querySelector('.sidebar .nav-item[data-view="tasks"]')); window.__ownerDescriptor = Object.getOwnPropertyDescriptor(store, "user"); Object.defineProperty(store, "user", { get: () => ({ id: "isolated-page-stack-owner" }), configurable: true }); await store.upsertGoal({ title: "Owner cleanup QA", targetCount: 1, currentCount: 0, unit: "check", notes: "Disposable fixture." }); });
    await p.waitForFunction(() => !document.documentElement.dataset.pageTransition);
    check(await p.evaluate(() => document.body.dataset.view === "calendar" && !document.documentElement.style.getPropertyValue("--page-height") && document.querySelectorAll(".view.active").length === 1), "Owner change allowed stale route or retained snapshot state");
    results.push({ test: "rapid-preference-resize-focus-owner", passed: true });
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.evaluate(() => { window.__stackQA.hold = false; });
    await visit(p, 1280, "tasks"); await p.waitForFunction(() => !document.documentElement.dataset.pageTransition);
    const trace = await p.evaluate(() => window.__stackQA.calls.at(-1).frames);
    check(trace.length >= 4 && trace.some(frame => Math.abs(frame.oldY) > 1 && Math.abs(frame.oldY) < frame.height - 1), "Normal RAF trace lacks painted intermediate frames");
    results.push({ test: "normal-raf-trace", trace });
  } finally { await edge.context.close(); }

  const scrolled = await setup();
  try {
    const p = scrolled.p;
    await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; const calendar = document.querySelector("#planner-calendar"); calendar.scrollTop = Math.min(180, calendar.scrollHeight - calendar.clientHeight); });
    const scrollTop = await p.locator("#planner-calendar").evaluate(element => element.scrollTop);
    check(scrollTop > 0, "Dark Calendar fixture was not actually scrolled");
    const before = await rect(p);
    await visit(p, 1280, "tasks"); const forward = await held(p, "forward", .5);
    check(Math.abs(forward.seam) < .02 && sameBox(before.workspace, forward.live), "Dark/scrolled forward clip or seam regressed");
    await p.screenshot({ path: path + "held-dark-scrolled-forward.png" }); await finish(p);
    await visit(p, 1280, "calendar"); const back = await held(p, "back", .5);
    check(Math.abs(back.seam) < .02 && sameBox(before.workspace, back.live), "Dark/scrolled return clip or seam regressed");
    await p.screenshot({ path: path + "held-dark-scrolled-back.png" }); await finish(p);
    const after = await rect(p), restored = await p.locator("#planner-calendar").evaluate(element => element.scrollTop);
    check(Math.abs(restored - scrollTop) < 1 && sameBox(before.workspace, after.workspace) && sameBox(before.nav, after.nav), "Dark Calendar scroll or navigation bounds changed on return");
    results.push({ test: "dark-scrolled-calendar", scrollTop, restored, forward, back });
  } finally { await scrolled.context.close(); }

  check(!errors.length && !blocked.length, "Unexpected page errors or external/API requests");
  return { browser: browser.version(), results, errors, blocked, video: videoPath, videoFailure, allContextsClosed: true };
}
