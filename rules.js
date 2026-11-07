import {TARGET_TYPES,TRASH_TYPES,isFood,VARIANT_COUNT} from './catalog.js?v=1.6.0';
export {TRASH_TYPES} from './catalog.js';

export const DURATION=120;
export const GOAL=10;
export const DIFFICULTIES=Object.freeze({
  easy:Object.freeze({id:'easy',goal:8,speedScale:.78,spawnIntervalScale:1.18,pullGrace:.9,trashRatio:.30}),
  normal:Object.freeze({id:'normal',goal:10,speedScale:1,spawnIntervalScale:1,pullGrace:.7,trashRatio:.42}),
  hard:Object.freeze({id:'hard',goal:14,speedScale:1.18,spawnIntervalScale:.86,pullGrace:.6,trashRatio:.52})
});
export function difficultyConfig(id='normal'){return Object.hasOwn(DIFFICULTIES,id)?DIFFICULTIES[id]:DIFFICULTIES.normal;}
export const ABSORB_RADIUS=1.35;
export const ABSORB_REACH=3.75;
export const SWALLOW_RADIUS=.42;
export const SWALLOW_REACH=.65;
export const PULL_GRACE=DIFFICULTIES.normal.pullGrace;
export const MOUTH_Z=2.22;
export function stageSpeed(stage,difficulty='normal'){
  const index=Number.isInteger(stage)?Math.max(0,Math.min(2,stage)):0;
  return [6,7.2,8.4][index]*difficultyConfig(difficulty).speedScale;
}
export function newRound(difficulty='normal'){
  const settings=difficultyConfig(difficulty);
  return {status:'ready',difficulty:settings.id,goal:settings.goal,elapsed:0,score:0,jellies:0,plastic:0,lives:3,slow:0,stage:0,outcome:null,streak:0,bestStreak:0,bonus:0,mistakes:Object.fromEntries(TRASH_TYPES.map(type=>[type,0])),mistakeVariants:{},lastMistake:null};
}
export function startRound(s){Object.assign(s,newRound(s.difficulty),{status:'running'});}
export function tickRound(s,dt){
  if(s.status!=='running'||!Number.isFinite(dt)||dt<0)return;
  s.elapsed=Math.min(DURATION,s.elapsed+dt);s.slow=Math.max(0,s.slow-dt);s.stage=s.elapsed<30?0:s.elapsed<75?1:2;
  if(s.elapsed>=DURATION){s.status='finished';s.outcome=s.jellies>=difficultyConfig(s.difficulty).goal?'success':'hungry';}
}
export function applyMeal(s,target){
  if(s.status!=='running'||!target||target.eaten||target.consumed||!TARGET_TYPES.includes(target.type))return false;
  target.consumed=true;target.pulling=false;
  if(isFood(target.type)){
    s.jellies++;s.streak++;s.bestStreak=Math.max(s.bestStreak,s.streak);
    const bonus=s.streak%5===0?10:0;s.score+=10+bonus;s.bonus+=bonus;target.bonus=bonus;
  }else{
    s.plastic++;s.mistakes[target.type]=(s.mistakes[target.type]??0)+1;
    const variant=Number.isInteger(target.variant)&&target.variant>=0&&target.variant<VARIANT_COUNT?target.variant:0;
    s.mistakeVariants[target.type]=variant;s.lastMistake={type:target.type,variant};
    s.streak=0;s.lives=Math.max(0,s.lives-1);s.slow=2.8;
    if(!s.lives){s.status='finished';s.outcome='hurt';}
  }
  return true;
}
function inside(t,p,radius,reach){
  const dz=MOUTH_Z-t.z;
  return dz>=-.25&&dz<=reach&&((t.x-p.x)**2+(t.y-p.y-.05)**2)/(radius*radius)+(dz/reach)**2<=1;
}
export function findEdible(items,player){return items.find(t=>!t.eaten&&!t.consumed&&inside(t,player,ABSORB_RADIUS,ABSORB_REACH))??null;}
// Species share the same attraction, release and swallowing rules at every difficulty.
// Fixed substeps prevent a fast frame from skipping the opportunity to steer away.
export function advanceTargets(items,player,dt,{speed=0,collect=true,difficulty='normal',pullGrace=difficultyConfig(difficulty).pullGrace}={}){
  if(!Number.isFinite(dt)||dt<=0)return [];
  const elapsed=Math.min(DURATION,dt),velocity=Number.isFinite(speed)?Math.max(0,Math.min(30,speed)):0;
  const grace=Number.isFinite(pullGrace)?Math.max(.6,Math.min(2,pullGrace)):PULL_GRACE;
  const ready=new Set(),steps=Math.ceil(elapsed/(1/120)),step=elapsed/steps;
  for(let n=0;n<steps;n++)for(const t of items){
    if(t.eaten||t.consumed||ready.has(t))continue;
    t.releaseDelay=Math.max(0,(t.releaseDelay??0)-step);
    if(t.pulling&&(!collect||!inside(t,player,ABSORB_RADIUS*1.08,ABSORB_REACH*1.08))){t.pulling=false;t.pullTime=0;t.releaseDelay=.4;}
    if(collect&&!t.pulling&&!t.releaseDelay&&inside(t,player,ABSORB_RADIUS,ABSORB_REACH)){t.pulling=true;t.pullTime=0;}
    if(t.pulling){
      t.pullTime+=step;
      const dx=player.x-t.x,dy=player.y+.05-t.y,d=Math.hypot(dx,dy),k=d?Math.min(1,.78*step/d):0;
      t.x+=dx*k;t.y+=dy*k;t.z=Math.min(MOUTH_Z-.06,t.z+(1.9+velocity*.12)*step);
      if(t.pullTime>=grace&&inside(t,player,SWALLOW_RADIUS,SWALLOW_REACH))ready.add(t);
    }else t.z+=velocity*step;
  }
  return [...ready];
}
export function collectNearby(s,items,player,dt){
  if(s.status!=='running')return [];
  const ready=advanceTargets(items,player,dt,{speed:stageSpeed(s.stage,s.difficulty)*(s.slow>0?.48:1),difficulty:s.difficulty}),captured=[];
  for(const t of ready){
    if(s.status!=='running')break;
    if(applyMeal(s,t))captured.push(t);
  }
  return captured;
}
export function reviewType(s){
  let best=null,count=0;
  for(const type of TRASH_TYPES)if(s.mistakes[type]>count){best=type;count=s.mistakes[type];}
  if(s.lastMistake&&s.mistakes[s.lastMistake.type]===count)best=s.lastMistake.type;
  return best??'jelly';
}
