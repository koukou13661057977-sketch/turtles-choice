import {difficultyConfig,reviewType} from './rules.js?v=1.7.0';
import {rankedEntries} from './progress.js?v=1.7.0';
import {TRASH_TYPES} from './catalog.js?v=1.7.0';

// Pure data for localized result copy. Call after this result has been saved;
// a lower-ranked result may already have fallen outside the stored top ten.
export function nextChallenge(board,round,resultId){
  const config=difficultyConfig(round?.difficulty);
  const entries=rankedEntries(board,config.id),ownIndex=entries.findIndex(e=>e.id===resultId);
  const others=entries.filter(e=>e.id!==resultId),score=Math.max(0,round?.score??0);
  const rank=ownIndex<0?0:ownIndex+1;
  let kind,targetEntry=null,targetRank=null;
  if(!others.length)kind='first';
  else if(ownIndex===0)kind='leader';
  else if(ownIndex>0){kind='chase';targetEntry=entries[ownIndex-1];targetRank=ownIndex;}
  else{kind='enter';targetEntry=entries.at(-1);targetRank=entries.length;}
  // One extra point tier beats every equal-score tie breaker, even when the
  // target's score is not a multiple of ten (e.g. a migrated legacy record).
  const targetScore=targetEntry?(Math.floor(targetEntry.score/10)+1)*10:null;
  const pointsNeeded=targetScore===null?0:Math.max(10,targetScore-score);
  const remaining=Math.max(0,config.goal-(round?.jellies??0));
  const type=reviewType(round??{mistakes:{},lastMistake:null});
  const tip=round?.plastic>0&&TRASH_TYPES.includes(type)?'recognize':remaining?'food':'streak';
  const streakTarget=(Math.floor(Math.max(0,round?.bestStreak??0)/5)+1)*5;
  return {kind,rank,targetScore,targetRank,pointsNeeded,tip,type,remaining,streakTarget};
}
