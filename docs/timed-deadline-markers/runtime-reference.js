// Actual rendered local phone example, using a disposable browser context.
async page => {
  const browser = page.context().browser(), c = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'en-US', timezoneId: 'America/Los_Angeles', reducedMotion: 'reduce', serviceWorkers: 'block' });
  const taskID = '78000000-0000-4000-8000-000000000001', classID = '78000000-0000-4000-8000-000000000090';
  await c.addInitScript(({ taskID, classID }) => {
    localStorage.setItem('duckplan-demo-classes-v1', JSON.stringify([{ id: classID, name: 'Calculus', color: '#538fc5', code: 'CALC' }]));
    localStorage.setItem('duckplan-demo-tasks-v1', JSON.stringify([{ id: taskID, classId: classID, title: 'Finish calculus practice', dueDate: '2026-11-20', dueTime: '17:00', scheduledStart: '2026-11-20T15:00', durationMinutes: 60, priority: 'Medium', completed: false, schemaVersion: 2 }]));
  }, { taskID, classID });
  const p = await c.newPage(); p.setDefaultTimeout(15000);
  try {
    await p.clock.install({ time: new Date('2026-11-20T12:00:00-08:00') });
    await p.goto('http://127.0.0.1:8034/?qa=timed-reference#calendar', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof store !== 'undefined' && workAlertContextReady && document.body.dataset.view === 'calendar');
    await p.evaluate(() => { selectedDate = '2026-11-20'; calendarView = 'day'; calendarUserScrolled = true; renderAll({ autoScrollCalendar: false }); document.querySelector('#planner-calendar').scrollTop = 14 * 62; });
    const proof = await p.evaluate(id => {
      const work = document.querySelector(`.calendar-event-block[data-edit-task="${id}"]`), due = document.querySelector(`.timed-deadline-marker[data-edit-task="${id}"]`), col = document.querySelector('.timeline-column'), point = col.querySelector('.timed-deadline-point');
      return { workTitle: work.textContent, dueTitle: due.textContent, workMinute: (work.getBoundingClientRect().top - col.getBoundingClientRect().top) * 60 / 62, dueMinute: Number(point.dataset.deadlineMinute), emptyDateOnlyStrip: !document.querySelector('.timeline-deadlines'), documentOverflow: document.documentElement.scrollWidth > innerWidth };
    }, taskID);
    if (Math.abs(proof.workMinute - 900) > 1 || proof.dueMinute !== 1020 || !proof.emptyDateOnlyStrip || proof.documentOverflow) throw new Error('Clean reference timing/layout mismatch');
    await p.screenshot({ path: '/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/timed-deadline-markers/reference-demo-phone.png' });
    return { status: 'PASS', runtime: browser.version(), mode: 'fresh local Chromium phone emulation, not physical Safari', proof, productionWrites: false };
  } finally { await c.close(); }
}
