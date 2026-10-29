(() => {
  "use strict";
  // Capture surface structure only. Text and controls stay in the native DOM.
  function capture(root,bounds,selector="[data-formation-surface]") {
    const canvas=document.createElement("canvas");
    const scale=Math.min(devicePixelRatio||1,1.25,1536/Math.max(bounds.width,bounds.height));
    canvas.width=Math.max(1,Math.round(bounds.width*scale));canvas.height=Math.max(1,Math.round(bounds.height*scale));
    const ctx=canvas.getContext("2d");if(!ctx)throw Error("Formation surface canvas unavailable");
    ctx.scale(scale,scale);ctx.fillStyle="#fff";ctx.fillRect(0,0,bounds.width,bounds.height);
    const surfaces=[root,...root.querySelectorAll(selector)];
    const styles=new WeakMap(),rects=new WeakMap();
    const styleOf=node=>{if(!styles.has(node))styles.set(node,getComputedStyle(node));return styles.get(node);};
    const rectOf=node=>{if(!rects.has(node))rects.set(node,node.getBoundingClientRect());return rects.get(node);};
    for(const node of surfaces){
      const rect=rectOf(node),style=styleOf(node);
      if(!rect.width || !rect.height || style.visibility==="hidden" || style.display==="none" || rect.right<bounds.left || rect.left>bounds.left+bounds.width || rect.bottom<bounds.top || rect.top>bounds.top+bounds.height)continue;
      const x=rect.left-bounds.left,y=rect.top-bounds.top;
      const radius=Math.min(parseFloat(style.borderTopLeftRadius)||0,rect.width/2,rect.height/2);
      ctx.save();
      // Respect scrollports: offscreen calendar rows must not paint over headers.
      for(let parent=node.parentElement;parent && parent!==root.parentElement;parent=parent.parentElement){
        const ps=styleOf(parent),pr=rectOf(parent);
        if(/auto|scroll|hidden|clip/.test(`${ps.overflowX} ${ps.overflowY}`)){
          ctx.beginPath();ctx.rect(pr.left-bounds.left,pr.top-bounds.top,pr.width,pr.height);ctx.clip();
        }
        if(parent===root)break;
      }
      ctx.beginPath();ctx.roundRect(x,y,rect.width,rect.height,radius);ctx.clip();
      ctx.fillStyle=style.backgroundColor;ctx.fillRect(x,y,rect.width,rect.height);
      for(const [side,bx,by,bw,bh] of [["Top",x,y,rect.width,parseFloat(style.borderTopWidth)||0],
        ["Bottom",x,y+rect.height-(parseFloat(style.borderBottomWidth)||0),rect.width,parseFloat(style.borderBottomWidth)||0],
        ["Left",x,y,parseFloat(style.borderLeftWidth)||0,rect.height],
        ["Right",x+rect.width-(parseFloat(style.borderRightWidth)||0),y,parseFloat(style.borderRightWidth)||0,rect.height]]){
        ctx.fillStyle=style[`border${side}Color`];if(bw && bh)ctx.fillRect(bx,by,bw,bh);
      }
      if(node.classList?.contains("calendar-slot")){
        ctx.fillStyle=style.getPropertyValue("--line").trim()||"#ead9ad";ctx.fillRect(x,y+rect.height-1,rect.width,1);
      }
      ctx.restore();
    }
    return canvas;
  }
  window.DuckFormation={capture};
})();
