(() => {
  'use strict';
  const running = new Map();
  const ease = window.DuckMotion?.easing || 'cubic-bezier(.22,.8,.24,1)';
  function capture(source) {
    const element = source instanceof Element ? source : null;
    const rect = element?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    const style=getComputedStyle(element);
    return {element,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},material:{
      tint:(!style.backgroundColor || style.backgroundColor==='transparent' || style.backgroundColor==='rgba(0, 0, 0, 0)') ? 'rgba(255,255,255,.7)' : style.backgroundColor,sheen:style.backgroundImage || 'none',
      radius:Math.min(rect.height/2,parseFloat(style.borderRadius)||rect.height/2),
      border:style.border || '1px solid rgba(255,255,255,.9)',shadow:style.boxShadow || 'none',
      color:style.color || '#2b210d',fontSize:style.fontSize || '14px',fontWeight:style.fontWeight || '700'
    }};
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
  // Opt-in local audit only; normal planner has no sampling loop or debug output.
  function auditMotion(opening) {
    if(!window.location?.search.includes('motionAudit=1'))return {finish(){}};
    const start=performance.now(),gaps=[];let last=start,frame=0,finished=false;
    const sample=now=>{gaps.push(now-last);last=now;frame=requestAnimationFrame(sample);};
    frame=requestAnimationFrame(sample);
    return {finish(result='complete'){
      if(finished)return;finished=true;cancelAnimationFrame(frame);
      const sorted=gaps.slice().sort((a,b)=>a-b),q=p=>Number((sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]||0).toFixed(2));
      let output=document.querySelector('#motion-audit');
      if(!output){output=document.createElement('output');output.id='motion-audit';output.style.cssText='position:fixed;bottom:8px;left:8px;z-index:100;font:11px monospace;white-space:pre-wrap;background:#fffef4;color:#292210;padding:8px;max-width:95vw;pointer-events:none';document.body.append(output);}
      const line=JSON.stringify({phase:opening?'open':'close',result,wallMs:Number((performance.now()-start).toFixed(1)),samples:gaps.length,medianMs:q(.5),p95Ms:q(.95),maxMs:q(1),over25ms:gaps.filter(x=>x>25).length});
      output.textContent=(output.textContent+'\n'+line).trim().split('\n').slice(-8).join('\n');
    }};
  }
  function morph(element, anchor, opening, done) {
    const audit=auditMotion(opening);
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
    const material=anchor.material, finalStyle=getComputedStyle(form);
    const surface=document.createElement('div'), label=document.createElement('div');
    surface.className='popup-morph-surface';surface.setAttribute('aria-hidden','true');
    label.className='popup-morph-label';label.textContent=heading.textContent;
    Object.assign(surface.style,{position:'fixed',margin:'0',pointerEvents:'none',zIndex:'0',boxSizing:'border-box',overflow:'hidden',backgroundColor:material.tint,backgroundImage:material.sheen,border:material.border,color:material.color,transformOrigin:'0 0',willChange:'transform'});
    Object.assign(label.style,{position:'fixed',whiteSpace:'nowrap',margin:'0',pointerEvents:'none',zIndex:'2',fontWeight:material.fontWeight,fontSize:getComputedStyle(heading).fontSize,color:material.color,left:`${title.left}px`,top:`${title.top}px`,transformOrigin:'0 0',willChange:'transform, opacity'});
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
    const small=frameFor(source,material.radius),full=frameFor(destination,parseFloat(finalStyle.borderRadius)||24);
    const start=interrupted ? frameFor(interrupted,interruptedRadius||24) : (opening?small:full);
    const duration=opening?(window.DuckMotion?.duration.popupOpen||240):(window.DuckMotion?.duration.popupClose||300);
    const timing={duration,easing:ease,fill:'both'};
    const animation=surface.animate([start,opening?full:small],timing);
    const textBox=label.getBoundingClientRect(),fontScale=(parseFloat(material.fontSize)||14)/(parseFloat(getComputedStyle(heading).fontSize)||21);
    const smallLabel={transform:`translate(${source.left+source.width/2-title.left-textBox.width*fontScale/2}px, ${source.top+source.height/2-title.top-textBox.height*fontScale/2}px) scale(${fontScale})`};
    const fullLabel={transform:'translate(0px, 0px) scale(1)'};
    const currentLabel=labelBox ? {transform:`translate(${labelBox.left-title.left}px, ${labelBox.top-title.top}px) scale(${labelBox.height/Math.max(1,textBox.height)})`} : null;
    const children=[label.animate([currentLabel||(opening?smallLabel:fullLabel),opening?fullLabel:smallLabel],timing),
      label.animate(opening?[{opacity:labelOpacity,offset:0},{opacity:1,offset:.45},{opacity:0,offset:.75},{opacity:0,offset:1}]:[{opacity:labelOpacity,offset:0},{opacity:1,offset:.3},{opacity:1,offset:1}],{...timing,easing:'linear'}),
      heading.animate(opening?[{opacity:headingOpacity,offset:0},{opacity:0,offset:.45},{opacity:1,offset:.75},{opacity:1,offset:1}]:[{opacity:headingOpacity,offset:0},{opacity:0,offset:.3},{opacity:0,offset:1}],{...timing,easing:'linear'}),
      form.animate(opening?[{opacity:contentOpacity,offset:0},{opacity:0,offset:.28},{opacity:1,offset:1}]:[{opacity:contentOpacity,offset:0},{opacity:0,offset:.3},{opacity:0,offset:1}],{...timing,easing:'linear'})];
    children.forEach(a=>a.finished.catch(()=>{}));
    const entry={animation,surface,label,cleanup:()=>{audit.finish('cancelled');children.forEach(a=>a.cancel());surface.remove();label.remove();form.style.opacity=originalOpacity;if(anchor.element?.isConnected)anchor.element.style.visibility=originalVisibility||'';},finish:null};
    entry.finish=()=>{if(running.get(element)!==entry)return;running.delete(element);audit.finish();try{done();}finally{animation.cancel();entry.cleanup();delete element.dataset.popupMotion;}};
    running.set(element,entry);animation.finished.then(entry.finish,()=>{});
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
  window.DuckPopupMotion={capture,open:(el,anchor,done)=>animate(el,anchor,true,done),close:(el,anchor,done)=>animate(el,anchor,false,done),cancel,__testing:{transform}};
})();
