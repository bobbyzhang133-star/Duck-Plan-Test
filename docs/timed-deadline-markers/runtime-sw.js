// One actual controlled browser tab/cache/offline reload; not an installed PWA claim.
async page => {
  const expected = {"calendar-date-presentation.js": "4400193757d2af291bca21562f46963aec96111e6e037b09160d7b980bbee48b", "calendar-date-clarity.css": "ddea6ca772700779a6089f6acbefe3a4b3dd4a81b57a60646be0111da997ecf9", "calendar-task-preview.js": "e2d2a3d12e50c42f22d875c452b43039636b3cc9d0434d74ace7b79b82c94f50", "calendar-task-preview.css": "346c41e6575b79672ec14118732187e930d23411ff53c523cd259ccd34bd3155", "app.js": "3bd11df9b3752e51ab69d487faafe759685fec708fadd0e82339124e15fb37ed", "index.html": "27e9004645e168664817b58e922dbbd68fb70cdef3509b5e265e4c495d516b32"};
  const expectedCache = 'duckplan-app-motion-preview-v62', origin = 'http://127.0.0.1:8034';
  const browser = page.context().browser(), c = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'en-US', timezoneId: 'America/Los_Angeles', reducedMotion: 'reduce', serviceWorkers: 'allow' });
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 20000 });
  const id = n => `77000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const tasks = [{ id: id(1), title: 'Offline work and deadline', dueDate: '2026-11-20', dueTime: '17:00', scheduledStart: '2026-11-20T10:00', durationMinutes: 60, completed: false, schemaVersion: 2 },
    { id: id(2), title: 'Offline second deadline', dueDate: '2026-11-20', dueTime: '17:15', scheduledStart: null, durationMinutes: 45, completed: false, schemaVersion: 2 }];
  await c.addInitScript(tasks => { if (localStorage.getItem('timed-deadline-sw-fixture')) return; localStorage.setItem('duckplan-demo-tasks-v1', JSON.stringify(tasks)); localStorage.setItem('duckplan-demo-classes-v1', '[]'); localStorage.setItem('timed-deadline-sw-fixture', 'ready'); }, tasks);
  const p = await c.newPage(), errors = [], assets = [];
  p.setDefaultTimeout(20000); p.setDefaultNavigationTimeout(30000); p.on('pageerror', e => errors.push(e.message));
  let offline = false, stage = 'setup', cacheProof;
  p.on('response', r => { const name = new URL(r.url()).pathname.slice(1) || 'index.html'; if (offline && Object.hasOwn(expected, name)) assets.push({ name, status: r.status(), fromServiceWorker: r.fromServiceWorker() }); });
  try {
    await p.clock.install({ time: new Date('2026-11-20T12:00:00-08:00') });
    await p.goto(origin + '/?qa=timed-deadline-sw#calendar', { waitUntil: 'domcontentloaded' });
    await wait(p, () => typeof store !== 'undefined' && workAlertContextReady && store.mode === 'local');
    stage = 'SW62 activation and frozen source digests';
    await p.evaluate(async () => { let timer; try { const r = await Promise.race([DuckPlanApp.ready, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('SW readiness timed out')), 20000); })]); if (!r?.active) throw new Error('No active service worker'); } finally { clearTimeout(timer); } });
    await wait(p, () => Boolean(navigator.serviceWorker.controller));
    cacheProof = await p.evaluate(async ({ expectedCache, names }) => {
      const keys = await caches.keys(), cache = await caches.open(expectedCache), digests = {};
      for (const name of names) { const r = await cache.match(new URL('/' + name, location.origin)); if (!r) { digests[name] = null; continue; } const hash = await crypto.subtle.digest('SHA-256', await r.arrayBuffer()); digests[name] = [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2, '0')).join(''); }
      return { keys, digests, scope: (await navigator.serviceWorker.getRegistration()).scope };
    }, { expectedCache, names: Object.keys(expected) });
    assert(cacheProof.keys.includes(expectedCache), 'SW62 cache missing');
    for (const [name, digest] of Object.entries(expected)) assert(cacheProof.digests[name] === digest, 'Missing/stale cached source: ' + name);
    await p.reload({ waitUntil: 'domcontentloaded' }); await wait(p, () => typeof store !== 'undefined' && workAlertContextReady);
    stage = 'offline reload and deadline group interaction';
    offline = true; await c.setOffline(true); await p.reload({ waitUntil: 'domcontentloaded' });
    await wait(p, () => typeof store !== 'undefined' && workAlertContextReady && typeof DuckCalendarDatePresentation !== 'undefined');
    await p.evaluate(() => { selectedDate = '2026-11-20'; calendarView = 'day'; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); document.querySelector('#planner-calendar').scrollTop = 16 * 62; });
    const trigger = p.locator('[data-timed-deadline-group="2026-11-20-1020"]'); await trigger.tap();
    const dialog = p.locator('#calendar-task-preview.calendar-deadline-group-preview'); await dialog.waitFor({ state: 'visible' });
    assert(await dialog.locator('[data-deadline-preview-task]').count() === 2, 'Offline group list missing deadlines');
    await dialog.locator(`[data-deadline-preview-task="${id(2)}"]`).tap();
    await wait(p, () => document.querySelector('#calendar-preview-title')?.textContent === 'Offline second deadline');
    assert(/5:15 PM/.test(await p.locator('.calendar-preview-dates').textContent()), 'Offline task details changed the precise deadline');
    await p.keyboard.press('Escape'); await p.locator('#calendar-task-preview').waitFor({ state: 'detached' });
    await p.screenshot({ path: '/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/timed-deadline-markers/offline-phone.png' });
    for (const name of Object.keys(expected)) assert(assets.some(a => a.name === name && a.status === 200 && a.fromServiceWorker), 'Offline asset was not served by actual SW: ' + name);
    stage = 'online reconnect and retained local timing';
    offline = false; await c.setOffline(false); await p.reload({ waitUntil: 'domcontentloaded' });
    await wait(p, id => typeof store !== 'undefined' && workAlertContextReady && store.listItems().find(t => t.id === id)?.dueTime === '17:15', id(2));
    assert(!errors.length, 'Unexpected page errors: ' + errors.join('; '));
    return { status: 'PASS', runtime: browser.version(), surface: 'fresh normal browser tab, not installed PWA', cacheProof, offlineAssets: assets, offlineDeadlineGroup: true, exactTaskDetails: true, onlineReconnect: true, errors, productionWrites: false };
  } catch (error) { return { status: 'FAIL', runtime: browser.version(), stage, error: error.message, cacheProof, offlineAssets: assets, errors, productionWrites: false }; }
  finally { await c.close(); }
}
