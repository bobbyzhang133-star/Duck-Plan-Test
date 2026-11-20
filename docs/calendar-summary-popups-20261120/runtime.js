async page => {
  const browser=page.context().browser(),results=[];
  const out='/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-summary-popups-20261120/';
  const check=(v,m)=>{if(!v)throw Error(m);};
  for(const viewport of [{width:1470,height:801},{width:1280,height:900},{width:835,height:1000},{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
    const c=await browser.newContext({viewport,hasTouch:viewport.width<1000,isMobile:viewport.width<700||viewport.height<500,serviceWorkers:'block',timezoneId:'America/Los_Angeles',reducedMotion:viewport.width===320?'reduce':'no-preference'});
    try{
      await c.addInitScript(()=>{
        if(localStorage.getItem('summary-window-qa'))return;
        localStorage.setItem('summary-window-qa','1');localStorage.setItem('duckplan-demo-classes-v1','[]');
        localStorage.setItem('duckplan-demo-tasks-v1',JSON.stringify([
          {id:'first',title:'Morning work',classId:null,scheduledStart:'2026-11-20T09:00',durationMinutes:60,dueDate:'2026-11-20',dueTime:'17:00'},
          {id:'overnight',title:'Overnight review',classId:null,scheduledStart:'2026-11-20T23:30',durationMinutes:90,dueDate:'2026-11-21',dueTime:'12:00'},
          {id:'date-only',title:'Reading response',classId:null,scheduledStart:null,durationMinutes:45,dueDate:'2026-11-20',dueTime:''},
          {id:'work-only',title:'Work without deadline',classId:null,scheduledStart:'2026-11-19T10:00',durationMinutes:45,dueDate:'',dueTime:''},
          {id:'due-only',title:'Deadline without work',classId:null,scheduledStart:null,durationMinutes:45,dueDate:'2026-11-18',dueTime:'14:00'}
        ].map(t=>({...t,priority:'Medium',completed:false,schemaVersion:2}))));
      });
      const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
      await p.clock.install({time:new Date('2026-11-20T12:30:00-08:00')});
      await p.goto('http://127.0.0.1:8034/?qa=summary-windows#calendar');await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
      await p.evaluate(()=>{selectedDate='2026-11-20';calendarView='week';calendarUserScrolled=true;renderAll({autoScrollCalendar:false});});
      const before=await p.evaluate(()=>JSON.stringify(store.listItems()));
      await p.locator('.calendar-day-heading > strong').first().evaluate(e=>e.click());
      check(await p.evaluate(()=>selectedDate==='2026-11-20'),'Heading changed selected date');
      check(await p.locator('button.calendar-date-button').count()===0,'Heading remains a button');
      const geometry=await p.evaluate(()=>({
        overflow:document.documentElement.scrollWidth>innerWidth+1,
        single:[...document.querySelectorAll('#planner-calendar .calendar-day-counts.is-single')].map(e=>({row:e.getBoundingClientRect().width,button:e.querySelector('button').getBoundingClientRect().width})),
        lines:[...document.querySelectorAll('.week-view .calendar-day-heading')].slice(1).map(e=>({bottom:getComputedStyle(e,'::before').bottom,left:e.getBoundingClientRect().left})),
        workColor:getComputedStyle(document.querySelector('[data-day-list="work"]')).color,
        headerHeight:document.querySelector('.timeline-days').getBoundingClientRect().height
      }));
      check(!geometry.overflow&&geometry.single.every(x=>Math.abs(x.row-x.button)<1),'Single tab does not fill row');
      check(geometry.lines.every(x=>x.bottom==='0px'),'Divider stops above header bottom');
      check(geometry.workColor==='rgb(37, 91, 160)','Work is not blue');
      if(await p.locator('#phone-week-strip:not([hidden])').count()){
        await p.locator('.phone-week-date[data-date="2026-11-19"]').click();check(await p.evaluate(()=>selectedDate==='2026-11-19'),'Phone date selection broken');
        const single=p.locator('#planner-calendar .calendar-day-counts.is-single');check(await single.count()===1,'Phone single summary missing');
        const g=await single.evaluate(e=>({a:e.getBoundingClientRect().width,b:e.querySelector('button').getBoundingClientRect().width}));check(Math.abs(g.a-g.b)<1,'Phone single tab width');
        await p.locator('.phone-week-date[data-date="2026-11-20"]').click();
      }
      for(const theme of ['light','dark']){
        await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);
        for(const kind of ['work','due']){
          const source=p.locator(`#planner-calendar [data-day-list="${kind}"][data-summary-date="2026-11-20"]`);
          await source.click();const dialog=p.locator('.calendar-day-list-preview');await dialog.waitFor({state:'visible'});await p.waitForTimeout(450);
          const state=await dialog.evaluate(e=>({rect:e.getBoundingClientRect().toJSON(),radius:getComputedStyle(e).borderRadius,backdrop:getComputedStyle(e,'::backdrop').backgroundColor,rows:[...e.querySelectorAll('[data-deadline-preview-task]')].map(b=>({id:b.dataset.deadlinePreviewTask,text:b.textContent}))}));
          check(state.rows.map(r=>r.id).join(',')===(kind==='work'?'first,overnight':'first,date-only'),'Wrong group/sort '+JSON.stringify(state));
          check(state.rect.width<=400.5&&state.rect.left>=13&&state.rect.right<=viewport.width-13&&state.rect.bottom<=viewport.height-13,'Popup outside viewport');
          check(state.radius==='28px'&&state.backdrop==='rgba(0, 0, 0, 0)','Reference popup surface');
          check(await source.getAttribute('aria-expanded')==='true','Launcher state');
          if(theme==='light')await p.screenshot({path:out+`${viewport.width}-${kind}.png`});
          await p.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
          check(await source.evaluate(e=>e===document.activeElement),'Close did not restore focus');
          results.push({viewport,theme,kind,status:'PASS',geometry,state});
        }
      }
      check(before===await p.evaluate(()=>JSON.stringify(store.listItems())),'Opening lists changed data');
      await p.evaluate(()=>document.documentElement.dataset.theme='light');
      await p.locator('#planner-calendar [data-day-list="work"][data-summary-date="2026-11-20"]').click();
      await p.locator('[data-deadline-preview-task="first"]').click();
      await p.locator('#calendar-preview-complete').waitFor({state:'visible'});
      check(await p.locator('#calendar-preview-title').textContent()==='Morning work','Wrong task preview');
      await p.locator('#calendar-preview-complete').click();await p.waitForFunction(()=>store.listItems().find(t=>t.id==='first').completed);
      await p.getByRole('button',{name:'Close task preview',exact:true}).click();await p.locator('#calendar-task-preview').waitFor({state:'detached'});
      await p.locator('#planner-calendar [data-day-list="work"][data-summary-date="2026-11-20"]').click();
      check(await p.locator('[data-deadline-preview-task]').count()===1,'Completed item remains in Work list');
      await p.evaluate(async()=>{await store.toggleComplete('overnight',true);});
      check((await p.locator('.calendar-preview-status').textContent()).includes('No remaining work'),'Live empty state missing');
      await p.keyboard.press('Escape');await p.locator('#calendar-task-preview').waitFor({state:'detached'});
      await p.reload();await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
      check(await p.evaluate(()=>store.listItems().find(t=>t.id==='first').completed),'Completion not saved');
      check(errors.length===0,errors.join(';'));
      results.push({viewport,status:'PASS',checks:['static heading','phone date selection','single fill','blue Work','divider bottom','readonly open/close','correct row handoff','complete','live empty state','reload']});
    }finally{await c.close();}
  }
  return {runtime:browser.version(),mode:'isolated real local store; touch emulation where selected',results};
}
