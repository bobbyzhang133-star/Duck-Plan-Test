async page => {
  const browser=page.context().browser(),c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block',timezoneId:'America/Los_Angeles'}),assert=(v,m)=>{if(!v)throw Error(m);};
  try{
    await c.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8034'?r.continue():r.abort());
    await c.addInitScript(()=>localStorage.setItem('duckplan-demo-tasks-v1',JSON.stringify([1,2,3].map(n=>({id:`90000000-0000-4000-8000-${String(n).padStart(12,'0')}`,title:`Grouped deadline ${n}`,classId:null,priority:'Medium',durationMinutes:45,notes:'Synthetic grouped deadline',completed:false,source:'manual',schemaVersion:2,dueDate:'2026-11-20',dueTime:'17:00',scheduledStart:null})))));
    const p=await c.newPage(),errors=[];p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-11-20T12:00:00-08:00')});
    await p.goto('http://127.0.0.1:8034/?qa=popup-group#calendar');await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
    await p.evaluate(()=>{selectedDate='2026-11-20';calendarView='day';calendarUserScrolled=true;renderAll({autoScrollCalendar:false});});
    const before=await p.evaluate(()=>JSON.stringify(store.listItems()));
    const group=p.locator('.timed-deadline-group-trigger');await group.scrollIntoViewIfNeeded();await group.tap();
    await p.waitForFunction(()=>document.querySelector('.calendar-deadline-group-preview')?.open&&!document.querySelector('.calendar-deadline-group-preview').dataset.popupMotion);
    assert(await p.locator('.calendar-deadline-group-item').count()===3,'group list count');
    await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#calendar-task-preview'));assert(await group.evaluate(e=>document.activeElement===e),'group focus restoration');
    await group.tap();await p.waitForFunction(()=>document.querySelector('#calendar-task-preview')?.open&&!document.querySelector('#calendar-task-preview').dataset.popupMotion);
    await p.locator('.calendar-deadline-group-item').first().tap();await p.waitForFunction(()=>document.querySelector('#calendar-preview-reschedule')&&!document.querySelector('#calendar-task-preview').dataset.popupMotion);
    await p.locator('#calendar-preview-reschedule').tap();await p.waitForFunction(()=>document.querySelector('#task-modal').open&&!document.querySelector('#task-modal').dataset.popupMotion);
    assert(await p.evaluate(()=>document.activeElement.name)==='scheduledDate','reschedule focus');await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#task-modal').open);
    assert(await p.evaluate(()=>JSON.stringify(store.listItems()))===before,'opening/cancelling changed task data');assert(errors.length===0,errors.join(';'));
    return {runtime:browser.version(),status:'PASS',mode:'isolated local phone touch emulation',groupCount:3,groupEscapeFocus:'PASS',groupToPreviewToReschedule:'PASS',unchangedData:'PASS',errors};
  }finally{await c.close();}
}
