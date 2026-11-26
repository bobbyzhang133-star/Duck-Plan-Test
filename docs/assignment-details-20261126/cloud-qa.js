async (page) => {
  const browser=page.context().browser(),origin="http://127.0.0.1:18814",results=[];
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  for(const [name,width,height,touch]of[["desktop",1280,900,false],["phone",390,844,true]]){
    const c=await browser.newContext({viewport:{width,height},hasTouch:touch,timezoneId:"America/Los_Angeles",serviceWorkers:"block"}),p=await c.newPage(),result={name,viewport:[width,height],mode:"signed-in isolated local Worker/D1",input:touch?"emulated touchscreen":"mouse",errors:[]};
    p.on("pageerror",e=>result.errors.push(e.message));const act=e=>touch?e.tap():e.click();
    try{
      const account={email:`details-${name}-${Date.now()}@fixture.test`,password:crypto.randomUUID()+"-Fixture"};
      const response=await c.request.post(origin+"/api/auth/sign-up",{headers:{Origin:origin},data:account});assert(response.status()===201,"Signup failed");
      const classId=crypto.randomUUID(),id=crypto.randomUUID(),due=crypto.randomUUID(),today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles"}).format(new Date());
      const row={title:"Cloud assignment",class_id:classId,type:"assignment",due_date:today,due_time:"16:00",duration_minutes:45,notes:"Keep the signed-in assignment instructions"};
      const imported=await c.request.post(origin+"/api/import",{headers:{Origin:origin},data:{classRows:[{id:classId,name:"Science",code:"SC",color:"#538fc5"}],itemRows:[{...row,id,scheduled_start:today+"T10:00"},{...row,id:due,title:"Cloud deadline",due_time:"14:00"}]}});assert(imported.ok(),"Fixture import failed");
      await p.goto(origin+"/#calendar");await p.waitForFunction(()=>{try{return store.mode==="cloud"&&store.listItems().length===2&&workAlertContextReady}catch{return false}});
      await act(p.locator('[data-calendar-view="day"]'));
      const work=p.locator(`.calendar-event-block[data-select-task="${id}"]`);const fill=await work.evaluate(e=>getComputedStyle(e).backgroundColor);await act(work);
      await p.waitForFunction(()=>{const d=document.querySelector('#calendar-task-preview');return d?.open&&!d.dataset.popupMotion});
      assert(await p.locator('#calendar-task-preview').evaluate(e=>getComputedStyle(e).backgroundColor)===fill,"Cloud work color mismatch");
      assert(!await p.locator('#task-modal').evaluate(e=>e.open),"Editor opened before Edit");await act(p.locator('#calendar-preview-edit'));
      await p.waitForFunction(()=>document.querySelector('#task-modal').open&&!document.querySelector('#task-modal').dataset.popupMotion);
      await p.locator('#task-form [name="title"]').fill('Cloud assignment saved through details');
      let fail=true;await p.route('**/api/items/'+id,route=>{if(fail&&route.request().method()==='PUT'){fail=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary fixture outage'})});}return route.continue();});
      await act(p.locator('#save-task'));await p.waitForFunction(()=>!document.querySelector('#task-form-error').hidden);assert(await p.locator('#task-modal').evaluate(e=>e.open),"Failed edit dismissed editor");
      await act(p.locator('#save-task'));await p.waitForFunction(()=>!document.querySelector('#task-modal').open);
      await p.reload();await p.waitForFunction(id=>{try{return store.listItems().find(t=>t.id===id)?.title==='Cloud assignment saved through details'}catch{return false}},id);
      assert(await p.evaluate(id=>store.listItems().find(t=>t.id===id).notes==='Keep the signed-in assignment instructions'&&store.listItems().length===2,id),"Metadata or task count changed");
      const marker=p.locator(`#planner-calendar [data-select-task="${due}"]`);const red=await marker.evaluate(e=>getComputedStyle(e,'::before').backgroundColor);await act(marker);await p.waitForFunction(()=>{const d=document.querySelector('#calendar-task-preview');return d?.open&&!d.dataset.popupMotion});
      assert(await p.locator('#calendar-task-preview').evaluate(e=>getComputedStyle(e).backgroundColor)===red,"Cloud deadline tint mismatch");
      await act(p.locator('#calendar-preview-complete'));await p.waitForFunction(id=>store.listItems().find(t=>t.id===id)?.completed,due);
      await p.reload();await p.waitForFunction(id=>{try{return store.listItems().find(t=>t.id===id)?.completed}catch{return false}},due);
      assert(!result.errors.length,"Page errors");result.status="PASS";result.checks={detailsBeforeEdit:true,workAndDeadlineTints:true,fixture503Retry:true,saveReload:true,completeReload:true,stableTaskCount:2};
    }catch(error){result.status="FAIL";result.error=error.message;}finally{await c.close();}results.push(result);
  }
  return {runtime:browser.version(),results,productionWrites:false};
}
