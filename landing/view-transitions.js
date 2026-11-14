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
    // Preserve the staggered pieces. The decorative line is a separate sibling,
    // not the header border, so it can spring without moving the whole header.
    const selectors = route === "calendar" ? [
      ["title", ".calendar-title-copy"],
      ["controls", "#calendar-today"], ["controls", ".calendar-stepper"], ["controls", ".calendar-toolbar-actions"],
      ["content", "#daily-task-panel"], ["content", "#planner-calendar"],
      ["outline", ".calendar-outline"],
    ] : [["title", ".topbar-title"], ["controls", ".topbar-actions"], ["content", ".topbar-divider"], ["content", `#view-${route}`]];
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
    function measureLayers(current, route, bounded = true) {
      const counts = { title: 0, controls: 0, content: 0, outline: 0 }, limits = { title: 1, controls: 3, content: 2, outline: 1 }, selected = [];
      for (const { role, element } of getLayers(route) || []) {
        if (!Object.hasOwn(limits, role) || counts[role] >= limits[role] || !element?.style || element === workspace || !workspace.contains(element)
          || element.closest?.("[hidden], [inert]") || selected.some(({ element: other }) => other === element || other.contains?.(element) || element.contains?.(other))) continue;
        const bounds = element.getBoundingClientRect(), clip = current.clip, style = win.getComputedStyle?.(element);
        if (!bounds.width || !bounds.height || bounds.right <= clip.left || bounds.left >= clip.right || bounds.bottom <= clip.top || bounds.top >= clip.bottom
          || style?.display === "none" || style?.visibility === "hidden" || style?.visibility === "collapse"
          // Long outgoing content stays in the bounded workspace snapshot. Live
          // incoming content is clipped normally, without a named texture.
          || (bounded && (bounds.height > (clip.bottom - clip.top) * 1.5 || bounds.width > (clip.right - clip.left) * 1.5))) continue;
        const index = counts[role]++;
        selected.push({ element, role, suffix: index ? `-${index}` : "" });
      }
      return selected;
    }
    function tagOutgoing(current, route) {
      try {
        const selected = measureLayers(current, route);
        // A capture name changes stacking/style state. Finish every geometry
        // read before naming any root, so one capture does not force a layout
        // flush for each individual title, control and panel.
        for (const { element, role, suffix } of selected) setTemporaryStyle(current.layers, element, "view-transition-name", `duck-route-old-${role}${suffix}`);
        return selected.length;
      } catch {
        // A missing/detached component changes only the visual composition.
        restore(current.layers);
        return 0;
      }
    }
    function complete(current) {
      if (running === current && current.nativeDone && current.liveDone) cleanup(current);
    }
    function prepareIncoming(current) {
      let selected = [];
      try { selected = measureLayers(current, current.to, false); } catch { /* The live page is still usable without an entrance. */ }
      const style = win.getComputedStyle?.(root);
      const token = (name, fallback) => style?.getPropertyValue?.(`--motion-route-${name}`)?.trim() || fallback;
      const duration = parseFloat(token("duration", "440ms")), fade = parseFloat(token("in-fade", "160ms")), stagger = parseFloat(token("stagger", "30ms"));
      const spring = token("spring", "cubic-bezier(.22,1,.36,1)"), fadeEase = token("fade-ease", "cubic-bezier(.2,.8,.2,1)");
      // Computed declarations are live. Read every distance before capture-name
      // writes or animation creation, rather than flushing style for each piece.
      const distances = Object.fromEntries(Object.entries({ title: 48, controls: 56, content: 64, outline: 64 })
        .map(([role, fallback]) => [role, parseFloat(token(`${role}-distance`, `${fallback}px`)) * current.movement]));
      // Incoming controls must be real DOM, not snapshots excluded from native
      // hit-testing. Even an existing custom capture name stays suppressed until
      // the old-only native transition ends; cleanup restores its inline value.
      setTemporaryStyle(current.styles, workspace, "view-transition-name", "none");
      try {
        for (const { element } of selected) setTemporaryStyle(current.layers, element, "view-transition-name", "none");
        for (const { element, role, suffix } of selected) {
          if (typeof element.animate !== "function") continue;
          const delay = stagger * ({ title: 0, controls: 1, content: 2, outline: 2 }[role]);
          const distance = distances[role];
          for (const [part, frames, timing] of [
            ["move", [{ transform: `translateY(${distance}px)` }, { transform: "translateY(0px)" }], { duration, easing: spring }],
            ["fade", [{ opacity: 0 }, { opacity: 1 }], { duration: fade, easing: fadeEase }],
          ]) {
            const animation = element.animate(frames, { ...timing, delay, fill: "both" });
            current.animations.push(animation);
            animation.id = `duck-route-live-${role}${suffix}-${part}`;
            animation.finished.catch(() => {});
            animation.pause(); animation.currentTime = 0;
          }
        }
      } catch {
        current.animations.forEach(animation => animation.cancel());
        current.animations.length = 0;
      }
      current.liveDone = !current.animations.length;
      if (!current.liveDone) Promise.all(current.animations.map(animation => animation.finished)).then(() => {
        if (running === current) { current.liveDone = true; complete(current); }
      }, () => { if (running === current) settle(); });
    }
    function playIncoming(current) {
      current.animations.forEach(animation => animation.play());
    }
    function cleanup(current) {
      if (running !== current) return;
      running = null;
      if (current.resumeFrame != null) win.cancelAnimationFrame?.(current.resumeFrame);
      current.animations.forEach(animation => animation.cancel());
      restore(current.layers);
      restore(current.styles);
      delete root.dataset.pageTransition;
      delete root.dataset.pageTransitionPhase;
      delete root.dataset.pageTransitionComposition;
      delete root.dataset.pageTransitionRenderer;
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
      root.dataset.pageTransitionPhase = "update";
      try {
        current.update();
        // An update may synchronously start another route or change account.
        if (running === current && current.sequence === sequence && current.owner === getOwner()) prepareIncoming(current);
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
      // Touch and content shortcuts stay immediate. Only the outgoing state is
      // captured; incoming controls keep native hit-testing while they move.
      if (!movement || reduced.matches || touch.matches || inside(pointer) || !source || workspace.contains(source)
        || doc.hidden || doc.body.classList.contains("task-panel-open") || doc.querySelector("dialog[open]") || shellMoving || !box.width || !box.height
        || typeof doc.startViewTransition !== "function") { update(); return; }
      const viewportWidth = win.innerWidth || box.right, viewportHeight = win.innerHeight || box.bottom;
      const clip = { left: Math.max(0, box.left), top: Math.max(0, box.top), right: Math.min(viewportWidth, box.right), bottom: Math.min(viewportHeight, box.bottom) };
      if (clip.right <= clip.left || clip.bottom <= clip.top) { update(); return; }
      const current = {
        sequence, owner: getOwner(), update, to, movement, committed: false, transition: null,
        layers: [], styles: [], clip, animations: [], nativeDone: false, liveDone: true,
        heldPointer: null, heldAnimations: [], resumeFrame: null,
      };
      running = current;
      root.dataset.pageTransition = movement > 0 ? "forward" : "back";
      root.dataset.pageTransitionPhase = "capture";
      root.dataset.pageTransitionRenderer = "live";
      try {
        for (const [edge, value] of Object.entries({ top: clip.top, right: viewportWidth - clip.right, bottom: viewportHeight - clip.bottom, left: clip.left })) {
          setTemporaryStyle(current.styles, root, `--route-clip-${edge}`, `${value}px`);
        }
        root.dataset.pageTransitionComposition = tagOutgoing(current, from) ? "layered" : "page";
        const transition = doc.startViewTransition(() => commit(current));
        current.transition = transition;
        transition.ready.then(() => {
          if (running === current) {
            if (current.owner !== getOwner()) { cleanup(current); return; }
            root.dataset.pageTransitionPhase = "animate"; playIncoming(current);
          }
        }, () => { if (running === current) settle(); });
        // Failure is a visual fallback; stale callbacks cannot commit old routes.
        transition.finished.then(() => {
          if (running === current) { commit(current); current.nativeDone = true; complete(current); }
        }, () => { if (running === current) settle(); });
        transition.updateCallbackDone.catch(() => { if (running === current) cleanup(current); });
      } catch { try { commit(current); } finally { cleanup(current); } }
    }
    function pointerMove(event) {
      pointer = { x: event.clientX, y: event.clientY };
      // Hover alone must not truncate a visible spring. Keep this hot path free
      // of layout reads. A press holds live geometry; keyboard/scroll settle it.
    }
    function pointerDown(event) {
      pointer = { x: event.clientX, y: event.clientY };
      if (!running || (!inside(pointer) && event.pointerType !== "touch")) return;
      if (root.dataset.pageTransitionPhase !== "animate" || !running.animations.length || event.pointerType === "touch") { settle(); return; }
      // Hold the actual transformed hitbox still through down→up→click. Finishing
      // here would move a button away before the browser dispatches its click.
      if (running.resumeFrame != null) { win.cancelAnimationFrame?.(running.resumeFrame); running.resumeFrame = null; }
      running.heldPointer = event.pointerId ?? "mouse";
      running.heldAnimations = running.animations.filter(animation => animation.playState === "running" || (animation.playState === "paused" && running.heldAnimations.includes(animation)));
      running.heldAnimations.forEach(animation => {
        const time = animation.currentTime;
        animation.pause(); animation.currentTime = time;
      });
    }
    function releasePointer(event) {
      const current = running;
      if (!current || current.heldPointer !== (event.pointerId ?? "mouse")) return;
      current.heldPointer = null;
      const resume = () => {
        current.resumeFrame = null;
        if (running !== current || current.heldPointer != null) return;
        if (current.owner !== getOwner()) { cleanup(current); return; }
        // Replaying a finished fade would restart it at zero and flash the UI.
        const held = current.heldAnimations.splice(0);
        held.forEach(animation => { if (animation.playState === "paused") animation.play(); });
      };
      if (typeof win.requestAnimationFrame === "function") current.resumeFrame = win.requestAnimationFrame(resume);
      else resume();
    }
    function focusContent(event) {
      if (workspace.contains(event.target) && !(event.type === "focusin" && running?.heldPointer != null)) settle();
    }
    const documentEvents = { pointermove: pointerMove, pointerdown: pointerDown, pointerup: releasePointer, pointercancel: releasePointer, lostpointercapture: releasePointer, focusin: focusContent, keydown: focusContent, wheel: settle, touchstart: settle };
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
