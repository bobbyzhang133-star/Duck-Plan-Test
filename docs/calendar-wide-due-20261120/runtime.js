async page=>{
  const browser=page.context().browser(),results=[],check=(v,m)=>{if(!v)throw Error(m);};
  for(const width of [1156,835,390,320]){
    const c=await browser.newContext({viewport:{width,height:width===1156?746:844},hasTouch:width<1000,isMobile:width<700,serviceWorkers:'block',timezoneId:'America/Los_Angeles'});
    try{
      await c.addInitScript(()=>{
        const date=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        localStorage.setItem('duckplan-demo-tasks-v1',JSON.stringify([
          {id:'single',title:'Sample: Calculus practice',scheduledStart:date+'T16:00',durationMinutes:45,dueTime:'17:00'},
          {id:'group-a',title:'Submit lab report',scheduledStart:date+'T18:00',durationMinutes:90,dueTime:'19:00'},
          {id:'group-b',title:'Upload reading response',scheduledStart:null,durationMinutes:45,dueTime:'19:05'},
          {id:'midnight',title:'Early review',scheduledStart:date+'T00:00',durationMinutes:30,dueTime:'00:00'},
          {id:'night',title:'Late review',scheduledStart:date+'T23:15',durationMinutes:45,dueTime:'23:59'}
        ].map(t=>({classId:null,priority:'Medium',completed:false,schemaVersion:2,dueDate:date,...t}))));
      });
      const p=await c.newPage();await p.goto('http://127.0.0.1:8034/#calendar');await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
      const before=await p.evaluate(()=>JSON.stringify(store.listItems()));
      for(const view of ['day','week']){
        await p.getByRole('button',{name:view==='day'?'Day':'Week',exact:true}).click();
        const single=p.locator('[data-calendar-kind="deadline"][data-select-task="single"]');await single.scrollIntoViewIfNeeded();
        await p.locator('.calendar-timeline-scroller').evaluate(e=>e.scrollTop=16*62);
        for(const theme of ['light','dark']){
          await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await p.waitForTimeout(300);
          const measured=await p.locator('.timed-deadline-anchor.has-work-overlap').evaluateAll(anchors=>anchors.map(e=>{
            const r=e.getBoundingClientRect(),col=e.closest('.timeline-column'),cr=col.getBoundingClientRect(),work=col.querySelector('.calendar-work-layer'),wr=work.getBoundingClientRect(),button=e.querySelector('button'),paint=getComputedStyle(button,'::before');
            return{widthRatio:r.width/wr.width,insetRatio:(r.left-wr.left)/wr.width,paintRatio:(r.width-parseFloat(paint.left))/wr.width,z:getComputedStyle(e).zIndex,workZ:getComputedStyle(work).zIndex,pointMinutes:[...e.querySelectorAll('[data-deadline-minute]')].map(p=>({minute:Number(p.dataset.deadlineMinute),y:p.getBoundingClientRect().top-cr.top})),bounds:{left:r.left-cr.left,right:r.right-cr.left,columnWidth:cr.width}};
          }));
          check(measured.length===4,'Missing overlap markers');
          check(measured.every(r=>Math.abs(r.widthRatio-.95)<.002&&Math.abs(r.insetRatio-.05)<.002&&r.paintRatio>.8),'Due still squeezed '+JSON.stringify(measured));
          check(measured.every(r=>Number(r.z)>Number(r.workZ)&&r.bounds.left>=0&&r.bounds.right<=r.bounds.columnWidth+.5),'Layer or column overflow');
          check(measured.every(r=>r.pointMinutes.every(p=>Math.abs(p.y-p.minute*62/60)<1)),'Due time anchor changed');
          await p.locator('.calendar-timeline-scroller').evaluate(e=>e.scrollTop=16*62);await single.click();await p.locator('#calendar-task-preview').waitFor({state:'visible'});await p.waitForTimeout(450);
          check((await p.locator('#calendar-task-preview').innerText()).includes('Sample: Calculus practice'),'Wrong single task');await p.keyboard.press('Escape');await p.locator('#calendar-task-preview').waitFor({state:'detached'});
          const group=p.locator('[data-timed-deadline-group]');await group.scrollIntoViewIfNeeded();await group.click();await p.locator('.calendar-deadline-group-preview').waitFor({state:'visible'});await p.waitForTimeout(450);
          const text=await p.locator('.calendar-deadline-group-preview').innerText();check(text.includes('Submit lab report')&&text.includes('Upload reading response'),'Wrong grouped tasks');await p.keyboard.press('Escape');await p.locator('#calendar-task-preview').waitFor({state:'detached'});
          results.push({width,view,theme,status:'PASS',measured});
        }
        await p.evaluate(()=>document.documentElement.dataset.theme='light');await p.locator('.calendar-timeline-scroller').evaluate(e=>e.scrollTop=16*62);await p.mouse.move(0,0);await p.waitForTimeout(300);
        if(width===1156&&view==='week'||width===390&&view==='day')await p.screenshot({path:'/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-wide-due-20261120/'+width+'-'+view+'.png'});
      }
      check(await p.evaluate(()=>JSON.stringify(store.listItems()))===before,'Read-only preview changed tasks');
      check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow');
    }finally{await c.close();}
  }
  return{runtime:browser.version(),mode:'isolated local; touch-emulated tablet/phone; Day/Week light/dark',results};
}
