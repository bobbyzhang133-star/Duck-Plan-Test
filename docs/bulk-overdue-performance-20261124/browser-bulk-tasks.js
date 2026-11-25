async (page) => {
  const browser = page.context().browser(), cases = [], evidence = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/bulk-overdue-performance-20261124/";
  for (const [name, width, height, touch] of [["small",320,568,true],["phone",390,844,true],["landscape",844,390,true],["ipad",835,1112,true],["desktop",1280,900,false]]) {
    const c = await browser.newContext({ viewport: {width,height}, hasTouch: touch, serviceWorkers:"block", reducedMotion:"no-preference" }), p = await c.newPage(), result = {name,viewport:[width,height],touchEmulated:touch,mode:"local storage",errors:[]};
    p.on("pageerror",e=>result.errors.push(e.message));
    try {
      await p.addInitScript(()=> {
        const rows=Array.from({length:24},(_,i)=>({id:"task-"+i,title:"Overdue task "+i,dueDate:"2026-01-01",dueTime:"12:00",completed:false,schemaVersion:2,classId:null,type:"task",durationMinutes:45,priority:"Medium"}));
        rows.push({...rows[0],id:"future",title:"A remaining task with a long title that needs to wrap cleanly and keep its buttons reachable",dueDate:"2027-12-01"});
        localStorage.setItem("duckplan-demo-tasks-v1",JSON.stringify(rows));
      });
      await p.goto("http://127.0.0.1:8788/#tasks",{timeout:25000});
      await p.waitForFunction(()=>typeof store!=="undefined" && store.listItems().length===25 && document.body.dataset.view==="tasks"); await p.waitForTimeout(500);
      await p.evaluate(()=>{
        window.taskSurface=[]; const animate=Element.prototype.animate;
        Element.prototype.animate=function(frames,options) {
          if(this.id==="view-tasks") taskSurface.push({frames, duration:options.duration, completed:store.listItems().filter(t=>t.completed).length, saved:JSON.parse(localStorage.getItem("duckplan-demo-tasks-v1")).filter(t=>t.completed).length, oldRows:this.querySelectorAll(".all-task-row").length});
          return animate.call(this,frames,options);
        };
      });
      const button=p.locator('#view-tasks [data-complete-overdue]'); await button.scrollIntoViewIfNeeded();
      await p.screenshot({path:evidence+"tasks-"+name+"-before.png"});
      if(touch)await button.tap();else {await button.focus();await p.keyboard.press("Enter");}
      await p.waitForFunction(()=>overdueCompletion===null && store.listItems().filter(t=>t.completed).length===24);
      await p.screenshot({path:evidence+"tasks-"+name+"-transition.png"});
      await p.waitForTimeout(450);
      result.state=await p.evaluate(()=>({animations:taskSurface,remaining:document.querySelectorAll("#all-task-list .all-task-row").length,overflow:document.documentElement.scrollWidth>innerWidth+1,focused:document.activeElement.dataset.filter,completed:store.listItems().filter(t=>t.completed).length}));
      if(result.state.animations.length!==2 || result.state.animations[0].completed!==24 || result.state.animations[0].saved!==24 || result.state.animations[0].oldRows!==25 || result.state.remaining!==1 || result.state.overflow || result.errors.length)throw Error("Bulk Tasks persistence/closing/opening/layout failure");
      await p.screenshot({path:evidence+"tasks-"+name+"-after.png"});
      // Navigation interrupts opening safely and leaves the other planner usable.
      await p.evaluate(()=>navigateView("calendar")); await p.waitForFunction(()=>document.body.dataset.view==="calendar");
      result.passed=true;
    }catch(e){result.passed=false;result.error=e.message;await p.screenshot({path:evidence+"tasks-"+name+"-failure.png"}).catch(()=>{});}
    finally{await c.close();} cases.push(result);
  }
  return {runtime:browser.version(),cases,passed:cases.every(c=>c.passed),physicalDeviceClaims:false};
}
