async page=>{
  const browser=page.context().browser(),results=[];
  for(const width of [1156,390,320]){
    const c=await browser.newContext({viewport:{width,height:width===1156?746:844},hasTouch:width<700,isMobile:width<700,serviceWorkers:'block'});
    try{
      await c.addInitScript(()=>{
        const today=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        localStorage.setItem('duckplan-demo-tasks-v1',JSON.stringify([{id:'due-tab-qa',title:'Review lab notes',dueDate:today,dueTime:'17:00',scheduledStart:today+'T14:00',classId:null,priority:'Medium',completed:false,durationMinutes:45,schemaVersion:2}]));
      });
      const p=await c.newPage();await p.goto('http://127.0.0.1:8034/#calendar');await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
      const before=await p.evaluate(()=>JSON.stringify(store.listItems()));
      for(const view of ['day','week']){
        await p.getByRole('button',{name:view==='day'?'Day':'Week',exact:true}).click();
        for(const theme of ['light','dark']){
          await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
          // Existing buttons transition their colors over 240ms; inspect settled paint.
          await p.waitForTimeout(350);
          const due=p.locator('#view-calendar [data-day-list="due"]:visible').first();
          const metrics=await due.evaluate(e=>{const s=getComputedStyle(e),work=e.parentElement.querySelector('[data-day-list="work"]'),w=work&&getComputedStyle(work);return{fill:s.backgroundColor,border:s.borderColor,borderWidth:s.borderWidth,borderStyle:s.borderStyle,rect:e.getBoundingClientRect().toJSON(),workFill:w?.backgroundColor,workBorder:w?.borderWidth};});
          if(metrics.borderWidth!=='2px'||metrics.borderStyle!=='solid')throw Error('Due border missing');
          if(metrics.border!==(theme==='light'?'rgb(196, 89, 73)':'rgb(239, 155, 133)'))throw Error('Wrong red '+JSON.stringify(metrics));
          if(metrics.workBorder!=='0px')throw Error('Work changed');
          await due.click();await p.locator('.calendar-day-list-preview').waitFor({state:'visible'});await p.waitForTimeout(450);
          if(!(await p.locator('.calendar-day-list-preview').innerText()).includes('Review lab notes'))throw Error('Due list missing task');
          await p.keyboard.press('Escape');await p.locator('.calendar-day-list-preview').waitFor({state:'detached'});
          results.push({width,view,theme,status:'PASS',...metrics});
        }
        await p.evaluate(()=>document.documentElement.dataset.theme='light');await p.waitForTimeout(350);
        if(view==='week'&&width!==320){await p.mouse.move(0,0);await p.screenshot({path:'/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-strong-due-tabs-20261120/'+width+'.png'});}
      }
      if(await p.evaluate(()=>JSON.stringify(store.listItems()))!==before)throw Error('Viewing changed data');
      if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Page overflow');
    }finally{await c.close();}
  }
  return{runtime:browser.version(),results};
}
