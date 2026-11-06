'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const scope=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync('combat-motion.js','utf8'),scope,{filename:'combat-motion.js'});
vm.runInContext(fs.readFileSync('character-system.js','utf8'),scope,{filename:'character-system.js'});
const Combat=scope.window.PartyCombatMotion,Characters=scope.window.PartyCharacters;
assert.equal(Combat.NORMAL_STUN,.8,'all normal punches stun for exactly 0.8 seconds');
assert.equal(typeof Characters.startPunch,'function');
assert.equal(typeof Characters.stepPunch,'function');
assert.equal(typeof Characters.punchFriends,'function');
assert.equal(typeof Characters.draw,'function');
const player=(id,x,y,color='#33dd99')=>({
 id,name:id,active:true,x,y,color,dir:{x:1,y:0},
 vx:0,vy:0,stun:0,punchCooldown:0
});
{
 const attacker=player('a',100,120,'#bb55ff');
 const victim=player('b',142,120,'#4499ff');
 const behind=player('c',68,120);
 assert.equal(Characters.startPunch(attacker),true);
 assert.equal(Characters.startPunch(attacker),false,'same press cannot launch second punch');
 assert.equal(Characters.stepPunch(attacker,.12,()=>Characters.punchFriends(attacker,[victim,behind],
  {range:53,coneCos:.45}).length),true);
 assert.equal(victim.stun,0,'punch has visible windup before impact');
 let touched=0;
 Characters.stepPunch(attacker,.08,()=>{
  touched+=Characters.punchFriends(attacker,[victim,behind],{range:53,coneCos:.45}).length;
 });
 assert.equal(touched,1);
 assert.equal(victim.stun,.8,'victim is stunned for exactly 0.8 seconds');
 assert.equal(victim.stunColor,attacker.color,'hitter owns the stars / glow color');
 assert.equal(behind.stun,0,'back-facing victim not punched');
 Characters.stepPunch(attacker,.9,()=>{throw Error('impact repeated')});
 assert.equal(attacker.attackRemaining,0);
}
for(const variant of ['ghost','fruit','color','chickens']){
 const attacker=player('attacker',150,150,'#ef467c');
 const victim=player(variant,192,150,'#06aadd');
 if(variant==='fruit'){victim.fruitStun=0;victim.fruitAttack={elapsed:0};}
 if(variant==='color'){victim.cs={stunRemaining:0,stunImmunity:0,punchState:{timer:.1}};}
 const hits=Characters.punchFriends(attacker,[victim],{range:57,coneCos:.35});
 assert.equal(hits.length,1,variant+' reuses shared character punch');
 assert.equal(victim.stun,.8);
 assert.equal(victim.stunColor,attacker.color);
 if(variant==='fruit'){
  assert.equal(victim.fruitStun,.8);
  assert.equal(victim.fruitAttack,null,'stun interrupts fruit punch windup');
 }
 if(variant==='color'){
  assert.equal(victim.cs.stunRemaining,.8);
  assert.equal(victim.cs.punchState,null,'stun interrupts color switch punch');
 }
}
{
 const attacker=player('red',150,150,'#ff3344');
 const blocked=player('immune',185,150);
 const victim=player('target',192,150);
 const hits=Characters.punchFriends(attacker,[blocked,victim],{
  range:57,maxHits:1,canHit:p=>p.id!=='immune'
 });
 assert.equal(hits.length,1,'filter and nearest-target policy are shared options');
 assert.equal(hits[0].id,'target');
 assert.equal(blocked.stun,0);
 const immune=Characters.punchFriends(attacker,[blocked],{canHit:()=>false});
 assert.equal(immune.length,0);
}
{
 const attacker=player('hit',100,100,'#ff8844');
 const victim=player('down',140,100);
 const events=[],painted=[];
 const ctx={
  save(){events.push('save')},restore(){events.push('restore')},
  beginPath(){},closePath(){},moveTo(){},lineTo(){},stroke(){events.push('stroke')},
  fill(){painted.push(this.fillStyle);events.push('fill')},
  arc(){},ellipse(){events.push('halo')},
  shadowBlur:0,shadowColor:null,fillStyle:null,strokeStyle:null,lineWidth:0,globalAlpha:1
 };
 assert.equal(Combat.drawStun(ctx,victim,1.2),undefined);
 assert.equal(painted.length,0,'no effect without stun');
 Combat.applyNormalPunch(victim,attacker);
 Combat.drawStun(ctx,victim,1.2);
 assert.ok(events.includes('halo'),'colored shimmer/halo sits above the head');
 assert.ok(painted.length>=3,'three orbiting stars are drawn');
 assert.ok(painted.every(c=>c===attacker.color),'every star and sparkle matches attacker color');
 assert.equal(ctx.shadowColor,attacker.color);
 painted.length=0;
 Characters.draw(ctx,victim,{time:2,local:true});
 assert.ok(painted.includes(attacker.color),'VFX stays attached to shared character draw');
 assert.equal(Combat.stunTime(victim),.8);
}
console.log('Shared character normal punches: 0.8s stun, color VFX, target policies, four games: OK');
