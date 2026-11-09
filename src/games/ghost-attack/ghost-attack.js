/* GHOST ATTACK — original asymmetric survival mini-game.
   The host is authoritative: controllers send movement/buttons, not positions.
   Coordinates are in a player-count-scaled 16:9 world. No match timer. */
(() => {
'use strict';
const TAU=Math.PI*2;
const ITEMS=['cloak','boost','stun','trap','slow'];
const ITEM_NAMES={cloak:'ผ้าคลุมล่องหน',boost:'บูสต์สปีด',stun:'สตั้นผี',trap:'กับดัก',slow:'ยาสโลว์เพื่อน'};

const ITEM_SVG={
 cloak:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#8be9fd" d="M16 18c8-8 24-8 32 0v30c-5-3-10-5-16-5s-11 2-16 5V18z"/><path fill="#d9fbff" d="M23 19c4-3 14-3 18 0v6H23z"/></svg>`,
 boost:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#ffd54f" d="M36 4 14 35h14l-4 25 26-35H35z"/></svg>`,
 stun:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="14" fill="#ffb74d"/><path fill="#fff3c4" d="m32 7 5 10 11 1-8 8 2 11-10-5-10 5 2-11-8-8 11-1z"/></svg>`,
 trap:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#cfd8dc" d="M10 34c0-8 10-14 22-14s22 6 22 14-10 18-22 18S10 42 10 34z"/><path fill="#ef5350" d="M16 37h32l-4 7H20z"/><path fill="#455a64" d="M18 28h4v7h-4zm8 0h4v7h-4zm8 0h4v7h-4zm8 0h4v7h-4z"/></svg>`,
 slow:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#b39ddb" d="M24 8h16v6l8 11c5 7 0 23-16 23S11 32 16 25l8-11z"/><circle cx="32" cy="33" r="7" fill="#ede7f6"/></svg>`
};
const ITEM_ICON_IMAGES=Object.create(null);
function getItemIconImage(item){
 if(!ITEM_SVG[item]||typeof Image==='undefined')return null;
 if(!ITEM_ICON_IMAGES[item]){
  const img=new Image();
  img.decoding='async';
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(ITEM_SVG[item]);
  ITEM_ICON_IMAGES[item]=img;
 }
 return ITEM_ICON_IMAGES[item];
}
function preloadItemIcons(){for(const key of ITEMS)getItemIconImage(key);}

const Combat=window.PartyCombatMotion;
if(!Combat)throw new Error('combat-motion.js must load before ghost-attack.js');
const Art=window.GhostCemeteryArt;
if(!Art)throw new Error('graveyard-art.js must load before ghost-attack.js');
// Keep the last theme between rounds without changing game selection artwork.
let previousGhostTheme='';
// Modest speed edge; interceptions, not teleporting, make ghosts competitive.
const C={humanSpeed:172,ghostSpeed:186,ghostTurn:6.1,hitRadius:19,punchRange:67,
  punchStun:Combat.NORMAL_STUN,punchCooldown:Combat.ATTACK.cooldown,ghostStun:1.45,
  trapRoot:1.1,slowTime:2.5,boostTime:2.6,cloakTime:2};
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const nrm=(x,y)=>{const l=Math.hypot(x,y)||1;return {x:x/l,y:y/l};};
function safeCircle(rect,x,y,r){
  const cx=clamp(x,rect.x,rect.x+rect.w),cy=clamp(y,rect.y,rect.y+rect.h);
  return Math.hypot(x-cx,y-cy)>=r;
}
function freeSpot(world,obstacles,others,margin=22,minDistance=52){
  for(let i=0;i<200;i++){
    const q={x:rand(margin,world.w-margin),y:rand(margin,world.h-margin)};
    if(obstacles.every(o=>safeCircle(o,q.x,q.y,margin))&&
       others.every(o=>dist(q,o)>minDistance))return q;
  }
  // A deterministic search still finds separated, walkable ground when an
  // unlucky RNG repeatedly samples walls. Never fall back into a forest corner.
  let best=null,clearance=-1;
  for(let y=margin;y<=world.h-margin;y+=24)for(let x=margin;x<=world.w-margin;x+=24){
    if(!obstacles.every(o=>safeCircle(o,x,y,margin)))continue;
    const q={x,y},space=Math.min(...others.map(o=>dist(q,o)),world.w);
    if(space>clearance){best=q;clearance=space;}
  }
  if(!best)throw new Error('GHOST ATTACK layout has no clear spawn');
  return best;
}
// Four authored courtyards. Coordinates are WORLD pixels, shared by the art,
// hitboxes, spawn clearance, inspector and bot navigation. No seeded scatter.
// Compact and large are independently arranged; large is not a stretched image.
// The v4 map ID deliberately replaces the old v1/v3 monument layouts.
const COURTYARDS={
 graveyard:[{
  arena:{x:164,y:36,w:752,h:536},spawn:{x:520,y:265},
  props:[
   [370,185,74,142,'coffin'],[552,276,72,142,'coffin'],
   [788,394,64,118,'coffin'],[233,190,56,66,'headstone'],
   [321,421,64,59,'broken'],[461,446,56,42,'slab'],
   [710,442,52,46,'headstone'],[803,230,54,70,'obelisk'],
   [710,132,66,54,'grave'],[482,103,63,42,'plaque'],
   [620,117,52,58,'cross'],[246,338,88,18,'iron-fence'],
   [690,326,90,18,'iron-fence']
  ]
 },{
  arena:{x:112,y:36,w:1056,h:648},spawn:{x:640,y:335},
  props:[
   [390,174,76,146,'coffin'],[685,281,78,150,'coffin'],
   [925,469,70,134,'coffin'],[329,468,72,130,'coffin'],
   [199,169,62,73,'headstone'],[503,457,64,49,'grave'],
   [584,119,65,54,'broken'],[964,180,60,82,'obelisk'],
   [830,116,55,64,'cross'],[805,534,62,46,'plaque'],
   [1046,352,56,65,'headstone'],[588,578,65,47,'grave'],
   [208,362,124,20,'iron-fence'],[506,357,103,20,'iron-fence'],
   [830,377,102,20,'iron-fence'],[966,96,108,22,'cemetery-wall'],
   [1080,480,20,100,'iron-fence']
  ]
 }],
 egypt:[{
  arena:{x:164,y:36,w:752,h:536},spawn:{x:540,y:300},
  props:[
   [437,218,72,155,'sarcophagus'],[579,218,72,155,'sarcophagus'],
   [250,140,140,24,'sandstone-wall'],[366,164,24,74,'sandstone-wall'],
   [690,140,140,24,'sandstone-wall'],[690,164,24,74,'sandstone-wall'],
   [250,440,140,24,'sandstone-wall'],[366,366,24,74,'sandstone-wall'],
   [690,440,140,24,'sandstone-wall'],[690,366,24,74,'sandstone-wall'],
   [244,288,46,50,'sandstone-pillar'],[790,288,46,50,'sandstone-pillar'],
   [479,119,120,22,'temple-fence'],[479,471,120,22,'temple-fence']
  ]
 },{
  arena:{x:112,y:36,w:1056,h:648},spawn:{x:640,y:354},
  props:[
   [510,273,78,163,'sarcophagus'],[692,273,78,163,'sarcophagus'],
   [244,160,164,26,'sandstone-wall'],[382,186,26,94,'sandstone-wall'],
   [872,160,164,26,'sandstone-wall'],[872,186,26,94,'sandstone-wall'],
   [244,534,164,26,'sandstone-wall'],[382,440,26,94,'sandstone-wall'],
   [872,534,164,26,'sandstone-wall'],[872,440,26,94,'sandstone-wall'],
   [225,336,56,60,'sandstone-pillar'],[1000,336,56,60,'sandstone-pillar'],
   [534,141,84,24,'temple-fence'],[678,141,84,24,'temple-fence'],
   [534,555,84,24,'temple-fence'],[678,555,84,24,'temple-fence']
  ]
 }]
};
function makeCourtyard(world,tier,theme){
 const layout=COURTYARDS[theme][tier-1],arena={...layout.arena};
 const prefix=theme==='egypt'?'EG':'GY';
 const obstacles=layout.props.map(([x,y,w,h,kind],i)=>({
  id:prefix+'-'+String(i+1).padStart(2,'0'),x,y,w,h,kind,
  variant:i%3,fixed:true,
  ...(kind==='coffin'?{artType:'single-large-coffin'}:{})
 }));
 // The scenery outside the fence is a physical boundary for humans AND
 // ghosts. Interior monuments still allow ghosts to phase, as before.
 const {x,y,w,h}=arena;
 for(const [side,bx,by,bw,bh] of [
  ['N',0,0,world.w,y],['S',0,y+h,world.w,world.h-y-h],
  ['W',0,y,x,h],['E',x+w,y,world.w-x-w,h]
 ])obstacles.push({id:prefix+'-R'+side,x:bx,y:by,w:bw,h:bh,
  kind:theme==='egypt'?'sandstone-wall':'cemetery-wall',boundary:true,fixed:true});
 return {arena,spawn:{...layout.spawn},obstacles,
  mapId:'GH-'+prefix+'-'+world.w+'x'+world.h+'-T'+tier+'-v4'};
}
function resetPlayer(p,pos){
  p.x=pos.x;p.y=pos.y;p.vx=0;p.vy=0;p.face=1;
  p.active=true;p.alive=true;p.ghost=false;p.score=0;
  p.item=null;p.selecting=false;p.targetId=null;
  p.pickupNotice=null;p.pickupNoticeItem=null;p.pickupNoticeTime=0;
  p.stun=0;p.slow=0;p.cloak=0;p.boost=0;p.punchCooldown=0;
  p.punchFX=0;p.altLatch=false;p.actionLatch=false;
  Combat.reset(p);
  p.input={left:false,right:false,jump:false,down:false,action:false,alt:false,axisX:0,axisY:0};
  p.dir={x:1,y:0};p.survival=0;p.infectedAt=null;
  p.botMind=p.isBot?{nextPlan:0,planKey:'',path:[],goal:null,
    lastX:null,lastY:null,stuckFor:0,unstickUntil:0,unstickGoal:null,
    lastEscapeGoal:null,roamGoal:null}:null;
}
function setup(round,players){
  // Random on the first round, then exclude the previous theme when there
  // are alternatives; the artwork is selected INSIDE the match only.
  const theme=Art.pickTheme(previousGhostTheme);
  previousGhostTheme=theme;
  preloadItemIcons();
  // Exactly two arena sizes, shared by the graveyard and Egypt themes:
  // 1–6 players use 1080x608; 7–12 players use 1280x720.
  // Host output stays 960x540 and scales to the selected world.
  const tier=players.length<=6?1:2;
  const world=tier===1?{w:1080,h:608}:{w:1280,h:720};
  round.rules={...(round.rules||{}),viewMode:round.rules?.viewMode||'topdown'};
  // No invisible HUD collider: the headcount/clock lives at the top centre.
  const layout=makeCourtyard(world,tier,theme);
  const obstacles=layout.obstacles;
  Art.preload(players,theme,obstacles);
  const center=layout.spawn;
  const used=[center];
  for(const p of players){
    // Humans spawn at random, dispersed locations away from the AI ghost plaza.
    const spacing=tier===2?110:Math.max(80,world.w/13);
    let pos=freeSpot(world,obstacles,used,30,spacing);
    for(let tries=0;tries<35&&dist(pos,center)<Math.min(world.w,world.h)*.32;tries++)
      pos=freeSpot(world,obstacles,used,30,spacing);
    resetPlayer(p,pos);used.push(pos);
  }
  // Always one starting ghost. Additional ghost hunters are converted
  // players, not extra NPCs seeded into large rooms.
  const npcs=[{id:'ai-ghost-0',x:center.x,y:center.y,
    dir:{x:1,y:0},targetId:null,lockUntil:0,stun:0}];
  round.ghost={world,obstacles,theme,tier,arena:layout.arena,
    spawn:layout.spawn,mapId:layout.mapId,showObstacleIds:false,selectedObstacleId:null,
    npcs,boxes:[],traps:[],time:0,
    boxClock:4.5,maxBoxes:tier===1?2:3,
    winnerId:null,converted:[],lastHumanId:null,ghostSpawned:false};
  round.phase='countdown';round.countdown=3;
}
function walk(entity,vx,vy,dt,world,obstacles,ignoreObstacles=false){
  const radius=15;
  // Ghosts phase through interior props, but stay inside the courtyard and HUD.
  const clear=(xx,yy)=>obstacles.every(o=>
    (ignoreObstacles&&!o.boundary&&o.kind!=='hud-blocker')||safeCircle(o,xx,yy,radius));
  // A speed boost or delayed frame must not hop across a thin fence. Substeps
  // retain axis sliding at corners while keeping every displacement < radius.
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(vx*dt),Math.abs(vy*dt))/12));
  for(let i=0;i<steps;i++){
    const x=clamp(entity.x+vx*dt/steps,radius+6,world.w-radius-6);
    const y=clamp(entity.y+vy*dt/steps,radius+6,world.h-radius-6);
    if(clear(x,entity.y))entity.x=x;
    if(clear(entity.x,y))entity.y=y;
  }
}
function turnTowards(current,wanted,seconds,turnSpeed){
  const len=Math.hypot(wanted.x,wanted.y);
  if(len<.01)return current;
  const from=Math.atan2(current.y,current.x),to=Math.atan2(wanted.y,wanted.x);
  const d=Math.atan2(Math.sin(to-from),Math.cos(to-from));
  const a=from+clamp(d,-turnSpeed*seconds,turnSpeed*seconds);
  return {x:Math.cos(a),y:Math.sin(a)};
}
function survivors(players){return players.filter(p=>p.active&&!p.ghost);}
function nearestTarget(npc,players,state,preferLock=true){
  const available=players.filter(p=>p.active&&!p.ghost&&p.cloak<=0);
  if(!available.length){npc.targetId=null;return null;}
  const sorted=[...available].sort((a,b)=>dist(npc,a)-dist(npc,b));
  const nearest=sorted[0];
  const old=available.find(p=>p.id===npc.targetId);
  // Target persistence, interrupted ONLY by a dramatically closer person.
  // Lock removes robotic rapid switching and keeps most chases predictable.
  if(preferLock&&old&&dist(npc,old)<=state.world.w*.52){
    if(state.time<npc.lockUntil&&dist(npc,nearest)>=dist(npc,old)*.55)return old;
    if(dist(npc,nearest)>=dist(npc,old)*.77)return old;
  }
  let next=nearest;
  // Rarely choose a nearby runner, never somebody far across the map.
  if(sorted.length>1&&Math.random()<.12&&
     dist(npc,sorted[1])<=dist(npc,nearest)*1.27)next=sorted[1];
  npc.targetId=next.id;
  npc.lockUntil=state.time+rand(1.2,1.85);
  return next;
}
function convert(p,state){
  if(!p.active||p.ghost||p.cloak>0)return;
  p.ghost=true;p.item=null;p.selecting=false;p.targetId=null;
  // Cancel windups so a newly infected player can never land a ghost punch.
  p.attackRemaining=0;p.attackHit=false;p.punchFX=0;
  p.pickupNotice=null;p.pickupNoticeItem=null;p.pickupNoticeTime=0;
  p.cloak=0;p.boost=0;p.slow=0;p.stun=.17;
  p.infectedAt=state.time;p.score=Math.floor(p.survival*10);
  state.converted.push(p.id);
}

function visiblePrey(players){
  return players.filter(p=>p.active&&!p.ghost&&p.cloak<=0);
}
function courtyardGoal(state,x,y){
  const b=state.arena||{x:0,y:0,w:state.world.w,h:state.world.h};
  return {x:clamp(x,b.x+24,b.x+b.w-24),y:clamp(y,b.y+24,b.y+b.h-24)};
}
function ghostForecast(hunter,prey,state,lead=1){
  // Observe current movement for a short lead; never read future controls.
  const time=clamp(dist(hunter,prey)/(C.ghostSpeed*2.15),.13,.85)*lead;
  return courtyardGoal(state,prey.x+(prey.vx||0)*time,prey.y+(prey.vy||0)*time);
}
function ghostInterceptGoal(hunter,prey,role,group,state){
  const predicted=ghostForecast(hunter,prey,state,role==='chase'?1:1.23);
  if(role==='chase'||dist(hunter,prey)<79)return predicted;
  const center={x:group.reduce((n,h)=>n+h.x,0)/group.length,
    y:group.reduce((n,h)=>n+h.y,0)/group.length};
  const moving=Math.hypot(prey.vx||0,prey.vy||0)>45;
  const escape=moving?nrm(prey.vx,prey.vy):
    nrm(prey.x-center.x,prey.y-center.y);
  const lead=clamp(55+dist(hunter,prey)*.24,68,168);
  let x=predicted.x,y=predicted.y;
  if(role==='intercept'){
    x+=escape.x*lead;y+=escape.y*lead;
  }else{
    const side=role==='flank-left'?-1:1;
    x+=escape.x*lead*.42-escape.y*side*lead*.79;
    y+=escape.y*lead*.42+escape.x*side*lead*.79;
  }
  return courtyardGoal(state,x,y);
}
function ghostLineHitsRect(a,b,rect){
  let enter=0,leave=1;
  for(const axis of ['x','y']){
    const d=b[axis]-a[axis];
    const lo=rect[axis],hi=rect[axis]+(axis==='x'?rect.w:rect.h);
    if(Math.abs(d)<1e-7){if(a[axis]<lo||a[axis]>hi)return false;continue;}
    let t0=(lo-a[axis])/d,t1=(hi-a[axis])/d;
    if(t0>t1){const tmp=t0;t0=t1;t1=tmp;}
    enter=Math.max(enter,t0);leave=Math.min(leave,t1);
    if(enter>leave)return false;
  }
  return true;
}
function ghostSteeringPoint(hunter,goal,state){
  const block=state.hudBlocker;
  if(!block)return goal;
  // Spirits phase through graves but not the solid upper-left HUD monument.
  const pad=23,rect={x:block.x-pad,y:block.y-pad,
    w:block.w+2*pad,h:block.h+2*pad};
  if(!ghostLineHitsRect(hunter,goal,rect))return goal;
  // When a hunter is already inside the safety margin (but outside the
  // physical HUD), route it to the free southeast corner first. Otherwise
  // every segment starts inside the inflated rectangle and looks blocked.
  if(hunter.x>=rect.x&&hunter.x<=rect.x+rect.w&&
     hunter.y>=rect.y&&hunter.y<=rect.y+rect.h){
    return {x:Math.min(state.world.w-22,rect.x+rect.w+12),
      y:Math.min(state.world.h-22,rect.y+rect.h+12)};
  }
  const options=[
    {x:rect.x-7,y:rect.y-7},{x:rect.x+rect.w+7,y:rect.y-7},
    {x:rect.x-7,y:rect.y+rect.h+7},
    {x:rect.x+rect.w+7,y:rect.y+rect.h+7}
  ].filter(p=>p.x>=22&&p.y>=22&&
    p.x<=state.world.w-22&&p.y<=state.world.h-22)
    .filter(p=>!ghostLineHitsRect(hunter,p,rect)&&
      !ghostLineHitsRect(p,goal,rect));
  if(!options.length)return goal;
  options.sort((a,b)=>dist(hunter,a)+dist(a,goal)-
    dist(hunter,b)-dist(b,goal));
  return options[0];
}
function updateGhostHuntPlans(players,state){
  const prey=visiblePrey(players);
  // Remote player ghosts are not AI-controlled and must stay under the pad.
  const bots=players.filter(p=>p.active&&p.isBot&&p.ghost&&p.stun<=0);
  const npcs=state.npcs.filter(g=>g.stun<=0);
  const hunters=[...npcs,...bots];
  if(!hunters.length)return;
  if(!prey.length){
    for(const h of hunters){
      h.huntGoal=null;h.huntRole=null;h.huntTargetId=null;
    }
    return;
  }
  // Re-evaluate nearby threats each frame, but only move tactical goalposts
  // every ~0.4 seconds unless the best target changes dramatically.
  const primary=npcs.length?nearestTarget(npcs[0],players,state):
    botNearest(hunters[0],prey).target;
  if(!primary)return;
  const current=hunters.every(h=>h.huntGoal&&
    prey.some(p=>p.id===h.huntTargetId));
  const changed=state.huntPrimaryId!==primary.id;
  if(!changed&&current&&state.time<(state.nextHuntPlan||0))return;
  state.huntPrimaryId=primary.id;
  state.nextHuntPlan=state.time+(hunters.length>1?.42:.31);
  // Two or three hunters surround the same prey. Four or more split into
  // pairs when two surviving humans are far apart.
  const secondary=hunters.length>=4?
    prey.filter(p=>p!==primary&&dist(p,primary)>190)
      .sort((a,b)=>dist(a,hunters[hunters.length-1])-
        dist(b,hunters[hunters.length-1]))[0]:null;
  const roleRank={'chase':0,'intercept':1,'flank-left':2,'flank-right':3};
  const sorted=[...hunters].sort((a,b)=>{
    // Keep the same chase/intercept/flank jobs across planning ticks.
    // Switching roles every half second makes bots twitch and bunch up.
    if(a.huntTargetId===primary.id&&b.huntTargetId===primary.id&&
       a.huntRole&&b.huntRole)
      return roleRank[a.huntRole]-roleRank[b.huntRole];
    return dist(a,primary)-dist(b,primary);
  });
  const cut=secondary?Math.ceil(sorted.length/2):sorted.length;
  if(secondary&&npcs.length){
    // The initial NPC's locked target is the primary group; otherwise the
    // pack planner could alternate targets every frame after a split.
    const npcIndex=sorted.indexOf(npcs[0]);
    if(npcIndex>=cut){
      sorted.splice(npcIndex,1);
      sorted.splice(cut-1,0,npcs[0]);
    }
  }
  for(let i=0;i<sorted.length;i++){
    const h=sorted[i];
    const target=secondary&&i>=cut?secondary:primary;
    const group=secondary?
      (i>=cut?sorted.slice(cut):sorted.slice(0,cut)):sorted;
    const slot=group.indexOf(h);
    const role=['chase','intercept','flank-left','flank-right'][slot%4];
    h.huntRole=role;
    h.huntTargetId=target.id;
    h.huntGoal=ghostInterceptGoal(h,target,role,group,state);
    h.targetId=target.id;
  }
}
function advanceNpcs(dt,players,state){
  for(const npc of state.npcs){
    npc.stun=Math.max(0,npc.stun-dt);
    if(npc.stun>0)continue;
    // Check current contact BEFORE steering: a ghost may initially face away
    // from a nearby player, but that must not undo an existing body touch.
    for(const p of players)if(p.active&&!p.ghost&&p.cloak<=0&&
      dist(npc,p)<=PLAYER_BODY_RADIUS*2+1)convert(p,state);
    const target=visiblePrey(players).find(p=>p.id===npc.huntTargetId);
    if(!target)continue;
    const goal=npc.huntGoal||ghostForecast(npc,target,state);
    const point=ghostSteeringPoint(npc,goal,state);
    const desired=nrm(point.x-npc.x,point.y-npc.y);
    npc.dir=turnTowards(npc.dir,desired,dt,C.ghostTurn);
    walk(npc,npc.dir.x*C.ghostSpeed,npc.dir.y*C.ghostSpeed,
      dt,state.world,state.obstacles,true);
    for(const p of players){
      if(p.active&&!p.ghost&&p.cloak<=0&&dist(npc,p)<=PLAYER_BODY_RADIUS*2+1)
        convert(p,state);
    }
  }
}
function useItem(p,state,players){
  if(!p.item||p.ghost)return;
  const item=p.item;
  if(item==='slow'){
    const choices=players.filter(x=>x.active&&!x.ghost&&x.id!==p.id);
    if(!p.selecting){
      if(!choices.length)return;
      p.selecting=true;
      p.targetId=choices[0].id;
      return;
    }
    const target=choices.find(x=>x.id===p.targetId);
    if(!target)return;
    target.slow=Math.max(target.slow,C.slowTime);
    p.selecting=false;p.targetId=null;p.item=null;
    return;
  }
  p.item=null;p.selecting=false;p.targetId=null;
  if(item==='cloak')p.cloak=C.cloakTime;
  if(item==='boost')p.boost=C.boostTime;
  if(item==='stun'){
    for(const npc of state.npcs)if(dist(npc,p)<=90)
      Combat.applyStun(npc,C.ghostStun,p.color);
    for(const other of players)
      if(other.active&&other.ghost&&dist(other,p)<=90)
        Combat.applyStun(other,C.ghostStun,p.color);
  }
  if(item==='trap'){
    state.traps.push({x:p.x,y:p.y,r:16,ttl:11,armed:.42,ownerGrace:1.1,owner:p.id,color:p.color});
  }
}
function cycleTarget(state,players,p,direction){
  if(!state||!p||!p.active||!p.selecting||p.item!=='slow'||p.ghost)return false;
  const choices=players.filter(x=>x.active&&!x.ghost&&x.id!==p.id);
  if(!choices.length){p.targetId=null;return false;}
  const idx=choices.findIndex(q=>q.id===p.targetId);
  const delta=direction<0?-1:1;
  p.targetId=choices[(idx+delta+choices.length)%choices.length].id;
  return true;
}
// Ghosts infect by touch ONLY. A is for human-vs-human defensive punches,
// and hits must be in the forward strike arc instead of any nearby bystander.
function punch(p,players,state){
  if(!p||!p.active||p.ghost||p.stun>0)return false;
  // Humans may defend themselves against other HUMAN players only.
  // Ignore input A when the only thing in front is a ghost. This avoids
  // the old strike VFX looking like it punches a converted player / NPC.
  const facing=p.dir||{x:1,y:0};
  const forward=o=>{
    const dx=o.x-p.x,dy=o.y-p.y,d=Math.hypot(dx,dy);
    return d>0&&d<C.punchRange&&(dx*facing.x+dy*facing.y)/d>.35?d:Infinity;
  };
  const humans=players.filter(o=>o!==p&&o.active&&!o.ghost);
  const targetDistance=Math.min(Infinity,...humans.map(forward));
  if(!Number.isFinite(targetDistance))return false;
  const ghosts=[...players.filter(o=>o.active&&o.ghost),...state.npcs];
  // A ghost closer in the same strike arc blocks the swing visually.
  if(ghosts.some(g=>forward(g)<=targetDistance))return false;
  return Combat.startAttack(p);
}
function strikeImpact(p,players){
 if(!p.active||p.ghost||p.stun>0)return false;
 // Normal punching belongs to the shared character, not Ghost Attack.
 // Preserve Ghost Attack's human-only and nearest-target rule.
 return window.PartyCharacters.punchFriends(p,players,{
   range:C.punchRange,coneCos:.35,maxHits:1,
   canHit:other=>!other.ghost
 }).length>0;
}
function tickPlayers(dt,players,state){
  for(const p of players){
    if(!p.active)continue;
    p.survival+=p.ghost?0:dt;
    for(const key of ['stun','slow','cloak','boost','punchCooldown','punchFX','pickupNoticeTime'])
      p[key]=Math.max(0,(p[key]||0)-dt);
    const input=p.input||{};
    // Attacks have one shared windup / impact / recovery window.
    const attackWasActive=Combat.isAttacking(p);
    if(attackWasActive)Combat.stepAttack(p,dt,()=>strikeImpact(p,players));
    if(!p.ghost&&input.action&&!p.actionLatch)punch(p,players,state);
    if(input.alt&&!p.altLatch)useItem(p,state,players);
    p.actionLatch=!!input.action;p.altLatch=!!input.alt;
    if(p.stun>0||attackWasActive||Combat.isAttacking(p)){
      p.vx=0;p.vy=0;continue;
    }
    const rawX=clamp((Number(input.axisX)||0)+
      (input.right?1:0)-(input.left?1:0),-1,1);
    const rawY=clamp((Number(input.axisY)||0)+
      (input.down?1:0)-(input.jump?1:0),-1,1);
    const length=Math.hypot(rawX,rawY);
    if(length<.08){p.vx=0;p.vy=0;continue;}
    const strength=Math.min(1,length);
    const desired=nrm(rawX,rawY);
    // Converted ghosts have slightly wider turns than humans, but not sluggish.
    p.dir=p.ghost?turnTowards(p.dir,desired,dt,C.ghostTurn):desired;
    const speed=(p.ghost?C.ghostSpeed:C.humanSpeed)*
      (p.slow>0?.58:1)*(p.boost>0?1.5:1);
    p.vx=p.dir.x*speed*strength;p.vy=p.dir.y*speed*strength;
    walk(p,p.vx,p.vy,dt,state.world,state.obstacles,p.ghost);
  }
}
// Resolve physical crowding after item pickup and ghost-touch checks.
// Joystick pressure determines who yields; equal opposing pressure holds position.
const PLAYER_BODY_RADIUS=16;
function pushPressure(p,nx,ny){
  if(p.stun>0)return .12;
  const approach=(p.vx||0)*nx+(p.vy||0)*ny;
  return .22+Math.max(0,approach)/C.humanSpeed;
}
function resolvePlayerCollisions(players,state){
 return window.PartyCharacters.resolve(players,{
   radius:PLAYER_BODY_RADIUS,iterations:4,speedReference:C.humanSpeed,
   force:pushPressure,
   constrain:(p,x,y)=>{
     const radius=15,edge=radius+6;
     const nextX=clamp(x,edge,state.world.w-edge),nextY=clamp(y,edge,state.world.h-edge);
     const clear=(xx,yy)=>state.obstacles.every(o=>
       (p.ghost&&!o.boundary&&o.kind!=='hud-blocker')||safeCircle(o,xx,yy,radius));
     if(clear(nextX,nextY))return {x:nextX,y:nextY};
     if(clear(nextX,p.y))return {x:nextX,y:p.y};
     if(clear(p.x,nextY))return {x:p.x,y:nextY};
     return {x:p.x,y:p.y};
   }
 });
}
function updateTraps(dt,players,state){
  state.traps=state.traps.filter(t=>{
    t.ttl-=dt;t.armed=Math.max(0,(t.armed||0)-dt);
    t.ownerGrace=Math.max(0,(t.ownerGrace||0)-dt);
    if(t.ttl<=0)return false;
    if(t.armed>0)return true;
    for(const p of players){
      if(!p.active||p.ghost||(p.id===t.owner&&t.ownerGrace>0))continue;
      if(dist(t,p)<25){Combat.applyStun(p,C.trapRoot,t.color);return false;}
    }
    return true;
  });
}
function newBox(players,state){
  const existing=[...players.filter(p=>p.active),...state.boxes];
  const q=freeSpot(state.world,state.obstacles,existing,25,80);
  return {x:q.x,y:q.y,ttl:17,item:ITEMS[Math.floor(Math.random()*ITEMS.length)]};
}
function updateBoxes(dt,players,state){
  for(let i=state.boxes.length-1;i>=0;i--){
    const b=state.boxes[i];b.ttl-=dt;
    if(b.ttl<=0){state.boxes.splice(i,1);continue;}
    for(const p of players){
      if(!p.active||p.ghost||p.item||dist(b,p)>27)continue;
      p.item=b.item;
      // Independent of the inventory slot: announce what this player JUST
      // collected above their character, for a brief, readable interval.
      p.pickupNoticeItem=b.item;
      p.pickupNotice=ITEM_NAMES[b.item]||'ไอเทม';
      p.pickupNoticeTime=2.1;
      state.boxes.splice(i,1);
      break;
    }
  }
  state.boxClock-=dt;
  if(state.boxClock<=0){
    if(state.boxes.length<state.maxBoxes)
      state.boxes.push(newBox(players,state));
    state.boxClock=rand(6.5,11);
  }
}
// Local bots use exactly the same authoritative movement/punch/item system
// as controllers. No remote model, network call or scripted teleportation.
function botNearest(p,list){
  let best=null,range=Infinity;
  for(const q of list){
    const d=dist(p,q);
    if(d<range){best=q;range=d;}
  }
  return {target:best,distance:range};
}
/* Grid routing is recalculated only on a new committed plan, never per
 * frame. A* resolves walls/corners; escape goals come from reachable cells.
 * This avoids the left-right/up-down oscillation from greedy angle sampling. */
const BOT_CELL=32;
const BOT_DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function botNavGrid(state){
  if(state.botGrid)return state.botGrid;
  const cols=Math.ceil(state.world.w/BOT_CELL);
  const rows=Math.ceil(state.world.h/BOT_CELL);
  const clear=new Uint8Array(cols*rows);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const px=(x+.5)*BOT_CELL,py=(y+.5)*BOT_CELL;
    const boundary=Math.min(px,py,state.world.w-px,state.world.h-py);
    if(boundary>=23&&state.obstacles.every(o=>safeCircle(o,px,py,19)))
      clear[y*cols+x]=1;
  }
  state.botGrid={cols,rows,clear};
  return state.botGrid;
}
function botCellPoint(nav,index){
  return {x:(index%nav.cols+.5)*BOT_CELL,
    y:(Math.floor(index/nav.cols)+.5)*BOT_CELL};
}
function botClosestCell(nav,point){
  let best=-1,bestD=Infinity;
  for(let i=0;i<nav.clear.length;i++){
    if(!nav.clear[i])continue;
    const p=botCellPoint(nav,i),d=(point.x-p.x)**2+(point.y-p.y)**2;
    if(d<bestD){bestD=d;best=i;}
  }
  return best;
}
function botNeighbors(nav,id){
  const x=id%nav.cols,y=Math.floor(id/nav.cols);
  const out=[];
  for(const [dx,dy] of BOT_DIRS){
    const xx=x+dx,yy=y+dy;
    if(xx<0||yy<0||xx>=nav.cols||yy>=nav.rows)continue;
    const next=yy*nav.cols+xx;
    if(!nav.clear[next])continue;
    if(dx&&dy&&(!nav.clear[y*nav.cols+xx]||!nav.clear[yy*nav.cols+x]))continue;
    out.push([next,dx&&dy?Math.SQRT2:1]);
  }
  return out;
}
function botNavRoute(state,p,goal,threats=[],others=[]){
  const nav=botNavGrid(state);
  const source=botClosestCell(nav,p),destination=botClosestCell(nav,goal);
  if(source<0||destination<0)return [];
  if(source===destination)return [{x:goal.x,y:goal.y}];
  const length=nav.clear.length;
  const cost=new Float64Array(length).fill(Infinity);
  const estimate=new Float64Array(length).fill(Infinity);
  const parent=new Int32Array(length).fill(-1);
  const closed=new Uint8Array(length);
  cost[source]=0;
  const last=botCellPoint(nav,destination);
  estimate[source]=dist(botCellPoint(nav,source),last)/BOT_CELL;
  const open=[source];
  while(open.length){
    let min=0;
    for(let i=1;i<open.length;i++)
      if(estimate[open[i]]<estimate[open[min]])min=i;
    const current=open.splice(min,1)[0];
    if(closed[current])continue;
    if(current===destination)break;
    closed[current]=1;
    for(const [next,step] of botNeighbors(nav,current)){
      if(closed[next])continue;
      const pos=botCellPoint(nav,next);
      let penalty=0;
      for(const g of threats){
        const d=dist(pos,g);
        if(d<180)penalty+=Math.max(0,(180-d)/105)*1.45;
      }
      for(const other of others){
        const d=dist(pos,other);
        if(d<37)penalty+=1.4;
      }
      const maybe=cost[current]+step*(1+penalty);
      if(maybe>=cost[next])continue;
      cost[next]=maybe;parent[next]=current;
      estimate[next]=maybe+dist(pos,last)/BOT_CELL;
      open.push(next);
    }
  }
  if(parent[destination]<0)return [];
  const path=[];
  for(let node=destination;node!==source&&node>=0;node=parent[node]){
    path.push(botCellPoint(nav,node));
    if(path.length>length)break;
  }
  path.reverse();
  // Align with the actual crate/player, rather than just its grid cell.
  if(state.obstacles.every(o=>safeCircle(o,goal.x,goal.y,18)))
    path.push({x:goal.x,y:goal.y});
  return path;
}
function botEscapeGoal(p,state,threats,previous=null){
  const nav=botNavGrid(state);
  const start=botClosestCell(nav,p);
  if(start<0)return {x:state.world.w/2,y:state.world.h/2};
  const queue=[start],visited=new Uint8Array(nav.clear.length);
  const steps=new Int16Array(nav.clear.length);
  visited[start]=1;
  let selected=botCellPoint(nav,start),bestScore=-Infinity;
  const baseThreat=Math.min(...threats.map(g=>dist(p,g)),400);
  // Flood only connected navigable cells. The chosen exit is guaranteed
  // reachable, even when the direct escape direction hits a closed corner.
  for(let at=0;at<queue.length;at++){
    const id=queue[at],point=botCellPoint(nav,id);
    const dSelf=dist(point,p);
    const dThreat=Math.min(...threats.map(g=>dist(point,g)),400);
    if(dSelf>=64&&dSelf<=245){
      const edge=Math.min(point.x,point.y,state.world.w-point.x,state.world.h-point.y);
      const motion=(p.vx||0)*(point.x-p.x)+(p.vy||0)*(point.y-p.y);
      const continuity=previous?Math.max(0,1-dist(point,previous)/260)*22:0;
      const score=dThreat*1.2+Math.min(dSelf,170)*.27-
        steps[id]*2.8+Math.min(edge,68)*.13+
        Math.max(-18,Math.min(18,motion/135))+continuity+
        (dThreat>baseThreat?12:0);
      if(score>bestScore){bestScore=score;selected=point;}
    }
    if(steps[id]>=10)continue;
    for(const [next] of botNeighbors(nav,id)){
      if(visited[next])continue;
      visited[next]=1;steps[next]=steps[id]+1;queue.push(next);
    }
  }
  return selected;
}
function botNextHeading(p,brain){
  const path=brain.path||[];
  // Consume close waypoints without switching routes each frame.
  while(path.length>1&&dist(p,path[0])<19)path.shift();
  const target=path[0]||brain.goal;
  if(!target)return {x:0,y:0};
  if(dist(target,p)<12){path.shift();return {x:0,y:0};}
  return nrm(target.x-p.x,target.y-p.y);
}
function updateBots(dt,players,state){
  updateGhostHuntPlans(players,state);
  const humans=players.filter(q=>q.active&&!q.ghost);
  const humanGhosts=players.filter(q=>q.active&&q.ghost&&q.stun<=0);
  const npcThreats=state.ghostSpawned?state.npcs.filter(g=>g.stun<=0):[];
  const dangers=state.ghostSpawned?[...npcThreats,...humanGhosts]:humanGhosts;
  for(const p of players){
    if(!p.active||!p.isBot)continue;
    const input=p.input||(p.input={});
    input.left=input.right=input.jump=input.down=false;
    input.action=false;input.alt=false;input.axisX=0;input.axisY=0;
    const mind=p.botMind||(p.botMind={nextPlan:0,planKey:'',path:[],
      goal:null,lastX:null,lastY:null,stuckFor:0,unstickUntil:0,
      unstickGoal:null,lastEscapeGoal:null,roamGoal:null});
    if(p.stun>0||Combat.isAttacking(p))continue;
    if(p.ghost){
      const victim=visiblePrey(players).find(q=>q.id===p.huntTargetId);
      if(victim){
        const goal=p.huntGoal||ghostForecast(p,victim,state);
        const point=ghostSteeringPoint(p,goal,state);
        const dir=nrm(point.x-p.x,point.y-p.y);
        input.axisX=dir.x;input.axisY=dir.y;
      }
      // Pack-hunting ghosts infect by touch. They can NEVER punch.
      input.action=false;
      continue;
    }
    // Detect actual lack of progress, not visual directional changes.
    if(mind.lastX!==null){
      const moved=Math.hypot(p.x-mind.lastX,p.y-mind.lastY);
      if(mind.lastPower>.55&&moved<Math.max(.28,C.humanSpeed*dt*.10))
        mind.stuckFor+=dt;
      else mind.stuckFor=Math.max(0,mind.stuckFor-dt*2);
    }
    mind.lastX=p.x;mind.lastY=p.y;
    const near=botNearest(p,dangers);
    const threat=near.target,danger=near.distance;
    const loot=p.item?null:botNearest(p,state.boxes).target;
    const rivals=botNearest(p,humans.filter(q=>q!==p));
    const escaping=!!(threat&&danger<255&&p.cloak<=0);
    let key=escaping?'escape:'+threat.id:
      loot?'loot:'+loot.x.toFixed(0)+':'+loot.y.toFixed(0):
      'roam';
    const stuck=mind.stuckFor>.55;
    if(stuck){
      mind.stuckFor=0;
      mind.unstickGoal=botEscapeGoal(p,state,
        dangers.length?dangers:players.filter(q=>q.active&&q!==p),mind.goal);
      mind.unstickUntil=state.time+1.2;
      mind.nextPlan=0;
    }
    if(state.time<mind.unstickUntil&&mind.unstickGoal)
      key='unstick';
    if(!mind.goal||mind.planKey!==key||state.time>=mind.nextPlan||
      !(mind.path||[]).length){
      let goal;
      if(key==='unstick')goal=mind.unstickGoal;
      else if(escaping){
        goal=botEscapeGoal(p,state,dangers,mind.lastEscapeGoal);
        mind.lastEscapeGoal=goal;
      }else if(loot)goal={x:loot.x,y:loot.y};
      else{
        if(!mind.roamGoal||dist(p,mind.roamGoal)<35)
          mind.roamGoal=freeSpot(state.world,state.obstacles,[p],32,90);
        goal=mind.roamGoal;
      }
      mind.goal=goal;mind.planKey=key;
      mind.path=botNavRoute(state,p,goal,escaping?dangers:[],
        players.filter(q=>q.active&&q.id!==p.id));
      mind.nextPlan=state.time+(escaping?.72:1.05);
    }
    const dir=botNextHeading(p,mind);
    const speed=escaping?1:.94;
    input.axisX=dir.x*speed;input.axisY=dir.y*speed;
    mind.lastPower=Math.hypot(input.axisX,input.axisY);
    // Bots prioritize escape, looting and survival. Only punch when another
    // HUMAN physically blocks the escape direction during an active chase.
    const blocker=humans.filter(other=>other!==p)
      .map(other=>{
        const dx=other.x-p.x,dy=other.y-p.y;
        const distance=Math.hypot(dx,dy);
        const forward=distance>0?(dx*dir.x+dy*dir.y)/distance:0;
        return {other,distance,forward};
      }).find(hit=>hit.distance<39&&hit.forward>.53);
    if(blocker&&escaping&&danger>76&&danger<170&&
       p.punchCooldown<=0&&!p.actionLatch&&
       state.time>=(mind.nextDefensivePunch||0)){
      input.action=true;
      mind.nextDefensivePunch=state.time+2.8;
    }
    // Defensive items are situational and use the same edge-triggered inputs.
    if(p.item&&!p.altLatch){
      const other=botNearest(p,humans.filter(q=>q!==p)).target;
      let use=false;
      if(p.item==='stun')use=!!(threat&&danger<86);
      if(p.item==='cloak')use=!!(threat&&danger<175);
      if(p.item==='boost')use=!!(threat&&danger<230);
      if(p.item==='trap')use=!!(threat&&danger<95);
      if(p.item==='slow'&&other){
        p.targetId=other.id;
        use=p.selecting||rivals.distance<180||danger<170;
      }
      if(use)input.alt=true;
    }
  }
}
function infectHumanTouch(players,state){
  for(const spirit of players){
    if(!spirit.active||!spirit.ghost||spirit.stun>0)continue;
    for(const person of players){
      if(person.active&&!person.ghost&&person.cloak<=0&&
          dist(person,spirit)<=PLAYER_BODY_RADIUS*2+1)
        convert(person,state);
    }
  }
}
function update(dt,round,players){
  const state=round.ghost;
  if(!state||!['countdown','playing'].includes(round.phase))return;
  state.time+=dt;
  // Plan bot moves first. Players and bots then share the same physics,
  // hit detection, obstacle collisions and cooldowns.
  updateBots(dt,players,state);
  tickPlayers(dt,players,state);
  if(round.phase==='countdown'){
    resolvePlayerCollisions(players,state);
    return null;
  }
  advanceNpcs(dt,players,state);
  // A collision projection separates bodies to 32px. The previous 24px
  // infection threshold could NEVER fire while two players pushed against
  // each other: they were separated again before the next simulation tick.
  infectHumanTouch(players,state);
  updateTraps(dt,players,state);
  updateBoxes(dt,players,state);
  resolvePlayerCollisions(players,state);
  // Check once again after multi-player push resolution, including crowds.
  infectHumanTouch(players,state);
  const live=survivors(players);
  if(live.length===1){
    state.winnerId=live[0].id;
    live[0].score=100000+Math.floor(live[0].survival*10);
    return 'winner';
  }
  if(live.length===0){
    // When two victims are hit in the same frame, the last one converted
    // was the last human, avoiding an unwinnable zero-survivor match.
    state.winnerId=state.converted.at(-1)||players[0]?.id||null;
    const last=players.find(p=>p.id===state.winnerId);
    if(last)last.score=100000+Math.floor(last.survival*10);
    return 'winner';
  }
  return null;
}
function itemStatus(players){
  return players.filter(p=>p.active).map(p=>({
    id:p.id,item:p.item||null,ghost:!!p.ghost,selecting:!!p.selecting,
    targetId:p.targetId||null,
    targetName:players.find(q=>q.id===p.targetId&&!q.ghost)?.name||'',
    targets:players.filter(q=>q.active&&!q.ghost&&q.id!==p.id).map(q=>({id:q.id,name:q.name}))
  }));
}
function hud(players,round){
  return {survivors:survivors(players).length,ghosts:players.filter(p=>p.active&&p.ghost).length+
    (round.ghost?.npcs.length||0),total:players.filter(p=>p.active).length};
}
const GHOST_VISUAL_SCALE=1.26;
const GHOST_NAME_COLOR='#ff454f';
function drawPerson(ctx,p,color,ghost,t,alpha=1,theme='graveyard'){
  ctx.save();ctx.globalAlpha=alpha;
  // Only enlarge ghost artwork; preserve gameplay speed, hit radius and physics.
  if(ghost)Art.drawActor(ctx,p,color,true,t,theme,GHOST_VISUAL_SCALE);
   else window.PartyPlayerAvatar.draw(ctx,p,{time:t,color,label:false,attacking:p.attackRemaining>0});
  // The shared combat and stun timelines also decorate the SVG sprite.
  Combat.drawAttack(ctx,p);
  Combat.drawStun(ctx,p,t);
  const labelY=p.y-(ghost?(p.stun>0?59:43):(p.stun>0?48:34));
  ctx.font=(ghost?'900 14px':'bold 13px')+' system-ui';ctx.textAlign='center';
  ctx.lineJoin='round';ctx.strokeStyle='#081329';ctx.lineWidth=4;
  ctx.strokeText(p.name||'GHOST',p.x,labelY);
  ctx.fillStyle=ghost?GHOST_NAME_COLOR:'#fff';
  ctx.fillText(p.name||'GHOST',p.x,labelY);
  ctx.restore();
}
function drawPickupNotice(ctx,p,w,h){
  if(!p.pickupNotice||p.pickupNoticeTime<=0)return;
  const elapsed=2.1-p.pickupNoticeTime;
  const y=clamp(p.y-66-elapsed*9,26,Math.max(26,h-48));
  const msg='ได้รับ: '+p.pickupNotice;
  const icon=getItemIconImage(p.pickupNoticeItem);
  const showIcon=!!(icon&&icon.complete&&icon.naturalWidth>0);
  ctx.save();
  ctx.globalAlpha=clamp(p.pickupNoticeTime/.38,0,1);
  ctx.textAlign='left';
  ctx.font='bold 15px system-ui';
  ctx.lineJoin='round';
  ctx.lineWidth=5;
  ctx.strokeStyle='#07192a';
  ctx.fillStyle='#ffe69b';
  const iconSize=18,gap=6;
  const textWidth=Math.min(220,ctx.measureText(msg).width);
  const totalWidth=textWidth+(showIcon?iconSize+gap:0);
  const half=totalWidth/2+8;
  const centerX=clamp(p.x,half,Math.max(half,w-half));
  const x=centerX-totalWidth/2;
  if(showIcon)ctx.drawImage(icon,x,y-14,iconSize,iconSize);
  const textX=x+(showIcon?iconSize+gap:0);
  ctx.strokeText(msg,textX,y,220);
  ctx.fillText(msg,textX,y,220);
  ctx.restore();
}
// Inspection is read-only and only enabled by the host's bot-only
// QA UI. ID, hitbox and coordinates match the actual collision obstacle.
function mapInfo(round){
 const s=round?.ghost;
 return s?{id:s.mapId,name:Art.themeLabel(s.theme),theme:s.theme,
   width:s.world.w,height:s.world.h,tier:s.tier,count:s.obstacles.length}:null;
}
function obstacleAt(round,x,y){
 const s=round?.ghost;
 if(!s||!Number.isFinite(x)||!Number.isFinite(y))return null;
 const hit=s.obstacles.findLast?.(o=>x>=o.x&&x<=o.x+o.w&&y>=o.y&&y<=o.y+o.h)||
   [...s.obstacles].reverse().find(o=>x>=o.x&&x<=o.x+o.w&&y>=o.y&&y<=o.y+o.h);
 return hit?{id:hit.id,kind:hit.kind,variant:hit.variant||0,
   x:hit.x,y:hit.y,w:hit.w,h:hit.h}:null;
}
function drawObstacleIds(ctx,s){
 if(!s.showObstacleIds)return;
 ctx.save();
 ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.font='bold 13px system-ui,sans-serif';
 for(const o of s.obstacles){
  if(o.kind==='hud-blocker')continue; // Keep the countdown legible.
  const selected=o.id===s.selectedObstacleId;
  ctx.strokeStyle=selected?'#ffe57f':'#83f4d6';
  ctx.lineWidth=selected?3:1.6;
  ctx.strokeRect(o.x-1,o.y-1,o.w+2,o.h+2);
  const cx=o.x+o.w/2,cy=o.y+o.h/2;
  ctx.fillStyle='#081d31ed';
  const textWidth=ctx.measureText?.(o.id)?.width||o.id.length*8;
  ctx.fillRect(cx-textWidth/2-5,cy-10,textWidth+10,20);
  ctx.fillStyle=selected?'#ffe57f':'#c4ffed';
  ctx.fillText(o.id,cx,cy);
 }
 ctx.restore();
}
function drawThemeBackdrop(ctx,state,t,w,h){
  window.PartyArenaArt.draw(ctx,state.theme,state,w,h);
}
function draw(ctx,t,round,players){
  const state=round.ghost;if(!state)return;
  const w=state.world.w,h=state.world.h;
  ctx.save();ctx.clearRect(0,0,960,540);
  ctx.scale(960/w,540/h);
  drawThemeBackdrop(ctx,state,t,w,h);
  // SVG visuals sit on the SAME collision rectangles and nav grid blockers.
  for(const o of state.obstacles)
    if(o.kind!=='hud-blocker'&&!o.boundary)Art.drawObstacle(ctx,o);
  // The warning marks the actual initial ghost position, then disappears.
  if(!state.ghostSpawned){
    const center=state.spawn||{x:w/2,y:h/2};
    ctx.save();ctx.strokeStyle=state.theme==='egypt'?'#ffe2a080':'#c6eaff80';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(center.x,center.y,24+3*Math.sin(t*2),0,TAU);ctx.stroke();
    ctx.restore();
  }
  for(const trap of state.traps){
    ctx.fillStyle='#2b1e29';ctx.strokeStyle='#f2a052';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(trap.x,trap.y,16,0,TAU);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(trap.x-9,trap.y-8);ctx.lineTo(trap.x+7,trap.y+8);
    ctx.moveTo(trap.x+9,trap.y-8);ctx.lineTo(trap.x-7,trap.y+8);ctx.stroke();
  }
  for(const b of state.boxes)Art.drawLootBox(ctx,b,t,state.theme);
  if(state.ghostSpawned){
    for(const npc of state.npcs)
      drawPerson(ctx,{...npc,name:state.theme==='egypt'?'ฟาโรห์':'ผี'},
        '#f5faff',true,t,npc.stun>0?.65:1,state.theme);
  }
  for(const p of players){
    if(!p.active)continue;
    const alpha=p.cloak>0?.19:1;
    drawPerson(ctx,p,p.color,p.ghost,t,alpha,state.theme);
    // Show the freshly obtained item above THIS player, not globally.
    drawPickupNotice(ctx,p,w,h);
    if(p.boost>0){ctx.save();ctx.strokeStyle=p.color;ctx.lineWidth=2.5;
      ctx.beginPath();ctx.arc(p.x,p.y,29,0,TAU);ctx.stroke();ctx.restore();}
  }
  // Slow-medicine target highlighting is visible on the host screen.
  for(const caster of players){
    if(!caster.active||!caster.selecting||caster.item!=='slow')continue;
    const target=players.find(p=>p.id===caster.targetId);
    if(!target)continue;
    ctx.save();ctx.strokeStyle=caster.color;ctx.lineWidth=5;
    ctx.shadowBlur=14;ctx.shadowColor=caster.color;ctx.beginPath();
    ctx.arc(target.x,target.y,31+2*Math.sin(t*7),0,TAU);ctx.stroke();ctx.restore();
  }
  // Shared centre badge is rendered by app.js after the scene.
  drawObstacleIds(ctx,state);
  ctx.restore();
}
window.GhostAttack={resultTitle:"ผู้รอดคนสุดท้าย!",countdownSeconds:3,updateDuringCountdown:true,onCountdownFinished(round){round.ghost.ghostSpawned=true;},setup,update,draw,hud,itemStatus,cycleTarget,
  mapInfo,obstacleAt,
  ITEM_NAMES,ITEM_SVG,getItemIconImage,constants:C};
})();
