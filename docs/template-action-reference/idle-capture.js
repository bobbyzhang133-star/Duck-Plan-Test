// Fresh contexts capture the reference's ordinary rest state before pointer feedback.
async(page)=>{
 const browser=page.context().browser(),origin='http://127.0.0.1:8034',out='/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/template-action-reference/',cases=[],errors=[];
 for(const [width,touch]of[[320,true],[835,false]]){
  const c=await browser.newContext({viewport:{width,height:900},hasTouch:touch,isMobile:touch,timezoneId:'America/Los_Angeles',serviceWorkers:'block',reducedMotion:'reduce'});
  try{await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const p=await c.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/?qa=reference-idle#calendar');await p.bringToFront();await p.waitForFunction(()=>typeof store!=='undefined'&&store.mode==='local'&&store.listItems().length>0);
   const id=await p.evaluate(async()=>{const klass=await store.upsertClass({id:crypto.randomUUID(),name:'Calculus',color:'#518fc9',code:'QA'});const t=await store.upsertTemplate({id:crypto.randomUUID(),classId:klass.id,title:'QA Calculus review',durationMinutes:60,priority:'Medium',notes:'Reference fixture',reminderChoice:'off'});selectedDate='2026-11-14';calendarView='week';setView('calendar',true);renderAll({autoScrollCalendar:false});return t.id;});
   if(touch)await p.locator('#phone-task-summary').tap();await p.locator('#calendar-templates-tab').click();await p.mouse.move(width-5,60);
   for(const theme of(width===320?['light','dark']:['light'])){
    await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    await p.waitForFunction(id=>{const card=document.querySelector(`[data-library-template="${id}"]`).parentElement,b=card.querySelector('[data-library-action="add-template"]'),s=card.querySelector('[data-library-action="schedule-template"]'),raw=getComputedStyle(b).getPropertyValue('--muted').trim();const expected=/^#[0-9a-f]{6}$/i.test(raw)?`rgb(${[1,3,5].map(i=>parseInt(raw.slice(i,i+2),16)).join(', ')})`:raw;return getComputedStyle(b).color===expected&&getComputedStyle(s).color===expected;},id);
    const colors=await p.evaluate(id=>{const card=document.querySelector(`[data-library-template="${id}"]`).parentElement;return [...card.querySelectorAll('.library-template-actions button')].slice(0,2).map(b=>({action:b.dataset.libraryAction,color:getComputedStyle(b).color,background:getComputedStyle(b).backgroundColor,shadow:getComputedStyle(b).boxShadow}));},id);
    await p.screenshot({path:out+`reference-${width}-${theme}.png`});cases.push({test:'fresh-idle-reference-colors',width,theme,status:'PASS',colors});
   }
  }finally{await c.close();}
 }
 return{runtime:browser.version(),cases,errors,allSyntheticContextsClosed:true};
}
