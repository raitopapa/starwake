import { segmentHitsRect } from '../../shared/collision.js';
/** Pure, deterministic simulation. No DOM, audio, wall clock, or rendering dependencies. */
export const WIDTH = 480;
export const HEIGHT = 720;
export const WEAPONS = [
  { name: 'PULSE', color: '#73ece3', subtitle: '広範囲ショット' },
  { name: 'LANCE', color: '#c7f879', subtitle: '前方集中レーザー' },
  { name: 'SEEKER', color: '#d8a5ff', subtitle: '追尾ミサイル' },
  { name: 'WAVE', color: '#8ecfff', subtitle: '貫通波動砲' },
  { name: 'BURST', color: '#ffbd86', subtitle: '近距離散弾' },
];
export const STAGES = [
  { name: '蒼の軌道', english: 'ORBITAL FRONTIER', color: '#74e9e4', bg: '#071321', duration: 55, boss: 'AEGIS / 軌道防衛艦', hp: 700 },
  { name: '紅の星雲', english: 'CRIMSON NEBULA', color: '#ff9aac', bg: '#1a101e', duration: 62, boss: 'SERAPH / 深紅の翼', hp: 920 },
  { name: '深淵の中枢', english: 'THE SILENT CORE', color: '#c4f36b', bg: '#0b191c', duration: 68, boss: 'OBLIVION / 終焉の中枢', hp: 1200 },
];
export const DIFFICULTIES = {
  cadet: { health: 7, bombs: 4, bulletSpeed: .72, fireRate: 1.3, enemyHp: .78, score: .7 },
  pilot: { health: 5, bombs: 3, bulletSpeed: 1, fireRate: 1, enemyHp: 1, score: 1 },
  ace: { health: 3, bombs: 2, bulletSpeed: 1.22, fireRate: .78, enemyHp: 1.18, score: 1.5 },
};
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function seededRandom(seed = 1) {
  let s = seed >>> 0;
  return () => { s += 0x6D2B79F5; let n = Math.imul(s ^ s >>> 15, 1 | s); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
/** Swept circle collision prevents fast bullets tunneling through small hitboxes. */
export function segmentHitsCircle(x1, y1, x2, y2, cx, cy, radius) {
  const dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy;
  const t = len ? clamp(((cx - x1) * dx + (cy - y1) * dy) / len, 0, 1) : 0;
  return (x1 + t * dx - cx) ** 2 + (y1 + t * dy - cy) ** 2 <= radius ** 2;
}

export class Game {
  constructor({ difficulty = 'pilot', startStage = 0, seed = 42 } = {}) {
    this.difficulty = Object.hasOwn(DIFFICULTIES, difficulty) ? difficulty : 'pilot';
    this.config = DIFFICULTIES[this.difficulty];
    this.startStage = Number.isInteger(startStage) ? clamp(startStage, 0, 2) : 0;
    this.stage = this.startStage;
    this.random = seededRandom(seed);
    this.fxRandom = seededRandom(seed ^ 0xABCDEF);
    this.state = 'playing';
    this.time = 0;
    this.stageTime = 0;
    this.wave = 0;
    this.nextWave = 2.4;
    this.nextId = 0;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.multiplier = 1;
    this.energy = 0;
    this.bombs = this.config.bombs;
    this.bombTimer = 0;
    this.driveTimer = 0;
    this.transitionTimer = 0;
    this.shake = 0;
    this.flash = 0;
    this.player = { x: WIDTH / 2, y: HEIGHT - 142, px: WIDTH / 2, py: HEIGHT - 142, radius: 4, health: this.config.health, maxHealth: this.config.health, level: 1, weapon: 0, invincible: 3, fireTimer: 0, bank: 0, focus: false };
    this.enemies = [];
    this.bullets = [];
    this.shots = [];
    this.pickups = [];
    this.particles = [];
    this.rings = [];
    this.labels = [];
    this.lasers = [];
    this.events = [];
    this.boss = null;
    this.bossSpawned = false;
    this.banner = { title: STAGES[this.stage].name, sub: `SECTOR 0${this.stage + 1} / ${STAGES[this.stage].english}`, time: 3.1, warning: false };
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }
  drainEvents() { return this.events.splice(0); }
  pause() { if (this.state === 'playing') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'playing'; }
  switchWeapon() {
    if (this.state !== 'playing') return false;
    this.player.weapon = (this.player.weapon + 1) % WEAPONS.length;
    this.player.fireTimer = 0;
    this.emit('switch');
    return true;
  }
  activateDrive() {
    if (this.state !== 'playing' || this.transitionTimer > 0 || this.energy < 100 || this.driveTimer > 0) return false;
    this.energy = 0;
    this.driveTimer = 6;
    this.player.invincible = Math.max(this.player.invincible, 1.2);
    this.clearBullets();
    this.rings.push({ x: this.player.x, y: this.player.y, radius: 20, life: .75, maxLife: .75, color: '#c4f36b', speed: 500 });
    this.addLabel('OVERDRIVE', this.player.x, this.player.y - 45, '#c4f36b');
    this.emit('drive');
    return true;
  }
  useBomb() {
    if (this.state !== 'playing' || this.transitionTimer > 0 || this.bombs <= 0 || this.bombTimer > 0) return false;
    this.bombs--;
    this.bombTimer = 1.15;
    this.player.invincible = Math.max(this.player.invincible, 2);
    this.flash = .38;
    this.shake = 13;
    this.clearBullets();
    this.lasers.length = 0;
    for (const enemy of this.enemies) this.damageEnemy(enemy, 65);
    if (this.boss && this.boss.age > 2) this.damageBoss(130);
    this.rings.push({ x: this.player.x, y: this.player.y, radius: 10, life: 1.2, maxLife: 1.2, color: '#e9ffc3', speed: 900 });
    this.emit('bomb');
    return true;
  }

  update(dt, input = {}) {
    if (this.state !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, .05);
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 28);
    this.flash = Math.max(0, this.flash - dt);
    this.bombTimer = Math.max(0, this.bombTimer - dt);
    this.driveTimer = Math.max(0, this.driveTimer - dt);
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) { this.combo = 0; this.multiplier = 1; }
    this.banner.time = Math.max(0, this.banner.time - dt);
    this.updateEffects(dt);
    this.movePlayer(dt, input);
    if (this.transitionTimer > 0) {
      this.updatePickups(dt);
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) this.advanceStage();
      return;
    }
    this.stageTime += dt;
    this.player.fireTimer -= dt;
    if (this.player.fireTimer <= 0) this.shoot();
    if (this.stageTime < STAGES[this.stage].duration && this.stageTime >= this.nextWave) {
      this.spawnWave();
      this.nextWave += 3.5 - this.stage * .3;
    }
    if (!this.bossSpawned && this.stageTime >= STAGES[this.stage].duration) this.spawnBoss();
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateShots(dt);
    this.updateBullets(dt);
    if (this.state !== 'playing') return;
    this.updateLasers(dt);
    this.updatePickups(dt);
    this.enemies = this.enemies.filter(e => e.hp > 0 && e.y < HEIGHT + 90 && e.x > -140 && e.x < WIDTH + 140);
  }

  movePlayer(dt, input) {
    const p = this.player;
    p.px = p.x; p.py = p.y;
    p.invincible = Math.max(0, p.invincible - dt);
    p.focus = !!input.focus;
    const speed = input.focus ? 130 : 300;
    if (input.target && Number.isFinite(input.target.x) && Number.isFinite(input.target.y)) {
      const dx = input.target.x - p.x, dy = input.target.y - p.y;
      const distance = Math.hypot(dx, dy), step = Math.min(distance, (p.focus ? 230 : 1050) * dt);
      if (distance > 0) { p.x += dx / distance * step; p.y += dy / distance * step; }
    } else {
      let dx = input.x || 0, dy = input.y || 0;
      const length = Math.max(1, Math.hypot(dx, dy));
      p.x += dx / length * speed * dt; p.y += dy / length * speed * dt;
    }
    p.x = clamp(p.x, 20, WIDTH - 20);
    p.y = clamp(p.y, 104, HEIGHT - 103);
    p.bank += (clamp((p.x - p.px) / dt / 650, -.45, .45) - p.bank) * Math.min(1, dt * 12);
  }

  shoot() {
    const p = this.player, drive = this.driveTimer > 0;
    const power = drive ? 1.65 : 1;
    const add = (x, vx, vy, damage, r = 3, homing = false) => {
      if (this.shots.length >= 180) return;
      this.shots.push({ x, y: p.y - 20, px: x, py: p.y - 20, vx, vy, damage: damage * power, r, weapon: p.weapon, homing, age: 0, baseX: x, hits: new Set(), piercing: p.weapon === 1 || p.weapon === 3, lifetime: p.weapon === 4 ? .64 : 4 });
    };
    if (p.weapon === 0) {
      for (const side of [-1, 1]) add(p.x + side * 7, side * 12, -650, 1.8);
      if (p.level >= 2) for (const side of [-1, 1]) add(p.x + side * 16, side * 100, -615, 1.5);
      if (p.level >= 4) for (const side of [-1, 1]) add(p.x + side * 20, side * 185, -580, 1.4);
      p.fireTimer += (p.level >= 3 ? .12 : .145) * (drive ? .62 : 1);
    } else if (p.weapon === 1) {
      add(p.x, 0, -960, 3.3 + p.level * 1.25, 5 + p.level);
      if (p.level >= 3) for (const side of [-1, 1]) add(p.x + side * 15, 0, -880, 1.2, 2);
      p.fireTimer += .13 * (drive ? .65 : 1);
    } else if (p.weapon === 2) {
      for (const side of [-1, 1]) add(p.x + side * 13, side * 85, -430, 2.8 + p.level * 1.1, 4, true);
      if (p.level >= 4) add(p.x, 0, -470, 3, 4, true);
      p.fireTimer += .26 * (drive ? .62 : 1);
    }
    if(p.weapon===3){
      add(p.x,0,-570,4+p.level*1.4,7+p.level);p.fireTimer+=.22*(drive?.62:1);
    }else if(p.weapon===4){
      for(let i=-2;i<=2;i++){const a=i*.15;add(p.x,Math.sin(a)*660,-Math.cos(a)*660,2+p.level*.6,3.5);}
      p.fireTimer+=.25*(drive?.62:1);
    }
    this.emit('shot', { weapon: p.weapon });
  }

  spawnEnemy(type, x, y, variant = 0) {
    const defs = { scout: [6, 17, 120, 110], wing: [9, 20, 96, 160], turret: [25, 26, 40, 350], charger: [12, 18, 90, 200], carrier: [45, 33, 36, 650] };
    const [hp, r, speed, points] = defs[type];
    const enemy = { id: ++this.nextId, type, x, y, px: x, py: y, startX: x, r, hp: hp * this.config.enemyHp, maxHp: hp * this.config.enemyHp, speed, points, age: 0, fire: 1.25 + this.random() * 1.1, variant, flash: 0, chargeX: 0, chargeY: 0, charged: false };
    this.enemies.push(enemy);
    return enemy;
  }
  spawnWave() {
    const n = this.wave++, pattern = n % 6;
    if (pattern === 0) {
      for (let i = 0; i < 5; i++) this.spawnEnemy('scout', 70 + i * 85, -35 - Math.abs(i - 2) * 35, n);
    } else if (pattern === 1) {
      for (let i = 0; i < 5; i++) this.spawnEnemy('wing', n % 2 ? 100 : 380, -35 - i * 67, i % 2);
    } else if (pattern === 2) {
      this.spawnEnemy('turret', 100, -40); this.spawnEnemy('turret', 380, -100);
      for (let i = 0; i < 3; i++) this.spawnEnemy('scout', 180 + i * 65, -160 - i * 30);
    } else if (pattern === 3) {
      for (let i = 0; i < 4 + this.stage; i++) this.spawnEnemy('charger', 45 + i * (390 / (3 + this.stage)), -70 - (i % 2) * 55, i);
    } else if (pattern === 4) {
      this.spawnEnemy('carrier', 240, -60);
      this.spawnEnemy('wing', 70, -130, 0); this.spawnEnemy('wing', 410, -130, 1);
    } else {
      for (let i = 0; i < 6; i++) this.spawnEnemy(i % 3 ? 'scout' : 'wing', 55 + i * 74, -40 - i * 32, i);
    }
  }
  fireBullet(x, y, angle, speed, r = 4, color = '#ff859f') {
    if (this.bullets.length >= 650 || this.bombTimer > 0 || this.transitionTimer > 0) return;
    speed *= this.config.bulletSpeed;
    this.bullets.push({ x, y, px: x, py: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, color, grazed: false });
  }
  aimedShot(enemy, count = 1, spread = .18, speed = 155) {
    const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    for (let i = 0; i < count; i++) this.fireBullet(enemy.x, enemy.y + 10, angle + (i - (count - 1) / 2) * spread, speed);
  }

  updateEnemies(dt) {
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.px = e.x; e.py = e.y;
      e.age += dt; e.fire -= dt; e.flash = Math.max(0, e.flash - dt);
      if (e.type === 'wing') {
        e.y += e.speed * dt;
        e.x = e.startX + Math.sin(e.age * 1.8 + e.variant * Math.PI) * 62;
      } else if (e.type === 'charger') {
        if (e.age < 2.1) e.y += e.speed * dt;
        else {
          if (!e.charged) {
            const a = Math.atan2(this.player.y - e.y, this.player.x - e.x);
            e.chargeX = Math.cos(a) * 265; e.chargeY = Math.sin(a) * 265; e.charged = true;
          }
          e.x += e.chargeX * dt; e.y += e.chargeY * dt;
        }
      } else {
        e.y += e.speed * dt;
        if (e.type === 'scout') e.x = e.startX + Math.sin(e.age * 1.6 + e.variant) * 22;
        if (e.type === 'carrier') e.x = e.startX + Math.sin(e.age * .8) * 100;
      }
      if (e.fire <= 0 && e.y > 40 && e.y < HEIGHT - 150) {
        if (e.type === 'turret') this.aimedShot(e, 3 + this.stage * 2, .2, 155);
        else if (e.type === 'carrier') {
          for (let i = 0; i < 10; i++) this.fireBullet(e.x, e.y, i * Math.PI / 5 + e.age * .3, 120, 5, '#f5c37c');
        } else this.aimedShot(e, this.stage > 0 ? 2 : 1, .13, 150 + this.stage * 15);
        e.fire = (e.type === 'turret' ? 1.5 : e.type === 'carrier' ? 2 : 2.8) * this.config.fireRate;
      }
      if (segmentHitsCircle(e.px-this.player.px,e.py-this.player.py,e.x-this.player.x,e.y-this.player.y,0,0,e.r+9)) this.hitPlayer();
      if (this.state !== 'playing') return;
    }
  }

  spawnBoss() {
    this.bossSpawned = true;
    this.enemies.length = 0;
    this.clearBullets();
    this.boss = { x: WIDTH / 2, y: -120, px: WIDTH / 2, py: -120, r: 66, hp: STAGES[this.stage].hp * this.config.enemyHp, maxHp: STAGES[this.stage].hp * this.config.enemyHp, age: 0, fire: 1, special: 6, phase: 1, flash: 0, volley: 0 };
    this.banner = { title: STAGES[this.stage].boss, sub: 'WARNING / MASSIVE SIGNAL DETECTED', time: 3.2, warning: true };
    this.emit('warning');
  }
  updateBoss(dt) {
    const b = this.boss;
    if (!b || this.transitionTimer > 0) return;
    b.px=b.x;b.py=b.y;
    b.age += dt; b.flash = Math.max(0, b.flash - dt);
    b.y += (160 - b.y) * Math.min(1, dt * 1.7);
    if (b.age < 3) return;
    b.x = WIDTH / 2 + Math.sin((b.age - 3) * (this.stage === 1 ? .85 : .5)) * (this.stage === 1 ? 135 : 90);
    const newPhase = b.hp < b.maxHp * .33 ? 3 : b.hp < b.maxHp * .66 ? 2 : 1;
    if (newPhase > b.phase) {
      b.phase = newPhase;
      this.clearBullets();
      this.banner = { title: `PHASE ${b.phase}`, sub: 'ATTACK PATTERN SHIFT', time: 1.4, warning: true };
      b.fire = .7;
      this.emit('warning');
    }
    b.fire -= dt; b.special -= dt;
    if (b.fire <= 0) {
      b.volley++;
      if (this.stage === 0) {
        // Alternating aimed fans and a readable downward arc.
        if (b.volley % 3) {
          for (const side of [-1, 1]) this.aimedShot({ x: b.x + side * 47, y: b.y + 25 }, 3 + (b.phase - 1) * 2, .17, 160 + b.phase * 12);
        } else {
          for (let i = 0; i < 12 + b.phase * 2; i++) this.fireBullet(b.x, b.y + 40, .15 + i * (Math.PI - .3) / (11 + b.phase * 2), 145, 5, '#f4c978');
        }
        b.fire = (1.12 - b.phase * .13) * this.config.fireRate;
      } else if (this.stage === 1) {
        // Rotating rings with staggered gaps; each ring moves rather than trapping the player.
        const count = 16 + b.phase * 2;
        for (let i = 0; i < count; i++) {
          if (i % 7 === b.volley % 7) continue;
          this.fireBullet(b.x, b.y + 20, i * Math.PI * 2 / count + b.volley * .2, 120 + b.phase * 15, 4, '#ff9bc5');
        }
        if (b.volley % 2 === 0) this.aimedShot(b, 3, .2, 220);
        b.fire = (.95 - b.phase * .12) * this.config.fireRate;
      } else {
        // Opposing spiral arms plus a slower aimed fan.
        for (let i = 0; i < 8; i++) this.fireBullet(b.x, b.y + 20, i * Math.PI / 4 + b.volley * .25, 125 + b.phase * 14, 4, i % 2 ? '#ff96b6' : '#fbdc8a');
        if (b.volley % 4 === 0) this.aimedShot(b, 3 + b.phase, .15, 180);
        b.fire = (.42 - b.phase * .055) * this.config.fireRate;
      }
    }
    if (b.special <= 0) {
      if (this.stage > 0 || b.phase > 1) {
        // Snapshot the player's X for an honest, stationary 1.4-second telegraph.
        const x = clamp(this.player.x, 45, WIDTH - 45);
        this.lasers.push({ x, y: b.y + 30, width: 27 + this.stage * 5, age: 0, warning: 1.4, duration: 1.05 });
        if (this.stage === 2 && b.phase === 3) this.lasers.push({ x: clamp(WIDTH - x, 35, WIDTH - 35), y: b.y + 30, width: 24, age: 0, warning: 1.4, duration: 1.05 });
        this.emit('laserWarning');
      }
      b.special = Math.max(4, 7 - b.phase * .6) * this.config.fireRate;
    }
    if (Math.hypot(b.x - this.player.x, b.y - this.player.y) < b.r + 7) this.hitPlayer();
  }

  updateShots(dt) {
    for (const s of this.shots) {
      s.px = s.x; s.py = s.y; s.age += dt;
      if (s.homing) {
        let target = this.boss && this.boss.age > 2 ? this.boss : null, distance = Infinity;
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - s.x, e.y - s.y);
          if (e.hp > 0 && e.y > 0 && e.y < s.y + 30 && d < distance) { target = e; distance = d; }
        }
        if (target) {
          const a = Math.atan2(target.y - s.y, target.x - s.x);
          s.vx += (Math.cos(a) * 560 - s.vx) * dt * 5;
          s.vy += (Math.sin(a) * 560 - s.vy) * dt * 5;
        }
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if(s.weapon===3){s.x=s.baseX+Math.sin(s.age*18)*20;s.r=Math.min(18,8+s.age*11);}
      for (const e of this.enemies) {
        if (e.hp > 0 && !s.hits.has(e.id) && segmentHitsCircle(s.px-e.px,s.py-e.py,s.x-e.x,s.y-e.y,0,0,e.r+s.r)) { s.hits.add(e.id);this.damageEnemy(e,s.damage);if(!s.piercing){s.dead=true;break;} }
      }
      if (!s.dead && this.boss && this.boss.age > 2 && !s.hits.has('boss') && segmentHitsCircle(s.px-this.boss.px,s.py-this.boss.py,s.x-this.boss.x,s.y-this.boss.y,0,0,this.boss.r+s.r)) {
        s.hits.add('boss');this.damageBoss(s.damage);if(!s.piercing)s.dead=true;
      }
    }
    this.shots = this.shots.filter(s => !s.dead && s.y > -50 && s.y < HEIGHT + 40 && s.x > -60 && s.x < WIDTH + 60 && s.age < s.lifetime);
  }
  updateBullets(dt) {
    const p = this.player;
    for (const b of this.bullets) {
      b.px = b.x; b.py = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt;
      // Relative sweep also catches a fast touch movement across a stationary bullet.
      if (segmentHitsCircle(b.px - p.px, b.py - p.py, b.x - p.x, b.y - p.y, 0, 0, b.r + p.radius)) {
        if (p.invincible <= 0) { b.dead = true; this.hitPlayer(); }
      } else if (!b.grazed && p.invincible <= 0 && Math.hypot(b.x - p.x, b.y - p.y) < b.r + 23) {
        b.grazed = true;
        this.energy = Math.min(100, this.energy + 2);
        this.score += Math.round(8 * this.config.score);
        this.sparks(p.x, p.y, '#c4f36b', 2);this.emit('graze');
      }
      if (this.state !== 'playing') break;
    }
    this.bullets = this.bullets.filter(b => !b.dead && b.y > -90 && b.y < HEIGHT + 60 && b.x > -70 && b.x < WIDTH + 70);
  }
  updateLasers(dt) {
    for (const laser of this.lasers) {
      const wasWarning = laser.age < laser.warning;
      laser.age += dt;
      if (wasWarning && laser.age >= laser.warning) this.emit('laser');
      if (laser.age >= laser.warning && laser.age <= laser.warning + laser.duration && segmentHitsRect(this.player.px,this.player.py,this.player.x,this.player.y,laser.x-laser.width/2-this.player.radius,laser.y-this.player.radius,laser.x+laser.width/2+this.player.radius,HEIGHT+this.player.radius)) this.hitPlayer();
    }
    this.lasers = this.lasers.filter(l => l.age < l.warning + l.duration);
  }

  hitPlayer() {
    const p = this.player;
    if (this.state !== 'playing' || p.invincible > 0 || this.transitionTimer > 0) return false;
    p.health--;
    p.invincible = 2.2;
    this.combo = 0; this.multiplier = 1; this.comboTimer = 0;
    this.shake = 8; this.flash = .18;
    this.sparks(p.x, p.y, '#80fff1', 28);
    this.rings.push({ x: p.x, y: p.y, radius: 10, life: .55, maxLife: .55, speed: 180, color: '#8affe5' });
    this.emit('hit');
    if (p.health <= 0) { this.state = 'gameover'; this.explode(p.x, p.y, '#a9fff2', 50); this.emit('gameover'); }
    return true;
  }
  damageEnemy(enemy, damage) {
    if (enemy.hp <= 0) return;
    enemy.hp -= damage; enemy.flash = .07;
    this.sparks(enemy.x, enemy.y + 7, '#d0f6e5', 2);
    if (enemy.hp > 0) return;
    this.kills++; this.combo++; this.comboTimer = 4;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.multiplier = Math.min(8, 1 + Math.floor(this.combo / 6));
    const points = Math.round(enemy.points * this.multiplier * this.config.score);
    this.score += points;
    this.energy = Math.min(100, this.energy + (enemy.type === 'carrier' ? 12 : 3));
    this.explode(enemy.x, enemy.y, enemy.type === 'carrier' ? '#ffe3a0' : '#ffb0a4', enemy.r);
    this.addLabel(String(points), enemy.x, enemy.y, '#dbe8d9', .65);
    this.emit('explosion', { large: enemy.r > 24 });
    let type = 'score';
    if (this.kills % 6 === 0) type = 'power';
    else if (this.kills % 17 === 0) type = 'health';
    else if (this.kills % 23 === 0) type = 'bomb';
    this.pickups.push({ x: enemy.x, y: enemy.y, type, age: 0 });
    if (this.pickups.length > 45) this.pickups.shift();
  }
  damageBoss(damage) {
    const b = this.boss;
    if (!b || b.hp <= 0 || this.transitionTimer > 0) return;
    b.hp -= damage; b.flash = .05;
    if (b.hp > 0) return;
    this.kills++;
    this.score += Math.round((10000 + this.stage * 5000 + this.player.health * 750) * this.config.score);
    this.explode(b.x, b.y, '#ffe6ad', 80);
    this.shake = 18; this.flash = .45;
    this.boss = null;
    this.enemies.length = 0;
    this.shots.length = 0;
    this.clearBullets();
    this.lasers.length = 0;
    this.transitionTimer = 3.5;
    this.banner = { title: 'SECTOR CLEAR', sub: this.stage === 2 ? 'THE LAST SIGNAL HAS BEEN RECEIVED.' : 'HULL +1 / NOVA +1', time: 3.5, warning: false };
    this.emit('clear');
  }
  advanceStage() {
    if (this.stage === 2) { this.state = 'victory'; this.emit('victory'); return; }
    this.stage++; this.stageTime = 0; this.wave = 0; this.nextWave = 2.4;
    this.bossSpawned = false; this.boss = null;
    this.player.health = Math.min(this.player.maxHealth, this.player.health + 1);
    this.player.invincible = 3;
    this.bombs = Math.min(5, this.bombs + 1);
    this.pickups.length = 0; this.bullets.length = 0; this.lasers.length = 0;
    this.banner = { title: STAGES[this.stage].name, sub: `SECTOR 0${this.stage + 1} / ${STAGES[this.stage].english}`, time: 3, warning: false };
    this.emit('stage', { stage: this.stage });
  }
  updatePickups(dt) {
    for (const item of this.pickups) {
      item.age += dt;
      const dx = this.player.x - item.x, dy = this.player.y - item.y, distance = Math.hypot(dx, dy);
      const magnet = distance < 105 || this.driveTimer > 0 || this.transitionTimer > 0;
      if (magnet && distance > 0) { item.x += dx / distance * Math.min(distance, 340 * dt); item.y += dy / distance * Math.min(distance, 340 * dt); }
      else item.y += 62 * dt;
      if (distance < 25) { this.collect(item); item.dead = true; }
    }
    this.pickups = this.pickups.filter(p => !p.dead && p.y < HEIGHT + 30 && p.age < 14);
  }
  collect(item) {
    const p = this.player;
    if (item.type === 'power') {
      p.level = Math.min(4, p.level + 1);
      this.addLabel(`POWER LV.${p.level}`, p.x, p.y - 32, '#c4f36b');
      this.score += Math.round(150 * this.config.score);
    } else if (item.type === 'health') {
      p.health = Math.min(p.maxHealth, p.health + 1);
      this.addLabel('HULL +1', p.x, p.y - 32, '#80ffd1');
    } else if (item.type === 'bomb') {
      this.bombs = Math.min(5, this.bombs + 1);
      this.addLabel('NOVA +1', p.x, p.y - 32, '#ffe1a1');
    } else {
      this.score += Math.round(50 * this.multiplier * this.config.score);
      this.energy = Math.min(100, this.energy + 1.5);
    }
    this.emit('pickup', { kind: item.type });
  }
  clearBullets() {
    for (let i = 0; i < this.bullets.length; i += 4) this.sparks(this.bullets[i].x, this.bullets[i].y, '#d1eebe', 1);
    this.bullets.length = 0;
  }
  addLabel(text, x, y, color, duration = 1.1) {
    this.labels.push({ text, x, y, color, life: duration, maxLife: duration });
    if (this.labels.length > 25) this.labels.shift();
  }
  sparks(x, y, color, count) {
    for (let i = 0; i < count && this.particles.length < 340; i++) {
      const a = this.fxRandom() * Math.PI * 2, speed = 25 + this.fxRandom() * 150, life = .15 + this.fxRandom() * .5;
      this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life, maxLife: life, color, size: 1 + this.fxRandom() * 2 });
    }
  }
  explode(x, y, color, size) {
    this.sparks(x, y, color, Math.min(65, Math.round(size)));
    this.rings.push({ x, y, radius: 2, life: .4, maxLife: .4, speed: size * 5, color });
    if (this.rings.length > 25) this.rings.shift();
    this.shake = Math.max(this.shake, size > 30 ? 5 : 1.7);
  }
  updateEffects(dt) {
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 2; p.vy *= 1 - dt * 2; p.life -= dt; }
    for (const r of this.rings) { r.radius += r.speed * dt; r.life -= dt; }
    for (const l of this.labels) { l.y -= dt * 26; l.life -= dt; }
    this.particles = this.particles.filter(p => p.life > 0);
    this.rings = this.rings.filter(r => r.life > 0);
    this.labels = this.labels.filter(l => l.life > 0);
  }
}
