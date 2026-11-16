// One revised daily-card layout preflight before final eight-client acceptance.
// Focused card metadata checks in isolated browser storage and real localhost QA accounts.
async page => {
  const browser = page.context().browser(), contexts = [], cases = [];
  const out = '/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/task-date-cards/';
  const today = '2026-11-20';
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 15000 });
  let stage = 'setup';
  function fixtures() {
    const prefix = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0'), id = n => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const prefs = { version: 1, timeZone: 'America/Los_Angeles', alarm: { enabled: false, mode: 'manual', at: '2026-11-21T16:45', sound: 'gentle', snoozeMinutes: 10 }, notification: { enabled: false, mode: 'manual', at: '2026-11-21T16:50' } };
    const base = { classId: id(90), priority: 'Medium', durationMinutes: 45, notes: 'Keep independent due/work dates and saved task settings.', completed: false, source: 'manual', schemaVersion: 2, dueDate: '', dueTime: '', scheduledStart: null };
    const rows = [
      { title: 'Past deadline with work today', dueDate: '2026-11-19', dueTime: '17:00', scheduledStart: today + 'T15:00', priority: 'High', actualMinutes: 0, reminderChoice: '15', workAlerts: prefs },
      { title: 'Future deadline with earlier work', dueDate: '2026-11-21', dueTime: '17:00', scheduledStart: today + 'T10:00', durationMinutes: 60 },
      { title: 'Date-only due today without a work slot', dueDate: today },
      { title: 'Earlier timed deadline today', dueDate: today, dueTime: '09:00', scheduledStart: today + 'T08:00', durationMinutes: 30, priority: 'High' },
      { title: 'Work tomorrow is not Today', dueDate: '2026-11-21', dueTime: '18:00', scheduledStart: '2026-11-21T16:00' },
      { title: 'Overnight work crosses deadline', dueDate: '2026-11-21', dueTime: '00:15', scheduledStart: today + 'T23:30', durationMinutes: 90, priority: 'High' },
      { title: 'Completed past deadline has no warning', dueDate: '2026-11-19', dueTime: '17:00', scheduledStart: today + 'T07:00', completed: true },
      { title: 'Inbox task without dates' },
      { title: 'Long "quoted" <span data-fixture-injected="yes"> title & clear dates without HTML injection', dueDate: today, dueTime: '19:00', scheduledStart: today + 'T17:00', durationMinutes: 60, priority: 'Low', classId: id(91) },
      { title: 'Scheduled work without a deadline', scheduledStart: today + 'T14:00' },
      { title: 'Past work is not Today', dueDate: '2026-11-19', scheduledStart: '2026-11-19T20:30' },
      { title: 'Future date-only deadline', dueDate: '2026-11-22' },
    ].map((task, i) => ({ ...base, ...task, id: id(i + 1) }));
    const expected = { 1: [true, true], 2: [false, false], 3: [false, false], 4: [true, false], 5: [false, false], 6: [false, true], 7: [false, false], 8: [false, false], 9: [false, false], 10: [false, false], 11: [true, false], 12: [false, false] };
    const classes = [{ id: id(90), name: 'Calculus', color: '#538fc5', code: 'CALC' }, { id: id(91), name: 'Computer Science and a long course title', color: '#7b6bc5', code: 'CS' }];
    return { id, rows, classes, expected };
  }
  async function setup(config) {
    const data = fixtures(), origin = config.cloud ? 'http://127.0.0.1:8796' : 'http://127.0.0.1:8034';
    const c = await browser.newContext({ viewport: { width: config.width, height: config.width < 700 ? 844 : 1000 }, hasTouch: config.width < 1000, isMobile: config.width < 700, locale: 'en-US', timezoneId: 'America/Los_Angeles', colorScheme: config.dark ? 'dark' : 'light', reducedMotion: config.reduce ? 'reduce' : 'no-preference', serviceWorkers: 'block' }); contexts.push(c);
    await c.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    if (config.cloud) {
      const signup = await c.request.post(origin + '/api/auth/sign-up', { headers: { Origin: origin }, data: { email: `task-card-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`, password: `Synthetic-${Date.now()}-${Math.random()}` }, timeout: 15000 }); assert(signup.status() === 201, 'Synthetic signup failed');
      const response = await c.request.post(origin + '/api/import', { headers: { Origin: origin }, data: { classRows: data.classes.map(t => ({ ...t })), itemRows: data.rows.map(t => ({ id: t.id, class_id: t.classId, title: t.title, notes: t.notes, priority: t.priority, due_date: t.dueDate || null, due_time: t.dueTime || null, scheduled_start: t.scheduledStart, duration_minutes: t.durationMinutes, completed: t.completed, ...(t.workAlerts ? { work_alerts: t.workAlerts, task_details: { version: 1, actualMinutes: t.actualMinutes, reminderChoice: t.reminderChoice } } : {}) })) }, timeout: 15000 }); assert(response.status() === 200, 'Synthetic fixture import failed');
    } else await c.addInitScript(({ rows, classes }) => { if (localStorage.getItem('task-date-card-fixture')) return; localStorage.setItem('duckplan-demo-tasks-v1', JSON.stringify(rows)); localStorage.setItem('duckplan-demo-classes-v1', JSON.stringify(classes)); localStorage.setItem('task-date-card-fixture', 'ready'); }, data);
    const p = await c.newPage(), errors = [];
    p.setDefaultTimeout(15000); p.setDefaultNavigationTimeout(30000); p.on('pageerror', e => errors.push(e.message));
    await p.clock.install({ time: new Date('2026-11-20T12:00:00-08:00') });
    await p.goto(origin + '/?qa=task-date-cards#calendar', { waitUntil: 'domcontentloaded' });
    await wait(p, ({ cloud, id }) => typeof store !== 'undefined' && workAlertContextReady && store.mode === (cloud ? 'cloud' : 'local') && store.listItems().some(t => t.id === id) && document.body.dataset.view === 'calendar', { cloud: config.cloud, id: data.id(12) });
    await p.evaluate(({ today, dark }) => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; selectedDate = today; calendarView = 'day'; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); }, { today, dark: config.dark });
    return { ...config, ...data, c, p, errors, origin, touch: config.width < 1000, label: `${config.cloud ? 'cloud' : 'local'}-${config.width}` };
  }
  const act = (f, locator) => f.touch ? locator.tap() : locator.click();
  async function panel(f, open) {
    if (f.width >= 700) return;
    const current = await f.p.evaluate(() => document.body.classList.contains('task-panel-open'));
    if (current !== open) await act(f, open ? f.p.locator('#phone-task-summary') : f.p.locator('#calendar-library-toolbar [data-close-task-panel]'));
    await wait(f.p, open => document.body.classList.contains('task-panel-open') === open, open);
  }
  async function nav(f, view) {
    if (view !== 'calendar') await panel(f, false);
    if (f.width < 700) { const direct = f.p.locator(`.phone-bottom-nav [data-view="${view}"]`); if (await direct.count()) await act(f, direct); else { await act(f, f.p.locator('#phone-more-button')); await act(f, f.p.locator(`#phone-more-dialog [data-view="${view}"]`)); } }
    else await act(f, f.p.locator(`#planner-sidebar [data-view="${view}"]`));
    await wait(f.p, view => document.body.dataset.view === view && !document.querySelector('[data-page-transition-phase]'), view);
  }
  const calendarCard = (f, n) => f.p.locator(`#daily-task-panel [data-task-card="${f.id(n)}"]`);
  const allCard = (f, n) => f.p.locator(`#all-task-list .task-select[data-edit-task="${f.id(n)}"]`).locator('..');
  async function inspectCard(f, locator, n, allTasks = false) {
    const row = f.rows[n - 1], expected = f.expected[n];
    const info = await locator.evaluate(el => {
      const box = el.getBoundingClientRect(), due = el.querySelector('.task-date-due'), work = el.querySelector('.task-date-work');
      const value = e => e?.querySelector('.task-date-value')?.textContent || null;
      const icon = e => { const s = e?.querySelector('svg.task-date-icon'); return s ? { hidden: s.getAttribute('aria-hidden'), focusable: s.getAttribute('focusable'), width: s.getBoundingClientRect().width } : null; };
      return { title: el.querySelector('.task-title')?.textContent, due: value(due), work: value(work), dueCount: el.querySelectorAll('.task-date-due').length, workCount: el.querySelectorAll('.task-date-work').length,
        dueIcon: icon(due), workIcon: icon(work), past: el.querySelector('.task-overdue-label')?.textContent || null, after: el.querySelector('.task-plan-warning')?.textContent || null,
        overdueClass: el.classList.contains('is-overdue'), afterClass: el.classList.contains('is-work-after-deadline'), completed: el.classList.contains('completed'), text: el.textContent,
        dueColumnCount: el.querySelectorAll('.task-due').length, dueColumnText: el.querySelector('.task-due')?.textContent || null,
        dot: el.querySelector('.course-dot')?.getBoundingClientRect().width || 0, priority: el.querySelector('.priority-tag')?.textContent,
        dueColor: due ? getComputedStyle(due.querySelector('.task-date-value')).color : null, workColor: work ? getComputedStyle(work.querySelector('.task-date-value')).color : null,
        dueWeight: due ? getComputedStyle(due.querySelector('.task-date-value')).fontWeight : null, workWeight: work ? getComputedStyle(work.querySelector('.task-date-value')).fontWeight : null,
        overflow: el.scrollWidth > el.clientWidth + 1,
        childBounds: [...el.querySelectorAll('.task-select,.task-edit,.task-check,.task-date-line,.task-timing-badges')].map(e => { const r = e.getBoundingClientRect(); return { className: e.className, left: r.left - box.left, right: r.right - box.left, width: r.width, cardWidth: box.width }; }) };
    });
    assert(info.title === row.title && info.dot > 0 && info.priority === row.priority, 'Card lost title/class dot/priority: ' + n);
    assert(info.overdueClass === expected[0] && info.afterClass === expected[1] && Boolean(info.past) === expected[0] && Boolean(info.after) === expected[1], 'Card warning differs from real date semantics: ' + n + JSON.stringify(info));
    if (info.past) assert(/Past deadline/.test(info.past), 'Past deadline label missing');
    if (info.after) assert(/Work after deadline/.test(info.after), 'Work-after-deadline label missing');
    assert(info.completed === row.completed, 'Completed task state changed');
    if (n === 1) assert(/0 min spent/.test(info.text), 'Logged zero minutes disappeared');
    if (allTasks) assert(info.dueCount === 0 && info.dueColumnCount === 1 && info.workCount === 1, 'All Tasks duplicates Due or loses its external Due column');
    else assert(info.dueCount === 1 && info.dueColumnCount === 0 && info.workCount === Number(Boolean(row.scheduledStart || !row.dueDate)), 'Card date-only/inbox row rules differ');
    if (!allTasks) {
      if (row.dueDate) assert(info.due.includes('Nov ' + Number(row.dueDate.slice(-2))) && (row.dueTime ? info.due.includes(row.dueTime === '00:15' ? '12:15 AM' : row.dueTime === '09:00' ? '9:00 AM' : row.dueTime === '18:00' ? '6:00 PM' : row.dueTime === '19:00' ? '7:00 PM' : '5:00 PM') : info.due.includes('End of day')), 'Due date/time changed: ' + n + info.due);
      else assert(info.due === 'No deadline', 'Undated task acquired a deadline');
    }
    if (row.scheduledStart) {
      assert(Boolean(info.work?.includes('Today')) === row.scheduledStart.startsWith(today), 'Work Today label followed selected date instead of actual now: ' + n + info.work);
      if (n === 6) assert(/11:30 PM/.test(info.work) && /1:00 AM/.test(info.work) && /Nov 21/.test(info.work), 'Overnight work lost its next-day end date');
    } else if (info.workCount) assert(info.work === 'Not scheduled', 'Unscheduled task gained a work time');
    for (const i of [info.dueIcon, info.workIcon].filter(Boolean)) assert(i.hidden === 'true' && i.focusable === 'false' && i.width > 0, 'Metadata icon missing or focusable');
    if (!row.completed && info.work && info.due) assert(info.dueColor !== info.workColor && Number(info.dueWeight) >= Number(info.workWeight), 'Due hierarchy is not stronger than muted Work');
    assert(!info.overflow && info.childBounds.every(b => b.left >= -1 && b.right <= b.cardWidth + 1), 'Card metadata or controls overflow: ' + n + JSON.stringify(info.childBounds));
    return info;
  }
  async function calendarChecks(f) {
    await panel(f, true);
    const checked = [];
    for (const n of [1, 2, 3, 4, 6, 7, 8, 9, 10, 11]) checked.push({ n, ...(await inspectCard(f, calendarCard(f, n), n)) });
    await calendarCard(f, 1).scrollIntoViewIfNeeded(); await f.p.screenshot({ path: out + `calendar-${f.label}.png` });
    await f.p.evaluate(() => { selectedDate = '2026-11-21'; renderAll({ autoScrollCalendar: false }); });
    const selectedFuture = { todayWork: await inspectCard(f, calendarCard(f, 1), 1), futureWork: await inspectCard(f, calendarCard(f, 5), 5), pastWork: await inspectCard(f, calendarCard(f, 11), 11) };
    await f.p.evaluate(() => { selectedDate = '2026-11-20'; renderAll({ autoScrollCalendar: false }); });
    return { checked, selectedFutureDoesNotRedefineToday: selectedFuture };
  }
  async function controls(f) {
    await act(f, calendarCard(f, 1).locator('.task-select')); await f.p.locator('#task-modal').waitFor({ state: 'visible' });
    assert(await f.p.evaluate(id => editingTaskId === id && els.form.elements.actualMinutes.value === '0' && els.form.elements.dueTime.value === '17:00' && els.form.elements.scheduledTime.value === '15:00', f.id(1)), 'Card click opened wrong editor or lost zero/detail values');
    await f.p.keyboard.press('Escape'); await f.p.locator('#task-modal').waitFor({ state: 'hidden' });
    await act(f, calendarCard(f, 9).locator('.task-edit')); await f.p.locator('#task-modal').waitFor({ state: 'visible' });
    assert(await f.p.evaluate(id => editingTaskId === id, f.id(9)), 'Ellipsis opened wrong task');
    await f.p.keyboard.press('Escape'); await f.p.locator('#task-modal').waitFor({ state: 'hidden' });
    await act(f, calendarCard(f, 6).locator('.task-reschedule')); await f.p.locator('#task-modal').waitFor({ state: 'visible' });
    assert(await f.p.evaluate(id => editingTaskId === id && els.form.elements.scheduledTime.value === '23:30', f.id(6)), 'Reschedule warning opened wrong work time');
    await f.p.keyboard.press('Escape'); await f.p.locator('#task-modal').waitFor({ state: 'hidden' });
    for (const completed of [true, false]) {
      const response = f.cloud ? f.p.waitForResponse(r => new URL(r.url()).pathname === `/api/items/${f.id(2)}` && r.request().method() === 'PATCH') : null;
      await calendarCard(f, 2).locator('.task-check').setChecked(completed);
      if (response) assert((await response).status() === 200, 'Checkbox change did not persist');
      await wait(f.p, ({ id, completed }) => store.listItems().find(t => t.id === id)?.completed === completed, { id: f.id(2), completed });
      assert(!await f.p.locator('#task-modal').evaluate(e => e.open), 'Checkbox opened editor');
    }
    assert(await f.p.locator('[data-fixture-injected]').count() === 0, 'Quoted title injected markup');
    return { clickEditor: true, ellipsis: true, reschedule: true, completeReopenPersisted: true };
  }
  async function dashboardChecks(f) {
    await nav(f, 'home');
    const checked = [];
    for (const n of [1, 2, 3, 4, 6, 9, 10]) checked.push({ n, ...(await inspectCard(f, f.p.locator(`#dashboard-task-list [data-task-card="${f.id(n)}"]`), n)) });
    await f.p.locator('.dashboard-completed').evaluate(e => { e.open = true; });
    await inspectCard(f, f.p.locator(`#dashboard-completed-list [data-task-card="${f.id(7)}"]`), 7);
    await f.p.locator(`#dashboard-task-list [data-task-card="${f.id(1)}"]`).scrollIntoViewIfNeeded(); await f.p.screenshot({ path: out + `dashboard-${f.label}.png` });
    return { activeCards: checked, completedHasNoOverdueWarning: true };
  }
  async function allTaskChecks(f) {
    await nav(f, 'tasks'); await act(f, f.p.locator('#view-tasks [data-filter="all"]'));
    const checked = [];
    for (let n = 1; n <= f.rows.length; n += 1) checked.push({ n, ...(await inspectCard(f, allCard(f, n), n, true)) });
    await allCard(f, 1).scrollIntoViewIfNeeded(); await f.p.screenshot({ path: out + `tasks-${f.label}.png` });
    return checked;
  }
  async function dragAndReload(f) {
    await nav(f, 'calendar'); await panel(f, true);
    const before = await f.p.evaluate(id => ({ task: structuredClone(store.listItems().find(t => t.id === id)), count: store.listItems().length }), f.id(1));
    if (f.width === 1280) {
      await f.p.evaluate(() => { selectedDate = '2026-11-20'; calendarView = 'day'; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); document.querySelector('#planner-calendar').scrollTop = 15 * 62; });
      const source = calendarCard(f, 1).locator('.task-select'), target = f.p.locator('[data-slot-date="2026-11-20"][data-slot-time="16:00"]');
      await source.scrollIntoViewIfNeeded(); await source.dragTo(target, { sourcePosition: { x: 20, y: 4 }, targetPosition: { x: 20, y: 4 } });
      await wait(f.p, id => store.listItems().find(t => t.id === id)?.scheduledStart === '2026-11-20T16:00', f.id(1));
      await f.p.locator('#toast-action').click(); await wait(f.p, id => store.listItems().find(t => t.id === id)?.scheduledStart === '2026-11-20T15:00', f.id(1));
    }
    await panel(f, false);
    const points = await f.p.evaluate(() => [...document.querySelectorAll('.timeline-column[data-column-date="2026-11-20"] .timed-deadline-point')].map(e => ({ minute: Number(e.dataset.deadlineMinute), y: e.getBoundingClientRect().top - e.closest('.timeline-column').getBoundingClientRect().top })));
    assert(points.some(p => p.minute === 540 && Math.abs(p.y - 9 * 62) < 1.5) && points.some(p => p.minute === 1140 && Math.abs(p.y - 19 * 62) < 1.5), 'Existing exact timed deadline markers shifted');
    await f.p.reload({ waitUntil: 'domcontentloaded' }); await wait(f.p, id => typeof store !== 'undefined' && workAlertContextReady && store.listItems().some(t => t.id === id), f.id(1));
    const after = await f.p.evaluate(id => ({ task: store.listItems().find(t => t.id === id), count: store.listItems().length }), f.id(1));
    for (const k of ['id', 'dueDate', 'dueTime', 'scheduledStart', 'durationMinutes', 'notes', 'actualMinutes', 'reminderChoice']) assert(after.task[k] === before.task[k], 'Card interaction/reload changed task field: ' + k);
    assert(after.count === before.count && JSON.stringify(after.task.workAlerts) === JSON.stringify(before.task.workAlerts), 'Identity/count/preferences changed');
    return { trustedDesktopDragAndUndo: f.width === 1280, exactDueWorkPrefsAfterReload: true, timedDeadlinePinsUnchanged: points };
  }
  try {
    for (const config of [{ width: 835, cloud: false, reduce: true }]) {
      let f; const result = { ...config, status: 'NOT RUN' };
      try {
        stage = 'setup'; f = await setup(config);
        stage = 'Calendar date cards'; result.calendar = await calendarChecks(f);
        stage = 'Card controls'; result.controls = await controls(f);
        stage = 'Dashboard date cards'; result.dashboard = await dashboardChecks(f);
        stage = 'All Tasks single Due column'; result.tasks = await allTaskChecks(f);
        stage = 'Drag/reload/timed-marker regression'; result.persistence = await dragAndReload(f);
        assert(!f.errors.length, 'Page errors: ' + f.errors.join('; '));
        assert(await f.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Document horizontal overflow');
        result.status = 'PASS';
      } catch (error) { result.status = 'FAIL'; result.stage = stage; result.error = error.message; if (f) await f.p.screenshot({ path: out + `failure-${f.label}.png` }).catch(() => {}); }
      finally { if (f) { await f.c.close(); contexts.splice(contexts.indexOf(f.c), 1); } }
      cases.push(result); if (result.status === 'FAIL') break;
    }
    return { runtime: browser.version(), cases, passed: cases.length === 1 && cases.every(c => c.status === 'PASS'), productionWrites: false, nativeOperations: false };
  } finally { for (const c of contexts) await c.close().catch(() => {}); }
}
