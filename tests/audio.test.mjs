import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../shared/audio.js';
const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(value){this.value=value;}});
class Context {
  state='running';currentTime=0;sampleRate=8000;destination={};buffers=0;
  createGain(){return{gain:param(),connect(){},disconnect(){}};}
  createDynamicsCompressor(){return{threshold:param(),ratio:param(),connect(){}};}
  createBuffer(){this.buffers++;return{getChannelData:()=>new Float32Array(8000)};}
  createBiquadFilter(){return{frequency:param(),connect(){},disconnect(){}};}
  createOscillator(){return{frequency:param(),connect(){},disconnect(){},start(){},stop(){this.onended?.();}};}
  createBufferSource(){return{connect(){},disconnect(){},start(){},stop(){this.onended?.();}};}
  async resume(){this.state='running';} async suspend(){this.state='suspended';}
}
test('BGM and effects retain separate volume controls and noise reuses its buffer',async()=>{
  globalThis.window={AudioContext:Context};const audio=new AudioEngine();assert.ok(await audio.unlock());
  audio.setVolumes(.2,.9);assert.equal(audio.music.gain.value,.2);assert.equal(audio.sfx.gain.value,.9);
  audio.noise(.1);audio.noise(.2);assert.equal(audio.ctx.buffers,1);audio.setEnabled(false);assert.equal(audio.master.gain.value,0);audio.stop();
});
test('two games have distinct melodies and boss music changes the score',()=>{
  const notes=(variant,boss)=>{const a=new AudioEngine({variant}),list=[];a.boss=boss;a.tone=(...args)=>list.push(args);a.noise=()=>{};for(let i=0;i<64;i++)a.musicStep(i,i*.1,.1);return list;};
  assert.notDeepEqual(notes('vertical',false),notes('horizontal',false));assert.notDeepEqual(notes('horizontal',false),notes('horizontal',true));
});
test('pause silences voices, resume keeps the phrase, and a stale resume cannot restart a stopped game',async()=>{
  globalThis.window={AudioContext:Context};const a=new AudioEngine();await a.unlock();a.start(1);a.step=31;a.boss=true;a.pause();
  assert.equal(a.playing,false);assert.equal(a.ctx.state,'suspended');assert.equal(a.voices.size,0);
  await a.resume();assert.equal(a.step,31);assert.equal(a.boss,true);assert.equal(a.stage,1);a.pause();
  let finish;a.unlock=()=>new Promise(resolve=>{finish=resolve;});const pending=a.resume();a.stop();finish(true);await pending;assert.equal(a.playing,false);assert.equal(a.timer,null);
});
