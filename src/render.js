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
  if (e.type === 'charger' && e.charged) c.rotate(Math.atan2(e.chargeY, e.chargeX) - Math.PI / 2);
  const s = large ? 1.6 : armored ? 1.25 : 1;
  c.scale(s, s);
  const shell = e.flash > 0 ? '#f8ffff' : stage === 1 ? '#79435b' : '#4b596a';
  const edge = stage === 1 ? '#dc7d93' : '#9aa6be';
  const bright = armored || large ? '#ffd483' : '#ff8d9f';
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

export class Renderer {
  constructor(canvas) {
    this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});this.backdrops=[];
    const r=seededRandom(557);
    this.stars=Array.from({length:125},()=>({x:r()*WIDTH,y:r()*HEIGHT,z:.15+r()*.85,size:r()>.94?1.4:.6}));
    this.rocks=Array.from({length:12},()=>({x:r()*WIDTH,y:r()*HEIGHT,r:4+r()*12,spin:r()*TAU}));
    this.reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
  }
  resize() {
    const rect=this.canvas.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1);
    const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  }
  background(stage,time) {
    const c=this.c;
    if(!this.backdrops[stage])this.backdrops[stage]=makeBackdrop(stage);
    c.drawImage(this.backdrops[stage],0,-45+Math.sin(time*.025)*30,WIDTH,HEIGHT+150);
    if(stage===2){
      for(const side of [0,1])for(let i=0;i<5;i++){
        const y=(i*190+time*30)%950-190,x=side?WIDTH-24:0;
        c.fillStyle='#152b2e';c.fillRect(x,y,24,150);c.strokeStyle='#42635955';c.strokeRect(x+4,y+5,16,140);
        c.fillStyle='#b4e99355';c.fillRect(x+9,y+15,6,3);
      }
    }
    for(const s of this.stars){
      const y=(s.y+time*(14+s.z*37))%HEIGHT;
      c.globalAlpha=.2+s.z*.6;c.fillStyle='#bfe2e1';c.fillRect(s.x,y,s.size,s.size*(s.z>.8?2:1));
    }
    c.globalAlpha=1;
    if(stage===1)for(const rock of this.rocks){
      const y=(rock.y+time*24)%(HEIGHT+70)-35;c.save();c.translate(rock.x,y);c.rotate(rock.spin+time*.05);
      polygon(c,[[-rock.r,-4],[-rock.r*.5,-rock.r],[rock.r*.6,-rock.r*.8],[rock.r,0],[rock.r*.5,rock.r],[-rock.r*.8,rock.r*.5]],'#412637','#79566655');
      path(c,[[-rock.r*.5,-rock.r],[0,1],[rock.r*.5,rock.r]],'#95727822');c.restore();
    }
    const v=c.createRadialGradient(240,360,180,240,360,470);v.addColorStop(0,'transparent');v.addColorStop(1,'#00091188');c.fillStyle=v;c.fillRect(0,0,WIDTH,HEIGHT);
  }
  draw(game) {
    const c=this.c;c.setTransform(this.canvas.width/WIDTH,0,0,this.canvas.height/HEIGHT,0,0);
    this.background(game.stage,game.time);
    c.save();
    if(!this.reduceMotion&&game.shake>0)c.translate(Math.sin(game.time*177)*game.shake,Math.cos(game.time*143)*game.shake*.65);
    for(const laser of game.lasers){
      const warning=laser.age<laser.warning;
      if(warning){c.fillStyle=`rgba(255,90,135,${.04+laser.age*.06})`;c.fillRect(laser.x-laser.width/2,laser.y,laser.width,HEIGHT);c.setLineDash([9,8]);path(c,[[laser.x,laser.y],[laser.x,HEIGHT]],'#ff97b888',1);c.setLineDash([]);}
      else{c.fillStyle='#ff58984d';c.fillRect(laser.x-laser.width,laser.y,laser.width*2,HEIGHT);c.fillStyle='#ff74ac';c.fillRect(laser.x-laser.width/2,laser.y,laser.width,HEIGHT);c.fillStyle='#fff2e8';c.fillRect(laser.x-laser.width*.16,laser.y,laser.width*.32,HEIGHT);}
    }
    for(const item of game.pickups){
      const color={power:'#c4f36b',health:'#77ffd1',bomb:'#ffe1a1',score:'#9ddfdc'}[item.type];
      c.save();c.translate(item.x,item.y);const s=item.type==='score'?6:12;
      glow(c,0,0,s*2.5,`${color}20`);
      if(item.type==='score'){c.rotate(Math.PI/4);c.strokeStyle=color;c.lineWidth=1;c.strokeRect(-s/2,-s/2,s,s);}
      else{c.fillStyle='#092129';c.fillRect(-s,-s,s*2,s*2);c.strokeStyle=color;c.lineWidth=1;c.strokeRect(-s,-s,s*2,s*2);c.fillStyle=color;c.font='bold 14px monospace';c.textAlign='center';c.fillText({power:'P',health:'+',bomb:'✳'}[item.type],0,5);}c.restore();
    }
    for(const s of game.shots){
      const color=WEAPONS[s.weapon].color;
      c.save();c.translate(s.x,s.y);c.rotate(Math.atan2(s.vy,s.vx)+Math.PI/2);
      if(s.weapon===1){c.fillStyle=`${color}25`;c.fillRect(-s.r,-23,s.r*2,43);c.fillStyle=color;c.fillRect(-s.r*.5,-23,s.r,34);c.fillStyle='#f5fff0';c.fillRect(-1.5,-23,3,32);}
      else if(s.homing){polygon(c,[[-3,4],[0,-11],[3,4]],'#efe2ff');path(c,[[0,4],[0,20]],'#c792ff85',3);}
      else{c.fillStyle=`${color}33`;c.fillRect(-5,-8,10,25);c.fillStyle=color;c.fillRect(-2,-8,4,17);c.fillStyle='#eaffee';c.fillRect(-1,-8,2,8);}c.restore();
    }
    for(const e of game.enemies)if(e.hp>0){
      drawEnemy(c,e,game.stage);
      if(e.type==='charger'&&!e.charged&&e.age>1.3){c.strokeStyle='#ffa0b488';c.beginPath();c.arc(e.x,e.y,24,0,TAU*clamp((e.age-1.3)/.8,0,1));c.stroke();}
    }
    if(game.boss)drawBoss(c,game.boss,game.stage,game.time);
    const p=game.player;
    if(p.health>0){
      if(p.invincible>0){c.strokeStyle=`rgba(125,244,227,${.22+Math.sin(game.time*9)*.1})`;c.lineWidth=1.5;c.beginPath();c.arc(p.x,p.y,27,0,TAU);c.stroke();}
      c.globalAlpha=p.invincible>0&&Math.floor(game.time*14)%2?.48:1;
      drawShip(c,p.x,p.y,.8,p.bank,game.time,game.driveTimer>0);
      c.globalAlpha=1;
      if(game.driveTimer>0){c.strokeStyle='#c4f36b66';c.lineWidth=1;c.beginPath();c.arc(p.x,p.y,34,game.time*4,game.time*4+Math.PI*1.5);c.stroke();}
      circle(c,p.x,p.y,5,'#071921');circle(c,p.x,p.y,2.7,'#effff4');
      if(p.focus){c.strokeStyle='#f0fffcb0';c.lineWidth=.7;c.beginPath();c.arc(p.x,p.y,10,0,TAU);c.stroke();}
    }
    // Bullets always render above explosions and ships for readable dodging.
    for(const particle of game.particles){c.globalAlpha=particle.life/particle.maxLife;c.fillStyle=particle.color;c.fillRect(particle.x,particle.y,particle.size,particle.size*1.5);}c.globalAlpha=1;
    for(const ring of game.rings){c.globalAlpha=ring.life/ring.maxLife;c.strokeStyle=ring.color;c.lineWidth=2;c.beginPath();c.arc(ring.x,ring.y,ring.radius,0,TAU);c.stroke();}c.globalAlpha=1;
    for(const b of game.bullets){circle(c,b.x,b.y,b.r+2.3,'#190f25');circle(c,b.x,b.y,b.r,b.color);circle(c,b.x-b.r*.18,b.y-b.r*.22,b.r*.46,'#ffe8dc');}
    for(const l of game.labels){c.globalAlpha=Math.min(1,l.life*3);c.fillStyle=l.color;c.font=l.text.length>5?'bold 11px monospace':'9px monospace';c.textAlign='center';c.fillText(l.text,clamp(l.x,55,WIDTH-55),l.y);}c.globalAlpha=1;
    c.restore();
    if(game.flash>0&&!this.reduceMotion){c.fillStyle=`rgba(215,250,237,${Math.min(.28,game.flash*.6)})`;c.fillRect(0,0,WIDTH,HEIGHT);}
    const top=c.createLinearGradient(0,0,0,115);top.addColorStop(0,'#06101ce8');top.addColorStop(1,'#06101c00');c.fillStyle=top;c.fillRect(0,0,WIDTH,115);
    const bottom=c.createLinearGradient(0,HEIGHT-100,0,HEIGHT);bottom.addColorStop(0,'transparent');bottom.addColorStop(1,'#05101dd9');c.fillStyle=bottom;c.fillRect(0,HEIGHT-100,WIDTH,100);
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
    drawShip(c,275+Math.sin(time*.35)*6,360+Math.sin(time*.5)*6,4.3,-.43+Math.sin(time*.23)*.015,time,false,true);
    drawShip(c,440,615+Math.sin(time*.5)*4,.7,-.4,time,false);
    drawShip(c,120,530+Math.sin(time*.5+1)*4,.5,-.4,time,false);
    path(c,[[150,317],[90,317],[65,296]],'#86aca84a',.8);
    c.font='8px monospace';c.fillStyle='#9dbab488';c.fillText('TWIN ION DRIVE',25,286);c.fillText('THRUST  /  98.4%',25,300);
    c.strokeStyle='#9bbeb444';c.lineWidth=1;
    for(const [x,y] of [[20,20],[540,20],[20,740],[540,740]]){const sx=x<280?1:-1,sy=y<380?1:-1;path(c,[[x,y+sy*12],[x,y],[x+sx*12,y]],'#a3c2b466');}
  }
}
