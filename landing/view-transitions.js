(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DuckViewTransitions = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  function direction(order, from, to) {
    const previous = order.indexOf(from), next = order.indexOf(to);
    return previous < 0 || next < 0 ? 0 : Math.sign(next - previous);
  }
  function defaultLayers(workspace, route) {
    const selectors = route === "calendar" ? [
      ["title", ".calendar-title-copy"],
      ["controls", "#calendar-today"], ["controls", ".calendar-stepper"], ["controls", ".calendar-toolbar-actions"],
      ["content", "#daily-task-panel"], ["content", "#planner-calendar"],
    ] : [["title", ".topbar-title"], ["controls", ".topbar-actions"], ["content", `#view-${route}`]];
    return selectors.map(([role, selector]) => ({ role, element: workspace.querySelector?.(selector) }));
  }
  function create({ window: win, workspace, order, getOwner = () => "local", getLayers = route => defaultLayers(workspace, route) }) {
    const doc = win.document, root = doc.documentElement;
    const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
    const touch = win.matchMedia("(any-pointer: coarse)");
    let running = null, sequence = 0, pointer = null, committing = false;
    function setTemporaryStyle(restores, element, name, value) {
      const previous = element.style.getPropertyValue?.(name) || "";
      const priority = element.style.getPropertyPriority?.(name) || "";
      restores.push(() => previous ? element.style.setProperty(name, previous, priority) : element.style.removeProperty(name));
      element.style.setProperty(name, value);
    }
    function restore(restores) { restores.splice(0).reverse().forEach(undo => undo()); }
    function tagLayers(current, route, phase) {
      const counts = { title: 0, controls: 0, content: 0 }, limits = { title: 1, controls: 3, content: 2 }, selected = [];
      try {
        for (const { role, element } of getLayers(route) || []) {
          if (!Object.hasOwn(limits, role) || counts[role] >= limits[role] || !element?.style || element === workspace || !workspace.contains(element)
            || element.closest?.("[hidden], [inert]") || selected.some(other => other === element || other.contains?.(element) || element.contains?.(other))) continue;
          const bounds = element.getBoundingClientRect(), clip = current.clip, style = win.getComputedStyle?.(element);
          if (!bounds.width || !bounds.height || bounds.right <= clip.left || bounds.left >= clip.right || bounds.bottom <= clip.top || bounds.top >= clip.bottom
            || style?.display === "none" || style?.visibility === "hidden" || style?.visibility === "collapse"
            // Leave very long document content in the bounded workspace snapshot.
            // The overlay clip bounds paint, but cannot bound a named texture.
            || bounds.height > (clip.bottom - clip.top) * 1.5 || bounds.width > (clip.right - clip.left) * 1.5) continue;
          const index = counts[role]++;
          setTemporaryStyle(current.layers, element, "view-transition-name", `duck-route-${phase}-${role}${index ? `-${index}` : ""}`);
          selected.push(element);
        }
      } catch {
        // A missing/detached component changes only the visual composition.
        restore(current.layers);
        return { total: 0, content: 0 };
      }
      return { total: selected.length, content: counts.content };
    }
    function cleanup(current) {
      if (running !== current) return;
      running = null;
      restore(current.layers);
      restore(current.styles);
      delete root.dataset.pageTransition;
      delete root.dataset.pageTransitionPhase;
      delete root.dataset.pageTransitionComposition;
      delete root.dataset.pageTransitionBacking;
      current.transition?.skipTransition();
    }
    function cancel() {
      sequence += 1;
      if (running) cleanup(running);
    }
    function commit(current) {
      if (running !== current || current.sequence !== sequence || current.owner !== getOwner() || current.committed) return;
      current.committed = true;
      committing = true;
      restore(current.layers);
      try {
        current.update();
        // An update may synchronously start another route or change account.
        if (running === current && current.sequence === sequence && current.owner === getOwner() && current.layered) {
          const incoming = tagLayers(current, current.to, "new");
          // A long route body stays inside the bounded parent capture. Give that
          // capture the content spring instead of weakening long-page motion.
          root.dataset.pageTransitionBacking = incoming.content ? "surface" : "content";
        }
      } finally { committing = false; }
    }
    function settle() {
      if (!running || committing) return;
      const current = running;
      try { commit(current); } finally {
        cleanup(current);
        if (sequence === current.sequence) sequence += 1;
      }
    }
    function inside(point) {
      if (!point) return false;
      const box = workspace.getBoundingClientRect();
      return point.x >= box.left && point.x < box.right && point.y >= box.top && point.y < box.bottom;
    }
    function navigate({ from, to, source, update }) {
      cancel();
      const movement = direction(order, from, to), box = workspace.getBoundingClientRect();
      const shellMoving = workspace.parentElement?.getAnimations?.().some((animation) => animation.playState === "running");
      // Captured snapshots cannot hit-test like live controls. Touch and content
      // shortcuts stay immediate; desktop mouse entry settles before a click.
      if (!movement || reduced.matches || touch.matches || inside(pointer) || !source || workspace.contains(source)
        || doc.hidden || doc.body.classList.contains("task-panel-open") || doc.querySelector("dialog[open]") || shellMoving || !box.width || !box.height
        || typeof doc.startViewTransition !== "function") { update(); return; }
      const viewportWidth = win.innerWidth || box.right, viewportHeight = win.innerHeight || box.bottom;
      const clip = { left: Math.max(0, box.left), top: Math.max(0, box.top), right: Math.min(viewportWidth, box.right), bottom: Math.min(viewportHeight, box.bottom) };
      if (clip.right <= clip.left || clip.bottom <= clip.top) { update(); return; }
      const current = { sequence, owner: getOwner(), update, to, committed: false, transition: null, layers: [], styles: [], clip, layered: false };
      running = current;
      root.dataset.pageTransition = movement > 0 ? "forward" : "back";
      root.dataset.pageTransitionPhase = "capture";
      try {
        for (const [edge, value] of Object.entries({ top: clip.top, right: viewportWidth - clip.right, bottom: viewportHeight - clip.bottom, left: clip.left })) {
          setTemporaryStyle(current.styles, root, `--route-clip-${edge}`, `${value}px`);
        }
        current.layered = tagLayers(current, from, "old").total > 0;
        root.dataset.pageTransitionComposition = current.layered ? "layered" : "page";
        const transition = doc.startViewTransition(() => commit(current));
        current.transition = transition;
        transition.ready.then(() => {
          if (running === current) root.dataset.pageTransitionPhase = "animate";
        }, () => { if (running === current) settle(); });
        // Failure is a visual fallback; stale callbacks cannot commit old routes.
        transition.finished.then(() => {
          if (running === current) { commit(current); cleanup(current); }
        }, () => { if (running === current) settle(); });
        transition.updateCallbackDone.catch(() => { if (running === current) cleanup(current); });
      } catch { try { commit(current); } finally { cleanup(current); } }
    }
    function pointerMove(event) {
      pointer = { x: event.clientX, y: event.clientY };
      if (inside(pointer)) settle();
    }
    function pointerDown(event) {
      pointer = { x: event.clientX, y: event.clientY };
      if (inside(pointer) || event.pointerType === "touch") settle();
    }
    function focusContent(event) { if (workspace.contains(event.target)) settle(); }
    const documentEvents = { pointermove: pointerMove, pointerdown: pointerDown, focusin: focusContent, keydown: focusContent, wheel: settle, touchstart: settle };
    Object.entries(documentEvents).forEach(([name, handler]) => doc.addEventListener(name, handler, { capture: true, passive: true }));
    const windowEvents = ["resize", "pagehide", "blur"];
    windowEvents.forEach((name) => win.addEventListener(name, settle));
    reduced.addEventListener("change", settle);
    touch.addEventListener("change", settle);
    const popups = new win.MutationObserver(() => {
      if (running && (doc.querySelector("dialog[open]") || doc.querySelector("#template-management-menu"))) settle();
    });
    popups.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    return Object.freeze({ navigate, cancel, settle, destroy() {
      cancel(); popups.disconnect();
      Object.entries(documentEvents).forEach(([name, handler]) => doc.removeEventListener(name, handler, true));
      windowEvents.forEach((name) => win.removeEventListener(name, settle));
      reduced.removeEventListener("change", settle); touch.removeEventListener("change", settle);
    } });
  }
  return Object.freeze({ create, direction });
});
