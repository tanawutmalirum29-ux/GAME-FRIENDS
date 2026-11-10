/* ICE RACE — host-authoritative drifting sleds on a closed floating ice road.
   Three hand-designed courses (small 1–4, medium 5–8, large 9–12 racers).
   One sampled centreline with a per-point road half-width drives rendering,
   fall detection, spawns, bot guidance and strictly ordered, direction-sensitive
   checkpoints, so the visible ice and the physical support can never disagree. */
(() => {
'use strict';
const TAU=Math.PI*2, STEP=1/60;
// Course specs. A course is a closed polyline of waypoints [x, y, cornerRadius, widthFactor];
// every corner is rounded with a true circular arc (radius 0 = pass straight through)
// and the width factor scales halfWidth at that waypoint, blended smoothly along the road.
// Design rules for every course:
//  * unrelated stretches of road stay >= hwA+hwB+~28 apart (no accidental bridges)
//  * waypoint 0 sits on a long straight: that straight is the start grid
//  * every bend radius stays comfortably above the road half-width
const TRACKS=Object.freeze({
 // 1–4 racers: compact counter-clockwise circuit. Long start straight, a deep
 // hairpin dive off the top road, and a left/right/left S-chicane on the west bank.
 small:Object.freeze({key:'small',name:'Frozen Lagoon',w:960,h:540,halfWidth:54,duration:30,
  gates:6,cols:2,laneGap:.82,rowSpacing:76,theme:{sea0:'#0a66e0',sea1:'#087afa',sea2:'#0647c7'},
  waypoints:[
   [480,462,0,1],[870,462,78,1],[870,92,78,.96],[640,92,84,1],[640,312,82,1.1],
   [470,312,82,1.1],[470,92,84,1],[130,92,78,1],[130,252,100,.9],[210,332,100,.86],
   [210,462,72,.95]]}),
 // 5–8 racers: clockwise grand circuit. Two tongues of road reach into the bay:
 // a wide sweeping hairpin from the top road and a tighter one from the bottom road.
 // Start grid sits on the long east bank.
 medium:Object.freeze({key:'medium',name:'Aurora Bay',w:1200,h:675,halfWidth:62,duration:50,
  gates:8,cols:2,laneGap:.8,rowSpacing:76,theme:{sea0:'#0a74d8',sea1:'#0791e6',sea2:'#0553b8'},
  waypoints:[
   [1115,485,0,1],[1115,580,86,1],[940,580,90,.96],[940,275,90,.92],[750,275,90,.92],
   [750,580,90,1],[430,580,0,1.22],[110,580,90,1.1],[110,430,100,.92],[170,310,100,.88],
   [110,190,100,.92],[110,95,86,1],[330,95,90,1],[330,390,100,1.08],[560,390,100,1.1],
   [560,95,90,1],[820,95,0,1.22],[1115,95,86,1]]}),
 // 9–12 racers: a long double serpentine in four lanes of road with five U-turns,
 // a wide start plaza on the north road, a broad south plaza and tighter hairpins.
 large:Object.freeze({key:'large',name:'Glacier Run',w:1440,h:810,halfWidth:74,duration:70,
  gates:10,cols:3,laneGap:.6,rowSpacing:78,theme:{sea0:'#0b5fcf',sea1:'#0a74e8',sea2:'#053fae'},
  waypoints:[
   [560,95,0,1.16],[900,95,0,1.2],[1330,95,90,1],[1330,305,96,1],[640,305,100,.95],[640,510,100,.95],
   [1190,510,96,1],[1190,715,96,1],[530,715,0,1.2],[110,715,90,1],[110,510,90,1],
   [420,510,96,.95],[420,305,96,.95],[110,305,90,1],[110,95,90,1.08]]})
});
const C=Object.freeze({
 small:TRACKS.small,medium:TRACKS.medium,large:TRACKS.large,
 radius:14,hullHalfLength:24,hullHalfWidth:18,maxSpeed:268,thrust:380,forwardDrag:.33,lateralGrip:2.1,
 turnSpeed:3.65,turnAcceleration:12.5,restitution:.62,impactInertia:900,impactFriction:.08,
 fallDelay:.8,spawnProtection:.6
});
const sizeClassFor=n=>n<=4?'small':n<=8?'medium':'large';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const active=ps=>ps.filter(p=>p.active);
const racing=p=>p.active&&p.ice?.state==='racing';
function rand(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x||1640531527;return(s.seed>>>0)/4294967296;}
function rng(seed){let x=(seed|0)||1640531527;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;x|=0;return(x>>>0)/4294967296;};}
// Turn a waypoint polyline into a dense closed centreline of straights and circular arcs.
function roundedLoop(wp,baseHalfWidth){
 const n=wp.length,pts=[],keys=[];
 // Pass 1: ideal tangent length of every fillet; pass 2: shrink neighbours that would
 // overlap on a shared edge (proportionally, never more than 98% of the edge together).
 const want=wp.map((P,i)=>{
  const A=wp[(i+n-1)%n],B=wp[(i+1)%n],r=P[2]||0;
  const ux=A[0]-P[0],uy=A[1]-P[1],vx=B[0]-P[0],vy=B[1]-P[1];
  const ang=Math.acos(clamp((ux*vx+uy*vy)/(Math.hypot(ux,uy)*Math.hypot(vx,vy)),-1,1));
  return r>0&&ang<Math.PI-1e-3?r/Math.tan(ang/2):0;
 });
 const use=want.slice();
 for(let i=0;i<n;i++){
  const j=(i+1)%n,L=Math.hypot(wp[j][0]-wp[i][0],wp[j][1]-wp[i][1]),sum=want[i]+want[j];
  if(sum>L*.98){const f=L*.98/sum;use[i]=Math.min(use[i],want[i]*f);use[j]=Math.min(use[j],want[j]*f);}
 }
 for(let i=0;i<n;i++){
  const P=wp[i],A=wp[(i+n-1)%n],B=wp[(i+1)%n],wf=P[3]??1;
  let ux=A[0]-P[0],uy=A[1]-P[1],vx=B[0]-P[0],vy=B[1]-P[1];
  const lu=Math.hypot(ux,uy),lv=Math.hypot(vx,vy);ux/=lu;uy/=lu;vx/=lv;vy/=lv;
  const ang=Math.acos(clamp(ux*vx+uy*vy,-1,1)),t=use[i];
  if(!(want[i]>0)||t<1e-3){keys.push({i:pts.length,wf});pts.push({x:P[0],y:P[1]});continue;}
  const rr=t*Math.tan(ang/2);
  const bx=ux+vx,by=uy+vy,bl=Math.hypot(bx,by),cd=rr/Math.sin(ang/2);
  const cx=P[0]+bx/bl*cd,cy=P[1]+by/bl*cd;
  const t1={x:P[0]+ux*t,y:P[1]+uy*t},t2={x:P[0]+vx*t,y:P[1]+vy*t};
  const a1=Math.atan2(t1.y-cy,t1.x-cx);
  let delta=Math.atan2(t2.y-cy,t2.x-cx)-a1;
  while(delta>Math.PI)delta-=TAU;while(delta<-Math.PI)delta+=TAU;
  const steps=Math.max(3,Math.ceil(Math.abs(delta)*rr/9));
  for(let k=0;k<=steps;k++){
   if(k===Math.round(steps/2))keys.push({i:pts.length,wf});
   const a=a1+delta*k/steps;pts.push({x:cx+Math.cos(a)*rr,y:cy+Math.sin(a)*rr});
  }
 }
 // Long straights get intermediate points so width blends and sampling stay smooth.
 const dense=[],map=new Map();
 for(let i=0;i<pts.length;i++){
  const p=pts[i],q=pts[(i+1)%pts.length];
  map.set(i,dense.length);dense.push({x:p.x,y:p.y});
  const d=Math.hypot(q.x-p.x,q.y-p.y),extra=Math.floor(d/40);
  for(let k=1;k<=extra;k++)dense.push({x:p.x+(q.x-p.x)*k/(extra+1),y:p.y+(q.y-p.y)*k/(extra+1)});
 }
 const cum=[0];
 for(let i=1;i<=dense.length;i++){
  const a=dense[i-1],b=dense[i%dense.length];cum.push(cum[i-1]+Math.hypot(b.x-a.x,b.y-a.y));
 }
 const total=cum[dense.length];
 const kd=keys.map(k=>({d:cum[map.get(k.i)],wf:k.wf}));
 for(let i=0;i<dense.length;i++){
  const d=cum[i];let lo=kd[kd.length-1],hi=kd[0],ld=lo.d-total,hd=hi.d;
  for(let j=0;j<kd.length;j++){
   if(kd[j].d<=d){lo=kd[j];ld=lo.d;hi=kd[(j+1)%kd.length];hd=j+1<kd.length?hi.d:hi.d+total;}
  }
  const f=hd>ld?clamp((d-ld)/(hd-ld),0,1):0,e=f*f*(3-2*f);
  dense[i].hw=baseHalfWidth*(lo.wf+(hi.wf-lo.wf)*e);
 }
 return dense;
}
function makeTrack(s){
 const spec=s.spec||C[s.sizeClass],points=roundedLoop(spec.waypoints,spec.halfWidth);
 let length=0;const m=points.length;
 const segments=points.map((p,i)=>{
  const q=points[(i+1)%m],dx=q.x-p.x,dy=q.y-p.y,size=Math.hypot(dx,dy)||1e-6;
  const seg={x:p.x,y:p.y,tx:dx/size,ty:dy/size,dist:size,start:length,hw0:p.hw,hw1:q.hw,k:0};
  length+=size;return seg;
 });
 // Signed curvature (rad/unit, >0 = turning toward the road's right-hand side).
 const raw=segments.map((g,i)=>{
  const h=segments[(i+1)%m];
  return Math.atan2(g.tx*h.ty-g.ty*h.tx,g.tx*h.tx+g.ty*h.ty)/((g.dist+h.dist)/2);
 });
 for(let i=0;i<m;i++){let sum=0;for(let o=-2;o<=2;o++)sum+=raw[(i+o+m)%m];segments[i].k=sum/5;}
 s.path=segments;s.trackLength=length;
 s.starts=segments.map(g=>g.start);
 s.maxHalfWidth=Math.max(...points.map(p=>p.hw));
 placeGates(s,spec.gates);
}
// Gates are spread evenly but slid to the calmest nearby stretch of road, so
// each one is crossed head-on instead of being clipped on the inside of a bend.
function placeGates(s,count){
 const total=s.trackLength,spacing=total/count,gates=[];
 const calm=d=>{let sum=0;for(let o=-70;o<=70;o+=10)sum+=Math.abs(sample(s,d+o).k);return sum;};
 for(let id=0;id<count;id++){
  let best=0;
  if(id>0){let bestCost=Infinity;
   for(let off=-spacing*.28;off<=spacing*.28;off+=6){
    const cost=calm(spacing*id+off)+Math.abs(off)*.0004;
    if(cost<bestCost){bestCost=cost;best=off;}
   }}
  const at=sample(s,spacing*id+best);
  gates.push({id,x:at.x,y:at.y,tx:at.tx,ty:at.ty,hw:at.hw,progress:at.progress});
 }
 s.checkpoints=gates;
}
function sample(s,d){
 const total=s.trackLength,progress=((d%total)+total)%total,st=s.starts;
 let lo=0,hi=st.length-1;
 while(lo<hi){const mid=(lo+hi+1)>>1;if(st[mid]<=progress)lo=mid;else hi=mid-1;}
 const seg=s.path[lo],f=clamp((progress-seg.start)/seg.dist,0,1);
 return {x:seg.x+seg.tx*seg.dist*f,y:seg.y+seg.ty*seg.dist*f,
  tx:seg.tx,ty:seg.ty,progress,hw:seg.hw0+(seg.hw1-seg.hw0)*f,k:seg.k};
}
// Closest point of the road sweep: the segment with the smallest (distance - halfWidth).
// margin <= 0 means the point is on the ice. `dist`/`hw` are those of that foot point.
function nearest(s,x,y){
 let best=null,min=Infinity;
 for(const seg of s.path){
  const d=(x-seg.x)*seg.tx+(y-seg.y)*seg.ty;
  const u=clamp(d,0,seg.dist),px=seg.x+seg.tx*u,py=seg.y+seg.ty*u;
  const dist=Math.hypot(x-px,y-py),hw=seg.hw0+(seg.hw1-seg.hw0)*(u/seg.dist),margin=dist-hw;
  if(margin<min){min=margin;best={dist,hw,margin,x:px,y:py,tx:seg.tx,ty:seg.ty,
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
 const spec=s.spec,cols=spec.cols;
 for(let i=0;i<ps.length;i++){
  const p=ps[i],col=i%cols,row=Math.floor(i/cols),lane=col-(cols-1)/2;
  // Staggered grid on the start straight; spacing scales with the road width.
  const at=sample(s,s.trackLength-46-row*spec.rowSpacing-(col%2)*22);
  const laneDistance=at.hw*spec.laneGap*lane;
  p.x=at.x-at.ty*laneDistance;
  p.y=at.y+at.tx*laneDistance;
  p.vx=0;p.vy=0;p.score=0;p.active=true;
  p.dir={x:at.tx,y:at.ty};p.face=at.tx<0?-1:1;
  p.ice={state:'racing',vx:0,vy:0,heading:Math.atan2(at.ty,at.tx),
   angularVelocity:0,driftAngle:0,lastCheckpoint:0,nextCheckpoint:1,
   invulnerable:0,respawnLeft:0,fallLeft:0,botOffset:(rand(s)-.5)*.7,
   botSpeed:(.92+rand(s)*.06)*C.maxSpeed,botReaction:.016+rand(s)*.012,
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
 const sizeClass=sizeClassFor(ps.length),cfg=C[sizeClass];
 const seed=(Number(round.iceSeed)||(Date.now()^0x47a2b91e))>>>0||1;
 const s={sizeClass,spec:cfg,trackName:cfg.name,w:cfg.w,h:cfg.h,halfWidth:cfg.halfWidth,
  duration:cfg.duration,remaining:cfg.duration,elapsed:0,tick:0,accumulator:0,finished:false,
  seed,roster:ps,path:[],checkpoints:[],effects:[],ranking:[],winnerIds:[]};
 makeTrack(s);scenery(s);initialSpawns(s,ps);
 round.iceRace=s;round.remaining=s.duration;
 return s;
}
function botVector(s,p){
 const ice=p.ice,near=nearest(s,p.x,p.y);
 const speed=Math.hypot(ice.vx,ice.vy);
 const forward=sample(s,near.progress+clamp(78+speed*.35,78,215));
 const next=sample(s,near.progress+clamp(115+speed*.6,125,240));
 const turn=Math.max(Math.acos(clamp(forward.tx*next.tx+forward.ty*next.ty,-1,1)),
  Math.acos(clamp(near.tx*forward.tx+near.ty*forward.ty,-1,1)));
 const edge=near.dist/near.hw;
 // Light traffic awareness: drift sideways around a sled that is just ahead,
 // so a full grid of bots spreads out and fights for lines instead of stacking.
 let avoid=0;
 for(const q of s.roster){
  if(q===p||!racing(q))continue;
  const rx=q.x-p.x,ry=q.y-p.y;
  const ahead=rx*near.tx+ry*near.ty,side=rx*(-near.ty)+ry*near.tx;
  if(ahead>0&&ahead<125&&Math.abs(side)<44)
   avoid+=(side>0?-1:1)*(1-ahead/125)*(1-Math.abs(side)/60);
 }
 const lane=clamp(ice.botOffset*forward.hw+avoid*38,-forward.hw*.6,forward.hw*.6);
 // Bots race close to the human speed cap rather than crawling at 35% of it.
 // Coast only when exceeding a corner's safe speed; otherwise full throttle.
 const targetSpeed=clamp(ice.botSpeed*(1-turn*.38)*(1-edge*edge*.2),
  C.maxSpeed*.25,ice.botSpeed);
 const tx=forward.x-forward.ty*lane,ty=forward.y+forward.tx*lane;
 const lead=.30+Math.min(.30,speed/500);
 let dx=tx-(p.x+ice.vx*lead),dy=ty-(p.y+ice.vy*lead);
 if(Math.hypot(dx,dy)<1){dx=forward.tx;dy=forward.ty;}
 const aim=Math.atan2(dy,dx),velocityDot=ice.vx*Math.cos(aim)+ice.vy*Math.sin(aim);
 const d=Math.hypot(dx,dy),throttle=speed>targetSpeed?0:1;
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
  const lane=(i%2?1:-1)*point.hw*.34;
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
 if(across>cp.hw-C.radius*.15)return false;
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
  const near=nearest(s,p.x,p.y);
  if(near.dist>near.hw-C.radius*.12){fall(s,p);continue;}
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
function disc(g,x,y,r,color){
 g.fillStyle=color;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();
}
// One stroke per centreline segment with its own width: the union of round-capped
// strokes is exactly the swept road that nearest() tests, so ice and physics agree.
function strokeRoad(g,s,extra,color,dx,dy){
 g.save();g.translate(dx||0,dy||0);g.strokeStyle=color;g.lineCap='round';g.lineJoin='round';
 for(const seg of s.path){
  g.lineWidth=seg.hw0+seg.hw1+extra*2;
  g.beginPath();g.moveTo(seg.x,seg.y);
  g.lineTo(seg.x+seg.tx*seg.dist,seg.y+seg.ty*seg.dist);g.stroke();
 }
 g.restore();
}
function berg(g,x,y,r,R){
 const n=7,pts=[];
 for(let i=0;i<n;i++){const a=i*TAU/n+R()*.5,k=r*(.78+R()*.3);pts.push([Math.cos(a)*k,Math.sin(a)*k*.82]);}
 g.save();g.translate(x,y);
 g.fillStyle='rgba(150,232,255,.22)';g.beginPath();g.ellipse(0,r*.32,r*1.3,r*.62,0,0,TAU);g.fill();
 g.fillStyle='#7cc6e6';g.beginPath();pts.forEach(([px,py],i)=>i?g.lineTo(px,py+r*.18):g.moveTo(px,py+r*.18));g.closePath();g.fill();
 g.fillStyle='#e6faff';g.beginPath();pts.forEach(([px,py],i)=>i?g.lineTo(px*.9,py*.9-r*.14):g.moveTo(px*.9,py*.9-r*.14));g.closePath();g.fill();
 g.fillStyle='rgba(255,255,255,.9)';g.beginPath();
 g.moveTo(pts[0][0]*.5,pts[0][1]*.5-r*.2);g.lineTo(pts[1][0]*.55,pts[1][1]*.55-r*.2);g.lineTo(pts[2][0]*.4,pts[2][1]*.4-r*.1);g.closePath();g.fill();
 g.restore();
}
// Everything that never changes during a race is painted once into an offscreen layer.
function paintWorld(g,s){
 const R=rng((s.seed^0x5bd1e995)|0),th=s.spec.theme;
 const bg=g.createLinearGradient(0,0,s.w,s.h);
 bg.addColorStop(0,th.sea0);bg.addColorStop(.52,th.sea1);bg.addColorStop(1,th.sea2);
 g.fillStyle=bg;g.fillRect(0,0,s.w,s.h);
 // gentle swell marks
 g.strokeStyle='rgba(190,238,255,.10)';g.lineWidth=2;g.lineCap='round';
 const swell=Math.round(s.w*s.h/6500);
 for(let i=0;i<swell;i++){
  const x=R()*s.w,y=R()*s.h,len=14+R()*26;
  g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+len/2,y-4,x+len,y);g.stroke();
 }
 for(const f of s.floes){
  g.save();g.translate(f.x,f.y);g.rotate(f.rotation);
  g.fillStyle='rgba(59,207,255,.18)';g.beginPath();
  for(let i=0;i<f.points;i++){
   const a=i*TAU/f.points,r=f.r*(i%2?.86:1);
   if(!i)g.moveTo(Math.cos(a)*r,Math.sin(a)*r);else g.lineTo(Math.cos(a)*r,Math.sin(a)*r);
  }g.closePath();g.fill();g.restore();
 }
 // icebergs only in open water, never close enough to read as road
 const bergs=[],want=Math.round(s.w*s.h/42000);
 for(let tries=0;tries<700&&bergs.length<want;tries++){
  const r=13+R()*20,x=r+R()*(s.w-2*r),y=r+R()*(s.h-2*r);
  if(nearest(s,x,y).margin<r+38)continue;
  if(bergs.some(b=>Math.hypot(b.x-x,b.y-y)<b.r+r+22))continue;
  bergs.push({x,y,r});
 }
 for(const b of bergs)berg(g,b.x,b.y,b.r,R);
 // ice shelf: drop shadow, cliff wall, lit rim, then the drivable surface
 strokeRoad(g,s,9,'#063a9c',0,24);
 strokeRoad(g,s,8,'#146ea6',0,13);
 strokeRoad(g,s,8,'#2aa0d4',0,7);
 strokeRoad(g,s,7,'#5cc6ea',0,0);
 strokeRoad(g,s,1.5,'#b6eafd',0,0);
 strokeRoad(g,s,-3.5,'#edfbff',0,0);
 strokeRoad(g,s,-8,'#e2f7fd',0,0);
 // hairline cracks and frost glints, kept soft so sleds and gates stay readable
 const cracks=Math.round(s.trackLength/34);
 g.lineCap='round';g.lineJoin='round';
 for(let i=0;i<cracks;i++){
  const at=sample(s,R()*s.trackLength),off=(R()*2-1)*at.hw*.62;
  let x=at.x-at.ty*off,y=at.y+at.tx*off,a=Math.atan2(at.ty,at.tx)+(R()-.5)*2.2;
  g.strokeStyle='rgba(104,176,208,.5)';g.lineWidth=1.1;g.beginPath();g.moveTo(x,y);
  const steps=2+(R()*2|0);
  for(let k=0;k<steps;k++){a+=(R()-.5)*.9;x+=Math.cos(a)*(7+R()*9);y+=Math.sin(a)*(7+R()*9);g.lineTo(x,y);}
  g.stroke();
  if(R()<.35){g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a+.9)*8,y+Math.sin(a+.9)*8);g.stroke();}
 }
 g.fillStyle='rgba(255,255,255,.95)';
 for(let i=0;i<cracks;i++){
  const at=sample(s,R()*s.trackLength),off=(R()*2-1)*at.hw*.7;
  g.beginPath();g.ellipse(at.x-at.ty*off,at.y+at.tx*off,2.2+R()*2,1+R(),R()*3,0,TAU);g.fill();
 }
 // red/white kerbs on the outside edge of the tight bends mark the dangerous corners
 for(const seg of s.path){
  if(Math.abs(seg.k)<.0078)continue;
  const side=seg.k>0?-1:1,nx=-seg.ty*side,ny=seg.tx*side,ex=seg.x+seg.tx*seg.dist,ey=seg.y+seg.ty*seg.dist;
  const a0=seg.hw0-9,a1=seg.hw0+1.5,b0=seg.hw1-9,b1=seg.hw1+1.5;
  g.fillStyle=(Math.floor(seg.start/15)&1)?'#ff6b5e':'#ffffff';
  g.beginPath();g.moveTo(seg.x+nx*a0,seg.y+ny*a0);g.lineTo(seg.x+nx*a1,seg.y+ny*a1);
  g.lineTo(ex+nx*b1,ey+ny*b1);g.lineTo(ex+nx*b0,ey+ny*b0);g.closePath();g.fill();
 }
 // short direction chevrons, spaced along the road
 g.strokeStyle='rgba(55,110,148,.32)';g.lineWidth=4;
 for(let d=68;d<s.trackLength;d+=116){
  const p=sample(s,d),a=Math.atan2(p.ty,p.tx);
  g.save();g.translate(p.x,p.y);g.rotate(a);g.beginPath();
  g.moveTo(-12,-9);g.lineTo(8,0);g.lineTo(-12,9);g.stroke();g.restore();
 }
 // checkpoint gates (gate 0 is the chequered start/finish line)
 for(const cp of s.checkpoints){
  g.save();g.translate(cp.x,cp.y);g.rotate(Math.atan2(cp.ty,cp.tx));
  const half=cp.hw-7;
  if(cp.id===0){
   const cell=7,rows=Math.max(2,Math.floor(half*2/cell)),y0=-rows*cell/2;
   for(let r=0;r<rows;r++)for(let c=0;c<2;c++){
    g.fillStyle=((r+c)&1)?'#20475d':'#ffffff';g.fillRect(c*cell-cell,y0+r*cell,cell,cell);
   }
  }else{
   g.strokeStyle='#56bfe5';g.lineWidth=5;g.beginPath();g.moveTo(0,-half);g.lineTo(0,half);g.stroke();
   g.strokeStyle='rgba(255,255,255,.95)';g.lineWidth=2;
   g.beginPath();g.moveTo(3,-half+2);g.lineTo(3,half-2);g.stroke();
  }
  for(const e of [-1,1]){disc(g,0,e*half,6,'#1f8fbf');disc(g,0,e*half,3.4,cp.id===0?'#ffd75e':'#f4fcff');}
  g.restore();
 }
}
const worldCaches=new WeakMap(),snowFields=new WeakMap();
function worldLayer(s){
 if(worldCaches.has(s))return worldCaches.get(s);
 let layer=null;
 try{
  if(typeof document!=='undefined'){
   const c=document.createElement('canvas'),k=1.5;
   c.width=Math.round(960*k);c.height=Math.round(540*k);
   const cg=c.getContext('2d');
   if(cg){cg.scale(c.width/s.w,c.height/s.h);paintWorld(cg,s);layer=c;}
  }
 }catch(e){layer=null;}
 worldCaches.set(s,layer);return layer;
}
function snow(g,s,t){
 let field=snowFields.get(s);
 if(!field){
  const R=rng((s.seed^0x1b873593)|0),n=Math.round(s.w*s.h/14000);
  field=Array.from({length:n},()=>({x:R()*s.w,y:R()*s.h,r:1+R()*1.6,vy:9+R()*14,vx:(R()-.5)*8,ph:R()*TAU}));
  snowFields.set(s,field);
 }
 g.fillStyle='rgba(255,255,255,.7)';g.beginPath();
 for(const f of field){
  const x=(((f.x+f.vx*t+Math.sin(t*.7+f.ph)*10)%s.w)+s.w)%s.w,y=(((f.y+f.vy*t)%s.h)+s.h)%s.h;
  g.moveTo(x+f.r,y);g.arc(x,y,f.r,0,TAU);
 }
 g.fill();
}
function iceWorld(g,s,t){
 // The ice is always painted from the shared course geometry (never an external
 // backdrop), so the visible road cannot disagree with the physical one.
 const layer=worldLayer(s);
 if(layer)g.drawImage(layer,0,0,s.w,s.h);else paintWorld(g,s);
 snow(g,s,Number(t)||0);
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
 // Each course has its own world size (same 16:9 frame); the scale below fits it to
 // the host canvas, and every course keeps sled-to-road proportions on screen.
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
// Game-specific roster presentation stays with its pinned engine revision.
function renderRoster(root,active,round){

    active.sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id))).forEach(p=>{
      const box=document.createElement('div');box.className='leader-chip';
      const color=document.createElement('span');color.className='circle';color.style.background=p.color;
      const name=document.createElement('span');name.className='leader-name';name.textContent=p.name;
      const score=document.createElement('small');score.className='leader-role';score.textContent=(p.score||0)+' คะแนน';
      const info=document.createElement('span');info.className='leader-item-slot';
      info.textContent=p.ice?.state==='falling'?'ตกน้ำ':'CP '+((p.ice?.nextCheckpoint??1)+1)+'/'+(round?.iceRace?.checkpoints?.length||4);
      box.append(color,name,score,info);root.append(box);
    });return;
   
}
// Game-owned controller packet; Host forwards this without mode-specific branches.
function getControllerPacket(p,round){
 return {t:'ice-status',mode:round.mode,score:p.score||0,
  nextCheckpoint:p.ice?.nextCheckpoint??1,falling:p.ice?.state==='falling'};
}
window.IceRace=Object.freeze({getControllerPacket,renderRoster,getResult,resultTitle:"ผ่านเช็กพอยต์มากที่สุด!",countdownSeconds:3,setup,update,draw,hud,step,finish,checkpoint,
 nearest,sample,collide,hullContact,hullPoints,fall,respawn,makeTrack,botVector,sizeClassFor,tracks:TRACKS,config:C});
})();
