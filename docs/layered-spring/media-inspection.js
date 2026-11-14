// Read-only local video/PNG decoding in Chromium; does not alter source media.
async (page) => {
  const base = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/layered-spring/";
  const browser = page.context().browser(), context = await browser.newContext({ viewport: { width: 1280, height: 1260 } });
  const result = { runtime: browser.version(), films: [], stationaryPixels: null, productionWrites: false };
  try {
    const p = await context.newPage(); p.setDefaultTimeout(5000); p.setDefaultNavigationTimeout(10000);
    const entries = {};
    for (const [key, file] of [["before", "dark-before.png"], ["start", "dark-held-start.png"], ["mid", "held-dark-forward.png"], ["after", "dark-after.png"]]) {
      await p.goto("file://" + encodeURI(base + file));
      entries[key] = await p.evaluate(async () => {
        const im = document.querySelector("img"); if (!im.complete) await im.decode();
        const canvas = document.createElement("canvas"); canvas.width = im.naturalWidth; canvas.height = im.naturalHeight;
        const ctx = canvas.getContext("2d"); ctx.drawImage(im, 0, 0);
        // Sample solid stationary rail pixels, avoiding hover/selected controls.
        return [[2, 10], [35, 800], [74, 50], [74, 450], [74, 800]].map(point => ({ point, rgba: Array.from(ctx.getImageData(...point, 1, 1).data) }));
      });
    }
    result.stationaryPixels = entries.before.map((s, i) => ({ point: s.point, rgba: Object.fromEntries(Object.entries(entries).map(([k, samples]) => [k, samples[i].rgba])), maxChannelDelta: Math.max(...Object.values(entries).flatMap(samples => s.rgba.map((v, c) => Math.abs(v - samples[i].rgba[c])))) }));
    for (const width of [1280, 835]) for (const variant of ["page", "layered"]) {
      await p.goto("file://" + encodeURI(base + `playback-${width}-${variant}.webm`));
      const film = await p.evaluate(async ({ width, variant }) => {
        const video = document.querySelector("video");
        if (video.readyState < 1) await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; setTimeout(() => reject(new Error("Metadata timeout")), 5000); });
        video.pause(); video.controls = false;
        const times = Array.from({ length: 16 }, (_, i) => .45 + i * (video.duration - .55) / 15);
        const tileW = 426, tileH = 300, cols = 3, rows = Math.ceil(times.length / cols);
        const canvas = document.createElement("canvas"); canvas.width = tileW * cols; canvas.height = tileH * rows;
        const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (const [i, time] of times.entries()) {
          if (Math.abs(video.currentTime - time) > .001) await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("Seek timeout")), 5000);
            video.addEventListener("seeked", () => { clearTimeout(timer); resolve(); }, { once: true }); video.currentTime = time;
          });
          const x = i % cols * tileW, y = Math.floor(i / cols) * tileH;
          ctx.drawImage(video, x, y, tileW, tileH - 22);
          ctx.fillStyle = "#111"; ctx.font = "14px sans-serif"; ctx.fillText(`${width}px ${variant} — ${time.toFixed(2)}s`, x + 6, y + tileH - 6);
        }
        video.style.display = "none"; document.body.style.cssText = "margin:0;background:white"; canvas.style.display = "block"; document.body.append(canvas);
        return { duration: video.duration, decodedWidth: video.videoWidth, decodedHeight: video.videoHeight, times, canvasWidth: canvas.width, canvasHeight: canvas.height };
      }, { width, variant });
      const file = base + `filmstrip-${width}-${variant}.png`; await p.screenshot({ path: file, fullPage: true }); result.films.push({ width, variant, ...film, file });
    }
    return { ...result, allSyntheticContextsClosed: true };
  } finally { await context.close(); }
}
