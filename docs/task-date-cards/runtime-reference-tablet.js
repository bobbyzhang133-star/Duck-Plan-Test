// Clean local-only illustrative runtime screenshot; no user records or generated mockup.
async page => {
  const browser = page.context().browser(), c = await browser.newContext({ viewport: { width: 835, height: 1000 }, hasTouch: true, isMobile: false, locale: 'en-US', timezoneId: 'America/Los_Angeles', reducedMotion: 'reduce', serviceWorkers: 'block' });
  const tasks = [
    { id: 'ref-review', title: 'Review app wireframe', classId: 'ref-cs', priority: 'Low', dueDate: '2026-11-19', dueTime: '17:00', scheduledStart: '2026-11-18T16:30', durationMinutes: 60, completed: false, schemaVersion: 2 },
    { id: 'ref-lab', title: 'Organize lab notes', classId: 'ref-physics', priority: 'Medium', dueDate: '2026-11-20', dueTime: '21:00', scheduledStart: '2026-11-20T19:45', durationMinutes: 45, completed: false, schemaVersion: 2 },
    { id: 'ref-calc', title: 'Finish calculus practice', classId: 'ref-calc-class', priority: 'High', dueDate: '2026-11-20', dueTime: '17:00', scheduledStart: '2026-11-19T14:00', durationMinutes: 60, completed: false, schemaVersion: 2 },
  ];
  const classes = [{ id: 'ref-cs', name: 'Computer Science', color: '#379b74' }, { id: 'ref-physics', name: 'Physics', color: '#7b6bc5' }, { id: 'ref-calc-class', name: 'Calculus', color: '#538fc5' }];
  await c.addInitScript(({ tasks, classes }) => { localStorage.setItem('duckplan-demo-tasks-v1', JSON.stringify(tasks)); localStorage.setItem('duckplan-demo-classes-v1', JSON.stringify(classes)); }, { tasks, classes });
  const p = await c.newPage();
  try {
    await p.clock.install({ time: new Date('2026-11-20T12:00:00-08:00') });
    await p.goto('http://127.0.0.1:8034/?qa=task-card-reference#calendar', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof store !== 'undefined' && workAlertContextReady && store.listItems().length === 3);
    await p.evaluate(() => { document.documentElement.dataset.theme = 'light'; selectedDate = '2026-11-20'; calendarView = 'day'; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); });
    await p.locator('#daily-task-panel').evaluate(e => { e.scrollTop = 0; });
    await p.screenshot({ path: '/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/task-date-cards/reference-task-cards-tablet.png' });
    const proof = await p.locator('#daily-task-panel').evaluate(e => ({ cards: [...e.querySelectorAll('[data-task-card]')].map(c => ({ title: c.querySelector('.task-title')?.textContent, due: c.querySelector('.task-date-due')?.textContent, work: c.querySelector('.task-date-work')?.textContent, overdue: c.classList.contains('is-overdue'), afterDeadline: c.classList.contains('is-work-after-deadline') })), overflow: e.scrollWidth > e.clientWidth }));
    if (proof.cards.length !== 3 || proof.cards.filter(c => c.overdue).length !== 1 || proof.cards.some(c => c.afterDeadline) || proof.overflow) throw new Error('Clean reference date semantics differ');
    return { status: 'PASS', runtime: browser.version(), viewport: { width: 835, height: 1000 }, fixtureNow: '2026-11-20T12:00:00-08:00', selectedDate: '2026-11-20', proof, productionWrites: false };
  } finally { await c.close(); }
}
