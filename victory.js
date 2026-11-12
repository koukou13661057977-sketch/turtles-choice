import * as THREE from './vendor/three.module.js';

export const VICTORY_SECONDS=4.6;
export const VICTORY_REDUCED_SECONDS=1.5;

const {clamp,lerp,smoothstep}=THREE.MathUtils;

export function victoryPose(elapsed,player,aspect,reduced=false){
  const time=reduced?1:clamp(elapsed/VICTORY_SECONDS,0,1);
  const rise=smoothstep(time,.02,.86);
  const turn=smoothstep(time,.16,.87);
  const x=lerp(player.x,.2,rise)+Math.sin(time*Math.PI)*.4;
  const y=lerp(player.y,3.35,rise);
  const z=lerp(4.1,-1.6,rise);
  const orbit=lerp(.25,.76,smoothstep(time,0,1));
  const distance=clamp((aspect<1?9.7:8.35)/Math.sqrt(aspect),8,17);
  const stroke=reduced?0:Math.sin(Math.PI*time);
  return {
    x,y,z,
    pitch:.32*stroke,
    yaw:lerp(0,-2.56,turn),
    roll:.16*Math.sin(time*2*Math.PI),
    stroke,
    cameraX:x+Math.sin(orbit)*distance,
    cameraY:y+lerp(2.4,.92,rise),
    cameraZ:z+Math.cos(orbit)*distance,
  };
}

export function createVictoryBubbles(){
  const count=24,geometry=new THREE.BufferGeometry();
  const positions=new THREE.BufferAttribute(new Float32Array(count*3),3);
  const sizes=Float32Array.from({length:count},(_,i)=>.43+(i%7)*.082);
  geometry.setAttribute('position',positions);
  geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    uniforms:{uOpacity:{value:0}},
    vertexShader:`
      attribute float aSize;
      void main(){
        vec4 point=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*point;
        gl_PointSize=clamp(160.*aSize/max(3.,-point.z),2.,20.);
      }`,
    fragmentShader:`
      uniform float uOpacity;
      void main(){
        vec2 uv=gl_PointCoord-.5;
        float radius=length(uv);
        float rim=(radius-.36)*22.;
        float edge=exp(-rim*rim);
        float gleam=exp(-pow(length(uv-vec2(-.18,-.19))*12.,2.));
        gl_FragColor=vec4(.84,1.,.95,(edge*.65+gleam*.34)*uOpacity);
      }`,
  });
  const mesh=new THREE.Points(geometry,material);
  mesh.visible=false;
  mesh.frustumCulled=false;
  return {
    mesh,
    update(elapsed,pose){
      mesh.visible=!!pose;
      if(!pose)return;
      for(let i=0;i<count;i++){
        const angle=i*2.399+elapsed*.36, spread=1.45+(i%8)*.29;
        const lift=(elapsed*.8+i*.23)%3.5;
        positions.setXYZ(i,pose.x+Math.cos(angle)*spread,pose.y-1.3+lift,pose.z-1.7+Math.sin(angle)*spread);
      }
      positions.needsUpdate=true;
      material.uniforms.uOpacity.value=smoothstep(elapsed,.02,.55)*(1-.55*smoothstep(elapsed,3.75,VICTORY_SECONDS));
    },
  };
}
