async page => {
  const browser=page.context().browser(),results=[],out='/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/complete-overdue-20261120/';
  const check=(value,message)=>{if(!value)throw Error(message);};
  for(const config of [{width:1280,height:900,mode:'local',view:'calendar'},{width:835,height:1000,mode:'local',view:'tasks'},
    {width:390,height:844,mode:'local',view:'calendar'},{width:320,height:568,mode:'local',view:'tasks'},
    {width:1280,height:900,mode:'cloud',view:'calendar'},{width:390,height:844,mode:'cloud',view:'tasks',failure:true}]){
    const c=await browser.newContext({viewport:{width:config.width,height:config.height},hasTouch:config.width<1000,isMobile:config.width<700,serviceWorkers:'block',timezoneId:'America/Los_Angeles'});
    try{
      const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
      await p.goto((config.mode==='cloud'?'http://127.0.0.1:8798/':'http://127.0.0.1:8034/')+'#calendar');
      await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
      if(config.mode==='cloud'){
        const user={email:`overdue-browser-${Date.now()}-${config.width}@overdue.test`,password:'QA-'+crypto.randomUUID()};
        await p.evaluate(async user=>{await store.signUp(user.email,user.password);},user);
        await p.waitForFunction(()=>store.mode==='cloud'&&workAlertContextReady);
      }
      const fixture=await p.evaluate(async()=>{
        const today=nowKey(),yesterday=Model.addDays(today,-1),tomorrow=Model.addDays(today,1);
        const rows=[{title:'Past date-only deadline',dueDate:yesterday},{title:'Earlier today deadline',dueDate:today,dueTime:'00:01'},
          {title:'Past deadline with future work',dueDate:yesterday,scheduledStart:tomorrow+'T09:00'},
          {title:'Date-only due today',dueDate:today},{title:'Future deadline',dueDate:tomorrow},{title:'Work without deadline',dueDate:'',scheduledStart:yesterday+'T10:00'}];
        for(const row of rows)await store.upsertItem({id:crypto.randomUUID(),classId:null,notes:'Keep these details',priority:'Medium',dueTime:'',scheduledStart:null,durationMinutes:45,completed:false,...row});
        const before=store.listItems();return{before,expected:before.filter(t=>Model.taskTiming(t).overdue).map(t=>t.id)};
      });
      if(config.view==='tasks')await p.locator('.nav-item[data-view="tasks"]:visible').click();
      else if(config.width<700)await p.locator('#phone-task-summary').click();
      const action=p.locator(`#${config.view==='tasks'?'view-tasks':'overdue-section'} [data-complete-overdue]`);
      await action.waitFor({state:'visible'});
      const geometry=await action.evaluate(e=>({rect:e.getBoundingClientRect().toJSON(),disabled:e.disabled,text:e.textContent}));
      check(geometry.rect.height>=44&&geometry.rect.width<=config.width&&!geometry.disabled,'Invalid action geometry/state');
      // Screenshot capture is separate from this functional matrix so it can run
      // without extra disk writes when the host is short on storage.
      let patchCount=0;
      if(config.mode==='cloud')await p.route('**/api/items/*',async route=>{
        if(route.request().method()!=='PATCH')return route.continue();
        patchCount++;
        if(config.failure&&patchCount===2)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'QA connection interrupted'})});
        if(patchCount===1)await new Promise(resolve=>setTimeout(resolve,300));
        await route.continue();
      });
      await action.click();
      if(config.mode==='cloud')check(await action.isDisabled(),'Busy state missing');
      await p.waitForFunction(()=>!overdueCompletion);
      if(config.failure){
        check(patchCount===2,'Failure did not stop queue');
        check((await p.locator('#toast-message').textContent()).includes('Completed 1 overdue task before stopping.'),'Partial failure feedback missing');
        check(await action.isEnabled(),'Retry disabled');
        const completed=await p.evaluate(()=>store.listItems().filter(t=>t.completed).map(t=>t.id));
        check(fixture.expected.filter(id=>completed.includes(id)).length===1,'Failed write retained optimistic completion');
        await p.unroute('**/api/items/*');await action.click();await p.waitForFunction(()=>!overdueCompletion);
      }
      const after=await p.evaluate(()=>store.listItems());
      for(const prior of fixture.before){const next=after.find(t=>t.id===prior.id);check(next?.completed===(fixture.expected.includes(prior.id)?true:prior.completed),'Wrong task completed');for(const key of ['title','dueDate','dueTime','scheduledStart','durationMinutes','notes'])check(next[key]===prior[key],'Changed '+key);}
      check(await action.isHidden(),'Action still visible with no overdue tasks');
      await p.reload();await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
      const persisted=await p.evaluate(()=>store.listItems());
      check(fixture.expected.every(id=>persisted.find(t=>t.id===id)?.completed),'Completion lost on reload');
      check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow');
      check(errors.length===0,errors.join(';'));
      results.push({config,status:'PASS',completed:fixture.expected.length,geometry,checks:['one click','both entry points','correct past deadline scope','unrelated details unchanged','reload persistence',...(config.failure?['partial failure','rollback','retry']:[])]});
    }finally{await c.close();}
  }
  return{runtime:browser.version(),backend:'real isolated loopback Worker/D1 on8798; browser503 injected only in failure case',results};
}
