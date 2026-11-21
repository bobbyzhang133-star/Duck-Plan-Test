// Disposable browser contexts and loopback QA accounts only; never user records.
async page => {
  const browser=page.context().browser(), results=[];
  const out='/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/task-editor-google-20261120/';
  const check=(value,message)=>{if(!value)throw Error(message);};
  for(const cfg of [
    {width:1470,height:745},{width:1156,height:746},{width:835,height:1000,touch:true},
    {width:390,height:844,touch:true},{width:320,height:568,touch:true,reduce:true},
    {width:844,height:390,touch:true},{width:1470,height:745,cloud:true},{width:390,height:844,touch:true,cloud:true}
  ]){
    const c=await browser.newContext({viewport:{width:cfg.width,height:cfg.height},hasTouch:!!cfg.touch,isMobile:cfg.width<700,timezoneId:'America/Los_Angeles',reducedMotion:cfg.reduce?'reduce':'no-preference',serviceWorkers:'block'});
    const p=await c.newPage(), errors=[];p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
    const origin=cfg.cloud?'http://127.0.0.1:8798':'http://127.0.0.1:8034';
    const result={...cfg,mode:cfg.cloud?'signed-in/current local Worker D1':'local',checks:[]};
    try{
      if(cfg.cloud){
        const signup=await c.request.post(origin+'/api/auth/sign-up',{data:{email:`editor-${Date.now()}-${cfg.width}@example.test`,password:`Fixture-${Date.now()}-${Math.random()}`},headers:{Origin:origin}});
        check(signup.status()===201,'QA signup failed');
      }else await c.addInitScript(()=>{if(localStorage.getItem('duckplan-demo-tasks-v1')===null)localStorage.setItem('duckplan-demo-tasks-v1','[]');});
      await p.goto(origin+'/#calendar');
      const ready=()=>p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
      await ready();
      check(await p.evaluate(()=>store.mode)===(cfg.cloud?'cloud':'local'),'Wrong account mode');
      const settled=()=>p.waitForFunction(()=>document.querySelector('#task-modal').open&&!document.querySelector('#task-modal').dataset.popupMotion&&!document.querySelector('#task-modal').inert);
      const closed=()=>p.waitForFunction(()=>!document.querySelector('#task-modal').open);
      const field=name=>p.locator(`#task-form [name="${name}"]`);
      const expand=async id=>{if(!await p.locator('#'+id).evaluate(e=>e.open))await p.locator('#'+id+'>summary').click();};
      const fits=async()=>{
        const box=await p.locator('#task-form').evaluate(e=>({rect:e.getBoundingClientRect().toJSON(),overflow:e.scrollWidth-e.clientWidth,page:document.documentElement.scrollWidth-innerWidth,footer:e.querySelector('.modal-actions').getBoundingClientRect().toJSON()}));
        check(box.rect.left>=12&&box.rect.right<=cfg.width-12&&box.rect.top>=12&&box.rect.bottom<=cfg.height-12,'Dialog bounds '+JSON.stringify(box));
        check(box.overflow<2&&box.page<2,'Horizontal overflow');
        check(box.footer.bottom<=box.rect.bottom+1&&box.footer.top>=box.rect.top,'Footer unreachable');
        return box;
      };
      const title=`Editor QA ${cfg.width} ${cfg.cloud?'cloud':'local'}`;
      await p.locator(await p.locator('#phone-add-task').isVisible()?'#phone-add-task':'#plan-selected-date').click();await settled();
      check(await field('title').evaluate(e=>e===document.activeElement),'Initial title focus');
      result.initial=await fits();
      check(await p.locator('#task-alarm-options').evaluate(e=>!e.open),'Alerts should start compact');
      await p.screenshot({path:out+`${cfg.width}-${cfg.height}-${cfg.cloud?'cloud':'local'}-initial.png`});
      await p.locator('#save-task').click();
      check(await p.locator('#task-form-error').isVisible(),'Empty title error hidden');
      check(await p.evaluate(()=>store.listItems().length)===0,'Invalid submission saved');
      await field('title').fill(title);await expand('task-schedule-options');
      const dates=await p.evaluate(()=>{const format=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');let d=new Date();d.setDate(d.getDate()+2);let work=format(d);d.setDate(d.getDate()+1);return{work,due:format(d)};});
      await field('scheduledDate').fill(dates.work);await p.locator('#save-task').click();
      check(await p.locator('#task-form-error').isVisible(),'Partial work error hidden');
      await field('scheduledTime').fill('08:00');await field('durationMinutes').selectOption('60');
      await field('dueDate').fill(dates.due);await field('dueTime').fill('12:00');
      await expand('task-detail-options');await field('classId').selectOption('');await field('priority').selectOption('High');
      await field('reminderChoice').selectOption('off');await field('notes').fill('Independent work and deadline. <literal>');
      await expand('actual-time-options');await field('actualMinutes').fill('5');
      await expand('task-alarm-options');
      check(await field('alarmAt').inputValue()===dates.work+'T08:00','Alarm work link');
      check(await field('notificationAt').inputValue()===dates.work+'T08:00','Notification alarm link');
      await field('notificationAt').fill(dates.work+'T07:50');await field('notificationAt').press('Tab');
      await fits();await p.locator('#save-task').click();await closed();
      await p.waitForFunction(t=>store.listItems().some(x=>x.title===t),title);
      const saved=await p.evaluate(t=>store.listItems().find(x=>x.title===t),title),id=saved.id;
      check(saved.scheduledStart===dates.work+'T08:00'&&saved.dueDate===dates.due&&saved.dueTime==='12:00'&&saved.actualMinutes===5,'Independent fields not saved');
      result.checks.push('Calendar create, invalid title/work, linked defaults, manual notification, independent deadline, details');
      await p.reload();await ready();
      await p.evaluate(()=>setView('tasks'));await p.waitForTimeout(550);
      await p.locator(`[data-edit-task="${id}"]:visible`).first().click();await settled();
      check(await field('notes').inputValue()==='Independent work and deadline. <literal>','Notes reload');
      check(await field('notificationAt').inputValue()===dates.work+'T07:50','Manual notification persistence');
      check(await field('actualMinutes').inputValue()==='5','Logged minutes reload');
      await field('scheduledTime').fill('09:00');
      check(await field('alarmAt').inputValue()===dates.work+'T09:00'&&await field('notificationAt').inputValue()===dates.work+'T07:50','Individual links lost');
      await p.locator('#save-task').click();await closed();await p.reload();await ready();await p.evaluate(()=>setView('tasks'));await p.waitForTimeout(550);
      await p.locator(`[data-edit-task="${id}"]:visible`).first().click();await settled();
      check(await field('scheduledTime').inputValue()==='09:00'&&await field('dueTime').inputValue()==='12:00','Edit reload changed deadline');
      await field('title').fill('Cancelled draft');await p.keyboard.press('Escape');await closed();
      check(await p.evaluate(id=>store.listItems().find(x=>x.id===id).title,id)===title,'Cancel changed data');
      await p.locator('#open-task-modal').click();await settled();check(await field('title').inputValue()==='','Tasks Add reused edit');
      await p.evaluate(()=>document.documentElement.dataset.theme='dark');await fits();await p.screenshot({path:out+`${cfg.width}-${cfg.height}-${cfg.cloud?'cloud':'local'}-dark.png`});
      await p.locator('#cancel-task').click();await closed();
      await p.evaluate(()=>document.documentElement.dataset.theme='light');
      await p.locator(`[data-edit-task="${id}"]:visible`).first().click();await settled();await p.locator('#delete-task').click();await closed();
      await p.waitForFunction(id=>!store.listItems().some(x=>x.id===id),id);await p.reload();await ready();check(await p.evaluate(()=>store.listItems().length)===0,'Delete reload failed');
      check(errors.length===0,errors.join(';'));result.checks.push('Tasks edit/reload, manual-link preservation, cancel/Escape, shared Add, dark, delete/reload');result.status='PASS';
    }catch(e){result.status='FAIL';result.error=e.message;await p.screenshot({path:out+`${cfg.width}-${cfg.height}-${cfg.cloud?'cloud':'local'}-failure.png`}).catch(()=>{});}
    finally{await c.close();}results.push(result);
  }
  return{runtime:browser.version(),results};
}
