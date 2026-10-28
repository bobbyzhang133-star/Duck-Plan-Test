"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
global.window={};require("../landing/fur-sheet.js");
const {geometry,sample,revealPolygon}=window.DuckFurSheet;
test("the sheet develops a raised crest and an overturned surface normal",()=>{
  const model=geometry(1000,600,{x:900,y:100},{},.42);
  const crest=sample(model,0,0),base=sample(model,0,-1);
  assert.ok(crest.z>50);assert.ok(Math.abs(base.z)<.001);
  assert.ok(crest.normal.z<0,"the crest must turn over rather than remain a smooth bump");
  const n=crest.normal;assert.ok(Math.abs(Math.hypot(n.x,n.y,n.z)-1)<1e-6);
});
test("thickness follows the curved normal and exposes a separate underside",()=>{
  const model=geometry(800,500,{x:0,y:250},{thickness:8},.4);
  const top=sample(model,100,.1,0),bottom=sample(model,100,.1,1);
  assert.ok(Math.abs(Math.hypot(top.x-bottom.x,top.y-bottom.y,top.z-bottom.z)-8)<1e-6);
});
test("growth broadens the material and the final trailing edge clears the viewport",()=>{
  const early=geometry(900,600,{x:0,y:200},{},.05),late=geometry(900,600,{x:0,y:200},{},1);
  assert.ok(late.span>early.span*3);
  assert.equal(late.amplitude,0);
  for(const [x,y]of [[0,0],[900,0],[0,600],[900,600]]){
    const u=(x-late.origin.x)*late.nx+(y-late.origin.y)*late.ny;
    assert.ok(sample(late,0,-1).u>u);
  }
});
test("DOM reveal boundary uses the same grounded trailing edge as the mesh",()=>{
  const model=geometry(1000,600,{x:900,y:100},{},.4);
  const grounded=sample(model,0,-1);
  assert.equal(grounded.z,0);
  assert.ok(revealPolygon(model).includes(`${grounded.x.toFixed(2)}px ${grounded.y.toFixed(2)}px`));
});
