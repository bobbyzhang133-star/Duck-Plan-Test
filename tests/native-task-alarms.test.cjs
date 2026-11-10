const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const Domain = require('../landing/reminder-domain.js');

function setup() {
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
  return { api: window.DuckTaskAlarms, elements, calls, saved, deny() { denied = true; } };
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
