async page=>{
const browser=page.context().browser(),results=[],baseline="@keyframes task-finish { 0% { opacity: .96; transform: scale(1); } 35% { opacity: .9; transform: translate(var(--completion-pop-x,0px),var(--completion-pop-y,-20px)) scale(var(--completion-pop-scale,2)); } 100% { opacity: 0; transform: scale(.99) translateY(1px); } }";
for(const width of [835,390]){
const captures=[];
for(const original of [true,false]){
 const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:"block"}),p=await c.newPage();
 try{
 await p.goto("http://127.0.0.1:8042/?demo=completion-20261122#calendar");await p.waitForFunction(()=>typeof store!=="undefined"&&store.listItems().length===8);await p.waitForTimeout(500);
 if(original)await p.addStyleTag({content:baseline});
 await p.locator('#daily-task-panel input[data-task-id="completion-20261122-1"]').click();
 const motion=await p.evaluate(async()=>{
 const e=document.querySelector(".task-completion-echo"),a=e.getAnimations()[0];a.pause();const frames=[];
 for(const t of [0,150.5,200,300,420]){a.currentTime=t;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const s=getComputedStyle(e);frames.push({t,transform:s.transform,opacity:s.opacity})}
 return {duration:a.effect.getTiming().duration,easing:getComputedStyle(e).animationTimingFunction,frames};
 });
 captures.push({original,...motion});
 }finally{await c.close()}
}
if(captures.some(c=>c.duration!==430||c.easing!=="ease"))throw Error("Original timing was not restored");
if(JSON.stringify(captures[0].frames.slice(1))!==JSON.stringify(captures[1].frames.slice(1)))throw Error("Return curve changed");
if(Number(captures[1].frames[0].transform.match(/matrix\(([^,]+)/)[1])<=1)throw Error("Initial appearance is not enlarged");
results.push({width,captures,returnCurveMatches:true});
}
return {runtime:browser.version(),results};
}
