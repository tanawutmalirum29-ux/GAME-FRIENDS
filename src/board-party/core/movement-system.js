function beginMove(s,p,steps,kind='walk'){
 // Preserve the existing real position at the pad, even across turns.
 const position=I().position(s,p),origin=s.map.nodes[p.currentNodeId].position;
 if(kind==='walk'&&!p.worldPosition)p.worldPosition={...position};
 s.move={playerId:p.id,kind,remaining:steps,total:steps,from:p.currentNodeId,to:null,
   t:0,lateral:0,nodeOffset:{x:position.x-origin.x,y:position.y-origin.y},
   intent:null,intentTime:0,started:false,visited:[p.currentNodeId],completedSteps:0,auto:false,
   expires:kind==='rocket'?s.time+5:Infinity};
 s.camera.explore=kind==='walk'&&!p.isBot;
 if(kind==='walk'&&s.inputs[p.id]){
   s.inputs[p.id].x=0;s.inputs[p.id].y=0;s.inputs[p.id].at=-Infinity;
 }
 if(kind==='rocket'){
  s.move.remaining=Infinity;s.move.total=Infinity;
  phase(s,'rocket',5);return;
 }
 if(p.pendingTraverse){
  const pending=p.pendingTraverse;delete p.pendingTraverse;
  // Never resume a stored edge after a UFO swap or any other node teleport.
  // The stale edge can point backwards into an already-visited tile and strand
  // bot/human movement. Valid mid-edge rocket position remains resumable.
  if(pending.from===p.currentNodeId&&s.map.nodes[pending.from]?.nextNodes.includes(pending.to)){
   s.move.from=pending.from;s.move.to=pending.to;
   s.move.startPosition=pending.startPosition;s.move.endPosition=pending.endPosition;
   s.move.t=pending.t;s.move.lateral=pending.lateral||0;
   s.move.nodeOffset={x:0,y:0};movePhase(s,'moving');return;
  }
 }
 phase(s,'move_ready',15);nextStep(s);
}
function nextStep(s){
 const m=s.move,p=current(s);
 if(!m)return;
 if(p.currentNodeId===s.map.finishId){win(s,p);return;}
 if(m.remaining<=0||m.stop||s.time>=m.expires||(m.kind==='rocket'&&m.expires-s.time<.48)){land(s);return;}
 const options=s.map.nodes[p.currentNodeId].nextNodes;
 if(options.length>1){s.branch={options:[...options],selected:options[0]};movePhase(s,'branch',Math.min(8,m.expires-s.time));return;}
 if(m.kind==='walk'){movePhase(s,'move_ready');return;}
 step(s,options[0]);
}
// Each visible road/bridge and circular tile measures 88 world units across.
// Leave a small allowance for the avatar footprint while letting it reach the
// edges of BOTH the path and the tile instead of forcing its centre into 18u.
const WALK_SPEED=240,ROAD_HALF_WIDTH=44,AVATAR_EDGE_CLEARANCE=10;
const LANE_RADIUS=ROAD_HALF_WIDTH-AVATAR_EDGE_CLEARANCE;
const NODE_RADIUS=ROAD_HALF_WIDTH-AVATAR_EDGE_CLEARANCE;
const ROCKET_LANE_RADIUS=18,TURN_DELAY=.08;
 // The Y-junction starts to curve before its centre. Keep branch steering
 // reversible inside the visibly shared curved plaza, not only when the
 // sprite is within a skinny 18-unit strip of the ALTERNATE straight line.
const JUNCTION_SWITCH_RADIUS=130,JUNCTION_TURN_LANE=86;
const bound=(x,a,b)=>Math.max(a,Math.min(b,x));
function step(s,to){
 const m=s.move,p=current(s);
 if(!m||m.to||!s.map.nodes[p.currentNodeId].nextNodes.includes(to)||(s.map.id!==M().MAP_ID&&m.visited.includes(to)))return false;
 const pos=I().position(s,p),a=s.map.nodes[p.currentNodeId].position,b=s.map.nodes[to].position;
 m.from=p.currentNodeId;m.to=to;m.intent=null;m.intentTime=0;
 if(m.kind==='walk'){
  // Keep the exact world-space location; never retarget the sprite to a pad centre.
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;
  m.startPosition=a;m.endPosition=b;
  m.t=((pos.x-a.x)*dx+(pos.y-a.y)*dy)/(d*d);
  m.lateral=((pos.y-a.y)*dx-(pos.x-a.x)*dy)/d;
 }else{
  m.startPosition=pos;m.endPosition=I().positionOnNode(s,p,to);
  m.t=0;m.lateral=0;
 }
 m.nodeOffset={x:0,y:0};
 movePhase(s,'moving');return true;
}
function roamNode(s,p,dt){
 const m=s.move;if(!m)return;
 const a=axes(s,p.id),strength=Math.hypot(a.x,a.y);
 if(strength>.11){
  if(!m.started){m.started=true;s.camera.explore=false;}
  // Walk freely inside the plaza around each tile. An accidental touch does
  // not commit a branch: direction must be held for 160 milliseconds.
  const v=m.nodeOffset||{x:0,y:0};
  let x=v.x+a.x*WALK_SPEED*dt,y=v.y+a.y*WALK_SPEED*dt;
  const d=Math.hypot(x,y);
  if(d>NODE_RADIUS){x=x*NODE_RADIUS/d;y=y*NODE_RADIUS/d;}
  m.nodeOffset={x,y};
  const next=forwardInput(s,p);
  if(next){
   if(m.intent===next)m.intentTime+=dt;
   else{m.intent=next;m.intentTime=dt;}
   // Single-exit checkpoints should not force a new joystick hold.
   // Genuine forks still debounce so unintended taps do not choose a route.
   if(s.map.nodes[p.currentNodeId].nextNodes.length===1||m.intentTime>=TURN_DELAY){step(s,next);return;}
  }else{m.intent=null;m.intentTime=0;}
 }else{m.intent=null;m.intentTime=0;}
}
function walkEdge(s,p,dt){
 const m=s.move;
 const a=m.startPosition,b=m.endPosition;
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,nx=dx/d,ny=dy/d;
 const stick=axes(s,p.id),magnitude=Math.hypot(stick.x,stick.y);
 if(magnitude>.13){
  const options=s.map.nodes[m.from].nextNodes;
  // Until the walker clears the rounded shared fork, the stick can turn
  // toward EITHER exit. Compare directions from the ACTUAL player position:
  // projecting onto the other edge with the old 18px corridor locked out
  // an otherwise obvious turn (including n3 -> b3_1 in the screenshot).
  const at=I().position(s,p);
  const nearFork=Math.hypot(at.x-a.x,at.y-a.y)<=JUNCTION_SWITCH_RADIUS;
  if(options.length>1&&nearFork&&m.t<.94){
   const candidate=M().choose(s.map,m.from,stick.x,stick.y);
   if(candidate!==m.to){
    const end=s.map.nodes[candidate].position,now=m.endPosition;
    const toCandidate={x:end.x-at.x,y:end.y-at.y};
    const toCurrent={x:now.x-at.x,y:now.y-at.y};
    const cd=Math.hypot(toCandidate.x,toCandidate.y)||1;
    const nd=Math.hypot(toCurrent.x,toCurrent.y)||1;
    const candidateDot=(stick.x*toCandidate.x+stick.y*toCandidate.y)/(magnitude*cd);
    const currentDot=(stick.x*toCurrent.x+stick.y*toCurrent.y)/(magnitude*nd);
    const vx=end.x-a.x,vy=end.y-a.y,len=Math.hypot(vx,vy)||1;
    const projected=((at.x-a.x)*vx+(at.y-a.y)*vy)/(len*len);
    const lateral=(-(at.x-a.x)*vy+(at.y-a.y)*vx)/len;
    if(candidateDot>.25&&candidateDot>currentDot+.10&&
      projected>=-.07&&projected<.93&&Math.abs(lateral)<=JUNCTION_TURN_LANE){
     // Reproject the same world point; gradual lane easing below avoids
     // teleporting to the newly selected line or deducting a dice step.
     m.to=candidate;m.endPosition=end;m.t=projected;m.lateral=lateral;
     m.walking=false;m.intent=null;m.intentTime=0;
     return;
    }
   }
  }
 }
 const tangent=stick.x*nx+stick.y*ny;
 const sideways=-stick.x*ny+stick.y*nx;
 const beforeT=m.t,beforeL=m.lateral||0;
 if(magnitude>.1){
  // Full 2D input: forwards, sideways and backwards are all allowed. The
  // walkable lane bounds prevent shortcuts while the dice still count nodes.
  // Gentle forward assist for diagonal input; a released or sideways stick
  // must never move automatically. Reverse remains a real reverse.
  const along=tangent>.14*magnitude?Math.max(tangent,.45*magnitude):tangent;
  // A turn may reproject slightly before the next road's origin. Clamping
  // this offset to zero immediately teleports the character at junctions.
  m.t=bound(m.t+along*WALK_SPEED*dt/d,-NODE_RADIUS/d,1);
  // A newly selected fork can start outside the narrow straight corridor.
  // Reduce that offset at a physically reachable rate, never clamp 60px
  // sideways to 18px in one frame (the visible "character snap" bug).
  const lane=Math.max(LANE_RADIUS,Math.abs(beforeL)-WALK_SPEED*dt*.55);
  m.lateral=bound(beforeL+sideways*WALK_SPEED*dt,-lane,lane);
 }
 m.walking=Math.abs(m.t-beforeT)>1e-6||Math.abs(m.lateral-beforeL)>1e-6;
 if(m.t<=.001&&tangent<-.15){
  // Reverse to the fork and choose again without consuming a die step.
  const pos=I().position(s,p),base=I().positionOnNode(s,p,m.from);
  m.nodeOffset={x:0,y:0};
  if(Number.isFinite(pos.x)&&Number.isFinite(pos.y)){
   const vx=pos.x-base.x,vy=pos.y-base.y,len=Math.hypot(vx,vy)||1;
   m.nodeOffset={x:len>NODE_RADIUS?vx*NODE_RADIUS/len:vx,y:len>NODE_RADIUS?vy*NODE_RADIUS/len:vy};
  }
  m.to=null;m.lateral=0;m.intent=null;m.intentTime=0;
  const options=s.map.nodes[p.currentNodeId].nextNodes;
  if(options.length>1){s.branch={options:[...options],selected:options[0]};movePhase(s,'branch');}
  else movePhase(s,'move_ready');
  return;
 }
 // A resumed rocket can reach the exact world endpoint with t=0.9999999999999999.
 // Resolve floating-point residue before the bot observes a zero-length aim.
 if(m.t>=1-1e-9){
  m.t=1;
  const worldPos=I().position(s,p);
  p.currentNodeId=m.to;m.visited.push(m.to);m.to=null;m.remaining--;
  p.worldPosition={...worldPos};
  const node=s.map.nodes[p.currentNodeId].position;
  m.nodeOffset={x:worldPos.x-node.x,y:worldPos.y-node.y};
  if(s.map.nodes[p.currentNodeId].type==='milestone')s.milestone={at:s.time,position:s.map.nodes[p.currentNodeId].position};
  nextStep(s);
  // Continue across a forced one-way checkpoint during the SAME simulation
  // update if the stick is still aligned. Dice count only actual edges.
  if(s.move===m&&m.kind==='walk'&&!m.to&&m.remaining>0&&!m.stop&&
     s.map.nodes[p.currentNodeId].nextNodes.length===1){
   const next=forwardInput(s,p);
   if(next)step(s,next);
  }
 }
}
// 5-second forward-only free steering. Completed edges advance the graph;
// mid-edge expiration stores a precise position and never awards the next node.
function updateRocket(s,dt){
 const m=s.move,p=current(s);if(!m||m.kind!=='rocket')return;
 const axesNow=axes(s,p.id),strength=Math.hypot(axesNow.x,axesNow.y);
 if(s.time>=m.expires){
  const point=I().position(s,p);p.worldPosition={...point};
  if(m.to&&m.t<.999){
   p.pendingTraverse={from:m.from,to:m.to,t:m.t,lateral:m.lateral||0,
    startPosition:{...m.startPosition},endPosition:{...m.endPosition}};
   land(s,false);return;
  }
  land(s,m.completedSteps>0);return;
 }
 if(strength<=.12)return;
 const stick={x:axesNow.x/strength,y:axesNow.y/strength};
 if(!m.to){
  const opts=s.map.nodes[p.currentNodeId].nextNodes;
  if(!opts.length){win(s,p);return;}
  const to=M().choose(s.map,p.currentNodeId,stick.x,stick.y);
  const a=s.map.nodes[p.currentNodeId].position,b=s.map.nodes[to].position;
  const len=Math.hypot(b.x-a.x,b.y-a.y)||1;
  if((stick.x*(b.x-a.x)+stick.y*(b.y-a.y))/len<.23)return;
  m.from=p.currentNodeId;m.to=to;
  m.startPosition=I().position(s,p);m.endPosition={...b};
  m.t=0;m.lateral=0;
 }
 const a=m.startPosition,b=m.endPosition,dx=b.x-a.x,dy=b.y-a.y;
 const len=Math.hypot(dx,dy)||1,nx=dx/len,ny=dy/len;
 const forward=Math.max(0,stick.x*nx+stick.y*ny),side=-stick.x*ny+stick.y*nx;
 m.t=Math.min(1,m.t+forward*510*dt/len);
 m.lateral=bound((m.lateral||0)+side*510*dt,-ROCKET_LANE_RADIUS,ROCKET_LANE_RADIUS);
 m.walking=forward>.05||Math.abs(side)>.05;
 if(m.t>=1){
  p.worldPosition=I().position(s,p);
  p.currentNodeId=m.to;m.visited.push(m.to);m.completedSteps++;
  m.from=p.currentNodeId;m.to=null;m.lateral=0;
  if(p.currentNodeId===s.map.finishId)win(s,p);
 }
}
