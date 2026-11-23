async page => {
  const browser = page.context().browser(), results = [];
  const demo = "completion-20261123-3";
  for (const config of [{width:1280,view:"calendar"}, {width:835,view:"calendar",dark:true}, {width:390,view:"tasks",phone:true}]) {
    const context = await browser.newContext({
      viewport:{width:config.width,height:950}, hasTouch:Boolean(config.phone), isMobile:Boolean(config.phone),
      timezoneId:"America/Los_Angeles", reducedMotion:"reduce", serviceWorkers:"block"
    });
    try {
      const p = await context.newPage(), errors = [];
      p.setDefaultTimeout(8000);
      p.on("pageerror", e=>errors.push(e.message));
      await p.goto("http://127.0.0.1:8042/?demo="+demo+"#"+config.view);
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length === 8);
      if (config.dark) await p.evaluate(() => document.documentElement.dataset.theme = "dark");
      const scope = config.phone ? "#view-tasks" : "#daily-task-panel";
      const cards = p.locator(scope+" [data-task-tone]");
      await cards.first().waitFor({state:"visible"});
      const inspect = () => cards.evaluateAll(rows => rows.map(row => {
        const style = getComputedStyle(row);
        return { tone:row.dataset.taskTone, fill:style.backgroundColor, image:style.backgroundImage,
          accent:style.getPropertyValue("--task-status-color").trim(), classDot:getComputedStyle(row.querySelector(".course-dot")).backgroundColor };
      }));
      const colors = await inspect();
      const palette = Object.fromEntries(colors.map(row=>[row.tone,row.fill]));
      if (Object.keys(palette).length !== 4 || new Set(Object.values(palette)).size !== 4 || colors.some(row=>row.image!=="none")
          || !colors.some(row=>row.tone==="neutral" && row.accent==="#8057be")) {
        throw Error("Task tints missing: "+JSON.stringify(colors));
      }
      const id = demo+"-6";
      if (config.phone) {
        await p.locator("#task-grouping").selectOption("class");
        if ((await inspect()).some(row=>row.fill!==palette[row.tone])) throw Error("Grouping changed colors");
        await p.locator(scope+' .task-select[data-edit-task="'+id+'"]').tap();
        await p.locator("#task-schedule-options > summary").tap();
        const date = await p.evaluate(()=>nowKey());
        await p.locator('#task-form [name="scheduledDate"]').fill(date);
        await p.locator('#task-form [name="scheduledTime"]').fill("14:15");
        await p.locator("#save-task").tap();
        await p.waitForFunction(({id,date})=>store.listItems().find(task=>task.id===id)?.scheduledStart===date+"T14:15",{id,date});
        const changed = p.locator(scope+' [data-task-tone="scheduled"]').filter({has:p.locator('button[data-edit-task="'+id+'"]')});
        await changed.waitFor({state:"visible"});
        await p.locator('.phone-bottom-nav [data-view="calendar"]').tap();
        await p.reload();
        const closeTasks = p.locator("button.task-panel-close-button");
        if (await closeTasks.isVisible()) await closeTasks.tap();
        await p.waitForFunction(() => !document.body.classList.contains("task-panel-open"));
      }
      const work = p.locator(config.phone?'[data-calendar-drag-task="'+id+'"]':'#view-calendar .calendar-event-block.is-short').first();
      await work.scrollIntoViewIfNeeded();
      const times = await (config.phone ? work : p.locator("#view-calendar .calendar-event-block.is-short")).evaluateAll(blocks=>blocks.map(block=>{
        const time=block.querySelector("small"), textRange=document.createRange();
        textRange.selectNodeContents(time);
        const label=textRange.getBoundingClientRect(), outer=block.getBoundingClientRect();
        return {
          text:time.textContent, height:Math.round(outer.height),
          fits:label.height>0 && label.bottom<=outer.bottom+1 && label.right<=outer.right+1
        };
      }));
      if (!times.length||times.some(time=>!time.fits)||config.phone&&times[0].text!=="2:15 PM") throw Error("Time label does not fit: "+JSON.stringify(times));
      if (errors.length) throw Error(errors.join("; "));
      await p.screenshot({path:"/tmp/duckplan-compact-work-"+config.width+".png"});
      results.push({config,status:"PASS",palette,times,errors});
    } finally { await context.close(); }
  }
  return {runtime:browser.version(),mode:"local demo",results};
}
