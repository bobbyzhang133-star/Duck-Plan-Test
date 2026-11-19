async page => {
  const browser = page.context().browser();
  async function capture(kind) {
    const c = await browser.newContext({ viewport: { width: 1280, height: 950 }, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = []; p.on("pageerror", e => errors.push(e.message));
      const url = kind === "google" ? "https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles&mode=WEEK" : "http://127.0.0.1:8034/?qa=native-reference#calendar";
      await p.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      if (kind === "google") {
        await p.waitForSelector(".mDPmMe", { timeout: 20000 }); await p.waitForTimeout(1800);
        await p.evaluate(() => { document.querySelector(".mDPmMe").scrollTop = 0; });
      } else {
        await p.waitForFunction(() => typeof store !== "undefined" && workAlertContextReady);
        await p.evaluate(() => { calendarView = "week"; renderAll({ autoScrollCalendar: false }); document.querySelector("#planner-calendar").scrollTop = 0; });
      }
      await p.waitForTimeout(250);
      const probe = await p.evaluate(kind => {
        if (kind === "google") return { mode: "white-edge", x: 500, minY: 30, maxY: 150 };
        const column = document.querySelector(".timeline-column").getBoundingClientRect();
        return { mode: "hour-rule", x: Math.round(column.left + 40), minY: Math.round(column.top + 40), maxY: Math.round(column.top + 100) };
      }, kind);
      const records = kind === "google" ? null : await p.evaluate(() => JSON.stringify(store.listItems()));
      const cd = await c.newCDPSession(p), events = []; let triggeredAt = 0;
      cd.on("Page.screencastFrame", e => { events.push({ time: Date.now(), png: e.data }); cd.send("Page.screencastFrameAck", { sessionId: e.sessionId }).catch(() => {}); });
      await cd.send("Page.startScreencast", { format: "png", everyNthFrame: 1 }); await p.waitForTimeout(100);
      const xy = await p.locator(kind === "google" ? ".mDPmMe" : ".timeline-column").first().boundingBox();
      triggeredAt = Date.now();
      await cd.send("Input.synthesizeScrollGesture", { x: xy.x + xy.width / 2, y: xy.y + 120, yDistance: 240, gestureSourceType: "mouse", preventFling: false, speed: 1800 });
      await p.waitForTimeout(700); await cd.send("Page.stopScreencast");
      if (records !== null && records !== await p.evaluate(() => JSON.stringify(store.listItems()))) throw Error("Gesture edited tasks");
      if (errors.length) throw Error(errors.join("; "));
      return { kind, referenceUrl: url, runtime: browser.version(), platform: await p.evaluate(() => navigator.platform), probe, events: events.map(e => ({ timeMs: e.time - triggeredAt, png: e.png })) };
    } finally { await c.close(); }
  }
  // Fresh reference visit, matching Week view/input, then return to Google after DuckPlan.
  return { googleBefore: await capture("google"), local: await capture("local"), googleAfter: await capture("google") };
}
