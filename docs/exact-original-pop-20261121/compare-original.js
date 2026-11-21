async (page) => {
  const browser = page.context().browser(), results = [];
  for (const port of [8042, 8034]) {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const p = await c.newPage();
      await p.goto(`http://127.0.0.1:${port}/#tasks`);
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length);
      await p.evaluate(() => localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify([
        { id: "exact-pop", title: "Original task pop comparison", dueDate: "2020-01-01", completed: false, schemaVersion: 2 },
        { id: "next-task", title: "Next task", dueDate: "2099-01-01", completed: false, schemaVersion: 2 }
      ])));
      await p.reload();
      await p.waitForFunction(() => store.listItems().some(t => t.id === "exact-pop"));
      await p.locator('#view-tasks input[data-task-id="exact-pop"]:visible').click();
      const motion = await p.evaluate(async () => {
        const echo = document.querySelector(".task-completion-echo"), animation = echo.getAnimations()[0];
        animation.pause();
        const samples = [];
        for (const time of [0, 75, 150.5, 300, 420]) {
          animation.currentTime = time;
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const style = getComputedStyle(echo), m = new DOMMatrix(style.transform);
          samples.push({ time, matrix: [m.a,m.b,m.c,m.d,m.e,m.f], opacity: Number(style.opacity) });
        }
        return { name: animation.animationName, duration: animation.effect.getTiming().duration, easing: getComputedStyle(echo).animationTimingFunction,
          frames: animation.effect.getKeyframes().map(f => ({ offset: f.offset, transform: f.transform, opacity: f.opacity })), samples };
      });
      await p.evaluate(async () => {
        document.querySelector(".task-completion-echo").getAnimations()[0].currentTime = 150.5;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      await p.screenshot({ path: `/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/exact-original-pop-20261121/reference-${port}.png` });
      results.push({ port, ...motion });
    } finally { await c.close(); }
  }
  const [original, current] = results;
  if (original.name !== current.name || original.duration !== current.duration || original.easing !== current.easing || JSON.stringify(original.frames) !== JSON.stringify(current.frames)) throw new Error("Original animation definition differs");
  original.samples.forEach((frame, i) => {
    if (frame.matrix.some((n,j) => Math.abs(n-current.samples[i].matrix[j]) > .0001) || Math.abs(frame.opacity-current.samples[i].opacity) > .0001) throw new Error("Rendered motion/fade differ at " + frame.time);
  });
  return { runtime: browser.version(), viewport: "390x844", input: "checkbox click", result: "PASS: original animation name, full keyframes including opacity, duration, easing and rendered samples match", results };
}
