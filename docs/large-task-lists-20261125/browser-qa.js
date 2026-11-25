// Isolated synthetic browser data only. No public account mutation.
async(page)=>{
  const browser=page.context().browser(),cases=[],origin="http://127.0.0.1:8798",evidence="/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/large-task-lists-20261125/";
  const assert=(v,m)=>{if(!v)throw Error(m);};
  for(const [name,width,height,touch] of [["small",320,568,true],["phone",390,844,true],["landscape",844,390,true],["ipad",835,1112,true],["desktop",1280,900,false]]){
    const c=await browser.newContext({viewport:{width,height},hasTouch:touch,serviceWorkers:"block",reducedMotion:"no-preference"}),p=await c.newPage(),r={name,viewport:[width,height],touchEmulated:touch,errors:[]};p.on("pageerror",e=>r.errors.push(e.message));p.setDefaultTimeout(15000);
    const act=async locator=>touch?locator.tap():locator.click();
    const wait=(fn,arg)=>p.waitForFunction(fn,arg,{timeout:15000});
    const nav=async view=>{
      if(await p.evaluate(()=>document.body.classList.contains('task-panel-open'))){await act(p.locator('.task-panel-close-button'));await p.waitForTimeout(420);}
      const direct=p.locator(`.phone-bottom-nav [data-view="${view}"]`);
      if(await direct.isVisible())await act(direct);else await act(p.locator(`#planner-sidebar [data-view="${view}"]`));
      await wait(view=>document.body.dataset.view===view,view);await p.waitForTimeout(420);
    };
    try{
      await p.addInitScript(()=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');const rows=Array.from({length:9119},(_,i)=>({id:'large-'+i,title:'Overdue task '+String(i).padStart(5,'0'),dueDate:'2026-01-01',dueTime:'12:00',priority:'Medium',classId:null,type:'task',durationMinutes:45,notes:'Preserve these notes',completed:false,schemaVersion:2}));rows.push({...rows[0],id:'future',title:'Keep this future task open',dueDate:'2027-12-01'});localStorage.setItem('duckplan-demo-tasks-v1',JSON.stringify(rows));});
      await p.goto(origin+'/#calendar',{timeout:60000});await wait(()=>{try{return store.listItems().length===9120&&workAlertContextReady}catch{return false}});
      const phone=await p.evaluate(()=>phonePlannerQuery.matches);if(phone){await act(p.locator('#phone-task-summary'));await p.waitForTimeout(450);}
      const initial=await p.evaluate(()=>({nodes:document.querySelectorAll('*').length,cards:document.querySelectorAll('#overdue-task-list .daily-task-card').length,total:document.querySelector('#overdue-count').textContent,range:document.querySelector('#overdue-task-list .task-page-range').textContent}));
      assert(initial.nodes<10000&&initial.cards===40&&initial.total==='9119','Initial list not bounded or total incorrect');r.initial=initial;
      await p.screenshot({path:evidence+name+'-calendar.png'});
      const first=await p.locator('#overdue-task-list input[data-task-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.taskId));
      let next=p.locator('#overdue-task-list [data-task-page-position="top"] [data-task-page-direction="1"]');await act(next);
      await wait(()=>document.querySelector('#overdue-task-list .task-page-range').textContent.startsWith('41'));
      const second=await p.locator('#overdue-task-list input[data-task-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.taskId));
      assert(second.length===40&&!second.some(id=>first.includes(id)),'Calendar page repeats/drops rows');
      await act(p.locator('#overdue-task-list [data-task-page-position="top"] [data-task-page-direction="-1"]'));
      assert(JSON.stringify(await p.locator('#overdue-task-list input[data-task-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.taskId)))===JSON.stringify(first),'Previous page failed');
      await act(p.locator('#overdue-section [data-collapse]'));await p.waitForTimeout(450);assert(!await p.locator('#overdue-task-list').isVisible(),'Overdue collapse failed');
      await act(p.locator('#overdue-section [data-collapse]'));await p.waitForTimeout(450);assert(await p.locator('#overdue-task-list').isVisible(),'Overdue expansion failed');
      r.calendarPagingAndOpenClose=true;
      await nav('tasks');assert(await p.locator('#all-task-list .all-task-row').count()===40,'Tasks list not bounded');
      await act(p.locator('#task-pages-top [data-task-page-direction="1"]'));await wait(()=>document.querySelector('#task-pages-top .task-page-range').textContent.startsWith('41'));
      await p.locator('#global-search').fill('09118');await wait(()=>document.querySelectorAll('#all-task-list .all-task-row').length===1);
      const edit=p.locator('#all-task-list [data-edit-task="large-9118"]').first();await act(edit);await wait(()=>document.querySelector('#task-modal').open);await p.waitForTimeout(450);
      await p.locator('#task-form [name="title"]').fill('Edited task outside the first page');await act(p.locator('#save-task'));await wait(()=>!document.querySelector('#task-modal').open);assert(await p.evaluate(()=>store.listItems().find(t=>t.id==='large-9118').title==='Edited task outside the first page'),'Off-page edit failed');
      await p.locator('#global-search').fill('');await wait(()=>document.querySelectorAll('#all-task-list .all-task-row').length===40);
      await act(p.locator('[data-task-layout="matrix"]'));await wait(()=>!document.querySelector('#task-matrix-root').hidden);
      assert(await p.locator('#task-matrix-root .matrix-task-card').count()<=40,'Matrix rendered entire collection');assert((await p.locator('.matrix-summary').textContent()).includes('9120'),'Matrix totals lost hidden pages');
      await p.screenshot({path:evidence+name+'-matrix.png'});await act(p.locator('[data-task-layout="list"]'));
      assert(await p.evaluate(()=>store.listItems().length===9120),'Paging mutated stored data');r.searchEditAndMatrix=true;
      // Complete all must include tasks on every page, not only the visible40.
      await act(p.locator('#view-tasks [data-complete-overdue]'));await wait(()=>overdueCompletion===null&&store.listItems().filter(t=>t.completed).length===9119);await p.waitForTimeout(500);
      assert(await p.evaluate(()=>!store.listItems().find(t=>t.id==='future').completed&&store.listItems().every(t=>t.notes==='Preserve these notes')),'Bulk scope or notes changed');
      await act(p.locator('[data-filter="done"]'));await wait(()=>document.querySelectorAll('#all-task-list .all-task-row').length===40);
      await act(p.locator('#task-pages-top [data-task-page-direction="1"]'));assert(await p.locator('#all-task-list .all-task-row').count()===40,'Done pages not bounded');
      const reopen=p.locator('#all-task-list input[data-task-id]').first();const reopened=await reopen.getAttribute('data-task-id');await act(reopen);await wait(id=>!store.listItems().find(t=>t.id===id).completed,reopened);await p.waitForTimeout(1000);
      await p.reload();await wait(()=>{try{return store.listItems().filter(t=>t.completed).length===9118}catch{return false}});
      r.bulkAcrossAllPagesAndReload=true;
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.querySelectorAll('*').length<10000),'Overflow or DOM grew after actions');assert(!r.errors.length,r.errors.join('; '));r.passed=true;
    }catch(error){r.passed=false;r.error=error.message;await p.screenshot({path:evidence+name+'-failure.png'}).catch(()=>{});}
    finally{await c.close();}cases.push(r);
  }
  return{runtime:browser.version(),origin,cases,passed:cases.every(c=>c.passed),physicalDeviceClaims:false};
}
