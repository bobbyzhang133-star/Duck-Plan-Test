async page => {
  const browser=page.context().browser(),c=await browser.newContext({viewport:{width:1280,height:950},hasTouch:true,serviceWorkers:"allow"}),cases=[],errors=[];
  let stage="startup";
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  try {
    const p=await c.newPage();p.setDefaultTimeout(6000);p.on("pageerror",e=>errors.push(e.message));
    await p.goto("http://127.0.0.1:8034/?qa=smooth-native-extra#calendar");await p.waitForFunction(()=>typeof store!=="undefined"&&typeof calendarScrollElement==="function");
    await p.evaluate(()=>{calendarView="week";renderCalendar({autoScroll:false});calendarScrollElement().scrollTop=0;});
    stage="horizontal alignment";await p.setViewportSize({width:835,height:950});await p.waitForTimeout(100);
    const horizontal=await p.evaluate(()=>{
      const surface=calendarScrollElement(),header=els.calendar.querySelector(".calendar-header-viewport");surface.scrollLeft=surface.scrollWidth;
      return {max:surface.scrollWidth-surface.clientWidth};
    });
    await p.waitForTimeout(100);
    check(horizontal.max>0,"Expected a horizontally scrollable Week fixture");
    check(await p.evaluate(()=>{const h=els.calendar.querySelector(".calendar-header-viewport"),s=calendarScrollElement();return h.scrollLeft===s.scrollLeft&&Math.abs(els.calendar.querySelector(".calendar-date-button").getBoundingClientRect().left-els.calendar.querySelector(".timeline-column").getBoundingClientRect().left)<1;}),"Horizontal date/body mismatch");
    cases.push({test:"horizontal-header-body-column-alignment",status:"PASS",max:horizontal.max});
    await p.setViewportSize({width:1280,height:950});
    await p.evaluate(()=>{calendarView="day";renderCalendar({autoScroll:false});calendarScrollElement().scrollTop=250;calendarScrollElement().scrollLeft=0;});
    const header=p.locator(".calendar-header-viewport"),before=await header.boundingBox(),body=p.locator(".calendar-timeline-scroller"),b=await body.boundingBox(),cd=await c.newCDPSession(p);
    stage="native touch pan";
    await cd.send("Input.synthesizeScrollGesture",{x:b.x+b.width/2,y:b.y+200,yDistance:-200,gestureSourceType:"touch",preventFling:true,speed:800});await p.waitForTimeout(150);
    const touchTop=await p.evaluate(()=>calendarScrollElement().scrollTop);
    check(touchTop>250&&Math.abs((await header.boundingBox()).y-before.y)<.1,"Native touch pan/header failed");
    cases.push({test:"trusted-touch-body-scroll-fixed-header",status:"PASS",scrollTop:touchTop});
    stage="header touch pan";
    const currentHeader=await header.boundingBox();
    await cd.send("Input.synthesizeScrollGesture",{x:currentHeader.x+currentHeader.width/2,y:currentHeader.y+20,yDistance:-150,gestureSourceType:"touch",preventFling:true,speed:800});await p.waitForTimeout(100);
    check(await p.evaluate(n=>calendarScrollElement().scrollTop>n,touchTop),"Header touch failed to pan body");
    check(Math.abs((await header.boundingBox()).y-before.y)<.1,"Header touch moved header");
    cases.push({test:"trusted-touch-header-pans-body-without-header-motion",status:"PASS"});
    stage="slot and work block";
    await p.evaluate(()=>{calendarScrollElement().scrollTop=0;});
    await p.locator('.calendar-slot[data-slot-time="01:00"]').click();await p.locator("#task-modal").waitFor({state:"visible"});
    check(await p.locator('#task-form [name="scheduledTime"]').inputValue()==="01:00","Slot mapped wrong time");await p.locator("#cancel-task").click();await p.waitForTimeout(500);
    const date=await p.evaluate(async()=>{const date=nowKey();await store.upsertItem({id:"qa-native-work",title:"QA move work",dueDate:date,dueTime:"18:00",scheduledStart:date+"T03:00",durationMinutes:45,priority:"Medium",completed:false});renderAll({autoScrollCalendar:false});calendarScrollElement().scrollTop=0;return date;});
    const src=await p.locator('[data-calendar-drag-task="qa-native-work"]').boundingBox(),dst=await p.locator('.calendar-slot[data-slot-time="04:00"]').boundingBox();
    await p.mouse.move(src.x+src.width/2,src.y+12);await p.mouse.down();await p.mouse.move(src.x+src.width/2+15,src.y+18,{steps:4});await p.mouse.move(dst.x+dst.width/2,dst.y+12,{steps:20});await p.mouse.up();await p.waitForTimeout(350);
    check(await p.evaluate(date=>{const t=store.listItems().find(t=>t.id==="qa-native-work");return t.scheduledStart===date+"T04:00"&&t.dueTime==="18:00";},date),"Work block drag failed: "+JSON.stringify(await p.evaluate(()=>store.listItems().find(t=>t.id==="qa-native-work"))));
    cases.push({test:"01:00-slot-editor-cancel-and-work-block-reschedule",status:"PASS"});
    stage="reduced motion";
    await p.emulateMedia({reducedMotion:"reduce"});check(await body.evaluate(e=>getComputedStyle(e).overscrollBehaviorY)==="none","Reduced motion has elasticity");await p.emulateMedia({reducedMotion:"no-preference"});
    cases.push({test:"reduced-motion-native-boundary-clamp",status:"PASS"});
    stage="offline cache";
    await p.evaluate(async()=>{await navigator.serviceWorker.ready;});await p.reload();await p.waitForFunction(()=>navigator.serviceWorker.controller&&typeof store!=="undefined");
    const cache=await p.evaluate(async()=>{const names=await caches.keys(),name=names.find(n=>n.endsWith("-v93"));if(!name)return{names};const cache=await caches.open(name),results=[];for(const path of ["calendar-viewport.js"]){const key=new URL(path+"?v=smooth-native-rebound-20261119",location.href);const cached=await cache.match(key)||await cache.match(new URL(path,location.href));const fresh=await fetch(key,{cache:"reload"});results.push({path,equal:cached&&await cached.text()===await fresh.text()});}return{name,results};});
    check(cache.name&&cache.results.every(r=>r.equal),"Cache mismatch "+JSON.stringify(cache));
    await c.setOffline(true);await p.reload();await p.waitForFunction(()=>typeof store!=="undefined"&&document.querySelector(".calendar-timeline-scroller"));
    check(await p.evaluate(date=>store.listItems().find(t=>t.id==="qa-native-work")?.scheduledStart===date+"T04:00",date),"Offline task missing");
    await p.evaluate(()=>{calendarView="day";renderCalendar({autoScroll:false});calendarScrollElement().scrollTop=0;});await p.locator('.calendar-slot[data-slot-time="02:00"]').click();await p.locator("#task-modal").waitFor({state:"visible"});await p.locator("#cancel-task").click();
    cases.push({test:"v93-viewport-asset-equal-offline-task-and-slot",status:"PASS",cache});
    check(!errors.length,errors.join(";"));return{runtime:browser.version(),mode:"disposable local browser context; touch emulation",cases,errors};
  }catch(error){return{stage,error:error.message,cases,errors};}finally{await c.close();}
}
