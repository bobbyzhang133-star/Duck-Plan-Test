async page => {
  const browser=page.context().browser(),results=[];
  for(const config of [
    {view:"calendar",width:1156},{view:"calendar",width:835,due:true},{view:"calendar",width:390},
    {view:"tasks",width:390},{view:"home",width:1156},{view:"tasks",width:390,cloud:true},
    {view:"calendar",width:390,rapid:true},{view:"calendar",width:390,reduced:true}
  ]) {
    const c=await browser.newContext({viewport:{width:config.width,height:1000},serviceWorkers:"block",reducedMotion:config.reduced?"reduce":"no-preference"});
    try {
      const p=await c.newPage(),errors=[],origin=config.cloud?"http://127.0.0.1:8798":"http://127.0.0.1:8042";
      p.on("pageerror",e=>errors.push(e.message));
      if(config.cloud){
        const auth=await c.request.post(origin+"/api/auth/sign-up",{headers:{Origin:origin},data:{email:`snap-${Date.now()}@example.test`,password:"Synthetic instant list snap fixture"}});
        if(!auth.ok())throw Error("Fixture signup failed");
        await p.route(origin+"/**",async route=>{const u=new URL(route.request().url());if(u.pathname.startsWith("/api/")||u.pathname==="/cloud-config.js")return route.continue();return route.fulfill({response:await c.request.get("http://127.0.0.1:8042"+u.pathname+u.search)})});
      }
      await p.goto(origin+"/"+(config.cloud?"":"?demo=completion-20261122")+"#"+config.view);
      await p.waitForFunction(cloud=>typeof store!=="undefined"&&(cloud?store.mode==="cloud":store.listItems().length===8),Boolean(config.cloud));
      let ids=["completion-20261122-"+(config.due?5:1),"completion-20261122-2"];
      if(config.cloud){
        ids=await p.evaluate(async()=>{const date=Model.todayKey(),ids=[crypto.randomUUID(),crypto.randomUUID()];for(const [i,id]of ids.entries())await store.upsertItem({id,title:"Instant snap fixture "+i,dueDate:date,dueTime:"23:59",scheduledStart:date+"T"+(i?"10":"09")+":00",durationMinutes:45,completed:false,schemaVersion:2});return ids});
        await p.route("**/api/items/*",async route=>{if(route.request().method()==="PATCH")await new Promise(r=>setTimeout(r,650));return route.continue()});
      }
      await p.waitForTimeout(500);
      const area=config.view==="calendar"?"#daily-task-panel":config.view==="home"?"#view-home":"#view-tasks";
      const source=p.locator(area+' input[data-task-id="'+ids[0]+'"]:visible:not(:checked)');
      await source.scrollIntoViewIfNeeded();
      await p.evaluate(({ids,area,due,rapid})=>{
        const root=document.querySelector(area);
        const target=()=>due?root.querySelector(".completed-section"):root.querySelector('input[data-task-id="'+ids[1]+'"]')?.closest(".daily-task-card,.all-task-row,.matrix-task-card");
        const position=()=>{const e=target(),b=e?.getBoundingClientRect(),r=root.getBoundingClientRect();return {y:b?b.top-r.top:null,animations:e?.getAnimations().filter(a=>a.effect.getKeyframes().some(f=>"transform" in f||"height" in f||"marginTop" in f)).length||0}};
        window.snapBefore=position();window.snapFrames=[];window.snapStart=null;window.snapImmediate=null;
        const label=due?root.querySelector("#unscheduled-task-list").closest(".task-section").querySelector(".task-section-heading"):null;
        document.addEventListener("change",event=>{
          if(event.target.dataset.taskId!==ids[0])return;
          snapStart=performance.now();const echo=document.querySelector(".task-completion-echo"),style=echo&&getComputedStyle(echo);
          snapImmediate={scale:style?new DOMMatrix(style.transform).a:0,target:style?Number(style.getPropertyValue("--completion-pop-scale")):0,transition:style?.transitionDuration,echo:Boolean(echo)};
          if(rapid)setTimeout(()=>root.querySelector('input[data-task-id="'+ids[1]+'"]').click(),75);
        },{once:true});
        const frame=()=>{if(snapStart!==null){snapFrames.push({time:performance.now()-snapStart,...position(),echo:document.querySelectorAll(".task-completion-echo").length,held:document.querySelectorAll(".completion-exit-source").length,labelOpacity:label?Number(getComputedStyle(label).opacity):null});if(performance.now()-snapStart>2200)return}requestAnimationFrame(frame)};requestAnimationFrame(frame);
      },{ids,area,due:config.due,rapid:config.rapid});
      await source.focus();await source.press("Space");
      await p.waitForTimeout(450);
      const focusBeforeAck=await p.evaluate(()=>document.activeElement?.dataset.taskId);
      await p.waitForTimeout(2000);
      const state=await p.evaluate(({ids,area})=>({before:snapBefore,frames:snapFrames,immediate:snapImmediate,completed:store.listItems().find(t=>t.id===ids[0]).completed,second:store.listItems().find(t=>t.id===ids[1]).completed,visible:[...document.querySelectorAll(area+' input[data-task-id="'+ids[0]+'"]')].some(e=>e.checkVisibility()),artifacts:document.querySelectorAll(".task-completion-echo,.completion-exit-source,.completion-duck-reaction,[data-completion-section-exit]").length,focused:document.activeElement?.dataset.taskId}),{ids,area});
      if(!state.completed||state.visible||state.artifacts||errors.length)throw Error("Completion/cleanup failed: "+JSON.stringify({state,errors}));
      if(!config.reduced&&(Math.abs(state.immediate.scale-state.immediate.target)>.001||state.immediate.transition!=="0s"))throw Error("Initial pop still transitions instead of appearing expanded");
      if(!config.reduced&&!config.rapid){
        const held=state.frames.filter(f=>f.echo),after=state.frames.filter(f=>!f.echo);
        if(held.some(f=>Math.abs(f.y-state.before.y)>1))throw Error("List moved before task exit");
        const final=after.at(-1)?.y;
        if(after.length<5||(!config.due&&Math.abs(final-state.before.y)<10)||after.some(f=>Math.abs(f.y-final)>1||f.animations))throw Error("List must snap once without intermediate positions/animations: "+JSON.stringify({before:state.before,after:after.slice(0,10),final}));
      }
      if(config.due&&!state.frames.some(f=>f.echo&&f.labelOpacity>0&&f.labelOpacity<.9))throw Error("Disappearing heading fade was lost");
      if(config.rapid&&!state.second)throw Error("Rapid click lost completion");
      if(config.cloud&&(!focusBeforeAck||state.focused!==focusBeforeAck))throw Error("Late save lost keyboard focus");
      await p.reload();await p.waitForFunction(id=>typeof store!=="undefined"&&store.listItems().some(t=>t.id===id&&t.completed),ids[0]);
      results.push({config,before:state.before,immediate:state.immediate,completed:state.completed,focusBeforeAck,focused:state.focused,frames:state.frames.filter((f,i)=>i%4===0)});
    }catch(error){return {runtime:browser.version(),results,failedConfig:config,error:error.message};}
    finally{await c.close();}
  }
  return {runtime:browser.version(),results};
}
