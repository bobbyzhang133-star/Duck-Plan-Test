async page => {
 const base="/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/github-signin-20261124/";
 const results=[];
 for(const [width,height,touch] of (globalThis.duckMenuCases || [[320,568,true],[390,844,true],[844,390,true],[1024,768,false],[1440,900,false]])){
  const c=await page.context().browser().newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,serviceWorkers:"block"});
  const p=await c.newPage();p.setDefaultTimeout(8000);p.setDefaultNavigationTimeout(25000);
  const errors=[];p.on("pageerror",e=>errors.push(e.message));
  const check=(v,s)=>{if(!v)throw Error(s)};
  const activate=l=>touch?l.tap():l.click();
  const ready=()=>p.waitForFunction(()=>document.querySelector('#account-dialog').open&&!document.querySelector('#account-dialog').dataset.popupMotion);
  const menuReady=()=>p.waitForFunction(()=>!document.querySelector('#account-menu').hidden&&!document.querySelector('#account-menu').dataset.popupMotion);
  try{
   await c.addInitScript(()=>{window.accountSamples=[];const original=Element.prototype.animate;Element.prototype.animate=function(frames,options){if(this.closest?.('#account-dialog'))window.accountSamples.push({target:this.className,frames,options});return original.call(this,frames,options)}});
   await p.goto('http://127.0.0.1:8788/#calendar');await p.waitForFunction(()=>typeof store!=='undefined'&&store.configured);
   const entry=p.locator('.calendar-account-entry'),menu=p.locator('#account-menu'),dialog=p.locator('#account-dialog');
   check(await entry.innerText()==='Account','account label');
   check(await p.locator('.primary-nav [data-view="settings"]').count()===0,'one Settings location');
   await activate(entry);await menuReady();
   const menuBox=await menu.boundingBox();check(menuBox.x>=0&&menuBox.y>=0&&menuBox.x+menuBox.width<=width&&menuBox.y+menuBox.height<=height,'menu fits');
   check(await menu.getByRole('menuitem').count()===2,'Settings and Sign in menu');
   await p.screenshot({path:base+`menu-${width}x${height}.png`});
   await p.keyboard.press('End');check(await p.locator('[data-account-menu-action="settings"]').evaluate(e=>e===document.activeElement),'End key');
   await p.keyboard.press('Home');check(await p.locator('[data-account-menu-action="sign-in"]').evaluate(e=>e===document.activeElement),'Home key');
   await activate(p.locator('[data-account-menu-action="sign-in"]'));
   await ready();check(await dialog.locator('#account-settings').count()===1,'same form root');
   check(await dialog.locator('#github-sign-in').isEnabled(),'GitHub enabled by fixture configuration');
   const githubBox=await dialog.locator('#github-sign-in').boundingBox();check(githubBox.width>=44&&githubBox.height>=44,'GitHub touch target');
   const box=await dialog.boundingBox();check(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,'dialog fits');
   const motion=await p.evaluate(()=>window.accountSamples);
   check(motion.filter(a=>a.target==='popup-morph-tile').length===9,'nine shell slices');
   check(motion.filter(a=>a.target==='account-dialog-surface').every(a=>a.frames.every(f=>!f.transform)),'fields never scale');
   await p.screenshot({path:base+`signin-${width}x${height}.png`});
   await activate(dialog.locator('[data-account-mode="sign-up"]'));await p.waitForTimeout(350);
   check(await dialog.locator('#sign-up-form').isVisible(),'signup panel');
   await activate(dialog.locator('[data-account-mode="sign-in"]'));await p.waitForTimeout(350);
   await dialog.locator('#show-recover').scrollIntoViewIfNeeded();await activate(dialog.locator('#show-recover'));await p.waitForTimeout(350);
   check(await dialog.locator('#recover-form').isVisible(),'recovery panel');
   await dialog.evaluate(e=>e.addEventListener('cancel',()=>window.closeStartState={open:e.open,motion:e.dataset.popupMotion},{once:true}));
   await p.keyboard.press('Escape');check(await p.evaluate(()=>window.closeStartState.open&&window.closeStartState.motion==='closing'),'close stays mounted');
   await dialog.waitFor({state:'hidden'});check(await entry.evaluate(e=>e===document.activeElement),'focus returned');
   check(await p.locator('#view-settings #account-settings').count()===1,'forms restored');
   await activate(entry);await menuReady();await p.keyboard.press('Escape');await menu.waitFor({state:'hidden'});check(await entry.evaluate(e=>e===document.activeElement),'menu Escape restores focus');
   await activate(entry);await menuReady();await p.mouse.click(width-3,height-3);await menu.waitFor({state:'hidden'});
   await activate(entry);await menuReady();await activate(p.locator('[data-account-menu-action="settings"]'));
   await p.waitForFunction(()=>document.body.dataset.view==='settings');await menu.waitFor({state:'hidden'});
   check(await p.locator('#main-content').evaluate(e=>e===document.activeElement),'Settings route focus');
   await p.screenshot({path:base+`settings-${width}x${height}.png`});
   await p.evaluate(()=>setView('calendar'));await p.waitForTimeout(400);
   if(!touch){
    const avatar=p.locator('.profile-card .avatar');await avatar.click();await menuReady();await p.screenshot({path:base+`folded-menu-${width}.png`});
    await p.locator('[data-account-menu-action="sign-in"]').click();await ready();await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    check(await avatar.evaluate(e=>getComputedStyle(e).visibility==='visible'),'folded avatar restored');
    await p.locator('.sidebar-rail-toggle').click();await p.waitForTimeout(450);await p.locator('.profile-card').click();await menuReady();await p.screenshot({path:base+`expanded-menu-${width}.png`});await p.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
   }
   check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow');check(!errors.length,errors.join(';'));
   results.push({viewport:`${width}x${height}`,input:touch?'emulated touch + keyboard':'mouse + keyboard',status:'PASS',menu:menuBox,dialog:box,checks:['menu placement','both routes','keyboard/outside dismissal','open and close','crisp content','form modes','focus return']});
  }catch(e){await p.screenshot({path:base+`failure-${width}x${height}.png`});results.push({viewport:`${width}x${height}`,status:'FAIL',error:e.message,errors})}finally{await c.close()}
 }
 return {runtime:page.context().browser().version(),mode:'isolated local Worker/D1, signed out; dummy GitHub OAuth config, not real OAuth',results};
}