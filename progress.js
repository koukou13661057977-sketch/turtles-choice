// Keep the existing storage key: v4 scores migrate into the normal-difficulty board.
export const BOARD_KEY='turtle-daily-board-v1';
export const BOOTH_RETURN_SECONDS=20;
const DIFFICULTIES=['easy','normal','hard'];
const MAX_NUMBER=1_000_000_000,MAX_RECEIPTS=4096;
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(id);
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const compare=(a,b)=>b.score-a.score||b.streak-a.streak||a.plastic-b.plastic||a.number-b.number;
const empty=day=>({day,entries:[],total:0,seenIds:[]});
const difficulty=id=>id===undefined?'normal':DIFFICULTIES.includes(id)?id:null;
export function localDay(date=new Date()){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function cleanEntry(entry){
  if(!entry||typeof entry!=='object'||!validId(entry.id)||!difficulty(entry.difficulty)||
    !integer(entry.number,1,MAX_NUMBER)||!integer(entry.score,0,99999)||
    !integer(entry.food,0,9999)||!integer(entry.streak,0,entry.food)||!integer(entry.plastic,0,3))return null;
  return {id:entry.id,number:entry.number,difficulty:difficulty(entry.difficulty),score:entry.score,streak:entry.streak,food:entry.food,plastic:entry.plastic};
}
export function rankedEntries(board,id='normal'){
  const selected=difficulty(id)??'normal';
  return (Array.isArray(board?.entries)?board.entries:[]).map(cleanEntry).filter(e=>e?.difficulty===selected).sort(compare).slice(0,10);
}
function normalizeBoard(data,day){
  if(data?.day!==day||!Array.isArray(data.entries))return empty(day);
  const ids=new Set(),entries=[];
  for(const value of data.entries.slice(0,10000)){
    const entry=cleanEntry(value);
    if(entry&&!ids.has(entry.id)){ids.add(entry.id);entries.push(entry);}
  }
  const ranked=DIFFICULTIES.flatMap(id=>rankedEntries({entries},id));
  const seenIds=[...new Set([...(Array.isArray(data.seenIds)?data.seenIds.slice(-MAX_RECEIPTS).filter(validId):[]),...entries.map(e=>e.id)])].slice(-MAX_RECEIPTS);
  const total=Math.max(integer(data.total,0,MAX_NUMBER)?data.total:0,...entries.map(e=>e.number));
  return {day,entries:ranked,total,seenIds};
}
export function readBoard(raw,day=localDay()){
  try{return normalizeBoard(JSON.parse(raw),day);}catch{return empty(day);}
}
export function addResult(board,round,id){
  if(!round||round.status!=='finished'||!validId(id))return board;
  const day=typeof board?.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(board.day)?board.day:localDay();
  const safe=normalizeBoard(board,day);
  if(safe.entries.some(e=>e.id===id)||safe.seenIds.includes(id))return board;
  if(safe.total>=MAX_NUMBER)return board;
  const number=safe.total+1;
  const entry=cleanEntry({id,number,difficulty:round.difficulty,score:round.score,streak:round.bestStreak,food:round.jellies,plastic:round.plastic});
  if(!entry)return board;
  const entries=[...safe.entries,entry];
  return {...safe,total:number,entries:DIFFICULTIES.flatMap(id=>rankedEntries({entries},id)),seenIds:[...safe.seenIds,id].slice(-MAX_RECEIPTS)};
}
