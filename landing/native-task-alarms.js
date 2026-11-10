(() => {
  'use strict';
  if (!window.DuckNativeAlarms) return;
  const records = new Map();
  let queue = Promise.resolve();
  let permission = 'notDetermined';
  let knownTasks = new Map();
  const copy = document.querySelector('#task-alarm-status');
  const enable = document.querySelector('#enable-task-alarms');
  const disable = document.querySelector('#disable-task-alarms');
  const request = body => {
    const operation = queue.then(() => window.DuckNativeAlarms.request(body));
    queue = operation.catch(() => {});
    return operation;
  };
  function render() {
    document.querySelector('#task-alarms-heading').textContent = 'Ringing task alarms';
    document.querySelector('#task-alarms-description').textContent = 'iPhone alarms ring at your chosen time with Stop and Snooze. Choose a sound on each task. Alarms are scheduled on this device and can ring while DuckPlan is closed or offline.';
    copy.textContent = permission === 'authorized' ? 'iPhone alarms are allowed. Saved alarms are managed by iOS.'
      : permission === 'denied' ? 'Alarm permission is off. Allow DuckPlan alarms in iPhone Settings.'
      : 'Enable iPhone alarms before scheduling your first task alarm.';
    enable.hidden = permission === 'authorized';
    enable.disabled = false;
    enable.textContent = 'Allow iPhone alarms';
    disable.hidden = records.size === 0;
    disable.textContent = 'Cancel all device alarms';
    document.querySelector('#native-alarm-options').hidden = false;
    document.querySelector('#task-alarm-legend').textContent = 'Ringing task alarm';
    document.querySelector('#alarm-date-label').textContent = 'Alarm date and time';
    document.querySelector('.notification-help').textContent = 'Deadline reminders appear while DuckPlan is open. For a ringing alarm while it is closed, set a separate Ringing task alarm on the task.';
    document.querySelector('.notification-permission').hidden = true;
    document.querySelector('#enable-device-notifications').hidden = true;
    document.querySelector('#notification-permission-help').hidden = true;
  }
  async function refresh() {
    const status = await request({ action: 'status' });
    permission = status.permission;
    render();
    const data = await request({ action: 'list' });
    records.clear();
    data.alarms.forEach(alarm => records.set(alarm.item_id, alarm));
    render();
  }
  enable.addEventListener('click', async () => {
    try { await request({ action: 'authorize' }); await refresh(); }
    catch (error) { copy.textContent = String(error.message || error); }
  });
  disable.addEventListener('click', async () => {
    try { await request({ action: 'cancelAll' }); await refresh(); }
    catch (error) { copy.textContent = String(error.message || error); }
  });
  window.DuckTaskAlarms = {
    native: true, refresh, get: id => records.get(id), canSave: () => true,
    async setContext(scope, tasks) {
      knownTasks = new Map(tasks.map(task => [task.id, task]));
      await request({ action: 'context', scope, activeTaskIDs: tasks.filter(task => !task.completed).map(task => task.id) });
      await refresh();
    },
    async detach() { await request({ action: 'cancelAll' }); records.clear(); },
    async save(taskID, wallTime, { title, sound = 'system', snoozeMinutes = 5 } = {}) {
      if (!wallTime) { await request({ action: 'cancel', taskID }); records.delete(taskID); return; }
      const timeZone = window.DuckReminderDomain.browserTimeZone();
      const resolved = window.DuckReminderDomain.wallTimeToEpoch(wallTime.slice(0, 10), wallTime.slice(11, 16), timeZone);
      if (!resolved.ok) throw new Error('That time does not exist in your time zone.');
      const data = await request({ action: 'schedule', taskID, title: title || knownTasks.get(taskID)?.title || 'Task',
        fireAt: resolved.epoch, sound, snoozeMinutes: Number(snoozeMinutes) });
      records.set(taskID, data.alarm);
      await refresh();
    },
  };
  window.addEventListener('focus', () => refresh().catch(error => { copy.textContent = String(error.message || error); }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh().catch(error => { copy.textContent = String(error.message || error); }); });
})();
