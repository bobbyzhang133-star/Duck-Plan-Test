async page => {
  const browser = page.context().browser(), results = [], demo = "completion-20261123-3";
  const assert = (condition,message) => { if (!condition) throw Error(message); };
  for (const config of [{width:1440},{width:390,phone:true},{width:835,reduced:true}]) {
    const context = await browser.newContext({
      viewport:{width:config.width,height:950}, timezoneId:"America/Los_Angeles",
      isMobile:!!config.phone,hasTouch:!!config.phone,reducedMotion:config.reduced?"reduce":"no-preference",serviceWorkers:"block"
    });
    try {
      const p=await context.newPage(), actions=[], errors=[];
      p.setDefaultTimeout(7000);
      p.on("pageerror",error=>errors.push(error.message));
      await p.goto("http://127.0.0.1:8042/?demo="+demo+"#calendar");
      await p.waitForFunction(()=>typeof store!=="undefined"&&store.listItems().length===8);
      const fixture=await p.evaluate(async demo=>{
        const date=nowKey(), monthDate=Model.addDays(date,2);
        const single=store.listItems().find(t=>t.id===demo+"-2"), monthly=store.listItems().find(t=>t.id===demo+"-1");
        await store.upsertItem({...single,dueTime:"15:00"});
        await store.upsertItem({...monthly,dueDate:monthDate,dueTime:"17:00",scheduledStart:monthDate+"T09:30",scheduledEnd:monthDate+"T10:15"});
        return {date,monthDate,single:single.id,monthly:monthly.id};
      },demo);
      const closeTasks=p.locator(".task-panel-close-button");
      if(config.phone && await closeTasks.isVisible()) await closeTasks.tap();
      const editor=p.locator("#task-modal"), preview=p.locator("#calendar-task-preview");
      const activate=async (control,keyboard=false)=>{
        if(keyboard) { await control.focus(); await p.keyboard.press("Enter"); }
        else if(config.phone) await control.tap();
        else await control.click();
      };
      async function checkEditor(id) {
        const expected=await p.evaluate(id=>{
          const t=store.listItems().find(t=>t.id===id);
          return [t.title,t.dueDate,t.dueTime,Model.scheduledParts(t)?.time||""];
        },id);
        await editor.waitFor({state:"visible"});
        const actual=await editor.evaluate(dialog=>{
          const form=dialog.querySelector("form");
          return { values:["title","dueDate","dueTime","scheduledTime"].map(k=>form.elements[k].value),
            direct:dialog.open && !form.inert && !document.querySelector("#calendar-task-preview") &&
              !dialog.querySelector(".popup-morph-source") && dialog.querySelector("#modal-title").textContent==="Edit task" };
        });
        assert(actual.direct && JSON.stringify(actual.values)===JSON.stringify(expected),
          JSON.stringify({actual,expected,id}));
      }
      async function verify(control,id,label,keyboard=false) {
        await control.scrollIntoViewIfNeeded();
        await activate(control,keyboard);
        await checkEditor(id);
        await p.keyboard.press("Escape");
        await editor.waitFor({state:"hidden"});
        assert(await control.evaluate(e=>e===document.activeElement),"Focus did not return to "+label);
        actions.push(label);
      }
      for (const view of ["day","week"]) {
        await p.locator('[data-calendar-view="'+view+'"]').click();
        await verify(p.locator('.calendar-event-block[data-select-task="'+fixture.single+'"]'),fixture.single,view+" work");
        const due=p.locator('.timed-deadline-marker[data-select-task="'+fixture.single+'"]');
        await verify(due,fixture.single,view+" deadline",view==="week"&&!config.phone);
      }
      if (!config.phone && !config.reduced) {
        const group=p.locator('.timed-deadline-group-trigger[data-deadline-date="'+fixture.date+'"]');
        await group.click();
        const row=preview.locator("[data-deadline-preview-task]").first();
        const id=await row.getAttribute("data-deadline-preview-task");
        await row.click();
        await checkEditor(id);
        await p.keyboard.press("Escape");
        await editor.waitFor({state:"hidden"});
        assert(await group.evaluate(e=>e===document.activeElement),"Group trigger did not recover focus");
        actions.push("Grouped deadline choice to editor");
        const count=p.locator('[data-day-list="work"][data-summary-date="'+fixture.date+'"]').filter({visible:true}).first();
        await count.click();
        assert(await preview.locator("[data-deadline-preview-task]").count()>0,"Calendar count no longer opens its list");
        await p.keyboard.press("Escape");await preview.waitFor({state:"detached"});
        actions.push("Day Work count opens its list");
      }
      await p.locator('[data-calendar-view="month"]').click();
      if(config.phone) await p.locator('.month-date-button[data-date="'+fixture.monthDate+'"]').tap();
      const entry=config.phone?".calendar-agenda-item":".month-entry";
      for(const kind of ["work","deadline"]) {
        const control=p.locator(entry+'[data-calendar-kind="'+kind+'"][data-select-task="'+fixture.monthly+'"]');
        await verify(control,fixture.monthly,"Month "+kind+(config.phone?" agenda":""),!config.phone && kind==="work");
      }
      if(config.width===1440) {
        const target=p.locator('.month-entry[data-calendar-kind="deadline"][data-select-task="'+fixture.monthly+'"]');
        await target.click();
        await checkEditor(fixture.monthly);
        await editor.locator('[name="title"]').fill("Edited from the Month deadline");
        await editor.locator("#save-task").click();
        await editor.waitFor({state:"hidden"});
        await p.reload();
        await p.waitForFunction(({id,date})=>{
          const task=store.listItems().find(t=>t.id===id);
          return task?.title==="Edited from the Month deadline" && task.dueDate===date && task.dueTime==="17:00" && task.scheduledStart===date+"T09:30";
        },{id:fixture.monthly,date:fixture.monthDate});
        actions.push("Month editor save persists after reload");
      }
      assert(!errors.length,errors.join("; "));
      results.push({config,status:"PASS",actions,errors});
    } finally { await context.close(); }
  }
  return {runtime:browser.version(),mode:"isolated local demo",results};
}
