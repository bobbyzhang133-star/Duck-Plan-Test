// Injected only in disposable QA bundles; exercise the real app/store/native API.
(async()=>{
  const base='http://127.0.0.1:8898',q=s=>document.querySelector(s),sleep=ms=>new Promise(r=>setTimeout(r,ms));let config,stage='startup';
  const check=(v,m)=>{if(!v)throw Error(m);};
  const wait=async(fn,label)=>{const end=Date.now()+70000;while(Date.now()<end){if(await fn())return;await sleep(70);}throw Error('Timeout '+label);};
  const report=(stage,data={})=>fetch(base+'/result',{method:'POST',body:JSON.stringify({runId:config?.runId,mode:config?.mode,stage,...data})});
  try{
    config=await(await fetch(base+'/command')).json();await wait(()=>typeof store!=='undefined'&&typeof workAlertContextReady!=='undefined'&&workAlertContextReady,'ready');
    check(window.DuckNativeCloud&&q('script[src*="app.js?v=complete-overdue-20261120"]'),'Stale/non-native app');
    if(config.mode.startsWith('cloud')){if(config.fixtureEmail&&(store.mode!=='cloud'||store.user?.email!==config.fixtureEmail))await store.signIn(config.fixtureEmail,config.fixturePassword);await wait(()=>store.mode==='cloud'&&workAlertContextReady,'signed in');}
    else if(store.mode==='cloud'){await store.signOut();await wait(()=>store.mode==='local'&&workAlertContextReady,'local');}
    const today=nowKey(),tomorrow=Model.addDays(today,1),yesterday=Model.addDays(today,-1),key='overdue-qa-'+store.mode;
    setView('calendar');selectedDate=today;renderAll({autoScrollCalendar:false});
    let saved;
    if(config.mode.endsWith('setup')){
      stage='fixtures';const rows=[{title:'QA Past date',dueDate:yesterday,dueTime:''},{title:'QA Earlier today',dueDate:today,dueTime:'00:01'},
        {title:'QA Past deadline future work',dueDate:yesterday,scheduledStart:tomorrow+'T10:00'},
        {title:'QA Due today date only',dueDate:today,dueTime:''},{title:'QA Future deadline',dueDate:tomorrow},
        {title:'QA Work without deadline',dueDate:'',scheduledStart:yesterday+'T10:00'}];
      const off={version:1,timeZone:'America/Los_Angeles',alarm:{enabled:false,mode:'work',at:null,sound:'system',snoozeMinutes:5},notification:{enabled:false,mode:'alarm',at:null}};
      for(const row of rows)await store.upsertItem({id:crypto.randomUUID(),classId:null,priority:'Medium',completed:false,notes:'Preserve this note',dueTime:'',scheduledStart:null,durationMinutes:45,workAlerts:off,...row});
      const before=store.listItems();const expected=before.filter(t=>Model.taskTiming(t).overdue).map(t=>t.id);
      const controls=[...document.querySelectorAll('[data-complete-overdue]')];check(controls.length===2&&controls.every(b=>!b.hidden&&!b.disabled),'Entry points missing');
      setTaskPanel(true);await sleep(400);const button=q('#overdue-section [data-complete-overdue]');
      check(button.getBoundingClientRect().height>=44,'Touch target too small');stage='one click';button.click();
      check(overdueCompletion&&controls.every(b=>b.disabled),'Missing pending/reentry protection');
      await wait(()=>!overdueCompletion,'saved completion');
      const after=store.listItems();
      for(const prior of before){const next=after.find(t=>t.id===prior.id);check(next&&next.completed===(expected.includes(prior.id)?true:prior.completed),'Wrong completion scope');for(const k of ['title','dueDate','dueTime','scheduledStart','durationMinutes','notes'])check(next[k]===prior[k],'Changed '+k);}
      check(controls.every(b=>b.hidden),'Empty action remains visible');check(q('#toast-message').textContent===`Completed ${expected.length} overdue tasks.`,'Wrong saved count');
      saved={completed:expected,open:before.filter(t=>!t.completed&&!expected.includes(t.id)).map(t=>t.id)};localStorage.setItem(key,JSON.stringify(saved));
    }else{stage='relaunch';saved=JSON.parse(localStorage.getItem(key));check(saved,'Missing checkpoint');}
    for(const id of saved.completed)check(store.listItems().find(t=>t.id===id)?.completed,'Completion lost');
    for(const id of saved.open)check(store.listItems().find(t=>t.id===id)?.completed===false,'Unrelated task changed');
    setView('tasks');await sleep(450);check(q('#view-tasks [data-complete-overdue]').hidden,'Tasks empty action remains');
    check(document.documentElement.scrollWidth<=innerWidth+1,'Page overflow');
    await report('finished',{status:'PASS',native:true,platform:navigator.userAgent,viewport:[innerWidth,innerHeight],completed:saved.completed.length,preserved:saved.open.length,checks:['one click','deadline scope','pending state','saved count','preserved work/deadlines/notes','both entry points','relaunch persistence','no page overflow']});
  }catch(error){await report('failure',{status:'FAIL',at:stage,message:error.message});}
})();
