'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
class FakeSvgImage {
 constructor(){this.complete=true;this.naturalWidth=64;}
 set src(src){this._src=src;}
 get src(){return this._src;}
}
const context=vm.createContext({window:{},Image:FakeSvgImage});
const avatarSource=fs.readFileSync('player-avatar.js','utf8');
const artSource=fs.readFileSync('src/shared/graveyard-art.js','utf8');
vm.runInContext(avatarSource,context,{filename:'player-avatar.js'});
vm.runInContext(artSource,context,{filename:'src/shared/graveyard-art.js'});
const Avatar=context.window.PartyPlayerAvatar,Art=context.window.GhostCemeteryArt;
const p={id:'one',name:'Tester',color:'#ff628c',x:420,y:285,
 dir:{x:0,y:-1},vx:0,vy:0};
function probe(){
 const calls=[];
 const ctx=new Proxy({},{
   get(_target,key){
     if(key==='globalAlpha')return 1;
     if(key==='createRadialGradient'||key==='createLinearGradient')return (...args)=>{calls.push([key,...args]);return{addColorStop(){}};};
     return (...values)=>{calls.push([key,...values]);};
   },
   set(){return true;}
 });
 return {ctx,calls};
}
const image=Avatar.svgFor(p.color,'idle');
assert.match(image,/viewBox="0 0 64 64"/);
assert.match(image,/data-view="top-down"/,'no front-facing sprite');
assert.doesNotMatch(image,/data-view="side"/);
assert.doesNotMatch(image,/M25 44 23 62/,'no old standing legs');
assert.doesNotMatch(image,/rx="3\.4" ry="3\.8"/,'no old frontal eyes');
assert.ok(Avatar.svgFor(p.color,'hold').includes('data-pose="hold"'));
assert.ok(Avatar.svgFor(p.color,'attack').includes('data-pose="attack"'));
assert.equal(Avatar.imageFor(p.color,'idle'),Avatar.imageFor(p.color,'idle'),
 'cache one SVG per color/pose');
for(const [dir,angle] of [
 [{x:0,y:-1},0],[{x:1,y:0},Math.PI/2],
 [{x:0,y:1},Math.PI],[{x:-1,y:0},3*Math.PI/2]
]){
 p.dir=dir;
 const {ctx,calls}=probe();
 Avatar.draw(ctx,p,{time:1});
 const translations=calls.filter(x=>x[0]==='translate');
 assert.equal(translations.length,1,'avatar must use one shared physics origin');
 assert.equal(translations[0][1],p.x);
 assert.equal(translations[0][2],p.y);
 const rotation=calls.find(x=>x[0]==='rotate');
 assert.ok(rotation&&Math.abs(rotation[1]-angle)<1e-9,
   'overhead sprite must rotate with the joystick');
 const body=calls.find(x=>x[0]==='drawImage');
 assert.ok(body,'cached SVG must be used');
 assert.deepEqual(body.slice(2),[-26,-26,52,52],
   'avatar is centered around the origin, not placed above/below it');
 const shadow=calls.find(x=>x[0]==='ellipse');
 assert.equal(shadow[1],0);assert.equal(shadow[2],0);
 const label=calls.find(x=>x[0]==='fillText'&&x[1]===p.name);
 assert.equal(label[2],p.x);
 assert.equal(label[3],p.y-30);
 assert.ok(calls.findIndex(x=>x[0]==='restore')<
   calls.findIndex(x=>x[0]==='fillText'),'name remains horizontal outside rotation');
}
{
 const {ctx,calls}=probe();Avatar.draw(ctx,p,{local:true,label:false});
 assert.ok(calls.some(x=>x[0]==='translate'&&x[1]===0&&x[2]===0));
 assert.ok(!calls.some(x=>x[0]==='fillText'));
}
for(const theme of ['graveyard','egypt']){
 const ghostSvg=Art.actorSVG(true,p.color,'float0',theme);
 assert.match(ghostSvg,/data-view="top-down"/,
   'Ghost Attack '+theme+' spirit is also overhead');
 if(theme==='egypt'){
   assert.match(ghostSvg,/data-actor="pharaoh-ghost"/);
   assert.match(ghostSvg,/url\(#nemes\)/);
 }
 const {ctx,calls}=probe();
 Art.drawActor(ctx,p,p.color,true,0,theme);
 assert.ok(calls.some(x=>x[0]==='translate'&&x[1]===p.x&&x[2]===p.y),
   'ghost and player share identical world-space origin');
 assert.ok(calls.some(x=>x[0]==='drawImage'&&x[2]===-27&&x[3]===-27&&
   x[4]===54&&x[5]===54),'ghost sprites must be centered top-down');
}
const shared=fs.readFileSync('character-system.js','utf8');
assert.match(shared,/PartyPlayerAvatar\?\.draw/,
 'PartyCharacters must delegate to the canonical overhead avatar');
for(const game of ['src/games/ghost-attack/ghost-attack.js','src/games/chickens/chickens.js','src/games/fruit-memory/fruit-memory.js','src/games/shockwave/shockwave.js']){
 const src=fs.readFileSync(game,'utf8');
 const viaShared=game==='src/games/chickens/chickens.js'||game==='src/games/fruit-memory/fruit-memory.js';
 assert.match(src,viaShared?/PartyCharacters\.draw/:/PartyPlayerAvatar\.draw/,
   game+' uses the same overhead avatar directly or through PartyCharacters');
}
const shock=fs.readFileSync('src/games/shockwave/shockwave.js','utf8');
assert.doesNotMatch(shock,/footAnchor:true/,'old side-view foot offset is removed');
assert.match(shock,/ctx\.arc\(p\.x,p\.y,C\.avatarRadius/,
 'displayed full-body blast marker uses exact physics centre');
console.log('TOP-DOWN AVATAR PASS: overhead SVG, four directions, centred foot anchor, theme ghosts, renderer reuse');

// Every seat and every legacy costume resolves to the same clean mask, no hats.
for(let id=1;id<=12;id++){
 const player={id:'p'+id,color:'#ff628c',costume:'pharaoh'};
 assert.equal(Avatar.costumeFor(player),'standard');
 assert.equal(Avatar.costumeFor({...player,color:'#ffe86b'}),'standard');
}
assert.equal(Avatar.COSTUMES.length,1);
for(const pose of ['idle','walk','walk2','hold','attack']){
 const sprite=Avatar.svgFor('#3fe4ef',pose,'fox');
 assert.match(sprite,/data-view="top-down"/);
 assert.match(sprite,/data-costume="standard"/);
 assert.doesNotMatch(sprite,/crown|headdress|fox|pharaoh|scout|chicken|hat/i);
 assert.equal(Avatar.imageFor('#3fe4ef',pose,'fox'),Avatar.imageFor('#3fe4ef',pose,'chicken'));
}
assert.notEqual(Avatar.svgFor('#3fe4ef','walk'),Avatar.svgFor('#3fe4ef','walk2'));
const front=Avatar.svgForFront('#ff628c');
assert.match(front,/data-view="front"/);
assert.match(front,/viewBox="0 0 96 96"/,'front portrait keeps its own aspect and projection');
assert.match(front,/fill="#fff"/);
assert.doesNotMatch(front,/crown|ears|hat|headdress/i);
assert.notEqual(front,Avatar.svgFor('#ff628c','idle'));
assert.notEqual(Avatar.svgForFront('#ff628c'),Avatar.svgForFront('#3fe4ef'),
 'every color has its own banner identity');
assert.equal(Avatar.imageForFront('#ff628c'),Avatar.imageForFront('#ff628c'));
assert.match(Art.actorSVG(false,'#ff628c','walk0'),/data-view="top-down"/,
 'legacy human entry point must not resurrect a front-facing actor');
assert.doesNotMatch(Avatar.svgFor('\" onload=\"alert(1)','idle','<script>'),/onload|<script>/);
// Loading without Image still produces a centred, rotated overhead fallback.
const noImages=vm.createContext({window:{}});
vm.runInContext(avatarSource,noImages);
{
 const {ctx,calls}=probe();noImages.window.PartyPlayerAvatar.draw(ctx,p,{label:false});
 assert.ok(calls.some(c=>c[0]==='ellipse'&&c[1]===32&&c[2]===30),'fallback draws the same overhead head');
 assert.ok(!calls.some(c=>c[0]==='drawImage'));
 assert.ok(calls.some(c=>c[0]==='translate'&&c[1]===p.x&&c[2]===p.y));
}
console.log('HATLESS AVATAR PASS: same mask, 12 colored identities, front/top projections and no-image fallback');

// The portrait is a camera projection, not an overhead sprite forced to face up.
{
 const before=JSON.stringify(p),{ctx,calls}=probe();
 Avatar.drawFront(ctx,p,123,246,72);
 assert.ok(!calls.some(c=>c[0]==='rotate'),'front portraits ignore world heading');
 const image=calls.find(c=>c[0]==='drawImage');
 assert.deepEqual(image.slice(2),[87,210,72,72],'portrait stays inside its requested UI box');
 assert.equal(JSON.stringify(p),before,'rendering never mutates gameplay state');
}
for(const dir of [{x:0,y:0},{x:NaN,y:1},{x:1,y:Infinity}]){
 assert.equal(Avatar.heading({dir}),0,'missing/invalid direction has a finite canonical heading');
}
for(let i=0;i<8;i++){
 const angle=i*Math.PI/4,dir={x:Math.sin(angle),y:-Math.cos(angle)};
 const heading=Avatar.heading({dir});
 assert.ok(Math.abs(Math.sin(heading)-Math.sin(angle))<1e-8);
 assert.ok(Math.abs(Math.cos(heading)-Math.cos(angle))<1e-8);
}
// All action poses use the same fixed physics anchor and sprite bounds.
for(const opts of [{time:.1},{time:.4},{holding:true},{attacking:true}]){
 const moving={...p,vx:120,vy:-30},before=JSON.stringify(moving),{ctx,calls}=probe();
 Avatar.draw(ctx,moving,{...opts,label:false});
 const image=calls.find(c=>c[0]==='drawImage');
 assert.deepEqual(image.slice(2),[-26,-26,52,52]);
 assert.equal(JSON.stringify(moving),before);
}
const noFront=probe();noImages.window.PartyPlayerAvatar.drawFront(noFront.ctx,p,70,80,60);
assert.ok(!noFront.calls.some(c=>c[0]==='rotate'),'front fallback also uses the front projection');
assert.ok(!noFront.calls.some(c=>c[0]==='drawImage'));
console.log('PROJECTION CONTRACT PASS: eight headings, separate portrait, stable action bounds and no gameplay mutation');

// Gradient URLs are scoped per color/projection when many SVG portraits share a DOM.
const redIds=[...Avatar.svgForFront('#ff0000').matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
const blueIds=[...Avatar.svgForFront('#0000ff').matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
assert.ok(redIds.length>0&&redIds.every(id=>!blueIds.includes(id)));

/* PUNCH-V2 TIMING: artwork is sampled from combat state, never drives damage. */
{
 const frame=ms=>Avatar.punchFrameFor({attackRemaining:.48-ms/1000});
 for(const [ms,index] of [
  [0,0],[24,0],[25,1],[139,4],[140,5],
  [179,6],[180,7],[209,7],[210,8],[279,9],
  [280,10],[454,14],[455,15],[479,15]
 ])assert.equal(frame(ms),index,'punch atlas frame at '+ms+'ms');
 assert.equal(Avatar.punchFrameFor({attackRemaining:0}),-1,'no frame after attack is canceled');
 assert.equal(Avatar.punchFrameFor({attackRemaining:-.1}),-1);
 assert.equal(Avatar.punchFrameFor(null),-1);
 const locked={dir:{x:0,y:-1},attackFacing:{x:1,y:0}};
 assert.ok(Math.abs(Avatar.punchHeading(locked)-Math.PI/2)<1e-9,'attack direction is locked independently of movement');
 const fixed={x:42,y:43,color:'#36d9e5',dir:{x:0,y:-1},attackFacing:{x:1,y:0},
  attackRemaining:.48-.19,name:'Punch',vx:0,vy:0};
 const {ctx,calls}=probe();
 Avatar.draw(ctx,fixed,{time:.2,label:false});
 assert.ok(calls.find(c=>c[0]==='translate'&&c[1]===42&&c[2]===43),'punch keeps physics origin');
 assert.ok(calls.find(c=>c[0]==='rotate'&&Math.abs(c[1]-Math.PI/2)<1e-9),'punch uses locked heading');
 assert.equal(Avatar.consumePunchDrawn(fixed),true,'legacy line must not double-draw');
 assert.equal(Avatar.consumePunchDrawn(fixed),false,'draw marker may only be consumed once');
 const timing=JSON.parse(fs.readFileSync('assets/animations/punch-v2/timing.json','utf8'));
 assert.equal(timing.durationsMs.total,480);
 assert.equal(timing.frames.length,16);
 assert.deepEqual(timing.viewBox,[-16,-32,96,112]);
 for(let i=0;i<16;i++){
  const item=timing.frames[i],text=fs.readFileSync('assets/animations/punch-v2/'+item.file,'utf8');
  assert.match(text,/viewBox="-16 -32 96 112"/,'each frame retains transparent padding, not hitbox');
  assert.match(text,/data-part="head"/);
  assert.equal(item.endMs,(i===15?480:timing.frames[i+1].startMs));
 }
 console.log('PUNCH-V2 TIMING PASS: sixteen original SVG frames, locked orientation, 480ms, no double VFX');
}

/* Every hand-punching minigame shares the actual colored punch-v2 atlas;
   custom COUNTDOWN DROP combat timing is mapped visually, not rewritten. */
{
 const expected=[[0,0],[24.99,0],[25,1],[140,5],[179,6],
  [180,7],[210,8],[280,10],[455,15],[479.9,15],[480,-1],[-1,-1]];
 for(const [time,frame] of expected)
  assert.equal(Avatar.punchFrameAtMs(time),frame,'shared punch frame at '+time+'ms');
 const local={x:92,y:79,color:'#ffd45b',dir:{x:0,y:-1},name:'COUNTDOWN'};
 const {ctx,calls}=probe();
 Avatar.draw(ctx,local,{punchElapsedMs:190,punchFacing:{x:1,y:0},attacking:true,label:false});
 assert.ok(calls.some(c=>c[0]==='rotate'&&Math.abs(c[1]-Math.PI/2)<1e-9),
  'COUNTDOWN custom punch is anchored to original character and locked heading');
 assert.ok(calls.some(c=>c[0]==='translate'&&c[1]===92&&c[2]===79));
 assert.equal(Avatar.consumePunchDrawn(local),true);
 const code={
  chicken:fs.readFileSync('src/games/chickens/chickens.js','utf8'),
  switch:fs.readFileSync('src/games/color-switch/color-switch.js','utf8'),
  fruit:fs.readFileSync('src/games/fruit-memory/fruit-memory.js','utf8'),
  ghost:fs.readFileSync('src/games/ghost-attack/ghost-attack.js','utf8'),
  countdown:fs.readFileSync('src/games/countdown-drop/countdown-drop.js','utf8'),
  countdownArt:fs.readFileSync('src/games/countdown-drop/countdown-drop-art.js','utf8')
 };
 for(const slug of ['chicken','switch','fruit']){
  assert.match(code[slug],/PartyCharacters\.draw\(/,slug+' draws shared character');
  assert.match(code[slug],/PartyCharacters\.(?:startPunch|punchFriends)\(/,
   slug+' uses shared physical punch');
 }
 assert.match(code.ghost,/PartyPlayerAvatar\.draw\(/);
 assert.match(code.ghost,/PartyCharacters\.punchFriends\(/);
 assert.match(code.countdown,/punchElapsedMs:visualMs,punchFacing:pn\.dir/,
  'custom game calls shared punch-v2 visual sampler');
 assert.match(code.countdown,/wind:\.12,active:\.1,recovery:\.18,cooldown:\.65/,
  'custom faster attack/cooldown unchanged');
 assert.match(code.countdown,/stun:1\.4/,'custom stun unchanged');
 assert.doesNotMatch(code.countdown,/a\.drawFist\(/,
  'old independent fist art must not display over SVG punch');
 assert.doesNotMatch(code.countdownArt,/function drawFist\(/);
 console.log('PUNCH MAP AUDIT PASS: CHICKENS, COLOR SWITCH, FRUIT MEMORY, GHOST ATTACK, COUNTDOWN DROP all share punch-v2 art');
}
