async (page) => {
  const browser = page.context().browser(), origin = "http://127.0.0.1:18814";
  const out = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/axis-deduplication-20261125/";
  const results = [], assert = (value, message) => { if (!value) throw Error(message); };
  for (const [name, width, height, touch] of [["small",320,568,true],["phone",390,844,true],["landscape",844,390,true],["ipad",835,1112,true],["desktop",1280,900,false]]) {
    const context = await browser.newContext({ viewport: {width,height}, hasTouch:touch, serviceWorkers:"block", reducedMotion:"reduce" });
    const p = await context.newPage(), result = {name,viewport:[width,height],touchEmulated:touch,input:touch?"emulated touchscreen tap":"mouse click",errors:[],fixtureBacked:true};
    p.setDefaultTimeout(20000); p.on("pageerror", e => result.errors.push(e.message));
    const cooldown = () => context.request.post(origin+"/__axis-qa",{headers:{Origin:origin},data:{}});
    async function action(control, method="POST") {
      result.stage = method + " " + await control.getAttribute("id") + " " + await control.textContent();
      const response = p.waitForResponse(r => new URL(r.url()).pathname==="/api/axis" && r.request().method()===method);
      if (touch) await control.tap(); else await control.click();
      const r = await response, data = await r.json(); assert(r.ok(),"Axis error "+r.status()); return data;
    }
    try {
      const account = {email:`axis-dedup-${name}-${Date.now()}@fixture.test`,password:`Fixture-${crypto.randomUUID()}`};
      const signup = await context.request.post(origin+"/api/auth/sign-up",{headers:{Origin:origin},data:account});assert(signup.status()===201,"Signup failed");
      await p.goto(origin+"/#settings");
      await p.waitForFunction(()=>{try{return store.mode==="cloud"&&!!document.querySelector("#axis-form")}catch{return false}});
      await p.locator("#axis-form input").fill("https://fixture.myschoolapp.com/podium/feed/iCal.aspx?z=synthetic-axis-fixture");
      const connected = await action(p.locator('#axis-form button[type="submit"]'));
      assert(connected.added===4 && connected.autoCompleted===1,"Wrong first import count");
      await p.waitForFunction(()=>store.listItems().length===4);
      const ids = await p.evaluate(()=>store.listItems().map(t=>t.id).sort());
      for (let i=0;i<3;i++) {
        await cooldown(); const synced = await action(p.locator("#axis-sync-now"));
        assert(synced.added===0 && synced.autoCompleted===0,"Regenerated UIDs inserted copies");
      }
      await action(p.locator("#axis-disconnect"),"DELETE");
      await p.locator("#axis-form input").fill("https://fixture.myschoolapp.com/podium/feed/iCal.aspx?z=synthetic-axis-fixture");
      assert((await action(p.locator('#axis-form button[type="submit"]'))).added===0,"Reconnect duplicated tasks");
      await p.reload();await p.waitForFunction(()=>{try{return store.mode==="cloud"&&store.listItems().length===4}catch{return false}});
      assert(JSON.stringify(await p.evaluate(()=>store.listItems().map(t=>t.id).sort()))===JSON.stringify(ids),"Identity changed after reload");
      assert(await p.evaluate(()=>store.listItems().filter(t=>t.completed).length===1),"Completion choice lost");
      await p.goto(origin+"/?axis-qa=tasks#tasks");await p.waitForFunction(()=>document.body.dataset.view==="tasks");
      await p.screenshot({path:out+name+".png",fullPage:true});
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Viewport overflow");
      assert(!result.errors.length,"Page errors");
      result.status="PASS"; result.checks={connect:true,repeatedSyncs:3,reconnect:true,reload:true,taskCount:4,identicalSimultaneousAssignments:2};
    } catch(error) {result.status="FAIL";result.error=error.message;}
    finally {await context.close();} results.push(result);
  }
  return {runtime:browser.version(),origin,productionWrites:false,results};
}
