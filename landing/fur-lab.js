(() => {
  "use strict";

  const controls = document.querySelector("#fur-controls");
  const stageElement = document.querySelector("#fur-stage");
  const buttonElement = document.querySelector("#fur-demo-button");
  const performanceOutput = document.querySelector("#fur-performance");
  const debugState = document.querySelector("#fur-debug-state");
  const debugValues = document.querySelector("#fur-debug-values");
  const defaults = {
    quality: "high",
    density: 1,
    length: 5.4,
    stiffness: 62,
    damping: 22,
    radius: 72,
    recoveryDelay: 280,
    pressDepth: 0.78,
    compression: 0.92,
    splay: 0.76,
    transitionWidth: 0.36,
    labelScale: 2,
    labelSharpness: 1.15,
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
    recoveryDelay: defaults.recoveryDelay,
    pressDepth: defaults.pressDepth,
    compression: defaults.compression,
    splay: defaults.splay,
    transitionWidth: defaults.transitionWidth,
    labelScale: defaults.labelScale,
    labelSharpness: defaults.labelSharpness,
    silhouette: true,
  });
  const comparisonSurfaces = [
    window.DuckFur.mount(document.querySelector("#fur-label-1x"), { quality: "medium", density: 1.2, silhouette: true, labelScale: 1, labelSharpness: defaults.labelSharpness }),
    window.DuckFur.mount(document.querySelector("#fur-label-2x"), { quality: "medium", density: 1.2, silhouette: true, labelScale: 2, labelSharpness: defaults.labelSharpness }),
    window.DuckFur.mount(document.querySelector("#fur-label-production"), { quality: "medium", density: 1.2, silhouette: true, labelScale: defaults.labelScale, labelSharpness: defaults.labelSharpness }),
  ];

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
      pressDepth: Number(form.get("pressDepth")),
      compression: Number(form.get("compression")),
      splay: Number(form.get("splay")),
      transitionWidth: Number(form.get("transitionWidth")),
      labelScale: Number(form.get("labelScale")),
      labelSharpness: Number(form.get("labelSharpness")),
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
    controls.querySelector('[data-output="pressDepth"]').textContent = parameters.pressDepth.toFixed(2);
    controls.querySelector('[data-output="compression"]').textContent = parameters.compression.toFixed(2);
    controls.querySelector('[data-output="splay"]').textContent = parameters.splay.toFixed(2);
    controls.querySelector('[data-output="transitionWidth"]').textContent = parameters.transitionWidth.toFixed(2);
    controls.querySelector('[data-output="labelScale"]').textContent = `${parameters.labelScale.toFixed(0)}×`;
    controls.querySelector('[data-output="labelSharpness"]').textContent = `${parameters.labelSharpness.toFixed(2)} px`;
  }

  let updateFrame = 0;
  function update() {
    cancelAnimationFrame(updateFrame);
    updateFrame = requestAnimationFrame(() => {
      const parameters = values();
      updateOutputs(parameters);
      stage.setParameters({ ...parameters, maxFibers: 30000 });
      button.setParameters({
        stiffness: parameters.stiffness,
        damping: parameters.damping,
        radius: Math.min(parameters.radius, 64),
        recoveryDelay: parameters.recoveryDelay,
        pressDepth: parameters.pressDepth,
        compression: parameters.compression,
        splay: parameters.splay,
        transitionWidth: parameters.transitionWidth,
        labelScale: parameters.labelScale,
        labelSharpness: parameters.labelSharpness,
      });
      comparisonSurfaces[2].setParameters({ labelScale: parameters.labelScale, labelSharpness: parameters.labelSharpness });
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
  document.querySelector("#fur-neutral").addEventListener("click", () => {
    [stage, button, ...comparisonSurfaces].forEach((surface) => surface.resetFibers());
  });

  window.setInterval(() => {
    const stats = stage.getStats();
    const activity = stats.settled ? "settled" : `${stats.recoveringFibers.toLocaleString()} recovering · ${stats.fps || "—"} FPS`;
    performanceOutput.textContent = `${stats.renderer} · ${stats.fibers.toLocaleString()} fibers · ${activity}`;
    debugState.textContent = stats.settled ? "Settled" : "Recovering";
    debugState.classList.toggle("is-recovering", !stats.settled);
    const sample = stats.sample;
    debugValues.textContent = sample
      ? `strand ${sample.index} · bend ${Math.hypot(sample.bendX, sample.bendY).toFixed(3)} · compression ${sample.compression.toFixed(3)} · depth ${sample.depression.toFixed(3)} · hold ${Math.round(sample.hold * 1000)} ms`
      : "Move over the surface to inspect its nearest strand.";
  }, 500);

  buttonElement.addEventListener("click", () => {
    const label = document.querySelector("#fur-demo-label");
    label.textContent = "Pressed — fibers recovering";
    window.setTimeout(() => { label.textContent = "Add to DuckPlan"; }, 900);
  });

  updateOutputs(defaults);
})();
