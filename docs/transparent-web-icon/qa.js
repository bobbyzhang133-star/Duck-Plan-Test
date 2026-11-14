// Local-only icon regression. Fresh Chromium contexts; no user tabs or records.
async (page) => {
  const origin = "http://127.0.0.1:8034";
  const output = "/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/transparent-web-icon/";
  const browser = page.context().browser(), contexts = new Set(), results = [];
  const pageErrors = [], unexpectedResponses = [], blocked = [];
  const transparent = size => `/assets/duckplan-sigma-icon-v11-transparent-${size}.png`;
  const opaque = size => `/assets/duckplan-sigma-icon-v11-${size}.png`;
  const check = (condition, label) => { if (!condition) throw new Error(label); };
  const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 5000 });
  async function setup({ width = 835, height = 747, dark = false, touch = false, offline = false } = {}) {
    const c = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: dark ? "dark" : "light", hasTouch: touch, isMobile: touch, reducedMotion: "reduce", serviceWorkers: offline ? "allow" : "block" });
    contexts.add(c);
    await c.route("**/*", route => {
      const u = new URL(route.request().url());
      if (u.origin !== origin || u.pathname.startsWith("/api/")) { blocked.push({ origin: u.origin, path: u.pathname }); return route.abort(); }
      return route.continue();
    });
    const p = await c.newPage(); p.setDefaultTimeout(5000); p.setDefaultNavigationTimeout(10000);
    p.on("pageerror", error => pageErrors.push(error.message));
    p.on("response", response => { if (response.status() >= 400) unexpectedResponses.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    await p.goto(`${origin}/?qa=transparent-icon-${width}-${dark ? "dark" : "light"}#calendar`);
    await wait(p, () => Boolean(document.querySelector(".duck-brand-image")?.complete) && document.querySelector(".duck-brand-image").naturalWidth > 0 && document.body.dataset.view === "calendar");
    return { c, p };
  }
  async function assetPixels(p, paths) {
    return p.evaluate(async paths => {
      const result = [];
      for (const path of paths) {
        const response = await fetch(path); if (!response.ok) throw new Error("Icon response failed: " + path);
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await response.arrayBuffer()));
        const sha256 = [...digest].map(value => value.toString(16).padStart(2, "0")).join("");
        const image = new Image();
        await new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error("Icon decode timeout")), 5000); image.onload = () => { clearTimeout(t); resolve(); }; image.onerror = () => { clearTimeout(t); reject(new Error("Icon decode failed: " + path)); }; image.src = path; });
        const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true }); context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const sample = (x, y) => [...pixels.slice((y * canvas.width + x) * 4, (y * canvas.width + x) * 4 + 4)];
        let minAlpha = 255, maxAlpha = 0, zeroPixels = 0, partialPixels = 0;
        for (let i = 3; i < pixels.length; i += 4) { minAlpha = Math.min(minAlpha, pixels[i]); maxAlpha = Math.max(maxAlpha, pixels[i]); if (pixels[i] === 0) zeroPixels++; else if (pixels[i] < 255) partialPixels++; }
        const w = canvas.width, h = canvas.height;
        result.push({ path, sha256, width: w, height: h, minAlpha, maxAlpha, zeroPixels, partialPixels,
          corners: [sample(0, 0), sample(w - 1, 0), sample(0, h - 1), sample(w - 1, h - 1)],
          exterior: [sample(0, Math.floor(h / 2)), sample(w - 1, Math.floor(h / 2))],
          body: sample(Math.floor(w / 2), Math.floor(h * .9)) });
      }
      return result;
    }, paths);
  }
  const geometry = p => p.evaluate(() => {
    const image = document.querySelector(".duck-brand-image"), mark = image.closest(".brand-mark"), anchor = image.closest("a");
    const style = n => { const s = getComputedStyle(n); return { background: s.backgroundColor, borderWidths: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth], shadow: s.boxShadow, objectFit: s.objectFit }; };
    return { source: new URL(image.currentSrc).pathname, image: image.getBoundingClientRect().toJSON(), mark: mark.getBoundingClientRect().toJSON(), anchor: anchor.getBoundingClientRect().toJSON(), markStyle: style(mark), imageStyle: style(image), folded: !document.body.classList.contains("sidebar-open"), theme: document.documentElement.dataset.theme, overflow: document.documentElement.scrollWidth > innerWidth, favicon: new URL(document.querySelector('link[rel="icon"]').href).pathname, appleTouch: new URL(document.querySelector('link[rel="apple-touch-icon"]').href).pathname };
  });
  try {
    for (const dark of [false, true]) {
      const { c, p } = await setup({ dark });
      const folded = await geometry(p);
      check(folded.source === transparent(192) && folded.favicon === transparent(192), "Brand/favicon must use transparent artwork");
      check(folded.appleTouch === opaque(512), "Existing Apple touch artwork must remain unchanged");
      check(Math.abs(folded.image.width - 36) < .1 && Math.abs(folded.image.height - 36) < .1, "Brand tile must remain36px");
      check(folded.markStyle.background === "rgba(0, 0, 0, 0)" && folded.markStyle.shadow === "none" && folded.markStyle.borderWidths.every(n => n === "0px"), "No button-like image backing/border");
      check(!folded.overflow && folded.folded && folded.theme === (dark ? "dark" : "light"), "Folded theme/layout failed");
      await p.screenshot({ path: output + `${dark ? "dark" : "light"}-folded.png`, fullPage: false });
      await p.locator("#planner-sidebar .sidebar-rail-toggle").click();
      await wait(p, () => document.body.classList.contains("sidebar-open"));
      const expanded = await geometry(p); check(!expanded.folded && !expanded.overflow && expanded.image.width === folded.image.width && expanded.image.height === folded.image.height, "Expanded image geometry changed");
      await p.screenshot({ path: output + `${dark ? "dark" : "light"}-expanded.png`, fullPage: false });
      await p.locator('#planner-sidebar [data-view="tasks"]').click(); await wait(p, () => document.body.dataset.view === "tasks");
      await p.locator("#planner-sidebar a.brand").click(); await wait(p, () => document.body.dataset.view === "calendar");
      const pixels = dark ? null : await assetPixels(p, [transparent(192), transparent(512), opaque(192), opaque(512)]);
      if (pixels) {
        for (const icon of pixels) {
          const expectedSize = icon.path.includes("192") ? 192 : 512; check(icon.width === expectedSize && icon.height === expectedSize, "Wrong icon export dimensions");
          if (icon.path.includes("transparent")) check(icon.minAlpha === 0 && icon.maxAlpha === 255 && icon.zeroPixels > 0 && icon.corners.slice(0, 2).every(corner => corner[3] === 0) && icon.exterior.every(sample => sample[3] === 0) && icon.body[3] === 255, "Background removal damaged subject or retained outside rectangle");
          else check(icon.minAlpha === 255 && icon.maxAlpha === 255, "Opaque platform export changed");
        }
      }
      const manifest = await p.evaluate(() => fetch("./app.webmanifest").then(r => r.json()));
      const any = manifest.icons.filter(icon => icon.purpose === "any"), maskable = manifest.icons.filter(icon => icon.purpose === "maskable");
      check(any.length === 2 && any.every(icon => icon.src.includes("-transparent-")), "Manifest any icons not transparent variants");
      check(maskable.length === 2 && maskable.every(icon => !icon.src.includes("-transparent-")), "Maskable platform exports must remain opaque variants");
      check(manifest.shortcuts.every(shortcut => shortcut.icons.every(icon => icon.src.includes("-transparent-"))), "Shortcut icons not updated");
      results.push({ test: dark ? "dark835" : "light835", folded, expanded, iconNavigation: "Tasks→brand→Calendar", pixels, manifest: { any, maskable, shortcutsTransparent: true } });
      await c.close(); contexts.delete(c);
    }
    {
      const { c, p } = await setup({ width: 390, height: 844, touch: true });
      check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Phone viewport overflows");
      const faviconResponse = await p.request.get(origin + transparent(192), { timeout: 5000 }); check(faviconResponse.ok(), "Phone favicon unavailable");
      await p.screenshot({ path: output + "phone390.png", fullPage: false });
      results.push({ test: "phone390", touchEmulated: true, overflow: false, faviconAvailable: true });
      await c.close(); contexts.delete(c);
    }
    {
      const { c, p } = await setup({ width: 390, height: 844, touch: true, offline: true });
      await p.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error("Service worker readiness timeout")), 10000))]));
      await wait(p, () => Boolean(navigator.serviceWorker.controller));
      const cache = await p.evaluate(async () => {
        const name = "duckplan-app-motion-preview-v40", cache = await caches.open(name);
        const paths = ["assets/duckplan-sigma-icon-v11-transparent-192.png", "assets/duckplan-sigma-icon-v11-transparent-512.png"];
        const icons = await Promise.all(paths.map(path => cache.match(new URL(path, location.href))));
        return { name, iconsCached: icons.every(Boolean) };
      });
      check(cache.iconsCached, "Transparent icons were not precached");
      await c.setOffline(true); await p.reload();
      await wait(p, () => document.body.dataset.view === "calendar" && Boolean(document.querySelector(".duck-brand-image")?.complete));
      const pixels = await assetPixels(p, [transparent(192), transparent(512)]); check(pixels.every(icon => icon.minAlpha === 0 && icon.body[3] === 255), "Offline icon alpha failed");
      await p.screenshot({ path: output + "offline-browser390.png", fullPage: false });
      results.push({ test: "offlineBrowser390", cache, iconsDecodeOffline: true, pixels, surface: "Chromium service-worker browser tab, not installed PWA" });
      await c.close(); contexts.delete(c);
    }
    check(pageErrors.length === 0 && unexpectedResponses.length === 0 && blocked.length === 0, "Unexpected errors or API/external requests");
    return { runtime: browser.version(), source: "Current local website transparent-icon change", origin, results, pageErrors, unexpectedResponses, blocked, allSyntheticContextsClosed: contexts.size === 0, productionWrites: false, limits: ["Chromium only", "Phone is touch emulation, not physical Safari", "Offline check is a browser service-worker context, not installed PWA", "Native icon equality checked separately; native app not changed or launched"] };
  } finally { for (const context of contexts) await context.close(); }
}
