/* WITCHING SNAKE — authoritative 60 Hz broom flight and dangerous magic trails. */
(() => {
'use strict';
const TAU=Math.PI*2, STEP=1/60, CELL=40;
const CONFIG=Object.freeze({
 small:Object.freeze({width:960,height:540,rx:319,ry:206,trailStart:190,trailGain:48,trailMax:520,stars:2}),
 large:Object.freeze({width:1280,height:720,rx:437,ry:281,trailStart:230,trailGain:65,trailMax:760,stars:4}),
 speed:173, turnMax:2.2, turnAcceleration:9, slip:.075, radius:12,
 trailRadius:3.4, selfGap:41, sample:8, soloDuration:60, overtimeStart:120,
 overtimeLength:75, minArenaScale:.18, starRadius:14
});
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const living=ps=>ps.filter(p=>p.active&&p.ws?.alive);
const random=s=>{let n=s.seed|0;n^=n<<13;n^=n>>>17;n^=n<<5;s.seed=n||1;return(s.seed>>>0)/4294967296;};
function polygon(s,scale=1){
 const result=[];
 for(let i=0;i<12;i++){
  const a=i*TAU/12;
  result.push({x:s.w/2+Math.cos(a)*s.rx*scale,y:s.h/2+Math.sin(a)*s.ry*scale});
 }
 return result;
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
 const w=p.ws,star=s.stars.filter(v=>Math.hypot(v.x-p.x,v.y-p.y)<230)
  .sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
 const candidates=[-1.35,-.8,-.4,0,.4,.8,1.35];
 let best=-Infinity,bestHeading=w.heading;
 for(const turn of candidates){
  const aim=w.heading+turn,trial={heading:w.heading,moveHeading:w.moveHeading,angular:w.angular};
  const pos={x:p.x,y:p.y,dir:p.dir,face:p.face};
  let score=-Math.abs(turn)*.8,collision=false;
  for(let k=0;k<11;k++){
   const previous={x:pos.x,y:pos.y};
   move(trial,pos,.13,aim);
   if(!inside(s,pos.x,pos.y,CONFIG.radius+6)){collision=true;break;}
   if(strikesTrail(s,p,previous,pos)){collision=true;break;}
   const dx=(pos.x-s.w/2)/s.rx,dy=(pos.y-s.h/2)/s.ry;
   score+=.04*(1-Math.hypot(dx,dy));
  }
  if(collision)score-=400;
  else{
   const near=Math.hypot((pos.x-s.w/2)/s.rx,(pos.y-s.h/2)/s.ry);
   score+=1.2*(1-near)+1.6;
   if(star&&w.trailCap<s.settings.trailMax){
    const start=Math.hypot(p.x-star.x,p.y-star.y);
    const finish=Math.hypot(pos.x-star.x,pos.y-star.y);
    score+=clamp((start-finish)/150,-.7,.7)*2;
   }
   score+=Math.sin(Number(String(p.id).length)*2.3+turn*3)*.07;
  }
  if(score>best){best=score;bestHeading=aim;}
 }
 return bestHeading;
}
function spawnPositions(s,count){
 const result=[];
 for(let i=0;i<count;i++){
  const theta=-Math.PI/2+TAU*i/count;
  const r=count===1?.3:count<=3?.38:.46;
  const x=s.w/2+s.rx*r*Math.cos(theta),y=s.h/2+s.ry*r*Math.sin(theta);
  const facing=theta+Math.PI/2+(i%2===0?.10:-.1);
  result.push({x,y,heading:facing});
 }
 return result;
}
function setup(round,ps){
 if(ps.length<1||ps.length>12)throw Error('WITCHING SNAKE supports 1–12 players');
 const cfg=ps.length>6?CONFIG.large:CONFIG.small;
 const s={w:cfg.width,h:cfg.height,rx:cfg.rx,ry:cfg.ry,settings:cfg,clock:0,tick:0,
  accumulator:0,arenaScale:1,seed:(Number(round.witchSeed)||1357911)>>>0||1,
  stars:[],starClock:0,grid:new Map(),finished:false,winnerIds:[],ranking:[],roster:ps};
 round.witchingSnake=s;round.remaining=ps.length===1?CONFIG.soloDuration:null;
 const positions=spawnPositions(s,ps.length);
 for(let i=0;i<ps.length;i++){
  const p=ps[i],q=positions[i];p.active=true;p.score=0;p.x=q.x;p.y=q.y;
  p.vx=0;p.vy=0;p.face=1;p.dir={x:Math.cos(q.heading),y:Math.sin(q.heading)};
  p.ws={alive:true,heading:q.heading,moveHeading:q.heading,angular:0,trail:[],
   trailCap:cfg.trailStart,distance:0,stars:0,eliminatedTick:null,
   eliminatedAt:null,fade:0,botPlan:q.heading,botClock:0};
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
   if(w.botClock<=0){w.botPlan=botPlan(s,p,ps);w.botClock=.14+(random(s)*.08);}
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
function circle(g,x,y,r,fill){g.fillStyle=fill;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();}
function artArena(g,s,time){
 g.fillStyle='#080d26';g.fillRect(0,0,s.w,s.h);
 const poly=polygon(s);g.beginPath();poly.forEach((v,i)=>i?g.lineTo(v.x,v.y):g.moveTo(v.x,v.y));g.closePath();
 g.fillStyle='#222346';g.fill();g.strokeStyle='#9574d8';g.lineWidth=11;g.stroke();
 g.save();g.clip();
 for(let i=0;i<6;i++){
  g.beginPath();g.ellipse(s.w/2,s.h/2,s.rx*(.25+i*.12),s.ry*(.25+i*.12),0,0,TAU);
  g.strokeStyle=i%2?'#4b4776':'#686193';g.globalAlpha=.24;g.lineWidth=2;g.stroke();
 }
 g.globalAlpha=.18;g.strokeStyle='#b8a4e7';g.lineWidth=1;
 for(let a=0;a<TAU;a+=Math.PI/6){
  g.beginPath();g.moveTo(s.w/2,s.h/2);
  g.lineTo(s.w/2+s.rx*Math.cos(a),s.h/2+s.ry*Math.sin(a));g.stroke();
 }
 g.restore();
 if(s.arenaScale<1){
  const sh=polygon(s,s.arenaScale);g.beginPath();g.rect(0,0,s.w,s.h);sh.forEach((v,i)=>i?g.lineTo(v.x,v.y):g.moveTo(v.x,v.y));g.closePath();
  g.fillStyle='rgba(5,8,25,.46)';g.fill('evenodd');
  g.strokeStyle='#f4ae64';g.lineWidth=5;g.stroke();
 }
 for(let i=0;i<12;i++){
  const p=poly[i];circle(g,p.x,p.y,4,'#d5b5ff');
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
function artWitch(g,p,t){
 const w=p.ws;if(!w.alive&&w.fade<=0)return;
 g.save();g.globalAlpha=w.alive?1:w.fade/.95;
 circle(g,p.x+3,p.y+9,14,'rgba(3,2,18,.34)');
 g.translate(p.x,p.y);g.rotate(w.heading);
 const tilt=clamp(w.angular/CONFIG.turnMax,-1,1);
 g.rotate(tilt*.11);
 g.strokeStyle='#ac8254';g.lineWidth=5;g.lineCap='round';g.beginPath();g.moveTo(-25,0);g.lineTo(23,0);g.stroke();
 g.fillStyle='#d4a56e';g.beginPath();g.moveTo(-25,-9);g.lineTo(-39,0);g.lineTo(-25,9);g.closePath();g.fill();
 g.fillStyle=p.color||'#b794f9';g.beginPath();g.moveTo(-15,-11-tilt*2);
 g.quadraticCurveTo(-25,0,-16,12+tilt*2);g.lineTo(6,10);g.lineTo(9,-9);g.closePath();g.fill();
 circle(g,-1,0,9,'#efcbb5');
 g.fillStyle='#272042';g.beginPath();g.ellipse(0,-6,16,6,0,0,TAU);g.fill();
 g.beginPath();g.moveTo(-9,-7);g.lineTo(-4,-30);g.lineTo(10,-7);g.closePath();g.fill();
 g.strokeStyle=p.color||'#e9c1ff';g.lineWidth=2;g.beginPath();g.moveTo(-10,-7);g.lineTo(10,-7);g.stroke();
 g.strokeStyle='#f8e4d2';g.lineWidth=3;
 g.beginPath();g.moveTo(1,8);g.lineTo(13,3);g.moveTo(-4,8);g.lineTo(10,5);g.stroke();
 g.restore();
 g.save();g.font='bold 13px system-ui';g.textAlign='center';
 g.lineWidth=3;g.strokeStyle='#09102d';g.fillStyle='#fff';
 const name=String(p.name||'แม่มด').slice(0,16);g.strokeText(name,p.x,p.y-39);g.fillText(name,p.x,p.y-39);g.restore();
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
 for(const p of ps)if(p.ws)artWitch(g,p,t);
 g.fillStyle='rgba(7,9,30,.78)';g.fillRect(12,10,209,57);
 g.textAlign='left';g.font='900 19px system-ui';g.fillStyle='#fff';
 g.fillText('WITCHING SNAKE',24,34);g.font='bold 13px system-ui';
 const status=round.phase==='countdown'?'เริ่มใน '+Math.ceil(round.countdown):
  'รอด '+living(ps).length+' • '+Math.floor(s.clock)+' วิ'+(s.clock>=120?' • OVERTIME':'');
 g.fillText(status,24,55);g.restore();
}
window.WitchingSnake=Object.freeze({setup,update,draw,hud,step,spawnPositions,
 inside,segmentsTouch,distPointSegment2,addTrail,indexTrails,strikesTrail,
 eliminate,finish,config:CONFIG});
})();
