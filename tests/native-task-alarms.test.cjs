const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const Domain = require('../landing/reminder-domain.js');

function setup({ beforeRequest } = {}) {
  const elements = new Map();
  const calls = [];
  const saved = new Map();
  let denied = false;
  const document = { addEventListener() {}, querySelector(id) {
    if (!elements.has(id)) elements.set(id, { hidden: false, disabled: false, textContent: '',
      events: {}, addEventListener(name, callback) { this.events[name] = callback; } });
    return elements.get(id);
  } };
  const window = { addEventListener() {}, DuckReminderDomain: Domain, DuckNativeAlarms: {
    async request(body) {
      calls.push(body);
      await beforeRequest?.(body);
      if (body.action === 'status') return { permission: denied ? 'denied' : 'authorized' };
      if (body.action === 'authorize') { if (denied) throw new Error('Permission denied'); return { permission: 'authorized' }; }
      if (body.action === 'list') return { alarms: [...saved.values()] };
      if (body.action === 'context') { for (const id of saved.keys()) if (!body.activeTaskIDs.includes(id)) saved.delete(id); }
      if (body.action === 'schedule') {
        if (denied) throw new Error('Permission denied');
        const alarm = { item_id: body.taskID, fire_at: body.fireAt, sound: body.sound, snoozeMinutes: body.snoozeMinutes };
        saved.set(body.taskID, alarm); return { alarm };
      }
      if (body.action === 'cancel') saved.delete(body.taskID);
      if (body.action === 'cancelAll') saved.clear();
      return { ok: true };
    },
  } };
  vm.runInNewContext(fs.readFileSync('landing/native-task-alarms.js', 'utf8'), { window, document, Map, Number });
  return { api: window.DuckTaskAlarms, window, elements, calls, saved, deny() { denied = true; } };
}
test('native task alarms use the selected sound/snooze and serialize schedule and cancellation', async () => {
  const { api, calls } = setup();
  await api.setContext('local', [{ id: 'essay', title: 'Write essay' }]);
  await api.save('essay', '2030-05-02T14:00', { title: 'Write essay', sound: 'bright', snoozeMinutes: 10 });
  const schedule = calls.find(call => call.action === 'schedule');
  assert.equal(schedule.sound, 'bright');
  assert.equal(schedule.snoozeMinutes, 10);
  assert.equal(schedule.title, 'Write essay');
  assert.equal(api.get('essay').sound, 'bright');
  await api.save('essay', '');
  assert.equal(api.get('essay'), undefined);
});
test('native reconciliation removes completed/deleted tasks and sign-out cancels device alarms', async () => {
  const { api, calls, saved } = setup();
  await api.setContext('user-a', [{ id: 'essay', completed: false }, { id: 'quiz', completed: true }]);
  const context = calls.find(call => call.action === 'context');
  assert.deepEqual(Array.from(context.activeTaskIDs), ['essay']);
  assert.equal(context.deviceEnabled, true, 'native background sync must receive this owner’s device choice');
  saved.set('essay', { item_id: 'essay' });
  await api.setContext('user-a', []);
  assert.equal(api.get('essay'), undefined);
  saved.set('quiz', { item_id: 'quiz' });
  await api.detach();
  assert.equal(saved.size, 0);
});
test('denied native permission is reported and failed scheduling cannot produce a saved alarm', async () => {
  const { api, elements, deny } = setup();
  deny();
  await api.refresh();
  assert.match(elements.get('#task-alarm-status').textContent, /permission is off/);
  await assert.rejects(api.save('essay', '2030-05-02T14:00', { title: 'Essay' }), /Permission denied/);
  assert.equal(api.get('essay'), undefined);
  await api.detach(); // A failed request must not poison the request queue.
});
test('native alarm adapter leaves ordinary web browsers unchanged', () => {
  const original = {};
  const window = { DuckTaskAlarms: original };
  vm.runInNewContext(fs.readFileSync('landing/native-task-alarms.js', 'utf8'), { window });
  assert.equal(window.DuckTaskAlarms, original);
});

test('canceling device alarms stays paused across reconciliation and is isolated to its owner', async () => {
  const { api, window, elements, saved, calls } = setup();
  const preferences = new Map();
  window.localStorage = { getItem: key => preferences.get(key) ?? null, setItem: (key, value) => preferences.set(key, value) };
  const tasks = [{ id: 'essay', title: 'Essay' }];
  await api.setContext('owner-a', tasks);
  await api.save('essay', '2030-05-02T14:00', { title: 'Essay' });
  await elements.get('#disable-task-alarms').events.click();
  assert.equal(calls.find(call => call.action === 'cancelAll').deviceEnabled, false);
  assert.equal(saved.size, 0);
  assert.equal(api.canSave(), false);
  await api.setContext('owner-a', tasks);
  assert.equal(api.canSave(), false, 'refreshing tasks must not resume canceled device alarms');
  await api.setContext('owner-b', tasks);
  assert.equal(api.canSave(), true, 'a different owner has a separate device preference');
  await api.setContext('owner-a', tasks);
  assert.equal(api.canSave(), false);
  await elements.get('#enable-task-alarms').events.click();
  assert.equal(api.canSave(), true);
  const resumed = calls.find(call => call.action === 'authorize');
  assert.equal(resumed.scope, 'owner-a');
  assert.equal(resumed.deviceEnabled, true);
});

test('native alarm scheduling carries the owner and selected alert time zone', async () => {
  const { api, calls } = setup();
  await api.setContext('owner-a', [{ id: 'essay', title: 'Essay' }]);
  await api.save('essay', '2030-05-02T14:00', { title: 'Essay', scope: 'owner-a', timeZone: 'UTC' });
  const scheduled = calls.find(call => call.action === 'schedule');
  assert.equal(scheduled.scope, 'owner-a');
  assert.equal(scheduled.fireAt, Date.parse('2030-05-02T14:00:00Z'));
  const before = calls.length;
  await assert.rejects(api.save('essay', '2030-05-02T14:00', { title: 'Essay', scope: 'owner-b', timeZone: 'UTC' }), /account changed/);
  assert.equal(calls.length, before);
});

for (const heldAction of ['status', 'schedule']) {
  test(`canceling device alarms blocks ${heldAction === 'status' ? 'queued' : 'in-flight'} saves and stays paused`, async () => {
    let armed = false, enter, release;
    const entered = new Promise(resolve => { enter = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const { api, elements, calls, saved } = setup({ beforeRequest: async body => {
      if (armed && body.action === heldAction) { armed = false; enter(); await gate; }
    } });
    await api.setContext('owner-a', [{ id: 'essay', title: 'Essay' }]);
    armed = true;
    const refreshing = heldAction === 'status' ? api.refresh() : Promise.resolve();
    const saving = api.save('essay', '2030-05-02T14:00', { title: 'Essay' });
    const rejectedSave = assert.rejects(saving, /account or device setting changed/);
    await entered;
    const pausing = elements.get('#disable-task-alarms').events.click();
    assert.equal(api.canSave(), false, 'device choice changes immediately while cancellation waits');
    await assert.rejects(api.save('essay', '2030-05-02T15:00'), /canceled on this device/);
    release();
    await Promise.all([refreshing, rejectedSave, pausing]);
    assert.equal(saved.size, 0);
    assert.equal(api.get('essay'), undefined);
    assert.equal(api.canSave(), false);
    const cancellation = calls.findLastIndex(call => call.action === 'cancelAll');
    assert.equal(calls.slice(cancellation + 1).some(call => call.action === 'schedule'), false);
  });
}
