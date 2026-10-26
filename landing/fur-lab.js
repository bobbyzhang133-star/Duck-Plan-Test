(() => {
  "use strict";

  const controls = document.querySelector("#fur-controls");
  const stageElement = document.querySelector("#fur-stage");
  const buttonElement = document.querySelector("#fur-demo-button");
  const performanceOutput = document.querySelector("#fur-performance");
  const comparisonPerformance = document.querySelector("#fur-comparison-performance");
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
    labelLengthScale: 0.48,
    labelWidthScale: 0.52,
    labelOrientationVariance: 0.06,
    labelDensity: 1.55,
    glyphTransition: 0.55,
    glyphGuardWidth: 1.4,
  };

  if (!window.DuckFur) {
    performanceOutput.textContent = "Renderer unavailable";
    comparisonPerformance.textContent = "Static fallback";
    return;
  }

  const stage = window.DuckFur.mount(stageElement, { ...defaults, maxFibers: 30000 });
  const improvedButtonOptions = {
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
    labelLengthScale: defaults.labelLengthScale,
    labelWidthScale: defaults.labelWidthScale,
    labelOrientationVariance: defaults.labelOrientationVariance,
    labelDensity: defaults.labelDensity,
    glyphTransition: defaults.glyphTransition,
    glyphGuardWidth: defaults.glyphGuardWidth,
    fragmentGlyphMask: true,
    silhouette: true,
  };
  const button = window.DuckFur.mount(buttonElement, improvedButtonOptions);

  const resolutionSurfaces = [1, 2, 3].map((scale) => window.DuckFur.mount(
    document.querySelector(`#fur-resolution-${scale}x`),
    { ...improvedButtonOptions, labelScale: scale },
  ));

  const geometrySurfaces = [
    window.DuckFur.mount(document.querySelector("#fur-geometry-baseline"), {
      ...improvedButtonOptions,
      fragmentGlyphMask: false,
      labelLengthScale: 0.54,
      labelWidthScale: 0.76,
      labelOrientationVariance: 0.12,
    }),
    window.DuckFur.mount(document.querySelector("#fur-geometry-narrow"), {
      ...improvedButtonOptions,
      fragmentGlyphMask: false,
    }),
    window.DuckFur.mount(document.querySelector("#fur-geometry-revised"), improvedButtonOptions),
  ];

  const productionSurfaces = [
    window.DuckFur.mount(document.querySelector("#fur-production-plan"), improvedButtonOptions),
    window.DuckFur.mount(document.querySelector("#fur-production-add"), improvedButtonOptions),
    window.DuckFur.mount(document.querySelector("#fur-production-focus"), improvedButtonOptions),
  ];
  const allSurfaces = [stage, button, ...resolutionSurfaces, ...geometrySurfaces, ...productionSurfaces];

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
      labelLengthScale: Number(form.get("labelLengthScale")),
      labelWidthScale: Number(form.get("labelWidthScale")),
      labelOrientationVariance: Number(form.get("labelOrientationVariance")),
      labelDensity: Number(form.get("labelDensity")),
      glyphTransition: Number(form.get("glyphTransition")),
      glyphGuardWidth: Number(form.get("glyphGuardWidth")),
    };
  }

  function updateOutputs(parameters) {
    const formats = {
      quality: `${parameters.quality[0].toUpperCase()}${parameters.quality.slice(1)}`,
      density: `${parameters.density.toFixed(2)}×`,
      length: `${parameters.length.toFixed(1)} px`,
      stiffness: parameters.stiffness,
      damping: parameters.damping,
      radius: `${parameters.radius} px`,
      recoveryDelay: `${parameters.recoveryDelay} ms`,
      pressDepth: parameters.pressDepth.toFixed(2),
      compression: parameters.compression.toFixed(2),
      splay: parameters.splay.toFixed(2),
      transitionWidth: parameters.transitionWidth.toFixed(2),
      labelScale: `${parameters.labelScale.toFixed(0)}×`,
      labelSharpness: `${parameters.labelSharpness.toFixed(2)} px`,
      labelLengthScale: `${parameters.labelLengthScale.toFixed(2)}×`,
      labelWidthScale: `${parameters.labelWidthScale.toFixed(2)}×`,
      labelOrientationVariance: `${parameters.labelOrientationVariance.toFixed(2)} rad`,
      labelDensity: `${parameters.labelDensity.toFixed(2)}×`,
      glyphTransition: `${parameters.glyphTransition.toFixed(2)} px`,
      glyphGuardWidth: `${parameters.glyphGuardWidth.toFixed(2)} px`,
    };
    Object.entries(formats).forEach(([name, value]) => {
      controls.querySelector(`[data-output="${name}"]`).textContent = value;
    });
  }

  let updateFrame = 0;
  function update() {
    cancelAnimationFrame(updateFrame);
    updateFrame = requestAnimationFrame(() => {
      const parameters = values();
      updateOutputs(parameters);
      stage.setParameters({ ...parameters, maxFibers: 30000 });
      const productionParameters = {
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
        labelLengthScale: parameters.labelLengthScale,
        labelWidthScale: parameters.labelWidthScale,
        labelOrientationVariance: parameters.labelOrientationVariance,
        labelDensity: parameters.labelDensity,
        glyphTransition: parameters.glyphTransition,
        glyphGuardWidth: parameters.glyphGuardWidth,
      };
      [button, ...productionSurfaces].forEach((surface) => surface.setParameters(productionParameters));
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
    allSurfaces.forEach((surface) => surface.resetFibers());
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

    const productionStats = productionSurfaces[1].getStats();
    const productionMotion = productionStats.settled ? "idle" : `${productionStats.fps || "—"} FPS`;
    comparisonPerformance.textContent = `${productionStats.fibers.toLocaleString()} fibers (${productionStats.labelFibers.toLocaleString()} label) · ${productionStats.drawCalls} draw · ${productionStats.rebuildMs.toFixed(1)} ms rebuild · ${(productionStats.gpuBytes / 1024).toFixed(0)} KB GPU data · ${productionMotion}`;
  }, 500);

  buttonElement.addEventListener("click", () => {
    const label = document.querySelector("#fur-demo-label");
    label.textContent = "Pressed — fibers recovering";
    window.setTimeout(() => { label.textContent = "Add to DuckPlan"; }, 900);
  });

  updateOutputs(defaults);
})();
