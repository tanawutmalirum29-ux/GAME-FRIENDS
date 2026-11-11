/* COUNTDOWN DROP — host-authoritative last-survivor game on a numbered tile board, 60 Hz fixed step.
   Every tile runs its own 8→0 countdown, opens into a pit, closes, and restarts at 8.
   Board size depends on the player count (two tiers):  1–6 players = 4×3 (12 tiles),  7–12 = 5×4 (20 tiles).
   Support rule (used everywhere: fall check, bots): a body is supported by the floor under its CENTRE point;
   it falls when that point is inside the opened gap of a tile (the gap grows from the tile centre outward). */
(() => {
'use strict';
const STEP=1/60,TAU=Math.PI*2,EPS=1e-8;
// All balance numbers live here so they can be tuned without touching the logic.
const C=Object.freeze({
 radius:15,maxSpeed:165,response:11,brake:14,knockDecay:3.2,restitution:.45,
 count:8,                              // tile restarts here after closing
 open:.15,hold:.55,close:.2,           // door animation / pit hold (seconds)
 overtimeAt:100,overtimeHold:.9,       // very long games: pits stay open longer (no random winner)
 tick:1,tickSD1:.8,tickSD2:.65,sd1At:45,sd2At:70, // seconds per count step / Sudden Death thresholds
 maxOpenRatio:.4,                      // never more than 40% of tiles in the open cycle at once
 stun:1.4,stunImmune:.6,fallTime:.7,
 punch:{wind:.12,active:.1,recovery:.18,cooldown:.65,fist:22,hitR:14,knock:150,slow:.55},
 finishDelay:.9,soloSeconds:45,
 tiers:[ // 1–6 / 7–12 players
  {maxPlayers:6,world:{w:960,h:540},cols:4,rows:3,tile:130},
  {maxPlayers:12,world:{w:1280,h:720},cols:5,rows:4,tile:140}
 ]
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const hyp=Math.hypot;
const living=ps=>ps.filter(p=>p.active&&p.dyn?.alive);
const art=()=>window.CountdownDropArt;
function rng(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x||0x3c6ef372;return(s.seed>>>0)/4294967296;}
function fxr(s){let x=s.fxSeed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.fxSeed=x||0x1b873593;return(s.fxSeed>>>0)/4294967296;}
function shuffle(s,a){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* ------------------------------ world & tiles ------------------------------ */
function layoutFor(n){
 const t=window.PartyArenaScale?.tier?window.PartyArenaScale.tier(n,C.tiers):C.tiers.find(e=>n<=e.maxPlayers);
 const w=t.world,bw=t.cols*t.tile,bh=t.rows*t.tile;
 return {world:{w:w.w,h:w.h},cols:t.cols,rows:t.rows,tile:t.tile,large:n>6,
  board:{x:(w.w-bw)/2,y:(w.h-bh)/2,w:bw,h:bh}};
}
function holdTime(s){return s.clock>=C.overtimeAt?C.overtimeHold:C.hold;}
function intervalAt(clock){return clock>=C.sd2At?C.tickSD2:clock>=C.sd1At?C.tickSD1:C.tick;}
function tileIndex(s,x,y){
 const L=s.layout,b=L.board;
 const c=clamp(Math.floor((x-b.x)/L.tile),0,L.cols-1),r=clamp(Math.floor((y-b.y)/L.tile),0,L.rows-1);
 return r*L.cols+c;
}
// Balanced 1–8 start values: every value is used before any repeats, so only a few tiles share a number,
// there are always enough high (safe) tiles to spawn on, and no two neighbouring tiles are both ≤2.
function startValues(s,cols,rows){
 const n=cols*rows,need=Math.ceil(n*.4);
 const ok=v=>{
  if(v.filter(x=>x>=5).length<need)return false;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
   const x=v[r*cols+c];if(x>2)continue;
   if(c+1<cols&&v[r*cols+c+1]<=2)return false;
   if(r+1<rows&&v[(r+1)*cols+c]<=2)return false;
  }
  return true;
 };
 for(let attempt=0;attempt<400;attempt++){
  const deck=[];
  while(deck.length<n)deck.push(...shuffle(s,[1,2,3,4,5,6,7,8]));
  const v=shuffle(s,deck.slice(0,n));
  if(ok(v))return v;
 }
 // deterministic fallback (a checkerboard-ish spread that satisfies all rules)
 const v=[];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)v.push(((c*3+r*5+(c+r)%2*4)%8)+1);
 return v;
}
function buildTiles(s){
 const L=s.layout,vals=startValues(s,L.cols,L.rows);
 s.tiles=vals.map((v,i)=>{
  const c=i%L.cols,r=Math.floor(i/L.cols);
  return {i,col:c,row:r,x:L.board.x+c*L.tile,y:L.board.y+r*L.tile,w:L.tile,h:L.tile,
   state:'counting',t:v,timer:0,open:0,display:v,pulse:0,startValue:v};
 });
}
function tilesInCycle(s){return s.tiles.reduce((a,t)=>a+(t.state==='counting'?0:1),0);}
function stepTile(s,t,dt,interval){
 if(t.pulse>0)t.pulse=Math.max(0,t.pulse-dt);
 if(t.state==='counting'){
  const before=t.display;
  t.t-=dt/interval;
  if(t.t<=EPS){
   // refuse to open if that would leave too little floor; the tile waits on "1" (never changes numbers)
   const cap=Math.max(3,Math.floor(s.tiles.length*C.maxOpenRatio));
   if(tilesInCycle(s)>=cap){t.t=.001;t.display=1;return;}
   t.t=0;t.display=0;t.state='opening';t.timer=0;t.pulse=.25;
   puffRow(s,t);
   return;
  }
  t.display=clamp(Math.ceil(t.t-1e-9),1,C.count);
  if(t.display!==before)t.pulse=.25;
  return;
 }
 t.timer+=dt;
 if(t.state==='opening'){
  t.open=clamp(t.timer/C.open,0,1);
  if(t.timer>=C.open){t.state='open';t.timer=0;t.open=1;}
 }else if(t.state==='open'){
  t.open=1;
  if(t.timer>=holdTime(s)){t.state='closing';t.timer=0;}
 }else if(t.state==='closing'){
  t.open=clamp(1-t.timer/C.close,0,1);
  if(t.timer>=C.close){t.state='counting';t.t=C.count;t.display=C.count;t.open=0;t.timer=0;t.pulse=.25;}
 }
}
function gapRect(t){const gw=t.w*t.open;return {x:t.x+(t.w-gw)/2,y:t.y,w:gw,h:t.h};}
function segHitsRect(x0,y0,x1,y1,r){
 let t0=0,t1=1;const dx=x1-x0,dy=y1-y0;
 const clip=(p,q)=>{
  if(Math.abs(p)<1e-12)return q>=0;
  const u=q/p;
  if(p<0){if(u>t1)return false;if(u>t0)t0=u;}else{if(u<t0)return false;if(u<t1)t1=u;}
  return true;
 };
 return clip(-dx,x0-r.x)&&clip(dx,r.x+r.w-x0)&&clip(-dy,y0-r.y)&&clip(dy,r.y+r.h-y0);
}
// Swept support test: covers the whole path travelled this step, so no speed can skip a pit.
function unsupported(s,p){
 const d=p.dyn,L=s.layout,b=L.board;
 const x0=d.ox,y0=d.oy,x1=p.x,y1=p.y;
 const c0=clamp(Math.floor((Math.min(x0,x1)-b.x)/L.tile),0,L.cols-1),c1=clamp(Math.floor((Math.max(x0,x1)-b.x)/L.tile),0,L.cols-1);
 const r0=clamp(Math.floor((Math.min(y0,y1)-b.y)/L.tile),0,L.rows-1),r1=clamp(Math.floor((Math.max(y0,y1)-b.y)/L.tile),0,L.rows-1);
 for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){
  const t=s.tiles[r*L.cols+c];
  if(t.open<.03)continue;
  if(segHitsRect(x0,y0,x1,y1,gapRect(t)))return t;
 }
 return null;
}
function clampBody(s,p){
 const b=s.layout.board,d=p.dyn,r=C.radius;
 if(p.x<b.x+r){p.x=b.x+r;if(d.cvx<0)d.cvx=0;if(d.kx<0)d.kx=0;}
 if(p.x>b.x+b.w-r){p.x=b.x+b.w-r;if(d.cvx>0)d.cvx=0;if(d.kx>0)d.kx=0;}
 if(p.y<b.y+r){p.y=b.y+r;if(d.cvy<0)d.cvy=0;if(d.ky<0)d.ky=0;}
 if(p.y>b.y+b.h-r){p.y=b.y+b.h-r;if(d.cvy>0)d.cvy=0;if(d.ky>0)d.ky=0;}
}

/* ------------------------------ fx ------------------------------ */
function fx(s,e){if(s.fx.length>140)s.fx.shift();s.fx.push(e);}
function puffRow(s,t){
 for(let i=0;i<6;i++)fx(s,{k:'puff',x:t.x+t.w/2+(fxr(s)-.5)*t.w*.5,y:t.y+t.h/2+(fxr(s)-.5)*t.h*.8,
  vx:(fxr(s)-.5)*60,vy:(fxr(s)-.5)*60,life:.55,max:.55,r0:4,grow:14,alpha:.3,color:'#9aa0a8'});
}
function stars(s,x,y){
 for(let i=0;i<6;i++){const a=fxr(s)*TAU,v=60+fxr(s)*120;
  fx(s,{k:'spark',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.3,max:.3,r:2.8,color:'#fff0a0'});}
 fx(s,{k:'ring',x,y,life:.25,max:.25,r0:6,grow:22,color:'#ffe45a'});
}

/* ------------------------------ setup ------------------------------ */
function makeBot(s){
 return {skill:.6+rng(s)*.28,lapseUntil:0,interval:.1+rng(s)*.07,at:rng(s)*.2,ax:0,ay:0,tile:-1,tx:0,ty:0,
  aggr:.4+rng(s)*.55,risk:.85+rng(s)*.3,offx:(rng(s)-.5)*.4,offy:(rng(s)-.5)*.4,
  avoidTile:-1,avoidUntil:0,lastX:0,lastY:0,stuckT:0,unstick:0,ux:0,uy:0,press:false,face:null};
}
function spawnPositions(s,n){
 // highest start values first (ties broken by the gameplay RNG); two players per tile at most.
 const order=s.tiles.slice().sort((a,b)=>b.startValue-a.startValue||rng(s)-.5);
 const m=Math.max(1,Math.ceil(n/2)),use=order.slice(0,m),out=[];
 const per=use.map(()=>[]);
 for(let i=0;i<n;i++)per[i%m].push(i);
 const L=s.layout,cx=L.board.x+L.board.w/2,cy=L.board.y+L.board.h/2;
 use.forEach((t,ti)=>{
  const ids=per[ti],k=ids.length,mx=t.x+t.w/2,my=t.y+t.h/2;
  ids.forEach((id,j)=>{
   let ox=0,oy=0;
   if(k===2){ox=j?30:-30;}
   out[id]={x:mx+ox,y:my+oy};
  });
 });
 return {pos:out,cx,cy};
}
function setup(round,ps){
 if(!ps.length||ps.length>12)throw Error('COUNTDOWN DROP supports 1–12 players');
 if(round.countdownDrop)cleanup(round);
 const n=ps.length,layout=layoutFor(n);
 const s={layout,world:layout.world,clock:0,tick:0,accumulator:0,interval:C.tick,
  seed:(((Number(round.countdownDropSeed)||(Date.now()^0x51ed27))>>>0)||1),fxSeed:0x9e3779b1,
  roster:ps,originalCount:n,tiles:[],fx:[],fallers:[],layers:null,
  finished:false,pendingFinish:0,winnerIds:[],ranking:[],eliminations:0,solo:n===1,sudden:0};
 round.countdownDrop=s;
 buildTiles(s);
 s.layers=art().preload(layout.world,layout.board);
 const sp=spawnPositions(s,n);
 const order=shuffle(s,ps.map((_,i)=>i));
 ps.forEach((p,i)=>{
  const q=sp.pos[order[i]];
  p.active=true;p.score=0;p.x=q.x;p.y=q.y;p.vx=p.vy=0;
  const m=hyp(sp.cx-q.x,sp.cy-q.y)||1;p.dir={x:(sp.cx-q.x)/m,y:(sp.cy-q.y)/m};p.face=p.dir.x<0?-1:1;
  p.dyn={alive:true,cvx:0,cvy:0,kx:0,ky:0,stunUntil:-9,immuneUntil:-9,ox:q.x,oy:q.y,
   eliminatedTick:null,eliminatedAt:null,
   pn:{phase:'idle',t:0,cool:0,dir:{x:1,y:0},hit:null,prevA:false},
   bot:p.isBot?makeBot(s):null};
  if(p.dyn.bot){p.dyn.bot.lastX=q.x;p.dyn.bot.lastY=q.y;}
 });
 // Host countdown covers the 3 s before play; `remaining` is only a placeholder so no host timer ends the round.
 round.remaining=s.solo?C.soloSeconds:9999;
 return s;
}
function cleanup(round){
 const s=round?.countdownDrop;if(!s)return;
 s.fx.length=0;s.fallers.length=0;s.tiles.length=0;s.layers=null;
 window.CountdownDropArt?.release?.();
 round.countdownDrop=null;
}

/* ------------------------------ input ------------------------------ */
function humanInput(p){
 if(window.PartyCharacters?.control)return window.PartyCharacters.control(p.input);
 const k=p.input||{};let x=finite(Number(k.axisX)),y=finite(Number(k.axisY));
 if(hyp(x,y)<.12){x=Number(!!k.right)-Number(!!k.left);y=Number(!!k.down)-Number(!!k.jump);}
 const m=hyp(x,y);const o=m>1?{x:x/m,y:y/m}:{x,y};o.action=!!(k.action||k.a||k.A);return o;
}

/* ------------------------------ bots ------------------------------ */
// Bots follow the player rules: same speed, same punch reach/cooldown, same support rule.
// They only read what a person can read: the numbers and pit states on the tiles.
function tileSpans(s,t){
 const iv=s.interval,hold=holdTime(s),dur=C.open+hold+C.close;
 let a,b;
 if(t.state==='counting'){a=t.t*iv-.02;b=a+dur+.04;}
 else{
  a=-1;
  b=t.state==='opening'?C.open-t.timer+hold+C.close:t.state==='open'?hold-t.timer+C.close:C.close-t.timer;
 }
 const out=[[a,b]];
 for(let k=0;k<2;k++){a=b+C.count*iv;b=a+dur;out.push([a,b]);}
 return out;
}
function holeAt(sp,tau,m){for(const[a,b]of sp)if(tau>=a-m&&tau<=b+m)return true;return false;}
function nextHole(sp,tau){for(const[a]of sp)if(a>tau)return a-tau;return 99;}
function botDecide(s,p,ps){
 const b=p.dyn.bot,d=p.dyn,S=C.maxSpeed,v=S*.88,L=s.layout;
 if(s.clock<b.lapseUntil&&b.tile>=0&&s.clock>=d.stunUntil&&!b.press)return;
 if(rng(s)<(1-b.skill)*.09)b.lapseUntil=s.clock+.45+rng(s)*.4;
 const spans=s.tiles.map(t=>tileSpans(s,t));
 const cur=tileIndex(s,p.x,p.y),others=living(ps).filter(q=>q!==p),noise=(1-b.skill)*1.6;
 const evalPoint=(ti,tx,ty)=>{
  const dist=hyp(tx-p.x,ty-p.y),ta=dist/v;
  let blocked=false;
  const steps=Math.max(1,Math.ceil(dist/22));
  for(let k=1;k<=steps;k++){
   const f=k/steps,ix=tileIndex(s,p.x+(tx-p.x)*f,p.y+(ty-p.y)*f);
   if(holeAt(spans[ix],ta*f+(rng(s)-.5)*noise,.1)){blocked=true;break;}
  }
  const arrive=ta+.05;
  const margin=holeAt(spans[ti],arrive,.1)?0:nextHole(spans[ti],arrive)+(rng(s)-.5)*noise;
  let crowd=0;
  for(const q of others){const dq=hyp(q.x-tx,q.y-ty);if(dq<36)crowd+=(36-dq)*.4;}
  let score=Math.min(margin,4)*12-ta*5/b.risk-crowd+(rng(s)-.5)*4;
  if(blocked)score-=90;
  if(margin<1.3)score-=70;
  if(ti===b.tile)score+=8;
  if(b.avoidTile===ti&&s.clock<b.avoidUntil)score-=50;
  return score;
 };
 let best=null,bestScore=-Infinity;
 const consider=(ti,x,y)=>{const sc=evalPoint(ti,x,y);if(sc>bestScore){bestScore=sc;best={ti,x,y};}};
 consider(cur,p.x,p.y);
 for(const t of s.tiles){
  const inset=C.radius+14;
  const cx=clamp(t.x+t.w*(.5+b.offx),t.x+inset,t.x+t.w-inset),cy=clamp(t.y+t.h*(.5+b.offy),t.y+inset,t.y+t.h-inset);
  consider(t.i,cx,cy);
  consider(t.i,clamp(p.x,t.x+inset,t.x+t.w-inset),clamp(p.y,t.y+inset,t.y+t.h-inset));
 }
 b.tile=best.ti;b.tx=best.x;b.ty=best.y;
 // stuck breaker: leaning on a crowd/wall → mark the target tile as bad for a moment and slide sideways
 b.stuckT+=b.interval;
 if(b.stuckT>.75){
  const moved=hyp(p.x-b.lastX,p.y-b.lastY),want=hyp(b.tx-p.x,b.ty-p.y);
  if(moved<7&&want>26&&s.clock>=d.stunUntil){
   b.avoidTile=b.tile;b.avoidUntil=s.clock+1.2;
   const m=want||1,side=rng(s)<.5?-1:1;
   b.unstick=s.clock+.4;b.ux=-(b.ty-p.y)/m*side;b.uy=(b.tx-p.x)/m*side;
  }
  b.lastX=p.x;b.lastY=p.y;b.stuckT=0;
 }
 // punching: same reach, same cooldown; only when my own floor is safe for a while
 b.press=false;b.face=null;
 const pn=d.pn;
 if(pn.phase==='idle'&&pn.cool<=0&&s.clock>=d.stunUntil){
  const mine=holeAt(spans[cur],0,.05)?0:nextHole(spans[cur],0);
  if(mine>=1.5){
   const reach=C.punch.fist+C.punch.hitR+C.radius-5;
   for(const q of others){
    if(s.clock<q.dyn.stunUntil||s.clock<q.dyn.immuneUntil)continue;
    const dist=hyp(q.x-p.x,q.y-p.y);if(dist>reach)continue;
    const qi=tileIndex(s,q.x,q.y),qw=holeAt(spans[qi],0,.05)?0:nextHole(spans[qi],0);
    const fleeing=qw>=.2&&qw<=2.6;
    if(rng(s)<(fleeing?b.aggr*.9:b.aggr*.1)){
     b.press=true;b.face={x:(q.x-p.x)/(dist||1),y:(q.y-p.y)/(dist||1)};break;
    }
   }
  }
 }
}
function botInput(s,p,ps,dt){
 // Late takeover must not dereference the null human-only bot controller.
 const b=p.dyn.bot||(p.dyn.bot=makeBot(s));
 if(b.lastX===0&&b.lastY===0){b.lastX=p.x;b.lastY=p.y;b.tx=p.x;b.ty=p.y;}
 b.at-=dt;
 if(b.at<=0){botDecide(s,p,ps);b.at=b.interval*(.85+rng(s)*.3);}
 let dx=b.tx-p.x,dy=b.ty-p.y;const dist=hyp(dx,dy);
 let ix=0,iy=0;
 if(s.clock<b.unstick){ix=b.ux;iy=b.uy;}
 else if(dist>6){const m=clamp(dist/20,0,1);ix=dx/dist*m;iy=dy/dist*m;}
 const a=1-Math.exp(-13*dt);
 b.ax+=(ix-b.ax)*a;b.ay+=(iy-b.ay)*a;
 const out={x:b.ax,y:b.ay,action:b.press,face:b.face};
 b.press=false;b.face=null;
 return out;
}

/* ------------------------------ movement & punch ------------------------------ */
function startPunch(s,p){
 const pn=p.dyn.pn;
 pn.phase='wind';pn.t=0;pn.cool=C.punch.cooldown;pn.hit=Object.create(null);
 pn.dir={x:p.dir.x,y:p.dir.y};
}
function punchStep(s,p,ps,dt){
 const d=p.dyn,pn=d.pn;
 pn.cool=Math.max(0,pn.cool-dt);
 if(pn.phase==='idle')return;
 pn.t+=dt;
 if(pn.phase==='wind'){if(pn.t>=C.punch.wind){pn.phase='active';pn.t=0;}}
 if(pn.phase==='active'){
  const fx0=p.x+pn.dir.x*C.punch.fist,fy0=p.y+pn.dir.y*C.punch.fist,reach=C.punch.hitR+C.radius;
  for(const q of living(ps)){
   if(q===p||pn.hit[q.id])continue;
   if(hyp(q.x-fx0,q.y-fy0)>reach)continue;
   pn.hit[q.id]=true;               // one punch can hit a target at most once
   if(s.clock<q.dyn.stunUntil||s.clock<q.dyn.immuneUntil)continue; // no stun-lock
   const qd=q.dyn;
   qd.stunUntil=s.clock+C.stun;qd.immuneUntil=qd.stunUntil+C.stunImmune;
   qd.kx+=pn.dir.x*C.punch.knock;qd.ky+=pn.dir.y*C.punch.knock;
   qd.pn.phase='idle';qd.pn.t=0;     // a stunned player's own punch is cancelled
   stars(s,q.x,q.y);
  }
  if(pn.t>=C.punch.active){pn.phase='recovery';pn.t=0;}
 }else if(pn.phase==='recovery'){
  if(pn.t>=C.punch.recovery){pn.phase='idle';pn.t=0;}
 }
}
function movePlayer(s,p,ps,dt){
 const d=p.dyn,stunned=s.clock<d.stunUntil;
 d.ox=p.x;d.oy=p.y;
 const inp=p.isBot?botInput(s,p,ps,dt):humanInput(p);
 let ix=finite(inp.x),iy=finite(inp.y);
 const m0=hyp(ix,iy);if(m0>1){ix/=m0;iy/=m0;}
 if(stunned){ix=0;iy=0;}
 const mag=hyp(ix,iy),pn=d.pn;
 // A: edge-triggered, needs idle + cooldown ready + not stunned
 const pressed=!!inp.action&&!pn.prevA;pn.prevA=!!inp.action;
 if(!stunned&&inp.face&&pressed)p.dir={x:inp.face.x,y:inp.face.y};
 if(stunned){pn.phase='idle';pn.t=0;}
 if(pressed&&!stunned&&pn.phase==='idle'&&pn.cool<=0)startPunch(s,p);
 punchStep(s,p,ps,dt);
 const slow=pn.phase==='idle'?1:C.punch.slow;
 const k=stunned?4:mag>.05?C.response:C.brake,a=1-Math.exp(-k*dt);
 d.cvx+=(ix*C.maxSpeed*slow-d.cvx)*a;d.cvy+=(iy*C.maxSpeed*slow-d.cvy)*a;
 const dec=Math.exp(-C.knockDecay*dt);d.kx*=dec;d.ky*=dec;
 if(hyp(d.kx,d.ky)<1){d.kx=0;d.ky=0;}
 p.x+=(d.cvx+d.kx)*dt;p.y+=(d.cvy+d.ky)*dt;
 clampBody(s,p);
 if(!stunned&&mag>.1&&pn.phase==='idle'){p.dir={x:ix/mag,y:iy/mag};p.face=p.dir.x<0?-1:1;}
 p.vx=d.cvx+d.kx;p.vy=d.cvy+d.ky;
}
function pairCollisions(s,live,impulse){
 const R2=C.radius*2;
 for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){
  const a=live[i],b=live[j];
  let dx=b.x-a.x,dy=b.y-a.y,d=hyp(dx,dy);
  if(d>=R2)continue;
  if(d<1e-4){const ang=((i*7+j*13)%16)*TAU/16;dx=Math.cos(ang);dy=Math.sin(ang);d=1e-4;} // tie-break by slot, never by id/name
  const nx=dx/d,ny=dy/d,over=R2-d;
  if(impulse){
   const va={x:a.dyn.cvx+a.dyn.kx,y:a.dyn.cvy+a.dyn.ky},vb={x:b.dyn.cvx+b.dyn.kx,y:b.dyn.cvy+b.dyn.ky};
   const rel=(vb.x-va.x)*nx+(vb.y-va.y)*ny;
   if(rel<0){const j2=-(1+C.restitution)*rel/2;a.dyn.kx-=j2*nx;a.dyn.ky-=j2*ny;b.dyn.kx+=j2*nx;b.dyn.ky+=j2*ny;}
  }
  const sh=Math.min(over/2+.05,6);
  a.x-=nx*sh;a.y-=ny*sh;b.x+=nx*sh;b.y+=ny*sh;
 }
}
function externalResolve(s,live){
 if(live.length>1&&window.PartyCharacters?.resolve){
  const b=s.layout.board;
  window.PartyCharacters.resolve(live,{radius:C.radius,iterations:2,maxShift:4,bounds:{x:b.x,y:b.y,w:b.w,h:b.h}});
 }
 for(const p of live)clampBody(s,p);
}

/* ------------------------------ falling / ranking ------------------------------ */
function eliminate(s,p,tile){
 if(!p?.dyn?.alive)return false;
 const d=p.dyn;
 d.alive=false;d.eliminatedAt=s.clock;d.eliminatedTick=s.tick;
 d.cvx=d.cvy=d.kx=d.ky=0;p.vx=p.vy=0;d.pn.phase='idle';
 s.eliminations++;
 s.fallers.push({p,t:0,x:p.x,y:p.y});
 fx(s,{k:'ring',x:p.x,y:p.y,life:.4,max:.4,r0:8,grow:30,color:'#ffffff'});
 return true;
}
function finish(s,round,ps){
 s.finished=true;
 const list=ps.filter(p=>p.active),survivors=living(list);
 s.winnerIds=survivors.map(p=>p.id);
 const value=p=>p.dyn?.alive?Infinity:(p.dyn?.eliminatedTick??-1);
 s.ranking=list.map(p=>({id:p.id,value:value(p),rank:1+list.filter(q=>value(q)>value(p)).length}))
  .sort((a,b)=>a.rank-b.rank);
 s.fx.length=0;
}

/* ------------------------------ step / update ------------------------------ */
function step(dt,round,ps){
 const s=round.countdownDrop;if(!s||s.finished)return;
 s.tick++;s.clock+=dt;
 s.interval=intervalAt(s.clock);s.sudden=s.interval<C.tick?(s.interval<=C.tickSD2?2:1):0;
 for(const t of s.tiles)stepTile(s,t,dt,s.interval);
 const live=living(ps);
 for(const p of live)movePlayer(s,p,ps,dt);
 pairCollisions(s,live,true);
 pairCollisions(s,live,false);
 externalResolve(s,live);
 for(const p of live){
  const t=unsupported(s,p);
  if(t)eliminate(s,p,t);
 }
 for(const p of living(ps)){p.vx=p.dyn.cvx+p.dyn.kx;p.vy=p.dyn.cvy+p.dyn.ky;}
 for(const f of s.fallers)f.t+=dt;
 s.fallers=s.fallers.filter(f=>f.t<C.fallTime);
 for(const e of s.fx){
  e.life-=dt;
  if(e.vx!==undefined){e.x+=e.vx*dt;e.y+=e.vy*dt;const f=Math.exp(-2.4*dt);e.vx*=f;e.vy*=f;}
 }
 s.fx=s.fx.filter(e=>e.life>0);
 const left=living(ps).length;
 if(s.solo){
  round.remaining=Math.max(0,C.soloSeconds-s.clock);
  if(!s.pendingFinish&&(left===0||s.clock>=C.soloSeconds))s.pendingFinish=left===0?C.finishDelay:EPS;
 }else{
  round.remaining=9999;
  if(!s.pendingFinish&&left<=1)s.pendingFinish=C.finishDelay;
 }
 if(s.pendingFinish){
  s.pendingFinish-=dt;
  if(s.pendingFinish<=0)finish(s,round,ps);
 }
}
function update(dt,round,ps){
 const s=round.countdownDrop;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.25,s.accumulator+clamp(finite(dt),0,.25));
 let cycles=0;
 while(s.accumulator+EPS>=STEP&&cycles++<15&&!s.finished){step(STEP,round,ps);s.accumulator-=STEP;}
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.countdownDrop;
 return {survivors:living(ps).length,remaining:null,elapsed:s?.clock||0,suddenDeath:s?.sudden||0,
  winnerIds:s?.winnerIds||[],statuses:ps.filter(p=>p.active).map(p=>({id:p.id,alive:!!p.dyn?.alive}))};
}

/* ------------------------------ drawing ------------------------------ */
// COUNTDOWN DROP keeps its 0.12 / 0.10 / 0.18-second punch and 1.4s stun.
// This function maps VISUAL phases only to the canonical 16-frame SVG.
function punchVisualMs(pn){
 if(pn.phase==='wind')return 180*clamp(pn.t/C.punch.wind,0,.99999);
 if(pn.phase==='active')return 180+100*clamp(pn.t/C.punch.active,0,.99999);
 if(pn.phase==='recovery')return 280+200*clamp(pn.t/C.punch.recovery,0,.99999);
 return null;
}
function draw(g,time,round,ps){
 const s=round.countdownDrop;if(!s)return;
 const a=art(),w=s.world,u=1,avatarScale=2;
 g.save();
 g.fillStyle='#2a2e35';g.fillRect(0,0,960,540);
 g.scale(960/w.w,540/w.h);
 a.drawBackdrop(g,w,s.layers);
 for(const t of s.tiles)a.drawTile(g,t,t.x,t.y,t.w,t.h,s.clock,u);
 for(const t of s.tiles)a.drawNumber(g,t,t.x,t.y,t.w,t.h,s.clock);
 for(const e of s.fx)if(e.k==='puff')a.drawPuff(g,e);
 for(const f of s.fallers)a.drawFall(g,f.p,clamp(f.t/C.fallTime,0,1),u*avatarScale);
 for(const p of living(ps)){
  const pn=p.dyn.pn,visualMs=punchVisualMs(pn);
  if(window.PartyCharacters?.draw)window.PartyCharacters.draw(g,p,{
   time:s.clock,label:false,scale:avatarScale,attacking:visualMs!==null,
   ...(visualMs===null?{}:{punchElapsedMs:visualMs,punchFacing:pn.dir})
  });
  else{g.fillStyle=p.color||'#eee';g.beginPath();g.arc(p.x,p.y,C.radius*avatarScale,0,TAU);g.fill();}
  if(s.clock<p.dyn.stunUntil)a.drawStun(g,p,s.clock,u*avatarScale);
 }
 for(const e of s.fx){if(e.k==='spark')a.drawSpark(g,e);else if(e.k==='ring')a.drawRing(g,e);}
 a.drawForeground(g,w,s.layers);
 g.restore();
 if(s.sudden){
  const pulse=.5+.5*Math.sin(s.clock*8);
  g.save();g.textAlign='center';g.textBaseline='middle';g.font='900 22px system-ui,sans-serif';
  g.lineWidth=5;g.strokeStyle='rgba(20,10,10,.8)';g.fillStyle='rgba(255,'+(90+90*pulse|0)+',60,1)';
  g.strokeText('SUDDEN DEATH',480,28);g.fillText('SUDDEN DEATH',480,28);g.restore();
 }
}

/* ------------------------------ results / roster ------------------------------ */
function getResult(round,players){
 return players.filter(p=>p.active).map(p=>{
  const alive=!!p.dyn?.alive,value=alive?Infinity:(p.dyn?.eliminatedTick??-1);
  const label=alive?'ผู้รอดชีวิต':'ตกหลุม • '+(p.dyn?.eliminatedAt??round.countdownDrop?.clock??0).toFixed(1)+' วิ';
  return {id:p.id,value,label};
 });
}
function getRoster(round,players){
 return players.filter(p=>p.active).map(p=>{
  const alive=!!p.dyn?.alive;
  return {id:p.id,value:alive?Infinity:(p.dyn?.eliminatedTick??-1),
   label:alive?'รอด':'ตกรอบ',status:alive?(round.countdownDrop&&round.countdownDrop.clock<p.dyn.stunUntil?'สตัน':'รอด'):'ตกรอบ',eliminated:!alive};
 });
}
function renderRoster(root,active,round){
 const ordered=active.slice().sort((a,b)=>Number(!!b.dyn?.alive)-Number(!!a.dyn?.alive)||(b.dyn?.eliminatedTick??0)-(a.dyn?.eliminatedTick??0));
 for(const p of ordered){
  const box=document.createElement('div');box.className='leader-chip';
  if(!p.dyn?.alive)box.classList.add('shockwave-eliminated');
  const dot=document.createElement('span');dot.className='circle';dot.style.background=p.color;
  const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;
  const role=document.createElement('small');role.className='leader-role';
  role.textContent=!p.dyn?.alive?'ตกรอบ':(round.countdownDrop&&round.countdownDrop.clock<p.dyn.stunUntil)?'สตัน':'รอด';
  const empty=document.createElement('span');empty.className='leader-item-slot';
  box.append(dot,name,role,empty);root.append(box);
 }
}
function getControllerPacket(p,round,players){
 const s=round.countdownDrop,st=p.dyn||{};
 return {t:'countdown-drop-status',mode:round.mode,alive:!!st.alive,
  stunned:!!s&&s.clock<(st.stunUntil??-9),punchReady:!!st.pn&&st.pn.cool<=0&&st.pn.phase==='idle',
  suddenDeath:s?.sudden||0,survivors:hud(players,round).survivors};
}

window.CountdownDrop=Object.freeze({getControllerPacket,renderRoster,getRoster,getResult,resultTitle:'ผู้รอดชีวิตคนสุดท้าย!',
 countdownSeconds:3,setup,update,draw,hud,step,finish,cleanup,eliminate,layoutFor,startValues,config:C});
})();
