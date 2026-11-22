async page => {
  const browser = page.context().browser(), results = [];
  for (const config of [
    { view: "calendar", width: 1156 }, { view: "calendar", width: 835 }, { view: "calendar", width: 390 },
    { view: "tasks", width: 390 }, { view: "tasks", width: 320, today: true },
    { view: "home", width: 1156 }, { view: "matrix", width: 835 },
    { view: "calendar", width: 390, cloud: true }, { view: "tasks", width: 390, cloud: true }
  ]) {
    const c = await browser.newContext({ viewport: { width: config.width, height: 1000 }, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = [], origin = config.cloud ? "http://127.0.0.1:8798" : "http://127.0.0.1:8042";
      p.on("pageerror", error => errors.push(error.message));
      if (config.cloud) {
        const auth = await c.request.post(origin+"/api/auth/sign-up", { headers: { Origin: origin }, data: { email: `archive-${Date.now()}@example.test`, password: "Synthetic completed archive fixture" } });
        if (!auth.ok()) throw Error("Fixture signup failed");
        await p.route(origin+"/**", async route => {
          const url = new URL(route.request().url());
          if (url.pathname.startsWith("/api/") || url.pathname==="/cloud-config.js") return route.continue();
          return route.fulfill({ response: await c.request.get("http://127.0.0.1:8042"+url.pathname+url.search) });
        });
      }
      await p.goto(origin+"/#"+(config.view==="matrix"?"tasks":config.view));
      await p.waitForFunction(cloud=>typeof store!=="undefined" && (cloud?store.mode==="cloud":store.listItems().length), Boolean(config.cloud));
      const ids = await p.evaluate(async cloud => {
        const date=Model.todayKey(), ids=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
        const fixtures=ids.map((id,i)=>({id,title:["Finish one practice task","Continue with the next task","Previously completed task"][i],dueDate:date,dueTime:"17:00",scheduledStart:date+"T0"+(9-i)+":00",durationMinutes:45,priority:"High",completed:i===2,schemaVersion:2}));
        if(cloud) for(const task of fixtures) await store.upsertItem(task);
        else localStorage.setItem("duckplan-demo-tasks-v1",JSON.stringify(fixtures));
        return ids;
      },Boolean(config.cloud));
      if(!config.cloud) await p.reload();
      if(config.today) await p.locator('[data-filter="today"]').click();
      const ensureMatrixOpen=async()=>{
        if(config.view!=="matrix")return;
        const group=p.locator(".matrix-unclassified");
        if(!(await group.evaluate(e=>e.open))) await group.locator("summary").first().click();
      };
      if(config.view==="matrix") {await p.locator('[data-task-layout="matrix"]').click();await ensureMatrixOpen();}
      if(config.view==="calendar"&&config.width===390){await p.locator("#phone-task-summary").click();await p.waitForTimeout(500);}
      const area=config.view==="calendar"?"#daily-task-panel":config.view==="home"?"#view-home":"#view-tasks";
      if(config.view==="calendar") {
        if(await p.locator('[data-collapse="completed"]').getAttribute("aria-expanded")!=="false") throw Error("Completed should start collapsed");
        await p.locator('[data-collapse="completed"]').click();
      }
      if(config.view==="home") await p.locator(".dashboard-completed > summary").click();
      if(config.cloud) await p.route("**/api/items/*",async route=>{if(route.request().method()==="PATCH")await new Promise(r=>setTimeout(r,650));return route.continue();});
      await p.locator(area+' input[data-task-id="'+ids[0]+'"]:visible:not(:checked)').click();
      await p.waitForTimeout(160);
      const during=await p.evaluate(()=>({echo:Boolean(document.querySelector(".task-completion-echo")),held:Boolean(document.querySelector(".completion-exit-source")),scale:document.querySelector(".task-completion-echo")?new DOMMatrix(getComputedStyle(document.querySelector(".task-completion-echo")).transform).a:0}));
      if(!during.echo||!during.held||during.scale<1.02)throw Error("Keep the stronger pop and outgoing space until it finishes");
      await p.waitForTimeout(2300);
      const after=await p.evaluate(({id,area})=>({completed:store.listItems().find(t=>t.id===id).completed,visible:[...document.querySelectorAll(area+' input[data-task-id="'+id+'"]')].filter(e=>e.checkVisibility()).length,folded:document.querySelector('[data-collapse="completed"]').getAttribute("aria-expanded")==="false",dashboardFolded:!document.querySelector(".dashboard-completed").open,artifacts:document.querySelectorAll(".task-completion-echo,.completion-exit-source,.completion-duck-reaction").length}),{id:ids[0],area});
      if(!after.completed||after.visible||after.artifacts||!after.folded||!after.dashboardFolded)throw Error("Completed task reappeared after one click: "+JSON.stringify(after));
      await p.screenshot({path:`/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/section-fade-20261122/after-${config.view}-${config.width}${config.cloud?"-cloud":""}.png`});
      if(config.view==="calendar") await p.locator('[data-collapse="completed"]').click();
      else if(config.view==="home") await p.locator(".dashboard-completed > summary").click();
      else {await p.locator('[data-filter="done"]').click();await ensureMatrixOpen();}
      const archived=p.locator(area+' input[data-task-id="'+ids[0]+'"]:visible:checked');
      if(await archived.count()!==1)throw Error("Finished task is not accessible in Completed/Done");
      await archived.click();
      await p.waitForFunction(id=>store.listItems().find(t=>t.id===id)?.completed===false,ids[0]);
      if(config.view==="tasks"||config.view==="matrix"){await p.locator('[data-filter="all"]').click();await ensureMatrixOpen();}
      const reopened=p.locator(area+' input[data-task-id="'+ids[0]+'"]:visible:not(:checked)');
      if(await reopened.count()!==1)throw Error("Reopened task did not return to active list");
      // Verify both the reopened item and the untouched completed item persist.
      await p.waitForTimeout(config.cloud?800:50);
      await p.reload();
      await p.waitForFunction(ids=>store.listItems().find(t=>t.id===ids[0])?.completed===false&&store.listItems().find(t=>t.id===ids[2])?.completed===true,ids);
      if(errors.length)throw Error(errors.join("; "));
      results.push({config,during,after,archiveAccessible:true,reopenedAndReloaded:true});
    } catch(error) {return {runtime:browser.version(),results,failedConfig:config,error:error.message};}
    finally {await c.close();}
  }
  return {runtime:browser.version(),results};
}
