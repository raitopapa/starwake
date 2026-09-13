import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, WIDTH, HEIGHT, STAGES, segmentHitsCircle } from '../src/engine.js';
import { readSave, writeSave, recordRun } from '../src/storage.js';

function tick(game,seconds,input={}){for(let i=0;i<Math.ceil(seconds*120);i++){game.update(1/120,input);game.drainEvents();}}
function quiet(){const g=new Game();g.nextWave=999;return g;}
test('same seed and input produce identical simulation',()=>{
  const a=new Game({seed:123}),b=new Game({seed:123});tick(a,12,{x:.2});tick(b,12,{x:.2});assert.equal(JSON.stringify(a),JSON.stringify(b));
});
test('pause freezes all simulation and resume continues',()=>{
  const g=quiet();tick(g,1);g.pause();const before=JSON.stringify(g);tick(g,3,{x:1});assert.equal(JSON.stringify(g),before);g.resume();tick(g,1);assert.ok(g.time>1.9);
});
test('paused and finished games cannot spend resources',()=>{
  for(const state of ['paused','gameover','victory']){const g=quiet();g.energy=100;g.state=state;assert.equal(g.useBomb(),false);assert.equal(g.activateDrive(),false);assert.equal(g.switchWeapon(),false);assert.equal(g.bombs,3);assert.equal(g.energy,100);}
});
test('diagonal movement is normalized and touch targets stay in bounds',()=>{
  const g=quiet(),x=g.player.x,y=g.player.y;g.update(.05,{x:1,y:-1});assert.ok(Math.abs(Math.hypot(g.player.x-x,g.player.y-y)-15)<.001);
  tick(g,1,{target:{x:-5000,y:5000}});assert.equal(g.player.x,20);assert.equal(g.player.y,HEIGHT-103);
});
test('swept collisions catch fast bullets and distinguish near misses',()=>{
  assert.equal(segmentHitsCircle(0,0,100,0,50,0,4),true);assert.equal(segmentHitsCircle(0,0,100,0,50,5,4),false);
  const g=quiet();g.player.invincible=0;g.fireBullet(g.player.x,g.player.y-100,Math.PI/2,3000);g.update(.05);assert.equal(g.player.health,4);
});
test('hull wings are safe, graze awards energy once, and invulnerability prevents repeat damage',()=>{
  const g=quiet();g.player.invincible=0;g.fireBullet(g.player.x+18,g.player.y,0,0);g.update(.01);assert.equal(g.player.health,5);assert.equal(g.energy,2);g.update(.01);assert.equal(g.energy,2);
  assert.equal(g.hitPlayer(),true);assert.equal(g.hitPlayer(),false);assert.equal(g.player.health,4);
});
test('touch movement across an enemy bullet cannot tunnel',()=>{
  const g=quiet();g.player.invincible=0;g.fireBullet(g.player.x+25,g.player.y,0,0);g.update(.05,{target:{x:g.player.x+60,y:g.player.y}});assert.equal(g.player.health,4);
});
test('all weapons cause real enemy damage',()=>{
  for(let weapon=0;weapon<3;weapon++){const g=quiet();g.player.weapon=weapon;g.player.level=3;const e=g.spawnEnemy('carrier',g.player.x,350);e.speed=0;tick(g,4);assert.ok(e.hp<=0,`weapon ${weapon} failed`);assert.ok(g.kills>0);}
});
test('bomb consumes one charge, clears bullets and lasers, and cannot be spammed',()=>{
  const g=quiet();g.spawnEnemy('carrier',240,200);g.fireBullet(100,200,1,200);g.lasers.push({x:50,age:0});assert.equal(g.useBomb(),true);assert.equal(g.bombs,2);assert.equal(g.useBomb(),false);assert.equal(g.bullets.length,0);assert.equal(g.lasers.length,0);assert.equal(g.kills,1);g.fireBullet(200,200,1,200);assert.equal(g.bullets.length,0);
});
test('overdrive needs full energy, clears bullets, and expires after six seconds',()=>{
  const g=quiet();assert.equal(g.activateDrive(),false);g.energy=100;g.fireBullet(20,20,1,100);assert.equal(g.activateDrive(),true);assert.equal(g.energy,0);assert.equal(g.bullets.length,0);assert.equal(g.activateDrive(),false);tick(g,6.1);assert.equal(g.driveTimer,0);
});
test('combo score multiplier increases and resets on timeout or damage',()=>{
  const g=quiet();for(let i=0;i<12;i++)g.damageEnemy(g.spawnEnemy('scout',70,70),100);assert.equal(g.multiplier,3);assert.equal(g.maxCombo,12);tick(g,4.1);assert.equal(g.multiplier,1);g.player.invincible=0;g.combo=9;g.multiplier=2;g.hitPlayer();assert.equal(g.combo,0);assert.equal(g.multiplier,1);
});
test('pickup effects respect health, bomb and weapon caps',()=>{
  const g=quiet();for(let i=0;i<10;i++){g.collect({type:'power'});g.collect({type:'health'});g.collect({type:'bomb'});}assert.equal(g.player.level,4);assert.equal(g.player.health,5);assert.equal(g.bombs,5);
});
test('laser telegraph locks position and does not damage before activation',()=>{
  const g=quiet();g.player.invincible=0;const x=g.player.x;g.lasers.push({x,y:100,width:30,age:0,warning:1.4,duration:1});tick(g,1.2);assert.equal(g.player.health,5);tick(g,.3);assert.equal(g.player.health,4);
  g.player.x=100;assert.equal(g.lasers[0].x,x);
});
test('boss defeat removes hazards and advances exactly one stage with supplies',()=>{
  const g=quiet();g.spawnBoss();g.boss.age=5;g.player.health=3;g.bombs=1;g.damageBoss(9999);assert.equal(g.boss,null);assert.ok(g.transitionTimer>0);assert.equal(g.useBomb(),false);tick(g,3.6);assert.equal(g.stage,1);assert.equal(g.player.health,4);assert.equal(g.bombs,2);assert.equal(g.bossSpawned,false);
});
test('complete campaign is reachable with actual shots, including all three bosses',()=>{
  const g=new Game({difficulty:'pilot',seed:31});g.player.invincible=9999;g.player.weapon=1;g.player.level=4;
  const entered=new Set([0]);let i=0;
  for(;i<120*600&&g.state==='playing';i++){
    g.update(1/120,{target:{x:g.boss?.x??240,y:570}});g.drainEvents();entered.add(g.stage);g.player.invincible=9999;
  }
  assert.equal(g.state,'victory');assert.deepEqual([...entered],[0,1,2]);assert.ok(g.score>40000);assert.ok(i/120<480);
});
test('all boss phases remain finite and within particle/bullet budgets',()=>{
  for(const difficulty of ['cadet','pilot','ace'])for(let stage=0;stage<3;stage++){
    const g=new Game({difficulty,startStage:stage});g.player.invincible=9999;g.spawnBoss();g.boss.age=4;g.boss.hp=g.boss.maxHp*.3;g.player.x=20;tick(g,24);
    assert.ok(g.bullets.length<=650);assert.ok(g.particles.length<=340);assert.ok(g.shots.length<=180);
    assert.ok(g.bullets.every(b=>[b.x,b.y,b.vx,b.vy].every(Number.isFinite)));
  }
});
test('death is terminal and results do not keep accumulating score',()=>{
  const g=quiet();g.player.health=1;g.player.invincible=0;g.hitPlayer();assert.equal(g.state,'gameover');const t=g.time,s=g.score;tick(g,5);assert.equal(g.time,t);assert.equal(g.score,s);
});
test('invalid saved data and blocked storage do not prevent play',()=>{
  assert.deepEqual(readSave(null).records,{});assert.equal(writeSave(null,{}),false);assert.equal(readSave({getItem:()=>'{broken'}).difficulty,'pilot');
  const data=readSave({getItem:()=>JSON.stringify({difficulty:'__proto__',stage:99,records:{'ace:2':400,'pilot:0':-1,bogus:999}})});assert.equal(data.stage,0);assert.deepEqual(data.records,{'ace:2':400});
});
test('records separate difficulty and start sector and cannot decrease',()=>{
  const save=readSave(null);assert.equal(recordRun(save,{difficulty:'pilot',startStage:0,score:500}),true);assert.equal(recordRun(save,{difficulty:'pilot',startStage:0,score:200}),false);recordRun(save,{difficulty:'ace',startStage:2,score:800});assert.deepEqual(save.records,{'pilot:0':500,'ace:2':800});
});
