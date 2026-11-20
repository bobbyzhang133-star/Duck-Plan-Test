async page => {
  const browser = page.context().browser();
  async function capture(kind, boundary = "top", target = "body") {
    const c = await browser.newContext({ viewport: { width: 1280, height: 950 }, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = []; p.on("pageerror", e => errors.push(e.message));
      const url = kind === "historical" ? "http://127.0.0.1:8038/#calendar" : "http://127.0.0.1:8034/?qa=smooth-native-rebound#calendar";
      await p.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await p.bringToFront();
      await p.waitForTimeout(500);
      const ready = await p.evaluate(() => typeof store !== "undefined" && typeof renderAll === "function");
      if (!ready) throw Error(`Calendar scripts not ready: ${kind} ${p.url()} ${JSON.stringify(await p.evaluate(() => ({ title: document.title, state: document.readyState, storeType: typeof store, renderType: typeof renderAll, scripts: document.scripts.length, grid: Boolean(document.querySelector('.timeline-calendar')) })))}, ${errors.join(';')}`);
      await p.evaluate(boundary => {
        calendarView = "week"; renderAll({ autoScrollCalendar: false });
        const root = document.querySelector("#planner-calendar");
        const surface = window.DuckCalendarViewport?.scroller?.(root) || root;
        surface.scrollTop = boundary === "bottom" ? surface.scrollHeight : 0;
      }, boundary);
      await p.waitForTimeout(250);
      const probe = await p.evaluate(boundary => {
        const column = document.querySelector(".timeline-column").getBoundingClientRect();
        const header = document.querySelector(".calendar-date-button").getBoundingClientRect();
        const body = (window.DuckCalendarViewport?.scroller?.(document.querySelector("#planner-calendar")) || document.querySelector("#planner-calendar")).getBoundingClientRect();
        return { mode: "hour-rule", x: Math.round(column.left + 40), minY: Math.round(boundary === "bottom" ? body.bottom - 100 : column.top + 40), maxY: Math.round(boundary === "bottom" ? body.bottom - 25 : column.top + 100),
          header: { x: Math.round(header.left + header.width / 2), minY: Math.round(header.top + 3), maxY: Math.round(header.top + 36) } };
      }, boundary);
      await p.evaluate(() => { window.qaWheelTimes = []; window.addEventListener("wheel", e => qaWheelTimes.push({ time: Date.now(), deltaY: e.deltaY }), { passive: true }); });
      const records = kind === "historical" ? null : await p.evaluate(() => JSON.stringify(store.listItems()));
      const cd = await c.newCDPSession(p), events = []; let triggeredAt = 0;
      cd.on("Page.screencastFrame", e => { events.push({ time: e.metadata.timestamp ? e.metadata.timestamp * 1000 : Date.now(), png: e.data }); cd.send("Page.screencastFrameAck", { sessionId: e.sessionId }).catch(() => {}); });
      await cd.send("Page.startScreencast", { format: "png", everyNthFrame: 1 }); await p.waitForTimeout(100);
      const xy = await p.locator(target === "header" ? ".calendar-date-button" : (kind === "historical" ? "#planner-calendar" : ".calendar-timeline-scroller")).first().boundingBox();
      triggeredAt = Date.now();
      await cd.send("Input.synthesizeScrollGesture", { x: xy.x + xy.width / 2, y: xy.y + Math.min(120,xy.height/2), yDistance: boundary === "bottom" ? -240 : 240, gestureSourceType: "mouse", preventFling: false, speed: 1800 });
      await p.waitForTimeout(700);
      const applicationAtEnd = kind === "historical" ? null : await p.evaluate(() => {
        const grid = document.querySelector(".timeline-calendar");
        return { transform: getComputedStyle(grid).transform, animations: grid.getAnimations().length };
      });
      // Keep a separately identified settled screenshot: a screencast can drop
      // its final unchanged frame, which must not be mistaken for a fast return.
      const settled = await p.screenshot();
      const settledPng = settled.toString("base64");
      await cd.send("Page.stopScreencast");
      if (records !== null && records !== await p.evaluate(() => JSON.stringify(store.listItems()))) throw Error("Gesture edited tasks");
      if (errors.length) throw Error(errors.join("; "));
      // Analyze pixels after the gesture, on a separate page. Only compact
      // samples and three representative PNGs cross the MCP response boundary.
      const analysis = await c.newPage();
      const measurements = await analysis.evaluate(async ({ frames, probe }) => {
        const samples = [];
        for (const frame of frames) {
          const bytes = Uint8Array.from(atob(frame.png), ch => ch.charCodeAt(0));
          const image = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
          function measure(x, minY, maxY, header) {
            const canvas = new OffscreenCanvas(1, maxY - minY), context = canvas.getContext("2d");
            context.drawImage(image, x, minY, 1, maxY - minY, 0, 0, 1, maxY - minY);
            const pixels = context.getImageData(0, 0, 1, maxY - minY).data;
            let row = -1, darkest = 256;
            for (let y = 0; y < maxY - minY; y++) {
              if (header && pixels[y * 4] < 180 && pixels[y * 4 + 1] < 180 && pixels[y * 4 + 2] < 180) return minY + y;
              if (!header && pixels[y * 4 + 2] < darkest) { darkest = pixels[y * 4 + 2]; row = minY + y; }
            }
            return row;
          }
          samples.push({ time: frame.time, paintEdgeY: measure(probe.x, probe.minY, probe.maxY, false),
            headerY: measure(probe.header.x, probe.header.minY, probe.header.maxY, true) });
          image.close();
        }
        return samples;
      }, { frames: events, probe });
      const baseline = measurements[0].paintEdgeY;
      const peak = measurements.reduce((best, sample, index) => (boundary === "bottom" ? sample.paintEdgeY < measurements[best].paintEdgeY : sample.paintEdgeY > measurements[best].paintEdgeY) ? index : best, 0);
      await analysis.close();
      return { kind, boundary, target, referenceUrl: url, runtime: browser.version(), platform: await p.evaluate(() => navigator.platform), probe, applicationAtEnd,
        gestureStartTime: triggeredAt, inputEvents: await p.evaluate(() => qaWheelTimes),
        samples: measurements.map(sample => ({ timeMs: sample.time - triggeredAt, paintEdgeY: sample.paintEdgeY, headerY: sample.headerY })),
        screenshots: { before: events[0].png, peak: events[peak].png, settled: settledPng },
        peakPx: measurements[peak].paintEdgeY - baseline };

    } finally { await c.close(); }
  }
  // Historical native reference, restored site, then return to the historical reference.
  const results = {};
  for (const boundary of ["top", "bottom"]) {
    results[boundary] = { historicalBefore: await capture("historical", boundary), local: await capture("local", boundary), historicalAfter: await capture("historical", boundary) };
  }
  results.header = await capture("local", "top", "header");
  for (const [boundary, captures] of Object.entries(results)) for (const result of Object.values(boundary === "header" ? { local: captures } : captures)) {
    const base=result.samples[0];
    result.headerTravelPx=Math.max(...result.samples.map(s=>s.headerY))-Math.min(...result.samples.map(s=>s.headerY));
    const lastMoving=result.samples.findLast(s=>s.paintEdgeY!==base.paintEdgeY);
    result.returnMs=lastMoving ? result.samples.find(s=>s.timeMs>lastMoving.timeMs&&s.paintEdgeY===base.paintEdgeY)?.timeMs ?? null : 0;
  }
  return results;
}