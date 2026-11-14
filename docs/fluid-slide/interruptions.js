// Targeted final live/native lifecycle interruptions in an isolated local fixture.
async(page)=>{
 const browser=page.context().browser(),c=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:"block"}),cases=[],errors=[],failed=[];
 try{
  await c.route("**/*",r=>{const u=new URL(r.request().url());return u.origin==="http://127.0.0.1:8034"&&!u.pathname.startsWith("/api/")?r.continue():r.abort();});
  const p=await c.newPage();p.setDefaultTimeout(5000);p.setDefaultNavigationTimeout(10000);p.on("pageerror",e=>errors.push(e.message));p.on("requestfailed",r=>failed.push({url:r.url(),failure:r.failure()?.errorText}));
  await p.goto("http://127.0.0.1:8034/?qa=smooth-interruptions#calendar");await p.waitForFunction(()=>typeof store!=="undefined"&&store.listItems().length>0);
  const end=()=>p.waitForFunction(()=>!document.documentElement.dataset.pageTransition),active=()=>p.waitForFunction(()=>document.documentElement.dataset.pageTransitionPhase==="animate");
  const visit=route=>p.locator(`.sidebar [data-view="${route}"]`).click();
  async function check(test){const state=await p.evaluate(()=>({view:document.body.dataset.view,attrs:[...document.documentElement.attributes].filter(a=>a.name.startsWith("data-page-transition")).length,names:document.querySelectorAll('[style*="view-transition-name"]').length,animations:document.getAnimations().filter(a=>a.id.startsWith("duck-route-live")||/duck-(workspace|route-)/.test(a.effect?.pseudoElement||"")).length,active:document.querySelectorAll(".view.active").length}));if(state.attrs||state.names||state.animations||state.active!==1)throw new Error("Cleanup failed "+JSON.stringify(state));cases.push({test,passed:true,state});}
  await p.evaluate(()=>{for(const route of["tasks","calendar","settings","home","tasks"])navigateView(route,true,document.querySelector(`.sidebar [data-view="${route}"]`));});await end();if(await p.evaluate(()=>document.body.dataset.view)!=="tasks")throw new Error("Stale rapid route won");await check("rapid-reverse-latest-route");
  await visit("calendar");await end();await visit("tasks");await active();await p.locator("#global-search").focus();await end();await p.locator("#global-search").fill("physics");await p.locator("#global-search").fill("");await check("keyboard-focus-search");
  await visit("calendar");await end();await visit("tasks");await active();await p.setViewportSize({width:1300,height:920});await end();await check("resize-cleanup");
  return{runtime:browser.version(),cases,errors,failed,allSyntheticContextsClosed:true};
 }finally{await c.close();}
}
