// Isolated native-snapshot motion checks. No user browser, accounts, API or native writes.
async (page) => {
  const browser = page.context().browser(), origin = "http://127.0.0.1:8034";
  const output = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/layered-spring/";
  const contexts = new Set(), cases = [], pageErrors = [], blocked = [];
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const same = (a, b) => ["x", "y", "width", "height"].every(k => Math.abs(a[k] - b[k]) < 1);
  const deadline = (promise, label) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(label)), 5000))]);

  async function setup({ width = 1280, height = 900, touch = false, reduced = false, unsupported = false, fail = false, hold = true, variant = "layered", video = false, controlledOwner = false } = {}) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, reducedMotion: reduced ? "reduce" : "no-preference", serviceWorkers: "block", ...(video ? { recordVideo: { dir: output + "video", size: { width, height } } } : {}) });
    contexts.add(context);
    await context.route("**/*", route => {
      const u = new URL(route.request().url());
      if (u.origin !== origin || u.pathname.startsWith("/api/")) { blocked.push(u.origin + u.pathname); return route.abort(); }
      return route.continue();
    });
    await context.addInitScript(({ hold, unsupported, fail, variant, controlledOwner }) => {
      const qa = window.__layerQA = { hold, calls: [], owner: "qa-owner-a" };
      // A is the same controller and safety lifecycle with semantic layers disabled.
      let api;
      Object.defineProperty(window, "DuckViewTransitions", { configurable: true, get: () => api, set(value) {
        api = { ...value, create: args => value.create.call(value, { ...args, ...(variant === "page" ? { getLayers: () => [] } : {}), ...(controlledOwner ? { getOwner: () => qa.owner } : {}) }) };
      } });
      const relevant = animation => /duck-(workspace|route-)/.test(animation.effect?.pseudoElement || "");
      qa.states = () => {
        const root = document.documentElement, animations = document.getAnimations().filter(relevant);
        const pseudos = [...new Set(animations.map(a => a.effect.pseudoElement))].filter(pseudo => /::view-transition-(old|new)\(/.test(pseudo));
        const snapshots = Object.fromEntries(pseudos.map(pseudo => {
          const style = getComputedStyle(root, pseudo), matrix = new DOMMatrixReadOnly(style.transform);
          return [pseudo, { y: matrix.m42, x: matrix.m41, scaleX: matrix.m11, scaleY: matrix.m22, opacity: Number(style.opacity), filter: style.filter }];
        }));
        return { direction: root.dataset.pageTransition, phase: root.dataset.pageTransitionPhase, composition: root.dataset.pageTransitionComposition, backing: root.dataset.pageTransitionBacking, snapshots };
      };
      const native = document.startViewTransition?.bind(document);
      if (unsupported) { document.startViewTransition = undefined; return; }
      if (fail) { document.startViewTransition = () => { throw new Error("Isolated snapshot failure"); }; return; }
      if (!native) return;
      document.startViewTransition = update => {
        const transition = native(update), call = { transition, frames: [], timings: [], readyError: null, finished: false };
        qa.calls.push(call);
        transition.finished.then(() => { call.finished = true; }, () => { call.finished = true; });
        transition.ready.then(() => {
          const animations = document.getAnimations().filter(relevant);
          call.timings = animations.map(a => ({ pseudo: a.effect.pseudoElement, name: a.animationName, ...a.effect.getTiming() }));
          if (qa.hold) { animations.forEach(a => a.pause()); return; }
          const start = performance.now();
          const trace = now => {
            if (call.finished || qa.calls.at(-1) !== call || !document.documentElement.dataset.pageTransition || call.frames.length >= 100) return;
            call.frames.push({ elapsed: now - start, ...qa.states() });
            requestAnimationFrame(trace);
          };
          requestAnimationFrame(trace);
        }, error => { call.readyError = error.name; });
        return transition;
      };
    }, { hold, unsupported, fail, variant, controlledOwner });
    const p = await context.newPage(); p.setDefaultTimeout(5000); p.setDefaultNavigationTimeout(10000);
    p.on("pageerror", error => pageErrors.push(error.message));
    await p.goto(`${origin}/?qa=layered-spring-${variant}-${width}#calendar`);
    await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length > 0 && document.body.dataset.view === "calendar", null, { timeout: 5000 });
    return { context, p, width, height, variant };
  }
  async function close(context) { await context.close(); contexts.delete(context); }
  const rect = p => p.evaluate(() => ({ workspace: document.querySelector(".workspace").getBoundingClientRect().toJSON(), nav: document.querySelector(innerWidth <= 700 ? ".phone-bottom-nav" : ".sidebar").getBoundingClientRect().toJSON(), sidebarDuration: getComputedStyle(document.documentElement).getPropertyValue("--motion-layout").trim() }));
  const visit = (p, width, name) => p.locator(`${width <= 700 ? ".phone-bottom-nav" : ".sidebar"} .nav-item[data-view="${name}"]`).click();
  async function clean(p) {
    const state = await p.evaluate(() => ({ attrs: [...document.documentElement.attributes].filter(a => a.name.startsWith("data-page-transition")).map(a => a.name), vars: [...document.documentElement.style].filter(k => k.startsWith("--route-clip-")), names: [...document.querySelectorAll("[style]")].filter(e => e.style.viewTransitionName.startsWith("duck-route-")).map(e => e.style.viewTransitionName), animations: document.getAnimations().filter(a => /duck-(workspace|route-)/.test(a.effect?.pseudoElement || "")).length, active: document.querySelectorAll(".view.active").length, forms: document.querySelectorAll("#task-form").length }));
    check(!state.attrs.length && !state.vars.length && !state.names.length && !state.animations && state.active === 1 && state.forms === 1, `Snapshot cleanup failed: ${JSON.stringify(state)}`);
    return state;
  }
  async function settle(p) {
    await p.evaluate(async () => {
      const call = window.__layerQA.calls.at(-1), timeout = promise => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("Native settlement timeout")), 5000))]);
      if (call) await timeout(call.transition.ready.catch(() => {}));
      document.getAnimations().filter(a => /duck-(workspace|route-)/.test(a.effect?.pseudoElement || "")).forEach(a => a.finish());
      if (call) await timeout(call.transition.finished);
    });
    await p.waitForFunction(() => !document.documentElement.dataset.pageTransition, null, { timeout: 5000 });
    return clean(p);
  }
  async function sample(p, elapsed) {
    await p.waitForFunction(() => document.documentElement.dataset.pageTransitionPhase === "animate", null, { timeout: 5000 });
    return p.evaluate(async elapsed => {
      const root = document.documentElement, animations = document.getAnimations().filter(a => /duck-(workspace|route-)/.test(a.effect?.pseudoElement || ""));
      const total = Math.max(...animations.map(a => { const t = a.effect.getTiming(); return Number(t.delay) + Number(t.duration) * Number(t.iterations); }));
      const seek = Math.min(elapsed === "end" ? total - .1 : elapsed, total - .1);
      animations.forEach(a => { a.pause(); a.currentTime = seek; });
      await new Promise(requestAnimationFrame);
      const groups = Object.fromEntries([...new Set(animations.map(a => a.effect.pseudoElement.match(/\(([^)]+)\)/)?.[1]).filter(Boolean))].map(name => {
        const group = getComputedStyle(root, `::view-transition-group(${name})`), pair = getComputedStyle(root, `::view-transition-image-pair(${name})`);
        return [name, { transform: group.transform, width: group.width, height: group.height, overflow: group.overflow, pairOverflow: pair.overflow }];
      }));
      return { elapsed: seek, total, ...window.__layerQA.states(), groups, clip: getComputedStyle(root, "::view-transition").clipPath, clipVars: Object.fromEntries(["top", "right", "bottom", "left"].map(k => [k, root.style.getPropertyValue(`--route-clip-${k}`)])), live: document.querySelector(".workspace").getBoundingClientRect().toJSON(), active: document.querySelectorAll(".view.active").length, forms: document.querySelectorAll("#task-form").length, timings: window.__layerQA.calls.at(-1).timings };
    }, elapsed);
  }
  function assertFrame(frame, before, variant, direction) {
    check(frame.direction === direction && frame.composition === variant, "Wrong navigation direction/composition");
    check(same(before.workspace, frame.live) && frame.active === 1 && frame.forms === 1, "Live workspace jumped or duplicated forms");
    const states = Object.entries(frame.snapshots);
    check(states.length >= (variant === "layered" ? 6 : 2), `Missing parent/semantic native snapshot groups: ${states.map(([name]) => name).join(", ")}`);
    check(states.every(([,s]) => Math.abs(s.y) <= 72.1 && s.x === 0 && s.scaleX === 1 && s.scaleY === 1 && s.filter === "none"), "Motion scaled, blurred, moved horizontally or exceeded 72px");
    check(frame.clip !== "none", "Global workspace overlay was not clipped");
    for (const [name, group] of Object.entries(frame.groups)) if (name.startsWith("duck-route-")) check(group.overflow === "visible" && group.pairOverflow === "visible", "A semantic group clips its own travel");
  }
  async function denseTasks(p) {
    return p.evaluate(async () => {
      for (let i = 0; i < 24; i++) await store.upsertItem({ id: `isolated-motion-${i}`, title: `Motion QA long assignment ${i + 1}: read, draft, review and prepare a careful response`, classId: null, type: "task", priority: "Medium", notes: "Isolated local fixture only", dueDate: "2026-11-15", dueTime: "17:00", durationMinutes: 45, completed: false, schemaVersion: 2 });
      return store.listItems().length;
    });
  }

  try {
    for (const [width, height] of [[1280, 900], [835, 835]]) for (const variant of ["layered", "page"]) {
      const f = await setup({ width, height, variant });
      try {
        for (const [name, direction] of [["tasks", "forward"], ["calendar", "back"]]) {
          const before = await rect(f.p); await visit(f.p, width, name); const frames = [];
          for (const elapsed of [0, 40, 80, 160, 260, 340, 400, 460, "end"]) {
            const frame = await sample(f.p, elapsed); frames.push(frame); assertFrame(frame, before, variant, direction);
            if (elapsed === 160) await f.p.screenshot({ path: `${output}held-${width}-${variant}-${direction}.png` });
          }
          const sign = direction === "forward" ? 1 : -1;
          const incoming = frame => Object.entries(frame.snapshots).filter(([key]) => variant === "layered" ? key.includes("new(duck-route-new-") || frame.backing === "content" && key === "::view-transition-new(duck-workspace)" : key === "::view-transition-new(duck-workspace)").map(([,s]) => s);
          check(incoming(frames[0]).every(s => s.y * sign >= 47.9), "Incoming content does not begin 48–72px away");
          check(incoming(frames[2]).some(s => s.opacity > .2 && Math.abs(s.y) > 4), "Incoming travel is invisible until too late");
          check(incoming(frames.at(-1)).every(s => Math.abs(s.y) < .1 && s.opacity > .99), "Incoming snapshots did not settle sharply");
          check(frames.some(f => incoming(f).some(s => s.y * sign < -1.5 && s.y * sign >= -4.5)), "No bounded 2–4px spring overshoot");
          const end = await settle(f.p), after = await rect(f.p);
          check(same(before.workspace, after.workspace) && same(before.nav, after.nav) && before.sidebarDuration === "480ms" && after.sidebarDuration === "480ms", "Frame/sidebar/global layout timing changed");
          check(await f.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Horizontal overflow");
          cases.push({ test: "held-forward-reverse", width, height, variant, to: name, frames, cleanup: end });
        }
        if (width === 835 && variant === "layered") {
          await f.p.locator(".sidebar-rail-toggle").click();
          await f.p.waitForFunction(() => !document.querySelector(".unified-shell").getAnimations().some(a => a.playState === "running"), null, { timeout: 5000 });
          for (const [name, direction] of [["settings", "forward"], ["home", "back"]]) {
            const before = await rect(f.p); await visit(f.p, width, name); const frame = await sample(f.p, 160); assertFrame(frame, before, variant, direction); await settle(f.p);
            check(same(before.nav, (await rect(f.p)).nav), "Expanded navigation moved"); cases.push({ test: "expanded-distant", width, to: name, frame });
          }
        }
      } finally { await close(f.context); }
    }

    for (const [width, height] of [[1280, 900], [835, 835]]) for (const variant of ["page", "layered"]) {
      const f = await setup({ width, height, variant, hold: false, video: true }), video = f.p.video();
      try {
        const taskCount = await denseTasks(f.p);
        for (const name of ["tasks", "calendar", "settings", "home"]) { await visit(f.p, width, name); await f.p.waitForFunction(() => !document.documentElement.dataset.pageTransition, null, { timeout: 5000 }); }
        const traces = await f.p.evaluate(() => window.__layerQA.calls.map(c => ({ frames: c.frames, timings: c.timings, readyError: c.readyError })));
        check(traces.length === 4 && traces.every(t => !t.readyError && t.frames.length >= 5), "Missing actual intermediate native playback");
        check(traces.every(t => t.frames.every(f => Object.values(f.snapshots).every(s => Math.abs(s.y) <= 72.1 && s.scaleX === 1 && s.scaleY === 1))), "Normal playback exceeded bounded travel/scaled text");
        cases.push({ test: "normal-playback", variant, width, height, taskCount, traces, cleanup: await clean(f.p) });
      } finally { await close(f.context); }
      const file = `${output}playback-${width}-${variant}.webm`; if (video) await deadline(video.saveAs(file), "Recording finalization timeout"); cases.push({ test: "recording", width, variant, file: video ? file : null });
    }

    for (const spec of [{ width: 390, height: 844, touch: true }, { width: 320, height: 740, touch: true }, { width: 1280, reduced: true }, { width: 1280, unsupported: true }, { width: 1280, fail: true }]) {
      const f = await setup(spec);
      try {
        for (const name of ["tasks", "calendar"]) {
          const control = f.p.locator(`${f.width <= 700 ? ".phone-bottom-nav" : ".sidebar"} .nav-item[data-view="${name}"]`);
          if (spec.touch) await control.tap(); else await control.click();
          check(await f.p.evaluate(name => document.body.dataset.view === name && !document.documentElement.dataset.pageTransition, name), "Fallback route was not immediate");
        }
        check(await f.p.evaluate(() => window.__layerQA.calls.length === 0), "Fallback captured snapshots");
        if (spec.touch) {
          await f.p.locator("#phone-add-task").tap(); await f.p.locator("#task-modal input[name=title]").waitFor({ state: "visible" }); await f.p.locator("#close-task-modal").tap();
          await f.p.waitForFunction(() => !document.querySelector("#task-modal").open, null, { timeout: 5000 }); await f.p.locator("#phone-task-summary").tap();
          check(await f.p.evaluate(() => document.body.classList.contains("task-panel-open")), "Phone Tasks sheet lost its touch action"); await f.p.keyboard.press("Escape");
        }
        cases.push({ test: "immediate-fallback", spec, cleanup: await clean(f.p), passed: true });
      } finally { await close(f.context); }
    }

    const edge = await setup();
    try {
      const p = edge.p;
      await p.evaluate(() => { for (const name of ["tasks", "calendar", "settings", "home", "tasks"]) navigateView(name, true, document.querySelector(`.sidebar .nav-item[data-view="${name}"]`)); });
      await sample(p, 160); check(await p.evaluate(() => document.body.dataset.view === "tasks"), "A stale rapid route won"); await settle(p);
      await visit(p, 1280, "calendar"); await sample(p, 80); await p.emulateMedia({ reducedMotion: "reduce" }); await p.waitForFunction(() => !document.documentElement.dataset.pageTransition, null, { timeout: 5000 }); await clean(p); await p.emulateMedia({ reducedMotion: "no-preference" });
      await visit(p, 1280, "tasks"); await sample(p, 160); await p.setViewportSize({ width: 1300, height: 920 }); await p.waitForFunction(() => !document.documentElement.dataset.pageTransition, null, { timeout: 5000 }); await clean(p);
      await visit(p, 1300, "calendar"); await settle(p); await visit(p, 1300, "tasks"); await sample(p, 80); await p.locator("#open-task-modal").focus();
      await p.waitForFunction(() => !document.documentElement.dataset.pageTransition, null, { timeout: 5000 }); await p.keyboard.press("Enter"); await p.locator("#task-modal input[name=title]").waitFor({ state: "visible" }); await clean(p);
      await p.locator("#close-task-modal").click(); await p.waitForFunction(() => !document.querySelector("#task-modal").open, null, { timeout: 5000 });
      await p.mouse.move(30, 230); await p.setViewportSize({ width: 1280, height: 900 });
      await p.evaluate(() => { setView("calendar"); document.documentElement.dataset.theme = "dark"; const calendar = document.querySelector("#planner-calendar"); calendar.scrollTop = Math.min(180, calendar.scrollHeight - calendar.clientHeight); });
      const scrollTop = await p.locator("#planner-calendar").evaluate(e => e.scrollTop); check(scrollTop > 0, "No actual scrolled Calendar");
      const before = await rect(p); await p.screenshot({ path: output + "dark-before.png" }); await visit(p, 1280, "tasks"); await sample(p, 0); await p.screenshot({ path: output + "dark-held-start.png" }); await sample(p, 160); await p.screenshot({ path: output + "held-dark-forward.png" }); await settle(p); await p.screenshot({ path: output + "dark-after.png" });
      await visit(p, 1280, "calendar"); await sample(p, 160); await p.screenshot({ path: output + "held-dark-back.png" }); await settle(p);
      check(await p.locator("#planner-calendar").evaluate(e => e.scrollTop) === scrollTop && same(before.workspace, (await rect(p)).workspace), "Dark Calendar scroll/frame changed");
      // Every retained route remains reachable under the semantic resolver.
      for (const name of ["home", "tasks", "classes", "goals", "notes", "settings", "calendar"]) { await visit(p, 1280, name); await sample(p, 160); await settle(p); check(await p.evaluate(n => document.body.dataset.view === n, name), "Retained section became unreachable"); }
      cases.push({ test: "rapid-reverse-preference-resize-focus-popup-dark-scroll-all-routes", passed: true, restoredScrollTop: scrollTop });
    } finally { await close(edge.context); }

    const owner = await setup({ controlledOwner: true });
    try {
      await visit(owner.p, 1280, "tasks"); await sample(owner.p, 80);
      await owner.p.evaluate(() => { window.__layerQA.owner = "qa-owner-b"; viewTransitions.cancel(); });
      await owner.p.waitForFunction(() => !document.documentElement.dataset.pageTransition, null, { timeout: 5000 });
      cases.push({ test: "controlled-owner-change-cancels-snapshots", passed: true, cleanup: await clean(owner.p), scope: "Controller owner token simulation only; no authenticated account or API" });
    } finally { await close(owner.context); }
    check(!pageErrors.length && !blocked.length, `Page errors or unexpected API/external requests: ${JSON.stringify({ pageErrors, blocked })}`);
    return { runtime: browser.version(), source: "Current local layered-spring implementation; record git/diff identity alongside result", mode: "isolated signed-out local fixture; API/external traffic blocked", cases, pageErrors, blocked, allSyntheticContextsClosed: contexts.size === 0, productionWrites: false, limits: ["Chromium only", "Touch is emulation, not physical Safari/iPad/native verification", "No hosted API, authentication, installed PWA or native bundle work in this presentation-only task", "Recordings/screenshots require visual review; numerical samples alone do not establish visual preference"] };
  } finally { for (const context of contexts) await context.close(); contexts.clear(); }
}
