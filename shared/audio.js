/** Original, layered chip/synth scores. All notes and percussion are synthesized. */
export class AudioEngine {
  constructor({ variant = 'horizontal' } = {}) {
    this.variant = variant; this.ctx = null; this.enabled = true; this.playing = false; this.timer = null;
    this.step = 0; this.stage = 0; this.boss = false; this.nextBeat = 0; this.lastShot = -1; this.lastGraze = -1; this.generation = 0;
    this.musicVolume = .65; this.sfxVolume = .8; this.voices = new Set();
  }
  async unlock() {
    try {
      const Context = window.AudioContext || window.webkitAudioContext; if (!Context) return false;
      if (!this.ctx) {
        this.ctx = new Context(); this.master = this.ctx.createGain(); this.master.gain.value = this.enabled ? .48 : 0;
        this.music = this.ctx.createGain(); this.sfx = this.ctx.createGain();
        this.music.gain.value = this.musicVolume; this.sfx.gain.value = this.sfxVolume;
        this.compressor = this.ctx.createDynamicsCompressor(); this.compressor.threshold.value = -14; this.compressor.ratio.value = 5;
        this.music.connect(this.compressor); this.sfx.connect(this.compressor); this.compressor.connect(this.master); this.master.connect(this.ctx.destination);
        this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state !== 'running') await this.ctx.resume();
      return this.ctx.state === 'running';
    } catch { return false; }
  }
  setEnabled(value) { this.enabled = value; if (this.master) this.master.gain.setTargetAtTime(value ? .48 : 0, this.ctx.currentTime, .03); }
  setVolumes(music, sfx) {
    this.musicVolume = Math.max(0, Math.min(1, Number(music) || 0)); this.sfxVolume = Math.max(0, Math.min(1, Number(sfx) || 0));
    if (this.ctx) { this.music.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, .03); this.sfx.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, .03); }
  }
  tone(freq, duration, type = 'sine', volume = .1, when = null, endFreq = null, bus = 'sfx') {
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running' || this.voices.size >= 100) return;
    const t = when ?? this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(12, endFreq), t + duration);
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(volume, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + duration);
    o.connect(g); g.connect(this[bus]); this.voices.add(o); o.start(t); o.stop(t + duration + .015);
    o.onended = () => { this.voices.delete(o); o.disconnect(); g.disconnect(); };
  }
  noise(duration, volume = .12, frequency = 1500, when = null, bus = 'sfx', highpass = false) {
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running' || this.voices.size >= 100) return;
    const t = when ?? this.ctx.currentTime, source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
    source.buffer = this.noiseBuffer; source.loop = true; filter.type = highpass ? 'highpass' : 'lowpass'; filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this[bus]); this.voices.add(source); source.start(t); source.stop(t + duration);
    source.onended = () => { this.voices.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  start(stage = 0, reset = true) {
    this.generation++; this.stage = Math.max(0, Math.min(2, stage)); if (reset) { this.step = 0; this.boss = false; }
    this.playing = true; this.nextBeat = (this.ctx?.currentTime || 0) + .04; this.stopTimer(); this.timer = setInterval(() => this.schedule(), 25);
  }
  stopTimer() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  clearVoices() { for (const voice of this.voices) { try { voice.stop(); } catch {} } this.voices.clear(); }
  pause() { this.generation++; this.playing = false; this.stopTimer(); this.clearVoices(); if (this.ctx?.state === 'running') this.ctx.suspend().catch(() => {}); }
  async resume() { const generation = ++this.generation; await this.unlock(); if (generation === this.generation) this.start(this.stage, false); }
  stop() { this.generation++; this.playing = false; this.stopTimer(); this.clearVoices(); }
  schedule() {
    if (!this.ctx || !this.playing || this.ctx.state !== 'running') return;
    const bpm = (this.variant === 'vertical' ? [146, 154, 164] : [132, 144, 152])[this.stage] + (this.boss ? 18 : 0), interval = 60 / bpm / 4;
    if (this.nextBeat < this.ctx.currentTime - .25) this.nextBeat = this.ctx.currentTime + .02;
    let guard = 0; while (this.nextBeat < this.ctx.currentTime + .12 && guard++ < 6) { this.musicStep(this.step++, this.nextBeat, interval); this.nextBeat += interval; }
  }
  musicStep(step, t, tick) {
    const hz = n => 440 * 2 ** ((n - 69) / 12), bar = Math.floor(step / 16), beat = step % 16;
    const progressions = this.variant === 'vertical' ? [[40, 36, 43, 38], [37, 33, 40, 35], [38, 34, 41, 36]] : [[38, 34, 41, 36], [36, 32, 39, 34], [33, 29, 36, 31]];
    const root = progressions[this.stage][Math.floor(bar / 2) % 4], bass = this.boss ? [0, 0, 12, 7, 0, 12, 3, 7] : [0, 0, 7, 12, 0, 7, 10, 7];
    if (beat % 2 === 0) this.tone(hz(root + bass[beat / 2]), tick * 1.6, 'triangle', .22, t, null, 'music');
    if (beat % 4 === 0) this.tone(145, .14, 'sine', .48, t, 38, 'music');
    if (beat === 4 || beat === 12) { this.noise(.12, .12, 2200, t, 'music'); this.tone(185, .09, 'triangle', .12, t, 100, 'music'); }
    if (beat % 2 === 0 || this.boss) this.noise(beat === 14 ? .085 : .027, beat % 4 ? .025 : .035, 6800, t, 'music', true);
    if (bar % 4 === 3 && beat > 12) this.noise(.07, .055, 3000, t, 'music');
    const melodies = this.variant === 'vertical' ? [
      [12, 19, 22, 19, 24, 22, 19, 15, 17, 19, 22, 24, 26, 24, 22, 19],
      [15, 19, 22, 24, 22, 19, 17, 14, 15, 17, 19, 22, 26, 24, 22, 19],
      [12, 15, 19, 24, 22, 19, 15, 19, 14, 17, 22, 26, 24, 22, 19, 17],
    ] : [
      [19, 19, 22, 24, 22, 19, 17, 15, 17, 19, 22, 19, 15, 14, 12, 14],
      [12, 15, 19, 22, 24, 22, 19, 17, 15, 17, 19, 24, 22, 19, 17, 14],
      [19, 22, 24, 26, 24, 19, 22, 17, 19, 15, 17, 14, 15, 19, 17, 12],
    ];
    if (beat % 2 === 0 && (bar % 8 > 0 || this.boss)) {
      const note = this.boss ? [12, 15, 19, 18, 12, 22, 19, 15][beat / 2] : melodies[this.stage][(Math.floor(step / 2) + (bar % 4 >= 2 ? 4 : 0)) % 16];
      const f = hz(root + note); this.tone(f, tick * 2.3, 'square', .045, t, null, 'music');
      this.tone(f * 1.003, tick * 2.7, 'triangle', .058, t + .009, null, 'music');
      this.tone(f, tick * 1.5, 'triangle', .018, t + tick * 3, null, 'music');
    }
    if (beat % 2 === 1) this.tone(hz(root + 24 + [0, 7, 3, 10][Math.floor(beat / 2) % 4]), tick * .9, 'triangle', .04, t, null, 'music');
    if (beat === 0) for (const note of [0, 3, 7]) this.tone(hz(root + 12 + note), tick * 14, 'sine', .037, t, null, 'music');
  }
  effect(event) {
    if (event.type === 'warning') this.boss = true;
    if (event.type === 'clear') this.boss = false;
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    switch (event.type) {
      case 'shot': if (t - this.lastShot > .09) { this.tone(event.weapon === 2 ? 980 : 1450, .048, 'triangle', .045, null, event.weapon === 4 ? 360 : 540); this.lastShot = t; } break;
      case 'explosion': this.noise(event.large ? .35 : .13, event.large ? .25 : .09, 1400); this.tone(event.large ? 95 : 170, .15, 'sine', .1, null, 40); break;
      case 'hit': this.noise(.28, .23, 2200); this.tone(180, .3, 'sawtooth', .075, null, 42); break;
      case 'shield': this.tone(760, .2, 'sine', .14, null, 120); break;
      case 'bomb': this.noise(.95, .4, 900); this.tone(160, .8, 'sine', .3, null, 26); break;
      case 'drive': for (let i = 0; i < 6; i++) this.tone(220 * 2 ** (i / 3), .3, 'triangle', .12, t + i * .06); break;
      case 'graze': if (t - this.lastGraze > .12) { this.tone(2200, .035, 'sine', .04); this.lastGraze = t; } break;
      case 'pickup': if (event.kind !== 'score') { this.tone(880, .1, 'sine', .12); this.tone(1320, .15, 'sine', .1, t + .07); } break;
      case 'equip': for (let i = 0; i < 3; i++) this.tone([660, 880, 1320][i], .22, 'triangle', .12, t + i * .08); break;
      case 'switch': this.tone(600, .08, 'sine', .08, null, 1150); break;
      case 'phase': case 'warning': case 'laserWarning': this.tone(330, .17, 'square', .055); this.tone(440, .17, 'square', .055, t + .23); break;
      case 'laser': this.noise(.33, .12, 4600); this.tone(230, .35, 'sawtooth', .06, null, 100); break;
      case 'clear': case 'victory': for (let i = 0; i < 5; i++) this.tone([440, 554, 659, 880, 1108][i], .5, 'triangle', .13, t + i * .14); break;
      case 'gameover': for (let i = 0; i < 4; i++) this.tone(330 * 2 ** (-i / 4), .4, 'triangle', .1, t + i * .17); break;
    }
  }
}
