'use strict';
// The turning leaf and its inserts share one depth buffer. Alpha cutouts write
// depth only where material exists; both faces use the same indexed vertices.
class PaperSurfaceRenderer {
  constructor(){
    this.canvas=document.createElement('canvas');
    this.gl=this.canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:false});
    this.ready=false;this.textures=new WeakMap();this.frame=0;this.stats={backend:'canvas',triangles:0};
    if(!this.gl)return;
    const gl=this.gl;
    const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
    const vertex=compile(gl.VERTEX_SHADER,`#version 300 es
      in vec3 position;in vec2 texcoord;in float light;in float coverage;
      out vec2 uv;out float illumination;out float alphaWeight;
      void main(){gl_Position=vec4(position,1.0);uv=texcoord;illumination=light;alphaWeight=coverage;}`);
    const fragment=compile(gl.FRAGMENT_SHADER,`#version 300 es
      precision highp float;
      uniform sampler2D frontTexture;uniform sampler2D backTexture;
      uniform float sourceSide;uniform float opacity;uniform bool frontFlip;uniform bool backFlip;
      in vec2 uv;in float illumination;in float alphaWeight;out vec4 color;
      void main(){bool front=gl_FrontFacing==(sourceSide>0.0);
        vec2 at=vec2((front?frontFlip:backFlip)?1.0-uv.x:uv.x,uv.y);
        vec4 paper=front?texture(frontTexture,at):texture(backTexture,at);
        paper.a*=opacity*alphaWeight;if(paper.a<0.008)discard;
        color=vec4(mix(paper.rgb,vec3(0.24706,0.08627,0.15686),1.0-illumination)*paper.a,paper.a);}`);
    this.program=gl.createProgram();gl.attachShader(this.program,vertex);gl.attachShader(this.program,fragment);gl.linkProgram(this.program);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
    this.buffer=gl.createBuffer();this.indices=gl.createBuffer();this.locations={};
    for(const name of ['position','texcoord','light','coverage'])this.locations[name]=gl.getAttribLocation(this.program,name);
    for(const name of ['frontTexture','backTexture','sourceSide','frontFlip','backFlip','opacity'])this.locations[name]=gl.getUniformLocation(this.program,name);
    this.ready=true;this.gpu=true;this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.ready=false;});
  }
  begin(width,height){
    if(!this.ready)return false;
    const gl=this.gl;if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    this.frame++;this.stats={backend:'webgl2',triangles:0,objects:0};
    gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);
    gl.disable(gl.CULL_FACE);gl.frontFace(gl.CW);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }
  texture(source,unit){
    const gl=this.gl;let record=this.textures.get(source);
    if(!record){record={texture:gl.createTexture(),frame:-1};this.textures.set(source,record);}
    gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,record.texture);
    if(!record.uploaded||record.width!==source.width||record.height!==source.height||record.lightingKey!==source.lightingKey||record.lightingBase!==source.lightingBase){
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
      const filter=source.pageViewport&&source.width>400?gl.LINEAR:gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);record.frame=this.frame;record.uploaded=true;record.width=source.width;record.height=source.height;record.lightingKey=source.lightingKey;record.lightingBase=source.lightingBase;
    }
  }
  surface(front,back,side,columns,rows,sample,{frontFlip=side<0,backFlip=side>0,shade=1,depthBias=0,opacity=1}={}){
    const gl=this.gl,vertices=new Float32Array((columns+1)*(rows+1)*7),indices=new Uint16Array(columns*rows*6);
    let at=0,index=0;
    for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
      const p=sample(i/columns,j/rows);
      vertices[at++]=p.x/1000*2-1;vertices[at++]=1-p.y/680*2;
      vertices[at++]=Math.max(-.95,Math.min(.95,-(p.depth+depthBias)/1000));
      vertices[at++]=i/columns;vertices[at++]=j/rows;vertices[at++]=(p.light??1)*shade;vertices[at++]=p.coverage??1;
      if(i<columns&&j<rows){const a=j*(columns+1)+i,b=a+1,c=a+columns+1,d=c+1;
        indices[index++]=a;indices[index++]=b;indices[index++]=d;indices[index++]=a;indices[index++]=d;indices[index++]=c;}
    }
    this.texture(front,0);this.texture(back||front,1);
    gl.uniform1i(this.locations.frontTexture,0);gl.uniform1i(this.locations.backTexture,1);gl.uniform1f(this.locations.sourceSide,side);gl.uniform1f(this.locations.opacity,opacity);
    gl.uniform1i(this.locations.frontFlip,frontFlip?1:0);gl.uniform1i(this.locations.backFlip,backFlip?1:0);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);
    for(const [name,size,offset] of [['position',3,0],['texcoord',2,12],['light',1,20],['coverage',1,24]]){gl.enableVertexAttribArray(this.locations[name]);gl.vertexAttribPointer(this.locations[name],size,gl.FLOAT,false,28,offset);}
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.DYNAMIC_DRAW);
    gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);this.stats.triangles+=indices.length/3;this.stats.objects++;
  }
  composite(context){context.drawImage(this.canvas,0,0,1000,680);}
}
// Canvas fallback retains the same samples, face winding and material UVs.
// It sorts actual triangles by camera depth instead of painting entire strips.
class CanvasPaperSurfaceRenderer {
  constructor(){this.canvas=document.createElement('canvas');this.ready=true;this.gpu=false;this.stats={backend:'canvas',triangles:0};}
  begin(width,height){this.canvas.width=width;this.canvas.height=height;this.context=this.canvas.getContext('2d');this.context.setTransform(width/1000,0,0,height/680,0,0);this.triangles=[];this.stats={backend:'canvas',triangles:0,objects:0};return true;}
  surface(front,back,side,columns,rows,sample,{frontFlip=side<0,backFlip=side>0,shade=1,depthBias=0,opacity=1}={}){
    columns=Math.min(columns,64);rows=Math.min(rows,32);
    const grid=Array.from({length:rows+1},(_,j)=>Array.from({length:columns+1},(_,i)=>({...sample(i/columns,j/rows),u:i/columns,v:j/rows})));
    for(let j=0;j<rows;j++)for(let i=0;i<columns;i++)for(const ids of [[[j,i],[j,i+1],[j+1,i+1]],[[j,i],[j+1,i+1],[j+1,i]]]){
      const points=ids.map(([r,c])=>grid[r][c]),[a,b,c]=points,area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
      const isFront=area*side>=0,image=isFront?front:back||front,flip=isFront?frontFlip:backFlip;
      const alpha=opacity*points.reduce((sum,p)=>sum+(p.coverage??1)/3,0);if(alpha<.008)continue;
      this.triangles.push({image,points,uv:points.map(p=>({x:(flip?1-p.u:p.u)*image.width,y:p.v*image.height})),depth:points.reduce((sum,p)=>sum+(p.depth+depthBias)/3,0),alpha});
    }this.stats.objects++;
  }
  composite(context){
    const target=this.context;this.triangles.sort((a,b)=>a.depth-b.depth);
    for(const t of this.triangles){target.globalAlpha=t.alpha;target.imageSmoothingEnabled=!!t.image.pageViewport&&t.image.width>400;triangle(t.image,t.uv,t.points,target);}
    target.globalAlpha=1;this.stats.triangles=this.triangles.length;context.drawImage(this.canvas,0,0,1000,680);
  }
}
