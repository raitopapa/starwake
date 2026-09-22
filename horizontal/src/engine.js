import { segmentHitsRect } from '../../shared/collision.js';
/** Deterministic, browser-independent horizontal arcade simulation. */
export const WIDTH = 960;
export const HEIGHT = 540;
export const WEAPONS = [
  { name: 'PULSE', label: 'パルス', color: '#83f3e6' },
  { name: 'DOUBLE', label: 'ダブル', color: '#ffe3a1' },
  { name: 'LANCE', label: '貫通レーザー', color: '#bff879' },
  { name: 'WAVE', label: '波動砲', color: '#8ed6ff' },
  { name: 'SEEKER', label: '追尾弾', color: '#d9adff' },
];
export const LOADOUTS = [
  { id: 'lance', weapon: 2, name: 'LANCE', description: '装甲を貫く、一直線のレーザー。' },
  { id: 'wave', weapon: 3, name: 'WAVE', description: '広がる波動で、編隊をまとめて撃ち抜く。' },
  { id: 'seeker', weapon: 4, name: 'SEEKER', description: '敵を追う誘導弾。回避に集中できる。' },
];
export const POWERUPS = ['SPEED', 'MISSILE', 'DOUBLE', 'BEAM', 'OPTION', 'SHIELD'];
export const STAGES = [
  { name: '蒼の軌道', en: 'ORBITAL FRONTIER', color: '#83f3e6', duration: 64, boss: 'AEGIS', bossSub: '軌道防衛艦', hp: 2000, scroll: 88, description: '惑星の稜線を抜け、軌道防衛艦を突破せよ。' },
  { name: '紅の星雲', en: 'CRIMSON NEBULA', color: '#ff9dbd', duration: 72, boss: 'SERAPH', bossSub: '深紅の翼', hp: 2700, scroll: 100, description: '結晶の洞窟に潜む、深紅の翼を追え。' },
  { name: '深淵の中枢', en: 'THE SILENT CORE', color: '#c4f36b', duration: 80, boss: 'OBLIVION', bossSub: '終焉の中枢', hp: 3400, scroll: 108, description: '動く要塞の回廊を抜け、最後の中枢へ。' },
];
export const DIFFICULTIES = {
  cadet: { health: 7, bombs: 4, bulletSpeed: .74, fireRate: 1.3, enemyHp: .78, score: .7 },
  pilot: { health: 5, bombs: 3, bulletSpeed: 1, fireRate: 1, enemyHp: 1, score: 1 },
  ace: { health: 3, bombs: 2, bulletSpeed: 1.2, fireRate: .8, enemyHp: 1.18, score: 1.5 },
};
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function segmentHitsCircle(x1, y1, x2, y2, cx, cy, radius) {
  const dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy;
  const t = len ? clamp(((cx - x1) * dx + (cy - y1) * dy) / len, 0, 1) : 0;
  return (x1 + dx * t - cx) ** 2 + (y1 + dy * t - cy) ** 2 <= radius ** 2;
}
const TAU = Math.PI * 2;

export class Game {
  constructor({ difficulty = 'pilot', startStage = 0, loadout = 'lance', seed = 42 } = {}) {
    this.difficulty = Object.hasOwn(DIFFICULTIES, difficulty) ? difficulty : 'pilot';
    this.settings = DIFFICULTIES[this.difficulty];
    this.startStage = Number.isInteger(startStage) ? clamp(startStage, 0, 2) : 0;
    this.loadout = LOADOUTS.find(item => item.id === loadout) || LOADOUTS[0];
    this.stage = this.startStage; this.random = seededRandom(seed); this.fxRandom = seededRandom(seed + 997);
    this.state = 'playing'; this.time = 0; this.stageTime = 0; this.scroll = 0; this.wave = 0; this.nextWave = 1.4; this.nextId = 1;
    this.score = 0; this.kills = 0; this.combo = 0; this.maxCombo = 0; this.comboTimer = 0; this.multiplier = 1;
    this.energy = 0; this.bombs = this.settings.bombs; this.bombTimer = 0; this.driveTimer = 0; this.transitionTimer = 0;
    this.shake = 0; this.flash = 0; this.hitStop = 0; this.meter = -1; this.equipSerial = 0;
    this.player = { x: 155, y: 270, px: 155, py: 270, radius: 4, health: this.settings.health, maxHealth: this.settings.health,
      speed: 0, missiles: 0, shield: 0, level: 1, weapon: 0, unlocked: [0], invincible: 3, fireTimer: 0, missileTimer: 0, bank: 0, focus: false };
    this.options = []; this.trail = [{ x: 155, y: 270 }, { x: -120, y: 270 }];
    this.enemies = []; this.shots = []; this.bullets = []; this.pickups = []; this.lasers = [];
    this.particles = []; this.rings = []; this.labels = []; this.events = [];
    this.boss = null; this.bossSpawned = false;
    this.banner = { title: this.sector.name, sub: `SECTOR 0${this.stage + 1} / ${this.sector.en}`, time: 2.8, warning: false };
    if (this.startStage > 0) {
      this.player.speed = 1; this.player.missiles = 1; this.player.unlocked.push(1, this.loadout.weapon); this.player.weapon = this.loadout.weapon;
      for (let i = 0; i < this.startStage; i++) this.addOption();
    }
  }
  get sector() { return STAGES[this.stage]; }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  drainEvents() { return this.events.splice(0); }
  pause() { if (this.state === 'playing') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'playing'; }
  switchWeapon() {
    if (this.state !== 'playing') return false;
    const p = this.player; p.weapon = p.unlocked[(p.unlocked.indexOf(p.weapon) + 1) % p.unlocked.length];
    this.emit('switch'); return true;
  }
  upgradeAvailable(slot = this.meter) {
    const p = this.player;
    return slot >= 0 && [p.speed < 3, p.missiles < 2, !p.unlocked.includes(1), !p.unlocked.includes(this.loadout.weapon), this.options.length < 4, p.shield < 3][slot];
  }
  equip() {
    if (this.state !== 'playing' || !this.upgradeAvailable()) return false;
    const slot = this.meter, p = this.player;
    if (slot === 0) p.speed++;
    if (slot === 1) p.missiles++;
    if (slot === 2 || slot === 3) { p.weapon = slot === 2 ? 1 : this.loadout.weapon; p.unlocked.push(p.weapon); }
    if (slot === 4) this.addOption();
    if (slot === 5) p.shield = 3;
    p.level = 1 + this.options.length; this.meter = -1; this.equipSerial++;
    this.label(p.x, p.y - 35, slot === 3 ? this.loadout.name : POWERUPS[slot], '#d6ff8c');
    this.ring(p.x, p.y, '#c4f36b', 60, .45); this.emit('equip', { slot }); return true;
  }
  addOption() {
    if (this.options.length >= 4) return;
    const point = this.trailPoint((this.options.length + 1) * 43);
    this.options.push({ ...point, px: point.x, py: point.y });
  }
  trailPoint(distance) {
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1], b = this.trail[i], d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d >= distance && d > 0) return { x: a.x + (b.x - a.x) * distance / d, y: a.y + (b.y - a.y) * distance / d };
      distance -= d;
    }
    return { ...this.trail[this.trail.length - 1] };
  }
  activateDrive() {
    if (this.state !== 'playing' || this.energy < 100 || this.transitionTimer) return false;
    this.energy = 0; this.driveTimer = 6; this.bullets.length = 0; this.player.invincible = Math.max(this.player.invincible, 1.2);
    this.ring(this.player.x, this.player.y, '#c4f36b', 230, .8); this.emit('drive'); return true;
  }
  useBomb() {
    if (this.state !== 'playing' || this.bombs <= 0 || this.bombTimer > 0 || this.transitionTimer) return false;
    this.bombs--; this.bombTimer = 1.15; this.player.invincible = 2; this.flash = .36; this.shake = 8;
    this.bullets.length = 0; this.lasers.length = 0;
    for (const e of this.enemies) this.damageEnemy(e, 150);
    if (this.boss?.age > 2.5) this.damageBoss(310);
    this.ring(this.player.x, this.player.y, '#aefce7', 1100, 1.1); this.emit('bomb'); return true;
  }
  /** Continuous ridgelines share the exact same sampler with rendering and collision. */
  terrainAt(x, scroll = this.scroll) {
    const world = scroll + x, entry = clamp((world - 480) / 800, 0, 1);
    const exit = clamp((this.sector.duration * this.sector.scroll - world + 700) / 900, 0, 1);
    const amount = entry * exit;
    let top, bottom;
    if (this.stage === 0) {
      top = 24 + (20 + 18 * Math.sin(world * .004) + 11 * Math.sin(world * .016)) * amount;
      bottom = HEIGHT - 28 - (38 + 31 * Math.sin(world * .006 + 1) + 12 * Math.sin(world * .025)) * amount;
    } else if (this.stage === 1) {
      const shift = Math.sin(world * .0035) * 36;
      top = 25 + (72 + shift + 22 * Math.sin(world * .014) + 13 * Math.sin(world * .033)) * amount;
      bottom = HEIGHT - 25 - (77 - shift + 25 * Math.sin(world * .014 + 2) + 12 * Math.sin(world * .031)) * amount;
    } else {
      const block = (Math.sin(world * .007) + Math.sin(world * .021) / 3) * 26;
      top = 28 + (65 + block + 25 * Math.sin(world * .0025)) * amount;
      bottom = HEIGHT - 28 - (65 - block + 22 * Math.sin(world * .0025 + 1)) * amount;
    }
    return { top, bottom };
  }
  update(dt, input = {}) {
    if (this.state !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(.05, dt);
    if (this.hitStop > 0) { this.hitStop = Math.max(0, this.hitStop - dt); this.updateEffects(dt); return; }
    this.time += dt; this.stageTime += dt;
    if (!this.bossSpawned && !this.transitionTimer) this.scroll += this.sector.scroll * dt;
    for (const key of ['bombTimer', 'driveTimer', 'comboTimer', 'transitionTimer']) this[key] = Math.max(0, this[key] - dt);
    this.banner.time = Math.max(0, this.banner.time - dt); this.player.invincible = Math.max(0, this.player.invincible - dt);
    if (!this.comboTimer) { this.combo = 0; this.multiplier = 1; }
    this.shake = Math.max(0, this.shake - dt * 25); this.flash = Math.max(0, this.flash - dt * 1.5);
    this.updateEffects(dt); this.movePlayer(dt, input);
    if (this.clearing) {
      this.updatePickups(dt);
      if (this.transitionTimer === 0) this.advanceStage();
      return;
    }
    this.player.fireTimer -= dt; this.player.missileTimer -= dt;
    if (this.player.fireTimer <= 0) this.shoot();
    if (this.player.missiles && this.player.missileTimer <= 0) this.shootMissiles();
    if (!this.bossSpawned) {
      if (this.stageTime >= this.sector.duration) this.spawnBoss();
      else if (this.stageTime >= this.nextWave) { this.spawnWave(); this.nextWave += 3.5 - this.stage * .25; }
    }
    this.updateEnemies(dt); this.updateBoss(dt); this.updateShots(dt); this.updateBullets(dt); this.updateLasers(dt); this.updatePickups(dt);
    this.enemies = this.enemies.filter(e => e.hp > 0 && e.x > -100 && e.y > -150 && e.y < HEIGHT + 150);
    this.shots = this.shots.filter(s => !s.dead && s.life > 0 && s.x > -50 && s.x < WIDTH + 100 && s.y > -60 && s.y < HEIGHT + 60);
    this.bullets = this.bullets.filter(b => !b.dead && b.x > -35 && b.x < WIDTH + 35 && b.y > 0 && b.y < HEIGHT);
  }
  movePlayer(dt, input) {
    const p = this.player; p.px = p.x; p.py = p.y; p.focus = !!input.focus;
    const speed = (225 + p.speed * 55) * (p.focus ? .48 : 1);
    if (input.target && Number.isFinite(input.target.x) && Number.isFinite(input.target.y)) {
      const dx = input.target.x - p.x, dy = input.target.y - p.y, distance = Math.hypot(dx, dy), step = Math.min(distance, (p.focus ? 230 : 900) * dt);
      if (distance > 0) { p.x += dx / distance * step; p.y += dy / distance * step; }
    } else {
      const x = Number.isFinite(input.x) ? input.x : 0, y = Number.isFinite(input.y) ? input.y : 0, length = Math.max(1, Math.hypot(x, y));
      p.x += x / length * speed * dt; p.y += y / length * speed * dt;
    }
    p.x = clamp(p.x, 28, WIDTH - 38); p.y = clamp(p.y, 28, HEIGHT - 28);
    p.bank += (clamp((p.y - p.py) * .08, -.22, .22) - p.bank) * Math.min(1, dt * 12);
    // Sweep the travel path as well as the current terrain; no tunnelling on fast drag.
    const steps = Math.max(1, Math.ceil(Math.hypot(p.x - p.px, p.y - p.py) / 5));
    for (let i = 0; i <= steps; i++) {
      const x = p.px + (p.x - p.px) * i / steps, y = p.py + (p.y - p.py) * i / steps, edge = this.terrainAt(x);
      if (y - 8 < edge.top || y + 8 > edge.bottom) { this.hitPlayer(); break; }
    }
    const edge = this.terrainAt(p.x); p.y = clamp(p.y, edge.top + 9, edge.bottom - 9);
    if (Math.hypot(p.x - this.trail[0].x, p.y - this.trail[0].y) > .5) {
      this.trail.unshift({ x: p.x, y: p.y }); let length = 0;
      for (let i = 1; i < this.trail.length; i++) { length += Math.hypot(this.trail[i].x - this.trail[i - 1].x, this.trail[i].y - this.trail[i - 1].y); if (length > 230) { this.trail.length = i + 1; break; } }
    }
    this.options.forEach((o, i) => { o.px = o.x; o.py = o.y; if (!p.focus) Object.assign(o, this.trailPoint((i + 1) * 43)); });
  }
  shoot() {
    const p = this.player, weapon = p.weapon, drive = this.driveTimer > 0;
    p.fireTimer = [ .17, .19, .105, .2, .24 ][weapon] * (drive ? .64 : 1);
    const origins = [{ x: p.x + 22, y: p.y, scale: 1 }, ...this.options.map(o => ({ x: o.x + 8, y: o.y, scale: .52 }))];
    for (const o of origins) {
      const angles = weapon === 1 ? [0, -.43] : weapon === 4 && drive ? [-.1, .1] : [0];
      for (const angle of angles) {
        if (this.shots.length >= 280) break;
        const speed = [800, 820, 1330, 660, 465][weapon];
        this.shots.push({ x: o.x, y: o.y, px: o.x, py: o.y, baseY: o.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          weapon, r: weapon === 3 ? 7 : 3, damage: [10, 9, 7, 13, 15][weapon] * o.scale * (drive ? 1.3 : 1), life: 2.8, age: 0,
          homing: weapon === 4, piercing: weapon === 2 || weapon === 3, hits: new Set(), option: o.scale < 1 });
      }
    }
    this.emit('shot', { weapon });
  }
  shootMissiles() {
    const p = this.player; p.missileTimer = .8;
    for (const side of p.missiles > 1 ? [1, -1] : [1]) {
      this.shots.push({ x: p.x, y: p.y + side * 10, px: p.x, py: p.y + side * 10, vx: 135, vy: side * 190, weapon: 0, r: 4, damage: 32,
        life: 5, age: 0, missile: true, side, grounded: false, hits: new Set() });
    }
  }
  spawnEnemy(type, x, y, variant = 0) {
    const defs = { scout: [18, 15, 170, 120], wing: [24, 18, 145, 180], turret: [55, 17, 0, 400], charger: [26, 16, 105, 250], carrier: [120, 30, 75, 900] };
    const [hp, r, speed, points] = defs[type] || defs.scout;
    const e = { id: this.nextId++, type, x, y, px: x, py: y, baseY: y, hp: hp * this.settings.enemyHp, maxHp: hp * this.settings.enemyHp, r, speed,
      points, age: 0, fire: 1.1 + this.random() * .6, variant, flash: 0, charged: false, capsule: false };
    this.enemies.push(e); return e;
  }
  spawnWave() {
    const wave = this.wave++, pattern = wave % 7, h = 140 + this.random() * 250;
    if (pattern === 0 || pattern === 1 || pattern === 4) {
      for (let i = 0; i < 5; i++) {
        const e = this.spawnEnemy(pattern === 1 ? 'wing' : 'scout', WIDTH + 30 + i * 65, clamp(h + (pattern === 1 ? (i - 2) * 29 : 0), 140, 390), i);
        e.capsule = i === 1 || i === 4; e.red = true;
      }
    } else if (pattern === 2) {
      for (let i = 0; i < 3; i++) this.spawnEnemy('turret', WIDTH + 40 + i * 210, 0, i % 2 && this.stage > 0 ? -1 : 1).capsule = true;
      for (let i = 0; i < 3; i++) this.spawnEnemy('wing', WIDTH + 150 + i * 80, 240, i);
    } else if (pattern === 3) {
      for (let i = 0; i < 3; i++) this.spawnEnemy('charger', WIDTH + 70 + i * 100, 160 + i * 100, i).capsule = i === 2;
    } else if (pattern === 5) {
      this.spawnEnemy('carrier', WIDTH + 80, HEIGHT / 2).capsule = true;
      for (let i = 0; i < 4; i++) this.spawnEnemy('scout', WIDTH + 20 + i * 85, i % 2 ? 380 : 150, i);
    } else {
      for (let i = 0; i < 6; i++) this.spawnEnemy('wing', WIDTH + 30 + i * 65, 270 + Math.sin(i) * 100, i).capsule = i % 3 === 0;
    }
  }
  fireBullet(x, y, angle, speed = 180, r = 4.5, color = '#ff9fc1') {
    if (this.bullets.length >= 600 || this.bombTimer > 0 || this.clearing) return;
    this.bullets.push({ x, y, px: x, py: y, vx: Math.cos(angle) * speed * this.settings.bulletSpeed, vy: Math.sin(angle) * speed * this.settings.bulletSpeed, r, color, grazed: false });
  }
  aimedShot(e, count = 1, spread = .18, speed = 180) {
    const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    for (let i = 0; i < count; i++) this.fireBullet(e.x, e.y, angle + (i - (count - 1) / 2) * spread, speed);
  }
  updateEnemies(dt) {
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.px = e.x; e.py = e.y; e.age += dt; e.flash = Math.max(0, e.flash - dt); e.fire -= dt;
      if (e.type === 'turret') { e.x -= this.sector.scroll * dt; const edge = this.terrainAt(e.x); e.y = e.variant === -1 ? edge.top + 14 : edge.bottom - 14; }
      else if (e.type === 'charger') {
        if (!e.charged && e.age >= 2.15 && e.x < WIDTH - 30) { const a = Math.atan2(this.player.y - e.y, this.player.x - e.x); e.chargeX = Math.cos(a) * 350; e.chargeY = Math.sin(a) * 350; e.charged = true; }
        e.x += (e.charged ? e.chargeX : -e.speed) * dt; if (e.charged) e.y += e.chargeY * dt;
      } else { e.x -= e.speed * dt; e.y = e.baseY + Math.sin(e.age * (e.type === 'wing' ? 2.6 : 1.8) + e.variant * .55) * (e.type === 'wing' ? 50 : 26); }
      if (e.type !== 'turret') { const edge = this.terrainAt(e.x); e.y = clamp(e.y, edge.top + e.r + 4, edge.bottom - e.r - 4); }
      if (e.fire <= 0 && e.x < WIDTH - 25 && e.x > this.player.x + 80 && Math.hypot(e.x - this.player.x, e.y - this.player.y) > 140) {
        if (e.type === 'carrier') this.aimedShot(e, 5 + this.stage * 2, .17, 170);
        else if (e.type === 'turret') this.aimedShot(e, 2 + this.stage, .16, 185);
        else if (e.type === 'wing' || this.stage > 0) this.aimedShot(e, 1, 0, 160);
        e.fire = (e.type === 'turret' ? 1.8 : 2.4) * this.settings.fireRate;
      }
      if (segmentHitsCircle(e.px - this.player.px, e.py - this.player.py, e.x - this.player.x, e.y - this.player.y, 0, 0, e.r + 8)) this.hitPlayer();
    }
  }
  spawnBoss() {
    this.bossSpawned = true; this.enemies.length = 0; this.bullets.length = 0; this.lasers.length = 0;
    this.boss = { id: 'boss', x: WIDTH + 150, y: HEIGHT / 2, px: WIDTH + 150, py: HEIGHT / 2, r: 51, hp: this.sector.hp * this.settings.enemyHp,
      maxHp: this.sector.hp * this.settings.enemyHp, age: 0, fire: 1, special: 5, phase: 1, flash: 0, volley: 0 };
    this.banner = { title: this.sector.boss, sub: `WARNING / ${this.sector.bossSub}`, time: 3, warning: true };
    this.emit('warning');
  }
  updateBoss(dt) {
    const b = this.boss; if (!b || this.clearing) return;
    b.px = b.x; b.py = b.y; b.age += dt; b.flash = Math.max(0, b.flash - dt);
    b.x += (795 + Math.sin(b.age * .5) * 18 - b.x) * Math.min(1, dt * 1.6);
    b.y = 270 + Math.sin(b.age * (.65 + this.stage * .1)) * (this.stage === 2 ? 82 : 112);
    if (segmentHitsCircle(b.px - this.player.px, b.py - this.player.py, b.x - this.player.x, b.y - this.player.y, 0, 0, b.r + 8)) this.hitPlayer();
    if (b.age < 3) return;
    const phase = b.hp / b.maxHp > .66 ? 1 : b.hp / b.maxHp > .33 ? 2 : 3;
    if (phase !== b.phase) { b.phase = phase; this.bullets.length = 0; this.ring(b.x, b.y, this.sector.color, 200, .6); this.emit('phase', { phase }); }
    b.fire -= dt; b.special -= dt;
    if (b.fire <= 0) {
      if (this.stage === 0) {
        this.aimedShot(b, 3 + b.phase * 2, .14, 190 + b.phase * 12);
        if (b.phase > 1) for (const side of [-1, 1]) this.fireBullet(b.x - 20, b.y + side * 70, Math.PI, 245, 5, '#ffd59f');
      } else if (this.stage === 1) {
        for (let i = 0; i < 10 + b.phase * 3; i++) this.fireBullet(b.x - 30, b.y, i * TAU / (10 + b.phase * 3) + b.volley * .23, 142 + b.phase * 13, 4.5);
        this.aimedShot(b, 3, .11, 220);
      } else {
        for (let i = 0; i < 5 + b.phase; i++) {
          const a = Math.PI - .9 + i * 1.8 / (4 + b.phase) + Math.sin(b.volley * .7) * .23;
          this.fireBullet(b.x - 40, b.y, a, 185 + b.phase * 8, 5, '#dcf798');
        }
      }
      b.volley++; b.fire = ([1.1, 1.35, .58][this.stage] - b.phase * .075) * this.settings.fireRate;
    }
    if (b.special <= 0) {
      const ys = this.stage === 2 && b.phase > 1 ? [this.player.y - 48, this.player.y + 48] : [this.player.y];
      for (const y of ys) this.lasers.push({ x: b.x - 45, y: clamp(y, 70, HEIGHT - 70), width: 22 + b.phase * 4, age: 0, warning: 1.4, duration: .9, fired: false });
      b.special = 7 - b.phase * .55; this.emit('laserWarning');
    }
  }
  updateShots(dt) {
    for (const s of this.shots) {
      if (s.dead) continue;
      s.px = s.x; s.py = s.y; s.life -= dt; s.age += dt;
      if (s.homing) {
        let nearest = null, distance = Infinity;
        for (const e of this.boss ? [...this.enemies, this.boss] : this.enemies) {
          if (e.hp <= 0 || e.x < s.x - 35 || e.x > WIDTH + 80) continue;
          const d = (e.x - s.x) ** 2 + (e.y - s.y) ** 2;
          if (d < distance) { nearest = e; distance = d; }
        }
        if (nearest) { const a = Math.atan2(nearest.y - s.y, nearest.x - s.x), amount = Math.min(1, dt * 5); s.vx += (Math.cos(a) * 490 - s.vx) * amount; s.vy += (Math.sin(a) * 490 - s.vy) * amount; }
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.weapon === 3) { s.y = s.baseY + Math.sin(s.age * 17) * Math.min(24, s.age * 35); s.r = Math.min(15, 7 + s.age * 8); }
      const edge = this.terrainAt(s.x);
      if (s.missile && (s.grounded || (s.side > 0 ? s.y + s.r >= edge.bottom : s.y - s.r <= edge.top))) {
        s.grounded = true; s.vy = 0; s.vx = 360; s.y = s.side > 0 ? edge.bottom - 5 : edge.top + 5;
      } else if (s.y - s.r < edge.top || s.y + s.r > edge.bottom) { s.dead = true; this.spark(s.x, s.y, '#b2d0c6', 3); continue; }
      for (const e of this.enemies) {
        if (e.hp <= 0 || s.hits.has(e.id)) continue;
        if (segmentHitsCircle(s.px - e.px, s.py - e.py, s.x - e.x, s.y - e.y, 0, 0, e.r + s.r)) {
          s.hits.add(e.id); this.damageEnemy(e, s.damage); this.spark(s.x, s.y, WEAPONS[s.weapon].color, 2);
          if (!s.piercing) { s.dead = true; break; }
        }
      }
      const b = this.boss;
      if (!s.dead && b && b.age > 2.5 && !s.hits.has('boss') && segmentHitsCircle(s.px - b.px, s.py - b.py, s.x - b.x, s.y - b.y, 0, 0, b.r + s.r)) {
        s.hits.add('boss'); this.damageBoss(s.damage); this.spark(s.x, s.y, WEAPONS[s.weapon].color, 3); if (!s.piercing) s.dead = true;
      }
    }
  }
  updateBullets(dt) {
    const p = this.player;
    for (const b of this.bullets) {
      b.px = b.x; b.py = b.y; b.x += b.vx * dt; b.y += b.vy * dt;
      const edge = this.terrainAt(b.x); if (b.y < edge.top || b.y > edge.bottom) { b.dead = true; continue; }
      const args = [b.px - p.px, b.py - p.py, b.x - p.x, b.y - p.y, 0, 0];
      if (segmentHitsCircle(...args, p.radius + b.r)) { if (p.invincible <= 0) { b.dead = true; this.hitPlayer(); } }
      else if (!b.grazed && p.invincible <= 0 && segmentHitsCircle(...args, b.r + 22)) {
        b.grazed = true; this.energy = clamp(this.energy + 2.2, 0, 100); this.score += 8;
        this.spark(p.x, p.y, '#a9fbe5', 2); this.emit('graze');
      }
    }
  }
  updateLasers(dt) {
    for (const l of this.lasers) {
      l.age += dt;
      if (l.age < l.warning) continue;
      if (!l.fired) { l.fired = true; this.emit('laser'); this.shake = Math.max(this.shake, 3); }
      const p = this.player;
      // The beam spans [0, x]. Relative player travel is swept through its live strip.
      if (l.age <= l.warning + l.duration && segmentHitsRect(p.px, p.py, p.x, p.y, -p.radius, l.y - l.width / 2 - p.radius, l.x + p.radius, l.y + l.width / 2 + p.radius)) this.hitPlayer();
    }
    this.lasers = this.lasers.filter(l => l.age < l.warning + l.duration);
  }
  hitPlayer() {
    const p = this.player;
    if (p.invincible > 0 || this.clearing || this.state !== 'playing') return false;
    if (p.shield > 0) { p.shield--; p.invincible = 1; this.ring(p.x, p.y, '#89f7ee', 60, .4); this.emit('shield'); return true; }
    p.health--; p.invincible = 2.2; this.combo = 0; this.multiplier = 1; this.comboTimer = 0;
    this.shake = 6; this.flash = .22; this.hitStop = .055; this.explode(p.x, p.y, '#b2ffe0', false); this.emit('hit');
    if (p.health <= 0) { this.state = 'gameover'; this.emit('gameover'); }
    return true;
  }
  damageEnemy(e, amount) {
    if (e.hp <= 0) return;
    e.hp -= amount; e.flash = .06;
    if (e.hp > 0) return;
    this.kills++; this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); this.comboTimer = 4.2; this.multiplier = Math.min(8, 1 + Math.floor(this.combo / 6));
    this.score += Math.round(e.points * this.multiplier * this.settings.score); this.energy = clamp(this.energy + (e.type === 'carrier' ? 12 : 3.3), 0, 100);
    this.explode(e.x, e.y, e.red ? '#ffc896' : this.sector.color, e.type === 'carrier');
    this.hitStop = Math.max(this.hitStop, e.type === 'carrier' ? .045 : .012);
    if (e.capsule) this.pickups.push({ x: e.x, y: e.y, type: 'capsule', age: 0 });
    else if (this.kills % 23 === 0) this.pickups.push({ x: e.x, y: e.y, type: 'health', age: 0 });
    else if (this.kills % 31 === 0) this.pickups.push({ x: e.x, y: e.y, type: 'bomb', age: 0 });
  }
  damageBoss(amount) {
    const b = this.boss; if (!b || b.hp <= 0) return;
    b.hp -= amount; b.flash = .05;
    if (b.hp > 0) return;
    this.kills++; this.score += Math.round((12000 + this.stage * 6000 + this.player.health * 800) * this.settings.score);
    for (let i = 0; i < 7; i++) this.explode(b.x + (this.fxRandom() - .5) * 140, b.y + (this.fxRandom() - .5) * 140, this.sector.color, true);
    this.boss = null; this.bullets.length = 0; this.lasers.length = 0; this.enemies.length = 0; this.shots.length = 0;
    this.clearing = true; this.transitionTimer = 3.2; this.shake = 11; this.flash = .35; this.hitStop = .09;
    this.banner = { title: 'SECTOR CLEAR', sub: 'HULL +1 / NOVA +1', time: 3.2, warning: false }; this.emit('clear');
  }
  advanceStage() {
    if (this.stage === 2) { this.state = 'victory'; this.emit('victory'); return; }
    this.stage++; this.stageTime = 0; this.scroll = 0; this.nextWave = 1.5; this.wave = 0; this.bossSpawned = false; this.clearing = false;
    this.player.health = Math.min(this.player.maxHealth, this.player.health + 1); this.player.invincible = 3; this.bombs = Math.min(5, this.bombs + 1);
    this.pickups.length = 0; this.banner = { title: this.sector.name, sub: `SECTOR 0${this.stage + 1} / ${this.sector.en}`, time: 2.8, warning: false }; this.emit('stage', { stage: this.stage });
  }
  updatePickups(dt) {
    for (const item of this.pickups) {
      item.age += dt; item.x -= this.sector.scroll * .7 * dt;
      const p = this.player, d = Math.hypot(p.x - item.x, p.y - item.y);
      if (d < 94 || this.driveTimer > 0 || this.clearing) { const step = Math.min(d, 320 * dt); if (d) { item.x += (p.x - item.x) / d * step; item.y += (p.y - item.y) / d * step; } }
      const edge = this.terrainAt(item.x); item.y = clamp(item.y, edge.top + 18, edge.bottom - 18);
      if (Math.hypot(p.x - item.x, p.y - item.y) < 24) { this.collect(item); item.dead = true; }
    }
    this.pickups = this.pickups.filter(item => !item.dead && item.x > -35 && item.age < 18);
  }
  collect(item) {
    if (item.type === 'capsule') { this.meter = (this.meter + 1) % 6; this.score += 150; this.emit('capsule', { slot: this.meter }); }
    if (item.type === 'health') this.player.health = Math.min(this.player.maxHealth, this.player.health + 1);
    if (item.type === 'bomb') this.bombs = Math.min(5, this.bombs + 1);
    this.emit('pickup', { kind: item.type }); this.ring(item.x, item.y, '#f5d39f', 34, .3);
  }
  spark(x, y, color, count = 8) {
    for (let i = 0; i < count && this.particles.length < 450; i++) {
      const angle = this.fxRandom() * TAU, speed = 35 + this.fxRandom() * 200, life = .15 + this.fxRandom() * .42;
      this.particles.push({ x, y, px: x, py: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, color, size: .8 + this.fxRandom() * 2.4 });
    }
  }
  explode(x, y, color, large = false) { this.spark(x, y, color, large ? 40 : 15); this.ring(x, y, color, large ? 105 : 42, large ? .65 : .33); this.emit('explosion', { large }); }
  ring(x, y, color, size, life) { if (this.rings.length < 30) this.rings.push({ x, y, color, size, radius: 2, life, maxLife: life }); }
  label(x, y, text, color) { if (this.labels.length < 20) this.labels.push({ x, y, text, color, life: 1.2 }); }
  updateEffects(dt) {
    for (const p of this.particles) { p.px = p.x; p.py = p.y; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-dt * 1.8); p.vy *= Math.exp(-dt * 1.8); p.life -= dt; }
    for (const r of this.rings) { r.life -= dt; r.radius = r.size * (1 - (r.life / r.maxLife) ** 2); }
    for (const l of this.labels) { l.life -= dt; l.y -= dt * 23; }
    this.particles = this.particles.filter(p => p.life > 0); this.rings = this.rings.filter(r => r.life > 0); this.labels = this.labels.filter(l => l.life > 0);
  }
}
