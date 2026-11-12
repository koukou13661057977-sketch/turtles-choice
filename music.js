// An original 108 BPM tune for mallets, plucked strings and soft wood taps.
export const EIGHTH_SECONDS=60/108/2;
const BARS=[
  {chord:[50,54,57],lead:[74,78,81,null,78,76,74,null]},
  {chord:[55,59,62],lead:[79,null,83,81,79,74,null,76]},
  {chord:[47,50,54],lead:[78,81,83,null,81,78,76,null]},
  {chord:[57,61,64],lead:[76,null,81,79,76,73,null,null]},
  {chord:[50,54,57],lead:[74,78,81,null,78,76,74,null]},
  {chord:[55,59,62],lead:[79,83,86,null,83,81,79,null]},
  {chord:[52,55,59],lead:[76,79,83,null,81,79,76,null]},
  {chord:[57,61,64],lead:[73,null,76,81,76,73,null,null]}
];
export const LOOP_STEPS=BARS.length*8;
const VOICES={
  bass:{type:'sine',attack:.018},
  pad:{type:'sine',attack:.065},
  pluck:{type:'triangle',attack:.012},
  bell:{type:'triangle',attack:.009},
  tap:{type:'sine',attack:.004}
};
const STAGE_COLOUR=[3200,2400,3800];
const note=(midi,voice,length,gain)=>({midi,voice,duration:length*EIGHTH_SECONDS,gain});

export function notesAtStep(step){
  const index=((step%LOOP_STEPS)+LOOP_STEPS)%LOOP_STEPS;
  const {chord,lead}=BARS[Math.floor(index/8)],beat=index%8,notes=[];
  if(beat===0){
    notes.push(note(chord[0]-12,'bass',1.65,.083));
    for(const pitch of chord)notes.push(note(pitch+12,'pad',3.25,.018));
  }
  if(beat===4)notes.push(note(chord[2]-12,'bass',1.45,.067));
  if(beat===2||beat===6)notes.push(note(chord[beat===2?1:2]+12,'pluck',.85,.048));
  if(beat===3||beat===7)notes.push(note(beat===3?68:65,'tap',.21,.026));
  const melody=lead[beat];
  if(melody!==null){
    const length=lead[beat+1]==null?1.55:.95;
    notes.push(note(melody,'bell',length,beat===0?.104:.086));
  }
  return notes;
}

export class OceanMusic {
  constructor(context,destination){
    this.context=context;
    this.output=context.createGain();this.output.gain.value=0;
    this.duckGain=context.createGain();this.output.connect(this.duckGain);this.duckGain.connect(destination);
    this.bus=context.createGain();
    this.colour=context.createBiquadFilter();this.colour.type='lowpass';this.colour.frequency.value=STAGE_COLOUR[0];this.colour.Q.value=-3;
    this.bus.connect(this.colour);this.colour.connect(this.output);

    const delay=context.createDelay(1);delay.delayTime.value=EIGHTH_SECONDS*.5;
    const feedback=context.createGain();feedback.gain.value=.18;
    const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2100;filter.Q.value=-3;
    const wet=context.createGain();wet.gain.value=.16;
    this.colour.connect(delay);delay.connect(filter);filter.connect(feedback);feedback.connect(delay);filter.connect(wet);wet.connect(this.output);

    this.stage=0;this.duckUntil=0;
    this.enabled=true;this.paused=false;this.volume=.65;this.step=0;this.nextTime=context.currentTime+.12;
    this.timer=setInterval(()=>this.schedule(),50);
  }
  setState({enabled,paused,volume}){
    const previouslyAudible=this.enabled&&!this.paused;
    this.enabled=enabled;this.paused=paused;this.volume=volume;
    const audible=enabled&&!paused;
    this.output.gain.setTargetAtTime(audible?volume:0,this.context.currentTime,.22);
    if(audible&&!previouslyAudible)this.nextTime=this.context.currentTime+.12;
    if(audible)this.schedule();
  }
  setMood(stage=0,hurt=false){
    this.stage=Number.isInteger(stage)&&stage>=0&&stage<STAGE_COLOUR.length?stage:0;
    this.colour.frequency.setTargetAtTime(hurt?620:STAGE_COLOUR[this.stage],this.context.currentTime,.35);
  }
  duck(seconds){
    if(!this.enabled||this.paused||this.volume<=0||!Number.isFinite(seconds)||seconds<=0)return;
    const now=this.context.currentTime,gain=this.duckGain.gain;
    this.duckUntil=Math.max(this.duckUntil,now+seconds);
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(.42,now,.018);
    gain.setTargetAtTime(1,this.duckUntil,.11);
  }
  note({midi,duration,voice,gain},at){
    const ctx=this.context,style=VOICES[voice],frequency=440*2**((midi-69)/12);
    const env=ctx.createGain();env.connect(this.bus);
    env.gain.setValueAtTime(.0001,at);
    env.gain.exponentialRampToValueAtTime(gain,at+style.attack);
    if(voice!=='tap')env.gain.exponentialRampToValueAtTime(gain*(voice==='pad'?.45:.16),at+duration*.63);
    env.gain.exponentialRampToValueAtTime(.0001,at+duration);

    const osc=ctx.createOscillator();
    osc.type=style.type;osc.frequency.setValueAtTime(frequency,at);
    if(voice==='tap')osc.frequency.exponentialRampToValueAtTime(frequency*.55,at+duration);
    osc.connect(env);osc.start(at);osc.stop(at+duration+.03);
    osc.onended=()=>{osc.disconnect();env.disconnect();};

    if(voice==='bell'){
      const overtone=ctx.createOscillator(),strike=ctx.createGain();
      overtone.frequency.value=frequency*3;
      strike.gain.setValueAtTime(.14,at);strike.gain.exponentialRampToValueAtTime(.0001,at+.065);
      overtone.connect(strike);strike.connect(env);overtone.start(at);overtone.stop(at+.075);
      overtone.onended=()=>{overtone.disconnect();strike.disconnect();};
    }
  }
  schedule(){
    if(!this.enabled||this.paused||this.context.state!=='running')return;
    if(this.nextTime<this.context.currentTime-.2)this.nextTime=this.context.currentTime+.05;
    while(this.nextTime<this.context.currentTime+.18){
      for(const n of notesAtStep(this.step)){
        const accent=this.stage===1&&n.voice==='bell'?.84:this.stage===2&&n.voice==='tap'?1.2:1;
        this.note({...n,gain:n.gain*accent},this.nextTime);
      }
      this.step=(this.step+1)%LOOP_STEPS;this.nextTime+=EIGHTH_SECONDS;
    }
  }
}
