(() => {
  'use strict';
  const running = new Map();
  const ease = window.DuckMotion?.easing || 'cubic-bezier(.22,.8,.24,1)';
  function capture(source) {
    const capturedAt=window.location?.search.includes('motionAudit=1')?performance.now():null;
    const element = source instanceof Element ? source : null;
    const rect = element?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    const style=getComputedStyle(element);
    return {element,capturedAt,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},material:{
      tint:(!style.backgroundColor || style.backgroundColor==='transparent' || style.backgroundColor==='rgba(0, 0, 0, 0)') ? 'rgba(255,255,255,.7)' : style.backgroundColor,sheen:style.backgroundImage || 'none',
      radius:Math.min(rect.height/2,parseFloat(style.borderRadius)||rect.height/2),
      border:style.border || '1px solid rgba(255,255,255,.9)',shadow:style.boxShadow || 'none',
      color:style.color || '#2b210d',fontSize:style.fontSize || '14px',fontWeight:style.fontWeight || '700'
    }};
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
    if(current){running.delete(element);current.animation.cancel();current.cleanup?.();delete element.dataset?.popupMotion;}
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
  function morph(element, anchor, opening, done) {
    const audit=auditMotion(opening,anchor);
    const form=element.querySelector('form'), heading=element.querySelector('#modal-title');
    const previous=running.get(element);
    const interrupted=previous?.surface?.getBoundingClientRect();
    const labelBox=previous?.label?.getBoundingClientRect();
    const interruptedRadius=previous?.surface ? parseFloat(getComputedStyle(previous.surface).borderRadius)*interrupted.width/Math.max(1,parseFloat(previous.surface.style.width)) : null;
    const labelOpacity=previous?.label ? getComputedStyle(previous.label).opacity : (opening?1:0);
    const headingOpacity=previous ? getComputedStyle(heading).opacity : (opening?0:1);
    const contentOpacity=previous ? getComputedStyle(form).opacity : (opening?'0':'1');
    cancel(element);
    if(matchMedia('(prefers-reduced-motion: reduce)').matches || !element.animate){audit.finish('reduced');done();return;}
    const source=anchorRect(anchor), destination=form.getBoundingClientRect(), title=heading.getBoundingClientRect();
    const material=anchor.material, finalStyle=getComputedStyle(form),finalRadius=parseFloat(finalStyle.borderRadius)||24,titleFont=getComputedStyle(heading).fontSize;
    const surface=document.createElement('div'), label=document.createElement('div');
    surface.className='popup-morph-surface';surface.setAttribute('aria-hidden','true');
    label.className='popup-morph-label';label.textContent=heading.textContent;
    Object.assign(surface.style,{position:'fixed',margin:'0',pointerEvents:'none',zIndex:'0',boxSizing:'border-box',overflow:'hidden',backgroundColor:material.tint,backgroundImage:material.sheen,border:material.border,color:material.color,transformOrigin:'0 0',willChange:'transform'});
    Object.assign(label.style,{position:'fixed',whiteSpace:'nowrap',margin:'0',pointerEvents:'none',zIndex:'2',fontWeight:material.fontWeight,fontSize:titleFont,color:material.color,left:`${title.left}px`,top:`${title.top}px`,transformOrigin:'0 0',willChange:'transform, opacity'});
    label.setAttribute('aria-hidden','true');element.append(surface,label);
    const originalOpacity=form.style.opacity, originalVisibility=anchor.element?.style.visibility;
    form.style.opacity=contentOpacity;
    if(anchor.element?.isConnected)anchor.element.style.visibility='hidden';
    element.dataset.popupMotion=opening?'opening':'closing';
    // Lay out each layer once. Movement uses transforms; native form text never scales.
    Object.assign(surface.style,{left:`${destination.left}px`,top:`${destination.top}px`,width:`${destination.width}px`,height:`${destination.height}px`,boxShadow:material.shadow});
    const frameFor=(r,radius)=>{
      const sx=Math.max(.001,r.width/destination.width),sy=Math.max(.001,r.height/destination.height);
      return {transform:`translate(${r.left-destination.left}px, ${r.top-destination.top}px) scale(${sx}, ${sy})`,borderRadius:`${radius/sx}px / ${radius/sy}px`};
    };
    const small=frameFor(source,material.radius),full=frameFor(destination,finalRadius);
    const start=interrupted ? frameFor(interrupted,interruptedRadius||24) : (opening?small:full);
    const duration=opening?(window.DuckMotion?.duration.popupOpen||240):(window.DuckMotion?.duration.popupClose||300);
    const timing={duration,easing:ease,fill:'both'};
    const textBox=label.getBoundingClientRect(),fontScale=(parseFloat(material.fontSize)||14)/(parseFloat(titleFont)||21);
    const smallLabel={transform:`translate(${source.left+source.width/2-title.left-textBox.width*fontScale/2}px, ${source.top+source.height/2-title.top-textBox.height*fontScale/2}px) scale(${fontScale})`};
    const fullLabel={transform:'translate(0px, 0px) scale(1)'};
    const currentLabel=labelBox ? {transform:`translate(${labelBox.left-title.left}px, ${labelBox.top-title.top}px) scale(${labelBox.height/Math.max(1,textBox.height)})`} : null;
    // Finish measuring before starting any animation: no layout reads in motion setup below.
    const animation=surface.animate([start,opening?full:small],timing);
    const children=[label.animate([currentLabel||(opening?smallLabel:fullLabel),opening?fullLabel:smallLabel],timing),
      label.animate(opening?[{opacity:labelOpacity,offset:0},{opacity:1,offset:.45},{opacity:0,offset:.75},{opacity:0,offset:1}]:[{opacity:labelOpacity,offset:0},{opacity:1,offset:.3},{opacity:1,offset:1}],{...timing,easing:'linear'}),
      heading.animate(opening?[{opacity:headingOpacity,offset:0},{opacity:0,offset:.45},{opacity:1,offset:.75},{opacity:1,offset:1}]:[{opacity:headingOpacity,offset:0},{opacity:0,offset:.3},{opacity:0,offset:1}],{...timing,easing:'linear'}),
      form.animate(opening?[{opacity:contentOpacity,offset:0},{opacity:0,offset:.28},{opacity:1,offset:1}]:[{opacity:contentOpacity,offset:0},{opacity:0,offset:.3},{opacity:0,offset:1}],{...timing,easing:'linear'})];
    children.forEach(a=>a.finished.catch(()=>{}));
    const entry={animation,surface,label,cleanup:()=>{audit.finish('cancelled');children.forEach(a=>a.cancel());surface.remove();label.remove();form.style.opacity=originalOpacity;if(anchor.element?.isConnected)anchor.element.style.visibility=originalVisibility||'';},finish:null};
    entry.finish=()=>{if(running.get(element)!==entry)return;running.delete(element);audit.finish();animation.cancel();entry.cleanup();delete element.dataset.popupMotion;done();};
    audit.ready();running.set(element,entry);animation.finished.then(entry.finish,()=>{});
  }
  function animate(element, anchor, opening, done=()=>{}) {
    if(element.matches?.('.task-modal') && anchor?.material && element.querySelector('form'))return morph(element,anchor,opening,done);
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
  if(typeof window.addEventListener==='function'){
    window.addEventListener('resize',finishAll);
    window.addEventListener('pagehide',finishAll);
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',finishAll);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)finishAll();});
  }
  window.DuckPopupMotion={capture,mark,open:(el,anchor,done)=>animate(el,anchor,true,done),close:(el,anchor,done)=>animate(el,anchor,false,done),cancel,__testing:{transform}};
})();
