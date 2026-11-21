async page=>{
  const c=await page.context().browser().newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block'}),p=await c.newPage(),origin='http://127.0.0.1:8798';
  const check=(v,m)=>{if(!v)throw Error(m);};
  try{
    const signed=await c.request.post(origin+'/api/auth/sign-up',{data:{email:`editor-failure-${Date.now()}@example.test`,password:`Fixture-${Date.now()}-${Math.random()}`},headers:{Origin:origin}});check(signed.status()===201,'QA signup');
    await p.goto(origin+'/#calendar');await p.waitForFunction(()=>typeof store!=='undefined'&&store.mode==='cloud'&&workAlertContextReady);
    await p.locator('#phone-add-task').click();await p.waitForFunction(()=>document.querySelector('#task-modal').open&&!document.querySelector('#task-modal').dataset.popupMotion);
    await p.locator('[name=title]').fill('Disposable failure test');
    await c.route('**/api/items/*',r=>r.request().method()==='PUT'?r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary QA save failure'})}):r.continue());
    await p.locator('#save-task').click();await p.locator('#task-form-error:not([hidden])').waitFor();
    check(await p.locator('#task-form-error').isVisible(),'Failure concealed');
    check(await p.locator('#save-task').isEnabled(),'Retry unavailable');
    check(await p.locator('#task-alarm-options').evaluate(e=>!e.open),'Error forced unrelated disclosure');
    check(await p.evaluate(()=>store.listItems().length)===0,'Failed save wrote task');
    const geometry=await p.locator('#task-form-error').evaluate(e=>({rect:e.getBoundingClientRect().toJSON(),viewport:innerHeight}));check(geometry.rect.top>=16&&geometry.rect.bottom<geometry.viewport-16,'Error offscreen');
    await p.screenshot({path:'/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/task-editor-google-20261120/phone-save-error.png'});
    await c.unroute('**/api/items/*');await p.locator('#save-task').click();await p.waitForFunction(()=>!document.querySelector('#task-modal').open);
    await p.reload();await p.waitForFunction(()=>typeof store!=='undefined'&&store.mode==='cloud'&&workAlertContextReady);check(await p.evaluate(()=>store.listItems().filter(t=>t.title==='Disposable failure test').length)===1,'Retry duplicated or lost task');
    return{status:'PASS',runtime:c.browser().version(),mode:'signed-in current loopback Worker/D1; one deliberate PUT 503',checks:['Visible error outside collapsed disclosures','Data preserved and retry enabled','Successful retry exactly once after reload'],geometry};
  }finally{await c.close();}
}
