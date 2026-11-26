async (page) => {
  const browser=page.context().browser(),results=[],assert=(v,m)=>{if(!v)throw Error(m);};
  for(const mode of ['signed-in','offline']){
    const origin=mode==='signed-in'?'http://127.0.0.1:18814':'http://127.0.0.1:8798',c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:mode==='offline'?'allow':'block'}),p=await c.newPage(),r={mode,input:'emulated touch'};p.setDefaultTimeout(15000);
    try{
      let id;
      if(mode==='signed-in'){
        const response=await c.request.post(origin+'/api/auth/sign-up',{headers:{Origin:origin},data:{email:`card-colors-${Date.now()}@fixture.test`,password:crypto.randomUUID()+'-Fixture'}});assert(response.status()===201,'Fixture signup failed');id=crypto.randomUUID();
        const imported=await c.request.post(origin+'/api/import',{headers:{Origin:origin},data:{itemRows:[{id,title:'Overdue task card',type:'assignment',due_date:'2026-01-01',notes:'Preserve signed-in task notes'}]}});assert(imported.ok(),'Fixture import failed');
      }
      await p.goto(origin+'/?card-color-mode='+mode+'#tasks');await p.waitForFunction(()=>{try{return store.listItems().length>0&&workAlertContextReady}catch{return false}});
      if(mode==='offline'){
        await p.evaluate(async()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);r.caches=await p.evaluate(()=>caches.keys());await c.setOffline(true);await p.reload();await p.waitForFunction(()=>{try{return store.listItems().length>0}catch{return false}});id=await p.locator('#all-task-list .task-select').first().getAttribute('data-edit-task');
      }
      const source=p.locator(`#all-task-list .task-select[data-edit-task="${id}"]`);await source.waitFor({state:'visible'});await p.waitForTimeout(300);const fill=await source.evaluate(e=>getComputedStyle(e.closest('.all-task-row')).backgroundColor);r.sourceFill=fill;
      await source.tap();await p.waitForFunction(()=>{const d=document.querySelector('#calendar-task-preview');return d?.open&&!d.dataset.popupMotion});
      r.preview=await p.locator('#calendar-task-preview').evaluate(e=>({fill:getComputedStyle(e).backgroundColor,kind:e.dataset.assignmentKind,tone:e.dataset.taskTone}));assert(r.preview.fill===fill,'Card/window color mismatch');
      await p.locator('#calendar-preview-edit').tap();await p.waitForFunction(()=>document.querySelector('#task-modal').open&&!document.querySelector('#task-modal').dataset.popupMotion);await p.locator('#task-form [name="title"]').fill('Saved with matching task colors');await p.locator('#save-task').tap();await p.waitForFunction(()=>!document.querySelector('#task-modal').open);await p.reload();await p.waitForFunction(id=>{try{return store.listItems().find(t=>t.id===id)?.title==='Saved with matching task colors'}catch{return false}},id);
      r.status='PASS';r.colorsMatch=true;r.editReload=true;
    }catch(error){r.status='FAIL';r.error=error.message;}finally{await c.close();}results.push(r);
  }
  return {runtime:browser.version(),results,productionWrites:false};
}
