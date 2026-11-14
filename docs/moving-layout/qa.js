// Isolated route-owned frame movement and real input checks; no user browser or API.
async (page) => {
  const browser = page.context().browser(), origin = "http://127.0.0.1:8034";
  const out = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/moving-layout/";
  const contexts = new Set(), cases = [], errors = [], failed = [], blocked = [];
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const relevant = a => a.id.startsWith("duck-route-live") || /duck-(workspace|route-)/.test(a.effect?.pseudoElement || "");
  let stage = "start";
  async function setup({ width = 835, height = 746, baseline = false, reduced = false, touch = false, video = false } = {}) {
    const c = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block", reducedMotion: reduced ? "reduce" : "no-preference", hasTouch: touch, isMobile: touch, ...(video ? { recordVideo: { dir: out + "raw-video", size: { width, height } } } : {}) });
    contexts.add(c);
    await c.route("**/*", r => { const u = new URL(r.request().url()); if (u.origin !== origin || u.pathname.startsWith("/api/")) { blocked.push(u.origin + u.pathname); return r.abort(); } return r.continue(); });
    if (baseline) await c.addInitScript(() => {
      let api;
      Object.defineProperty(window, "DuckViewTransitions", { configurable: true, get: () => api, set(v) {
        api = { ...v, create: args => v.create({ ...args, getLayers: route => (route === "calendar" ? [
          ["title", ".calendar-title-copy"], ["controls", "#calendar-today"], ["controls", ".calendar-stepper"], ["controls", ".calendar-toolbar-actions"], ["content", "#daily-task-panel"], ["content", "#planner-calendar"],
        ] : [["title", ".topbar-title"], ["controls", ".topbar-actions"], ["content", `#view-${route}`]]).map(([role, selector]) => ({ role, element: args.workspace.querySelector(selector) })) }) };
      } });
    });
    const p = await c.newPage(); p.setDefaultTimeout(5000); p.setDefaultNavigationTimeout(10000);
    p.on("pageerror", e => errors.push(e.message)); p.on("requestfailed", r => failed.push(new URL(r.url()).pathname));
    await p.goto(`${origin}/?qa=moving-layout-${baseline ? "baseline" : "candidate"}#calendar`);
    await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length > 0);
    return { c, p, width, height, baseline };
  }
  async function close(c) { await c.close(); contexts.delete(c); }
  async function clean(p) {
    const result = await p.evaluate(() => ({ attrs: [...document.documentElement.attributes].filter(a => a.name.startsWith("data-page-transition")).length, names: document.querySelectorAll('[style*="view-transition-name"]').length, live: document.getAnimations().filter(a => a.id.startsWith("duck-route-live")).length, active: document.querySelectorAll(".view.active").length, forms: document.querySelectorAll("#task-form").length }));
    check(!result.attrs && !result.names && !result.live && result.active === 1 && result.forms === 1, "Transition cleanup failed " + JSON.stringify(result)); return result;
  }
  async function navigate(f, from, to) {
    await f.p.evaluate(from => setView(from, true), from);
    await f.p.locator(`.sidebar [data-view="${to}"]`).click();
    await f.p.waitForFunction(() => document.documentElement.dataset.pageTransitionPhase === "animate");
    await f.p.evaluate(() => document.getAnimations().filter(a => a.id.startsWith("duck-route-live") || /duck-(workspace|route-)/.test(a.effect?.pseudoElement || "")).forEach(a => { a.pause(); a.currentTime = 0; }));
  }
  async function sample(p, elapsed) {
    return p.evaluate(async elapsed => {
      const animations = document.getAnimations().filter(a => a.id.startsWith("duck-route-live") || /duck-(workspace|route-)/.test(a.effect?.pseudoElement || ""));
      animations.forEach(a => { a.pause(); a.currentTime = elapsed; }); await new Promise(requestAnimationFrame);
      const liveRoots = [...new Set(animations.filter(a => a.id.startsWith("duck-route-live")).map(a => a.effect.target))];
      const measure = selector => { const e = document.querySelector(selector); if (!e || !e.getBoundingClientRect().width) return null; const s = getComputedStyle(e), b = e.getBoundingClientRect(); return { rect: b.toJSON(), y: new DOMMatrixReadOnly(s.transform).m42, opacity: Number(s.opacity), borderBottom: s.borderBottom, borderTop: s.borderTop, borderBottomY: b.bottom - parseFloat(s.borderBottomWidth) / 2, ancestorMotionRoot: liveRoots.find(r => r === e || r.contains(e))?.className || null }; };
      const clip = document.querySelector(".workspace").getBoundingClientRect();
      const borderOwners = [...document.querySelectorAll(".workspace *")].filter(e => { const b = e.getBoundingClientRect(), s = getComputedStyle(e); return b.width && b.height && b.bottom > clip.top && b.top < clip.bottom && b.right > clip.left && b.left < clip.right && [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth].some(n => parseFloat(n) > 0); }).map(e => ({ selector: e.id ? `#${e.id}` : `${e.tagName.toLowerCase()}.${String(e.className).replaceAll(" ", ".")}`, covered: liveRoots.some(r => r === e || r.contains(e)) }));
      return { elapsed, phase: document.documentElement.dataset.pageTransitionPhase, view: document.body.dataset.view, header: measure(".compact-topbar"), title: measure(".topbar-title"), search: measure(".topbar-actions"), body: measure(".view.active"), frame: measure(".planner-workspace"), grid: measure("#planner-calendar"), taskPane: measure("#daily-task-panel"), workspace: measure(".workspace"), roots: liveRoots.map(e => ({ id: e.id, className: e.className, y: new DOMMatrixReadOnly(getComputedStyle(e).transform).m42, ownAnimations: animations.filter(a => a.effect?.target === e).map(a => a.id) })), borderOwners, horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
    }, elapsed);
  }
  async function finish(p) {
    await p.evaluate(() => document.getAnimations().filter(a => a.id.startsWith("duck-route-live") || /duck-(workspace|route-)/.test(a.effect?.pseudoElement || "")).forEach(a => a.finish()));
    await p.waitForFunction(() => !document.documentElement.dataset.pageTransition); return clean(p);
  }
  async function held(f, from, to, label) {
    stage = label; await navigate(f, from, to); const frames = [];
    for (const time of [0, 80, 160, 320, 499]) { const s = await sample(f.p, time); frames.push(s); if (time === 160) await f.p.screenshot({ path: out + `${label}.png` }); }
    const cleanup = await finish(f.p), end = await sample(f.p, 0);
    if (f.baseline) check(frames.every(s => Math.abs(s.header.y) < .01) && frames.some(s => Math.abs(s.body.y) > 1), "Baseline did not reproduce stationary divider");
    else for (const s of frames) {
      check(!s.horizontalOverflow, "Moving layout has horizontal overflow");
      check(s.borderOwners.every(o => o.covered), "A route-owned visible border is outside its moving root: " + JSON.stringify(s.borderOwners.filter(o => !o.covered)));
      if (to === "calendar") {
        check(s.roots.length === 1 && Math.abs(s.frame.y) <= 64.1, "Calendar must have one 64px root, not nested movement");
        check(Math.abs((s.grid.rect.top - end.grid.rect.top) - s.frame.y) < .15 && Math.abs((s.taskPane.rect.top - end.taskPane.rect.top) - s.frame.y) < .15, "Calendar children do not inherit exactly one frame translation");
      } else {
        check(s.roots.length === 2 && Math.abs(s.header.y - s.body.y) < .01, "Header and content use different movement phases");
        check(Math.abs((s.header.borderBottomY - end.header.borderBottomY) - s.header.y) < .15, "Divider does not move with header");
        check(Math.abs((s.title.rect.top - end.title.rect.top) - s.header.y) < .15 && Math.abs((s.search.rect.top - end.search.rect.top) - s.header.y) < .15, "Header children do not inherit divider movement");
      }
    }
    cases.push({ test: "held-layout", label, width: f.width, baseline: f.baseline, from, to, frames, end, cleanup });
  }
  try {
    const baseline = await setup({ baseline: true }); try { await held(baseline, "calendar", "home", "baseline-dashboard-forward-835"); } finally { await close(baseline.c); }
    for (const width of [835, 1280]) {
      const f = await setup({ width, height: width === 835 ? 746 : 900 });
      try {
        await held(f, "calendar", "home", `dashboard-forward-${width}`); await held(f, "tasks", "home", `dashboard-back-${width}`); await held(f, "tasks", "calendar", `calendar-back-${width}`);
        if (width === 835) for (const [from, to] of [["home", "tasks"], ["tasks", "classes"], ["classes", "goals"], ["goals", "notes"], ["notes", "settings"]]) await held(f, from, to, `section-${to}-835`);
      } finally { await close(f.c); }
    }
    for (const spec of [{ reduced: true }, { width: 390, height: 844, touch: true }]) {
      const f = await setup(spec); try { for (const to of ["tasks", "calendar"]) { await f.p.locator(`${spec.touch ? ".phone-bottom-nav" : ".sidebar"} [data-view="${to}"]`).click(); check(await f.p.evaluate(to => document.body.dataset.view === to && !document.documentElement.dataset.pageTransition, to), "Fallback was not immediate"); } cases.push({ test: "immediate-fallback", spec, cleanup: await clean(f.p) }); } finally { await close(f.c); }
    }
    const input = await setup(); try {
      for (const target of ["checkbox", "slot"]) {
        await input.p.evaluate(target => { setView(target === "checkbox" ? "calendar" : "tasks", true); document.querySelector("#planner-calendar").scrollTop = 0; }, target);
        await input.p.locator(`.sidebar [data-view="${target === "checkbox" ? "tasks" : "calendar"}"]`).click(); await input.p.waitForFunction(() => document.documentElement.dataset.pageTransitionPhase === "animate"); await input.p.evaluate(() => new Promise(r => setTimeout(r, 220)));
        const point = await input.p.evaluate(target => { const e = document.querySelector(target === "checkbox" ? "#view-tasks input.task-check" : ".calendar-slot"), b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, sameHit: document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) === e, id: e.dataset.taskId, date: e.dataset.slotDate, time: e.dataset.slotTime, before: store.listItems().map(t => ({ id: t.id, completed: t.completed })) }; }, target);
        await input.p.mouse.click(point.x, point.y, { delay: 100 });
        if (target === "slot") await input.p.locator("#task-modal").waitFor({ state: "visible" });
        const after = await input.p.evaluate(() => ({ items: store.listItems().map(t => ({ id: t.id, completed: t.completed })), open: document.querySelector("#task-modal").open, date: document.querySelector('[name="scheduledDate"]').value, time: document.querySelector('[name="scheduledTime"]').value }));
        const changes = after.items.filter(t => point.before.find(b => b.id === t.id)?.completed !== t.completed);
        check(point.sameHit && (target === "checkbox" ? changes.length === 1 && changes[0].id === point.id : after.open && after.date === point.date && after.time === point.time), "Moving control lost its trusted click");
        if (after.open) { await input.p.locator("#close-task-modal").click(); await input.p.waitForFunction(() => !document.querySelector("#task-modal").open); }
        await input.p.waitForFunction(() => !document.documentElement.dataset.pageTransition); cases.push({ test: "trusted-moving-input", target, point, after, cleanup: await clean(input.p) });
      }
    } finally { await close(input.c); }
    check(!errors.length && !failed.length && !blocked.length, "Browser errors or unexpected traffic: " + JSON.stringify({ errors, failed, blocked }));
    return { runtime: browser.version(), mode: "Isolated signed-out fixture; API/external traffic blocked", cases, errors, failed, blocked, allSyntheticContextsClosed: contexts.size === 0 };
  } catch (error) { return { runtime: browser.version(), stage, harnessError: error.message, cases, errors, failed, blocked }; }
  finally { for (const c of contexts) await c.close(); }
}
