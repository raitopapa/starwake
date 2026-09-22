import { WIDTH, HEIGHT, clamp } from './engine.js';
export class Input {
  constructor(canvas, { active, action, position }) {
    this.canvas = canvas; this.active = active; this.action = action; this.position = position;
    this.keys = new Set(); this.target = null; this.pointerId = null; this.lastPointer = null; this.focusHeld = false;
    window.addEventListener('keydown', event => {
      if (!this.active()) return;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Space','KeyX','KeyC','KeyZ','KeyP','Escape'].includes(event.code)) {
        event.preventDefault(); this.keys.add(event.code);
        const actions = { Space: 'bomb', KeyX: 'weapon', KeyC: 'drive', KeyZ: 'equip', KeyP: 'pause', Escape: 'pause' };
        if (!event.repeat && actions[event.code]) this.action(actions[event.code]);
      }
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.reset()); this.attachSurface(canvas);
  }
  attachSurface(surface) {
    surface.addEventListener('pointerdown', event => {
      if (!this.active() || this.pointerId !== null) return;
      event.preventDefault(); this.pointerId = event.pointerId; this.pointerSurface = surface;
      this.lastPointer = this.point(event); this.target = { ...this.position() };
      surface.setPointerCapture(event.pointerId); this.canvas.focus({ preventScroll: true });
    });
    surface.addEventListener('pointermove', event => {
      if (event.pointerId !== this.pointerId || !this.active()) return;
      event.preventDefault(); const point = this.point(event);
      this.target.x = clamp(this.target.x + point.x - this.lastPointer.x, 28, WIDTH - 38);
      this.target.y = clamp(this.target.y + point.y - this.lastPointer.y, 28, HEIGHT - 28); this.lastPointer = point;
    });
    const release = event => { if (event.pointerId === this.pointerId) { this.pointerId = null; this.target = null; this.lastPointer = null; } };
    for (const type of ['pointerup','pointercancel','lostpointercapture']) surface.addEventListener(type, release);
    surface.addEventListener('contextmenu', event => event.preventDefault());
  }
  point(event) { const rect = this.pointerSurface.getBoundingClientRect(), scale = WIDTH / rect.width; return { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale }; }
  reset() { this.keys.clear(); this.pointerId = null; this.target = null; this.lastPointer = null; this.focusHeld = false; }
  read() { return { x: Number(this.keys.has('ArrowRight') || this.keys.has('KeyD')) - Number(this.keys.has('ArrowLeft') || this.keys.has('KeyA')), y: Number(this.keys.has('ArrowDown') || this.keys.has('KeyS')) - Number(this.keys.has('ArrowUp') || this.keys.has('KeyW')), focus: this.focusHeld || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'), target: this.target }; }
}
