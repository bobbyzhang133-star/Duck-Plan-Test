async page=>{
 const browser=page.context().browser(),origin='http://127.0.0.1:8034',out='/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-time-cutoff/',results=[];
 const check=(v,m)=>{if(!v)throw Error(m);};
 const inspect=()=>{
  const root=document.querySelector('#planner-calendar'),frame=root.getBoundingClientRect(),axis=document.querySelector('.time-axis').getBoundingClientRect();
  const top=Math.max(frame.top+root.clientTop,...[...root.querySelectorAll('.timeline-days,.timeline-deadlines')].map(e=>e.getBoundingClientRect().bottom));
  const bottom=frame.top+root.clientTop+root.clientHeight,left=frame.left+root.clientLeft,right=left+root.clientWidth;
  const labels=[...root.querySelectorAll('.time-axis-label')].map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,visible:getComputedStyle(e).opacity!=='0',top:r.top,bottom:r.bottom,left:r.left,right:r.right};});
  const line=root.querySelector('.current-time-line'),dot=line?.querySelector('span')?.getBoundingClientRect();
  return {top,bottom,left,right,axisRight:axis.right,axisWidth:axis.width,labels,indicator:line?{visible:getComputedStyle(line).opacity!=='0',top:dot.top,bottom:dot.bottom,left:dot.left,right:dot.right}:null,overflow:document.documentElement.scrollWidth>innerWidth+1};
 };
 const valid=s=>s.labels.filter(e=>e.visible).every(e=>e.top>=s.top-.5&&e.bottom<=s.bottom+.5&&e.left>=s.left-.5&&e.right<=s.axisRight+.5)&&(!s.indicator?.visible||(s.indicator.top>=s.top-.5&&s.indicator.bottom<=s.bottom+.5&&s.indicator.left>=s.axisRight-.5&&s.indicator.right<=s.right+.5));
 for(const width of [1280,835,390,320]){
  const c=await browser.newContext({viewport:{width,height:1000},hasTouch:width<1000,isMobile:width<700,serviceWorkers:'block',timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});
  try{
   await c.addInitScript(()=>{localStorage.setItem('duckplan-demo-classes-v1','[]');localStorage.setItem('duckplan-demo-tasks-v1',JSON.stringify([{id:'cutoff-work',title:'Study calculus',classId:null,dueDate:'2026-11-16',dueTime:'17:00',scheduledStart:'2026-11-16T15:00',durationMinutes:60,priority:'Medium',completed:false,notes:'Synthetic clipping check',schemaVersion:2},{id:'cutoff-date',title:'Date-only reading',classId:null,dueDate:'2026-11-16',dueTime:'',scheduledStart:null,durationMinutes:45,priority:'Medium',completed:false,schemaVersion:2}]));});
   const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(10000);
   await p.clock.install({time:new Date('2026-11-16T10:05:00-08:00')});await p.goto(origin+'/?qa=time-cutoff#calendar');await p.waitForFunction(()=>typeof store!=='undefined'&&workAlertContextReady);
   const before=await p.evaluate(()=>JSON.stringify(store.listItems()));
   for(const mode of ['day','week']){
    await p.evaluate(mode=>{selectedDate='2026-11-16';calendarView=mode;calendarUserScrolled=true;renderAll({autoScrollCalendar:false});document.querySelector('#planner-calendar').scrollTop=0;},mode);
    await p.waitForTimeout(80);
    const start=await p.evaluate(inspect);check(valid(start),'Clipped top/hour glyph at '+width+'/'+mode);check(start.labels[0].visible,'Midnight label hidden at initial boundary');check(start.axisWidth>=(width<700?64:72),'Time gutter too narrow');
    const positions=await p.evaluate(()=>{const r=document.querySelector('#planner-calendar'),b=r.getBoundingClientRect(),line=r.querySelector('.current-time-line');const floor=Math.max(b.top+r.clientTop,...[...r.querySelectorAll('.timeline-days,.timeline-deadlines')].map(e=>e.getBoundingClientRect().bottom));return {now:line.getBoundingClientRect().top-b.top-r.clientTop+r.scrollTop,header:floor-b.top-r.clientTop};});
    const samples=[];
    for(const offset of [2,12,27,57,75,126]){
     await p.evaluate(({positions,offset})=>{document.querySelector('#planner-calendar').scrollTop=positions.now-positions.header-offset;},{positions,offset});await p.waitForTimeout(60);
     const state=await p.evaluate(inspect);check(valid(state),'Partial label/indicator at '+width+'/'+mode+'/'+offset);check(state.labels.some(l=>l.visible),'No visible hours');if(offset===2)check(!state.indicator.visible,'Partial dot must not leak under sticky header '+JSON.stringify({width,mode,offset,positions,top:state.top,indicator:state.indicator}));if(offset===12)check(state.indicator.visible,'Fully visible current indicator not restored');samples.push({offset,visibleLabels:state.labels.filter(l=>l.visible).map(l=>l.text),indicator:state.indicator});
    }
    await p.evaluate(positions=>{document.querySelector('#planner-calendar').scrollTop=positions.now-positions.header-150;},positions);await p.waitForTimeout(70);
    await p.screenshot({path:out+`after-${width}-${mode}.png`});
    if(width===835&&mode==='week'){
     const xBefore=(await p.evaluate(inspect)).labels.find(l=>l.visible).left;
     await p.evaluate(()=>{const r=document.querySelector('#planner-calendar');r.scrollLeft=(r.scrollWidth-r.clientWidth)/2;});await p.waitForTimeout(80);const moved=await p.evaluate(inspect);check(valid(moved),'Horizontal scroll clips hour rail');check(Math.abs(moved.labels.find(l=>l.visible).left-xBefore)<1,'Time rail did not remain fixed');
    }
    await p.evaluate(()=>document.documentElement.dataset.theme='dark');await p.waitForTimeout(60);check(valid(await p.evaluate(inspect)),'Dark clipping');await p.evaluate(()=>document.documentElement.dataset.theme='light');
    check(errors.length===0,errors.join(';'));check(before===await p.evaluate(()=>JSON.stringify(store.listItems())),'Presentation changed tasks');
    results.push({width,mode,status:'PASS',axisWidth:start.axisWidth,midnightVisible:true,samples,errors});
   }
   await p.evaluate(()=>{calendarView='month';renderCalendar();});await p.waitForTimeout(50);check(await p.locator('.month-calendar').count()===1,'Month navigation broken');
  }finally{await c.close();}
 }
 return {runtime:browser.version(),mode:'isolated local browser fixtures; frozen current time10:05',results};
}
