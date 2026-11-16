// Actual browser-tab service worker/offline card editing; not an installed-PWA claim.
async page => {
  const expected = {"app.js": "2e797a7980cb306a168fb8893362b73f1a658745de40ebf912fc20a0ff368be7", "calendar-date-clarity.css": "ea8d1e3a0934f4e815951e6bd0b4a080059157a5f4ca8fe691cb498712bbc975", "index.html": "f363f0b50335da6558cb962a3ecf2759a73ac614ffe7b7200ef869f6537c90c3"};
  const expectedCache = 'duckplan-app-motion-preview-v65', origin = 'http://127.0.0.1:8034';
  const browser = page.context().browser(), c = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'en-US', timezoneId: 'America/Los_Angeles', reducedMotion: 'reduce', serviceWorkers: 'allow' });
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 20000 });
  const id = '88000000-0000-4000-8000-000000000001';
  const prefs = { version: 1, timeZone: 'America/Los_Angeles', alarm: { enabled: false, mode: 'manual', at: '2026-11-21T16:45', sound: 'gentle', snoozeMinutes: 10 }, notification: { enabled: false, mode: 'manual', at: '2026-11-21T16:50' } };
  const task = { id, title: 'Offline card with independent dates', dueDate: '2026-11-19', dueTime: '17:00', scheduledStart: '2026-11-20T15:00', durationMinutes: 60, priority: 'High', completed: false, actualMinutes: 0, reminderChoice: '15', workAlerts: prefs, schemaVersion: 2 };
  await c.addInitScript(task => { if (localStorage.getItem('task-date-card-sw-fixture')) return; localStorage.setItem('duckplan-demo-tasks-v1', JSON.stringify([task])); localStorage.setItem('duckplan-demo-classes-v1', '[]'); localStorage.setItem('task-date-card-sw-fixture', 'ready'); }, task);
  const p = await c.newPage(), errors = [], assets = [];
  p.setDefaultTimeout(20000); p.setDefaultNavigationTimeout(30000); p.on('pageerror', e => errors.push(e.message));
  let offline = false, stage = 'setup', cacheProof, cardProof;
  p.on('response', r => { const name = new URL(r.url()).pathname.slice(1) || 'index.html'; if (offline && Object.hasOwn(expected, name)) assets.push({ name, status: r.status(), fromServiceWorker: r.fromServiceWorker() }); });
  try {
    assert(Object.keys(expected).length === 3, 'Populate the three frozen-source digests before running');
    await p.clock.install({ time: new Date('2026-11-20T12:00:00-08:00') });
    await p.goto(origin + '/?qa=task-date-card-sw#calendar', { waitUntil: 'domcontentloaded' });
    await wait(p, () => typeof store !== 'undefined' && workAlertContextReady && store.mode === 'local');
    stage = 'SW activation and frozen-source digests';
    await p.evaluate(async () => { let timer; try { const r = await Promise.race([DuckPlanApp.ready, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('SW readiness timed out')), 20000); })]); if (!r?.active) throw new Error('No active service worker'); } finally { clearTimeout(timer); } });
    await wait(p, () => Boolean(navigator.serviceWorker.controller));
    cacheProof = await p.evaluate(async ({ expectedCache, names }) => {
      const keys = await caches.keys(), cache = await caches.open(expectedCache), digests = {};
      for (const name of names) { const r = await cache.match(new URL('/' + name, location.origin)); if (!r) { digests[name] = null; continue; } const hash = await crypto.subtle.digest('SHA-256', await r.arrayBuffer()); digests[name] = [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2, '0')).join(''); }
      return { keys, digests, scope: (await navigator.serviceWorker.getRegistration()).scope };
    }, { expectedCache, names: Object.keys(expected) });
    assert(cacheProof.keys.includes(expectedCache), 'Expected cache missing');
    for (const [name, digest] of Object.entries(expected)) assert(cacheProof.digests[name] === digest, 'Missing/stale cached source: ' + name);
    await p.reload({ waitUntil: 'domcontentloaded' }); await wait(p, () => typeof store !== 'undefined' && workAlertContextReady);
    stage = 'offline reload, metadata and local card edit';
    offline = true; await c.setOffline(true); await p.reload({ waitUntil: 'domcontentloaded' });
    await wait(p, () => typeof store !== 'undefined' && workAlertContextReady);
    await p.evaluate(() => { selectedDate = '2026-11-20'; calendarView = 'day'; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); });
    await p.locator('#phone-task-summary').tap(); await wait(p, () => document.body.classList.contains('task-panel-open'));
    const card = p.locator(`#daily-task-panel [data-task-card="${id}"]`);
    cardProof = await card.evaluate(e => ({ due: e.querySelector('.task-date-due')?.textContent, work: e.querySelector('.task-date-work')?.textContent, icons: e.querySelectorAll('svg.task-date-icon[aria-hidden="true"]').length, overdue: e.classList.contains('is-overdue'), after: e.classList.contains('is-work-after-deadline'), text: e.textContent }));
    assert(/Nov 19/.test(cardProof.due) && /5:00 PM/.test(cardProof.due) && /Today/.test(cardProof.work) && /3:00 PM/.test(cardProof.work) && cardProof.icons === 2 && cardProof.overdue && cardProof.after && /0 min spent/.test(cardProof.text), 'Offline card metadata or warnings changed');
    await card.locator('.task-select').tap(); await p.locator('#task-modal').waitFor({ state: 'visible' });
    await p.locator('#task-form [name="title"]').fill('Offline card edited and retained');
    await p.locator('#save-task').tap(); await p.locator('#task-modal').waitFor({ state: 'hidden' });
    await wait(p, id => store.listItems().find(t => t.id === id)?.title === 'Offline card edited and retained', id);
    await p.screenshot({ path: '/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/task-date-cards/offline-phone.png' });
    for (const name of Object.keys(expected)) assert(assets.some(a => a.name === name && a.status === 200 && a.fromServiceWorker), 'Offline asset was not served by actual SW: ' + name);
    stage = 'online reconnect and retained dates/preferences';
    offline = false; await c.setOffline(false); await p.reload({ waitUntil: 'domcontentloaded' });
    await wait(p, id => typeof store !== 'undefined' && workAlertContextReady && store.listItems().find(t => t.id === id)?.title === 'Offline card edited and retained', id);
    const after = await p.evaluate(id => ({ task: store.listItems().find(t => t.id === id), count: store.listItems().length }), id);
    for (const k of ['id', 'dueDate', 'dueTime', 'scheduledStart', 'durationMinutes', 'actualMinutes', 'reminderChoice']) assert(after.task[k] === task[k], 'Offline edit/reconnect changed task detail: ' + k);
    assert(after.count === 1 && JSON.stringify(after.task.workAlerts) === JSON.stringify(prefs), 'Offline editing duplicated task or lost preferences');
    assert(!errors.length, 'Unexpected page errors: ' + errors.join('; '));
    return { status: 'PASS', runtime: browser.version(), surface: 'fresh normal browser tab, not installed PWA', cacheProof, offlineAssets: assets, cardProof, offlineCardEdit: true, onlineReconnect: true, preservedIdDatesWorkAndPreferences: true, errors, productionWrites: false };
  } catch (error) { return { status: 'FAIL', runtime: browser.version(), stage, error: error.message, cacheProof, cardProof, offlineAssets: assets, errors, productionWrites: false }; }
  finally { await c.close(); }
}
