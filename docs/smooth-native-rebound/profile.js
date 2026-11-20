async page => {
  const browser=page.context().browser();
  async function run(cpuRate) {
    const c=await browser.newContext({viewport:{width:1280,height:950},serviceWorkers:"block"});
    try {
      const p=await c.newPage();await p.goto("http://127.0.0.1:8034/?qa=rebound-profile#calendar");
      await p.waitForFunction(()=>typeof calendarScrollElement==="function");
      await p.evaluate(()=>{calendarView="week";renderCalendar({autoScroll:false});calendarScrollElement().scrollTop=0;});await p.waitForTimeout(400);
      const cd=await c.newCDPSession(p);await cd.send("Emulation.setCPUThrottlingRate",{rate:cpuRate});
      await cd.send("Tracing.start",{categories:"devtools.timeline,blink.user_timing",transferMode:"ReturnAsStream"});
      await p.evaluate(()=>{
        window.qaProfile={frames:[],queries:{},mutations:0,longtasks:[],running:true};
        const query=Element.prototype.querySelector;Element.prototype.querySelector=function(selector){if(this.id==="planner-calendar")qaProfile.queries[selector]=(qaProfile.queries[selector]||0)+1;return query.call(this,selector);};
        new MutationObserver(rows=>qaProfile.mutations+=rows.length).observe(document.querySelector("#planner-calendar"),{attributes:true,subtree:true});
        new PerformanceObserver(list=>qaProfile.longtasks.push(...list.getEntries().map(e=>({name:e.name,duration:e.duration})))).observe({type:"longtask"});
        let prev=performance.now();const frame=now=>{qaProfile.frames.push(now-prev);prev=now;if(qaProfile.running)requestAnimationFrame(frame);};requestAnimationFrame(frame);
      });
      const b=await p.locator(".calendar-timeline-scroller").boundingBox();
      for(let i=0;i<3;i++) {
        await cd.send("Input.synthesizeScrollGesture",{x:b.x+b.width/2,y:b.y+150,yDistance:-500,gestureSourceType:"mouse",speed:1800,preventFling:true});
        await cd.send("Input.synthesizeScrollGesture",{x:b.x+b.width/2,y:b.y+150,yDistance:800,gestureSourceType:"mouse",speed:1800,preventFling:false});
        await p.waitForTimeout(700);
      }
      const metrics=await p.evaluate(()=>{qaProfile.running=false;const a=qaProfile.frames.slice(1).sort((a,b)=>a-b);return{frameCount:a.length,p95FrameMs:a[Math.floor(a.length*.95)],maxFrameMs:Math.max(...a),framesOver25ms:a.filter(n=>n>25).length,queries:qaProfile.queries,mutations:qaProfile.mutations,longtasks:qaProfile.longtasks};});
      const complete=new Promise(resolve=>cd.once("Tracing.tracingComplete",resolve));await cd.send("Tracing.end");const {stream}=await complete;let trace="";
      while(true){const r=await cd.send("IO.read",{handle:stream});trace+=r.data;if(r.eof)break;}await cd.send("IO.close",{handle:stream});
      const events=JSON.parse(trace).traceEvents,work={};
      for(const e of events)if(["Layout","UpdateLayoutTree","Paint","FunctionCall","EventDispatch"].includes(e.name)&&e.ph==="X"){
        const key=e.name==="EventDispatch"?e.name+":"+e.args?.data?.type:e.name;
        const s=work[key]||(work[key]={count:0,totalMs:0,maxMs:0});s.count++;s.totalMs+=(e.dur||0)/1000;s.maxMs=Math.max(s.maxMs,(e.dur||0)/1000);
      }
      return{cpuRate,runtime:browser.version(),metrics,work};
    }finally{await c.close();}
  }
  return [await run(1),await run(4)];
}
