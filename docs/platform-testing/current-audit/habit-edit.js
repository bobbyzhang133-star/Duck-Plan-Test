// Small signed-in UI continuation of browser-functional.js: edit the habit schedule itself.
async(page)=>{
  const origin="http://127.0.0.1:8794", c=await page.context().browser().newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,timezoneId:"America/Los_Angeles",reducedMotion:"reduce",serviceWorkers:"block"});
  const p=await c.newPage();p.setDefaultTimeout(5000);p.setDefaultNavigationTimeout(10000);const errors=[];p.on("pageerror",e=>errors.push(e.message));
  await c.route("**/*",r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  try{
    const r=await c.request.post(origin+"/api/auth/sign-up",{headers:{Origin:origin},data:{email:`habit-edit-${Date.now()}@example.test`,password:`Fixture-${Date.now()}-${Math.random()}`},timeout:10000});if(r.status()!==201)throw new Error("Local signup failed");
    await p.goto(origin+"/?qa=habit-edit#goals");await p.waitForFunction(()=>store.mode==="cloud"&&store.supportsPersonal,null,{timeout:5000});
    await p.locator("#open-task-modal").tap();await p.locator('[data-pg-choice="habit"]').tap();let d=p.locator("#personal-goals-dialog");
    await d.locator('[name="title"]').fill("Habit edit fixture");await d.getByRole("button",{name:"Save habit",exact:true}).tap();await d.waitFor({state:"detached"});
    const id=await p.evaluate(()=>store.listHabits()[0].id);await p.locator(`[data-pg-action="edit-habit"][data-pg-id="${id}"]`).tap();d=p.locator("#personal-goals-dialog");
    await d.locator('[name="notes"]').fill("Edited habit schedule and notes");for(const input of await d.locator('[name="repeatDays"]').all())await input.setChecked(["1","3","5"].includes(await input.getAttribute("value")));
    await d.getByRole("button",{name:"Save habit",exact:true}).tap();await d.waitFor({state:"detached"});await p.reload();
    await p.waitForFunction(id=>JSON.stringify(store.listHabits().find(x=>x.id===id)?.repeatDays)==="[1,3,5]"&&store.listHabits().find(x=>x.id===id)?.notes==="Edited habit schedule and notes",id,{timeout:5000});
    if(errors.length)throw new Error(errors.join("; "));
    return {passed:true,runtime:await page.context().browser().version(),mode:"local signed-in current Worker8794",touchEmulated:true,viewport:[390,844],habitEditScheduleAndNotesReload:true,repeatDays:[1,3,5],pageErrors:errors,syntheticContextClosed:true,productionWrites:false};
  }finally{await c.close();}
}
