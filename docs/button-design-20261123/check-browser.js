async page=>{
 const browser=page.context().browser(), results=[];
 const origin="http://127.0.0.1:8042/?demo=completion-20261123-3&v=button-design-20261123";
 const assert=(ok,message)=>{if(!ok)throw Error(message)};
 for(const config of [{width:1440},{width:835,dark:true},{width:390,touch:true},{width:320,touch:true,reduced:true}]){
  const c=await browser.newContext({viewport:{width:config.width,height:900},hasTouch:!!config.touch,isMobile:!!config.touch,colorScheme:config.dark?"dark":"light",reducedMotion:config.reduced?"reduce":"no-preference",serviceWorkers:"block"});
  try{
    const p=await c.newPage(),errors=[], checked=[];
    p.setDefaultTimeout(8000);
    p.on("pageerror",e=>errors.push(e.message));
    await p.goto(origin+"#calendar");
    await p.waitForFunction(()=>typeof store!=="undefined"&&store.listItems().length===8);
    await p.locator("#toast.show").waitFor({state:"hidden"});
    const measure=async(scope)=>p.locator(scope+" [data-button-icon]").evaluateAll(controls=>controls.filter(e=>e.offsetWidth&&e.offsetHeight&&!e.closest('[inert]')).map(e=>{
      const s=getComputedStyle(e), icon=getComputedStyle(e,"::before"), r=e.getBoundingClientRect();
      return { id:e.id, action:e.textContent.trim(), background:s.backgroundColor, radius:s.borderRadius,
        icon:icon.maskImage.startsWith("url("), size:[r.width,r.height], enabled:!e.disabled,
        overflow:e.scrollWidth>e.clientWidth+1 };
    }));
    async function checkContent(scope,label){
      await p.waitForFunction(scope=>[...document.querySelectorAll(scope+" [data-button-icon]")].some(e=>e.offsetWidth&&e.offsetHeight&&!e.closest("[inert]")),scope);
      const controls=await measure(scope);
      assert(controls.length&&controls.every(e=>e.icon&&!e.overflow),"Buttons were clipped or missing a glyph "+JSON.stringify({config,label,controls}));
      checked.push({label,controls});
    }
    const closeTasks=p.locator(".task-panel-close-button");
    if(config.touch&&await closeTasks.isVisible()) await closeTasks.tap();
    await checkContent("#view-calendar","Calendar controls");
    if(config.width===1440) await p.screenshot({path:"/tmp/duckplan-button-calendar-1440.png"});
    const switchDay=p.locator('[data-calendar-view="day"]');
    await switchDay.click();
    await p.locator("#calendar-today").click();
    const event=p.locator('[data-calendar-drag-task="completion-20261123-3-2"]');
    await event.scrollIntoViewIfNeeded();
    await event.click();
    const dialog=p.locator("#task-modal");
    await dialog.waitFor({state:"visible"});
    await p.waitForFunction(()=>!document.querySelector("#task-modal").dataset.popupMotion);
    assert(await dialog.locator('[name="title"]').inputValue()==="Sample: Review physics notes","Edit action opened a different task");
    await checkContent("#task-modal","Edit dialog actions");
    if(config.width===320) {
      const rows=await dialog.locator(".modal-actions button:not([hidden])").evaluateAll(buttons=>buttons.map(b=>Math.round(b.getBoundingClientRect().top)));
      assert(new Set(rows).size===1,"The 320px edit footer wraps its actions");
    }
    if(config.width===320||config.width===1440) await dialog.screenshot({path:"/tmp/duckplan-button-editor-"+config.width+".png"});
    await dialog.locator("#cancel-task").click();
    await dialog.waitFor({state:"hidden"});
    const add=config.touch?p.locator("#phone-add-task"):p.locator("#plan-selected-date");
    await add.click();
    await p.waitForFunction(()=>document.querySelector("#task-modal").open&&!document.querySelector("#task-modal").dataset.popupMotion);
    await checkContent("#task-modal","Add task dialog actions");
    if(config.width===1440) {
      await dialog.locator('[name="title"]').fill("Browser QA button test");
      await dialog.locator("#save-task").click();
      await dialog.waitFor({state:"hidden"});
      await p.reload();
      await p.waitForFunction(()=>store.listItems().some(t=>t.title==="Browser QA button test"));
    } else {
      await dialog.locator("#cancel-task").click();
      await dialog.waitFor({state:"hidden"});
    }
    const nav=config.touch?".phone-bottom-nav":"#planner-sidebar";
    await p.locator(nav+' button[data-view="tasks"]').click();
    await p.locator('[data-task-layout="matrix"]').click();
    await checkContent("#view-tasks","Priority matrix");
    await p.locator('[data-task-layout="list"]').click();
    await checkContent("#view-tasks","Tasks list");
    if(config.touch) {
      await p.locator("#phone-more-button").tap();
      await p.locator('#phone-more-dialog button[data-view="settings"]').tap();
    } else await p.locator('#planner-sidebar button[data-view="settings"]').click();
    await checkContent("#view-settings","Settings actions");
    if(config.width===835) { await p.waitForTimeout(700); await p.screenshot({path:"/tmp/duckplan-button-settings-835.png"}); }
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"Page exceeds viewport width");
    assert(!errors.length,errors.join("; "));
    results.push({config,status:"PASS",checked,errors});
  } finally { await c.close(); }
 }
 return {runtime:browser.version(),results};
}
