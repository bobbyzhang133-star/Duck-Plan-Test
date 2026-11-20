async page => {
  const browser=page.context().browser(),results=[];
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  async function capture(port,bottom,tag){
    const c=await browser.newContext({viewport:{width:1156,height:746},serviceWorkers:"block"});
    try{
      await c.addInitScript(()=>{
        window.qaRebound={wheel:[],returns:[],frames:[]};
        addEventListener("wheel",e=>{if(e.target.closest?.(".time-axis,.timeline-columns")){qaRebound.wheel.push(performance.now());let count=0;const sample=()=>{const el=document.querySelector(".calendar-body-grid")||document.querySelector(".timeline-calendar");qaRebound.frames.push({time:performance.now(),offset:new DOMMatrixReadOnly(getComputedStyle(el).transform).m42});if(++count<36)requestAnimationFrame(sample);};requestAnimationFrame(sample);}},{capture:true,passive:true});
        const animate=Element.prototype.animate;
        Element.prototype.animate=function(frames,options){if(this.matches(".calendar-body-grid,.timeline-calendar"))qaRebound.returns.push({time:performance.now(),duration:options.duration,frames});return animate.call(this,frames,options);};
      });
      const p=await c.newPage();await p.goto(`http://127.0.0.1:${port}/?qa=immediate-rebound#calendar`);await p.waitForFunction(()=>typeof store!=="undefined");
      await p.evaluate(bottom=>{calendarView="week";renderCalendar({autoScroll:false});const root=document.querySelector("#planner-calendar"),s=root.querySelector(".calendar-timeline-scroller")||root;s.scrollTop=bottom?s.scrollHeight:0;},bottom);await p.waitForTimeout(250);
      const before=await p.evaluate(()=>({header:document.querySelector(".timeline-days").getBoundingClientRect().top,records:JSON.stringify(store.listItems())}));
      const h=await p.locator(".timeline-days").boundingBox(),b=await p.locator(".time-axis").boundingBox();
      await p.mouse.move(b.x+b.width+100,h.y+h.height+100);await p.mouse.wheel(0,bottom?120:-120);
      const immediate=await p.evaluate(()=>{const e=document.querySelector(".calendar-body-grid")||document.querySelector(".timeline-calendar");return{active:e.getAnimations().length,offset:new DOMMatrixReadOnly(getComputedStyle(e).transform).m42};});
      if(port===8034)check(immediate.active===1,"Return did not exist immediately after wheel input");
      await p.waitForTimeout(650);
      const result=await p.evaluate(before=>{const e=document.querySelector(".calendar-body-grid")||document.querySelector(".timeline-calendar");return{...qaRebound,headerMoved:document.querySelector(".timeline-days").getBoundingClientRect().top-before.header,recordsUnchanged:JSON.stringify(store.listItems())===before.records,settled:!e.style.transform&&!e.getAnimations().length};},before);
      check(result.settled&&result.recordsUnchanged&&Math.abs(result.headerMoved)<.01,"Cleanup/header/data regression");
      const startLatency=result.returns[0].time-result.wheel[0],sign=bottom?-1:1;
      if(port===8034)check(startLatency<8,"Return scheduling exceeded immediate-input budget");
      const peak=Math.max(...result.frames.map(f=>f.offset*sign)),overshoot=-Math.min(...result.frames.map(f=>f.offset*sign));
      check(peak>30&&overshoot>1,"Whole-surface spring was lost");
      return{port,edge:bottom?"bottom":"top",immediate,startLatencyMs:startLatency,peakPx:peak,overshootPx:overshoot,...result};
    }finally{await c.close();}
  }
  for(const bottom of [false,true]){
    const before=await capture(8039,bottom,"historical-before"),local=await capture(8034,bottom,"local"),after=await capture(8039,bottom,"historical-after");
    check(JSON.stringify(before.returns[0].frames)===JSON.stringify(local.returns[0].frames)&&JSON.stringify(after.returns[0].frames)===JSON.stringify(local.returns[0].frames),"Copied motion changed beyond removing its idle wait");
    results.push({edge:bottom?"bottom":"top",before,local,after});
  }
  return{runtime:browser.version(),reference:"e592335 at local8039; same curve, intentionally removed idle pause",results};
}
