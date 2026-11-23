/* Shared reversible disclosure motion. Data saves remain independent of presentation. */
(() => {
  "use strict";
  const active = new Map(), reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const duration = () => window.DuckMotion?.duration.control || 240;
  const easing = () => window.DuckMotion?.easing || "cubic-bezier(.2,.8,.2,1)";
  const allowed = element => !reduced.matches && typeof element.animate === "function";
  function settleWithin(root = document) {
    for (const [element, record] of [...active]) if (root === element || root.contains(element)) record.finish();
  }
  function isExpanded(element) {
    return active.get(element)?.open ?? (element?.tagName === "DETAILS" ? element.open : !element?.hidden);
  }
  function setExpanded(element, open, { trigger = null, details = element?.tagName === "DETAILS" } = {}) {
    if (!element) return;
    const previous = active.get(element), wasOpen = isExpanded(element);
    if (wasOpen === open && !previous) return;
    const fromHeight = element.hidden ? 0 : element.getBoundingClientRect().height;
    const initialStyle = getComputedStyle(element);
    const fromOpacity = previous ? Number(initialStyle.opacity) : wasOpen ? 1 : 0;
    const fromPaddingTop = initialStyle.paddingTop, fromPaddingBottom = initialStyle.paddingBottom;
    const contents = details ? [...element.children].filter(child => child.tagName !== "SUMMARY") : [];
    const contentOpacities = new Map(contents.map(child => [child, Number(getComputedStyle(child).opacity)]));
    previous?.interrupt();
    const originalStyle = element.style.cssText;
    const inertStates = contents.map(child => [child, child.inert]);
    const originalInert = element.inert;
    trigger ||= details ? element.querySelector(":scope > summary") : null;
    trigger?.setAttribute("aria-expanded", String(open));
    if (!open && element.contains(document.activeElement) && document.activeElement !== trigger) trigger?.focus({ preventScroll: true });
    let closedHeight = 0;
    if (details) {
      element.open = false;
      closedHeight = element.getBoundingClientRect().height;
      element.open = true;
      contents.forEach(child => { child.inert = !open; });
    } else { element.hidden = false; element.inert = !open; }
    const naturalHeight = element.getBoundingClientRect().height;
    const style = getComputedStyle(element), paddingTop = style.paddingTop, paddingBottom = style.paddingBottom;
    const targetHeight = open ? naturalHeight : closedHeight;
    let animations = [], timer, finished = false;
    const restore = () => {
      element.style.cssText = originalStyle;
      delete element.dataset.uiExpansion;
    };
    const record = {
      open,
      interrupt() {
        if (finished) return;
        finished = true; clearTimeout(timer); animations.forEach(a => a.cancel());
        active.delete(element); restore();
        element.inert = originalInert; inertStates.forEach(([child, inert]) => { child.inert = inert; });
      },
      finish() {
        if (finished) return;
        record.interrupt();
        if (details) element.open = open; else element.hidden = !open;
        element.inert = originalInert;
        trigger?.setAttribute("aria-expanded", String(open));
      }
    };
    active.set(element, record);
    if (!allowed(element) || Math.abs((wasOpen ? fromHeight : details ? closedHeight : 0) - targetHeight) < 1) { record.finish(); return; }
    element.dataset.uiExpansion = open ? "opening" : "closing";
    Object.assign(element.style, { overflow: "clip", boxSizing: "border-box", minHeight: "0", maxHeight: "none" });
    const frames = [
      { height: `${previous || wasOpen ? fromHeight : closedHeight}px`, paddingTop: previous ? fromPaddingTop : details || wasOpen ? paddingTop : "0px", paddingBottom: previous ? fromPaddingBottom : details || wasOpen ? paddingBottom : "0px" },
      { height: `${targetHeight}px`, paddingTop: details || open ? paddingTop : "0px", paddingBottom: details || open ? paddingBottom : "0px" }
    ];
    if (!details) { frames[0].opacity = fromOpacity; frames[1].opacity = open ? 1 : 0; }
    const geometry = element.animate(frames, { duration: duration(), easing: easing(), fill: "both" });
    animations.push(geometry);
    if (details) contents.forEach(child => animations.push(child.animate([{ opacity: previous ? contentOpacities.get(child) : wasOpen ? 1 : 0 }, { opacity: open ? 1 : 0 }], { duration: duration(), easing: easing(), fill: "both" })));
    animations.forEach(a => a.finished.catch(() => {}));
    geometry.finished.then(record.finish, () => {});
    timer = setTimeout(record.finish, duration() + 150);
  }
  function overlay(element, open, finish = () => {}) {
    const style = getComputedStyle(element), from = { opacity: style.opacity, transform: style.transform };
    active.get(element)?.interrupt();
    let animation, timer, ended = false;
    const record = {
      open,
      interrupt() { if (ended) return; ended = true; clearTimeout(timer); animation?.cancel(); active.delete(element); delete element.dataset.uiExpansion; },
      finish() { if (ended) return; record.interrupt(); finish(); }
    };
    active.set(element, record);
    if (!allowed(element)) { record.finish(); return; }
    element.dataset.uiExpansion = open ? "opening" : "closing";
    animation = element.animate(open ? [{ opacity: 0, transform: "translateY(5px) scale(.97)" }, { opacity: 1, transform: "none" }] : [from, { opacity: 0, transform: "translateY(3px) scale(.97)" }], { duration: duration(), easing: easing(), fill: "both" });
    animation.finished.then(record.finish, () => {});
    timer = setTimeout(record.finish, duration() + 150);
  }
  function swapPanels(from, to, apply) {
    settleWithin(from.parentElement);
    const rect = from.getBoundingClientRect(), parent = from.parentElement.getBoundingClientRect(), oldStyle = from.style.cssText;
    apply();
    if (!allowed(to) || !rect.width) return;
    Object.assign(from.style, { position: "absolute", left: `${rect.left - parent.left}px`, top: `${rect.top - parent.top}px`, width: `${rect.width}px`, margin: "0", pointerEvents: "none" });
    from.hidden = false; from.inert = true;
    overlay(from, false, () => { from.hidden = true; from.style.cssText = oldStyle; });
    overlay(to, true);
  }
  document.addEventListener("click", event => {
    const summary = event.target.closest("summary"), details = summary?.parentElement;
    if (!details || details.tagName !== "DETAILS" || summary !== details.querySelector(":scope > summary") || event.defaultPrevented) return;
    if (event.target.closest("a,button,input,select,textarea")) return;
    event.preventDefault();
    setExpanded(details, !isExpanded(details), { trigger: summary, details: true });
  }, true);
  reduced.addEventListener("change", () => { if (reduced.matches) settleWithin(); });
  window.addEventListener("resize", () => settleWithin());
  window.addEventListener("pagehide", () => settleWithin());
  document.addEventListener("visibilitychange", () => { if (document.hidden) settleWithin(); });
  new MutationObserver(() => settleWithin()).observe(document.body, { attributes: true, attributeFilter: ["data-view"] });
  window.DuckExpansionMotion = Object.freeze({ setExpanded, isExpanded, overlay, swapPanels, settleWithin });
})();
