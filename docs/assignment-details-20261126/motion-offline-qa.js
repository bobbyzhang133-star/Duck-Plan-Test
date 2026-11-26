async (page) => {
  const browser=page.context().browser(),origin="http://127.0.0.1:8798",results=[];
  const out="/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/assignment-details-20261126/";
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  for(const offline of [false,true]){
    const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:"no-preference",serviceWorkers:offline?"allow":"block"}),p=await c.newPage();
    const result={mode:offline?"offline browser tab":"rendered motion",input:"emulated touchscreen",frames:[]};
    p.setDefaultTimeout(10000);
    try{
      await c.addInitScript(()=>{
        if(sessionStorage.getItem('tint-seeded'))return;sessionStorage.setItem('tint-seeded','1');
        const d=new Date(),date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
        localStorage.setItem('duckplan-demo-classes-v1',JSON.stringify([{id:'green',name:'Green class',code:'GC',color:'#3e946d'}]));
        const row={classId:'green',type:'assignment',durationMinutes:45,priority:'Medium',notes:'Assignment instructions',dueDate:date,dueTime:'14:00',completed:false,schemaVersion:2};
        localStorage.setItem('duckplan-demo-tasks-v1',JSON.stringify([{...row,id:'work',title:'Green work assignment',dueTime:'16:00',scheduledStart:date+'T10:00'},{...row,id:'deadline',title:'Single deadline',scheduledStart:null}]));
      });
      await p.goto(origin+'/?tint-evidence=1#calendar');await p.waitForFunction(()=>{try{return store.listItems().length===2&&workAlertContextReady}catch{return false}});
      if(offline){await p.evaluate(async()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);result.caches=await p.evaluate(()=>caches.keys());await c.setOffline(true);await p.reload();await p.waitForFunction(()=>{try{return store.listItems().length===2}catch{return false}});result.reload=true;}
      await p.locator('[data-calendar-view="day"]').tap();
      for(const [id,kind]of[['work','work'],['deadline','deadline']]){
        const source=p.locator(`#planner-calendar [data-select-task="${id}"]`).first();
        const background=await source.evaluate((e,kind)=>getComputedStyle(e,kind==='deadline'?'::before':null).backgroundColor,kind);
        await source.tap();
        if(!offline){
          await p.waitForTimeout(80);const opening=await p.locator('#calendar-task-preview').evaluate(d=>({state:d.dataset.popupMotion,paint:d.querySelector('.popup-morph-surface>div>div')?.style.backgroundColor}));
          assert(opening.state==='opening'&&opening.paint===background,'Opening surface tint changed');result.frames.push({kind,opening});await p.screenshot({path:out+kind+'-opening.png'});
        }
        await p.waitForFunction(()=>{const d=document.querySelector('#calendar-task-preview');return d?.open&&!d.dataset.popupMotion});
        assert(await p.locator('#calendar-task-preview').evaluate(e=>getComputedStyle(e).backgroundColor)===background,'Final tint mismatch');
        await p.keyboard.press('Escape');
        if(!offline){await p.waitForTimeout(80);const closing=await p.locator('#calendar-task-preview').evaluate(d=>({state:d.dataset.popupMotion,inert:d.inert,paint:d.querySelector('.popup-morph-surface>div>div')?.style.backgroundColor}));assert(closing.state==='closing'&&closing.inert&&closing.paint===background,'Closing surface tint changed');result.frames.push({kind,closing});await p.screenshot({path:out+kind+'-closing.png'});}
        await p.waitForFunction(()=>!document.querySelector('#calendar-task-preview'));
        assert(await source.evaluate(e=>document.activeElement===e),'Dismissal lost source focus');
      }
      result.status='PASS';result.taskCount=await p.evaluate(()=>store.listItems().length);result.standalonePWA=false;
    }catch(error){result.status='FAIL';result.error=error.message;}finally{await c.close();}results.push(result);
  }
  return {runtime:browser.version(),results};
}
