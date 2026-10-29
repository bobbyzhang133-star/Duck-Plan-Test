(() => {
  const form=document.querySelector("#sheet-controls"),root=document.querySelector("#sheet-workspace"),output=document.querySelector("#sheet-metrics");
  let destination=false,timers=[];
  document.querySelectorAll("#sheet-lab button:not([data-progress])").forEach(host=>DuckFur.mount(host,{silhouette:true,quality:"medium",length:5.2,label:host.textContent.trim()}));
  function values(){const result={};for(const input of form.querySelectorAll("input")){result[input.name]=input.type==="checkbox"?input.checked:Number(input.value);const out=input.parentElement.querySelector("output");if(out)out.value=input.value;}return result;}
  function report(){const s=DuckTransitions.getStats(),peak=s.sheetPeak||{},live=s.sheetResources||{};
    const diagnostic=document.querySelector("#sheet-registration");
    if(diagnostic){const r=s.registration,last=r?.frames?.at(-1),a=r?.before,b=last?.layout||r?.destination;
      if(r)diagnostic.dataset.registration=JSON.stringify(r);
      diagnostic.textContent=a&&b?`Viewport ${b.viewport} · scroll ${b.scroll}\nRoot ${b.root?.width.toFixed(1)} × ${b.root?.height.toFixed(1)} at ${b.root?.x.toFixed(1)}, ${b.root?.y.toFixed(1)}\nOverlay ${b.overlay?.width.toFixed(1)} × ${b.overlay?.height.toFixed(1)} · canvas ${b.backing}\nTargets ${s.targets?.length||0} · content regions ${s.contentRegions?.length||0} · Δ scroll ${b.scroll.map((v,i)=>(v-a.scroll[i]).toFixed(1))}\nAnchor drift ${Math.max(0,...(last?.anchors||[]).map(p=>Math.hypot(p.x-p.projected.x,p.y-p.projected.y))).toFixed(3)} px · held frames ${r.frames.length}`:"Registration measurements appear after a transition.";
    }
    output.value=`${Math.round((s.progress||0)*100)}% · ${s.phase||"Ready"} · ${s.formation?`fur color: ${Math.round((s.tint||0)*100)}% · flatten: ${Math.round((s.settlement||0)*100)}%`:"growth / baseline"} · material domain ${Math.round(s.materialArea||0)} px² · origin ${s.activation?.modality||"—"}${s.activation?.external?" (external contact → boundary emergence)":""} · ${s.fps} FPS · max ${s.maxFrameMs.toFixed(1)} ms · ${s.longFrames} long frames · sheet init ${(peak.initializationMs||0).toFixed(1)} ms · ${peak.meshVertices||0} mesh vertices · ${peak.fiberInstances||0} fibers · GPU estimate ${((peak.gpuBytes||0)/1048576).toFixed(2)} MiB · live sheet: ${live.contexts||0} contexts / ${live.buffers||0} buffers / ${live.programs||0} programs / ${live.textures||0} textures / ${live.framebuffers||0} FBOs · ${s.layers} overlay · ${s.reusedSheets||0} interrupted renderer reuses · quality reduced ${Boolean(s.qualityReduced)} · last cancel ${s.lastCancellation||"none"}${s.sheetFailure?` · fallback: ${s.sheetFailure}`:""}`;
  }
  function turn(source,event,effect="sheet"){
    const settings=values();if(effect==="sheet" && settings.ribbon)effect="ribbon";settings.registration=true;settings.formation=effect==="sheet" && !settings.growthOnly && !settings.legacyFade;DuckTransitions.configure({duration:settings.duration});
    DuckTransitions.workspace({root,source,event,effect,sheetOptions:settings,holdProgress:()=>{const v=values();return v.hold?v.inspectProgress:null;},update:()=>{
      if(settings.growthOnly)return;
      destination=!destination;root.classList.toggle("destination",destination);
      root.querySelector("h3").textContent=destination?"Your week, in focus":"Today’s study plan";
      root.querySelector(".section-kicker").textContent=destination?"Destination workspace":"Outgoing workspace";
    },complete:report});
  }
  document.querySelector("#sheet-new").addEventListener("click",e=>turn(e.currentTarget,e));
  document.querySelector("#sheet-inside").addEventListener("click",e=>turn(e.currentTarget,e));
  document.querySelector("#sheet-ribbon").addEventListener("click",e=>turn(e.currentTarget,e,"ribbon"));
  document.querySelectorAll("#sheet-frames button").forEach(button=>button.addEventListener("click",()=>{form.elements.hold.checked=true;form.elements.inspectProgress.value=button.dataset.progress;values();}));
  document.querySelector("#sheet-old").addEventListener("click",e=>turn(e.currentTarget,e,"radial"));
  document.querySelector("#sheet-stress").addEventListener("click",e=>{timers.forEach(clearTimeout);timers=[];const source=e.currentTarget;for(let i=0;i<4;i++)timers.push(setTimeout(()=>turn(source,null),i*130));});
  document.querySelector("#sheet-reset").addEventListener("click",()=>{timers.forEach(clearTimeout);timers=[];DuckTransitions.cancel();form.reset();values();report();});
  form.addEventListener("input",event=>{values();if(event.target.name==="contextLoss" && event.target.checked)DuckTransitions.testSheetContextLoss();});values();setInterval(report,300);
  addEventListener("pagehide",()=>{timers.forEach(clearTimeout);DuckTransitions.cancel();});
})();
