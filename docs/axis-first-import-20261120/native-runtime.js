// Inject only into a disposable simulator copy. Native bridges/API transport remain real.
(async () => {
  const base = 'http://127.0.0.1:8896', q = selector => document.querySelector(selector);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let config, stage = 'startup';
  const check = (value, message) => { if (!value) throw new Error(message); };
  const report = (name, data = {}) => fetch(base + '/result', { method:'POST',body:JSON.stringify({runId:config?.runId,mode:config?.mode,stage:name,...data}) });
  const wait = async (fn, label, timeout = 40000) => {const until=Date.now()+timeout;while(Date.now()<until){if(await fn())return;await sleep(80);}throw new Error('Timeout: '+label);};
  const click = selector => {const el=typeof selector==='string'?q(selector):selector;check(el&&!el.disabled,'Unavailable control '+selector);el.click();};
  const fill = (form, values) => {for(const [name,value]of Object.entries(values)){const el=form.elements.namedItem(name);check(el,'Missing field '+name);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}};
  const submit = form => form.requestSubmit(form.querySelector('button[type="submit"]'));
  const view = async name => {
    let el=[...document.querySelectorAll(`[data-view="${name}"]`)].find(e=>e.getClientRects().length&&!e.closest('[hidden],[inert]'));
    if(!el){click('#phone-more-button');await wait(()=>q('#phone-more-dialog')?.open,'More');el=q(`#phone-more-dialog [data-view="${name}"]`);}
    check(el,'Missing route '+name);click(el);await wait(()=>document.body.dataset.view===name,'route '+name);await sleep(350);
  };
  const states = () => Object.fromEntries(store.listItems().map(t=>[t.title,t.completed]));
  try {
    config=await(await fetch(base+'/command')).json();
    await wait(()=>typeof store!=='undefined'&&typeof workAlertContextReady!=='undefined'&&workAlertContextReady,'native app ready',80000);
    check(window.DuckNativeCloud&&window.DuckNativeAlarms&&window.DuckNativeNotifications,'Native bridges missing');
    check(q('script[src*="axis-first-import-20261120"]'),'Stale app web bundle');
    await report('started',{api:window.DUCKPLAN_CLOUD.apiUrl,native:true,viewport:[innerWidth,innerHeight],fixtureBacked:true});
    await view('settings');
    if(store.user&&store.user.email!==config.fixtureEmail){click('#sign-out');await wait(()=>store.mode==='local'&&workAlertContextReady,'fresh QA owner');}
    if(!store.user){fill(q('#sign-in-form'),{email:config.fixtureEmail,password:config.fixturePassword});submit(q('#sign-in-form'));await wait(()=>store.mode==='cloud'&&store.user&&workAlertContextReady,'native sign in');await wait(()=>q('#toast').textContent.includes('Signed in as '),'sign-in action finished');}
    if(config.mode==='initial'){
      stage='first connect';check(store.listItems().length===0,'Fresh account has unexpected tasks');
      await wait(()=>q('#axis-form'),'Axis connect form');fill(q('#axis-form'),{icalUrl:config.feed});submit(q('#axis-form'));
      await wait(()=>store.listItems().length===4&&q('#axis-sync-now'),'initial import');
      const state=states();check(state['Past assignment']&&state['Earlier today']&&!state['Due today']&&!state['Future assignment'],'Initial completion status');
      await wait(()=>q('#toast').textContent.includes('2 overdue assignments marked complete.'),'initial completion feedback');
      const old=store.listItems().find(t=>t.title==='Past assignment');
      await view('tasks');click('[data-filter="done"]');await wait(()=>q(`#all-task-list input[data-task-id="${old.id}"]`),'Done list');
      click(`#all-task-list input[data-task-id="${old.id}"]`);await wait(()=>!store.listItems().find(t=>t.id===old.id).completed,'manual reopen');
      localStorage.setItem('axis-initial-qa',JSON.stringify({old:old.id}));
      await report('initial-pass',{imported:4,autoCompleted:2,todayOpen:true,futureOpen:true,completionToast:true,doneListAndReopen:true,nativeURLSession:true});
    }else if(config.mode==='later'){
      stage='relaunch persistence';const saved=JSON.parse(localStorage.getItem('axis-initial-qa'));check(saved&&store.listItems().length===4&&!store.listItems().find(t=>t.id===saved.old).completed,'Native import/reopen did not survive relaunch');
      stage='later sync';await wait(()=>q('#axis-sync-now'),'Sync control');click('#axis-sync-now');await wait(()=>store.listItems().length===5&&q('#axis-sync-now')&&!q('#axis-sync-now').disabled,'later sync');
      check(!states()['New overdue assignment']&&!store.listItems().find(t=>t.id===saved.old).completed,'Later sync re-completed work');
      stage='disconnect reconnect';click('#axis-disconnect');await wait(()=>q('#axis-form'),'disconnect');fill(q('#axis-form'),{icalUrl:config.feed});submit(q('#axis-form'));await wait(()=>q('#axis-sync-now')&&!q('#axis-form'),'reconnect');
      check(store.listItems().length===5&&store.listItems().filter(t=>t.completed).length===1,'Reconnect altered completion choices');
      check(!q('#toast').textContent.includes('overdue assignments marked complete'),'Reconnect repeated completion feedback');
      await report('later-pass',{relaunchPersistence:true,newOverdueOpen:true,reopenedStillOpen:true,reconnectNoRepeat:true,nativeURLSession:true});
    }else throw new Error('Unknown QA mode');
    await report('finished',{status:'PASS',runtime:'actual iOS27.2 WKWebView; scripted DOM actions; real URLSession/Worker/D1 and synthetic upstream'});
  }catch(error){await report('failure',{at:stage,message:String(error.message),toast:stage==='first connect'?q('#toast')?.textContent:null}).catch(()=>{});}
})();
