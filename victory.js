import * as THREE from './vendor/three.module.js';

export const VICTORY_SECONDS=4.6;
export const VICTORY_REDUCED_SECONDS=1.5;
export const SPECIAL_VICTORY_SECONDS=10;

const {clamp,lerp,smoothstep}=THREE.MathUtils;

function swimPath(time,player){
  const rise=smoothstep(time,.04,.82);
  const distance=smoothstep(time,0,.86);
  return {
    x:lerp(player.x,.55,distance)-Math.sin(time*Math.PI)*.65,
    y:lerp(player.y,6.65,rise),
    z:lerp(4.1,-4.2,distance),
  };
}

export function victoryPose(elapsed,player,aspect,reduced=false,start={}){
  const time=reduced?1:clamp(elapsed/VICTORY_SECONDS,0,1);
  const path=swimPath(time,player);
  const lift=smoothstep(time,.02,.22)*(1-smoothstep(time,.57,.86));
  const reveal=smoothstep(time,.51,.77);
  const gesture=smoothstep(time,.70,.86);
  const wave=gesture*(1-smoothstep(time,.88,1))*Math.sin((time-.74)*Math.PI*10);
  const orbit=lerp(.65,1.36,smoothstep(time,.04,.88));
  const distance=clamp(11.2/Math.sqrt(aspect),8.5,14.6)*(1-.09*reveal);
  const cameraHeight=lerp(1.7,-1.35,smoothstep(time,.04,.49))+1.57*reveal;
  const bank=Math.sin(time*Math.PI)*.09;
  const ready=smoothstep(time,0,.18);
  return {
    ...path,
    pitch:lerp(start.pitch??0,.31*lift+.035*gesture,ready),
    yaw:lerp(lerp(start.yaw??0,.2,ready),orbit-Math.PI-.22,reveal),
    roll:lerp(start.roll??0,bank-.04*gesture,ready),
    scale:lerp(start.scale??.77,.87,smoothstep(time,0,.45)),
    light:smoothstep(time,.10,.78),
    gesture,wave,
    cameraX:path.x+Math.sin(orbit)*distance,
    cameraY:path.y+cameraHeight,
    cameraZ:path.z+Math.cos(orbit)*distance,
    focusY:path.y+lerp(.25,.39,reveal),
    fov:aspect<1?57:43,
  };
}

function coralSwimPath(time,player){
  const travel=smoothstep(time,0,.83);
  const rise=smoothstep(time,.06,.81);
  const sweep=Math.sin(time*Math.PI*2.28)*Math.sin(time*Math.PI)**2;
  return {
    x:lerp(player.x,.25,travel)+sweep*2.5,
    y:lerp(player.y,7.8,rise)+Math.sin(time*Math.PI)*.55,
    z:lerp(4.1,-8,travel)-.7*Math.sin(time*Math.PI),
  };
}

export function coralVictoryPose(elapsed,player,aspect,reduced=false,start={}){
  const time=reduced?1:clamp(elapsed/SPECIAL_VICTORY_SECONDS,0,1);
  const path=coralSwimPath(time,player);
  const ready=smoothstep(time,0,.12);
  const climb=smoothstep(time,.04,.25)*(1-smoothstep(time,.55,.74));
  const turn=smoothstep(time,.45,.76);
  const gesture=smoothstep(time,.76,.90);
  const orbit=.54+1.86*smoothstep(time,.02,.56)-.96*smoothstep(time,.60,.94);
  const distance=clamp(11.8/Math.sqrt(aspect),9.3,17.4)+1.3*climb-.55*gesture;
  const cameraHeight=1.65-3.55*smoothstep(time,.06,.48)+2.05*smoothstep(time,.55,.89);
  const swimmingYaw=.34-.66*Math.sin(time*Math.PI*1.8);
  return {
    ...path,
    pitch:lerp(start.pitch??0,.42*climb+.19*gesture,ready),
    yaw:lerp(lerp(start.yaw??0,swimmingYaw,ready),orbit-Math.PI-.16,turn),
    roll:lerp(start.roll??0,Math.sin(time*Math.PI*3.3)*.21*climb-.06*gesture,ready),
    scale:lerp(start.scale??.77,.93,smoothstep(time,0,.41)),
    light:smoothstep(time,.06,.58),
    gesture,
    wave:Math.sin(time*Math.PI*9)*climb,
    cameraX:path.x+Math.sin(orbit)*distance,
    cameraY:path.y+cameraHeight,
    cameraZ:path.z+Math.cos(orbit)*distance,
    focusY:path.y+lerp(.2,.44,gesture),
    fov:aspect<1?57:43,
  };
}

export function createVictoryLight(){
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(33,27),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{uLight:{value:0},uTime:{value:0},uCoral:{value:0}},
    vertexShader:`
      varying vec2 vUv;
      void main(){
        vUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader:`
      uniform float uLight;
      uniform float uTime;
      uniform float uCoral;
      varying vec2 vUv;
      void main(){
        vec2 p=(vUv-.5)*2.;
        float distanceToLight=length(p);
        float halo=(1.-smoothstep(.12,1.,distanceToLight))*.22;
        float center=exp(-distanceToLight*distanceToLight*16.)*.31;
        float wave=.7+.3*sin(p.x*23.+p.y*15.+sin(p.y*8.-uTime)+uTime*1.4);
        vec3 warm=vec3(.99,.94,.72);
        vec3 coral=mix(vec3(.86,.36,.55),vec3(1.,.72,.42),1.-smoothstep(.06,.92,distanceToLight));
        gl_FragColor=vec4(mix(warm,coral,uCoral),(halo*wave+center)*uLight);
      }`,
  }));
  glow.rotation.x=Math.PI/2;
  glow.renderOrder=-1;
  glow.visible=false;
  return glow;
}

export function createCoralCelebration(){
  const ribbonCount=114,pearlsPerBurst=24,laurelCount=34;
  const bursts=[{at:2.32,life:2.15},{at:4.72,life:2.42},{at:6.60,life:3.05}];
  const count=ribbonCount+bursts.length*pearlsPerBurst+laurelCount;
  const geometry=new THREE.BufferGeometry();
  const positions=new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage);
  const opacity=new THREE.BufferAttribute(new Float32Array(count),1).setUsage(THREE.DynamicDrawUsage);
  const sizes=Float32Array.from({length:count},(_,i)=>.23+(i%9)*.078);
  const kinds=Float32Array.from({length:count},(_,i)=>i<ribbonCount?0:i%3+1);
  geometry.setAttribute('position',positions);
  geometry.setAttribute('aOpacity',opacity);
  geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
  geometry.setAttribute('aKind',new THREE.BufferAttribute(kinds,1));
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    uniforms:{uPixelRatio:{value:Math.min(globalThis.devicePixelRatio||1,1.75)}},
    vertexShader:`
      attribute float aOpacity;
      attribute float aSize;
      attribute float aKind;
      uniform float uPixelRatio;
      varying float vOpacity;
      varying float vKind;
      void main(){
        vec4 point=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*point;
        gl_PointSize=clamp(330.*aSize/max(3.,-point.z),2.,23.)*uPixelRatio;
        vOpacity=aOpacity;
        vKind=aKind;
      }`,
    fragmentShader:`
      varying float vOpacity;
      varying float vKind;
      void main(){
        vec2 p=gl_PointCoord-.5;
        float r=length(p);
        float line=(r-.37)*21.;
        float reflection=exp(-pow(length(p-vec2(-.13,-.15))*11.,2.));
        float bubble=exp(-line*line)*.63+reflection*.60;
        float pearl=(1.-smoothstep(.21,.38,r))*.78+reflection*.40+(1.-smoothstep(.30,.49,r))*.14;
        vec3 tint=vec3(.72,.98,.96);
        if(vKind>.5)tint=vec3(1.,.65,.52);
        if(vKind>1.5)tint=vec3(.96,.81,.48);
        if(vKind>2.5)tint=vec3(.80,.69,1.);
        gl_FragColor=vec4(tint,min(1.,vKind<.5?bubble:pearl)*vOpacity);
      }`,
  });
  const mesh=new THREE.Points(geometry,material);
  mesh.visible=false;
  mesh.frustumCulled=false;
  mesh.renderOrder=2;

  function drawRibbon(elapsed,player){
    for(let i=0;i<ribbonCount;i++){
      const side=i%2===0?-1:1;
      const birth=.10+Math.floor(i/2)*.145+(i%2)*.032;
      const age=elapsed-birth,life=2.75+(i%7)*.17;
      if(age<=0||age>=life){opacity.setX(i,0);continue;}
      const origin=coralSwimPath(birth/SPECIAL_VICTORY_SECONDS,player);
      const turn=birth*2.7+age*1.23;
      positions.setXYZ(i,
        origin.x+side*(1.10+.64*Math.sin(turn)+age*.26),
        origin.y-.46+age*(.48+(i%5)*.11)+Math.sin(turn+.7)*.38,
        origin.z+1+age*.52+Math.cos(turn)*.39,
      );
      const fade=smoothstep(age,0,.28)*(1-smoothstep(age,life-.79,life));
      opacity.setX(i,fade*(1-smoothstep(elapsed,8.2,9.45))*.86);
    }
  }

  function drawPearls(elapsed,player){
    bursts.forEach(({at,life},burst)=>{
      const origin=coralSwimPath(at/SPECIAL_VICTORY_SECONDS,player);
      for(let j=0;j<pearlsPerBurst;j++){
        const i=ribbonCount+burst*pearlsPerBurst+j;
        const age=elapsed-at-(j%4)*.045;
        if(age<=0||age>=life){opacity.setX(i,0);continue;}
        const angle=j*Math.PI*2/pearlsPerBurst+burst*.22;
        const radius=.58+(1-Math.exp(-age*1.4))*(3.2+(j%5)*.38);
        const horizontal=Math.cos(angle)*radius;
        const depth=-1.95+Math.sin(j*2.4)*.5;
        positions.setXYZ(i,origin.x+horizontal*.29+depth*.86,origin.y+Math.sin(angle)*radius*.74+age*.36,origin.z-horizontal*.96+depth*.33);
        opacity.setX(i,smoothstep(age,0,.28)*(1-smoothstep(age,life-.90,life))*.88);
      }
    });
  }

  function drawLaurel(elapsed,player,scale){
    const center=coralSwimPath(1,player);
    const reveal=smoothstep(elapsed,7.7,9.52);
    const radius=lerp(3.1,4.15,reveal);
    for(let j=0;j<laurelCount;j++){
      const i=count-laurelCount+j;
      const angle=.16+j/(laurelCount-1)*(Math.PI-.32);
      const offset=radius+Math.sin(j*2.08)*.34;
      const horizontal=Math.cos(angle)*offset;
      positions.setXYZ(i,center.x+(horizontal*.15-1.9)*scale,center.y+(-.26+Math.sin(angle)*offset*.57)*scale,center.z-(horizontal+1.15)*scale);
      opacity.setX(i,reveal*(.57+(j%4)*.085));
    }
  }

  return {
    mesh,
    update(elapsed,player,reduced=false,scale=1){
      mesh.visible=!!player;
      if(!player)return;
      const time=reduced?SPECIAL_VICTORY_SECONDS:elapsed;
      drawRibbon(time,player);drawPearls(time,player);drawLaurel(time,player,scale);
      positions.needsUpdate=true;opacity.needsUpdate=true;
    },
  };
}

export function createVictoryBubbles(){
  const count=36,geometry=new THREE.BufferGeometry();
  const positions=new THREE.BufferAttribute(new Float32Array(count*3),3);
  const opacity=new THREE.BufferAttribute(new Float32Array(count),1);
  const sizes=Float32Array.from({length:count},(_,i)=>.27+(i%7)*.092);
  geometry.setAttribute('position',positions);
  geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
  geometry.setAttribute('aOpacity',opacity);
  const pixelRatio=Math.min(globalThis.devicePixelRatio||1,1.75);
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    uniforms:{uPixelRatio:{value:pixelRatio}},
    vertexShader:`
      attribute float aSize;
      attribute float aOpacity;
      uniform float uPixelRatio;
      varying float vOpacity;
      void main(){
        vec4 point=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*point;
        gl_PointSize=clamp(210.*aSize/max(2.,-point.z),2.,21.)*uPixelRatio;
        vOpacity=aOpacity;
      }`,
    fragmentShader:`
      varying float vOpacity;
      void main(){
        vec2 uv=gl_PointCoord-.5;
        float radius=length(uv);
        float rim=(radius-.37)*21.;
        float edge=exp(-rim*rim)*(.72-.34*uv.y);
        float gleam=exp(-pow(length(uv-vec2(-.16,-.19))*11.,2.));
        float tint=(1.-smoothstep(.12,.37,radius))*.09;
        gl_FragColor=vec4(.80,.99,.96,(edge+gleam*.57+tint)*vOpacity);
      }`,
  });
  const mesh=new THREE.Points(geometry,material);
  mesh.visible=false;
  mesh.frustumCulled=false;
  return {
    mesh,
    update(elapsed,player){
      mesh.visible=!!player;
      if(!player)return;
      const fade=1-smoothstep(elapsed,4.03,VICTORY_SECONDS);
      for(let i=0;i<count;i++){
        const birth=.14+Math.floor(i/3)*.30+(i%3)*.052;
        const age=elapsed-birth;
        const life=1.42+(i%4)*.26;
        if(age<=0||age>=life){opacity.setX(i,0);continue;}
        // Each bubble keeps the earlier swimmer position that released it.
        const trail=swimPath(birth/VICTORY_SECONDS,player);
        const side=i%2===0?-1:1;
        const sway=Math.sin(i*2.4+age*2.3);
        positions.setXYZ(i,
          trail.x+side*(.54+(i%4)*.22+age*.31)+sway*.13,
          trail.y-.39+(i%3)*.10+age*(.65+(i%5)*.17),
          trail.z+.75+(i%5)*.14+age*.29+Math.cos(i*2.4+age*1.6)*.16,
        );
        opacity.setX(i,smoothstep(age,0,.17)*(1-smoothstep(age,life-.44,life))*fade*.88);
      }
      positions.needsUpdate=true;
      opacity.needsUpdate=true;
    },
  };
}
