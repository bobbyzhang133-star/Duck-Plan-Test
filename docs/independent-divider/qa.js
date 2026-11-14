// Independent title/control/content/divider proof. Isolated fixture only; no user/API data.
async (page) => {
  const browser=page.context().browser(),origin="http://127.0.0.1:8034";
  const out="/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/independent-divider/";
  const contexts=new Set(),cases=[],errors=[],failed=[],blocked=[];
  let stage="start";
  const check=(v,m)=>{if(!v)throw new Error(m);};
  const relevant=a=>a.id.startsWith("duck-route-live")||/duck-(workspace|route-)/.test(a.effect?.pseudoElement||"");
  const expectations={
    835:{header:{x:98,y:0,width:715,height:158.25},title:{x:98,y:22,width:198.21875,height:44},controls:{x:98,y:90,width:715,height:45.25},body:{x:98,y:184.25,width:715,height:1490.203125}},
    1280:{header:{x:104,y:0,width:1148,height:96},title:{x:104,y:25.5,width:197.21875,height:44},controls:{x:820.71875,y:24.875,width:431.28125,height:45.25},body:{x:104,y:122,width:1148,height:1333.65625}}
  };
  async function setup(spec={}){
    const width=spec.width||835,height=spec.height||(width===835?746:900);
    const c=await browser.newContext({viewport:{width,height},serviceWorkers:"block",reducedMotion:spec.reduced?"reduce":"no-preference",hasTouch:!!spec.touch,isMobile:!!spec.touch});contexts.add(c);
    await c.route("**/*",r=>{const u=new URL(r.request().url());if(u.origin!==origin||u.pathname.startsWith("/api/")){blocked.push(u.origin+u.pathname);return r.abort();}return r.continue();});
    const p=await c.newPage();p.setDefaultTimeout(5000);p.setDefaultNavigationTimeout(10000);
    p.on("pageerror",e=>errors.push(e.message));p.on("requestfailed",r=>failed.push(new URL(r.url()).pathname));
    await p.goto(origin+"/?qa=independent-divider#calendar");await p.waitForFunction(()=>typeof store!=="undefined"&&store.listItems().length>0);
    return{c,p,width,height};
  }
  async function close(c){await c.close();contexts.delete(c);}
  async function clean(p){
    const r=await p.evaluate(()=>({attrs:[...document.documentElement.attributes].filter(a=>a.name.startsWith("data-page-transition")).length,names:document.querySelectorAll('[style*="view-transition-name"]').length,live:document.getAnimations().filter(a=>a.id.startsWith("duck-route-live")).length,active:document.querySelectorAll(".view.active").length,forms:document.querySelectorAll("#task-form").length}));
    check(!r.attrs&&!r.names&&!r.live&&r.active===1&&r.forms===1,"Cleanup failed "+JSON.stringify(r));return r;
  }
  async function frame(p,elapsed){
    return p.evaluate(async elapsed=>{
      if(elapsed!=null){document.getAnimations().filter(a=>a.id.startsWith("duck-route-live")||/duck-(workspace|route-)/.test(a.effect?.pseudoElement||"")).forEach(a=>{a.pause();a.currentTime=elapsed;});await new Promise(requestAnimationFrame);}
      const animations=document.getAnimations().filter(a=>a.id.startsWith("duck-route-live"));
      const measure=selector=>{const e=document.querySelector(selector);if(!e||!e.getBoundingClientRect().width)return null;const b=e.getBoundingClientRect(),s=getComputedStyle(e);return{rect:b.toJSON(),y:new DOMMatrixReadOnly(s.transform).m42,opacity:Number(s.opacity),background:s.backgroundColor,border:s.borderBottom,ariaHidden:e.getAttribute("aria-hidden"),own:animations.filter(a=>a.effect?.target===e).map(a=>({id:a.id,keys:a.effect.getKeyframes(),timing:a.effect.getTiming()}))};};
      return{elapsed,direction:document.documentElement.dataset.pageTransition,view:document.body.dataset.view,header:measure(".compact-topbar"),title:measure(".topbar-title"),controls:measure(".topbar-actions"),divider:measure(".topbar-divider"),body:measure(".view.active"),frame:measure(".planner-workspace"),calendarTitle:measure(".calendar-title-copy"),grid:measure("#planner-calendar"),pane:measure("#daily-task-panel"),roots:[...new Set(animations.map(a=>a.effect.target))].map(e=>({id:e.id,className:e.className})),overflow:document.documentElement.scrollWidth>innerWidth,dividerCount:document.querySelectorAll(".topbar-divider").length};
    },elapsed);
  }
  async function finish(p){
    await p.evaluate(()=>document.getAnimations().filter(a=>a.id.startsWith("duck-route-live")||/duck-(workspace|route-)/.test(a.effect?.pseudoElement||"")).forEach(a=>a.finish()));
    await p.waitForFunction(()=>!document.documentElement.dataset.pageTransition);return clean(p);
  }
  async function held(f,from,to,label){
    stage=label;await f.p.evaluate(from=>setView(from,true),from);await f.p.locator('.sidebar [data-view="'+to+'"]').click();
    await f.p.waitForFunction(()=>document.documentElement.dataset.pageTransitionPhase==="animate");const frames=[];
    for(const elapsed of[0,80,160,320,499]){frames.push(await frame(f.p,elapsed));if(elapsed===160)await f.p.screenshot({path:out+label+".png"});}
    const cleanup=await finish(f.p),end=await frame(f.p,null);
    for(const s of frames){check(!s.overflow,"Horizontal overflow");check(s.dividerCount===1,"Missing/duplicate divider");
      if(to==="calendar"){check(!s.divider&&!s.header&&s.roots.length===6,"Calendar individual pieces not restored");check(Math.abs(s.frame.y)<.01&&Math.abs(s.grid.y)>0.00001,"Calendar parent still moves as one piece");}
      else{check(s.header&&Math.abs(s.header.y)<.01&&s.roots.length===4,"Header parent moved or individual roots missing");check(s.title.own.length===2&&s.controls.own.length===2&&s.body.own.length===2&&s.divider.own.length===2,"Individual effect ownership missing");check(s.divider.ariaHidden==="true"&&s.divider.rect.height===1,"Divider is not a 1px decorative piece");}
    }
    if(to!=="calendar"){
      const s=frames[0],sign=s.direction==="forward"?1:-1;
      check(Math.abs(s.title.y-sign*48)<.01&&Math.abs(s.controls.y-sign*56)<.01&&Math.abs(s.body.y-sign*64)<.01,"Previous independent distances changed");
      const at80=frames[1];check(Math.abs(at80.title.y-at80.controls.y)>1&&Math.abs(at80.controls.y-at80.body.y)>1,"Individual stagger collapsed");
      check(frames.some(s=>Math.abs(s.divider.y)>1)&&Math.abs(frames.at(-1).divider.y)<.01,"Divider is stationary or does not settle");
      check(Math.abs(end.divider.rect.bottom-end.header.rect.bottom)<.1,"Divider resting strip no longer matches old bottom border");
    }
    cases.push({test:"held-independent-pieces",label,width:f.width,from,to,frames,end,cleanup});
  }
  try{
    for(const width of[835,1280]){
      const f=await setup({width});try{
        await f.p.evaluate(()=>setView("home",true));
        for(const theme of["light","dark"]){
          await f.p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);const rest=await frame(f.p,null),expected=expectations[width];
          for(const key of["header","title","controls","body"])for(const metric of["x","y","width","height"])check(Math.abs(rest[key].rect[metric]-expected[key][metric])<.1,"Rest geometry changed "+width+" "+theme+" "+key+" "+metric);
          check(rest.divider.background===(theme==="light"?"rgb(234, 229, 214)":"rgb(69, 67, 56)"),"Divider theme color changed");
          cases.push({test:"rest-geometry-theme",width,theme,rest});
        }
        await f.p.evaluate(()=>document.documentElement.dataset.theme="light");
        await held(f,"calendar","home","dashboard-forward-"+width);await held(f,"tasks","home","dashboard-back-"+width);await held(f,"tasks","calendar","calendar-back-"+width);
        if(width===835)for(const [from,to]of[["home","tasks"],["tasks","classes"],["classes","goals"],["goals","notes"],["notes","settings"]])await held(f,from,to,"section-"+to+"-835");
      }finally{await close(f.c);}
    }
    for(const spec of[{reduced:true},{width:390,height:844,touch:true}]){
      const f=await setup(spec);try{for(const to of["tasks","calendar"]){await f.p.locator((spec.touch?".phone-bottom-nav":".sidebar")+' [data-view="'+to+'"]').click();check(await f.p.evaluate(to=>document.body.dataset.view===to&&!document.documentElement.dataset.pageTransition,to),"Fallback not immediate");}cases.push({test:"immediate-fallback",spec,cleanup:await clean(f.p)});}finally{await close(f.c);}
    }
    const f=await setup();try{
      stage="trusted held checkbox";await f.p.evaluate(()=>setView("calendar",true));await f.p.locator('.sidebar [data-view="tasks"]').click();await f.p.waitForFunction(()=>document.documentElement.dataset.pageTransitionPhase==="animate");await f.p.evaluate(()=>new Promise(r=>setTimeout(r,220)));
      const point=await f.p.evaluate(()=>{const e=document.querySelector("#view-tasks input.task-check"),b=e.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2,id:e.dataset.taskId,before:store.listItems().map(t=>({id:t.id,completed:t.completed})),hit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===e};});await f.p.mouse.click(point.x,point.y,{delay:100});
      const changed=await f.p.evaluate(before=>store.listItems().filter(t=>before.find(b=>b.id===t.id)?.completed!==t.completed).map(t=>t.id),point.before);check(point.hit&&changed.length===1&&changed[0]===point.id,"Moving checkbox lost trusted input");await f.p.waitForFunction(()=>!document.documentElement.dataset.pageTransition);cases.push({test:"trusted-moving-checkbox",point,changed,cleanup:await clean(f.p)});
      stage="trusted Add Task";await f.p.evaluate(()=>setView("calendar",true));await f.p.locator('.sidebar [data-view="tasks"]').click();await f.p.waitForFunction(()=>document.documentElement.dataset.pageTransitionPhase==="animate");await f.p.evaluate(()=>new Promise(r=>setTimeout(r,220)));const add=await f.p.locator("#open-task-modal").boundingBox();await f.p.mouse.click(add.x+add.width/2,add.y+add.height/2);await f.p.locator("#task-modal").waitFor({state:"visible"});await f.p.locator("#close-task-modal").click();await f.p.waitForFunction(()=>!document.querySelector("#task-modal").open);cases.push({test:"trusted-moving-add-task",cleanup:await clean(f.p)});
    }finally{await close(f.c);}
    check(!errors.length&&!failed.length&&!blocked.length,"Unexpected error/request "+JSON.stringify({errors,failed,blocked}));return{runtime:browser.version(),cases,errors,failed,blocked,allSyntheticContextsClosed:contexts.size===0};
  }catch(error){return{runtime:browser.version(),stage,harnessError:error.message,cases,errors,failed,blocked};}
  finally{for(const c of contexts)await c.close();}
}
