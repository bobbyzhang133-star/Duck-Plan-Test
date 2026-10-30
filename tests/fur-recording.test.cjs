'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('workspace recorder stops every track and releases its backing canvas exactly once',()=>{
 let stopped=0,cleared=0,results=0;const stream={getTracks:()=>[{stop(){stopped++;}}]},ctx={clearRect(){},drawImage(){}};
 const canvas={width:0,height:0,getContext:()=>ctx,captureStream:()=>stream};
 class MediaRecorder{static isTypeSupported(){return true;}constructor(){this.state='inactive';this.mimeType='video/webm';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable({data:new Blob(['frame'])});this.onstop();}}
 const env={window:{},Blob,MediaRecorder,document:{createElement:()=>canvas},setTimeout:()=>1,clearTimeout(){cleared++;},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../landing/fur-recording.js'),'utf8'),env);
 const recorder=new env.window.DuckFurRecording.Recorder({width:761,height:420},{},blob=>{results++;assert.ok(blob.size>0);});
 recorder.frame({},{});recorder.finish();recorder.finish();assert.equal(stopped,1);assert.equal(cleared,1);assert.equal(results,1);assert.equal(canvas.width,0);assert.equal(canvas.height,0);
});
test('a stale recording completion cannot replace the latest exported clip',()=>{
 const video={},link={};let urls=0;
 const env={window:{},Blob,document:{querySelector:key=>key==='#sheet-video'?video:link},URL:{createObjectURL:()=>`blob:${++urls}`,revokeObjectURL(){}},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../landing/fur-recording.js'),'utf8'),env);
 env.window.DuckFurRecording.show(new Blob(['latest']),{sequence:2});const current=video.src;
 env.window.DuckFurRecording.show(new Blob(['old']),{sequence:1});assert.equal(video.src,current);assert.equal(urls,1);
});
test('an unavailable recording encoder releases the already opened capture stream',()=>{
 let stopped=0;const canvas={width:0,height:0,getContext:()=>({}),captureStream:()=>({getTracks:()=>[{stop(){stopped++;}}]})};
 class MediaRecorder{static isTypeSupported(){return true;}constructor(){throw Error('encoder unavailable');}}
 const env={window:{},MediaRecorder,document:{createElement:()=>canvas},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../landing/fur-recording.js'),'utf8'),env);
 assert.throws(()=>new env.window.DuckFurRecording.Recorder({width:761,height:420},{},()=>{}),/encoder unavailable/);
 assert.equal(stopped,1);assert.equal(canvas.width,0);assert.equal(canvas.height,0);
});
