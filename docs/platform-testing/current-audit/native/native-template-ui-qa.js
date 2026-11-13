// Temporary simulator-bundle instrumentation only. Supply local fixture credentials in the private collector command file; never commit that file.
(async()=>{
 const base='http://127.0.0.1:8795';
 let fixtureEmail, fixturePassword;
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 const wait=async(fn,label)=>{for(let n=0;n<400;n++){if(fn())return;await delay(50);}throw new Error('Timeout: '+label);};
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 const report=async(stage,data={})=>{await fetch(base+'/result',{method:'POST',body:JSON.stringify({stage,...data})});};
 const q=s=>document.querySelector(s);
 const click=s=>{const e=q(s);check(e&&!e.disabled,'Unavailable control '+s);e.click();};
 const fill=(form,values)=>{for(const [name,value]of Object.entries(values)){const el=form.elements.namedItem(name);check(el,'Missing field '+name);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}};
 const submit=async(selector)=>{const form=q(selector);check(form,'Missing form '+selector);form.requestSubmit(form.querySelector('button[type="submit"]'));};
 const view=async(name)=>{
  const direct=q('.phone-bottom-nav [data-view="'+name+'"]');
  if(direct)direct.click();else{click('#phone-more-button');await wait(()=>q('#phone-more-dialog').open,'More dialog');await delay(450);click('#phone-more-dialog [data-view="'+name+'"]');await wait(()=>!q('#phone-more-dialog').open,'More closed');}
  await wait(()=>document.body.dataset.view===name,'view '+name);await delay(450);
 };
 const templates=async()=>{await view('calendar');if(!document.body.classList.contains('task-panel-open'))click('#phone-task-summary');await wait(()=>document.body.classList.contains('task-panel-open'),'phone sheet');click('#calendar-templates-tab');await delay(450);};
 const signIn=async()=>{await view('settings');if(!store.user){await wait(()=>q('#sign-in-form'),'sign-in form');fill(q('#sign-in-form'),{email:fixtureEmail,password:fixturePassword});await submit('#sign-in-form');await wait(()=>store.mode==='cloud'&&store.user,'signed in');await delay(450);}};
 const newTemplate=async(title)=>{click('#calendar-assignment-templates [data-library-action="new-template"]');await wait(()=>q('#planner-library-dialog')?.open,'template dialog');fill(q('#planner-library-dialog form'),{title,classId:'',durationMinutes:'20',priority:'High',reminderChoice:'60',notes:'Native saved instructions\nSecond line.'});await submit('#planner-library-dialog form');await wait(()=>!q('#planner-library-dialog'),'saved template');const item=store.listTemplates().find(t=>t.title===title);check(item,'Template persisted');return item;};
 const manage=async(id,action)=>{click('#calendar-assignment-templates [data-library-action="template-menu"][data-library-id="'+id+'"]');await wait(()=>q('#template-management-menu'),'template menu');await delay(250);click('[data-template-menu-action="'+action+'"]');await wait(()=>q('#planner-library-dialog')?.open,'management dialog');};
 const schedule=async(item)=>{const before=store.listItems().map(t=>t.id);click('#calendar-assignment-templates [data-library-action="schedule-template"][data-library-id="'+item.id+'"]');await wait(()=>q('#task-modal').open,'schedule editor');await delay(450);check(q('#task-form').elements.namedItem('title').value===item.title,'Schedule title');check(q('#task-form').elements.namedItem('dueDate').value==='','Schedule blank deadline');check(store.listItems().length===before.length,'Schedule draft creates no task');await submit('#task-form');await wait(()=>!q('#task-modal').open,'saved schedule');const task=store.listItems().find(t=>!before.includes(t.id));check(task&&task.scheduledStart&&task.durationMinutes===20&&task.notes===item.notes&&task.reminderChoice==='60','Scheduled task saved with template settings');check(store.listTemplates().some(t=>t.id===item.id),'Template survives scheduling');return task;};
 try{
  const config=await(await fetch(base+'/command')).json(); const {mode}=config; fixtureEmail=config.fixtureEmail; fixturePassword=config.fixturePassword;
  await wait(()=>typeof store!=='undefined'&&store.configured,'store startup');await delay(1200);
  await report('started',{mode,native:Boolean(window.DuckNativeCloud),endpoint:window.DUCKPLAN_CLOUD.apiUrl});
  if(mode==='old'){
   await signIn();await templates();
   const disabled=q('#calendar-assignment-templates [data-library-action="new-template"]').disabled;
   const notice=q('#calendar-assignment-templates .library-unavailable')?.textContent;
   check(!store.supportsOrganization&&disabled&&notice,'Old backend capability gate');
   await report('old-blocked',{mode,disabled,notice,organization:store.supportsOrganization,personal:store.supportsPersonal});
  }else if(mode==='local'){
   await view('settings');if(store.user){click('#sign-out');await wait(()=>store.mode==='local','local sign-out');}
   await templates();check(store.supportsOrganization,'Local templates enabled');
   const item=await newTemplate('Native QA local template');const task=await schedule(item);
   localStorage.setItem('duckplan-native-qa-local-ids',JSON.stringify({template:item.id,task:task.id}));
   await templates();await report('local-saved',{template:item.id,task:task.id,title:item.title,scheduledStart:task.scheduledStart});
  }else if(mode==='local-relaunch'){
   await wait(()=>store.mode==='local','local restored');const ids=JSON.parse(localStorage.getItem('duckplan-native-qa-local-ids'));
   check(store.listTemplates().some(t=>t.id===ids.template)&&store.listItems().some(t=>t.id===ids.task&&t.scheduledStart),'Local data survives native relaunch');
   await templates();await report('local-relaunch-pass',{ids});
  }else if(mode==='cloud'){
   await signIn();await wait(()=>store.supportsOrganization&&store.supportsPersonal,'current backend capabilities');await templates();
   const item=await newTemplate('Native QA cloud template');
   await manage(item.id,'edit');fill(q('#planner-library-dialog form'),{title:'Native QA cloud template edited'});await submit('#planner-library-dialog form');await wait(()=>!q('#planner-library-dialog'),'edited template');
   const edited=store.listTemplates().find(t=>t.id===item.id);check(edited.title.endsWith('edited'),'Template edit');
   await manage(item.id,'details');check(q('#planner-library-dialog').textContent.includes('Native saved instructions')&&q('#planner-library-dialog').textContent.includes('1 hour before'),'Full template details');click('#planner-library-dialog [data-library-close]');await wait(()=>!q('#planner-library-dialog'),'details closed');
   const task=await schedule(edited);await templates();
   const before=store.listItems().map(t=>t.id);const add=()=>click('#calendar-assignment-templates [data-library-action="add-template"][data-library-id="'+item.id+'"]');
   add();await wait(()=>store.listItems().filter(t=>!before.includes(t.id)).length===1,'first unscheduled copy');await wait(()=>q('#calendar-assignment-templates [data-library-action="add-template"][data-library-id="'+item.id+'"]').getAttribute('aria-busy')!=='true','first copy persisted');add();await wait(()=>store.listItems().filter(t=>!before.includes(t.id)).length===2,'second independent copy');
   await wait(()=>q('#calendar-assignment-templates [data-library-action="add-template"][data-library-id="'+item.id+'"]').getAttribute('aria-busy')!=='true','second copy persisted');check(store.listItems().filter(t=>!before.includes(t.id)).every(t=>!t.scheduledStart),'Add to tasks stays unscheduled');
   await manage(item.id,'delete');click('#planner-library-dialog [data-library-close]');await wait(()=>!q('#planner-library-dialog'),'delete canceled');check(store.listTemplates().some(t=>t.id===item.id),'Delete cancel preserves template');
   const disposable=await newTemplate('Native QA disposable template');await manage(disposable.id,'delete');await submit('#planner-library-dialog form');await wait(()=>!store.listTemplates().some(t=>t.id===disposable.id),'confirmed delete');await wait(()=>!q('#planner-library-dialog'),'delete dialog closed');
   if(document.body.classList.contains('task-panel-open'))click('[data-close-task-panel]');await delay(450);
   await view('notes');click('[data-note-action="new"]');await wait(()=>q('.personal-note-dialog[open]'),'note dialog');await delay(450);fill(q('.personal-note-dialog form'),{title:'Native QA saved note',body:'Native note body survives relaunch.'});await submit('.personal-note-dialog form');await wait(()=>store.listNotes().some(n=>n.title==='Native QA saved note'),'note saved');await wait(()=>!q('.personal-note-dialog'),'note closed');
   await view('goals');click('[data-pg-action="add-goal"]');await wait(()=>q('.pg-dialog[open]'),'goal dialog');await delay(450);fill(q('.pg-dialog form'),{title:'Native QA saved goal',targetCount:'5',currentCount:'2',unit:'sessions'});await submit('.pg-dialog form');await wait(()=>store.listGoals().some(g=>g.title==='Native QA saved goal'),'goal saved');await wait(()=>!q('.pg-dialog'),'goal closed');
   click('[data-pg-action="add-habit"]');await wait(()=>q('.pg-dialog[open]'),'habit dialog');await delay(450);fill(q('.pg-dialog form'),{title:'Native QA saved habit'});await submit('.pg-dialog form');await wait(()=>store.listHabits().some(h=>h.title==='Native QA saved habit'),'habit saved');await wait(()=>!q('.pg-dialog'),'habit closed');
   const habit=store.listHabits().find(h=>h.title==='Native QA saved habit');const date=nowKey();click('[data-pg-action="checkin"][data-pg-id="'+habit.id+'"][data-pg-date="'+date+'"]');await wait(()=>store.listHabitCheckins().some(c=>c.habitId===habit.id&&c.date===date&&c.completed),'habit checked');
   await wait(()=>!q('[data-pg-action="checkin"][data-pg-id="'+habit.id+'"][data-pg-date="'+date+'"][aria-busy="true"]'),'check-in persisted');localStorage.setItem('duckplan-native-qa-cloud-ids',JSON.stringify({template:item.id,task:task.id,habit:habit.id,date}));
   await templates();await report('cloud-pass',{template:item.id,task:task.id,notes:store.listNotes().length,goals:store.listGoals().length,habits:store.listHabits().length,templateCrud:true,schedule:true,independentCopies:2});
  }else if(mode==='cloud-relaunch'){
   await wait(()=>store.user&&store.supportsOrganization&&store.supportsPersonal,'cloud restored');const ids=JSON.parse(localStorage.getItem('duckplan-native-qa-cloud-ids'));
   check(store.listTemplates().some(t=>t.id===ids.template)&&store.listItems().some(t=>t.id===ids.task),'Cloud template and scheduled task restored');
   check(store.listNotes().some(n=>n.title==='Native QA saved note')&&store.listGoals().some(g=>g.title==='Native QA saved goal')&&store.listHabitCheckins().some(c=>c.habitId===ids.habit&&c.date===ids.date&&c.completed),'Personal data restored');
   await templates();await report('cloud-relaunch-pass',{ids,identityRestored:true});
  }
 }catch(error){await report('failure',{message:error.message,stack:error.stack?.slice(0,1200)}).catch(()=>{});const pre=document.createElement('pre');pre.textContent='QA failure: '+error.message;pre.style.cssText='position:fixed;inset:70px 10px auto;z-index:99999;background:white;color:red;padding:12px;white-space:pre-wrap';document.body.append(pre);}
})();
