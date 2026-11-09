/* WITCHING SNAKE — authoritative 60 Hz broom flight and dangerous magic trails. */
(() => {
'use strict';
const TAU=Math.PI*2, STEP=1/60, CELL=40;
const CONFIG=Object.freeze({
 small:Object.freeze({width:960,height:540,rx:292,ry:222,trailStart:190,trailGain:48,trailMax:520,stars:2}),
 large:Object.freeze({width:1280,height:720,rx:490,ry:300,trailStart:230,trailGain:65,trailMax:760,stars:4}),
 // 20% more steering authority; maintain original broom speed and light slip.
 speed:173, turnMax:2.64, turnAcceleration:10.8, slip:.075, radius:12,
 trailRadius:3.4, selfGap:41, sample:8, soloDuration:60, overtimeStart:120,
 overtimeLength:75, minArenaScale:.18, starRadius:14
});
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const living=ps=>ps.filter(p=>p.active&&p.ws?.alive);
const random=s=>{let n=s.seed|0;n^=n<<13;n^=n>>>17;n^=n<<5;s.seed=n||1;return(s.seed>>>0)/4294967296;};
// Give each match fresh entropy, but honor an explicit seed for reproducible QA.
function matchSeed(round){
 const chosen=Number(round?.witchSeed);
 if(Number.isFinite(chosen)&&chosen!==0)return(chosen>>>0)||1;
 let entropy=0;
 try{
  const bytes=new Uint32Array(1);
  window.crypto?.getRandomValues?.(bytes);
  entropy=bytes[0];
 }catch(_){}
 return entropy||((Math.random()*4294967296)>>>0)||(Date.now()>>>0)||1;
}
function polygon(s,scale=1){
 // A broad, 12-facet oval: long upper/lower rails and gently chamfered ends.
 // The identical world polygon drives rendering, pickups, bots and collision.
 const shape=[[-.65,-.98],[.65,-.98],[.9,-.8],[1,-.38],
  [1,.38],[.9,.8],[.65,.98],[-.65,.98],
  [-.9,.8],[-1,.38],[-1,-.38],[-.9,-.8]];
 return shape.map(([x,y])=>({x:s.w/2+x*s.rx*scale,y:s.h/2+y*s.ry*scale}));
}
function inside(s,x,y,padding=0,scale=s.arenaScale){
 const poly=polygon(s,scale);let sign=0;
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length];
  const cross=(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x);
  if(cross<0)return false;
  if(padding){
   const edge=Math.hypot(b.x-a.x,b.y-a.y);
   if(cross/edge<padding)return false;
  }
  sign++;
 }
 return sign===poly.length;
}
function distPointSegment2(p,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,div=dx*dx+dy*dy||1;
 const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/div,0,1);
 return (p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2;
}
function segmentsTouch(a,b,c,d,r){
 const cross=(p,q,v)=>(q.x-p.x)*(v.y-p.y)-(q.y-p.y)*(v.x-p.x);
 const a1=cross(a,b,c),a2=cross(a,b,d),b1=cross(c,d,a),b2=cross(c,d,b);
 // Strict crossings; collinear but disjoint segments must not be false positives.
 if(a1*a2<0&&b1*b2<0)return true;
 const limit=r*r;
 return distPointSegment2(a,c,d)<=limit||distPointSegment2(b,c,d)<=limit||
  distPointSegment2(c,a,b)<=limit||distPointSegment2(d,a,b)<=limit;
}
function rear(p){const a=p.ws.heading;return{x:p.x-Math.cos(a)*19,y:p.y-Math.sin(a)*19};}
function addTrail(p){
 const w=p.ws,pt=rear(p),nodes=w.trail;
 if(!nodes.length){nodes.push({...pt,d:w.distance});return;}
 const last=nodes[nodes.length-1],dx=pt.x-last.x,dy=pt.y-last.y,len=Math.hypot(dx,dy);
 if(len<.05)return;
 const parts=Math.ceil(len/CONFIG.sample);
 for(let i=1;i<=parts;i++){
  const d=len/parts,from=nodes[nodes.length-1];
  nodes.push({x:last.x+dx*i/parts,y:last.y+dy*i/parts,d:from.d+d});
 }
 w.distance=nodes[nodes.length-1].d;
 const cutoff=w.distance-w.trailCap;
 while(nodes.length>2&&nodes[1].d<=cutoff)nodes.shift();
 if(nodes.length>1&&nodes[0].d<cutoff){
  const a=nodes[0],b=nodes[1],t=clamp((cutoff-a.d)/(b.d-a.d||1),0,1);
  nodes[0]={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,d:cutoff};
 }
}
function indexTrails(s,ps){
 const map=new Map();
 for(const p of ps){
  const w=p.ws;if(!w||(!w.alive&&w.fade<=0)||w.trail.length<2)continue;
  if(!w.alive)continue; // dead trails become visual-only after the death tick
  for(let i=1;i<w.trail.length;i++){
   const a=w.trail[i-1],b=w.trail[i],entry={a,b,owner:p};
   const x0=Math.floor((Math.min(a.x,b.x)-5)/CELL),x1=Math.floor((Math.max(a.x,b.x)+5)/CELL);
   const y0=Math.floor((Math.min(a.y,b.y)-5)/CELL),y1=Math.floor((Math.max(a.y,b.y)+5)/CELL);
   for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
    const key=x+','+y;if(!map.has(key))map.set(key,[]);map.get(key).push(entry);
   }
  }
 }
 s.grid=map;
}
function nearby(s,a,b,r=20){
 const x0=Math.floor((Math.min(a.x,b.x)-r)/CELL),x1=Math.floor((Math.max(a.x,b.x)+r)/CELL);
 const y0=Math.floor((Math.min(a.y,b.y)-r)/CELL),y1=Math.floor((Math.max(a.y,b.y)+r)/CELL);
 const found=new Set();
 for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
  for(const entry of s.grid.get(x+','+y)||[])found.add(entry);
 }
 return found;
}
function strikesTrail(s,p,a,b){
 for(const e of nearby(s,a,b,CONFIG.radius+CONFIG.trailRadius)){
  if(e.owner===p&&p.ws.distance-e.b.d<CONFIG.selfGap)continue;
  if(segmentsTouch(a,b,e.a,e.b,CONFIG.radius+CONFIG.trailRadius))return true;
 }
 return false;
}
function steer(w,desired,dt){
 const diff=angleDiff(desired,w.heading);
 const wanted=clamp(diff*3.5,-CONFIG.turnMax,CONFIG.turnMax);
 w.angular+=clamp(wanted-w.angular,-CONFIG.turnAcceleration*dt,CONFIG.turnAcceleration*dt);
 w.angular=clamp(w.angular,-CONFIG.turnMax,CONFIG.turnMax);
 w.heading+=w.angular*dt;
 w.moveHeading+=angleDiff(w.heading,w.moveHeading)*Math.min(1,dt*(1-CONFIG.slip)*21);
}
function vector(input){
 if(window.PartyCharacters?.control)return window.PartyCharacters.control(input);
 const i=input||{};const x=Number(i.axisX)||Number(!!i.right)-Number(!!i.left);
 const y=Number(i.axisY)||Number(!!i.down)-Number(!!i.jump);const m=Math.hypot(x,y);
 return{x:m>1?x/m:x,y:m>1?y/m:y};
}
function move(w,p,dt,aim){
 if(Number.isFinite(aim))steer(w,aim,dt);
 else{
  steer(w,w.heading,dt);
 }
 p.x+=Math.cos(w.moveHeading)*CONFIG.speed*dt;
 p.y+=Math.sin(w.moveHeading)*CONFIG.speed*dt;
 p.vx=Math.cos(w.moveHeading)*CONFIG.speed;
 p.vy=Math.sin(w.moveHeading)*CONFIG.speed;
 p.dir={x:Math.cos(w.heading),y:Math.sin(w.heading)};p.face=p.dir.x<0?-1:1;
}
function botPlan(s,p,ps){
 const w=p.ws,style=w.botStyle||{orbit:.5,caution:1,starDrive:1,turnBias:0};
 const star=s.stars.filter(v=>Math.hypot(v.x-p.x,v.y-p.y)<250)
  .sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
 // Choose from a richer range; varied preferences stop every bot circling
 // the same central lane. The same explicit seed still reproduces QA runs.
 const candidates=[-1.7,-1.3,-.95,-.65,-.34,0,.34,.65,.95,1.3,1.7];
 let best=-Infinity,bestHeading=w.heading;
 for(const turn of candidates){
  const aim=w.heading+turn+style.turnBias,trial={heading:w.heading,moveHeading:w.moveHeading,angular:w.angular};
  const pos={x:p.x,y:p.y,dir:p.dir,face:p.face};
  let score=-Math.abs(turn)*(.3+.25*style.caution),collision=false;
  for(let k=0;k<11;k++){
   const previous={x:pos.x,y:pos.y};
   move(trial,pos,.13,aim);
   if(!inside(s,pos.x,pos.y,CONFIG.radius+6)){collision=true;break;}
   if(strikesTrail(s,p,previous,pos)){collision=true;break;}
   const dx=(pos.x-s.w/2)/s.rx,dy=(pos.y-s.h/2)/s.ry;
   score+=.025*(1-Math.hypot(dx,dy));
  }
  if(collision)score-=400;
  else{
   const near=Math.hypot((pos.x-s.w/2)/s.rx,(pos.y-s.h/2)/s.ry);
   // Each bot prefers its own safe orbit radius rather than funneling center.
   score+=1.5-2.3*Math.abs(near-style.orbit);
   if(!inside(s,pos.x,pos.y,CONFIG.radius+22))score-=.8*style.caution;
   // Avoid steering straight into the other living brooms.
   for(const other of ps){
    if(other===p||!other.ws?.alive||!other.active)continue;
    const d=Math.hypot(pos.x-other.x,pos.y-other.y);
    if(d<85)score-=((85-d)/85)*1.3*style.caution;
   }
   if(star&&w.trailCap<s.settings.trailMax){
    const start=Math.hypot(p.x-star.x,p.y-star.y);
    const finish=Math.hypot(pos.x-star.x,pos.y-star.y);
    score+=clamp((start-finish)/150,-.7,.7)*2.2*style.starDrive;
   }
   // Small reproducible exploration allows varied turn decisions.
   score+=random(s)*.16;
  }
  if(score>best){best=score;bestHeading=aim;}
 }
 return bestHeading;
}
function spawnPositions(s,count){
 const result=[],rotation=random(s)*TAU,clockwise=random(s)<.5?-1:1;
 for(let i=0;i<count;i++){
  // Evenly spaced for fairness, with a new orientation and slight stagger
  // per match. Jitter is capped to avoid crowding in 7–12-player rooms.
  const theta=-Math.PI/2+rotation+TAU*i/count+
   (random(s)-.5)*Math.min(.15,TAU/count*.2);
  const radius=(count===1?.3:count<=3?.38:.46)+(random(s)-.5)*.065;
  const x=s.w/2+s.rx*radius*Math.cos(theta);
  const y=s.h/2+s.ry*radius*Math.sin(theta);
  const facing=theta+clockwise*Math.PI/2+(random(s)-.5)*.19;
  result.push({x,y,heading:facing});
 }
 return result;
}
function setup(round,ps){
 if(ps.length<1||ps.length>12)throw Error('WITCHING SNAKE supports 1–12 players');
 const cfg=ps.length>6?CONFIG.large:CONFIG.small;
 const s={w:cfg.width,h:cfg.height,rx:cfg.rx,ry:cfg.ry,settings:cfg,clock:0,tick:0,
  accumulator:0,arenaScale:1,seed:matchSeed(round),
  stars:[],starClock:0,grid:new Map(),finished:false,winnerIds:[],ranking:[],roster:ps};
 s.boundary=polygon(s);window.PartyArenaScenes?.preload('witch',s);
 round.witchingSnake=s;round.remaining=ps.length===1?CONFIG.soloDuration:null;
 const positions=spawnPositions(s,ps.length);
 for(let i=0;i<ps.length;i++){
  const p=ps[i],q=positions[i];p.active=true;p.score=0;p.x=q.x;p.y=q.y;
  p.vx=0;p.vy=0;p.face=1;p.dir={x:Math.cos(q.heading),y:Math.sin(q.heading)};
  p.ws={alive:true,heading:q.heading,moveHeading:q.heading,angular:0,trail:[],
   trailCap:cfg.trailStart,distance:0,stars:0,eliminatedTick:null,
   eliminatedAt:null,fade:0,botPlan:q.heading,botClock:0,
   botStyle:{orbit:.34+random(s)*.37,caution:.75+random(s)*.65,
    starDrive:.55+random(s)*1.1,turnBias:(random(s)-.5)*.18,
    reaction:.13+random(s)*.12}};
 }
 return s;
}
function addStars(s,ps){
 const count=s.stars.length,limit=s.settings.stars;
 if(count>=limit)return;
 for(let a=0;a<60;a++){
  const x=s.w/2+(random(s)*2-1)*s.rx*.78,y=s.h/2+(random(s)*2-1)*s.ry*.76;
  if(!inside(s,x,y,CONFIG.starRadius+24))continue;
  if(living(ps).some(p=>Math.hypot(x-p.x,y-p.y)<65))continue;
  const pt={x,y};
  if(nearby(s,pt,pt,CONFIG.starRadius+15).size)continue;
  if(s.stars.some(v=>Math.hypot(v.x-x,v.y-y)<60))continue;
  s.stars.push({x,y,phase:random(s)*TAU});break;
 }
}
function eliminate(s,p){
 if(!p.ws?.alive)return;
 p.ws.alive=false;p.ws.eliminatedTick=s.tick;p.ws.eliminatedAt=s.clock;p.ws.fade=.95;
 p.ws.angular=0;
}
function finish(s,round,ps){
 s.finished=true;s.winnerIds=living(ps).map(p=>p.id);
 const value=p=>p.ws?.alive?Infinity:(p.ws?.eliminatedTick??-1);
 s.ranking=ps.filter(p=>p.active).map(p=>({id:p.id,value:value(p),
  rank:1+ps.filter(q=>q.active&&value(q)>value(p)).length}))
  .sort((a,b)=>a.rank-b.rank||String(a.id).localeCompare(String(b.id)));
 round.remaining=0;
}
function step(dt,round,ps){
 const s=round.witchingSnake;if(s.finished)return;
 s.clock+=dt;s.tick++;
 s.arenaScale=s.clock<=CONFIG.overtimeStart?1:
  Math.max(CONFIG.minArenaScale,1-(s.clock-CONFIG.overtimeStart)/CONFIG.overtimeLength*(1-CONFIG.minArenaScale));
 const old=new Map();
 const live=living(ps);
 for(const p of live){
  old.set(p.id,{x:p.x,y:p.y});const w=p.ws;
  if(p.isBot){
   w.botClock-=dt;
   if(w.botClock<=0){w.botPlan=botPlan(s,p,ps);w.botClock=(w.botStyle?.reaction||.14)*(0.85+random(s)*.3);}
  }
  const input=p.isBot?null:vector(p.input);
  const aim=p.isBot?w.botPlan:Math.hypot(input.x,input.y)>.14?Math.atan2(input.y,input.x):null;
  move(w,p,dt,aim);
 }
 if(window.PartyCharacters?.resolve&&live.length>1)
  window.PartyCharacters.resolve(live,{radius:CONFIG.radius,iterations:3,maxShift:5,pressure:true});
 for(const p of live)addTrail(p);
 indexTrails(s,ps);
 const dead=[];
 for(const p of live){
  const a=old.get(p.id),b={x:p.x,y:p.y};
  if(!inside(s,b.x,b.y,CONFIG.radius)||strikesTrail(s,p,a,b))dead.push(p);
 }
 // Resolve simultaneous eliminations only after testing every moving witch.
 for(const p of dead)eliminate(s,p);
 for(const p of ps)if(p.ws&&!p.ws.alive)p.ws.fade=Math.max(0,p.ws.fade-dt);
 if(s.clock>=s.starClock){
  addStars(s,ps);s.starClock=s.clock+7+random(s)*4;
 }
 for(let i=s.stars.length-1;i>=0;i--){
  const star=s.stars[i],claim=living(ps).find(p=>
   distPointSegment2(star,old.get(p.id)||{x:p.x,y:p.y},p)<=Math.pow(CONFIG.radius+CONFIG.starRadius,2));
  if(!claim)continue;
  const w=claim.ws;w.trailCap=Math.min(s.settings.trailMax,w.trailCap+s.settings.trailGain);
  w.stars++;s.stars.splice(i,1);
 }
 indexTrails(s,ps);
 const survivors=living(ps);
 if(ps.filter(p=>p.active).length===1){
  if(s.clock>=CONFIG.soloDuration||survivors.length===0)finish(s,round,ps);
  round.remaining=Math.max(0,CONFIG.soloDuration-s.clock);
 }else if(survivors.length<=1)finish(s,round,ps);
}
function update(dt,round,ps){
 const s=round.witchingSnake;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.25,s.accumulator+clamp(Number(dt)||0,0,.25));
 let count=0;
 while(s.accumulator+1e-10>=STEP&&count++<15&&!s.finished){
  step(STEP,round,ps);s.accumulator-=STEP;
 }
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.witchingSnake;
 return {survivors:living(ps).length,remaining:round.remaining,elapsed:s?.clock||0,
  winnerIds:s?.winnerIds||[],statuses:ps.filter(p=>p.active).map(p=>({id:p.id,alive:!!p.ws?.alive,stars:p.ws?.stars||0}))};
}
function circle(g,x,y,r,fill){
 g.fillStyle=fill;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();
}
function traceArena(g,points){
 g.beginPath();
 for(let i=0;i<points.length;i++){
  const v=points[i];if(i===0)g.moveTo(v.x,v.y);else g.lineTo(v.x,v.y);
 }
 g.closePath();
}
function artArena(g,s,time){
 window.PartyArenaScenes.witch(g,s);
 if(s.arenaScale<1){
  const safe=polygon(s,s.arenaScale);
  g.save();g.beginPath();g.rect(0,0,s.w,s.h);
  safe.forEach((v,i)=>i?g.lineTo(v.x,v.y):g.moveTo(v.x,v.y));g.closePath();
  g.fillStyle='rgba(6,9,28,.52)';g.fill('evenodd');
  g.shadowColor='#ffd27d';g.shadowBlur=12;
  g.strokeStyle='#efac64';g.lineWidth=5;g.stroke();
  g.restore();
 }
}
function artStar(g,p,t){
 g.save();g.translate(p.x,p.y+Math.sin(t*2+p.phase)*3);
 g.rotate(t*.5+p.phase);g.strokeStyle='#b6b4fa';g.lineWidth=1.5;
 g.beginPath();g.arc(0,0,19,0,TAU);g.stroke();
 g.rotate(-t*.9);
 g.beginPath();for(let i=0;i<12;i++){const a=i*Math.PI/6-Math.PI/2,r=i%2?7:16;
  i?g.lineTo(Math.cos(a)*r,Math.sin(a)*r):g.moveTo(Math.cos(a)*r,Math.sin(a)*r);}
 g.closePath();g.fillStyle='#ffe69a';g.shadowColor='#f7c35c';g.shadowBlur=14;g.fill();
 circle(g,0,0,3,'#ffffff');g.restore();
}
function draw(g,t,round,ps){
 const s=round.witchingSnake;if(!s)return;
 g.save();g.scale(960/s.w,540/s.h);artArena(g,s,t);
 for(const p of ps){
  const w=p.ws;if(!w||w.trail.length<2||(!w.alive&&w.fade<=0))continue;
  g.save();g.globalAlpha=w.alive?1:w.fade/.95;
  const line=(width,color,blur)=>{
   g.beginPath();g.moveTo(w.trail[0].x,w.trail[0].y);
   for(let i=1;i<w.trail.length;i++)g.lineTo(w.trail[i].x,w.trail[i].y);
   g.lineCap='round';g.lineJoin='round';g.lineWidth=width;g.strokeStyle=color;
   g.shadowColor=p.color||'#c7a4ff';g.shadowBlur=blur;g.stroke();
  };
  line(11,p.color||'#c7a4ff',14);line(3.5,'#f6eeff',3);g.restore();
 }
 for(const star of s.stars)artStar(g,star,t);
 for(const p of ps)if(p.ws)window.PartyArenaScenes.witchRider(g,s,p,t);
 g.restore();
 // app.js paints the common clock for countdown/solo, or SVG headcount for
 // multiplayer survival; avoid painting a competing elapsed-time badge here.
}
window.WitchingSnake=Object.freeze({setup,update,draw,hud,step,spawnPositions,
 inside,segmentsTouch,distPointSegment2,addTrail,indexTrails,strikesTrail,
 eliminate,finish,config:CONFIG});
})();
