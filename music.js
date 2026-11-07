// An original, softly looping 72 BPM ocean score. No remote audio assets.
export const EIGHTH_SECONDS=60/72/2;
export const LOOP_STEPS=64;
const CHORDS=[[50,54,57,61],[47,54,57,62],[43,50,54,59],[45,52,57,59],[50,54,57,64],[47,54,57,62],[43,50,54,59],[45,52,57,61]];
const MELODY=[74,null,null,78,81,null,78,null,76,null,74,null,69,null,null,null,71,null,null,74,78,null,76,null,73,null,71,null,69,null,null,null,74,null,78,null,81,null,null,83,81,null,78,null,76,null,null,null,74,null,71,null,69,null,66,null,69,null,73,null,76,null,null,null];
export function notesAtStep(step){
  const s=((step%LOOP_STEPS)+LOOP_STEPS)%LOOP_STEPS,bar=Math.floor(s/8),beat=s%8,chord=CHORDS[bar],notes=[];
  if(beat===0){notes.push({midi:chord[0]-12,duration:EIGHTH_SECONDS*7.7,voice:'bass',gain:.14});for(const midi of chord)notes.push({midi,duration:EIGHTH_SECONDS*8.2,voice:'pad',gain:.033});}
  if(beat%2===0)notes.push({midi:chord[[0,2,1,3][beat/2]]+12,duration:1.2,voice:'pluck',gain:.06});
  if(MELODY[s]!==null)notes.push({midi:MELODY[s],duration:1.9,voice:'bell',gain:.115});
  return notes;
}
export class OceanMusic {
  constructor(context,destination){
    this.context=context;this.output=context.createGain();this.output.gain.value=0;this.output.connect(destination);this.bus=context.createGain();this.colour=context.createBiquadFilter();this.colour.type='lowpass';this.colour.frequency.value=2500;this.bus.connect(this.colour);this.colour.connect(this.output);this.stage=0;
    this.delay=context.createDelay(2);this.delay.delayTime.value=EIGHTH_SECONDS*.75;const feedback=context.createGain();feedback.gain.value=.25;const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2300;const wet=context.createGain();wet.gain.value=.24;
    this.bus.connect(this.delay);this.delay.connect(filter);filter.connect(feedback);feedback.connect(this.delay);filter.connect(wet);wet.connect(this.output);
    this.enabled=true;this.paused=false;this.volume=.65;this.step=0;this.nextTime=context.currentTime+.12;
    this.timer=setInterval(()=>this.schedule(),50);
  }
  setState({enabled,paused,volume}){
    const previouslyAudible=this.enabled&&!this.paused;this.enabled=enabled;this.paused=paused;this.volume=volume;
    const audible=enabled&&!paused;this.output.gain.setTargetAtTime(audible?volume:0,this.context.currentTime,.22);
    if(audible&&!previouslyAudible)this.nextTime=this.context.currentTime+.12;
    if(audible)this.schedule();
  }
  setMood(stage=0,hurt=false){this.stage=stage;this.colour.frequency.setTargetAtTime(hurt?620:[2500,1800,3200][stage],this.context.currentTime,.35);}
  note({midi,duration,voice,gain},at){
    const ctx=this.context,f=440*Math.pow(2,(midi-69)/12),env=ctx.createGain();env.connect(this.bus);
    env.gain.setValueAtTime(.0001,at);
    const pad=voice==='pad'||voice==='bass';env.gain.exponentialRampToValueAtTime(gain,at+(pad?.55:.015));env.gain.exponentialRampToValueAtTime(.0001,at+duration);
    const osc=ctx.createOscillator();osc.type=voice==='pad'?'triangle':'sine';osc.frequency.value=f;
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=pad?720:4000;osc.connect(filter);filter.connect(env);osc.start(at);osc.stop(at+duration+.03);
    let overtone;
    if(voice==='bell'){overtone=ctx.createOscillator();overtone.frequency.value=f*2.001;const upperGain=ctx.createGain();upperGain.gain.value=.15;overtone.connect(upperGain);upperGain.connect(env);overtone.start(at);overtone.stop(at+duration*.55);overtone.onended=()=>{overtone.disconnect();upperGain.disconnect();};}
    osc.onended=()=>{osc.disconnect();filter.disconnect();env.disconnect();};
  }
  schedule(){
    if(!this.enabled||this.paused||this.context.state!=='running')return;
    if(this.nextTime<this.context.currentTime-.2)this.nextTime=this.context.currentTime+.05;
    while(this.nextTime<this.context.currentTime+.18){for(const n of notesAtStep(this.step))this.note({...n,gain:n.gain*(n.voice==='bell'&&this.stage===1?.75:1)},this.nextTime);this.step=(this.step+1)%LOOP_STEPS;this.nextTime+=EIGHTH_SECONDS;}
  }
}
