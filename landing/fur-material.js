(() => {
  "use strict";

  const DEFAULTS = Object.freeze({
    quality: "medium",
    density: 1,
    length: 5.4,
    stiffness: 86,
    damping: 17,
    radius: 54,
    brushStrength: 5.8,
    compression: 0.92,
    recoveryDelay: 300,
  });

  const QUALITY = Object.freeze({
    low: { fibersPerPixel: 0.12, maxFibers: 1800, dpr: 1.25 },
    medium: { fibersPerPixel: 0.28, maxFibers: 5200, dpr: 1.75 },
    high: { fibersPerPixel: 0.35, maxFibers: 30000, dpr: 2 },
  });

  const registry = new WeakMap();
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const smoothstep = (edge0, edge1, value) => {
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  function shader(gl, type, source) {
    const compiled = gl.createShader(type);
    gl.shaderSource(compiled, source);
    gl.compileShader(compiled);
    if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(compiled);
      gl.deleteShader(compiled);
      throw new Error(message || "DuckFur shader compilation failed");
    }
    return compiled;
  }

  function program(gl, vertexSource, fragmentSource) {
    const linked = gl.createProgram();
    gl.attachShader(linked, shader(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(linked, shader(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(linked);
    if (!gl.getProgramParameter(linked, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(linked) || "DuckFur shader linking failed");
    }
    return linked;
  }

  const VERTEX_SHADER = `#version 300 es
    precision highp float;
    layout(location = 0) in vec2 a_corner;
    layout(location = 1) in vec2 a_root;
    layout(location = 2) in vec3 a_seed;
    layout(location = 3) in vec3 a_state;

    uniform vec2 u_resolution;
    uniform float u_length;
    uniform float u_dpr;

    out float v_height;
    out float v_side;
    out float v_color;
    out float v_compression;
    out float v_light;

    void main() {
      float compression = clamp(a_state.z, 0.0, 1.0);
      float lengthPx = u_length * u_dpr * a_seed.x;
      float heightScale = 1.0 - compression * 0.72;
      vec2 naturalLean = vec2(cos(a_seed.y), sin(a_seed.y)) * lengthPx * mix(0.28, 0.38, a_seed.z);
      vec2 bend = a_state.xy * lengthPx * 1.5;
      vec2 direction = naturalLean * heightScale + bend * mix(0.72, 1.3, compression);
      float projectedLength = max(length(direction), 1.15 * u_dpr);
      vec2 tangent = direction / projectedLength;
      vec2 normal = vec2(-tangent.y, tangent.x);
      float rootWidth = mix(1.05, 1.5, a_seed.z) * u_dpr;
      float tipWidth = rootWidth * mix(0.82, 1.26, compression);
      float width = mix(rootWidth, tipWidth, a_corner.y);
      vec2 rootPx = a_root * u_resolution;
      vec2 pixel = rootPx + direction * a_corner.y + normal * a_corner.x * width;
      vec2 clip = pixel / u_resolution * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);

      v_height = a_corner.y;
      v_side = a_corner.x;
      v_color = a_seed.z;
      v_compression = compression;
      v_light = 0.78 + 0.22 * clamp(dot(normalize(vec3(tangent, 0.7)), normalize(vec3(-0.35, -0.45, 0.82))), 0.0, 1.0);
    }
  `;

  const FRAGMENT_SHADER = `#version 300 es
    precision highp float;
    in float v_height;
    in float v_side;
    in float v_color;
    in float v_compression;
    in float v_light;
    out vec4 outColor;

    void main() {
      float softEdge = 1.0 - smoothstep(0.62, 1.0, abs(v_side));
      float taperedTip = 1.0 - smoothstep(0.86, 1.0, v_height) * 0.24;
      vec3 root = mix(vec3(0.72, 0.49, 0.10), vec3(0.86, 0.66, 0.22), v_color);
      vec3 middle = mix(vec3(0.98, 0.84, 0.46), vec3(1.0, 0.92, 0.65), v_color);
      vec3 tip = mix(vec3(1.0, 0.95, 0.76), vec3(1.0, 0.985, 0.88), v_color);
      vec3 color = mix(root, middle, smoothstep(0.0, 0.58, v_height));
      color = mix(color, tip, smoothstep(0.58, 1.0, v_height));
      float occlusion = mix(1.0, 0.56, v_compression * (1.0 - v_height * 0.45));
      float tipGlow = 1.0 + smoothstep(0.76, 1.0, v_height) * 0.11;
      color *= v_light * occlusion * tipGlow;
      float alpha = softEdge * taperedTip * mix(0.82, 0.94, v_height);
      outColor = vec4(color, alpha);
    }
  `;

  class DuckFurSurface {
    constructor(host, options = {}) {
      this.host = host;
      this.options = { ...DEFAULTS, ...options };
      this.canvas = document.createElement("canvas");
      this.canvas.className = "fur-canvas";
      this.canvas.setAttribute("aria-hidden", "true");
      this.host.prepend(this.canvas);
      this.host.classList.add("fur-material");

      this.width = 0;
      this.height = 0;
      this.count = 0;
      this.visible = true;
      this.running = false;
      this.pressed = false;
      this.recoveryDelayRemaining = 0;
      this.hovered = false;
      this.pointer = { x: 0, y: 0, previousX: 0, previousY: 0, time: 0 };
      this.lastFrame = 0;
      this.frames = 0;
      this.fpsClock = performance.now();
      this.fps = 0;
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.lowPower = (navigator.deviceMemory && navigator.deviceMemory <= 4) || navigator.hardwareConcurrency <= 4;

      this.onPointerEnter = this.onPointerEnter.bind(this);
      this.onPointerMove = this.onPointerMove.bind(this);
      this.onPointerDown = this.onPointerDown.bind(this);
      this.onPointerUp = this.onPointerUp.bind(this);
      this.onPointerLeave = this.onPointerLeave.bind(this);
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onKeyUp = this.onKeyUp.bind(this);
      this.onVisibility = this.onVisibility.bind(this);
      this.onMotionChange = this.onMotionChange.bind(this);
      this.onContextLost = this.onContextLost.bind(this);
      this.onContextRestored = this.onContextRestored.bind(this);
      this.frame = this.frame.bind(this);

      this.bindEvents();
      this.initializeGraphics();
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.host);
      if ("IntersectionObserver" in window) {
        this.intersectionObserver = new IntersectionObserver(([entry]) => {
          this.visible = entry.isIntersecting;
          if (this.visible) this.wake();
        }, { rootMargin: "80px" });
        this.intersectionObserver.observe(this.host);
      }
      this.resize();
    }

    bindEvents() {
      this.host.addEventListener("pointerenter", this.onPointerEnter);
      this.host.addEventListener("pointermove", this.onPointerMove);
      this.host.addEventListener("pointerdown", this.onPointerDown);
      this.host.addEventListener("pointerup", this.onPointerUp);
      this.host.addEventListener("pointercancel", this.onPointerUp);
      this.host.addEventListener("pointerleave", this.onPointerLeave);
      this.host.addEventListener("keydown", this.onKeyDown);
      this.host.addEventListener("keyup", this.onKeyUp);
      document.addEventListener("visibilitychange", this.onVisibility);
      this.canvas.addEventListener("webglcontextlost", this.onContextLost);
      this.canvas.addEventListener("webglcontextrestored", this.onContextRestored);
      if (this.reducedMotion.addEventListener) this.reducedMotion.addEventListener("change", this.onMotionChange);
    }

    initializeGraphics() {
      try {
        this.gl = this.canvas.getContext("webgl2", {
          alpha: true,
          antialias: true,
          depth: false,
          stencil: false,
          powerPreference: this.lowPower ? "low-power" : "high-performance",
          premultipliedAlpha: true,
        });
        if (!this.gl) throw new Error("WebGL 2 unavailable");
        this.program = program(this.gl, VERTEX_SHADER, FRAGMENT_SHADER);
        this.resolutionLocation = this.gl.getUniformLocation(this.program, "u_resolution");
        this.lengthLocation = this.gl.getUniformLocation(this.program, "u_length");
        this.dprLocation = this.gl.getUniformLocation(this.program, "u_dpr");
        this.createBuffers();
        this.host.classList.remove("fur-static-fallback");
      } catch (error) {
        this.gl = null;
        this.host.classList.add("fur-static-fallback");
        this.fallbackReason = error.message;
      }
    }

    createBuffers() {
      const gl = this.gl;
      this.vertexArray = gl.createVertexArray();
      gl.bindVertexArray(this.vertexArray);

      const corners = new Float32Array([
        -1, 0, 1, 0, -1, 1,
        -1, 1, 1, 0, 1, 1,
      ]);
      this.cornerBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      this.rootBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.rootBuffer);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 0);
      gl.vertexAttribDivisor(1, 1);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 20, 8);
      gl.vertexAttribDivisor(2, 1);

      this.stateBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.stateBuffer);
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 12, 0);
      gl.vertexAttribDivisor(3, 1);

      gl.bindVertexArray(null);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    resize() {
      const rect = this.host.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (!width || !height) return;
      const quality = QUALITY[this.options.quality] || QUALITY.medium;
      const dprLimit = this.lowPower ? Math.min(quality.dpr, 1.25) : quality.dpr;
      this.dpr = Math.min(window.devicePixelRatio || 1, dprLimit);
      this.canvas.width = Math.max(1, Math.round(width * this.dpr));
      this.canvas.height = Math.max(1, Math.round(height * this.dpr));
      this.width = width;
      this.height = height;
      if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.rebuildFibers();
    }

    rebuildFibers() {
      if (!this.gl || !this.width || !this.height) return;
      const quality = QUALITY[this.options.quality] || QUALITY.medium;
      const customCap = Number(this.options.maxFibers) || quality.maxFibers;
      this.count = Math.max(90, Math.min(customCap, Math.round(this.width * this.height * quality.fibersPerPixel * this.options.density)));
      this.roots = new Float32Array(this.count * 2);
      this.rootSeeds = new Float32Array(this.count * 5);
      this.state = new Float32Array(this.count * 3);
      this.velocity = new Float32Array(this.count * 3);

      const aspect = this.width / this.height;
      const columns = Math.ceil(Math.sqrt(this.count * aspect));
      const rows = Math.ceil(this.count / columns);
      let index = 0;
      for (let row = 0; row < rows && index < this.count; row += 1) {
        for (let column = 0; column < columns && index < this.count; column += 1) {
          const jitterX = (Math.random() - 0.5) * 0.78;
          const jitterY = (Math.random() - 0.5) * 0.78;
          const x = clamp((column + 0.5 + jitterX) / columns, 0.002, 0.998);
          const y = clamp((row + 0.5 + jitterY) / rows, 0.002, 0.998);
          const rootOffset = index * 2;
          const seedOffset = index * 5;
          this.roots[rootOffset] = x;
          this.roots[rootOffset + 1] = y;
          this.rootSeeds[seedOffset] = x;
          this.rootSeeds[seedOffset + 1] = y;
          this.rootSeeds[seedOffset + 2] = 0.78 + Math.random() * 0.44;
          this.rootSeeds[seedOffset + 3] = Math.random() * Math.PI * 2;
          this.rootSeeds[seedOffset + 4] = Math.random();
          index += 1;
        }
      }

      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.rootBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.rootSeeds, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.stateBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.state, gl.DYNAMIC_DRAW);
      this.draw();
    }

    localPointer(event) {
      const rect = this.host.getBoundingClientRect();
      return {
        x: clamp(event.clientX - rect.left, 0, rect.width),
        y: clamp(event.clientY - rect.top, 0, rect.height),
      };
    }

    onPointerEnter(event) {
      if (this.host.disabled) return;
      const point = this.localPointer(event);
      this.hovered = true;
      this.pointer = { ...point, previousX: point.x, previousY: point.y, time: event.timeStamp };
      this.host.classList.add("fur-hovered");
    }

    onPointerMove(event) {
      if (this.host.disabled) return;
      const point = this.localPointer(event);
      const elapsed = Math.max(8, event.timeStamp - this.pointer.time);
      const deltaX = point.x - this.pointer.x;
      const deltaY = point.y - this.pointer.y;
      if (!this.reducedMotion.matches && this.hovered) this.brush(point.x, point.y, deltaX, deltaY, elapsed);
      this.pointer = { ...point, previousX: this.pointer.x, previousY: this.pointer.y, time: event.timeStamp };
      this.wake();
    }

    brush(x, y, deltaX, deltaY, elapsed) {
      const distance = Math.hypot(deltaX, deltaY);
      if (distance < 0.2) return;
      const speed = distance / elapsed * 1000;
      const directionX = deltaX / distance;
      const directionY = deltaY / distance;
      const impulse = clamp(speed / 560, 0.12, 1) * this.options.brushStrength;
      const radius = this.options.radius;
      for (let index = 0; index < this.count; index += 1) {
        const root = index * 2;
        const dx = this.roots[root] * this.width - x;
        const dy = this.roots[root + 1] * this.height - y;
        const normalizedDistance = Math.hypot(dx, dy) / radius;
        if (normalizedDistance >= 1) continue;
        const falloff = 1 - smoothstep(0.05, 1, normalizedDistance);
        const state = index * 3;
        this.velocity[state] = clamp(this.velocity[state] + directionX * impulse * falloff, -12, 12);
        this.velocity[state + 1] = clamp(this.velocity[state + 1] + directionY * impulse * falloff, -12, 12);
        this.velocity[state + 2] = clamp(this.velocity[state + 2] + impulse * falloff * 0.035, -3, 3);
      }
    }

    onPointerDown(event) {
      if (this.host.disabled) return;
      const point = this.localPointer(event);
      this.pointer = { ...point, previousX: point.x, previousY: point.y, time: event.timeStamp };
      this.pressed = true;
      this.recoveryDelayRemaining = 0;
      this.host.classList.add("fur-pressed");
      if (this.host.setPointerCapture) this.host.setPointerCapture(event.pointerId);
      if (this.reducedMotion.matches) this.setReducedPress(true);
      else this.imprintPress();
      this.wake();
    }

    onPointerUp(event) {
      if (!this.pressed) return;
      this.pressed = false;
      this.host.classList.remove("fur-pressed");
      if (event.pointerId !== undefined && this.host.hasPointerCapture?.(event.pointerId)) this.host.releasePointerCapture(event.pointerId);
      if (this.reducedMotion.matches) {
        this.recoveryDelayRemaining = 0;
        this.setReducedPress(false);
      } else {
        this.recoveryDelayRemaining = Math.max(0, Number(this.options.recoveryDelay) || 0) / 1000;
      }
      this.wake();
    }

    onPointerLeave() {
      this.hovered = false;
      this.host.classList.remove("fur-hovered");
      if (!this.pressed) this.wake();
    }

    onKeyDown(event) {
      if (event.repeat || (event.key !== "Enter" && event.key !== " ") || this.host.disabled) return;
      this.pointer.x = this.width / 2;
      this.pointer.y = this.height / 2;
      this.pressed = true;
      this.recoveryDelayRemaining = 0;
      this.host.classList.add("fur-pressed");
      if (this.reducedMotion.matches) this.setReducedPress(true);
      else this.imprintPress();
      this.wake();
    }

    onKeyUp(event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      this.pressed = false;
      this.host.classList.remove("fur-pressed");
      if (this.reducedMotion.matches) {
        this.recoveryDelayRemaining = 0;
        this.setReducedPress(false);
      } else {
        this.recoveryDelayRemaining = Math.max(0, Number(this.options.recoveryDelay) || 0) / 1000;
      }
      this.wake();
    }

    setReducedPress(pressed) {
      for (let index = 0; index < this.count; index += 1) {
        const root = index * 2;
        const distance = Math.hypot(this.roots[root] * this.width - this.pointer.x, this.roots[root + 1] * this.height - this.pointer.y);
        const falloff = 1 - smoothstep(0, this.options.radius, distance);
        const state = index * 3;
        this.state[state] = 0;
        this.state[state + 1] = 0;
        this.state[state + 2] = pressed ? falloff * this.options.compression : 0;
        this.velocity[state] = 0;
        this.velocity[state + 1] = 0;
        this.velocity[state + 2] = 0;
      }
      this.draw();
    }

    imprintPress(strength = 0.82) {
      for (let index = 0; index < this.count; index += 1) {
        const root = index * 2;
        const deltaX = this.roots[root] * this.width - this.pointer.x;
        const deltaY = this.roots[root + 1] * this.height - this.pointer.y;
        const distance = Math.hypot(deltaX, deltaY);
        const falloff = 1 - smoothstep(0, this.options.radius, distance);
        if (falloff <= 0) continue;

        const safeDistance = Math.max(distance, 0.001);
        const seedAngle = this.rootSeeds[index * 5 + 3];
        const outwardX = distance > 0.5 ? deltaX / safeDistance : Math.cos(seedAngle);
        const outwardY = distance > 0.5 ? deltaY / safeDistance : Math.sin(seedAngle);
        const targetX = outwardX * falloff * 0.78;
        const targetY = outwardY * falloff * 0.78;
        const targetCompression = falloff * falloff * this.options.compression;
        const blend = strength * smoothstep(0, 1, falloff);
        const state = index * 3;

        this.state[state] += (targetX - this.state[state]) * blend;
        this.state[state + 1] += (targetY - this.state[state + 1]) * blend;
        this.state[state + 2] += (targetCompression - this.state[state + 2]) * blend;
        this.velocity[state] = clamp(this.velocity[state] + targetX * 2.4, -18, 18);
        this.velocity[state + 1] = clamp(this.velocity[state + 1] + targetY * 2.4, -18, 18);
        this.velocity[state + 2] = clamp(this.velocity[state + 2] + (targetCompression - this.state[state + 2]) * 5.2, -18, 18);
      }
      this.draw();
    }

    simulate(step) {
      const stiffness = this.options.stiffness;
      const damping = this.options.damping;
      const delayedRelease = !this.pressed && this.recoveryDelayRemaining > 0;
      if (delayedRelease) this.recoveryDelayRemaining = Math.max(0, this.recoveryDelayRemaining - step);
      const keepPressTarget = this.pressed || delayedRelease;
      let maximumEnergy = 0;
      for (let index = 0; index < this.count; index += 1) {
        const root = index * 2;
        const state = index * 3;
        let targetX = 0;
        let targetY = 0;
        let targetCompression = 0;
        if (keepPressTarget) {
          const deltaX = this.roots[root] * this.width - this.pointer.x;
          const deltaY = this.roots[root + 1] * this.height - this.pointer.y;
          const distance = Math.hypot(deltaX, deltaY);
          const falloff = 1 - smoothstep(0, this.options.radius, distance);
          if (falloff > 0) {
            const safeDistance = Math.max(distance, 0.001);
            const seedAngle = this.rootSeeds[index * 5 + 3];
            const outwardX = distance > 0.5 ? deltaX / safeDistance : Math.cos(seedAngle);
            const outwardY = distance > 0.5 ? deltaY / safeDistance : Math.sin(seedAngle);
            targetX = outwardX * falloff * 0.78;
            targetY = outwardY * falloff * 0.78;
            targetCompression = falloff * falloff * this.options.compression;
          }
        }

        for (let component = 0; component < 3; component += 1) {
          const target = component === 0 ? targetX : component === 1 ? targetY : targetCompression;
          const offset = state + component;
          const acceleration = stiffness * (target - this.state[offset]) - damping * this.velocity[offset];
          this.velocity[offset] = clamp(this.velocity[offset] + acceleration * step, -18, 18);
          this.state[offset] += this.velocity[offset] * step;
          if (component < 2) this.state[offset] = clamp(this.state[offset], -1.35, 1.35);
          else this.state[offset] = clamp(this.state[offset], -0.08, 1);
          maximumEnergy = Math.max(maximumEnergy, Math.abs(this.state[offset] - target), Math.abs(this.velocity[offset]) * 0.08);
        }
      }
      return maximumEnergy;
    }

    frame(time) {
      if (!this.running) return;
      if (!this.visible || document.hidden) {
        this.running = false;
        this.lastFrame = 0;
        return;
      }
      const elapsed = this.lastFrame ? clamp((time - this.lastFrame) / 1000, 1 / 240, 1 / 24) : 1 / 60;
      this.lastFrame = time;
      const substeps = Math.ceil(elapsed / (1 / 60));
      const step = elapsed / substeps;
      let energy = 0;
      for (let index = 0; index < substeps; index += 1) energy = Math.max(energy, this.simulate(step));
      this.draw();
      this.frames += 1;
      if (time - this.fpsClock >= 500) {
        this.fps = Math.round(this.frames * 1000 / (time - this.fpsClock));
        this.frames = 0;
        this.fpsClock = time;
      }
      if (this.pressed || this.recoveryDelayRemaining > 0 || energy > 0.0025) requestAnimationFrame(this.frame);
      else {
        this.running = false;
        this.lastFrame = 0;
      }
    }

    draw() {
      const gl = this.gl;
      if (!gl || !this.count) return;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.lengthLocation, this.options.length);
      gl.uniform1f(this.dprLocation, this.dpr);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.stateBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.state);
      gl.bindVertexArray(this.vertexArray);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
      gl.bindVertexArray(null);
    }

    wake() {
      if (this.running || !this.gl || !this.visible || document.hidden) return;
      this.running = true;
      this.lastFrame = 0;
      this.frames = 0;
      this.fpsClock = performance.now();
      requestAnimationFrame(this.frame);
    }

    setParameters(parameters) {
      const previousDensity = this.options.density;
      const previousQuality = this.options.quality;
      this.options = { ...this.options, ...parameters };
      if (previousDensity !== this.options.density || previousQuality !== this.options.quality) this.resize();
      else {
        this.draw();
        this.wake();
      }
    }

    getStats() {
      return {
        renderer: this.gl ? "WebGL2 instanced strands" : "static fallback",
        fibers: this.count,
        fps: this.running ? this.fps : 0,
        settled: !this.running,
        quality: this.options.quality,
        fallbackReason: this.fallbackReason || "",
      };
    }

    onVisibility() {
      if (!document.hidden) this.wake();
    }

    onMotionChange() {
      if (this.reducedMotion.matches) {
        this.recoveryDelayRemaining = 0;
        this.state.fill(0);
        this.velocity.fill(0);
        this.running = false;
        this.draw();
      }
    }

    onContextLost(event) {
      event.preventDefault();
      this.running = false;
      this.gl = null;
      this.host.classList.add("fur-static-fallback");
      this.fallbackReason = "WebGL context lost";
    }

    onContextRestored() {
      this.initializeGraphics();
      this.resize();
    }
  }

  function mount(host, options = {}) {
    if (!host) return null;
    const existing = registry.get(host);
    if (existing) {
      existing.setParameters(options);
      return existing;
    }
    const surface = new DuckFurSurface(host, options);
    registry.set(host, surface);
    return surface;
  }

  function mountAll(root = document, selector = "[data-fur-material]") {
    return [...root.querySelectorAll(selector)].map((host) => mount(host));
  }

  window.DuckFur = { mount, mountAll, defaults: { ...DEFAULTS } };
})();
