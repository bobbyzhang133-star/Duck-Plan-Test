"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
global.window={};require("../landing/fur-sheet.js");
const {geometry,sample,project,revealRadius,revealPolygon}=window.DuckFurSheet;
const model=p=>geometry(900,600,{x:410,y:250},{},p);
test("zero-progress footprint is empty and projected seed is exact",()=>{
  const m=model(0);assert.equal(m.radius,0);assert.equal(m.coverageArea,0);
  const seed=sample(m,0,-1);assert.equal(seed.visible,false);
  assert.deepEqual(project(m,seed),m.origin);
});
test("early growth is localized with no finite initial band or displaced seed",()=>{
  const m=model(.01);assert.ok(m.radius<1);assert.ok(m.band<=m.radius*.55);
  assert.equal(sample(m,0,-1).x,m.origin.x);assert.equal(sample(m,0,-1).y,m.origin.y);
  assert.ok(sample(m,0,-1).z<.2);
});
test("filled material domain grows monotonically and stays connected from seed to crest",()=>{
  let area=0;
  for(const p of [.05,.1,.2,.4,.6,.8,1]){
    const m=model(p);assert.ok(m.coverageArea>=area);area=m.coverageArea;
    for(let i=0;i<=100;i++)assert.ok(sample(m,0,2*(m.radius*i/100)/m.reach-1).visible || i===100);
  }
});
test("a root keeps fixed material coordinates as growth activates it",()=>{
  const a=model(.4),b=model(.7),q=2*20/a.reach-1;
  const first=sample(a,.25,q),second=sample(b,.25,q);
  assert.equal(first.r,second.r);assert.equal(first.x,second.x);assert.equal(first.y,second.y);
  assert.ok(first.visible && second.visible);assert.equal(first.normal.z,1);
});
test("raised rolling crest overturns its normal and carries normal-offset thickness",()=>{
  const m=model(.4),q=2*(m.radius-m.band*.5)/m.reach-1;
  const top=sample(m,0,q),bottom=sample(m,0,q,1);
  assert.ok(top.z>30);assert.ok(top.normal.z<0);
  assert.ok(Math.abs(Math.hypot(top.x-bottom.x,top.y-bottom.y,top.z-bottom.z)-m.settings.thickness)<1e-6);
});
test("reveal follows grounded inner roll foot rather than outer growth or raised crest",()=>{
  const m=model(.4),foot=sample(m,0,2*revealRadius(m)/m.reach-1);
  assert.ok(Math.abs(foot.z)<1e-8);
  assert.ok(revealPolygon(m).includes(`${foot.x.toFixed(2)}px ${foot.y.toFixed(2)}px`));
  assert.notEqual(revealRadius(m),m.radius);
});
test("settlement clears the temporary material only after full workspace coverage",()=>{
  const m=model(1);assert.equal(m.opacity,0);assert.equal(m.amplitude,0);
  for(const [x,y]of [[0,0],[900,0],[0,600],[900,600]])assert.ok(Math.hypot(x-m.origin.x,y-m.origin.y)<revealRadius(m));
});
test("every growth-speed tuning still covers and settles the whole workspace",()=>{
  for(const growthSpeed of [.5,1,2]){
    const m=geometry(900,600,{x:410,y:250},{growthSpeed},1);
    assert.equal(m.radius,m.reach);assert.equal(m.opacity,0);
  }
});
