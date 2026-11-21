async (page) => {
  const browser = page.context().browser(), results = [];
  for (const port of [8042, 8034]) {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const p = await c.newPage();
      await p.goto(`http://127.0.0.1:${port}/#tasks`);
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length);
      await p.evaluate(() => localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify([
        { id: "original-pop-check", title: "Reference pop-out check", dueDate: "2020-01-01", completed: false, schemaVersion: 2 },
        { id: "keep-open", title: "Another task", dueDate: "2099-01-01", completed: false, schemaVersion: 2 }
      ])));
      await p.reload();
      await p.waitForFunction(() => store.listItems().some(t => t.id === "original-pop-check"));
      await p.locator('#view-tasks input[data-task-id="original-pop-check"]:visible').click();
      const samples = await p.evaluate(async port => {
        const target = document.querySelector(port === 8042 ? ".task-completion-echo" : ".completion-echo-copy");
        const animation = target.getAnimations()[0];
        animation.pause();
        const samples = [];
        for (const time of [0, 75, 150.5, 300, 430]) {
          animation.currentTime = time;
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const style = getComputedStyle(target), matrix = new DOMMatrix(style.transform);
          samples.push({ time, matrix: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f], opacity: Number(style.opacity) });
        }
        return { name: animation.animationName, duration: animation.effect.getTiming().duration, easing: getComputedStyle(target).animationTimingFunction,
          keyframes: animation.effect.getKeyframes().map(f => ({ offset: f.offset, transform: f.transform })), samples };
      }, port);
      await p.evaluate(async port => {
        const target = document.querySelector(port === 8042 ? ".task-completion-echo" : ".completion-echo-copy");
        target.getAnimations()[0].currentTime = 150.5;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, port);
      await p.screenshot({ path: `/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/original-pop-full-duck-20261120/reference-${port}-peak.png` });
      results.push({ port, ...samples });
    } finally { await c.close(); }
  }
  for (let index = 0; index < results[0].samples.length; index += 1) {
    const first = results[0].samples[index].matrix, second = results[1].samples[index].matrix;
    if (first.some((n, i) => Math.abs(n - second[i]) > .0001)) throw new Error("Motion differs at " + results[0].samples[index].time);
  }
  if (results[0].duration !== results[1].duration || results[0].easing !== results[1].easing) throw new Error("Original duration/easing differ");
  return { runtime: browser.version(), viewport: "390x844", input: "checkbox click", result: "PASS: original transform curve, duration and easing match", note: "New card deliberately holds its opacity for the requested duck reveal; the parent supplies the later shared fade.", results };
}
