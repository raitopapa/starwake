import test from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../src/input.js';

class Surface {
  listeners = new Map();
  addEventListener(name, handler) { const list=this.listeners.get(name)||[];list.push(handler);this.listeners.set(name,list); }
  emit(name,values={}) { const event={preventDefault(){},...values};for(const fn of this.listeners.get(name)||[])fn(event); }
  getBoundingClientRect() { return {left:10,top:20,width:240,height:360}; }
  setPointerCapture() {}
  focus() {}
}
test('relative pointer control, multi-touch ownership and cancellation',()=>{
  const canvas=new Surface();globalThis.window=new Surface();
  const input=new Input(canvas,{active:()=>true,action(){},position:()=>({x:240,y:550})});
  canvas.emit('pointerdown',{pointerId:1,clientX:50,clientY:80});assert.deepEqual(input.target,{x:240,y:550});
  canvas.emit('pointermove',{pointerId:1,clientX:70,clientY:90});assert.deepEqual(input.target,{x:280,y:570});
  canvas.emit('pointerdown',{pointerId:2,clientX:200,clientY:300});canvas.emit('pointermove',{pointerId:2,clientX:220,clientY:310});assert.deepEqual(input.target,{x:280,y:570});
  canvas.emit('pointerup',{pointerId:2});assert.equal(input.pointerId,1);
  canvas.emit('pointercancel',{pointerId:1});assert.equal(input.target,null);assert.equal(input.pointerId,null);
});
test('keyboard auto-repeat cannot spend multiple bombs and blur releases held movement',()=>{
  const canvas=new Surface();globalThis.window=new Surface();const actions=[];
  const input=new Input(canvas,{active:()=>true,action:a=>actions.push(a),position:()=>({x:240,y:550})});
  window.emit('keydown',{code:'Space',repeat:false});window.emit('keydown',{code:'Space',repeat:true});assert.deepEqual(actions,['bomb']);
  window.emit('keydown',{code:'KeyD'});window.emit('keydown',{code:'ShiftLeft'});assert.equal(input.read().x,1);assert.equal(input.read().focus,true);
  window.emit('blur');assert.equal(input.read().x,0);assert.equal(input.read().focus,false);
});
