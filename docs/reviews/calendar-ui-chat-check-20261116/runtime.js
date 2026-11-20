// Read-only product review. Synthetic records live only in isolated browser contexts.
async page => {
  const origin='http://127.0.0.1:8034',out='/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/reviews/calendar-ui-chat-check-20261116/';
  const browser=page.context().browser(),results=[];
  const check=(v,m)=>{if(!v)throw Error(m);};
  const tasks=[
    {id:'calendar-review-work',title:'Work on calculus',classId:null,scheduledStart:'2026-11-16T15:00',durationMinutes:60,dueDate:'2026-11-16',dueTime:'17:00'},
    {id:'calendar-review-date-only',title:'Date-only reading',classId:null,scheduledStart:null,durationMinutes:30,dueDate:'2026-11-16',dueTime:''},
    {id:'calendar-review-custom',title:'Review class notes',classId:'review-math',scheduledStart:'2026-11-16T14:00',durationMinutes:45,dueDate:'2026-11-16',dueTime:'18:15'},
    {id:'calendar-review-late',title:'Finish overdue reflection',classId:null,scheduledStart:'2026-11-16T18:00',durationMinutes:30,dueDate:'2026-11-15',dueTime:'13:00'},
  ].map(t=>({priority:'Medium',notes:'Synthetic review record',completed:false,source:'manual',schemaVersion:2,...t}));
  for(const width of [1280,835,390,320]){
    const c=await browser.newContext({viewport:{width,height:1000},hasTouch:width<1000,isMobile:width<700,serviceWorkers:'block',timezoneId:'America/Los_Angeles',reducedMotion:'reduce'});
    try{
      await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      await c.addInitScript(({tasks})=>{if(localStorage.getItem('calendar-review-seeded'))return;localStorage.setItem('calendar-review-seeded','1');localStorage.setItem('duckplan-demo-tasks-v1',JSON.stringify(tasks));localStorage.setItem('duckplan-demo-classes-v1',JSON.stringify([{id:'review-math',name:'Calculus',color:'#538fc5',code:'M'}]));},{tasks});
      const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(10000);
      await p.clock.install({time:new Date('2026-11-16T12:00:00-08:00')});await p.goto(origin+'/?qa=calendar-chat-check#calendar');
      await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
      check(await p.evaluate(()=>document.body.dataset.view==='calendar'),'Calendar is not default route');
      const initial=await p.evaluate(()=>({phoneSheetCollapsed:!document.body.classList.contains('task-panel-open'),phoneNav:!!document.querySelector('.phone-bottom-nav'),source:[...document.scripts].map(s=>s.src).filter(s=>s.includes('app.js?v='))}));
      if(width<700)check(initial.phoneSheetCollapsed,'Phone Tasks not collapsed');
      const before=await p.evaluate(()=>JSON.stringify(store.listItems()));
      for(const mode of ['day','week']){
        await p.evaluate(mode=>{selectedDate='2026-11-16';calendarView=mode;calendarUserScrolled=true;renderAll({autoScrollCalendar:false});},mode);
        const evidence=await p.evaluate(()=>{
          const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
          const block=document.querySelector('.calendar-event-block[data-edit-task="calendar-review-work"]'),custom=document.querySelector('.calendar-event-block[data-edit-task="calendar-review-custom"]');
          const points=[...document.querySelectorAll('.timeline-column [data-deadline-minute]')].map(e=>({minute:Number(e.dataset.deadlineMinute),top:e.getBoundingClientRect().y-e.closest('.timeline-column').getBoundingClientRect().y}));
          return {columns:document.querySelectorAll('.timeline-column').length,phoneDays:[...document.querySelectorAll('#phone-week-strip button')].filter(e=>e.getClientRects().length).length,topBand:[...document.querySelectorAll('.timeline-deadlines .deadline-chip')].map(e=>e.textContent.trim()),points,hourHeight:parseFloat(getComputedStyle(document.querySelector(".timeline-calendar")).getPropertyValue("--hour-height")),work:rect(block),workColor:getComputedStyle(block).backgroundColor,workBorder:getComputedStyle(block).borderLeftWidth,customColor:getComputedStyle(custom).backgroundColor,taskPanel:rect(document.querySelector('#daily-task-panel')),calendarPanel:rect(document.querySelector('.unified-calendar-panel')),documentOverflow:document.documentElement.scrollWidth>innerWidth+1,hours:document.querySelectorAll('.time-axis > span').length};
        });
        check(evidence.columns===(mode==='week'&&width>=700?7:1),'Wrong responsive timeline columns');
        if(mode==='week'&&width<700)check(evidence.phoneDays===7,'Phone Week lacks seven-day selector');
        check(evidence.topBand.length===1&&evidence.topBand[0].includes('Date-only'),'Timed deadline in top band');
        for(const minute of [1020,1095]){const pin=evidence.points.find(v=>v.minute===minute);check(pin,'Missing exact deadline '+minute);check(Math.abs(pin.top-minute/60*evidence.hourHeight)<2,'Deadline geometry differs from exact minute');}
        check(evidence.workColor==='rgb(255, 243, 191)'&&evidence.customColor!==evidence.workColor,'Default/custom fill mismatch');
        check(parseFloat(evidence.workBorder)===0,'Colored work stripe remains');
        check(!evidence.documentOverflow,'Page-level overflow');
        if(width>=700)check(evidence.taskPanel.x+evidence.taskPanel.width<=evidence.calendarPanel.x+2,'Task column not beside calendar');
        const deadline=p.locator('.timed-deadline-marker[data-edit-task="calendar-review-work"]');
        const control=(await deadline.count())?deadline:p.locator('.timed-deadline-marker').filter({hasText:'Work on calculus'});
        await control.scrollIntoViewIfNeeded();
        await p.screenshot({path:out+`calendar-${width}-${mode}.png`});
        await control.click();await p.waitForFunction(()=>document.querySelector('.calendar-task-preview[open]')||document.querySelector('dialog[open]'));
        const preview=await p.locator('dialog[open]').innerText();check(preview.includes('Work on calculus')&&preview.includes('Edit')&&preview.includes('Reschedule'),'Compact preview missing dates/actions');
        await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('dialog[open]'));
        results.push({width,mode,status:'PASS',initial,...evidence,previewActions:true,pageErrors:errors});
      }
      if(width<700){await p.locator('#phone-task-summary').click();await p.waitForFunction(()=>document.body.classList.contains('task-panel-open'));}
      const card=p.locator('[data-task-card="calendar-review-work"]').first();
      check(await card.locator('.task-date-due').count()===1&&await card.locator('.task-date-work').count()===1,'Separate Due/Work rows absent');
      check(await p.locator('[data-task-card="calendar-review-late"] .task-overdue-label').count()>0&&await p.locator('[data-task-card="calendar-review-late"] .task-plan-warning').count()>0,'Distinct warning pills absent');
      await p.screenshot({path:out+`task-cards-${width}.png`});
      const after=await p.evaluate(()=>JSON.stringify(store.listItems()));check(before===after,'Review interactions changed task records');check(errors.length===0,errors.join(';'));
    }finally{await c.close();}
  }
  return {runtime:browser.version(),sourceCommit:'ca0a00e5e20da741498a63397b760b3961b6f3ea',mode:'isolated local browser fixtures; no user records',results};
}
