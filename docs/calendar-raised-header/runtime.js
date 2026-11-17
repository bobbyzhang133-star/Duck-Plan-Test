async page => {
  const browser=page.context().browser(),results=[],out="/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-raised-header/";
  const check=(v,m)=>{if(!v)throw Error(m);};
  const inspect=()=>{
    const root=document.querySelector("#planner-calendar"),header=root.querySelector(".timeline-days"),due=root.querySelector(".timeline-deadlines");
    const rgb=color=>{const canvas=document.createElement("canvas");canvas.width=canvas.height=1;const ctx=canvas.getContext("2d");ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
    const light=color=>rgb(color).reduce((sum,v,i)=>{v/=255;return sum+[.2126,.7152,.0722][i]*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4);},0);
    const paint=e=>getComputedStyle(e),rect=e=>e?.getBoundingClientRect().toJSON();
    const color=paint(header).backgroundColor;
    return {header:rect(header),due:rect(due),toolbar:rect(document.querySelector(".calendar-toolbar")),summary:rect(document.querySelector("#phone-task-summary")),scrollTop:root.scrollTop,max:root.scrollHeight-root.clientHeight,
      overscroll:paint(root).overscrollBehaviorY,headerColor:color,headerLuminance:light(color),columns:[...root.querySelectorAll(".timeline-column")].map(e=>({color:paint(e).backgroundColor,luminance:light(paint(e).backgroundColor)})),
      cells:root.querySelectorAll(".time-axis > span").length,midnight:paint(root.querySelector(".time-axis-label")).visibility,fold:root.classList.contains("is-timeline-scrolled"),shadow:paint(due||header).boxShadow};
  };
  for(const viewport of [{width:1280,height:1000},{width:785,height:900},{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
    const c=await browser.newContext({viewport,serviceWorkers:"block",hasTouch:viewport.width<1000,isMobile:viewport.width<700||viewport.height<500,reducedMotion:"reduce"});
    try{
      await c.addInitScript(()=>{localStorage.setItem("duckplan-demo-classes-v1","[]");localStorage.setItem("duckplan-demo-tasks-v1",JSON.stringify([{id:"layer-work",title:"Study calculus",classId:null,dueDate:"2026-11-18",dueTime:"17:00",scheduledStart:"2026-11-18T15:00",durationMinutes:60,completed:false,priority:"Medium",schemaVersion:2},{id:"layer-date",title:"Reading response",classId:null,dueDate:"2026-11-18",scheduledStart:null,durationMinutes:45,completed:false,schemaVersion:2}]));});
      const p=await c.newPage(),errors=[];p.on("pageerror",e=>errors.push(e.message));
      await p.goto("http://127.0.0.1:8034/?qa=raised-header#calendar");await p.waitForFunction(()=>typeof store!=="undefined"&&workAlertContextReady);
      const before=await p.evaluate(()=>JSON.stringify(store.listItems()));
      for(const mode of ["day","week"]){
        await p.evaluate(mode=>{selectedDate="2026-11-18";calendarView=mode;calendarUserScrolled=true;renderAll({autoScrollCalendar:false});},mode);
        for(const theme of ["light","dark"]){
          await p.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.querySelector("#planner-calendar").scrollTop=0;},theme);await p.waitForTimeout(70);
          const start=await p.evaluate(inspect);
          check(start.overscroll==="none","Boundary bounce still enabled");
          check(start.columns.every(e=>start.headerLuminance>=e.luminance-.001),"Raised header darker than grid "+JSON.stringify(start));
          const bounds=await p.locator("#planner-calendar").boundingBox();await p.mouse.move(bounds.x+bounds.width-12,bounds.y+bounds.height-12);await p.mouse.wheel(0,-900);await p.waitForTimeout(100);
          const pulled=await p.evaluate(inspect);
          check(pulled.scrollTop===0 && Math.abs(pulled.header.top-start.header.top)<.5,"Header moved on top-edge wheel");
          check(Math.abs(pulled.toolbar.top-start.toolbar.top)<.5,"Toolbar moved on edge");
          await p.mouse.wheel(0,300);await p.waitForTimeout(100);
          const mid=await p.evaluate(inspect);check(mid.scrollTop>0&&mid.fold,"Normal scrolling/fold broken");check(Math.abs(mid.header.top-start.header.top)<.5,"Sticky header moved during normal scroll");
          await p.screenshot({path:out+`after-${viewport.width}-${mode}-${theme}.png`});
          await p.locator("#planner-calendar").evaluate(e=>e.scrollTop=e.scrollHeight);await p.waitForTimeout(60);const bottom=await p.evaluate(inspect);await p.mouse.wheel(0,900);await p.waitForTimeout(100);const beyond=await p.evaluate(inspect);
          check(beyond.scrollTop===bottom.max&&Math.abs(beyond.header.top-bottom.header.top)<.5,"Bottom-edge header moved");
          check(beyond.cells===24&&beyond.midnight==="hidden","Timeline extent or midnight-label changed");
          check(before===await p.evaluate(()=>JSON.stringify(store.listItems())),"Presentation changed user data");
          results.push({viewport,mode,theme,status:"PASS",headerColor:start.headerColor,headerLuminance:start.headerLuminance,columnLuminances:start.columns.map(e=>e.luminance),topBoundaryStationary:true,bottomBoundaryStationary:true,ordinaryScroll:true,fold:true});
        }
      }
      check(!errors.length,errors.join(";"));
    }finally{await c.close();}
  }
  return {runtime:browser.version(),mode:"isolated Chromium local fixtures; browser wheel boundary tests, not physical macOS/iOS rubber-band validation",results};
}
