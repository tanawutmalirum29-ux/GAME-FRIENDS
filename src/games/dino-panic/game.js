/* DINO PANIC — host-authoritative, fixed-step jungle survival race.
 * Standalone native minigame; no changes to platform scripts required. */
const TAU=Math.PI*2,STEP=1/60,VIEW_W=960,VIEW_H=540;
const C=Object.freeze({radius:15,speed:176,headStart:225,collisionIterations:3,
  botLookAhead:260,smallDuration:76,largeDuration:94});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hyp=Math.hypot;
const racers=ps=>ps.filter(p=>p.active&&p.dp?.status==='running');
const rnd=s=>{let v=s.seed|0;v^=v<<13;v^=v>>>17;v^=v<<5;s.seed=v||0x1234567;return(s.seed>>>0)/4294967296;};
const hash=n=>{let x=(n*2654435761)>>>0;x^=x>>>16;x=Math.imul(x,2246822519);x^=x>>>13;return (x>>>0)/4294967296;};
function tier(n){
 const large=n>6;
 return {id:large?'large':'small',w:large?10700:7690,h:540,
  top:large?67:94,bottom:large?475:446,
  finishX:large?10400:7400,duration:large?C.largeDuration:C.smallDuration,
  lanes:large?8:6};
}
function inputVector(p){
 const i=p.input||{};
 let x=Number(i.axisX)||Number(!!i.right)-Number(!!i.left);
 let y=Number(i.axisY)||Number(!!i.down)-Number(!!i.up||!!i.jump);
 if(!Number.isFinite(x))x=0;if(!Number.isFinite(y))y=0;
 const m=hyp(x,y);return m>1?{x:x/m,y:y/m}:{x,y};
}
function generateObstacles(s){
 const w=s.world,lanes=w.lanes,h=(w.bottom-w.top)/lanes;
 let x=610,wave=0;
 while(x<w.finishX-300){
  const count=rnd(s)<.36?1:rnd(s)<.76?2:3;
  const chosen=new Set();
  for(let j=0;j<count;j++){
   let lane=Math.floor(rnd(s)*lanes),tries=0;
   while(chosen.has(lane)&&tries++<15)lane=Math.floor(rnd(s)*lanes);
   if(chosen.has(lane))continue;
   chosen.add(lane);
   const y=w.top+(lane+.5)*h+(rnd(s)-.5)*Math.min(9,h*.2);
   const isLog=rnd(s)<.16,rock=rnd(s)<.19;
   const ww=isLog?76:rock?39:44+rnd(s)*12,hh=isLog?23:rock?37:42+rnd(s)*8;
   s.obstacles.push({id:s.obstacles.length,x:x+(rnd(s)-.5)*40,y,
    w:ww,h:hh,type:isLog?'log':rock?'rock':'crate',phase:rnd(s)*TAU});
  }
  x+=210+rnd(s)*110;wave++;
 }
}
function rectHit(x,y,r,o){
 const a=clamp(x,o.x-o.w/2,o.x+o.w/2),b=clamp(y,o.y-o.h/2,o.y+o.h/2);
 return (x-a)*(x-a)+(y-b)*(y-b)<r*r;
}
function blocked(s,x,y,r=C.radius){
 for(const o of s.obstacles){
  if(Math.abs(o.x-x)>o.w/2+r+1)continue;
  if(rectHit(x,y,r,o))return true;
 }
 return false;
}
function keepInLane(p,w){
 p.y=clamp(p.y,w.top+C.radius,w.bottom-C.radius);
 p.x=Math.max(C.radius,p.x);
}
function ejectCrates(s,p){
 for(const o of s.obstacles){
  const dx=p.x-o.x,dy=p.y-o.y;
  if(Math.abs(dx)>o.w/2+C.radius+2||Math.abs(dy)>o.h/2+C.radius+2)continue;
  if(!rectHit(p.x,p.y,C.radius,o))continue;
  const nearX=clamp(p.x,o.x-o.w/2,o.x+o.w/2);
  const nearY=clamp(p.y,o.y-o.h/2,o.y+o.h/2);
  let nx=p.x-nearX,ny=p.y-nearY,dist=hyp(nx,ny);
  if(dist<.0001){
   const left=Math.abs(p.x-(o.x-o.w/2)),right=Math.abs((o.x+o.w/2)-p.x);
   const up=Math.abs(p.y-(o.y-o.h/2)),down=Math.abs((o.y+o.h/2)-p.y);
   const m=Math.min(left,right,up,down);
   if(m===left)p.x=o.x-o.w/2-C.radius-.05;
   else if(m===right)p.x=o.x+o.w/2+C.radius+.05;
   else if(m===up)p.y=o.y-o.h/2-C.radius-.05;
   else p.y=o.y+o.h/2+C.radius+.05;
  }else{
   const shift=C.radius-dist+.05;
   p.x+=nx/dist*shift;p.y+=ny/dist*shift;
  }
 }
 keepInLane(p,s.world);
}
function botVector(s,p,dt){
 const d=p.dp,w=s.world;
 d.botTimer-=dt;
 if(d.botTimer<=0){
  d.botTimer=.28+rnd(s)*.17;
  let bestY=d.targetY??p.y,best=Infinity;
  const span=(w.bottom-w.top)/w.lanes;
  for(let lane=0;lane<w.lanes;lane++){
   const y=w.top+(lane+.5)*span;
   let score=Math.abs(y-p.y)*.13;
   if(Math.abs(y-d.targetY)>span*.35)score+=11;
   for(const o of s.obstacles){
    const ahead=o.x-p.x;
    if(ahead< -35||ahead>C.botLookAhead)continue;
    if(Math.abs(y-o.y)<o.h/2+C.radius+7){
     score+=85+135*(1-clamp(ahead/C.botLookAhead,0,1));
    }
    // Changing lanes too late can still collide with the current crate.
    const transition=clamp(ahead/150,0,1);
    const travelY=p.y+(y-p.y)*transition;
    if(ahead>0&&ahead<175&&Math.abs(travelY-o.y)<o.h/2+C.radius+5)
     score+=90*(1-ahead/180);
   }
   for(const q of racers(s.roster)){
    if(q===p)continue;
    const ahead=q.x-p.x;
    if(ahead>-18&&ahead<75&&Math.abs(q.y-y)<C.radius*2.4)score+=13;
   }
   score+=(hash(lane*41+s.tick*7+p.dp.botPhase)%1)*2;
   if(score<best){best=score;bestY=y;}
  }
  d.targetY=bestY;
 }
 const error=d.targetY-p.y;
 let x=1,y=clamp(error/65,-.82,.82);
 // React to an impending wall early; never read hidden actions or player inputs.
 for(const o of s.obstacles){
  if(o.x<p.x||o.x>p.x+78)continue;
  if(Math.abs(p.y-o.y)>o.h/2+C.radius+8)continue;
  if(Math.abs(error)<15)y=(p.y<o.y?-.85:.85);
 }
 const length=hyp(x,y)||1;
 return{x:x/length,y:y/length};
}
function movePlayer(s,p,dt){
 const d=p.dp,w=s.world,vec=p.isBot?botVector(s,p,dt):inputVector(p);
 d.oldX=p.x;d.oldY=p.y;
 let nx=p.x+vec.x*C.speed*dt;
 if(!blocked(s,nx,p.y))p.x=nx;
 let ny=p.y+vec.y*C.speed*dt;
 if(!blocked(s,p.x,ny))p.y=ny;
 keepInLane(p,w);
 p.vx=(p.x-d.oldX)/dt;p.vy=(p.y-d.oldY)/dt;
 if(hyp(vec.x,vec.y)>.08){p.dir={x:vec.x,y:vec.y};p.face=vec.x<-.01?-1:1;}
 d.farthest=Math.max(d.farthest,p.x);
}
function collideRacers(s){
 const live=racers(s.roster);
 for(let iter=0;iter<C.collisionIterations;iter++){
  for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){
   const a=live[i],b=live[j];
   let dx=b.x-a.x,dy=b.y-a.y,dist=hyp(dx,dy);
   if(dist>=C.radius*2)continue;
   if(dist<1e-7){dx=0;dy=a.id<b.id?1:-1;dist=1;}
   const nx=dx/dist,ny=dy/dist,overlap=C.radius*2-dist;
   // Both players resist equally. Contacts can slow forward movement and cost survival time.
   a.x-=nx*overlap*.5;a.y-=ny*overlap*.5;
   b.x+=nx*overlap*.5;b.y+=ny*overlap*.5;
  }
  for(const p of live){keepInLane(p,s.world);ejectCrates(s,p);}
 }
 for(const p of live){p.vx=(p.x-p.dp.oldX)/STEP;p.vy=(p.y-p.dp.oldY)/STEP;}
}
function effect(s,x,y,color){
 s.effects.push({x,y,color,life:.7,age:0});
 if(s.effects.length>24)s.effects.shift();
}
function eliminate(s,p,time){
 if(p.dp.status!=='running')return;
 p.dp.status='dead';p.dp.deadAt=Math.round(time*1e6)/1e6;
 p.dp.farthest=Math.max(p.dp.farthest,p.x);
 effect(s,p.x,p.y,p.color||'#fcdb94');
}
function finishPlayer(s,p,t){
 if(p.dp.status!=='running')return;
 p.dp.status='finished';p.dp.finishedAt=Math.round(t*1e6)/1e6;
 p.dp.farthest=s.world.finishX;p.x=s.world.finishX;
 effect(s,p.x,p.y,p.color||'#77da8b');
}
function valueFor(p){
 const d=p.dp;
 if(!d)return -Infinity;
 if(d.status==='finished')return 20000000-d.finishedAt;
 if(d.status==='running')return 10000000+d.farthest;
 return d.deadAt??-1;
}
function endGame(s,round){
 s.finished=true;round.remaining=0;
 const players=s.roster.filter(p=>p.active);
 const score=players.map(p=>({p,value:valueFor(p)}));
 s.ranking=score.map(({p,value})=>({id:p.id,value,rank:1+score.filter(q=>q.value>value).length}))
  .sort((a,b)=>a.rank-b.rank||String(a.id).localeCompare(String(b.id)));
 const best=Math.max(...score.map(x=>x.value));
 s.winnerIds=score.filter(x=>x.value===best).map(x=>x.p.id);
}
function step(dt,round){
 const s=round.dinoPanic;if(!s||s.finished)return;
 const previousTime=s.clock,oldFront=s.dinoFront;
 s.tick++;s.clock+=dt;s.dinoFront+=C.speed*dt;
 for(const p of racers(s.roster))movePlayer(s,p,dt);
 collideRacers(s);
 for(const p of racers(s.roster)){
  const d=p.dp;
  if(d.oldX<s.world.finishX&&p.x>=s.world.finishX){
   const f=clamp((s.world.finishX-d.oldX)/Math.max(1e-10,p.x-d.oldX),0,1);
   finishPlayer(s,p,previousTime+dt*f);
   continue;
  }
  const before=d.oldX-C.radius-oldFront;
  const after=p.x-C.radius-s.dinoFront;
  if(after<=0){
   const f=before<=0?0:clamp(before/(before-after||1),0,1);
   eliminate(s,p,previousTime+dt*f);
  }
 }
 for(const e of s.effects){e.age+=dt;e.life-=dt;}
 s.effects=s.effects.filter(e=>e.life>0);
 const active=racers(s.roster),finished=s.roster.filter(p=>p.active&&p.dp?.status==='finished');
 // If nobody finished and only one racer survives, there is already a winner.
 // With finishers on record, continue until all remaining racers finish/die.
 if(active.length===0||(s.originalCount>1&&finished.length===0&&active.length===1)||
    s.clock>=s.world.duration)endGame(s,round);
 else round.remaining=Math.max(0,s.world.duration-s.clock);
 const target=clamp(s.dinoFront-115,0,Math.max(0,s.world.w-VIEW_W));
 s.cameraX+=(target-s.cameraX)*Math.min(1,dt*10);
}
function setup(round,players){
 const n=players.length;if(n<1||n>12)throw Error('DINO PANIC supports 1–12 players');
 const world=tier(n);
 const s={world,seed:(Number(round.dinoSeed??round.seed)||(Date.now()^0x51a320))>>>0||1,
  roster:players,originalCount:n,clock:0,tick:0,accumulator:0,
  dinoFront:115,cameraX:0,obstacles:[],effects:[],finished:false,ranking:[],winnerIds:[]};
 round.dinoPanic=s;
 generateObstacles(s);
 const h=(world.bottom-world.top-2*C.radius),startY=world.top+C.radius;
 players.forEach((p,i)=>{
  const y=n===1?(world.top+world.bottom)/2:startY+h*i/(n-1);
  p.active=true;p.score=0;p.x=s.dinoFront+C.headStart;p.y=y;
  p.vx=p.vy=0;p.dir={x:1,y:0};p.face=1;
  p.dp={status:'running',oldX:p.x,oldY:p.y,farthest:p.x,
    deadAt:null,finishedAt:null,targetY:y,botTimer:.03+(i%5)*.045,botPhase:i};
 });
 round.remaining=world.duration;
 return s;
}
function update(dt,round){
 const s=round.dinoPanic;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.25,s.accumulator+clamp(Number(dt)||0,0,.25));
 let ticks=0;
 while(s.accumulator+1e-9>=STEP&&ticks++<15&&!s.finished){
  step(STEP,round);s.accumulator-=STEP;
 }
 return s.finished?'winner':null;
}
function circle(g,x,y,r,color){g.fillStyle=color;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();}
function dirt(g,x,y,size,color){g.fillStyle=color;g.beginPath();g.ellipse(x,y,size,size*.45,0,0,TAU);g.fill();}
function drawTree(g,x,y,seed){
 g.save();g.translate(x,y);
 const r=23+hash(seed)*17;
 circle(g,5,9,r+4,'#345b25');
 circle(g,-5,-2,r,'#448d38');
 circle(g,10,-8,r*.73,'#5c9e46');
 circle(g,-12,-11,r*.53,'#80bc52');
 g.strokeStyle='#2c6d2b';g.lineWidth=2;
 for(let i=0;i<5;i++){g.beginPath();g.moveTo(0,0);
  g.lineTo(Math.cos(i*TAU/5)*r*.7,Math.sin(i*TAU/5)*r*.65);g.stroke();}
 g.restore();
}
function drawBackground(g,s){
 const w=s.world,left=s.cameraX-100,right=left+VIEW_W+200;
 g.fillStyle='#b2a36a';g.fillRect(left,0,right-left,VIEW_H);
 g.fillStyle='#dca773';g.fillRect(left,w.top,right-left,w.bottom-w.top);
 g.fillStyle='#dcb083';g.fillRect(left,w.top+15,right-left,w.bottom-w.top-30);
 for(let x=Math.floor(left/100)*100;x<right;x+=100){
  const a=hash(Math.floor(x/100)*5+81);
  dirt(g,x+30*a,w.top+55+a*30,10+a*16,'#d9a071');
  dirt(g,x+70,w.bottom-42,7+a*15,'#c78e60');
  g.fillStyle='#aa855a';
  for(let j=0;j<3;j++){
   const px=x+hash(Math.floor(x)+j*31)*80;
   const yy=w.top+34+hash(Math.floor(x)*4+j*53)*(w.bottom-w.top-68);
   g.fillRect(px,yy,3+hash(j+x)*3,2);
  }
 }
 g.fillStyle='#4d7d39';g.fillRect(left,0,right-left,w.top-3);
 g.fillRect(left,w.bottom+3,right-left,VIEW_H-w.bottom);
 for(let i=Math.floor(left/74)-1;i<Math.floor(right/74)+2;i++){
  const x=i*74+hash(i*31)*17;
  drawTree(g,x,-12+hash(i*17)*13,i*37);
  drawTree(g,x,VIEW_H+7-hash(i*29)*14,i*79);
  if(i%3===0){
   circle(g,x+17,w.top-7,7,'#7e6c50');
   circle(g,x+22,w.bottom+7,8,'#77664b');
  }
 }
 g.strokeStyle='#9c7c4f';g.lineWidth=4;
 g.beginPath();g.moveTo(left,w.top);g.lineTo(right,w.top);
 g.moveTo(left,w.bottom);g.lineTo(right,w.bottom);g.stroke();
}
function drawObstacle(g,o){
 g.save();g.translate(o.x,o.y);
 g.fillStyle='rgba(55,34,20,.25)';g.fillRect(-o.w/2+4,-o.h/2+7,o.w,o.h);
 if(o.type==='rock'){
  g.fillStyle='#5b574d';g.beginPath();g.ellipse(0,0,o.w*.5,o.h*.48,.3,0,TAU);g.fill();
  g.fillStyle='#989080';g.beginPath();g.ellipse(-5,-6,o.w*.26,o.h*.2,.3,0,TAU);g.fill();
 }else if(o.type==='log'){
  g.rotate(-.1);g.fillStyle='#7f4e2c';g.fillRect(-o.w/2,-o.h/2,o.w,o.h);
  g.strokeStyle='#a87549';g.lineWidth=3;
  for(let x=-o.w/2+12;x<o.w/2;x+=16){g.beginPath();g.moveTo(x,-o.h/2);g.lineTo(x,o.h/2);g.stroke();}
  circle(g,-o.w/2,0,o.h*.48,'#bd905f');circle(g,o.w/2,0,o.h*.48,'#bd905f');
 }else{
  g.fillStyle='#4b5d63';g.fillRect(-o.w/2-3,-o.h/2-3,o.w+6,o.h+6);
  g.fillStyle='#ad6335';g.fillRect(-o.w/2,-o.h/2,o.w,o.h);
  g.fillStyle='#ca8752';g.fillRect(-o.w/2+5,-o.h/2+5,o.w-10,o.h-10);
  g.strokeStyle='#77472f';g.lineWidth=3;g.strokeRect(-o.w/2+6,-o.h/2+6,o.w-12,o.h-12);
  g.beginPath();g.moveTo(-o.w/2+6,-o.h/2+6);g.lineTo(o.w/2-6,o.h/2-6);
  g.moveTo(o.w/2-6,-o.h/2+6);g.lineTo(-o.w/2+6,o.h/2-6);g.stroke();
  for(const x of [-o.w/2+2,o.w/2-2])for(const y of [-o.h/2+2,o.h/2-2])circle(g,x,y,3,'#aeb7bc');
 }
 g.restore();
}
function drawDino(g,s){
 const y=(s.world.top+s.world.bottom)/2;
 g.save();g.translate(s.dinoFront-200,y);
 // A giant armored, blue prehistoric predator, advancing its snout to x=front.
 g.fillStyle='rgba(66,31,22,.3)';g.beginPath();g.ellipse(75,48,174,116,0,0,TAU);g.fill();
 g.fillStyle='#184a69';g.beginPath();g.ellipse(38,0,153,127,-.08,0,TAU);g.fill();
 g.fillStyle='#2f8dab';g.beginPath();g.ellipse(61,-14,142,110,-.08,0,TAU);g.fill();
 for(let i=0;i<9;i++){
  const t=(i-4)*.28,x=28+Math.cos(t)*100,y0=Math.sin(t)*92;
  g.fillStyle=i%2?'#d6d3c2':'#e8e7db';
  g.beginPath();g.ellipse(x-15,y0-17,16+hash(i*17)*10,25,.22,0,TAU);g.fill();
  g.strokeStyle='#9cbaad';g.lineWidth=2;g.stroke();
 }
 g.fillStyle='#5c4777';g.beginPath();g.ellipse(144,7,78,78,.1,0,TAU);g.fill();
 g.fillStyle='#89669e';g.beginPath();g.ellipse(151,-20,61,55,.3,0,TAU);g.fill();
 for(let i=0;i<5;i++){
  const a=-1.25+i*.52;
  circle(g,151+48*Math.cos(a),-22+52*Math.sin(a),9,'#e5e3d8');
 }
 // Eye and armored jaw.
 circle(g,177,-26,12,'#eedcae');circle(g,181,-26,5,'#261e23');
 g.fillStyle='#225276';g.beginPath();g.ellipse(178,38,37,20,-.22,0,TAU);g.fill();
 g.fillStyle='#e4d5b3';for(let i=0;i<4;i++){g.beginPath();
  g.moveTo(165+i*12,47);g.lineTo(170+i*12,35);g.lineTo(176+i*12,47);g.fill();}
 g.restore();
}
function drawFinish(g,s){
 const x=s.world.finishX,top=s.world.top,bottom=s.world.bottom;
 g.fillStyle='#f9e8b2';g.fillRect(x-7,top,14,bottom-top);
 for(let y=top;y<bottom;y+=22){
  g.fillStyle=(Math.floor((y-top)/22)%2)?'#242424':'#f5f2e7';
  g.fillRect(x-7,y,7,22);
  g.fillStyle=(Math.floor((y-top)/22)%2)?'#f5f2e7':'#242424';
  g.fillRect(x,y,7,22);
 }
 g.fillStyle='#d6a844';g.fillRect(x-35,top-18,70,24);
 g.fillStyle='#fffdf0';g.font='bold 14px sans-serif';g.textAlign='center';
 g.fillText('FINISH',x,top);
}
function draw(g,unused,round){
 const s=round.dinoPanic;if(!s)return;
 const w=s.world;g.save();
 g.fillStyle='#4b773d';g.fillRect(0,0,VIEW_W,VIEW_H);
 g.translate(-s.cameraX,0);
 drawBackground(g,s);
 for(const o of s.obstacles)if(o.x+o.w/2>s.cameraX-40&&o.x-o.w/2<s.cameraX+VIEW_W+40)
  drawObstacle(g,o);
 if(w.finishX>=s.cameraX-30&&w.finishX<=s.cameraX+VIEW_W+35)drawFinish(g,s);
 drawDino(g,s);
 const visible=racers(s.roster).slice().sort((a,b)=>a.y-b.y);
 for(const p of visible){
  if(window.PartyCharacters?.draw)window.PartyCharacters.draw(g,p,{time:s.clock,label:false});
  else circle(g,p.x,p.y,C.radius,p.color||'#ffcf55');
 }
 for(const e of s.effects){
  g.save();g.globalAlpha=clamp(e.life/.7,0,1);
  g.strokeStyle=e.color;g.lineWidth=4;g.beginPath();
  g.arc(e.x,e.y,14+40*e.age/.7,0,TAU);g.stroke();g.restore();
 }
 g.restore();
}
function hud(ps,round){
 const s=round.dinoPanic;
 return{survivors:s?racers(s.roster).length:0,
  remaining:round.remaining??null,elapsed:s?.clock||0,winnerIds:s?.winnerIds||[]};
}
function getResult(round,ps){
 return ps.filter(p=>p.active).map(p=>{
  const d=p.dp||{},label=d.status==='finished'?'เข้าเส้นชัย '+d.finishedAt.toFixed(3)+' วิ':
   d.status==='dead'?'ถูกเหยียบ '+d.deadAt.toFixed(3)+' วิ':'ระยะ '+Math.round(d.farthest||0);
  return{id:p.id,value:valueFor(p),label};
 });
}
function getRoster(round,ps){
 return ps.filter(p=>p.active).map(p=>({id:p.id,value:valueFor(p),
  status:p.dp?.status||'running',eliminated:p.dp?.status==='dead',
  label:p.dp?.status==='finished'?'FINISH':p.dp?.status==='dead'?'ตกรอบ':'กำลังหนี'}));
}
function getControllerPacket(p,round){
 return{t:'dino-panic-status',mode:round.mode,
  status:p.dp?.status||'running',survivors:round.dinoPanic?racers(round.dinoPanic.roster).length:0};
}
function dispose(round){
 const s=round.dinoPanic;if(!s)return;
 s.effects.length=0;s.obstacles.length=0;
}
const engine=Object.freeze({setup,update,draw,hud,getResult,getRoster,getControllerPacket,dispose,
 countdownSeconds:3,resultTitle:'หนีไดโนเสาร์สำเร็จ!',config:C,tier,step});
export default engine;
