async page=>{
 const browser=page.context().browser(),c=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/Los_Angeles',hasTouch:true,isMobile:true,reducedMotion:'reduce'});
 try{
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-11-16T10:05:00-08:00')});
  await p.goto('http://127.0.0.1:8034/?qa=time-cutoff-cache#calendar');await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);await p.waitForFunction(()=>navigator.serviceWorker.controller!==null,undefined,{timeout:30000});
  const cache=await p.evaluate(async()=>{const name='duckplan-app-motion-preview-v70',c=await caches.open(name),keys=await c.keys(),files={};for(const file of ['calendar-viewport.js','calendar-date-clarity.css','app.js','index.html']){const key=keys.find(k=>new URL(k.url).pathname==='/'+file);if(!key)throw Error('Not cached: '+file);const body=await(await c.match(key)).arrayBuffer();files[file]=[...new Uint8Array(await crypto.subtle.digest('SHA-256',body))].map(v=>v.toString(16).padStart(2,'0')).join('');}return {name,files};});
  await c.setOffline(true);await p.reload();await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady&&document.querySelectorAll('.time-axis-label').length===24);
  await p.evaluate(async()=>{await store.upsertItem({id:'cutoff-offline-date',title:'Offline date-only label check',dueDate:'2026-11-16',durationMinutes:45});});
  const sizes=[];
  for(const viewport of [{width:320,height:568},{width:844,height:390},{width:835,height:1112},{width:390,height:844}]){
   await p.setViewportSize(viewport);await p.evaluate(()=>{selectedDate='2026-11-16';calendarView='week';calendarUserScrolled=true;renderAll({autoScrollCalendar:false});const r=document.querySelector('#planner-calendar');r.scrollTop=360;});await p.waitForTimeout(100);
   const state=await p.evaluate(()=>{const root=document.querySelector('#planner-calendar'),r=root.getBoundingClientRect(),axis=root.querySelector('.time-axis').getBoundingClientRect(),top=Math.max(r.top+root.clientTop,...[...root.querySelectorAll('.timeline-days,.timeline-deadlines')].map(e=>e.getBoundingClientRect().bottom)),bottom=r.top+root.clientTop+root.clientHeight;const labels=[...root.querySelectorAll('.time-axis-label')].filter(e=>getComputedStyle(e).opacity!=='0').map(e=>e.getBoundingClientRect());return {width:innerWidth,height:innerHeight,visibleLabels:labels.length,cutoff:labels.some(l=>l.top<top-.5||l.bottom>bottom+.5||l.left<r.left||l.right>axis.right),pageOverflow:document.documentElement.scrollWidth>innerWidth+1,columns:root.querySelectorAll('.timeline-column').length,rootHeight:root.clientHeight,top,bottom,calendarView,phone:phonePlannerQuery.matches,axis:axis.toJSON(),labelRects:[...root.querySelectorAll('.time-axis-label')].slice(5,10).map(e=>({text:e.textContent,opacity:getComputedStyle(e).opacity,rect:e.getBoundingClientRect().toJSON()}))};});
   if(state.cutoff||state.pageOverflow||!state.visibleLabels)throw Error('Resize cutoff '+JSON.stringify(state));sizes.push(state);if(viewport.width===844)await p.screenshot({path:'/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-time-cutoff/after-landscape.png'});
  }
  await p.reload();await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady&&store.listItems().some(t=>t.id==='cutoff-offline-date'));
  if(errors.length)throw Error(errors.join(';'));
  return {status:'PASS',runtime:browser.version(),cache,offlineReloadAndPersistence:true,dynamicDeadlineBand:true,resize:sizes,errors,installedPWAClaim:false};
 }finally{await c.close();}
}
