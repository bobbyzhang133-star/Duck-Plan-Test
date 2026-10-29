(() => {
  "use strict";
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const settings = { duration: 620, fold: 0.55, reducedMotion: false, effect: "sheet" };
  const metrics = { frames: 0, longFrames: 0, maxFrameMs: 0, durationMs: 0, layers: 0, snapshotMs: 0, snapshotBytes: 0, cancelled: 0 };
  let active = null;
  const morphs = new Map();
  let activation = null;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const ease = (t) => t*t*(3-2*t);
  const reduced = () => motion.matches || settings.reducedMotion;

  let activationSequence=0;
  const contacts=new WeakMap();
  function captureActivation(source,event={},previous=null) {
    event ||= {};
    const bounds=source?.getBoundingClientRect?.()||{left:0,top:0,width:0,height:0};
    const pointer=previous?.modality!=="keyboard" && (event.pointerType || event.type?.startsWith("pointer") || event.detail>0);
    const contact=previous?.modality!=="keyboard" && previous?.contact ? {...previous.contact} : pointer && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
      ? {x:event.clientX,y:event.clientY} : previous?.modality!=="keyboard" && previous?.contact
      ? {...previous.contact} : {x:bounds.left+bounds.width/2,y:bounds.top+bounds.height/2};
    return {id:previous?.id||++activationSequence,source,bounds:previous?.bounds||{left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height},
      contact,modality:pointer?(event.pointerType||"pointer"):(previous?.modality||(event.type==="keydown"||event.type==="click"?"keyboard":"programmatic")),
      contactAt:previous?.contactAt??performance.now(),timeline:{startedAt:performance.now(),duration:settings.duration}};
  }
  function mapActivation(record,rect) {
    // Physical contact remains in viewport coordinates. Only emergence is clipped.
    return {contact:{...record.contact},emergence:{x:clamp(record.contact.x-rect.left,0,rect.width),y:clamp(record.contact.y-rect.top,0,rect.height)},
      external:record.contact.x<rect.left || record.contact.x>rect.left+rect.width || record.contact.y<rect.top || record.contact.y>rect.top+rect.height};
  }
  function origin(source,event,rect) {
    const record=activation && activation.source===source ? activation : captureActivation(source,event);
    return mapActivation(record,rect).emergence;
  }

  function snapshot(root) {
    const copy = root.cloneNode(true);
    // Snapshot is a decorative, inert tree: no duplicate identifiers or focus stops.
    for (const node of [copy,...copy.querySelectorAll("*")]) {
      node.removeAttribute("id"); node.removeAttribute("autofocus");
      if (node.matches("button,a,input,select,textarea,[tabindex]")) node.tabIndex = -1;
    }
    const oldCanvases = root.querySelectorAll("canvas");
    copy.querySelectorAll("canvas").forEach((canvas,index)=> {
      const source = oldCanvases[index];
      if (!source) return;
      window.DuckFur?.get(source.parentElement)?.draw();
      canvas.width=source.width; canvas.height=source.height;
      try { canvas.getContext("2d").drawImage(source,0,0); } catch { canvas.style.visibility="hidden"; }
      metrics.snapshotBytes += canvas.width*canvas.height*4;
    });
    const originals=[root,...root.querySelectorAll("*")];
    [copy,...copy.querySelectorAll("*")].forEach((node,index)=> {
      // Scroll offsets are not copied by cloneNode.
      node.scrollTop=originals[index]?.scrollTop||0;
      node.scrollLeft=originals[index]?.scrollLeft||0;
    });
    copy.querySelectorAll("script,dialog,.material-transition-layer").forEach((node)=>node.remove());
    copy.inert=true; copy.setAttribute("aria-hidden","true");
    return copy;
  }

  function cancel(reason="interrupted") {
    if (!active) return;
    const current=active; active=null;
    cancelAnimationFrame(current.frame);
    if(current.sheet){metrics.sheetPeak=current.sheet.getStats();current.sheet.dispose();}
    current.layer.remove(); metrics.layers=0;
    metrics.cancelled++;metrics.lastCancellation=reason;
    current.complete?.({cancelled:true,reason});
  }

  function workspace({root=document.querySelector(".workspace"),source=activation?.source,event=activation?.event,update,complete,effect=settings.effect,sheetOptions={},holdProgress=null}={}) {
    let reusable=(effect==="sheet" || effect==="ribbon") && active?.sheet?.canRetarget && active.effect===effect ? active.sheet : null;
    if(reusable)active.sheet=null;
    cancel();
    if (!root || reduced() || document.hidden || !root.getClientRects().length) { reusable?.dispose(); update?.(); complete?.({cancelled:false}); return; }
    const rect=root.getBoundingClientRect();
    const drawer=document.querySelector(".sidebar-open .sidebar")?.getBoundingClientRect();
    const left=Math.max(0,rect.left,drawer?.right||0);
    const bounds={left,top:Math.max(0,rect.top),width:Math.max(0,Math.min(rect.right??rect.left+rect.width,innerWidth)-left),height:Math.min(rect.height,innerHeight-Math.max(0,rect.top))};
    if(!bounds.width || !bounds.height){reusable?.dispose();update?.();complete?.({cancelled:false});return;}
    const record=activation && activation.source===source ? activation : captureActivation(source,event);
    const mapped=mapActivation(record,bounds),point=mapped.emergence;
    metrics.activation={id:record.id,modality:record.modality,contact:record.contact,emergence:point,external:mapped.external};
    metrics.snapshotBytes=0;
    const started=performance.now();
    let copy;
    try{copy=snapshot(root);}catch(error){reusable?.dispose();update?.();complete?.({cancelled:false,fallback:true});return;}
    const layer=document.createElement("div");
    layer.className="material-transition-layer"; layer.inert=true; layer.setAttribute("aria-hidden","true");
    Object.assign(layer.style,{left:`${bounds.left}px`,top:`${bounds.top}px`,width:`${bounds.width}px`,height:`${bounds.height}px`});
    copy.style.cssText+=`;position:absolute!important;left:${rect.left-bounds.left}px!important;top:${rect.top-bounds.top}px!important;width:${rect.width}px!important;height:${rect.height}px!important;margin:0!important;max-width:none!important;`;
    // Retain the outgoing layout's body-dependent CSS while the real app changes.
    const wrapper=document.createElement("div"); wrapper.className="material-outgoing";
    wrapper.dataset.view=document.body.dataset.view||"";
    wrapper.append(copy); layer.append(wrapper);
    const curved=document.createElement("div"); curved.className="material-outgoing material-curved";
    curved.dataset.view=wrapper.dataset.view;
    const curvedCopy=(effect==="sheet" || effect==="ribbon") ? document.createElement("div") : snapshot(root); curvedCopy.style.cssText=copy.style.cssText;
    curved.append(curvedCopy); layer.append(curved);
    const fold=document.createElement("div"); fold.className="material-fold-band"; layer.append(fold);
    const snapshotElapsed=performance.now()-started;
    let sheet=null;
    const renderer=effect==="ribbon"?window.DuckFurRibbon:window.DuckFurSheet;
    if((effect === "sheet" || effect==="ribbon") && renderer) {
      try {
        const options={...settings,...sheetOptions,renderer:effect};
        if(reusable?.canRetarget(bounds.width,bounds.height,options)){
          sheet=reusable;reusable=null;sheet.retarget(layer,point,options);metrics.reusedSheets=(metrics.reusedSheets||0)+1;
        }else{
          reusable?.dispose();reusable=null;
          sheet=new renderer.FurSheet(layer,{width:bounds.width,height:bounds.height,origin:point,options,onFailure:()=>cancel("sheet-context-lost")});
        }
        curved.style.display="none";fold.style.display="none";
        metrics.sheetPeak=sheet.getStats();metrics.sheetFailure=null;
      }catch(error){reusable?.dispose();sheet?.dispose();sheet=null;metrics.sheetFailure=String(error.message);}
    }
    document.body.append(layer);
    metrics.snapshotMs=snapshotElapsed;
    metrics.totalInitializationMs=performance.now()-started;
    metrics.layers=1; metrics.frames=0; metrics.longFrames=0; metrics.maxFrameMs=0; metrics.durationMs=0;
    metrics.qualityReduced=Boolean(sheet?.qualityReduced);
    const focus=document.activeElement;
    try {
      update?.();
      if(sheet && sheetOptions.formation){
        if(!window.DuckFormation || !sheet.setDestination)throw Error("Formation capture unavailable");
        sheet.setDestination(window.DuckFormation.capture(root,bounds,sheetOptions.surfaceSelector));
      }
    } catch(error) { sheet?.dispose();layer.remove(); metrics.layers=0;if(sheetOptions.formation){metrics.sheetFailure=String(error.message);complete?.({cancelled:false,fallback:true});return;}throw error; }
    if((effect === "sheet" || effect==="ribbon") && !sheet){layer.remove();metrics.layers=0;complete?.({cancelled:false,fallback:true});return;}
    const reach=Math.max(...[[0,0],[bounds.width,0],[0,bounds.height],[bounds.width,bounds.height]].map(([x,y])=>Math.hypot(x-point.x,y-point.y)))+45;
    const job={layer,frame:0,complete,sheet,effect}; active=job;
    // Compilation/snapshot latency must not consume the physical animation.
    record.timeline.startedAt=performance.now();record.timeline.duration=settings.duration;
    record.timeline.progressAt=time=>{const held=typeof holdProgress === "function"?holdProgress():holdProgress;return held===null?clamp((time-record.timeline.startedAt)/record.timeline.duration,0,1):clamp(held,0,1);};
    record.timeline.radiusAt=time=>window.DuckFurSheet?.geometry(bounds.width,bounds.height,point,sheetOptions,record.timeline.progressAt(time)).radius||0;
    const surface=source && window.DuckFur?.get(source);
    if(surface && !surface.waves?.some(w=>w.activationId===record.id))surface.emitWave(mapActivation(record,source.getBoundingClientRect()).emergence,{timeline:record.timeline,activationId:record.id});
    let previous=null,lastProgress=null;
    const debug=sheetOptions.debug && document.createElementNS ? document.createElementNS("http://www.w3.org/2000/svg","svg"):null;
    if(debug){debug.setAttribute("viewBox",`0 0 ${bounds.width} ${bounds.height}`);debug.style.cssText="position:absolute;inset:0;width:100%;height:100%;z-index:5;pointer-events:none";layer.append(debug);}
    function diagnostics(model){
      if(!debug || effect!=="sheet")return;
      const paths=renderer.boundaries(model);
      const circle=(x,y,color,label,dy=-8)=>`<circle cx="${x}" cy="${y}" r="5" fill="${color}" stroke="white"/><text x="${x+8}" y="${Math.max(14,y+dy)}" fill="${color}" stroke="white" stroke-width=".4" font-size="12">${label}</text>`;
      debug.innerHTML=`<path d="${paths.growth}" fill="none" stroke="#2563eb" stroke-dasharray="5 3"/><path d="${paths.crest}" fill="none" stroke="#be185d"/><path d="${paths.reveal}" fill="none" stroke="#059669" stroke-dasharray="3 3"/><path d="${paths.flatten||""}" fill="none" stroke="#ea580c" stroke-dasharray="6 3"/>`+circle(record.contact.x-bounds.left,record.contact.y-bounds.top,"#dc2626","Contact")+circle(point.x,point.y,"#7c3aed",mapped.external?"Boundary emergence":"Seed",18);
    }
    function frame(time) {
      if(active!==job) return;
      const elapsed=time-record.timeline.startedAt;
      const interval=previous===null?0:time-previous; previous=time;
      metrics.frames++; metrics.maxFrameMs=Math.max(metrics.maxFrameMs,interval); if(interval>25) metrics.longFrames++;
      const held=typeof holdProgress === "function" ? holdProgress() : holdProgress;
      const progress=record.timeline.progressAt(time);
      if(sheet && progress!==lastProgress){
        try {
          const model=sheet.draw(progress);lastProgress=progress;
          if(!model){cancel("sheet-unavailable");return;}
          metrics.sheetPeak=sheet.getStats();
          wrapper.style.clipPath=sheetOptions.growthOnly?"none":renderer.revealPolygon(model);
          diagnostics(model);metrics.phase=model.phase;metrics.materialArea=model.coverageArea||0;metrics.progress=progress;metrics.formation=Boolean(sheetOptions.formation);metrics.settlement=model.settleProgress||0;metrics.formedRadius=sheetOptions.formation?renderer.revealRadius(model):0;
          if(held===null && interval>35 && metrics.longFrames>=2 && !job.reducedQuality){sheet.reduceQuality();sheet.draw(progress);job.reducedQuality=true;metrics.qualityReduced=true;}
        }catch(error){metrics.sheetFailure=String(error.message);cancel("sheet-render-error");return;}
      }else if(!sheet){
      const radius=ease(progress)*reach;
      const mask=`radial-gradient(circle at ${point.x}px ${point.y}px,transparent ${Math.max(0,radius-2)}px,#000 ${radius+1}px)`;
      wrapper.style.maskImage=mask; wrapper.style.webkitMaskImage=mask;
      const band=12+settings.fold*18;
      const curvedMask=`radial-gradient(circle at ${point.x}px ${point.y}px,transparent ${Math.max(0,radius-band)}px,#000 ${Math.max(0,radius-band+3)}px,#000 ${radius}px,transparent ${radius+3}px)`;
      curved.style.maskImage=curvedMask;curved.style.webkitMaskImage=curvedMask;
      curvedCopy.style.transformOrigin=`${point.x}px ${point.y}px`;
      curvedCopy.style.transform=`translateY(${-settings.fold*3}px) scale(${1+settings.fold*0.009})`;
      fold.style.background=`radial-gradient(circle at ${point.x}px ${point.y}px,transparent ${Math.max(0,radius-band)}px,rgba(103,76,23,${settings.fold*0.2}) ${Math.max(0,radius-7)}px,rgba(255,247,206,${settings.fold*0.85}) ${radius}px,rgba(255,255,255,${settings.fold*0.65}) ${radius+3}px,rgba(74,52,10,${settings.fold*0.16}) ${radius+9}px,transparent ${radius+band}px)`;
      fold.style.opacity=String(Math.min(1,progress*12,(1-progress)*12));
      // Restrained curvature confined to the moving band, never the sidebar.
      fold.style.filter=`blur(${settings.fold*0.7}px)`;
      }
      if(progress<1 || held!==null) job.frame=requestAnimationFrame(frame);
      else {
        if(sheet){metrics.sheetPeak=sheet.getStats();sheet.dispose();}
        metrics.durationMs=elapsed; layer.remove(); active=null; metrics.layers=0;
        if(focus && !focus.isConnected && !document.querySelector("dialog[open]")) {
          const heading=root.querySelector(".view.active h2,.view.active h1");
          if(heading) { heading.tabIndex=-1; heading.focus({preventScroll:true}); }
        }
        complete?.({cancelled:false});
      }
    }
    job.frame=requestAnimationFrame(frame);
  }

  function morph(host,label,parameters={}) {
    morphs.get(host)?.();
    const surface=window.DuckFur?.get(host);
    if(!surface) { host.textContent=label; return; }
    if(reduced()) { host.replaceChildren(surface.canvas,document.createTextNode(label)); surface.setParameters({...parameters,label}); return; }
    surface.draw();
    const canvas=document.createElement("canvas"); canvas.className="fur-morph-outgoing";
    canvas.width=surface.canvas.width; canvas.height=surface.canvas.height;
    canvas.getContext("2d").drawImage(surface.canvas,0,0);
    canvas.setAttribute("aria-hidden","true");
    const overscan=surface.overscan||0;
    canvas.style.cssText=`position:absolute;left:${-overscan}px;top:${-overscan}px;width:${surface.width+overscan*2}px;height:${surface.height+overscan*2}px;pointer-events:none;z-index:2;`;
    const savedOrigin=activation?.source===host ? origin(host,activation.event,host.getBoundingClientRect()):{x:surface.width/2,y:surface.height/2};
    host.textContent=label;
    // Restore the live renderer node removed by textContent; it owns the incoming strands.
    host.prepend(surface.canvas); surface.setParameters({...parameters,label}); host.append(canvas);
    surface.waves=[];surface.emitWave(savedOrigin);
    const started=performance.now(),reach=Math.hypot(surface.width,surface.height)+overscan*2;
    let handle;
    const cleanup=()=> { cancelAnimationFrame(handle); canvas.remove(); surface.canvas.style.maskImage="";surface.canvas.style.webkitMaskImage="";morphs.delete(host); };
    morphs.set(host,cleanup);
    function frame(time) {
      if(!host.isConnected) {cleanup();return;}
      const progress=clamp((time-started)/420,0,1),radius=ease(progress)*reach;
      const mask=`radial-gradient(circle at ${savedOrigin.x+overscan}px ${savedOrigin.y+overscan}px,transparent ${Math.max(0,radius-3)}px,#000 ${radius+2}px)`;
      canvas.style.maskImage=mask;canvas.style.webkitMaskImage=mask;
      const incoming=`radial-gradient(circle at ${savedOrigin.x+overscan}px ${savedOrigin.y+overscan}px,#000 ${Math.max(0,radius-2)}px,transparent ${radius+2}px)`;
      surface.canvas.style.maskImage=incoming;surface.canvas.style.webkitMaskImage=incoming;
      if(progress<1)handle=requestAnimationFrame(frame);else cleanup();
    }
    handle=requestAnimationFrame(frame);
  }

  document.addEventListener("pointerdown",event=>{
    const source=event.target.closest("button,a");if(!source || source.disabled)return;
    contacts.set(source,captureActivation(source,event));
  },true);
  document.addEventListener("keydown",event=>{
    if(!["Enter"," "].includes(event.key))return;const source=event.target.closest("button,a");
    if(source && !source.disabled)contacts.set(source,captureActivation(source,{type:"keydown"}));
  },true);
  document.addEventListener("pointercancel",event=>{const source=event.target.closest("button,a");if(source)contacts.delete(source);},true);
  document.addEventListener("click",event=> {
    const source=event.target.closest("button,a");
    if(!source || source.disabled) return;
    const previous=contacts.get(source);contacts.delete(source);
    activation=captureActivation(source,event,previous);
    const record=activation;queueMicrotask(()=>{if(activation===record)activation=null;});
  },true);
  const interrupt=()=>{cancel();for(const cleanup of [...morphs.values()])cleanup();};
  addEventListener("resize",interrupt);
  document.addEventListener("scroll",()=>cancel("scroll"),true);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)interrupt();});
  document.addEventListener("toggle",event=>{if(event.target.matches("dialog"))interrupt();},true);
  motion.addEventListener("change",interrupt);
  window.DuckTransitions={captureActivation,mapActivation,getActivation:source=>activation?.source===source?activation:null,workspace,morph,cancel:interrupt,settings,metrics,reduced,testSheetContextLoss(){active?.sheet?.gl?.getExtension("WEBGL_lose_context")?.loseContext();},configure(values){Object.assign(settings,values);if(reduced())interrupt();},getStats(){return {...metrics,morphs:morphs.size,fps:metrics.durationMs?Math.round(Math.max(0,metrics.frames-1)*1000/metrics.durationMs):0,contexts:window.DuckFur?.getRendererStats().contexts||0,sheetResources:Object.fromEntries(["contexts","buffers","programs","textures","framebuffers"].map(key=>[key,(window.DuckFurSheet?.resources?.[key]||0)+(window.DuckFurRibbon?.resources?.[key]||0)]))};}};
})();
