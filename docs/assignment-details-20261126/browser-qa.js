async (page) => {
  const browser = page.context().browser(), origin = "http://127.0.0.1:8798";
  const evidence = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/assignment-details-20261126/";
  const results = [], assert = (ok, text) => { if (!ok) throw Error(text); };
  for (const [name,width,height,touch,reduced,dark] of [["small",320,568,true,false,false],["phone",390,844,true,false,false],["landscape",844,390,true,false,false],["ipad",835,1112,true,false,false],["desktop",1280,900,false,false,false],["dark-reduced",390,844,true,true,true]]) {
    const c = await browser.newContext({viewport:{width,height},hasTouch:touch,reducedMotion:reduced?"reduce":"no-preference",serviceWorkers:"block"}),p=await c.newPage();
    const result={name,viewport:[width,height],input:touch?"emulated touch":"mouse and keyboard",mode:"local browser storage",reducedMotion:reduced,dark,errors:[]};p.on("pageerror",e=>result.errors.push(e.message));
    const act=locator=>touch?locator.tap():locator.click();
    async function idlePreview() {await p.waitForFunction(()=>{const d=document.querySelector('#calendar-task-preview');return d?.open&&!d.dataset.popupMotion;});}
    async function dismiss() {await act(p.locator('#calendar-task-preview .close-button'));await p.waitForFunction(()=>!document.querySelector('#calendar-task-preview'));}
    async function material() {
      return p.locator('#calendar-task-preview').evaluate(d=>{
        const rgb=value=>{const ctx=document.createElement('canvas').getContext('2d');ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
        const luminance=values=>values.map(v=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
        const s=getComputedStyle(d),bg=rgb(s.backgroundColor),fg=rgb(getComputedStyle(d.querySelector('.calendar-preview-meta')).color),a=luminance(bg),b=luminance(fg);
        return {kind:d.dataset.assignmentKind,background:s.backgroundColor,metaContrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
      });
    }
    try {
      await c.addInitScript(({dark})=>{
        if(sessionStorage.getItem('details-seeded'))return;sessionStorage.setItem('details-seeded','1');
        const d=new Date(),today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
        localStorage.setItem('duckplan-demo-classes-v1',JSON.stringify([{id:'science',name:'Science',code:'SC',color:'#538fc5',teacher:'Test',period:'1'}]));
        const row={title:'Assignment details with a long title that wraps on a small phone',notes:'First line of assignment instructions.\nA second line with the full assignment requirements.',type:'assignment',dueDate:today,dueTime:'16:00',scheduledStart:today+'T10:00',durationMinutes:45,priority:'High',completed:false,schemaVersion:2,classId:'science'};
        localStorage.setItem('duckplan-demo-tasks-v1',JSON.stringify([{...row,id:'work'},{...row,id:'personal',title:'Personal work',classId:null,scheduledStart:today+'T11:00',dueTime:'18:00'},{...row,id:'due',title:'Single timed deadline',scheduledStart:null,dueTime:'14:00'},{...row,id:'group-one',title:'Grouped deadline one',scheduledStart:null,dueTime:'15:00'},{...row,id:'group-two',title:'Grouped deadline two',scheduledStart:null,dueTime:'15:05'}]));
        if(dark)localStorage.setItem('duckplan-theme','dark');
      },{dark});
      await p.goto(origin+'/?details-qa=1#calendar');await p.waitForFunction(()=>{try{return store.listItems().length===5&&workAlertContextReady}catch{return false}});
      if(dark){await p.evaluate(()=>document.documentElement.dataset.theme='dark');await p.waitForTimeout(300);}
      await act(p.locator('[data-calendar-view="day"]'));
      const block=p.locator('#planner-calendar .calendar-event-block[data-select-task="work"]');await block.scrollIntoViewIfNeeded();
      const workBackground=await block.evaluate(e=>getComputedStyle(e).backgroundColor);
      await act(block);await idlePreview();assert(!await p.locator('#task-modal').evaluate(e=>e.open),'Block opened editor directly');
      result.workMaterial=await material();assert(result.workMaterial.background===workBackground,'Work details background differs from its block');assert(result.workMaterial.metaContrast>=4.5,'Work details text contrast too low');
      assert((await p.locator('#calendar-preview-title').textContent()).includes('Assignment details'),'Wrong details');
      await p.screenshot({path:evidence+name+'-details.png'});
      const bounds=await p.locator('#calendar-task-preview').boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,'Preview outside viewport');
      await act(p.locator('#calendar-preview-edit'));await p.waitForFunction(()=>document.querySelector('#task-modal').open&&!document.querySelector('#calendar-task-preview'));
      await p.waitForFunction(()=>!document.querySelector('#task-modal').dataset.popupMotion);
      assert(await p.locator('#task-form [name="title"]').inputValue()==='Assignment details with a long title that wraps on a small phone','Wrong edit target');
      await p.locator('#task-form [name="title"]').fill('Saved through assignment details');await act(p.locator('#save-task'));await p.waitForFunction(()=>!document.querySelector('#task-modal').open);
      await p.reload();await p.waitForFunction(()=>{try{return store.listItems().find(t=>t.id==='work')?.title==='Saved through assignment details'}catch{return false}});
      await act(p.locator('[data-calendar-view="day"]'));
      if(dark){await p.evaluate(()=>document.documentElement.dataset.theme='dark');await p.waitForTimeout(300);}
      const personal=p.locator('#planner-calendar .calendar-event-block[data-select-task="personal"]');await personal.scrollIntoViewIfNeeded();const personalBackground=await personal.evaluate(e=>getComputedStyle(e).backgroundColor);await act(personal);await idlePreview();result.personalMaterial=await material();assert(result.personalMaterial.background===personalBackground,'Personal yellow fill differs');await dismiss();
      const due=p.locator('#planner-calendar [data-select-task="due"]');await due.scrollIntoViewIfNeeded();const deadlineBackground=await due.evaluate(e=>getComputedStyle(e,'::before').backgroundColor);await act(due);await idlePreview();assert(await p.locator('#calendar-preview-title').textContent()==='Single timed deadline','Single deadline details failed');result.deadlineMaterial=await material();assert(result.deadlineMaterial.background===deadlineBackground,'Deadline window differs from red marker surface');assert(result.deadlineMaterial.metaContrast>=4.5,'Deadline text contrast too low');await p.screenshot({path:evidence+name+'-deadline.png'});await dismiss();
      const group=p.locator('#planner-calendar [data-timed-deadline-group]').first();await group.scrollIntoViewIfNeeded();await act(group);await idlePreview();
      await act(p.locator('#calendar-task-preview [data-deadline-preview-task]').first());await idlePreview();assert(await p.locator('#calendar-preview-edit').count()===1&&!await p.locator('#task-modal').evaluate(e=>e.open),'Grouped deadline skipped details');await dismiss();
      await p.goto(origin+'/?details-qa=tasks#tasks');await p.waitForFunction(()=>document.body.dataset.view==='tasks');
      const title=p.locator('#all-task-list .task-select[data-edit-task="work"]');await act(title);await idlePreview();await dismiss();
      assert(await title.evaluate(e=>document.activeElement===e),'List focus not restored');
      if(!touch){
        await title.focus();await p.keyboard.press('Enter');await idlePreview();
        await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#calendar-task-preview'));
        assert(await title.evaluate(e=>document.activeElement===e),'Keyboard focus not restored');
      }
      assert(await p.evaluate(()=>store.listItems().length===5&&store.listItems().every(t=>!t.completed)),'Opening details changed tasks');
      assert(!result.errors.length,'Browser errors');result.status='PASS';result.checks={blockDetailsThenEdit:true,saveReload:true,singleDeadline:true,groupedDeadline:true,listDetailsAndFocus:true};
    } catch(error){result.status='FAIL';result.error=error.message;await p.screenshot({path:evidence+name+'-failure.png'}).catch(()=>{});}
    finally{await c.close();}results.push(result);
  }
  return {runtime:browser.version(),origin,results,physicalDeviceClaims:false};
}
