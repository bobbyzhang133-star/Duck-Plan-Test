async page => {
  const browser=page.context().browser(),results=[];
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  async function capture(port,width,bottom,tag){
    const c=await browser.newContext({viewport:{width,height:950},hasTouch:width<1000,isMobile:width<700,serviceWorkers:"block"});
    try{
      const p=await c.newPage(),errors=[];p.on("pageerror",e=>errors.push(e.message));
      await p.goto(`http://127.0.0.1:${port}/?qa=copied-spring#calendar`);await p.waitForFunction(()=>typeof store!=="undefined");
      await p.evaluate(bottom=>{calendarView="week";renderCalendar({autoScroll:false});const root=document.querySelector("#planner-calendar"),surface=root.querySelector(".calendar-timeline-scroller")||root;surface.scrollTop=bottom?surface.scrollHeight:0;},bottom);
      await p.waitForTimeout(200);
      const rest=await p.evaluate(()=>{const root=document.querySelector("#planner-calendar"),header=root.querySelector(".timeline-days").getBoundingClientRect(),surface=root.querySelector(".calendar-timeline-scroller")||root,box=surface.getBoundingClientRect();return{header:header.top,x:box.left+100,y:Math.max(header.bottom,box.top)+80,records:JSON.stringify(store.listItems())};});
      await p.mouse.move(rest.x,rest.y);await p.mouse.wheel(0,bottom?120:-120);await p.waitForTimeout(25);
      const pull=await p.evaluate(()=>{const moving=document.querySelector(".calendar-body-grid")||document.querySelector(".timeline-calendar");return new DOMMatrixReadOnly(getComputedStyle(moving).transform).m42;});
      check(Math.abs(pull-42*(bottom?-1:1))<.01,"First pull differs from copied historical resistance");
      await p.waitForTimeout(110);
      const phases=await p.evaluate(()=>{
        const root=document.querySelector("#planner-calendar"),moving=root.querySelector(".calendar-body-grid")||root.querySelector(".timeline-calendar");
        const animations=root.getAnimations({subtree:true}).filter(a=>a.effect.target.matches(".calendar-body-grid,.timeline-calendar,.timeline-corner,.timeline-days,.timeline-deadline-label,.timeline-deadlines"));
        if(!animations.length)throw Error("Copied spring did not start");animations.forEach(a=>a.pause());
        const animation=animations.find(a=>a.effect.target===moving);
        const frames=animation.effect.getKeyframes();
        return{duration:animation.effect.getTiming().duration,frames:frames.map(f=>({offset:f.offset,transform:f.transform})),target:moving.className,animationCount:animations.length};
      });
      const samples=[];
      for(const time of [0,150,210,264,350,430]){
        const sample=await p.evaluate(time=>{const root=document.querySelector("#planner-calendar"),moving=root.querySelector(".calendar-body-grid")||root.querySelector(".timeline-calendar");root.getAnimations({subtree:true}).filter(a=>a.effect.target.matches(".calendar-body-grid,.timeline-calendar,.timeline-corner,.timeline-days,.timeline-deadline-label,.timeline-deadlines")).forEach(a=>a.currentTime=time);return{time,offset:new DOMMatrixReadOnly(getComputedStyle(moving).transform).m42,header:root.querySelector(".timeline-days").getBoundingClientRect().top};},time);
        check(Math.abs(sample.header-rest.header)<.02,"Date header moved with spring");samples.push(sample);
        if(width===1156&&[0,264].includes(time))await p.screenshot({path:`/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/copied-working-spring/${tag}-${bottom?"bottom":"top"}-${time}.png`});
      }
      check(phases.duration===440&&phases.frames.length===61,"Historical spring duration/curve changed");
      check(bottom?Math.max(...samples.map(s=>s.offset))>2:Math.min(...samples.map(s=>s.offset))< -2,"No visible overshoot");
      await p.evaluate(()=>{const root=document.querySelector("#planner-calendar");root.getAnimations({subtree:true}).filter(a=>a.effect.target.matches(".calendar-body-grid,.timeline-calendar,.timeline-corner,.timeline-days,.timeline-deadline-label,.timeline-deadlines")).forEach(a=>a.play());});
      await p.waitForFunction(()=>{const moving=document.querySelector(".calendar-body-grid")||document.querySelector(".timeline-calendar");return !moving.style.transform&&!moving.getAnimations().length;});
      check(await p.evaluate(records=>JSON.stringify(store.listItems())===records,rest.records),"Gesture changed tasks");check(!errors.length,errors.join(";"));
      return{port,width,bottom,status:"PASS",pull,...phases,samples};
    }finally{await c.close();}
  }
  for(const bottom of [false,true]){
    const before=await capture(8039,1156,bottom,"historical-before"),local=await capture(8034,1156,bottom,"current"),after=await capture(8039,1156,bottom,"historical-after");
    check(JSON.stringify(before.frames)===JSON.stringify(local.frames)&&JSON.stringify(after.frames)===JSON.stringify(local.frames),"Current keyframes differ from historical reference");
    check(before.samples.every((s,i)=>Math.abs(s.offset-local.samples[i].offset)<.001)&&after.samples.every((s,i)=>Math.abs(s.offset-local.samples[i].offset)<.001),"Rendered spring phases differ from reference");
    results.push({edge:bottom?"bottom":"top",before,local,after});
  }
  for(const width of [835,390,320])for(const bottom of [false,true])results.push(await capture(8034,width,bottom,"current-"+width));
  return{runtime:browser.version(),reference:"e592335 first 440ms spring, local8039",results};
}
