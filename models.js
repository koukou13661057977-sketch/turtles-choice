import * as THREE from './vendor/three.module.js';
import {isFood,VARIANT_COUNT} from './catalog.js?v=1.6.0';

const TAU = Math.PI * 2;
const sphere = new THREE.SphereGeometry(1, 32, 24);
const color = value => new THREE.Color(value);
const materials = (value, options = {}) => new THREE.MeshStandardMaterial({color:value, roughness:.68, ...options});
const mix = (a,b,t) => a.clone().lerp(b,THREE.MathUtils.clamp(t,0,1));

function mesh(parent, geometry, material, name) {
  const object=new THREE.Mesh(geometry,material);if(name)object.name=name;parent.add(object);return object;
}
function ellipsoid(parent, material, position, scale, name) {
  const object=mesh(parent,sphere,material,name);object.position.set(...position);object.scale.set(...scale);return object;
}
function curveMesh(parent, points, radius, material, segments=28, radial=6) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  return mesh(parent,new THREE.TubeGeometry(curve,segments,radius,radial,false),material);
}
function surface(segments,rings,point,colour) {
  const positions=[],colors=[],uvs=[],indices=[];
  for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){
    const u=i/segments,v=j/rings,p=point(u,v);positions.push(...p);uvs.push(u,v);
    if(colour){const c=colour(p,u,v);colors.push(c.r,c.g,c.b);}
  }
  for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){
    const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));if(colour)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function leatherMaterial(){
  const m=materials('#ffffff',{vertexColors:true,roughness:.54,metalness:0});
  // Fine, irregular pale flecks belong to the skin, rather than raised decorative beads.
  m.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSkin;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSkin=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vSkin;
      float speck(vec3 p){vec3 cell=floor(p);vec3 f=fract(p)-.5;
        float h=fract(sin(dot(cell,vec3(127.1,311.7,74.7)))*43758.5453);
        vec3 offset=vec3(fract(h*43.7),fract(h*19.3),fract(h*91.1))*.55-.275;
        return (1.-smoothstep(.055,.14,length(f-offset)))*step(.67,h);
      }`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float fleck=speck(vSkin*34.0);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.77,.84,.66),fleck*.46);
      diffuseColor.rgb*=.97+.03*sin(vSkin.x*139.+sin(vSkin.z*161.))*sin(vSkin.y*127.);`);
  };
  m.customProgramCacheKey=()=> 'leatherback-skin-v5';return m;
}

function shellShape(u,v){
  const angle=u*TAU,theta=v*Math.PI,r=Math.sin(theta),t=(1-Math.cos(theta))/2;
  const width=r*(1.17-.33*t),z=-1.45+3.12*t;
  let y=.025+Math.sin(angle)*r*(Math.sin(angle)>0?.67:.31);
  if(Math.sin(angle)>0){
    const xratio=Math.cos(angle);
    for(const ridge of [-.82,-.58,-.30,0,.30,.58,.82]){
      const d=(xratio-ridge)/.041;
      y+=.024*Math.exp(-d*d)*Math.pow(r,.7);
    }
  }
  return [Math.cos(angle)*width,y,z];
}
function finGeometry(side,rear=false){
  const n=rear?18:28;
  const g=surface(14,n,(u,t)=>{
    const a=u*TAU,reach=rear?.75:1.93;
    // A substantial shoulder and an asymmetric swept paddle, with a rounded tip.
    const w=rear?.20*Math.pow(Math.sin(Math.PI*t),.65)+.035:.36*Math.pow(Math.sin(Math.PI*(.19+.81*t)),.66)+.008;
    return [side*(t*reach),Math.sin(a)*(.083*Math.pow(1-t,.7)+.006),(.04+Math.cos(a)*w)+(rear?t*.52:t*t*.55-.10*t)];
  },(p,u,v)=>{
    const top=Math.sin(u*TAU)>0;
    const shade=.10*Math.sin(v*16)+.08*Math.cos(u*17);
    return mix(color(top?'#438d88':'#b9cba3'),color(top?'#81b6a0':'#e6dfb2'),shade+.14);
  });
  // The loft runs along X: handedness changes its winding.
  if(side>0){const a=g.index.array;for(let i=0;i<a.length;i+=3){[a[i+1],a[i+2]]=[a[i+2],a[i+1]];}g.computeVertexNormals();}
  g.userData.rest=new Float32Array(g.attributes.position.array);return g;
}

export function createTurtleModel(species='leatherback'){
  if(['green','hawksbill','loggerhead'].includes(species))return createHardTurtle(species);
  const root=new THREE.Group();root.name='leatherback';
  const skin=leatherMaterial(),mouthMat=materials('#245356'),under=materials('#dedbb0',{roughness:.70});
  const carapace=surface(160,64,shellShape,(p,u,v)=>{
    const upper=Math.sin(u*TAU)>0,t=(1-Math.cos(v*Math.PI))/2;
    let c=upper?mix(color('#337b80'),color('#77aa94'),.20+.27*Math.sin(u*TAU)+.06*Math.sin(t*16)):mix(color('#a5bba0'),color('#e1dcb0'),.64);
    if(upper){let ridge=0;for(const r of [-.82,-.58,-.30,0,.30,.58,.82])ridge=Math.max(ridge,Math.exp(-Math.pow((Math.cos(u*TAU)-r)/.052,2)));c.lerp(color('#bad2ac'),ridge*.30*Math.sin(v*Math.PI));}
    c.multiplyScalar(.96+.04*Math.sin(p[0]*21+p[2]*19));return c;
  });
  mesh(root,carapace,skin,'carapace');
  // A continuous, tapering neck fits into the shoulders of the shell.
  const neck=surface(36,20,(u,v)=>{
    const a=u*TAU,w=.39+.055*Math.sin(v*Math.PI);return [Math.cos(a)*w,Math.sin(a)*(.27+.025*Math.sin(v*Math.PI))+.005,-1.0-v*.85];
  },(p,u)=>mix(color('#619f91'),color('#d9dcb1'),Math.max(0,-Math.sin(u*TAU))*.8));
  const ni=neck.index.array;for(let i=0;i<ni.length;i+=3)[ni[i+1],ni[i+2]]=[ni[i+2],ni[i+1]];neck.computeVertexNormals();mesh(root,neck,skin,'neck');
  const head=new THREE.Group();head.name='head-rig';head.position.set(0,.05,-1.85);root.add(head);
  const skull=surface(64,38,(u,v)=>{
    const a=u*TAU,t=v*Math.PI,r=Math.pow(Math.sin(t),.70),z=.35-.99*v;
    const w=.445*r*(1-.12*v);const y=.05+Math.sin(a)*r*(Math.sin(a)>0?.345:.245)-.025*v;
    return [Math.cos(a)*w,y,z];
  },(p,u,v)=>mix(color('#72ae9a'),color('#deddb2'),Math.max(0,-Math.sin(u*TAU))*.82+.045*Math.sin(v*13)));
  // The head loft points toward -Z, so reverse its faces.
  const si=skull.index.array;for(let i=0;i<si.length;i+=3)[si[i+1],si[i+2]]=[si[i+2],si[i+1]];skull.computeVertexNormals();mesh(head,skull,skin,'head');
  const jaw=new THREE.Group();jaw.position.set(0,-.12,.10);head.add(jaw);
  ellipsoid(jaw,under,[0,-.035,-.32],[.31,.115,.36],'jaw');
  curveMesh(head,[[-.345,-.055,-.12],[-.29,-.12,-.38],[-.13,-.14,-.56],[0,-.12,-.605],[.13,-.14,-.56],[.29,-.12,-.38],[.345,-.055,-.12]],.012,mouthMat,30).name='smile';
  ellipsoid(head,under,[0,-.085,-.535],[.065,.065,.048]);
  const eyeMaterial=new THREE.MeshPhysicalMaterial({color:'#172a2c',roughness:.1,clearcoat:1,clearcoatRoughness:.05});
  const irisMaterial=materials('#9a8750',{roughness:.42});
  const pupilMaterial=materials('#101f22',{roughness:.15});
  const glint=new THREE.MeshBasicMaterial({color:'#fff7df'});
  const eyes=[];
  for(const side of [-1,1]){
    const eye=new THREE.Group();eye.position.set(side*.349,.17,-.29);eye.scale.setScalar(1.16);eye.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(side*.80,.08,-.6).normalize());head.add(eye);eyes.push(eye);
    ellipsoid(eye,materials('#79ad95'),[0,0,-.016],[.132,.15,.073]);
    ellipsoid(eye,eyeMaterial,[0,0,.025],[.095,.112,.07]);
    ellipsoid(eye,irisMaterial,[.005,0,.087],[.061,.075,.014]);
    ellipsoid(eye,pupilMaterial,[.005,0,.10],[.043,.058,.009]);
    ellipsoid(eye,glint,[-.024,.038,.108],[.015,.020,.006]);
    curveMesh(eye,[[-.105,.02,.03],[-.068,.116,.025],[.025,.13,.02],[.1,.05,.02]],.022,materials('#90bda0'),15);
    ellipsoid(head,mouthMat,[side*.112,.105,-.585],[.024,.014,.013]);
    // A small crease below each eye gives expression without oversized white eyeballs.
    curveMesh(head,[[side*.36,.025,-.17],[side*.34,-.025,-.29],[side*.29,-.045,-.38]],.007,materials('#659883'),12);
  }
  const fins=[],rearFins=[];
  for(const side of [-1,1]){
    const fin=new THREE.Group();fin.position.set(side*.86,-.10,-.73);fin.userData.side=side;root.add(fin);
    const blade=mesh(fin,finGeometry(side),skin,'flipper');fin.userData.blade=blade;fins.push(fin);
    const rear=new THREE.Group();rear.position.set(side*.69,-.16,1.12);rear.rotation.y=-side*.35;root.add(rear);mesh(rear,finGeometry(side,true),skin,'rear-flipper');rear.userData.side=side;rearFins.push(rear);
  }
  const tail=ellipsoid(root,skin,[0,-.12,1.62],[.11,.09,.28],'tail');
  // Vertex colours are optional on the few small shared-sphere skin details.
  tail.material=materials('#6ba792');
  root.userData={fins,rearFins,jaw,head,eyes,species:'leatherback'};return root;
}

// Hard-shelled species use their own dome, individually bevelled scutes and head
// geometry. Static detail is vertex-coloured, avoiding texture downloads and
// hundreds of separate decorative meshes.
const hardPalettes={
  green:{top:'#697d3b',light:'#c3ba68',dark:'#3e5031',skin:'#8b9d64',belly:'#e3d7a0',sideCount:4,width:1.13,height:.65,head:[.36,.30,.88]},
  hawksbill:{top:'#875331',light:'#e4b461',dark:'#4c3425',skin:'#ad9b62',belly:'#eed6a0',sideCount:4,width:1.03,height:.63,head:[.32,.29,1.03]},
  loggerhead:{top:'#9c5941',light:'#d09b64',dark:'#673c2e',skin:'#b87950',belly:'#e8cf99',sideCount:5,width:1.15,height:.69,head:[.56,.37,1.03]}
};
function hardWidth(p,z){return p.width*(1+(p===hardPalettes.loggerhead?-.17:p===hardPalettes.hawksbill?.10:0)*z/1.50);}
function shellHeight(p,x,z){return .04+p.height*Math.sqrt(Math.max(.005,1-(x/hardWidth(p,z))**2-(z/1.5)**2));}
function hardScute(parent,p,species,cx,cz,rx,rz,index){
  const isHawk=species==='hawksbill',points=[],normals=[],colours=[],indices=[];
  const centreColour=mix(color(p.top),color(p.light),.27+.09*Math.sin(index*2.13));
  // Three bevel rings and a raised centre give each shield a physical lip.
  for(let ring=0;ring<4;ring++)for(let i=0;i<12;i++){
    const angle=i/12*TAU,rad=[1,.94,.67,.035][ring];
    let x=cx+Math.cos(angle)*rx*rad,z=cz+Math.sin(angle)*rz*rad;
    const ellipse=Math.sqrt((x/hardWidth(p,z))**2+(z/1.5)**2);if(ellipse>.965){x*=.965/ellipse;z*=.965/ellipse;}
    const lift=[.012,.030,.037,.042][ring]+(isHawk?.035*(z-cz+rz)/(2*rz):0);
    points.push(x,shellHeight(p,x,z)+lift,z);
    let c=ring===0?color(p.dark):ring===1?mix(color(p.top),color(p.light),.65):centreColour.clone();
    if(ring>=2){const flame=Math.sin(angle*(isHawk?5:3)+index)*Math.cos(angle*7-index);c.lerp(color(isHawk?p.dark:p.light),.17+.19*Math.max(0,flame));}
    colours.push(c.r,c.g,c.b);
  }
  for(let r=0;r<3;r++)for(let i=0;i<12;i++){const a=r*12+i,b=r*12+(i+1)%12,c=a+12,d=b+12;indices.push(a,c,b,b,c,d);}
  for(let i=1;i<11;i++)indices.push(36,36+i+1,36+i);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));g.setIndex(indices);g.computeVertexNormals();
  mesh(parent,g,parent.userData.material,`scute-${index}`);
}
function createHardTurtle(species){
  const p=hardPalettes[species],root=new THREE.Group();root.name=species;
  const bodyMat=materials('#ffffff',{vertexColors:true,roughness:.58}),skinMat=materials('#ffffff',{vertexColors:true,roughness:.72}),belly=materials(p.belly),dark=materials(p.dark);
  const carapace=surface(112,38,(u,v)=>{
    const a=u*TAU,t=v*Math.PI,r=Math.sin(t),z=-Math.cos(t)*1.50;
    const jag=species==='hawksbill'&&z>.05?1+.025*Math.sin(v*25*Math.PI)**6:1;
    return [Math.cos(a)*r*hardWidth(p,z)*jag,.04+Math.sin(a)*r*(Math.sin(a)>0?p.height:.25),z];
  },(pos,u)=>mix(color(p.dark),color(p.belly),Math.max(0,-Math.sin(u*TAU))*.92));
  mesh(root,carapace,bodyMat,'carapace');
  const shields=new THREE.Group();shields.name='shell-scutes';shields.userData.material=bodyMat;root.add(shields);
  for(let i=0;i<5;i++)hardScute(shields,p,species,0,-1.10+i*.53,.38,i===0||i===4?.35:.38,i);
  for(const side of [-1,1])for(let i=0;i<p.sideCount;i++){
    const z=-.94+i*(1.88/(p.sideCount-1)),x=side*(.58+.045*Math.sin(i*2));
    hardScute(shields,p,species,x,z,.47*(species==='hawksbill'?1.08:1),p.sideCount===5?.29:.37,5+(side===1?p.sideCount:0)+i);
  }
  // A scalloped marginal band is a single closed loft around the shell.
  const rim=surface(96,4,(u,v)=>{
    const a=u*TAU,r=.94+v*.06,z=Math.sin(a)*1.50*r;
    const serration=species==='hawksbill'&&z>0?1+.033*Math.pow(Math.max(0,Math.sin(a*22)),3):1;
    const x=Math.cos(a)*hardWidth(p,z)*r*serration;
    return [x,.03+.11*Math.sin(v*Math.PI),z];
  },(pos,u,v)=>mix(color(p.dark),color(p.light),.34+.40*Math.sin(v*Math.PI)+.10*Math.sin(u*TAU*22)));
  const rimIndex=rim.index.array;for(let i=0;i<rimIndex.length;i+=3)[rimIndex[i+1],rimIndex[i+2]]=[rimIndex[i+2],rimIndex[i+1]];rim.computeVertexNormals();mesh(root,rim,bodyMat,'marginal-scutes');
  const neck=ellipsoid(root,materials(p.skin),[0,-.01,-1.31],[species==='loggerhead'?.43:.30,.26,.52],'neck');
  const head=new THREE.Group();head.name='head-rig';head.position.set(0,.03,-1.78);root.add(head);
  const skull=surface(56,32,(u,v)=>{
    const a=u*TAU,r=Math.pow(Math.sin(v*Math.PI),.68),taper=species==='hawksbill'?1-.33*v:species==='loggerhead'?1-.05*v:1-.15*v;
    return [Math.cos(a)*p.head[0]*r*taper,.03+Math.sin(a)*p.head[1]*r,.32-p.head[2]*v];
  },(pos,u,v)=>{
    const underside=Math.max(0,-Math.sin(u*TAU)),c=mix(color(p.skin),color(p.belly),underside*.9);
    const scalePattern=Math.sin(u*TAU*10+Math.sin(v*31)) * Math.sin(v*26);
    if(underside<.1)c.lerp(color(p.dark),.1+.18*Math.max(0,scalePattern));return c;
  });
  const si=skull.index.array;for(let i=0;i<si.length;i+=3)[si[i+1],si[i+2]]=[si[i+2],si[i+1]];skull.computeVertexNormals();mesh(head,skull,skinMat,'head');
  const jaw=new THREE.Group();jaw.position.set(0,-.14,.08);head.add(jaw);
  ellipsoid(jaw,belly,[0,-.025,-.35],[species==='loggerhead'?.42:species==='hawksbill'?.23:.27,.13,species==='hawksbill'?.43:.34],'jaw');
  if(species==='hawksbill'){
    const beak=surface(28,16,(u,v)=>{const a=u*TAU,r=(1-v)*(.15+.02*Math.sin(v*Math.PI));return [Math.cos(a)*r,.045-v*v*.16+Math.sin(a)*r*.65,-.42-v*.43];},()=>color('#bfa575'));
    const bi=beak.index.array;for(let i=0;i<bi.length;i+=3)[bi[i+1],bi[i+2]]=[bi[i+2],bi[i+1]];beak.computeVertexNormals();mesh(head,beak,skinMat,'hooked-beak');
  }
  const mouthWidth=species==='loggerhead'?.43:species==='hawksbill'?.26:.29,nose=species==='hawksbill'?-.73:species==='loggerhead'?-.64:-.52;
  curveMesh(head,[[-mouthWidth,-.05,-.10],[-mouthWidth*.8,-.10,-.36],[0,-.11,nose],[mouthWidth*.8,-.10,-.36],[mouthWidth,-.05,-.10]],.009,dark,28).name='smile';
  const eyes=[],eyeSkin=materials(p.skin),eyeMat=new THREE.MeshPhysicalMaterial({color:'#1e261c',roughness:.13,clearcoat:1}),iris=materials(species==='hawksbill'?'#b98d39':'#8d713d'),pupil=materials('#14221f'),glint=new THREE.MeshBasicMaterial({color:'#fff7df'});
  for(const side of [-1,1]){
    const eye=new THREE.Group();eye.position.set(side*p.head[0]*.78,.15,-.28);eye.scale.setScalar(1.16);eye.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(side*.86,.09,-.51).normalize());head.add(eye);eyes.push(eye);
    ellipsoid(eye,eyeSkin,[0,0,-.01],[.12,.13,.06]);ellipsoid(eye,eyeMat,[0,0,.025],[.085,.10,.055]);ellipsoid(eye,iris,[0,0,.074],[.054,.064,.013]);ellipsoid(eye,pupil,[0,0,.086],[.035,.049,.008]);ellipsoid(eye,glint,[-.019,.028,.094],[.013,.016,.005]);
    ellipsoid(head,dark,[side*.09,.10,nose+.06],[.019,.013,.013],'nostril');
  }
  const forehead=new THREE.Group();forehead.name='prefrontal-scales';head.add(forehead);
  for(const side of [-1,1])for(let i=0;i<(species==='green'?1:2);i++){
    const scale=ellipsoid(forehead,dark,[side*.09,.29-i*.025,-.23-i*.14],[.068,.015,species==='green'?.13:.068]);scale.rotation.z=-side*.22;
  }
  const fins=[],rearFins=[];
  for(const side of [-1,1])for(const rear of [false,true]){
    const pivot=new THREE.Group();pivot.position.set(side*(rear?.69:.86),-.12,rear?1.10:-.72);pivot.userData.side=side;root.add(pivot);if(rear)pivot.rotation.y=-side*.35;
    const geometry=finGeometry(side,rear),pos=geometry.attributes.position,col=geometry.attributes.color;
    for(let i=0;i<pos.count;i++){
      const t=Math.abs(pos.getX(i))/(rear?.75:1.93),angle=(i%15)/14*TAU;
      // Paler flipper margins and tessellated skin colours are baked in once.
      const edge=Math.pow(Math.abs(Math.cos(angle)),10),c=mix(color(p.skin),color(p.belly),edge*.7+Math.max(0,-Math.sin(angle))*.65);
      c.lerp(color(p.dark),Math.max(0,Math.sin(t*41+Math.sin(angle*6))*Math.sin(angle*9))*.28);
      col.setXYZ(i,c.r,c.g,c.b);
      const reach=species==='green'?1:species==='hawksbill'?.95:.94;pos.setX(i,pos.getX(i)*reach);pos.setZ(i,pos.getZ(i)*(species==='loggerhead'?1.16:.96));
    }
    geometry.userData.rest=new Float32Array(pos.array);geometry.computeVertexNormals();
    const blade=mesh(pivot,geometry,skinMat,rear?'rear-flipper':'flipper');pivot.userData.blade=blade;(rear?rearFins:fins).push(pivot);
  }
  ellipsoid(root,materials(p.skin),[0,-.12,1.55],[.10,.08,.23],'tail');
  root.userData={fins,rearFins,jaw,head,eyes,species};return root;
}

export function animateTurtle(root,time,{slow=false,vx=0,vy=0,bite=0,happy=0}={}){
  const phase=time*(slow?2.25:2.9),stroke=Math.sin(phase);
  for(const fin of root.userData.fins){
    const side=fin.userData.side;fin.rotation.z=side*(-.10+Math.sin(phase+(slow?side*.35:0))*(slow?.14:.22));fin.rotation.y=side*(.04+Math.cos(phase)*.075);
    const geometry=fin.userData.blade.geometry,p=geometry.attributes.position,rest=geometry.userData.rest;
    for(let i=0;i<p.count;i++){const x=rest[i*3],u=Math.abs(x)/1.93;p.setY(i,rest[i*3+1]+Math.sin(phase-.8)*.16*u*u);}
    p.needsUpdate=true;geometry.computeVertexNormals();
  }
  for(const rear of root.userData.rearFins){rear.rotation.z=rear.userData.side*(.05+Math.sin(phase-.9)*.08);rear.rotation.x=vy*.025;}
  root.userData.head.rotation.set(Math.sin(time*.72)*.023-vy*.008-Math.sin(happy*Math.PI)*.085+(slow?.065:0),-vx*.012,Math.sin(time*.57)*.016);
  root.userData.jaw.rotation.x=bite>0?-.48*Math.sin(bite/.48*Math.PI):0;
  const blink=happy>0?Math.sin(Math.min(1,happy)*Math.PI)*.55:Math.pow(Math.max(0,Math.cos(time*.83)),70)*.75;
  for(const eye of root.userData.eyes)eye.scale.y=1.16*(1-blink);
}

function translucent(value,opacity,extra={}){
  return new THREE.MeshPhysicalMaterial({color:value,transparent:true,opacity,roughness:.24,metalness:0,side:THREE.DoubleSide,depthWrite:false,clearcoat:.8,clearcoatRoughness:.18,...extra});
}
function strip(parent,points,width,material,twist=0){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const geometry=surface(2,30,(u,v)=>{
    const p=curve.getPoint(v),a=twist+v*3.2,w=width*(.78+.22*Math.sin(v*15))*(1-.8*v);
    return [p.x+(u-.5)*2*w*Math.cos(a),p.y+(u-.5)*w*.3*Math.sin(v*13),p.z+(u-.5)*2*w*Math.sin(a)];
  });return mesh(parent,geometry,material);
}
function mergeStaticChildren(group){
  const bins=new Map();
  for(const object of group.children){if(!object.isMesh||object.name)continue;if(!bins.has(object.material))bins.set(object.material,[]);bins.get(object.material).push(object);}
  for(const [material,objects] of bins){
    if(objects.length<2)continue;
    const positions=[],normals=[],uvs=[];
    for(const object of objects){object.updateMatrix();const geometry=(object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone()).applyMatrix4(object.matrix),p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;positions.push(...p.array);normals.push(...n.array);if(uv)uvs.push(...uv.array);else uvs.push(...new Float32Array(p.count*2));geometry.dispose();group.remove(object);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));mesh(group,geometry,material);
  }
}
function jellySurface(u,v){
  const a=u*TAU,b=v*Math.PI*.515;
  const r=.665*Math.sin(b)*(1+.018*Math.cos(a*24)*Math.pow(v,7));
  return [Math.cos(a)*r,.49*Math.cos(b)-.024*Math.cos(a*24)*Math.pow(v,8),Math.sin(a)*r];
}
export function createJellyModel(){
  const root=new THREE.Group();root.name='jelly';
  const bell=new THREE.Group();bell.name='bell';root.add(bell);
  const membrane=translucent('#e3ede5',.40,{roughness:.16,emissive:'#578e91',emissiveIntensity:.10});
  const tissue=translucent('#e4e7c8',.54,{roughness:.35});
  const thread=translucent('#d9e8db',.64,{emissive:'#79a6a1',emissiveIntensity:.12});
  mesh(bell,surface(96,28,jellySurface),membrane,'outer-membrane');
  const inner=mesh(bell,surface(64,20,jellySurface),translucent('#c2ddc7',.14));inner.scale.set(.92,.85,.92);inner.position.y=.015;
  const edge=[];for(let i=0;i<=120;i++){const p=jellySurface(i/120,1);edge.push(p);}curveMesh(bell,edge,.009,thread,120,5);
  // Four translucent horseshoes and radial canals, inspired by moon jelly anatomy.
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2+Math.PI/4,pts=[];
    for(let j=0;j<=22;j++){const b=.32+j/22*Math.PI*1.75,rr=.092;pts.push([Math.cos(a)*.13+Math.cos(b)*rr,.24+Math.sin(b)*.008,Math.sin(a)*.13+Math.sin(b)*rr]);}
    curveMesh(bell,pts,.018,tissue,24);
  }
  for(let i=0;i<16;i++){
    const pts=[];for(let j=0;j<=20;j++){const v=.22+j/20*.78,p=jellySurface(i/16+.004*Math.sin(v*8),v);p[1]-=.018;pts.push(p);}curveMesh(bell,pts,i%2?.0035:.005,thread,22,4);
  }
  for(let i=0;i<24;i++){
    const a=i/24*TAU,rootlet=new THREE.Group();rootlet.name='tendril';rootlet.userData.phase=i*.7;rootlet.position.set(Math.cos(a)*.628,-.04,Math.sin(a)*.628);root.add(rootlet);
    const pts=[];const length=.72+.36*(.5+.5*Math.sin(i*2.3));
    for(let j=0;j<=14;j++){const t=j/14;pts.push([Math.sin(t*5+i)*.065*t,-t*length,Math.cos(t*6+i)*.075*t]);}
    curveMesh(rootlet,pts,.0045,thread,18,4);
  }
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2+.4,arm=new THREE.Group();arm.name='tendril';arm.userData.phase=i*1.5;arm.position.set(Math.cos(a)*.12,.10,Math.sin(a)*.12);root.add(arm);
    const pts=[];for(let j=0;j<=14;j++){const t=j/14;pts.push([Math.cos(a+t*3)*.13*t,-t*(1.35+i%2*.13),Math.sin(a+t*4)*.15*t]);}
    const tissueStrip=strip(arm,pts,.10,tissue,a);if(i===0)tissueStrip.name='oral-arms';curveMesh(arm,pts,.013,thread,22,5);
  }
  mergeStaticChildren(bell);return root;
}
export function createMoonModel(){
  const root=new THREE.Group();root.name='moon';root.userData.pulseSpeed=1.65;
  const bell=new THREE.Group();bell.name='bell';root.add(bell);
  const skin=translucent('#ddd9f3',.40,{roughness:.18,emissive:'#7d7ca5',emissiveIntensity:.09});
  const tissue=translucent('#e9c6e1',.75,{roughness:.36});
  const thread=translucent('#f0e5f5',.70);
  const point=(u,v)=>{const a=u*TAU,b=v*Math.PI*.52,r=.76*Math.sin(b);return [Math.cos(a)*r,.29*Math.cos(b)-.014*Math.cos(a*32)*Math.pow(v,8),Math.sin(a)*r];};
  mesh(bell,surface(80,24,point),skin,'moon-disc');
  const inner=mesh(bell,surface(56,18,point),translucent('#c9cee8',.19));inner.scale.set(.92,.80,.92);
  const organs=new THREE.Group();organs.name='four-horseshoes';bell.add(organs);
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2+Math.PI/4,pts=[];
    for(let j=0;j<=25;j++){const b=.3+j/25*Math.PI*1.78;pts.push([Math.cos(a)*.21+Math.cos(b)*.11,.16+Math.sin(b)*.008,Math.sin(a)*.21+Math.sin(b)*.11]);}
    curveMesh(organs,pts,.022,tissue,24,5);
  }
  const rim=[];for(let i=0;i<=96;i++)rim.push(point(i/96,1));curveMesh(bell,rim,.013,thread,96,5).name='moon-fringe';
  for(let i=0;i<16;i++){
    const a=i/16*TAU,arm=flutterGroup(root,[Math.cos(a)*.73,-.025,Math.sin(a)*.73],i*.7);arm.name='tendril';
    curveMesh(arm,[[0,0,0],[Math.cos(a)*.035,-.10,Math.sin(a)*.035],[Math.cos(a+.5)*.06,-.22-(i%3)*.035,Math.sin(a+.5)*.06]],.006,thread,10,4);
  }
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2,arm=flutterGroup(root,[Math.cos(a)*.15,.04,Math.sin(a)*.15],i);arm.name='tendril';
    strip(arm,[[0,0,0],[Math.cos(a)*.06,-.20,Math.sin(a)*.06],[Math.cos(a+1)*.12,-.44,Math.sin(a+1)*.12],[Math.cos(a+2)*.10,-.66,Math.sin(a+2)*.10]],.075,tissue,a);
  }
  mergeStaticChildren(bell);return root;
}
export function createCompassModel(){
  const root=new THREE.Group();root.name='compass';root.userData.pulseSpeed=2.45;
  const bell=new THREE.Group();bell.name='bell';root.add(bell);
  const skin=translucent('#f3dfbf',.43,{roughness:.18,emissive:'#a48068',emissiveIntensity:.08});
  const stripe=translucent('#c98166',.73,{roughness:.42});
  const tissue=translucent('#f3cfb0',.64),thread=translucent('#edd9be',.70);
  const point=(u,v)=>{const a=u*TAU,b=v*Math.PI*.515,r=.64*Math.sin(b)*(1+.02*Math.cos(a*16)*Math.pow(v,7));return [Math.cos(a)*r,.54*Math.cos(b)-.025*Math.cos(a*16)*Math.pow(v,8),Math.sin(a)*r];};
  mesh(bell,surface(80,28,point),skin,'compass-bell');
  const spokes=new THREE.Group();spokes.name='compass-stripes';bell.add(spokes);
  for(let i=0;i<16;i++){
    const ribbon=surface(4,18,(u,v)=>{const offset=(u-.5)*(.006+.018*v),p=point(i/16+offset,.18+v*.76);p[1]+=.003;return p;});mesh(spokes,ribbon,stripe);
  }
  mergeStaticChildren(spokes);
  const edge=[];for(let i=0;i<=80;i++)edge.push(point(i/80,1));curveMesh(bell,edge,.012,tissue,80,5);
  const veil=new THREE.Group();veil.name='compass-oral-arms';root.add(veil);
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2,arm=flutterGroup(veil,[Math.cos(a)*.12,.06,Math.sin(a)*.12],i*.9);arm.name='tendril';
    strip(arm,[[0,0,0],[Math.cos(a)*.08,-.25,Math.sin(a)*.08],[Math.cos(a+1)*.17,-.63,Math.sin(a+1)*.17],[Math.cos(a+2)*.14,-1.10,Math.sin(a+2)*.14]],.105,tissue,a);
  }
  for(let i=0;i<16;i++){
    const a=i/16*TAU,arm=flutterGroup(root,[Math.cos(a)*.61,-.04,Math.sin(a)*.61],i*.73);arm.name='tendril';
    const length=.85+.38*(.5+.5*Math.sin(i*2.1));
    curveMesh(arm,[[0,0,0],[Math.sin(a)*.04,-length*.3,Math.cos(a)*.04],[Math.sin(a+1)*.09,-length*.7,Math.cos(a+1)*.09],[Math.sin(a+2)*.12,-length,Math.cos(a+2)*.12]],.006,thread,16,4);
  }
  mergeStaticChildren(bell);return root;
}
function plasticPalette(){return {sheet:translucent('#e0e9e0',.40,{roughness:.31,clearcoat:1}),fold:translucent('#e3ede0',.60,{roughness:.38}),ink:translucent('#769c95',.55,{roughness:.8})};}
function flutterGroup(root,position,phase){const g=new THREE.Group();g.position.set(...position);g.name='ribbon';g.userData.phase=phase;root.add(g);return g;}
export function createBagModel(){
  const root=new THREE.Group(),p=plasticPalette();root.name='bag';
  const point=(u,v)=>{
    const a=u*TAU,b=v*Math.PI*.55,r=.68*Math.sin(b),fold=Math.pow(v,.75)*(.022*Math.sin(a*9+v*6)+.012*Math.sin(a*17-v*8));
    return [Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.82)*(r+fold),.50*Math.cos(b)+.03*Math.cos(a*7+v*3)*v,Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.82)*(r+fold)*.80];
  };
  mesh(root,surface(72,32,point),p.sheet);
  const rim=[];for(let i=0;i<=100;i++)rim.push(point(i/100,1));curveMesh(root,rim,.009,p.fold,100,4);
  for(const side of [-1,1]){
    const loop=flutterGroup(root,[side*.29,-.11,0],side);const path=[[-.14,0,0],[-.18,-.30,.025],[-.11,-.72,.07],[.03,-.85,.04],[.18,-.65,.015],[.16,-.23,-.02],[.13,0,0]];
    // Flat folded handles, not round tentacles.
    strip(loop,path,.052,p.fold,0).name=side<0?'flat-handle-left':'flat-handle-right';
    const seam=[];for(let j=0;j<=26;j++)seam.push(point(side>0?.02:.52,.10+j/26*.90));const sealed=curveMesh(root,seam,.008,p.fold,28,4);if(side<0)sealed.name='sealed-edge';
  }
  for(let i=0;i<5;i++){
    const points=[];for(let j=0;j<=16;j++)points.push(point(.08+i*.18,.30+j/16*.65));curveMesh(root,points,.0035,p.fold,18,3);
  }
  // A faint, broken printed mark is only legible at close range.
  const mark=curveMesh(root,[[-.12,.20,.48],[-.17,.07,.50],[-.04,.08,.53]],.009,p.ink,10,4);mark.name='printed-mark';
  curveMesh(root,[[.02,.08,.53],[.15,.08,.51],[.10,.20,.49]],.009,p.ink,10,4);
  return root;
}
export function createBalloonModel(){
  const root=new THREE.Group(),p=plasticPalette();root.name='balloon';
  const point=(u,v)=>{
    const a=u*TAU,b=v*Math.PI,r=Math.sin(b)*(.68-.19*v),wrinkle=.012*Math.sin(a*13+v*7)*Math.pow(v,3);
    return [Math.cos(a)*(r+wrinkle),.48*Math.cos(b),Math.sin(a)*(r+wrinkle)*.86];
  };
  mesh(root,surface(64,36,point),translucent('#e1e0c9',.46,{roughness:.28}));
  const seam=[];for(let j=0;j<=50;j++)seam.push(point(.25,j/50));for(let j=50;j>=0;j--)seam.push(point(.75,j/50));curveMesh(root,seam,.007,p.fold,100,4).name='balloon-seam';
  const knot=new THREE.Mesh(new THREE.ConeGeometry(.065,.13,10),p.fold);knot.name='tied-knot';knot.position.y=-.49;knot.rotation.z=Math.PI;root.add(knot);
  const ribbon=flutterGroup(root,[0,-.54,0],1.8);
  strip(ribbon,[[0,0,0],[.06,-.2,.08],[-.13,-.45,.1],[-.06,-.72,-.05],[.16,-1.0,0]],.025,p.fold,.3).name='balloon-ribbon';
  curveMesh(ribbon,[[0,0,0],[-.08,-.3,-.06],[.12,-.66,-.08],[.02,-1.02,.06]],.005,p.fold,26,4);return root;
}
export function createFilmModel(){
  const root=new THREE.Group(),p=plasticPalette();root.name='film';
  const point=(u,v)=>{
    const a=u*TAU,b=v*Math.PI*.53,r=.665*Math.sin(b)*(1+.045*Math.cos(a*5)*Math.pow(v,4));
    return [Math.cos(a)*r,.47*Math.cos(b)+.035*Math.sin(a*8+v*9)*v,Math.sin(a)*r*(1+.045*Math.sin(a*7))];
  };mesh(root,surface(80,28,point),p.sheet);
  for(let i=0;i<6;i++){
    const a=i/6*TAU,ribbon=flutterGroup(root,[Math.cos(a)*.54,-.03,Math.sin(a)*.54],i*.8);
    const length=.72+.24*(i%3)/2;const torn=strip(ribbon,[[0,0,0],[.09,-.26,.05],[-.07,-length*.67,-.06],[.02,-length,.10]],.08,p.fold,a);if(i===0)torn.name='torn-edge';
  }
  for(let i=0;i<5;i++){const pts=[];for(let j=0;j<=16;j++)pts.push(point(.08+i*.19,.22+j/16*.78));const fold=curveMesh(root,pts,.005,p.fold,22,4);if(i===0)fold.name='film-crease';}
  return root;
}
export function createGloveModel(){
  const root=new THREE.Group(),p=plasticPalette();root.name='glove';
  // Flattened rectangular palm and a lateral thumb read as a hand up close.
  const palm=surface(64,32,(u,v)=>{
    const a=u*TAU,b=v*Math.PI,r=Math.pow(Math.sin(b),.36),x=Math.cos(a);
    return [Math.sign(x)*Math.pow(Math.abs(x),.48)*.37*r,.20+.36*Math.cos(b),Math.sin(a)*r*.115+.008*Math.sin(v*19)*r];
  });mesh(root,palm,p.sheet,'flat-palm');
  const cuff=new THREE.Mesh(new THREE.TorusGeometry(.205,.016,6,48),p.fold);cuff.name='rolled-cuff';cuff.rotation.x=Math.PI/2;cuff.position.y=.54;cuff.scale.set(1,.52,1);root.add(cuff);
  for(let i=0;i<4;i++){
    const x=(i-1.5)*.19,finger=flutterGroup(root,[x,-.09,.01],i*.9),length=[.56,.77,.73,.57][i];
    const geom=surface(18,22,(u,v)=>{const a=u*TAU,r=.083*Math.pow(Math.sin(Math.PI*(.32+v*.68)),.35);return [Math.cos(a)*r+x*.30*v,-length*v,.035*Math.sin(v*4)+Math.sin(a)*r*.68];});mesh(finger,geom,p.sheet,`glove-finger-${i+1}`);
    curveMesh(finger,[[.055,0,.03],[.065,-length*.5,.05],[.025,-length*.96,.01]],.004,p.fold,16,4);
  }
  const thumb=flutterGroup(root,[-.32,.24,.01],3.2);curveMesh(thumb,[[0,0,0],[-.18,-.06,.01],[-.31,-.20,.035],[-.29,-.36,.045]],.083,p.sheet,22,10).name='side-thumb';
  ellipsoid(thumb,p.sheet,[-.29,-.36,.045],[.082,.082,.065]);
  curveMesh(root,[[-.29,.19,.11],[-.15,.13,.123],[.03,.12,.125],[.24,.17,.11]],.006,p.fold,20,4).name='palm-crease';
  for(let i=0;i<3;i++)curveMesh(root,[[-.22+i*.19,.36,.10],[-.20+i*.19,.24,.12],[-.24+i*.19,.02,.11]],.0035,p.fold,14,4);
  return root;
}
export function createBottleModel(){
  const root=new THREE.Group();root.name='bottle';
  const plastic=translucent('#c7e3e1',.42,{roughness:.20}),edge=translucent('#e1eee4',.63),ink=translucent('#b9c9bd',.78,{roughness:.65});
  const radius=v=>v<.16?.13:v<.32?.13+(v-.16)/.16*.22:v>.91?.35-(v-.91)/.09*.07:.35;
  const point=(u,v)=>{const a=u*TAU,r=radius(v),dent=v>.30&&v<.88?.028*Math.sin(a*5+v*13):0;return [Math.cos(a)*(r+dent),.68-1.30*v,Math.sin(a)*(r+dent)*.90];};
  mesh(root,surface(48,40,point),plastic,'bottle-body');
  const cap=mesh(root,new THREE.CylinderGeometry(.151,.151,.12,20),translucent('#99bdb3',.90,{roughness:.48}),'screw-cap');cap.position.y=.70;
  for(let i=0;i<12;i++){const a=i/12*TAU;curveMesh(cap,[[Math.cos(a)*.153,-.045,Math.sin(a)*.153],[Math.cos(a)*.153,.045,Math.sin(a)*.153]],.005,edge,2,3);}
  for(const v of [.37,.75,.86]){const pts=[];for(let i=0;i<=48;i++)pts.push(point(i/48,v));curveMesh(root,pts,.009,edge,48,4);}
  mesh(root,surface(48,8,(u,v)=>{const p=point(u,.48+v*.18);p[0]*=1.018;p[2]*=1.018;return p;}),ink,'bottle-label');
  const mark=curveMesh(root,[[-.10,-.01,.328],[-.15,-.12,.329],[-.02,-.12,.329]],.012,translucent('#73978e',.75),10,4);mark.name='bottle-print';
  mesh(root,new THREE.CircleGeometry(.28,32),plastic,'bottle-base').rotation.x=Math.PI/2;root.getObjectByName('bottle-base').position.y=-.62;
  return root;
}
export function createCupModel(){
  const root=new THREE.Group();root.name='cup';
  const plastic=translucent('#eee3cf',.48,{roughness:.34}),rimMat=translucent('#f0e7d3',.77),printMat=translucent('#c8957a',.62,{roughness:.56});
  const point=(u,v)=>{const a=u*TAU,r=.28+.20*v;return [Math.cos(a)*r,.40-.76*v,Math.sin(a)*r];};
  mesh(root,surface(48,16,point),plastic,'rigid-cup');
  const base=mesh(root,new THREE.CircleGeometry(.28,40),plastic,'cup-base');base.rotation.x=-Math.PI/2;base.position.y=.40;
  const rim=mesh(root,new THREE.TorusGeometry(.48,.023,7,56),rimMat,'rolled-rim');rim.rotation.x=Math.PI/2;rim.position.y=-.36;
  mesh(root,surface(48,6,(u,v)=>{const p=point(u,.37+v*.18);p[0]*=1.008;p[2]*=1.008;return p;}),printMat,'printed-band');
  const straw=curveMesh(root,[[.12,-.04,.06],[.12,-.56,.06],[.17,-.80,.06],[.37,-.92,.06]],.025,rimMat,22,7);straw.name='bent-straw';
  for(let i=0;i<3;i++){const ring=mesh(root,new THREE.TorusGeometry(.027,.004,4,12),printMat);ring.position.set(.15+i*.008,-.72-i*.025,.06);ring.rotation.x=Math.PI/2;}
  return root;
}
export function createMaskModel(){
  const root=new THREE.Group();root.name='mask';
  const cloth=translucent('#b9d8de',.72,{roughness:.83,clearcoat:0}),seam=translucent('#e4e9df',.85,{roughness:.75});
  const point=(u,v)=>{const x=(u-.5)*1.04,y=(v-.5)*.62,z=.07*Math.cos(x*2.4)+.035*Math.sin(v*Math.PI*6)+.018*Math.sin(u*8+v*3);return [x,y,z];};
  mesh(root,surface(32,26,point),cloth,'pleated-panel');
  for(let i=0;i<3;i++){
    const pts=[];for(let j=0;j<=24;j++)pts.push(point(j/24,.19+i*.27));curveMesh(root,pts,.008,seam,24,4).name=`mask-pleat-${i+1}`;
  }
  for(const v of [0,1]){const pts=[];for(let i=0;i<=24;i++)pts.push(point(i/24,v));curveMesh(root,pts,.012,seam,24,5);}
  for(const side of [-1,1]){
    curveMesh(root,[[side*.52,-.31,.04],[side*.52,0,.07],[side*.52,.31,.04]],.012,seam,12,5);
    const loop=flutterGroup(root,[side*.51,.16,.025],side);
    curveMesh(loop,[[0,.08,0],[side*.24,-.02,.015],[side*.29,-.28,.035],[side*.20,-.61,.055],[side*.02,-.59,.025],[0,-.34,0]],.014,seam,28,6).name=side<0?'ear-loop-left':'ear-loop-right';
  }
  curveMesh(root,[[-.22,.292,.047],[0,.309,.079],[.22,.292,.047]],.018,translucent('#b8c6c5',.8),18,5).name='nose-wire';
  return root;
}
function varyTarget(root,type,variant){
  root.userData.variant=variant;if(!variant)return root;
  const dimensions={jelly:[[1.09,.83,.94],[.91,1.12,1.06]],moon:[[1.10,.86,.96],[.91,1.10,1.05]],compass:[[1.08,.89,.95],[.92,1.09,1.06]],bag:[[.88,1.16,1.06],[1.11,.88,.87]],balloon:[[.91,1.15,.93],[1.09,.89,1.06]],film:[[1.08,.92,.91],[.92,1.13,1.07]],glove:[[1.06,.93,.9],[.92,1.12,1.08]],bottle:[[1.10,.87,.83],[.91,1.08,1.04]],cup:[[1.09,.88,.94],[.91,1.13,1.05]],mask:[[1.08,.88,.90],[.91,1.12,1.08]]}[type][variant-1];
  const [sx,sy,sz]=dimensions;
  if(root.userData.guidePins)root.userData.guidePins=root.userData.guidePins.map(([x,y,z])=>[x*sx+(variant===1?.055:-.045)*y*y,y*sy,z*sz+Math.sin(y*3+x*2)*.025*variant]);
  root.traverse(o=>{
    if(o!==root)o.position.multiply(new THREE.Vector3(sx,sy,sz));
    if(!o.isMesh)return;
    o.geometry=o.geometry.clone();const p=o.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      p.setXYZ(i,x*sx+(variant===1?.055:-.045)*y*y,y*sy,z*sz+Math.sin(y*3+x*2)*.025*variant);
    }
    p.needsUpdate=true;o.geometry.computeVertexNormals();o.geometry.computeBoundingSphere();
  });
  // Different lengths and curls retain the defining handles, knot, torn edge or fingers.
  let index=0;root.traverse(child=>{if(['ribbon','tendril'].includes(child.name)){
    child.scale.y=.88+.20*(.5+.5*Math.sin(index*2.3+variant));child.userData.phase+=variant*.73;index++;
  }});
  return root;
}
export function createTargetModels(variant=0){
  const selected=Number.isInteger(variant)&&variant>=0&&variant<VARIANT_COUNT?variant:0;
  const models={jelly:createJellyModel(),moon:createMoonModel(),compass:createCompassModel(),bag:createBagModel(),balloon:createBalloonModel(),film:createFilmModel(),glove:createGloveModel(),bottle:createBottleModel(),cup:createCupModel(),mask:createMaskModel()};
  const clues={jelly:['outer-membrane','oral-arms'],moon:['four-horseshoes','moon-fringe'],compass:['compass-stripes','compass-oral-arms'],bag:['flat-handle-right','sealed-edge'],balloon:['tied-knot','balloon-seam'],film:['torn-edge','film-crease'],glove:['glove-finger-2','rolled-cuff'],bottle:['screw-cap','bottle-label'],cup:['rolled-rim','bent-straw'],mask:['mask-pleat-2','ear-loop-right']};
  const pins={jelly:[[.40,.25,.40],[.12,-.83,.12]],moon:[[.22,.17,.18],[.65,-.12,.20]],compass:[[.30,.35,.36],[.12,-.70,.12]],bag:[[.29,-.56,.04],[-.55,.10,.10]],balloon:[[0,-.49,0],[0,.12,.46]],film:[[.52,-.48,0],[-.3,.22,.45]],glove:[[-.11,-.48,.04],[0,.54,.05]],bottle:[[0,.70,.12],[.10,-.06,.32]],cup:[[.40,-.36,.15],[.17,-.78,.06]],mask:[[0,-.02,.10],[.75,-.14,.04]]};
  for(const [type,model] of Object.entries(models)){
    model.userData.kind=isFood(type)?'food':'trash';model.userData.clueNames=clues[type];model.userData.guidePins=pins[type];
    varyTarget(model,type,selected);
  }return models;
}

export function createDistantTurtle(){
  const root=new THREE.Group(),skin=materials('#486e71'),fins=[];
  mesh(root,surface(48,20,shellShape),skin);ellipsoid(root,skin,[0,0,-1.8],[.29,.23,.52]);
  for(const side of [-1,1]){
    const fin=new THREE.Group();fin.position.set(side*.85,-.1,-.7);fin.userData.side=side;mesh(fin,finGeometry(side),skin);root.add(fin);fins.push(fin);
    const rear=mesh(root,finGeometry(side,true),skin);rear.position.set(side*.65,-.15,1.1);
  }
  root.userData.fins=fins;return root;
}

export function animateJelly(root,time,phase=0){
  const pulse=time*(root.userData.pulseSpeed||2.15)+phase;
  const bell=root.getObjectByName('bell'),contract=.5+.5*Math.sin(pulse),edgeScale=1-contract*.085;
  if(bell)bell.scale.set(edgeScale,1+contract*.11,edgeScale);
  root.traverse(child=>{
    if(child.name!=='tendril')return;
    child.userData.baseX??=child.position.x;child.userData.baseZ??=child.position.z;child.position.x=child.userData.baseX*edgeScale;child.position.z=child.userData.baseZ*edgeScale;
    const a=child.userData.phase+phase;child.rotation.z=Math.sin(time*1.65+a)*.12;child.rotation.x=Math.cos(time*1.43+a)*.10;
    child.position.y=child.userData.baseY??(child.userData.baseY=child.position.y);child.position.y+=Math.sin(pulse)*.018;
  });
}
