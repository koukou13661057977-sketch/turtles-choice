import {OceanWorld} from './world.js?v=1.8.0';
import {DURATION,DIFFICULTIES,difficultyConfig,TRASH_TYPES,newRound,startRound,tickRound,collectNearby,advanceTargets,stageSpeed,reviewType} from './rules.js?v=1.8.0';
import {OceanMusic} from './music.js?v=1.7.0';
import {STRINGS} from './i18n.js?v=1.8.0';
import {BOARD_KEY,BOOTH_RETURN_SECONDS,localDay,readBoard,addResult,rankedEntries} from './progress.js?v=1.7.0';

import {FOOD_TYPES,isFood} from './catalog.js?v=1.7.0';

import {TURTLE_IDS,turtleConfig,TURTLE_GAME_NOTE} from './turtles.js?v=1.7.0';
import {planEncounter} from './encounters.js?v=1.8.0';
import {nextChallenge} from './debrief.js?v=1.8.0';
import {createPerformanceMonitor} from './performance.js?v=1.7.0';
import {VICTORY_SECONDS,VICTORY_REDUCED_SECONDS} from './victory.js?v=1.7.0';

const $=id=>document.getElementById(id);
function saved(key,fallback){try{return localStorage.getItem(key)??fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}}
const languageSelectors=['lang-btn','pause-lang-btn','result-lang-btn','guide-lang-btn','board-lang-btn'];
const pageLocales={zh:'zh-CN','zh-Hant':'zh-Hant-HK',en:'en'};
const linkLanguage=location.search&&new URLSearchParams(location.search).get('lang');
let lang=Object.hasOwn(STRINGS,linkLanguage)?linkLanguage:saved('turtle-language','zh');
if(!Object.hasOwn(STRINGS,lang))lang='zh';
const tr=(key,vars={})=>(STRINGS[lang][key]??key).replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');
let soundEnabled=saved('turtle-sound','on')!=='off',highQuality=saved('turtle-quality','high')!=='low';
let musicEnabled=saved('turtle-music','on')!=='off',musicVolume=Math.max(0,Math.min(1,Number(saved('turtle-music-volume','0.65'))||0));
let booth=saved('turtle-booth','off')==='on';
let selectedDifficulty=difficultyConfig(saved('turtle-difficulty','normal')).id,boardDifficulty=selectedDifficulty;
let selectedTurtle=turtleConfig(saved('turtle-species','leatherback')).id;
let stageCardTime=0,mealFeedbackTime=0,milestoneTime=0,milestoneKey='',milestoneStreak=0,encounterBeat='observe';
let renderElapsed=0;const performanceMonitor=createPerformanceMonitor();
// Opt-in local QA: ?profile=1 reports observed frame cadence without changing play.
// rAF intervals include browser scheduling; callback wall time is not a GPU timer.
const profileEnabled=location.search?.includes('profile=1');
let profileSeconds=0,profileFrames=0,profileSlowFrames=0,profileWorkMs=0,profileMaxGapMs=0,profileRenders=0;
let mode='home',previousMode='home',panelReturn='home',panelFocus=null,round=newRound(selectedDifficulty),world=null;
let player={x:0,y:0},vx=0,vy=0,keys=new Set(),nextSpawn=0,wave=0,trashCount=0;
let selectedView='first',viewYaw=0,viewPitch=0,lookPointer=null;
const touchKeys=new Map();
let tutorialStep=0,tutorialDone=false,tutorialMove=0,countdownTime=0,lastCount=-1;
let noticeTime=0,toastTime=0,toastKey='',noticeKey='',noticeVars={},last=performance.now(),lastInput=last;
let victory=null;
let audioContext,master,ambience,music,lastMood='';
let board=readBoard(saved(BOARD_KEY,'')),storageAvailable=true,resultId='',resultSaved=false;
let guideType='jelly',guideVariant=0,reviewModel='jelly',guideRect=null,reviewRect=null,layoutDirty=true;
const hudCache={};
function hudText(id,value){if(hudCache[id]!==value){$(id).textContent=value;hudCache[id]=value;}}
function initAudio(){
  if(audioContext){if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});return;}
  try{
    audioContext=new (window.AudioContext||window.webkitAudioContext)();master=audioContext.createGain();master.gain.value=soundEnabled?.2:0;master.connect(audioContext.destination);ambience=audioContext.createGain();ambience.gain.value=.045;ambience.connect(master);music=new OceanMusic(audioContext,master);
    const buffer=audioContext.createBuffer(1,audioContext.sampleRate*3,audioContext.sampleRate),a=buffer.getChannelData(0);let v=0;
    for(let i=0;i<a.length;i++){v=(v+(Math.random()*2-1)*.025)/1.025;a[i]=v;}
    const noise=audioContext.createBufferSource();noise.buffer=buffer;noise.loop=true;const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=380;noise.connect(filter);filter.connect(ambience);noise.start();audioLevel();
  }catch{soundEnabled=false;}
}
function audioLevel(){const muted=['paused','guide','board','error'].includes(mode);if(master)master.gain.setTargetAtTime(soundEnabled&&!muted?.32:0,audioContext.currentTime,.15);music?.setState({enabled:musicEnabled&&soundEnabled,paused:muted,volume:musicVolume});}
function tone(f,duration=.17,delay=0,end=f){if(!audioContext||!soundEnabled)return;const at=audioContext.currentTime+delay,o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.setValueAtTime(f,at);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),at+duration);g.gain.setValueAtTime(.001,at);g.gain.exponentialRampToValueAtTime(.19,at+.015);g.gain.exponentialRampToValueAtTime(.001,at+duration);o.connect(g);g.connect(master);o.start(at);o.stop(at+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};}
function playGood(bonus=0){tone(260,.12,0,510);tone(660,.17,.07);tone(880,.23,.17);if(bonus){tone(1047,.3,.27);tone(1319,.35,.36);}}
function playBad(){tone(190,.27,0,80);tone(145,.25,.12,70);}
function showToast(key){toastKey=key;$('toast').textContent=tr(key);$('toast').classList.add('show');toastTime=3.5;}
function notice(key,bad=false,duration=2.3,vars={}){noticeKey=key;noticeVars=vars;noticeTime=duration;$('notice').textContent=tr(key,vars);$('notice').classList.toggle('bad',bad);$('notice').classList.add('show');}
function isTutorialRound(){
  return mode==='tutorial'||previousMode==='tutorial'&&(mode==='paused'||mode==='guide'&&panelReturn==='paused');
}
function updateLanguage(){
  document.documentElement.lang=pageLocales[lang];
  document.title=tr('pageTitle');
  document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=tr(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-html]').forEach(el=>el.innerHTML=tr(el.dataset.i18nHtml));
  document.querySelectorAll('[data-i18n-aria]').forEach(el=>el.setAttribute('aria-label',tr(el.dataset.i18nAria)));
  for(const id of languageSelectors){
    const select=$(id);
    select.value=lang;
    select.setAttribute('aria-label',tr('language'));
  }
  for(const [id,key,enabled] of [['sound-btn',soundEnabled?'soundOn':'soundOff',soundEnabled],['music-btn',musicEnabled?'musicOn':'musicOff',musicEnabled]]){$(id).title=tr(key);$(id).setAttribute('aria-label',tr(key));$(id).setAttribute('aria-pressed',String(enabled));}
  $('sound-btn').classList.toggle('muted',!soundEnabled);$('music-btn').classList.toggle('is-off',!musicEnabled);
  $('music-volume').setAttribute('aria-label',tr('musicVolume'));$('music-volume').title=tr('musicVolume');$('music-volume').value=Math.round(musicVolume*100);
  $('fullscreen-btn').title=tr('fullscreen');$('fullscreen-btn').setAttribute('aria-label',tr('fullscreen'));
  $('quality-btn').textContent=highQuality?'HQ':'LQ';$('quality-btn').title=tr(highQuality?'hq':'lq');$('quality-btn').setAttribute('aria-label',$('quality-btn').title);
  $('booth-btn').setAttribute('aria-pressed',String(booth));$('booth-status').textContent=tr('boothStatus');$('booth-status').hidden=!booth;$('desktop-note').hidden=booth;
  if(noticeKey)$('notice').textContent=tr(noticeKey,noticeVars);
  if(toastTime)$('toast').textContent=tr(toastKey);
  if(milestoneTime)$('milestone').textContent=tr(milestoneKey,{n:milestoneStreak});
  if(lastCount===0)$('countdown').textContent=tr('ready');
  renderDifficulty();renderTurtle();updateStageText();
  updateHUD();
  if(isTutorialRound())renderTutorial();
  if(mode==='results')renderResults();if(mode==='guide')renderGuideText();if(mode==='board')renderBoard();
  $('loading-label').textContent=tr('loading');layoutDirty=true;
}
function renderTurtle(){
  const config=turtleConfig(selectedTurtle);
  for(const id of TURTLE_IDS){$(`turtle-${id}`).textContent=turtleConfig(id)[lang];$(`turtle-${id}`).setAttribute('aria-pressed',String(id===selectedTurtle));}
  $('turtle-name').textContent=config[lang];$('turtle-latin').textContent=config.latin;$('turtle-description').textContent=config.description[lang];$('turtle-game-note').textContent=TURTLE_GAME_NOTE[lang];
}
function updateViewControls(){
  const active=mode==='playing'||mode==='tutorial';
  const firstPerson=selectedView==='first';
  $('view-first').setAttribute('aria-pressed',String(firstPerson));
  $('view-overhead').setAttribute('aria-pressed',String(!firstPerson));
  $('look-surface').hidden=!active||!firstPerson;
  $('touch-move').hidden=!active;
  $('view-look').hidden=!active||!firstPerson;
  $('view-look-touch').hidden=!active||!firstPerson;
  if(!active){lookPointer=null;touchKeys.clear();}
  if(mode==='countdown'){viewYaw=0;viewPitch=0;}
}
function turnView(yaw,pitch){
  viewYaw=Math.max(-.38,Math.min(.38,viewYaw+yaw));
  viewPitch=Math.max(-.25,Math.min(.25,viewPitch+pitch));
}
function screens(){
  $('home').hidden=mode!=='home';$('game-ui').hidden=!['playing','tutorial','countdown','paused'].includes(mode);$('pause-screen').hidden=mode!=='paused';$('results').hidden=mode!=='results';$('guide-screen').hidden=mode!=='guide';$('board-screen').hidden=mode!=='board';
  const tut=mode==='tutorial'||mode==='paused'&&previousMode==='tutorial';$('tutorial-card').hidden=!tut;$('practice-label').hidden=!tut;$('countdown').hidden=mode!=='countdown';$('streak-display').hidden=tut||mode==='countdown';
  updateViewControls();
  document.body.classList.toggle('playing',mode!=='home');document.body.classList.toggle('guide-open',mode==='guide');layoutDirty=true;renderElapsed=0;audioLevel();
}
function updateHUD(){
  if(hudCache.lives!==round.lives){$('hearts').innerHTML=Array.from({length:3},(_,i)=>`<svg class="heart${i>=round.lives?' empty':''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C8 17.6 3 13.9 3 8.7A4.7 4.7 0 0 1 12 6.8a4.7 4.7 0 0 1 9 1.9c0 5.2-5 8.9-9 12.3Z"/></svg>`).join('');hudCache.lives=round.lives;}
  $('hearts').setAttribute('aria-label',`${tr('health')}: ${round.lives} / 3`);hudText('score-value',String(round.score).padStart(3,'0'));
  const left=Math.ceil(DURATION-round.elapsed);hudText('timer-value',`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`);
  if(hudCache.left!==left){$('timer-fill').style.width=`${100*left/DURATION}%`;hudCache.left=left;}
  hudText('goal-count',`${round.jellies} / ${difficultyConfig(round.difficulty).goal}`);hudText('streak-value',String(round.streak));
  if(hudCache.streak!==round.streak){$('streak-pips').innerHTML=Array.from({length:5},(_,i)=>`<i class="streak-pip${i<(round.streak%5|| (round.streak?5:0))?' filled':''}"></i>`).join('');hudCache.streak=round.streak;}
  const tutorial=isTutorialRound();hudText('stage-label',tr(tutorial?'tutorialStage':`stage${round.stage}`));hudText('stage-num',tutorial?'01 — 03':`0${round.stage+1} / 03`);
  hudText('difficulty-badge',tr(`difficultyShort_${round.difficulty}`)+' · '+turtleConfig(selectedTurtle)[lang]);
  hudText('encounter-cue',tr(`beat_${encounterBeat}`));$('encounter-cue').hidden=mode!=='playing';
  for(let i=0;i<3;i++){hudText(`journey-${i}`,tr(`journey${i}`));$(`journey-${i}`).classList.toggle('active',round.stage===i);$(`journey-${i}`).classList.toggle('done',round.stage>i);}
  hudText('speed-note',round.slow>0?tr('slow'):tr(booth?'boothKeys':'comboHint'));
}
function reset(){victory=null;milestoneTime=0;$('milestone').hidden=true;encounterBeat='observe';round=newRound(selectedDifficulty);stageCardTime=0;mealFeedbackTime=0;$('stage-card').hidden=true;$('meal-feedback').hidden=true;player={x:0,y:0};vx=vy=0;keys.clear();world.guideEnabled=false;world.clearTargets();wave=0;trashCount=0;nextSpawn=0;noticeTime=0;noticeKey='';resultSaved=false;resultId='';lastMood='';$('notice').classList.remove('show');$('bite-prompt').hidden=true;$('hurt-flash').classList.remove('flash');$('streak-display').classList.remove('reward');lastInput=performance.now();}
function goHome(){if(!world)return;reset();mode='home';world.setMode('home');screens();updateHUD();$('start-btn').focus({preventScroll:true});}
function startTutorial(){if(!world)return;initAudio();reset();viewYaw=0;viewPitch=0;mode='tutorial';world.setMode('play');tutorialStep=0;tutorialMove=0;tutorialDone=false;screens();setupTutorial();document.activeElement?.blur();}
function setupTutorial(){
  world.clearTargets();player={x:0,y:0};vx=vy=0;tutorialDone=tutorialStep===2;keys.clear();noticeTime=0;$('notice').classList.remove('show');
  if(tutorialStep===1)world.spawn('jelly',1.8,.1,.7,.88,0);
  if(tutorialStep===2){world.spawn('bag',-2,.2,.6,.86,0);world.spawn('balloon',1.9,.3,.2,.86,1);world.spawn('film',-.2,1.9,-.1,.86,2);world.spawn('glove',3.6,1.6,-2,.86,0);}
  renderTutorial();updateHUD();
}
function renderTutorial(){
  $('tutorial-card').dataset.step=String(tutorialStep);
  $('tutorial-step').textContent=`0${tutorialStep+1} / 03`;$('tutorial-title').textContent=tr(`tut${tutorialStep}Title`);$('tutorial-text').textContent=tr(`tut${tutorialStep}Body`);$('tutorial-key').innerHTML=tr(tutorialDone&&tutorialStep<2?`tut${tutorialStep}Done`:`tut${tutorialStep}Key`);$('tutorial-next').disabled=!tutorialDone;$('tutorial-next').firstElementChild.textContent=tr(tutorialStep===2?'beginRound':'next');
}
function beginCountdown(){if(!world)return;initAudio();reset();mode='countdown';world.setMode('play');countdownTime=3;lastCount=-1;screens();updateHUD();document.activeElement?.blur();}
function beginPlay(){mode='playing';startRound(round);nextSpawn=2.5;wave=0;world.spawn('jelly',0,.05,-18,.87,0);world.spawn('bag',-3,1.1,-26,.85,0);screens();updateHUD();showStageCard();}
function pause(){if(!['playing','tutorial','countdown'].includes(mode))return;previousMode=mode;mode='paused';if(round.status==='running')round.status='paused';keys.clear();vx=vy=0;$('bite-prompt').hidden=true;screens();$('resume-btn').focus({preventScroll:true});}
function resume(){if(mode!=='paused')return;mode=previousMode;if(mode==='playing')round.status='running';last=performance.now();keys.clear();screens();document.activeElement?.blur();}
function currentBoard(){if(board.day!==localDay())board=readBoard(saved(BOARD_KEY,''));return board;}
function finish(){
  if(mode==='victory'||mode==='results')return;
  keys.clear();vx=vy=0;world.aim(null);$('bite-prompt').hidden=true;$('hurt-flash').classList.remove('flash');
  if(!resultSaved){resultId=globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random()}`;board=addResult(currentBoard(),round,resultId);storageAvailable=save(BOARD_KEY,JSON.stringify(board));resultSaved=true;}
  if(round.outcome==='success'){
    victory={elapsed:0,reduced:!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches};
    mode='victory';world.clearTargets();world.setMode('victory');screens();
    tone(523,.27);tone(659,.3,.17);tone(784,.48,.35);tone(1047,.62,.63);
    return;
  }
  tone(247,.35);showResults();
}
function showResults(){
  victory=null;mode='results';world.setMode('results');
  reviewModel=reviewType(round);world.setGuide(reviewModel,round.mistakeVariants[reviewModel]??0);lastInput=performance.now();screens();renderResults();
  if(!storageAvailable)showToast('storageUnavailable');$('again-btn').focus({preventScroll:true});
}
function renderResults(){
  const p=round.outcome==='success'?'success':round.outcome==='hurt'?'hurt':'hungry';
  $('result-symbol').textContent=p==='success'?'✦':'≈';$('result-eyebrow').textContent=tr(`${p}Eye`);$('result-title').textContent=tr(`${p}Title`);$('result-subtitle').textContent=tr(`${p}Sub`,{n:difficultyConfig(round.difficulty).goal});
  $('result-difficulty').textContent=tr(`difficulty_${round.difficulty}`)+' · '+tr('roundGoal',{n:difficultyConfig(round.difficulty).goal});
  $('result-score').textContent=round.score;$('result-food').textContent=round.jellies;$('result-plastic').textContent=round.plastic;$('result-streak').textContent=round.bestStreak;$('result-bonus').textContent=`+${round.bonus}`;
  const rank=rankedEntries(currentBoard(),round.difficulty).findIndex(x=>x.id===resultId)+1;$('result-rank').textContent=rank?tr('yourRank',{n:rank})+' ↗':tr('outsideBoard')+' ↗';
  const challenge=nextChallenge(currentBoard(),round,resultId);
  $('challenge-title').textContent=tr(`challenge_${challenge.kind}`,{n:challenge.pointsNeeded,rank:challenge.targetRank});
  $('challenge-tip').textContent=tr(`challengeTip_${challenge.tip}`,{name:tr(`name_${challenge.type}`),n:challenge.remaining,streak:challenge.streakTarget});
  $('again-btn').firstElementChild.textContent=tr(booth?'nextPlayer':'playAgain');
  $('review-eyebrow').textContent=tr(round.plastic?'reviewEye':'reviewClean');$('review-title').textContent=round.plastic?tr('reviewCount',{name:tr(`name_${reviewModel}`),n:round.mistakes[reviewModel]}):tr('noMistakes');
  $('review-clue-1').textContent=tr(`clue1_${reviewModel}`);$('review-clue-2').textContent=tr(`clue2_${reviewModel}`);$('review-tip').textContent=tr(`tip_${reviewModel}`);$('booth-countdown').hidden=!booth;layoutDirty=true;
}
function autoAbsorb(dt){
  if(mode==='playing'){
    const targets=collectNearby(round,world.targets,player,dt);
    for(const target of targets){
      const reachedGoal=isFood(target.type)&&round.jellies>=round.goal&&!round.goalCelebrated;
      if(reachedGoal)round.goalCelebrated=true;
      target.feedback=reachedGoal?'goal':target.bonus?'combo':'normal';
      if(reachedGoal||target.bonus){
        milestoneTime=2.4;milestoneKey=reachedGoal?'goalCelebration':'comboCelebration';milestoneStreak=round.streak;
        $('milestone').hidden=false;$('milestone').textContent=tr(milestoneKey,{n:milestoneStreak});
        if(reachedGoal){tone(1047,.22,.22);tone(1568,.45,.4);}
      }
      if(isFood(target.type)){
        playGood(target.bonus);notice(target.bonus?'combo':round.jellies===difficultyConfig(round.difficulty).goal?'goalReached':'good',false,2.3,{n:round.streak});
        if(target.bonus){$('streak-display').classList.remove('reward');void $('streak-display').offsetWidth;$('streak-display').classList.add('reward');}
      }else{playBad();notice(`bad_${target.type}`,true);$('hurt-flash').classList.add('flash');}
      mealFeedbackTime=.9;$('meal-feedback').hidden=false;$('meal-feedback').textContent=isFood(target.type)?`+${10+(target.bonus||0)}`:'−1 ♥';$('meal-feedback').classList.toggle('bad',!isFood(target.type));$('meal-feedback').style.animation='none';void $('meal-feedback').offsetWidth;$('meal-feedback').style.animation='';
      world.consume(target);
    }
    if(targets.length)updateHUD();if(round.status==='finished')finish();
  }else if(mode==='tutorial'){
    for(const target of advanceTargets(world.targets,player,dt)){
      target.consumed=true;target.pulling=false;world.consume(target);
      if(isFood(target.type)){playGood();tutorialDone=true;renderTutorial();notice('tut1Done');}else{playBad();notice('tut2Done',true,4);}
    }
  }
}
function renderDifficulty(){
  for(const id of Object.keys(DIFFICULTIES))$(`difficulty-${id}`).setAttribute('aria-pressed',String(id===selectedDifficulty));
  $('difficulty-desc').textContent=tr(`difficultyDesc_${selectedDifficulty}`,{n:difficultyConfig(selectedDifficulty).goal});$('home-goal').textContent=difficultyConfig(selectedDifficulty).goal;
}
function updateStageText(){
  $('stage-card-number').textContent=`0${round.stage+1} / 03 · ${tr(`difficultyShort_${round.difficulty}`)}`;
  $('stage-card-title').textContent=tr(`stage${round.stage}`);$('stage-card-desc').textContent=tr(`phaseHint${round.stage}`);
}
function showStageCard(){stageCardTime=3.4;updateStageText();$('stage-card').hidden=false;document.body.dataset.stage=String(round.stage);}
function spawnWave(){
  const plan=planEncounter({stage:round.stage,wave:wave++,difficulty:round.difficulty});
  for(const target of plan.targets)world.spawn(target.type,target.x,target.y,target.z,target.scale,target.variant);
  encounterBeat=plan.beat;return plan.delay;
}
function openPanel(next){
  if(!world||!['home','results','paused'].includes(mode))return false;
  panelReturn=mode;panelFocus=document.activeElement;mode=next;keys.clear();vx=vy=0;lastInput=performance.now();screens();return true;
}
function openGuide(type='jelly',variant=0){
  if(!openPanel('guide'))return;guideType=type;guideVariant=variant;world.setGuide(type,variant);world.guideEnabled=true;renderGuideText();$('guide-close-btn').focus({preventScroll:true});
}
function renderGuideText(){
  document.querySelectorAll('[data-guide-type]').forEach(b=>{b.textContent=tr(`name_${b.dataset.guideType}`);b.setAttribute('aria-pressed',String(b.dataset.guideType===guideType));});
  $('guide-kind').textContent=tr(isFood(guideType)?'foodLabel':'trashLabel');$('guide-title').textContent=tr(`name_${guideType}`);$('guide-clue-1').textContent=tr(`clue1_${guideType}`);$('guide-clue-2').textContent=tr(`clue2_${guideType}`);$('guide-detail').textContent=tr(`detail_${guideType}`);$('guide-tip').textContent=tr(`tip_${guideType}`);$('guide-variant').textContent=tr('variant',{n:guideVariant+1});layoutDirty=true;
}
function chooseGuide(type,variant=0){guideType=type;guideVariant=variant;world.setGuide(type,variant);renderGuideText();}
function openBoard(){if(!openPanel('board'))return;boardDifficulty=panelReturn==='results'?round.difficulty:selectedDifficulty;renderBoard();$('board-close-btn').focus({preventScroll:true});}
function renderBoard(){
  const b=currentBoard();$('board-date').textContent=tr('boardDate',{date:b.day});$('board-body').replaceChildren();
  const entries=rankedEntries(b,boardDifficulty);for(const id of Object.keys(DIFFICULTIES))$(`board-${id}`).setAttribute('aria-pressed',String(id===boardDifficulty));
  $('board-summary').textContent=tr('boardSummary',{difficulty:tr(`difficultyShort_${boardDifficulty}`),n:entries.length,best:entries[0]?.score??0});
  entries.forEach((entry,index)=>{const row=document.createElement('tr');row.classList.toggle('current',entry.id===resultId);for(const value of [String(index+1).padStart(2,'0'),`${tr('explorer')} ${String(entry.number).padStart(3,'0')}`,entry.score,entry.streak]){const cell=document.createElement('td');cell.textContent=value;row.appendChild(cell);}$('board-body').appendChild(row);});
  $('board-empty').hidden=entries.length>0;$('board-storage-note').hidden=storageAvailable;
}
function closePanel(){
  if(!['guide','board'].includes(mode))return;world.guideEnabled=false;world.guideDragging=false;mode=panelReturn;lastInput=performance.now();
  if(mode==='results'){world.setGuide(reviewModel,round.mistakeVariants[reviewModel]??0);renderResults();}
  screens();panelFocus?.focus({preventScroll:true});last=performance.now();
}
async function fullscreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{showToast('fullscreenFail');}}
function trapFocus(e){
  const id={paused:'pause-screen',results:'results',guide:'guide-screen',board:'board-screen',error:'error-screen'}[mode];if(e.code!=='Tab'||!id)return;
  const items=[...$(id).querySelectorAll('button:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]')].filter(x=>!x.hidden&&x.getClientRects().length);
  if(!items.length)return;const first=items[0],end=items.at(-1),active=document.activeElement;
  if(e.shiftKey&&(active===first||!$(id).contains(active))){e.preventDefault();end.focus();}else if(!e.shiftKey&&(active===end||!$(id).contains(active))){e.preventDefault();first.focus();}
}
function bindViewControls(){
  for(const id of ['first','overhead'])$(`view-${id}`).onclick=()=>{
    if(mode!=='home')return;
    selectedView=id;
    updateViewControls();
  };

  const look=$('look-surface');
  look.onpointerdown=e=>{
    if(look.hidden||lookPointer||e.button!==0)return;
    if(e.pointerType==='touch'){
      const bounds=look.getBoundingClientRect();
      if(e.clientX<bounds.left+bounds.width/2)return;
    }
    lookPointer={id:e.pointerId,x:e.clientX,y:e.clientY};
    look.setPointerCapture(e.pointerId);
  };
  look.onpointermove=e=>{
    if(lookPointer?.id!==e.pointerId)return;
    turnView((e.clientX-lookPointer.x)*.004,(lookPointer.y-e.clientY)*.004);
    lookPointer.x=e.clientX;lookPointer.y=e.clientY;
  };
  const endLook=e=>{if(lookPointer?.id===e.pointerId)lookPointer=null;};
  look.onpointerup=look.onpointercancel=look.onlostpointercapture=endLook;

  for(const [direction,code] of [['up','KeyW'],['down','KeyS'],['left','KeyA'],['right','KeyD']]){
    const button=$(`touch-${direction}`);
    button.onpointerdown=e=>{
      if($('touch-move').hidden||touchKeys.has(code)||e.button!==0)return;
      e.preventDefault();
      touchKeys.set(code,e.pointerId);
      button.setPointerCapture(e.pointerId);
    };
    const release=e=>{if(touchKeys.get(code)===e.pointerId)touchKeys.delete(code);};
    button.onpointerup=button.onpointercancel=button.onlostpointercapture=release;
  }
}
function bind(){
  bindViewControls();
  for(const id of TURTLE_IDS)$(`turtle-${id}`).onclick=()=>{if(mode!=='home')return;selectedTurtle=id;save('turtle-species',id);world?.setTurtle(id);renderTurtle();};
  for(const id of Object.keys(DIFFICULTIES)){$(`difficulty-${id}`).onclick=()=>{selectedDifficulty=id;save('turtle-difficulty',id);round=newRound(id);renderDifficulty();updateHUD();};$(`board-${id}`).onclick=()=>{boardDifficulty=id;renderBoard();};}
  $('start-btn').onclick=startTutorial;$('quick-btn').onclick=beginCountdown;
  $('tutorial-next').onclick=()=>{if(!tutorialDone)return;if(tutorialStep===2)beginCountdown();else{tutorialStep++;setupTutorial();}};
  $('tutorial-skip').onclick=beginCountdown;$('pause-btn').onclick=pause;$('resume-btn').onclick=resume;$('restart-btn').onclick=beginCountdown;$('back-btn').onclick=goHome;$('again-btn').onclick=beginCountdown;$('result-home-btn').onclick=goHome;
  $('guide-home-btn').onclick=()=>openGuide();$('guide-pause-btn').onclick=()=>openGuide();$('review-guide-btn').onclick=()=>openGuide(reviewModel,round.mistakeVariants[reviewModel]??0);
  $('guide-close-btn').onclick=closePanel;$('board-close-btn').onclick=closePanel;
  for(const id of ['board-home-btn','board-result-btn','result-rank'])$(id).onclick=openBoard;
  document.querySelectorAll('[data-guide-type]').forEach(b=>b.onclick=()=>chooseGuide(b.dataset.guideType));
  $('guide-variant-btn').onclick=()=>chooseGuide(guideType,(guideVariant+1)%3);$('guide-reset-btn').onclick=()=>world.setGuide(guideType,guideVariant);
  let pointer=null;
  $('guide-viewport').onpointerdown=e=>{if(!world)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};world.guideDragging=true;e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.focus();};
  $('guide-viewport').onpointermove=e=>{if(!pointer||pointer.id!==e.pointerId)return;world.rotateGuide(e.clientX-pointer.x,e.clientY-pointer.y);pointer.x=e.clientX;pointer.y=e.clientY;};
  const endDrag=()=>{pointer=null;if(world)world.guideDragging=false;};$('guide-viewport').onpointerup=endDrag;$('guide-viewport').onpointercancel=endDrag;$('guide-viewport').onlostpointercapture=endDrag;
  $('booth-btn').onclick=async()=>{booth=!booth;save('turtle-booth',booth?'on':'off');initAudio();updateLanguage();showToast(booth?'boothOn':'boothOff');document.activeElement?.blur();if(booth&&!document.fullscreenElement)await fullscreen();};
  $('brand-home').onclick=e=>{e.preventDefault();if(['playing','tutorial','countdown'].includes(mode))pause();else if(mode==='home')goHome();};
  for(const id of languageSelectors)$(id).onchange=e=>{
    const chosen=e.currentTarget.value;
    if(!Object.hasOwn(STRINGS,chosen))return;
    lang=chosen;
    save('turtle-language',lang);
    updateLanguage();
  };
  $('sound-btn').onclick=()=>{soundEnabled=!soundEnabled;save('turtle-sound',soundEnabled?'on':'off');initAudio();audioLevel();updateLanguage();showToast(soundEnabled?'soundOn':'soundOff');document.activeElement?.blur();};
  $('music-btn').onclick=()=>{musicEnabled=!musicEnabled;save('turtle-music',musicEnabled?'on':'off');if(musicEnabled){soundEnabled=true;save('turtle-sound','on');}initAudio();audioLevel();updateLanguage();showToast(musicEnabled?'musicOn':'musicOff');document.activeElement?.blur();};
  $('music-volume').oninput=e=>{musicVolume=Number(e.target.value)/100;save('turtle-music-volume',String(musicVolume));if(musicVolume>0){musicEnabled=true;soundEnabled=true;save('turtle-music','on');save('turtle-sound','on');}initAudio();audioLevel();updateLanguage();};
  $('quality-btn').onclick=()=>{highQuality=!highQuality;world?.quality(highQuality);performanceMonitor.reset();save('turtle-quality',highQuality?'high':'low');updateLanguage();showToast(highQuality?'qualityHigh':'qualityLow');document.activeElement?.blur();};
  $('fullscreen-btn').onclick=()=>{fullscreen();document.activeElement?.blur();};$('reload-btn').onclick=()=>location.reload();
  document.addEventListener('keydown',e=>{
    lastInput=performance.now();if(e.altKey||e.ctrlKey||e.metaKey)return;trapFocus(e);
    if(document.activeElement?.tagName==='SELECT')return;
    if(e.code==='Escape'){e.preventDefault();if(['guide','board'].includes(mode))closePanel();else if(mode==='paused')resume();else pause();return;}
    if(mode==='guide'&&document.activeElement===$('guide-viewport')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){e.preventDefault();world.rotateGuide(e.code==='ArrowLeft'?-12:e.code==='ArrowRight'?12:0,e.code==='ArrowUp'?-10:e.code==='ArrowDown'?10:0);return;}
    if((e.code==='KeyR'&&mode==='results')||(e.code==='Enter'&&['home','results'].includes(mode)&&!['BUTTON','A','INPUT'].includes(document.activeElement?.tagName))){e.preventDefault();if(!e.repeat)beginCountdown();return;}
    if(!['playing','tutorial'].includes(mode)||document.activeElement?.tagName==='INPUT')return;
    if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code!=='Space')keys.add(e.code);
  });
  document.addEventListener('keyup',e=>keys.delete(e.code));
  for(const event of ['pointerdown','pointermove','wheel'])document.addEventListener(event,()=>{lastInput=performance.now();},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else lastInput=performance.now();});window.addEventListener('blur',()=>{pause();keys.clear();});
  if(globalThis.ResizeObserver){const observer=new ResizeObserver(()=>{layoutDirty=true;});for(const id of ['guide-viewport','review-viewport','result-layout'])observer.observe($(id));}
  window.addEventListener('resize',()=>{layoutDirty=true;});document.addEventListener('scroll',()=>{layoutDirty=true;},true);
  window.addEventListener('storage',e=>{if(e.key===BOARD_KEY){board=readBoard(e.newValue);if(mode==='board')renderBoard();if(mode==='results')renderResults();}});
}
function measure(id,clipId){
  const r=$(id).getBoundingClientRect(),rect={left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
  if(clipId){const c=$(clipId).getBoundingClientRect();rect.clip={left:c.left,right:c.right,top:c.top,bottom:c.bottom};}return rect;
}
function updatePins(prefix,rect){if(!rect)return;world.guidePins(rect).forEach((p,i)=>{const el=$(`${prefix}-pin-${i+1}`);el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;});}
function updateSimulation(dt){
    milestoneTime=Math.max(0,milestoneTime-dt);$('milestone').hidden=!milestoneTime;
    stageCardTime=Math.max(0,stageCardTime-dt);$('stage-card').hidden=!stageCardTime;mealFeedbackTime=Math.max(0,mealFeedbackTime-dt);$('meal-feedback').hidden=!mealFeedbackTime;
    noticeTime=Math.max(0,noticeTime-dt);if(!noticeTime)$('notice').classList.remove('show');if(round.slow<2.25)$('hurt-flash').classList.remove('flash');
    if(mode==='countdown'){countdownTime-=dt;const count=Math.ceil(countdownTime);if(count!==lastCount){lastCount=count;$('countdown').textContent=count>0?count:tr('ready');tone(count>0?440:880,.12);}if(countdownTime<=0)beginPlay();return;}
    if(mode==='playing'){
      const stage=round.stage;tickRound(round,dt);
      if(round.status==='finished')finish();else{if(round.stage!==stage){wave=0;encounterBeat=round.stage===1?'choose':'rush';showStageCard();nextSpawn=2.4;}nextSpawn-=dt;if(nextSpawn<=0){nextSpawn+=spawnWave();}}
    }
    if(['playing','tutorial'].includes(mode)){
      const right=keys.has('KeyD')||keys.has('ArrowRight')||touchKeys.has('KeyD');
      const left=keys.has('KeyA')||keys.has('ArrowLeft')||touchKeys.has('KeyA');
      const up=keys.has('KeyW')||keys.has('ArrowUp')||touchKeys.has('KeyW');
      const down=keys.has('KeyS')||keys.has('ArrowDown')||touchKeys.has('KeyS');
      const ix=Number(right)-Number(left),iy=Number(up)-Number(down);
      const normal=ix&&iy?Math.SQRT1_2:1,speed=round.slow>0?3.8:6.2;
      if(selectedView==='first'){
        const turn=Number(keys.has('KeyE'))-Number(keys.has('KeyQ'));
        if(turn)turnView(turn*dt*1.4,0);
      }
      vx+=(ix*speed*normal-vx)*(1-Math.exp(-(ix?17:24)*dt));vy+=(iy*speed*normal-vy)*(1-Math.exp(-(iy?17:24)*dt));player.x=Math.max(-4.4,Math.min(4.4,player.x+vx*dt));player.y=Math.max(-1.85,Math.min(2.25,player.y+vy*dt));
      if(mode==='tutorial'&&tutorialStep===0&&!tutorialDone){tutorialMove+=(Math.abs(vx)+Math.abs(vy))*dt;if(tutorialMove>.85){tutorialDone=true;renderTutorial();}}
      autoAbsorb(dt);
    }
}
function frame(now){
  const profiling=profileEnabled&&!document.hidden,workStart=profiling?performance.now():0;
  const raw=Math.max(0,(now-last)/1000);last=now;
  // A stalled/hidden window must not consume a round while the player cannot react.
  if(raw>1)pause();
  const dt=Math.min(raw,1),frozen=['paused','guide','board','error'].includes(mode);
  // Keep the clock, steering, spawning and attraction on the same elapsed time.
  // Only simulation is substepped; scene animation and rendering run once below.
  if(!frozen){const steps=Math.ceil(dt/.05);for(let i=0;i<steps;i++)updateSimulation(dt/steps);}
  if(victory&&mode==='victory'&&!document.hidden)victory.elapsed+=Math.min(dt,.1);
  toastTime=Math.max(0,toastTime-dt);if(!toastTime)$('toast').classList.remove('show');
  const autoActive=['playing','tutorial'].includes(mode),pulling=world.targets.some(t=>t.pulling&&!t.eaten);
  $('bite-prompt').hidden=!(autoActive&&(pulling||world.biteTime>0));hudText('bite-label',tr(pulling?'bitePrompt':'swallowed'));
  const mood=`${round.stage}/${round.slow>0}`;if(music&&mood!==lastMood){music.setMood(round.stage,round.slow>0);lastMood=mood;}
  if(booth){
    const idle=(now-lastInput)/1000,reviewing=['guide','board'].includes(mode)&&panelReturn==='results';
    if(mode==='results')hudText('booth-countdown',tr('boothReturn',{n:Math.max(0,Math.ceil(BOOTH_RETURN_SECONDS-idle))}));
    if(mode==='results'&&idle>=BOOTH_RETURN_SECONDS||reviewing&&idle>=60)goHome();
  }
  if(layoutDirty){guideRect=mode==='guide'?measure('guide-viewport'):null;reviewRect=mode==='results'?measure('review-viewport','result-layout'):null;layoutDirty=false;}
  // Render at most 60 Hz during play and 30 Hz in menus; simulation keeps real time.
  renderElapsed+=dt;const renderInterval=autoActive||mode==='victory'?1/60:1/30;
  if(renderElapsed+1e-7>=renderInterval){
    const renderDt=renderElapsed;renderElapsed=0;const renderStart=performance.now(),renderFrameBefore=profiling?(world.renderer.info?.render?.frame??0):0;
    world.update(renderDt,{player,vx,vy,autoActive,paused:frozen,moving:mode==='playing',speed:stageSpeed(round.stage,round.difficulty)*(round.slow>0?.48:1),slow:round.slow>0,stage:round.stage,guideRect,reviewRect,view:selectedView,viewYaw,viewPitch,victory});
    if(profiling)profileRenders+=Math.max(0,(world.renderer.info?.render?.frame??0)-renderFrameBefore);
    if(performanceMonitor.sample({dt:renderDt,workMs:performance.now()-renderStart,active:mode==='playing',visible:!document.hidden,highQuality})&&world.applyAdaptiveQuality())showToast('qualityAdaptive');
  }
  if(victory&&victory.elapsed>=(victory.reduced?VICTORY_REDUCED_SECONDS:VICTORY_SECONDS))showResults();
  if(mode==='guide')updatePins('guide',guideRect);if(mode==='results')updatePins('review',reviewRect);if(mode==='playing')updateHUD();
  if(profiling){
    profileSeconds+=raw;profileFrames++;profileWorkMs+=performance.now()-workStart;profileMaxGapMs=Math.max(profileMaxGapMs,raw*1000);if(raw>.1)profileSlowFrames++;
    if(profileSeconds>=10){document.body.dataset.frameSample=JSON.stringify({mode,quality:highQuality?'HQ':'LQ',seconds:+profileSeconds.toFixed(2),fps:+(profileFrames/profileSeconds).toFixed(1),renderFps:+(profileRenders/profileSeconds).toFixed(1),workMs:+(profileWorkMs/profileFrames).toFixed(2),maxGapMs:+profileMaxGapMs.toFixed(1),over100ms:profileSlowFrames,viewport:[innerWidth,innerHeight]});console.info('Turtle frame sample',document.body.dataset.frameSample);profileSeconds=0;profileFrames=0;profileSlowFrames=0;profileWorkMs=0;profileMaxGapMs=0;profileRenders=0;}
  }
  requestAnimationFrame(frame);
}
updateLanguage();bind();
try{
  world=new OceanWorld($('ocean'));world.quality(highQuality);world.setTurtle(selectedTurtle);
  world.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();mode='error';world.guideEnabled=false;$('error-screen').hidden=false;screens();});
  world.update(0,{player,vx,vy,paused:false,moving:false,speed:0,slow:false,stage:0});
  $('loading').style.opacity='0';setTimeout(()=>$('loading').hidden=true,500);screens();requestAnimationFrame(frame);
}catch(error){console.error('Ocean initialization failed:',error);$('loading').hidden=true;$('error-screen').hidden=false;mode='error';screens();}
