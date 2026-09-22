// Optional authoring tool. Requires @napi-rs/canvas; the games themselves have no dependencies.
import { createRequire } from 'node:module';
import { writeFile, mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
let canvasModule;
try { canvasModule = require('@napi-rs/canvas'); }
catch { canvasModule = require(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/@napi-rs/canvas`); }
const { createCanvas } = canvasModule;
globalThis.window = { devicePixelRatio: 1 };
globalThis.matchMedia = () => ({ matches: false });
globalThis.document = { createElement: () => createCanvas(1,1) };
const root = new URL('../', import.meta.url);
await mkdir(new URL('test-results/',root),{recursive:true});
for (const mode of ['vertical','horizontal']) {
  const { Game, WIDTH, HEIGHT } = await import(`../${mode}/src/engine.js`);
  const { Renderer } = await import(`../${mode}/src/render.js`);
  const canvas = createCanvas(WIDTH,HEIGHT); canvas.getBoundingClientRect=()=>({width:WIDTH,height:HEIGHT});
  const renderer=new Renderer(canvas);
  for(let stage=0;stage<3;stage++){
    const g=new Game({startStage:stage,seed:24});g.nextWave=999;g.player.invincible=9999;
    g.player.weapon=mode==='horizontal'?2:1;g.player.level=4;
    if(mode==='horizontal'){
      for(let i=0;i<3;i++)g.addOption();
      for(let i=0;i<140;i++)g.update(1/120,{x:1,y:i<70?-.4:.4});
      g.scroll=1900;g.player.missiles=2;g.shootMissiles();
    }
    g.spawnBoss();g.boss.age=7;g.boss.x=mode==='horizontal'?790:240;g.boss.y=mode==='horizontal'?270:155;g.boss.phase=2;g.boss.fire=.05;
    for(let i=0;i<85;i++){g.player.invincible=9999;g.update(1/120,{});}
    if(mode==='horizontal'){
      g.spawnEnemy('wing',575,340);g.spawnEnemy('scout',650,360);g.spawnEnemy('turret',530,g.terrainAt(530).bottom-14,1);
      g.pickups.push({type:'capsule',x:440,y:220,age:2});g.explode(590,130,'#ffc68b');
    }else{g.spawnEnemy('wing',80,370);g.spawnEnemy('scout',390,400);g.explode(325,310,'#ffc68b',30);}
    g.player.invincible=0;g.flash=0;g.shake=0;renderer.draw(g);
    await writeFile(new URL(`test-results/${mode}-sector-${stage+1}.png`,root),canvas.toBuffer('image/png'));
    if(stage===0)await writeFile(new URL(`assets/${mode==='horizontal'?'horizon':'zenith'}-cover.png`,root),canvas.toBuffer('image/png'));
  }
}
console.log('Rendered both game covers and all six boss arenas.');
