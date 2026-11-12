import {FOOD_TYPES,TRASH_TYPES} from './catalog.js?v=1.7.0';
import {difficultyConfig} from './rules.js?v=1.7.0';

// A stage owns its wave index. These authored encounters change the decision
// the player makes without changing attraction, health or species physics.
const HEIGHTS=[.05,.65,-.65,1.25,-1.1];
const SHALLOW_TRASH=['bag','bottle','balloon'];
const GRASS_TRASH=['film','glove','mask','bag'];
const target=(type,x,y,z,wave,offset=0)=>({type,x,y,z,scale:.88,variant:(wave+offset)%3});

export function planEncounter({stage=0,wave=0,difficulty='normal'}={}){
  const phase=Number.isInteger(stage)?Math.max(0,Math.min(2,stage)):0;
  const index=Number.isSafeInteger(wave)&&wave>=0?wave:0;
  const config=difficultyConfig(difficulty),tempo=config.spawnIntervalScale;
  const y=HEIGHTS[index%HEIGHTS.length],side=index%2===0?1:-1;
  if(phase===0){
    // First two waves introduce living bells, one at a time. Later waves use
    // only three familiar litter silhouettes, with a clear view of each.
    const litter=index>1&&((index*.61803398875+.31)%1)<config.trashRatio;
    const type=litter?SHALLOW_TRASH[index%SHALLOW_TRASH.length]:FOOD_TYPES[index%2];
    const x=[0,1.8,-1.8,0,2.8,-2.8][index%6];
    return {targets:[target(type,x,y,-38,index)],delay:3.6*tempo,beat:'observe'};
  }
  if(phase===1){
    // Both choices arrive together. Food changes side; no lane is permanently
    // safe, and the 4.4-unit separation prevents one approach catching both.
    const food=FOOD_TYPES[index%FOOD_TYPES.length];
    return {targets:[target(food,side*2.2,y,-38,index),target(GRASS_TRASH[index%4],-side*2.2,y,-38,index,1)],delay:3.35*tempo,beat:'choose'};
  }
  // Reef: two short decision waves, then a clear food lane and a long gap.
  // The food-only wave is an actual recovery window, not merely different text.
  const pulse=index%3;
  if(pulse===2)return {targets:[target(FOOD_TYPES[Math.floor(index/3)%3],0,.05,-38,index)],delay:6.8*tempo,beat:'rest'};
  const food=FOOD_TYPES[(index+Math.floor(index/3))%FOOD_TYPES.length];
  const litter=TRASH_TYPES[(Math.floor(index/3)*2+pulse)%TRASH_TYPES.length];
  return {targets:[target(food,side*2.2,y,-38,index),target(litter,-side*2.2,y,-38,index,1)],delay:(pulse===0?1.7:2.0)*tempo,beat:'rush'};
}
