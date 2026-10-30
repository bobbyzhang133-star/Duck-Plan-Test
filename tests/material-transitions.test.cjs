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
  function node() {return {children:[],style:{cssText:""},dataset:{},scrollTop:0,scrollLeft:0,isConnected:true,
    removeAttribute(){},setAttribute(){},matches(){return false;},querySelectorAll(){return [];},querySelector(){return null;},
    append(...nodes){this.children.push(...nodes);},remove(){layers.delete(this);},cloneNode(){return node();},
    getClientRects(){return [{}];},getBoundingClientRect(){return {left:0,top:0,width:800,height:600};}};}
  const context={window:{},innerWidth:1024,innerHeight:768,performance:{now:()=>0},
    document:{hidden:false,activeElement:null,body:{dataset:{view:"home"},append(layer){layers.add(layer);}},createElement:node,addEventListener(type,fn){events[type]=fn;},querySelector(){return null;}},
    matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(type,fn){events[type]=fn;},
    requestAnimationFrame(fn){frames.set(++next,fn);return next;},cancelAnimationFrame(id){frames.delete(id);}};
  vm.runInNewContext(code,context);
  context.window.DuckTransitions.configure({effect:"radial"});
  return {context,transitions:context.window.DuckTransitions,root:node(),layers,events,frames,tick(time){for(const [id,fn]of [...frames]){frames.delete(id);fn(time);}}};
}
test("rapid workspace navigation commits the latest action and removes every old layer",()=> {
  const env=animatedSetup();let destination="home",cancelled=0;
  env.transitions.workspace({root:env.root,update:()=>{destination="classes";},complete:result=>{if(result.cancelled)cancelled++;}});
  env.tick(0);
  env.transitions.workspace({root:env.root,update:()=>{destination="settings";}});
  assert.equal(destination,"settings");assert.equal(cancelled,1);assert.equal(env.layers.size,1);
  env.tick(20);env.tick(1100);
  assert.equal(env.layers.size,0);assert.equal(env.frames.size,0);assert.equal(env.transitions.metrics.layers,0);
});
test("resize interrupts visual layers without undoing the destination state",()=> {
  const env=animatedSetup();let updated=false;
  env.transitions.workspace({root:env.root,update:()=>{updated=true;}});
  env.events.resize();
  assert.equal(updated,true);assert.equal(env.layers.size,0);assert.equal(env.frames.size,0);
});
test("GPU initialization failure commits the real state and removes the overlay",()=>{
  const env=animatedSetup();let updated=0,completed=0;
  env.context.window.DuckFurSheet={FurSheet:class{constructor(){throw Error("GPU unavailable");}}};
  env.transitions.workspace({root:env.root,effect:"sheet",update:()=>updated++,complete:()=>completed++});
  assert.equal(updated,1);assert.equal(completed,1);assert.equal(env.layers.size,0);assert.equal(env.frames.size,0);
});
test("rapid sheet turns dispose the previous GPU renderer and final renderer",()=>{
  const env=animatedSetup();let disposals=0;
  env.context.window.DuckFurSheet={FurSheet:class{getStats(){return {};}draw(){return {};}dispose(){disposals++;}},revealPolygon(){return "polygon(0 0,100% 0,100% 100%)";}};
  env.transitions.workspace({root:env.root,effect:"sheet",update(){}});env.tick(0);
  env.transitions.workspace({root:env.root,effect:"sheet",update(){}});env.tick(20);env.tick(1100);
  assert.equal(disposals,2);assert.equal(env.layers.size,0);assert.equal(env.frames.size,0);
});
test("compatible interrupted sheets reuse one renderer and dispose it at final completion",()=>{
  const env=animatedSetup();let allocations=0,reuses=0,disposals=0;
  env.context.window.DuckFurSheet={FurSheet:class{
    constructor(){allocations++;}getStats(){return {};}draw(){return {};}dispose(){disposals++;}
    canRetarget(){return true;}retarget(){reuses++;}
  },revealPolygon(){return "polygon(0 0,100% 0,100% 100%)";}};
  for(let i=0;i<4;i++){env.transitions.workspace({root:env.root,effect:"sheet",update(){}});env.tick(i*50);}
  env.tick(1100);
  assert.equal(allocations,1);assert.equal(reuses,3);assert.equal(disposals,1);assert.equal(env.layers.size,0);
});
test("dialog opening and hidden tabs remove transition layers without reversing state",()=>{
  const env=animatedSetup();let actions=0;
  env.transitions.workspace({root:env.root,update:()=>actions++});
  env.events.toggle({target:{matches:selector=>selector==="dialog"}});
  assert.equal(env.layers.size,0);
  env.transitions.workspace({root:env.root,update:()=>actions++});
  env.context.document.hidden=true;env.events.visibilitychange();
  assert.equal(actions,2);assert.equal(env.layers.size,0);assert.equal(env.frames.size,0);
});
test("an open sidebar is excluded from the sheet viewport",()=>{
  const env=animatedSetup();let dimensions;
  env.context.document.querySelector=selector=>selector===".sidebar-open .sidebar"?{getBoundingClientRect:()=>({right:250})}:null;
  env.context.window.DuckFurSheet={FurSheet:class{
    constructor(container,options){dimensions=options;}getStats(){return {};}draw(){return {};}dispose(){}
  },revealPolygon(){return "polygon(0 0,100% 0,100% 100%)";}};
  env.transitions.workspace({root:env.root,effect:"sheet",update(){}});
  assert.equal(dimensions.width,550);assert.equal(dimensions.height,600);
  env.transitions.cancel();assert.equal(env.layers.size,0);
});
test("pointer contact survives delayed click displacement and maps exactly inside workspace",()=>{
  const {transitions:t}=animatedSetup();const source={getBoundingClientRect:()=>({left:300,top:200,width:120,height:44})};
  const down=t.captureActivation(source,{type:"pointerdown",pointerType:"mouse",clientX:317,clientY:211});
  const click=t.captureActivation(source,{type:"click",detail:1,clientX:370,clientY:220},down);
  assert.equal(click.id,down.id);assert.equal(click.contact.x,317);assert.equal(click.contact.y,211);
  const mapped=t.mapActivation(click,{left:100,top:150,width:800,height:500});
  assert.equal(mapped.emergence.x,217);assert.equal(mapped.emergence.y,61);assert.equal(mapped.external,false);
});
test("keyboard activation is deliberately centered; external contact remains separate",()=>{
  const {transitions:t}=animatedSetup();const source={getBoundingClientRect:()=>({left:20,top:100,width:100,height:40})};
  const key=t.captureActivation(source,{type:"keydown"});assert.equal(key.modality,"keyboard");
  assert.equal(key.contact.x,70);assert.equal(key.contact.y,120);
  const mapped=t.mapActivation(key,{left:250,top:50,width:550,height:600});
  assert.equal(mapped.contact.x,70);assert.equal(mapped.emergence.x,0);assert.equal(mapped.emergence.y,70);assert.equal(mapped.external,true);
});
test("button wave and sheet receive one shared timeline and activation ID",()=>{
  const env=animatedSetup();let shared,drawProgress;
  const source={getBoundingClientRect:()=>({left:300,top:200,width:100,height:40})};
  const surface={waves:[],emitWave(point,options){shared=options;this.waves.push(options);}};
  env.context.window.DuckFur={get:()=>surface};
  env.context.window.DuckFurSheet={FurSheet:class{getStats(){return {};}draw(p){drawProgress=p;return {};}dispose(){}},geometry:(w,h,o,s,p)=>({radius:p*100}),revealPolygon:()=>"none"};
  env.transitions.workspace({root:env.root,source,effect:"sheet",holdProgress:.2,update(){}});env.tick(70);
  assert.equal(shared.timeline.progressAt(70),drawProgress);assert.equal(shared.timeline.radiusAt(70),20);
  assert.ok(shared.activationId);env.transitions.cancel();assert.equal(env.layers.size,0);
});
test("programmatic rapid turns accept an explicit null event and retain control-centered origin",()=>{
  const env=animatedSetup();const source={getBoundingClientRect:()=>({left:50,top:100,width:120,height:40})};
  const record=env.transitions.captureActivation(source,null);
  assert.equal(record.modality,"programmatic");assert.equal(record.contact.x,110);
  for(let i=0;i<4;i++){env.transitions.workspace({root:env.root,source,event:null,update(){}});env.tick(i*50);}
  env.tick(1100);assert.equal(env.layers.size,0);
});
test("formation captures destination structure after real state update and cleans up on interruption",()=>{
  const env=animatedSetup();let updated=false,captured=0,uploads=0,disposed=0;
  env.context.window.DuckFormation={capture(root,bounds){assert.equal(updated,true);assert.equal(bounds.width,800);captured++;return {width:800,height:600};}};
  env.context.window.DuckFurSheet={FurSheet:class{
    getStats(){return {};}setDestination(canvas){assert.equal(canvas.width,800);uploads++;}dispose(){disposed++;}
  }};
  env.transitions.workspace({root:env.root,effect:"sheet",sheetOptions:{formation:true},update(){updated=true;}});
  assert.equal(captured,1);assert.equal(uploads,1);env.events.resize();
  assert.equal(disposed,1);assert.equal(env.layers.size,0);assert.equal(env.frames.size,0);
});
test("formation capture failure keeps the destination usable and removes GPU/DOM resources",()=>{
  const env=animatedSetup();let updated=0,completed=0,disposed=0;
  env.context.window.DuckFormation={capture(){throw Error("capture unavailable");}};
  env.context.window.DuckFurSheet={FurSheet:class{getStats(){return {};}setDestination(){}dispose(){disposed++;}}};
  env.transitions.workspace({root:env.root,effect:"sheet",sheetOptions:{formation:true},update(){updated++;},complete(result){assert.equal(result.fallback,true);completed++;}});
  assert.equal(updated,1);assert.equal(completed,1);assert.equal(disposed,1);assert.equal(env.layers.size,0);assert.equal(env.frames.size,0);
});
test("scrolled workspace bounds intersect the viewport instead of keeping the unclipped height",()=>{
  const env=animatedSetup();let rendererHeight;
  env.root.getBoundingClientRect=()=>({left:20,top:-100,width:800,height:600,right:820,bottom:500});
  env.context.window.DuckFurSheet={FurSheet:class{constructor(layer,{height}){rendererHeight=height;}getStats(){return {};}dispose(){}}};
  env.transitions.workspace({root:env.root,effect:"sheet",update(){}});
  assert.equal(rendererHeight,500);env.transitions.cancel();
});

test("native destination is available under resolving fur once complete growth hides the old snapshot",()=>{
  const env=animatedSetup();
  env.context.window.DuckFormation={capture:()=>({width:800,height:600})};
  env.context.window.DuckFurSheet={FurSheet:class{getStats(){return {};}setDestination(){}dispose(){}draw(p){return {settleProgress:p,coverageArea:1};}},revealPolygon:()=>"none",revealRadius:()=>0};
  env.transitions.workspace({root:env.root,effect:"sheet",sheetOptions:{formation:true},update(){}});
  const wrapper=[...env.layers][0].children[0];
  env.tick(0);assert.equal(wrapper.style.visibility,"visible");
  env.tick(600);assert.equal(wrapper.style.visibility,"hidden");
  env.tick(1100);assert.equal(env.layers.size,0);
});

test("measured handoff is captured before destination unmount, retains the source, and emits only one continuation",()=>{
 const env=animatedSetup();let captured=0,release=0,disposed=0,unmounted=false,options,shared;
 const source={getBoundingClientRect:()=>({left:300,top:200,width:100,height:40})},impulse={capturedAt:0,material:{length:5.2},samples:[],pressRadius:38.4};
 const surface={waves:[],captureDispersalState(record){assert.equal(unmounted,false);captured++;return {...impulse,activationId:record.id};},retainDispersal(){return ()=>release++;},emitWave(p,s){shared=s;this.waves.push(s);}};
 env.context.window.DuckFur={get:()=>surface};env.context.window.DuckFurSheet={FurSheet:class{constructor(layer,args){options=args.options;this.options=options;}getStats(){return {};}draw(){return {radius:40};}dispose(){disposed++;}},revealPolygon:()=>"none"};
 env.transitions.workspace({root:env.root,source,effect:"sheet",update(){unmounted=true;}});
 assert.equal(captured,1);assert.equal(options.impulse.activationId,shared.activationId);assert.equal(shared.impulse,options.impulse);assert.equal(surface.waves.length,1);assert.equal(options.fiberLength,5.2);
 env.tick(1100);assert.equal(release,1);assert.equal(disposed,1);assert.equal(env.layers.size,0);
});
test("physical clock includes delayed renderer preparation instead of restarting on readiness",()=>{
 const env=animatedSetup();let clock=0,progress;
 env.context.performance.now=()=>clock;
 env.context.window.DuckFurSheet={FurSheet:class{constructor(){clock=300;}getStats(){return {};}draw(p){progress=p;return {radius:50};}dispose(){}},revealPolygon:()=>"none"};
 env.transitions.workspace({root:env.root,effect:"sheet",update(){}});env.tick(10);
 assert.equal(progress,.3);env.transitions.cancel();assert.equal(env.layers.size,0);
});
test("cancelled contacts never seed a later native activation and keyboard capture stays centered",()=>{
 const env=animatedSetup();env.context.queueMicrotask=()=>{};
 const source={disabled:false,getBoundingClientRect:()=>({left:300,top:200,width:100,height:40})},event={target:{closest:()=>source},type:"pointerdown",pointerType:"mouse",clientX:310,clientY:210};
 env.events.pointerdown(event);env.events.pointercancel(event);env.events.click({...event,type:"click",detail:0});
 assert.equal(env.transitions.getActivation(source).modality,"mouse"); // click's explicit pointer metadata is independent of cancelled contact
 env.events.keydown({target:event.target,key:"Enter"});env.events.click({target:event.target,type:"click",detail:0});
 assert.equal(env.transitions.getActivation(source).modality,"keyboard");assert.equal(env.transitions.getActivation(source).contact.x,350);
});
test("GPU startup fallback releases a retained initiating button",()=>{
 const env=animatedSetup();let releases=0;
 const source={getBoundingClientRect:()=>({left:30,top:40,width:100,height:44})};
 env.context.window.DuckFur={get:()=>({captureDispersalState:()=>({capturedAt:0,material:{length:5.2},samples:[],pressRadius:38}),retainDispersal:()=>()=>releases++})};
 env.context.window.DuckFurSheet={FurSheet:class{constructor(){throw Error("cold GPU failure");}}};
 env.transitions.workspace({root:env.root,source,effect:"sheet",update(){}});assert.equal(releases,1);assert.equal(env.layers.size,0);assert.equal(env.frames.size,0);
});
