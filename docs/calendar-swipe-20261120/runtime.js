// Native Chromium touch input, isolated storage; no production records.
async page=>{
  const browser=page.context().browser(),results=[],check=(v,m)=>{if(!v)throw Error(m);};
  for(const cfg of [{width:390,height:844},{width:320,height:568,reduce:true},{width:844,height:390},{width:835,height:1112}]){
    const c=await browser.newContext({viewport:{width:cfg.width,height:cfg.height},hasTouch:true,isMobile:cfg.width<700,reducedMotion:cfg.reduce?'reduce':'no-preference',serviceWorkers:'block',timezoneId:'America/Los_Angeles'}),p=await c.newPage(),errors=[];
    const result={...cfg,checks:[]};p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(10000);
    try{
      await c.addInitScript(()=>{if(localStorage.getItem('duckplan-demo-tasks-v1')===null)localStorage.setItem('duckplan-demo-tasks-v1','[]');});
      await p.goto('http://127.0.0.1:8034/#calendar');await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
      const s=await c.newCDPSession(p);
      async function gesture(points){
        await s.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...points[0],id:1}]});
        for(const point of points.slice(1)){await s.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:1}]});await p.waitForTimeout(20);}
        await s.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(250);
      }
      async function swipe(direction,locator=null){
        const target=locator||p.locator(calendarViewSelector()),bounds=await target.boundingBox();
        const clip=await target.evaluate(e=>{const p=e.closest('#planner-calendar'),r=p?.getBoundingClientRect();return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom}:{left:0,top:0,right:innerWidth,bottom:innerHeight};});
        const left=Math.max(bounds.x,clip.left),top=Math.max(bounds.y,clip.top),right=Math.min(bounds.x+bounds.width,clip.right),bottom=Math.min(bounds.y+bounds.height,clip.bottom);
        const r={x:left,y:top,width:right-left,height:bottom-top};
        const start={x:r.x+r.width*(direction>0?.8:.2),y:r.y+r.height*.5},end={x:r.x+r.width*(direction>0?.2:.8),y:start.y};
        await gesture(Array.from({length:7},(_,i)=>({x:start.x+(end.x-start.x)*i/6,y:start.y})));
      }
      function calendarViewSelector(){return '.calendar-timeline-scroller';}
      const state=()=>p.evaluate(()=>({date:selectedDate,mode:calendarView,dialogs:document.querySelectorAll('dialog[open]').length}));
      const expect=direction=>p.evaluate(direction=>Model.shiftView(calendarView,selectedDate,direction),direction);
      const before=await p.evaluate(()=>JSON.stringify(store.listItems()));
      for(const mode of ['day','week','month']){
        await p.getByRole('button',{name:mode[0].toUpperCase()+mode.slice(1),exact:true}).click();await p.locator('#calendar-today').click();
        const target=mode==='month'?p.locator('.month-grid'):p.locator('.calendar-timeline-scroller');
        if(mode!=='month')await p.locator('.calendar-timeline-scroller').evaluate(e=>e.scrollLeft=e.scrollWidth);
        const next=await expect(1);await swipe(1,target);check((await state()).date===next,mode+' left did not advance period');
        if(mode!=='month')await p.locator('.calendar-timeline-scroller').evaluate(e=>e.scrollLeft=0);
        const previous=await expect(-1);await swipe(-1,target);check((await state()).date===previous,mode+' right did not return');
        check((await state()).dialogs===0,'Swipe opened a task');result.checks.push({mode,left:'PASS',right:'PASS',unit:mode});
      }
      // Phone Week date-strip swipes follow Week, not the single visible day.
      await p.getByRole('button',{name:'Week',exact:true}).click();await p.locator('#calendar-today').click();
      const phone=await p.evaluate(()=>phonePlannerQuery.matches);
      if(phone){const next=await expect(1);await swipe(1,p.locator('#phone-week-strip'));check((await state()).date===next,'Phone strip did not advance week');result.checks.push({phoneStrip:'PASS'});}
      if(!phone){
        const scroller=p.locator('.calendar-timeline-scroller');await scroller.evaluate(e=>e.scrollLeft=0);const original=(await state()).date;
        await swipe(1);await p.waitForTimeout(400);const pan=await scroller.evaluate(e=>({left:e.scrollLeft,max:e.scrollWidth-e.clientWidth}));
        check((await state()).date===original&&pan.left>0,'iPad pan changed period or did not pan');result.checks.push({ipadNativePan:'PASS',pan});
      }
      await p.getByRole('button',{name:'Day',exact:true}).click();await p.locator('#calendar-today').click();
      const scroller=p.locator('.calendar-timeline-scroller');await scroller.evaluate(e=>e.scrollTop=10*62);const sr=await scroller.boundingBox(),original=(await state()).date;
      await gesture(Array.from({length:7},(_,i)=>({x:sr.x+sr.width*.6,y:sr.y+sr.height*.75-i*15})));
      await p.waitForTimeout(350);const scrollTop=await scroller.evaluate(e=>e.scrollTop);check((await state()).date===original&&scrollTop>10*62+20,'Vertical scroll intercepted');result.checks.push({verticalScroll:'PASS',scrollTop});
      // A tap still opens Add; a short/vertical gesture must not change dates.
      await scroller.evaluate(e=>e.scrollTop=14*62);const br=await scroller.boundingBox();await p.touchscreen.tap(br.x+br.width*.6,br.y+Math.min(30,br.height*.2));await p.locator('#task-modal').waitFor({state:'visible'});await p.waitForTimeout(600);await p.locator('#cancel-task').click();await p.waitForFunction(()=>!document.querySelector('#task-modal').open);
      check((await state()).date===original,'Tap changed date');result.checks.push({tapAddCancel:'PASS'});
      check(await p.evaluate(()=>JSON.stringify(store.listItems()))===before,'Navigation changed task records');
      check(errors.length===0,errors.join(';'));result.status='PASS';await s.detach();
    }catch(e){result.status='FAIL';result.error=e.message;await p.screenshot({path:'/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-swipe-20261120/'+cfg.width+'-failure.png'}).catch(()=>{});}
    finally{await c.close();}results.push(result);
  }
  return{runtime:browser.version(),input:'CDP Input.dispatchTouchEvent, not DOM-dispatched touch events',results};
}
