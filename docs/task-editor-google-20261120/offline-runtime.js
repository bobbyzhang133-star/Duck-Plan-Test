async page=>{
  const c=await page.context().browser().newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),p=await c.newPage();
  const check=(v,m)=>{if(!v)throw Error(m);};
  try{
    await c.addInitScript(()=>{if(localStorage.getItem('duckplan-demo-tasks-v1')===null)localStorage.setItem('duckplan-demo-tasks-v1','[]');});
    await p.goto('http://127.0.0.1:8034/#calendar');await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload();
    await p.waitForFunction(()=>!!navigator.serviceWorker.controller&&typeof store!=='undefined'&&workAlertContextReady);
    const cache=await p.evaluate(async()=>{let keys=await caches.keys();let c=await caches.open('duckplan-app-motion-preview-v103');return{keys,css:!!await c.match('./task-editor.css'),js:!!await c.match('./task-editor.js')};});
    check(cache.keys.includes('duckplan-app-motion-preview-v103')&&cache.css&&cache.js,'Editor missing from current cache');
    await c.setOffline(true);await p.reload();await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
    await p.locator('#phone-add-task').click();await p.waitForFunction(()=>document.querySelector('#task-modal').open&&!document.querySelector('#task-modal').dataset.popupMotion);
    check(await p.locator('#task-form').evaluate(e=>getComputedStyle(e).borderRadius)==='28px','Offline old CSS');
    check(await p.locator('#task-work-summary').innerText()==='Not scheduled','Offline script missing');
    await p.locator('[name=title]').fill('Offline editor task');await p.locator('#save-task').click();await p.waitForFunction(()=>!document.querySelector('#task-modal').open);
    await p.reload();await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);check(await p.evaluate(()=>store.listItems().filter(t=>t.title==='Offline editor task').length)===1,'Offline persistence');
    return{status:'PASS',runtime:c.browser().version(),surface:'browser tab with service worker, not installed PWA',cache,checks:['Current shell includes both new assets','Offline compact editor style and summaries','Offline save and reload persistence']};
  }finally{await c.close();}
}
