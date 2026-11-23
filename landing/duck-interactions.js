/* Presentation-only reactions to the existing planner. Task data is read, never written. */
(() => {
  "use strict";
  const Mascot = window.DuckPlanMascot;
  const hero = document.querySelector("#welcome-duck");
  const pond = document.querySelector("#pond-duck");
  const effects = document.querySelector("#completion-effects");
  const celebration = document.querySelector("#completion-note");
  const motionControl = document.querySelector("#mascot-motion");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  let reactionTimer;
  let celebrationTimer;
  let swimTimer;
  let gazeFrame = null;
  let baseMood = "focused";
  const motionTimers = new Set();
  const operations = new Set(), checkboxOperations = new WeakMap();
  const completionContext = () => `${store.mode}:${store.user?.id || "local"}:${plannerOwnerVersion}:${document.body.dataset.view}`;
  const renderHold = window.DuckCompletionRenderHold.create({ getContext: completionContext });
  function cancelCompletions(options) {
    renderHold.cancel(options);
    for (const operation of [...operations]) operation.cancel();
  }
  window.DuckTaskCompletion = Object.freeze({
    deferRender: callback => renderHold.deferRender(callback),
    preserveFocus: () => {
      if (!operations.size) return null;
      const focused = document.activeElement, view = document.body.dataset.view;
      const taskControl = focused?.matches("input[data-task-id],button[data-edit-task]");
      const keyboard = taskControl && focused.matches(":focus-visible");
      return taskControl ? () => restoreCompletionFocus(focused, keyboard, view) : null;
    },
    forCheckbox: checkbox => checkboxOperations.get(checkbox),
    cancel: cancelCompletions
  });

  document.querySelectorAll("[data-duck-state]").forEach((element) => Mascot.mount(element, element.dataset.duckState));
  try { motionControl.checked = localStorage.getItem("duckplan-ui-mascot-motion") !== "off"; } catch { /* Keep motion available when storage is blocked. */ }
  const motionAllowed = () => motionControl.checked && !reducedMotion.matches;
  function scheduleCleanup(callback, delay) {
    const timer = setTimeout(() => { motionTimers.delete(timer); callback(); }, delay);
    motionTimers.add(timer);
  }
  function applyMotion() {
    document.documentElement.dataset.mascotMotion = motionAllowed() ? "on" : "off";
    if (!motionAllowed()) {
      cancelCompletions();
      effects.replaceChildren();
      document.querySelectorAll(".task-completion-echo").forEach((element) => element.remove());
      motionTimers.forEach(clearTimeout);
      motionTimers.clear();
      hero.classList.remove("is-greeting", "is-reacting");
      pond.classList.remove("is-swimming");
      hero.style.removeProperty("--duck-look-x");
      hero.style.removeProperty("--duck-look-y");
    }
  }
  motionControl.addEventListener("change", () => {
    try { localStorage.setItem("duckplan-ui-mascot-motion", motionControl.checked ? "on" : "off"); } catch { /* Session preference still applies. */ }
    applyMotion();
  });
  reducedMotion.addEventListener("change", applyMotion);
  applyMotion();

  function dailySummary() {
    if (window.DuckPlanClarity) return window.DuckPlanClarity.todaySummary();
    const groups = Model.groupForDate(tasks, nowKey(), nowKey());
    const unfinished = [...groups.scheduled, ...groups.unscheduled];
    const total = unfinished.length + groups.completed.length;
    return { unfinished, total, completed: groups.completed.length, percent: total ? Math.round(groups.completed.length / total * 100) : 0 };
  }
  function syncCharacter() {
    // Reopening/deleting a task or switching accounts must retire its lingering completion card.
    for (const operation of [...operations]) operation.sync();
    const summary = dailySummary();
    const hour = new Date().getHours();
    if (summary.unfinished.length > 0 || summary.total === 0) { celebration.hidden = true; clearTimeout(celebrationTimer); }
    baseMood = summary.total > 0 && summary.unfinished.length === 0 ? "happy" : hour >= 20 || hour < 6 ? "sleepy" : tasks.filter((task) => !task.completed).length >= 5 ? "encouraging" : "focused";
    if (!hero.classList.contains("is-reacting")) Mascot.setState(hero, baseMood);
    document.querySelector("#duck-companion-caption").textContent = baseMood === "sleepy" ? "A softer pace for the evening." : baseMood === "encouraging" ? "One small task is a great start." : baseMood === "happy" ? "Look at all that progress." : "A little planning. A lighter day.";
    pond.style.setProperty("--pond-position", `${summary.percent}%`);
    document.querySelector(".pond-progress-ring").style.setProperty("--pond-angle", `${summary.percent * 3.6}deg`);
    document.querySelector(".marker-finish").textContent = summary.percent === 100 ? "Made it!" : "A little further";
    const week = Model.datesForView("week", nowKey());
    const weeklyTasks = tasks.filter((task) => week.includes(task.dueDate) || week.includes(Model.scheduledParts(task)?.date));
    const completed = weeklyTasks.filter((task) => task.completed).length;
    document.querySelector("#weekly-completion-copy").textContent = weeklyTasks.length ? `${completed} of ${weeklyTasks.length} tasks completed this week` : "Your week is ready for a fresh start";
  }
  document.addEventListener("planner:render", syncCharacter);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) syncCharacter(); });
  window.addEventListener("focus", syncCharacter);
  syncCharacter();
  if (motionAllowed()) {
    hero.classList.add("is-greeting");
    scheduleCleanup(() => hero.classList.remove("is-greeting"), 1700);
  }

  // Look toward the pointer only within the welcome area, without a continuous render loop.
  const welcome = document.querySelector(".dashboard-welcome");
  welcome.addEventListener("pointermove", (event) => {
    if (!finePointer.matches || !motionAllowed() || gazeFrame !== null) return;
    const { clientX, clientY } = event;
    gazeFrame = requestAnimationFrame(() => {
      gazeFrame = null;
      if (!motionAllowed()) return;
      const rect = hero.getBoundingClientRect();
      const clamp = (value) => Math.max(-1.8, Math.min(1.8, value));
      hero.style.setProperty("--duck-look-x", `${clamp((clientX - rect.left - rect.width / 2) / 45)}px`);
      hero.style.setProperty("--duck-look-y", `${clamp((clientY - rect.top - rect.height / 2) / 45)}px`);
    });
  });
  welcome.addEventListener("pointerleave", () => {
    if (gazeFrame !== null) { cancelAnimationFrame(gazeFrame); gazeFrame = null; }
    hero.style.removeProperty("--duck-look-x"); hero.style.removeProperty("--duck-look-y");
  });

  function burst(x, y, large) {
    const count = large ? 22 : 10;
    const batch = document.createElement("span");
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement("i");
      particle.className = "completion-particle";
      const angle = (index / count) * Math.PI * 2;
      const distance = (large ? 82 : 36) + (index % 3) * 12;
      particle.style.left = `${x}px`; particle.style.top = `${y}px`;
      particle.style.setProperty("--particle-x", `${Math.cos(angle) * distance}px`);
      particle.style.setProperty("--particle-y", `${Math.sin(angle) * distance - 28}px`);
      particle.style.setProperty("--particle-rotation", `${index * 57}deg`);
      batch.append(particle);
    }
    effects.append(batch);
    scheduleCleanup(() => batch.remove(), 950);
    return batch;
  }
  function showDayComplete(summary) {
    celebration.hidden = false;
    document.querySelector(".toast").classList.remove("show");
    document.querySelector("#completion-note-copy").textContent = `${summary.completed} of ${summary.total} tasks done today. Enjoy a little breathing room.`;
    clearTimeout(celebrationTimer);
    celebrationTimer = setTimeout(() => {
      // Never remove a keyboard user's focused dismiss control automatically.
      if (!celebration.contains(document.activeElement)) celebration.hidden = true;
    }, 6500);
  }
  document.querySelector("#dismiss-celebration").addEventListener("click", () => {
    celebration.hidden = true;
    clearTimeout(celebrationTimer);
  });

  // Freeze the source's ancestor-dependent formatting before moving its copy onto the body.
  const snapshotProperties = [
    "box-sizing", "display", "position", "inset", "grid-template-columns", "grid-template-rows", "grid-auto-flow",
    "grid-column", "grid-row", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis",
    "align-items", "align-self", "justify-content", "gap", "padding", "margin", "width", "height",
    "min-width", "max-width", "min-height", "max-height", "font-family", "font-size", "font-weight",
    "line-height", "letter-spacing", "text-align", "white-space", "overflow-wrap", "word-break",
    "color", "background-color", "border-width", "border-style", "border-color", "border-radius"
  ];
  function completionEcho(card, rect) {
    const echo = card.cloneNode(true);
    const sourceNodes = [card, ...card.querySelectorAll("*")];
    const copiedNodes = [echo, ...echo.querySelectorAll("*")];
    sourceNodes.forEach((source, index) => {
      if (source instanceof SVGElement && source.tagName.toLowerCase() !== "svg") return;
      const style = getComputedStyle(source);
      for (const property of snapshotProperties) {
        const value = style.getPropertyValue(property);
        // Avoid rounding a text box down below the width needed by its last character.
        const frozen = ["width", "height"].includes(property) && /^\d+(\.\d+)?px$/.test(value)
          ? `${Math.ceil(Number.parseFloat(value) * 100) / 100}px` : value;
        copiedNodes[index].style.setProperty(property, frozen);
      }
    });
    echo.classList.add("task-completion-echo", "completed");
    echo.setAttribute("aria-hidden", "true"); echo.inert = true;
    echo.removeAttribute("id");
    echo.querySelectorAll("[id]").forEach(element => element.removeAttribute("id"));
    echo.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.checked = true;
      input.style.removeProperty("background-color");
      input.style.removeProperty("border-color");
      input.style.transition = "none";
    });
    const dateIcons = [...echo.querySelectorAll(".task-date-icon")];
    dateIcons.forEach(icon => {
      const space = document.createElement("span");
      space.style.cssText = icon.style.cssText;
      space.style.visibility = "hidden";
      space.setAttribute("aria-hidden", "true");
      icon.replaceWith(space);
    });
    Object.assign(echo.style, { position: "fixed", margin: "0", overflow: "clip", right: "auto", bottom: "auto", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    const height = rect.height;
    // Reserve space for the original 1.2% lift even on a narrow or short viewport.
    const scale = Math.max(.1, Math.min(2, (innerWidth - 16) / (rect.width * 1.012), (innerHeight - 36) / (height * 1.012)));
    const peakScale = scale * 1.012;
    const peakLeft = rect.left - rect.width * (peakScale - 1) / 2;
    const peakRight = rect.right + rect.width * (peakScale - 1) / 2;
    const shift = Math.max(8 - peakLeft, Math.min(0, innerWidth - 8 - peakRight));
    const peakTop = rect.top - height * (peakScale - 1) / 2 - 2 * peakScale;
    const peakBottom = rect.top + height + height * (peakScale - 1) / 2;
    const shiftY = Math.max(16 - peakTop, Math.min(0, innerHeight - 16 - peakBottom));
    echo.style.setProperty("--completion-base-scale", String(scale));
    echo.style.setProperty("--completion-peak-scale", String(peakScale));
    echo.style.setProperty("--completion-pop-x", `${shift}px`);
    echo.style.setProperty("--completion-pop-y", `${shiftY}px`);
    return echo;
  }

  function completionDuck(rect) {
    const duck = document.createElement("span"), size = Math.min(144, innerWidth - 24);
    duck.className = "completion-duck-reaction";
    duck.setAttribute("aria-hidden", "true"); duck.inert = true;
    duck.innerHTML = Mascot.markup("thumbsup");
    Object.assign(duck.style, {
      width: `${size}px`, height: `${size}px`,
      left: `${Math.max(12, Math.min(innerWidth - size - 12, rect.left + rect.width / 2 - size / 2))}px`,
      top: `${Math.max(12, Math.min(innerHeight - size - 90, rect.top + rect.height / 2 - size / 2))}px`
    });
    document.body.append(duck);
    return duck;
  }

  function fadeCompletionLabels(card, task) {
    const targets = new Set();
    const section = card?.closest("#daily-task-panel .task-section");
    if (section && !section.matches(".overdue-section,.completed-section")
      && ![...section.querySelectorAll("input[data-task-id]")].some(input => !input.checked)) {
      targets.add(section.querySelector(".task-section-heading"));
    }
    if (Model.taskTiming(task).overdue && unfinishedOverdueTasks().length === 1) {
      document.querySelectorAll("[data-complete-overdue]").forEach(button => {
        if (button.checkVisibility?.() !== false && !button.closest("[hidden]")) targets.add(button);
      });
    }
    return [...targets].filter(Boolean).map(element => {
      const animation = element.animate([{ opacity: getComputedStyle(element).opacity }, { opacity: 0 }],
        { duration: 200, easing: "ease-out", fill: "forwards" });
      animation.finished.catch(() => {});
      return animation;
    });
  }

  function restoreCompletionFocus(checkbox, keyboard, view) {
    if (!keyboard || document.body.dataset.view !== view || ![document.body, checkbox].includes(document.activeElement)) return;
    const scope = document.querySelector(view === "calendar" ? "#daily-task-panel" : view === "home" ? "#view-home" : "#view-tasks");
    if (!scope) return;
    const visible = element => element.getClientRects().length && element.checkVisibility?.() !== false && !element.closest("details:not([open]),[hidden],[inert]");
    const matches = [...scope.querySelectorAll("input[data-task-id]")].filter(visible);
    let replacement;
    if (checkbox.dataset.editTask) {
      const selector = checkbox.classList.contains("task-edit") ? ".task-edit[data-edit-task]" : ".task-select[data-edit-task]";
      replacement = [...scope.querySelectorAll(selector)].find(button => button.dataset.editTask === checkbox.dataset.editTask && visible(button));
    } else replacement = matches.find(input => input.dataset.taskId === checkbox.dataset.taskId);
    replacement ||= matches[0];
    const selector = view === "calendar" ? "#plan-selected-date,[data-collapse]" : view === "home" ? ".dashboard-completed > summary" : ".filter-chip.active,[data-task-layout][aria-pressed=true]";
    const fallback = [...scope.querySelectorAll(selector)].find(element => element.checkVisibility?.() !== false);
    (replacement || fallback)?.focus({ preventScroll: true });
  }

  // Capture before the persisted completion path runs. Hold only rendering, never the save.
  document.addEventListener("change", (event) => {
    const checkbox = event.target.closest("input[data-task-id]");
    if (!checkbox) return;
    checkboxOperations.get(checkbox)?.cancel();
    checkboxOperations.delete(checkbox);
    if (!checkbox.checked) return;
    const task = store.listItems().find(item => item.id === checkbox.dataset.taskId);
    if (!task || task.completed) return;
    const before = dailySummary(), view = document.body.dataset.view, context = completionContext();
    const isToday = before.unfinished.some(item => item.id === task.id), keyboard = checkbox.matches(":focus-visible");
    const rect = checkbox.getBoundingClientRect();
    const card = checkbox.closest(".daily-task-card,.all-task-row,.matrix-task-card");
    const cardRect = card?.getBoundingClientRect();
    const echo = motionAllowed() && cardRect?.width ? completionEcho(card, cardRect) : null;
    const labelFades = echo ? fadeCompletionLabels(card, task) : [];
    const controls = echo ? [...card.querySelectorAll("input,button,a,[tabindex]")].map(element => [element, element.getAttribute("tabindex")]) : [];
    const previousBusy = card?.getAttribute("aria-busy");
    // Click feedback starts now, independently of saving or the outgoing card's render hold.
    const particles = motionAllowed() ? burst(rect.left + rect.width / 2, rect.top + rect.height / 2, isToday && before.unfinished.length === 1) : null;
    let ticket = null, settled = !echo, confirmed = false, cancelled = false, reacted = false, focusAtRender = null, focusWasVisible = false;
    let duck = null, duckTimer = null, duckCleanup = null;
    const current = () => !cancelled && context === completionContext();
    function react() {
      if (!current() || !settled || !confirmed || reacted || !store.listItems().some(item => item.id === task.id && item.completed)) return;
      reacted = true;
      if (echo && motionAllowed()) {
        duckTimer = setTimeout(() => {
          if (!current()) return;
          duck = completionDuck(cardRect);
          const finish = () => { duck?.remove(); operations.delete(operation); clearTimeout(duckCleanup); };
          duck.addEventListener("animationend", event => {
            if (event.target === duck) finish();
          });
          duckCleanup = setTimeout(finish, 1700);
        }, 90);
      } else operations.delete(operation);
      const summary = dailySummary();
      const finishedDay = isToday && before.unfinished.length === 1 && summary.total > 0 && summary.unfinished.length === 0;
      Mascot.setState(hero, finishedDay ? "celebrating" : "happy");
      if (motionAllowed()) {
        hero.classList.remove("is-reacting");
        void hero.offsetWidth;
        hero.classList.add("is-reacting");
        pond.classList.add("is-swimming");
        clearTimeout(swimTimer);
        swimTimer = setTimeout(() => pond.classList.remove("is-swimming"), 1500);
      }
      if (finishedDay) showDayComplete(summary);
      clearTimeout(reactionTimer);
      reactionTimer = setTimeout(() => {
        hero.classList.remove("is-reacting");
        Mascot.setState(hero, baseMood);
      }, 1900);
    }
    function restoreSource() {
      card?.classList.remove("completion-exit-source");
      if (previousBusy == null) card?.removeAttribute("aria-busy"); else card.setAttribute("aria-busy", previousBusy);
      controls.forEach(([element, tabindex]) => { if (tabindex === null) element.removeAttribute("tabindex"); else element.setAttribute("tabindex", tabindex); });
    }
    function clean({ restore = true } = {}) {
      if (restore) {
        restoreSource(); particles?.remove();
        clearTimeout(duckTimer); clearTimeout(duckCleanup); duck?.remove();
      }
      labelFades.forEach(animation => animation.cancel());
      echo?.remove();
    }
    const operation = {
      saved() {
        if (!current()) return false;
        confirmed = true;
        if (!echo) restoreCompletionFocus(checkbox, keyboard, view);
        react(); return true;
      },
      failed() { operation.cancel(); if (context === completionContext()) restoreCompletionFocus(checkbox, keyboard, view); },
      sync() { if (!current() || !store.listItems().some(item => item.id === task.id && item.completed)) operation.cancel(); },
      cancel() {
        if (cancelled) return;
        cancelled = true; operations.delete(operation);
        ticket?.cancel(); clean();
      }
    };
    operations.add(operation); checkboxOperations.set(checkbox, operation);
    if (echo) {
      ticket = renderHold.hold({
        duration: 550,
        onRelease({ cancelled: interrupted }) {
          if (interrupted) { cancelled = true; operations.delete(operation); }
          clean({ restore: interrupted });
        },
        beforeRender() {
          const active = document.activeElement;
          focusAtRender = active?.matches("input[data-task-id],button[data-edit-task]") ? active : null;
          focusWasVisible = focusAtRender?.matches(":focus-visible");
        },
        afterRelease() {
          restoreSource();
          settled = true;
          if (current()) { restoreCompletionFocus(focusAtRender || checkbox, Boolean(focusAtRender) && focusWasVisible, view); react(); }
        }
      });
      echo.addEventListener("animationend", event => {
        if (event.target === echo && event.animationName === "task-finish") ticket.finish();
      });
      card.classList.add("completion-exit-source"); card.setAttribute("aria-busy", "true");
      controls.forEach(([element]) => { if (element !== checkbox) element.tabIndex = -1; });
      document.body.append(echo);
    }
  }, true);
  window.addEventListener("resize", () => cancelCompletions());
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancelCompletions(); });
})();
