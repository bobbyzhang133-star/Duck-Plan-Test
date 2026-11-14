// Decode only the local normal-speed fixture recording; no application writes.
async (page) => {
  const out = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/moving-layout/";
  const c = await page.context().browser().newContext({ viewport: { width: 1254, height: 1600 } });
  try {
    const p = await c.newPage(); p.setDefaultTimeout(5000); p.setDefaultNavigationTimeout(10000);
    await p.goto("file://" + encodeURI(out + "moving-layout-835.webm"));
    const result = await p.evaluate(async () => {
      const v = document.querySelector("video");
      if (v.readyState < 1) await new Promise((resolve, reject) => { v.addEventListener("loadedmetadata", resolve, { once: true }); setTimeout(() => reject(new Error("Video metadata timeout")), 5000); });
      v.pause();
      const canvas = document.createElement("canvas"), width = 418, height = 400, ctx = canvas.getContext("2d"); canvas.width = width * 3; canvas.height = height * 4;
      const times = Array.from({ length: 12 }, (_, i) => Math.min(v.duration - .02, .25 + i * (v.duration - .30) / 12));
      for (const [i, time] of times.entries()) {
        if (Math.abs(v.currentTime - time) > .001) await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("Video seek timeout")), 5000); v.addEventListener("seeked", () => { clearTimeout(timer); resolve(); }, { once: true }); v.currentTime = time; });
        const x = i % 3 * width, y = Math.floor(i / 3) * height;
        ctx.fillStyle = "white"; ctx.fillRect(x, y, width, height); ctx.drawImage(v, x, y, width, height - 24); ctx.fillStyle = "#111"; ctx.font = "14px sans-serif"; ctx.fillText(`835px — ${time.toFixed(2)}s`, x + 6, y + height - 6);
      }
      v.style.display = "none"; document.body.style.cssText = "margin:0;background:white"; document.body.append(canvas);
      return { duration: v.duration, times, decodedWidth: v.videoWidth, decodedHeight: v.videoHeight };
    });
    await p.screenshot({ path: out + "filmstrip-835.png", fullPage: true }); return result;
  } finally { await c.close(); }
}
