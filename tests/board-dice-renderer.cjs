'use strict';
// Deterministic projected 3D dice: every physical face, animation and host roll.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({window:{},console});
for(const name of ['board-map','board-dice','board-dice-renderer','board-items','board-minigame','board-party']){
 vm.runInContext(fs.readFileSync(name+'.js','utf8'),ctx,{filename:name+'.js'});
}
const {BoardDiceRenderer:R,BoardDice:D,BoardParty:P}=ctx.window;
assert.equal(R.DURATION,D.TIMING.throw);
assert.equal(R.HOLD,D.TIMING.hold);
const plain=a=>JSON.parse(JSON.stringify(a));
assert.equal(R.FACES.length,6);
const values=R.FACES.map(f=>f.value);
assert.deepEqual([...values].sort(),[1,2,3,4,5,6]);
for(const [a,b] of [[1,6],[2,5],[3,4]]){
 const x=R.FACES.find(f=>f.value===a).n,y=R.FACES.find(f=>f.value===b).n;
 assert.equal(x.reduce((v,z,i)=>v+z*y[i],0),-1,'opposite physical faces must match standard dice');
}
for(let face=1;face<=6;face++){
 assert.equal(R.PIPS[face].length,face);
 for(const index of [0,1]){
  assert.equal(R.frontFace(face,Infinity,index),face,'front-facing polygon must match host roll '+face);
  assert.equal(R.frontFace(face,R.DURATION,index),face,'no visual correction after animation');
  assert.equal(R.pose(face,R.DURATION,index).settled,true);
  assert.equal(R.pose(face,R.DURATION,index).height,0);
  assert.equal(R.pose(face,R.DURATION,index).angularVelocity,0);
 }
}
assert.ok(R.pose(3,.59,0).height>50,'first arc has measurable upward travel');
assert.ok(R.pose(3,1.32,0).height>0,'first bounce must lift off ground');
assert.ok(R.pose(3,1.58,1).height>0,'second bounce must lift off ground');
assert.equal(R.pose(3,1.76,0).animationState,'settled');
assert.notEqual(R.pose(3,.49,0).rotationX,R.pose(3,.49,1).rotationX);
assert.notEqual(R.pose(3,.49,0).rotationY,R.pose(3,.49,1).rotationY);
assert.ok(R.pose(3,R.DURATION+.1,0).glint>0,'gold appears on the final face');
assert.deepEqual(plain(R.pose(6,.5,0)),plain(R.pose(6,.5,0)),
 'rejoining the same state/time replays exactly the same frame');
let polys=0,arcs=0,gradients=0;
const g=new Proxy({},{get(o,k){
 if(k==='createLinearGradient')return()=>{gradients++;return{addColorStop(){}};};
 if(k==='beginPath')return()=>{polys++;};
 if(k==='ellipse')return()=>{arcs++;};
 if(k==='fillText')return()=>{};
 return ()=>{};
},set(o,k,v){o[k]=v;return true;}});
for(let face=1;face<=6;face++)for(const reduced of [true,false]){
 R.draw(g,face,100,100,70,.8,0,reduced);
 R.draw(g,face,200,100,70,R.DURATION+.12,1,reduced);
}
assert.ok(polys>250&&arcs>0&&gradients>0,'3D vector faces, pips, gradients and shadows render');
for(let n=1;n<=12;n++){
 const roster=Array.from({length:n},(_,i)=>({id:'p'+i,name:'Player '+i,color:'#ac8'}));
 const s=P.create(roster,{seed:n,rng:()=>.53});
 P.startOrder(s);for(let i=0;i<30;i++)P.update(s,.05);
 assert.equal(s.phase,'order');
 for(const p of s.players)assert.equal(P.action(s,p.id,'A'),true);
 const committed=s.players.map(p=>plain(p.dice));
 for(let i=0;i<32;i++)P.update(s,.05); // 1.60s, still flying
 assert.equal(s.phase,'order','order cannot resolve before dice settle');
 s.players.forEach((p,i)=>assert.deepEqual(plain(p.dice),committed[i]));
 for(let i=0;i<10;i++)P.update(s,.05);
 assert.equal(s.phase,'order_result','order advances only after settled results');
}
{
 const s=P.create([{id:'p1',name:'P1',color:'#fff'}],{seed:1,rng:()=>0});
 s.order=['p1'];P.startTurn(s);
 assert.equal(P.roll(s),true);assert.deepEqual(plain(s.moveDice),[1,1]);
 assert.equal(P.remainingSteps(s,'p1'),0);
 for(let i=0;i<20;i++)P.update(s,.05);
 assert.equal(P.remainingSteps(s,'p1'),0);
 for(let i=0;i<16;i++)P.update(s,.05);
 assert.equal(P.remainingSteps(s,'p1'),2);
 assert.equal(s.phase,'dice','the result hold still blocks movement');
 for(let i=0;i<8;i++)P.update(s,.05);
 assert.notEqual(s.phase,'dice');
 assert.equal(s.die,2,'walk reads the same host result');
}
console.log('BOARD 3D DICE PASS: 6 faces, 36 combinations, 2 bounces, 1–12 player order and movement gate');
