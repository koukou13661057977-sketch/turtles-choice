import {FOOD_TYPES,TRASH_TYPES} from './catalog.js?v=1.7.0';
import {difficultyConfig} from './rules.js?v=1.8.0';

// Each stage starts its own pattern so its choices and recovery gaps are consistent.
const HEIGHTS=[.05,.65,-.65,1.25,-1.1];
const SHALLOW_TRASH=['bag','bottle','balloon'];
const GRASS_TRASH=['film','glove','mask','bag'];
const CHOICE_SIDES=[1,-1,-1,1,1,-1,1,-1];
const REEF_LANES=[-3.2,0,3.2];
const REEF_FOOD_LANES=[0,2,1,2,0,1,0,2,2,1,0,1];
const REEF_DECOYS=[
  ['bag','cup'],['balloon','film'],['glove','mask'],
  ['film','bottle'],['balloon','bag'],['mask','cup'],
];
const target=(type,x,y,z,wave,offset=0)=>({type,x,y,z,scale:.88,variant:(wave+offset)%3});

export function planEncounter({stage=0,wave=0,difficulty='normal'}={}){
  const phase=Number.isInteger(stage)?Math.max(0,Math.min(2,stage)):0;
  const index=Number.isSafeInteger(wave)&&wave>=0?wave:0;
  const config=difficultyConfig(difficulty),tempo=config.spawnIntervalScale;
  const easy=config.id==='easy',hard=config.id==='hard';
  const y=HEIGHTS[index%HEIGHTS.length];
  const side=easy?(index%2===0?1:-1):CHOICE_SIDES[index%CHOICE_SIDES.length];
  if(phase===0){
    // First two waves introduce living bells, one at a time. Later waves use
    // only three familiar litter silhouettes, with a clear view of each.
    const litter=index>1&&((index*.61803398875+.31)%1)<config.trashRatio;
    const type=litter?SHALLOW_TRASH[index%SHALLOW_TRASH.length]:FOOD_TYPES[index%2];
    const x=[0,1.8,-1.8,0,2.8,-2.8][index%6];
    return {targets:[target(type,x,y,-38,index)],delay:3.6*tempo,beat:'observe'};
  }
  if(phase===1){
    // Both choices arrive together. On higher difficulties, the same side
    // can be safe twice in a row, so the player needs to read the next pair.
    const food=FOOD_TYPES[index%FOOD_TYPES.length];
    return {targets:[target(food,side*2.2,y,-38,index),target(GRASS_TRASH[index%4],-side*2.2,y,-38,index,1)],delay:3.35*tempo,beat:'choose'};
  }
  const cycleLength=hard?4:3;
  const pulse=index%cycleLength,group=Math.floor(index/cycleLength);
  if(pulse===cycleLength-1){
    // A food-only wave still gives a breather. On high, swim over to meet it.
    const x=hard?(group%2===0?-2.9:2.9):0;
    const delay=hard?5.3:easy?6.8:6.3;
    return {targets:[target(FOOD_TYPES[group%3],x,.05,-38,index)],delay:delay*tempo,beat:'rest'};
  }
  const food=FOOD_TYPES[(index+group)%FOOD_TYPES.length];
  if(hard||(!easy&&pulse===0)){
    const foodLane=REEF_FOOD_LANES[index%REEF_FOOD_LANES.length];
    const decoys=REEF_DECOYS[index%REEF_DECOYS.length];
    let nextDecoy=0;
    const targets=REEF_LANES.map((x,lane)=>{
      const type=lane===foodLane?food:decoys[nextDecoy++];
      return target(type,x,y,-38,index,lane);
    });
    const delay=hard?[1.95,2.2,2.6][pulse]:1.85;
    return {targets,delay:delay*tempo,beat:'rush'};
  }
  const litter=TRASH_TYPES[(group*2+pulse)%TRASH_TYPES.length];
  return {targets:[target(food,side*2.2,y,-38,index),target(litter,-side*2.2,y,-38,index,1)],delay:(pulse===0?1.7:2)*tempo,beat:'rush'};
}
