import { WIDTH, HEIGHT, clamp } from './engine.js';

export class Input {
  constructor(canvas, { active, action, position }) {
    this.canvas=canvas;this.active=active;this.action=action;this.position=position;
    this.focusHeld=false;this.keys=new Set();this.target=null;this.pointerId=null;this.lastPointer=null;
    window.addEventListener('keydown',event=>{
      if(event.code==='Escape'&&this.active()){event.preventDefault();if(!event.repeat)this.action('pause');return;}
      if(!this.active())return;
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Space','KeyX','KeyC','KeyP'].includes(event.code)){
        event.preventDefault();this.keys.add(event.code);
        if(!event.repeat){if(event.code==='Space')this.action('bomb');if(event.code==='KeyX')this.action('weapon');if(event.code==='KeyC')this.action('drive');if(event.code==='KeyP')this.action('pause');}
      }
    });
    window.addEventListener('keyup',event=>this.keys.delete(event.code));
    window.addEventListener('blur',()=>this.reset());
    canvas.addEventListener('pointerdown',event=>{
      if(!this.active()||this.pointerId!==null)return;
      event.preventDefault();this.pointerId=event.pointerId;this.lastPointer=this.point(event);this.target={...this.position()};
      canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});
    });
    canvas.addEventListener('pointermove',event=>{
      if(event.pointerId!==this.pointerId||!this.active())return;
      event.preventDefault();const p=this.point(event);
      this.target.x=clamp(this.target.x+p.x-this.lastPointer.x,20,WIDTH-20);
      this.target.y=clamp(this.target.y+p.y-this.lastPointer.y,104,HEIGHT-103);
      this.lastPointer=p;
    });
    const release=event=>{if(event.pointerId===this.pointerId){this.pointerId=null;this.target=null;this.lastPointer=null;}};
    canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
    canvas.addEventListener('contextmenu',event=>event.preventDefault());
  }
  point(event){const rect=this.canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)/rect.width*WIDTH,y:(event.clientY-rect.top)/rect.height*HEIGHT};}
  reset(){this.focusHeld=false;this.keys.clear();this.pointerId=null;this.target=null;this.lastPointer=null;}
  read(){return{x:Number(this.keys.has('ArrowRight')||this.keys.has('KeyD'))-Number(this.keys.has('ArrowLeft')||this.keys.has('KeyA')),y:Number(this.keys.has('ArrowDown')||this.keys.has('KeyS'))-Number(this.keys.has('ArrowUp')||this.keys.has('KeyW')),focus:this.focusHeld||this.keys.has('ShiftLeft')||this.keys.has('ShiftRight'),target:this.target};}
}
