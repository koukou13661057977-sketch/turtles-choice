import * as THREE from './vendor/three.module.js';

const TAU=Math.PI*2;
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const colour=v=>new THREE.Color(v);
const standard=(c,more={})=>new THREE.MeshStandardMaterial({color:c,roughness:.85,...more});

// Merge the authored pieces into one draw call per reef, preserving their colours.
export function mergePieces(pieces){
  const p=[],n=[],c=[],uv=[];const nm=new THREE.Matrix3(),v=new THREE.Vector3(),normal=new THREE.Vector3();
  for(const piece of pieces){
    piece.updateMatrix();const source=piece.geometry.index?piece.geometry.toNonIndexed():piece.geometry;
    const pos=source.attributes.position,nor=source.attributes.normal,cols=source.attributes.color;nm.getNormalMatrix(piece.matrix);
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos,i).applyMatrix4(piece.matrix);normal.fromBufferAttribute(nor,i).applyMatrix3(nm).normalize();p.push(v.x,v.y,v.z);n.push(normal.x,normal.y,normal.z);
      if(cols)c.push(cols.getX(i)*piece.material.color.r,cols.getY(i)*piece.material.color.g,cols.getZ(i)*piece.material.color.b);else c.push(piece.material.color.r,piece.material.color.g,piece.material.color.b);
      uv.push(source.attributes.uv?.getX(i)||0,source.attributes.uv?.getY(i)||0);
    }
    if(source!==piece.geometry)source.dispose();
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
}
function piece(list,geometry,color,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0]){const m=new THREE.Mesh(geometry,standard(color));m.position.set(...position);m.scale.set(...scale);m.rotation.set(...rotation);list.push(m);return m;}
function branch(list,a,b,r1,r2,color){
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start),geometry=new THREE.CylinderGeometry(r2,r1,direction.length(),7,1);
  const m=piece(list,geometry,color,start.add(end).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
}
function rockGeometry(random){const g=new THREE.IcosahedronGeometry(1,3),p=g.attributes.position;for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),f=1+.08*Math.sin(x*9+z*6)+.07*Math.sin(y*11-z*4)+.035*Math.cos(x*17+y*15);p.setXYZ(i,x*f,y*f,z*f);
}g.computeVertexNormals();return g;}
function coralTree(list,random,base,scale,tint,depth=4){
  function grow(start,direction,length,width,level){
    const end=start.map((v,i)=>v+direction[i]*length);branch(list,start,end,width,width*.67,tint);
    if(level<=0){piece(list,new THREE.SphereGeometry(width*.72,7,5),tint,end);return;}
    const spread=.32+random()*.35;
    for(let i=0;i<(level>2?2:2);i++){
      const d=new THREE.Vector3(direction[0]+(i?1:-1)*spread,direction[1]+.1,direction[2]+(random()-.5)*.28).normalize();grow(end,d.toArray(),length*(.65+random()*.12),width*.64,level-1);
    }
  }grow(base,[0,1,0],scale*.55,scale*.07,depth);
}
export function makeReef(seed){
  const random=rng(seed),root=new THREE.Group(),pieces=[],palette=['#698e88','#62887e','#7a9788'];
  const size=1.4+random()*1.2;
  for(let i=0;i<4;i++)piece(pieces,rockGeometry(random),palette[i%3],[(random()-.5)*2.5,-.12+random()*.15,(random()-.5)*2],[(.6+random()*.8)*size,.35+random()*.5,(.5+random()*.7)*size],[random()*.25,random()*TAU,random()*.2]);
  if(seed%3!==1){
    coralTree(pieces,random,[-.8,.1,.1],1+random()*.65,seed%2?'#a77b69':'#b99a7c',4);
    coralTree(pieces,random,[.35,.1,-.5],.7+random()*.5,'#879a87',3);
  }
  // Low, overlapping plate coral makes a different silhouette from the branching coral.
  if(seed%3===1)for(let i=0;i<6;i++){
    const g=new THREE.SphereGeometry(1,24,10),m=piece(pieces,g,i%2?'#9eae91':'#839b86',[(i%3-1)*.4,.3+i*.12,Math.sin(i*2)*.5],[.62,.065,.54],[.05*Math.sin(i),i*.75,.08*Math.cos(i)]);
  }
  const geom=mergePieces(pieces);root.add(new THREE.Mesh(geom,standard('#ffffff',{vertexColors:true})));
  for(const part of pieces){part.geometry.dispose();part.material.dispose();}
  return root;
}
function bladeGeometry(){
  const p=[],idx=[],c=[];
  for(let i=0;i<=12;i++){
    const t=i/12,width=.08*Math.pow(1-t,.65),bend=.28*t*t;
    for(const side of [-1,1]){p.push(side*width+bend,1.5*t,.10*Math.sin(t*4));const col=colour('#365f57').lerp(colour('#96b494'),t*.72);c.push(col.r,col.g,col.b);}
    if(i<12){const n=i*2;idx.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
export function addMeadow(root,seed,timeUniform){
  const random=rng(seed),material=standard('#ffffff',{vertexColors:true,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{shader.uniforms.uTime=timeUniform;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;').replace('#include <begin_vertex>',`#include <begin_vertex>
    float phase=instanceMatrix[3].x*2.3+instanceMatrix[3].z;
    transformed.x+=sin(uTime*.72+phase+position.y)*.12*position.y*position.y;
    transformed.z+=cos(uTime*.63+phase)*.075*position.y;`);};
  material.customProgramCacheKey=()=> 'meadow-v3';
  const blades=new THREE.InstancedMesh(bladeGeometry(),material,32),o=new THREE.Object3D();
  for(let i=0;i<32;i++){const a=random()*TAU,r=1.1+random()*1.4;o.position.set(Math.cos(a)*r,.03,Math.sin(a)*r);o.rotation.y=random()*TAU;o.rotation.z=(random()-.5)*.25;o.scale.set(.7+random()*.5,.3+random()*.9,1);o.updateMatrix();blades.setMatrixAt(i,o.matrix);}root.add(blades);
}

function finishHabitat(root,pieces){
  root.add(new THREE.Mesh(mergePieces(pieces),standard('#ffffff',{vertexColors:true})));
  for(const part of pieces){part.geometry.dispose();part.material.dispose();}
  return root;
}

// Each biome has its own silhouette. The central five-unit swimming lane stays open.
// Merged rocks/coral and instanced blades keep the scenery inexpensive to render.
export function makeShallows(seed){
  const random=rng(seed),root=new THREE.Group(),pieces=[];root.userData.biome='shallows';
  for(let i=0;i<3;i++)piece(pieces,new THREE.IcosahedronGeometry(1,1),i%2?'#c7c9a4':'#c7bd91',[(random()-.5)*2.8,.06,(random()-.5)*3.5],[.8+random()*.6,.22+random()*.24,.65+random()*.65],[0,random()*TAU,.1]);
  for(let i=0;i<5;i++){
    const x=(random()-.5)*3.6,z=(random()-.5)*4.4,shade=i%2?'#f3ddba':'#e8bba0';
    piece(pieces,new THREE.SphereGeometry(1,10,6),shade,[x,.08,z],[.27,.07,.22]);
    for(let rib=0;rib<4;rib++)branch(pieces,[x-.15+rib*.1,.12,z-.12],[x-.11+rib*.075,.15,z+.12],.012,.008,'#fff0d5');
  }
  // A small starfish reads clearly against the warm sand without competing with food.
  const starX=(random()-.5)*2,starZ=(random()-.5)*2;
  piece(pieces,new THREE.SphereGeometry(.16,8,5),'#d89772',[starX,.13,starZ],[1,.35,1]);
  for(let i=0;i<5;i++){const a=i*TAU/5;branch(pieces,[starX,.13,starZ],[starX+Math.cos(a)*.44,.10,starZ+Math.sin(a)*.44],.10,.015,'#d89772');}
  return finishHabitat(root,pieces);
}

export function makeSeagrassBank(seed,timeUniform){
  const random=rng(seed),root=new THREE.Group(),pieces=[];root.userData.biome='seagrass';
  for(let i=0;i<3;i++)piece(pieces,new THREE.IcosahedronGeometry(1,1),'#728c5b',[(i-1)*1.4,-.10,(random()-.5)*2],[1.3,.35,1.5],[0,random()*TAU,0]);
  finishHabitat(root,pieces);
  const geometry=bladeGeometry(),colors=geometry.attributes.color;
  for(let i=0;i<colors.count;i++){const height=geometry.attributes.position.getY(i)/1.5;const tint=colour('#287448').lerp(colour('#b3cf5b'),height*.80);colors.setXYZ(i,tint.r,tint.g,tint.b);}
  const material=standard('#ffffff',{vertexColors:true,side:THREE.DoubleSide,roughness:.72});
  material.onBeforeCompile=shader=>{
    shader.uniforms.uTime=timeUniform;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;').replace('#include <begin_vertex>',`#include <begin_vertex>
      float phase=instanceMatrix[3].x*1.6+instanceMatrix[3].z;
      transformed.x+=sin(uTime*.65+phase+position.y*.6)*.13*position.y*position.y;
      transformed.z+=cos(uTime*.51+phase)*.085*position.y;`);
  };material.customProgramCacheKey=()=> 'tall-seagrass-v5';
  const grass=new THREE.InstancedMesh(geometry,material,68),dummy=new THREE.Object3D();grass.name='tall-seagrass';
  for(let i=0;i<68;i++){
    const a=random()*TAU,r=Math.sqrt(random())*2.2;
    dummy.position.set(Math.cos(a)*r,.05,Math.sin(a)*r*1.35);dummy.rotation.set(0,random()*TAU,(random()-.5)*.15);
    dummy.scale.set(1.15+random()*.9,2.4+random()*2.5,1);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);
  }
  grass.computeBoundingSphere();root.add(grass);return root;
}

export function makeCoralGarden(seed){
  const random=rng(seed),root=new THREE.Group(),pieces=[];root.userData.biome='coral';
  for(let i=0;i<3;i++)piece(pieces,new THREE.IcosahedronGeometry(1,1),'#9a9a8a',[(i-1)*1.25,.12,(random()-.5)*1.2],[1.4,.48+random()*.25,1.5],[0,random()*TAU,0]);
  coralTree(pieces,random,[-1.05,.25,.15],2.4+random()*.9,seed%2?'#f19876':'#eb7a73',3);
  coralTree(pieces,random,[.75,.25,-.65],2.1+random()*.8,seed%2?'#d6a4cc':'#bf90cd',3);
  // Broad table corals, warm tube sponges and branching fans are visible at a glance.
  for(let i=0;i<4;i++)piece(pieces,new THREE.SphereGeometry(1,16,7),i%2?'#dcaa68':'#efbf7d',[(i%2?1:-1)*.7,.4+i*.40,.7],[1.05-i*.1,.10,.75],[.04,i*.8,.08*Math.sin(i)]);
  for(let i=0;i<5;i++){
    const x=.6+(i%3)*.28,z=-.1+Math.floor(i/3)*.34,h=.8+random()*.8;
    piece(pieces,new THREE.CylinderGeometry(.16,.24,h,9,1,true),'#e9c56a',[x,h/2+.25,z]);
    const lip=piece(pieces,new THREE.TorusGeometry(.15,.035,6,12),'#f4d987',[x,h+.25,z]);lip.rotation.x=Math.PI/2;
    piece(pieces,new THREE.CircleGeometry(.13,9),'#705e38',[x,h+.23,z],[1,1,1],[-Math.PI/2,0,0]);
  }
  return finishHabitat(root,pieces);
}

export function makeSand(timeUniform,scrollUniform){
  const geometry=new THREE.PlaneGeometry(160,210,100,140);geometry.rotateX(-Math.PI/2);const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),banks=.45*Math.pow(Math.min(1,Math.abs(x)/16),2);
    p.setY(i,.20*Math.sin(x*.24+z*.10)+.12*Math.cos(z*.31)+banks+.023*Math.sin(x*3.2+Math.sin(z*.5)));
  }geometry.computeVertexNormals();
  const material=standard('#d6d4a6',{roughness:1});
  material.onBeforeCompile=shader=>{
    shader.uniforms.uTime=timeUniform;shader.uniforms.uScroll=scrollUniform;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSand;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSand=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vSand;uniform float uTime;uniform float uScroll;
      vec2 wave(vec2 p,float t){return p+vec2(sin(p.y*1.6+t*.42)+sin(p.x*.8-t*.33),cos(p.x*1.4-t*.31)+sin(p.y*.9+t*.4))*.48;}
      float caustic(vec2 p,float t){vec2 q=wave(p,t);float a=sin(q.x*2.8+q.y)*sin(q.y*2.5-q.x*.8);return pow(1.-abs(a),17.);}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 uv=vSand.xz+vec2(0.,uScroll);
      float dune=.5+.5*sin(uv.x*3.7+sin(uv.y*.45)*1.3);
      float fleck=fract(sin(dot(floor(uv*145.),vec2(12.9898,78.233)))*43758.5453);
      diffuseColor.rgb*=.91+dune*.055+fleck*.025;
      float ca=caustic(uv*.62,uTime)*.55+caustic(uv*.39+3.7,-uTime*.8)*.34;
      diffuseColor.rgb+=vec3(.22,.23,.13)*ca;`);
  };material.customProgramCacheKey=()=> 'sand-caustics-v3';
  const sand=new THREE.Mesh(geometry,material);sand.position.set(0,-4.45,-63);return sand;
}
export function makeWaterSurface(timeUniform){
  const material=new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,uniforms:{uTime:timeUniform},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform float uTime;
    void main(){vec2 p=vUv*40.;float w=sin(p.x+sin(p.y*1.3+uTime*.12))*sin(p.y*.78-uTime*.16);float a=.06+pow(1.-abs(w),14.)*.12;gl_FragColor=vec4(.55,.77,.69,a);}`});
  const surface=new THREE.Mesh(new THREE.PlaneGeometry(180,210),material);surface.rotation.x=Math.PI/2;surface.position.set(0,12,-55);return surface;
}
export function makeLightShafts(timeUniform){
  const group=new THREE.Group();
  for(let i=0;i<6;i++){
    const w=2.5+(i%3),x=-18+i*7,z=-28-(i%3)*12;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([x,16,z,x+w,16,z,x+9+w*2,-4,z+2,x+9-w,-4,z+2],3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,1,0,0,0],2));geometry.setIndex([0,1,2,0,2,3]);
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{uTime:timeUniform,uPhase:{value:i*1.7}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform float uTime;uniform float uPhase;
      void main(){float edge=pow(sin(vUv.x*3.1415926),2.);float ends=smoothstep(0.,.25,vUv.y)*(1.-smoothstep(.86,1.,vUv.y));float breath=.8+.2*sin(uTime*.24+uPhase);gl_FragColor=vec4(.60,.79,.67,edge*ends*.075*breath);}`});
    group.add(new THREE.Mesh(geometry,material));
  }return group;
}
export function makeParticles(){
  const random=rng(3841),p=[],sizes=[];for(let i=0;i<320;i++){p.push((random()-.5)*55,random()*17-4,-random()*95+14);sizes.push(.5+random());}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('aSize',new THREE.Float32BufferAttribute(sizes,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uPixelRatio:{value:Math.min(globalThis.devicePixelRatio||1,1.75)}},vertexShader:`attribute float aSize;uniform float uPixelRatio;varying float vFade;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(20.*aSize*uPixelRatio/-mv.z,1.,3.5*uPixelRatio);vFade=clamp(1.-(-mv.z)/70.,0.,1.);}`,fragmentShader:`varying float vFade;void main(){float a=(1.-smoothstep(.15,.5,length(gl_PointCoord-.5)))*.28*vFade;gl_FragColor=vec4(.80,.89,.80,a);}`});return new THREE.Points(geometry,material);
}
export function makeFish(timeUniform){
  const parts=[],body=new THREE.SphereGeometry(1,20,12);
  piece(parts,body,'#8ea99e',[0,0,0],[.32,.11,.075]);
  const tail=new THREE.BufferGeometry();tail.setAttribute('position',new THREE.Float32BufferAttribute([-.25,0,0,-.50,.15,0,-.45,0,0,-.25,0,0,-.45,0,0,-.50,-.15,0],3));tail.computeVertexNormals();piece(parts,tail,'#739589');
  for(const side of [-1,1])piece(parts,new THREE.SphereGeometry(.016,8,6),'#193f45',[.21,.025,side*.061]);
  const geometry=mergePieces(parts),material=standard('#ffffff',{vertexColors:true,side:THREE.DoubleSide,roughness:.44});
  material.onBeforeCompile=shader=>{shader.uniforms.uTime=timeUniform;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;').replace('#include <begin_vertex>',`#include <begin_vertex>
    transformed.z+=sin(uTime*7.+instanceMatrix[3].x*2.+position.x*8.)*.09*smoothstep(.1,.48,-position.x);`);};material.customProgramCacheKey=()=> 'fish-swim-v3';
  for(const part of parts){part.geometry.dispose();part.material.dispose();}
  return new THREE.InstancedMesh(geometry,material,36);
}
