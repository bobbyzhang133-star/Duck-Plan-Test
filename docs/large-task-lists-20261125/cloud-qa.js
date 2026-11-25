// Disposable localhost accounts and real Worker/D1; no production writes.
async(page)=>{
  const browser=page.context().browser(),origin="http://127.0.0.1:18763",cases=[];
  const assert=(v,m)=>{if(!v)throw Error(m);};
  for(const [name,width,height,touch]of[["desktop",1280,900,false],["phone",390,844,true]]){
    const c=await browser.newContext({viewport:{width,height},hasTouch:touch,serviceWorkers:"block",reducedMotion:"reduce"}),p=await c.newPage(),r={name,viewport:[width,height],touchEmulated:touch,errors:[]};p.on('pageerror',e=>r.errors.push(e.message));
    const account={email:`large-list-${name}-${Date.now()}@example.test`,password:`Fixture-${Date.now()}-${Math.random()}`},second={email:`other-large-${name}-${Date.now()}@example.test`,password:`Fixture-${Date.now()}-${Math.random()}`};
    try{
      const signup=await c.request.post(origin+'/api/auth/sign-up',{data:account,headers:{Origin:origin}});assert(signup.status()===201,'Fixture signup failed');
      for(let start=0;start<9119;start+=2000){
        const rows=Array.from({length:Math.min(2000,9119-start)},(_,i)=>({id:crypto.randomUUID(),title:'Cloud overdue '+String(start+i).padStart(5,'0'),due_date:'2026-01-01',due_time:'12:00',notes:'Keep cloud notes',duration_minutes:45}));
        const imported=await c.request.post(origin+'/api/import',{data:{itemRows:rows},headers:{Origin:origin}});assert(imported.ok(),'Large fixture import failed');
      }
      await p.goto(origin+'/#tasks',{timeout:60000});await p.waitForFunction(()=>{try{return store.mode==='cloud'&&store.listItems().length===9119}catch{return false}},{},{timeout:30000});
      assert(await p.locator('#all-task-list .all-task-row').count()===40,'Signed-in list unbounded');
      await p.locator('#task-pages-top [data-task-page-direction="1"]').click();
      const edit=p.locator('#all-task-list [data-edit-task]').first(),id=await edit.getAttribute('data-edit-task');await edit.click();await p.waitForFunction(()=>document.querySelector('#task-modal').open);
      await p.locator('#task-form [name="title"]').fill('Edited cloud task on page two');
      let fail=true;await p.route('**/api/items/'+id,route=>{if(route.request().method()==='PUT'&&fail){fail=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary fixture outage'})});}return route.continue();});
      await p.locator('#save-task').click();await p.waitForFunction(()=>!document.querySelector('#task-form-error').hidden);
      assert(await p.evaluate(id=>store.listItems().find(t=>t.id===id).title!=='Edited cloud task on page two',id),'Failed save was not rolled back');
      await p.locator('#save-task').click();await p.waitForFunction(()=>!document.querySelector('#task-modal').open);
      await p.reload();await p.waitForFunction(()=>{try{return store.listItems().some(t=>t.title==='Edited cloud task on page two'&&t.notes==='Keep cloud notes')}catch{return false}});
      r.pagedEditFailureRetryAndReload=true;
      await p.locator('#task-pages-top [data-task-page-direction="1"]').click();
      await p.evaluate(async data=>{await store.signOut();await store.signUp(data.email,data.password);},second);
      await p.waitForFunction(()=>store.mode==='cloud'&&store.listItems().length===0);assert(await p.locator('#all-task-list .all-task-row').count()===0,'Old-owner rows remained');
      await p.evaluate(async data=>{await store.signOut();await store.signIn(data.email,data.password);},account);
      await p.waitForFunction(()=>store.mode==='cloud'&&store.listItems().length===9119);
      assert((await p.locator('#task-pages-top .task-page-range').textContent()).startsWith('1–40'),'Paging position leaked across owner change');
      assert(await p.evaluate(()=>document.querySelectorAll('*').length<10000),'Signed-in DOM unbounded');r.ownerIsolationAndPageReset=true;r.passed=!r.errors.length;
    }catch(error){r.passed=false;r.error=error.message;}
    finally{await c.close();}cases.push(r);
  }
  return{runtime:browser.version(),origin,cases,passed:cases.every(c=>c.passed),productionWrites:false};
}
