async page => {
  const browser=page.context().browser(),results=[],out='/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/popup-content-morph/';
  const assert=(v,m)=>{if(!v)throw Error(m);},id='60000000-0000-4000-8000-000000000001';
  const rows=[{id,title:'Review calculus notes',classId:'60000000-0000-4000-8000-000000000090',priority:'Medium',durationMinutes:45,notes:'Keep this task and its due time unchanged.',completed:false,source:'manual',schemaVersion:2,dueDate:'2026-11-20',dueTime:'17:00',scheduledStart:'2026-11-20T10:00'}];
  for(const config of [{width:1280},{width:835,cloud:true},{width:390,cloud:true},{width:320,dark:true}]){
    const prefix=Math.random().toString(16).slice(2,10).padEnd(8,'0'),id=prefix+'-0000-4000-8000-000000000001',classId=prefix+'-0000-4000-8000-000000000090',fixtureRows=rows.map(t=>({...t,id,classId}));
    const {width}=config,origin=config.cloud?'http://127.0.0.1:8796':'http://127.0.0.1:8034';
    const c=await browser.newContext({viewport:{width,height:900},hasTouch:width<1000,isMobile:width<700,colorScheme:config.dark?'dark':'light',serviceWorkers:'block',timezoneId:'America/Los_Angeles'});
    try{
      await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      if(config.cloud){
        const signup=await c.request.post(origin+'/api/auth/sign-up',{headers:{Origin:origin},data:{email:`popup-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`,password:`Synthetic-${Date.now()}-${Math.random()}`}});assert(signup.status()===201,'synthetic signup');
        const imported=await c.request.post(origin+'/api/import',{headers:{Origin:origin},data:{classRows:[{id:classId,name:'Calculus',color:'#538fc5'}],itemRows:fixtureRows.map(t=>({id:t.id,title:t.title,class_id:t.classId,priority:t.priority,notes:t.notes,duration_minutes:t.durationMinutes,completed:false,due_date:t.dueDate,due_time:t.dueTime,scheduled_start:t.scheduledStart}))}});assert(imported.status()===200,'synthetic import');
      } else
      await c.addInitScript(({rows,classId})=>{if(localStorage.getItem('popup-motion-fixture'))return;localStorage.setItem('popup-motion-fixture','1');localStorage.setItem('duckplan-demo-tasks-v1',JSON.stringify(rows));localStorage.setItem('duckplan-demo-classes-v1',JSON.stringify([{id:classId,name:'Calculus',color:'#538fc5'}]));}, {rows:fixtureRows,classId});
      const p=await c.newPage(),errors=[];p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
      await p.clock.install({time:new Date('2026-11-20T12:00:00-08:00')});
      await p.goto(origin+'/?qa=popup-content-morph#calendar');
      await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady&&document.body.dataset.view==='calendar');
      await p.evaluate(()=>{selectedDate='2026-11-20';calendarView='day';calendarUserScrolled=true;document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';renderAll({autoScrollCalendar:false});});
      if(width<700)await p.locator('#phone-task-summary').click();
      await p.evaluate(()=>{
        window.popupTest={paused:true,animations:[]};const native=Element.prototype.animate;
        Element.prototype.animate=function(...args){const a=native.apply(this,args);if(this.closest('.task-modal,.calendar-task-preview')){popupTest.animations.push(a);if(popupTest.paused)a.pause();}return a;};
      });
      const source=p.locator(`#daily-task-panel .task-select[data-edit-task="${id}"]`);
      await source.evaluate(e=>{e.id='fixture-popup-source';e.querySelector('span').id='fixture-popup-child';e.setAttribute('ondblclick','void 0');});
      const expectedPaint=await p.locator('#task-form').evaluate(e=>getComputedStyle(e).backgroundColor);
      await source.click();
      const start=await p.evaluate(()=>{
        const d=document.querySelector('#task-modal'),copy=d.querySelector('.popup-morph-label'),f=d.querySelector('form');
        return {paint:[...d.querySelectorAll('.popup-morph-paint')].map(e=>getComputedStyle(e).backgroundColor),open:d.open,stage:d.dataset.popupStage,copy:copy?.textContent,children:copy?.querySelectorAll('*').length,duplicates:copy?.querySelectorAll('[id],[ondblclick],[autofocus]').length,sourceHidden:document.querySelector('#daily-task-panel .task-select').style.visibility,opacity:getComputedStyle(f).opacity,inert:f.inert,anim:popupTest.animations.map(a=>({target:a.effect.target.className,duration:a.effect.getTiming().duration,properties:[...new Set(a.effect.getKeyframes().flatMap(f=>Object.keys(f).filter(k=>['opacity','transform'].includes(k))))]}))};
      });
      assert(start.paint.every(color=>color===expectedPaint),'shell must match actual theme material');assert(start.open&&start.inert&&start.opacity==='0','form must start hidden and inert');assert(start.copy.includes('Review calculus notes')&&start.children>5,'formatted source snapshot missing');assert(start.duplicates===0,'snapshot duplicated IDs');
      const samples=[];
      for(const time of [0,80,192,308]){
        await p.evaluate(time=>popupTest.animations.forEach(a=>a.currentTime=time),time);
        const sample=await p.evaluate(()=>({source:Number(getComputedStyle(document.querySelector('.popup-morph-label')).opacity),content:Number(getComputedStyle(document.querySelector('#task-form')).opacity),tile:getComputedStyle(document.querySelector('.popup-morph-tile')).transform}));samples.push({time,...sample});
        if(width===835)await p.screenshot({path:out+`tablet-${time}.png`});
      }
      assert(samples[0].source===1&&samples[0].content===0,'source identity at takeoff');assert(samples[2].content>0&&samples[2].content<1&&samples[2].source>0,'source and destination must overlap during expansion');assert(samples[3].content===1,'destination resolved before endpoint');
      await p.evaluate(()=>{popupTest.paused=false;popupTest.animations.forEach(a=>a.finish());});
      await p.waitForFunction(()=>!document.querySelector('#task-modal').dataset.popupMotion);
      const focused=await p.evaluate(()=>({name:document.activeElement.name,inert:document.querySelector('#task-form').inert,layers:document.querySelectorAll('.popup-morph-surface').length}));assert(focused.name==='title'&&!focused.inert&&focused.layers===0,'cleanup or title focus');
      await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#task-modal').open);
      assert(await source.evaluate(e=>getComputedStyle(e).visibility)==='visible','source remains hidden after close');
      // Unpaused real UI actions: reopen, Escape early, resize, preview/edit handoff.
      await source.click();await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#task-modal').open);
      await source.click();await p.setViewportSize({width:width-1,height:880});await p.waitForFunction(()=>!document.querySelector('#task-modal').dataset.popupMotion);
      assert(await p.locator('#task-form').evaluate(e=>!e.inert),'resize left form inert');
      await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#task-modal').open);await p.setViewportSize({width,height:900});
      if(width<700)await p.locator('#calendar-library-toolbar [data-close-task-panel]').click();
      await p.evaluate(()=>{document.querySelector('#planner-calendar').scrollTop=0;document.querySelectorAll('.timeline-scroll,.calendar-scroll').forEach(e=>e.scrollTop=0);});
      const block=p.locator(`.calendar-event-block[data-edit-task="${id}"]`);await block.scrollIntoViewIfNeeded();await block.click();
      await p.waitForFunction(()=>document.querySelector('#calendar-task-preview')?.open&&!document.querySelector('#calendar-task-preview').dataset.popupMotion);
      assert(await p.locator('#calendar-preview-title').textContent()==='Review calculus notes','preview contents');
      await p.setViewportSize({width:Math.min(width,390),height:700});assert(await p.locator('#calendar-task-preview').evaluate(e=>e.getBoundingClientRect().width<=innerWidth-28),'preview does not resize');await p.setViewportSize({width,height:900});
      const preview=await p.locator('#calendar-task-preview').evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,scroll:e.scrollHeight,client:e.clientHeight,staged:e.dataset.popupStaged}));
      await p.locator('#calendar-preview-edit').click();await p.waitForFunction(()=>document.querySelector('#task-modal').open&&!document.querySelector('#task-modal').dataset.popupMotion);
      await p.locator('#task-form [name="title"]').fill('Reviewed calculus notes');await p.locator('#task-form [type="submit"]').click();await p.waitForFunction(()=>!document.querySelector('#task-modal').open);
      assert(await p.evaluate(id=>store.listItems().find(t=>t.id===id).title,id)==='Reviewed calculus notes','save failed');
      await p.emulateMedia({reducedMotion:'reduce'});await block.click();await p.waitForFunction(()=>document.querySelector('#calendar-task-preview')?.open);
      assert(await p.locator('#calendar-task-preview').evaluate(e=>!e.dataset.popupMotion&&!e.querySelector('[inert]')),'reduced preview staging');await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#calendar-task-preview'));
      if(width<700){
        await p.emulateMedia({reducedMotion:'no-preference'});await p.locator('#phone-add-task').click();await p.waitForFunction(()=>document.querySelector('#task-modal').open&&!document.querySelector('#task-modal').dataset.popupMotion);
        assert(await p.locator('#task-form [name="title"]').inputValue()==='','Add retained an old title');await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#task-modal').open);
      }
      const saved=await p.evaluate(id=>{const t=store.listItems().find(t=>t.id===id);return {title:t.title,dueDate:t.dueDate,dueTime:t.dueTime,scheduledStart:t.scheduledStart};},id);assert(saved.dueTime==='17:00'&&saved.scheduledStart==='2026-11-20T10:00','dates changed');assert(errors.length===0,errors.join(';'));
      await p.reload();await p.waitForFunction(({id})=>typeof store!=='undefined'&&store.listItems().some(t=>t.id===id&&t.title==='Reviewed calculus notes'),{id});
      results.push({width,status:'PASS',mode:config.cloud?'synthetic signed-in / real localhost Worker schema 0001-0008':'isolated local',theme:config.dark?'dark':'light',start,samples,focused,preview,saved,errors});
    }finally{await c.close();}
  }
  return {runtime:browser.version(),results};
}
