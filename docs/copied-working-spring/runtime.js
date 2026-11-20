async page => {
  const browser = page.context().browser(), contexts = new Set(), cases = [], errors = [];
  const check = (ok, message) => { if (!ok) throw Error(message); };
  let stage = "start";
  async function setup(width, height = 950, touch = false) {
    const c = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch && width < 700, serviceWorkers: "block", timezoneId: "America/Los_Angeles" });
    contexts.add(c);
    const p = await c.newPage(); p.setDefaultTimeout(7000); p.on("pageerror", e => errors.push(e.message));
    await p.goto("http://127.0.0.1:8034/?qa=copied-spring-runtime#calendar");
    await p.waitForFunction(() => typeof store !== "undefined" && store.mode === "local");
    const fixture = await p.evaluate(async () => {
      const date = nowKey(), classId = "qa-native-class", taskId = "qa-native-task";
      await store.upsertClass({ id: classId, name: "QA Class", color: "#518fc9" });
      await store.upsertItem({ id: taskId, title: "QA unscheduled work", classId, dueDate: date, dueTime: "18:00", durationMinutes: 45, priority: "Medium", completed: false });
      await store.upsertItem({ id: "qa-native-date-only", title: "QA date-only", classId, dueDate: date, dueTime: "", priority: "Medium", completed: false });
      const template = await store.upsertTemplate({ id: "qa-native-template", title: "QA native template", classId, durationMinutes: 60, priority: "Medium" });
      selectedDate = date; calendarView = "week"; setView("calendar", true); renderAll({ autoScrollCalendar: false }); calendarScrollElement().scrollTop = 0;
      return { date, classId, taskId, template };
    });
    await p.waitForTimeout(200); return { c, p, fixture, width };
  }
  async function drag(p, source, target) {
    const a = await source.boundingBox(), b = await target.boundingBox(); check(a && b, "Drag source/target absent");
    await p.mouse.move(a.x + a.width / 2, a.y + 15); await p.mouse.down();
    await p.mouse.move(a.x + a.width / 2 + 18, a.y + 20, { steps: 5 });
    await p.mouse.move(b.x + b.width / 2, b.y + 2, { steps: 25 }); await p.waitForTimeout(100); await p.mouse.up(); await p.waitForTimeout(400);
  }
  try {
    for (const [width, height, touch] of [[1280,950,false],[835,950,true],[390,844,true],[320,740,true],[844,390,true]]) {
      stage = `layout ${width}`; const f = await setup(width,height,touch), {p} = f;
      for (const view of ["day", "week"]) for (const theme of ["light", "dark"]) {
        await p.evaluate(({view,theme}) => { calendarView = view; document.documentElement.dataset.theme = theme; renderCalendar({autoScroll:false}); calendarScrollElement().scrollTop = 100; }, {view,theme});
        await p.waitForTimeout(80);
        const s = await p.evaluate(() => {
          const root = els.calendar, body = calendarScrollElement(), header = root.querySelector(".calendar-header-viewport");
          return { outer:root.getBoundingClientRect().toJSON(), body:body.getBoundingClientRect().toJSON(), header:header.getBoundingClientRect().toJSON(), scroll:body.scrollTop, scrollHeight:body.scrollHeight, clientHeight:body.clientHeight, overflow:document.documentElement.scrollWidth>innerWidth, policy:getComputedStyle(body).overscrollBehaviorY, labels:root.querySelectorAll(".time-axis > span").length, firstLabel:getComputedStyle(root.querySelector(".time-axis-label")).visibility };
        });
        check(s.body.height >= 62 && s.body.bottom <= s.outer.bottom + 1 && s.header.bottom <= s.body.top + 1, "Bad scroll/header layout " + JSON.stringify({width,view,theme,s}));
        check(!s.overflow && s.scrollHeight > s.clientHeight && s.labels === 24 && s.policy === "none", "Native/24h layout failed " + JSON.stringify({width,view,theme,s}));
        cases.push({test:"responsive-fixed-header-copied-spring-body",width,height,touch,view,theme,status:"PASS",bodyHeight:s.body.height});
      }
      await p.evaluate(() => {calendarView="week";document.documentElement.dataset.theme="light";renderCalendar({autoScroll:false});calendarScrollElement().scrollTop=0;});
      const header = p.locator(".calendar-header-viewport"), hb=await header.boundingBox();
      await p.mouse.move(hb.x+hb.width/2,hb.y+10); await p.mouse.wheel(0,-400); await p.waitForTimeout(200);
      check(await p.evaluate(() => calendarScrollElement().scrollTop===0), "Header crossed top boundary");
      await p.mouse.wheel(0,150); await p.waitForTimeout(150);
      check(await p.evaluate(() => calendarScrollElement().scrollTop===150), "Header did not pan body");
      const after=await header.boundingBox();check(Math.abs(after.y-hb.y)<.1,"Header moved");
      await p.evaluate(() => {calendarScrollElement().scrollTop=220;renderAll({autoScrollCalendar:false});});
      check(await p.evaluate(() => calendarScrollElement().scrollTop===220),"Rerender lost scroll");
      const toggle=p.locator(".deadline-row-toggle");
      if(await toggle.count()){await toggle.click();check(await p.evaluate(() => calendarScrollElement().scrollTop===220),"Due fold lost scroll");}
      await p.evaluate(()=>{calendarView="month";renderCalendar({autoScroll:false});});
      check(await p.evaluate(()=>calendarScrollElement()===els.calendar&&!els.calendar.querySelector(".calendar-timeline-scroller")),"Month fallback failed");
      cases.push({test:"header-input-rerender-Due-Month",width,status:"PASS"});
      await f.c.close(); contexts.delete(f.c);
    }
    stage="trusted task and template drags"; const f=await setup(1280),{p,fixture}=f;
    await p.evaluate(()=>{calendarView="day";renderAll({autoScrollCalendar:false});calendarScrollElement().scrollTop=0;});
    await p.waitForTimeout(100);
    await drag(p,p.locator(`#daily-task-panel [data-drag-task="${fixture.taskId}"]`).first(),p.locator('.calendar-slot[data-slot-time="03:00"]').first());
    const saved=await p.evaluate(id=>store.listItems().find(t=>t.id===id),fixture.taskId);
    check(saved.scheduledStart===fixture.date+"T03:00"&&saved.dueTime==="18:00","Task drag coordinate/deadline failed "+JSON.stringify(saved));
    cases.push({test:"task-drag-03:00-preserves-18:00-deadline",status:"PASS"});
    await p.locator("#calendar-templates-tab").click();
    await p.evaluate(()=>{calendarScrollElement().scrollTop=0;});
    const count=await p.evaluate(()=>store.listItems().length);
    await drag(p,p.locator(`[data-library-template="${fixture.template.id}"]`).first(),p.locator('.calendar-slot[data-slot-time="05:00"]').first());
    const copy=await p.evaluate(()=>store.listItems().find(t=>t.title==="QA native template"));
    check(copy?.scheduledStart===fixture.date+"T05:00"&&copy.classId===fixture.classId&&copy.durationMinutes===60,"Template drag failed "+JSON.stringify(copy));
    check(await p.evaluate(n=>store.listItems().length===n+1&&store.listTemplates().some(t=>t.id==="qa-native-template"),count),"Template source/copy failed");
    await p.reload(); await p.waitForFunction(()=>typeof store!=="undefined"&&store.listItems().some(t=>t.title==="QA native template"));
    check(await p.evaluate(({taskId,copyId})=>store.listItems().find(t=>t.id===taskId).scheduledStart.endsWith("T03:00")&&store.listItems().find(t=>t.id===copyId).scheduledStart.endsWith("T05:00"),{taskId:fixture.taskId,copyId:copy.id}),"Reload lost schedule");
    cases.push({test:"template-drag-05:00-copy-source-and-task-reload",status:"PASS"});
    check(!errors.length,errors.join(";"));
    return {runtime:browser.version(),mode:"isolated local storage / browser touch emulation",cases,errors};
  } catch(error) {return {stage,error:error.message,cases,errors};} finally {for(const c of contexts)await c.close();}
}
