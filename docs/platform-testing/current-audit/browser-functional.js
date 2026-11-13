// Manual Playwright MCP runner. Local disposable Worker accounts only; never use production.
// Uses current Worker8794 and old-schema/old-code Worker8793, both owned by the native QA agent.
async (page) => {
  const origin = "http://127.0.0.1:8794", oldOrigin = "http://127.0.0.1:8793";
  const evidence = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/platform-testing/current-audit/";
  const browser = page.context().browser(), contexts = [], clients = [], cases = [];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const account = { email: `platform-browser-${Date.now()}@example.test`, password: `Fixture-${Date.now()}-${Math.random()}` };
  const allowed = new Set([origin, oldOrigin]);
  let cookies = [], compatibility;
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 5000 });
  const counts = p => p.evaluate(() => ({ tasks: store.listItems().length, templates: store.listTemplates().length, resources: store.listResources().length, goals: store.listGoals().length, habits: store.listHabits().length, notes: store.listNotes().length }));
  async function setup(config) {
    const c = await browser.newContext({ viewport: { width: config.width, height: config.height }, hasTouch: Boolean(config.touch), isMobile: config.name === "phone", timezoneId: "America/Los_Angeles", reducedMotion: "reduce", serviceWorkers: "block" });
    contexts.push(c); if (cookies.length) await c.addCookies(cookies);
    const p = await c.newPage(); p.setDefaultTimeout(5000); p.setDefaultNavigationTimeout(10000);
    const result = { name: config.name, viewport: [config.width, config.height], touchEmulated: Boolean(config.touch), checks: {}, pageErrors: [], blocked: [], unexpectedResponses: [] };
    p.on("pageerror", e => result.pageErrors.push(e.message));
    p.on("response", r => { if (new URL(r.url()).pathname.startsWith("/api/") && r.status() >= 400 && r.status() !== 503) result.unexpectedResponses.push({ path: new URL(r.url()).pathname, status: r.status() }); });
    await c.route("**/*", route => { if (!allowed.has(new URL(route.request().url()).origin)) { result.blocked.push(new URL(route.request().url()).origin); return route.abort(); } return route.continue(); });
    return { c, p, result };
  }
  async function featureSnapshot(c, target) {
    const response = await c.request.get(target + "/api/planner", { timeout: 10000 });
    const data = await response.json();
    const arrays = ["classes", "items", "templates", "resources", "goals", "habits", "habit_checkins", "notes"];
    const missing = arrays.filter(k => !Array.isArray(data[k]));
    if (!data.organization || typeof data.organization !== "object") missing.push("organization");
    return { origin: target, status: response.status(), compatible: response.ok() && missing.length === 0, missing };
  }
  try {
    // Signup writes only into the dedicated disposable local databases. Never expose credentials.
    const fixture = await setup({ name: "desktop", width: 1280, height: 900 });
    const signed = await fixture.c.request.post(origin + "/api/auth/sign-up", { data: account, headers: { Origin: origin }, timeout: 10000 });
    assert(signed.status() === 201, "Current local fixture signup failed");
    cookies = await fixture.c.cookies();
    const current = await featureSnapshot(fixture.c, origin);
    const old = await browser.newContext({ serviceWorkers: "block" }); contexts.push(old);
    const oldSignup = await old.request.post(oldOrigin + "/api/auth/sign-up", { data: account, headers: { Origin: oldOrigin }, timeout: 10000 });
    assert(oldSignup.status() === 201, "Old local fixture signup failed");
    const legacy = await featureSnapshot(old, oldOrigin); await old.close();
    compatibility = { current, legacy };
    assert(current.compatible && !legacy.compatible && legacy.missing.includes("templates") && legacy.missing.includes("notes"), "Capability gate failed to distinguish current and old Workers");

    for (const config of [{ name: "desktop", width: 1280, height: 900 }, { name: "phone", width: 390, height: 844, touch: true }, { name: "ipad", width: 835, height: 1112, touch: true }]) {
      const { c, p, result } = config.name === "desktop" ? fixture : await setup(config);
      clients.push(p); let stage = "startup";
      const act = locator => config.touch ? locator.tap() : locator.click();
      const nav = async name => {
        if (config.name === "phone") {
          const direct = p.locator(`.phone-bottom-nav [data-view="${name}"]`);
          if (await direct.count()) await act(direct);
          else { await act(p.locator("#phone-more-button")); await act(p.locator(`#phone-more-dialog [data-view="${name}"]`)); }
        } else await act(p.locator(`#planner-sidebar [data-view="${name}"]`));
        await wait(p, name => document.body.dataset.view === name, name);
      };
      const fits = async () => assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${config.name}: horizontal page overflow at ${stage}`);
      const templatePane = async () => {
        await nav("calendar");
        if (config.name === "phone" && !await p.evaluate(() => document.body.classList.contains("task-panel-open"))) await act(p.locator("#phone-task-summary"));
        await act(p.locator("#calendar-templates-tab"));
      };
      const closeSheet = async () => { if (config.name === "phone" && await p.evaluate(() => document.body.classList.contains("task-panel-open"))) await act(p.locator("#calendar-library-toolbar [data-close-task-panel]")); };
      const submitDialog = async (dialog, label) => { await act(dialog.getByRole("button", { name: label, exact: true })); await dialog.waitFor({ state: "detached" }); };
      const prefix = `Audit ${config.name}`;
      try {
        await p.goto(origin + `/?qa=platform-${config.name}#calendar`);
        await wait(p, () => store.mode === "cloud" && store.user && store.supportsOrganization && store.supportsPersonal);
        await fits();
        if (config.name === "phone") assert(await p.locator(".phone-bottom-nav").isVisible() && !await p.evaluate(() => document.body.classList.contains("task-panel-open")), "Phone sheet/nav default failed");
        else assert(await p.evaluate(() => { const a=document.querySelector("#daily-task-panel").getBoundingClientRect(),b=document.querySelector(".calendar-main-panel").getBoundingClientRect();return Math.abs(a.top-b.top)<2 && a.right<=b.left+2; }), "Tablet/desktop task and calendar composition failed");
        result.checks.startupSignedInAndComposition = true;

        stage = "class creation"; await nav("classes"); await act(p.locator("#open-task-modal"));
        let dialog = p.locator('dialog[aria-labelledby="class-editor-heading"]');
        await dialog.locator('[name="name"]').fill(prefix + " Science"); await dialog.locator('[name="code"]').fill("QA");
        await dialog.locator('[name="teacher"]').fill("Fixture teacher"); await dialog.locator('[name="period"]').fill("2");
        await dialog.locator('[name="color"]').fill("#39896f"); await submitDialog(dialog, "Save class");
        await wait(p, title => store.listClasses().some(x=>x.name===title), prefix + " Science");
        const classId = await p.evaluate(title=>store.listClasses().find(x=>x.name===title).id,prefix+" Science");
        stage="resource create/edit/open"; await p.locator("#library-class-select").selectOption(classId); await act(p.locator("#library-tab-resources"));
        await act(p.locator('#library-class-panel [data-library-action="new-resource"]')); dialog=p.locator("#planner-library-dialog");
        await dialog.locator('[name="title"]').fill(prefix+" guide"); await dialog.locator('[name="url"]').fill(origin+"/?qa=resource#home");
        await dialog.locator('[name="description"]').fill("Saved local guide link"); await submitDialog(dialog,"Save resource");
        const resourceId=await p.evaluate(title=>store.listResources().find(x=>x.title===title).id,prefix+" guide");
        await act(p.locator(`[data-library-action="edit-resource"][data-library-id="${resourceId}"]`)); dialog=p.locator("#planner-library-dialog");
        await dialog.locator('[name="description"]').fill("Edited saved local guide"); await submitDialog(dialog,"Save resource");
        const popupPromise=p.waitForEvent("popup",{timeout:5000}); await act(p.getByRole("link",{name:prefix+" guide",exact:false})); const popup=await popupPromise;
        await popup.waitForURL(url=>url.searchParams.get("qa")==="resource",{timeout:5000}); await popup.close();
        result.checks.classCreateAndResourceCreateEditOpen=true;

        stage="template create/edit"; await templatePane(); await act(p.locator('#calendar-assignment-templates [data-library-action="new-template"]'));
        dialog=p.locator("#planner-library-dialog"); await dialog.locator('[name="title"]').fill(prefix+" template");
        await dialog.locator('[name="classId"]').selectOption(classId); await dialog.locator('[name="durationMinutes"]').fill("60");
        await dialog.locator('[name="priority"]').selectOption("High"); await dialog.locator('[name="reminderChoice"]').selectOption("60");
        await dialog.locator('[name="notes"]').fill("Saved original template notes"); await submitDialog(dialog,"Save template");
        const templateId=await p.evaluate(title=>store.listTemplates().find(x=>x.title===title).id,prefix+" template");
        const card=()=>p.locator(`#calendar-assignment-templates [data-library-template="${templateId}"]`).locator("..");
        await act(card().locator('[data-library-action="template-menu"]')); await act(p.locator('#template-management-menu [data-template-menu-action="edit"]'));
        dialog=p.locator("#planner-library-dialog"); await dialog.locator('[name="notes"]').fill("Edited retained template notes"); await submitDialog(dialog,"Save template");
        const template=await p.evaluate(id=>store.listTemplates().find(x=>x.id===id),templateId); const before=await counts(p);
        stage="template Schedule"; await act(card().locator('[data-library-action="schedule-template"]')); await p.locator("#task-modal").waitFor({state:"visible"});
        await p.locator("#task-schedule-options").evaluate(el=>{el.open=true;});
        const date=await p.evaluate(()=>selectedDate);
        await p.locator('#task-form [name="scheduledDate"]').fill(date); await p.locator('#task-form [name="scheduledTime"]').fill("10:00");
        await act(p.locator("#save-task")); await p.locator("#task-modal").waitFor({state:"hidden"});
        await wait(p,n=>store.listItems().length===n+1,before.tasks);
        let copies=await p.evaluate(title=>store.listItems().filter(x=>x.title===title),template.title);
        const scheduled=copies[0];
        for(const key of ["title","classId","durationMinutes","priority","notes","reminderChoice"]) assert(scheduled[key]===template[key],`${config.name}: Schedule changed ${key}`);
        assert(scheduled.scheduledStart===`${date}T10:00`&&!scheduled.dueDate&&!scheduled.dueTime&&scheduled.id!==templateId,"Schedule identity/date/deadline mismatch");
        await closeSheet();
        if(config.name==="desktop") {
          stage="native template drag";await templatePane();const block=card().locator(`[data-library-template="${templateId}"]`),target=p.locator(`[data-slot-date="${date}"][data-slot-time="11:00"]`);
          await target.scrollIntoViewIfNeeded();await block.scrollIntoViewIfNeeded();await block.dragTo(target,{targetPosition:{x:20,y:20}});
          await wait(p,n=>store.listItems().length===n+2,before.tasks);
          copies=await p.evaluate(title=>store.listItems().filter(x=>x.title===title),template.title);
          const dropped=copies.find(x=>x.id!==scheduled.id);for(const key of ["classId","durationMinutes","priority","notes","reminderChoice"])assert(dropped[key]===template[key],`Drop changed ${key}`);
          assert(!await p.locator("#task-modal").evaluate(x=>x.open),"Drop opened editor");result.checks.desktopNativeDrag=true;
        }
        stage="template add unscheduled";await templatePane(); const preAdd=(await counts(p)).tasks;await act(card().locator('[data-library-action="add-template"]'));
        await wait(p,n=>store.listItems().length===n+1,preAdd);copies=await p.evaluate(title=>store.listItems().filter(x=>x.title===title),template.title);
        assert(copies.some(x=>!x.scheduledStart&&!x.dueDate)&&await p.evaluate(id=>store.listTemplates().some(x=>x.id===id),templateId),"Add did not retain independent unscheduled copy/source");
        await fits();await p.screenshot({path:evidence+`templates-${config.name}.png`}); await closeSheet();
        await p.reload();await wait(p,id=>store.listTemplates().some(x=>x.id===id)&&store.listItems().some(x=>x.title===store.listTemplates().find(t=>t.id===id).title),templateId);
        result.checks.templateCreateEditScheduleCopyRetainReload=true;

        stage="core task invalid/failed/create/edit/complete/delete";await nav("tasks");await act(p.locator("#open-task-modal"));
        await act(p.locator("#save-task"));assert(await p.locator("#task-form-error").isVisible(),"Invalid task falsely saved");
        await p.locator('#task-form [name="title"]').fill(prefix+" core task");
        await c.route("**/api/items/*",route=>route.request().method()==="PUT"?route.fulfill({status:503,contentType:"application/json",body:'{"error":"Fixture unavailable"}'}):route.continue(),{times:1});
        await act(p.locator("#save-task"));await wait(p,()=>!document.querySelector("#task-form-error").hidden&&document.querySelector("#task-form-error").textContent.includes("Fixture"));
        assert(!await p.evaluate(title=>store.listItems().some(x=>x.title===title),prefix+" core task"),"Failed request remained saved");
        await act(p.locator("#save-task"));await p.locator("#task-modal").waitFor({state:"hidden"});
        const taskId=await p.evaluate(title=>store.listItems().find(x=>x.title===title).id,prefix+" core task");
        await act(p.locator(`#all-task-list [data-edit-task="${taskId}"]`));await p.locator('#task-form [name="title"]').fill(prefix+" edited task");await act(p.locator("#save-task"));await p.locator("#task-modal").waitFor({state:"hidden"});
        await p.locator(`#all-task-list [data-task-id="${taskId}"]`).check();await wait(p,id=>store.listItems().find(x=>x.id===id)?.completed,taskId);
        await p.locator(`#all-task-list [data-task-id="${taskId}"]`).uncheck();await wait(p,id=>!store.listItems().find(x=>x.id===id)?.completed,taskId);
        await act(p.locator(`#all-task-list [data-edit-task="${taskId}"]`));await act(p.locator("#delete-task"));await wait(p,id=>!store.listItems().some(x=>x.id===id),taskId);
        result.checks.taskCrudInvalidAndFailedSave=true;

        stage="Note CRUD";await nav("notes");const taskCount=(await counts(p)).tasks;await act(p.locator("#open-task-modal"));dialog=p.locator(".personal-note-dialog[open]");
        await dialog.locator('[name="title"]').fill(prefix+" note");await dialog.locator('[name="body"]').fill("First line\n\nRetain exact note writing.");await submitDialog(dialog,"Save note");
        const noteId=await p.evaluate(title=>store.listNotes().find(x=>x.title===title).id,prefix+" note");
        await act(p.locator(`[data-note-card="${noteId}"] [data-note-action="open"]`).first());dialog=p.locator(".personal-note-dialog[open]");await dialog.locator('[name="body"]').fill("Edited note body\nSecond line.");await submitDialog(dialog,"Save note");
        await p.locator('#view-notes input[type="search"]').fill(prefix+" note");assert(await p.locator(".personal-note-card").count()===1,"Note search failed");

        stage="Goal/Habit CRUD";await nav("goals");await act(p.locator("#open-task-modal"));await act(p.locator('[data-pg-choice="goal"]'));dialog=p.locator("#personal-goals-dialog");
        await dialog.locator('[name="title"]').fill(prefix+" goal");await dialog.locator('[name="targetCount"]').fill("3");await dialog.locator('[name="currentCount"]').fill("1");await submitDialog(dialog,"Save goal");
        const goalId=await p.evaluate(title=>store.listGoals().find(x=>x.title===title).id,prefix+" goal");await act(p.locator(`[data-pg-action="edit-goal"][data-pg-id="${goalId}"]`));dialog=p.locator("#personal-goals-dialog");await dialog.locator('[name="currentCount"]').fill("3");await submitDialog(dialog,"Save goal");
        await act(p.locator("#open-task-modal"));await act(p.locator('[data-pg-choice="habit"]'));dialog=p.locator("#personal-goals-dialog");await dialog.locator('[name="title"]').fill(prefix+" habit");await submitDialog(dialog,"Save habit");
        const habitId=await p.evaluate(title=>store.listHabits().find(x=>x.title===title).id,prefix+" habit"),today=await p.evaluate(()=>nowKey());
        const checkin=p.locator(`[data-pg-action="checkin"][data-pg-id="${habitId}"][data-pg-date="${today}"]`);await act(checkin);await wait(p,id=>store.listHabitCheckins({habitId:id}).length===1,habitId);
        await act(checkin);await wait(p,id=>store.listHabitCheckins({habitId:id}).length===0,habitId);await act(checkin);await wait(p,id=>store.listHabitCheckins({habitId:id}).length===1,habitId);
        await p.reload();await wait(p,ids=>store.listGoals().find(x=>x.id===ids.goalId)?.currentCount===3&&store.listHabitCheckins({habitId:ids.habitId}).length===1&&store.listNotes().find(x=>x.id===ids.noteId)?.body==="Edited note body\nSecond line.",{goalId,habitId,noteId});
        assert((await counts(p)).tasks===taskCount,"Personal feature created an unintended task");await fits();await p.screenshot({path:evidence+`personal-${config.name}.png`});
        result.checks.noteGoalEditHabitCheckinReloadCorrectTypes=true;
        if(config.name!=="desktop") {await wait(clients[0],id=>store.listNotes().some(x=>x.id===id),noteId);result.checks.liveDesktopPeerReceivedNote=true;}

        stage="delete personal/resource and retained template";await nav("goals");
        for(const [kind,id] of [["habit",habitId],["goal",goalId]]) {await act(p.locator(`[data-pg-action="delete-${kind}"][data-pg-id="${id}"]`));await submitDialog(p.locator("#personal-goals-dialog"),`Delete ${kind}`);}
        await nav("notes");await act(p.locator(`[data-note-action="delete"][data-note-id="${noteId}"]`));await submitDialog(p.locator(".personal-note-dialog[open]"),"Delete note");
        await nav("classes");await p.locator("#library-class-select").selectOption(classId);await act(p.locator("#library-tab-resources"));await act(p.locator(`[data-library-action="delete-resource"][data-library-id="${resourceId}"]`));await submitDialog(p.locator("#planner-library-dialog"),"Delete");
        await templatePane();await act(card().locator('[data-library-action="template-menu"]'));await act(p.locator('#template-management-menu [data-template-menu-action="delete"]'));await submitDialog(p.locator("#planner-library-dialog"),"Delete");
        await closeSheet();await p.reload();await wait(p,ids=>!store.listTemplates().some(x=>x.id===ids.templateId)&&!store.listResources().some(x=>x.id===ids.resourceId)&&!store.listNotes().some(x=>x.id===ids.noteId)&&!store.listGoals().some(x=>x.id===ids.goalId)&&!store.listHabits().some(x=>x.id===ids.habitId)&&store.listHabitCheckins({habitId:ids.habitId}).length===0,{templateId,resourceId,noteId,goalId,habitId});
        assert(await p.evaluate(title=>store.listItems().filter(x=>x.title===title).length>=2,template.title),"Deleting template removed independent task copies");
        result.checks.deleteReloadCascadeAndCopiesRetained=true;result.finalCounts=await counts(p);await fits();
        assert(!result.pageErrors.length&&!result.blocked.length&&!result.unexpectedResponses.length,"Unexpected browser/API/external errors");result.passed=true;
      } catch(error) {result.passed=false;result.stage=stage;result.error=error.message;await p.screenshot({path:evidence+`failure-${config.name}.png`}).catch(()=>{});}
      cases.push(result);
    }
    return { runtime:await browser.version(), origin, source:"5c6134f plus guidance/compatibility-tool changes", mode:"dedicated local signed-in fixture", compatibility, cases, passed:cases.every(x=>x.passed), productionWrites:false, physicalDeviceClaims:false };
  } finally {for(const context of contexts)await context.close().catch(()=>{});}
}
