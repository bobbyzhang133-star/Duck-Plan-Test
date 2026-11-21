// Isolated local storage / dedicated loopback accounts only. No Google writes.
async page => {
  const browser = page.context().browser(), results = [];
  const out = '/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-overlap-20261120/';
  const check = (value, message) => { if (!value) throw Error(message); };
  for (const cfg of [{width:1470,height:745},{width:1156,height:746},{width:835,height:1000,touch:true},{width:390,height:844,touch:true},{width:320,height:568,touch:true,reduce:true},{width:1470,height:745,cloud:true},{width:390,height:844,touch:true,cloud:true}]) {
    const c = await browser.newContext({viewport:{width:cfg.width,height:cfg.height},hasTouch:!!cfg.touch,isMobile:cfg.width<700,timezoneId:'America/Los_Angeles',reducedMotion:cfg.reduce?'reduce':'no-preference',serviceWorkers:'block'});
    const p = await c.newPage(), errors = [], result = {...cfg,mode:cfg.cloud?'signed-in current loopback Worker/D1':'local',checks:[]};
    p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
    const origin = cfg.cloud?'http://127.0.0.1:8798':'http://127.0.0.1:8034';
    try {
      if (cfg.cloud) {
        const r = await c.request.post(origin+'/api/auth/sign-up',{data:{email:`overlap-${Date.now()}-${cfg.width}@example.test`,password:`Fixture-${Date.now()}-${Math.random()}`},headers:{Origin:origin}});
        check(r.status()===201,'QA signup failed');
      } else await c.addInitScript(()=>{if(localStorage.getItem('duckplan-demo-tasks-v1')===null)localStorage.setItem('duckplan-demo-tasks-v1','[]');});
      await p.goto(origin+'/#calendar');
      const ready = () => p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
      await ready();check(await p.evaluate(()=>store.mode)===(cfg.cloud?'cloud':'local'),'Wrong mode');
      const fixture = await p.evaluate(async()=>{
        const date=Model.todayKey(), ids={}, alerts={version:1,timeZone:'America/Los_Angeles',alarm:{enabled:false,mode:'manual',at:Model.addDays(date,1)+'T12:00',sound:'gentle',snoozeMinutes:10},notification:{enabled:false,mode:'manual',at:Model.addDays(date,1)+'T12:05'}};
        for(const [key,title,start,duration,due] of [
          ['early','Study calculus','14:00',135,null],['late','Practice problems','14:45',90,'15:30'],
          ['sameLong','Long work session','17:00',90,null],['sameShort','Short work session','17:00',45,'17:00'],
          ['nearby','Upload lab report',null,45,'15:35'],['dateOnly','Reading response',null,45,''],
          ['midnight','Early review','00:00',30,'00:00'],['night','Late review','23:15',45,'23:59']
        ]){
          ids[key]=crypto.randomUUID();await store.upsertItem({id:ids[key],title,classId:null,priority:'Medium',dueDate:due===null?'':date,dueTime:due||'',scheduledStart:start?date+'T'+start:null,durationMinutes:duration,notes:'Overlap fixture',actualMinutes:0,reminderChoice:'off',workAlerts:alerts,schemaVersion:2});
        }
        return {date,ids};
      });
      const before = await p.evaluate(()=>JSON.stringify(store.listItems()));
      const column = () => p.locator(`.timeline-column[data-column-date="${fixture.date}"]`);
      const work = key => column().locator(`[data-calendar-drag-task="${fixture.ids[key]}"]`);
      const scroll = hour => p.locator('.calendar-timeline-scroller').evaluate((e,h)=>e.scrollTop=h*62,hour);
      const reveal = async locator => {
        for(let attempt=0;;attempt++)try{await locator.scrollIntoViewIfNeeded();return;}catch(error){
          if(attempt===2||!error.message.includes('not attached'))throw error;
          await p.waitForTimeout(100); // A live cloud acknowledgement can replace the same task node.
        }
      };
      for (const view of ['day','week']) {
        await p.getByRole('button',{name:view==='day'?'Day':'Week',exact:true}).click();await scroll(13);
        // Bring today's Week column into the horizontal viewport without altering data.
        await reveal(work('early'));await scroll(13);
        const geometry = await column().evaluate((col,ids)=>{
          const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
          const event=key=>box(col.querySelector(`[data-calendar-drag-task="${ids[key]}"]`));
          return{column:box(col),early:event('early'),late:event('late'),sameLong:event('sameLong'),sameShort:event('sameShort')};
        },fixture.ids);
        const {early,late,sameLong,sameShort}=geometry;
        check(Math.abs((late.x-early.x)/early.w-.05)<.002&&Math.abs(late.w/early.w-.95)<.002,'Staggered reference ratios');
        check(Math.abs((sameShort.x-sameLong.x)/sameLong.w-50/85)<.003&&Math.abs(sameShort.w/sameLong.w-50/85)<.003,'Close-heading reference ratios');
        check(early.x+early.w>late.x&&sameLong.x+sameLong.w>sameShort.x,'Blocks do not overlap');
        for (const theme of ['light','dark']) {
          await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await p.waitForTimeout(300);
          const group=column().locator('[data-timed-deadline-group]').first();await reveal(group);
          await work('early').hover({position:{x:15,y:8}});await work('early').focus();
          const hit=await group.evaluate(button=>{
            const r=button.getBoundingClientRect(),g=parseFloat(getComputedStyle(button.closest('.timed-deadline-anchor')).getPropertyValue('--timed-deadline-gutter'))||0;
            const x=r.left+g+(r.width-g)/2,y=r.top+Math.min(24,r.height/2);
            const hit=document.elementFromPoint(x,y);
            return{top:hit?.closest('.timed-deadline-marker,.timed-deadline-group-trigger')===button?'deadline':hit?.closest('.calendar-event-block')?'work':hit?.tagName,layer:getComputedStyle(button.closest('.timeline-column').querySelector('.calendar-work-layer')).zIndex,front:getComputedStyle(button.closest('.timed-deadline-anchor')).zIndex};
          });
          check(hit.top==='deadline','Work hides or intercepts Due '+JSON.stringify(hit));
          await group.click();await p.locator('.calendar-deadline-group-preview').waitFor({state:'visible'});await p.waitForTimeout(450);
          const text=await p.locator('.calendar-deadline-group-preview').innerText();check(text.includes('Practice problems')&&text.includes('Upload lab report'),'Grouped Due membership');
          await p.keyboard.press('Escape');await p.locator('.calendar-deadline-group-preview').waitFor({state:'detached'});
          // Both exposed work headings remain real pointer controls.
          await scroll(13);await reveal(work('early'));await scroll(13);
          for(const key of ['early','late']){
            await work(key).click({position:{x:Math.min(15,(await work(key).boundingBox()).width/3),y:8}});
            await p.locator('#calendar-task-preview.calendar-task-preview').waitFor({state:'visible'});await p.waitForTimeout(450);
            await p.keyboard.press('Escape');await p.locator('#calendar-task-preview').waitFor({state:'detached'});
          }
          result.checks.push({view,theme,status:'PASS',geometry,deadlineHit:hit});
        }
        await p.evaluate(()=>document.documentElement.dataset.theme='light');await p.waitForTimeout(300);await scroll(13);
        if(view==='day'&&[1470,390].includes(cfg.width)&&!cfg.cloud)await p.screenshot({path:out+`${cfg.width}-day.png`});
        if(view==='week'&&cfg.width===1156)await p.screenshot({path:out+'1156-week.png'});
      }
      check(await p.evaluate(()=>JSON.stringify(store.listItems()))===before,'Viewing changed data');
      await p.getByRole('button',{name:'Day',exact:true}).click();await scroll(16);
      // A single exact-time Due marker wins even at the same work start.
      const single=column().locator(`[data-calendar-kind="deadline"][data-select-task="${fixture.ids.sameShort}"]`);await reveal(single);await single.click();await p.locator('#calendar-task-preview').waitFor({state:'visible'});await p.waitForTimeout(450);
      check((await p.locator('#calendar-task-preview').innerText()).includes('Short work session'),'Single deadline opens wrong task');await p.keyboard.press('Escape');await p.locator('#calendar-task-preview').waitFor({state:'detached'});
      // Keyboard move works through the new wrapper, with existing Undo and durable settings.
      await work('sameLong').focus();await p.keyboard.press('Alt+ArrowDown');
      await p.waitForFunction(({id,date})=>store.listItems().find(t=>t.id===id)?.scheduledStart===date+'T17:15',{id:fixture.ids.sameLong,date:fixture.date});
      await p.locator('#toast-action').click();await p.waitForFunction(({id,date})=>store.listItems().find(t=>t.id===id)?.scheduledStart===date+'T17:00',{id:fixture.ids.sameLong,date:fixture.date});
      if(!cfg.touch){
        await scroll(12);await reveal(work('late'));await scroll(12);
        const original=await p.evaluate(id=>structuredClone(store.listItems().find(t=>t.id===id)),fixture.ids.late);
        await work('late').dragTo(column().locator('[data-slot-time="13:00"]'),{sourcePosition:{x:15,y:4},targetPosition:{x:15,y:4}});
        await p.waitForFunction(({id,date})=>store.listItems().find(t=>t.id===id)?.scheduledStart===date+'T13:00',{id:fixture.ids.late,date:fixture.date});
        const moved=await p.evaluate(id=>store.listItems().find(t=>t.id===id),fixture.ids.late);
        check(moved.dueDate===original.dueDate&&moved.dueTime===original.dueTime&&JSON.stringify(moved.workAlerts)===JSON.stringify(original.workAlerts),'Drag changed deadline/settings');
        await p.locator('#toast-action').click();await p.waitForFunction(({id,date})=>store.listItems().find(t=>t.id===id)?.scheduledStart===date+'T14:45',{id:fixture.ids.late,date:fixture.date});
      }
      await p.reload();await ready();
      const saved=await p.evaluate(ids=>({count:store.listItems().length,late:store.listItems().find(t=>t.id===ids.late),long:store.listItems().find(t=>t.id===ids.sameLong)}),fixture.ids);
      check(saved.count===8&&saved.late.scheduledStart===fixture.date+'T14:45'&&saved.late.dueTime==='15:30'&&saved.long.scheduledStart===fixture.date+'T17:00','Reload lost undo/data');
      check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow');check(errors.length===0,errors.join(';'));
      result.status='PASS';result.persistence='move/Undo/reload preserve identity, deadlines, alerts and count';
    } catch(error) {result.status='FAIL';result.error=error.message;await p.screenshot({path:out+`${cfg.width}-${cfg.cloud?'cloud':'local'}-failure.png`}).catch(()=>{});}
    finally {await c.close();}results.push(result);
  }
  return{runtime:browser.version(),results};
}
