import * as THREE from './vendor/three.module.js';
import {ABSORB_RADIUS,MOUTH_Z} from './rules.js?v=1.8.0';
import {isFood} from './catalog.js?v=1.7.0';
import {createTurtleModel,createTargetModels,createDistantTurtle,animateTurtle,animateJelly} from './models.js?v=1.7.0';
import {makeShallows,makeSeagrassBank,makeCoralGarden,makeSand,makeWaterSurface,makeLightShafts,makeParticles,makeFish} from './habitat.js?v=1.7.0';
import {VICTORY_SECONDS,SPECIAL_VICTORY_SECONDS,victoryPose,coralVictoryPose,createVictoryBubbles,createVictoryLight,createCoralCelebration} from './victory.js?v=1.9.0';
export {createTargetModels} from './models.js?v=1.7.0';

const C=THREE;
const clamp=C.MathUtils.clamp;
const smooth=(a,b,t)=>C.MathUtils.lerp(a,b,1-Math.exp(-t));

export class OceanWorld {
  constructor(container){
    this.renderer=new C.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.outputColorSpace=C.SRGBColorSpace;this.renderer.toneMapping=C.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
    container.appendChild(this.renderer.domElement);
    this.scene=new C.Scene();this.scene.background=new C.Color('#449caa');this.scene.fog=new C.FogExp2('#449caa',.017);
    this.camera=new C.PerspectiveCamera(48,innerWidth/innerHeight,.1,170);this.camera.position.set(0,3.8,13);
    const ambient=new C.HemisphereLight('#e4f5ff','#5e7880',1.75);this.scene.add(ambient);this.ambient=ambient;
    const sun=new C.DirectionalLight('#fff0d3',2.7);sun.position.set(-7,14,3);this.scene.add(sun);this.sun=sun;
    const rim=new C.DirectionalLight('#b5e7ff',2.05);rim.position.set(6,5,-12);this.scene.add(rim);
    const bounce=new C.DirectionalLight('#e3f5e3',.8);bounce.position.set(0,-3,6);this.scene.add(bounce);
    this.turtle=createTurtleModel('leatherback');this.turtleSpecies='leatherback';this.turtleCache=new Map([['leatherback',this.turtle]]);this.scene.add(this.turtle);
    this.meshPool=new Map();this.guideCache=new Map();this._mouthVector=new C.Vector3();this.mainFrameValid=false;this.lastFrozen=false;this.adaptiveQuality=false;
    this.mode='home';this.time=0;this.homeBlend=1;this.targets=[];this.nextId=1;this.biteTime=0;
    this.timeUniform={value:0};this.scrollUniform={value:0};
    this.variants=[createTargetModels(0),createTargetModels(1),createTargetModels(2)];this.targetModels=this.variants[0];this.decor=[];this.clusters=[];
    this.palette=['#449caa','#245d70','#287da0'].map(c=>new C.Color(c));this.waterColour=this.palette[0].clone();this.happyTime=0;
    this.sand=makeSand(this.timeUniform,this.scrollUniform);this.scene.add(this.sand);
    this.sandPalette=['#d6d4a6','#819872','#b5c5b7'].map(c=>new C.Color(c));
    this.surface=makeWaterSurface(this.timeUniform);this.scene.add(this.surface);
    this.rays=makeLightShafts(this.timeUniform);this.scene.add(this.rays);
    this.biomes=[];this.biomeWeights=[1,0,0];
    const builders=[makeShallows,makeSeagrassBank,makeCoralGarden];
    for(let stage=0;stage<3;stage++){
      const biome=new C.Group();biome.name=['warm-shallows','seagrass-corridor','coral-garden'][stage];biome.userData.stage=stage;biome.position.y=-4.22;
      for(let i=0;i<14;i++){
        const bank=builders[stage](130+stage*79+i*17,this.timeUniform),side=i%2?1:-1;
        bank.position.set(side*([9.6,9.2,9.1][stage]+(i%3)*.65),0,14-i*7.8+Math.sin(i*3.1)*1.5);
        bank.rotation.y=i*1.371;bank.scale.setScalar(stage===0?1:1+(i%3)*.08);bank.userData.stage=stage;
        biome.add(bank);this.clusters.push(bank);
      }
      biome.visible=stage===0;this.scene.add(biome);this.biomes.push(biome);
    }
    this.particles=makeParticles();this.scene.add(this.particles);
    this.victoryBubbles=createVictoryBubbles();this.scene.add(this.victoryBubbles.mesh);
    this.coralCelebration=createCoralCelebration();this.scene.add(this.coralCelebration.mesh);
    this.victoryGlow=createVictoryLight();this.scene.add(this.victoryGlow);
    this.victoryFill=new C.DirectionalLight('#fff0d3',0);
    this.victoryFill.position.set(8,11,6);this.scene.add(this.victoryFill);
    this.coralRim=new C.DirectionalLight('#f1a0ad',0);
    this.coralRim.position.set(-6,12,-7);this.scene.add(this.coralRim);
    this.coralWater=new C.Color('#5f6e91');
    this.coralHighlight=new C.Color('#78b3ab');
    this.victoryStart=null;this.victoryEnd=null;
    this.fish=makeFish(this.timeUniform);this.scene.add(this.fish);this.fishDummy=new C.Object3D();
    this.distantTurtles=[createDistantTurtle(),createDistantTurtle()];this.distantTurtles.forEach(t=>this.scene.add(t));
    for(let i=0;i<5;i++){
      const j=this.targetModels.jelly.clone(true);j.position.set(i%2?6.7+i*.65:-7.5-i*.5,1.4+(i%3)*1.2,-9-i*7);j.scale.setScalar(.5+(i%2)*.16);this.scene.add(j);this.decor.push(j);
    }
    this.createCaptureEffect();this.createShadow();this.createGuide();
    window.addEventListener('resize',()=>this.resize());this.resize();
  }
  createCaptureEffect(){
    const material=new C.MeshBasicMaterial({color:'#dcfff0',transparent:true,opacity:.18,depthWrite:false});
    // Four quiet arcs suggest a collection zone without an aiming reticle over the animal.
    this.ring=new C.Group();for(let i=0;i<4;i++){
      const arc=new C.Mesh(new C.TorusGeometry(ABSORB_RADIUS,.015,5,22,Math.PI*.30),material);arc.rotation.z=i*Math.PI/2+.17;this.ring.add(arc);
    }this.ringMaterial=material;this.ring.visible=false;this.scene.add(this.ring);
    this.bitePulse=new C.Mesh(new C.TorusGeometry(.35,.026,6,48),new C.MeshBasicMaterial({color:'#f7f2bc',transparent:true,opacity:.8,depthWrite:false}));this.bitePulse.visible=false;this.scene.add(this.bitePulse);
    const particles=new C.BufferGeometry(),positions=new Float32Array(18*3);particles.setAttribute('position',new C.BufferAttribute(positions,3));
    this.mealSpark=new C.Points(particles,new C.PointsMaterial({color:'#f4efd4',size:.075,transparent:true,opacity:0,depthWrite:false}));this.scene.add(this.mealSpark);
  }
  createShadow(){
    const material=new C.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uOpacity:{value:.12}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float uOpacity;void main(){float d=length((vUv-.5)*2.);gl_FragColor=vec4(.08,.20,.23,pow(max(0.,1.-d),2.)*uOpacity);}'});
    this.shadow=new C.Mesh(new C.PlaneGeometry(6,7),material);this.shadow.rotation.x=-Math.PI/2;this.shadow.position.y=-4.0;this.scene.add(this.shadow);
  }
  createGuide(){
    this.guideScene=new C.Scene();this.guideScene.background=new C.Color('#173f49');
    this.guideScene.add(new C.HemisphereLight('#eef7ff','#32434b',2.2));
    const key=new C.DirectionalLight('#fff0d3',3.2);key.position.set(-3,5,4);this.guideScene.add(key);
    const rim=new C.DirectionalLight('#bedfff',1.8);rim.position.set(4,1,-2);this.guideScene.add(rim);
    this.guideCamera=new C.PerspectiveCamera(39,1,.1,30);this.guideCamera.position.set(0,.1,4.9);this.guideCamera.lookAt(0,0,0);
    this.guideRig=new C.Group();this.guideScene.add(this.guideRig);this.guideEnabled=false;this.guideTime=0;this.guideDragging=false;this.guideStill=0;this.guideBounds=new C.Box3();
  }
  setGuide(type,variant=0){
    this.mainFrameValid=false;this.guideRig.clear();const key=`${type}/${variant}`;
    if(!this.guideCache.has(key)){const object=this.variants[variant][type].clone(true),box=new C.Box3().setFromObject(object);object.position.sub(box.getCenter(new C.Vector3()));this.guideCache.set(key,object);}
    this.guideObject=this.guideCache.get(key);this.guideType=type;
    this.guideRig.add(this.guideObject);this.guideRig.rotation.set(.08,-.35,0);this.guideStill=2;
  }
  rotateGuide(dx,dy){this.guideRig.rotation.y+=dx*.009;this.guideRig.rotation.x=clamp(this.guideRig.rotation.x+dy*.007,-.65,.65);this.guideStill=5;}
  renderGuide(rect,dt,overlay=false){
    if(!rect||rect.width<1||rect.height<1)return;
    this.mainFrameValid=false;
    this.guideTime+=dt;this.guideStill=Math.max(0,this.guideStill-dt);
    if(!this.guideDragging&&!this.guideStill)this.guideRig.rotation.y+=dt*.14;
    if(isFood(this.guideType))animateJelly(this.guideObject,this.guideTime,0);
    this.guideCamera.aspect=rect.width/rect.height;this.guideCamera.updateProjectionMatrix();
    // Fit the current rotated specimen, including long tentacles and ear loops, in any viewport.
    // The same calculation serves the full guide, narrow phones and the smaller mistake review.
    this.guideRig.updateWorldMatrix(true,true);this.guideBounds.setFromObject(this.guideRig);
    const bounds=this.guideBounds,tanV=Math.tan(C.MathUtils.degToRad(this.guideCamera.fov/2)),tanH=tanV*this.guideCamera.aspect;
    const fit=Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x))/tanH;
    const fitY=Math.max(Math.abs(bounds.min.y),Math.abs(bounds.max.y))/tanV;
    this.guideCamera.position.set(0,0,Math.max(2,Math.max(fit,fitY)*1.15+bounds.max.z));this.guideCamera.lookAt(0,0,0);
    if(!overlay){this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,innerWidth,innerHeight);this.renderer.setClearColor('#173f49');this.renderer.clear();}
    const left=Math.max(0,rect.left,rect.clip?.left??0),right=Math.min(innerWidth,rect.right,rect.clip?.right??innerWidth),top=Math.max(0,rect.top,rect.clip?.top??0),bottom=Math.min(innerHeight,rect.bottom,rect.clip?.bottom??innerHeight);
    if(right<=left||bottom<=top)return;
    const y=innerHeight-rect.bottom;this.renderer.setViewport(rect.left,y,rect.width,rect.height);this.renderer.setScissor(left,innerHeight-bottom,right-left,bottom-top);this.renderer.setScissorTest(true);
    this.renderer.render(this.guideScene,this.guideCamera);this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,innerWidth,innerHeight);
  }
  guidePins(rect){
    const anchors=this.guideObject.userData.guidePins??{
      jelly:[[.40,.25,.40],[.12,-.83,.12]],moon:[[.25,.22,.26],[.48,-.16,.16]],compass:[[.30,.20,.25],[.10,-1,.12]],
      bag:[[.29,-.56,.04],[-.55,.10,.10]],balloon:[[0,-.49,0],[.53,.05,0]],film:[[.52,-.48,0],[-.3,.22,.45]],glove:[[.11,-.64,.02],[0,.51,.05]],
      bottle:[[0,.62,0],[.31,-.10,.12]],cup:[[.36,.38,0],[.23,-.32,.12]],mask:[[.64,0,0],[.10,.1,.16]]
    }[this.guideType]??[[0,.2,0],[0,-.2,0]];
    this.guideObject.updateWorldMatrix(true,false);this.guideCamera.updateMatrixWorld();
    return anchors.map(a=>{const p=new C.Vector3(...a).applyMatrix4(this.guideObject.matrixWorld).project(this.guideCamera);return {x:(p.x+1)*rect.width/2,y:(1-p.y)*rect.height/2};});
  }
  resize(){this.mainFrameValid=false;this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);}
  quality(high){
    this.highQuality=high;this.adaptiveQuality=false;this.mainFrameValid=false;
    const ratio=high?Math.min(devicePixelRatio,1.75):1;this.renderer.setPixelRatio(ratio);this.renderer.setSize(innerWidth,innerHeight);
    this.particles.visible=high;this.particles.material.uniforms.uPixelRatio.value=ratio;this.surface.visible=high;
    // Keep both sides of the grass corridor on lower quality; reduce blade density instead.
    for(const bank of this.clusters){const grass=bank.getObjectByName('tall-seagrass');if(grass)grass.count=high?68:40;}
    this.rays.children.forEach((ray,i)=>{ray.visible=high||i%2===0;});this.fish.count=high?36:20;
  }
  // One temporary resolution reduction per manual quality choice; preferences stay intact.
  applyAdaptiveQuality(){
    if(this.adaptiveQuality||!this.highQuality)return false;
    this.adaptiveQuality=true;this.mainFrameValid=false;
    const ratio=Math.max(.75,Math.min(devicePixelRatio,1.75)*.75);
    this.renderer.setPixelRatio(ratio);this.renderer.setSize(innerWidth,innerHeight);
    this.particles.material.uniforms.uPixelRatio.value=ratio;return true;
  }
  setTurtle(species='leatherback'){
    const id=['leatherback','green','hawksbill','loggerhead'].includes(species)?species:'leatherback';
    if(id===this.turtleSpecies)return this.turtle;
    if(!this.turtleCache.has(id))this.turtleCache.set(id,createTurtleModel(id));
    const previous=this.turtle,next=this.turtleCache.get(id);
    next.position.copy(previous.position);next.rotation.copy(previous.rotation);next.scale.copy(previous.scale);
    this.scene.remove(previous);this.scene.add(next);this.turtle=next;this.turtleSpecies=id;this.mainFrameValid=false;return next;
  }
  setMode(mode,victory){
    if(this.mode===mode)return;
    if(mode==='victory'){
      const {x:pitch,y:yaw,z:roll}=this.turtle.rotation;
      this.victoryStart={pitch,yaw,roll,scale:this.turtle.scale.x};
    }else if(mode==='results'&&victory){
      this.holdVictory(victory);
    }else if(mode!=='results'){
      this.victoryStart=null;this.victoryEnd=null;
    }
    this.mainFrameValid=false;this.mode=mode;
  }
  holdVictory({special=false,reduced=false}){
    this.victoryEnd={elapsed:special?SPECIAL_VICTORY_SECONDS:VICTORY_SECONDS,special,reduced};
  }
  releaseTarget(target){
    this.scene.remove(target.mesh);const key=`${target.type}/${target.variant}`,pool=this.meshPool.get(key)??[];
    // Geometry/materials belong to the templates and are shared: never dispose them here.
    if(pool.length<2){pool.push(target.mesh);this.meshPool.set(key,pool);}
  }
  spawn(type,x,y,z,scale=.8,variant=Math.floor(Math.random()*3)){
    const proto=this.variants[variant][type];if(!proto)throw new Error(`Unknown target: ${type}`);
    const mesh=this.meshPool.get(`${type}/${variant}`)?.pop()??proto.clone(true);mesh.rotation.set(0,0,0);mesh.scale.setScalar(scale);this.scene.add(mesh);this.mainFrameValid=false;
    const obj={id:this.nextId++,type,variant,x,y,z,scale,mesh,phase:Math.random()*6.28,eaten:false,eatTime:0,pulling:false,pullTime:0};mesh.position.set(x,y,z);this.targets.push(obj);return obj;
  }
  clearTargets(){for(const target of this.targets)this.releaseTarget(target);this.targets=[];this.ring.visible=false;this.biteTime=0;this.happyTime=0;this.mainFrameValid=false;}
  consume(target){
    target.eaten=true;target.eatTime=.48;target.start=target.mesh.position.clone();this.biteTime=.48;this.lastMealType=target.type;
    this.mealLevel=isFood(target.type)?({normal:1,combo:1.4,goal:1.8}[target.feedback]??1):1;
    if(isFood(target.type))this.happyTime=this.mealLevel;this.mainFrameValid=false;
  }
  mouth(player){return {x:player.x,y:player.y+.05,z:MOUTH_Z};}
  aim(target){this.aimed=target;}
  updateVictory(victory,player,pose){
    if(!pose){
      this.victoryGlow.visible=false;
      this.victoryFill.intensity=0;
      this.coralRim.intensity=0;
      this.victoryBubbles.update(0,null);
      this.coralCelebration.update(0,null);
      return;
    }
    const {elapsed,reduced,special}=victory;
    const banner=special&&this.mode==='results'&&innerHeight>600;
    const bannerScale=banner?(innerWidth>760?.24:.38):1;
    this.turtle.visible=true;this.shadow.visible=false;
    this.turtle.position.set(pose.x,pose.y,pose.z);
    this.turtle.rotation.set(pose.pitch,pose.yaw,pose.roll);
    this.turtle.scale.setScalar(pose.scale*bannerScale);

    const {head,jaw,fins,eyes}=this.turtle.userData;
    head.rotation.y+=(special?.07:.14)*pose.gesture;
    head.rotation.x-=(special?.23:.08)*pose.gesture;
    jaw.rotation.x=-(special?.28:.22)*pose.gesture;
    for(const eye of eyes)eye.scale.y=C.MathUtils.lerp(eye.scale.y,1.16,pose.gesture);
    for(const fin of fins){
      const side=fin.userData.side;
      const raise=special?(side<0?.73:.69):(side<0?.38+.30*pose.wave:.13);
      const spread=special?-.18:side<0?-.14:.06;
      fin.rotation.z=C.MathUtils.lerp(fin.rotation.z+(special?side*.13*pose.wave:0),side*raise,pose.gesture);
      fin.rotation.y=C.MathUtils.lerp(fin.rotation.y,side*spread,pose.gesture);
    }

    this.camera.position.set(pose.cameraX,pose.cameraY,pose.cameraZ);
    let focusY=pose.focusY;
    if(banner){
      const gap=Math.max(112,innerHeight*.14);
      const framing=Math.atan((1-gap/innerHeight)*Math.tan(C.MathUtils.degToRad(pose.fov/2)));
      const distance=Math.hypot(pose.cameraX-pose.x,pose.cameraZ-pose.z);
      const tilt=Math.atan2(pose.y-pose.cameraY,distance)-framing;
      focusY=pose.cameraY+distance*Math.tan(tilt);
    }
    this.camera.lookAt(pose.x,focusY,pose.z);
    this.victoryGlow.visible=pose.light>0;
    this.victoryGlow.position.set(pose.x-3,11.95,pose.z-(special?1.2:4));
    this.victoryGlow.material.uniforms.uLight.value=pose.light;
    this.victoryGlow.material.uniforms.uTime.value=reduced?0:elapsed;
    this.victoryGlow.material.uniforms.uCoral.value=special?1:0;
    this.victoryFill.intensity=(special?1.6:1.35)*pose.light;
    this.coralRim.intensity=special?1.8*pose.light:0;
    if(special){
      this.scene.background.lerp(this.coralWater,pose.light*.45).lerp(this.coralHighlight,pose.gesture*.35);
      this.scene.fog.color.copy(this.scene.background);
    }
    this.victoryBubbles.update(elapsed,special||reduced||elapsed>=VICTORY_SECONDS?null:player);
    this.coralCelebration.update(elapsed,special?player:null,reduced,bannerScale);
  }
  update(dt,model){
    if(this.guideEnabled){this.renderGuide(model.guideRect,dt);return;}
    const heldVictory=this.mode==='results'?this.victoryEnd:null;
    const victory=model.victory??heldVictory;
    const freeze=model.paused||!!victory?.reduced||!!heldVictory;
    // Paused/board overlays are HTML; retain their unchanged ocean framebuffer.
    if(freeze&&this.lastFrozen&&this.mainFrameValid&&!model.reviewRect)return;
    const tdt=freeze?0:dt;this.time+=tdt;const t=this.time;this.timeUniform.value=t;
    const home=this.mode==='home';this.homeBlend=smooth(this.homeBlend,home?1:0,tdt*2.2);const h=this.homeBlend;
    const aspect=innerWidth/innerHeight,homeX=aspect>1.4?3.7:2.6;
    const pose=victory?(victory.special?coralVictoryPose:victoryPose)(victory.elapsed,model.player,aspect,victory.reduced,this.victoryStart??{}):null;
    this.turtle.position.set(C.MathUtils.lerp(model.player.x,homeX,h),C.MathUtils.lerp(model.player.y,1.5+Math.sin(t*.65)*.13,h),C.MathUtils.lerp(4.1,.7,h));
    this.turtle.scale.setScalar(C.MathUtils.lerp(.77,clamp(aspect*.88,.95,1.45),h));
    this.turtle.rotation.y=smooth(this.turtle.rotation.y,C.MathUtils.lerp(-model.vx*.035,2.30,h),tdt*5);
    this.turtle.rotation.z=smooth(this.turtle.rotation.z,-model.vx*.05*(1-h)+Math.sin(t*.55)*.025*h,tdt*5);
    this.turtle.rotation.x=smooth(this.turtle.rotation.x,model.vy*.038*(1-h)+.47*h,tdt*5);
    this.biteTime=Math.max(0,this.biteTime-tdt);this.happyTime=Math.max(0,this.happyTime-tdt);animateTurtle(this.turtle,t,{slow:model.slow,vx:model.vx,vy:model.vy,bite:this.biteTime,happy:this.happyTime});
    const firstPerson=this.mode==='play'&&model.view==='first';
    const fov=pose?.fov??(firstPerson?(aspect<1?78:63):48);
    if(this.camera.fov!==fov){
      this.camera.fov=fov;
      this.camera.updateProjectionMatrix();
    }
    this.turtle.visible=!firstPerson;
    this.shadow.visible=!firstPerson;
    if(firstPerson){
      const mouth=this.mouth(model.player);
      const yaw=model.viewYaw??0,pitch=(model.viewPitch??0)-.08;
      const eye=this.camera.position;
      eye.set(mouth.x,mouth.y+.14,mouth.z+.72);
      this.camera.lookAt(eye.x+Math.sin(yaw)*Math.cos(pitch),eye.y+Math.sin(pitch),eye.z-Math.cos(yaw)*Math.cos(pitch));
    }else{
      const camY=C.MathUtils.lerp(4.5+model.player.y*.6,3.6,h);
      this.camera.position.set(model.player.x*.25*(1-h),camY,C.MathUtils.lerp(12,13.5,h));this.camera.lookAt(C.MathUtils.lerp(model.player.x*.25,0,h),C.MathUtils.lerp(-2.4+model.player.y*.6,1.1,h),C.MathUtils.lerp(-8,-5,h));
    }
    this.shadow.position.x=this.turtle.position.x+.8;this.shadow.position.z=this.turtle.position.z-.5;
    this.shadow.material.uniforms.uOpacity.value=.1+(1-h)*.035;
    const scroll=model.moving?model.speed:home?1.0:0;
    const stage=home?0:clamp(model.stage??0,0,2),blend=1-Math.exp(-tdt*.95);
    this.waterColour.lerp(this.palette[stage],blend);this.scene.background.copy(this.waterColour);this.scene.fog.color.copy(this.waterColour);this.scene.fog.density=smooth(this.scene.fog.density,[.017,.023,.019][stage],tdt*.95);
    this.sand.material.color.lerp(this.sandPalette[stage],blend);this.sun.position.x=-7+Math.sin(t*.025)*5;this.sun.intensity=smooth(this.sun.intensity,[2.7,1.8,2.5][stage],tdt*.95);
    this.ambient.intensity=smooth(this.ambient.intensity,[1.75,1.5,1.85][stage],tdt*.95);
    for(let i=0;i<this.biomes.length;i++){
      const biome=this.biomes[i],weight=this.biomeWeights[i]=smooth(this.biomeWeights[i],i===stage?1:0,tdt*.95);
      biome.visible=weight>.015;biome.position.y=-4.22-(1-weight)*2.2;biome.scale.y=.12+weight*.88;
      for(const bank of biome.children){bank.position.z+=scroll*tdt;if(bank.position.z>21)bank.position.z-=109.2;}
    }
    this.scrollUniform.value-=scroll*tdt;
    const particles=this.particles.geometry.attributes.position;
    for(let i=0;this.particles.visible&&i<particles.count;i++){
      let z=particles.getZ(i)+scroll*tdt,y=particles.getY(i)+tdt*.028;
      if(z>15)z=-88;if(y>13)y=-4;particles.setZ(i,z);particles.setY(i,y);
    }if(this.particles.visible)particles.needsUpdate=true;
    const dummy=this.fishDummy;
    for(let i=0;i<this.fish.count;i++){
      const school=i<20?1:-1,tt=t*.19+i*.27;
      const crossing=stage===2?Math.sin(t*.045)*9:school*(11+Math.sin(t*.05)*3);
      dummy.position.set(crossing+Math.sin(tt)*3+(i%4)*.4,3.2+Math.sin(i*1.8)*.8,-29-Math.floor(i/4)*1.4+Math.cos(tt)*2);
      dummy.rotation.y=school>0?-.25:Math.PI+.25;dummy.rotation.z=Math.sin(t*2+i)*.035;dummy.scale.setScalar(.65+(i%3)*.18);dummy.updateMatrix();this.fish.setMatrixAt(i,dummy.matrix);
    }this.fish.instanceMatrix.needsUpdate=true;
    this.distantTurtles.forEach((turtle,i)=>{
      const phase=t*.045+i*2.5;turtle.visible=this.highQuality||i===0;turtle.position.set(Math.sin(phase)*(13+i*2),4.5+i*.8,-42-i*15+Math.cos(phase)*5);turtle.scale.setScalar(.72+i*.12);turtle.rotation.y=-Math.PI/2+Math.cos(phase)*.25;
      for(const fin of turtle.userData.fins)fin.rotation.z=fin.userData.side*Math.sin(t*1.65+i)*.24;
    });
    for(let i=0;i<this.decor.length;i++){
      const jelly=this.decor[i];jelly.visible=home||this.mode==='results';jelly.position.y=1.4+(i%3)*1.2+Math.sin(t*.5+i)*.2;if(jelly.visible)animateJelly(jelly,t,i);
    }
    const gone=[];
    for(const target of this.targets){
      if(target.eaten){
        target.eatTime-=tdt;const k=clamp(1-target.eatTime/.48,0,1),pull=k*k,mouth=this.mouth(model.player);
        target.mesh.position.copy(target.start).lerp(this._mouthVector.set(mouth.x,mouth.y,mouth.z),pull);
        target.mesh.position.x+=Math.sin(k*Math.PI)*Math.sin(k*7)*.10;target.mesh.position.y+=Math.sin(k*Math.PI)*.12;
        target.mesh.rotation.y+=tdt*2;target.mesh.scale.setScalar(target.scale*(1-pull));if(k>=1)gone.push(target);continue;
      }
      const yy=target.y+Math.sin(t*.9+target.phase)*(target.pulling?.025:.07);target.mesh.position.set(target.x,yy,target.z);
      if(isFood(target.type)){
        animateJelly(target.mesh,t,target.phase);target.mesh.rotation.z=Math.sin(t*.7+target.phase)*.09;
        let fringe=0;for(const child of target.mesh.children)if(child.name==='tendril'){child.visible=fringe>=24||target.z>(this.highQuality?-22:-10)||fringe%2===0;fringe++;}
      }
      else{
        target.mesh.rotation.set(Math.sin(t*.6+target.phase)*.10,Math.sin(t*.48+target.phase)*.35+target.phase,Math.sin(t*.68+target.phase)*.15);
        // Litter drifts and its loose ribbons sway; only living bells actively pulse.
        target.mesh.scale.setScalar(target.scale);
        for(const child of target.mesh.children)if(child.name==='ribbon'){child.rotation.z=Math.sin(t*1.5+child.userData.phase+target.phase)*.13;child.rotation.x=Math.sin(t*1.27+child.userData.phase)*.10;}
      }
      if(target.z>9)gone.push(target);
    }
    for(const target of gone){this.releaseTarget(target);this.targets.splice(this.targets.indexOf(target),1);}
    this.ring.visible=this.mode==='play'&&model.autoActive&&!freeze;
    if(this.ring.visible){
      const mouth=this.mouth(model.player),pulling=this.targets.some(x=>x.pulling&&!x.eaten);
      this.ring.position.set(mouth.x,mouth.y,mouth.z-(firstPerson?1:.65));
      this.ring.quaternion.copy(this.camera.quaternion);
      this.ring.scale.setScalar((firstPerson?.15:1)*(pulling?.94+Math.sin(t*5)*.04:1));
      this.ringMaterial.opacity=pulling?.56:firstPerson?.30:.16;
      if(pulling)this.ring.rotateZ(t*.5);
    }
    this.bitePulse.visible=this.biteTime>0&&!freeze;this.mealSpark.visible=this.bitePulse.visible;
    if(this.bitePulse.visible){
      const m=this.mouth(model.player),progress=1-this.biteTime/.48,level=this.mealLevel??1;
      const mealColor=isFood(this.lastMealType)?(level>1.5?'#9fffe4':level>1?'#ffe37a':'#fff1a8'):'#ff946e';
      this.bitePulse.position.set(m.x,m.y,m.z-(firstPerson?.35:0));this.bitePulse.quaternion.copy(this.camera.quaternion);this.bitePulse.scale.setScalar((firstPerson?.40:1)*(.9+progress*2.3)*level);this.bitePulse.material.opacity=(1-progress)*.8;this.bitePulse.material.color.set(mealColor);
      const p=this.mealSpark.geometry.attributes.position;
      for(let i=0;i<p.count;i++){const a=i/p.count*Math.PI*2,r=.15+progress*(.55+(i%3)*.12)*level;p.setXYZ(i,m.x+Math.cos(a)*r,m.y+Math.sin(a)*r+progress*.15,m.z+Math.sin(i)*r*.5);}p.needsUpdate=true;
      this.mealSpark.material.size=.075*level;this.mealSpark.material.color.set(mealColor);this.mealSpark.material.opacity=(1-progress)*.85;
    }
    if(model.victory)this.holdVictory(model.victory);
    this.updateVictory(victory,model.player,pose);
    this.renderer.render(this.scene,this.camera);this.mainFrameValid=true;this.lastFrozen=!!freeze;
    if(model.reviewRect)this.renderGuide(model.reviewRect,dt,true);
  }
}
