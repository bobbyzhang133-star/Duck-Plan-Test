(() => {
  'use strict';
  if (window.DuckNativeAlarms) return;
  const records = new Map();
  const copy = document.querySelector('#task-alarm-status');
  const enable = document.querySelector('#enable-task-alarms');
  const disable = document.querySelector('#disable-task-alarms');
  let available = false;
  async function api(method,path,body) {
    const response = await fetch(`/api${path}`,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save the alarm.');
    return data;
  }
  async function refresh() {
    records.clear(); available=false;
    if (!window.DUCKPLAN_CLOUD?.apiUrl) { copy.textContent='Sign in on the hosted DuckPlan app to schedule task notifications.'; enable.disabled=true; return; }
    try {
      const config=await api('GET','/push/config');
      const data=await api('GET','/alarms');
      data.alarms.forEach(alarm=>records.set(alarm.item_id,alarm));
      available=true;
      const registration=await window.DuckPlanApp.ready;
      const subscription=await registration?.pushManager?.getSubscription();
      copy.textContent=!config.available?'Notification delivery is awaiting server activation. You can save notification times now.':subscription?'Task notifications enabled on this device. Other devices must opt in separately.':'Enable this device to receive task notifications, including while DuckPlan is closed. On iPhone, open DuckPlan from your Home Screen first.';
      enable.disabled=!config.available || !registration?.pushManager || !('Notification' in window);
      enable.hidden=Boolean(subscription);
      disable.hidden=!subscription;
    } catch { copy.textContent='Sign in to schedule task notifications and enable this device.'; enable.disabled=true; disable.hidden=true; }
  }
  enable.addEventListener('click', async()=>{
    enable.disabled=true;
    try {
      // Request permission directly from this user gesture (required on iOS).
      if (await Notification.requestPermission()!=='granted') throw new Error('Allow notifications in device settings to receive alarms.');
      const {publicKey}=await api('GET','/push/config');
      const bytes=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
      const registration=await window.DuckPlanApp.ready;
      const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
      try { await api('POST','/push/devices',{endpoint:subscription.endpoint}); }
      catch(error) { await subscription.unsubscribe(); throw error; }
      await refresh();
    } catch(error) { copy.textContent=error.message; enable.disabled=false; }
  });
  disable.addEventListener('click',async()=>{
    try {
      const registration=await window.DuckPlanApp.ready;
      const subscription=await registration?.pushManager?.getSubscription();
      if (subscription) { await api('DELETE','/push/devices',{endpoint:subscription.endpoint}); await subscription.unsubscribe(); }
      await refresh();
    } catch(error) {copy.textContent=error.message;}
  });
  window.DuckTaskAlarms={refresh, get:(id)=>records.get(id), canSave:()=>available,
    async detach() {
      const registration=await window.DuckPlanApp.ready;
      const subscription=await registration?.pushManager?.getSubscription();
      if(subscription) { await api('DELETE','/push/devices',{endpoint:subscription.endpoint}); await subscription.unsubscribe(); }
      records.clear(); available=false;
    },
    async save(taskId,wallTime) {
      if (!wallTime) { if(records.has(taskId)) await api('DELETE',`/alarms/${encodeURIComponent(taskId)}`); records.delete(taskId); return; }
      const timeZone=window.DuckReminderDomain.browserTimeZone();
      const resolved=window.DuckReminderDomain.wallTimeToEpoch(wallTime.slice(0,10),wallTime.slice(11,16),timeZone);
      if(!resolved.ok) throw new Error('That alarm time does not exist in your time zone.');
      const {alarm}=await api('PUT',`/alarms/${encodeURIComponent(taskId)}`,{fireAt:resolved.epoch,timeZone});
      records.set(taskId,alarm);
    }
  };
})();
