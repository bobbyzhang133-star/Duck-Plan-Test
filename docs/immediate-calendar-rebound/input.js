async page => {
  const browser=page.context().browser(),results=[];
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  for(const width of [1280,835,390]){
    const c=await browser.newContext({viewport:{width,height:950},hasTouch:width<1000,isMobile:width<700,serviceWorkers:"block"});
    try{
      const p=await c.newPage();await p.goto("http://127.0.0.1:8034/?qa=immediate-input#calendar");await p.waitForFunction(()=>typeof store!=="undefined");
      await p.evaluate(()=>{calendarView="week";renderCalendar({autoScroll:false});calendarScrollElement().scrollTop=0;});await p.waitForTimeout(200);
      const body=p.locator(".calendar-body-grid"),bounds=await p.locator(".calendar-timeline-scroller").boundingBox(),header=await p.locator(".timeline-days").boundingBox(),cd=await c.newCDPSession(p);
      const x=bounds.x+120,y=bounds.y+80;
      await cd.send("Input.synthesizeScrollGesture",{x,y,yDistance:240,gestureSourceType:"mouse",speed:1200,preventFling:true});
      const burst=await body.evaluate(e=>({active:e.getAnimations().length,offset:new DOMMatrixReadOnly(getComputedStyle(e).transform).m42}));
      check(burst.active===1&&burst.offset>0&&burst.offset<=48,"Continuous input lost or doubled spring "+JSON.stringify({width,burst}));
      check(Math.abs((await p.locator(".timeline-days").boundingBox()).y-header.y)<.01,"Continuous wheel moved header");
      await p.waitForFunction(()=>{const b=document.querySelector(".calendar-body-grid");return !b.style.transform&&!b.getAnimations().length;});
      results.push({width,input:"continuous trusted wheel",status:"PASS",burst});
      if(width<1000){
        await cd.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
        for(const dy of [20,45,70]){await cd.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y:y+dy}]});await p.waitForTimeout(20);}
        await p.waitForTimeout(120);
        const held=await body.evaluate(e=>({active:e.getAnimations().length,offset:new DOMMatrixReadOnly(getComputedStyle(e).transform).m42}));
        check(held.active===0&&held.offset>0,"Held touch started returning early");
        await cd.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
        const lifted=await body.evaluate(e=>({active:e.getAnimations().length,offset:new DOMMatrixReadOnly(getComputedStyle(e).transform).m42}));
        check(lifted.active===1,"Touch lift waited before starting return");
        await p.waitForFunction(()=>{const b=document.querySelector(".calendar-body-grid");return !b.style.transform&&!b.getAnimations().length;});
        results.push({width,input:"trusted touch hold/lift",status:"PASS",held,lifted});
      }
    }finally{await c.close();}
  }
  return{runtime:browser.version(),mode:"isolated local browser; desktop and touch emulation",results};
}
