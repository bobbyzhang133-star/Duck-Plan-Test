// Isolated browser measurement; never touches user tabs, accounts or planner data.
async (page) => {
  const baseline = {}; // Candidate uses served source; baseline is pinned in measure.js.
  const browser = page.context().browser(), origin = "http://127.0.0.1:8034";
  const variant = "candidate";
  const cases = [], errors = [], blocked = [], contexts = new Set();
  async function setup(width, height, variant, video = false) {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block", ...(video ? { recordVideo: { dir: "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/smooth-navigation/raw-video", size: { width, height } } } : {}) });
    contexts.add(context);
    await context.route("**/*", route => {
      const u = new URL(route.request().url());
      if (u.origin !== origin || u.pathname.startsWith("/api/")) { blocked.push(u.origin + u.pathname); return route.abort(); }
      if (variant === "baseline" && u.pathname.endsWith("/view-transitions.js")) return route.fulfill({ contentType: "application/javascript", body: baseline.js });
      if (variant === "baseline" && u.pathname.endsWith("/page-stack.css")) return route.fulfill({ contentType: "text/css", body: baseline.css });
      if (variant === "baseline" && u.pathname === "/app.js") return route.fulfill({ contentType: "application/javascript", body: baseline.app });
      return route.continue();
    });
    await context.addInitScript(() => {
      const qa = window.__smoothQA = { calls: [], longTasks: [], clicks: [], events: [] };
      for(const name of ["blur","resize","pagehide"]) window.addEventListener(name,()=>qa.events.push({name,time:performance.now()}));
      for(const name of ["pointerdown","focusin","keydown","wheel","touchstart"]) document.addEventListener(name,e=>qa.events.push({name,time:performance.now(),target:e.target?.id||e.target?.tagName}),true);
      document.addEventListener("click", e => { if (e.target.closest?.(".sidebar .nav-item")) qa.clicks.push(performance.now()); }, true);
      try { new PerformanceObserver(list => qa.longTasks.push(...list.getEntries().map(e => ({ startTime: e.startTime, duration: e.duration })))).observe({ type: "longtask", buffered: true }); } catch {}
      const native = document.startViewTransition.bind(document);
      document.startViewTransition = update => {
        const start = performance.now(), call = { start, clickElapsed: start - qa.clicks.at(-1), frames: [], readyElapsed: null, done: false };
        qa.calls.push(call);
        const transition = native(() => { call.updateStart = performance.now() - start; const value = update(); call.updateEnd = performance.now() - start; return value; });
        const skip=transition.skipTransition.bind(transition);
        transition.skipTransition=()=>{call.skips ||= [];call.skips.push({elapsed:performance.now()-start,done:call.done});return skip();};
        transition.finished.then(() => { call.nativeDone = true; call.nativeFinishedElapsed = performance.now() - start; }, e => { call.nativeDone = true; call.finishedError = e.name; });
        transition.ready.then(() => {
          call.readyElapsed = performance.now() - start;
          const trace = now => { if (call.done || qa.calls.at(-1) !== call) return; if (!document.documentElement.dataset.pageTransition) { call.done=true; call.finishedElapsed=performance.now()-start; return; } call.frames.push(now); requestAnimationFrame(trace); };
          requestAnimationFrame(trace);
        }, e => { call.readyError = e.name; call.done = true; });
        return transition;
      };
    });
    const p = await context.newPage(); p.setDefaultTimeout(5000); p.setDefaultNavigationTimeout(10000);
    p.on("pageerror", e => errors.push(e.message));
    await p.goto(origin + "/?qa=smooth-navigation#calendar");
    await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length > 0, null, { timeout: 5000 });
    const cdp = await context.newCDPSession(p);
    await cdp.send("Performance.enable");
    return { context, p, cdp };
  }
  const visit = (p, route) => p.locator(`.sidebar .nav-item[data-view="${route}"]`).click();
  async function settle(p) { await p.waitForFunction(() => window.__smoothQA.calls.at(-1)?.done && !document.documentElement.dataset.pageTransition, null, { timeout: 5000 }); await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); }
  async function report(p) {
    return p.evaluate(() => ({ calls: window.__smoothQA.calls.map(c => {
      const gaps = c.frames.slice(1).map((t, i) => t - c.frames[i]);
      return { ...c, frames: c.frames.length, gaps, medianGap: [...gaps].sort((a,b)=>a-b)[Math.floor(gaps.length/2)], maxGap: Math.max(...gaps), updateDuration: c.updateEnd-c.updateStart };
    }), longTasks: window.__smoothQA.longTasks, events:window.__smoothQA.events, clean: { attrs: [...document.documentElement.attributes].filter(a=>a.name.startsWith("data-page-transition")).map(a=>a.name), names: document.querySelectorAll('[style*="view-transition-name"]').length } }));
  }
  try {
    for (const [width,height] of [[835,747],[1280,900]]) {
      const f = await setup(width,height,variant);
      try {
        const routes = ["tasks","calendar","settings","home","classes","goals","notes","calendar","tasks","calendar"];
        const metrics = [];
        for (const route of routes) {
          const before = Object.fromEntries((await f.cdp.send("Performance.getMetrics")).metrics.map(m=>[m.name,m.value]));
          await visit(f.p,route); await settle(f.p);
          const after = Object.fromEntries((await f.cdp.send("Performance.getMetrics")).metrics.map(m=>[m.name,m.value]));
          metrics.push({route,delta:Object.fromEntries(["LayoutCount","RecalcStyleCount","LayoutDuration","RecalcStyleDuration","ScriptDuration","TaskDuration"].map(k=>[k,after[k]-before[k]]))});
        }
        cases.push({ test:"raf-navigation",variant,width,height,routes,metrics,...await report(f.p) });
        // Pointer entry currently aborts at the moment it enters the snapshot.
        await visit(f.p,"tasks");
        await f.p.waitForFunction(() => document.documentElement.dataset.pageTransitionPhase === "animate",null,{timeout:5000});
        await f.p.evaluate(() => new Promise(r => setTimeout(r,100)));
        const before = await f.p.evaluate(() => ({ state: document.documentElement.dataset.pageTransitionPhase, callElapsed: performance.now()-window.__smoothQA.calls.at(-1).start }));
        await f.p.mouse.move(150,300);
        const after = await f.p.evaluate(() => ({ state: document.documentElement.dataset.pageTransitionPhase||null, callElapsed: performance.now()-window.__smoothQA.calls.at(-1).start }));
        await settle(f.p);
        cases.push({test:"pointer-entry",variant,width,height,before,after,...await report(f.p)});
      } finally { await f.context.close(); contexts.delete(f.context); }
    }
    return { runtime:browser.version(), source:variant === "baseline" ? baseline.identity : "Current served candidate controller/CSS", mode:"Fresh signed-out local fixture, API/external blocked; RAF-only main samples, no per-frame style reads", cases, errors, blocked, allSyntheticContextsClosed:contexts.size===0 };
  } finally { for (const c of contexts) await c.close(); }
}
