const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(reduced=false,profile=null){
  const events={},animations=[];class Element {constructor(rect={left:100,top:200,width:400,height:300}){this.rect=rect;this.isConnected=true;this.style={opacity:"",visibility:"visible"};this.dataset={};this.children=[];}matches(s){return s===".task-modal"&&this.className==="task-modal";}querySelector(s){return s==="form"?this.form:s==="#modal-title"?this.heading:null;}append(...nodes){this.children.push(...nodes);}setAttribute(){}remove(){this.removed=true;}getBoundingClientRect(){return this.rect;}getClientRects(){return this.isConnected?[this.rect]:[];}animate(frames,options){let resolve,reject;const a={target:this,frames,options,finished:new Promise((ok,no)=>{resolve=ok;reject=no;}),cancel(){this.cancelled=true;reject();},finish(){resolve();}};animations.push(a);return a;}}
  const ctx={window:{DuckMotion:profile,addEventListener:(name,fn)=>events[name]=fn},document:{addEventListener(){},createElement:()=>new Element()},Element,getComputedStyle:()=>({transform:'matrix(1,0,0,1,5,8)',opacity:'.6',backgroundColor:'rgb(248, 201, 67)',backgroundImage:'none',borderRadius:'24px',fontSize:'14px'}),matchMedia:()=>({matches:reduced})};vm.runInNewContext(fs.readFileSync('landing/popup-motion.js','utf8'),ctx);return {api:ctx.window.DuckPopupMotion,Element,animations,events,ctx};
}
test('popup geometry maps its center and size toward the launcher rectangle',()=>{const {api}=fixture();assert.equal(api.__testing.transform({left:100,top:200,width:400,height:300},{left:20,top:30,width:80,height:40}),'translate(-240px, -300px) scale(0.2, 0.13333333333333333)');});
test('closing waits for motion and keeps the original rectangle when source is removed',async()=>{const {api,Element,animations}=fixture(),source=new Element({left:20,top:30,width:80,height:40}),panel=new Element(),anchor=api.capture(source);source.isConnected=false;let closed=false;api.close(panel,anchor,()=>closed=true);assert.equal(closed,false);assert.match(animations[0].frames[1].transform,/translate\(-240px, -300px\)/);animations[0].finish();await Promise.resolve();assert.equal(closed,true);assert.equal(animations[0].cancelled,true);});
test('reopening cancels a pending close without firing its stale close callback',async()=>{const {api,Element,animations}=fixture(),panel=new Element();let closed=false;api.close(panel,null,()=>closed=true);api.open(panel,null);assert.equal(animations[0].cancelled,true);assert.equal(animations[1].frames[0].transform,'matrix(1,0,0,1,5,8)');animations[1].finish();await Promise.resolve();assert.equal(closed,false);});
test('reduced motion completes synchronously without a shrinking animation',()=>{const {api,Element,animations}=fixture(true);let closed=false;api.close(new Element(),null,()=>closed=true);assert.equal(closed,true);assert.equal(animations.length,0);});

test('resize finishes a pending close and releases its animation',()=>{const {api,Element,animations,events}=fixture();let closed=false;api.close(new Element(),null,()=>closed=true);events.resize();assert.equal(closed,true);assert.equal(animations[0].cancelled,true);});

test('popup timing and easing come from the shared UI motion profile',()=>{const profile={easing:'linear(0,0.5,1)',duration:{popupOpen:380,popupClose:300}}, {api,Element,animations}=fixture(false,profile),panel=new Element();api.open(panel,null);assert.equal(animations[0].options.duration,380);assert.equal(animations[0].options.easing,profile.easing);api.close(panel,null);assert.equal(animations[1].options.duration,300);});

test('material morph keeps fixed layout, avoids moving blur and restores source',async()=>{const {api,Element,animations}=fixture(),source=new Element({left:20,top:30,width:80,height:40}),panel=new Element();panel.className='task-modal';panel.form=new Element();panel.heading=new Element({left:120,top:220,width:100,height:30});panel.heading.textContent='Add task';const anchor=api.capture(source);assert.equal(anchor.material.tint,'rgb(248, 201, 67)');api.open(panel,anchor);assert.equal(source.style.visibility,'hidden');assert.equal(panel.children[0].style.width,'400px');assert.equal(animations[0].frames[0].width,undefined);assert.match(animations[0].frames[0].transform,/translate\(-80px, -170px\) scale\(0.2, 0.13333333333333333\)/);assert.equal(panel.children[0].style.backdropFilter,undefined);assert.equal(animations[0].frames[0].left,undefined);assert.equal(animations[1].frames[0].fontSize,undefined);const content=animations.find(a=>a.target===panel.form);assert(content.frames[1].offset<=.3);assert(content.frames.every(f=>f.transform===undefined));animations[0].finish();await Promise.resolve();assert.equal(source.style.visibility,'visible');assert.equal(panel.form.style.opacity,'');assert(panel.children[0].removed);let closed=false;api.close(panel,anchor,()=>{assert.equal(source.style.visibility,'visible');assert(panel.children.every(node=>node.removed));closed=true;});const closing=animations.find(a=>a.target===panel.children[2]);assert.match(closing.frames[1].transform,/scale\(0.2, 0.13333333333333333\)/);assert(!closed);closing.finish();await Promise.resolve();assert(closed);assert.equal(source.style.visibility,'visible');});
test('cancelled material morph removes temporary surfaces and restores native content',()=>{const {api,Element}=fixture(),panel=new Element(),source=new Element();panel.className='task-modal';panel.form=new Element();panel.heading=new Element();api.open(panel,api.capture(source));api.cancel(panel);assert(panel.children[0].removed);assert.equal(source.style.visibility,'visible');assert.equal(panel.form.style.opacity,'');});

// Profiling must release its own observers/RAF when a user interrupts a popup.
test('opt-in profiler disconnects on cancellation and does not report twice',async()=>{
  const {api,Element,animations,ctx}=fixture();let disconnected=0,cancelled=0,created=0,output;
  ctx.window.location={search:'?motionAudit=1'};
  ctx.performance={now:()=>100,getEntriesByType:()=>[]};
  ctx.requestAnimationFrame=()=>1;ctx.cancelAnimationFrame=()=>cancelled++;
  ctx.PerformanceObserver=class {static supportedEntryTypes=['longtask'];constructor(){created++;}observe(){}takeRecords(){return [];}disconnect(){disconnected++;}};
  ctx.document.querySelector=()=>output;
  ctx.document.body={append(node){output=node;}};
  ctx.document.createElement=()=>{const node=new Element();node.textContent='';return node;};
  const panel=new Element();panel.className='task-modal';panel.form=new Element();panel.heading=new Element();
  api.open(panel,api.capture(new Element()));api.cancel(panel);animations[0].finish();await Promise.resolve();
  assert.equal(created,1);assert.equal(disconnected,1);assert.equal(cancelled,1);
  assert.equal(output.hidden,true);const records=output.textContent.trim().split('\n').map(JSON.parse);
  assert.equal(records.length,1);assert.equal(records[0].result,'cancelled');
  assert(panel.children.every(node=>node.removed));assert.equal(panel.form.style.opacity,'');
});
test('normal popup does not construct performance observers or schedule audit frames',()=>{
  const {api,Element,ctx}=fixture();ctx.PerformanceObserver=class {constructor(){throw Error('unexpected observer');}};
  ctx.requestAnimationFrame=()=>{throw Error('unexpected audit RAF');};
  const panel=new Element();panel.className='task-modal';panel.form=new Element();panel.heading=new Element();
  api.open(panel,api.capture(new Element()));api.cancel(panel);
});
