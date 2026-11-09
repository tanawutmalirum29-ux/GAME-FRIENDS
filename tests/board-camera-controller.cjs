'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','src/board-party/runtime/board-controller-camera.js'),'utf8');
const window={};let now=1000;
vm.runInNewContext(source,{window,Date:{now:()=>now}});
const handlers={};
const classes=new Set();
const zone={
 classList:{toggle:(k,v)=>{if(v)classes.add(k);else classes.delete(k);}},
 setAttribute(name,value){this[name]=value;},
 getBoundingClientRect(){return {left:0,top:0,width:360,height:240};},
 addEventListener(name,fn,capture){assert.equal(capture,true);(handlers[name]??=[]).push(fn);},
 setPointerCapture(){}
};
let permitted=true,rotated=false,resets=0;
const modes=[],gestures=[];
const c=window.BoardControllerCamera.attach(zone,{
 allowed:()=>permitted,
 releaseStick:()=>resets++,
 isRotated:()=>rotated,
 onMode:(enabled)=>modes.push(enabled),
 onGesture:g=>gestures.push(g)
});
function event(type,id,x,y){
 const e={type,pointerId:id,clientX:x,clientY:y,preventDefault(){this.prevented=true;},
   stopImmediatePropagation(){this.stopped=true;}};
 for(const cb of handlers[type]||[])cb(e);
 return e;
}
function tap(id=1,x=40,y=60){
 event('pointerdown',id,x,y);now+=50;event('pointerup',id,x,y);now+=80;
}
assert.equal(c.enabled(),false);
tap();assert.equal(c.enabled(),false,'first tap remains ordinary walking');
tap();assert.equal(c.enabled(),true,'second tap on the walk area enters camera mode');
assert.ok(classes.has('board-camera-mode'));
assert.deepEqual(modes,[true]);
assert.equal(resets,1,'enabling camera must immediately zero the floating stick');
let e=event('pointerdown',1,45,60);
assert.equal(e.stopped,true,'camera finger cannot reach walking stick listeners');
e=event('pointermove',1,100,60);
assert.equal(e.stopped,true);
assert.equal(gestures.at(-1).kind,'pan');
assert.ok(gestures.at(-1).dx>140&&gestures.at(-1).dy===0);
event('pointerup',1,100,60);
const n=gestures.length;
event('pointerdown',1,55,50);
event('pointerdown',2,155,50);
event('pointermove',2,195,50);
assert.ok(gestures.length>n);
assert.equal(gestures.at(-1).kind,'pinch');
assert.ok(gestures.at(-1).scale>1,'outward pinch zooms in');
event('pointerup',2,195,50);event('pointerup',1,55,50);
assert.equal(c.enabled(),true,'a multi-finger gesture cannot count as a double tap');
tap(3,45,60);tap(4,45,60);
assert.equal(c.enabled(),false,'double-tap again resumes walking');
assert.deepEqual(modes,[true,false]);
assert.equal(resets,2,'leaving camera clears stale input a second time');
assert.equal(classes.has('board-camera-mode'),false);
permitted=false;tap();tap();
assert.equal(c.enabled(),false,'spectator cannot start camera inspection');
permitted=true;tap();tap();assert.equal(c.enabled(),true);
permitted=false;c.reset();assert.equal(c.enabled(),false,'permission revocation resets gesture state');
assert.equal(c.reset(),false,'repeated reset has no side effects');
console.log('BOARD CAMERA GESTURES PASS: double-tap toggles, drag, pinch, movement isolation, spectators and revocation');
