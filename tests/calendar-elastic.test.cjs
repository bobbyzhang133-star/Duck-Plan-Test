const test = require("node:test");
const assert = require("node:assert/strict");
const { createElastic } = require("../landing/calendar-viewport.js");

function fixture() {
  let next = 0;
  const frames = new Map(), timers = new Map(), animations = [], registrations = [];
  const style = () => ({ transform: "", getPropertyValue(name) { return this[name] || ""; }, getPropertyPriority() { return ""; },
    setProperty(name, value) { this[name] = value; }, removeProperty(name) { this[name] = ""; } });
  const timeline = { style: style() }, header = { style: style() };
  for (const part of [timeline, header]) part.animate = (keyframes, options) => {
    let resolve; const finished = new Promise(done => { resolve = done; });
    const animation = { keyframes, options, finished, cancel: resolve, finish: resolve };
    animations.push(animation); return animation;
  };
  const listen = target => Object.assign(target, {
    addEventListener(name, callback, options) { registrations.push({ target, name, callback, options }); },
    removeEventListener(name, callback) { const at = registrations.findIndex(r => r.target === target && r.name === name && r.callback === callback); if (at >= 0) registrations.splice(at, 1); },
  });
  const calendar = listen({ style: style(), scrollTop: 0, scrollHeight: 1500, clientHeight: 500,
    contains: node => node === timeline || node === header,
    querySelector: () => timeline,
    querySelectorAll: () => [timeline, header] });
  const reduced = listen({ matches: false });
  const view = listen({ matchMedia: () => reduced,
    requestAnimationFrame(fn) { frames.set(++next, fn); return next; }, cancelAnimationFrame: key => frames.delete(key),
    setTimeout(fn) { timers.set(++next, fn); return next; }, clearTimeout: key => timers.delete(key),
    getComputedStyle: () => ({ transform: "matrix(1,0,0,1,0,7)" }),
    displayedOffset: 7, DOMMatrixReadOnly: class { constructor() { this.m42 = view.displayedOffset; } },
  });
  const controller = createElastic({ calendar, view });
  const target = { closest: selector => selector.split(",").some(part => [".time-axis", ".timeline-columns", ".timeline-calendar"].includes(part)) ? timeline : null };
  const emit = (name, fields = {}, owner = calendar) => {
    const event = { target, cancelable: true, deltaX: 0, deltaY: -100, deltaMode: 0, prevented: false,
      preventDefault() { this.prevented = true; }, ...fields };
    registrations.filter(r => r.target === owner && r.name === name).forEach(r => r.callback(event));
    return event;
  };
  const flush = () => { const work = [...frames.values()]; frames.clear(); work.forEach(fn => fn()); };
  const release = () => { const work = [...timers.values()]; timers.clear(); work.forEach(fn => fn()); };
  return { timeline, header, calendar, view, reduced, frames, timers, animations, registrations, controller, target, emit, flush, release };
}

test("edge wheel pulls move only hours and schedule, with resistance and bounded displacement", async () => {
  const f = fixture();
  assert.ok(f.emit("wheel").prevented); f.flush();
  const first = Number(f.timeline.style.transform.match(/,(-?[\d.]+)px/)[1]);
  assert.ok(first > 20 && first < 35, "Resisted travel is smaller than the input");
  assert.equal(f.header.style.transform, `translate3d(0,${-first}px,0)`, "Header counter-moves exactly to stay stationary");
  for (let n = 0; n < 20; n++) f.emit("wheel");
  assert.equal(f.frames.size, 1, "Wheel paints coalesce into one frame"); f.flush();
  const maximum = Number(f.timeline.style.transform.match(/,(-?[\d.]+)px/)[1]);
  assert.ok(maximum > first && maximum < 48, "Continued pulls approach the limit without hitting a hard stop");
  f.release(); assert.equal(f.animations.length, 2);
  assert.equal(f.animations[0].options.duration, 220);
  assert.equal(f.animations[0].keyframes.at(-1).transform, "translate3d(0,0px,0)");
  f.animations.forEach(animation => animation.finish()); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(f.timeline.style.transform, ""); assert.equal(f.header.style.transform, "");
  f.calendar.scrollTop = 1000; f.emit("wheel", { deltaY: 100 }); f.flush();
  const bottom = Number(f.timeline.style.transform.match(/,(-?[\d.]+)px/)[1]);
  assert.ok(bottom < -20 && bottom > -35); f.controller.destroy();
});

test("the spring rebounds past rest at both limits with equal opposite stationary-header motion", () => {
  for (const bottom of [false, true]) {
    const f = fixture();
    if (bottom) f.calendar.scrollTop = 1000;
    f.emit("wheel", { deltaY: bottom ? 1000 : -1000 }); f.flush(); f.release();
    const y = frame => Number(frame.transform.match(/,(-?[\d.e+-]+)px/)[1]);
    const body = f.animations[0].keyframes, header = f.animations[1].keyframes;
    const rebound = bottom ? Math.max(...body.map(y)) : -Math.min(...body.map(y));
    assert.ok(rebound > 2 && rebound < 4, "A visible but restrained rebound, rather than a monotonic return");
    assert.equal(y(body.at(-1)), 0);
    assert.ok(Math.abs(y(body.at(-2))) < 0.01, "Tail comes to rest before cleanup");
    body.forEach((frame, index) => {
      assert.equal(frame.offset, header[index].offset);
      assert.ok(Math.abs(y(frame) + y(header[index])) < 0.000001, "Header compensation must match every spring sample");
    });
    f.controller.destroy();
  }
});

test("normal scrolling, horizontal gestures, zoom, headers and reduced motion are not intercepted", () => {
  const f = fixture();
  f.calendar.scrollTop = 100;
  assert.equal(f.emit("wheel").prevented, false);
  f.calendar.scrollTop = 0;
  for (const fields of [{ deltaY: 100 }, { deltaX: 200 }, { ctrlKey: true }, { target: { closest: () => null } }]) {
    assert.equal(f.emit("wheel", fields).prevented, false);
  }
  f.reduced.matches = true; assert.equal(f.emit("wheel").prevented, false);
  assert.equal(f.frames.size, 0); f.controller.destroy();
});

test("touch holds the stretch until release and leaves multiple fingers or block drags alone", () => {
  const f = fixture(), finger = (x, y) => ({ clientX: x, clientY: y });
  f.emit("touchstart", { touches: [finger(10, 100)] });
  assert.ok(f.emit("touchmove", { touches: [finger(10, 150)] }).prevented); f.flush();
  assert.equal(f.timers.size, 0);
  const held = Number(f.timeline.style.transform.match(/,(-?[\d.]+)px/)[1]);
  assert.ok(held > 15 && held < 20);
  f.emit("touchend"); assert.equal(f.animations.length, 2);
  f.emit("touchstart", { touches: [finger(0, 0), finger(10, 10)] });
  assert.equal(f.emit("touchmove", { touches: [finger(0, 50), finger(10, 60)] }).prevented, false);
  f.emit("touchstart", { target: { closest: () => ({}) }, touches: [finger(0, 0)] });
  assert.equal(f.emit("touchmove", { touches: [finger(0, 50)] }).prevented, false);
  f.controller.destroy();
});

test("renewed wheel gesture resumes the displayed spring position without a jump", () => {
  for (const displayed of [7, -2]) {
    const f = fixture(); f.emit("wheel"); f.flush(); f.release();
    f.view.displayedOffset = displayed;
    f.emit("wheel", { deltaY: -1 }); f.flush();
    const value = Number(f.timeline.style.transform.match(/,(-?[\d.]+)px/)[1]);
    assert.ok(value > displayed && value < displayed + 1, "Resume the displayed return/rebound position, rather than old 35px");
    f.controller.destroy();
  }
});

test("drag, rerender and lifecycle cleanup restore transforms and leave no work/listeners", () => {
  const f = fixture(); f.timeline.style.transform = "translateX(2px)";
  f.emit("wheel"); f.flush(); f.emit("dragenter");
  assert.equal(f.timeline.style.transform, "translateX(2px)");
  assert.equal(f.emit("wheel").prevented, false);
  f.emit("dragend", {}, f.view); assert.ok(f.emit("wheel").prevented);
  f.controller.reset(); assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0);
  f.emit("wheel"); f.flush(); f.release();
  f.emit("change", {}, f.reduced); assert.equal(f.timeline.style.transform, "translateX(2px)");
  f.controller.destroy(); f.controller.destroy();
  assert.equal(f.registrations.length, 0); assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0);
});

test("an interrupted or external drag cannot leave boundary stretch disabled", () => {
  for (const recover of [
    f => f.emit("dragleave", { relatedTarget: null }),
    f => f.emit("blur", {}, f.view),
    f => f.emit("pagehide", {}, f.view),
    f => f.emit("hashchange", {}, f.view),
    f => f.emit("keydown", { key: "Escape" }, f.view),
    f => f.emit("pointerdown", { pointerType: "mouse" }),
  ]) {
    const f = fixture(); f.emit("dragenter");
    assert.equal(f.emit("wheel").prevented, false, "Active drags must not stretch");
    recover(f);
    assert.equal(f.emit("wheel").prevented, true, "Cancelled drag must not disable later stretching");
    f.controller.destroy();
  }
});

test("internal drag movement and viewport refresh keep active drag protection until exit", () => {
  const f = fixture(); f.emit("dragenter");
  f.emit("dragleave", { relatedTarget: f.timeline }); f.controller.reset();
  assert.equal(f.emit("wheel").prevented, false);
  f.emit("dragleave", { relatedTarget: null });
  assert.equal(f.emit("wheel").prevented, true);
  f.controller.destroy();
});

test("one wheel movement crossing a limit uses its leftover travel for stretch at either end", () => {
  for (const bottom of [false, true]) {
    const f = fixture(); f.calendar.scrollTop = bottom ? 980 : 20;
    assert.equal(f.emit("wheel", { deltaY: bottom ? 80 : -80 }).prevented, true);
    f.flush();
    assert.equal(f.calendar.scrollTop, bottom ? 1000 : 0);
    const value = Number(f.timeline.style.transform.match(/,(-?[\d.]+)px/)[1]);
    assert.ok(bottom ? value < 0 : value > 0);
    f.controller.destroy();
  }
});

test("the exposed overlimit area continues the same pull and a reverse gesture returns into scrolling", () => {
  const f = fixture();
  const gap = { closest: selector => selector.split(",").includes(".timeline-calendar") ? f.timeline : null };
  assert.equal(f.emit("wheel", { target: gap, deltaY: -40 }).prevented, true); f.flush();
  const first = Number(f.timeline.style.transform.match(/,(-?[\d.]+)px/)[1]);
  f.emit("wheel", { target: gap, deltaY: -40 }); f.flush();
  const second = Number(f.timeline.style.transform.match(/,(-?[\d.]+)px/)[1]);
  assert.ok(second > first && second < first * 2, "Resistance grows with pull distance");
  f.emit("wheel", { deltaY: 10 }); f.flush();
  const reversed = Number(f.timeline.style.transform.match(/,(-?[\d.]+)px/)[1]);
  assert.ok(reversed > 0 && reversed < second, "Reverse input must unwind rather than snap");
  assert.equal(f.calendar.scrollTop, 0);
  f.emit("wheel", { deltaY: 100 }); f.flush();
  assert.ok(f.calendar.scrollTop > 0 && f.calendar.scrollTop < 100);
  assert.equal(f.timeline.style.transform, "");
  f.controller.destroy();
});

test("non-cancelable native wheel/touch input paints only the boundary without doubling in-range scroll", () => {
  const f = fixture(), point = y => ({ clientX: 10, clientY: y });
  f.calendar.scrollTop = 100;
  assert.equal(f.emit("wheel", { deltaY: -20, cancelable: false }).prevented, false);
  assert.equal(f.calendar.scrollTop, 100); assert.equal(f.frames.size, 0);
  f.calendar.scrollTop = 0;
  assert.equal(f.emit("wheel", { deltaY: -30, cancelable: false }).prevented, false);
  f.flush(); assert.ok(Number(f.timeline.style.transform.match(/,(-?[\d.]+)px/)[1]) > 0);
  f.controller.reset(); f.calendar.scrollTop = 100;
  f.emit("touchstart", { touches: [point(100)] });
  assert.equal(f.emit("touchmove", { touches: [point(120)], cancelable: false }).prevented, false);
  assert.equal(f.calendar.scrollTop, 100); assert.equal(f.frames.size, 0);
  f.calendar.scrollTop = 0;
  assert.equal(f.emit("touchmove", { touches: [point(160)], cancelable: false }).prevented, false);
  f.flush(); assert.ok(Number(f.timeline.style.transform.match(/,(-?[\d.]+)px/)[1]) > 0);
  f.emit("touchend"); assert.equal(f.animations.length, 2);
  f.controller.destroy();
});
