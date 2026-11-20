async page => {
  const browser = page.context().browser(), results = [];
  const check = (value, message) => { if (!value) throw Error(message); };
  for (const viewport of [{ width: 835, height: 1000 }, { width: 390, height: 844 }]) {
    const c = await browser.newContext({ viewport, hasTouch: viewport.width < 700, isMobile: viewport.width < 700, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = []; p.on("pageerror", e => errors.push(e.message));
      await p.goto("http://127.0.0.1:8034/?qa=stretch-recovery#calendar");
      await p.waitForFunction(() => typeof store !== "undefined" && workAlertContextReady);
      await p.evaluate(() => { calendarView = "day"; renderCalendar(); document.querySelector("#planner-calendar").scrollTop = 0; });
      await p.waitForTimeout(100);
      const before = await p.evaluate(() => JSON.stringify(store.listItems()));
      const point = await p.evaluate(() => { const a = document.querySelector(".time-axis").getBoundingClientRect(), h = document.querySelector(".timeline-days").getBoundingClientRect(); return { x: a.right + 30, y: h.bottom + 70, header: h.top }; });
      for (const signal of ["blur", "dragleave", "Escape", "pointerdown"]) {
        await p.evaluate(() => document.querySelector("#planner-calendar").dispatchEvent(new DragEvent("dragenter", { bubbles: true })));
        await p.mouse.move(point.x, point.y); await p.mouse.wheel(0, -120); await p.waitForTimeout(25);
        check(await p.evaluate(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector(".timeline-calendar")).transform).m42) === 0, "Active drag protection missing");
        await p.evaluate(signal => {
          const root = document.querySelector("#planner-calendar");
          if (signal === "blur") window.dispatchEvent(new Event("blur"));
          if (signal === "dragleave") root.dispatchEvent(new DragEvent("dragleave", { bubbles: true, relatedTarget: null }));
          if (signal === "Escape") window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          if (signal === "pointerdown") root.querySelector(".time-axis").dispatchEvent(new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }));
        }, signal);
        await p.mouse.wheel(0, -120); await p.waitForTimeout(25);
        const state = await p.evaluate(() => ({ offset: new DOMMatrixReadOnly(getComputedStyle(document.querySelector(".timeline-calendar")).transform).m42, header: document.querySelector(".timeline-days").getBoundingClientRect().top }));
        check(state.offset > 0 && state.header === point.header, "Stretch failed to recover or moved the header");
        await p.waitForFunction(() => !document.querySelector(".timeline-calendar").style.transform, null, { timeout: 2000 });
        results.push({ viewport, injectedInterruption: signal, status: "PASS", offset: state.offset });
      }
      check(before === await p.evaluate(() => JSON.stringify(store.listItems())), "Recovery changed records");
      check(!errors.length, errors.join("; "));
    } finally { await c.close(); }
  }
  return { runtime: browser.version(), mode: "isolated local browser; injected interruption events plus real wheel input; not observation of the user's original tab", results };
}
