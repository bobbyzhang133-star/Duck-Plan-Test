// Disposable local-mode fixtures; never reads or changes user browser state.
async(page)=>{
 const browser=page.context().browser(), origin='http://127.0.0.1:8034', out='/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/template-action-reference/';
 const contexts=new Set(),cases=[],errors=[],failed=[];let stage='start',diagnostic=null;
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 const wait=(p,fn,arg)=>p.waitForFunction(fn,arg,{timeout:6000});
 async function setup(width,touch){
  const c=await browser.newContext({viewport:{width,height:900},hasTouch:touch,isMobile:touch&&width<700,timezoneId:'America/Los_Angeles',serviceWorkers:'block',reducedMotion:'reduce'});contexts.add(c);
  await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const p=await c.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push({width,message:e.message}));p.on('requestfailed',r=>failed.push({width,path:new URL(r.url()).pathname,error:r.failure()?.errorText}));
  await p.goto(origin+'/?qa=template-action-reference#calendar');await p.bringToFront();await wait(p,()=>typeof store!=='undefined'&&store.mode==='local'&&store.listItems().length>0);
  const template=await p.evaluate(async()=>{const c=await store.upsertClass({id:crypto.randomUUID(),name:'Calculus',color:'#518fc9',code:'QA'});const t=await store.upsertTemplate({id:crypto.randomUUID(),title:'QA Calculus review',classId:c.id,durationMinutes:60,priority:'Medium',notes:'Keep the reference template notes',reminderChoice:'off'});selectedDate='2026-11-14';calendarView='week';setView('calendar',true);renderAll({autoScrollCalendar:false});return t;});
  if(width<700)await p.locator('#phone-task-summary').tap();
  await p.locator('#calendar-templates-tab').click();
  const card=p.locator(`#calendar-assignment-templates [data-library-template="${template.id}"]`).locator('..');
  return{c,p,width,touch,template,card,schedule:card.locator('[data-library-action="schedule-template"]'),add:card.locator('[data-library-action="add-template"]')};
 }
 async function snapshot(f){return f.card.evaluate(e=>{const b=action=>e.querySelector(`[data-library-action="${action}"]`);const m=e=>{const s=getComputedStyle(e);return{rect:e.getBoundingClientRect().toJSON(),background:s.backgroundColor,border:s.borderColor,borderWidth:s.borderWidth,borderStyle:s.borderStyle,radius:s.borderRadius,shadow:s.boxShadow,after:getComputedStyle(e,'::after').display,color:s.color};};const svg=b('schedule-template').querySelector('svg');return{row:e.querySelector('.library-template-actions').getBoundingClientRect().toJSON(),schedule:m(b('schedule-template')),add:m(b('add-template')),menu:m(b('template-menu')),icon:{width:svg?.getBoundingClientRect().width,height:svg?.getBoundingClientRect().height,hidden:svg?.getAttribute('aria-hidden'),focusable:svg?.getAttribute('focusable'),paths:svg?.querySelectorAll('path').length},overflow:document.documentElement.scrollWidth>innerWidth};});}
 const transparent=s=>s==='rgba(0, 0, 0, 0)'||s==='transparent';
 function plain(style,label){check(transparent(style.background)&&transparent(style.border)&&style.shadow==='none'&&style.after==='none','Plain text action has a box in '+label+' '+JSON.stringify(style));}
 async function functional(f){
  const before=await f.p.evaluate(()=>({tasks:store.listItems(),templates:store.listTemplates()}));
  stage='Schedule SVG/path '+f.width;
  await f.schedule.locator('svg path').click();await f.p.locator('#task-modal').waitFor({state:'visible'});
  const form=await f.p.locator('#task-form').evaluate(e=>({title:e.elements.title.value,date:e.elements.scheduledDate.value,time:e.elements.scheduledTime.value,due:e.elements.dueDate.value,duration:e.elements.durationMinutes.value,classId:e.elements.classId.value,notes:e.elements.notes.value}));
  check(form.title===f.template.title&&form.date==='2026-11-14'&&form.time==='09:00'&&form.due===''&&form.duration==='60'&&form.classId===f.template.classId&&form.notes===f.template.notes,'Schedule lost its prefilled editor '+JSON.stringify(form));
  await f.p.locator('#cancel-task').click();await wait(f.p,()=>!document.querySelector('#task-modal').open);
  check(await f.p.evaluate(n=>store.listItems().length===n,before.tasks.length),'Cancel wrote a task');
  cases.push({test:'calendar-plus-path-click-opens-existing-prefilled-editor-cancel',width:f.width,status:'PASS',form});
  stage='Add copy '+f.width;await f.add.click();await wait(f.p,n=>store.listItems().length===n+1,before.tasks.length);await wait(f.p,()=>/Added a new task/.test(document.querySelector('#toast-message').textContent));
  const copy=await f.p.evaluate(ids=>store.listItems().find(t=>!ids.includes(t.id)),before.tasks.map(t=>t.id));
  check(copy.id!==f.template.id&&copy.title===f.template.title&&copy.classId===f.template.classId&&copy.durationMinutes===60&&copy.notes===f.template.notes&&!copy.scheduledStart&&!copy.dueDate,'Add to tasks copy changed settings');
  await f.p.reload();await wait(f.p,ids=>typeof store!=='undefined'&&store.listItems().some(t=>t.id===ids.copy)&&store.listTemplates().some(t=>t.id===ids.template),{copy:copy.id,template:f.template.id});
  cases.push({test:'plain-Add-task-independent-copy-reload-source-preserved',width:f.width,status:'PASS',copyId:copy.id,templateId:f.template.id});
 }
 try{
  for(const [width,touch]of[[768,true],[320,true],[390,true],[835,false]]){
   stage='setup '+width;const f=await setup(width,touch);
   try{
    for(const theme of ['light','dark'])for(const motion of ['reduce','no-preference']){
     stage=`style ${width} ${theme} ${motion}`;await f.p.emulateMedia({reducedMotion:motion});await f.p.evaluate(t=>document.documentElement.dataset.theme=t,theme);await f.p.mouse.move(width-6,60);
     const rest=await snapshot(f);diagnostic={width,touch,...rest};plain(rest.add,stage+' rest');check(transparent(rest.schedule.background)&&!transparent(rest.schedule.border)&&parseFloat(rest.schedule.borderWidth)>=1&&rest.schedule.borderStyle==='solid'&&parseFloat(rest.schedule.radius)>=rest.schedule.rect.height/2,'Schedule is not an outlined pill');
     check(rest.icon.width===18&&rest.icon.height===18&&rest.icon.hidden==='true'&&rest.icon.focusable==='false'&&rest.icon.paths>0,'Calendar-plus SVG missing/accessible');check(!rest.overflow,'Page overflow');
     for(const b of [rest.schedule,rest.add,rest.menu]){check(b.rect.left>=rest.row.left-.5&&b.rect.right<=rest.row.right+.5,'Action clipping');if(touch)check(b.rect.height>=44&&b.rect.width>=44,'Touch target below44');}
     check(rest.schedule.rect.right<=rest.add.rect.left+.1&&rest.add.rect.right<=rest.menu.rect.left+.1,'Action overlap');
     await f.add.hover();const hover=await f.add.evaluate(e=>({background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderColor,shadow:getComputedStyle(e).boxShadow,after:getComputedStyle(e,'::after').display}));plain(hover,stage+' hover');
     await f.p.mouse.down();const press=await f.add.evaluate(e=>({background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderColor,shadow:getComputedStyle(e).boxShadow,after:getComputedStyle(e,'::after').display}));plain(press,stage+' press');await f.p.mouse.move(width-6,60);await f.p.mouse.up();
     const release=await f.add.evaluate(e=>({background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderColor,shadow:getComputedStyle(e).boxShadow,after:getComputedStyle(e,'::after').display}));plain(release,stage+' release');
     await f.p.keyboard.press('Tab');await f.schedule.focus();const focus=await f.schedule.evaluate(e=>({visible:e.matches(':focus-visible'),width:getComputedStyle(e).outlineWidth,style:getComputedStyle(e).outlineStyle}));check(focus.visible&&parseFloat(focus.width)>0&&focus.style!=='none','Schedule keyboard focus missing');
     await f.add.focus();const addFocus=await f.add.evaluate(e=>({visible:e.matches(':focus-visible'),width:getComputedStyle(e).outlineWidth,style:getComputedStyle(e).outlineStyle}));check(addFocus.visible&&parseFloat(addFocus.width)>0&&addFocus.style!=='none','Text-action keyboard focus missing');
     cases.push({test:'reference-style-layout-feedback-focus',width,touch,theme,motion,status:'PASS',rest,hover,press,release,focus,addFocus});
     if(motion==='no-preference'&&((width===320)||(width===835&&theme==='light'))){await f.card.locator('h3').click();await wait(f.p,id=>!document.querySelector(`[data-library-template="${id}"]`).parentElement.querySelector('.interaction-pressed,.interaction-released'),f.template.id);await f.p.screenshot({path:out+'reference-'+width+'-'+theme+'.png'});}
    }
    if(width===835){await f.p.emulateMedia({reducedMotion:'reduce'});await f.p.evaluate(()=>document.documentElement.dataset.theme='light');await functional(f);}
   }finally{await f.c.close();contexts.delete(f.c);}
  }
  return{runtime:browser.version(),mode:'local browser storage / disposable fixtures',cases,errors,failed,allSyntheticContextsClosed:contexts.size===0,scope:'Presentation/action checks in Chromium with touch emulation; not physical Safari, native WKWebView or installed PWA acceptance.'};
 }catch(error){return{runtime:browser.version(),stage,error:error.message,diagnostic,cases,errors,failed};}finally{for(const c of contexts)await c.close();}
}
