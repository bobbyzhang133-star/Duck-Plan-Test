async page => {
  const browser=page.context().browser(), results=[];
  for(const config of [{width:1156},{width:835},{width:390},{width:320},{width:835,kind:"overdue"},{width:390,kind:"empty"},{width:835,kind:"cancel"},{width:390,kind:"reduced"}]) {
    const c=await browser.newContext({viewport:{width:config.width,height:1000},serviceWorkers:"block",reducedMotion:config.kind==="reduced"?"reduce":"no-preference"});
    try {
      const p=await c.newPage(),errors=[];p.on("pageerror",e=>errors.push(e.message));
      await p.goto("http://127.0.0.1:8042/#tasks");await p.waitForFunction(()=>typeof store!=="undefined"&&store.listItems().length);
      await p.evaluate(()=>localStorage.setItem("duckplan-demo-tasks-v1",JSON.stringify([{id:"real-fixture",title:"Existing personal task",dueDate:Model.todayKey(),completed:false,schemaVersion:2}])));
      await p.reload();await p.waitForFunction(()=>store.listItems().some(t=>t.id==="real-fixture"));
      const normal=await p.evaluate(()=>localStorage.getItem("duckplan-demo-tasks-v1"));
      const demo="http://127.0.0.1:8042/?demo=completion-20261122#"+(config.kind==="empty"?"tasks":"calendar");
      await p.goto(demo);await p.waitForFunction(()=>typeof store!=="undefined"&&store.listItems().length===8);
      await p.waitForTimeout(500);
      if(config.kind==="empty") await p.evaluate(async()=>{for(const task of store.listItems().filter(t=>!t.id.endsWith("-0")))await store.toggleComplete(task.id,true);});
      const id="completion-20261122-"+(["overdue","empty"].includes(config.kind)?0:5),area=config.kind==="empty"?"#view-tasks":"#daily-task-panel";
      const target=config.kind==="empty"?"#view-tasks [data-complete-overdue]":config.kind==="overdue"?"#daily-task-panel [data-complete-overdue]":"#unscheduled-task-list";
      await p.evaluate(({target,kind})=>{
        window.transitionFrames=[];window.transitionStart=null;
        const targetNode=document.querySelector(target), element=kind==="overdue"||kind==="empty"?targetNode:targetNode.closest(".task-section");
        document.addEventListener("change",()=>{window.transitionStart=performance.now();},{once:true});
        const sample=()=>{
          if(window.transitionStart!==null){const style=getComputedStyle(element),echo=document.querySelector(".task-completion-echo"),r=echo?.getBoundingClientRect();
            transitionFrames.push({t:performance.now()-transitionStart,height:element.getBoundingClientRect().height,opacity:Number(style.opacity),display:style.display,panelHeight:document.querySelector("#view-tasks .tasks-panel").getBoundingClientRect().height,fade:element.hasAttribute("data-completion-section-exit"),echo:Boolean(echo),scale:echo?new DOMMatrix(getComputedStyle(echo).transform).a:0,bounds:r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom}:null});
            if(performance.now()-transitionStart>2500)return;
          }requestAnimationFrame(sample);
        };requestAnimationFrame(sample);
      },{target,kind:config.kind});
      await p.locator(area+' input[data-task-id="'+id+'"]:visible:not(:checked)').click();
      if(config.kind==="cancel") {await p.waitForFunction(()=>document.querySelector("[data-completion-section-exit]"));await p.evaluate(()=>setView("tasks"));}
      await p.waitForTimeout(2600);
      const observed=await p.evaluate(({normal,id})=>({frames:transitionFrames,normalUntouched:localStorage.getItem("duckplan-demo-tasks-v1")===normal,count:store.listItems().length,completed:store.listItems().find(t=>t.id===id).completed,markers:document.querySelectorAll("[data-completion-section-exit],.completion-exit-source,.task-completion-echo,.completion-duck-reaction").length,emptyVisible:!document.querySelector("#task-empty").hidden,alertsDisabled:store.listItems().every(t=>!t.workAlerts.alarm.enabled&&!t.workAlerts.notification.enabled&&t.reminderChoice==="off")}),{normal,id});
      if(!observed.normalUntouched||observed.count!==8||!observed.completed||observed.markers||!observed.alertsDisabled||errors.length)throw Error("Isolation, completion, cleanup or runtime failed");
      if(config.kind!=="reduced"&&config.kind!=="cancel"){
        const fading=observed.frames.filter(f=>f.fade);
        if(fading.length<8||!fading.some(f=>f.opacity>.1&&f.opacity<.9)||fading[0].height<=fading.at(-1).height)throw Error("Heading/control must fade while its space shrinks");
        if(observed.frames.some(f=>f.fade&&f.echo))throw Error("Section closes before task exit ends");
        const peak=observed.frames.reduce((a,b)=>a.scale>b.scale?a:b);
        if(peak.scale<1.04||peak.bounds.left < -1||peak.bounds.right>config.width+1||peak.bounds.top < -1||peak.bounds.bottom>1001)throw Error("Larger task leaves viewport: "+JSON.stringify(peak));
        if(config.width>=835&&peak.scale<1.7)throw Error("Desktop/tablet should have a much larger pop");
      }
      if(config.kind==="empty") {
        if(!observed.emptyVisible)throw Error("Empty state missing");
        const tail=observed.frames.filter(f=>f.t>780&&f.t<1100);
        if(tail.some((f,i)=>i&&Math.abs(f.panelHeight-tail[i-1].panelHeight)>4))throw Error("Panel jumps when the fading control finishes");
      }
      await p.screenshot({path:`/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/section-fade-20261122/after-${config.width}-${config.kind||"due"}.png`});
      await p.reload();await p.waitForFunction(id=>typeof store!=="undefined"&&store.listItems().some(t=>t.id===id&&t.completed),id);
      if(await p.evaluate(()=>store.listItems().length)!==8)throw Error("Reload duplicates or resets samples");
      await p.goto("http://127.0.0.1:8042/#tasks");await p.waitForFunction(()=>typeof store!=="undefined"&&store.listItems().some(t=>t.id==="real-fixture"));
      if(await p.evaluate(()=>store.listItems().length)!==1)throw Error("Sample tasks leaked into real planner");
      results.push({config,count:observed.count,normalUntouched:true,completionPreserved:true,frames:observed.frames.filter((f,i)=>i%4===0)});
    }catch(error){return {runtime:browser.version(),results,failedConfig:config,error:error.message};}
    finally{await c.close();}
  }
  return {runtime:browser.version(),results};
}
