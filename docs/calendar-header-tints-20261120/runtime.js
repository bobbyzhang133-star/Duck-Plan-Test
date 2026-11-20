async page => {
  const browser=page.context().browser(),results=[],out='/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-header-tints-20261120/';
  const check=(value,message)=>{if(!value)throw Error(message);};
  for(const viewport of [{width:1156,height:746},{width:835,height:1000},{width:390,height:844},{width:320,height:568}]){
    const c=await browser.newContext({viewport,hasTouch:viewport.width<1000,isMobile:viewport.width<700,serviceWorkers:'block',timezoneId:'America/Los_Angeles',reducedMotion:viewport.width===320?'reduce':'no-preference'});
    try{
      await c.addInitScript(()=>{
        const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        localStorage.setItem('duckplan-demo-tasks-v1',JSON.stringify([
          {id:'work',title:'Study calculus',scheduledStart:today+'T14:30',dueDate:today,dueTime:'17:00'},
          {id:'date-only',title:'Submit lab notes',dueDate:today,dueTime:''},
          {id:'nearby',title:'Upload the reading response',dueDate:today,dueTime:'17:05'}
        ].map(t=>({classId:null,priority:'Medium',completed:false,durationMinutes:45,schemaVersion:2,...t}))));
      });
      const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
      await p.goto('http://127.0.0.1:8034/#calendar');await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
      const before=await p.evaluate(()=>JSON.stringify(store.listItems()));
      for(const view of ['day','week']){
        await p.locator(`#calendar-${view}`).count();
        await p.getByRole('button',{name:view==='day'?'Day':'Week',exact:true}).click();
        const geometry=await p.evaluate(()=>{
          const header=document.querySelector('.calendar-header-viewport').getBoundingClientRect(),body=document.querySelector('.calendar-timeline-scroller').getBoundingClientRect();
          const headings=[...document.querySelectorAll('.calendar-day-heading')],columns=[...document.querySelectorAll('.timeline-column')];
          return{headerHeight:header.height,gap:body.top-header.bottom,offsets:headings.map((h,i)=>h.getBoundingClientRect().left-columns[i].getBoundingClientRect().left)};
        });
        check(Math.abs(geometry.gap)<1&&geometry.offsets.every(x=>Math.abs(x)<1),'Header/body gap or misalignment');
        check(await p.locator('#calendar-date-only-deadlines,.timeline-deadline-label,[data-toggle-deadline-row]').count()===0,'Duplicate Due band remains');
        check(await p.locator('#planner-calendar [data-deadline-minute="1020"]').count()>0,'Timed deadline moved');
        for(const theme of ['light','dark']){
          await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
          for(const kind of ['work','due']){
            await p.locator(`#planner-calendar [data-day-list="${kind}"]`).first().click();
            const dialog=p.locator('.calendar-day-list-preview');await dialog.waitFor({state:'visible'});await p.waitForTimeout(420);
            const state=await dialog.evaluate(e=>({rows:[...e.querySelectorAll('.calendar-deadline-group-item')].map(b=>({text:b.textContent,color:getComputedStyle(b).color,time:getComputedStyle(b.querySelector('time')).color,background:getComputedStyle(b).backgroundColor,image:getComputedStyle(b).backgroundImage})),rect:e.getBoundingClientRect().toJSON()}));
            const expected=theme==='dark'?(kind==='work'?'rgb(36, 58, 86)':'rgb(74, 48, 46)'):(kind==='work'?'rgb(232, 240, 254)':'rgb(251, 238, 237)');
            check(state.rows.length===(kind==='work'?1:3),'Wrong summary membership');
            check(state.rows.every(r=>r.background===expected&&r.time===r.color&&r.image==='none'),'Tint/text mismatch '+JSON.stringify(state));
            if(kind==='due')check(state.rows.some(r=>r.text.includes('End of day')&&r.text.includes('Submit lab notes')),'Date-only deadline inaccessible');
            check(state.rect.left>=13&&state.rect.right<=viewport.width-13&&state.rect.bottom<=viewport.height-13,'List outside viewport');
            if(view==='day'&&theme==='light'&&viewport.width!==835)await p.screenshot({path:out+`${viewport.width}-${kind}.png`});
            await p.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
            results.push({viewport,view,theme,kind,status:'PASS',geometry,state});
          }
        }
      }
      check(before===await p.evaluate(()=>JSON.stringify(store.listItems())),'Viewing lists changed data');
      await p.reload();await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
      check(await p.locator('#calendar-date-only-deadlines').count()===0,'Band returned after reload');
      check(errors.length===0,errors.join(';'));
      check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow');
    }finally{await c.close();}
  }
  return {runtime:browser.version(),mode:'isolated local store; phone/tablet touch emulation; both themes',results};
}
