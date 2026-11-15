// Focused deadline presentation acceptance. Only disposable storage/accounts/loopback Workers.
async page => {
  const browser = page.context().browser(), contexts = [], cases = [];
  const output = '/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/timed-deadline-markers/';
  const date = '2026-11-20';
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 15000 });
  let current, stage = 'setup';
  function fixture() {
    const prefix = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
    const id = n => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const prefs = { version: 1, timeZone: 'America/Los_Angeles', alarm: { enabled: false, mode: 'manual', at: '2026-11-21T16:45', sound: 'gentle', snoozeMinutes: 10 }, notification: { enabled: false, mode: 'manual', at: '2026-11-21T16:50' } };
    const base = { classId: id(90), priority: 'High', durationMinutes: 60, notes: 'Preserve exact deadline and independent work time.', completed: false, source: 'manual', schemaVersion: 2, dueDate: date, dueTime: '', scheduledStart: null };
    const rows = [
      { title: 'Independent work and 5 PM deadline', dueTime: '17:00', scheduledStart: date + 'T10:00', actualMinutes: 37, reminderChoice: '15', workAlerts: prefs },
      { title: 'Deadline fifteen minutes later', dueTime: '17:15' },
      { title: 'Same time "quoted" <span data-fixture-injected="yes"> & a very long title that should wrap safely', dueTime: '17:00' },
      { title: 'Exactly midnight deadline', dueTime: '00:00' },
      { title: 'Last minute deadline', dueTime: '23:59' },
      { title: 'Date-only deadline' },
      { title: 'Work overlapping the deadline cluster', dueDate: '', scheduledStart: date + 'T17:00', durationMinutes: 90 },
      { title: 'Work crosses a 9 AM deadline', dueTime: '09:00', scheduledStart: date + 'T08:30', durationMinutes: 90 },
      { title: 'Close deadline five minutes later', dueTime: '17:05' },
      { title: 'A long "quoted" standalone <img src=x onerror="window.fixtureInjection=1"> deadline label', dueTime: '13:00' },
      { title: 'Quiet next day dual occurrence', dueDate: '2026-11-21', dueTime: '19:00', scheduledStart: '2026-11-21T12:00' },
      { title: 'Completed due and work occurrence', dueTime: '17:00', scheduledStart: date + 'T14:00', completed: true },
    ].map((task, index) => ({ ...base, ...task, id: id(index + 1) }));
    const classes = [{ id: id(90), name: 'Synthetic deadline course', color: '#39896f', code: 'QA', teacher: 'Fixture', period: '2', archived: false }];
    return { id, rows, classes };
  }
  async function setup(config) {
    const { id, rows, classes } = fixture(), origin = config.cloud ? 'http://127.0.0.1:8796' : 'http://127.0.0.1:8034';
    const c = await browser.newContext({ viewport: { width: config.width, height: config.width < 700 ? 844 : 1000 }, hasTouch: config.width < 1000, isMobile: config.width < 700, locale: 'en-US', timezoneId: 'America/Los_Angeles', colorScheme: config.dark ? 'dark' : 'light', reducedMotion: config.reduce ? 'reduce' : 'no-preference', serviceWorkers: 'block' }); contexts.push(c);
    await c.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    if (config.cloud) {
      const signup = await c.request.post(origin + '/api/auth/sign-up', { headers: { Origin: origin }, data: { email: `deadline-marker-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`, password: `Synthetic-${Date.now()}-${Math.random()}` }, timeout: 15000 });
      assert(signup.status() === 201, 'Synthetic signup failed');
      const imported = await c.request.post(origin + '/api/import', { headers: { Origin: origin }, data: {
        classRows: classes.map(t => ({ id: t.id, name: t.name, color: t.color, code: t.code })),
        itemRows: rows.map(t => ({ id: t.id, class_id: t.classId, title: t.title, notes: t.notes, priority: t.priority, due_date: t.dueDate || null, due_time: t.dueTime || null, scheduled_start: t.scheduledStart, duration_minutes: t.durationMinutes, completed: t.completed, ...(t.workAlerts ? { work_alerts: t.workAlerts, task_details: { version: 1, actualMinutes: t.actualMinutes, reminderChoice: t.reminderChoice } } : {}) })),
      }, timeout: 15000 }); assert(imported.status() === 200, 'Synthetic import failed');
    } else await c.addInitScript(({ rows, classes }) => {
      if (localStorage.getItem('timed-deadline-fixture')) return;
      localStorage.setItem('duckplan-demo-tasks-v1', JSON.stringify(rows)); localStorage.setItem('duckplan-demo-classes-v1', JSON.stringify(classes)); localStorage.setItem('timed-deadline-fixture', 'ready');
    }, { rows, classes });
    const p = await c.newPage(), errors = [], requests = [];
    p.setDefaultTimeout(15000); p.setDefaultNavigationTimeout(30000);
    p.on('pageerror', e => errors.push(e.message));
    p.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/') && !['GET', 'OPTIONS'].includes(r.method())) requests.push({ method: r.method(), path: new URL(r.url()).pathname }); });
    await p.clock.install({ time: new Date('2026-11-20T12:00:00-08:00') });
    await p.goto(origin + '/?qa=timed-deadline-markers#calendar', { waitUntil: 'domcontentloaded' });
    await wait(p, ({ cloud, id }) => typeof store !== 'undefined' && workAlertContextReady && store.mode === (cloud ? 'cloud' : 'local') && store.listItems().some(t => t.id === id), { cloud: config.cloud, id: id(12) });
    await p.evaluate(({ date, dark }) => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; selectedDate = date; calendarView = 'day'; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); }, { date, dark: config.dark });
    return { c, p, id, rows, classes, origin, ...config, errors, requests, label: `${config.cloud ? 'cloud' : 'local'}-${config.width}`, touch: config.width < 1000 };
  }
  const act = (f, locator) => f.touch ? locator.tap() : locator.click();
  const column = f => f.p.locator(`.timeline-column[data-column-date="${date}"]`);
  async function setView(f, view) {
    await act(f, f.p.locator(`[data-calendar-view="${view}"]`));
    await wait(f.p, view => calendarView === view, view);
  }
  async function scrollTime(f, hour) { await f.p.locator('#planner-calendar').evaluate((e, hour) => { e.scrollTop = Math.max(0, (hour - 1) * 62); }, hour); }
  async function inspectGeometry(f, expectedDateOnly = true) {
    const data = await column(f).evaluate(col => {
      const b = col.getBoundingClientRect();
      const relative = e => { const r = e.getBoundingClientRect(); return { x: r.x - b.x, y: r.y - b.y, width: r.width, height: r.height, right: r.right - b.x, bottom: r.bottom - b.y }; };
      const points = [...col.querySelectorAll('.timed-deadline-point')].map(e => ({ minute: Number(e.dataset.deadlineMinute), anchorY: e.getBoundingClientRect().top - b.top, art: relative(e.querySelector('.timed-deadline-diamond')), color: getComputedStyle(e.querySelector('.timed-deadline-diamond')).color, count: e.querySelector('.timed-deadline-point-count')?.textContent || '' }));
      const labels = [...col.querySelectorAll('.timed-deadline-marker,.timed-deadline-group-trigger')].map(e => ({ ...relative(e), text: e.textContent, group: e.dataset.timedDeadlineGroup || null }));
      return { height: b.height, width: b.width, slots: col.querySelectorAll('.calendar-slot').length, first: col.querySelector('.calendar-slot')?.dataset.slotTime, last: [...col.querySelectorAll('.calendar-slot')].at(-1)?.dataset.slotTime, points, labels,
        dateOnly: [...document.querySelectorAll('.deadline-cell [data-edit-task]')].map(e => ({ id: e.dataset.editTask, text: e.textContent })), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert(data.slots === 24 && data.first === '00:00' && data.last === '23:00' && Math.abs(data.height - 24 * 62) < 2, '24-hour grid geometry changed');
    assert(!data.overflow, 'Document overflows horizontally');
    assert(JSON.stringify(data.points.map(p => p.minute).sort((a, b) => a - b)) === JSON.stringify([0, 540, 780, 1020, 1025, 1035, 1439]), 'Missing or duplicate distinct timed deadline pins');
    for (const point of data.points) {
      assert(Math.abs(point.anchorY - point.minute * 62 / 60) <= 1.5, 'Deadline point shifted from exact time: ' + JSON.stringify(point));
      assert(point.art.x >= -1 && point.art.right <= data.width + 1 && point.art.y >= -1 && point.art.bottom <= data.height + 1, 'Diamond art outside its date column');
      if (point.minute !== 0 && point.minute !== 1439) assert(Math.abs(point.art.y + point.art.height / 2 - point.minute * 62 / 60) <= 1.5, 'Non-edge diamond shifted away from exact time');
      else assert(Math.abs(point.art.y + point.art.height / 2 - point.minute * 62 / 60) <= 5.5, 'Edge diamond moved more than its approved inward inset');
    }
    assert(data.points.find(p => p.minute === 1020).count === '2', 'Same-time deadlines lost their shared pin count');
    for (const label of data.labels) assert(label.x >= -1 && label.right <= data.width + 1 && label.y >= -1 && label.bottom <= data.height + 1, 'Compact label exceeds its date column: ' + JSON.stringify(label));
    assert(expectedDateOnly ? data.dateOnly.length === 1 && data.dateOnly[0].id === f.id(6) && /End of day/.test(data.dateOnly[0].text) : data.dateOnly.length === 0, 'Date-only strip includes timed deadlines or hides its date-only task');
    assert(await f.p.locator('[data-fixture-injected],img[src="x"]').count() === 0, 'Quoted task title injected markup/attributes');
    return data;
  }
  async function groupInteractions(f) {
    await scrollTime(f, 17);
    const key = date + '-1020', trigger = () => column(f).locator(`[data-timed-deadline-group="${key}"]`);
    assert(await trigger().count() === 1, 'Close/same-time deadline group not rendered');
    const before = f.requests.length;
    if (f.touch) await trigger().tap(); else { await trigger().focus(); await f.p.keyboard.press('Enter'); }
    const group = f.p.locator('#calendar-task-preview.calendar-deadline-group-preview'); await group.waitFor({ state: 'visible' });
    assert(await trigger().getAttribute('aria-expanded') === 'true', 'Group expanded state missing');
    const rows = await group.locator('[data-deadline-preview-task]').evaluateAll(es => es.map(e => ({ id: e.dataset.deadlinePreviewTask, title: e.querySelector('.calendar-deadline-group-task-title')?.textContent, time: e.querySelector('.calendar-deadline-group-time')?.textContent })));
    assert(JSON.stringify(rows.map(r => r.id).sort()) === JSON.stringify([1, 2, 3, 9].map(f.id).sort()), 'Expanded group omitted or included the wrong task');
    for (const n of [1, 2, 3, 9]) assert(rows.find(r => r.id === f.id(n))?.title === f.rows[n - 1].title, 'Group title was truncated or unsafe');
    assert(rows.filter(r => /5:00 PM/.test(r.time)).length === 2 && rows.some(r => /5:05 PM/.test(r.time)) && rows.some(r => /5:15 PM/.test(r.time)), 'Group list changed exact deadline times');
    const groupBounds = await group.evaluate(e => { const b = e.getBoundingClientRect(); return { x: b.x, right: b.right, width: b.width, viewport: innerWidth, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth }; });
    assert(groupBounds.x >= -1 && groupBounds.right <= groupBounds.viewport + 1 && groupBounds.scrollWidth <= groupBounds.clientWidth + 1, 'Group list overflows phone/tablet viewport');
    await f.p.screenshot({ path: output + `group-${f.label}.png` });
    await f.p.keyboard.press('Escape'); await group.waitFor({ state: 'detached' });
    await wait(f.p, key => document.activeElement?.dataset.timedDeadlineGroup === key, key);
    await act(f, trigger()); await group.waitFor({ state: 'visible' });
    await act(f, group.locator(`[data-deadline-preview-task="${f.id(2)}"]`));
    await wait(f.p, title => document.querySelector('#calendar-preview-title')?.textContent === title && !document.querySelector('#calendar-task-preview')?.classList.contains('calendar-deadline-group-preview'), f.rows[1].title);
    assert(/5:15 PM/.test(await f.p.locator('.calendar-preview-dates').textContent()), 'Details opened first group time instead of selected task time');
    await f.p.keyboard.press('Escape'); await f.p.locator('#calendar-task-preview').waitFor({ state: 'detached' });
    await act(f, trigger()); await group.waitFor({ state: 'visible' });
    await act(f, group.locator(`[data-deadline-preview-task="${f.id(1)}"]`));
    await wait(f.p, title => document.querySelector('#calendar-preview-title')?.textContent === title, f.rows[0].title);
    const detailText = await f.p.locator('.calendar-preview-dates').textContent();
    assert(/10:00 AM/.test(detailText) && /5:00 PM/.test(detailText), 'Details lost independent work/deadline times');
    assert((await f.p.locator('.calendar-preview-notes').textContent()).includes(f.rows[0].notes), 'Task notes missing from details');
    await act(f, f.p.locator('#calendar-preview-edit')); await f.p.locator('#task-modal').waitFor({ state: 'visible' });
    const editor = await f.p.locator('#task-form').evaluate(form => ({ id: editingTaskId, title: form.elements.title.value, due: form.elements.dueTime.value, work: form.elements.scheduledTime.value, actual: form.elements.actualMinutes.value }));
    assert(editor.id === f.id(1) && editor.title === f.rows[0].title && editor.due === '17:00' && editor.work === '10:00' && editor.actual === '37', 'Edit handoff opened wrong task or changed metadata');
    await f.p.keyboard.press('Escape'); await f.p.locator('#task-modal').waitFor({ state: 'hidden' });
    await wait(f.p, key => document.activeElement?.dataset.timedDeadlineGroup === key, key);
    assert(f.requests.length === before, 'Opening deadline list/details/editor unexpectedly wrote task data: ' + JSON.stringify(f.requests.slice(before)));
    const overlap = await column(f).locator('.timed-deadline-anchor.has-work-overlap').count();
    assert(overlap >= 2, 'Work-overlap deadline layout was not applied');
    return { rows, groupBounds, editor, focusRestored: true, noWrites: true };
  }
  async function workRemainsSeparate(f) {
    await scrollTime(f, 17);
    const work = column(f).locator(`[data-calendar-kind="work"][data-edit-task="${f.id(7)}"]`);
    await act(f, work); await wait(f.p, title => document.querySelector('#calendar-preview-title')?.textContent === title, f.rows[6].title);
    assert(/Not scheduled|No deadline/i.test(await f.p.locator('.calendar-preview-dates').textContent()), 'Work-only task acquired a deadline');
    await f.p.keyboard.press('Escape'); await f.p.locator('#calendar-task-preview').waitFor({ state: 'detached' });
    assert(await f.p.locator('.timed-deadline-marker[data-calendar-drag-task],.timed-deadline-group-trigger[data-calendar-drag-task]').count() === 0, 'Deadline markers expose work drag semantics');
  }
  async function dragAndUndo(f) {
    const before = await f.p.evaluate(id => ({ task: structuredClone(store.listItems().find(t => t.id === id)), count: store.listItems().length }), f.id(1));
    await scrollTime(f, 11);
    const source = column(f).locator(`.calendar-event-block[data-edit-task="${f.id(1)}"]`), target = column(f).locator('[data-slot-time="11:00"]');
    await source.dragTo(target, { sourcePosition: { x: 20, y: 4 }, targetPosition: { x: 20, y: 4 } });
    await wait(f.p, id => store.listItems().find(t => t.id === id)?.scheduledStart === '2026-11-20T11:00', f.id(1));
    const moved = await f.p.evaluate(id => ({ task: store.listItems().find(t => t.id === id), count: store.listItems().length }), f.id(1));
    assert(moved.count === before.count && moved.task.dueDate === before.task.dueDate && moved.task.dueTime === before.task.dueTime && JSON.stringify(moved.task.workAlerts) === JSON.stringify(before.task.workAlerts), 'Work drag changed identity/deadline/manual alert settings');
    await f.p.locator('#toast-action').click(); await wait(f.p, id => store.listItems().find(t => t.id === id)?.scheduledStart === '2026-11-20T10:00', f.id(1));
    await wait(f.p, () => /undone|previous time/i.test(document.querySelector('#toast-message').textContent));
    return { sameIdentity: true, deadlineUnchanged: true, manualAlertsUnchanged: true, undo: true };
  }
  async function timedOnlyDay(f) {
    const original = await f.p.evaluate(id => store.listItems().find(t => t.id === id), f.id(6));
    await f.p.evaluate(task => store.upsertItem({ ...task, dueDate: '', dueTime: '' }), original);
    await wait(f.p, () => !document.querySelector('.timeline-deadlines') && !document.querySelector('.timeline-deadline-label'));
    const metrics = await inspectGeometry(f, false);
    await f.p.evaluate(task => store.upsertItem(task), original);
    await wait(f.p, () => Boolean(document.querySelector('.timeline-deadlines')));
    return { emptyStripRemoved: true, pointAndGridGeometry: metrics };
  }
  async function monthRegression(f) {
    await setView(f, 'month');
    const counts = await f.p.locator(`.month-day[data-date="${date}"]`).evaluate(e => ({ due: e.querySelector('.month-deadline-count b')?.textContent, work: e.querySelector('.month-work-count b')?.textContent, label: e.querySelector('.month-date-button')?.getAttribute('aria-label') }));
    assert(counts.due === '10' && counts.work === '4' && /11 tasks/.test(counts.label), 'Month counts changed or double-counted a task');
    const quiet = f.p.locator('.month-day[data-date="2026-11-21"]');
    if (f.width < 700) {
      await act(f, quiet.locator('.month-date-button'));
      assert(await f.p.locator(`[data-month-agenda="2026-11-21"] [data-edit-task="${f.id(11)}"]`).count() === 2, 'Phone Month agenda lost independent work/deadline occurrences');
    } else assert(await quiet.locator(`[data-edit-task="${f.id(11)}"]`).count() === 2, 'Month lost separate work/deadline entries');
    return counts;
  }
  try {
    const configs = [{ width: 1280, cloud: true, reduce: true, dark: true }];
    for (const config of configs) {
      let f;
      const result = { ...config, status: 'NOT RUN' };
      try {
        stage = 'fixture'; f = await setup(config); current = f;
        stage = 'Day exact pin/label geometry'; result.day = await inspectGeometry(f);
        stage = 'Day deadline group/list/details/edit/focus'; result.group = await groupInteractions(f);
        stage = 'Overlapping work remains separate'; await workRemainsSeparate(f);
        stage = 'Week exact marker layout'; await setView(f, 'week'); result.week = await inspectGeometry(f);
        assert(await f.p.locator('.timeline-column').count() === (f.width < 700 ? 1 : 7), 'Week column behavior changed');
        if (f.width < 700) assert(await f.p.locator('.phone-week-day').count() === 7, 'Phone Week selector disappeared');
        await scrollTime(f, 17); await f.p.screenshot({ path: output + `week-${f.label}.png` });
        stage = 'Week deadline list and focus'; await groupInteractions(f);
        if (f.width === 1280) { stage = 'Work drag/Undo'; await setView(f, 'day'); result.drag = await dragAndUndo(f); stage = 'Timed-only day empty strip removal'; result.timedOnlyDay = await timedOnlyDay(f); }
        stage = 'Month regression'; result.month = await monthRegression(f);
        stage = 'Reload persistence'; await f.p.reload({ waitUntil: 'domcontentloaded' });
        await wait(f.p, id => typeof store !== 'undefined' && workAlertContextReady && store.listItems().find(t => t.id === id)?.dueTime === '17:00', f.id(1));
        const restored = await f.p.evaluate(id => store.listItems().find(t => t.id === id), f.id(1));
        assert(restored.scheduledStart === date + 'T10:00' && restored.actualMinutes === 37 && restored.reminderChoice === '15', 'Reload lost independent task fields');
        assert(!f.errors.length, 'Unexpected page errors: ' + f.errors.join('; ')); result.status = 'PASS'; result.mode = f.cloud ? 'real isolated signed-in Worker/schema0001–0008' : 'isolated browser local storage';
      } catch (error) { result.status = 'FAIL'; result.stage = stage; result.error = error.message; await f?.p.screenshot({ path: output + `failure-${f.label}.png` }).catch(() => {}); }
      finally { if (f) { await f.c.close(); contexts.splice(contexts.indexOf(f.c), 1); } }
      cases.push(result);
      if (result.status === 'FAIL') break;
    }
    return { runtime: browser.version(), cases, passed: cases.length === 8 && cases.every(c => c.status === 'PASS'), productionWrites: false, nativeChanges: false, serviceWorkers: 'blocked for isolated focused UI checks' };
  } finally { for (const c of contexts) await c.close().catch(() => {}); }
}
