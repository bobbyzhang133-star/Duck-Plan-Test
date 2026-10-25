(() => {
  "use strict";

  const controls = document.querySelector("#fur-controls");
  const stageElement = document.querySelector("#fur-stage");
  const buttonElement = document.querySelector("#fur-demo-button");
  const performanceOutput = document.querySelector("#fur-performance");
  const defaults = {
    quality: "high",
    density: 1,
    length: 5.4,
    stiffness: 62,
    damping: 22,
    radius: 72,
    recoveryDelay: 450,
  };

  if (!window.DuckFur) {
    performanceOutput.textContent = "Renderer unavailable";
    return;
  }

  const stage = window.DuckFur.mount(stageElement, { ...defaults, maxFibers: 30000 });
  const button = window.DuckFur.mount(buttonElement, {
    quality: "medium",
    density: 1,
    length: 5.2,
    stiffness: 64,
    damping: 23,
    radius: 48,
  });

  function values() {
    const form = new FormData(controls);
    return {
      quality: form.get("quality"),
      density: Number(form.get("density")),
      length: Number(form.get("length")),
      stiffness: Number(form.get("stiffness")),
      damping: Number(form.get("damping")),
      radius: Number(form.get("radius")),
      recoveryDelay: Number(form.get("recoveryDelay")),
    };
  }

  function updateOutputs(parameters) {
    controls.querySelector('[data-output="quality"]').textContent = `${parameters.quality[0].toUpperCase()}${parameters.quality.slice(1)}`;
    controls.querySelector('[data-output="density"]').textContent = `${parameters.density.toFixed(2)}×`;
    controls.querySelector('[data-output="length"]').textContent = `${parameters.length.toFixed(1)} px`;
    controls.querySelector('[data-output="stiffness"]').textContent = parameters.stiffness;
    controls.querySelector('[data-output="damping"]').textContent = parameters.damping;
    controls.querySelector('[data-output="radius"]').textContent = `${parameters.radius} px`;
    controls.querySelector('[data-output="recoveryDelay"]').textContent = `${parameters.recoveryDelay} ms`;
  }

  let updateFrame = 0;
  function update() {
    cancelAnimationFrame(updateFrame);
    updateFrame = requestAnimationFrame(() => {
      const parameters = values();
      updateOutputs(parameters);
      stage.setParameters({ ...parameters, maxFibers: 30000 });
    });
  }

  controls.addEventListener("input", update);
  controls.addEventListener("change", update);
  document.querySelector("#fur-reset").addEventListener("click", () => {
    Object.entries(defaults).forEach(([name, value]) => {
      controls.elements[name].value = value;
    });
    update();
  });

  window.setInterval(() => {
    const stats = stage.getStats();
    const activity = stats.settled ? "settled" : `${stats.fps || "—"} FPS`;
    performanceOutput.textContent = `${stats.renderer} · ${stats.fibers.toLocaleString()} fibers · ${activity}`;
  }, 500);

  buttonElement.addEventListener("click", () => {
    const label = document.querySelector("#fur-demo-label");
    label.textContent = "Pressed — fibers recovering";
    window.setTimeout(() => { label.textContent = "Add to DuckPlan"; }, 900);
  });

  updateOutputs(defaults);
})();
