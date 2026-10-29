"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
const code=fs.readFileSync(require.resolve("../landing/formation-surface.js"),"utf8");
test("formation captures destination panel structure with native text excluded",()=>{
  const paints=[];let color;
  const ctx={scale(){},save(){},restore(){},beginPath(){},roundRect(){},clip(){},
    set fillStyle(value){color=value;},fillRect(x,y,w,h){paints.push({color,x,y,w,h});}};
  const rect={left:100,top:200,width:400,height:250};
  const card={getBoundingClientRect:()=>({left:120,top:260,width:360,height:60})};
  const root={getBoundingClientRect:()=>rect,querySelectorAll(selector){assert.equal(selector,"[data-formation-surface]");return [card];}};
  const canvas={getContext:()=>ctx};
  const context={window:{},devicePixelRatio:1,document:{createElement:()=>canvas},getComputedStyle:node=>({
    backgroundColor:node===root?"#ecf5fa":"#fff",borderTopLeftRadius:"14px",borderLeftWidth:node===card?"4px":"0px",borderLeftColor:"#538fc5"})};
  vm.runInNewContext(code,context);
  const result=context.window.DuckFormation.capture(root,rect);
  assert.equal(result.width,400);assert.equal(result.height,250);
  assert.ok(paints.some(p=>p.color==="#fff" && p.x===20 && p.y===60 && p.w===360));
  assert.ok(paints.some(p=>p.color==="#538fc5" && p.x===20 && p.y===60 && p.w===4));
  assert.equal(typeof ctx.fillText,"undefined","native text is never rasterized into forming material");
});
