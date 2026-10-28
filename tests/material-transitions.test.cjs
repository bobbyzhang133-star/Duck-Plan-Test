"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const code=fs.readFileSync(require.resolve("../landing/material-transitions.js"),"utf8");
function setup() {
  const context={window:{},document:{hidden:false,addEventListener(){},querySelector(){return null;}},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}};
  vm.runInNewContext(code,context);return context.window.DuckTransitions;
}
test("missing workspace never loses an action or completion",()=> {
  const transitions=setup();let actions=0,completed=0;
  transitions.workspace({root:null,update:()=>actions++,complete:()=>completed++});
  assert.equal(actions,1);assert.equal(completed,1);
});
test("reduced motion updates the destination without snapshots or animation frames",()=> {
  const transitions=setup();transitions.configure({reducedMotion:true});
  let current="day";
  const root={getClientRects(){throw Error("must not read layout for reduced motion");}};
  for(const mode of ["week","month","day"])transitions.workspace({root,update:()=>{current=mode;}});
  assert.equal(current,"day");assert.equal(transitions.metrics.layers,0);
});

function animatedSetup() {
  const frames=new Map(),layers=new Set(),events={};let next=0;
  function node() {return {style:{cssText:""},dataset:{},scrollTop:0,scrollLeft:0,isConnected:true,
    removeAttribute(){},setAttribute(){},matches(){return false;},querySelectorAll(){return [];},querySelector(){return null;},
    append(){},remove(){layers.delete(this);},cloneNode(){return node();},
    getClientRects(){return [{}];},getBoundingClientRect(){return {left:0,top:0,width:800,height:600};}};}
  const context={window:{},innerWidth:1024,innerHeight:768,performance:{now:()=>0},
    document:{hidden:false,activeElement:null,body:{dataset:{view:"home"},append(layer){layers.add(layer);}},createElement:node,addEventListener(type,fn){events[type]=fn;},querySelector(){return null;}},
    matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(type,fn){events[type]=fn;},
    requestAnimationFrame(fn){frames.set(++next,fn);return next;},cancelAnimationFrame(id){frames.delete(id);}};
  vm.runInNewContext(code,context);
  return {transitions:context.window.DuckTransitions,root:node(),layers,events,frames,tick(time){for(const [id,fn]of [...frames]){frames.delete(id);fn(time);}}};
}
test("rapid workspace navigation commits the latest action and removes every old layer",()=> {
  const env=animatedSetup();let destination="home",cancelled=0;
  env.transitions.workspace({root:env.root,update:()=>{destination="classes";},complete:result=>{if(result.cancelled)cancelled++;}});
  env.tick(0);
  env.transitions.workspace({root:env.root,update:()=>{destination="settings";}});
  assert.equal(destination,"settings");assert.equal(cancelled,1);assert.equal(env.layers.size,1);
  env.tick(20);env.tick(600);
  assert.equal(env.layers.size,0);assert.equal(env.frames.size,0);assert.equal(env.transitions.metrics.layers,0);
});
test("resize interrupts visual layers without undoing the destination state",()=> {
  const env=animatedSetup();let updated=false;
  env.transitions.workspace({root:env.root,update:()=>{updated=true;}});
  env.events.resize();
  assert.equal(updated,true);assert.equal(env.layers.size,0);assert.equal(env.frames.size,0);
});
