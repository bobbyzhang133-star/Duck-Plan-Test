async (page) => {
  const origin = 'http://127.0.0.1:8798';
  const out = '/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/axis-first-import-20261120/';
  const feed = 'https://fixture.myschoolapp.com/podium/feed/iCal.aspx?z=synthetic-axis-fixture';
  const browser = page.context().browser(), results = [], contexts = [];
  const check = (ok, text) => { if (!ok) throw new Error(text); };
  const fixture = (c, stage) => c.request.post(origin + '/__axis-qa', { data: { stage } });
  async function nav(p, name) {
    let control = p.locator(`[data-view="${name}"]:visible`).first();
    if (!await control.count()) { await p.locator('#phone-more-button').click(); control = p.locator(`#phone-more-dialog [data-view="${name}"]`); }
    await control.click(); await p.waitForFunction(name => document.body.dataset.view === name, name);
  }
  async function postAction(p, fn, method = 'POST') {
    const response = p.waitForResponse(r => new URL(r.url()).pathname === '/api/axis' && r.request().method() === method);
    await fn(); const r = await response; const data = await r.json(); check(r.ok(), 'Axis action status ' + r.status()); return data;
  }
  try {
    for (const spec of [{ name:'desktop',width:1280,height:900 }, { name:'phone',width:390,height:844,touch:true }, { name:'ipad',width:835,height:1112,touch:true }]) {
      const c = await browser.newContext({ viewport:{width:spec.width,height:spec.height},hasTouch:!!spec.touch,isMobile:spec.name==='phone',timezoneId:'America/Los_Angeles',reducedMotion:'reduce',serviceWorkers:'block' }); contexts.push(c);
      const p = await c.newPage();p.setDefaultTimeout(20000);const result={name:spec.name,fixtureBacked:true,native:false,checks:{},pageErrors:[]};results.push(result);p.on('pageerror',e=>result.pageErrors.push(e.message));
      await fixture(c,'initial');await p.goto(origin+'/#settings');await p.waitForFunction(()=>typeof store!=='undefined'&&store.mode==='local');
      await p.locator('#connect-axis').click();await p.waitForFunction(()=>document.activeElement?.name==='email');result.checks.localSignInFirst=true;
      const account={email:`axis-${spec.name}-${Date.now()}@axis.test`,password:`Synthetic-${Date.now()}-${Math.random()}`};
      const signup=await c.request.post(origin+'/api/auth/sign-up',{data:account});check(signup.status()===201,'fixture signup');
      await p.reload();await p.waitForFunction(()=>store.mode==='cloud'&&store.user&&document.querySelector('#axis-form'));
      check(await p.getByText('Your first import marks already-overdue assignments complete.',{exact:true}).isVisible(),'Missing first-import explanation');
      await fixture(c,'invalid');await p.locator('#axis-form input').fill(feed);await p.locator('#axis-form button[type="submit"]').click();await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes("didn't return an Axis calendar"));
      check(await p.evaluate(()=>store.listItems().length===0),'Invalid feed wrote tasks');result.checks.failedConnectNoRows=true;
      await fixture(c,'initial');
      const connected=await postAction(p,()=>p.locator('#axis-form button[type="submit"]').click());
      await p.waitForFunction(()=>store.listItems().length===4&&store.listItems().filter(t=>t.completed).length===2);
      result.checks.initialResponse=connected;check(connected.added===4&&connected.autoCompleted===2,'Initial response count');
      await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('2 overdue assignments marked complete.'));
      const ids=await p.evaluate(()=>Object.fromEntries(store.listItems().map(t=>[t.title,t.id])));
      check(await p.evaluate(()=>store.listItems().filter(t=>t.completed).every(t=>['Past assignment','Earlier today'].includes(t.title))),'Initial status');
      result.checks.initial={added:4,autoCompleted:2,todayOpen:true,futureOpen:true,toast:true};
      await nav(p,'tasks');await p.locator('[data-filter="done"]').click();
      await p.locator(`#all-task-list input[data-task-id="${ids['Past assignment']}"]`).waitFor();
      await p.screenshot({path:out+`initial-${spec.name}.png`,fullPage:true});
      await p.locator(`#all-task-list input[data-task-id="${ids['Past assignment']}"]`).click();
      await p.waitForFunction(id=>!store.listItems().find(t=>t.id===id).completed,ids['Past assignment']);
      await p.reload();await p.waitForFunction(()=>store.mode==='cloud'&&store.listItems().length===4);
      check(await p.evaluate(id=>!store.listItems().find(t=>t.id===id).completed,ids['Past assignment']),'Reopened choice lost after reload');result.checks.reopenAndReload=true;
      await fixture(c,'later');await nav(p,'settings');
      const synced=await postAction(p,()=>p.locator('#axis-sync-now').click());await p.waitForFunction(()=>store.listItems().length===5);
      check(synced.autoCompleted===0&&synced.added===1,'Later auto-completion');
      check(await p.evaluate(()=>!store.listItems().find(t=>t.title==='New overdue assignment').completed&&!store.listItems().find(t=>t.title==='Past assignment').completed),'Later changed completion choices');
      result.checks.laterSync={added:1,autoCompleted:0,newOverdueOpen:true,reopenedStillOpen:true};
      await postAction(p,()=>p.locator('#axis-disconnect').click(),'DELETE');await p.locator('#axis-form input').fill(feed);
      const reconnected=await postAction(p,()=>p.locator('#axis-form button[type="submit"]').click());check(reconnected.autoCompleted===0,'Reconnect repeated completion');
      await p.reload();await p.waitForFunction(()=>store.mode==='cloud'&&store.listItems().length===5);
      check(await p.evaluate(()=>store.listItems().filter(t=>t.completed).length===1),'Reconnect status lost');
      result.checks.reconnectAndPersist=true;result.checks.noOverflow=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);check(result.checks.noOverflow,'Page overflow');check(!result.pageErrors.length,'Page errors');result.status='PASS';
    }
  } catch(error) {results.push({status:'FAIL',message:error.message});}
  finally {await Promise.all(contexts.map(c=>c.close()));}
  return results;
}
