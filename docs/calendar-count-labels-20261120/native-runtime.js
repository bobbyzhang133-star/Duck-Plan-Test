// Injected only into the separate count-layout QA app, never production source.
(async()=>{
  const base='http://127.0.0.1:8896',sleep=ms=>new Promise(r=>setTimeout(r,ms));
  let config,stage='start';
  const check=(v,m)=>{if(!v)throw Error(m);};
  const wait=async(fn,label)=>{const end=Date.now()+70000;while(Date.now()<end){if(await fn())return;await sleep(80);}throw Error('Timeout '+label);};
  const report=(stage,data={})=>fetch(base+'/result',{method:'POST',body:JSON.stringify({runId:config?.runId,mode:config?.mode,stage,...data})});
  const validate=()=>{
    const root=document.querySelector('#phone-week-strip:not([hidden])')||document.querySelector('.timeline-days');
    const rows=[...root.querySelectorAll('button[data-date]')].map(b=>{
      const expected=Model.daySummary(store.listItems(),b.dataset.date),count=n=>n>99?'99+':String(n);
      check((b.querySelector('[data-day-work-count] [data-day-count-value]')?.textContent||'0')===count(expected.workCount),'Wrong Work count');
      check((b.querySelector('[data-day-due-count] [data-day-count-value]')?.textContent||'0')===count(expected.dueCount),'Wrong Due count');
      const r=b.getBoundingClientRect();
      for(const e of b.querySelectorAll('.calendar-day-counts span,.calendar-day-counts svg')){
        if(!e.getClientRects().length||getComputedStyle(e).display==='none')continue;
        const x=e.getBoundingClientRect();check(x.left>=r.left-.6&&x.right<=r.right+.6&&x.top>=r.top-.6&&x.bottom<=r.bottom+.6,'Clipped native count');
      }
      const badge=b.querySelector('strong')?.getBoundingClientRect(),counts=b.querySelector('.calendar-day-counts')?.getBoundingClientRect();
      if(b.classList.contains('phone-week-day')&&b.querySelector('.calendar-day-counts > span'))check(counts.top>=badge.bottom+.5,'Date/count overlap');
      return {date:b.dataset.date,...expected,height:r.height,badgeBottom:badge?.bottom,countsTop:counts?.top};
    });
    check(document.documentElement.scrollWidth<=innerWidth+1,'Page overflow');
    return rows;
  };
  try{
    config=await(await fetch(base+'/command')).json();
    await wait(()=>typeof store!=='undefined'&&typeof workAlertContextReady!=='undefined'&&workAlertContextReady,'native ready');
    check(window.DuckNativeCloud&&window.DuckNativeAlarms,'Missing native bridge');
    check(document.querySelector('script[src*="calendar-date-presentation.js?v=day-count-labels-20261120"]'),'Stale count bundle');
    if(config.mode.startsWith('cloud')){
      if(config.fixtureEmail&&(store.mode!=='cloud'||store.user?.email!==config.fixtureEmail))await store.signIn(config.fixtureEmail,config.fixturePassword);
      await wait(()=>store.mode==='cloud'&&workAlertContextReady,'signed in');
    }else if(store.mode==='cloud'){await store.signOut();await wait(()=>store.mode==='local'&&workAlertContextReady,'local');}
    const today=nowKey(),key='count-qa-'+store.mode;
    selectedDate=today;calendarView='week';calendarUserScrolled=true;setView('calendar');renderAll({autoScrollCalendar:false});
    await sleep(500);
    if(config.mode.endsWith('setup')){
      stage='create';const ids=[];
      for(let n=0;n<12;n++){
        const id=crypto.randomUUID();ids.push(id);
        await store.upsertItem({id,title:'Count QA '+n,classId:null,dueDate:today,dueTime:n===1?'':'17:00',scheduledStart:today+'T09:00',durationMinutes:45,priority:'Medium',completed:false});
      }
      validate();
      const button=document.querySelector(`.phone-week-day[data-date="${today}"]`);if(button)button.focus();
      stage='complete';await store.toggleComplete(ids[0],true);validate();
      if(button)check(document.activeElement===button,'Phone date focus replaced');
      stage='reschedule';const tomorrow=Model.addDays(today,1);
      await store.upsertItem({...store.listItems().find(t=>t.id===ids[1]),scheduledStart:tomorrow+'T10:00'});validate();
      stage='due edit';await store.upsertItem({...store.listItems().find(t=>t.id===ids[1]),dueDate:tomorrow});validate();
      localStorage.setItem(key,JSON.stringify({ids,today,tomorrow}));
    }else{
      stage='relaunch';const saved=JSON.parse(localStorage.getItem(key));check(saved,'Missing QA checkpoint');
      check(store.listItems().find(t=>t.id===saved.ids[0])?.completed,'Completion lost on relaunch');
      const edited=store.listItems().find(t=>t.id===saved.ids[1]);check(edited?.dueDate===saved.tomorrow&&edited?.scheduledStart===saved.tomorrow+'T10:00','Dates lost on relaunch');validate();
    }
    for(const theme of ['light','dark']){document.documentElement.dataset.theme=theme;validate();}
    document.documentElement.dataset.theme='light';
    await sleep(400);
    const scroller=document.querySelector('.calendar-timeline-scroller'),header=document.querySelector('.timeline-days'),top=header.getBoundingClientRect().top;
    scroller.scrollTop=640;await sleep(80);const after=document.querySelector('.timeline-days').getBoundingClientRect().top;check(Math.abs(after-top)<1,'Header moved '+JSON.stringify({top,after,oldConnected:header.isConnected}));
    await report('finished',{status:'PASS',native:true,platform:navigator.userAgent,viewport:[innerWidth,innerHeight],rows:validate(),checks:['actual WKWebView','real native transport for cloud mode','light/dark','large counts','completion','reschedule','due edit','fixed header','relaunch when requested']});
  }catch(error){await report('failure',{status:'FAIL',at:stage,message:error.message});}
})();
