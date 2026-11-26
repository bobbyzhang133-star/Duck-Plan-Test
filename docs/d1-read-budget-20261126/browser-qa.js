async(page)=>{
 const browser=page.context().browser(),origin='http://127.0.0.1:18814',root='/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/d1-read-budget-20261126/', contexts=[],cases=[],assert=(v,m)=>{if(!v)throw Error(m);};
 try{
  const seed=await browser.newContext();contexts.push(seed);const signed=await seed.request.post(origin+'/api/auth/sign-up',{headers:{Origin:origin},data:{email:`budget-browser-${Date.now()}@fixture.test`,password:crypto.randomUUID()+'-Fixture'}});assert(signed.status()===201,'Signup');
  const id=crypto.randomUUID();await seed.request.post(origin+'/api/import',{headers:{Origin:origin},data:{itemRows:[{id,title:'Read budget mobile long assignment title to check wrapping',notes:'Keep these details',due_date:'2026-11-19'}]}});const cookies=await seed.cookies();
  const peer=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});contexts.push(peer);await peer.addCookies(cookies);const pp=await peer.newPage();await pp.goto(origin+'/#tasks');await pp.waitForFunction(()=>{try{return store.mode==='cloud'&&store.listItems().length===1}catch{return false}});await pp.waitForTimeout(200);
  for(const v of [{name:'small',width:320,height:568,touch:true},{name:'phone',width:390,height:844,touch:true},{name:'landscape',width:844,height:390,touch:true},{name:'ipad',width:835,height:1112,touch:true},{name:'desktop',width:1280,height:900}]){
   const c=await browser.newContext({viewport:{width:v.width,height:v.height},hasTouch:!!v.touch,isMobile:v.name==='phone'||v.name==='small',serviceWorkers:'block'});contexts.push(c);await c.addCookies(cookies);const p=await c.newPage();p.setDefaultTimeout(15000);const errors=[],loads=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',async r=>{if(new URL(r.url()).pathname==='/api/planner')loads.push(await r.json());});
   const r={viewport:[v.width,v.height],orientation:v.width>v.height?'landscape':'portrait',mode:'signed-in local Worker/D1',input:v.touch?'emulated touch':'mouse/keyboard'};const act=el=>v.touch?el.tap():el.click();
   try{
    await p.goto(origin+'/#tasks');await p.waitForFunction(()=>{try{return store.mode==='cloud'&&workAlertContextReady}catch{return false}});await p.waitForTimeout(300);
    await act(p.locator(`#all-task-list .task-select[data-edit-task="${id}"]`));await p.waitForFunction(()=>document.querySelector('#calendar-task-preview')?.open&&!document.querySelector('#calendar-task-preview').dataset.popupMotion);await p.screenshot({path:root+v.name+'-details.png'});
    const completeButton=p.getByRole('button',{name:'Mark complete',exact:true});await completeButton.scrollIntoViewIfNeeded();const buttonBounds=await completeButton.boundingBox();assert(buttonBounds&&buttonBounds.y>=0&&buttonBounds.y+buttonBounds.height<=v.height,'Completion action unreachable');await p.screenshot({path:root+v.name+'-actions.png'});r.scrolledActionsReachable=true;
    const focusBefore=await p.evaluate(()=>document.activeElement?.id);
    for(let i=0;i<10;i++)await p.evaluate(()=>store.refresh());assert(await p.evaluate(()=>document.querySelector('#calendar-task-preview').open),'No-op refresh closed details');assert((await p.evaluate(()=>document.activeElement?.id))===focusBefore,'No-op refresh moved focus');
    assert(loads.slice(-10).every(d=>d.unchanged===true),'Refresh downloaded full snapshot');r.unchangedRefreshes=10;r.focusRetained=true;
    await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#calendar-task-preview')?.open);await p.screenshot({path:root+v.name+'-closed.png'});
    const initial=loads.length;
    const task=await pp.evaluate(id=>store.listItems().find(t=>t.id===id),id);
    const complete=await peer.request.post(origin+'/api/items/complete-overdue',{headers:{Origin:origin},data:{items:[{id,expected_revision:task.syncRevision,due_date:'2026-11-19',due_time:null}],before:'2026-11-20T13:00:00.000'}});assert(complete.ok(),'Peer completion');
    await p.waitForFunction(id=>store.listItems().find(t=>t.id===id)?.completed,id);await pp.waitForFunction(id=>store.listItems().find(t=>t.id===id)?.completed,id);await p.waitForTimeout(150);assert(loads.length===initial,'Compact completion triggered a full reload');r.compactLiveCompletion=true;
    const reopen=await peer.request.patch(origin+'/api/items/'+id,{headers:{Origin:origin},data:{completed:false}});assert(reopen.ok(),'Reopen');await p.waitForFunction(id=>!store.listItems().find(t=>t.id===id)?.completed,id);await pp.waitForFunction(id=>!store.listItems().find(t=>t.id===id)?.completed,id);
    await p.reload();await p.waitForFunction(id=>{try{return store.listItems().find(t=>t.id===id)?.completed===false}catch{return false}},id);r.durablePeerChange=true;
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');assert(!errors.length,'Browser errors: '+errors.join());r.status='PASS';
   }catch(error){r.status='FAIL';r.error=error.message;await p.screenshot({path:root+v.name+'-failure.png'}).catch(()=>{});}finally{await c.close();}cases.push(r);
  }
  return{runtime:browser.version(),source:'d23fb66 + read-budget fix; cache159; schema0012',cases,productionWrites:false,physicalSafari:'NOT RUN',nativeApp:'NOT RUN: frozen release checkpoint',passed:cases.every(c=>c.status==='PASS')};
 }finally{for(const c of contexts)await c.close().catch(()=>{});}
}
