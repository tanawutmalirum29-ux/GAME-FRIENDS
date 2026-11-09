/* ICE RACE — host-authoritative drifting sleds on a closed floating ice road.
   The same sampled centreline drives rendering, fall detection, bot guidance
   and strictly ordered, direction-sensitive checkpoints. */
(() => {
'use strict';
const TAU=Math.PI*2, STEP=1/60;
const C=Object.freeze({
 small:Object.freeze({w:960,h:540,halfWidth:45,duration:40}),
 large:Object.freeze({w:1280,h:720,halfWidth:82,duration:70}),
 radius:14,hullHalfLength:24,hullHalfWidth:18,maxSpeed:306,thrust:426,forwardDrag:.16,lateralGrip:.82,
 turnSpeed:3.65,turnAcceleration:12.5,restitution:.62,impactInertia:900,impactFriction:.08,
 fallDelay:.8,spawnProtection:.6
});
// Two intentionally different racecourses, not the same centreline stretched.
// Wider lanes must not bridge neighbouring turns on the crowded course.
// Keep the small course's centre connector above the two return bends at
// y=.44/.46. These anchors define both the visible ice and its physical support.
const SMALL_ANCHORS=Object.freeze([
 [.53,.79],[.71,.79],[.81,.70],[.76,.59],[.65,.55],[.65,.46],
 [.80,.42],[.83,.25],[.74,.17],[.65,.19],[.63,.22],[.51,.22],
 [.48,.17],[.35,.17],[.30,.27],[.32,.42],[.46,.44],[.46,.53],
 [.35,.62],[.24,.69],[.29,.79],[.43,.79]
]);
const LARGE_ANCHORS=Object.freeze([
 [.51,.79],[.67,.79],[.81,.73],[.84,.59],[.79,.46],[.83,.35],
 [.77,.23],[.64,.19],[.51,.23],[.42,.30],[.33,.20],[.21,.27],
 [.16,.40],[.19,.55],[.15,.67],[.30,.79]
]);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const active=ps=>ps.filter(p=>p.active);
const racing=p=>p.active&&p.ice?.state==='racing';
function rand(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x||1640531527;return(s.seed>>>0)/4294967296;}
function catmull(a,b,c,d,t){
 return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
}
function makeTrack(s){
 const anchors=s.sizeClass==='large'?LARGE_ANCHORS:SMALL_ANCHORS;
 const src=anchors.map(([x,y])=>({x:x*s.w,y:y*s.h})),n=src.length,points=[];
 for(let i=0;i<n;i++)for(let k=0;k<10;k++){
  const t=k/10,at=j=>src[(j+n)%n];
  points.push({x:catmull(at(i-1).x,at(i).x,at(i+1).x,at(i+2).x,t),
   y:catmull(at(i-1).y,at(i).y,at(i+1).y,at(i+2).y,t)});
 }
 let length=0;
 const segments=points.map((p,i)=>{
  const q=points[(i+1)%points.length],dx=q.x-p.x,dy=q.y-p.y,size=Math.hypot(dx,dy);
  const seg={x:p.x,y:p.y,tx:dx/size,ty:dy/size,dist:size,start:length};
  length+=size;return seg;
 });
 s.path=segments;s.trackLength=length;
 s.checkpoints=Array.from({length:4},(_,id)=>{
  // On the small course, the first quarter lands on the inside of a tight
  // bend. Move its gate onto the following straight, so racers actually
  // cross the gate in its forward direction rather than cutting past it.
  const gateOffset=s.sizeClass==='small'&&id===1?45:0;
  const at=sample(s,length*id/4+gateOffset);
  return {id,x:at.x,y:at.y,tx:at.tx,ty:at.ty,progress:at.progress};
 });
}
function sample(s,d){
 const total=s.trackLength,progress=((d%total)+total)%total;
 // A small sampled spline keeps distance parameterization stable across framerates.
 const seg=s.path.find(v=>progress<v.start+v.dist)||s.path.at(-1);
 const f=clamp((progress-seg.start)/seg.dist,0,1);
 return {x:seg.x+seg.tx*seg.dist*f,y:seg.y+seg.ty*seg.dist*f,
  tx:seg.tx,ty:seg.ty,progress};
}
function nearest(s,x,y){
 let best=null,min=Infinity;
 for(const seg of s.path){
  const d=(x-seg.x)*seg.tx+(y-seg.y)*seg.ty;
  const u=clamp(d,0,seg.dist),px=seg.x+seg.tx*u,py=seg.y+seg.ty*u;
  const dist=Math.hypot(x-px,y-py);
  if(dist<min){min=dist;best={dist,x:px,y:py,tx:seg.tx,ty:seg.ty,
    progress:seg.start+u};}
 }
 return best;
}
function inputVector(input){
 if(window.PartyCharacters?.control){
  const v=window.PartyCharacters.control(input||{});
  return {x:Number(v.x)||0,y:Number(v.y)||0};
 }
 const v=input||{},x=Number(v.axisX)||Number(!!v.right)-Number(!!v.left);
 const y=Number(v.axisY)||Number(!!v.down)-Number(!!v.jump);
 const size=Math.hypot(x,y);
 return {x:size>1?x/size:x,y:size>1?y/size:y};
}
function initialSpawns(s,ps){
 for(let i=0;i<ps.length;i++){
  const p=ps[i],lane=i%2?1:-1,row=Math.floor(i/2);
  const at=sample(s,s.trackLength-44-row*90);
  // Keep an intentional but collision-free two-column starting grid in both
  // arenas; more participants get more side-to-side passing room later.
  const laneDistance=s.halfWidth*(s.sizeClass==='large'?.27:.50);
  p.x=at.x-at.ty*lane*laneDistance;
  p.y=at.y+at.tx*lane*laneDistance;
  p.vx=0;p.vy=0;p.score=0;p.active=true;
  p.dir={x:at.tx,y:at.ty};p.face=at.tx<0?-1:1;
  p.ice={state:'racing',vx:0,vy:0,heading:Math.atan2(at.ty,at.tx),
   angularVelocity:0,driftAngle:0,lastCheckpoint:0,nextCheckpoint:1,
   invulnerable:0,respawnLeft:0,fallLeft:0,botOffset:(rand(s)-.5)*s.halfWidth*.12,
   botSpeed:(.35+rand(s)*.08)*C.maxSpeed,botReaction:.035+rand(s)*.035,
   botClock:0,botInput:{x:0,y:0},botSkill:.75+rand(s)*.5,
   fallingVelocity:{x:0,y:0}};
 }
}
function scenery(s){
 s.floes=Array.from({length:85},(_,i)=>{
  const x=rand(s)*s.w,y=rand(s)*s.h;
  return {x,y,r:5+rand(s)*28,rotation:rand(s)*TAU,points:5+i%4};
 });
}
function setup(round,players){
 window.PartyCharacters?.activate?.(players);
 const ps=active(players);
 if(ps.length<1||ps.length>12)throw Error('ICE RACE supports 1–12 players');
 const sizeClass=ps.length<=6?'small':'large',cfg=C[sizeClass];
 const seed=(Number(round.iceSeed)||(Date.now()^0x47a2b91e))>>>0||1;
 const s={sizeClass,w:cfg.w,h:cfg.h,halfWidth:cfg.halfWidth,duration:cfg.duration,
  remaining:cfg.duration,elapsed:0,tick:0,accumulator:0,finished:false,
  seed,roster:ps,path:[],checkpoints:[],effects:[],ranking:[],winnerIds:[]};
 makeTrack(s);scenery(s);initialSpawns(s,ps);
 round.iceRace=s;round.remaining=s.duration;
 return s;
}
function botVector(s,p){
 const ice=p.ice,near=nearest(s,p.x,p.y);
 const speed=Math.hypot(ice.vx,ice.vy);
 const forward=sample(s,near.progress+clamp(95+speed*.35,95,215));
 const next=sample(s,near.progress+clamp(115+speed*.6,125,240));
 const turn=Math.max(Math.acos(clamp(forward.tx*next.tx+forward.ty*next.ty,-1,1)),
  Math.acos(clamp(near.tx*forward.tx+near.ty*forward.ty,-1,1)));
 const edge=near.dist/s.halfWidth;
 const targetSpeed=clamp(ice.botSpeed*(1-turn*1.4)*(1-edge*.4),48,ice.botSpeed);
 const tx=forward.x-forward.ty*ice.botOffset,ty=forward.y+forward.tx*ice.botOffset;
 const lead=.30+Math.min(.30,speed/500);
 let dx=tx-(p.x+ice.vx*lead),dy=ty-(p.y+ice.vy*lead);
 if(Math.hypot(dx,dy)<1){dx=forward.tx;dy=forward.ty;}
 const aim=Math.atan2(dy,dx),velocityDot=ice.vx*Math.cos(aim)+ice.vy*Math.sin(aim);
 const d=Math.hypot(dx,dy),throttle=speed>targetSpeed?0:speed>targetSpeed*.88?.25:1;
 // The AI uses exactly the same acceleration, angular inertia, drag and
 // fall physics as a human; stopping input to coast is not a teleport brake.
 return{x:Math.cos(aim)*throttle*(d>2?1:0),y:Math.sin(aim)*throttle*(d>2?1:0),
  velocityDot,aim};
}
function steer(p,control,dt){
 const w=p.ice,size=clamp(Math.hypot(control.x,control.y),0,1);
 if(size>.11||Number.isFinite(control.aim)){
  const aim=Number.isFinite(control.aim)?control.aim:Math.atan2(control.y,control.x);
  const wanted=clamp(angleDiff(aim,w.heading)*4.7,-C.turnSpeed,C.turnSpeed);
  w.angularVelocity+=clamp(wanted-w.angularVelocity,
   -C.turnAcceleration*dt,C.turnAcceleration*dt);
 }else w.angularVelocity*=Math.max(0,1-dt*5.5);
 w.heading+=w.angularVelocity*dt;
 const fx=Math.cos(w.heading),fy=Math.sin(w.heading),rx=-fy,ry=fx;
 const forward=w.vx*fx+w.vy*fy,side=w.vx*rx+w.vy*ry;
 const friction=1-Math.exp(-C.lateralGrip*dt),drag=Math.exp(-C.forwardDrag*dt);
 w.vx=(fx*forward+rx*side*(1-friction))*drag+fx*C.thrust*size*dt;
 w.vy=(fy*forward+ry*side*(1-friction))*drag+fy*C.thrust*size*dt;
 const speed=Math.hypot(w.vx,w.vy);
 if(speed>C.maxSpeed){w.vx*=C.maxSpeed/speed;w.vy*=C.maxSpeed/speed;}
 w.driftAngle=Math.atan2(w.vx*(-fy)+w.vy*fx,w.vx*fx+w.vy*fy);
 p.x+=w.vx*dt;p.y+=w.vy*dt;p.vx=w.vx;p.vy=w.vy;
 p.dir={x:fx,y:fy};p.face=fx<0?-1:1;
}
function fall(s,p){
 const w=p.ice;if(w.state!=='racing')return;
 w.state='falling';w.respawnLeft=C.fallDelay;
 w.fallingVelocity={x:w.vx,y:w.vy};w.fallLeft=0;
 if(s.effects.length>40)s.effects.shift();
 s.effects.push({x:p.x,y:p.y,life:.65,type:'splash',color:p.color});
}
function respawn(s,p){
 const w=p.ice,cp=s.checkpoints[w.lastCheckpoint];
 // Respawn 18 units AFTER the last checkpoint, not on its scoring line.
 // All alternate slots are within the drivable width and never overlap.
 const peers=s.roster.filter(v=>v!==p&&racing(v));
 let at=null;
 for(let i=0;i<12;i++){
  const progress=cp.progress+24+(i>>1)*31,point=sample(s,progress);
  const lane=(i%2?1:-1)*s.halfWidth*.34;
  const x=point.x-point.ty*lane,y=point.y+point.tx*lane;
  if(peers.every(q=>Math.hypot(q.x-x,q.y-y)>C.radius*2.3)){
   at={x,y,tx:point.tx,ty:point.ty};break;
  }
 }
 if(!at){const q=sample(s,cp.progress+41);at={x:q.x,y:q.y,tx:q.tx,ty:q.ty};}
 p.x=at.x;p.y=at.y;p.vx=0;p.vy=0;
 w.vx=0;w.vy=0;w.angularVelocity=0;w.driftAngle=0;
 w.heading=Math.atan2(at.ty,at.tx);w.state='racing';
 w.respawnLeft=0;w.invulnerable=C.spawnProtection;
 p.dir={x:at.tx,y:at.ty};p.face=at.tx<0?-1:1;
}
// The visible skis extend to x=±23 and y=±17. Collision uses the *whole*
// rotated sled rather than the tiny centre-circle of the old character.
function hullPoints(p){
 const a=p.ice.heading,fx=Math.cos(a),fy=Math.sin(a),rx=-fy,ry=fx;
 const L=C.hullHalfLength,W=C.hullHalfWidth;
 return [[-L,-W],[L,-W],[L,W],[-L,W]].map(([x,y])=>
  ({x:p.x+fx*x+rx*y,y:p.y+fy*x+ry*y}));
}
function hullContact(a,b){
 const L=C.hullHalfLength,W=C.hullHalfWidth;
 const dx=b.x-a.x,dy=b.y-a.y;
 if(dx*dx+dy*dy>4*(L*L+W*W))return null;
 const af={x:Math.cos(a.ice.heading),y:Math.sin(a.ice.heading)};
 const ar={x:-af.y,y:af.x};
 const bf={x:Math.cos(b.ice.heading),y:Math.sin(b.ice.heading)};
 const br={x:-bf.y,y:bf.x};
 let depth=Infinity,nx=0,ny=0;
 for(const axis of [af,ar,bf,br]){
  const d=dx*axis.x+dy*axis.y;
  const ra=L*Math.abs(af.x*axis.x+af.y*axis.y)+W*Math.abs(ar.x*axis.x+ar.y*axis.y);
  const rb=L*Math.abs(bf.x*axis.x+bf.y*axis.y)+W*Math.abs(br.x*axis.x+br.y*axis.y);
  const overlap=ra+rb-Math.abs(d);
  if(overlap<=1e-7)return null;
  if(overlap<depth){depth=overlap;nx=axis.x*(d<0?-1:1);ny=axis.y*(d<0?-1:1);}
 }
 // Clip the overlapping rectangles and use their contact patch centroid.
 // It gives nose, broadside and off-centre hits different angular impulses.
 let polygon=hullPoints(a),clip=hullPoints(b);
 for(let k=0;k<4;k++){
  const e=clip[k],next=clip[(k+1)%4],ex=next.x-e.x,ey=next.y-e.y;
  const signed=p=>ex*(p.y-e.y)-ey*(p.x-e.x);
  const input=polygon;polygon=[];
  if(!input.length)break;
  let prev=input[input.length-1],prevDist=signed(prev);
  for(const curr of input){
   const currDist=signed(curr);
   if((prevDist<0)!==(currDist<0)){
    const ratio=clamp(prevDist/(prevDist-currDist),0,1);
    polygon.push({x:prev.x+(curr.x-prev.x)*ratio,y:prev.y+(curr.y-prev.y)*ratio});
   }
   if(currDist>=0)polygon.push(curr);
   prev=curr;prevDist=currDist;
  }
 }
 const point=polygon.length?
  {x:polygon.reduce((v,p)=>v+p.x,0)/polygon.length,
   y:polygon.reduce((v,p)=>v+p.y,0)/polygon.length}:
  {x:(a.x+b.x)/2,y:(a.y+b.y)/2};
 return {nx,ny,depth,point};
}
function collide(ps){
 const alive=ps.filter(racing);
 // Resolve contacts in several iterations so three-way pileups don't
 // leave another sled embedded in the first one.
 for(let pass=0;pass<5;pass++)for(let i=0;i<alive.length;i++)
  for(let j=i+1;j<alive.length;j++){
   const a=alive[i],b=alive[j],aw=a.ice,bw=b.ice;
   // Respawn glow is cosmetic: newly spawned sleds are SOLID too.
   const hit=hullContact(a,b);
   if(!hit)continue;
   const {nx,ny,depth,point}=hit;
   const push=(depth+.001)*.5;
   a.x-=nx*push;a.y-=ny*push;
   b.x+=nx*push;b.y+=ny*push;
   const ax=point.x-a.x,ay=point.y-a.y;
   const bx=point.x-b.x,by=point.y-b.y;
   const avx=aw.vx-aw.angularVelocity*ay,avy=aw.vy+aw.angularVelocity*ax;
   const bvx=bw.vx-bw.angularVelocity*by,bvy=bw.vy+bw.angularVelocity*bx;
   const rel=(bvx-avx)*nx+(bvy-avy)*ny;
   if(rel>=0)continue; // already separating; positional separation only
   const an=ax*ny-ay*nx,bn=bx*ny-by*nx;
   const invInertia=1/C.impactInertia;
   const impulse=-(1+C.restitution)*rel/(2+(an*an+bn*bn)*invInertia);
   const ix=impulse*nx,iy=impulse*ny;
   aw.vx-=ix;aw.vy-=iy;bw.vx+=ix;bw.vy+=iy;
   aw.angularVelocity-=an*impulse*invInertia;
   bw.angularVelocity+=bn*impulse*invInertia;
   // Ice has very weak tangential collision friction: most side momentum
   // survives an impact, rather than snapping either sled straight.
   const tx=-ny,ty=nx;
   const vaT=(bw.vx-bw.angularVelocity*by-aw.vx+aw.angularVelocity*ay)*tx+
    (bw.vy+bw.angularVelocity*bx-aw.vy-aw.angularVelocity*ax)*ty;
   const at=ax*ty-ay*tx,bt=bx*ty-by*tx;
   const tangential=clamp(-vaT/(2+(at*at+bt*bt)*invInertia),
    -C.impactFriction*impulse,C.impactFriction*impulse);
   aw.vx-=tangential*tx;aw.vy-=tangential*ty;
   bw.vx+=tangential*tx;bw.vy+=tangential*ty;
   aw.angularVelocity-=at*tangential*invInertia;
   bw.angularVelocity+=bt*tangential*invInertia;
   for(const p of [a,b]){
    const w=p.ice,speed=Math.hypot(w.vx,w.vy);
    if(speed>C.maxSpeed*1.2){
     const scale=C.maxSpeed*1.2/speed;w.vx*=scale;w.vy*=scale;
    }
    w.angularVelocity=clamp(w.angularVelocity,-C.turnSpeed*1.5,C.turnSpeed*1.5);
    p.vx=w.vx;p.vy=w.vy;
    const fx=Math.cos(w.heading),fy=Math.sin(w.heading);
    w.driftAngle=Math.atan2(w.vx*(-fy)+w.vy*fx,w.vx*fx+w.vy*fy);
   }
  }
}
function checkpoint(s,p,before){
 const w=p.ice,cp=s.checkpoints[w.nextCheckpoint],nx=cp.tx,ny=cp.ty;
 const from=(before.x-cp.x)*nx+(before.y-cp.y)*ny;
 const to=(p.x-cp.x)*nx+(p.y-cp.y)*ny;
 if(from>0||to<0||from===to)return false;
 const t=-from/(to-from),x=before.x+(p.x-before.x)*t,y=before.y+(p.y-before.y)*t;
 const across=Math.abs((x-cp.x)*(-ny)+(y-cp.y)*nx);
 if(across>s.halfWidth-C.radius*.15)return false;
 // The current target advances exactly once; reverse crossings, wrong
 // checkpoints and spawn on a marker cannot add points.
 p.score+=1;w.lastCheckpoint=w.nextCheckpoint;
 w.nextCheckpoint=(w.nextCheckpoint+1)%s.checkpoints.length;
 if(s.effects.length>40)s.effects.shift();
 s.effects.push({x:p.x,y:p.y-21,life:.58,type:'score',color:p.color});
 return true;
}
function finish(s,round,ps){
 if(s.finished)return;
 s.finished=true;s.remaining=0;round.remaining=0;
 const roster=active(ps),value=p=>Math.trunc(p.score||0);
 s.ranking=roster.map(p=>({id:p.id,value:value(p),
  rank:1+roster.filter(q=>value(q)>value(p)).length}))
  .sort((a,b)=>a.rank-b.rank||String(a.id).localeCompare(String(b.id)));
 const top=s.ranking[0]?.value;
 s.winnerIds=s.ranking.filter(r=>r.value===top).map(r=>r.id);
}
function step(dt,round,ps){
 const s=round.iceRace;if(s.finished)return;
 const allowed=Math.min(dt,Math.max(0,s.remaining));
 s.elapsed+=allowed;s.remaining=Math.max(0,s.duration-s.elapsed);s.tick++;
 const previous=new Map();
 for(const p of active(ps)){
  const w=p.ice;if(!w)continue;
  if(w.state==='falling'){
   w.fallLeft+=allowed;w.respawnLeft-=allowed;
   p.x+=w.fallingVelocity.x*allowed*.36;
   p.y+=w.fallingVelocity.y*allowed*.36;
   if(w.respawnLeft<=0)respawn(s,p);
   continue;
  }
  previous.set(p.id,{x:p.x,y:p.y});
  w.invulnerable=Math.max(0,w.invulnerable-allowed);
  let ctrl=inputVector(p.input);
  if(p.isBot){
   w.botClock-=allowed;
   if(w.botClock<=0){w.botInput=botVector(s,p);w.botClock=w.botReaction;}
   ctrl=w.botInput;
  }
  steer(p,ctrl,allowed);
 }
 collide(ps);
 // Collision displacement is included in the support test. A car cannot
 // stick to an invisible side rail after being shunted by another player.
 for(const p of active(ps)){
  const w=p.ice;if(w?.state!=='racing')continue;
  if(nearest(s,p.x,p.y).dist>s.halfWidth-C.radius*.12){fall(s,p);continue;}
  const prev=previous.get(p.id);
  if(prev)checkpoint(s,p,prev);
 }
 for(let i=s.effects.length-1;i>=0;i--){
  s.effects[i].life-=allowed;if(s.effects[i].life<=0)s.effects.splice(i,1);
 }
 round.remaining=s.remaining;
 if(s.remaining<=1e-9)finish(s,round,ps);
}
function update(dt,round,ps){
 const s=round.iceRace;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.25,s.accumulator+clamp(Number(dt)||0,0,.25));
 let iterations=0;
 while(s.accumulator+1e-10>=STEP&&iterations++<15&&!s.finished){
  step(STEP,round,ps);s.accumulator-=STEP;
 }
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.iceRace;
 return {survivors:active(ps).length,remaining:round.remaining,
  scores:active(ps).map(p=>({id:p.id,score:p.score||0})),
  winnerIds:s?.winnerIds||[]};
}
function path(g,s){
 g.beginPath();for(let i=0;i<s.path.length;i++){
  const p=s.path[i];if(!i)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);
 }g.closePath();
}
function disc(g,x,y,r,color){
 g.fillStyle=color;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();
}
function iceWorld(g,s,t){
 if(window.ReferenceArenaArt?.ice(g,s))return;
 const bg=g.createLinearGradient(0,0,s.w,s.h);
 bg.addColorStop(0,'#0961dd');bg.addColorStop(.52,'#087afa');bg.addColorStop(1,'#0647c7');
 g.fillStyle=bg;g.fillRect(0,0,s.w,s.h);
 for(const f of s.floes){
  g.save();g.translate(f.x,f.y);g.rotate(f.rotation);
  g.fillStyle='rgba(59,207,255,.18)';g.beginPath();
  for(let i=0;i<f.points;i++){
   const a=i*TAU/f.points,r=f.r*(i%2?.86:1);
   if(!i)g.moveTo(Math.cos(a)*r,Math.sin(a)*r);else g.lineTo(Math.cos(a)*r,Math.sin(a)*r);
  }g.closePath();g.fill();g.restore();
 }
 g.save();g.translate(0,16);path(g,s);
 g.lineCap='round';g.lineJoin='round';g.lineWidth=s.halfWidth*2+16;
 g.strokeStyle='rgba(0,20,86,.36)';g.stroke();g.restore();
 path(g,s);g.lineCap='round';g.lineJoin='round';g.lineWidth=s.halfWidth*2+14;
 g.strokeStyle='#038fc4';g.stroke();
 path(g,s);g.lineWidth=s.halfWidth*2+3;g.strokeStyle='#b6eafd';g.stroke();
 path(g,s);g.lineWidth=s.halfWidth*2-7;g.strokeStyle='#edfbff';g.stroke();
 path(g,s);g.lineWidth=s.halfWidth*2-14;g.strokeStyle='#e0f7fd';g.stroke();
 // Use short, direction-aligned grey arrows, not big overhead signs.
 for(let d=68;d<s.trackLength;d+=116){
  const p=sample(s,d),a=Math.atan2(p.ty,p.tx);
  g.save();g.translate(p.x,p.y);g.rotate(a);g.strokeStyle='rgba(55,110,148,.32)';
  g.lineWidth=4;g.lineCap='round';g.beginPath();
  g.moveTo(-12,-9);g.lineTo(8,0);g.lineTo(-12,9);g.stroke();g.restore();
 }
 for(const cp of s.checkpoints){
  g.save();g.translate(cp.x,cp.y);g.rotate(Math.atan2(cp.ty,cp.tx));
  g.strokeStyle=cp.id===0?'#91ecff':'#56bfe5';g.lineWidth=5;
  g.beginPath();g.moveTo(0,-s.halfWidth+7);g.lineTo(0,s.halfWidth-7);g.stroke();
  g.strokeStyle='rgba(255,255,255,.95)';g.lineWidth=2;
  g.beginPath();g.moveTo(3,-s.halfWidth+9);g.lineTo(3,s.halfWidth-9);g.stroke();
  g.restore();
 }
}
function sled(g,p,t){
 const w=p.ice;if(!w)return;
 if(window.ReferenceArenaArt?.sled(g,p,t))return;
 if(w.state==='falling'&&w.fallLeft>.65)return;
 const fall=w.state==='falling',f=fall?Math.max(.25,1-w.fallLeft*1.3):1;
 g.save();g.translate(p.x,p.y+(fall?w.fallLeft*22:0));
 g.rotate(w.heading+(fall?w.fallLeft*1.7:0));g.scale(f,f);
 g.globalAlpha=fall?Math.max(.12,1-w.fallLeft*1.7):1;
 const color=p.color||'#ff6677';
 g.fillStyle='#12567e55';g.beginPath();g.ellipse(2,8,23,16,0,0,TAU);g.fill();
 if(!fall&&Math.abs(w.driftAngle)>.18&&Math.hypot(w.vx,w.vy)>60){
  for(const o of [-1,1])disc(g,-23,o*11,3+Math.abs(Math.sin(t*12+o)), '#bbfaff');
 }
 g.strokeStyle='#207394';g.lineWidth=4;g.lineCap='round';
 for(const side of [-1,1]){
  g.beginPath();g.moveTo(-23,side*15);g.lineTo(23,side*15);g.stroke();
  g.strokeStyle='#f4fcff';g.lineWidth=2;
  g.beginPath();g.moveTo(-23,side*17);g.lineTo(23,side*17);g.stroke();
  g.strokeStyle='#207394';g.lineWidth=4;
 }
 g.fillStyle='#1b4559';g.beginPath();g.roundRect(-21,-13,38,26,9);g.fill();
 g.fillStyle=color;g.beginPath();g.roundRect(-17,-12,34,24,8);g.fill();
 g.fillStyle='#e9f9ff';g.beginPath();g.roundRect(8,-9,10,18,5);g.fill();
 disc(g,-15,0,9,'#294e64');disc(g,-15,0,5,'#f7b949');
 // The existing character colours remain visible on their sled.
 disc(g,-2,0,11,color);disc(g,1,0,7,'#f8d7b2');
 disc(g,4,-3,1.6,'#334957');disc(g,4,3,1.6,'#334957');
 g.save();g.rotate(-w.heading);g.fillStyle='#f8feff';g.font='bold 11px system-ui';
 g.textAlign='center';g.shadowColor='#164b80';g.shadowBlur=4;
 g.fillText(String(p.name||'').slice(0,12),0,-29);g.restore();
 if(w.invulnerable>0){g.strokeStyle='#c0f8ff';g.lineWidth=2;g.setLineDash([5,4]);g.beginPath();g.arc(0,0,24,0,TAU);g.stroke();}
 g.restore();
}
function draw(g,t,round,ps){
 const s=round.iceRace;if(!s)return;
 // Canvas scale is identical for both arenas, so the large road must have a
 // meaningfully larger physical half-width to also look wider on screen.
 g.save();g.scale(960/s.w,540/s.h);iceWorld(g,s,t);
 for(const p of active(ps))sled(g,p,t);
 for(const effect of s.effects){
  g.save();g.globalAlpha=clamp(effect.life*1.6,0,1);
  g.textAlign='center';g.font='bold 18px system-ui';
  g.fillStyle=effect.type==='score'?'#fff8be':'#bcf5ff';
  g.fillText(effect.type==='score'?'+1':'✧',effect.x,
   effect.y-(.65-effect.life)*25);g.restore();
 }
 g.restore();
}
function getResult(round,players){
 return players.filter(p=>p.active).map(p=>{
  const value=Number(p.score)||0;
 const label=value+' คะแนน';
  return {id:p.id,value,label};
 });
}
window.IceRace=Object.freeze({getResult,resultTitle:"ผ่านเช็กพอยต์มากที่สุด!",countdownSeconds:3,setup,update,draw,hud,step,finish,checkpoint,
 nearest,sample,collide,hullContact,hullPoints,fall,respawn,makeTrack,botVector,config:C});
})();
