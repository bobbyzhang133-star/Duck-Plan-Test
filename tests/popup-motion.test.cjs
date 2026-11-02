const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(reduced=false,profile=null){
  const events={},animations=[],timers=new Map();let nextTimer=0;
  class Element {
    constructor(rect={left:100,top:200,width:400,height:300}){
      this.rect=rect;this.isConnected=true;this.style={opacity:'',visibility:'visible'};this.dataset={};this.children=[];this.attributes={};this.inert=false;this.open=false;this.reads=0;
    }
    matches(s){return s==='.task-modal'&&this.className==='task-modal';}
    querySelector(s){return s==='form'?this.form:s==='#modal-title'?this.heading:null;}
    append(...nodes){this.children.push(...nodes);nodes.forEach(n=>n.removed=false);}
    setAttribute(name,value){this.attributes[name]=String(value);}
    getAttribute(name){return this.attributes[name]??null;}
    removeAttribute(name){delete this.attributes[name];}
    remove(){this.removed=true;}
    focus(){this.focused=true;}
    showModal(){this.open=true;}
    getBoundingClientRect(){this.reads++;return this.rect;}
    getClientRects(){return this.isConnected?[this.rect]:[];}
    animate(frames,options){
      let resolve,reject;const a={target:this,frames,options,finished:new Promise((ok,no)=>{resolve=ok;reject=no;}),cancel(){this.cancelled=true;reject();},finish(){resolve();}};
      animations.push(a);return a;
    }
  }
  const ctx={window:{innerWidth:600,innerHeight:700,devicePixelRatio:1,DuckMotion:profile,addEventListener:(name,fn)=>events[name]=fn},
    document:{hidden:false,addEventListener(){},createElement:()=>new Element()},Element,
    setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id),
    getComputedStyle:()=>({transform:'matrix(1,0,0,1,5,8)',opacity:'.6',backgroundColor:'rgb(248, 201, 67)',backgroundImage:'none',borderRadius:'24px',fontSize:'14px',fontWeight:'700'}),matchMedia:()=>({matches:reduced})};
  vm.runInNewContext(fs.readFileSync('landing/popup-motion.js','utf8'),ctx);
  const panel=()=>{const p=new Element();p.className='task-modal';p.form=new Element();p.heading=new Element({left:120,top:220,width:100,height:30});p.heading.textContent='Add task';return p;};
  return {api:ctx.window.DuckPopupMotion,Element,animations,events,timers,ctx,panel};
}
const settle=async animation=>{animation.finish();await Promise.resolve();};
test('popup geometry maps its center and size toward the launcher rectangle',()=>{const {api}=fixture();assert.equal(api.__testing.transform({left:100,top:200,width:400,height:300},{left:20,top:30,width:80,height:40}),'translate(-240px, -300px) scale(0.2, 0.13333333333333333)');});
test('closing waits for motion and keeps original rectangle when source is removed',async()=>{const {api,Element,animations}=fixture(),source=new Element({left:20,top:30,width:80,height:40}),panel=new Element(),anchor=api.capture(source);source.isConnected=false;let closed=false;api.close(panel,anchor,()=>closed=true);assert(!closed);assert.match(animations[0].frames[1].transform,/translate\(-240px, -300px\)/);await settle(animations[0]);assert(closed);assert(animations[0].cancelled);});
test('reopening cancels a close without firing its stale callback',async()=>{const {api,Element,animations}=fixture(),panel=new Element();let closed=false;api.close(panel,null,()=>closed=true);api.open(panel,null);assert(animations[0].cancelled);assert.equal(animations[1].frames[0].transform,'matrix(1,0,0,1,5,8)');await settle(animations[1]);assert(!closed);});
test('reduced motion is synchronous and shows native form without staging',()=>{
  const {api,animations,panel}=fixture(true),p=panel();let ready=false;api.open(p,null,()=>ready=true);
  assert(ready);assert(p.open);assert(!p.form.inert);assert.equal(animations.length,0);assert.equal(p.dataset.popupStage,undefined);
});
test('resize finishes a pending close',()=>{const {api,Element,animations,events}=fixture();let closed=false;api.close(new Element(),null,()=>closed=true);events.resize();assert(closed);assert(animations[0].cancelled);});
test('popup consumes shared duration and easing',()=>{const profile={easing:'linear(0,0.5,1)',duration:{popupOpen:380,popupClose:300}}, {api,Element,animations}=fixture(false,profile),panel=new Element();api.open(panel,null);assert.equal(animations[0].options.duration,380);assert.equal(animations[0].options.easing,profile.easing);api.close(panel,null);assert.equal(animations[1].options.duration,300);});
test('idle preparation does not open/focus/reset the form, and avoids full-form reads on click',()=>{
  const {api,Element,panel}=fixture(),p=panel();p.form.savedTitle='Keep this';
  assert(api.prepare(p));assert(!p.open);assert(!p.focused);assert.equal(p.dataset.popupPreparing,undefined);assert.equal(p.form.savedTitle,'Keep this');
  const reads=p.form.reads;api.open(p,api.capture(new Element()));assert.equal(p.form.reads,reads);assert.equal(p.dataset.popupPrepared,'true');api.cancel(p);
});
test('shell travels first; fields reveal only at fixed final geometry, then native focus callback runs',async()=>{
  const {api,Element,animations,panel}=fixture(),p=panel(),source=new Element({left:20,top:30,width:80,height:40});api.prepare(p);
  let ready=false;api.open(p,api.capture(source),()=>ready=true);
  assert(p.open);assert(p.focused);assert.equal(p.dataset.popupStage,'shell');assert(p.form.inert);assert.equal(p.form.getAttribute('aria-hidden'),'true');
  assert.equal(source.style.visibility,'hidden');assert.equal(animations.filter(a=>a.target===p.form).length,0);
  for(const a of animations)for(const frame of a.frames)assert(Object.keys(frame).every(k=>['transform','opacity','offset'].includes(k)));
  assert.equal(p.children[0].style.width,'400px');assert.equal(p.children[0].style.backdropFilter,undefined);
  await settle(animations[0]);
  assert.equal(p.dataset.popupStage,'content');assert(!p.form.inert);assert(!ready);assert.equal(p.style.width,'400px');assert.equal(p.style.height,'300px');
  const content=animations.find(a=>a.target===p.form);assert(content);assert(content.frames.every(f=>f.transform===undefined));
  await settle(content);assert(ready);assert.equal(source.style.visibility,'visible');assert(p.children.every(n=>n.removed));assert.equal(p.dataset.popupStage,undefined);
});
test('cold click reserves a scrollable frame without synchronously measuring hidden form',()=>{
  const {api,Element,panel}=fixture(),p=panel();api.open(p,api.capture(new Element()));
  assert.equal(p.form.reads,0);assert.equal(p.heading.reads,0);assert.equal(p.dataset.popupPrepared,'false');assert.equal(p.style.height,'668px');api.cancel(p);
});
test('close resolves fields before shell shrinks and restores source before callback',async()=>{
  const {api,Element,panel,animations}=fixture(),p=panel(),source=new Element();api.prepare(p);api.open(p,api.capture(source));
  await settle(animations[0]);await settle(animations.find(a=>a.target===p.form));
  const start=animations.length;let closed=false;api.close(p,api.capture(source),()=>{assert.equal(source.style.visibility,'visible');assert(p.children.every(n=>n.removed));closed=true;});
  assert.equal(p.dataset.popupStage,'content');assert(!closed);
  const fade=animations.slice(start).find(a=>a.target===p.form);assert.equal(fade.options.duration,60);await settle(fade);
  assert.equal(p.dataset.popupStage,'shell');assert(!closed);
  const movement=animations.slice(start).find(a=>a.target===p.children.at(-3)&&a.options.duration===240);assert(movement);await settle(movement);assert(closed);
});
test('Escape/close during shell reverses without revealing content or firing stale ready callback',async()=>{
  const {api,Element,panel,animations}=fixture(),p=panel(),source=new Element();let ready=false,closed=false;
  api.open(p,api.capture(source),()=>ready=true);const old=animations[0],start=animations.length;
  api.close(p,api.capture(source),()=>closed=true);assert(old.cancelled);assert.equal(p.dataset.popupStage,'shell');
  await settle(animations[start]);await settle(old);assert(closed);assert(!ready);assert.equal(animations.filter(a=>a.target===p.form).length,0);assert(p.children.every(n=>n.removed));
});
test('cancel during content reveal cancels every child, restores fields and leaves no layers',async()=>{
  const {api,Element,panel,animations}=fixture(),p=panel(),source=new Element();api.open(p,api.capture(source));await settle(animations[0]);api.cancel(p);
  assert(animations.every(a=>a.cancelled));assert(p.children.every(n=>n.removed));assert(!p.form.inert);assert.equal(p.form.getAttribute('aria-hidden'),null);assert.equal(p.form.style.opacity,'');assert.equal(source.style.visibility,'visible');
});
test('idle job skips an active modal and resize invalidates prepared geometry',()=>{
  const {api,Element,panel,timers,events}=fixture(),p=panel();api.schedulePrepare(p);p.open=true;[...timers.values()][0]();assert.equal(p.form.reads,0);
  p.open=false;api.prepare(p);events.resize();const reads=p.form.reads;api.open(p,api.capture(new Element()));assert.equal(p.form.reads,reads);assert.equal(p.dataset.popupPrepared,'false');api.cancel(p);
});
test('resize while content is resolving makes dialog usable and reserves the reflowed form',()=>{
  const {api,Element,panel,events}=fixture(),p=panel();let ready=false;api.open(p,api.capture(new Element()),()=>ready=true);events.resize();
  assert(ready);assert(!p.form.inert);assert(p.children.every(n=>n.removed));assert.equal(p.style.width,'400px');assert.equal(p.style.height,'300px');
});
test('opt-in profiler disconnects once on interruption',async()=>{
  const {api,Element,animations,ctx,panel}=fixture();let disconnected=0,cancelled=0,output;
  ctx.window.location={search:'?motionAudit=1'};ctx.performance={now:()=>100,getEntriesByType:()=>[]};ctx.requestAnimationFrame=()=>1;ctx.cancelAnimationFrame=()=>cancelled++;
  ctx.PerformanceObserver=class {static supportedEntryTypes=['longtask'];observe(){}takeRecords(){return [];}disconnect(){disconnected++;}};
  ctx.document.querySelector=()=>output;ctx.document.body={append(node){output=node;}};ctx.document.createElement=()=>{const n=new Element();n.textContent='';return n;};
  const p=panel();api.open(p,api.capture(new Element()));api.cancel(p);await settle(animations[0]);
  assert.equal(disconnected,1);assert.equal(cancelled,1);assert(output.hidden);const records=output.textContent.trim().split('\n').map(JSON.parse);assert.equal(records.length,1);assert.equal(records[0].result,'cancelled');
});
test('normal motion has no audit observer or RAF loop',()=>{
  const {api,Element,ctx,panel}=fixture();ctx.PerformanceObserver=class {constructor(){throw Error('unexpected observer');}};ctx.requestAnimationFrame=()=>{throw Error('unexpected audit RAF');};
  const p=panel();api.open(p,api.capture(new Element()));api.cancel(p);
});

test('reset releases reserved bounds and restores native form state after dismissal',()=>{
  const {api,Element,panel}=fixture(),p=panel();p.style.width='80%';api.open(p,api.capture(new Element()));p.open=false;api.reset(p);
  assert.equal(p.style.width,'80%');assert.equal(p.dataset.popupStaged,undefined);assert.equal(p.dataset.popupStage,undefined);assert(!p.form.inert);assert(p.children.every(n=>n.removed));
});
