async page=>{
  const browser=page.context().browser(),results=[],out="/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-header-unified/";
  for(const width of [1280,785,390,320]){
    const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:"block",hasTouch:width<1000,isMobile:width<700,reducedMotion:"reduce"});
    try{
      await c.addInitScript(()=>{localStorage.setItem("duckplan-demo-tasks-v1","[]");localStorage.setItem("duckplan-demo-classes-v1","[]");});
      const p=await c.newPage();await p.goto("http://127.0.0.1:8034/?qa=unified-header#calendar");await p.waitForFunction(()=>typeof store!=="undefined"&&workAlertContextReady);
      for(const mode of ["day","week"]){
        await p.evaluate(mode=>{selectedDate="2026-11-17";calendarView=mode;renderCalendar();},mode);
        for(const theme of ["light","dark"]){
          await p.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.querySelector("#planner-calendar").scrollTop=300;},theme);await p.waitForTimeout(70);
          const s=await p.evaluate(()=>{const root=document.querySelector("#planner-calendar"),h=root.querySelector(".timeline-days"),corner=root.querySelector(".timeline-corner"),axis=root.querySelector(".time-axis");const after=getComputedStyle(h,"::after");return {borders:[...h.querySelectorAll("button")].map(e=>getComputedStyle(e).borderLeftWidth),fills:[getComputedStyle(h).backgroundColor,getComputedStyle(corner).backgroundColor,...[...h.children].map(e=>getComputedStyle(e).backgroundColor)],cornerShadow:getComputedStyle(corner).boxShadow,dayShadow:getComputedStyle(h).boxShadow,fold:after.boxShadow,foldLeft:parseFloat(after.left),axisWidth:axis.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth+1,cells:root.querySelectorAll(".time-axis > span").length};});
          if(s.borders.some(x=>x!=="0px")||new Set(s.fills).size!==1||s.cornerShadow!=="none"||s.dayShadow!=="none"||s.fold==="none"||s.foldLeft!==-s.axisWidth||s.overflow||s.cells!==24)throw Error(JSON.stringify(s));
          await p.screenshot({path:out+`after-${width}-${mode}-${theme}.png`});results.push({width,mode,theme,status:"PASS",state:s});
        }
        await p.locator("#planner-calendar").evaluate(e=>e.scrollTop=0);await p.waitForTimeout(60);
        if(await p.locator(".timeline-days").evaluate(e=>getComputedStyle(e,"::after").boxShadow!=="none"))throw Error("Fold not cleared at top");
      }
      await p.evaluate(()=>{tasks=[{id:"date",title:"Date-only fixture",dueDate:"2026-11-17",durationMinutes:45,completed:false}];calendarView="day";renderCalendar();document.querySelector("#planner-calendar").scrollTop=300;});await p.waitForTimeout(70);
      const due=await p.locator(".timeline-deadlines").evaluate(e=>({fold:getComputedStyle(e,"::after").boxShadow,labelShadow:getComputedStyle(document.querySelector(".timeline-deadline-label")).boxShadow}));if(due.fold==="none"||due.labelShadow!=="none")throw Error("Split Due shadow");
      if(await p.evaluate(()=>store.listItems().length!==0))throw Error("Fixture renderer changed stored tasks");
    }finally{await c.close();}
  }
  return {runtime:browser.version(),mode:"isolated local browser; no saved records changed",results};
}
