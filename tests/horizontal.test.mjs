import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, WIDTH, HEIGHT, WEAPONS } from '../horizontal/src/engine.js';
import { segmentHitsRect } from '../shared/collision.js';
import { readSave, writeSave, recordRun } from '../horizontal/src/storage.js';
import { readSave as readVertical } from '../vertical/src/storage.js';
function tick(game,seconds,input={}) { for(let i=0;i<Math.ceil(seconds*120);i++){game.update(1/120,input);game.drainEvents();} }
function quiet(options={}) { const g=new Game(options);g.nextWave=999;return g; }
test('HORIZON is an independent horizontal game with its own save namespace',()=>{
  assert.ok(WIDTH>HEIGHT);const seen=[];const storage={getItem:k=>{seen.push(k);return null;},setItem(){}};
  readSave(storage);readVertical(storage);assert.ok(seen.includes('starwake.horizon.v2'));assert.ok(seen.includes('starwake.zenith.v2'));
  assert.ok(writeSave(storage,readSave(null)));assert.equal(writeSave(null,{}),false);
});
test('capsules advance a six-slot meter; equipping consumes selection and respects caps',()=>{
  const g=quiet();assert.equal(g.equip(),false);
  g.collect({type:'capsule',x:0,y:0});assert.equal(g.meter,0);assert.ok(g.equip());assert.equal(g.player.speed,1);assert.equal(g.meter,-1);
  for(let i=0;i<5;i++)g.collect({type:'capsule',x:0,y:0});assert.equal(g.meter,4);assert.ok(g.equip());assert.equal(g.options.length,1);
  for(let i=0;i<7;i++)g.collect({type:'capsule',x:0,y:0});assert.equal(g.meter,0);
  g.player.speed=3;assert.equal(g.equip(),false);assert.equal(g.meter,0);
});
test('beam choice unlocks only that system; weapon switch cycles acquired equipment',()=>{
  for(const loadout of ['lance','wave','seeker']){
    const g=quiet({loadout});assert.deepEqual(g.player.unlocked,[0]);g.meter=3;g.equip();assert.equal(g.player.weapon,g.loadout.weapon);
    g.meter=2;g.equip();assert.equal(g.player.weapon,1);g.switchWeapon();assert.equal(g.player.weapon,0);
    assert.deepEqual(g.player.unlocked,[0,g.loadout.weapon,1]);
  }
});
test('four options trace travelled distance and focus holds their firing positions',()=>{
  const g=quiet();for(let i=0;i<6;i++)g.addOption();assert.equal(g.options.length,4);
  tick(g,.4,{x:1});for(let i=0;i<4;i++)assert.ok(Math.abs(g.player.x-g.options[i].x-43*(i+1))<.1);
  const positions=g.options.map(o=>[o.x,o.y]);tick(g,.3,{y:1,focus:true});assert.deepEqual(g.options.map(o=>[o.x,o.y]),positions);
  tick(g,.5,{y:1});assert.ok(g.options[0].y>positions[0][1]);assert.ok(g.trail.length<600);
  g.shots=[];g.shoot();assert.equal(g.shots.length,5);assert.equal(g.shots.filter(s=>s.option).length,4);
});
test('all five primary weapons damage targets; piercing hits each target only once',()=>{
  for(let weapon=0;weapon<WEAPONS.length;weapon++){
    const g=quiet();g.player.weapon=weapon;const e=g.spawnEnemy('carrier',430,270);e.speed=0;tick(g,5);assert.ok(e.hp<=0,WEAPONS[weapon].name);
  }
  const g=quiet();g.player.weapon=2;g.shoot();const s=g.shots[0];s.x=350;s.y=270;s.vx=20;
  const a=g.spawnEnemy('carrier',350,270),b=g.spawnEnemy('scout',390,270);a.px=a.x;a.py=a.y;b.px=b.x;b.py=b.y;
  for(let i=0;i<15;i++)g.updateShots(.05);assert.equal(a.hp,a.maxHp-s.damage);assert.equal(s.dead,undefined);
});
test('missile follows the floor and second upgrade adds ceiling missile',()=>{
  const g=quiet();g.player.missiles=2;g.shootMissiles();assert.equal(g.shots.length,2);
  for(let i=0;i<150;i++)g.updateShots(1/120);
  for(const s of g.shots){assert.ok(s.grounded);const edge=g.terrainAt(s.x);assert.ok(Math.abs(s.y-(s.side>0?edge.bottom-5:edge.top+5))<.001);assert.equal(s.vx,360);}
});
test('terrain always leaves a navigable corridor, and scrolling terrain can damage the hull',()=>{
  for(let stage=0;stage<3;stage++){const g=quiet({startStage:stage});for(let w=0;w<9000;w+=7){const t=g.terrainAt(w,0);assert.ok(t.bottom-t.top>240);assert.ok(t.top>=0&&t.bottom<=HEIGHT);}}
  const g=quiet();g.player.invincible=0;g.scroll=1500;g.player.y=g.terrainAt(g.player.x).bottom-3;g.update(.01);assert.equal(g.player.health,4);
  assert.ok(g.player.y<=g.terrainAt(g.player.x).bottom-8);
});
test('small hitbox gives near misses; moving across a stationary bullet still hits',()=>{
  const g=quiet();g.player.invincible=0;g.fireBullet(g.player.x,g.player.y+18,0,0);g.update(.01);assert.equal(g.player.health,5);assert.equal(g.energy,2.2);g.update(.01);assert.equal(g.energy,2.2);
  g.bullets=[];g.fireBullet(g.player.x+25,g.player.y,0,0);g.update(.05,{target:{x:g.player.x+80,y:g.player.y}});assert.equal(g.player.health,4);assert.equal(g.hitPlayer(),false);
});
test('shield takes three spaced hits before hull damage, without removing weapons',()=>{
  const g=quiet();g.meter=5;g.equip();for(let i=0;i<3;i++){g.player.invincible=0;g.hitPlayer();}assert.equal(g.player.health,5);assert.equal(g.player.shield,0);
  g.player.invincible=0;g.hitPlayer();assert.equal(g.player.health,4);
});
test('laser telegraph is harmless and fixed; active beam sweeps fast player motion',()=>{
  const g=quiet();g.player.invincible=0;g.lasers=[{x:800,y:270,width:26,age:0,warning:1.4,duration:1}];tick(g,1.3);assert.equal(g.player.health,5);
  tick(g,.15);assert.equal(g.player.health,4);assert.equal(g.lasers[0].y,270);
  const h=quiet();h.player.invincible=0;h.player.py=245;h.player.y=295;h.lasers=[{x:800,y:270,width:20,age:1.6,warning:1.4,duration:1}];h.updateLasers(.01);assert.equal(h.player.health,4);
});
test('rectangle clipping avoids false positives on diagonal travel near laser corners',()=>{
  assert.equal(segmentHitsRect(0,0,10,10,0,8,2,10),false);
  assert.equal(segmentHitsRect(0,0,10,10,4,4,6,6),true);
  assert.equal(segmentHitsRect(3,0,3,20,4,4,6,6),false);
  assert.equal(segmentHitsRect(4,0,4,20,4,4,6,6),true);
});
test('bombs and drive clear hazards; paused or terminal games cannot spend equipment',()=>{
  const g=quiet();g.spawnEnemy('carrier',400,270);g.fireBullet(300,200,2);g.lasers=[{x:100,y:100}];assert.ok(g.useBomb());assert.equal(g.bombs,2);assert.equal(g.useBomb(),false);assert.equal(g.bullets.length,0);assert.equal(g.lasers.length,0);
  for(const state of ['paused','victory','gameover']){const h=quiet();h.state=state;h.energy=100;h.meter=4;assert.equal(h.equip(),false);assert.equal(h.useBomb(),false);assert.equal(h.activateDrive(),false);assert.equal(h.switchWeapon(),false);}
  const h=quiet();h.energy=100;assert.ok(h.activateDrive());tick(h,6.1);assert.equal(h.driveTimer,0);
});
test('pause freezes simulation; identical seeds and input replay identically',()=>{
  const a=new Game({seed:122}),b=new Game({seed:122});tick(a,9,{x:.08});tick(b,9,{x:.08});assert.equal(JSON.stringify(a),JSON.stringify(b));
  a.pause();const before=JSON.stringify(a),time=a.time;tick(a,1);assert.equal(JSON.stringify(a),before);a.resume();tick(a,.1);assert.ok(a.time>time);
});
test('actual shots complete all three stages, with no direct boss damage calls',()=>{
  const g=new Game({seed:11});g.player.invincible=9999;g.player.weapon=2;g.addOption();g.addOption();const stages=new Set();
  for(let i=0;i<120*540&&g.state==='playing';i++){
    g.player.invincible=9999;g.update(1/120,{target:{x:150,y:g.boss?.y??270}});g.drainEvents();stages.add(g.stage);
    assert.ok(g.bullets.length<=600);assert.ok(g.shots.length<=280);assert.ok(g.particles.length<=450);
  }
  assert.equal(g.state,'victory');assert.deepEqual([...stages],[0,1,2]);assert.ok(g.score>50000);
});
test('all bosses reach phase three with finite trajectories at every difficulty',()=>{
  for(const difficulty of ['cadet','pilot','ace'])for(let stage=0;stage<3;stage++){
    const g=quiet({difficulty,startStage:stage});g.player.invincible=999;g.spawnBoss();g.boss.hp=g.boss.maxHp*.3;g.player.y=100;
    tick(g,12);assert.equal(g.boss?.phase,3);assert.ok(g.bullets.every(b=>[b.x,b.y,b.vx,b.vy].every(Number.isFinite)));
  }
});
test('records stay separate by beam, sector and difficulty and reject corrupted values',()=>{
  const save=readSave(null);for(const loadout of ['lance','wave','seeker'])recordRun(save,{difficulty:'pilot',startStage:0,loadout:{id:loadout},score:100});
  assert.equal(Object.keys(save.records).length,3);assert.equal(recordRun(save,{difficulty:'pilot',startStage:0,loadout:{id:'wave'},score:1}),false);
  const invalid=readSave({getItem:()=>JSON.stringify({difficulty:'x',loadout:'x',stage:8,music:99,sfx:-1,records:{'pilot:0:lance':123,'pilot:0':999,'ace:2:wave':-1}})});
  assert.equal(invalid.loadout,'lance');assert.equal(invalid.music,1);assert.equal(invalid.sfx,0);assert.deepEqual(invalid.records,{'pilot:0:lance':123});
});
