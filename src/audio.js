/** Original procedural soundtrack and effects. No samples or network requests. */
export class AudioEngine {
  constructor() { this.ctx=null;this.enabled=true;this.playing=false;this.timer=null;this.step=0;this.stage=0;this.nextBeat=0;this.lastShot=-1;this.generation=0; }
  async unlock() {
    try {
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!Context)return false;
      if(!this.ctx){this.ctx=new Context();this.master=this.ctx.createGain();this.master.gain.value=this.enabled?.36:0;this.master.connect(this.ctx.destination);}
      if(this.ctx.state!=='running')await this.ctx.resume();
      return this.ctx.state==='running';
    } catch { return false; }
  }
  setEnabled(enabled){this.enabled=enabled;if(this.master)this.master.gain.setTargetAtTime(enabled?.36:0,this.ctx.currentTime,.035);}
  tone(freq,duration,type='sine',volume=.1,when=null,endFreq=null) {
    if(!this.ctx||!this.enabled||this.ctx.state!=='running')return;
    const t=when??this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);if(endFreq)o.frequency.exponentialRampToValueAtTime(Math.max(10,endFreq),t+duration);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.01);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  noise(duration,volume=.16,frequency=1300) {
    if(!this.ctx||!this.enabled||this.ctx.state!=='running')return;
    const length=Math.ceil(this.ctx.sampleRate*duration),buffer=this.ctx.createBuffer(1,length,this.ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
    const source=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();
    source.buffer=buffer;filter.type='lowpass';filter.frequency.value=frequency;gain.gain.value=volume;
    source.connect(filter);filter.connect(gain);gain.connect(this.master);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  start(stage=0) { this.generation++;this.stage=stage;this.step=0;this.playing=true;this.nextBeat=(this.ctx?.currentTime||0)+.05;this.stopTimer();this.timer=setInterval(()=>this.schedule(),25); }
  stopTimer(){if(this.timer){clearInterval(this.timer);this.timer=null;}}
  pause(){this.generation++;this.playing=false;this.stopTimer();if(this.ctx?.state==='running')this.ctx.suspend().catch(()=>{});}
  async resume(){const generation=++this.generation;await this.unlock();if(generation===this.generation)this.start(this.stage);}
  stop(){this.generation++;this.playing=false;this.stopTimer();}
  schedule() {
    if(!this.ctx||!this.playing||this.ctx.state!=='running')return;
    const bpm=[112,124,132][this.stage],interval=60/bpm/4;
    if(this.nextBeat<this.ctx.currentTime-.25)this.nextBeat=this.ctx.currentTime+.02;
    let guard=0;
    while(this.nextBeat<this.ctx.currentTime+.12&&guard++<5){this.musicStep(this.step++,this.nextBeat);this.nextBeat+=interval;}
  }
  musicStep(step,t) {
    const roots=[[38,34,41,36],[36,32,39,34],[33,29,36,31]][this.stage],root=roots[Math.floor(step/32)%4];
    const hz=n=>440*2**((n-69)/12);
    const arps=[[0,7,12,7,3,10,14,10],[0,12,7,15,0,10,7,14],[0,7,3,12,10,7,14,12]][this.stage];
    if(step%2===0)this.tone(hz(root+12+arps[(step/2)%8]),.16,'triangle',.045,t);
    if(step%4===0)this.tone(hz(root),.3,'triangle',.15,t);
    if(step%8===0)this.tone(120,.14,'sine',.33,t,36);
    if(step%8===4){this.tone(180,.08,'triangle',.065,t,70);this.tone(1600,.025,'square',.012,t,800);}
    if(step%2===1)this.tone(7300,.012,'square',.009,t,4500);
    if(step%32===0)for(const n of [0,7,12])this.tone(hz(root+12+n),1.5,'sine',.022,t);
  }
  effect(event) {
    if(!this.enabled||!this.ctx)return;
    const t=this.ctx.currentTime;
    switch(event.type){
      case 'shot':if(t-this.lastShot>.08){this.tone(event.weapon===1?920:1300,.045,'triangle',.033,null,event.weapon===2?300:450);this.lastShot=t;}break;
      case 'explosion':this.noise(event.large?.28:.12,event.large?.22:.09,1100);this.tone(event.large?90:150,.12,'sine',.09,null,38);break;
      case 'hit':this.noise(.26,.2,2300);this.tone(180,.3,'sawtooth',.09,null,42);break;
      case 'bomb':this.noise(.9,.38,850);this.tone(200,.9,'sine',.28,null,25);break;
      case 'drive':for(let i=0;i<6;i++)this.tone(220*2**(i/3),.3,'triangle',.1,t+i*.06);break;
      case 'pickup':if(event.kind!=='score'){this.tone(880,.12,'sine',.1);this.tone(1320,.16,'sine',.09,t+.08);}break;
      case 'switch':this.tone(600,.07,'sine',.07,null,1100);break;
      case 'warning':case 'laserWarning':this.tone(330,.18,'square',.07);this.tone(440,.18,'square',.07,t+.23);break;
      case 'laser':this.noise(.32,.12,4500);this.tone(220,.35,'sawtooth',.065,null,110);break;
      case 'clear':case 'victory':for(let i=0;i<5;i++)this.tone([440,554,659,880,1108][i],.5,'triangle',.12,t+i*.14);break;
      case 'gameover':for(let i=0;i<4;i++)this.tone(330*2**(-i/4),.4,'triangle',.09,t+i*.17);break;
    }
  }
}
