async page => {
  const browser = page.context().browser(), results = [];
  for (const width of [390, 835]) {
    const c = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: "block" });
    try {
      const p = await c.newPage(), errors = [];
      p.on("pageerror", error => errors.push(error.message));
      await p.goto("http://127.0.0.1:8042/#calendar");
      await p.waitForFunction(() => window.DuckPlanMascot && typeof store !== "undefined" && store.listItems().length);
      const placements = await p.evaluate(() => [...document.querySelectorAll("[data-duck-state]")].map(e => ({ id: e.id || e.className, brand: e.classList.contains("brand-mark"), source: e.querySelector("img")?.getAttribute("src"), head: e.querySelector(".duck-head")?.dataset.headArt || e.querySelector("[data-head-art]")?.dataset.headArt })));
      if (placements.some(p => p.brand ? !p.source.includes("v11") : !p.head?.startsWith("v11"))) throw Error("An existing placement still uses old head artwork");
      await p.evaluate(() => {
        const date = Model.todayKey();
        localStorage.setItem("duckplan-demo-tasks-v1", JSON.stringify([
          { id: "head-first", title: "Finish practice notes", dueDate: date, dueTime: "17:00", scheduledStart: date+"T09:00", durationMinutes: 45, completed: false, schemaVersion: 2 },
          { id: "head-next", title: "Prepare next practice task", dueDate: date, completed: false, schemaVersion: 2 }
        ]));
      });
      await p.reload();
      if (width === 390) { await p.locator("#phone-task-summary").click(); await p.waitForTimeout(500); }
      await p.locator('#daily-task-panel input[data-task-id="head-first"]:visible').click();
      await p.waitForFunction(() => document.querySelector(".completion-duck-reaction"));
      const completion = await p.evaluate(async () => {
        const duck = document.querySelector(".completion-duck-reaction"), a = duck.getAnimations()[0], wing = duck.querySelector(".duck-thumbs-up-wing").getAnimations()[0];
        a.pause(); a.currentTime=850; wing.pause(); wing.currentTime=620;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const head = duck.querySelector(".duck-profile-head"), box = duck.getBoundingClientRect();
        return { head: duck.querySelector(".duck-head").dataset.headArt, source: head.querySelector("image").getAttribute("href"), scaleX: head.width.baseVal.value/1024, scaleY: head.height.baseVal.value/800, body: Boolean(duck.querySelector(".duck-body")), feet: Boolean(duck.querySelector(".duck-feet")), thumb: getComputedStyle(duck.querySelector(".duck-thumbs-up-wing")).display, echo: Boolean(document.querySelector(".task-completion-echo")), inViewport: box.left>=0 && box.right<=innerWidth && box.top>=0 && box.bottom<=innerHeight };
      });
      if (completion.head !== "v11" || !completion.source.includes("v11-transparent") || completion.scaleX !== completion.scaleY || !completion.body || !completion.feet || completion.thumb !== "inline" || completion.echo || !completion.inViewport) throw Error("Completion mascot differs from approved artwork or full-body pose");
      await p.screenshot({ path: `/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/profile-mascots-20261121/completion-${width}.png` });
      const poses = await p.evaluate(() => {
        const wall=document.createElement("div"); wall.id="mascot-proof";
        wall.style="position:fixed;inset:0;z-index:200;background:#fffdf8;padding:20px;display:grid;grid-template-columns:repeat(4,1fr);gap:15px;overflow:auto";
        wall.innerHTML=["happy","sleepy","focused","encouraging","celebrating","swimming","thumbsup","side"].map(m=>`<section style="text-align:center;background:white;border-radius:20px;padding:12px"><b>${m}</b><div style="width:150px;height:160px;margin:auto">${DuckPlanMascot.markup(m==="side"?"swimming":m,m==="side"?"side":"front")}</div></section>`).join("");
        document.body.append(wall);
        return [...wall.querySelectorAll(".duck-character")].map(e=>({ mood:e.dataset.mood, profile:e.dataset.profile || "front", head:e.dataset.headArt || e.querySelector(".duck-head")?.dataset.headArt, source:e.querySelector("image").getAttribute("href"), open:getComputedStyle(e.querySelector(".duck-open-eyes")).display, sleepy:e.querySelector(".duck-sleep-eyes") ? getComputedStyle(e.querySelector(".duck-sleep-eyes")).display : null, glasses:e.querySelector(".duck-glasses") ? getComputedStyle(e.querySelector(".duck-glasses")).display : null, idReferencesValid:[...e.querySelectorAll("use")].every(use=>document.getElementById(use.getAttribute("href").slice(1))) }));
      });
      if (poses.some(p=>!p.head.startsWith("v11") || !p.idReferencesValid || !p.source.includes("v11-transparent"))) throw Error("Pose contains old/unresolved artwork");
      if (poses.find(p=>p.mood==="sleepy").open!=="none" || poses.find(p=>p.mood==="sleepy").sleepy!=="inline" || poses.find(p=>p.mood==="focused").glasses!=="inline") throw Error("Expression hooks regressed");
      if (width===835) await p.screenshot({ path: "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/profile-mascots-20261121/approved-poses.png" });
      if (errors.length) throw Error(errors.join("; "));
      results.push({ width, placements, completion, poses });
    } catch (error) { return { runtime: browser.version(), results, failedWidth: width, error: error.message }; }
    finally { await c.close(); }
  }
  return { runtime: browser.version(), results };
}
