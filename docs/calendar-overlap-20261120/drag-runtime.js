async page=>{
  const browser=page.context().browser(),results=[];
  const check=(v,m)=>{if(!v)throw Error(m);};
  for(const cloud of [false,true]){
    const c=await browser.newContext({viewport:{width:1470,height:745},serviceWorkers:'block',timezoneId:'America/Los_Angeles'}),p=await c.newPage(),origin=cloud?'http://127.0.0.1:8798':'http://127.0.0.1:8034';
    const result={cloud,checks:[]};p.setDefaultTimeout(10000);
    try{
      if(cloud){const r=await c.request.post(origin+'/api/auth/sign-up',{data:{email:`overlap-drag-${Date.now()}@example.test`,password:`Fixture-${Date.now()}-${Math.random()}`},headers:{Origin:origin}});check(r.status()===201,'QA signup');}
      else await c.addInitScript(()=>localStorage.setItem('duckplan-demo-tasks-v1','[]'));
      await p.goto(origin+'/#calendar');await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
      const fixture=await p.evaluate(async()=>{
        const date=Model.todayKey(),scheduled=crypto.randomUUID(),unscheduled=crypto.randomUUID(),template=crypto.randomUUID();
        const base={classId:null,priority:'Medium',durationMinutes:90,notes:'Keep these details',dueDate:date,dueTime:'14:30',workAlerts:{version:1,timeZone:'America/Los_Angeles',alarm:{enabled:false,mode:'work',at:null,sound:'system',snoozeMinutes:5},notification:{enabled:false,mode:'alarm',at:null}}};
        await store.upsertItem({...base,id:scheduled,title:'Existing work',scheduledStart:date+'T14:00'});
        await store.upsertItem({...base,id:unscheduled,title:'Unscheduled work',dueTime:'16:00',scheduledStart:null});
        await store.upsertTemplate({id:template,title:'Reusable review',durationMinutes:45,classId:null,priority:'High',notes:'Template notes',reminderChoice:'off'});
        return{date,scheduled,unscheduled,template};
      });
      await p.getByRole('button',{name:'Day',exact:true}).click();
      const col=p.locator(`.timeline-column[data-column-date="${fixture.date}"]`),scroll=()=>p.locator('.calendar-timeline-scroller').evaluate(e=>e.scrollTop=13*62);
      await scroll();const source=col.locator(`[data-calendar-drag-task="${fixture.scheduled}"]`),r=await source.boundingBox(),cr=await col.boundingBox();
      const before=await p.evaluate(()=>JSON.stringify(store.listItems()));
      await p.mouse.move(r.x+15,r.y+4);await p.mouse.down();await p.mouse.move(cr.x+cr.width*.3,cr.y+14.25*62+4,{steps:8});await p.waitForFunction(()=>!!calendarDrag?.started);
      const geometry=await p.locator('.calendar-drag-ghost').evaluate(e=>{const r=e.getBoundingClientRect(),layer=e.closest('.calendar-work-layer'),lr=layer?.getBoundingClientRect(),due=e.closest('.timeline-column')?.querySelector('.timed-deadline-anchor');return{inWorkLayer:!!layer,position:getComputedStyle(e).position,width:r.width,layerWidth:lr?.width,workZ:layer&&getComputedStyle(layer).zIndex,dueZ:due&&getComputedStyle(due).zIndex,pointer:getComputedStyle(e).pointerEvents};});
      check(geometry.inWorkLayer&&geometry.position==='absolute'&&geometry.pointer==='none'&&Math.abs(geometry.width-geometry.layerWidth)<1&&Number(geometry.dueZ)>Number(geometry.workZ),'Live drag is above Due or does not fit '+JSON.stringify(geometry));
      if(!cloud)await p.screenshot({path:'/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-overlap-20261120/live-drag-under-due.png'});
      await p.keyboard.press('Escape');await p.mouse.up();check(await p.locator('.calendar-drag-ghost').count()===0,'Pointer cancel cleanup');check(await p.locator('dialog[open]').count()===0,'Cancelled drag opened a task');check(await p.evaluate(()=>JSON.stringify(store.listItems()))===before,'Cancelled drag wrote data');
      result.checks.push({kind:'real pointer drag',status:'PASS',geometry,cancelPreservesData:true});
      // Real DOM handlers with a synthetic HTML5 DataTransfer; OS drag bitmap is not asserted here.
      for(const kind of ['task','template']){
        if(kind==='template')await p.locator('#calendar-templates-tab').click();
        const source=kind==='task'?p.locator(`[data-drag-task="${fixture.unscheduled}"]`).first():p.locator(`[data-library-template="${fixture.template}"]`).first();
        check(await source.count()===1,'Missing '+kind+' source');
        const transfer=await p.evaluateHandle(()=>new DataTransfer());
        await source.dispatchEvent('dragstart',{dataTransfer:transfer,clientX:200,clientY:300});await scroll();
        const rect=await col.boundingBox(),point={clientX:rect.x+rect.width*.3,clientY:rect.y+14.25*62};
        const slot=col.locator('[data-slot-time="14:00"]');
        await slot.dispatchEvent('dragover',{dataTransfer:transfer,...point});
        check(await p.locator('.calendar-work-layer .template-drop-preview').count()===1,'Fitted '+kind+' preview not below Due');
        await p.locator('body').dispatchEvent('dragover',{dataTransfer:transfer,clientX:200,clientY:300});
        check(await p.locator('body > .template-drop-preview[data-drag-placement="free"]').count()===1,'Free '+kind+' preview did not return to body');
        await slot.dispatchEvent('dragover',{dataTransfer:transfer,...point});await slot.dispatchEvent('drop',{dataTransfer:transfer,...point});await source.dispatchEvent('dragend',{dataTransfer:transfer});
        if(kind==='task')await p.waitForFunction(({id,date})=>store.listItems().find(t=>t.id===id)?.scheduledStart===date+'T14:15',{id:fixture.unscheduled,date:fixture.date});
        else await p.waitForFunction(date=>store.listItems().some(t=>t.title==='Reusable review'&&t.scheduledStart===date+'T14:15'),fixture.date);
        check(await p.locator('.calendar-drag-ghost').count()===0,'Drop cleanup');result.checks.push({kind:'synthetic HTML5 '+kind+' drag',status:'PASS',fitFreeFit:true,scheduled:'14:15'});await transfer.dispose();
      }
      const saved=await p.evaluate(ids=>({items:store.listItems(),template:store.listTemplates().find(t=>t.id===ids.template)}),fixture);
      check(saved.items.length===3&&saved.items.find(t=>t.id===fixture.unscheduled).dueTime==='16:00'&&saved.template.title==='Reusable review','Copy/move semantics changed');
      result.status='PASS';
    }catch(e){result.status='FAIL';result.error=e.message;await p.screenshot({path:'/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-overlap-20261120/drag-'+(cloud?'cloud':'local')+'-failure.png'}).catch(()=>{});}
    finally{await c.close();}results.push(result);
  }
  return{runtime:browser.version(),results};
}
