// Resumed bounded verification of Month marker layout, gutter bounds and Reschedule focus.
async (page) => {
  const browser = page.context().browser(), contexts = [], cases = [], errors = [];
  let fixturePrefix = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  const id = n => `${fixturePrefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const base = { classId: id(90), priority: "Medium", durationMinutes: 60, notes: "Keep deadline and work time independent", completed: false, source: "manual", schemaVersion: 2 };
  const manualAlerts = { version: 1, timeZone: "America/Los_Angeles", alarm: { enabled: true, mode: "manual", at: "2026-11-21T16:30", sound: "gentle", snoozeMinutes: 10 }, notification: { enabled: true, mode: "manual", at: "2026-11-21T17:15" } };
  const rows = [
    { title: "Overdue but working today", dueDate: "2026-11-19", dueTime: "18:00", scheduledStart: "2026-11-20T14:00" },
    { title: "Overdue with future work", dueDate: "2026-11-19", dueTime: "17:00", scheduledStart: "2026-11-21T15:00" },
    { title: "Due today with future work", dueDate: "2026-11-20", dueTime: "17:00", scheduledStart: "2026-11-21T10:00" },
    { title: "Work and due on same day", dueDate: "2026-11-20", dueTime: "16:00", scheduledStart: "2026-11-20T10:00" },
    { title: "Work finishes after same-day deadline", dueDate: "2026-11-20", dueTime: "09:00", scheduledStart: "2026-11-20T08:30", durationMinutes: 90 },
    { title: "Overnight work crosses deadline", dueDate: "2026-11-21", dueTime: "00:15", scheduledStart: "2026-11-20T23:30", durationMinutes: 60 },
    { title: "Drag keeps manual alerts and deadline", dueDate: "2026-11-22", dueTime: "17:00", scheduledStart: "2026-11-20T16:00", workAlerts: manualAlerts },
    { title: "Unscheduled backlog", dueDate: "", dueTime: "", scheduledStart: null },
    { title: "Due today without work slot", dueDate: "2026-11-20", dueTime: "19:00", scheduledStart: null },
    { title: "Completed work and due today", dueDate: "2026-11-20", dueTime: "18:00", scheduledStart: "2026-11-20T11:00", completed: true },
    { title: "Overdue without work", dueDate: "2026-11-18", dueTime: "17:00", scheduledStart: null },
    { title: 'Quoted" data-fixture-injected="yes <img src=x onerror="1"> & extra-long name', dueDate: "2026-11-20", dueTime: "20:00", scheduledStart: null },
    { title: "Overflow deadline five", dueDate: "2026-11-20", dueTime: "21:00", scheduledStart: null },
    { title: "Overflow deadline six", dueDate: "2026-11-20", dueTime: "22:00", scheduledStart: null },
    { title: "Date-only overflow deadline", dueDate: "2026-11-20", dueTime: "", scheduledStart: null },
    { title: "Quiet month dual occurrence", dueDate: "2026-11-23", dueTime: "18:00", scheduledStart: "2026-11-23T11:00" },
    { title: "Completed month dual occurrence", dueDate: "2026-11-24", dueTime: "14:00", scheduledStart: "2026-11-24T11:00", completed: true },
  ].map((t, i) => ({ ...base, dueDate: "", dueTime: "", scheduledStart: null, ...t, id: id(i + 1) }));
  rows.push(...Array.from({ length: 11 }, (_, index) => ({ ...base, id: id(18 + index), title: `Busy count fixture ${index + 1}`, dueDate: "2026-11-20", dueTime: "22:30", scheduledStart: `2026-11-20T${String(index + 1).padStart(2,"0")}:00` })));
  const classes = [{ id: id(90), name: "Fixture Science", color: "#39896f", code: "QA", teacher: "Fixture", period: "2", archived: false }];
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 15000 });
  const artifacts = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-date-clarity/";
  let stage = "setup", diagnostic = null;
  async function setup(config) {
    fixturePrefix = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
    rows.forEach((row, index) => { row.id = id(index + 1); row.classId = id(90); }); classes[0].id = id(90);
    const caseRows = config.singleDigit ? rows.slice(0,17) : rows;
    const origin = config.cloud ? "http://127.0.0.1:8796" : "http://127.0.0.1:8034";
    const c = await browser.newContext({ viewport: { width: config.width, height: config.height || 1000 }, timezoneId: "America/Los_Angeles", locale: "en-US", hasTouch: Boolean(config.touch), isMobile: config.width < 700, colorScheme: config.dark ? "dark" : "light", reducedMotion: config.reduce ? "reduce" : "no-preference", serviceWorkers: "block" }); contexts.push(c);
    await c.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    if (config.cloud) {
      const signup = await c.request.post(origin + "/api/auth/sign-up", { headers: { Origin: origin }, data: { email: `calendar-clarity-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`, password: `Fixture-${Date.now()}-OnlyLocalQA` } }); assert(signup.status() === 201, "Synthetic signup failed");
      const response = await c.request.post(origin + "/api/import", { headers: { Origin: origin }, data: { classRows: classes.map(t => ({ id: t.id, name: t.name, color: t.color, code: t.code, teacher: t.teacher, period: t.period })), itemRows: caseRows.map(t => ({ id: t.id, class_id: t.classId, title: t.title, due_date: t.dueDate || null, due_time: t.dueTime || null, scheduled_start: t.scheduledStart, duration_minutes: t.durationMinutes, completed: t.completed, priority: t.priority, notes: t.notes, ...(t.workAlerts ? { work_alerts: JSON.stringify(t.workAlerts) } : {}) })) } }); assert(response.ok(), "Synthetic fixture import failed " + response.status());
    } else await c.addInitScript(({ rows, classes }) => {
      if (localStorage.getItem("calendar-clarity-fixture-v1")) return;
      localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify(rows)); localStorage.setItem("duckplan-demo-classes-v1", JSON.stringify(classes)); localStorage.setItem("calendar-clarity-fixture-v1", "ready");
    }, { rows: caseRows, classes });
    const p = await c.newPage(); p.setDefaultTimeout(15000); p.setDefaultNavigationTimeout(60000); p.on("pageerror", e => errors.push({ mode: config.cloud ? "cloud" : "local", width: config.width, error: e.message }));
    await p.clock.install({ time: new Date("2026-11-20T12:00:00-08:00") }); await p.goto(origin + "/?qa=calendar-date-clarity-resume#calendar", { waitUntil: "domcontentloaded" }); await p.bringToFront();
    await wait(p, ({ cloud, target }) => typeof store !== "undefined" && workAlertContextReady && store.mode === (cloud ? "cloud" : "local") && store.listItems().some(t => t.id === target), { cloud: config.cloud, target: id(16) });
    await p.evaluate(dark => { document.documentElement.dataset.theme = dark ? "dark" : "light"; selectedDate = "2026-11-20"; calendarView = "day"; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); }, config.dark);
    if (config.cloud) { await p.evaluate(() => store.refresh()); await p.waitForLoadState("networkidle"); }
    await p.locator(".timeline-deadline-label").waitFor({ state:"visible" });
    return { c, p, origin, ...config, mode: config.cloud ? "signed-in isolated real Worker" : "local browser storage" };
  }
  const act = (f, locator) => f.touch ? locator.tap() : locator.click();
  async function gutterAndFocus(f, focusEnabled = true) {
    const gutter = await f.p.locator(".timeline-deadline-label").evaluate(el => {
      const rect = el.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(el); const text = range.getBoundingClientRect(), style = getComputedStyle(el);
      return { label: el.textContent.trim(), accessible: el.getAttribute("aria-label"), left: rect.left, right: rect.right, textLeft: text.left, textRight: text.right, paddingLeft: parseFloat(style.paddingLeft), paddingRight: parseFloat(style.paddingRight), width: rect.width, textWidth: text.width };
    });
    assert(gutter.label === "Due" && gutter.accessible === "Deadlines" && gutter.textLeft >= gutter.left + gutter.paddingLeft - 1 && gutter.textRight <= gutter.right - gutter.paddingRight + 1, "Due gutter text exceeds its axis bounds: " + JSON.stringify(gutter));
    if (!focusEnabled) return { gutter, focus: { status: "NOT RUN IN MARKER PHASE", reason: "Separate focus regression/retest" } };
    const work = f.p.locator(`.calendar-event-block[data-edit-task="${id(7)}"]`); await act(f, work); await wait(f.p, () => document.querySelector("#calendar-task-preview")?.open);
    await act(f, f.p.locator("#calendar-preview-reschedule")); await wait(f.p, () => document.querySelector("#task-modal").open && document.activeElement?.name === "scheduledDate");
    const focus = await f.p.evaluate(() => ({ id: editingTaskId, name: document.activeElement.name, date: els.form.elements.scheduledDate.value, time: els.form.elements.scheduledTime.value }));
    assert(focus.id === id(7) && focus.date === "2026-11-20" && focus.time === "16:00", "Reschedule focus points to wrong work fields");
    await f.p.keyboard.press("Tab"); const tabFocus = await f.p.evaluate(() => ({ tag: document.activeElement.tagName, name: document.activeElement.name }));
    assert(await f.p.locator("#task-modal").evaluate(e => e.contains(document.activeElement)), "Reschedule keyboard navigation escapes its editor");
    await f.p.keyboard.press("Escape"); await wait(f.p, () => !document.querySelector("#task-modal").open);
    let earlyInteraction = { status:"NOT APPLICABLE", reason:"Reduced motion has no delayed focus callback window" }, cancelDuringOpen = {status:"NOT APPLICABLE"};
    if (!f.reduce) {
      await act(f,work); await wait(f.p,()=>document.querySelector("#calendar-task-preview")?.open); await act(f,f.p.locator("#calendar-preview-reschedule"));
      await wait(f.p,()=>document.querySelector("#task-modal").open && document.querySelector("#task-modal").dataset.popupMotion==="opening" && !document.querySelector("#task-modal form").inert);
      await f.p.evaluate(()=>{
        window.__resumeEarlyKey=null;
        const record=event=>{if(event.key!=="Tab"||!event.target.closest("#task-modal"))return;window.__resumeEarlyKey={trusted:event.isTrusted,motion:document.querySelector("#task-modal").dataset.popupMotion};document.removeEventListener("keydown",record,true);};
        document.addEventListener("keydown",record,true);
      });
      await f.p.keyboard.press("Tab"); const chosen=await f.p.evaluate(()=>({id:document.activeElement.id,name:document.activeElement.name,key:window.__resumeEarlyKey}));
      assert(chosen.key?.trusted && chosen.key.motion==="opening","Trusted early keyboard interaction missed opening window");
      await wait(f.p,()=>!document.querySelector("#task-modal").dataset.popupMotion);
      const after=await f.p.evaluate(()=>({id:document.activeElement.id,name:document.activeElement.name}));
      assert(after.id===chosen.id&&after.name===chosen.name,"Delayed Reschedule focus stole user's chosen control");
      earlyInteraction={status:"PASS",chosen,after};
      await f.p.keyboard.press("Escape"); await wait(f.p,()=>!document.querySelector("#task-modal").open);
      await act(f,work); await wait(f.p,()=>document.querySelector("#calendar-task-preview")?.open); await act(f,f.p.locator("#calendar-preview-reschedule"));
      await wait(f.p,()=>document.querySelector("#task-modal").open&&document.querySelector("#task-modal").dataset.popupMotion==="opening");
      await f.p.keyboard.press("Escape"); await wait(f.p,()=>!document.querySelector("#task-modal").open&&!document.querySelector("#task-modal").dataset.popupMotion);
      assert(!await f.p.locator("#task-modal").evaluate(el=>el.contains(document.activeElement)),"Canceled opening refocused its closed editor");
      cancelDuringOpen={status:"PASS"};
    }
    return { gutter, focus: { ...focus, taskId: undefined }, tabFocus,earlyInteraction,cancelDuringOpen };
  }
  async function month(f) {
    await act(f, f.p.locator('[data-calendar-view="month"]')); await wait(f.p, () => Boolean(document.querySelector(".calendar-layered-month")));
    const busy = () => f.p.locator('.month-day[data-date="2026-11-20"]');
    const label = await busy().locator('.month-date-button').getAttribute("aria-label");
    const expected = f.singleDigit ? { due:9, work:6, tasks:12 } : { due:20, work:17, tasks:23 };
    assert(label.includes(`${expected.due} deadlines`) && label.includes(`${expected.work} work sessions`) && label.includes(`${expected.tasks} tasks`), "Occurrence/unique semantics changed: " + label);
    const bounds = await f.p.evaluate(() => {
      const rect = el => { const r = el.getBoundingClientRect(); return { left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height }; };
      return [...document.querySelectorAll('.month-day')].map(cell => {
        const cluster = cell.querySelector('.month-kind-markers'), visible = getComputedStyle(cluster).display !== 'none';
        const markers = [...cluster.children].map(marker => ({ rect:rect(marker), kind:marker.className, text:marker.textContent, icon:rect(marker.querySelector('svg')), count:rect(marker.querySelector('b')), scroll:marker.scrollWidth, client:marker.clientWidth }));
        const textRects = [...cell.querySelectorAll('.month-entry small,.month-entry-counts')].filter(el=>el.getClientRects().length).flatMap(el=>{const range=document.createRange();range.selectNodeContents(el);return [...range.getClientRects()].map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}));});
        return { date:cell.dataset.date, cell:rect(cell), cluster:rect(cluster), visible, markers, textRects, entries:[...cell.querySelectorAll('.month-entry')].filter(el=>el.getClientRects().length).map(rect) };
      });
    });
    const fits = (child,parent) => child.left >= parent.left - 1 && child.right <= parent.right + 1 && child.top >= parent.top - 1 && child.bottom <= parent.bottom + 1;
    for (const cell of bounds) {
      if (cell.visible && cell.markers.length) {
        assert(fits(cell.cluster,cell.cell), "Marker cluster exceeds its date cell " + cell.date);
        for (const marker of cell.markers) {
          assert(fits(marker.rect,cell.cell) && fits(marker.icon,cell.cell) && fits(marker.count,cell.cell), "Marker/icon/count bleeds into adjacent cell " + cell.date + ":" + marker.text);
          assert(marker.scroll <= marker.client + 1 && marker.icon.width >= 8 && marker.icon.height >= 8, "Count or kind icon is clipped/unreadable " + cell.date);
        }
        for (let i=0;i<cell.markers.length;i++) for (let j=i+1;j<cell.markers.length;j++) {
          const a=cell.markers[i].rect,b=cell.markers[j].rect;
          assert(Math.min(a.right,b.right)-Math.max(a.left,b.left)<=1 || Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=1, "Work/deadline counts overlap each other " + cell.date);
        }
      } else {
        for (const entry of cell.entries) assert(fits(entry,cell.cell), "Desktop Month entry exceeds own date cell: " + JSON.stringify({date:cell.date,entry,cell:cell.cell}));
        for (const text of cell.textRects) assert(fits(text,cell.cell), "Month time/footer text exceeds own date cell: " + JSON.stringify({date:cell.date,text,cell:cell.cell}));
      }
    }
    await act(f, f.p.locator('.month-date-button[data-date="2026-11-23"]')); await wait(f.p, () => selectedDate === "2026-11-23");
    if(f.width<700) {
      const agenda=f.p.locator('.month-selected-agenda'); assert(await agenda.locator('[data-calendar-kind="work"]').count()===1 && await agenda.locator('[data-calendar-kind="deadline"]').count()===1,"Single-digit date selection loses agenda occurrences");
      await act(f,agenda.locator('[data-calendar-kind="work"]')); await wait(f.p,()=>document.querySelector('#calendar-task-preview')?.open);
      assert((await f.p.locator('#calendar-preview-title').textContent())===rows[15].title,'Agenda opens wrong task'); await f.p.keyboard.press('Escape'); await wait(f.p,()=>!document.querySelector('#calendar-task-preview')?.open);
    }
    await act(f,busy().locator('.month-date-button')); await wait(f.p,()=>selectedDate==='2026-11-20');
    if(f.width<700) assert(await f.p.locator('.month-selected-agenda [data-calendar-kind="work"]').count()===expected.work && await f.p.locator('.month-selected-agenda [data-calendar-kind="deadline"]').count()===expected.due,'Multi-digit date selection loses agenda items');
    assert(await f.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Month page overflows viewport');
    await f.p.evaluate(()=>{hideToast();document.querySelector('#planner-calendar').scrollTop=0;});
    await f.p.screenshot({path:artifacts+`resume-month-${f.cloud?'cloud':'local'}-${f.width}.png`});
    return {label,markerDaysChecked:bounds.filter(c=>c.visible&&c.markers.length).length,phoneMarkers:bounds.filter(c=>c.visible&&c.markers.length&&["2026-11-18","2026-11-20","2026-11-23"].includes(c.date)),desktopEntryCells:bounds.filter(c=>c.entries.length).length};
  }
  const configs=[
    {cloud:false,width:320,height:740,touch:true,dark:true,reduce:true,singleDigit:true},
    {cloud:true,width:320,height:740,touch:true,dark:false,reduce:true},
    {cloud:false,width:390,height:844,touch:true,dark:false,reduce:false},
    {cloud:true,width:390,height:844,touch:true,dark:true,reduce:true},
    {cloud:false,width:768,height:1024,touch:true,dark:true,reduce:true},
    {cloud:true,width:1280,height:1000,touch:false,dark:false,reduce:false},
  ];
  try {
    for(const config of [configs[0],configs[5]]) {
      stage=`setup ${config.cloud?'cloud':'local'}${config.width}`;const f=await setup(config);
      try {
        stage=`gutter/focus ${f.mode}${f.width}`;const gutterFocus=await gutterAndFocus(f);
        const marker={status:"NOT RUN IN FOCUS PHASE",reason:"Covered by final6-client marker matrix"};
        cases.push({status:'PASS',mode:f.mode,width:f.width,height:f.height,touchEmulation:f.touch,theme:f.dark?'dark':'light',reducedMotion:f.reduce,gutterFocus,marker});
      } catch(error) {
        diagnostic=await f.p.evaluate(()=>({view:document.body.dataset.view,selectedDate,calendarView,modal:document.querySelector('#task-modal')?.open,preview:document.querySelector('#calendar-task-preview')?.open,focus:document.activeElement?.name}));
        await f.p.screenshot({path:artifacts+`resume-failure-${f.cloud?'cloud':'local'}-${f.width}.png`}).catch(()=>{});throw error;
      } finally {await f.c.close();contexts.splice(contexts.indexOf(f.c),1);}
    }
    return {runtime:browser.version(),cases,errors,passed:errors.length===0,allSyntheticContextsClosed:contexts.length===0,scope:'Bounded frontend follow-up; real isolated APIs in signed-in cases. Chromium touch emulation does not establish native/physical Safari behavior.'};
  } catch(error) {return {runtime:browser.version(),stage,error:error.message,diagnostic,cases,errors};}
  finally {for(const c of contexts)await c.close();}
}
