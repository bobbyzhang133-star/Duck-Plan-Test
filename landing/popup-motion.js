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
  function morph(element, anchor, opening, done) {
    const form=element.querySelector('form'), heading=element.querySelector('#modal-title');
    const previous=running.get(element);
    const interrupted=previous?.surface?.getBoundingClientRect();
    const labelBox=previous?.label?.getBoundingClientRect();
    const interruptedRadius=previous?.surface ? getComputedStyle(previous.surface).borderRadius : null;
    const interruptedFont=previous?.label ? getComputedStyle(previous.label).fontSize : null;
    const contentOpacity=previous ? getComputedStyle(form).opacity : (opening?'0':'1');
    cancel(element);
    if(matchMedia('(prefers-reduced-motion: reduce)').matches || !element.animate){done();return;}
    const source=anchorRect(anchor), destination=form.getBoundingClientRect(), title=heading.getBoundingClientRect();
    const material=anchor.material, finalStyle=getComputedStyle(form);
    const surface=document.createElement('div'), label=document.createElement('div');
    surface.className='popup-morph-surface';surface.setAttribute('aria-hidden','true');
    label.className='popup-morph-label';label.textContent=heading.textContent;
    Object.assign(surface.style,{position:'fixed',margin:'0',pointerEvents:'none',zIndex:'0',boxSizing:'border-box',overflow:'hidden',backgroundColor:material.tint,backgroundImage:material.sheen,border:material.border,color:material.color,backdropFilter:'blur(18px) saturate(135%)'});
    Object.assign(label.style,{position:'absolute',whiteSpace:'nowrap',margin:'0',fontWeight:material.fontWeight});
    surface.append(label);element.append(surface);
    const originalOpacity=form.style.opacity, originalVisibility=anchor.element?.style.visibility;
    form.style.opacity=contentOpacity;
    if(anchor.element?.isConnected)anchor.element.style.visibility='hidden';
    element.dataset.popupMotion=opening?'opening':'closing';
    const rectFrame=r=>({left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`});
    const small={...rectFrame(source),borderRadius:`${material.radius}px`,boxShadow:material.shadow};
    const full={...rectFrame(destination),borderRadius:finalStyle.borderRadius,boxShadow:finalStyle.boxShadow};
    const start=interrupted ? {...rectFrame(interrupted),borderRadius:interruptedRadius} : (opening?small:full);
    const duration=opening?(window.DuckMotion?.duration.popupOpen||240):(window.DuckMotion?.duration.popupClose||300);
    const timing={duration,easing:ease,fill:'both'};
    const animation=surface.animate([start,opening?full:small],timing);
    const smallLabel={left:`${source.width/2}px`,top:`${source.height/2}px`,transform:'translate(-50%,-50%)',fontSize:material.fontSize};
    const fullLabel={left:`${title.left-destination.left}px`,top:`${title.top-destination.top}px`,transform:'translate(0,0)',fontSize:getComputedStyle(heading).fontSize};
    const currentLabel=labelBox&&interrupted ? {left:`${labelBox.left-interrupted.left}px`,top:`${labelBox.top-interrupted.top}px`,transform:'none',fontSize:interruptedFont} : null;
    const children=[label.animate([currentLabel||(opening?smallLabel:fullLabel),opening?fullLabel:smallLabel],timing),
      label.animate(opening?[{opacity:1,offset:0},{opacity:1,offset:.6},{opacity:0,offset:1}]:[{opacity:0,offset:0},{opacity:1,offset:.3},{opacity:1,offset:1}],{...timing,easing:'linear'}),
      form.animate(opening?[{opacity:contentOpacity,offset:0},{opacity:0,offset:.55},{opacity:1,offset:1}]:[{opacity:contentOpacity,offset:0},{opacity:0,offset:.3},{opacity:0,offset:1}],{...timing,easing:'linear'})];
    children.forEach(a=>a.finished.catch(()=>{}));
    const entry={animation,surface,label,cleanup:()=>{children.forEach(a=>a.cancel());surface.remove();form.style.opacity=originalOpacity;if(anchor.element?.isConnected)anchor.element.style.visibility=originalVisibility||'';},finish:null};
    entry.finish=()=>{if(running.get(element)!==entry)return;running.delete(element);try{done();}finally{animation.cancel();entry.cleanup();delete element.dataset.popupMotion;}};
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
