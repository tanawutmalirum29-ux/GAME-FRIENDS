/* GLADIATORS regression tests — run with node --test tests/gladiators.test.cjs */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'src/games/gladiators/gladiators.js'),'utf8');
function harness(){
 const win={
  PartyCharacters:{
   control(input){const k=input||{};let x=Number(k.axisX)||0,y=Number(k.axisY)||0;let l=Math.hypot(x,y);if(l>1){x/=l;y/=l;}return{x,y};},
   move(p,v,dt,o){
    const {bounds:b,radius:r,speed}=o;
    const fromX=p.x,fromY=p.y;
    p.x=Math.max(b.x+r,Math.min(b.x+b.w-r,p.x+v.x*dt*speed));
    p.y=Math.max(b.y+r,Math.min(b.y+b.h-r,p.y+v.y*dt*speed));
    p.vx=(p.x-fromX)/dt;p.vy=(p.y-fromY)/dt;
    if(Math.hypot(v.x,v.y)>.12)p.dir={x:v.x,y:v.y};
   },
   resolve(){return {contacts:0};}
  }
 };
 const ctx=vm.createContext({window:win,Date,Math,Number,Object,Array,Map,Set});
 vm.runInContext(src,ctx,{filename:'src/games/gladiators/gladiators.js'});
 return win.Gladiators;
}
const player=(id,isBot=false)=>({id:'p'+id,name:'Player'+id,color:'#ee5588',isBot,input:{axisX:0,axisY:0},active:true,dir:{x:0,y:-1}});
function match(n){const api=harness(),ps=Array.from({length:n},(_,i)=>player(i+1));const round={mode:'gladiators',phase:'playing',paused:false,gladiatorsSeed:123456};
 const state=api.setup(round,ps);return {api,ps,round,s:state};}
function hypot(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
test('registration and scripts are connected to both party modes',()=>{
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const board=fs.readFileSync(path.join(root,'board-minigame.js'),'utf8');
 const cover=fs.readFileSync(path.join(root,'game-cover-art.js'),'utf8');
 assert.match(app,/gladiators:'GLADIATORS'/);assert.match(app,/gladiators:'Gladiators'/);
 assert.match(app,/function endPluginRound\(/);
 assert.ok(!app.includes('function endGladiatorsRound('),'results must stay in owning game engine');
 assert.match(fs.readFileSync(path.join(root,'src/games/gladiators/gladiators.js'),'utf8'),/function getResult\(/);
 assert.match(board,/case 'gladiators'/);
 assert.match(html,/data-pick="gladiators"/);
 assert.ok(html.indexOf('src/games/gladiators/gladiators-art.js')<html.indexOf('src/games/gladiators/gladiators.js'));
 assert.ok(html.indexOf('src/games/gladiators/gladiators.js')<html.indexOf('app.js'));
 assert.match(cover,/gladiators:gladiatorsScene/);
});
test('1, 6, 7, 12 active players get isolated spawns and two world scales',()=>{
 for(const n of [1,6,7,12]){
  const {ps,s}=match(n);
  assert.equal(ps.length,n);
  assert.equal(s.bounds.w,n>6?1280:960);
  assert.equal(s.bounds.h,n>6?720:540);
  for(const p of ps){assert.equal(p.gladiator.alive,true);
   assert.ok(p.x>s.bounds.x+15&&p.x<s.bounds.right-15);
   assert.ok(p.y>s.bounds.y+15&&p.y<s.bounds.bottom-15);
   for(const other of ps)if(other!==p)assert.ok(hypot(p,other)>31);
  }
 }
});
test('idle mace never develops energy or kills its own wielder',()=>{
 const {api,ps,round,s}=match(1),p=ps[0],b=p.gladiator.ball;
 const start={x:b.x,y:b.y};
 for(let i=0;i<120;i++)api.step(1/60,round,ps);
 assert.equal(p.gladiator.alive,true);
 assert.ok(hypot(start,b)<.01);
 assert.ok(Math.abs(b.vx)<1e-7);assert.ok(Math.abs(b.vy)<1e-7); // floating-point constraint noise
});
test('turning and movement drive the ball while chain length remains bounded',()=>{
 const {api,ps,round,s}=match(1),p=ps[0],ball=p.gladiator.ball;
 const start={x:ball.x,y:ball.y};
 for(let tick=0;tick<150;tick++){
  const a=tick/150*Math.PI*4;
  p.input.axisX=Math.cos(a);p.input.axisY=Math.sin(a);
  api.step(1/60,round,ps);
  const dx=ball.x-p.gladiator.anchorX,dy=ball.y-p.gladiator.anchorY;
  assert.ok(Math.hypot(dx,dy)<=api.config.chain+2,'chain overstretch');
  assert.ok(Number.isFinite(ball.x+ball.y+ball.vx+ball.vy));
 }
 assert.ok(hypot(start,ball)>1,'mace failed to move from physics');
 assert.equal(p.gladiator.alive,true,'owner cannot kill self');
});
test('joystick reversal steers gradually instead of flipping the avatar instantly',()=>{
 const {api,ps,round}=match(1),p=ps[0];
 const start={x:p.x,y:p.y},heading=p.gladiator.heading;
 p.input.axisX=-Math.cos(heading);p.input.axisY=-Math.sin(heading);
 api.step(1/60,round,ps);
 const delta=Math.atan2(Math.sin(p.gladiator.heading-heading),Math.cos(p.gladiator.heading-heading));
 assert.ok(Math.abs(delta)>0);
 assert.ok(Math.abs(delta)<=api.config.turnRate/60+1e-9,'instant heading flip');
 assert.ok(Math.cos(p.gladiator.heading-heading)>.99,'avatar must still face roughly forward');
 assert.ok((p.x-start.x)*Math.cos(heading)+(p.y-start.y)*Math.sin(heading)>0,
  'a reversed stick must not teleport character into reverse movement');
 for(let i=0;i<70;i++)api.step(1/60,round,ps);
 assert.ok(Math.cos(p.gladiator.heading-heading)<-.95,'eventually reaches opposite heading');
});
test('chain gains exactly two 9px links without clipping into arena walls',()=>{
 const {api,ps,s}=match(1),p=ps[0],ball=p.gladiator.ball;
 assert.equal(api.config.chain,114);
 const distance=hypot(ball,{x:p.gladiator.anchorX,y:p.gladiator.anchorY});
 assert.ok(distance>0&&distance<=90+.01,'initial mace must respect 90px reach and wall clamp');
 assert.ok(ball.x>=s.bounds.x+api.config.ball&&ball.x<=s.bounds.right-api.config.ball);
 assert.ok(ball.y>=s.bounds.y+api.config.ball&&ball.y<=s.bounds.bottom-api.config.ball);
 assert.equal(Math.floor(api.config.chain/9)-Math.floor(96/9),2);
});
test('own mace is solid, pushes the owner and never kills them',()=>{
 const {api,ps,round}=match(1),p=ps[0],ball=p.gladiator.ball;
 const startX=p.x,startY=p.y;
 Object.assign(ball,{x:p.x+20,y:p.y,px:p.x+20,py:p.y,vx:-210,vy:0});
 api.step(1/60,round,ps);
 assert.equal(p.gladiator.alive,true);
 assert.ok(p.x<startX-.5,'owner must be pushed away from approaching mace');
 assert.ok(hypot(p,ball)>=api.config.body+api.config.ball+api.config.spike*.65-.15,
  'owner body may not overlap with their own mace');
 assert.ok(p.gladiator.knockVx<0,'collision must transfer knockback momentum');
 assert.ok(Number.isFinite(p.y-startY+ball.vx+ball.vy));
});
test('own mace remains solid even when owner is against the arena wall',()=>{
 const {api,ps,round,s}=match(1),p=ps[0],ball=p.gladiator.ball;
 p.x=s.bounds.x+api.config.body;p.y=s.bounds.h/2;
 p.dir={x:1,y:0};p.gladiator.heading=0;
 Object.assign(ball,{x:p.x+22,y:p.y,px:p.x+22,py:p.y,vx:-125,vy:0});
 api.step(1/60,round,ps);
 assert.equal(p.gladiator.alive,true);
 assert.ok(p.x>=s.bounds.x+api.config.body);
 assert.ok(hypot(p,ball)>=api.config.body+api.config.ball+api.config.spike*.65-.15,
  'mace must separate even when player cannot be pushed through wall');
});
test('twelve independent rigid links store physical joints instead of a straight painted line',()=>{
 const {api,ps,s}=match(1),p=ps[0],st=p.gladiator;
 assert.equal(api.config.chainLinks,12);
 assert.equal(st.links.length,11);
 const pts=[{x:st.anchorX,y:st.anchorY},...st.links,st.ball];
 for(const joint of st.links){
  assert.ok(Number.isFinite(joint.x+joint.y+joint.px+joint.py+joint.vx+joint.vy));
  assert.notEqual(joint,st.ball,'links are not a shared ball reference');
 }
 for(let i=1;i<pts.length;i++){
  assert.ok(Math.abs(hypot(pts[i-1],pts[i])-api.config.chain/api.config.chainLinks)<.2,
   'each link starts at its own 9.5-unit length');
 }
 const first=pts[0],last=pts.at(-1);
 const maxBend=Math.max(...st.links.map(q=>
  Math.abs((last.x-first.x)*(q.y-first.y)-(last.y-first.y)*(q.x-first.x))/
  (hypot(first,last)||1)));
 assert.ok(maxBend>1,'the slack chain must have an articulated bend instead of a painted straight line');
});
test('chain joints lag and swing separately, respond to turns, and stay connected',()=>{
 const {api,ps,round,s}=match(1),p=ps[0],st=p.gladiator;
 let sawMomentum=false,sawBend=false;
 const step=api.config.chain/api.config.chainLinks;
 for(let i=0;i<240;i++){
  const a=i<80?0:i<150?Math.PI*.8:-Math.PI*.35;
  p.input.axisX=Math.cos(a);p.input.axisY=Math.sin(a);
  api.step(1/60,round,ps);
  const pts=[{x:st.anchorX,y:st.anchorY},...st.links,st.ball];
  for(let j=1;j<pts.length;j++){
   assert.ok(Number.isFinite(pts[j].x+pts[j].y),'joint must remain finite');
   assert.ok(hypot(pts[j-1],pts[j])<step+4,'no link may detach from its neighbour');
  }
  if(st.links.some(j=>Math.hypot(j.vx,j.vy)>2))sawMomentum=true;
  const first=pts[0],last=pts.at(-1);
  const deviation=Math.max(...st.links.map(q=>
   Math.abs((last.x-first.x)*(q.y-first.y)-(last.y-first.y)*(q.x-first.x))/
   (hypot(first,last)||1)));
  if(deviation>4)sawBend=true;
  assert.ok(hypot(first,last)<api.config.chain+2,'whole tether stays within its total reach');
 }
 assert.equal(sawMomentum,true,'each link should carry independent inertia');
 assert.equal(sawBend,true,'chain should flex visibly while changing direction');
});
test('chain joints respect walls, remain harmless and freeze with their owner',()=>{
 const {api,ps,round,s}=match(1),p=ps[0],st=p.gladiator;
 for(let i=0;i<90;i++){
  p.input.axisX=-1;p.input.axisY=0;
  api.step(1/60,round,ps);
  for(const pin of st.links){
   assert.ok(pin.x>=s.bounds.x+3-1e-5&&pin.x<=s.bounds.right-3+1e-5);
   assert.ok(pin.y>=s.bounds.y+3-1e-5&&pin.y<=s.bounds.bottom-3+1e-5);
  }
  assert.equal(st.alive,true);
 }
 const before=st.links.map(q=>({x:q.x,y:q.y}));
 api.eliminate(s,p,'regression');
 api.step(1/60,round,ps);
 for(let i=0;i<st.links.length;i++){
  assert.ok(hypot(st.links[i],before[i])<.001,'eliminated chain must stay in its last position');
 }
});
test('opposing mace touches cause simultaneous eliminations and tied ranks',()=>{
 const {api,ps,round,s}=match(2),[a,b]=ps;
 a.x=430;a.y=270;b.x=550;b.y=270;
 a.dir={x:-1,y:0};b.dir={x:1,y:0};
 a.gladiator.anchorX=440;a.gladiator.anchorY=270;
 b.gladiator.anchorX=540;b.gladiator.anchorY=270;
 Object.assign(a.gladiator.ball,{x:550,y:270,px:550,py:270,vx:0,vy:0});
 Object.assign(b.gladiator.ball,{x:430,y:270,px:430,py:270,vx:0,vy:0});
 api.step(1/60,round,ps);
 assert.equal(a.gladiator.alive,false);assert.equal(b.gladiator.alive,false);
 assert.equal(a.gladiator.eliminatedTick,b.gladiator.eliminatedTick);
 assert.equal(s.finished,true);
 assert.equal(s.winnerIds.length,0);
 assert.equal(s.ranking[0].rank,1);
 assert.equal(s.ranking[1].rank,1);
});
test('mace stays at its final position and remains deadly after owner dies',()=>{
 const {api,ps,round,s}=match(3);
 const owner=ps[0],victim=ps[1],third=ps[2];
 const mace=owner.gladiator.ball;
 Object.assign(mace,{x:520,y:250,px:520,py:250,vx:90,vy:70});
 owner.gladiator.anchorX=470;owner.gladiator.anchorY=240;
 api.eliminate(s,owner,'test');
 assert.equal(mace.static,true);
 assert.equal(mace.vx,0);
 assert.equal(mace.x,520);
 victim.x=539;victim.y=250;victim.dir={x:0,y:-1};
 // Keep the other maces away from the test collision.
 third.x=650;third.y=400;
 api.step(1/60,round,ps);
 assert.equal(victim.gladiator.alive,false,'frozen mace must kill');
 assert.equal(mace.x,520,'dead owner mace moved');
 assert.equal(mace.y,250,'dead owner mace moved');
 assert.equal(owner.gladiator.deadAnchorX,470);
});
test('chain does not kill and friendly mace collisions do not harm the owner',()=>{
 const {api,ps,round,s}=match(1),p=ps[0];
 p.gladiator.ball.x=p.x;p.gladiator.ball.y=p.y;
 api.step(1/60,round,ps);
 assert.equal(p.gladiator.alive,true);
});
test('swept collision detects fast crossing missed by endpoint overlap',()=>{
 const {api}=match(1);
 assert.equal(api.swept({x:0,y:0},{x:100,y:0},{x:50,y:-30},{x:50,y:30},5),true);
 assert.equal(api.swept({x:0,y:0},{x:100,y:0},{x:50,y:20},{x:50,y:25},5),false);
});
test('static mace does not move when another moving mace collides',()=>{
 const {api}=match(2);
 const moving={x:0,y:0,vx:100,vy:0},fixed={x:30,y:0,vx:0,vy:0,static:true};
 assert.equal(api.impact(moving,fixed,20,20),true);
 assert.equal(fixed.x,30);assert.equal(fixed.y,0);
 assert.ok(moving.vx<0,'moving mace must reflect');
});
test('paused round does not advance time, and frame-rate accumulator is bounded',()=>{
 const {api,ps,round,s}=match(2);round.paused=true;
 api.update(.5,round,ps);assert.equal(s.tick,0);
 round.paused=false;api.update(.2,round,ps);assert.equal(s.tick,12);
});
test('bots navigate via joystick vectors, never command their ball directly',()=>{
 const {api,ps,round,s}=match(3);
 ps.forEach(p=>p.isBot=true);
 const start=ps.map(p=>({x:p.x,y:p.y}));
 for(let i=0;i<30&&!s.finished;i++)api.step(1/60,round,ps);
 assert.ok(ps.some((p,i)=>hypot(p,start[i])>1),'bots never moved');
 for(const p of ps)assert.ok(Number.isFinite(p.gladiator.ball.x));
});
test('ball-wall collision cannot escape arena',()=>{
 const {api,ps,round,s}=match(1),b=ps[0].gladiator.ball;
 for(let i=0;i<50;i++){
  b.x=s.bounds.right-api.config.ball-1;b.y=ps[0].y;b.vx=900;
  api.step(1/60,round,ps);
  assert.ok(b.x<=s.bounds.right);
  assert.ok(b.x>=s.bounds.x);
 }
});


test('2, 6 and 12 bot matches finish, keep finite physics, and rank all players',()=>{
 for(const n of [2,6,12])for(let trial=0;trial<3;trial++){
  const {api,ps,round,s}=match(n);
  round.gladiatorsSeed=1000+n+trial;
  ps.forEach(p=>p.isBot=true);
  // Seed variety in real bot decisions. All simulated physics remain at 60Hz.
  s.seed=1000+n*89+trial*101;
  for(let tick=0;tick<60*180&&!s.finished;tick++){
   api.step(1/60,round,ps);
   if(tick%60===0)for(const p of ps){
    const b=p.gladiator.ball;
    assert.ok(Number.isFinite(b.x+b.y+b.vx+b.vy+p.x+p.y));
    assert.ok(Math.hypot(b.x-p.gladiator.anchorX,b.y-p.gladiator.anchorY)<=api.config.chain+2);
   }
  }
  assert.equal(s.finished,true,n+' bots failed to finish trial '+trial);
  assert.equal(s.ranking.length,n);
  assert.equal(new Set(s.ranking.map(x=>x.id)).size,n);
  assert.ok(s.ranking.every(x=>Number.isInteger(x.rank)&&x.rank>=1&&x.rank<=n));
 }
});
