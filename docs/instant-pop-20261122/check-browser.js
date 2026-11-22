async page => {
  const browser=page.context().browser(),results=[];
  for(const config of [{width:1156,id:1},{width:835,id:5},{width:390,id:1},{width:390,id:1,rapid:true},{width:390,id:5,reduced:true}]) {
    const c=await browser.newContext({viewport:{width:config.width,height:900},serviceWorkers:"block",reducedMotion:config.reduced?"reduce":"no-preference"});
    try {
      const p=await c.newPage(),errors=[];p.on("pageerror",e=>errors.push(e.message));
      await p.goto("http://127.0.0.1:8042/?demo=completion-20261122#calendar");
      await p.waitForFunction(()=>typeof store!=="undefined"&&store.listItems().length===8);await p.waitForTimeout(500);
      const id="completion-20261122-"+config.id;
      await p.evaluate(id=>{
        window.popObservations=[];window.popFrames=[];window.popStart=null;window.popEnds=[];
        document.addEventListener("change",event=>{
          if(!event.target.matches("input[data-task-id]"))return;
          window.popStart??=performance.now();
          const echo=[...document.querySelectorAll(".task-completion-echo")].at(-1),style=echo&&getComputedStyle(echo),a=echo?.getAnimations()[0];
          popObservations.push({time:performance.now()-popStart,echo:Boolean(echo),scale:style?new DOMMatrix(style.transform).a:0,target:style?Number(style.getPropertyValue("--completion-pop-scale")):0,duration:a?.effect.getTiming().duration,frames:a?.effect.getKeyframes().map(f=>({offset:f.offset,transform:f.transform,opacity:f.opacity})),particles:document.querySelectorAll(".completion-particle").length});
          echo?.addEventListener("animationend",e=>{if(e.target===echo)popEnds.push(performance.now()-popStart)},{once:true});
        });
        const frame=()=>{
          if(popStart!==null){
            const section=document.querySelector("#unscheduled-task-list").closest(".task-section");
            popFrames.push({time:performance.now()-popStart,echo:document.querySelectorAll(".task-completion-echo").length,held:document.querySelectorAll(".completion-exit-source").length,fade:section.hasAttribute("data-completion-section-exit"),opacity:Number(getComputedStyle(section).opacity),duck:document.querySelectorAll(".completion-duck-reaction").length});
            if(performance.now()-popStart>2300)return;
          }requestAnimationFrame(frame);
        };requestAnimationFrame(frame);
      },id);
      await p.locator('#daily-task-panel input[data-task-id="'+id+'"]:visible').click();
      if(config.rapid){await p.waitForTimeout(75);await p.locator('#daily-task-panel input[data-task-id="completion-20261122-2"]:visible:not(:checked)').click();}
      await p.waitForTimeout(2400);
      const state=await p.evaluate(id=>({observations:popObservations,ends:popEnds,frames:popFrames.filter((f,i)=>i%3===0),completed:store.listItems().find(t=>t.id===id).completed,second:store.listItems().find(t=>t.id==="completion-20261122-2").completed,visible:[...document.querySelectorAll('#daily-task-panel input[data-task-id="'+id+'"]')].some(e=>e.checkVisibility()),artifacts:document.querySelectorAll(".task-completion-echo,.completion-exit-source,.completion-duck-reaction,[data-completion-section-exit]").length}),id);
      if(!state.completed||state.visible||state.artifacts||errors.length)throw Error("Completion/cleanup failed");
      if(config.rapid&&!state.second)throw Error("Rapid completion lost a task");
      for(const sample of state.observations){
        if(config.reduced){if(sample.echo||sample.particles)throw Error("Reduced motion ignored");continue;}
        if(!sample.echo||sample.duration!==300||Math.abs(sample.scale-sample.target)>.001||sample.particles===0)throw Error("Pop must begin at full size immediately: "+JSON.stringify(sample));
        if(sample.frames[0].transform!==sample.frames[1].transform)throw Error("Initial pose still grows instead of appearing big");
      }
      if(!config.reduced){
        if(!state.ends.length||state.ends.some(t=>t>700))throw Error("Pop did not finish promptly");
        const firstDuck=state.frames.find(f=>f.duck);
        if(!firstDuck||firstDuck.time<Math.max(...state.ends))throw Error("Duck must follow task exit");
        if(config.id===5&&!state.frames.some(f=>f.fade&&f.opacity>0&&f.opacity<1))throw Error("Section fade was lost");
      }
      await p.reload();await p.waitForFunction(id=>typeof store!=="undefined"&&store.listItems().some(t=>t.id===id&&t.completed),id);
      results.push({config,...state});
    }catch(error){return {runtime:browser.version(),results,failedConfig:config,error:error.message};}
    finally{await c.close();}
  }
  return {runtime:browser.version(),results};
}
