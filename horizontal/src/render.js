import { WIDTH, HEIGHT, STAGES, WEAPONS, seededRandom, clamp } from './engine.js';

const TAU = Math.PI * 2;
function polygon(c, points, fill, stroke = null, width = 1) {
  c.beginPath(); c.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
  c.closePath(); c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
function circle(c, x, y, r, fill) { c.beginPath(); c.arc(x, y, Math.max(.1, r), 0, TAU); c.fillStyle = fill; c.fill(); }
function glow(c, x, y, r, color) {
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'transparent');
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}
function path(c, points, color, width = 1) {
  c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.strokeStyle = color; c.lineWidth = width; c.stroke();
}

/** Original vector art: all geometry and textures are drawn locally. */
export function drawShip(c, x, y, scale = 1, bank = 0, time = 0, drive = false, hero = false) {
  c.save(); c.translate(x, y); c.rotate(bank); c.scale(scale, scale);
  const accent = drive ? '#ddff85' : '#a4eac3';
  for (const side of [-1, 1]) {
    const ex = side * 14;
    const length = (hero ? 45 : 26) + Math.sin(time * 38 + side) * 6;
    const g = c.createLinearGradient(ex, 22, ex, 30 + length);
    g.addColorStop(0, '#f0fff6'); g.addColorStop(.16, drive ? '#e1ff7bcc' : '#86ffeaee'); g.addColorStop(.5, '#3acdbd70'); g.addColorStop(1, '#1ec9a900');
    polygon(c, [[ex - 4, 22], [ex + 4, 22], [ex + 6, 30], [ex + 1, 29 + length], [ex - 5, 33]], g);
    path(c, [[ex, 25], [ex, 29 + length * .55]], '#eaffedb0', 1.3);
  }
  polygon(c, [[-5,-27],[-13,-7],[-34,22],[-31,29],[-11,20],[0,27],[11,20],[31,29],[34,22],[13,-7],[5,-27],[0,-38]], '#2b4448', '#102b31', .8);
  // Wing spars, ceramic armor, and dark leading edges.
  polygon(c, [[-7,-13],[-16,-6],[-34,22],[-23,20],[-9,6]], '#aec5bd', '#d2e0ce', .5);
  polygon(c, [[7,-13],[16,-6],[34,22],[23,20],[9,6]], '#d4dfcd', '#e5e9d9', .5);
  polygon(c, [[-18,3],[-31,21],[-19,15],[-10,0]], '#728f8c');
  polygon(c, [[18,3],[31,21],[19,15],[10,0]], '#99b2a2');
  polygon(c, [[-15,9],[-19,27],[-10,27],[-8,5]], '#264349', '#8faf9b', .6);
  polygon(c, [[15,9],[19,27],[10,27],[8,5]], '#3d5754', '#bed1b9', .6);
  polygon(c, [[0,-38],[-8,-17],[-7,14],[0,24],[7,14],[8,-17]], '#b6cbbc', '#deead6', .65);
  polygon(c, [[0,-38],[1,-11],[0,22],[7,14],[8,-17]], '#dce7d0');
  polygon(c, [[0,-22],[-4,-12],[-3,0],[0,5],[3,0],[4,-12]], '#172e37', '#76a9a5', .5);
  polygon(c, [[0,-20],[1,0],[3,-3],[3,-12]], '#5cbaac');
  path(c, [[-4,10],[4,10]], '#364e48', .8);
  path(c, [[-5,14],[5,14]], '#6c9185', .7);
  for (const side of [-1, 1]) {
    polygon(c, [[side*25,12],[side*28,16],[side*18,13],[side*17,8]], accent);
    path(c, [[side*12,-3],[side*13,17]], '#112e35', .8);
    path(c, [[side*14,20],[side*14,24]], '#eaffd5', 2.8);
    c.fillStyle = '#132930'; c.fillRect(side * 25 - 1, 18, 2, 5);
    circle(c, side * 30, 23, 1, '#beffbc');
  }
  if (hero) {
    c.fillStyle = '#3b6557'; c.font = '2.6px monospace'; c.textAlign = 'center'; c.fillText('SW–01', 0, 16);
    path(c, [[-3,-26],[0,-29],[3,-26]], '#c4f36b', .6);
    for (const side of [-1,1]) for (let i=0;i<3;i++) c.fillRect(side * 15 - 1, 11 + i * 2, 2, .6);
  }
  c.restore();
}

function drawEnemy(c, e, stage) {
  c.save(); c.translate(e.x, e.y);
  const large = e.type === 'carrier', armored = e.type === 'turret';
  c.rotate(e.type === 'charger' && e.charged ? Math.atan2(e.chargeY, e.chargeX) - Math.PI / 2 : Math.PI / 2);
  const s = large ? 1.6 : armored ? 1.25 : 1;
  c.scale(s, s);
  const shell = e.flash > 0 ? '#f8ffff' : stage === 1 ? '#79435b' : '#4b596a';
  const edge = stage === 1 ? '#dc7d93' : '#9aa6be';
  const bright = e.red ? '#ffb477' : armored || large ? '#ffd483' : '#ff8d9f';
  circle(c, -11, -16, 3, '#ff78875c'); circle(c, 11, -16, 3, '#ff78875c');
  if (armored || large) {
    polygon(c, [[-18,-18],[-25,-5],[-22,17],[-12,23],[12,23],[22,17],[25,-5],[18,-18]], '#263043', edge, .6);
    polygon(c, [[-11,-16],[-16,8],[0,22],[16,8],[11,-16]], shell, edge, .8);
    for (const side of [-1,1]) {
      polygon(c, [[side*13,-11],[side*23,-3],[side*20,15],[side*14,17]], shell, edge, .5);
      path(c, [[side*19,6],[side*19,20]], '#182333', 3);
      circle(c, side*19, 12, 1.5, bright);
    }
    circle(c, 0, 0, 8, '#192434'); circle(c, 0, 0, 4, bright);
  } else if (e.type === 'wing') {
    polygon(c, [[0,23],[-9,6],[-25,-8],[-20,-16],[-7,-10],[0,-15],[7,-10],[20,-16],[25,-8],[9,6]], shell, edge, .8);
    path(c, [[-20,-9],[-10,-3],[0,13],[10,-3],[20,-9]], '#243040', 2);
    polygon(c, [[0,13],[-3,2],[0,-6],[3,2]], bright);
  } else {
    polygon(c, [[0,24],[-6,7],[-20,-6],[-17,-15],[-6,-9],[0,-17],[6,-9],[17,-15],[20,-6],[6,7]], shell, edge, .7);
    polygon(c, [[0,14],[-4,-3],[0,-10],[4,-3]], bright);
    path(c, [[-13,-8],[-10,1]], '#222c40', 2); path(c, [[13,-8],[10,1]], '#222c40', 2);
  }
  c.restore();
}

export function drawBoss(c, b, stage, time) {
  c.save(); c.translate(b.x, b.y);
  const flash = b.flash > 0;
  const accent = ['#7bdcf4', '#ffa1bd', '#d6f594'][stage];
  const hull = flash ? '#e9f9f8' : ['#465971', '#734b65', '#596b61'][stage];
  if (stage === 2) {
    c.save(); c.rotate(time * .16);
    c.strokeStyle = '#b6eb9d77'; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 93, 0, TAU); c.stroke();
    for (let i=0;i<8;i++) {
      c.save(); c.rotate(i*Math.PI/4);
      polygon(c, [[-14,-74],[-20,-99],[-10,-115],[10,-115],[20,-99],[14,-74]], hull, '#a5b697', 1);
      path(c, [[-8,-105],[8,-105]], accent, 3); c.restore();
    }
    c.restore();
  } else {
    for (const side of [-1, 1]) {
      const wing = stage === 1 ? 119 : 106;
      polygon(c, [[side*19,-29],[side*75,-47],[side*wing,-7],[side*(wing-6),44],[side*78,24],[side*40,34]], '#28354b', '#91a1ba', 1);
      polygon(c, [[side*30,-23],[side*72,-35],[side*(wing-13),-3],[side*85,13],[side*35,13]], hull, '#b2b6c7', .8);
      polygon(c, [[side*63,-13],[side*80,-7],[side*79,40],[side*61,46],[side*51,27]], '#38455d', '#a3acc2', .7);
      path(c, [[side*66,25],[side*66,47]], '#1a2838', 7);
      path(c, [[side*66,28],[side*66,42]], accent, 3);
      path(c, [[side*91,-3],[side*87,12]], accent, 2);
      circle(c, side*77, -27, 3, '#ffd999');
    }
  }
  polygon(c, [[0,-63],[-35,-38],[-45,14],[-26,47],[0,66],[26,47],[45,14],[35,-38]], hull, '#b6c8c7', 1.2);
  polygon(c, [[0,-56],[-20,-34],[-26,17],[0,49],[26,17],[20,-34]], '#1d2c40', '#7b939b', 1);
  circle(c,0,0,23,'#0c1c2b');
  c.save(); c.rotate(time * (b.phase > 1 ? 2 : .7));
  c.strokeStyle = accent; c.lineWidth = 2;
  for (let i=0;i<3;i++){c.beginPath();c.arc(0,0,26,i*TAU/3,i*TAU/3+1.3);c.stroke();} c.restore();
  glow(c, 0, 0, 30, `${accent}77`); circle(c,0,0,11,accent); circle(c,-3,-4,4,'#ffffff');
  path(c, [[0,-52],[0,-35]], accent, 2);
  c.restore();
}

function makeBackdrop(stage, hero = false) {
  const canvas = document.createElement('canvas'); canvas.width = 560; canvas.height = 900;
  const c = canvas.getContext('2d'); const rand = seededRandom(717 + stage);
  const g = c.createLinearGradient(0,0,560,900);
  g.addColorStop(0, ['#0c2736','#231228','#102226'][stage]); g.addColorStop(1, ['#07111d','#110e1c','#061116'][stage]);
  c.fillStyle=g;c.fillRect(0,0,560,900);
  for (let i=0;i<30;i++) {
    const x=rand()*650-50,y=rand()*1000-50,r=60+rand()*190;
    glow(c,x,y,r, stage===0 ? `rgba(47,132,149,${.014+rand()*.045})` : stage===1 ? `rgba(${rand()>.5?'200,70,120':'111,76,162'},${.025+rand()*.055})` : `rgba(80,133,106,${.02+rand()*.03})`);
  }
  if (stage === 0) {
    const x=hero?435:490,y=hero?190:65,r=hero?197:208;
    glow(c,x,y,r+14,'#66cde746');
    const pg=c.createRadialGradient(x-r*.55,y-r*.42,10,x,y,r);
    pg.addColorStop(0,'#a2c9ca');pg.addColorStop(.17,'#518b9e');pg.addColorStop(.53,'#254d69');pg.addColorStop(.9,'#0b263b');pg.addColorStop(1,'#101d2b');
    circle(c,x,y,r,pg);
    c.save();c.beginPath();c.arc(x,y,r,0,TAU);c.clip();
    for(let i=0;i<160;i++){
      const px=x+(rand()-.5)*r*2,py=y+(rand()-.5)*r*2;
      c.save();c.translate(px,py);c.rotate(-.4);c.fillStyle=`rgba(161,218,207,${rand()*.15})`;
      c.beginPath();c.ellipse(0,0,3+rand()*30,1+rand()*10,0,0,TAU);c.fill();c.restore();
    }
    const shade=c.createLinearGradient(x-r,y-r,x+r*.5,y+r*.7);shade.addColorStop(0,'#00152800');shade.addColorStop(.48,'#00152815');shade.addColorStop(1,'#020b16ef');c.fillStyle=shade;c.fillRect(x-r,y-r,r*2,r*2);c.restore();
    c.strokeStyle='#7de2e42b';c.lineWidth=1;c.beginPath();c.ellipse(x,y+15,r*1.4,r*.3,-.48,0,TAU);c.stroke();
  } else if(stage===1) {
    for(let i=0;i<70;i++){
      const a=rand()*TAU,r=25+rand()*300;
      glow(c,280+Math.cos(a)*r,240+Math.sin(a)*r*.65,30+rand()*85,`rgba(${i%2?'211,90,110':'123,73,155'},.06)`);
    }
    glow(c,390,180,80,'#ffad8022');circle(c,390,180,3,'#ffe4c1');
  } else {
    c.strokeStyle='#43605c33'; c.lineWidth=1;
    for(let i=0;i<9;i++){c.beginPath();c.arc(280,100,75+i*42,0,TAU);c.stroke();}
    for(let i=0;i<12;i++){const a=i*TAU/12;path(c,[[280+Math.cos(a)*50,100+Math.sin(a)*50],[280+Math.cos(a)*470,100+Math.sin(a)*470]],'#43605c33');}
    circle(c,280,100,64,'#030a0e');c.strokeStyle='#b9ec9255';c.lineWidth=2;c.beginPath();c.arc(280,100,68,0,TAU);c.stroke();
  }
  return canvas;
}

function fieldBackdrop(stage) {
  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
  const c = canvas.getContext('2d'), random = seededRandom(460 + stage);
  const g = c.createLinearGradient(0, 0, WIDTH, HEIGHT);
  g.addColorStop(0, ['#071e2c', '#1f112a', '#081c21'][stage]); g.addColorStop(1, ['#0c2633', '#28152d', '#152d2a'][stage]);
  c.fillStyle = g; c.fillRect(0, 0, WIDTH, HEIGHT);
  for (let i = 0; i < 36; i++) glow(c, random() * WIDTH, random() * HEIGHT, 40 + random() * 190, ['#45999e09', '#ca628c0d', '#70a98909'][stage]);
  if (stage === 0) {
    const x = 730, y = 28, r = 183;
    glow(c, x, y, r + 14, '#a1f4ff3a');
    const planet = c.createRadialGradient(x - 90, y - 70, 10, x, y, r);
    planet.addColorStop(0, '#aecfcc'); planet.addColorStop(.36, '#528d9f'); planet.addColorStop(.8, '#203f58'); planet.addColorStop(1, '#122639');
    circle(c, x, y, r, planet); c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
    for (let i = 0; i < 130; i++) { c.fillStyle = `rgba(173,218,210,${random() * .14})`; c.beginPath(); c.ellipse(x + (random() - .5) * r * 2, y + (random() - .5) * r * 2, random() * 45 + 5, random() * 7 + 1, -.35, 0, TAU); c.fill(); }
    c.restore(); c.strokeStyle = '#8adee13a'; c.beginPath(); c.ellipse(x, y + 30, 285, 60, -.27, 0, TAU); c.stroke();
  } else if (stage === 1) {
    for (let i = 0; i < 24; i++) glow(c, 490 + (random() - .5) * 540, 210 + (random() - .5) * 170, 70 + random() * 90, '#ed6d8d09');
    glow(c, 630, 148, 100, '#ffc1801a'); circle(c, 630, 148, 2.5, '#ffdab9');
  } else {
    for (let i = 0; i < 9; i++) { c.strokeStyle = '#98c79d15'; c.lineWidth = 2; c.beginPath(); c.ellipse(720, 270, 70 + i * 72, 55 + i * 40, 0, 0, TAU); c.stroke(); }
    glow(c, 720, 270, 100, '#bdffc512'); circle(c, 720, 270, 45, '#061115');
  }
  return canvas;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas; this.c = canvas.getContext('2d', { alpha: false }); this.backdrops = [];
    const random = seededRandom(557);
    this.stars = Array.from({ length: 130 }, () => ({ x: random() * WIDTH, y: random() * HEIGHT, z: .12 + random() * .88, size: random() > .95 ? 1.4 : .65 }));
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; this.effects = true; this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }
  background(game) {
    const c = this.c, stage = game.stage;
    if (!this.backdrops[stage]) this.backdrops[stage] = fieldBackdrop(stage);
    c.drawImage(this.backdrops[stage], 0, 0);
    for (const star of this.stars) {
      const x = ((star.x - game.time * (9 + star.z * 43)) % WIDTH + WIDTH) % WIDTH;
      c.globalAlpha = .18 + star.z * .55; c.fillStyle = '#c2e4e4'; c.fillRect(x, star.y, star.size * (star.z > .8 ? 2 : 1), star.size);
    }
    c.globalAlpha = 1;
    for (let layer = 0; layer < 2; layer++) {
      const top = [], bottom = [];
      for (let x = 0; x <= WIDTH + 8; x += 8) {
        const t = game.terrainAt(x, layer ? game.scroll : game.scroll * .4);
        top.push([x, t.top + (layer ? 0 : 25)]); bottom.push([x, t.bottom - (layer ? 0 : 25)]);
      }
      const fill = layer ? ['#182c34', '#372336', '#213c3a'][stage] : ['#142b37', '#2a2034', '#163330'][stage];
      polygon(c, [[0, 0], ...top, [WIDTH + 8, 0]], fill);
      polygon(c, [[0, HEIGHT], ...bottom, [WIDTH + 8, HEIGHT]], fill);
      if (layer) { path(c, top, ['#6faaa58a', '#d287b890', '#b1cc8f90'][stage], 1.5); path(c, bottom, ['#6faaa58a', '#d287b890', '#b1cc8f90'][stage], 1.5); }
    }
    // Scenery is contained within the solid walls, so every visible edge is honest.
    for (let i = -1; i < 15; i++) {
      const x = i * 80 - game.scroll % 80, t = game.terrainAt(x);
      if (stage === 1) {
        polygon(c, [[x - 12, HEIGHT], [x - 7, t.bottom + 18], [x + 2, t.bottom + 6], [x + 16, HEIGHT]], '#57384f', '#d088a933');
        path(c, [[x + 2, t.bottom + 10], [x + 8, HEIGHT]], '#f3a9c633');
      } else {
        c.fillStyle = stage === 2 ? '#9ab87c44' : '#71979933'; c.fillRect(x, t.bottom + 9, 31, 2); c.fillRect(x + 13, t.top - 12, 19, 2);
        if (stage === 2) { c.strokeStyle = '#a3d19b20'; c.strokeRect(x, t.bottom + 17, 56, 25); c.fillStyle = '#d7fa9c'; c.fillRect(x + 5, t.bottom + 20, 4, 2); }
      }
    }
  }
  draw(game) {
    const c = this.c, p = game.player;
    c.setTransform(this.canvas.width / WIDTH, 0, 0, this.canvas.height / HEIGHT, 0, 0);
    this.background(game); c.save();
    if (!this.reduceMotion && this.effects && game.shake > 0) c.translate(Math.sin(game.time * 177) * game.shake * .65, Math.cos(game.time * 143) * game.shake * .5);
    for (const laser of game.lasers) {
      if (laser.age < laser.warning) {
        c.fillStyle = '#ff76b014'; c.fillRect(0, laser.y - laser.width / 2, laser.x, laser.width);
        c.setLineDash([10, 9]); path(c, [[0, laser.y], [laser.x, laser.y]], '#ffadc8a0', 1); c.setLineDash([]);
        c.fillStyle = '#ffc2d4'; c.font = '9px monospace'; c.fillText('DANGER', 12, laser.y - laser.width / 2 - 7);
        circle(c, laser.x, laser.y, 5 + laser.age * 6, '#ff9eba80');
      } else {
        c.fillStyle = '#ff629728'; c.fillRect(0, laser.y - laser.width, laser.x, laser.width * 2);
        c.fillStyle = '#ff79a7'; c.fillRect(0, laser.y - laser.width / 2, laser.x, laser.width);
        c.fillStyle = '#ffe5e9'; c.fillRect(0, laser.y - laser.width * .17, laser.x, laser.width * .34);
      }
    }
    for (const item of game.pickups) {
      const color = { capsule: '#ffc185', health: '#87ffe0', bomb: '#d1a8ff' }[item.type];
      c.save(); c.translate(item.x, item.y); glow(c, 0, 0, 22, `${color}22`);
      c.rotate(Math.sin(item.age * 3) * .1); polygon(c, [[-12, -8], [-7, -12], [8, -12], [12, -7], [12, 8], [7, 12], [-8, 12], [-12, 7]], '#142930', color, 1.5);
      c.fillStyle = color; c.font = 'bold 13px monospace'; c.textAlign = 'center'; c.fillText({ capsule: 'P', health: '+', bomb: 'N' }[item.type], 0, 4.5); c.restore();
    }
    for (const s of game.shots) {
      c.save(); c.translate(s.x, s.y); c.rotate(Math.atan2(s.vy, s.vx));
      const color = WEAPONS[s.weapon].color; c.globalAlpha = s.option ? .75 : 1;
      if (s.missile) { path(c, [[-18, 0], [-4, 0]], '#ffc58688', 3); polygon(c, [[-6, -3], [7, -2], [11, 0], [7, 2], [-6, 3]], '#ffe4b4'); }
      else if (s.weapon === 2) { path(c, [[-47, 0], [5, 0]], `${color}25`, 12); path(c, [[-42, 0], [3, 0]], color, 5); path(c, [[-40, 0], [3, 0]], '#f8fff2', 1.5); }
      else if (s.weapon === 3) { c.strokeStyle = `${color}40`; c.lineWidth = 9; c.beginPath(); c.ellipse(-3, 0, 8, s.r, 0, -1.5, 1.5); c.stroke(); c.strokeStyle = '#bbebff'; c.lineWidth = 2; c.stroke(); }
      else if (s.homing) { path(c, [[-26, 0], [-4, 0]], '#b795ee55', 3); polygon(c, [[-6, -3], [8, 0], [-6, 3], [-3, 0]], '#eed7ff'); }
      else { path(c, [[-14, 0], [4, 0]], `${color}3b`, 9); path(c, [[-12, 0], [4, 0]], color, 3); }
      c.restore();
    }
    for (const e of game.enemies) {
      if (e.hp <= 0) continue;
      if (e.type === 'turret') {
        c.save(); c.translate(e.x, e.y); if (e.variant === -1) c.scale(1, -1);
        polygon(c, [[-20, 14], [-14, -10], [8, -16], [18, 0], [20, 14]], e.flash > 0 ? '#f2fff5' : '#617578', '#a3c2b2', .8);
        path(c, [[0, -1], [-18, -11]], '#1a3039', 9); circle(c, 0, -1, 6, '#ffc88f'); c.restore();
      } else drawEnemy(c, e, game.stage);
      if (e.red) { c.strokeStyle = '#ffb780a0'; c.lineWidth = 1; c.beginPath(); c.arc(e.x, e.y, 4, 0, TAU); c.stroke(); }
      if (e.type === 'charger' && !e.charged && e.age > 1.3) { c.strokeStyle = '#ffd0ae'; c.beginPath(); c.arc(e.x, e.y, 25, 0, TAU * clamp((e.age - 1.3) / .85, 0, 1)); c.stroke(); }
    }
    if (game.boss) {
      const b = game.boss;
      c.save(); c.translate(b.x, b.y); c.rotate(Math.PI / 2); drawBoss(c, { ...b, x: 0, y: 0 }, game.stage, game.time); c.restore();
      c.fillStyle = '#f5ffd090'; c.font = '8px monospace'; c.textAlign = 'center'; c.fillText('CORE', b.x, b.y + 42);
    }
    for (const o of game.options) {
      glow(c, o.x, o.y, 15, '#ffd18430'); circle(c, o.x, o.y, 7, '#8a5b37'); circle(c, o.x, o.y, 5.2, '#ffd38f'); circle(c, o.x + 1.5, o.y - 1.5, 2.4, '#fff6d8');
      if (p.focus) { c.strokeStyle = '#ffd38f90'; c.strokeRect(o.x - 10, o.y - 10, 20, 20); }
    }
    if (p.health > 0) {
      if (p.shield) { c.strokeStyle = '#a6ffff80'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(p.x + 3, p.y, 33, 24, 0, 0, TAU); c.stroke(); }
      c.globalAlpha = p.invincible > 0 && Math.floor(game.time * 12) % 2 ? .42 : 1;
      drawShip(c, p.x, p.y, .57, Math.PI / 2 + p.bank, game.time, game.driveTimer > 0); c.globalAlpha = 1;
      circle(c, p.x, p.y, p.radius + 1.5, '#081820'); circle(c, p.x, p.y, p.radius, '#eafff6'); circle(c, p.x, p.y, 1.6, '#62cbbb');
      if (p.focus) { c.strokeStyle = '#edfff7a0'; c.lineWidth = .8; c.beginPath(); c.arc(p.x, p.y, 11, 0, TAU); c.stroke(); }
      if (game.driveTimer > 0) { c.strokeStyle = '#deff8f88'; c.beginPath(); c.arc(p.x, p.y, 29, game.time * 4, game.time * 4 + 4.8); c.stroke(); }
    }
    for (const particle of game.particles) {
      c.globalAlpha = particle.life / particle.maxLife;
      path(c, [[particle.x - particle.vx * .018, particle.y - particle.vy * .018], [particle.x, particle.y]], particle.color, particle.size);
    }
    c.globalAlpha = 1;
    for (const ring of game.rings) {
      c.globalAlpha = Math.max(0, ring.life / ring.maxLife); c.strokeStyle = ring.color; c.lineWidth = ring.size > 150 ? 3 : 1.5;
      c.beginPath(); c.arc(ring.x, ring.y, Math.max(.1, ring.radius), 0, TAU); c.stroke();
      if (this.effects && ring.life / ring.maxLife > .78) glow(c, ring.x, ring.y, 12 + ring.radius * .45, `${ring.color}55`);
    }
    c.globalAlpha = 1;
    // Enemy projectiles stay on top of bright effects; the solid disc is the hit area.
    for (const b of game.bullets) { circle(c, b.x, b.y, b.r + 2, '#190f25'); circle(c, b.x, b.y, b.r, b.color); circle(c, b.x - 1, b.y - 1, b.r * .42, '#fff0e8'); }
    for (const l of game.labels) { c.globalAlpha = Math.min(1, l.life * 3); c.fillStyle = l.color; c.font = 'bold 12px monospace'; c.textAlign = 'center'; c.fillText(l.text, clamp(l.x, 55, WIDTH - 55), l.y); }
    c.globalAlpha = 1; c.restore();
    if (game.flash > 0 && !this.reduceMotion && this.effects) { c.fillStyle = `rgba(215,250,237,${Math.min(.18, game.flash * .45)})`; c.fillRect(0, 0, WIDTH, HEIGHT); }
  }
}

export class HeroRenderer {
  constructor(canvas) { this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});this.stage=0;this.backgrounds=[];this.reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;const r=seededRandom(29);this.stars=Array.from({length:100},()=>({x:r()*560,y:r()*760,s:r()}));this.resize(); }
  resize(){const box=this.canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);this.canvas.width=Math.max(1,Math.round(box.width*dpr));this.canvas.height=Math.max(1,Math.round(box.height*dpr));}
  draw(time=0) {
    if(this.reduceMotion)time=0;
    const c=this.c,w=560,h=760;c.setTransform(this.canvas.width/w,0,0,this.canvas.height/h,0,0);
    if(!this.backgrounds[this.stage])this.backgrounds[this.stage]=makeBackdrop(this.stage,true);
    c.drawImage(this.backgrounds[this.stage],0,0,w,h);
    for(const s of this.stars){c.globalAlpha=.15+s.s*.6;c.fillStyle='#c9ebe6';c.fillRect(s.x,(s.y+time*(3+s.s*5))%h,s.s>.95?1.7:.7,s.s>.95?1.7:.7);}c.globalAlpha=1;
    c.save();c.translate(273,397);c.rotate(-.45);c.strokeStyle='#b0dab21c';c.lineWidth=1;
    c.beginPath();c.ellipse(0,0,232,216,0,0,TAU);c.stroke();c.setLineDash([2,13]);c.beginPath();c.ellipse(0,0,251,235,0,0,TAU);c.stroke();c.setLineDash([]);c.restore();
    glow(c,245,457,200,'#3ee6c015');
    drawShip(c,275+Math.sin(time*.35)*6,360+Math.sin(time*.5)*6,3.7,1.27+Math.sin(time*.23)*.015,time,false,true);
    drawShip(c,440,615+Math.sin(time*.5)*4,.7,1.27,time,false);
    drawShip(c,120,530+Math.sin(time*.5+1)*4,.5,1.27,time,false);
    path(c,[[150,317],[90,317],[65,296]],'#86aca84a',.8);
    c.font='8px monospace';c.fillStyle='#9dbab488';c.fillText('TWIN ION DRIVE',25,286);c.fillText('THRUST  /  98.4%',25,300);
    c.strokeStyle='#9bbeb444';c.lineWidth=1;
    for(const [x,y] of [[20,20],[540,20],[20,740],[540,740]]){const sx=x<280?1:-1,sy=y<380?1:-1;path(c,[[x,y+sy*12],[x,y],[x+sx*12,y]],'#a3c2b466');}
  }
}
