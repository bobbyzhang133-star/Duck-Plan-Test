async page => {
  const browser = page.context().browser(), results = [];
  const out = '/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-count-labels-20261120/';
  const check = (value, message) => { if (!value) throw Error(message); };
  for (const viewport of [{width:1280,height:900},{width:835,height:1000},{width:390,height:844},{width:375,height:812},{width:320,height:568}]) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width < 1000, isMobile: viewport.width < 700, serviceWorkers:'block', timezoneId:'America/Los_Angeles', reducedMotion: viewport.width === 320 ? 'reduce' : 'no-preference' });
    try {
      await context.addInitScript(() => {
        if (localStorage.getItem('count-label-qa')) return;
        localStorage.setItem('count-label-qa','1');
        localStorage.setItem('duckplan-demo-classes-v1','[]');
        const task = (id, date, extra = {}) => ({ id, title:id, classId:null, dueDate:date, dueTime:'17:00', scheduledStart:date+'T09:00', durationMinutes:45, completed:false, schemaVersion:2, ...extra });
        localStorage.setItem('duckplan-demo-tasks-v1',JSON.stringify([
          task('Study calculus','2026-11-20'),
          task('Reading response','2026-11-20',{dueTime:'',scheduledStart:null}),
          task('Overnight review','2026-11-21',{scheduledStart:'2026-11-20T23:30',durationMinutes:90}),
          task('Already done','2026-11-20',{completed:true}),
          ...Array.from({length:12},(_,n)=>task('Two digit '+n,'2026-11-21')),
          ...Array.from({length:110},(_,n)=>task('Large '+n,'2026-11-22',{dueTime:''}))
        ]));
      });
      const p = await context.newPage(), errors=[];
      p.on('pageerror',e=>errors.push(e.message));
      await p.clock.install({time:new Date('2026-11-20T12:30:00-08:00')});
      await p.goto('http://127.0.0.1:8034/?qa=count-labels#calendar');
      await p.waitForFunction(()=>typeof store !== 'undefined' && workAlertContextReady);
      await p.evaluate(()=>{ selectedDate='2026-11-20'; calendarView='week'; calendarUserScrolled=true; renderAll({autoScrollCalendar:false}); });
      const read = () => {
        const root=document.querySelector('#phone-week-strip:not([hidden])')||document.querySelector('.timeline-days');
        return [...root.querySelectorAll('button[data-date]')].map(b=>({date:b.dataset.date,label:b.getAttribute('aria-label'),work:b.querySelector('[data-day-work-count] [data-day-count-value]')?.textContent||'0',due:b.querySelector('[data-day-due-count] [data-day-count-value]')?.textContent||'0'}));
      };
      const geometry = () => {
        const buttons=[...document.querySelectorAll('.calendar-date-button,.phone-week-day')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]'));
        const clipped=[];
        for(const b of buttons){const r=b.getBoundingClientRect();for(const e of b.querySelectorAll('.calendar-day-counts span,.calendar-day-counts svg')){if(!e.getClientRects().length||getComputedStyle(e).display==='none')continue;const x=e.getBoundingClientRect();if(x.left<r.left-.5||x.right>r.right+.5||x.top<r.top-.5||x.bottom>r.bottom+.5)clipped.push({date:b.dataset.date,text:e.textContent,box:x.toJSON(),button:r.toJSON()});}}
        return {clipped,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,headerHeight:document.querySelector('.timeline-days').getBoundingClientRect().height,stripHeight:document.querySelector('#phone-week-strip:not([hidden]) button')?.getBoundingClientRect().height,headerTop:document.querySelector('.timeline-days').getBoundingClientRect().top};
      };
      let summary=await p.evaluate(read);
      check(summary.find(r=>r.date==='2026-11-20').work==='2','Work count');
      check(summary.find(r=>r.date==='2026-11-20').due==='2','Due count');
      check(summary.find(r=>r.date==='2026-11-21').work==='12','Overnight counted twice');
      check(summary.find(r=>r.date==='2026-11-22').work==='99+','Visual cap');
      check(summary.find(r=>r.date==='2026-11-22').label.includes('110 deadlines'),'Exact accessible count');
      for(const theme of ['light','dark']){
        await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
        const before=await p.evaluate(geometry);
        check(!before.clipped.length&&!before.pageOverflow,'Clipped counts '+JSON.stringify({viewport,theme,before}));
        check(before.headerHeight<=66.5&&(!before.stripHeight||before.stripHeight<=56.5),'Header grew');
        await p.evaluate(()=>document.querySelector('.calendar-timeline-scroller').scrollTop=640);
        await p.waitForTimeout(70);
        const after=await p.evaluate(geometry);
        check(Math.abs(before.headerTop-after.headerTop)<1,'Header moved on scroll');
        await p.screenshot({path:out+`week-${viewport.width}-${theme}.png`});
        results.push({viewport,theme,status:'PASS',summary,geometry:after});
      }
      await p.evaluate(()=>{document.documentElement.dataset.theme='light';const b=document.querySelector('.phone-week-day[data-date="2026-11-20"]');if(b){window.qaDay=b;b.focus();}});
      await p.evaluate(async()=>{await store.upsertItem({...store.listItems().find(t=>t.id==='Reading response'),scheduledStart:'2026-11-19T10:00'});});
      check((await p.evaluate(read)).find(r=>r.date==='2026-11-19').work==='1','Schedule update');
      check(await p.evaluate(()=>!window.qaDay||window.qaDay===document.activeElement),'Day focus changed');
      await p.evaluate(async()=>{await store.toggleComplete('Study calculus',true);});
      summary=await p.evaluate(read);
      check(summary.find(r=>r.date==='2026-11-20').work==='1'&&summary.find(r=>r.date==='2026-11-20').due==='1','Completion update');
      await p.evaluate(async()=>{await store.upsertItem({...store.listItems().find(t=>t.id==='Reading response'),dueDate:'2026-11-19'});});
      check((await p.evaluate(read)).find(r=>r.date==='2026-11-19').due==='1','Due update');
      await p.evaluate(async()=>{await store.deleteItem('Reading response');});
      check((await p.evaluate(read)).find(r=>r.date==='2026-11-19').due==='0','Deletion update');
      const beforeReload=JSON.stringify(await p.evaluate(read));
      await p.reload();await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
      await p.getByRole('button',{name:'Week',exact:true}).click();
      const afterReload=JSON.stringify(await p.evaluate(read));
      check(afterReload===beforeReload,'Reload counts '+JSON.stringify({viewport,beforeReload,afterReload}));
      await p.evaluate(()=>{calendarView='day';selectedDate='2026-11-20';renderAll({autoScrollCalendar:false});});
      const day=await p.evaluate(geometry);check(!day.clipped.length&&!day.pageOverflow&&day.headerHeight<=66.5,'Day layout');
      await p.screenshot({path:out+`day-${viewport.width}.png`});
      check(errors.length===0,errors.join(';'));
      results.push({viewport,status:'PASS',updates:['schedule','complete','deadline edit','delete','reload','retained phone focus'],day});
    } finally {await context.close();}
  }
  return {runtime:browser.version(),mode:'isolated local browser; not native',results};
}
