import { Game, STAGES, WEAPONS, POWERUPS } from './engine.js';
import { Renderer, HeroRenderer } from './render.js';
import { AudioEngine } from '../../shared/audio.js';
import { Input } from './input.js';
import { readSave, writeSave, recordRun } from './storage.js';

const $ = id => document.getElementById(id);
const number = n => Math.floor(n).toString().padStart(6, '0');
const timeLabel = n => `${Math.floor(n / 60).toString().padStart(2,'0')}:${Math.floor(n % 60).toString().padStart(2,'0')}`;
const setText = (id, value) => { const element = $(id); if (element.textContent !== String(value)) element.textContent = value; };
let storage;
try { storage = window.localStorage; } catch { storage = null; }
const save = readSave(storage);
const audio = new AudioEngine();
audio.setEnabled(save.sound);
audio.setVolumes(save.music, save.sfx);
const hero = new HeroRenderer($('hero-canvas'));
const renderer = new Renderer($('game-canvas'));
renderer.effects = save.effects;
let game = null, active = false, resultShown = false;
let lastFrame = performance.now(), accumulator = 0, lastHud = 0, lastHero = 0, healthMarkup = '';
const input = new Input($('game-canvas'), {
  active: () => active && game?.state === 'playing',
  action: action => { if(action === 'pause') pauseGame(); else if(action === 'bomb') game?.useBomb(); else if(action === 'weapon') game?.switchWeapon(); else if(action === 'drive') game?.activateDrive(); else if(action === 'equip') game?.equip(); },
  position: () => ({ x: game.player.x, y: game.player.y }),
});

input.attachSurface($('touch-pad'));

function persist() { if (!writeSave(storage, save)) $('offline-status').textContent = '記録を保存できません（端末の保存設定を確認）'; }
function updateBest() {
  const best = save.records[`${save.difficulty}:${save.stage}:${save.loadout}`] || 0;
  setText('best-score', number(best)); setText('flight-best', number(best));
}
function updateSound() {
  const button = $('sound-toggle');
  button.setAttribute('aria-pressed', String(audio.enabled));
  button.setAttribute('aria-label', audio.enabled ? 'サウンドをオフ' : 'サウンドをオン');
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z${audio.enabled ? 'm5 3c3 2 3 6 0 8m3-11c5 4 5 10 0 14' : 'm5 4 5 6m0-6-5 6'}"/></svg><span>SOUND ${audio.enabled ? 'ON' : 'OFF'}</span>`;
  setText('pause-sound', `サウンド：${audio.enabled ? 'オン' : 'オフ'}`);
  $('pause-sound').setAttribute('aria-pressed', String(audio.enabled));
}
async function toggleSound() {
  audio.setEnabled(!audio.enabled);save.sound=audio.enabled;persist();updateSound();
  if (audio.enabled && game?.state !== 'paused') { await audio.unlock(); audio.effect({type:'switch'}); }
}
function selectStage(stage) {
  save.stage=stage;hero.stage=stage;
  for (const card of document.querySelectorAll('[data-stage]')) {
    const selected = Number(card.dataset.stage) === stage;
    card.classList.toggle('selected',selected);card.setAttribute('aria-pressed',String(selected));
  }
  updateBest();
}
function launch() {
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  input.reset();
  audio.stop();
  game=new Game({difficulty:save.difficulty,startStage:save.stage,loadout:save.loadout,seed:Math.floor(Math.random()*0xffffffff)});
  active=true;resultShown=false;accumulator=0;lastFrame=performance.now();
  $('hangar').hidden=true;$('flight').hidden=false;document.body.classList.add('in-flight');
  renderer.resize();updateBest();updateHud();$('game-canvas').focus({preventScroll:true});persist();
  const flight=game;
  audio.unlock().then(()=>{if(game===flight&&game.state==='playing')audio.start(game.stage);});
}
function pauseGame() {
  if(!active||game?.state!=='playing')return;
  game.pause();input.reset();audio.pause();accumulator=0;
  if(!$('pause-dialog').open&&!$('help-dialog').open)$('pause-dialog').showModal();
}
function resumeGame() {
  $('pause-dialog').close();
  if(!active||game?.state!=='paused')return;
  input.reset();game.resume();lastFrame=performance.now();accumulator=0;
  audio.resume();$('game-canvas').focus({preventScroll:true});
}
function goHome() {
  if(game)recordRun(save,game);
  persist();active=false;game=null;input.reset();audio.stop();accumulator=0;
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  document.body.classList.remove('in-flight');$('flight').hidden=true;$('hangar').hidden=false;
  updateBest();hero.resize();hero.draw();$('launch').focus({preventScroll:true});
}
function showResult() {
  if(resultShown)return;resultShown=true;input.reset();audio.stop();audio.effect({type:game.state==='victory'?'victory':'gameover'});
  const record=recordRun(save,game);persist();updateBest();
  const won=game.state==='victory';
  setText('result-eyebrow',won?'SIGNAL DELIVERED / FLIGHT REPORT':'SIGNAL LOST / FLIGHT REPORT');
  setText('result-title',won?'星の海に、夜明けを。':'次の一機に、希望を。');
  setText('result-caption',won?'最終宙域を突破。あなたのシグナルが届きました。':`${STAGES[game.stage].name}で通信途絶。武器とボムを使い分けて、再び挑もう。`);
  setText('result-score',number(game.score));setText('result-kills',game.kills);setText('result-combo',game.maxCombo);setText('result-time',timeLabel(game.time));
  $('new-record').hidden=!record;$('result-dialog').showModal();
}
function updateHud() {
  if(!game)return;
  setText('hud-score',number(game.score));setText('hud-multiplier',`×${game.multiplier}`);
  setText('hud-sector',`SECTOR 0${game.stage+1}`);setText('hud-power',`OPTION ${game.options.length}/4`);
  setText('side-sector',STAGES[game.stage].name);setText('side-description',STAGES[game.stage].en);
  setText('flight-time',timeLabel(game.time));setText('flight-kills',game.kills);
  const health=`${game.player.health}:${game.player.maxHealth}`;
  if(health!==healthMarkup){$('hud-health').innerHTML=Array.from({length:game.player.maxHealth},(_,i)=>`<i${i>=game.player.health?' class="empty"':''}></i>`).join('');$('hud-health').setAttribute('aria-label',`耐久力 ${game.player.health} / ${game.player.maxHealth}`);healthMarkup=health;}
  const weapon=WEAPONS[game.player.weapon], label=$('weapon-name');
  if(label.dataset.weapon!==weapon.name){label.innerHTML=`${weapon.name}<small>X / 武器切替</small>`;label.dataset.weapon=weapon.name;label.style.color=weapon.color;}
  setText('bomb-count',`ボム × ${game.bombs}`);$('bomb').disabled=game.bombs<=0||game.bombTimer>0||game.transitionTimer>0;
  const energy=game.driveTimer>0?game.driveTimer/6*100:game.energy;
  $('drive-fill').style.width=`${energy}%`;
  setText('drive-label',game.driveTimer>0?`発動中 ${game.driveTimer.toFixed(1)}s`:game.energy>=100?'発動可能 ↗':`${Math.floor(game.energy)}%`);
  $('overdrive').disabled=game.energy<100||game.driveTimer>0||game.transitionTimer>0;$('overdrive').classList.toggle('ready',game.energy>=100&&game.driveTimer<=0);
  $('boss-hud').hidden=!game.boss;
  if(game.boss){setText('boss-name',STAGES[game.stage].boss);setText('boss-phase',`PHASE ${game.boss.phase}`);$('boss-health').style.width=`${Math.max(0,game.boss.hp/game.boss.maxHp*100)}%`;}
  const banner=$('mission-banner');banner.hidden=game.banner.time<=0;
  if(game.banner.time>0){const content=`<span>${game.banner.sub}</span>${game.banner.title}`;if(banner.innerHTML!==content)banner.innerHTML=content;banner.classList.toggle('warning',game.banner.warning);}
  $('touch-tip').hidden=game.time>9;
  setText('shield-status',`SHIELD ${game.player.shield}`); setText('gear-status',`SPD ${game.player.speed} · MSL ${game.player.missiles}`);
  setText('beam-name',game.loadout.name);
  for(const slot of document.querySelectorAll('[data-slot]')){
    const index=Number(slot.dataset.slot);slot.classList.toggle('selected',index===game.meter);slot.classList.toggle('maxed',!game.upgradeAvailable(index));
    slot.setAttribute('aria-current',String(index===game.meter));
  }
  $('equip').disabled=!game.upgradeAvailable();
  const selected=game.meter===3?game.loadout.name:POWERUPS[game.meter];
  setText('meter-hint',game.meter<0?'橙色のPで枠が進む。欲しい装備で Z / 装備決定。':game.upgradeAvailable()?`${selected} を装備できます。次のPで枠が進みます。`:`${selected} は最大です。次のPを集めて別の枠へ。`);
  $('focus').setAttribute('aria-pressed',String(input.read().focus));
  $('weapon').disabled=game.player.unlocked.length<2;

}

$('launch').addEventListener('click',launch);
$('equip').addEventListener('click',()=>game?.equip());
$('focus').addEventListener('click',()=>{if(game?.state==='playing')input.focusHeld=!input.focusHeld;});
$('fullscreen').addEventListener('click',async()=>{
  try { if(document.fullscreenElement)await document.exitFullscreen();else if($('flight').requestFullscreen)await $('flight').requestFullscreen();else setText('meter-hint','このブラウザでは全画面操作に対応していません。'); }
  catch { setText('meter-hint','全画面に切り替えられませんでした。'); }
});
for(const name of ['music','sfx']){
  const slider=$(name+'-volume');slider.value=Math.round(save[name]*100);
  slider.addEventListener('input',()=>{save[name]=Number(slider.value)/100;audio.setVolumes(save.music,save.sfx);persist();});
}
$('effects-toggle').checked=save.effects;
$('effects-toggle').addEventListener('change',()=>{save.effects=$('effects-toggle').checked;renderer.effects=save.effects;persist();});
for(const radio of document.querySelectorAll('[name="loadout"]')){
  radio.checked=radio.value===save.loadout;radio.addEventListener('change',()=>{save.loadout=radio.value;persist();updateBest();});
}

$('sound-toggle').addEventListener('click',toggleSound);$('pause-sound').addEventListener('click',toggleSound);
$('pause').addEventListener('click',pauseGame);$('resume').addEventListener('click',resumeGame);
$('retry').addEventListener('click',launch);$('return-hangar').addEventListener('click',goHome);
$('result-retry').addEventListener('click',launch);$('result-home').addEventListener('click',goHome);
$('weapon').addEventListener('click',()=>game?.switchWeapon());$('bomb').addEventListener('click',()=>game?.useBomb());$('overdrive').addEventListener('click',()=>game?.activateDrive());
for(const card of document.querySelectorAll('[data-stage]'))card.addEventListener('click',()=>{selectStage(Number(card.dataset.stage));persist();hero.draw(performance.now()/1000);});
for(const radio of document.querySelectorAll('[name="difficulty"]')){radio.checked=radio.value===save.difficulty;radio.addEventListener('change',()=>{save.difficulty=radio.value;persist();updateBest();});}
$('help-open').addEventListener('click',()=>{if(active)pauseGame();$('pause-dialog').close();$('help-dialog').showModal();});
function closeHelp(){ $('help-dialog').close();if(active&&game?.state==='paused')$('pause-dialog').showModal(); }
$('help-close').addEventListener('click',closeHelp);
$('help-dialog').addEventListener('cancel',event=>{event.preventDefault();closeHelp();});
$('pause-dialog').addEventListener('cancel',event=>{event.preventDefault();resumeGame();});
$('result-dialog').addEventListener('cancel',event=>{event.preventDefault();goHome();});
window.addEventListener('blur',pauseGame);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();lastFrame=performance.now();accumulator=0;});
const resize=new ResizeObserver(()=>{if(active)renderer.resize();else hero.resize();});
resize.observe($('game-shell'));resize.observe($('hero-canvas'));
const STEP=1/120;
function frame(now) {
  const dt=Math.min(.1,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
  if(!document.hidden){
    if(active&&game){
      if(game.state==='playing'){
        accumulator+=dt;
        while(accumulator>=STEP&&game.state==='playing'){
          game.update(STEP,input.read());accumulator-=STEP;
          for(const event of game.drainEvents()){audio.effect(event);if(event.type==='stage')audio.start(event.stage);}
        }
      }else accumulator=0;
      renderer.draw(game);
      if(now-lastHud>65){updateHud();lastHud=now;}
      if(game.state==='victory'||game.state==='gameover')showResult();
    }else if(now-lastHero>33){hero.draw(now/1000);lastHero=now;}
  }
  requestAnimationFrame(frame);
}
selectStage(save.stage);updateSound();requestAnimationFrame(frame);
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
  navigator.serviceWorker.register('../sw.js',{scope:'../'}).then(async()=>{await navigator.serviceWorker.ready;setText('offline-status','OFFLINE READY');}).catch(()=>setText('offline-status','ONLINE PLAY / オフライン保存は未完了'));
}
if(location.protocol==='file:')setText('offline-status','STANDALONE / OFFLINE');
