/* BOULDER BASH — deterministic fixed-step, host-authoritative snow survival. */
(() => {
'use strict';
const STEP=1/60,TAU=Math.PI*2,MIN_X=94,MAX_X=658,TOP=75,BOTTOM=468;
const C=Object.freeze({radius:15,accel:780,drag:2.4,maxSpeed:195,pushImpulse:98,pushRange:40,
 pushCooldown:.6,rockGravity:118,rockDrag:.14,rockLimit:18,rockChance:.25,soloDuration:60});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const living=ps=>ps.filter(p=>p.active&&p.bb?.alive);
const rng=s=>{let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x||0x12345;return(s.seed>>>0)/4294967296;};
const color=(p)=>p.color||'#f5c87a';
function vector(i){let x=Number(i?.axisX)||Number(!!i?.right)-Number(!!i?.left);
 let y=Number(i?.axisY)||Number(!!i?.down)-Number(!!i?.jump);
 const m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}return{x,y};}
function interval(t){return t<15?2.5:t<30?2:t<45?1.5:t<60?1:.75;}
function setup(round,ps){
 if(!ps.length||ps.length>12)throw Error('BOULDER BASH supports 1–12 players');
 const n=ps.length,s={clock:0,tick:0,accumulator:0,seed:(Number(round.boulderSeed)||(Date.now()^0x1a59c3e))>>>0||1,
  rocks:[],warnings:[],effects:[],queue:[],nextSpawn:1.2,nextId:1,finished:false,
  winnerIds:[],ranking:[],roster:ps,originalCount:n,spawnCursor:0};
 round.boulderBash=s;round.remaining=null;
 const rows=n<=4?1:n<=8?2:3,cols=Math.ceil(n/rows),startY=n<=4?270:n<=8?232:190;
 ps.forEach((p,i)=>{
  p.active=true;p.score=0;
  const col=Math.floor(i/rows),row=i%rows;
  p.x=210+col*44;p.y=startY+(row-(rows-1)/2)*(n<=8?66:75);
  p.vx=0;p.vy=0;p.dir={x:1,y:0};p.face=1;
  p.bb={alive:true,eliminatedAt:null,eliminatedTick:null,mode:'alive',rockId:null,
   pushCooldown:0,botPhase:rng(s)*TAU,homeY:p.y,homeX:p.x,botTarget:null};
 });
 return s;
}
function eligible(s){return s.roster.filter(p=>p.active&&!p.bb.alive&&p.bb.rockId===null);}
function rockAt(s,y,owner=null){
 const r=owner?27:24+Math.floor(rng(s)*4)*5;
 const x=1000+r,vy=(rng(s)-.5)*85;
 const rock={id:s.nextId++,ownerId:owner?.id||null,color:owner?color(owner):null,
  x,y,oldX:x,oldY:y,vx:-145-rng(s)*58,vy,r,mass:r*r,angle:rng(s)*TAU,
  wobble:rng(s)*TAU,spin:0,trail:[],radius:r,age:0};
 s.rocks.push(rock);
 if(owner){owner.bb.rockId=rock.id;owner.bb.mode='rock';}
 return rock;
}
function spawnWarning(s){
 if(s.rocks.length+s.warnings.length>=C.rockLimit)return;
 let y=TOP+43+rng(s)*(BOTTOM-TOP-86);
 for(let i=0;i<9;i++){
  if(s.warnings.every(w=>Math.abs(w.y-y)>73)&&s.rocks.every(r=>r.x>855?Math.abs(r.y-y)>r.r+43:true))break;
  y=TOP+43+rng(s)*(BOTTOM-TOP-86);
 }
 const dead=eligible(s),owner=dead.length&&rng(s)<C.rockChance?dead[s.spawnCursor++%dead.length]:null;
 s.warnings.push({y,ownerId:owner?.id||null,delay:.55});
}
function transferRock(s,r){
 if(r.ownerId){const owner=s.roster.find(p=>p.id===r.ownerId);
  if(owner&&owner.bb.rockId===r.id){owner.bb.rockId=null;owner.bb.mode='spectator';}}
}
function eliminate(s,p,rock){
 if(!p?.bb?.alive)return false;
 p.bb.alive=false;p.bb.mode='spectator';p.bb.eliminatedAt=s.clock;p.bb.eliminatedTick=s.tick;
 p.bb.rockId=null;p.bb.killedBy=rock?.ownerId||null;
 s.effects.push({x:p.x,y:p.y,color:color(p),life:.7});
 return true;
}
function botSteer(s,p){
 const b=p.bb;
 let vx=0,vy=0,pressure=0;
 for(const r of s.rocks){
  const rx=r.x-p.x,ry=r.y-p.y,relX=r.vx-p.vx,relY=r.vy-p.vy;
  const t=clamp(-(rx*relX+ry*relY)/(relX*relX+relY*relY+1),0,1.6);
  const delta=Math.hypot(rx+relX*t,ry+relY*t);
  if(rx>-35&&delta<r.r+80){
   const weight=(r.r+85-delta)/(r.r+85);
   const sign=(ry+relY*t)>0?-1:1;
   vy+=sign*weight*2.5;vx+=rx>0?-weight*.7:weight*.35;pressure=Math.max(pressure,weight);
  }
 }
 vx+=(b.homeX-p.x)*.008;
 vy+=(b.homeY+Math.sin(s.clock*.65+b.botPhase)*60-p.y)*.014;
 if(p.y<TOP+38)vy+=2;if(p.y>BOTTOM-38)vy-=2;
 const m=Math.hypot(vx,vy)||1;
 const nearest=living(s.roster).filter(q=>q!==p).sort((a,c)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(c.x-p.x,c.y-p.y))[0];
 const act=nearest&&Math.hypot(nearest.x-p.x,nearest.y-p.y)<C.pushRange&&s.clock>.8&&rng(s)<.025;
 return {x:clamp(vx/m,-1,1),y:clamp(vy/m,-1,1),push:!!act,pressure};
}
function playerMove(s,p,dt){
 const b=p.bb;
 if(!b.alive)return;
 b.pushCooldown=Math.max(0,b.pushCooldown-dt);
 const inp=p.isBot?botSteer(s,p):{...vector(p.input),push:!!p.input?.action};
 let x=inp.x,y=inp.y;
 const scale=clamp(Math.hypot(x,y),0,1);
 p.vx+=x*C.accel*dt;p.vy+=y*C.accel*dt;
 const damp=Math.exp(-C.drag*dt);p.vx*=damp;p.vy*=damp;
 const speed=Math.hypot(p.vx,p.vy);
 if(speed>C.maxSpeed+45){const a=(C.maxSpeed+45)/speed;p.vx*=a;p.vy*=a;}
 if(scale>.1){const m=scale||1;p.dir={x:x/m,y:y/m};p.face=p.dir.x<0?-1:1;}
 p.x+=p.vx*dt;p.y+=p.vy*dt;
 if(p.x<MIN_X+C.radius){p.x=MIN_X+C.radius;p.vx=Math.max(0,p.vx);}
 if(p.x>MAX_X-C.radius){p.x=MAX_X-C.radius;p.vx=Math.min(0,p.vx);}
 if(p.y<TOP+C.radius){p.y=TOP+C.radius;p.vy=Math.max(0,p.vy);}
 if(p.y>BOTTOM-C.radius){p.y=BOTTOM-C.radius;p.vy=Math.min(0,p.vy);}
 if(inp.push&&b.pushCooldown<=0){
  b.pushCooldown=C.pushCooldown;
  for(const q of living(s.roster)){
   if(q===p)continue;
   const dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy);
   const f=p.dir||{x:1,y:0};
   if(d>C.pushRange||d<.01||(dx*f.x+dy*f.y)/d<.45)continue;
   q.vx+=f.x*C.pushImpulse;q.vy+=f.y*C.pushImpulse;
  }
 }
}
function resolveBodies(s){
 const people=living(s.roster);
 if(people.length<2)return;
 if(window.PartyCharacters?.resolve){
  window.PartyCharacters.resolve(people,{radius:C.radius,iterations:3,maxShift:5,
   bounds:{x:MIN_X,y:TOP,w:MAX_X-MIN_X,h:BOTTOM-TOP}});
 }else{
  for(let i=0;i<people.length;i++)for(let j=i+1;j<people.length;j++){
   const a=people[i],b=people[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.001;
   if(d<2*C.radius){const t=(2*C.radius-d)/2,nx=dx/d,ny=dy/d;
    a.x-=t*nx;a.y-=t*ny;b.x+=t*nx;b.y+=t*ny;}
  }
 }
 for(const p of people){p.x=clamp(p.x,MIN_X+C.radius,MAX_X-C.radius);
 p.y=clamp(p.y,TOP+C.radius,BOTTOM-C.radius);}
}
function rockInput(s,r){
 if(!r.ownerId)return 0;
 const p=s.roster.find(p=>p.id===r.ownerId);
 if(!p)return 0;
 if(p.isBot){
  const t=living(s.roster).sort((a,b)=>Math.abs(a.y-r.y)-Math.abs(b.y-r.y))[0];
  if(!t)return 0;
  const prediction=t.y+t.vy*clamp((r.x-t.x)/Math.max(60,-r.vx),0,2);
  return clamp((prediction-r.y)/90,-1,1)*.9;
 }
 return vector(p.input).y;
}
function moveRocks(s,dt){
 for(const r of s.rocks){
  r.oldX=r.x;r.oldY=r.y;r.age+=dt;
  // Gravity always accelerates down-slope (-X). Steering never adds up-slope force.
  r.vx-=C.rockGravity*dt;r.vx*=Math.exp(-C.rockDrag*dt);
  r.vy+=((Math.sin(s.clock*1.25+r.wobble)*17)+rockInput(s,r)*155)*dt;
  r.vy*=Math.exp(-.6*dt);
  r.vx=Math.max(-390,r.vx);r.vy=clamp(r.vy,-125,125);
  r.x+=r.vx*dt;r.y+=r.vy*dt;
  if(r.y<TOP+r.r){r.y=TOP+r.r;r.vy=Math.abs(r.vy)*.6;}
  if(r.y>BOTTOM-r.r){r.y=BOTTOM-r.r;r.vy=-Math.abs(r.vy)*.6;}
  const traveled=Math.hypot(r.x-r.oldX,r.y-r.oldY);
  r.spin=traveled/r.r*(r.vy>0?1:-1);r.angle+=r.spin;
  if(s.tick%8===0){r.trail.push({x:r.x,y:r.y});if(r.trail.length>7)r.trail.shift();}
 }
 // Elastic mass-dependent impulses and overlap separation for rock-rock collisions.
 for(let i=0;i<s.rocks.length;i++)for(let j=i+1;j<s.rocks.length;j++){
  const a=s.rocks[i],b=s.rocks[j],dx=b.x-a.x,dy=b.y-a.y;
  const d=Math.hypot(dx,dy)||.001,min=a.r+b.r;if(d>min)continue;
  const nx=dx/d,ny=dy/d,over=min-d,share=a.mass+b.mass;
  a.x-=nx*over*b.mass/share;b.x+=nx*over*a.mass/share;
  a.y-=ny*over*b.mass/share;b.y+=ny*over*a.mass/share;
  const rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
  if(rel<0){const impulse=-(1+.35)*rel/(1/a.mass+1/b.mass);
   a.vx-=impulse*nx/a.mass;a.vy-=impulse*ny/a.mass;
   b.vx+=impulse*nx/b.mass;b.vy+=impulse*ny/b.mass;}
 }
}
function sweptHit(p,r,px,py){
 // Relative continuous circle segment: detect both tunneling and initial overlap.
 const x=r.oldX-px,y=r.oldY-py;
 const dx=(r.x-r.oldX)-(p.x-px),dy=(r.y-r.oldY)-(p.y-py);
 const m=clamp(-(x*dx+y*dy)/(dx*dx+dy*dy+1e-12),0,1);
 return Math.hypot(x+dx*m,y+dy*m)<=r.r+C.radius*.88;
}
function finish(s,round,ps){
 s.finished=true;
 const list=ps.filter(p=>p.active);
 const survivors=living(list);
 s.winnerIds=survivors.map(p=>p.id);
 if(s.originalCount===1&&survivors.length===0)s.winnerIds=[];
 const value=p=>p.bb.alive?Infinity:p.bb.eliminatedTick??-1;
 s.ranking=list.map(p=>({id:p.id,value:value(p),rank:1+list.filter(q=>value(q)>value(p)).length}))
  .sort((a,b)=>a.rank-b.rank||String(a.id).localeCompare(String(b.id)));
 round.remaining=0;
}
function step(dt,round,ps){
 const s=round.boulderBash;if(s.finished)return;
 s.tick++;s.clock+=dt;
 for(const p of living(ps)){p.bb.oldX=p.x;p.bb.oldY=p.y;playerMove(s,p,dt);}
 resolveBodies(s);
 for(const w of s.warnings)w.delay-=dt;
 for(let i=s.warnings.length-1;i>=0;i--){
  const w=s.warnings[i];if(w.delay>0)continue;
  const owner=s.roster.find(p=>p.id===w.ownerId&&p.bb.rockId===null&&!p.bb.alive);
  rockAt(s,w.y,owner||null);s.warnings.splice(i,1);
 }
 if(s.clock>=s.nextSpawn){
  spawnWarning(s);s.nextSpawn=s.clock+interval(s.clock)*(.9+rng(s)*.2);
 }
 moveRocks(s,dt);
 // Same physics tick can eliminate multiple players: equal ranking for simultaneous deaths.
 for(const r of s.rocks)for(const p of living(ps)){
  if(sweptHit(p,r,p.bb.oldX,p.bb.oldY))eliminate(s,p,r);
 }
 for(let i=s.rocks.length-1;i>=0;i--){
  if(s.rocks[i].x<-s.rocks[i].r+36){transferRock(s,s.rocks[i]);s.rocks.splice(i,1);}
 }
 for(const e of s.effects)e.life-=dt;
 s.effects=s.effects.filter(e=>e.life>0).slice(-40);
 const survivors=living(ps);
 if(ps.filter(p=>p.active).length===1){
  if(s.clock>=C.soloDuration||survivors.length===0)finish(s,round,ps);
 }else if(survivors.length<=1)finish(s,round,ps);
 round.remaining=ps.length===1?Math.max(0,C.soloDuration-s.clock):null;
}
function update(dt,round,ps){
 const s=round.boulderBash;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.25,s.accumulator+clamp(dt,0,.25));
 let cycles=0;
 while(s.accumulator+1e-9>=STEP&&cycles++<15&&!s.finished){
  step(STEP,round,ps);s.accumulator-=STEP;
 }
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.boulderBash;
 return {survivors:living(ps).length,remaining:round.remaining,elapsed:s?.clock||0,
  winnerIds:s?.winnerIds||[],statuses:ps.filter(p=>p.active).map(p=>({id:p.id,mode:p.bb?.mode}))};
}
function circle(g,x,y,r,fill){g.fillStyle=fill;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();}
function scenery(g,s){
 g.fillStyle='#416a65';g.fillRect(0,0,960,540);
 const snow=g.createLinearGradient(75,55,920,495);
 snow.addColorStop(0,'#f5fdff');snow.addColorStop(.48,'#d5f0f8');snow.addColorStop(1,'#8dc2dc');
 g.fillStyle=snow;g.beginPath();g.moveTo(82,44);g.lineTo(925,40);g.lineTo(960,102);
 g.lineTo(960,480);g.lineTo(918,501);g.lineTo(79,502);g.closePath();g.fill();
 g.strokeStyle='#f9ffff';g.lineWidth=8;g.beginPath();g.moveTo(84,55);g.lineTo(922,55);
 g.moveTo(84,490);g.lineTo(923,490);g.stroke();
 // Cliff falls off to the left; cyan ice ledge on the right.
 g.fillStyle='#315667';g.beginPath();g.moveTo(75,42);g.lineTo(104,67);g.lineTo(99,480);
 g.lineTo(65,514);g.lineTo(37,500);g.lineTo(55,46);g.fill();
 g.fillStyle='#b4dce7';g.beginPath();g.moveTo(910,62);g.lineTo(932,53);g.lineTo(952,86);
 g.lineTo(952,462);g.lineTo(925,492);g.lineTo(908,477);g.closePath();g.fill();
 g.strokeStyle='#9bc8da';g.lineWidth=1;
 for(let i=0;i<20;i++){const y=86+i*20;
  g.beginPath();g.moveTo(110,y);g.bezierCurveTo(280,y-9,530,y+10,880,y-5);g.stroke();}
 for(let i=0;i<70;i++){
  const x=122+(i*137)%750,y=90+(i*79)%364;
  circle(g,x,y,1+(i%3)*.45,i%4===0?'#ffffffbd':'#8ebed066');
 }
 for(let i=0;i<12;i++){
  const y=84+i*34,x=36+(i%2)*17;
  circle(g,x,y,5+i%3,'#75a290');
  circle(g,x+4,y-4,3,'#adbec2');
 }
}
function drawRock(g,r){
 g.save();
 for(let i=0;i<r.trail.length;i++){
  const p=r.trail[i];circle(g,p.x+6,p.y+7,r.r*.28,'#6596af28');
 }
 g.translate(r.x,r.y);
 g.fillStyle='#315b7588';g.beginPath();g.ellipse(5,9,r.r*1.13,r.r*.82,-.2,0,TAU);g.fill();
 g.rotate(r.angle);
 g.beginPath();
 for(let i=0;i<9;i++){
  const a=TAU*i/9,rad=r.r*(i%3===0?.96:i%2===0?1.03:.9);
  if(!i)g.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);
  else g.lineTo(Math.cos(a)*rad,Math.sin(a)*rad);
 }
 g.closePath();
 const fill=g.createRadialGradient(-r.r*.4,-r.r*.5,2,0,0,r.r*1.3);
 fill.addColorStop(0,r.color||'#b0bdca');
 fill.addColorStop(.65,r.color||'#657c8c');
 fill.addColorStop(1,r.color?'#233e55':'#34485d');
 g.fillStyle=fill;g.fill();g.lineWidth=2;g.strokeStyle='#e7f5fb88';g.stroke();
 g.strokeStyle=r.color?'#fff8':'#34495b';g.lineWidth=2;
 g.beginPath();g.moveTo(-r.r*.48,-r.r*.09);g.lineTo(-r.r*.12,-r.r*.31);
 g.lineTo(r.r*.12,0);g.lineTo(r.r*.5,-r.r*.1);g.moveTo(r.r*.12,0);g.lineTo(r.r*.1,r.r*.45);g.stroke();
 g.restore();
 if(r.ownerId){
  const owner=window.BoulderBash._roster?.find(p=>p.id===r.ownerId);
  if(owner){g.fillStyle='#183d58bb';g.fillRect(r.x-31,r.y-r.r-26,62,18);
   g.fillStyle='#ffffff';g.font='bold 11px sans-serif';g.textAlign='center';
   g.fillText(String(owner.name||'').slice(0,9),r.x,r.y-r.r-13);}
 }
}
function draw(g,time,round,ps){
 const s=round.boulderBash;if(!s)return;
 g.save();g.clearRect(0,0,960,540);scenery(g,s);
 for(const w of s.warnings){
  g.save();g.globalAlpha=.34+.2*Math.sin(s.clock*20);
  g.strokeStyle=w.ownerId?'#f7b4ce':'#e8faff';g.lineWidth=3;
  g.beginPath();g.ellipse(921,w.y,26,40,0,0,TAU);g.stroke();g.restore();
 }
 for(const r of s.rocks)drawRock(g,r);
 for(const p of living(ps)){
  if(window.PartyCharacters?.draw)window.PartyCharacters.draw(g,p,{time:s.clock});
  else{circle(g,p.x,p.y,C.radius,color(p));}
 }
 for(const e of s.effects){g.save();g.globalAlpha=clamp(e.life/.7,0,1);
  g.strokeStyle=e.color;g.lineWidth=4;g.beginPath();g.arc(e.x,e.y,35*(1-e.life/.7)+12,0,TAU);g.stroke();g.restore();}
 g.fillStyle='#174158e0';g.beginPath();g.roundRect(12,10,205,57,10);g.fill();
 g.fillStyle='#f4fdff';g.textAlign='left';g.font='900 20px system-ui';g.fillText('BOULDER BASH',24,34);
 g.font='bold 14px system-ui';g.fillText(round.phase==='countdown'?'เริ่มใน '+Math.ceil(round.countdown):
  'รอด '+living(ps).length+' • '+Math.floor(s.clock)+' วินาที',24,54);
 g.restore();
}
window.BoulderBash=Object.freeze({setup,update,draw,hud,step,spawnWarning,rockAt,eliminate,
 sweptHit,finish,interval,config:C,get _roster(){return null;}});
})();