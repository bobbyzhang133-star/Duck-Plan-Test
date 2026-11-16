async page => {
  const browser=page.context().browser(),out='/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/popup-content-morph/',assert=(v,m)=>{if(!v)throw Error(m);};
  const id='80000000-0000-4000-8000-000000000001',rows=[{id,title:'Review calculus notes',classId:null,priority:'Medium',durationMinutes:45,notes:'Synthetic animation check.',completed:false,source:'manual',schemaVersion:2,dueDate:'2026-11-20',dueTime:'17:00',scheduledStart:'2026-11-20T10:00'}];
  const c=await browser.newContext({viewport:{width:835,height:900},serviceWorkers:'allow',timezoneId:'America/Los_Angeles'});
  try{
    await c.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8034'?r.continue():r.abort());
    await c.addInitScript(rows=>{if(localStorage.getItem('popup-extra-seed'))return;localStorage.setItem('popup-extra-seed','1');localStorage.setItem('duckplan-demo-tasks-v1',JSON.stringify(rows));},rows);
    const p=await c.newPage(),errors=[];p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
    await p.clock.install({time:new Date('2026-11-20T12:00:00-08:00')});
    await p.goto('http://127.0.0.1:8034/?motionAudit=1#calendar');await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady&&navigator.serviceWorker.controller);
    await p.reload();await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
    const cache=await p.evaluate(async()=>({keys:await caches.keys(),controller:navigator.serviceWorker.controller?.scriptURL,assets:await Promise.all(['popup-motion.js','motion-tokens.js','planner-motion.css','calendar-task-preview.css'].map(async file=>{const cache=await caches.open('duckplan-app-motion-preview-v66'),res=await cache.match('./'+file),live=await fetch('./'+file);return {file,matches:await res.text()===await live.text()};}))}));assert(cache.keys.includes('duckplan-app-motion-preview-v66')&&cache.assets.every(a=>a.matches),'stale cache');
    await p.evaluate(()=>{selectedDate='2026-11-20';calendarView='day';calendarUserScrolled=true;renderAll({autoScrollCalendar:false});});
    const source=p.locator(`#daily-task-panel .task-select[data-edit-task="${id}"]`);
    // Real, uninterrupted runs; do not screenshot or scrub while measuring frames.
    for(let i=0;i<3;i++){await source.click();await p.waitForFunction(()=>document.querySelector('#task-modal').open&&!document.querySelector('#task-modal').dataset.popupMotion);await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#task-modal').open);}
    const audit=await p.locator('#motion-audit').textContent();
    // Sample the same actual WAAPI for a reproducible visual sequence.
    await p.evaluate(()=>{window.motionFrames=[];const native=Element.prototype.animate;Element.prototype.animate=function(...args){const a=native.apply(this,args);if(this.closest('.task-modal')){a.pause();motionFrames.push(a);}return a;};});
    await source.click();
    for(let n=0;n<=20;n++){await p.evaluate(time=>motionFrames.forEach(a=>a.currentTime=time),Math.min(319,n*16));await p.screenshot({path:out+`frame-${String(n).padStart(2,'0')}.png`});}
    await p.evaluate(()=>motionFrames.forEach(a=>a.finish()));await p.waitForFunction(()=>!document.querySelector('#task-modal').dataset.popupMotion);await p.screenshot({path:out+'final-window.png'});
    await p.keyboard.press('Escape');await p.evaluate(()=>motionFrames.filter(a=>a.playState==='paused').forEach(a=>a.finish()));
    // Closing has a second shell phase; allow that one to finish too.
    await p.waitForTimeout(50);await p.evaluate(()=>motionFrames.filter(a=>a.playState==='paused').forEach(a=>a.finish()));await p.waitForFunction(()=>!document.querySelector('#task-modal').open);
    // Return to native animations for real offline interactions.
    await p.reload();await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
    await c.setOffline(true);await p.reload();await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
    await p.evaluate(()=>{selectedDate='2026-11-20';calendarView='day';calendarUserScrolled=true;renderAll({autoScrollCalendar:false});});
    await source.click();await p.waitForFunction(()=>!document.querySelector('#task-modal').dataset.popupMotion);await p.locator('#task-form [name="title"]').fill('Offline reviewed notes');await p.locator('#task-form [type="submit"]').click();await p.waitForFunction(()=>!document.querySelector('#task-modal').open);
    await p.reload();await p.waitForFunction(id=>typeof store!=='undefined'&&store.listItems().find(t=>t.id===id)?.title==='Offline reviewed notes',id);
    await c.setOffline(false);await p.reload();await p.waitForFunction(id=>typeof store!=='undefined'&&store.listItems().find(t=>t.id===id)?.title==='Offline reviewed notes',id);
    assert(errors.length===0,errors.join(';'));
    return {runtime:browser.version(),status:'PASS',mode:'isolated local browser / SW66 offline cache; not installed PWA',cache,offlineEditReloadReconnect:'PASS',audit: audit.split('\n').map(JSON.parse),errors};
  }finally{await c.close();}
}
