// Real independent browser sessions and disposable loopback Workers only.
async page => {
  const browser = page.context().browser(), contexts = [], results = [], errors = [];
  const origin = 'http://127.0.0.1:8796', legacy = 'http://127.0.0.1:8797';
  const evidence = '/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/account-device-sync/';
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 15000 });
  const details = (n = 37, reminder = '15') => ({ version: 1, actualMinutes: n, reminderChoice: reminder });
  let stage = 'setup', active;
  const account = () => ({ email: `shared-runtime-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`, password: `Fixture-${Date.now()}-${Math.random()}` });
  async function api(c, target, path, method = 'GET', data) {
    const r = await c.request.fetch(target + '/api' + path, { method, headers: { Origin: target }, ...(data === undefined ? {} : { data }), timeout: 15000 });
    return { status: r.status(), data: await r.json() };
  }
  async function client(target, credentials, signup = false, width = 1280) {
    const c = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, hasTouch: width < 700, isMobile: width < 700, timezoneId: 'America/Los_Angeles', reducedMotion: 'reduce', serviceWorkers: 'block' }); contexts.push(c);
    await c.route('**/*', r => new URL(r.request().url()).origin === target ? r.continue() : r.abort());
    const auth = await api(c, target, '/auth/' + (signup ? 'sign-up' : 'sign-in'), 'POST', credentials);
    assert(auth.status === (signup ? 201 : 200), 'Synthetic account authentication failed');
    const p = await c.newPage(), requests = [];
    p.setDefaultTimeout(15000); p.setDefaultNavigationTimeout(30000);
    p.on('pageerror', e => errors.push({ stage, message: e.message }));
    p.on('request', r => { if (new URL(r.url()).pathname.includes('/api/items/')) requests.push({ method: r.method(), path: new URL(r.url()).pathname }); });
    await p.goto(target + '/?qa=shared-settings#tasks', { waitUntil: 'domcontentloaded' });
    await wait(p, () => typeof store !== 'undefined' && store.mode === 'cloud' && store.user && workAlertContextReady);
    return { c, p, target, requests, owner: auth.data.user.id };
  }
  async function nav(f, name) {
    const p = f.p;
    if (await p.locator('.phone-bottom-nav').isVisible()) {
      const direct = p.locator(`.phone-bottom-nav [data-view="${name}"]`);
      if (await direct.count()) await direct.tap();
      else { await p.locator('#phone-more-button').tap(); await p.locator(`#phone-more-dialog [data-view="${name}"]`).tap(); }
    } else await p.locator(`#planner-sidebar [data-view="${name}"]`).click();
    await wait(p, name => document.body.dataset.view === name, name);
  }
  async function openTask(f, id) {
    await nav(f, 'tasks');
    const all = f.p.locator('#view-tasks [data-filter="all"]'); if (await all.count()) await all.click();
    await f.p.locator(`#all-task-list .task-select[data-edit-task="${id}"]`).click();
    await f.p.locator('#task-modal').waitFor({ state: 'visible' });
    await f.p.locator('#task-form details').evaluateAll(es => es.forEach(e => { e.open = true; }));
  }
  async function save(f) {
    await f.p.locator('#save-task').click();
    await f.p.locator('#task-modal').waitFor({ state: 'hidden' });
  }
  async function reload(f) {
    await f.p.reload({ waitUntil: 'domcontentloaded' });
    await wait(f.p, () => typeof store !== 'undefined' && store.mode === 'cloud' && workAlertContextReady);
  }
  async function seedCache(f, id, prefs, data) {
    await f.p.evaluate(({ id, prefs, data }) => {
      const suffix = 'cloud:' + store.user.id;
      if (prefs) {
        const key = 'duckplan-device-task-extras-v1:work-alerts:' + suffix;
        localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key) || '{}'), [id]: prefs }));
      }
      if (data) {
        const key = 'duckplan-device-task-extras-v1:task-details:' + suffix;
        localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key) || '{}'), [id]: data }));
      }
    }, { id, prefs, data });
  }
  const item = (f, id) => f.p.evaluate(id => store.listItems().find(t => t.id === id), id);
  const raw = async (f, id) => (await api(f.c, f.target, '/planner')).data.items.find(t => t.id === id);
  try {
    const creds = account(), a = await client(origin, creds, true), b = await client(origin, creds, false, 390); active = a;
    assert(JSON.stringify(await a.c.cookies()) !== JSON.stringify(await b.c.cookies()), 'Clients must have separate authenticated sessions');
    const day = await a.p.evaluate(() => Model.addDays(nowKey(), 2));
    const prefs = { version: 1, timeZone: 'America/Los_Angeles', alarm: { enabled: true, mode: 'manual', at: day + 'T09:15', sound: 'gentle', snoozeMinutes: 10 }, notification: { enabled: true, mode: 'manual', at: day + 'T09:20' } };
    stage = 'two-client UI create and edit';
    await a.p.locator('#open-task-modal').click();
    await a.p.locator('#task-form details').evaluateAll(es => es.forEach(e => { e.open = true; }));
    for (const [name, value] of Object.entries({ title: 'Shared account timing fixture', dueDate: day, dueTime: '17:00', notes: 'Preserve all task details across independent clients', scheduledDate: day, scheduledTime: '09:00', actualMinutes: '37', alarmAt: prefs.alarm.at, notificationAt: prefs.notification.at })) await a.p.locator(`#task-form [name="${name}"]`).fill(value);
    await a.p.locator('#task-form [name="reminderChoice"]').selectOption('15');
    await a.p.locator('#task-form [name="durationMinutes"]').selectOption('60');
    await a.p.locator('#task-form [name="importance"]').selectOption('important');
    await a.p.locator('#task-form [name="urgency"]').selectOption('urgent');
    await save(a);
    const created = await a.p.evaluate(() => store.listItems().find(t => t.title === 'Shared account timing fixture'));
    await wait(b.p, id => store.listItems().some(t => t.id === id && t.actualMinutes === 37 && t.workAlerts?.alarm.mode === 'manual'), created.id);
    await openTask(b, created.id);
    const controls = await b.p.locator('#task-form').evaluate(f => Object.fromEntries(['actualMinutes', 'reminderChoice', 'alarmAt', 'notificationAt', 'scheduledDate', 'scheduledTime'].map(k => [k, f.elements[k].value])));
    assert(controls.actualMinutes === '37' && controls.reminderChoice === '15' && controls.alarmAt === day + 'T09:15' && controls.notificationAt === day + 'T09:20', 'Peer editor did not restore all timing/details fields');
    await b.p.screenshot({ path: evidence + 'shared-peer-phone-editor.png' });
    await b.p.locator('#task-form [name="actualMinutes"]').fill('92'); await b.p.locator('#task-form [name="reminderChoice"]').selectOption('off'); await b.p.locator('#task-form [name="scheduledTime"]').fill('11:00'); await save(b);
    await wait(a.p, id => store.listItems().some(t => t.id === id && t.actualMinutes === 92 && t.reminderChoice === 'off' && t.scheduledStart.endsWith('T11:00')), created.id);
    await Promise.all([reload(a), reload(b)]);
    const ta = await item(a, created.id), tb = await item(b, created.id);
    assert(JSON.stringify(ta) === JSON.stringify(tb), 'Reloaded independent clients disagree');
    assert(ta.workAlerts.alarm.at === day + 'T09:15' && ta.workAlerts.notification.at === day + 'T09:20' && ta.dueTime === '17:00' && ta.durationMinutes === 60, 'Editing work time changed independent deadline or manual alerts');
    results.push({ case: stage, status: 'PASS', independentSessions: true, realLiveUpdate: true, reload: true, exactPeerFields: controls });

    stage = 'new account sync status and Refresh account';
    await nav(b, 'settings');
    assert((await b.p.locator('#account-sync-copy').textContent()).includes('shared'), 'Account sync explanation missing');
    const snapshotResponse = b.p.waitForResponse(r => new URL(r.url()).pathname === '/api/planner' && r.request().method() === 'GET');
    await b.p.locator('#refresh-account-sync').tap(); assert((await snapshotResponse).status() === 200, 'Refresh account failed');
    await wait(b.p, () => !document.querySelector('#refresh-account-sync').disabled);
    results.push({ case: stage, status: 'PASS', currentBackend: true });

    stage = 'legacy cache auto-adopts metadata only and peer receives all settings';
    const adoptedId = await a.p.evaluate(() => crypto.randomUUID());
    assert((await api(a.c, origin, '/items/' + adoptedId, 'PUT', { title: 'Bare legacy canonical task', scheduled_start: day + 'T09:00' })).status === 200, 'Bare task seed failed');
    await seedCache(a, adoptedId, prefs, details());
    await reload(a);
    await wait(b.p, id => store.listItems().some(t => t.id === id && t.actualMinutes === 37 && t.workAlerts?.alarm.at), adoptedId);
    const adoptedRaw = await raw(a, adoptedId);
    assert(adoptedRaw.title === 'Bare legacy canonical task' && adoptedRaw.sync_revision === 1 && JSON.parse(adoptedRaw.task_details).actualMinutes === 37 && JSON.stringify(JSON.parse(adoptedRaw.work_alerts)) === JSON.stringify(prefs), 'Metadata adoption did not retain canonical task/revision');
    assert(a.requests.some(r => r.method === 'POST' && r.path.endsWith('/adopt-settings')), 'Auto-adoption did not use CAS');
    results.push({ case: stage, status: 'PASS', revision: 1, fullTaskRewrite: false });

    stage = 'canonical settings win over conflicting device cache';
    const conflicting = structuredClone(prefs); conflicting.alarm.at = day + 'T07:30';
    await seedCache(b, adoptedId, conflicting, details(999, '1440')); await reload(b);
    const canonicalPeer = await item(b, adoptedId);
    assert(canonicalPeer.actualMinutes === 37 && canonicalPeer.workAlerts.alarm.at === prefs.alarm.at && !canonicalPeer.workAlertsDeviceOnly && !canonicalPeer.taskDetailsDeviceOnly, 'Conflicting device cache overwrote canonical settings');
    results.push({ case: stage, status: 'PASS' });

    stage = 'competing actual clients CAS adopt one canonical winner';
    const raceId = await a.p.evaluate(() => crypto.randomUUID());
    await api(a.c, origin, '/items/' + raceId, 'PUT', { title: 'Concurrent cache adoption fixture' });
    await seedCache(a, raceId, prefs, details(10, '15')); await seedCache(b, raceId, conflicting, details(20, '60'));
    await Promise.all([reload(a), reload(b)]);
    const winner = await raw(a, raceId), winningDetails = JSON.parse(winner.task_details), winningPrefs = JSON.parse(winner.work_alerts);
    assert(winner.sync_revision === 1 && [10, 20].includes(winningDetails.actualMinutes), 'Concurrent adoption changed revision more than once');
    await a.p.evaluate(() => store.refresh()); await b.p.evaluate(() => store.refresh());
    await wait(a.p, ({ id, n }) => store.listItems().find(t => t.id === id)?.actualMinutes === n, { id: raceId, n: winningDetails.actualMinutes });
    await wait(b.p, ({ id, at }) => store.listItems().find(t => t.id === id)?.workAlerts?.alarm.at === at, { id: raceId, at: winningPrefs.alarm.at });
    results.push({ case: stage, status: 'PASS', canonicalRevision: winner.sync_revision, bothClientsConverged: true });

    stage = 'completed historical details and alarm preferences share without delivery';
    const doneId = await a.p.evaluate(() => crypto.randomUUID());
    await api(a.c, origin, '/items/' + doneId, 'PUT', { title: 'Completed historical fixture', completed: true });
    await seedCache(a, doneId, prefs, details(85, '60')); await reload(a);
    await wait(b.p, id => store.listItems().some(t => t.id === id && t.completed && t.actualMinutes === 85 && t.workAlerts?.alarm.at), doneId);
    const jobs = await api(a.c, origin, '/alarms');
    assert(!(jobs.data.alarms || []).some(r => r.item_id === doneId), 'Completed metadata activated a notification job');
    assert((await raw(a, doneId)).completed === 1, 'Adoption changed completion');
    results.push({ case: stage, status: 'PASS', completedPreserved: true, noNotificationJobs: true });

    stage = 'late old-owner CAS response cannot hydrate a new account';
    const otherCreds = account(), other = await client(origin, otherCreds, true), heldId = await a.p.evaluate(() => crypto.randomUUID());
    await api(a.c, origin, '/items/' + heldId, 'PUT', { title: 'Captured old owner fixture' }); await seedCache(a, heldId, prefs, details(55));
    let release, received;
    const held = new Promise(resolve => { received = resolve; });
    await a.c.route('**/api/items/' + heldId + '/adopt-settings', async route => { const response = await route.fetch(); await new Promise(resolve => { release = resolve; received(); }); await route.fulfill({ response }); }, { times: 1 });
    const pendingReload = a.p.reload({ waitUntil: 'domcontentloaded' });
    await held;
    await a.p.evaluate(() => store.signOut()); await a.p.evaluate(credentials => store.signIn(credentials.email, credentials.password), otherCreds);
    release(); await pendingReload;
    await wait(a.p, owner => store.user?.id === owner && workAlertContextReady, other.owner);
    assert(!(await a.p.evaluate(id => store.listItems().some(t => t.id === id), heldId)), 'Old-owner late response leaked task into the new account');
    assert(JSON.parse((await raw(b, heldId)).task_details).actualMinutes === 55, 'Old owner durable metadata was lost');
    results.push({ case: stage, status: 'PASS', capturedOwnerPersisted: true, newOwnerIsolated: true });

    stage = 'actual schema0005 server preserves owner-scoped device fallback and honest status';
    const oldCreds = account(), oldA = await client(legacy, oldCreds, true), oldB = await client(legacy, oldCreds, false); active = oldA;
    const oldSaved = await oldA.p.evaluate(({ prefs, data }) => store.upsertItem({ title: 'Legacy device-only timing fixture', workAlerts: prefs, actualMinutes: data.actualMinutes, reminderChoice: data.reminderChoice }), { prefs, data: details(73, '1440') });
    await reload(oldA);
    const oldRestored = await item(oldA, oldSaved.id);
    assert(oldRestored.actualMinutes === 73 && oldRestored.workAlerts.alarm.at === prefs.alarm.at && oldRestored.workAlertsDeviceOnly && oldRestored.taskDetailsDeviceOnly, 'Real old-server fallback did not persist');
    await oldB.p.evaluate(() => store.refresh()); await wait(oldB.p, id => store.listItems().some(t => t.id === id), oldSaved.id);
    const oldPeer = await item(oldB, oldSaved.id);
    assert(oldPeer.workAlerts == null && oldPeer.actualMinutes == null, 'Old server falsely shared unsupported metadata');
    await nav(oldA, 'settings'); assert((await oldA.p.locator('#account-sync-copy').textContent()).includes('device'), 'Old server device-only explanation missing');
    results.push({ case: stage, status: 'PASS', schema: '0001–0005', unsupportedMetadataNotClaimedShared: true });
    assert(!errors.length, 'Unexpected page errors');
    return { runtime: browser.version(), cases: results, passed: true, pageErrors: errors, productionWrites: false, physicalOrInstalledPwaClaims: false };
  } catch (error) {
    await active?.p.screenshot({ path: evidence + 'shared-runtime-failure.png' }).catch(() => {});
    return { runtime: browser.version(), cases: results, passed: false, stage, error: error.message, pageErrors: errors, productionWrites: false };
  } finally { for (const c of contexts) await c.close().catch(() => {}); }
}
