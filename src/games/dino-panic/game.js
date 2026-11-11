/* DINO PANIC — GAME-FRIENDS minigame (native ES module, folder-only discovery).
   Host-authoritative fixed-step simulation (1/60 s). Everything is in WORLD units:
   the corridor, obstacles, runners and the dinosaur share one coordinate system; only render.js maps it to the screen.
   Rules: runners and dinosaur have the SAME reduced max speed (130 u/s). The dinosaur never speeds up. Time lost
   to obstacles / crowding / bad routes is the only way the dinosaur gains on a runner. */
import {C,STEP,clamp,mkRng,tierFor} from './config.js';
import {buildTrack,pushOut,dinoEdge} from './map.js';
import {makeBot,botControl} from './bot.js';
import {drawWorld,preloadArt} from './render.js';

const active=ps=>ps.filter(p=>p.active);
const E_TIE=1e-9;                       // crossing / elimination times closer than this are a true tie (sub-nanosecond)
const PC=()=>typeof window!=='undefined'?window.PartyCharacters:undefined;
const QN=[],QP=[],QD=[];                 // scratch lists for spatial queries (no array allocation per call)

function inputVector(input){
 const pc=PC(),v=pc?.control?pc.control(input||{}):input||{};
 let x=Number(v.x??v.axisX)||(Number(!!v.right)-Number(!!v.left)),y=Number(v.y??v.axisY)||(Number(!!v.down)-Number(!!v.jump));
 const m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}      // diagonal never faster than straight
 return{x,y};
}
function spawnSlots(track,n,rng){
 const out=[];let left=n;
 for(let c=0;c<track.cols;c++){
  const cnt=Math.ceil(left/(track.cols-c)),lo=track.top+28,hi=track.bottom-28;left-=cnt;
  for(let i=0;i<cnt;i++)out.push({x:track.spawnX+c*C.colGap,y:cnt===1?track.cy:lo+(hi-lo)*i/(cnt-1)});
 }
 for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
 return out;
}
function setup(round,players){
 PC()?.activate?.(players);
 const ps=active(players);
 if(ps.length<1||ps.length>12)throw Error('DINO PANIC supports 1–12 players');
 
 const tier=tierFor(ps.length),seed=(Number(round.dinoSeed)||(Date.now()^0x2f6e2b1))>>>0||1;
 const track=buildTrack(tier,seed,ps.length),rng=mkRng(seed^0x51ed270b);
 preloadArt(track);
 const duration=track.finishX/C.speed+2;
 const s={track,tier,seed,roster:ps,clock:0,tick:0,accumulator:0,front:0,duration,remaining:duration,finished:false,
  ending:null,ranking:[],winnerIds:[],fx:[],fxSeed:rng()*1e6,doneCount:0,camX:-190,total:ps.length,stompAt:0};
 const slots=spawnSlots(track,ps.length,rng);
 ps.forEach((p,i)=>{
  const sl=slots[i];
  p.active=true;p.x=sl.x;p.y=sl.y;p.vx=0;p.vy=0;p.dir={x:1,y:0};p.face=1;p.score=0;
  p.dino={state:'run',kx:0,ky:0,px:p.x,py:p.y,ix:0,iy:0,elimAt:null,finishAt:null,parkX:0,dustIn:rng()*.1,
   bot:p.isBot?makeBot(i,rng):null};
 });
 s.camX=camFor(s);
 s.prevCam=s.camX;s.prevFront=s.front;s.live=[];s.rk=null;s.rkTick=-1;
 round.dinoPanic=s;round.remaining=duration;
 return s;
}
function camFor(s){return clamp(s.front-190,-190,s.track.endX-960+40);}

/* ───────── effects (cheap, capped, never placed in front of upcoming obstacles) ───────── */
function fx(s,e){if(s.fx.length>=130)s.fx.splice(0,s.fx.length-115);s.fx.push(e);}
function burst(s,x,y,n,o){for(let i=0;i<n;i++){const a=Math.random()*6.283,v=(o.v||60)*(.4+Math.random());
 fx(s,{t:o.t,x,y,vx:Math.cos(a)*v+(o.bx||0),vy:Math.sin(a)*v,life:(o.life||.6)*(.6+Math.random()*.6),max:o.life||.6,size:o.size||5,color:o.color,rot:Math.random()*6.28,spin:(Math.random()-.5)*10});}}

/* ───────── elimination / finish bookkeeping ───────── */
function eliminate(s,p,t){
 const d=p.dino;d.state='dead';d.elimAt=t;p.vx=p.vy=0;
 fx(s,{t:'squash',x:p.x,y:p.y,vx:0,vy:0,life:.9,max:.9,size:1,color:p.color,rot:0,spin:0});
 burst(s,p.x,p.y,8,{t:'dust',v:50,life:.7,size:9,color:'#e7c999'});
}
function reachFinish(s,p,t){
 const d=p.dino;d.state='done';d.finishAt=t;s.doneCount++;
 d.parkX=s.track.finishX+70+((s.doneCount*47)%210);
 burst(s,s.track.finishX+6,p.y,16,{t:'confetti',v:120,life:1.1,size:5,color:p.color,bx:90});
}
function grp(d){return d.state==='done'?0:d.state==='run'?1:2;}
function rankAll(s){
 const rows=s.roster.map(p=>({p,d:p.dino,id:p.id}));
 const cmp=(a,b)=>{ // <0 ⇒ a ranks better. Never uses player id, array order, packet order or frame rate.
  const ga=grp(a.d),gb=grp(b.d);if(ga!==gb)return ga-gb;
  if(ga===0){const df=a.d.finishAt-b.d.finishAt;return Math.abs(df)>E_TIE?df:0;}
  if(ga===1){const dx=b.p.x-a.p.x;return Math.abs(dx)>1e-6?dx:0;}
  const de=b.d.elimAt-a.d.elimAt;return Math.abs(de)>E_TIE?de:0;};
 for(const r of rows){let better=0;for(const q of rows)if(q!==r&&cmp(q,r)<0)better++;r.rank=1+better;}
 return rows.sort((a,b)=>a.rank-b.rank);
}
// ranking only changes inside step(), so it is computed at most once per tick no matter how often the host asks
function rankCached(s){
 if(s.finished&&s.ranking.length)return s.ranking;
 if(!s.rk||s.rkTick!==s.tick){s.rk=rankAll(s);s.rkTick=s.tick;}
 return s.rk;
}
function finish(s,round,reason){
 if(s.finished)return;
 s.finished=true;s.ending=reason;round.remaining=0;s.remaining=0;
 s.ranking=rankAll(s);s.winnerIds=s.ranking.filter(r=>r.rank===1).map(r=>r.id);
 for(const r of s.ranking)r.p.score=Math.max(0,s.total-r.rank+1);
}

/* ───────── shoveable scenery ───────── */
// Local bucket search avoids scanning the full corridor each frame.
function obstacleNear(tr,x,y,r){
 for(const o of tr.query(x-r-8,x+r+8,QN)){
  if(o.shape==='circle'){
   if(Math.hypot(x-o.x,y-o.y)<r+o.r)return true;
  }else{
   const xx=clamp(x,o.x-o.hw,o.x+o.hw),yy=clamp(y,o.y-o.hh,o.y+o.hh);
   if(Math.hypot(x-xx,y-yy)<r)return true;
  }
 }
 return false;
}
function pushScenery(tr,p,dt){
 if(!p.dino.pushing)return;
 const R=C.R,vx=p.dino.ix,vy=p.dino.iy;
 for(const o of tr.query(p.x-R-8,p.x+R+8,QP)){
  if(o.kind==='fence')continue; // fixed structural obstacles
  const circle=o.shape==='circle';
  const px=circle?o.x:clamp(p.x,o.x-o.hw,o.x+o.hw);
  const py=circle?o.y:clamp(p.y,o.y-o.hh,o.y+o.hh);
  let nx=p.x-px,ny=p.y-py,d=Math.hypot(nx,ny);
  if(d>R+(circle?o.r:0)+2)continue;
  if(d<1e-5){nx=p.x-o.x;ny=p.y-o.y;d=Math.hypot(nx,ny);}
  if(d<1e-5){nx=-vx;ny=-vy;d=Math.hypot(nx,ny);}
  if(d<1e-5)continue;
  nx/=d;ny/=d;
  const closing=-(vx*nx+vy*ny);
  if(closing<=0)continue;
  // Transfer force along the collision normal. The rocky surface is a
  // CONTACT point on the circumference, not the rock's centre.
  const mass=o.kind==='crate'?1:o.kind==='rock'?1.25:4.5;
  const impulse=Math.min(165,closing)*dt*3.2/mass;
  const tx=-ny,ty=nx;
  const tangential=vx*tx+vy*ty;
  const grip=(o.kind==='rock'?.22:.09)*tangential*dt;
  const cx=circle?o.x+nx*o.r:px,cy=circle?o.y+ny*o.r:py;
  tr.impulseObstacle(o,-nx*impulse+tx*grip,-ny*impulse+ty*grip,cx,cy);
 }
}
/* ───────── simulation step ───────── */
function knock(q,x,y){const d=q.dino;d.kx+=x;d.ky+=y;const km=Math.hypot(d.kx,d.ky);if(km>70){d.kx*=70/km;d.ky*=70/km;}}
function step(dt,round){
 const s=round.dinoPanic;if(!s||s.finished)return;
 const tr=s.track,R=C.R,t0=s.tick*STEP,prevFront=s.front;
 s.tick++;s.clock=s.tick*STEP;s.front=C.speed*s.clock;     // constant dinosaur speed, no rubber-banding
 s.remaining=Math.max(0,s.duration-s.clock);round.remaining=s.remaining;
 const pc=PC();
 s.prevFront=prevFront;s.prevCam=s.camX;tr.tick=s.tick;   // previous-tick state for render interpolation
 // 1) runners move (same speed for humans and bots)
 for(const p of s.roster){
  const d=p.dino;d.px=p.x;d.py=p.y;
  if(d.state==='dead')continue;
  if(d.state==='done'){ // finished runners stroll to a parking spot and are not solid
   const dx=d.parkX-p.x;p.vx=Math.abs(dx)>3?Math.sign(dx)*110:0;p.vy=0;p.x+=p.vx*dt;if(p.vx)p.face=1;continue;}
  const c=p.isBot?botControl(s,p,dt):inputVector(p.input),m=Math.hypot(c.x,c.y);
  const approaching=m>.1&&obstacleNear(tr,p.x+c.x*16,p.y+c.y*16,R+7);
  d.pushing=approaching;
  const speed=C.speed*(approaching?C.pushFactor:1);
  d.ix=c.x*speed;d.iy=c.y*speed;
  const k=Math.exp(-7*dt);d.kx*=k;d.ky*=k;
  p.vx=d.ix+d.kx;p.vy=d.iy+d.ky;p.x+=p.vx*dt;p.y+=p.vy*dt;
  if(m>.1){p.dir={x:c.x/m,y:c.y/m};p.face=p.dir.x<0?-1:1;}
 }
 const live=s.live;live.length=0;for(const p of s.roster)if(p.dino.state==='run')live.push(p);
 for(const p of live)pushScenery(tr,p,dt);
 tr.stepObstacles(dt);
 // 2) body-to-body shoves: closing speed turns into a short knock for both runners
 for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){
  const a=live[i],b=live[j],dx=b.x-a.x,dy=b.y-a.y,dd=Math.hypot(dx,dy);
  if(dd>=2*R+1||dd<1e-6)continue;
  const nx=dx/dd,ny=dy/dd,cs=Math.max(0,(a.dino.ix-b.dino.ix)*nx+(a.dino.iy-b.dino.iy)*ny),J=9+cs*.22;
  knock(a,-nx*J,-ny*J);knock(b,nx*J,ny*J);
 }
 // 3) Resolve player pairs through the shared solver; do not run a second
 // O(n²) pair solver three times on top of PartyCharacters.resolve().
 if(pc?.resolve&&live.length>1){
  pc.resolve(live,{radius:R,iterations:2,maxShift:6,bounds:{x:-600,y:tr.top,w:tr.endX+1200,h:tr.H}});
  for(const p of live)pushOut(tr,p,R);
 }else{
  // Standalone engine tests can run without the shared collision API.
  for(let it=0;it<2;it++){
   for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){
    const a=live[i],b=live[j];let dx=b.x-a.x,dy=b.y-a.y,dd=Math.hypot(dx,dy);
    if(dd>=2*R)continue;if(dd<1e-6){dx=0;dy=(i%2?1:-1);dd=1;}
    const overlap=(2*R-dd)/2,nx=dx/dd,ny=dy/dd;
    a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
   }
   for(const p of live)pushOut(tr,p,R);
  }
 }
 for(const p of live){const d=p.dino;p.vx=(p.x-d.px)/dt;p.vy=(p.y-d.py)/dt;}
 // 4) the dinosaur flattens every obstacle its snout reaches (it never slows down)
 for(const o of tr.query(s.front-60,s.front+120,QD)){
  const e=o.shape==='circle'?o.r:o.hw,eh=o.shape==='circle'?o.r:o.hh,yc=clamp(tr.cy,o.y-eh,o.y+eh);
  if(dinoEdge(tr,s.front,yc)>=o.x-e){o.alive=false;
   burst(s,o.x,o.y,o.kind==='rock'?7:10,{t:o.kind==='rock'?'pebble':'debris',v:110,life:.75,size:o.kind==='log'?6:5,color:o.kind==='rock'?'#8a8077':'#b9783a',bx:60});
   burst(s,o.x,o.y,4,{t:'dust',v:60,life:.8,size:11,color:'#d9b585'});}
 }
 // 5) stomping dust (visual only)
 if(s.clock>=s.stompAt){s.stompAt=s.clock+.32;const side=(Math.round(s.clock/.32)%2)?1:-1;
  burst(s,s.front-40,tr.cy+side*(tr.H/2-24),5,{t:'dust',v:70,life:.9,size:13,color:'#dcbb8c',bx:-20});}
 // 6) stomp / finish decisions with sub-tick interpolation (position before & after physics → crossing fraction)
 for(const p of live){
  const d=p.dino;
  const g0=(d.px-R)-dinoEdge(tr,prevFront,d.py),g1=(p.x-R)-dinoEdge(tr,s.front,p.y);
  let tE=Infinity,tF=Infinity;
  if(g1<=0)tE=t0+(g0<=0?0:g0/(g0-g1))*dt;
  if(d.px<tr.finishX&&p.x>=tr.finishX)tF=t0+((tr.finishX-d.px)/(p.x-d.px))*dt;
  if(tF<=tE&&tF<Infinity)reachFinish(s,p,tF);
  else if(tE<Infinity)eliminate(s,p,tE);
  else{
   d.dustIn-=dt;if(d.dustIn<=0&&Math.hypot(p.vx,p.vy)>40){d.dustIn=.11;
    fx(s,{t:'dust',x:p.x-p.dir.x*10,y:p.y+9,vx:-p.dir.x*14,vy:-6,life:.45,max:.45,size:5,color:'#e5c690',rot:0,spin:0});}
   p.score=Math.round(clamp(p.x/tr.finishX,0,1)*100);
  }
 }
 // 7) effects
 for(let i=s.fx.length-1;i>=0;i--){const e=s.fx[i];e.life-=dt;if(e.life<=0){const last=s.fx.pop();if(i<s.fx.length)s.fx[i]=last;continue;}   // O(1) swap-remove
  e.x+=e.vx*dt;e.y+=e.vy*dt;e.vx*=.97;e.vy*=.97;e.rot+=e.spin*dt;}
 s.camX=camFor(s);
 // 8) end of race
 let run=0,done=0,last=null;
 for(const p of s.roster){if(p.dino.state==='run'){run++;last=p;}else if(p.dino.state==='done')done++;}
 if(s.total>1&&done===0&&run===1){finish(s,round,'last');return;}   // last runner standing before anyone reaches the line
 if(run===0){finish(s,round,done?'all':'none');return;}
 if(s.remaining<=1e-9)finish(s,round,'time');
}
function update(dt,round){
 const s=round.dinoPanic;if(!s)return null;
 if(s.finished)return'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.12,s.accumulator+clamp(Number(dt)||0,0,.12));
 let cycles=0;
 while(s.accumulator+1e-9>=STEP&&cycles++<6&&!s.finished){step(STEP,round);s.accumulator-=STEP;}
 if(s.accumulator>=STEP)s.accumulator%=STEP;   // after a long stall drop the backlog instead of racing to catch up
 return s.finished?'winner':null;
}
function draw(g,time,round,ps){
 const s=round.dinoPanic;if(!s)return;
 // render alpha = how far we are between the previous and the current 1/60 s tick (removes 0-or-2-steps-per-frame judder)
 drawWorld(g,time,s,s.finished?1:clamp(s.accumulator/STEP,0,1));
}
function hud(ps,round){
 const s=round.dinoPanic;let survivors=0,finished=0;
 for(const p of ps){if(!p.active)continue;const st=p.dino?.state;if(st!=='dead')survivors++;if(st==='done')finished++;}
 return{survivors,remaining:round.remaining,elapsed:s?.clock||0,finished,winnerIds:s?.winnerIds||[]};
}

/* ───────── results / roster / controller ───────── */
const fmt=t=>t.toFixed(3);
function getResult(round,players){
 const s=round.dinoPanic,list=s?(s.ranking.length?s.ranking:rankAll(s)):[],by=new Map(list.map(r=>[r.id,r]));
 return players.filter(p=>p.active).map(p=>{
  const r=by.get(p.id),d=p.dino||{},rank=r?.rank||players.length;
  let label;
  if(d.state==='done')label='ถึงเส้นชัย '+fmt(d.finishAt)+' วิ';
  else if(d.state==='dead')label='ถูกเหยียบ • '+d.elimAt.toFixed(2)+' วิ';
  else label=s?.ending==='last'?'รอดคนสุดท้าย':Math.round((p.score||0))+'%';
  return{id:p.id,value:-rank,label};
 });
}
function getRoster(round,players){
 const s=round.dinoPanic,order=new Map((s?rankCached(s):[]).map(r=>[r.id,r.rank]));
 return players.filter(p=>p.active).map(p=>({id:p.id,value:-(order.get(p.id)||99),
  label:p.dino?.state==='done'?'ถึงเส้นชัย':p.dino?.state==='dead'?'ตกรอบ':'วิ่งอยู่',status:p.dino?.state||'run',eliminated:p.dino?.state==='dead'}));
}
const ROSTER=new WeakMap();
const roleText=d=>d?.state==='done'?'ถึงเส้นชัย':d?.state==='dead'?'ตกรอบ':'วิ่งอยู่';
/* Chips are created once per player and then only touched when something actually changed.
   Same output as before, but no DOM churn (and the elimination animation is no longer restarted on every call). */
function renderRoster(root,activePlayers,round){
 const s=round.dinoPanic,order=new Map((s?rankCached(s):[]).map(r=>[r.id,r.rank]));
 const list=[...activePlayers].sort((a,b)=>(order.get(a.id)||99)-(order.get(b.id)||99));
 let st=ROSTER.get(root);if(!st){st={sig:'',nodes:new Map(),first:null};ROSTER.set(root,st);}
 let sig='';for(const p of list)sig+=p.id+':'+(p.dino?.state||'run')+'|';
 if(sig===st.sig&&root.firstElementChild===st.first&&root.childElementCount===list.length)return;
 for(const p of list){
  let n=st.nodes.get(p.id);
  if(!n){
   const box=document.createElement('div');box.className='leader-chip';
   const dot=document.createElement('span');dot.className='circle';
   const name=document.createElement('span');name.className='leader-name';
   const role=document.createElement('small');role.className='leader-role';
   const info=document.createElement('span');info.className='leader-item-slot';
   box.append(dot,name,role,info);
   n={box,dot,name,role,info,state:null,color:null,nm:null};st.nodes.set(p.id,n);
  }
  const state=p.dino?.state||'run';
  if(n.color!==p.color){n.dot.style.background=p.color;n.color=p.color;}
  if(n.nm!==p.name){n.name.textContent=p.name;n.nm=p.name;}
  if(n.state!==state){n.role.textContent=roleText(p.dino);n.info.textContent=state==='dead'?'ถูกเหยียบ':' ';n.box.classList.toggle('shockwave-eliminated',state==='dead');n.state=state;}
  root.append(n.box);
 }
 st.sig=sig;st.first=root.firstElementChild;
}
function survivorCount(s){let n=0;for(const p of s.roster)if(p.dino?.state!=='dead')n++;return n;}
function getControllerPacket(p,round){
 const s=round.dinoPanic,d=p.dino||{},status=d.state||'run',progress=Math.round(p.score||0),survivors=s?survivorCount(s):0,c=p._dpPkt;
 // identical content → identical object, so a host that de-duplicates (by reference or by value) sends nothing
 if(c&&c.mode===round.mode&&c.status===status&&c.progress===progress&&c.survivors===survivors)return c;
 return p._dpPkt={t:'dino-panic-status',mode:round.mode,status,progress,survivors};
}
function dispose(round){ // give every resource back when the round ends
 const s=round?.dinoPanic;if(!s)return;
 s.fx.length=0;s.botFields?.clear();s.track.obstacles.length=0;s.track.query=()=>[];s.ranking=[];
 for(const p of s.roster){delete p._dpPkt;if(p.dino){p.dino.bot=null;}}
 delete round.dinoPanic;
}
const engine=Object.freeze({getControllerPacket,renderRoster,getResult,getRoster,dispose,resultTitle:'ผู้รอดจากไดโนเสาร์!',countdownSeconds:3,
 setup,update,draw,hud,step,finish,rankAll});
export default engine;
