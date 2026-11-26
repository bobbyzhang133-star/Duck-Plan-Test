async (page) => {
  const browser=page.context().browser(),origin="http://127.0.0.1:8798",out="/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/task-details-card-color-20261126/",cases=[];
  const check=(value,message)=>{if(!value)throw Error(message);};
  for(const [name,width,height,touch,dark]of[["small",320,568,true,false],["phone",390,844,true,false],["landscape",844,390,true,false],["ipad",835,1112,true,false],["desktop",1280,900,false,false],["dark",390,844,true,true]]){
    const c=await browser.newContext({viewport:{width,height},hasTouch:touch,serviceWorkers:"block"}),p=await c.newPage(),r={name,viewport:[width,height],input:touch?"emulated touch":"mouse",mode:"local storage",colors:[],errors:[]};p.setDefaultTimeout(12000);p.on('pageerror',e=>r.errors.push(e.message));
    const act=e=>touch?e.tap():e.click();
    const idle=()=>p.waitForFunction(()=>{const d=document.querySelector('#calendar-task-preview');return d?.open&&!d.dataset.popupMotion;});
    const close=async()=>{await act(p.locator('#calendar-task-preview .close-button'));await p.waitForFunction(()=>!document.querySelector('#calendar-task-preview'));};
    try{
      await c.addInitScript(()=>{
        if(sessionStorage.getItem('card-seed'))return;sessionStorage.setItem('card-seed','1');
        const date=(offset=0)=>{const d=new Date();d.setDate(d.getDate()+offset);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
        localStorage.setItem('duckplan-demo-classes-v1',JSON.stringify([{id:'science',name:'Science',code:'SC',color:'#538fc5'}]));
        const base={classId:'science',type:'assignment',durationMinutes:45,priority:'Medium',notes:'Full assignment instructions with a long title that wraps neatly on a phone.',completed:false,schemaVersion:2};
        localStorage.setItem('duckplan-demo-tasks-v1',JSON.stringify([{...base,id:'neutral',title:'Neutral assignment with a long title that wraps on a small phone',dueDate:date(3)},{...base,id:'due',title:'Due today',dueDate:date()},{...base,id:'overdue',title:'Past due assignment',dueDate:date(-1)},{...base,id:'scheduled',title:'Scheduled assignment',dueDate:date(2),dueTime:'16:00',scheduledStart:date()+'T10:00'},{...base,id:'completed',title:'Completed assignment',dueDate:date(),completed:true}]));
      });
      await p.goto(origin+'/?card-color=1#tasks');await p.waitForFunction(()=>{try{return store.listItems().length===5&&workAlertContextReady}catch{return false}});
      if(dark){await p.evaluate(()=>document.documentElement.dataset.theme='dark');await p.waitForTimeout(300);}
      for(const id of ['neutral','due','overdue','scheduled','completed']){
        if(id==='completed')await act(p.locator('[data-filter="done"]'));
        const button=p.locator(`#all-task-list .task-select[data-edit-task="${id}"]`),source=await button.evaluate(e=>({fill:getComputedStyle(e.closest('.all-task-row')).backgroundColor,tone:e.closest('.all-task-row').dataset.taskTone}));
        await act(button);await idle();const actual=await p.locator('#calendar-task-preview').evaluate(e=>({fill:getComputedStyle(e).backgroundColor,tone:e.dataset.taskTone,kind:e.dataset.assignmentKind}));
        check(actual.fill===source.fill&&actual.tone===source.tone&&actual.kind==='task','Card details color differs for '+id);r.colors.push({id,...actual});
        if(id==='neutral'||id==='overdue')await p.screenshot({path:out+name+'-'+id+'.png'});
        if(id==='scheduled'){
          await act(p.locator('#calendar-preview-complete'));await p.waitForFunction(()=>document.querySelector('#calendar-task-preview').dataset.taskTone==='completed');check(await p.evaluate(()=>store.listItems().find(t=>t.id==='scheduled').completed),'Completion failed');
        }
        await close();check(await p.evaluate(id=>{const source=document.querySelector(`#all-task-list .task-select[data-edit-task="${id}"]`);return document.activeElement===(source||document.querySelector('#open-task-modal'));},id),'Source focus lost');
      }
      await act(p.locator('[data-filter="all"]'));await act(p.locator('#all-task-list .task-select[data-edit-task="neutral"]'));await idle();await act(p.locator('#calendar-preview-edit'));await p.waitForFunction(()=>document.querySelector('#task-modal').open&&!document.querySelector('#task-modal').dataset.popupMotion);await p.locator('#task-form [name="title"]').fill('Edited through matching details');await act(p.locator('#save-task'));await p.waitForFunction(()=>!document.querySelector('#task-modal').open);await p.reload();await p.waitForFunction(()=>{try{return store.listItems().find(t=>t.id==='neutral')?.title==='Edited through matching details'}catch{return false}});
      await p.goto(origin+'/?card-color=calendar#calendar');await p.waitForFunction(()=>{try{return store.listItems().length===5&&workAlertContextReady}catch{return false}});if(dark){await p.evaluate(()=>document.documentElement.dataset.theme='dark');await p.waitForTimeout(300);}
      if(await p.evaluate(()=>phonePlannerQuery.matches))await act(p.locator('#phone-task-summary'));
      const daily=p.locator('#daily-task-panel .task-select[data-edit-task="overdue"]'),dailyFill=await daily.evaluate(e=>getComputedStyle(e.closest('.daily-task-card')).backgroundColor);await act(daily);await idle();check(await p.locator('#calendar-task-preview').evaluate(e=>getComputedStyle(e).backgroundColor)===dailyFill,'Calendar task-column color differs');await close();
      check(!r.errors.length,'Page errors');r.status='PASS';r.editReload=true;r.calendarTaskColumn=true;
    }catch(error){r.status='FAIL';r.error=error.message;}finally{await c.close();}cases.push(r);
  }
  return {runtime:browser.version(),cases};
}
