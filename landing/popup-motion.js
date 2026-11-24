(() => {
  'use strict';
  const running = new Map();
  const ease = window.DuckMotion?.easing || 'cubic-bezier(.22,.8,.24,1)';
  function capture(source) {
    const element = source instanceof Element ? source : null;
    const capturedAt=window.location?.search.includes('motionAudit=1')?performance.now():null;
    const rect = element?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    const style=getComputedStyle(element);
    return {element,capturedAt,visual:sourceVisual(element),label:element.textContent?.trim().replace(/\s+/g,' ')||'',rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},material:{
      tint:(!style.backgroundColor || style.backgroundColor==='transparent' || style.backgroundColor==='rgba(0, 0, 0, 0)') ? 'rgba(255,255,255,.7)' : style.backgroundColor,sheen:style.backgroundImage || 'none',
      radius:Math.max(0,Math.min(rect.height/2,parseFloat(style.borderTopLeftRadius||style.borderRadius)||0)),
      border:style.border || '1px solid rgba(255,255,255,.9)',shadow:style.boxShadow || 'none',
      color:style.color || '#2b210d',fontSize:style.fontSize || '14px',fontWeight:style.fontWeight || '700'
    }};
  }
  // Freeze only the small launcher, before editor setup can rerender it. The copy
  // is inert paint: no IDs, handlers, focus targets or duplicate form controls.
  const sourcePaintProperties=('display position left top right bottom width height min-width min-height max-width max-height box-sizing margin padding gap row-gap column-gap grid-template-columns grid-template-rows grid-column grid-row align-items align-self justify-content justify-self flex flex-direction flex-wrap order font-family font-size font-weight font-style line-height letter-spacing text-align text-decoration text-transform text-overflow white-space overflow overflow-wrap word-break color background border border-radius box-shadow opacity visibility fill stroke stroke-width stroke-linecap stroke-linejoin').split(' ');
  function sourceVisual(element) {
    if (!element?.cloneNode || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    const originals=[element,...element.querySelectorAll('*')];
    if (originals.length>80 || originals.some(node=>node.matches('input,textarea,select,iframe,canvas,video'))) return null;
    const copy=element.cloneNode(true),copies=[copy,...copy.querySelectorAll('*')];
    originals.forEach((node,index)=>{
      const target=copies[index],style=getComputedStyle(node);
      for (const property of sourcePaintProperties) target.style.setProperty(property,style.getPropertyValue(property));
      for (const attribute of [...target.attributes]) if (/^(id|name|for|form|autofocus|tabindex|href|on.*)$/i.test(attribute.name)) target.removeAttribute(attribute.name);
      Object.assign(target.style,{animation:'none',transition:'none',transform:'none',pointerEvents:'none',backdropFilter:'none',webkitBackdropFilter:'none'});
      target.setAttribute('tabindex','-1');
    });
    copy.querySelectorAll('script,style').forEach(node=>node.remove());
    Object.assign(copy.style,{margin:'0',position:'relative',left:'auto',top:'auto',right:'auto',bottom:'auto',width:'100%',height:'100%',boxSizing:'border-box',visibility:'visible'});
    copy.inert=true;copy.setAttribute('aria-hidden','true');
    return copy;
  }
  function mark(anchor, name) {
    if(anchor?.capturedAt!=null)(anchor.phases||(anchor.phases={}))[name]=Number((performance.now()-anchor.capturedAt).toFixed(2));
  }
  function anchorRect(anchor) {
    const r = anchor?.element?.isConnected && anchor.element.getClientRects().length ? anchor.element.getBoundingClientRect() : null;
    return r?.width && r?.height ? r : anchor?.rect;
  }
  function transform(box, source) {
    if (!source || !box.width || !box.height) return 'translateY(8px) scale(.97)';
    const x=source.left+source.width/2-box.left-box.width/2;
    const y=source.top+source.height/2-box.top-box.height/2;
    const sx=Math.max(.035,Math.min(.9,source.width/box.width));
    const sy=Math.max(.035,Math.min(.9,source.height/box.height));
    return `translate(${x}px, ${y}px) scale(${sx}, ${sy})`;
  }
  function cancel(element) {
    const current=running.get(element);
    if(current){running.delete(element);current.animation?.cancel();current.cleanup?.();delete element.dataset?.popupMotion;}
  }
  // Opt-in local diagnostics; never sample or change rendering on the normal page.
  function auditMotion(opening, anchor) {
    if(!window.location?.search.includes('motionAudit=1'))return {ready(){},finish(){}};
    const start=performance.now(),contact=opening&&anchor?.capturedAt!=null?anchor.capturedAt:start;
    const gaps=[],slowFrames=[],entries=[],observers=[],supported=typeof PerformanceObserver==='function'?(PerformanceObserver.supportedEntryTypes||[]):[];
    const round=value=>Number(value.toFixed(2));
    let last=start,frame=0,finished=false,setupMs=0;
    const sample=now=>{const gap=now-last;gaps.push(gap);if(gap>25)slowFrames.push({atMs:round(now-start),gapMs:round(gap)});last=now;frame=requestAnimationFrame(sample);};
    for(const type of ['longtask','long-animation-frame'])if(supported.includes(type)){
      const observer=new PerformanceObserver(list=>entries.push(...list.getEntries()));
      observer.observe({type,buffered:true});observers.push(observer);
    }
    // Explicit diagnostic comparison only, with identical geometry and timing.
    const noBlur=window.location.search.includes('motionNoBlur=1'),lightGlass=window.location.search.includes('motionLightGlass=1');
    if((noBlur||lightGlass)&&!document.querySelector('#motion-audit-no-blur')){
      const style=document.createElement('style');style.id='motion-audit-no-blur';
      style.textContent=noBlur?'.task-modal::backdrop,.task-modal form,.task-modal .glass-button{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}':'.task-modal::backdrop,.task-modal .glass-button{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}.task-modal form{-webkit-backdrop-filter:blur(20px) saturate(150%)!important;backdrop-filter:blur(20px) saturate(150%)!important}';document.head.append(style);
    }
    const readiness={document:document.readyState,fonts:document.fonts?.status||'unavailable',pageAgeMs:round(start)};
    frame=requestAnimationFrame(sample);
    return {ready(){setupMs=performance.now()-contact;},finish(result='complete'){
      if(finished)return;finished=true;cancelAnimationFrame(frame);
      const end=performance.now();for(const observer of observers){entries.push(...observer.takeRecords());observer.disconnect();}
      const longWork=entries.filter(e=>e.startTime<end&&e.startTime+e.duration>=contact).map(e=>({type:e.entryType,durationMs:round(e.duration),attribution:Array.from(e.attribution||[]).map(x=>({name:x.name,container:x.containerType})),renderMs:e.renderStart?round(e.startTime+e.duration-e.renderStart):null,scripts:Array.from(e.scripts||[]).map(x=>({source:x.sourceURL?.split('/').pop(),function:x.sourceFunctionName,durationMs:round(x.duration),forcedLayoutMs:round(x.forcedStyleAndLayoutDuration||0)}))}));
      const resources=performance.getEntriesByType('resource').filter(e=>e.responseEnd>=contact&&e.startTime<=end).map(e=>({name:e.name.split('/').pop(),durationMs:round(e.duration)}));
      const sorted=gaps.slice().sort((a,b)=>a-b),q=p=>round(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]||0);
      let output=document.querySelector('#motion-audit');
      if(!output){output=document.createElement('output');output.id='motion-audit';output.hidden=true;output.setAttribute('aria-hidden','true');output.style.cssText='position:fixed;bottom:8px;left:8px;z-index:100;font:10px monospace;white-space:pre-wrap;background:#fffef4;color:#292210;padding:8px;max-width:95vw;max-height:25vh;overflow:hidden;pointer-events:none';document.body.append(output);}
      const line=JSON.stringify({phase:opening?'open':'close',result,noBlur,lightGlass,readiness,phases:opening?anchor?.phases:null,setupMs:round(setupMs),completionTailMs:round(end-last),wallMs:round(end-contact),samples:gaps.length,medianMs:q(.5),p95Ms:q(.95),maxMs:q(1),over25ms:slowFrames.length,slowFrames,supported,longWork,resources});
      output.textContent=(output.textContent+'\n'+line).trim().split('\n').slice(-24).join('\n');
    }};
  }
  const known = new Set(), prepared = new WeakMap(), used = new WeakMap(), nodes = new WeakMap(), jobs = new Map();
  const viewportKey = () => `${window.innerWidth}:${window.innerHeight}:${window.devicePixelRatio || 1}`;
  const boundsProperties = ['left','top','right','bottom','width','height','margin'];
  function removeJob(element) {
    const job=jobs.get(element);if(!job)return;
    if(job.idle)window.cancelIdleCallback?.(job.id);else clearTimeout(job.id);
    jobs.delete(element);
  }
  // Slice the surface into corners, edge bands and a center. Corner transforms
  // stay uniform, so a short pill cannot squash a tall panel's curves into squares.
  function sliceGeometry(box, target, targetRadius) {
    const r=Math.max(.001,Math.min(box.radius||24,box.width/2,box.height/2));
    const endR=Math.max(0,Math.min(targetRadius,target.width/2,target.height/2));
    const columns=[0,r,box.width-r],rows=[0,r,box.height-r];
    const widths=[r,Math.max(.001,box.width-2*r),r],heights=[r,Math.max(.001,box.height-2*r),r];
    const xs=[target.left-box.left,target.left-box.left+endR,target.left-box.left+target.width-endR];
    const ys=[target.top-box.top,target.top-box.top+endR,target.top-box.top+target.height-endR];
    const endWidths=[endR,Math.max(0,target.width-2*endR),endR],endHeights=[endR,Math.max(0,target.height-2*endR),endR];
    return rows.flatMap((y,row)=>columns.map((x,column)=>{
      const base={x,y,width:widths[column],height:heights[row]};
      const end={x:xs[column],y:ys[row],width:endWidths[column],height:endHeights[row]};
      return {base,end,radius:r,corner:row!==1&&column!==1,
        small:{transform:`translate(${end.x-x}px, ${end.y-y}px) scale(${end.width/base.width}, ${end.height/base.height})`},
        full:{transform:'translate(0px, 0px) scale(1, 1)'}};
    }));
  }
  function layers(element) {
    if(nodes.has(element))return nodes.get(element);
    const surface=document.createElement('div'),source=document.createElement('div'),label=document.createElement('div');
    surface.className='popup-morph-surface';source.className='popup-morph-source';label.className='popup-morph-label';
    for(const layer of [surface,source,label]){
      layer.setAttribute('aria-hidden','true');
      Object.assign(layer.style,{position:'fixed',margin:'0',pointerEvents:'none',boxSizing:'border-box',transformOrigin:'0 0'});
    }
    const tiles=Array.from({length:9},()=>{
      const tile=document.createElement('div'),paint=document.createElement('div');
      tile.className='popup-morph-tile';paint.className='popup-morph-paint';
      Object.assign(tile.style,{position:'absolute',overflow:'hidden',transformOrigin:'0 0',willChange:'transform'});
      Object.assign(paint.style,{position:'absolute',boxSizing:'border-box',pointerEvents:'none'});
      tile.append(paint);surface.append(tile);return {tile,paint};
    });
    const result={surface,source,label,tiles};nodes.set(element,result);return result;
  }
  // Warm the actual closed form without opening a dialog, stealing focus or painting it.
  function prepare(element) {
    known.add(element);removeJob(element);
    if(element.open || running.size || document.hidden)return false;
    const form=element.querySelector('form'),heading=element.querySelector('#modal-title');
    if(!form||!heading)return false;
    element.dataset.popupPreparing='true';
    try {
      form.scrollTop=0;
      const box=form.getBoundingClientRect(),title=heading.getBoundingClientRect(),style=getComputedStyle(heading);
      if(!box.width||!box.height)return false;
      prepared.set(element,{key:viewportKey(),width:box.width,height:box.height,radius:parseFloat(getComputedStyle(form).borderRadius)||24,
        titleX:title.left-box.left,titleY:title.top-box.top,titleFont:style.fontSize,titleWeight:style.fontWeight,titleLineHeight:style.lineHeight,titleFamily:style.fontFamily,titleSpacing:style.letterSpacing});
      layers(element);return true;
    } finally {delete element.dataset.popupPreparing;}
  }
  function schedulePrepare(element) {
    known.add(element);removeJob(element);
    if(element.open || document.hidden)return;
    const work=deadline=>{
      jobs.delete(element);
      if(element.open || running.size || document.hidden)return;
      if(deadline&&!deadline.didTimeout&&deadline.timeRemaining()<8){schedulePrepare(element);return;}
      prepare(element);
    };
    if(typeof window.requestIdleCallback==='function')jobs.set(element,{idle:true,id:window.requestIdleCallback(work,{timeout:1500})});
    else jobs.set(element,{idle:false,id:setTimeout(work,200)});
  }
  function geometry(element) {
    const key=viewportKey(),cached=prepared.get(element);
    // An early click never synchronously lays out the full form. Reserve a bounded
    // fallback frame; its content scrolls inside it rather than resizing the shell.
    const width=Math.max(1,Math.min(Number(element.dataset.popupWidth)||680,(window.innerWidth||1000)-28));
    const height=Math.max(1,Math.min(Number(element.dataset.popupHeight)||((window.innerWidth||1000)<=700?860:680),(window.innerHeight||800)-32));
    const shape=cached?.key===key?cached:{key,width,height,radius:Number(element.dataset.popupRadius)||24,titleX:20,titleY:24,titleFont:'14px',titleWeight:'550'};
    return {...shape,left:Math.max(0,((window.innerWidth||1000)-shape.width)/2),top:Math.max(0,((window.innerHeight||800)-shape.height)/2),prepared:cached?.key===key};
  }
  function reserve(element,box) {
    if(!used.has(element))used.set(element,{original:Object.fromEntries(boundsProperties.map(name=>[name,element.style[name]||'']))});
    used.get(element).box=box;
    Object.assign(element.style,{left:`${box.left}px`,top:`${box.top}px`,right:'auto',bottom:'auto',width:`${box.width}px`,height:`${box.height}px`,margin:'0'});
    element.dataset.popupStaged='true';element.dataset.popupPrepared=String(box.prepared);
  }
  function reset(element) {
    cancel(element);removeJob(element);
    const saved=used.get(element);if(saved)Object.assign(element.style,saved.original);used.delete(element);
    delete element.dataset.popupStage;delete element.dataset.popupStaged;delete element.dataset.popupPrepared;
    element.removeAttribute('aria-busy');schedulePrepare(element);
  }
  function morph(element, anchor, opening, done) {
    removeJob(element);
    const editor=element.matches('.task-modal');
    if(editor)known.add(element);
    const audit=auditMotion(opening,anchor),form=element.querySelector(editor?'form':'.calendar-preview-card'),heading=element.querySelector(editor?'#modal-title':'#calendar-preview-title');
    const previous=running.get(element),oldLayers=previous?.layers;
    // Only reversal reads live animation state; the normal opening uses idle geometry.
    const interrupted=oldLayers?{
      slices:oldLayers.tiles.map(part=>getComputedStyle(part.tile).transform),source:getComputedStyle(oldLayers.source).transform,
      surfaceOpacity:getComputedStyle(oldLayers.surface).opacity,sourceOpacity:getComputedStyle(oldLayers.source).opacity,
      label:getComputedStyle(oldLayers.label).transform,labelOpacity:getComputedStyle(oldLayers.label).opacity,
      content:getComputedStyle(form).opacity,box:previous.box
    }:null;
    cancel(element);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches || !element.animate;
    if(reduced){
      form.inert=false;form.removeAttribute('aria-hidden');delete element.dataset.popupStage;element.removeAttribute('aria-busy');
      if(opening&&!element.open)element.showModal();audit.finish('reduced');done();return;
    }
    let previewBox;
    if(!editor){
      const rect=element.getBoundingClientRect(),title=heading.getBoundingClientRect();
      previewBox={left:rect.left,top:rect.top,width:rect.width,height:rect.height,radius:parseFloat(getComputedStyle(element).borderRadius)||20,titleX:title.left-rect.left,titleY:title.top-rect.top,prepared:true};
    }
    const box=interrupted?.box || (!opening&&used.get(element)?.box) || previewBox || geometry(element);
    const destinationStyle=getComputedStyle(editor?form:element);
    const destinationPaint=previous?.paint||{tint:destinationStyle.backgroundColor||'#fffdf7',sheen:destinationStyle.backgroundImage||'none',border:destinationStyle.border||'0'};
    reserve(element,box);
    const sourceBox=previous?.sourceBox||anchorRect(anchor)||{left:box.left+box.width/2-24,top:box.top+box.height/2-20,width:48,height:40};
    const material=anchor?.material||{tint:'rgba(255,255,255,.7)',sheen:'none',border:'1px solid rgba(255,255,255,.9)',shadow:'none',color:'#2b210d',radius:20,fontSize:'14px',fontWeight:'700'};
    const chrome=layers(element),{surface,source,label,tiles}=chrome;
    const slices=sliceGeometry(box,sourceBox,material.radius);
    const oldVisibility=anchor?.element?.style.visibility,oldOpacity=form.style.opacity;
    const oldHidden=form.getAttribute('aria-hidden'),oldInert=form.inert;
    element.dataset.popupMotion=opening?'opening':'closing';element.dataset.popupStage=opening?'morph':'content';
    if(opening){form.inert=true;form.setAttribute('aria-hidden','true');element.setAttribute('aria-busy','true');}
    Object.assign(surface.style,{zIndex:'0',left:`${box.left}px`,top:`${box.top}px`,width:`${box.width}px`,height:`${box.height}px`,background:'none',border:'0',boxShadow:'none',willChange:'opacity'});
    tiles.forEach(({tile,paint},index)=>{
      const {base,radius}=slices[index];
      Object.assign(tile.style,{left:`${base.x}px`,top:`${base.y}px`,width:`${base.width+(index%3<2?.5:0)}px`,height:`${base.height+(index<6?.5:0)}px`});
      // The destination surface uses its actual theme material. Tiny internal
      // overlaps avoid subpixel cracks; source material fades above it.
      Object.assign(paint.style,{left:`${-base.x}px`,top:`${-base.y}px`,width:`${box.width}px`,height:`${box.height}px`,borderRadius:`${radius}px`,backgroundColor:destinationPaint.tint,backgroundImage:destinationPaint.sheen,border:destinationPaint.border,boxShadow:'none'});
    });
    Object.assign(source.style,{zIndex:'1',left:`${sourceBox.left}px`,top:`${sourceBox.top}px`,width:`${sourceBox.width}px`,height:`${sourceBox.height}px`,borderRadius:`${material.radius}px`,backgroundColor:material.tint,backgroundImage:material.sheen,border:material.border,boxShadow:material.shadow,willChange:'transform, opacity'});
    label.textContent='';
    if(anchor?.visual)label.append(anchor.visual.cloneNode(true));else label.textContent=anchor?.label||heading.textContent;
    Object.assign(label.style,{zIndex:'2',left:'0px',top:'0px',width:`${sourceBox.width}px`,height:`${sourceBox.height}px`,overflow:'hidden',borderRadius:`${material.radius}px`,whiteSpace:'normal',fontWeight:material.fontWeight,fontSize:material.fontSize,lineHeight:box.titleLineHeight||'normal',fontFamily:box.titleFamily||'inherit',letterSpacing:box.titleSpacing||'normal',color:material.color,willChange:'transform, opacity'});
    element.append(surface,source,label);
    if(anchor?.element?.isConnected)anchor.element.style.visibility='hidden';
    if(opening&&!element.open)element.showModal();
    if(opening)element.focus({preventScroll:true});
    const full={transform:'translate(0px, 0px) scale(1, 1)'};
    const sourceFull={transform:`translate(${box.left-sourceBox.left}px, ${box.top-sourceBox.top}px) scale(${box.width/sourceBox.width}, ${box.height/sourceBox.height})`};
    const labelSmall={transform:`translate(${sourceBox.left}px, ${sourceBox.top}px) scale(1)`};
    const labelFull={transform:`translate(${box.left+box.titleX}px, ${box.top+box.titleY}px) scale(1)`};
    const openTime=window.DuckMotion?.duration.popupOpen||240,closeTime=window.DuckMotion?.duration.popupClose||300;
    const outTime=window.DuckMotion?.duration.popupContentOut||60;
    const active=[];
    const play=(target,frames,duration,easing=ease)=>{const animation=target.animate(frames,{duration,easing,fill:'both'});animation.finished.catch(()=>{});active.push(animation);return animation;};
    const entry={animation:null,layers:chrome,box,sourceBox,paint:destinationPaint,stage:'morph',cleanup:null,finish:null};
    entry.cleanup=()=>{
      audit.finish('cancelled');active.forEach(a=>a.cancel());[surface,source,label].forEach(layer=>layer.remove());
      form.style.opacity=oldOpacity;form.inert=oldInert;
      if(oldHidden==null)form.removeAttribute('aria-hidden');else form.setAttribute('aria-hidden',oldHidden);
      if(anchor?.element?.isConnected)anchor.element.style.visibility=oldVisibility||'';
      delete element.dataset.popupStage;element.removeAttribute('aria-busy');
      // Dynamic previews return to native responsive sizing as soon as motion
      // ends (or reverses); only the reusable editor keeps its prepared frame.
      if(!editor){
        const saved=used.get(element);if(saved)Object.assign(element.style,saved.original);used.delete(element);
        delete element.dataset.popupStaged;delete element.dataset.popupPrepared;
      }
    };
    entry.finish=()=>{
      if(running.get(element)!==entry)return;running.delete(element);audit.finish();entry.cleanup();delete element.dataset.popupMotion;
      form.inert=false;form.removeAttribute('aria-hidden');done();
    };
    running.set(element,entry);
    const follow=(animation,next)=>{entry.animation=animation;animation.finished.then(()=>{if(running.get(element)===entry)next();},()=>{});};
    const move=duration=>{
      entry.stage='morph';element.dataset.popupStage='morph';
      form.inert=true;form.setAttribute('aria-hidden','true');
      const main=play(surface,[{transform:'none'},{transform:'none'}],duration);
      // One endpoint pair per layer, traversed in the opposite direction on close.
      // A separate center/size curve can make the top edge dip then rise.
      const travel=(target,small,large,live)=>play(target,[
        interrupted?{transform:live}:(opening?small:large),opening?large:small
      ],duration);
      tiles.forEach(({tile},index)=>travel(tile,slices[index].small,slices[index].full,interrupted?.slices[index]));
      travel(source,full,sourceFull,interrupted?.source);
      // The sliced shell remains round; the source paint resolves only near the end.
      // All live geometry still uses transforms, without per-frame layout/radius changes.
      play(surface,opening?[{opacity:interrupted?.surfaceOpacity??0},{opacity:1,offset:.3},{opacity:1}]:[{opacity:interrupted?.surfaceOpacity??1},{opacity:1,offset:.7},{opacity:0}],duration,'linear');
      play(source,opening?[{opacity:interrupted?.sourceOpacity??1},{opacity:0,offset:.3},{opacity:0}]:[{opacity:interrupted?.sourceOpacity??0},{opacity:0,offset:.7},{opacity:1}],duration,'linear');
      travel(label,labelSmall,labelFull,interrupted?.label);
      // Keep the source design at takeoff, then crossfade the two identities while
      // the shell is still growing. Native fields stay at their final, crisp size.
      play(label,opening?[
        {opacity:interrupted?.labelOpacity??1},{opacity:interrupted?.labelOpacity??1,offset:.2},{opacity:0,offset:.68},{opacity:0}
      ]:[{opacity:interrupted?.labelOpacity??0},{opacity:0,offset:.48},{opacity:1}],duration,'linear');
      play(form,opening?[
        {opacity:interrupted?.content??0},{opacity:interrupted?.content??0,offset:.52},{opacity:1,offset:.96},{opacity:1}
      ]:[{opacity:interrupted?.content??0},{opacity:0,offset:.2},{opacity:0}],duration,'linear');
      follow(main,entry.finish);
    };
    if(opening)move(openTime);
    else if(interrupted)move(closeTime);
    else {
      entry.stage='content';
      // Resolve content at fixed bounds first, then return only the lightweight shell.
      play(surface,[{...full,opacity:1},{...full,opacity:1}],outTime,'linear');
      play(source,[{...sourceFull,opacity:0},{...sourceFull,opacity:0}],outTime,'linear');
      play(label,[{...labelFull,opacity:0},{...labelFull,opacity:0}],outTime,'linear');
      follow(play(form,[{opacity:interrupted?.content||1},{opacity:0}],outTime,'linear'),()=>move(Math.max(1,closeTime-outTime)));
    }
    audit.ready();
  }
  function animate(element, anchor, opening, done=()=>{}) {
    if ((element.matches?.('.task-modal') && element.querySelector('form')) || (element.matches?.('.calendar-task-preview') && element.querySelector('.calendar-preview-card'))) return morph(element,anchor,opening,done);
    // Sample an interrupted transform before cancelling, so reversing doesn't jump.
    const previous=running.has(element) ? {transform:getComputedStyle(element).transform,opacity:getComputedStyle(element).opacity} : null;
    cancel(element);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !element.animate) { done(); return; }
    const end=transform(element.getBoundingClientRect(),anchorRect(anchor));
    const full={transform:'translate(0px, 0px) scale(1, 1)',opacity:1};
    const small={transform:end,opacity:0};
    if(element.dataset)element.dataset.popupMotion=opening?'opening':'closing';
    const animation=element.animate([previous || (opening?small:full),opening?full:small],{
      duration:opening?(window.DuckMotion?.duration.popupOpen || 240):(window.DuckMotion?.duration.popupClose || 220),easing:ease,fill:'both',composite:'replace'
    });
    const entry={animation,finish:null};
    entry.finish=()=>{if(running.get(element)!==entry)return;running.delete(element);try{done();}finally{animation.cancel();delete element.dataset?.popupMotion;}};
    running.set(element,entry);
    animation.finished.then(entry.finish,()=>{});
  }
  // Complete pending operations on viewport changes; never leave a dialog inert.
  function finishAll(){for(const entry of [...running.values()])entry.finish();}
  function resized(){
    finishAll();
    for(const element of known){
      prepared.delete(element);const saved=used.get(element);if(saved)Object.assign(element.style,saved.original);used.delete(element);
      delete element.dataset.popupStaged;
      if(element.open){
        // Temporarily restore native responsive sizing before measuring. Leaving
        // percentage form heights on an auto-height dialog can overflow it.
        const form=element.querySelector('form'),heading=element.querySelector('#modal-title');
        const box=form.getBoundingClientRect(),title=heading.getBoundingClientRect(),font=getComputedStyle(heading);
        reserve(element,{left:box.left,top:box.top,width:box.width,height:box.height,radius:parseFloat(getComputedStyle(form).borderRadius)||24,titleX:title.left-box.left,titleY:title.top-box.top,titleFont:font.fontSize,titleWeight:font.fontWeight,titleLineHeight:font.lineHeight,titleFamily:font.fontFamily,titleSpacing:font.letterSpacing,prepared:false});
      }else schedulePrepare(element);
    }
  }
  if(typeof window.addEventListener==='function'){
    window.addEventListener('resize',resized);
    window.addEventListener('pagehide',()=>{finishAll();for(const element of jobs.keys())removeJob(element);});
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',finishAll);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){finishAll();for(const element of jobs.keys())removeJob(element);}else for(const element of known)if(!element.open)schedulePrepare(element);});
  }
  window.DuckPopupMotion={capture,mark,prepare,schedulePrepare,reset,open:(el,anchor,done)=>animate(el,anchor,true,done),close:(el,anchor,done)=>animate(el,anchor,false,done),cancel,__testing:{transform,sliceGeometry}};
})();
