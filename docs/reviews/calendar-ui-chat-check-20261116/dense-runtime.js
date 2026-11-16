async page=>{
 const browser=page.context().browser(),out='/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/reviews/calendar-ui-chat-check-20261116/',results=[];
 for(const width of [835,390]){
  const c=await browser.newContext({viewport:{width,height:1000},isMobile:width<700,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce',timezoneId:'America/Los_Angeles'});
  try{
   await c.addInitScript(()=>{const tasks=[0,1,2].map((n)=>({id:'dense-review-'+n,title:'Deadline '+(n+1),dueDate:'2026-11-16',dueTime:['17:00','17:05','17:10'][n],scheduledStart:n===0?'2026-11-16T16:30':null,durationMinutes:90,classId:null,priority:'Medium',notes:'Synthetic dense review',completed:false,schemaVersion:2}));localStorage.setItem('duckplan-demo-tasks-v1',JSON.stringify(tasks));localStorage.setItem('duckplan-demo-classes-v1','[]');});
   const p=await c.newPage();p.setDefaultTimeout(10000);await p.goto('http://127.0.0.1:8034/?qa=dense-calendar#calendar');await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
   await p.evaluate(()=>{selectedDate='2026-11-16';calendarView='week';calendarUserScrolled=true;renderAll({autoScrollCalendar:false});});
   const group=p.locator('.timed-deadline-group-trigger');if(await group.count()!==1)throw Error('Expected one deadline group');await group.scrollIntoViewIfNeeded();
   const measured=await p.evaluate(()=>({points:[...document.querySelectorAll('[data-deadline-minute]')].map(e=>Number(e.dataset.deadlineMinute)),workWidth:document.querySelector('.calendar-event-block').getBoundingClientRect().width,workLabel:document.querySelector('.calendar-event-block').getAttribute('aria-label'),overflow:document.documentElement.scrollWidth>innerWidth+1}));
   if(measured.points.join(',')!=='1020,1025,1030'||measured.overflow||measured.workWidth<30)throw Error('Dense marker geometry/containment');
   await p.screenshot({path:out+'dense-'+width+'.png'});await group.click();await p.waitForFunction(()=>document.querySelector('.calendar-deadline-group-preview[open]'));
   const dialog=p.locator('.calendar-deadline-group-preview[open]');for(const n of [1,2,3])if(!(await dialog.innerText()).includes('Deadline '+n))throw Error('Hidden deadline '+n);
   await dialog.getByRole('button',{name:/Deadline 2\. Deadline at/}).click();await p.waitForFunction(()=>document.querySelector('.calendar-task-preview[open]')&&!document.querySelector('.calendar-deadline-group-preview[open]'));
   if(!(await p.locator('.calendar-task-preview[open]').innerText()).includes('Deadline 2'))throw Error('Group selection wrong task');
   await p.keyboard.press('Escape');results.push({width,status:'PASS',...measured,groupContainsAllDeadlines:true,selectionOpensCorrectTask:true});
  }finally{await c.close();}
 }
 return {runtime:browser.version(),mode:'isolated local browser fixtures',results};
}
