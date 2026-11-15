(() => {
  'use strict';
  if (!window.DuckNativeAlarms) return;
  const records = new Map();
  let queue = Promise.resolve();
  let permission = 'notDetermined';
  let knownTasks = new Map();
  let scope = 'local', generation = 0;
  const enabledKey = () => `duckplan-native-alarms-enabled:${scope}`;
  const readEnabled = () => { try { return window.localStorage?.getItem(enabledKey()) !== 'off'; } catch { return true; } };
  let deviceEnabled = readEnabled();
  const setEnabled = value => { deviceEnabled = value; try { window.localStorage?.setItem(enabledKey(), value ? 'on' : 'off'); } catch {} };
  const changed = () => window.dispatchEvent?.(new Event('duckplan:work-alert-capability'));
  const copy = document.querySelector('#task-alarm-status');
  const enable = document.querySelector('#enable-task-alarms');
  const disable = document.querySelector('#disable-task-alarms');
  const stale = () => new Error('The alarm account or device setting changed. Try again.');
  const request = (body, token = generation) => {
    const operation = queue.then(() => {
      if (token !== generation) throw stale();
      return window.DuckNativeAlarms.request(body);
    });
    queue = operation.catch(() => {});
    return operation;
  };
  function render() {
    document.querySelector('#task-alarms-heading').textContent = 'Ringing task alarms';
    document.querySelector('#task-alarms-description').textContent = 'iPhone alarms ring at your chosen time with Stop and Snooze. Choose a sound on each task. Alarms are scheduled on this device and can ring while DuckPlan is closed or offline.';
    copy.textContent = !deviceEnabled ? 'Ringing alarms are canceled on this device. Enable them again to use saved task settings.' : permission === 'authorized' ? 'iPhone alarms are allowed. Saved alarms are managed by iOS.'
      : permission === 'denied' ? 'Alarm permission is off. Allow DuckPlan alarms in iPhone Settings.'
      : 'Enable iPhone alarms before scheduling your first task alarm.';
    enable.hidden = permission === 'authorized' && deviceEnabled;
    enable.disabled = false;
    enable.textContent = 'Allow iPhone alarms';
    disable.hidden = records.size === 0;
    disable.textContent = 'Cancel all device alarms';
    document.querySelector('#native-alarm-options').hidden = false;
    document.querySelector('#task-alarm-legend').textContent = 'Ringing task alarm';
    document.querySelector('#alarm-date-label').textContent = 'Alarm date and time';
    document.querySelector('.notification-help').textContent = 'Deadline reminders appear while DuckPlan is open. Ringing alarms and normal notifications have separate task controls and permissions.';
    document.querySelector('.notification-permission').hidden = true;
    document.querySelector('#enable-device-notifications').hidden = true;
    document.querySelector('#notification-permission-help').hidden = true;
  }
  async function refresh() {
    const token = generation;
    const status = await request({ action: 'status' });
    if (token !== generation) return;
    permission = status.permission;
    render();
    const data = await request({ action: 'list' });
    if (token !== generation) return;
    records.clear();
    data.alarms.forEach(alarm => records.set(alarm.item_id, alarm));
    render();
  }
  enable.addEventListener('click', async () => {
    const token = generation;
    try { await request({ action: 'authorize', scope, deviceEnabled: true }); if (token !== generation) return; setEnabled(true); await refresh(); changed(); }
    catch (error) { if (token === generation) copy.textContent = String(error.message || error); }
  });
  disable.addEventListener('click', async () => {
    const token = ++generation;
    setEnabled(false); records.clear(); render();
    try { await request({ action: 'cancelAll', scope, deviceEnabled: false }, token); if (token !== generation) return; await refresh(); }
    catch (error) { if (token === generation) copy.textContent = String(error.message || error); }
    finally { if (token === generation) changed(); }
  });
  window.DuckTaskAlarms = {
    native: true, refresh, get: id => records.get(id), canSave: () => deviceEnabled,
    get available() { return permission === 'authorized' && deviceEnabled; },
    async setContext(nextScope, tasks) {
      if (nextScope !== scope) { scope = nextScope; generation += 1; records.clear(); deviceEnabled = readEnabled(); }
      knownTasks = new Map(tasks.map(task => [task.id, task]));
      const token = generation;
      await request({ action: 'context', scope, deviceEnabled, activeTaskIDs: tasks.filter(task => !task.completed && !task.deleted && !task.deleted_at).map(task => task.id) }, token);
      if (token !== generation) return;
      await refresh();
    },
    async detach() { const token = ++generation; records.clear(); knownTasks.clear(); await request({ action: 'cancelAll' }, token); },
    async save(taskID, wallTime, { title, sound = 'system', snoozeMinutes = 5, timeZone: zone, scope: owner = scope } = {}) {
      const token = generation;
      if (owner !== scope) throw new Error('The alarm account changed. Try again.');
      if (wallTime && !deviceEnabled) throw new Error('Ringing alarms are canceled on this device. Enable them again before scheduling.');
      if (!wallTime) { await request({ action: 'cancel', taskID }, token); if (token === generation) records.delete(taskID); return; }
      const timeZone = zone || window.DuckReminderDomain.browserTimeZone();
      const resolved = window.DuckReminderDomain.wallTimeToEpoch(wallTime.slice(0, 10), wallTime.slice(11, 16), timeZone);
      if (!resolved.ok) throw new Error('That time does not exist in your time zone.');
      const data = await request({ action: 'schedule', taskID, title: title || knownTasks.get(taskID)?.title || 'Task',
        fireAt: resolved.epoch, sound, snoozeMinutes: Number(snoozeMinutes), scope: owner }, token);
      if (token !== generation) throw stale();
      records.set(taskID, data.alarm);
      await refresh();
    },
  };
  const refreshVisible = () => { const token = generation; refresh().catch(error => { if (token === generation) copy.textContent = String(error.message || error); }); };
  window.addEventListener('focus', refreshVisible);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshVisible(); });
})();
