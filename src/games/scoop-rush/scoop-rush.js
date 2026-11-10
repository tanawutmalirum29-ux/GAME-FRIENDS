/* SCOOP RUSH — ice-rink merge race, 120 Hz fixed step, native ES module.
   Every player owns 5 equal, widely scattered scoops (mass 1 each). Same-owner
   scoops that touch merge (mass and momentum conserved); other-owner scoops collide.
   First player with a single scoop of mass 5 wins; on time-out the biggest-scoop percentage decides.
   All coordinates are WORLD units; the Host canvas is a 960x540 design viewport. */
import Art from './scoop-art.js';

const STEP=1/120,TAU=Math.PI*2,EPS=1e-8;
// All balance numbers live here so they can be tuned without touching the logic.
const C=Object.freeze({
 radius:15,maxSpeed:165,response:10,brake:13,knockDecay:4.2,knockShare:.3,
 scoops:5,baseR:22,playerMass:4.5,pushLoad:.16,
 drag:1.05,coulomb:9,maxScoopSpeed:430,
 eScoop:.55,eWall:.5,ePlayer:.22,wallTangent:.94,mergeGap:.5,iterations:6,
 secondsSmall:50,secondsLarge:70,finishDelay:.55,timeoutDelay:.35
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const hyp=Math.hypot;
const radiusFor=m=>C.baseR*Math.sqrt(m);
function rng(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x||0x3c6ef372;return(s.seed>>>0)/4294967296;}
// Visual-only randomness never touches the gameplay seed.
function fxr(s){let x=s.fxSeed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.fxSeed=x||0x1b873593;return(s.fxSeed>>>0)/4294967296;}

/* ------------------------------ world ------------------------------ */
function worldFor(n){
 const large=n>6;
 return large
  ?{w:1280,h:720,large,bounds:{x:130,y:104,w:1020,h:540,rc:120}}
  :{w:960,h:540,large,bounds:{x:100,y:84,w:760,h:400,rc:96}};
}
const GRID={1:[1,1],2:[2,1],3:[3,1],4:[2,2],5:[3,2],6:[3,2],7:[4,2],8:[4,2],9:[3,3],10:[4,3],11:[4,3],12:[4,3]};

// Keep a body of radius r inside the rounded-rectangle rink. Returns the corrected
// position and the inward wall normal (hit=false when nothing had to move).
function fitBody(b,x,y,r){
 let nx=0,ny=0,hit=false;
 const l=b.x+r,rt=b.x+b.w-r,t=b.y+r,bt=b.y+b.h-r;
 if(x<l){x=l;nx=1;hit=true;}else if(x>rt){x=rt;nx=-1;hit=true;}
 if(y<t){y=t;ny=1;hit=true;}else if(y>bt){y=bt;ny=-1;hit=true;}
 const rc=b.rc;
 const cx=x<b.x+rc?b.x+rc:x>b.x+b.w-rc?b.x+b.w-rc:null;
 const cy=y<b.y+rc?b.y+rc:y>b.y+b.h-rc?b.y+b.h-rc:null;
 if(cx!==null&&cy!==null){
  const dx=x-cx,dy=y-cy,d=hyp(dx,dy),lim=rc-r;
  if(d>lim&&d>1e-9){const k=lim/d;x=cx+dx*k;y=cy+dy*k;nx=-dx/d;ny=-dy/d;hit=true;}
 }
 return {x,y,nx,ny,hit};
}

/* ------------------------------ effects ------------------------------ */
function fx(s,e){if(s.fx.length>240)s.fx.shift();s.fx.push(e);}
function mergeBurst(s,sc,c,pct){
 fx(s,{k:'ring',x:sc.x,y:sc.y,life:.55,max:.55,r0:sc.r*.6,grow:sc.r*1.7,color:c});
 fx(s,{k:'ring',x:sc.x,y:sc.y,life:.35,max:.35,r0:sc.r*.4,grow:sc.r*1.1,color:'#ffffff'});
 for(let i=0;i<9;i++){
  const a=fxr(s)*TAU,v=60+fxr(s)*120;
  fx(s,{k:'drop',x:sc.x+Math.cos(a)*sc.r*.6,y:sc.y+Math.sin(a)*sc.r*.6,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.6+fxr(s)*.3,max:.9,r:2+fxr(s)*2.4,color:c});
 }
 for(let i=0;i<3;i++)fx(s,{k:'puff',x:sc.x+(fxr(s)-.5)*sc.r,y:sc.y+(fxr(s)-.5)*sc.r,life:.5,max:.5,r0:4,grow:10+fxr(s)*8});
 fx(s,{k:'text',x:sc.x,y:sc.y-sc.r-8,vy:-32,life:.9,max:.9,text:pct+'%',color:'#fff',size:Math.round(15+sc.r*.25)});
}

/* ------------------------------ setup ------------------------------ */
// Game colours come from the player's actual lobby palette, not seat order.
function flavorOf(p,index){
 const color=String(p.color||'').trim();
 if(/^#[0-9a-f]{6}$/i.test(color))return color;
 if(/^#[0-9a-f]{3}$/i.test(color))return '#'+[1,2,3].map(i=>color[i]+color[i]).join('');
 const rgb=/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,[^)]*)?\)$/i.exec(color);
 if(rgb)return '#'+[rgb[1],rgb[2],rgb[3]].map(v=>Math.max(0,Math.min(255,Number(v))).toString(16).padStart(2,'0')).join('');
 return Art.FLAVORS[index%Art.FLAVORS.length];
}
function makeBot(s){
 return {skill:.78+rng(s)*.2,interval:.08+rng(s)*.07,at:rng(s)*.15,dx:0,dy:0,ax:0,ay:0,
  speedBias:.96+rng(s)*.04,aggro:.015+rng(s)*.035,nextAggro:2+rng(s)*4,mode:'merge',until:0,dm:0,dp:0,
  plan:null,ignore:Object.create(null),lastX:0,lastY:0,idle:0,unstickUntil:0,ux:0,uy:0,wanting:false};
}
function newScoop(s,owner,x,y){
 const spk=[];
 for(let i=0;i<14;i++)spk.push({a:fxr(s)*TAU,d:.15+fxr(s)*.78,r:.035+fxr(s)*.06,l:fxr(s)<.55?1:0});
 return {id:s.nextId++,owner,mass:1,x,y,vx:0,vy:0,r:radiusFor(1),drawR:radiusFor(1),rot:fxr(s)*TAU,squash:0,flash:0,spk,dead:false};
}
function setup(round,ps){
 if(!ps.length||ps.length>12)throw Error('SCOOP RUSH supports 1–12 players');
 const n=ps.length,world=worldFor(n),b=world.bounds;
 const s={world,clock:0,tick:0,acc:0,
  seed:(((Number(round.scoopRushSeed)||(Date.now()^0x51ce7a3))>>>0)||1),fxSeed:0x9e3779b1,
  roster:ps,scoops:[],nextId:1,fx:[],stats:Object.create(null),frozen:null,
  total:n>6?C.secondsLarge:C.secondsSmall,finished:false,done:false,pending:0,winnerIds:[],timeUp:false,
  shake:0,layers:null,merges:0};
 round.scoopRush=s;
 s.layers=Art.preload(world);
 // Fair start: evenly separated bear positions; 5 ice-cream balls per owner
 // distributed over the whole rink instead of one cluster beside each bear.
 const [cols,rows]=GRID[n],cw=b.w/cols,ch=b.h/rows;
 const cells=[];
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)cells.push({x:b.x+cw*(c+.5),y:b.y+ch*(r+.5)});
 for(let i=cells.length-1;i>0;i--){const j=Math.floor(rng(s)*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]];}
 const mx=b.x+b.w/2,my=b.y+b.h/2;
 ps.forEach((p,i)=>{
  const cell=cells[i%cells.length];
  p.active=true;p.x=cell.x;p.y=cell.y;p.vx=p.vy=0;
  const dx=mx-p.x,dy=my-p.y,m=hyp(dx,dy)||1;p.dir={x:dx/m,y:dy/m};p.face=p.dir.x<0?-1:1;
  p.sr={flavor:flavorOf(p,i),cvx:0,cvy:0,kx:0,ky:0,loadMass:0,loadSmooth:1,push:Object.create(null),
   moving:false,bot:p.isBot?makeBot(s):null};
  if(p.sr.bot){p.sr.bot.lastX=p.x;p.sr.bot.lastY=p.y;}
 });
 // Seeded lattice creates broad distribution without overlaps or wall clipping.
 const spacing=65,nx=Math.max(1,Math.floor((b.w-2*C.baseR-20)/spacing)),
  ny=Math.max(1,Math.floor((b.h-2*C.baseR-20)/spacing)),spots=[];
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const px=b.x+(x+.5)*b.w/nx+(rng(s)-.5)*7;
  const py=b.y+(y+.5)*b.h/ny+(rng(s)-.5)*7;
  const fit=fitBody(b,px,py,C.baseR+3);
  if(fit.hit||ps.some(p=>hyp(p.x-fit.x,p.y-fit.y)<C.baseR+C.radius+12))continue;
  spots.push({x:fit.x,y:fit.y});
 }
 for(let i=spots.length-1;i>0;i--){const j=Math.floor(rng(s)*(i+1));[spots[i],spots[j]]=[spots[j],spots[i]];}
 const mine=Object.create(null);
 for(const p of ps)mine[p.id]=[];
 for(let k=0;k<C.scoops;k++)for(const p of ps){
  let chosen=-1,best=-Infinity;
  for(let i=0;i<spots.length;i++){
   const pt=spots[i];
   if(s.scoops.some(sc=>hyp(sc.x-pt.x,sc.y-pt.y)<C.baseR*2+9))continue;
   const existing=mine[p.id];
   const spread=existing.length?Math.min(...existing.map(sc=>hyp(sc.x-pt.x,sc.y-pt.y))):0;
   const quality=spread+rng(s)*30;
   if(quality>best){best=quality;chosen=i;}
  }
  if(chosen<0)throw Error('SCOOP RUSH: not enough safe starting positions');
  const pt=spots.splice(chosen,1)[0],sc=newScoop(s,p.id,pt.x,pt.y);
  s.scoops.push(sc);mine[p.id].push(sc);
 }
 s.stats=calcStats(s,ps);
 for(const p of ps)p.score=s.stats[p.id].pct;
 round.remaining=s.total;
 return s;
}

/* ------------------------------ stats / ranking ------------------------------ */
function calcStats(s,ps){
 const st=Object.create(null);
 for(const p of ps)if(p.active)st[p.id]={id:p.id,best:0,count:0,pct:0,complete:false};
 for(const sc of s.scoops){
  const q=st[sc.owner];if(!q)continue;
  q.count++;if(sc.mass>q.best)q.best=sc.mass;
 }
 for(const id in st){
  const q=st[id];
  q.pct=Math.round(q.best/C.scoops*100);
  q.complete=q.best===C.scoops&&q.count===1;
 }
 return st;
}
// Higher is better: win → Infinity, then biggest-scoop mass, then fewer scoops left.
function valueOf(q){return q.complete?Infinity:q.best*100+(99-Math.min(99,q.count));}
function labelOf(q){return q.complete?'รวมครบ 100%':q.pct+'% • '+q.count+' ก้อน';}

/* ------------------------------ input ------------------------------ */
function humanInput(p){
 if(window.PartyCharacters?.control)return window.PartyCharacters.control(p.input);
 const k=p.input||{};let x=finite(Number(k.axisX)),y=finite(Number(k.axisY));
 if(hyp(x,y)<.12){x=Number(!!k.right)-Number(!!k.left);y=Number(!!k.down)-Number(!!k.jump);}
 const m=hyp(x,y);return m>1?{x:x/m,y:y/m}:{x,y};
}

/* ------------------------------ bots ------------------------------ */
// Finds where the bot must stand (behind the scoop, opposite the aim) — rotating the push
// direction when that spot would be inside a wall/corner.
function pushSetup(s,m,ax,ay){
 const bd=s.world.bounds,R=C.radius;
 let ux=ax-m.x,uy=ay-m.y;const L=hyp(ux,uy)||1;ux/=L;uy/=L;
 const base=Math.atan2(uy,ux);
 for(const o of [0,.3,-.3,.6,-.6,.9,-.9]){
  const a=base+o,cx=Math.cos(a),cy=Math.sin(a);
  const px=m.x-cx*(m.r+R+3),py=m.y-cy*(m.r+R+3);
  if(!fitBody(bd,px,py,R+2).hit)return {ux:cx,uy:cy,px,py,off:Math.abs(o),ok:true};
 }
 return {ux,uy,px:m.x-ux*(m.r+R+3),py:m.y-uy*(m.r+R+3),off:1.5,ok:false};
}
// Steers the bot to push scoop m toward (ax,ay). gap = distance still needed to touch the target
// (null when disrupting); when the scoop will coast there by itself the bot just trails it.
function planPush(s,p,m,ax,ay,gap){
 const b=p.sr.bot,R=C.radius,g=pushSetup(s,m,ax,ay);
 const ex=g.px-p.x,ey=g.py-p.y;
 const tmx=m.x-p.x,tmy=m.y-p.y,dM=hyp(tmx,tmy)||1;
 const align=(tmx*g.ux+tmy*g.uy)/dM;
 const along=m.vx*g.ux+m.vy*g.uy;
 const coast=gap!==null&&along>18&&along/C.drag>gap+m.r*.5;
 let tx=g.px,ty=g.py,dx,dy,scale=1;
 const near=dM<m.r+R+22&&align>.88;
 if(near&&!coast){
  const e=ex*g.ux+ey*g.uy,lx=ex-g.ux*e,ly=ey-g.uy*e;
  dx=g.ux+lx*.05;dy=g.uy+ly*.05;
 }else{
  const front=(p.x-m.x)*g.ux+(p.y-m.y)*g.uy;
  if(front>-(m.r+R)*.3&&dM<m.r+R+70){
   const side=(p.x-m.x)*(-g.uy)+(p.y-m.y)*g.ux,sg=side>=0?1:-1;
   tx=m.x-g.uy*sg*(m.r+R+18);ty=m.y+g.ux*sg*(m.r+R+18);
  }
  dx=tx-p.x;dy=ty-p.y;
  const dist=hyp(dx,dy);
  scale=coast?clamp(dist/20,0,1):clamp(dist/30,.3,1);
 }
 let L=hyp(dx,dy)||1;dx/=L;dy/=L;
 // soft repulsion from scoops so the bot never shoves its own scoops off by accident
 for(const sc of s.scoops){
  if(sc===m&&near&&!coast)continue;
  const d=hyp(p.x-sc.x,p.y-sc.y)-(sc.r+R),range=26;
  if(d<range){
   const w=Math.pow(1-Math.max(d,0)/range,2)*(sc.owner===p.id?.85:.65),k=hyp(p.x-sc.x,p.y-sc.y)||1;
   dx+=(p.x-sc.x)/k*w;dy+=(p.y-sc.y)/k*w;
  }
 }
 L=hyp(dx,dy)||1;
 b.dx=dx/L*scale;b.dy=dy/L*scale;b.wanting=!coast;
 return g;
}
function botDecide(s,p){
 const b=p.sr.bot,R=C.radius,bd=s.world.bounds,now=s.clock;
 const moved=hyp(p.x-b.lastX,p.y-b.lastY);b.lastX=p.x;b.lastY=p.y;
 if(b.wanting&&moved<b.interval*14)b.idle+=b.interval;else b.idle=0;
 if(now<b.unstickUntil){b.dx=b.ux;b.dy=b.uy;return;}
 if(b.idle>1.1){
  b.idle=0;b.unstickUntil=now+.5+rng(s)*.35;
  const a=Math.atan2(bd.y+bd.h/2-p.y,bd.x+bd.w/2-p.x)+(rng(s)-.5)*2.2;
  b.ux=Math.cos(a);b.uy=Math.sin(a);b.dx=b.ux;b.dy=b.uy;
  if(b.plan)b.ignore[b.plan.key]=now+2.2+rng(s)*1.5;
  b.plan=null;b.mode='merge';return;
 }
 const mine=s.scoops.filter(q=>q.owner===p.id);
 if(mine.length<2){b.wanting=false;b.dx=0;b.dy=0;return;}
 // occasional, limited interference with the leading rival
 if(b.mode==='disrupt'){
  const m=s.scoops.find(q=>q.id===b.dm),pt=s.scoops.find(q=>q.id===b.dp);
  if(now<b.until&&m&&pt&&!m.dead&&!pt.dead){
   const d=hyp(m.x-pt.x,m.y-pt.y)||1;
   planPush(s,p,m,m.x+(m.x-pt.x)/d*120,m.y+(m.y-pt.y)/d*120,null);
   return;
  }
  b.mode='merge';b.plan=null;
 }
 // Maintain the same scoop pair while approaching it, instead of choosing
 // a different target every 0.1s and spinning in place between the two.
 if(b.plan&&now<b.plan.until){
  const m=s.scoops.find(q=>q.id===b.plan.mover&&q.owner===p.id);
  const t=s.scoops.find(q=>q.id===b.plan.target&&q.owner===p.id);
  if(m&&t&&!m.dead&&!t.dead){
   const gap=hyp(t.x-m.x,t.y-m.y)-(m.r+t.r);
   if(gap>-.5){
    planPush(s,p,m,t.x+t.vx*.25-m.vx*.25,t.y+t.vy*.25-m.vy*.25,gap);
    return;
   }
  }
  b.plan=null;
 }
 if(now>=b.nextAggro){
  b.nextAggro=now+2.5+rng(s)*4;
  if(rng(s)<b.aggro*3){
   let rival=null;
   for(const q of s.roster){
    if(q===p||!q.active)continue;
    const st=s.stats[q.id];
    if(!st||st.complete||st.count>2||st.best<2)continue;
    if(!rival||st.best>s.stats[rival.id].best)rival=q;
   }
   if(rival){
    const rs=s.scoops.filter(q=>q.owner===rival.id).sort((a,c)=>c.mass-a.mass);
    if(rs.length===2){
     const m=rs[1],pt=rs[0];
     if(hyp(m.x-pt.x,m.y-pt.y)<260&&hyp(p.x-m.x,p.y-m.y)<300){
      b.mode='disrupt';b.dm=m.id;b.dp=pt.id;b.until=now+1.8+rng(s)*1.2;b.plan=null;return;
     }
    }
   }
  }
 }
 // choose the cheapest (mover → target) pair: close, light, easy to line up
 let best=null;
 for(const m of mine)for(const t of mine){
  if(m===t)continue;
  const key=m.id+'>'+t.id,d=hyp(t.x-m.x,t.y-m.y),gap=d-(m.r+t.r);
  const g=pushSetup(s,m,t.x+t.vx*.4-m.vx*.4,t.y+t.vy*.4-m.vy*.4);
  let cost=hyp(g.px-p.x,g.py-p.y)*.9+Math.max(gap,0)+m.mass*16+g.off*35+(g.ok?0:200)
   +(b.ignore[key]>now?300:0)+rng(s)*22*(1.05-b.skill)-(b.plan&&b.plan.key===key?40:0);
  if(!best||cost<best.cost)best={cost,m,t,key,gap};
 }
 if(!best){b.wanting=false;b.dx=0;b.dy=0;return;}
 const {m,t}=best;
 b.plan={key:best.key,mover:m.id,target:t.id,until:now+1.65};
 planPush(s,p,m,t.x+t.vx*.4-m.vx*.4,t.y+t.vy*.4-m.vy*.4,best.gap);
}
function botInput(s,p,dt){
 const b=p.sr.bot;
 b.at-=dt;
 if(b.at<=0){botDecide(s,p);b.at=b.interval*(.85+rng(s)*.3);}
 const a=1-Math.exp(-13*dt);
 b.ax+=(b.dx-b.ax)*a;b.ay+=(b.dy-b.ay)*a;
 return {x:b.ax,y:b.ay};
}

/* ------------------------------ movement ------------------------------ */
function movePlayer(s,p,dt){
 const d=p.sr,bd=s.world.bounds;
 const inp=p.isBot?botInput(s,p,dt):humanInput(p);
 let ix=finite(inp.x),iy=finite(inp.y);
 const m0=hyp(ix,iy);if(m0>1){ix/=m0;iy/=m0;}
 const mag=hyp(ix,iy);
 // heavier scoops in contact slow the bear a little, never to a crawl
 d.loadSmooth+=(1/(1+C.pushLoad*d.loadMass)-d.loadSmooth)*(1-Math.exp(-12*dt));
 const sp=C.maxSpeed*(p.isBot?d.bot.speedBias:1)*d.loadSmooth;
 const a=1-Math.exp(-(mag>.05?C.response:C.brake)*dt);
 d.cvx+=(ix*sp-d.cvx)*a;d.cvy+=(iy*sp-d.cvy)*a;
 const dec=Math.exp(-C.knockDecay*dt);d.kx*=dec;d.ky*=dec;
 if(hyp(d.kx,d.ky)<1){d.kx=0;d.ky=0;}
 p.x+=(d.cvx+d.kx)*dt;p.y+=(d.cvy+d.ky)*dt;
 const f=fitBody(bd,p.x,p.y,C.radius);
 if(f.hit){
  p.x=f.x;p.y=f.y;
  const vn=d.cvx*f.nx+d.cvy*f.ny;if(vn<0){d.cvx-=vn*f.nx;d.cvy-=vn*f.ny;}
  const kn=d.kx*f.nx+d.ky*f.ny;if(kn<0){d.kx-=kn*f.nx;d.ky-=kn*f.ny;}
 }
 p.vx=d.cvx+d.kx;p.vy=d.cvy+d.ky;
 d.moving=hyp(p.vx,p.vy)>22;
 if(mag>.2){p.dir={x:ix/mag,y:iy/mag};}
 if(ix<-.12)p.face=-1;else if(ix>.12)p.face=1;
}

/* ------------------------------ scoop physics ------------------------------ */
function integrateScoops(s,dt){
 const k1=1-Math.exp(-14*dt);
 for(const sc of s.scoops){
  let sp=hyp(sc.vx,sc.vy);
  if(sp>C.maxScoopSpeed){const f=C.maxScoopSpeed/sp;sc.vx*=f;sc.vy*=f;sp=C.maxScoopSpeed;}
  sc.x+=sc.vx*dt;sc.y+=sc.vy*dt;
  if(sp>0){
   // ice: low drag + a little constant friction so scoops coast, then stop; heavier = more inertia
   const k=C.drag/(1+.1*(sc.mass-1));
   let ns=sp*Math.exp(-k*dt)-C.coulomb*dt;if(ns<3)ns=0;
   const f=ns/sp;sc.vx*=f;sc.vy*=f;
  }
  sc.rot+=(sc.vx*dt+sc.vy*dt*.35)/sc.r;
  sc.drawR+=(sc.r-sc.drawR)*k1;
  if(sc.squash>0)sc.squash=Math.max(0,sc.squash-dt*2.4);
  if(sc.flash>0)sc.flash=Math.max(0,sc.flash-dt*3);
 }
}
function wallScoops(s){
 const bd=s.world.bounds;
 for(const sc of s.scoops){
  const f=fitBody(bd,sc.x,sc.y,sc.r);
  if(!f.hit)continue;
  sc.x=f.x;sc.y=f.y;
  const vn=sc.vx*f.nx+sc.vy*f.ny;
  if(vn<0){
   sc.vx-=(1+C.eWall)*vn*f.nx;sc.vy-=(1+C.eWall)*vn*f.ny;
   sc.vx*=C.wallTangent;sc.vy*=C.wallTangent;
   if(-vn>140)fx(s,{k:'spark',x:sc.x-f.nx*sc.r,y:sc.y-f.ny*sc.r,life:.25,max:.25,r:4});
  }
 }
}
function mergeScoops(s,a,b,byId){
 const keep=(a.mass>b.mass||(a.mass===b.mass&&a.id<b.id))?a:b,gone=keep===a?b:a;
 const M=a.mass+b.mass;
 const x=(a.x*a.mass+b.x*b.mass)/M,y=(a.y*a.mass+b.y*b.mass)/M;
 const vx=(a.vx*a.mass+b.vx*b.mass)/M,vy=(a.vy*a.mass+b.vy*b.mass)/M;
 const big=Math.max(a.drawR,b.drawR);
 keep.x=x;keep.y=y;keep.vx=vx;keep.vy=vy;keep.mass=M;keep.r=radiusFor(M);
 keep.drawR=big*.92;keep.squash=1;keep.flash=1;keep.rot=(a.rot*a.mass+b.rot*b.mass)/M;
 gone.dead=true;s.merges++;
 const owner=byId[keep.owner];
 mergeBurst(s,keep,owner?owner.sr.flavor:'#fff',Math.round(M/C.scoops*100));
 return keep;
}
function scoopPairs(s,byId){
 const arr=s.scoops;
 for(let i=0;i<arr.length;i++){
  let a=arr[i];if(a.dead)continue;
  for(let j=i+1;j<arr.length;j++){
   const b=arr[j];if(b.dead||a.dead)continue;
   let dx=b.x-a.x,dy=b.y-a.y,d=hyp(dx,dy);const minD=a.r+b.r;
   if(a.owner===b.owner){
    if(d<=minD+C.mergeGap){a=mergeScoops(s,a,b,byId);if(a!==arr[i])break;}
    continue;
   }
   if(d>=minD)continue;
   let nx,ny;
   if(d<1e-6){const ang=rng(s)*TAU;nx=Math.cos(ang);ny=Math.sin(ang);d=0;}else{nx=dx/d;ny=dy/d;}
   const pen=minD-d,w=a.mass+b.mass;
   a.x-=nx*pen*(b.mass/w)*.9;a.y-=ny*pen*(b.mass/w)*.9;
   b.x+=nx*pen*(a.mass/w)*.9;b.y+=ny*pen*(a.mass/w)*.9;
   const vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
   if(vn<0){
    const j=-(1+C.eScoop)*vn/(1/a.mass+1/b.mass);
    a.vx-=j/a.mass*nx;a.vy-=j/a.mass*ny;b.vx+=j/b.mass*nx;b.vy+=j/b.mass*ny;
   }
  }
 }
 if(arr.some(q=>q.dead))s.scoops=arr.filter(q=>!q.dead);
}
function playerScoops(s,live,firstPass){
 const R=C.radius;
 for(const sc of s.scoops){
  for(const p of live){
   const dx=sc.x-p.x,dy=sc.y-p.y,minD=sc.r+R;
   if(dx*dx+dy*dy>=minD*minD)continue;
   let d=hyp(dx,dy),nx,ny;
   if(d<1e-6){nx=p.dir?.x||1;ny=p.dir?.y||0;d=0;}else{nx=dx/d;ny=dy/d;}
   const st=p.sr;
   sc.x+=nx*(minD-d);sc.y+=ny*(minD-d);
   const pvx=st.cvx+st.kx,pvy=st.cvy+st.ky;
   const vrel=(sc.vx-pvx)*nx+(sc.vy-pvy)*ny;
   const pushing=pvx*nx+pvy*ny>20;
   if(vrel<0){
    const m=sc.mass,Mp=C.playerMass,j=-(1+C.ePlayer)*vrel*(Mp*m)/(Mp+m);
    sc.vx+=j/m*nx;sc.vy+=j/m*ny;
    // a fast rolling scoop can shove a bear that is not pushing it
    if(firstPass&&!pushing){const kn=Math.min(140,j/Mp*C.knockShare);st.kx-=nx*kn;st.ky-=ny*kn;}
   }
   if(pushing)st.push[sc.id]=sc.mass;
  }
 }
}
// Final guarantee: no scoop rests inside a bear; the bear yields first, then the scoop.
function separate(s,live){
 const bd=s.world.bounds,R=C.radius;
 for(let k=0;k<3;k++){
  for(const sc of s.scoops)for(const p of live){
   let dx=sc.x-p.x,dy=sc.y-p.y;const minD=sc.r+R,d2=dx*dx+dy*dy;
   if(d2>=minD*minD)continue;
   let d=Math.sqrt(d2),nx,ny;
   if(d<1e-6){nx=p.dir?.x||1;ny=p.dir?.y||0;d=0;}else{nx=dx/d;ny=dy/d;}
   const pen=minD-d;
   const f=fitBody(bd,p.x-nx*pen,p.y-ny*pen,R);
   p.x=f.x;p.y=f.y;
   dx=sc.x-p.x;dy=sc.y-p.y;d=hyp(dx,dy);
   if(d<minD-.4){
    const g=fitBody(bd,sc.x+nx*(minD-d),sc.y+ny*(minD-d),sc.r);
    sc.x=g.x;sc.y=g.y;
   }
  }
 }
}
function resolvePlayers(s,live){
 const b=s.world.bounds;
 if(live.length>1&&window.PartyCharacters?.resolve)
  window.PartyCharacters.resolve(live,{radius:C.radius,iterations:2,maxShift:4,bounds:{x:b.x,y:b.y,w:b.w,h:b.h}});
 for(const p of live){const f=fitBody(b,p.x,p.y,C.radius);p.x=f.x;p.y=f.y;}
}

/* ------------------------------ step / finish ------------------------------ */
function finish(s,round,ps,why){
 s.finished=true;s.timeUp=why==='time';
 s.frozen=s.stats;
 s.winnerIds=ps.filter(p=>p.active&&s.stats[p.id]?.complete).map(p=>p.id);
 s.pending=why==='win'?C.finishDelay:C.timeoutDelay;
 round.remaining=why==='time'?0:Math.max(0,s.total-s.clock);
 if(why==='win'){
  s.shake=.6;
  for(const sc of s.scoops)if(s.winnerIds.includes(sc.owner)){
   const c=ps.find(p=>p.id===sc.owner)?.sr.flavor||'#fff';
   sc.flash=1;sc.squash=1;
   for(let i=0;i<22;i++){
    const a=fxr(s)*TAU,v=70+fxr(s)*190;
    fx(s,{k:'drop',x:sc.x,y:sc.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.8+fxr(s)*.5,max:1.3,r:2+fxr(s)*3,color:fxr(s)<.5?c:'#fff'});
   }
   fx(s,{k:'ring',x:sc.x,y:sc.y,life:.7,max:.7,r0:sc.r,grow:sc.r*3.2,color:c});
  }
 }
}
function step(dt,round,ps){
 const s=round.scoopRush;if(!s)return;
 s.tick++;
 if(!s.finished){
  s.clock+=dt;
  const live=ps.filter(p=>p.active&&p.sr);
  const byId=Object.create(null);for(const p of live)byId[p.id]=p;
  for(const p of live){p.sr.loadMass=0;for(const id in p.sr.push)p.sr.loadMass+=p.sr.push[id];p.sr.push=Object.create(null);}
  for(const p of live)movePlayer(s,p,dt);
  integrateScoops(s,dt);
  for(let it=0;it<C.iterations;it++){
   scoopPairs(s,byId);
   playerScoops(s,live,it===0);
   wallScoops(s);
  }
  resolvePlayers(s,live);
  separate(s,live);
  wallScoops(s);
  s.stats=calcStats(s,ps);
  for(const p of live)p.score=s.stats[p.id].pct;
  round.remaining=Math.max(0,s.total-s.clock);
  if(live.some(p=>s.stats[p.id].complete))finish(s,round,ps,'win');
  else if(s.clock>=s.total)finish(s,round,ps,'time');
 }else{
  s.pending-=dt;
  if(s.pending<=0)s.done=true;
 }
 for(const e of s.fx){
  e.life-=dt;
  if(e.vx!==undefined){e.x+=e.vx*dt;e.y+=e.vy*dt;const f=Math.exp(-2.6*dt);e.vx*=f;e.vy*=f;}
  else if(e.vy!==undefined)e.y+=e.vy*dt;
 }
 s.fx=s.fx.filter(e=>e.life>0);
 s.shake=Math.max(0,s.shake-dt*2);
 if(s.finished){ // keep celebratory scoops animating without moving them
  for(const sc of s.scoops){
   sc.drawR+=(sc.r-sc.drawR)*(1-Math.exp(-14*dt));
   if(sc.squash>0)sc.squash=Math.max(0,sc.squash-dt*2.4);
   if(sc.flash>0)sc.flash=Math.max(0,sc.flash-dt*3);
  }
 }
}
function update(dt,round,ps){
 const s=round.scoopRush;if(!s)return null;
 if(s.done)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.acc=Math.min(.25,s.acc+clamp(finite(dt),0,.25));
 let cycles=0;
 while(s.acc+EPS>=STEP&&cycles++<30&&!s.done){step(STEP,round,ps);s.acc-=STEP;}
 return s.done?'winner':null;
}
function hud(ps,round){
 const s=round.scoopRush,st=s?.frozen||s?.stats||{};
 let leaderId=null,leaderPct=0;
 for(const id in st)if(st[id].pct>leaderPct){leaderPct=st[id].pct;leaderId=st[id].id;}
 return {remaining:round.remaining??null,elapsed:s?.clock||0,survivors:ps.filter(p=>p.active).length,
  leaderId,leaderPct,winnerIds:s?.winnerIds||[],
  progress:ps.filter(p=>p.active).map(p=>({id:p.id,pct:st[p.id]?.pct??0,count:st[p.id]?.count??C.scoops}))};
}

/* ------------------------------ drawing ------------------------------ */
function draw(g,time,round,ps){
 const s=round.scoopRush;if(!s)return;
 const w=s.world,t=s.clock;
 g.save();
 g.scale(960/w.w,540/w.h);
 if(s.shake>0)g.translate(Math.sin(t*91)*5*s.shake,Math.cos(t*77)*5*s.shake);
 Art.drawBackdrop(g,w,s.layers,t);
 const flav=Object.create(null);
 for(const p of ps)if(p.sr)flav[p.id]=p.sr.flavor;
 for(const sc of s.scoops)Art.drawGround(g,sc,flav[sc.owner]||'#fff');
 const items=[];
 for(const sc of s.scoops)items.push({y:sc.y+sc.drawR*.3,sc});
 for(const p of ps)if(p.active&&p.sr)items.push({y:p.y+10,p});
 items.sort((a,b)=>a.y-b.y);
 for(const it of items){
  if(it.sc){Art.drawScoop(g,it.sc,flav[it.sc.owner]||'#fff',t);continue;}
  const p=it.p;
  Art.drawBear(g,p,p.sr.flavor,t,p.sr.moving);
  if(window.PartyCharacters?.draw){
   const oy=p.y;p.y-=8;
   window.PartyCharacters.draw(g,p,{time:t,scale:.8,label:false});
   p.y=oy;
  }else{g.fillStyle=p.color||'#eee';g.beginPath();g.arc(p.x,p.y-8,10,0,TAU);g.fill();}
 }
 for(const e of s.fx)Art.drawFx(g,e);
 g.restore();
}

/* ------------------------------ results / roster ------------------------------ */
function liveStats(round,players){
 const s=round.scoopRush;
 return s?.frozen||(s?calcStats(s,players):Object.create(null));
}
function getResult(round,players){
 const st=liveStats(round,players);
 return players.filter(p=>p.active).map(p=>{
  const q=st[p.id]||{best:0,count:C.scoops,pct:0,complete:false};
  return {id:p.id,value:valueOf(q),label:labelOf(q)};
 });
}
function getRoster(round,players){
 const st=liveStats(round,players);
 return players.filter(p=>p.active).map(p=>{
  const q=st[p.id]||{best:0,count:C.scoops,pct:0,complete:false};
  return {id:p.id,value:valueOf(q),label:labelOf(q),status:q.pct+'%',eliminated:false};
 }).sort((a,b)=>(b.value===a.value?0:b.value>a.value?1:-1));
}

const engine=Object.freeze({
 resultTitle:'รวมไอศกรีมครบก่อนใคร!',countdownSeconds:3,
 setup,update,draw,hud,getResult,getRoster,step,worldFor,config:C
});
export default engine;
