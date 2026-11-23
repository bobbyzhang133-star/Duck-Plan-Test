async page => {
  const browser = page.context().browser(), results = [];
  for (const config of [
    {width:1280,view:"calendar"},
    {width:835,view:"tasks",dark:true},
    {width:390,view:"tasks",phone:true},
    {width:320,view:"calendar",phone:true}
  ]) {
    const c = await browser.newContext({
      viewport:{width:config.width,height:950}, timezoneId:"America/Los_Angeles",
      isMobile:!!config.phone, hasTouch:!!config.phone, colorScheme:config.dark?"dark":"light",
      reducedMotion:"reduce",serviceWorkers:"block"
    });
    try {
      const p = await c.newPage(), errors = [];
      p.setDefaultTimeout(8000);
      p.on("pageerror", e => errors.push(e.message));
      await p.goto("http://127.0.0.1:8042/?demo=completion-20261123-3#"+config.view);
      const scope = config.view === "calendar" ? "#daily-task-panel" : "#view-tasks";
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length===8);
      if (config.phone && config.view==="calendar" && !await p.locator("body").evaluate(e=>e.classList.contains("task-panel-open"))) await p.locator("#phone-task-summary").tap();
      const rows=p.locator(scope+" :is(.daily-task-card,.all-task-row)");
      await rows.first().waitFor({state:"visible"});
      await p.waitForFunction(selector=>document.querySelectorAll(selector+" [data-has-deadline]").length>=5,scope);
      const checked=await rows.evaluateAll(cards=>{
        const bg=e=>getComputedStyle(e).backgroundColor;
        const luminance=rgb=>{
          const values=rgb.match(/[\d.]+/g).slice(0,3).map(Number);
          const linear=values.map(value=>{const c=value/255; return c<=.04045?c/12.92:((c+.055)/1.055)**2.4});
          return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
        };
        return cards.map(card=>{
          const due=card.querySelector(".task-due,.task-date-due"), work=card.querySelector(".task-date-work");
          const fill=bg(due), foreground=getComputedStyle(due.querySelector("strong")??due).color;
          const lower=due.querySelector("small"), lowerColor=lower?.textContent?getComputedStyle(lower).color:foreground;
          const l=luminance(fill);
          const contrast=Math.min(...[foreground,lowerColor].map(color=>{const f=luminance(color);return (Math.max(f,l)+.05)/(Math.min(f,l)+.05);}));
          return { status:card.dataset.taskTone, hasDeadline:due.hasAttribute("data-has-deadline"), visible:due.getBoundingClientRect().height>0,
            fill, workFill:work&&bg(work), contrast, overflow:due.scrollWidth>due.clientWidth+1 };
        });
      });
      if (checked.filter(row=>row.hasDeadline).length!==6 || checked.some(row=>row.overflow||!row.visible
          || (row.hasDeadline?(row.fill!==(config.dark?"rgb(78, 48, 41)":"rgb(251, 226, 221)")||row.contrast<4.5):row.fill!=="rgba(0, 0, 0, 0)")
          || (row.workFill&&row.workFill!=="rgba(0, 0, 0, 0)"))) throw Error("Deadline styling mismatch: "+JSON.stringify({config,checked}));
      const row=rows.filter({hasText:"Sample: Calculus practice"});
      await row.scrollIntoViewIfNeeded();
      if(config.width===390||config.width===1280) {
        await p.locator("#toast.show").waitFor({state:"hidden"});
        await row.screenshot({path:"/tmp/duckplan-due-highlight-"+config.width+".png"});
      }
      const editorTarget=row.locator(config.view==="calendar"?"[data-has-deadline]":".task-select");
      await editorTarget.click();
      await p.locator("#close-task-modal").waitFor({state:"visible"});
      await p.locator("#close-task-modal").click();
      await p.locator("#close-task-modal").waitFor({state:"hidden"});
      if (errors.length) throw Error(errors.join("; "));
      results.push({config,status:"PASS",count:checked.filter(row=>row.hasDeadline).length, contrast:Math.min(...checked.filter(row=>row.hasDeadline).map(row=>row.contrast)),errors});
    } finally { await c.close(); }
  }
  return {runtime:browser.version(),mode:"local demo",results};
}
