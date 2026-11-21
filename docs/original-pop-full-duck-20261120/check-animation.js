async (page) => {
  const browser = page.context().browser(), results = [];
  const root = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/original-pop-full-duck-20261120/";
  const assert = (value, message) => { if (!value) throw new Error(message); };
  for (const config of [{ width: 1156 }, { width: 835 }, { width: 390 }, { width: 320 }, { width: 390, dark: true }, { width: 390, reduced: true }, { width: 390, motionOff: true }]) {
    const c = await browser.newContext({ viewport: { width: config.width, height: 900 }, reducedMotion: config.reduced ? "reduce" : "no-preference" });
    try {
      const p = await c.newPage(), errors = [];
      p.on("pageerror", error => errors.push(error.message));
      await p.goto("http://127.0.0.1:8034/#tasks");
      await p.waitForFunction(() => typeof store !== "undefined" && store.listItems().length);
      await p.evaluate(config => {
        localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify([
          { id: "duck-overdue", title: "Finish the overdue reading response", dueDate: "2020-01-01", dueTime: "12:00", completed: false, schemaVersion: 2 },
          { id: "duck-future", title: "Prepare the next practice questions", dueDate: "2099-01-01", completed: false, schemaVersion: 2 }
        ]));
        if (config.motionOff) localStorage.setItem("duckplan-ui-mascot-motion", "off");
      }, config);
      await p.reload();
      await p.waitForFunction(() => store.listItems().some(task => task.id === "duck-overdue"));
      if (config.dark) await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
      for (const id of ["duck-overdue", "duck-future"]) {
        await p.locator('#view-tasks input[data-task-id="' + id + '"]:visible').click();
        const phases = [];
        if (!config.reduced && !config.motionOff) {
          await p.waitForFunction(() => document.querySelector(".task-completion-echo"));
          for (const time of [0, 150.5, 430, 500, 950, 1440]) {
            const sample = await p.evaluate(async time => {
              const echo = document.querySelector(".task-completion-echo");
              for (const animation of document.getAnimations().filter(a => a.effect?.target === echo || echo.contains(a.effect?.target))) { animation.pause(); animation.currentTime = time; }
              await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              const copy = echo.querySelector(".completion-echo-copy"), duck = echo.querySelector(".completion-echo-duck"), thumb = echo.querySelector(".duck-thumbs-up-wing"), svg = duck.querySelector(".duck-character");
              const rect = echo.getBoundingClientRect();
              return { time, scale: new DOMMatrix(getComputedStyle(copy).transform).a, copyOpacity: getComputedStyle(copy).opacity, duckOpacity: Number(getComputedStyle(duck).opacity), thumbOpacity: Number(getComputedStyle(thumb).opacity), groupOpacity: Number(getComputedStyle(echo).opacity), caption: copy.querySelector("span").textContent,
                pose: svg.dataset.mood, fullBody: Boolean(svg.querySelector(".duck-body") && svg.querySelector(".duck-feet")), profileImages: duck.querySelectorAll("img").length,
                oldIcons: echo.querySelectorAll(".task-date-icon,.completion-echo-mark,input,button,[id]").length,
                inert: echo.inert && echo.getAttribute("aria-hidden") === "true", copyFits: copy.scrollHeight <= copy.clientHeight + 1,
                inViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
                overflow: document.documentElement.scrollWidth > innerWidth };
            }, time);
            assert(!sample.oldIcons && sample.inert && sample.copyFits && sample.inViewport && !sample.overflow, "Clean readable noninteractive completion inside viewport");
            phases.push(sample);
            if (id === "duck-overdue" && time === 950) await p.screenshot({ path: root + `duck-${config.width}${config.dark ? "-dark" : ""}.png` });
          }
          assert(phases[1].scale > 1 && phases[2].scale < 1 && Math.abs(phases[3].scale - .99) < .001, "Block pops, bounces back and holds");
          assert(phases[3].duckOpacity === 0 && phases[4].duckOpacity === 1 && phases[4].thumbOpacity === 1, "Duck thumbs up follows the settled block");
          assert(phases[4].pose === "thumbsup" && phases[4].fullBody && phases[4].profileImages === 0, "Use one complete Sigma duck drawing with orange feet and an integrated thumbs-up");
          assert(phases[4].groupOpacity === 1 && phases[5].groupOpacity < 1 && phases[5].copyOpacity === "1" && phases[5].duckOpacity === 1, "Block and duck fade through one parent");
        } else {
          await p.waitForTimeout(120);
          assert(await p.locator(".task-completion-echo").count() === 0, "No animation with motion disabled");
        }
        await p.waitForTimeout(1750);
        assert(await p.locator(".task-completion-echo,.completion-particle").count() === 0, "Effects finish and clean up");
        assert(await p.evaluate(id => store.listItems().find(t => t.id === id)?.completed, id), "Task saves completed state");
        results.push({ config, id, phases });
      }
      await p.reload();
      await p.waitForFunction(() => store.listItems().filter(t => t.id.startsWith("duck-") && t.completed).length === 2);
      assert(errors.length === 0, "No page errors");
    } catch (error) { return { runtime: browser.version(), results, failedConfig: config, error: error.message }; }
    finally { await c.close(); }
  }
  return { runtime: browser.version(), mode: "isolated local", results };
}
