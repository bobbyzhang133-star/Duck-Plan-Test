async page => {
  const browser = page.context().browser(), results = [];
  const out = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-header-separation/";
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const inspect = () => {
    const root = document.querySelector("#planner-calendar"), frame = root.getBoundingClientRect();
    const axis = root.querySelector(".time-axis"), rail = axis.getBoundingClientRect();
    const line = root.querySelector(".current-time-line"), dot = line?.querySelector("span");
    const rect = e => e?.getBoundingClientRect().toJSON(), paint = e => getComputedStyle(e);
    const top = Math.max(frame.top + root.clientTop, ...[...root.querySelectorAll(".timeline-days,.timeline-deadlines")].map(e => e.getBoundingClientRect().bottom));
    return { top, bottom: frame.top + root.clientTop + root.clientHeight, axis: rect(axis), axisPaint: paint(axis).backgroundColor, headerPaint: paint(root.querySelector(".timeline-days")).backgroundColor, duePaint: root.querySelector(".timeline-deadlines") ? paint(root.querySelector(".timeline-deadlines")).backgroundColor : null, axisBorder: paint(axis).borderRightWidth,
      line: line ? { rect: rect(line), dot: rect(dot), column: rect(line.parentElement), date: line.parentElement.dataset.columnDate, opacity: paint(line).opacity, z: +paint(line).zIndex } : null,
      columns: [...root.querySelectorAll(".timeline-column")].map(e => ({ date: e.dataset.columnDate, selected: e.classList.contains("selected-day"), fill: paint(e).backgroundColor, border: paint(e).borderLeftWidth })),
      headers: [...root.querySelectorAll(".calendar-date-button")].map(e => ({ selected: e.classList.contains("selected"), fill: paint(e).backgroundColor })),
      labels: [...root.querySelectorAll(".time-axis-label")].filter(e => paint(e).opacity !== "0").map(e => ({ text: e.textContent, rect: rect(e) })),
      overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  };
  for (const viewport of [{width:1280,height:1000},{width:835,height:1000},{width:390,height:844},{width:320,height:568},{width:844,height:390}]) {
    const c = await browser.newContext({ viewport, hasTouch: viewport.width < 1000, isMobile: viewport.width < 700 || viewport.height < 500, timezoneId:"America/Los_Angeles", locale:"en-US", reducedMotion:"reduce", serviceWorkers:"block" });
    try {
      await c.addInitScript(() => {
        localStorage.setItem("duckplan-demo-classes-v1", "[]");
        localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify([
          {id:"grid-work",title:"Study calculus",classId:null,dueDate:"2026-11-18",dueTime:"17:00",scheduledStart:"2026-11-18T15:00",durationMinutes:60,priority:"Medium",completed:false,schemaVersion:2},
          {id:"grid-date",title:"Reading response",classId:null,dueDate:"2026-11-18",dueTime:"",scheduledStart:null,durationMinutes:45,priority:"Medium",completed:false,schemaVersion:2}
        ]));
      });
      const p = await c.newPage(), errors = []; p.on("pageerror", e => errors.push(e.message)); p.setDefaultTimeout(10000);
      await p.clock.install({time:new Date("2026-11-18T10:05:00-08:00")});
      await p.goto("http://127.0.0.1:8034/?qa=header-band#calendar");
      await p.waitForFunction(() => typeof store !== "undefined" && workAlertContextReady);
      const before = await p.evaluate(() => JSON.stringify(store.listItems()));
      for (const mode of ["day","week"]) {
        await p.evaluate(mode => { selectedDate="2026-11-18"; calendarView=mode; calendarUserScrolled=true; renderAll({autoScrollCalendar:false}); }, mode);
        for (const theme of ["light","dark"]) {
          await p.evaluate(theme => { document.documentElement.dataset.theme=theme; const r=document.querySelector("#planner-calendar");r.scrollTop=8*62;r.scrollLeft=0; const b=r.getBoundingClientRect(), floor=Math.max(b.top+r.clientTop,...[...r.querySelectorAll(".timeline-days,.timeline-deadlines")].map(e=>e.getBoundingClientRect().bottom)); r.scrollTop+=r.querySelector(".current-time-line").getBoundingClientRect().top-floor-Math.min(120,(b.top+r.clientTop+r.clientHeight-floor)/2); },theme);
          await p.waitForTimeout(100);
          const s = await p.evaluate(inspect);
          check(!s.overflow, "Page overflow "+JSON.stringify(viewport));
          check(s.axisBorder === "0px" && s.columns[0].border === "0px", "Gutter still has a divider");
          check(s.columns.filter(e=>!e.selected).every(e=>e.fill===s.axisPaint), "Non-selected/weekend column tinted");
          check(s.headerPaint!==s.axisPaint && s.headers.every(e=>e.fill===s.headerPaint), "Header must be one distinct neutral band");
          check(!s.duePaint || s.duePaint===s.headerPaint, "Date-only row lost header surface");
          check(s.columns.filter(e=>e.selected).every(e=>e.fill!==s.axisPaint), "Selected day lost its highlight");
          check(s.line?.opacity === "1", "Boundary dot incorrectly suppressed "+JSON.stringify({viewport,mode,theme,s}));
          check(Math.abs(s.line.dot.x+s.line.dot.width/2-s.line.column.x)<.6, "Dot not centred on today's column edge");
          check(Math.abs(s.line.dot.y+s.line.dot.height/2-s.line.rect.y-s.line.rect.height/2)<.6, "Dot not centred on line");
          check(s.line.date === "2026-11-18" && s.line.z > 4, "Indicator moved to another day/behind gutter");
          check(s.labels.length && s.labels.every(l=>l.rect.y>=s.top-.6&&l.rect.bottom<=s.bottom+.6), "Clipped hour label");
          await p.screenshot({path:out+`after-${viewport.width}-${viewport.height}-${mode}-${theme}.png`});
          results.push({viewport,mode,theme,status:"PASS",state:s});
        }
        // The dot crosses the sticky header edge as a whole, then returns.
        const samples = [];
        for (const gap of [2,12]) {
          await p.evaluate(gap=>{const r=document.querySelector("#planner-calendar"),b=r.getBoundingClientRect(),line=r.querySelector(".current-time-line");const floor=Math.max(b.top+r.clientTop,...[...r.querySelectorAll(".timeline-days,.timeline-deadlines")].map(e=>e.getBoundingClientRect().bottom));r.scrollTop+=line.getBoundingClientRect().top-floor-gap;},gap);
          await p.waitForTimeout(80); const s=await p.evaluate(inspect);
          check(s.line.opacity === (gap===2?"0":"1"), "Sticky edge hide/restore failed"); samples.push({gap,opacity:s.line.opacity});
        }
        if (viewport.width===835 && mode==="week") {
          await p.evaluate(()=>document.querySelector("#planner-calendar").scrollLeft=50); await p.waitForTimeout(80);
          const s=await p.evaluate(inspect); check(s.line.opacity==="1", "Middle-of-week dot hidden after horizontal scroll");
          check(Math.abs(s.line.dot.x+s.line.dot.width/2-s.line.column.x)<.6,"Horizontal scroll moved dot off its column");
        }
        // Choose another day: only that column is shaded; 'now' stays today.
        await p.evaluate(()=>{selectedDate="2026-11-19";renderAll({autoScrollCalendar:false});});await p.waitForTimeout(80);
        const selected=await p.evaluate(inspect);
        check(selected.columns.filter(e=>e.selected).length===1,"Selection not unique");
        check(selected.columns.filter(e=>!e.selected).every(e=>e.fill===selected.axisPaint),"Old selected column stayed yellow");
        check(mode==="day" || viewport.width<700 || viewport.height<500 ? !selected.line : selected.line.date==="2026-11-18","Now line followed selection instead of today");
        check(before===await p.evaluate(()=>JSON.stringify(store.listItems())),"Presentation changed task data");
      }
      await p.reload();await p.waitForFunction(()=>typeof store!=="undefined"&&workAlertContextReady);
      check(before===await p.evaluate(()=>JSON.stringify(store.listItems())),"Reload changed tasks");
      check(errors.length===0,errors.join(";"));
    } finally { await c.close(); }
  }
  return {runtime:browser.version(),mode:"isolated local browser fixtures; frozen Wednesday 10:05; not native",results};
}
