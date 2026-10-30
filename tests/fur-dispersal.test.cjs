'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../landing/fur-dispersal.js');require('../landing/fur-material.js');require('../landing/fur-sheet.js');
const D=window.DuckDispersal,F=window.DuckFur.__testing,DuckFurSurface=F.DuckFurSurface;
function surface(){
 const s=Object.create(DuckFurSurface.prototype);s.width=160;s.height=44;s.count=32;s.pointer={x:80,y:22};
 s.options={length:5.2,splay:1,compression:.8,pressDepth:.7,transitionWidth:.36,pressRadius:38.4,radius:12.8,waveSpeed:540,labelLengthScale:.8};
 s.host={getBoundingClientRect:()=>({left:100,top:200,width:160,height:44})};
 s.roots=new Float32Array(64);s.rootSeeds=new Float32Array(192);s.materialMask=new Float32Array(96);s.state=new Float32Array(128);s.velocity=new Float32Array(128);
 for(let i=0;i<32;i++){const a=i*Math.PI/16,c=Math.cos(a),n=Math.sin(a),k=i*4;s.roots[i*2]=(80+c*14)/160;s.roots[i*2+1]=(22+n*14)/44;s.rootSeeds[i*6]=1;s.state[k]=c*.3;s.state[k+1]=n*.3;s.state[k+2]=.4;s.state[k+3]=.2;s.velocity[k]=c*2;s.velocity[k+1]=n*2;}
 return s;
}
const record={id:7,modality:'mouse',contact:{x:180,y:222},contactAt:10};
test('capture is measured in projected CSS pixels, immutable, and survives unmount/recovery',()=>{
 const s=surface(),v=D.capture(s,record,30),sample=v.samples[0],scale=5.2*1.62*(.68+.77*.4);
 for(const sector of v.samples)assert.ok(Math.abs(sector.radial-.3*scale)<1e-5);
 assert.ok(Math.abs(sample.radial-.3*scale)<1e-6);assert.ok(Math.abs(sample.velocity-2*scale)<1e-5);
 assert.ok(Math.abs(sample.compression-.4)<1e-6);assert.ok(Math.abs(sample.depression-.2)<1e-6);
 s.state.fill(0);s.velocity.fill(0);s.roots=null;
 assert.ok(sample.radial>2);assert.ok(Object.isFrozen(v.samples[0]));assert.equal(v.activationId,7);assert.equal(v.contactAt,10);
});
test('angular interpolation preserves outward direction and measured asymmetry without adding energy to empty sectors',()=>{
 const s=surface();s.state[0]*=2;const v=D.capture(s,record,30),east=D.angular(v,0),west=D.angular(v,Math.PI);
 assert.ok(east.radial>west.radial);assert.ok(Math.abs(east.tangential)<1e-6);
 s.count=0;assert.equal(D.capture(s,record,30).samples[0].radial,0);
 assert.ok(Math.abs(D.angular(v,-.001).radial-D.angular(v,2*Math.PI-.001).radial)<1e-9);
});
test('field preserves displacement/compression and initial velocity at measured seam within explicit tolerances',()=>{
 const v=D.capture(surface(),record,30),a=.4,s=D.angular(v,a),start=D.field(v,a,s.radius,0),dt=1e-6,next=D.field(v,a,s.radius,dt);
 assert.ok(Math.abs(start.radial-s.radial)<1e-10);assert.ok(Math.abs(start.compression-s.compression)<1e-10);
 assert.ok(Math.abs((next.radial-start.radial)/dt-s.velocity)<.001);
 const left=D.field(v,a,s.edge-1e-6,.04),right=D.field(v,a,s.edge+1e-6,.04);
 assert.ok(Math.abs(left.radial-right.radial)<1e-5);assert.ok(Math.abs(left.velocity-right.velocity)<1e-4);assert.ok(Math.abs(left.compression-right.compression)<1e-6);
});
test('pill seam measures real long/short axes and offset contacts',()=>{
 const b={width:160,height:44},p={x:80,y:22};assert.ok(Math.abs(D.edgeDistance(p,b,0)-80)<.001);assert.ok(Math.abs(D.edgeDistance(p,b,Math.PI/2)-22)<.001);
 assert.ok(Math.abs(D.edgeDistance({x:150,y:22},b,0)-10)<.001);
});
test('early sheet has nonzero continuing speed, rooted angular variation, and later accepted formation ordering',()=>{
 const impulse=D.capture(surface(),record,30),opts={formation:true,impulse,duration:1000},g=p=>window.DuckFurSheet.geometry(800,420,{x:100,y:90},opts,p);
 const a=g(0),b=g(.00001);assert.ok(a.radius>0);assert.ok((b.radius-a.radius)/.00001/1>500);
 for(const p of [.05,.1,.2,.5,.7,.9,1]){const m=g(p);assert.ok(m.radius>=a.radius);assert.equal(m.opacity,1);if(p===.7){assert.equal(m.tintProgress,1);assert.equal(m.settleProgress,0);}}
 assert.equal(g(.5).radius,g(.5).reach);assert.equal(g(1).settleProgress,1);
});
test('source continuation and sheet seam use identical impulse at matching physical age',()=>{
 const s=surface(),v=D.capture(s,record,30),f=D.field(v,0,20,.05);
 // Exercise actual button branch, not just two calls with matching timestamps.
 s.pressed=false;s.activePress=new Uint8Array(32);s.roots[0]=100/160;s.roots[1]=22/44;s.gl={};s.reducedMotion={matches:false};s.wake=()=>{};s.emitWave({x:80,y:22},{impulse:v,timeline:{radiusAt:()=>40}});
 const old=global.performance;global.performance={now:()=>80};try{s.advanceWaves(.016);}finally{global.performance=old;}
 const scale=5.2*1.62*(.68+.77*f.compression);
 assert.ok(Math.abs(s.state[0]*scale-f.radial)<1e-5);assert.ok(Math.abs(s.state[2]-f.compression)<1e-6);
});
test('cancelled press cannot be reused as a handoff',()=>{
 const s=surface();s.pressed=false;s.onPointerCancel({});assert.equal(s.captureDispersalState(record),null);
});
test('retained source defers unmount cleanup and releases exactly once',()=>{
 const s=surface();s.frameId=0;s.running=true;const release=s.retainDispersal();s.destroy();assert.equal(s.pendingDestroy,true);assert.equal(s.destroyed,undefined);
 let disposed=0;s.destroy=()=>disposed++;release();release();assert.equal(disposed,1);assert.equal(s.transitionRetains,0);
});
test('grounded seam matches projected sample displacement with no independent roll offset',()=>{
 const impulse=D.capture(surface(),record,30),a=0,r=D.angular(impulse,a).edge;
 const m=window.DuckFurSheet.geometry(800,420,{x:100,y:90},{formation:true,impulse,duration:1000},.1),p=window.DuckFurSheet.sample(m,0,2*r/m.reach-1),f=D.field(impulse,a,r,.1),fade=1-(.2*.2*(3-2*.2));
 assert.ok(Math.abs(p.x-(100+r+f.radial*fade))<1e-8);assert.ok(Math.abs(p.y-90)<1e-8);assert.equal(p.z,0);
});
test('confirmed native click does not add another impulse when the workspace consumes it',()=>{
 const s=surface(),pending=[],oldMicrotask=global.queueMicrotask,oldTransitions=window.DuckTransitions;
 const record={contact:{x:180,y:222},id:9,impulse:{},consumed:true};let waves=0;
 s.host.dataset={};s.emitWave=()=>waves++;window.DuckTransitions={getActivation:()=>record};global.queueMicrotask=fn=>pending.push(fn);
 try{s.onActivate({detail:0});pending.shift()();assert.equal(waves,0);record.consumed=false;s.onActivate({detail:0});pending.shift()();assert.equal(waves,1);}finally{global.queueMicrotask=oldMicrotask;window.DuckTransitions=oldTransitions;}
});
