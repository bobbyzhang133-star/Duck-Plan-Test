async page => {
  const browser=page.context().browser(),origin="https://duckplan-latest.ocs-learning.workers.dev";
  const a=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:"allow"}),b=await browser.newContext({serviceWorkers:"block"});
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  let p,taskId,stage="sign-up",result;
  try{
    const account={email:`push-activation-${Date.now()}@example.test`,password:`Notification-QA-${Date.now()}-${Math.random()}`};
    const signup=await a.request.post(origin+"/api/auth/sign-up",{data:account,headers:{Origin:origin}});check(signup.status()===201,"Fixture signup failed");
    const signin=await b.request.post(origin+"/api/auth/sign-in",{data:account,headers:{Origin:origin}});check(signin.status()===200,"Second-session sign-in failed");
    stage="live notification config";
    const response=await a.request.get(origin+"/api/push/config"),config=await response.json();
    const peer=await b.request.get(origin+"/api/push/config"),peerConfig=await peer.json();
    const key=Buffer.from(config.publicKey||"","base64url");
    check(response.status()===200&&config.available===true&&key.length===65&&key[0]===4,"Live push configuration not active");
    check(peerConfig.publicKey===config.publicKey&&peerConfig.available,"Client configuration differs");
    stage="Settings availability";p=await a.newPage();const errors=[];p.on("pageerror",e=>errors.push(e.message));
    await p.goto(origin+"/#settings");await p.waitForFunction(()=>typeof store!=="undefined"&&store.mode==="cloud"&&workAlertContextReady);
    await p.waitForFunction(()=>!document.querySelector("#task-notification-status").textContent.includes("awaiting server activation")&&window.DuckTaskNotifications.canSave());
    const ui=await p.evaluate(()=>({copy:document.querySelector("#task-notification-status").textContent,action:document.querySelector("#enable-task-notifications").textContent,buttonDisabled:document.querySelector("#enable-task-notifications").disabled,permission:window.Notification?.permission,canSave:window.DuckTaskNotifications.canSave(),availableOnThisDevice:window.DuckTaskNotifications.available}));
    check(ui.canSave&&!/awaiting server activation/.test(ui.copy),"UI still gated by server activation");
    await p.locator('section[aria-labelledby="task-notifications-heading"]').screenshot({path:"/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/cloudflare-latest-20261119/notifications-ready.png"});
    stage="save and peer persistence";
    taskId=await p.evaluate(async()=>{const t=await store.upsertItem({id:crypto.randomUUID(),title:"Notification setup verification",priority:"Medium",durationMinutes:45,completed:false});return t.id;});
    const wallTime=new Date(Date.now()+3600000).toISOString().slice(0,16),expected=Date.parse(wallTime+"Z");
    await p.evaluate(async({id,wallTime})=>{await window.DuckTaskNotifications.refresh();await window.DuckTaskNotifications.save(id,wallTime,{timeZone:"UTC"});},{id:taskId,wallTime});
    const saved=await b.request.get(origin+"/api/alarms"),alarms=(await saved.json()).alarms;
    check(saved.status()===200&&alarms.some(r=>r.item_id===taskId&&r.fire_at===expected&&r.time_zone==="UTC"),"Notification time did not persist to peer");
    stage="cancel";
    await p.evaluate(id=>window.DuckTaskNotifications.save(id,null),taskId);
    const cancelled=await b.request.get(origin+"/api/alarms");check(!(await cancelled.json()).alarms.some(r=>r.item_id===taskId),"Cancellation did not persist");
    await p.evaluate(id=>store.deleteItem(id),taskId);taskId=null;
    check(!errors.length,errors.join(";"));
    result={runtime:browser.version(),origin,pushAvailable:true,publicKeyBytes:key.length,keyConsistentAcrossSessions:true,ui,savedNotificationTimeSeenByPeer:true,cancelSeenByPeer:true,errors,physicalPushDelivery:"NOT RUN: this disposable browser was not enrolled for push",testDevicesRegistered:0,status:"PASS"};
    return result;
  }catch(error){return{stage,error:error.message,status:"FAIL"};}
  finally{
    if(taskId){await a.request.delete(origin+"/api/alarms/"+taskId,{headers:{Origin:origin}}).catch(()=>{});await a.request.delete(origin+"/api/items/"+taskId,{headers:{Origin:origin}}).catch(()=>{});}
    await a.close();await b.close();
  }
}
