(() => {
  "use strict";
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const smooth=(x)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
  const defaults={growthSpeed:1,thickness:5,elevation:64,curvature:0.72,furDensity:1,fiberLength:5.5,sheetWidth:110,lighting:0.8};
  const pileCache=new Map(); // Bounded CPU-only tiles; never retain a GPU context.
  const resources={contexts:0,buffers:0,programs:0,textures:0,framebuffers:0};

  // The domain is fixed in material space: angle v in [-1,1], radius q in [-1,1].
  // Growth activates roots; it never stretches or redistributes existing roots.
  function geometry(width,height,origin,options={},progress=0) {
    const settings={...defaults,...options},p=clamp(progress,0,1);
    const reach=Math.max(...[[0,0],[width,0],[0,height],[width,height]].map(([x,y])=>Math.hypot(x-origin.x,y-origin.y)))+settings.sheetWidth+4;
    const radius=reach*Math.pow(smooth(Math.min(1,p/.88)),1/settings.growthSpeed);
    const band=Math.min(settings.sheetWidth,radius*.55);
    const amplitude=smooth(p/.18)*(1-smooth((p-.88)/.12));
    return {width,height,origin,settings,progress:p,reach,radius,band,amplitude,
      opacity:1-smooth((p-.92)/.08),coverageArea:Math.PI*radius*radius};
  }
  function profile(model,r) {
    const {settings:s,radius,band,amplitude}=model;
    const t=clamp((r-radius+band)/Math.max(.001,band),0,1);
    const crestHeight=Math.min(s.elevation,radius*.38)*amplitude;
    const curl=crestHeight*.6*s.curvature;
    const inCrest=r>=radius-band && r<=radius;
    const tuft=radius*.18*(1-smooth(model.progress/.18));
    const tuftShape=Math.max(0,1-r*r/Math.max(.001,radius*radius));
    return {u:r+(inCrest?curl*Math.sin(2*Math.PI*t):0),
      z:(inCrest?crestHeight*Math.sin(Math.PI*t)**2:0)+tuft*tuftShape*tuftShape};
  }
  function sample(model,v,q,layer=0) {
    const angle=v*Math.PI,r=(q+1)*.5*model.reach;
    const center=profile(model,r),delta=.05;
    const lo=profile(model,Math.max(0,r-delta)),hi=profile(model,r+delta);
    const du=hi.u-lo.u,dz=hi.z-lo.z,len=Math.hypot(du,dz)||1;
    const nx=Math.cos(angle),ny=Math.sin(angle),normal={x:-nx*dz/len,y:-ny*dz/len,z:du/len};
    return {x:model.origin.x+nx*center.u-normal.x*layer*model.settings.thickness* Math.min(1,model.radius/20),
      y:model.origin.y+ny*center.u-normal.y*layer*model.settings.thickness*Math.min(1,model.radius/20),
      z:center.z-normal.z*layer*model.settings.thickness*Math.min(1,model.radius/20),normal,r,visible:r<=model.radius && model.radius>0};
  }
  function project(model,p){const scale=1800/(1800-p.z);return {x:model.origin.x+(p.x-model.origin.x)*scale,y:model.origin.y+(p.y-model.origin.y)*scale-p.z*.65};}
  function contour(model,r,projected=false){return Array.from({length:129},(_,i)=>{
    const p=sample(model,i/64-1,2*r/model.reach-1);return projected?project(model,p):p;
  });}
  function revealRadius(model){return Math.max(0,model.radius-model.band);}
  function revealPolygon(model) {
    // An even-odd polygon cuts a hole behind the grounded inner foot of the roll.
    const ring=contour(model,revealRadius(model));
    const outer=[{x:0,y:0},{x:model.width,y:0},{x:model.width,y:model.height},{x:0,y:model.height},{x:0,y:0}];
    return `polygon(evenodd,${[...outer,...ring,ring[0],outer[0]].map(p=>`${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`).join(',')})`;
  }
  function boundaries(model){const path=points=>points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')+'Z';
    return {growth:path(contour(model,model.radius)),crest:path(contour(model,model.radius-model.band*.5,true)),reveal:path(contour(model,revealRadius(model)))};
  }
  const common=`
    precision highp float;
    uniform vec2 u_size,u_origin;
    uniform float u_progress,u_reach,u_radius,u_band,u_opacity,u_bodyFloor,u_amplitude;
    uniform float u_width,u_elevation,u_curvature,u_thickness,u_lighting,u_length;
    vec2 profile(float r){
      float t=clamp((r-u_radius+u_band)/max(0.001,u_band),0.0,1.0);
      float height=min(u_elevation,u_radius*0.38)*u_amplitude;
      float curl=height*0.6*u_curvature;
      float inside=step(u_radius-u_band,r)*step(r,u_radius);
      float tuft=u_radius*0.18*(1.0-smoothstep(0.0,0.18,u_progress));
      float shape=max(0.0,1.0-r*r/max(0.001,u_radius*u_radius));
      return vec2(r+inside*curl*sin(6.2831853*t),inside*height*pow(sin(3.14159265*t),2.0)+tuft*shape*shape);
    }
    vec3 positionAt(float v,float q,out vec3 normal,out vec3 tangent) {
      float r=(q+1.0)*0.5*u_reach;vec2 direction=vec2(cos(v*3.14159265),sin(v*3.14159265));
      vec2 center=profile(r),delta=profile(r+0.05)-profile(max(0.0,r-0.05));
      tangent=normalize(vec3(direction*delta.x,delta.y));
      normal=normalize(vec3(-direction*delta.y,delta.x));
      return vec3(u_origin+direction*center.x,center.y);
    }
    vec4 project(vec3 p) {
      float perspective=1800.0/(1800.0-p.z);
      vec2 pixel=(p.xy-u_origin)*perspective+u_origin;
      pixel.y-=p.z*0.65;vec2 clip=pixel/u_size*2.0-1.0;
      return vec4(clip.x,-clip.y,clamp(-p.z/400.0,-0.95,0.95),1.0);
    }
    float bodyVisibility(float r){
      // Settled inner fur remains present while sharp destination HTML shows through.
      float foot=max(0.0,u_radius-u_band);
      return mix(u_bodyFloor,1.0,smoothstep(max(0.0,foot-35.0),max(0.001,foot),r));
    }
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  `;
  const meshVertex=`#version 300 es
    ${common}
    layout(location=0) in vec3 a_param;
    uniform float u_shadow;
    out vec3 v_normal;out vec2 v_uv;out float v_layer,v_height,v_radius;
    void main(){
      vec3 normal,tangent;float v=a_param.x;
      float layer=mod(a_param.z,2.0);
      float q=a_param.z>=2.0 ? 2.0*u_radius/max(0.001,u_reach)-1.0 : a_param.y;
      vec3 p=positionAt(v,q,normal,tangent);
      p-=normal*layer*u_thickness;
      v_normal=normal*(1.0-2.0*layer);v_radius=(q+1.0)*0.5*u_reach;v_uv=vec2(cos(v*3.14159265),sin(v*3.14159265))*v_radius;
      v_layer=layer;v_height=p.z;
      if(a_param.z>=2.0)v_radius=max(0.0,u_radius-0.7);
      if(u_shadow>0.5){p.xy+=vec2(5.0,11.0)*u_amplitude;p.z=-2.0;}
      gl_Position=project(p);
    }
  `;
  const meshFragment=`#version 300 es
    ${common}
    uniform float u_shadow;
    uniform sampler2D u_pile;
    in vec3 v_normal;in vec2 v_uv;in float v_layer,v_height,v_radius;out vec4 color;
    void main(){
      if(v_radius>u_radius || u_radius<0.01 || u_opacity<0.001)discard;
      float edge=(1.0-smoothstep(max(0.0,u_radius-1.0),u_radius,v_radius))*u_opacity*bodyVisibility(v_radius);
      if(u_shadow>0.5){color=vec4(0.18,0.12,0.025,edge*u_amplitude*u_lighting*0.16);return;}
      vec3 n=normalize(v_normal);
      // The underlying pile is baked with the *button's* unmodified shaders.
      // UVs are material-space CSS pixels: growth does not enlarge the fibers.
      float light=0.82+0.18*clamp(dot(n,normalize(vec3(-0.3,-0.5,1.0)))/0.86387,0.0,1.0);
      vec4 texel=texture(u_pile,v_uv/64.0);
      // Match the button canvas' premultiplied-alpha composition over ivory.
      vec3 pile=min(vec3(1.0),texel.rgb+vec3(1.0,0.99,0.96)*(1.0-texel.a));
      vec3 base=pile*mix(1.0,0.87,smoothstep(0.25,0.75,v_layer));
      color=vec4(base*mix(1.0,light,u_lighting),edge);
    }
  `;
  const furVertex=`#version 300 es
    ${common}
    layout(location=0) in vec4 a_seed;
    out float v_height,v_side,v_light,v_seed,v_edge;
    void main(){
      vec2 corners[6]=vec2[6](vec2(-1,0),vec2(1,0),vec2(-1,1),vec2(-1,1),vec2(1,0),vec2(1,1));
      vec2 corner=corners[gl_VertexID];
      float v=a_seed.x,q=a_seed.y;
      vec3 normal,tangent;vec3 p=positionAt(v,q,normal,tangent);
      vec3 across=vec3(-sin(v*3.14159265),cos(v*3.14159265),0);
      float angle=a_seed.w*6.2831853;
      vec3 lean=normalize(tangent*cos(angle)+across*sin(angle));
      vec3 side=normalize(cross(normal,lean));
      float length=u_length*(0.78+a_seed.z*0.44);
      p+=(normal*0.5+lean*mix(0.28,0.38,a_seed.z))*length*corner.y;
      float rootWidth=mix(1.05,1.5,a_seed.z);
      p+=side*corner.x*mix(rootWidth,rootWidth*0.82,corner.y);
      gl_Position=project(p);
      v_height=corner.y;v_side=corner.x;v_seed=a_seed.z;
      v_light=(0.78+0.22*max(0.0,dot(normalize(vec3(cos(angle),sin(angle),0.7)),normalize(vec3(-0.35,-0.45,0.82)))))*(0.82+0.18*max(0.0,dot(normal,normalize(vec3(-0.3,-0.5,1.0)))));
      float r=(q+1.0)*0.5*u_reach;
      v_edge=step(r,u_radius)*step(0.01,u_radius)*u_opacity*bodyVisibility(r);
      if(v_edge<0.001)gl_Position=vec4(2.0,2.0,2.0,1.0);
    }
  `;
  const furFragment=`#version 300 es
    precision highp float;
    in float v_height,v_side,v_light,v_seed,v_edge;out vec4 color;
    void main(){
      vec3 root=mix(vec3(0.72,0.49,0.10),vec3(0.86,0.66,0.22),v_seed);
      vec3 middle=mix(vec3(0.98,0.84,0.46),vec3(1.0,0.92,0.65),v_seed);
      vec3 tip=mix(vec3(1.0,0.95,0.76),vec3(1.0,0.985,0.88),v_seed);
      vec3 fur=mix(root,middle,smoothstep(0.0,0.58,v_height));
      fur=mix(fur,tip,smoothstep(0.58,1.0,v_height));
      float tipGlow=1.0+smoothstep(0.76,1.0,v_height)*0.11;
      float alpha=(1.0-smoothstep(0.62,1.0,abs(v_side)))*(1.0-smoothstep(0.86,1.0,v_height)*0.24)*mix(0.82,0.94,v_height);
      color=vec4(fur*v_light*tipGlow,alpha*v_edge);
    }
  `;

  function meshData(columns,rows) {
    const vertices=[];
    const add=(a,b,c)=>{for(const p of [a,b,c])vertices.push(p[0],2*((p[1]+1)*.5)**2-1,p[2]);};
    for(let layer=0;layer<=1;layer++)for(let x=0;x<columns;x++)for(let y=0;y<rows;y++){
      const a=[x/columns*2-1,y/rows*2-1,layer],b=[(x+1)/columns*2-1,y/rows*2-1,layer];
      const c=[x/columns*2-1,(y+1)/rows*2-1,layer],d=[(x+1)/columns*2-1,(y+1)/rows*2-1,layer];
      add(a,b,c);add(c,b,d);
    }
    // A dynamic outer seam follows the growth edge, closing top to underside.
    for(const q of [1])for(let x=0;x<columns;x++){
      const a=[x/columns*2-1,q,2],b=[(x+1)/columns*2-1,q,2],c=[x/columns*2-1,q,3],d=[(x+1)/columns*2-1,q,3];add(a,b,c);add(c,b,d);
    }
    return new Float32Array(vertices);
  }
  function program(gl,vertex,fragment) {
    const shaders=[];let result;
    try {
      for(const [type,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
        const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
      }
      result=gl.createProgram();shaders.forEach(shader=>gl.attachShader(result,shader));gl.linkProgram(result);
      if(!gl.getProgramParameter(result,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(result));
      resources.programs++;return result;
    }catch(error){if(result)gl.deleteProgram(result);throw error;}finally{shaders.forEach(shader=>gl.deleteShader(shader));}
  }

  class FurSheet {
    constructor(container,{width,height,origin,options={},onFailure=()=>{}}) {
      this.options={...defaults,...options};this.width=width;this.height=height;this.origin=origin;
      this.buffers=[];this.programs=[];this.disposed=false;this.onFailure=onFailure;
      this.canvas=document.createElement("canvas");this.canvas.className="fur-sheet-canvas";this.canvas.setAttribute("aria-hidden","true");
      this.onLost=event=>{event.preventDefault();this.dispose();onFailure("WebGL context lost");};
      this.canvas.addEventListener("webglcontextlost",this.onLost);
      container.append(this.canvas);
      const start=performance.now();
      try{
        const gl=this.canvas.getContext("webgl2",{alpha:true,antialias:true,premultipliedAlpha:false,depth:true});
        if(!gl)throw Error("WebGL2 unavailable");this.gl=gl;resources.contexts++;
        const small=width<600 || (navigator.hardwareConcurrency||8)<=4;
        this.dpr=Math.min(devicePixelRatio||1,small?1.15:1.5);
        this.canvas.width=Math.round(width*this.dpr);this.canvas.height=Math.round(height*this.dpr);
        this.meshProgram=program(gl,meshVertex,meshFragment);this.programs.push(this.meshProgram);
        this.furProgram=program(gl,furVertex,furFragment);this.programs.push(this.furProgram);
        const mesh=meshData(small?80:120,small?48:72);this.meshVertices=mesh.length/3;
        this.meshBuffer=this.buffer(mesh);
        this.fibers=Math.round((small?9000:26000)*clamp(this.options.furDensity,.35,1.8));
        const seeds=new Float32Array(this.fibers*4);
        const random=i=>{const n=Math.sin(i*12.9898+78.233)*43758.5453;return n-Math.floor(n);};
        for(let i=0;i<this.fibers;i++){
          // Every prefix covers the whole sheet, so adaptive draw-count reduction
          // cannot remove an entire side of the fur-covered crest.
          seeds[i*4]=random(i+1)*2-1;
          const q=random(i+9)*2-1;
          const t=(q+1)*.5;
          seeds[i*4+1]=2*(random(i+200)<.35?t**1.5:Math.sqrt(t))-1;
          seeds[i*4+2]=random(i+45);seeds[i*4+3]=random(i+91);
        }
        this.sortedRadii=Array.from({length:this.fibers},(_,i)=>(seeds[i*4+1]+1)*.5).sort((a,b)=>a-b);
        this.furBuffer=this.buffer(seeds);
        this.bufferBytes=mesh.byteLength+seeds.byteLength;
        this.gpuBytes=this.bufferBytes+(this.textureBytes||0)+this.canvas.width*this.canvas.height*8;
        this.uniforms=new Map();
        for(const target of this.programs){const uniforms={};for(const name of ["size","origin","progress","reach","radius","band","opacity","bodyFloor","amplitude","width","elevation","curvature","thickness","lighting","length","shadow","pile"])uniforms[name]=gl.getUniformLocation(target,`u_${name}`);this.uniforms.set(target,uniforms);}
        this.bakeButtonPile();
        gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
        // Compile/validate the first draw before starting the visible frame clock.
        // Initialization latency is reported separately, not hidden in FPS.
        this.draw(0);
        this.initializationMs=performance.now()-start;
      }catch(error){this.dispose();throw error;}
    }
    bakeButtonPile(){
      const gl=this.gl,shared=window.DuckFur?.materialShaders;
      if(!shared)throw Error("Shared button fur shaders unavailable");
      const tile=64,dpr=2,size=tile*dpr,temporaryBuffers=[];
      let target,framebuffer,glyph,vao;
      const buffer=data=>{const value=gl.createBuffer();temporaryBuffers.push(value);resources.buffers++;gl.bindBuffer(gl.ARRAY_BUFFER,value);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);};
      const key=`${this.options.fiberLength}:${this.options.furDensity}`,cached=pileCache.get(key);
      this.materialTexture=gl.createTexture();resources.textures++;
      gl.bindTexture(gl.TEXTURE_2D,this.materialTexture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,cached||null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
      const finish=()=>{gl.bindTexture(gl.TEXTURE_2D,this.materialTexture);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);this.textureBytes=Math.ceil(size*size*4*4/3);this.gpuBytes+=this.textureBytes;};
      if(cached){finish();return;}
      try{
        target=program(gl,shared.vertex,shared.fragment);
        framebuffer=gl.createFramebuffer();resources.framebuffers++;gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.materialTexture,0);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error("Button pile framebuffer incomplete");
        // Dummy glyph field keeps the original sampler valid; labels are disabled.
        glyph=gl.createTexture();resources.textures++;gl.bindTexture(gl.TEXTURE_2D,glyph);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,1,1,0,gl.RED,gl.UNSIGNED_BYTE,new Uint8Array([0]));
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
        const count=Math.round(tile*tile*shared.fibersPerPixel*this.options.furDensity),columns=Math.ceil(Math.sqrt(count));
        const data=[];const rand=i=>{const n=Math.sin(i*12.9898+78.233)*43758.5453;return n-Math.floor(n);};
        for(let i=0;i<count;i++){
          const x=((i%columns)+.5+(rand(i+1)-.5)*.78)/columns;
          const y=(Math.floor(i/columns)+.5+(rand(i+2)-.5)*.78)/Math.ceil(count/columns);
          const seed=[.78+rand(i+3)*.44,rand(i+4)*Math.PI*2,rand(i+5),rand(i+6)];
          // Wrapped neighbors make identical fiber fragments meet at tile borders.
          for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)data.push(x+dx,y+dy,...seed);
        }
        vao=gl.createVertexArray();gl.bindVertexArray(vao);
        buffer(new Float32Array([-1,0,1,0,-1,1,-1,1,1,0,1,1]));
        gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
        buffer(new Float32Array(data));
        gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,24,0);gl.vertexAttribDivisor(1,1);
        gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,24,8);gl.vertexAttribDivisor(2,1);
        gl.disableVertexAttribArray(3);gl.vertexAttrib4f(3,0,0,0,0);gl.disableVertexAttribArray(4);gl.vertexAttrib3f(4,0,0,0);
        gl.useProgram(target);
        const loc=name=>gl.getUniformLocation(target,name);
        gl.uniform2f(loc("u_canvasResolution"),size,size);gl.uniform2f(loc("u_surfaceResolution"),size,size);gl.uniform2f(loc("u_surfaceOffset"),0,0);
        gl.uniform1f(loc("u_length"),this.options.fiberLength);gl.uniform1f(loc("u_dpr"),dpr);
        for(const name of ["u_labelLengthScale","u_labelWidthScale","u_boundaryLabelWidthScale","u_boundaryLabelLeanScale"])gl.uniform1f(loc(name),1);
        gl.uniform1f(loc("u_hasGlyph"),0);gl.uniform1f(loc("u_glyphTransition"),.55);gl.uniform1f(loc("u_sdfRange"),12);
        gl.uniform1f(loc("u_motionGuardStart"),.12);gl.uniform1f(loc("u_motionGuardEnd"),.58);gl.uniform1i(loc("u_glyphField"),0);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,glyph);
        gl.viewport(0,0,size,size);gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArraysInstanced(gl.TRIANGLES,0,6,data.length/6);
        const pixels=new Uint8Array(size*size*4);gl.readPixels(0,0,size,size,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        pileCache.set(key,pixels);if(pileCache.size>4)pileCache.delete(pileCache.keys().next().value);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);finish();
      }finally{
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindVertexArray(null);
        if(vao)gl.deleteVertexArray(vao);
        if(framebuffer){gl.deleteFramebuffer(framebuffer);resources.framebuffers--;}
        if(glyph){gl.deleteTexture(glyph);resources.textures--;}
        for(const value of temporaryBuffers){gl.deleteBuffer(value);resources.buffers--;}
        if(target){gl.deleteProgram(target);resources.programs--;}
      }
    }
    buffer(data){const gl=this.gl,buffer=gl.createBuffer();this.buffers.push(buffer);resources.buffers++;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return buffer;}
    uniformsFor(target,model){const gl=this.gl,u=this.uniforms.get(target),s=this.options;gl.useProgram(target);
      gl.uniform2f(u.size,this.width,this.height);gl.uniform2f(u.origin,this.origin.x,this.origin.y);
      for(const [name,value]of Object.entries({progress:model.progress,reach:model.reach,radius:model.radius,band:model.band,opacity:model.opacity,bodyFloor:s.growthOnly?1:.42,amplitude:model.amplitude,width:s.sheetWidth,elevation:s.elevation,curvature:s.curvature,thickness:s.thickness*Math.min(1,model.radius/20),lighting:s.lighting,length:s.fiberLength}))gl.uniform1f(u[name],value);
    }
    draw(progress){if(this.disposed)return null;const gl=this.gl;
      const model=geometry(this.width,this.height,this.origin,this.options,progress);
      gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      this.uniformsFor(this.meshProgram,model);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.materialTexture);gl.uniform1i(this.uniforms.get(this.meshProgram).pile,0);gl.bindBuffer(gl.ARRAY_BUFFER,this.meshBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(0,0);
      gl.depthMask(false);gl.uniform1f(this.uniforms.get(this.meshProgram).shadow,1);gl.drawArrays(gl.TRIANGLES,0,this.meshVertices);
      gl.depthMask(true);gl.uniform1f(this.uniforms.get(this.meshProgram).shadow,0);gl.drawArrays(gl.TRIANGLES,0,this.meshVertices);
      this.uniformsFor(this.furProgram,model);gl.bindBuffer(gl.ARRAY_BUFFER,this.furBuffer);gl.vertexAttribPointer(0,4,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(0,1);
      // All fixed roots are submitted; shader activation never re-samples the domain.
      let low=0,high=this.sortedRadii.length;const limit=model.radius/model.reach;
      while(low<high){const mid=(low+high)>>1;if(this.sortedRadii[mid]<=limit)low=mid+1;else high=mid;}
      this.visibleFibers=Math.round(low*this.fibers/this.sortedRadii.length);
      gl.drawArraysInstanced(gl.TRIANGLES,0,6,this.fibers);gl.vertexAttribDivisor(0,0);
      return model;
    }
    reduceQuality(){if(this.disposed)return;this.qualityReduced=true;this.fibers=Math.max(4000,Math.round(this.fibers*.7));this.canvas.width=Math.round(this.width);this.canvas.height=Math.round(this.height);this.gpuBytes=this.bufferBytes+(this.textureBytes||0)+this.canvas.width*this.canvas.height*8;}
    canRetarget(width,height,options){return !this.disposed && this.width===width && this.height===height && this.options.renderer===options.renderer && this.options.furDensity===(options.furDensity??defaults.furDensity) && this.options.fiberLength===(options.fiberLength??defaults.fiberLength);}
    retarget(container,origin,options){this.origin=origin;this.options={...defaults,...options};container.append(this.canvas);this.initializationMs=0;this.draw(0);}
    getStats(){return {meshVertices:this.meshVertices||0,fiberInstances:this.visibleFibers||0,fiberCapacity:this.fibers||0,gpuBytes:this.gpuBytes||0,initializationMs:this.initializationMs||0,temporaryCanvases:this.disposed?0:1,material:"shared-button-shaders",textureBytes:this.textureBytes||0,...resources};}
    dispose(){if(this.disposed)return;this.disposed=true;const gl=this.gl;
      if(gl){if(this.materialTexture){gl.deleteTexture(this.materialTexture);resources.textures--;this.materialTexture=null;}for(const buffer of this.buffers){gl.deleteBuffer(buffer);resources.buffers--;}for(const item of this.programs){gl.deleteProgram(item);resources.programs--;}
        this.canvas.removeEventListener("webglcontextlost",this.onLost);gl.getExtension("WEBGL_lose_context")?.loseContext();resources.contexts--;}
      this.gl=null;this.canvas.remove();
    }
  }
  window.DuckFurSheet={FurSheet,defaults,geometry,sample,project,profile,revealRadius,revealPolygon,boundaries,resources};
})();
