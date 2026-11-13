// Inspect only local QA screenshots and recordings in Chromium's media decoder.
// Uses no external resources, accounts or user tabs. Does not modify source images.
async (page) => {
  const base = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/fade-pull/";
  const browser = page.context().browser(), context = await browser.newContext({ viewport: { width: 1280, height: 1260 } });
  const result = { runtime: browser.version(), marginPixels: {}, films: [], productionWrites: false };
  try {
    const p = await context.newPage(); p.setDefaultTimeout(5000); p.setDefaultNavigationTimeout(10000);
    for (const theme of ["light", "dark"]) {
      const entries = {};
      for (const [key, file] of [["before", `${theme}-before.png`], ["start", `${theme}-held-start.png`], ["mid", theme === "light" ? "held-1280-forward.png" : "held-dark-forward.png"], ["after", `${theme}-after.png`]]) {
        await p.goto("file://" + encodeURI(base + file));
        entries[key] = await p.evaluate(async () => {
          const im = document.querySelector("img"); if (!im.complete) await im.decode();
          const canvas = document.createElement("canvas"); canvas.width = im.naturalWidth; canvas.height = im.naturalHeight;
          const ctx = canvas.getContext("2d"); ctx.drawImage(im, 0, 0);
          return [[80,50],[80,200],[80,450],[80,800],[84,450],[1276,50],[1276,450],[1276,800]].map(point => ({ point, rgba: Array.from(ctx.getImageData(...point,1,1).data) }));
        });
      }
      const samples = entries.before.map((sample, i) => ({ point: sample.point, rgba: Object.fromEntries(Object.entries(entries).map(([key, rows]) => [key, rows[i].rgba])), maxChannelDelta: Math.max(...["start", "mid", "after"].flatMap(key => sample.rgba.map((n, j) => Math.abs(n - entries[key][i].rgba[j])))) }));
      result.marginPixels[theme] = { samples, maxChannelDelta: Math.max(...samples.map(s => s.maxChannelDelta)) };
    }
    for (const width of [1280, 835]) for (const variant of ["balanced", "subtle"]) {
      await p.goto("file://" + encodeURI(base + `playback-${width}-${variant}.webm`));
      const film = await p.evaluate(async ({ width, variant }) => {
        const video = document.querySelector("video");
        if (video.readyState < 1) await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; setTimeout(() => reject(new Error("Metadata timeout")),5000); });
        video.pause(); video.controls = false;
        const times = [0,.45,.75,.9,1.05,1.2,1.4,1.6,1.8,2,2.3,2.8].filter(t => t < video.duration);
        const tileW = 426, tileH = 292, cols = 3, rows = Math.ceil(times.length / cols);
        const canvas = document.createElement("canvas"); canvas.width = tileW * cols; canvas.height = tileH * rows;
        const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0,0,canvas.width,canvas.height);
        for (const [i,time] of times.entries()) {
          if (Math.abs(video.currentTime - time) > .001) await new Promise((resolve,reject) => {
            const timer = setTimeout(() => reject(new Error("Seek timeout")),5000);
            video.addEventListener("seeked", () => { clearTimeout(timer); resolve(); }, { once:true }); video.currentTime = time;
          });
          const x = i % cols * tileW, y = Math.floor(i / cols) * tileH;
          ctx.drawImage(video, x, y, tileW, tileH - 22);
          ctx.fillStyle = "#111"; ctx.font = "14px sans-serif"; ctx.fillText(`${width}px ${variant} — ${time.toFixed(2)}s`,x+6,y+tileH-6);
        }
        video.style.display = "none"; document.body.style.cssText = "margin:0;background:white"; canvas.style.display = "block"; document.body.append(canvas);
        return { duration: video.duration, decodedWidth: video.videoWidth, decodedHeight: video.videoHeight, times, canvasWidth: canvas.width, canvasHeight: canvas.height };
      }, { width, variant });
      const file = base + `filmstrip-${width}-${variant}.png`;
      await p.screenshot({ path: file, fullPage: true }); result.films.push({ width, variant, ...film, file });
    }
    return { ...result, allSyntheticContextsClosed: true };
  } finally { await context.close(); }
}
