async(page)=>{
  const browser=page.context().browser(),results=[],assert=(v,m)=>{if(!v)throw Error(m);};
  for(const mode of ['signed-in','offline']){
    const origin=mode==='signed-in'?'http://127.0.0.1:18814':'http://127.0.0.1:8798',c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:mode==='offline'?'allow':'block'}),p=await c.newPage(),r={mode,input:'emulated touch'};p.setDefaultTimeout(15000);
    const field=n=>p.locator(`#task-form [name="${n}"]`);
    try{
      let id;
      if(mode==='signed-in'){
        const response=await c.request.post(origin+'/api/auth/sign-up',{headers:{Origin:origin},data:{email:`work-range-${Date.now()}@fixture.test`,password:crypto.randomUUID()+'-Fixture'}});assert(response.status()===201,'Signup failed');id=crypto.randomUUID();const day=offset=>{const d=new Date();d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10);};
        const imported=await c.request.post(origin+'/api/import',{headers:{Origin:origin},data:{itemRows:[{id,title:'Signed-in work range',type:'assignment',due_date:day(8),due_time:'16:15',scheduled_start:day(4)+'T23:30',duration_minutes:77,notes:'Preserve notes and deadline'}]}});assert(imported.ok(),'Fixture import failed');
      }
      await p.goto(origin+'/?work-range-mode='+mode+'#tasks');await p.waitForFunction(()=>{try{return store.listItems().length>0&&workAlertContextReady}catch{return false}});
      if(mode==='offline'){await p.evaluate(async()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);r.caches=await p.evaluate(()=>caches.keys());await c.setOffline(true);await p.reload();await p.waitForFunction(()=>{try{return store.listItems().length>0&&workAlertContextReady}catch{return false}});id=await p.locator('#all-task-list .task-select').first().getAttribute('data-edit-task');}
      const before=await p.evaluate(id=>store.listItems().find(t=>t.id===id),id);
      await p.locator(`#all-task-list .task-select[data-edit-task="${id}"]`).tap();await p.waitForFunction(()=>{const d=document.querySelector('#calendar-task-preview');return d?.open&&!d.dataset.popupMotion});await p.locator('#calendar-preview-edit').tap();await p.waitForFunction(()=>document.querySelector('#task-modal').open&&!document.querySelector('#task-modal').dataset.popupMotion);
      if(!await field('scheduledTime').isVisible())await p.locator('#task-schedule-options summary').tap();
      if(!await field('scheduledDate').inputValue())await field('scheduledDate').fill('2030-05-02');await field('scheduledTime').fill('10:00');await field('scheduledEndDate').fill(await field('scheduledDate').inputValue());await field('scheduledEndTime').fill('11:17');
      if(mode==='signed-in'){
        let fail=true;await p.route('**/api/items/'+id,route=>{if(fail&&route.request().method()==='PUT'){fail=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic outage'})});}return route.continue();});
        await p.locator('#save-task').tap();await p.waitForFunction(()=>!document.querySelector('#task-form-error').hidden);assert(await p.locator('#task-modal').evaluate(e=>e.open),'Failed save closed editor');r.failedSaveStayedOpen=true;
      }
      await p.locator('#save-task').tap();await p.waitForFunction(()=>!document.querySelector('#task-modal').open);await p.reload();await p.waitForFunction(id=>{try{return store.listItems().find(t=>t.id===id)?.scheduledStart?.endsWith('T10:00')}catch{return false}},id);
      const after=await p.evaluate(id=>store.listItems().find(t=>t.id===id),id);assert(after.durationMinutes===77&&after.dueDate===before.dueDate&&after.dueTime===before.dueTime&&(after.notes||'')===(before.notes||''),'Saved range or unrelated fields changed');
      await p.locator(`#all-task-list .task-select[data-edit-task="${id}"]`).tap();await p.waitForFunction(()=>{const d=document.querySelector('#calendar-task-preview');return d?.open&&!d.dataset.popupMotion});await p.locator('#calendar-preview-edit').tap();await p.waitForFunction(()=>document.querySelector('#task-modal').open&&!document.querySelector('#task-modal').dataset.popupMotion);assert(await field('scheduledEndTime').inputValue()==='11:17','End time lost after reload');r.status='PASS';r.rangeSaveReload=true;r.deadlineNotesPreserved=true;
    }catch(error){r.status='FAIL';r.error=error.message;}finally{await c.close();}results.push(r);
  }
  return{runtime:browser.version(),results,productionWrites:false};
}
