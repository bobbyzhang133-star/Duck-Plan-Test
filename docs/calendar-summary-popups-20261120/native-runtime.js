// Disposable simulator QA only; production native bridge/store remain unchanged.
(async()=>{
  const base='http://127.0.0.1:8896',q=s=>document.querySelector(s),sleep=ms=>new Promise(r=>setTimeout(r,ms));let config,stage='start';
  const check=(v,m)=>{if(!v)throw Error(m);};
  const wait=async(fn,label)=>{const end=Date.now()+70000;while(Date.now()<end){if(await fn())return;await sleep(70);}throw Error('Timeout '+label);};
  const report=(stage,data={})=>fetch(base+'/result',{method:'POST',body:JSON.stringify({runId:config?.runId,mode:config?.mode,stage,...data})});
  const click=el=>{check(el&&!el.disabled,'Missing control');el.click();};
  const close=async()=>{click(q('#calendar-task-preview .close-button'));await wait(()=>!q('#calendar-task-preview'),'dialog close');};
  async function list(kind,date,phone=false){
    const selector=`${phone?'#phone-week-strip':'#planner-calendar'} [data-day-list="${kind}"][data-summary-date="${date}"]`;
    const source=q(selector);click(source);await wait(()=>q('.calendar-day-list-preview')?.open,'day list');await sleep(400);
    const expected=store.listItems().filter(t=>!t.completed&&!t.deleted&&!t.deleted_at&&(kind==='work'?Model.scheduledParts(t)?.date:t.dueDate)===date).map(t=>String(t.id)).sort();
    const seen=[...q('.calendar-day-list-preview').querySelectorAll('[data-deadline-preview-task]')].map(b=>b.dataset.deadlinePreviewTask).sort();
    check(JSON.stringify(expected)===JSON.stringify(seen),'Wrong list membership');
    const rect=q('.calendar-day-list-preview').getBoundingClientRect();check(rect.left>=13&&rect.right<=innerWidth-13&&rect.bottom<=innerHeight-13,'Popup outside viewport');
    check(getComputedStyle(q('.calendar-day-list-preview')).borderRadius==='28px','Stale popup CSS');
    await close();check(document.activeElement===q(selector),'List close focus');
  }
  try{
    config=await(await fetch(base+'/command')).json();await wait(()=>typeof store!=='undefined'&&typeof workAlertContextReady!=='undefined'&&workAlertContextReady,'native ready');
    check(window.DuckNativeCloud&&q('script[src*="calendar-task-preview.js?v=day-summary-windows-20261120"]'),'Stale/non-native bundle');
    if(config.mode.startsWith('cloud')){if(config.fixtureEmail&&(store.mode!=='cloud'||store.user?.email!==config.fixtureEmail))await store.signIn(config.fixtureEmail,config.fixturePassword);await wait(()=>store.mode==='cloud'&&workAlertContextReady,'sign in');}
    else if(store.mode==='cloud'){await store.signOut();await wait(()=>store.mode==='local'&&workAlertContextReady,'local');}
    const today=nowKey(),tomorrow=Model.addDays(today,1),key='summary-window-qa-'+store.mode;let ids;
    selectedDate=today;calendarView='week';calendarUserScrolled=true;setView('calendar');renderAll({autoScrollCalendar:false});await sleep(500);
    if(config.mode.endsWith('setup')){
      ids=[crypto.randomUUID(),crypto.randomUUID()];stage='create';
      for(let i=0;i<2;i++)await store.upsertItem({id:ids[i],title:i?'Summary QA date only':'Summary QA timed',classId:null,scheduledStart:today+(i?'T11:00':'T09:00'),durationMinutes:45,dueDate:today,dueTime:i?'':'17:00',priority:'Medium',completed:false});
      stage='open lists';await list('work',today);await list('due',today);
      click(q(`#planner-calendar [data-day-list="work"][data-summary-date="${today}"]`));await wait(()=>q('.calendar-day-list-preview')?.open,'work handoff');
      click(q(`[data-deadline-preview-task="${ids[0]}"]`));await wait(()=>q('#calendar-preview-complete'),'task preview');
      check(q('#calendar-preview-title').textContent==='Summary QA timed','Wrong task opened');
      stage='complete';click(q('#calendar-preview-complete'));await wait(()=>store.listItems().find(t=>t.id===ids[0])?.completed,'saved complete');await close();
      await store.upsertItem({...store.listItems().find(t=>t.id===ids[1]),scheduledStart:tomorrow+'T11:00'});
      localStorage.setItem(key,JSON.stringify({ids,today,tomorrow}));
    }else{
      stage='relaunch';const saved=JSON.parse(localStorage.getItem(key));check(saved,'Missing QA checkpoint');ids=saved.ids;
      check(store.listItems().find(t=>t.id===ids[0])?.completed,'Completion lost');const task=store.listItems().find(t=>t.id===ids[1]);check(task?.dueDate===today&&task?.scheduledStart===tomorrow+'T11:00','Work/deadline split lost');
    }
    stage='responsive controls';check(q('.calendar-day-heading').tagName==='DIV'&&!q('button.calendar-date-button'),'Clickable timetable heading');
    q('.calendar-day-heading > strong')?.click();check(selectedDate===today,'Heading changed day');
    if(!q('#phone-week-strip').hidden){
      await list('work',tomorrow,true);check(selectedDate===today,'Count action changed phone day');
      click(q(`.phone-week-date[data-date="${tomorrow}"]`));check(selectedDate===tomorrow,'Phone date selection failed');
      click(q(`.phone-week-date[data-date="${today}"]`));
      check(!q('#phone-week-strip button button'),'Nested phone buttons');
    }
    for(const theme of ['light','dark']){document.documentElement.dataset.theme=theme;await list('due',today);}
    document.documentElement.dataset.theme='light';
    const singles=[...document.querySelectorAll('#planner-calendar .calendar-day-counts.is-single')];check(singles.every(e=>Math.abs(e.getBoundingClientRect().width-e.querySelector('button').getBoundingClientRect().width)<1),'Single label width');
    check(document.documentElement.scrollWidth<=innerWidth+1,'Page overflow');
    click(q(`#planner-calendar [data-day-list="due"][data-summary-date="${today}"]`));await wait(()=>q('.calendar-day-list-preview')?.open,'final due list');await sleep(400);
    check(q(`[data-deadline-preview-task="${ids[1]}"]`).textContent.includes('End of day'),'Date-only deadline lost');
    await report('finished',{status:'PASS',native:true,platform:navigator.userAgent,viewport:[innerWidth,innerHeight],mode:config.mode,checks:['independent lists','static heading','phone date selection','phone summary controls','task preview handoff','saved completion','independent work date','single fill','light/dark','focus','relaunch when requested']});
  }catch(error){await report('failure',{status:'FAIL',at:stage,message:error.message});}
})();
