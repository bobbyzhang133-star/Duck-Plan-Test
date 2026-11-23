async page => {
  const browser = page.context().browser(), results = [];
  const demo = "completion-20261123-3", id = demo+"-2";
  const assert=(ok,message)=>{ if (!ok) throw Error(message); };
  for (const config of [{width:1440},{width:390,phone:true},{width:1280,reduced:true}]) {
    const c=await browser.newContext({
      viewport:{width:config.width,height:950},isMobile:!!config.phone,hasTouch:!!config.phone,
      reducedMotion:config.reduced?"reduce":"no-preference",timezoneId:"America/Los_Angeles",serviceWorkers:"block"
    });
    try {
      const p=await c.newPage(),errors=[];
      p.setDefaultTimeout(8000);
      p.on("pageerror",e=>errors.push(e.message));
      await p.goto("http://127.0.0.1:8042/?demo="+demo+"#calendar");
      const closeTasks=p.locator("button.task-panel-close-button");
      if(await closeTasks.isVisible()) await closeTasks.tap();
      await p.locator('[data-calendar-view="day"]').click();
      const bar=p.locator('[data-calendar-drag-task="'+id+'"]'), editor=p.locator("#task-modal");
      await bar.scrollIntoViewIfNeeded();
      const source=await bar.boundingBox();
      if(config.phone) await bar.tap(); else await bar.click();
      const openState=await editor.evaluate(e=>{
        const form=e.querySelector("form"), bounds=form.getBoundingClientRect();
        const style=getComputedStyle(form);
        const shell=e.getAnimations().find(a=>a.effect.target===e);
        return {open:e.open,width:bounds.width,height:bounds.height,paint:style.backgroundColor,fieldsAvailable:!form.inert,
          title:form.elements.title.value,workStart:form.elements.scheduledTime.value,
          prefillDueDate:form.elements.dueDate.value,preview:!!document.querySelector(".calendar-task-preview[open]"),
          morph:!!e.querySelector(".popup-morph-label"),
          motion:e.dataset.popupMotion||null, keyframes:shell?.effect.getKeyframes().map(f=>[f.opacity,f.transform])};
      });
      assert(openState.open && openState.fieldsAvailable && !openState.preview && !openState.morph && openState.paint!=="rgba(0, 0, 0, 0)" &&
        openState.title==="Sample: Review physics notes" && openState.workStart==="10:00",JSON.stringify({config,openState}));
      if(config.width===1440) {
        assert(source.width>800 && openState.width<source.width && openState.height<=520,"Did not exercise full-width bar with compact editor");
        assert(openState.keyframes?.length && openState.keyframes.every(f=>!f[1]?.includes("scale(")||f[1].includes("scale(1, 1)")),"Day bar morphed");
        await editor.screenshot({path:"/tmp/duckplan-day-edit-1440.png"});
      }
      if(config.reduced) assert(!openState.motion,"Reduced motion must open without staging");
      await p.keyboard.press("Escape");
      if(!config.reduced) {
        const closing=await editor.evaluate(e=>e.dataset.popupMotion==="closing"&&e.open&&e.inert);
        assert(closing,"Editor closed before the exit animation");
      }
      await editor.waitFor({state:"hidden"});
      await p.waitForFunction(id=>document.activeElement?.dataset?.calendarDragTask===id,id);
      if(!config.phone) {
        await bar.focus();
        await p.keyboard.press("Enter");
        await editor.waitFor({state:"visible"});
        await p.waitForFunction(()=>document.activeElement?.name==="title");
        await editor.locator('input[name="title"]').fill("Verified edited work block");
        await editor.locator("#save-task").click();
        await editor.waitFor({state:"hidden"});
        await p.reload();
        await p.waitForFunction(({id,due})=>{ const t=store.listItems().find(t=>t.id===id); return t?.title==="Verified edited work block" && t.scheduledStart.endsWith("T10:00") && t.dueDate===due; },{id,due:openState.prefillDueDate});
        await p.locator('[data-calendar-view="week"]').click();
        await bar.scrollIntoViewIfNeeded(); await bar.click();
        const preview=p.locator(".calendar-task-preview");
        await preview.waitFor({state:"visible"});
        assert(!(await editor.evaluate(e=>e.open)),"Week work skipped the preview");
        await p.keyboard.press("Escape");
        await preview.waitFor({state:"detached"});
      }
      assert(!errors.length,errors.join("; "));
      results.push({config,status:"PASS",barWidth:source.width,openState,escapeFocusRestored:true,
        savedAndReloaded:!config.phone,weekPreview:!config.phone,errors});
    } finally { await c.close(); }
  }
  return {runtime:browser.version(),mode:"local demo",results};
}
