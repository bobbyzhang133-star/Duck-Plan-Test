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
    const owner = `${store.mode}:${store.user?.id || "local"}`;
    document.querySelectorAll(".task-completion-echo").forEach((echo) => {
      if (echo.dataset.completionOwner !== owner || !tasks.some((task) => task.id === echo.dataset.completionTaskId && task.completed)) echo.remove();
    });
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
    scheduleCleanup(() => batch.remove(), 750);
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

  // Use a self-contained completion card: cloning a task loses its page-scoped Due/Work styles.
  function completionEcho(task, overdue, rect) {
    const echo = document.createElement("div");
    echo.className = "task-completion-echo";
    echo.dataset.completionTaskId = task.id;
    echo.dataset.completionOwner = `${store.mode}:${store.user?.id || "local"}`;
    echo.setAttribute("aria-hidden", "true");
    echo.inert = true;
    const copy = document.createElement("span");
    copy.className = "completion-echo-copy";
    const title = document.createElement("strong");
    title.textContent = task.title || "Task";
    const status = document.createElement("span");
    status.textContent = overdue ? "Overdue task completed" : "Completed";
    copy.append(title, status);
    const duck = document.createElement("span");
    duck.className = "completion-echo-duck";
    duck.innerHTML = Mascot.markup("thumbsup");
    echo.append(copy, duck);
    const height = Math.min(Math.max(rect.height, 132), 180);
    const width = Math.min(rect.width, window.innerWidth - 24);
    Object.assign(echo.style, {
      left: `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`,
      top: `${Math.max(12, Math.min(rect.top + (rect.height - height) / 2, window.innerHeight - height - 12))}px`,
      width: `${width}px`, height: `${height}px`
    });
    return echo;
  }

  // Capture the source position before the app re-renders it. React after its change handler finishes.
  document.addEventListener("change", (event) => {
    const checkbox = event.target.closest("input[data-task-id]");
    if (!checkbox) return;
    // The app replaces list markup after a toggle. Preserve keyboard position in the new markup.
    if (checkbox.matches(":focus-visible")) {
      const listId = checkbox.closest(".daily-task-list,.dashboard-task-list,#dashboard-completed-list,#all-task-list")?.id;
      const id = checkbox.dataset.taskId;
      setTimeout(() => {
        const candidates = [...(document.getElementById(listId)?.querySelectorAll("input[data-task-id]") || [])];
        const replacement = candidates.find((input) => input.dataset.taskId === id) || candidates[0];
        const fallback = document.body.dataset.view === "home" ? ".dashboard-completed > summary" : document.body.dataset.view === "calendar" ? "#plan-selected-date" : "#view-tasks .filter-chip.active";
        (replacement || document.querySelector(fallback))?.focus({ preventScroll: true });
      }, 0);
    }
    if (!checkbox.checked) return;
    const task = tasks.find((item) => item.id === checkbox.dataset.taskId);
    if (!task || task.completed) return;
    const before = dailySummary();
    const isToday = before.unfinished.some((item) => item.id === task.id);
    const rect = checkbox.getBoundingClientRect();
    const card = checkbox.closest(".daily-task-card,.all-task-row,.matrix-task-card");
    const cardRect = card?.getBoundingClientRect();
    const echo = motionAllowed() && cardRect?.width ? completionEcho(task, Model.taskTiming(task).overdue, cardRect) : null;
    setTimeout(() => {
      if (!tasks.find((item) => item.id === task.id)?.completed) return;
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
        if (echo && cardRect?.width) {
          document.body.append(echo);
          scheduleCleanup(() => echo.remove(), 1640);
          // Celebrate after the block settles and the duck's thumbs-up arrives.
          scheduleCleanup(() => {
            if (motionAllowed() && echo.isConnected && tasks.find((item) => item.id === task.id)?.completed) {
              const landing = echo.getBoundingClientRect();
              burst(landing.right - 42, landing.top + landing.height / 2, finishedDay);
            }
          }, 700);
        } else burst(rect.left + rect.width / 2, rect.top + rect.height / 2, finishedDay);
      }
      if (finishedDay) showDayComplete(summary);
      clearTimeout(reactionTimer);
      reactionTimer = setTimeout(() => {
        hero.classList.remove("is-reacting");
        Mascot.setState(hero, baseMood);
      }, 1900);
    }, 0);
  }, true);
})();
