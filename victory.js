import * as THREE from './vendor/three.module.js';

export const VICTORY_SECONDS=4.6;
export const VICTORY_REDUCED_SECONDS=1.5;

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

export function createVictoryLight(){
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(33,27),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{uLight:{value:0},uTime:{value:0}},
    vertexShader:`
      varying vec2 vUv;
      void main(){
        vUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader:`
      uniform float uLight;
      uniform float uTime;
      varying vec2 vUv;
      void main(){
        vec2 p=(vUv-.5)*2.;
        float distanceToLight=length(p);
        float halo=(1.-smoothstep(.12,1.,distanceToLight))*.22;
        float center=exp(-distanceToLight*distanceToLight*16.)*.31;
        float wave=.7+.3*sin(p.x*23.+p.y*15.+sin(p.y*8.-uTime)+uTime*1.4);
        gl_FragColor=vec4(.99,.94,.72,(halo*wave+center)*uLight);
      }`,
  }));
  glow.rotation.x=Math.PI/2;
  glow.renderOrder=-1;
  glow.visible=false;
  return glow;
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
