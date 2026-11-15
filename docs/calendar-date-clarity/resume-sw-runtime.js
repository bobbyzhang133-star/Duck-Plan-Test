// Actual service-worker cache/offline tab check. This is not an installed-PWA test.
async (page) => {
  const expectedCache = "duckplan-app-motion-preview-v60";
  const expectedDigests = {"calendar-date-presentation.js": "f875c2e1fd713bbb3fec9fd32307eb3b132edb8f302b541a1358310fd7735449", "calendar-date-clarity.css": "25fb6e89594053b53dba504b60c71d2c8e767a512fce28482f4997049a768d41", "calendar-task-preview.js": "2e0f282ed765031e0d74f2fae3042e0ff7b62c420eb2bb2bbee60c0c0eaf2f67", "calendar-task-preview.css": "ede7c54abf6d1bec60e2b62ac322381ec0616cb69f89f37ee3f65eb171ed6b04", "app.js": "12392e93dadb64890e8937b3897d08fbed7b38e4b341e43002a469a3840014d9", "index.html": "64f0ce52290b882cc61b7c9b22f32865a6c0e9e13af89824fda67339283fd718"};
  const origin = "http://127.0.0.1:8034", browser = page.context().browser(), errors = [], offlineAssets = [];
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 20000 });
  const c = await browser.newContext({ viewport: { width: 320, height: 740 }, hasTouch: true, isMobile: true, timezoneId: "America/Los_Angeles", locale: "en-US", reducedMotion: "reduce", colorScheme: "dark", serviceWorkers: "allow" });
  const prefix = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0"), taskId = prefix + "-0000-4000-8000-000000000001", secondId = prefix + "-0000-4000-8000-000000000002";
  const rows = [{ id: taskId, title: "Offline calendar work fixture", dueDate: "2026-11-20", dueTime: "18:00", scheduledStart: "2026-11-20T14:00", durationMinutes: 45, completed: false, priority: "Medium", schemaVersion: 2 },
    { id: secondId, title: "Offline calendar deadline fixture", dueDate: "2026-11-20", dueTime: "21:00", scheduledStart: null, durationMinutes: 45, completed: false, priority: "Medium", schemaVersion: 2 }];
  const p = await c.newPage(); p.setDefaultTimeout(20000); p.setDefaultNavigationTimeout(60000); p.on("pageerror", e => errors.push(e.message));
  let offline = false, stage = "setup", diagnostic = null, cached = null;
  p.on("response", r => { const name = new URL(r.url()).pathname === "/" ? "index.html" : new URL(r.url()).pathname.slice(1); if (offline && Object.hasOwn(expectedDigests, name)) offlineAssets.push({ name, status: r.status(), fromServiceWorker: r.fromServiceWorker() }); });
  await c.addInitScript(rows => {
    if (localStorage.getItem("calendar-sw-fixture-v1")) return;
    localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify(rows)); localStorage.setItem("duckplan-demo-classes-v1", "[]"); localStorage.setItem("calendar-sw-fixture-v1", "ready");
  }, rows);
  try {
    await p.clock.install({ time: new Date("2026-11-20T12:00:00-08:00") }); await p.goto(origin + "/?qa=calendar-resume-sw#calendar", { waitUntil: "domcontentloaded" }); await p.bringToFront();
    await wait(p, () => typeof store !== "undefined" && workAlertContextReady && store.mode === "local");
    stage = "real registration activation and exact cache digests";
    await p.evaluate(async () => {
      let timer;
      try { const registration = await Promise.race([DuckPlanApp.ready, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Actual SW ready did not settle")), 20000); })]); if (!registration?.active) throw new Error("SW registration has no active worker"); }
      finally { clearTimeout(timer); }
    });
    await wait(p, () => Boolean(navigator.serviceWorker.controller));
    cached = await p.evaluate(async ({ expectedCache, names }) => {
      const keys = await caches.keys(), cache = await caches.open(expectedCache), assets = {};
      for (const name of names) {
        const response = await cache.match(new URL("/" + name, location.origin));
        if (!response) { assets[name] = null; continue; }
        const hash = await crypto.subtle.digest("SHA-256", await response.arrayBuffer());
        assets[name] = [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2,"0")).join("");
      }
      return { keys, assets, scope: (await navigator.serviceWorker.getRegistration()).scope,cacheURLs:(await cache.keys()).map(r=>r.url),pageURL:location.href };
    }, { expectedCache, names: Object.keys(expectedDigests) });
    assert(cached.keys.includes(expectedCache), "Current service-worker cache is not active");
    assert(Object.keys(expectedDigests).length >= 5, "Frozen source digest expectations were not initialized");
    for (const [name, digest] of Object.entries(expectedDigests)) assert(cached.assets[name] === digest, "Cache missing or stale for " + name);
    await p.reload({ waitUntil: "domcontentloaded" }); await wait(p, () => typeof store !== "undefined" && workAlertContextReady);
    stage = "focused Reschedule field visible within form and viewport";
    await p.evaluate(() => { selectedDate="2026-11-20";calendarView="day";calendarUserScrolled=true;renderAll({autoScrollCalendar:false}); });
    await p.evaluate(()=>{
      window.__resumeFocusLayoutSamples=[];
      document.addEventListener('focusin',event=>{const modal=document.querySelector('#task-modal'),form=document.querySelector('#task-form'),details=document.querySelector('#task-detail-options');if(!modal.contains(event.target))return;const r=form.elements.scheduledDate.getBoundingClientRect();window.__resumeFocusLayoutSamples.push({target:event.target.name||event.target.id,detailsOpen:details.open,detailsHeight:details.getBoundingClientRect().height,formScrollHeight:form.scrollHeight,formScrollTop:form.scrollTop,workDateTop:r.top,workDateBottom:r.bottom});},true);
    });
    await p.locator(`.calendar-event-block[data-edit-task="${taskId}"]`).tap();await wait(p,()=>document.querySelector("#calendar-task-preview")?.open);
    await p.locator("#calendar-preview-reschedule").tap();await wait(p,()=>document.querySelector("#task-modal").open&&document.activeElement?.name==="scheduledDate");
    await p.waitForFunction(()=>{const a=document.querySelector('[name="scheduledDate"]').getBoundingClientRect(),f=document.querySelector('#task-form'),b=f.getBoundingClientRect();return Math.min(a.bottom,b.top+f.clientTop+f.clientHeight,innerHeight)>Math.max(a.top,b.top+f.clientTop,0);},undefined,{timeout:2000}).catch(()=>{});
    const focusVisibility=await p.evaluate(()=>{
      const input=document.querySelector('[name="scheduledDate"]'),form=document.querySelector('#task-form'),a=input.getBoundingClientRect(),b=form.getBoundingClientRect();
      const clip={left:Math.max(0,b.left+form.clientLeft),right:Math.min(innerWidth,b.left+form.clientLeft+form.clientWidth),top:Math.max(0,b.top+form.clientTop),bottom:Math.min(innerHeight,b.top+form.clientTop+form.clientHeight)};
      const visibleWidth=Math.max(0,Math.min(a.right,clip.right)-Math.max(a.left,clip.left)),visibleHeight=Math.max(0,Math.min(a.bottom,clip.bottom)-Math.max(a.top,clip.top));
      return {focused:document.activeElement===input,formMetrics:{scrollTop:form.scrollTop,clientHeight:form.clientHeight,scrollHeight:form.scrollHeight,overflowY:getComputedStyle(form).overflowY,scrollBehavior:getComputedStyle(form).scrollBehavior,inputOffsetTop:input.offsetTop},ancestors:[...(()=>{const a=[];for(let e=input.parentElement;e;e=e.parentElement){const r=e.getBoundingClientRect();a.push({tag:e.tagName,id:e.id,top:r.top,bottom:r.bottom,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,scrollTop:e.scrollTop,overflowY:getComputedStyle(e).overflowY});if(e.id==='task-modal')break;}return a;})()],field:{left:a.left,right:a.right,top:a.top,bottom:a.bottom,width:a.width,height:a.height},clip,visibleWidth,visibleHeight,fullyVisible:visibleWidth>=a.width-1&&visibleHeight>=a.height-1};
    });
    assert(focusVisibility.focused&&focusVisibility.fullyVisible,"Focused Reschedule date is clipped outside visible form: "+JSON.stringify(focusVisibility));
    await p.keyboard.press("Escape");await wait(p,()=>!document.querySelector("#task-modal").open);
    await p.locator("#phone-add-task").tap();await wait(p,()=>document.querySelector("#task-modal").open&&document.activeElement?.name==="title");
    await p.waitForFunction(()=>{const a=document.querySelector('#task-form [name="title"]').getBoundingClientRect(),f=document.querySelector('#task-form'),b=f.getBoundingClientRect();return Math.min(a.bottom,b.top+f.clientTop+f.clientHeight,innerHeight)>Math.max(a.top,b.top+f.clientTop,0);},undefined,{timeout:2000}).catch(()=>{});
    const reopenedTitleVisibility=await p.evaluate(()=>{
      const input=document.querySelector('#task-form [name="title"]'),form=document.querySelector('#task-form'),a=input.getBoundingClientRect(),b=form.getBoundingClientRect();
      const clip={left:Math.max(0,b.left+form.clientLeft),right:Math.min(innerWidth,b.left+form.clientLeft+form.clientWidth),top:Math.max(0,b.top+form.clientTop),bottom:Math.min(innerHeight,b.top+form.clientTop+form.clientHeight)};
      const visibleWidth=Math.max(0,Math.min(a.right,clip.right)-Math.max(a.left,clip.left)),visibleHeight=Math.max(0,Math.min(a.bottom,clip.bottom)-Math.max(a.top,clip.top));
      return {focused:document.activeElement===input,newTask:editingTaskId===null,field:{left:a.left,right:a.right,top:a.top,bottom:a.bottom,width:a.width,height:a.height},clip,formScrollTop:form.scrollTop,visibleWidth,visibleHeight,fullyVisible:visibleWidth>=a.width-1&&visibleHeight>=a.height-1};
    });
    assert(reopenedTitleVisibility.focused&&reopenedTitleVisibility.newTask&&reopenedTitleVisibility.fullyVisible,"Reopened Add title remains clipped from prior editor scroll: "+JSON.stringify(reopenedTitleVisibility));
    await p.keyboard.press("Escape");await wait(p,()=>!document.querySelector("#task-modal").open);
    const focusLayoutSamples=await p.evaluate(()=>window.__resumeFocusLayoutSamples);
    stage = "offline reload loads all new assets and interactive Month preview";
    offline = true; await c.setOffline(true); await p.reload({ waitUntil: "domcontentloaded" });
    await wait(p, () => typeof store !== "undefined" && workAlertContextReady && typeof DuckCalendarDatePresentation !== "undefined" && typeof DuckCalendarTaskPreview !== "undefined");
    await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; selectedDate = "2026-11-20"; calendarView = "month"; renderAll({ autoScrollCalendar: false }); });
    const agenda = p.locator('.month-selected-agenda');
    assert(await agenda.locator('[data-calendar-kind="work"]').count() === 1 && await agenda.locator('[data-calendar-kind="deadline"]').count() === 2, "Offline Month layers did not render");
    await agenda.locator(`[data-edit-task="${taskId}"][data-calendar-kind="work"]`).tap(); await wait(p, () => document.querySelector("#calendar-task-preview")?.open);
    assert((await p.locator("#calendar-preview-title").textContent()) === rows[0].title, "Offline preview opened wrong task");
    await p.locator("#calendar-preview-edit").tap(); await wait(p, () => document.querySelector("#task-modal").open);
    await p.locator('#task-form [name="title"]').fill("Offline calendar work edited"); await p.locator("#save-task").tap(); await wait(p, () => !document.querySelector("#task-modal").open);
    await p.reload({ waitUntil: "domcontentloaded" }); await wait(p, id => typeof store !== "undefined" && workAlertContextReady && store.listItems().find(t => t.id === id)?.title === "Offline calendar work edited", taskId);
    const named = new Set(offlineAssets.filter(r => r.fromServiceWorker && r.status === 200).map(r => r.name));
    for (const name of Object.keys(expectedDigests)) assert(named.has(name), "Offline request was not served by actual SW: " + name);
    stage = "online reconnect persistence"; offline = false; await c.setOffline(false); await p.reload({ waitUntil: "domcontentloaded" });
    await wait(p, id => typeof store !== "undefined" && workAlertContextReady && store.listItems().find(t => t.id === id)?.title === "Offline calendar work edited", taskId);
    assert(!errors.length, "Browser errors during offline shell operation");
    return { status: "PASS", runtime: browser.version(), viewport: [320,740], touchEmulation: true, mode: "local regular browser tab + actual service worker", expectedCache, cached, focusVisibility, reopenedTitleVisibility, focusLayoutSamples, offlineAssets,
      assertions: ["All4 new assets plus app.js and index.html match frozen SHA-256 in active cache", "Offline navigation reload obtains assets from actual service worker", "Focused Reschedule and reopened Add fields are visible", "Offline Month/agenda/preview/Edit work", "Offline edit survives reload and online reconnect"],
      errors, installedPWAClaim: false, physicalDeviceClaim: false, syntheticContextClosed: true };
  } catch (error) {
    diagnostic = await p.evaluate(() => ({ mode: typeof store === "undefined" ? null : store.mode, ready: typeof workAlertContextReady === "undefined" ? null : workAlertContextReady, controller: Boolean(navigator.serviceWorker.controller), modal: document.querySelector("#task-modal")?.open, taskError: document.querySelector("#task-form-error")?.textContent })).catch(() => null);
    return { status: "FAIL", runtime: browser.version(), stage, error: error.message, diagnostic, cached,expectedDigests,errors, offlineAssets };
  } finally { await c.setOffline(false); await c.close(); }
}
