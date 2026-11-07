// A conservative, session-only hint. Long gaps are scheduling/visibility events,
// not evidence that the GPU cannot render the scene. Manual quality stays sovereign.
export function createPerformanceMonitor(){
  let seconds=0,frames=0,slow=0,work=0,suggested=false;
  const clear=()=>{seconds=frames=slow=work=0;};
  return {
    reset(){clear();suggested=false;},
    sample({dt,workMs=0,active=true,visible=true,highQuality=true}={}){
      if(suggested)return false;
      if(!active||!visible||!highQuality||!Number.isFinite(dt)||dt<=0||dt>=.25){clear();return false;}
      seconds+=dt;frames++;slow+=dt>1/28?1:0;work+=Math.max(0,Number.isFinite(workMs)?workMs:0);
      if(seconds<8)return false;
      // Require sustained <28 FPS plus meaningful callback cost. A browser's
      // inexpensive, regularly throttled callbacks should never change quality.
      const struggling=frames>=40&&slow/frames>=.7&&work/frames>=8;
      clear();if(struggling)suggested=true;return struggling;
    }
  };
}
