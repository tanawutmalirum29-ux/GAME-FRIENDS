/* FRUIT MEMORY: host-authoritative survival game. Deliberately independent of GhostAttack/Chickens. */
(() => {
'use strict';
const TAU=Math.PI*2, FIXED=1/60;
const Combat=window.PartyCombatMotion;
const C=Object.freeze({speed:207,radius:13,footRadius:10,punchRange:53,windup:Combat.ATTACK.windup,hit:Combat.ATTACK.active,recovery:Combat.ATTACK.recovery,cooldown:Combat.ATTACK.cooldown,stun:Combat.NORMAL_STUN});
const FRUITS=[
 {id:'apple',name:'แอปเปิล',color:'#e84957',svg:'<path d="M32 20c-9-13-25-6-23 10 1 14 11 24 23 17 12 7 22-3 23-17 2-16-14-23-23-10Z" fill="#e84957"/><path d="M32 22c-2-9 1-14 7-18" stroke="#65452b" stroke-width="4" fill="none"/><path d="M33 15c5-9 13-9 17-7-3 9-9 12-17 7Z" fill="#73d180"/>'},
 {id:'banana',name:'กล้วย',color:'#f5d258',svg:'<path d="M11 10c10 29 25 35 48 23-8 24-43 31-51-16Z" fill="#ffda61" stroke="#b98525" stroke-width="3"/><path d="M10 11 6 7m51 28 3 3" stroke="#654622" stroke-width="5"/>'},
 {id:'orange',name:'ส้ม',color:'#ff9c38',svg:'<circle cx="32" cy="32" r="23" fill="#ff9c38"/><circle cx="24" cy="26" r="4" fill="#ffd18a" opacity=".65"/><path d="M31 11c2-8 12-11 19-8-4 10-12 13-19 8Z" fill="#66b95c"/><path d="M32 14v-6" stroke="#4b8d44" stroke-width="3"/>'},
 {id:'grape',name:'องุ่น',color:'#b28cfc',svg:'<path d="M32 15c-2-8 0-11 6-12" stroke="#52874f" stroke-width="4"/><path d="M32 14c7-10 17-7 20-4-4 8-12 11-20 4Z" fill="#67b76c"/><g fill="#a87af0" stroke="#7551bc" stroke-width="1.4"><circle cx="23" cy="23" r="9"/><circle cx="40" cy="23" r="9"/><circle cx="16" cy="35" r="9"/><circle cx="32" cy="35" r="9"/><circle cx="48" cy="35" r="9"/><circle cx="24" cy="46" r="9"/><circle cx="40" cy="46" r="9"/><circle cx="32" cy="55" r="8"/></g>'},
 {id:'strawberry',name:'สตรอว์เบอร์รี',color:'#f35665',svg:'<path d="M12 21c-3 23 17 37 20 39 5-2 25-21 20-39-10-8-31-8-40 0Z" fill="#f35665"/><path d="m32 19-8-9 1 11-13-4 10 11 10-4 11 4 9-11-12 4V9Z" fill="#65b65b"/><g fill="#ffe7a3"><circle cx="22" cy="34" r="2"/><circle cx="39" cy="34" r="2"/><circle cx="30" cy="44" r="2"/><circle cx="41" cy="46" r="2"/></g>'},
 {id:'pineapple',name:'สับปะรด',color:'#e5ba4e',svg:'<path d="m31 21-11-17 14 11 11-11-5 18" fill="#67ae64"/><ellipse cx="32" cy="39" rx="19" ry="24" fill="#e9b94d" stroke="#b9812e" stroke-width="2"/><path d="m18 23 27 30m-26 0 27-30M13 36h38M19 47h26" stroke="#b8812c" stroke-width="2" opacity=".8"/>'},
 {id:'watermelon',name:'แตงโม',color:'#fc6878',svg:'<path d="M7 19a29 29 0 0 0 50 0L32 50Z" fill="#f95d6d"/><path d="M7 19a29 29 0 0 0 50 0" fill="none" stroke="#429d61" stroke-width="7"/><g fill="#452e33"><ellipse cx="24" cy="30" rx="2" ry="4"/><ellipse cx="39" cy="30" rx="2" ry="4"/><ellipse cx="32" cy="39" rx="2" ry="4"/></g>'},
 {id:'cherry',name:'เชอร์รี',color:'#eb4669',svg:'<path d="M31 17C22 6 17 14 15 29m16-12C39 5 48 9 48 28" stroke="#538e4f" stroke-width="4" fill="none"/><path d="M31 17c-5-10 2-14 15-13-1 9-6 12-15 13Z" fill="#67c174"/><circle cx="16" cy="39" r="13" fill="#df4564"/><circle cx="47" cy="39" r="13" fill="#f15170"/>'}
];
const FRUIT_BY_ID=Object.fromEntries(FRUITS.map(f=>[f.id,f]));
const TILE_COLORS=Object.freeze({apple:'#f3b6ad',banana:'#f2da78',orange:'#f9c56a',grape:'#aeceec',
 strawberry:'#efb5cb',pineapple:'#dbdf80',watermelon:'#95d6b5',cherry:'#d4b5e8'});
const imageCache={};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const shuffle=list=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const living=players=>players.filter(p=>p.active&&p.fruitAlive);
function fruitImage(id){
 if(imageCache[id])return imageCache[id];
 if(typeof Image==='undefined')return null;
 const fruit=FRUIT_BY_ID[id];if(!fruit)return null;
 const img=new Image();
 img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'+fruit.svg+'</svg>');
 imageCache[id]=img;return img;
}
function generateGrid(count,selected){
 const small=count<=6;
 const cols=small?5:6,kindsCount=small?5:6;
 const kinds=selected||shuffle(FRUITS.map(f=>f.id)).slice(0,kindsCount);
 const distributed=shuffle(kinds.flatMap(id=>Array.from({length:small?5:6},()=>id)));
 return distributed.map((fruitType,i)=>({tileId:i,row:Math.floor(i/cols),column:i%cols,fruitType,
   revealState:'closed',collapseState:'solid',fall:0}));
}
function buildRevealSchedule(tiles,minCards=4,maxCards=6){
 // Small arena: 4–6 cards/batch; large arena: 6–8 cards/batch.
 // Only pick counts that allow every remaining batch to meet its own limits.
 const pending=shuffle(tiles.map(t=>t.tileId)),groups=[];
 const partitionable=remaining=>{
   if(remaining===0)return true;
   for(let batches=Math.ceil(remaining/maxCards);batches<=Math.floor(remaining/minCards);batches++)
     if(batches*minCards<=remaining&&remaining<=batches*maxCards)return true;
   return false;
 };
 if(!partitionable(pending.length))throw Error('Fruit Memory grid cannot be partitioned into reveal batches');
 while(pending.length){
   const possible=[];
   for(let n=minCards;n<=maxCards;n++)
     if(n<=pending.length&&partitionable(pending.length-n))possible.push(n);
   if(!possible.length)throw Error('Cannot schedule remaining Fruit Memory cards');
   const count=possible[Math.floor(Math.random()*possible.length)];
   groups.push(pending.splice(0,count));
 }
 return groups;
}
// Each new survival wave accelerates Fruit Memory. Round one retains the
// original timings; later waves shorten exposure and running time with floors.
function memoryPace(roundNumber,large){
 const extra=Math.max(0,(Number(roundNumber)||1)-1);
 return {
   revealFactor:Math.max(.55,1-.08*extra),
   moveSeconds:large?Math.max(3.2,7-.6*extra):Math.max(2.5,5-.5*extra)
 };
}
function buildRevealTimeline(groups,revealFactor=1){
 let start=0;
 return groups.map(ids=>{
   // Every group completes its own (progressively shorter) exposure; there
   // is never a hard global cutoff that could skip unrevealed tiles.
   const duration=(1.15+ids.length*.13+Math.random()*.33)*revealFactor;
   const item={ids,start,end:start+duration,duration};
   start=item.end;
   return item;
 });
}
function configureBoard(state){
  // Each logical tile is a perfect square on the 960x540 arena.
  // Center the largest practical square below the gameplay HUD.
  const side=420;
  state.board={x:(960-side)/2,y:105,w:side,h:side};
  state.tileW=side/state.cols;
  state.tileH=side/state.rows;
}
 function tileAt(state,x,y){
 const b=state.board;
 if(x<b.x||x>=b.x+b.w||y<b.y||y>=b.y+b.h)return null;
 const col=Math.floor((x-b.x)/state.tileW),row=Math.floor((y-b.y)/state.tileH);
 return state.tiles[row*state.cols+col]||null;
}
function tileRect(state,t){return {x:state.board.x+t.column*state.tileW,y:state.board.y+t.row*state.tileH,w:state.tileW,h:state.tileH};}
function setPhase(state,phase){state.phase=phase;state.elapsed=0;}
function newMemorize(state,players,entrants){
 const firstRound=state.rounds===0;
 if(firstRound)state.tiles=generateGrid(state.startCount);
 else{
   // Reuse THE SAME board, tile objects and tile coordinates. Only change
   // the hidden fruit assignment after the dropped tiles have risen back.
   const shuffled=generateGrid(state.startCount);
   for(let i=0;i<state.tiles.length;i++){
     const tile=state.tiles[i];
     tile.fruitType=shuffled[i].fruitType;
     tile.revealState='closed';tile.collapseState='solid';tile.fall=0;
   }
 }
 state.revealedTileIds=new Set();
 state.revealGroups=state.big?buildRevealSchedule(state.tiles,6,8):buildRevealSchedule(state.tiles,4,6);
 const nextRound=state.rounds+1;
 const pace=memoryPace(nextRound,state.big);
 state.revealFactor=pace.revealFactor;
 state.moveSeconds=pace.moveSeconds;
 state.revealTimeline=buildRevealTimeline(state.revealGroups,pace.revealFactor);
 state.revealCursor=0;
 state.revealDuration=state.revealTimeline.at(-1).end;
 state.target=null;state.rounds=nextRound;
 state.fallEntries=[];state.pendingWinner=null;state.botTargets={};
 state.pendingTie=false;state.tieIds=[];
 for(const p of players){
   p.fruitAlive=entrants.includes(p.id)&&p.active;
   p.fruitFall=0;p.fruitStun=0;p.fruitAttack=null;p.fruitCooldown=0;p.fruitPunchPressed=false;
   p.stun=0;p.punchCooldown=0;Combat.reset(p);
 }
 const active=living(players);
 if(firstRound){
   // Place players only ONCE, when the full match begins. Never teleport
   // surviving players or bots at the start of each memory round.
   const spawns=shuffle(state.tiles);
   for(let i=0;i<active.length;i++){
     const p=active[i],tile=spawns[i];
     p.x=state.board.x+(tile.column+.5)*state.tileW;
     p.y=state.board.y+(tile.row+.5)*state.tileH;
     p.dir={x:1,y:0};p.vx=0;p.vy=0;
   }
 }else{
   for(const p of active){p.vx=0;p.vy=0;}
 }
 state.previousEntrants=[...entrants];
 setPhase(state,'memorize');
}
function setup(round,players){
 const startCount=clamp(players.length,1,12);
 const large=startCount>6;
 const state={startCount,big:large,cols:large?6:5,rows:large?6:5,
   moveSeconds:large?7:5,collapseSeconds:large?1.8:1.5,
   tiles:[],elapsed:0,accumulator:0,rounds:0,phase:'memorize',previousTarget:null,
   winnerId:null,finished:false,totalElapsed:0,pendingTie:false,tieIds:[]};
 configureBoard(state);
 round.fruitMemory=state;
 for(const p of players){p.active=true;p.score=0;p.fruitRounds=0;p.fruitEliminatedRound=0;}
 newMemorize(state,players,players.map(p=>p.id));
 return state;
}
function inputVector(input){
 const x=Number(input?.axisX)||Number(!!input?.right)-Number(!!input?.left);
 const y=Number(input?.axisY)||Number(!!input?.down)-Number(!!input?.jump);
 const len=Math.hypot(x,y);return len>1?{x:x/len,y:y/len}:{x,y};
}
function chooseTargetFruit(state){
 const ids=[...new Set(state.tiles.map(t=>t.fruitType))];
 const possibilities=ids.filter(id=>id!==state.previousTarget);
 state.target=possibilities[Math.floor(Math.random()*possibilities.length)]||ids[0];
 state.previousTarget=state.target;
 state.botTargets={};
}
function botVector(p,state){
 if(state.phase!=='move'||!state.target)return {x:0,y:0};
 if(!state.botTargets[p.id]){
   // Bots remember most tiles but can misremember, so bot-only matches can conclude.
   const mistake=state.startCount>1&&Math.random()<.24;
   const options=state.tiles.filter(t=>mistake?t.fruitType!==state.target:t.fruitType===state.target);
   const sorted=options.map(t=>({t,x:tileRect(state,t).x+state.tileW*.5,
     y:tileRect(state,t).y+state.tileH*.5})).sort((a,b)=>
     Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
   const rank=parseInt(String(p.id).replace(/\D/g,''),10)||0;
   state.botTargets[p.id]=sorted[Math.min(rank%2,sorted.length-1)]||sorted[0];
 }
 const goal=state.botTargets[p.id];if(!goal)return {x:0,y:0};
 const dx=goal.x-p.x,dy=goal.y-p.y,d=Math.hypot(dx,dy);
 return d<6?{x:0,y:0}:{x:dx/d,y:dy/d};
}
function startPunch(p){
 if(!window.PartyCharacters.startPunch(p))return false;
 p.fruitAttack={elapsed:0};
 p.fruitCooldown=p.punchCooldown;
 return true;
}
function resolvePunchHits(attacker,players){
 // Keep Fruit Memory's multi-target arc with the shared 0.8s stun.
 return window.PartyCharacters.punchFriends(attacker,living(players),{
   range:C.punchRange+C.radius,coneCos:.55,
   canHit:target=>target.fruitAlive
 });
}
function stepPlayer(p,state,players,dt){
 if(!p.active||!p.fruitAlive)return;
 p.punchCooldown=Math.max(0,(p.punchCooldown||0)-dt);
 p.fruitCooldown=p.punchCooldown;
 p.fruitStun=Math.max(0,(p.fruitStun||0)-dt);
 p.stun=p.fruitStun;
 p.fruitHitFlash=Math.max(0,(p.fruitHitFlash||0)-dt);
 const input=p.input||{},pressed=!!input.action;
 const wasAttacking=Combat.isAttacking(p);
 if(wasAttacking){
   window.PartyCharacters.stepPunch(p,dt,()=>resolvePunchHits(p,players));
   if(p.fruitAttack)p.fruitAttack.elapsed+=dt;
   if(!Combat.isAttacking(p))p.fruitAttack=null;
 }
 if(pressed&&!p.fruitPunchPressed&&p.fruitStun<=0&&!p.fruitAttack)startPunch(p);
 p.fruitPunchPressed=pressed;
 const motion=p.isBot?botVector(p,state):inputVector(input);
 if(Math.hypot(motion.x,motion.y)>.14&&!Combat.isAttacking(p)&&p.fruitStun<=0)
   p.dir={x:motion.x,y:motion.y};
 const allowed=state.phase==='memorize'||state.phase==='move';
 const canWalk=allowed&&!wasAttacking&&!Combat.isAttacking(p)&&p.fruitStun<=0;
 p.vx=canWalk?motion.x*C.speed:0;p.vy=canWalk?motion.y*C.speed:0;
 p.x+=p.vx*dt;p.y+=p.vy*dt;
 const b=state.board;
 p.x=clamp(p.x,b.x+C.radius,b.x+b.w-C.radius);
 p.y=clamp(p.y,b.y+C.radius,b.y+b.h-C.radius);
}
function resolvePlayerCollisions(state,players){
 return window.PartyCharacters.resolve(players,{
   filter:p=>p.active&&p.fruitAlive,
   radius:C.radius,iterations:8,pressure:false,
   bounds:state.board
 });
}
// Exact circle/rectangle intersection (Simpson numerical integration), used ONLY at the snapshot.
function circleRectArea(cx,cy,r,rect){
 const from=Math.max(cx-r,rect.x),to=Math.min(cx+r,rect.x+rect.w);
 if(to<=from)return 0;
 const n=96,h=(to-from)/n;
 function height(x){
   const dy=Math.sqrt(Math.max(0,r*r-(x-cx)*(x-cx)));
   return Math.max(0,Math.min(cy+dy,rect.y+rect.h)-Math.max(cy-dy,rect.y));
 }
 let sum=height(from)+height(to);
 for(let i=1;i<n;i++)sum+=(i%2?4:2)*height(from+i*h);
 return Math.max(0,sum*h/3);
}
function calculateFootSupport(state,p){
 const footArea=Math.PI*C.footRadius*C.footRadius;
 let safeArea=0,otherArea=0;
 for(const t of state.tiles){
   const r=tileRect(state,t);
   if(Math.abs(p.x-(r.x+r.w/2))>r.w/2+C.footRadius||
      Math.abs(p.y-(r.y+r.h/2))>r.h/2+C.footRadius)continue;
   const area=circleRectArea(p.x,p.y,C.footRadius,r);
   if(t.fruitType===state.target)safeArea+=area;
   else otherArea+=area;
 }
 const ratio=clamp(safeArea/footArea,0,1);
 const center=tileAt(state,p.x,p.y);
 const tie=Math.abs(ratio-.5)<=.002;
 return {ratio,area:safeArea,covered:clamp((safeArea+otherArea)/footArea,0,1),
   survive:ratio>.5+.002||(tie&&center?.fruitType===state.target)};
}
function evaluateSurvivors(state,players){
 // Every judgment reads the SAME position snapshot, before any fall animation.
 const entrants=living(players);
 const snapshots=entrants.map(p=>({id:p.id,x:p.x,y:p.y,result:calculateFootSupport(state,p)}));
 const survivors=new Set(snapshots.filter(s=>s.result.survive).map(s=>s.id));
 state.snapshots=snapshots;
 state.fallEntries=entrants.map(p=>({id:p.id,x:p.x,y:p.y,survive:survivors.has(p.id)}));
 // All entrants are assessed from the same movement snapshot.
 // Nobody resurrects after simultaneous elimination; previous-round losers
 // remain permanently eliminated and cannot appear in future rounds.
 for(const p of entrants){
   p.fruitAlive=survivors.has(p.id);
   if(p.fruitAlive){p.fruitRounds++;p.score=p.fruitRounds;}
   else p.fruitEliminatedRound=state.rounds;
 }
 state.pendingTie=survivors.size===0;
 state.tieIds=state.pendingTie?entrants.map(p=>p.id):[];
 state.replayEntrants=null;
 const remaining=living(players);
 state.pendingWinner=remaining.length===1?remaining[0].id:null;
 for(const t of state.tiles)t.collapseState=t.fruitType===state.target?'safe':'falling';
 setPhase(state,'collapse');
}
function step(state,players,dt){
 state.totalElapsed+=dt;
 if(!living(players).length&&state.phase!=='collapse'){
  state.winnerId=null;state.finished=true;return;
 }
 if(state.pendingWinner&&!players.some(p=>p.id===state.pendingWinner&&p.active)){
   state.pendingWinner=null;state.replayEntrants=living(players).map(p=>p.id);
 }
 if(state.phase==='memorize'){
   state.elapsed+=dt;
   // Complete each reveal AFTER its visibility interval. The last batch is
   // shown in full and then we immediately flip everything face-down.
   while(state.revealCursor<state.revealTimeline.length&&
     state.elapsed+1e-8>=state.revealTimeline[state.revealCursor].end){
     const batch=state.revealTimeline[state.revealCursor++];
     for(const id of batch.ids)state.revealedTileIds.add(id);
   }
   if(state.revealCursor===state.revealTimeline.length&&
      state.revealedTileIds.size===state.tiles.length)setPhase(state,'hide');
 }else if(state.phase==='hide'){
   state.elapsed+=dt;if(state.elapsed>=.65){chooseTargetFruit(state);setPhase(state,'target');}
 }else if(state.phase==='target'){
   state.elapsed+=dt;if(state.elapsed>=.55)setPhase(state,'move');
 }else if(state.phase==='move'){
   // Fixed physics resolves impulses and punch before freezing ALL players.
   for(const p of players)stepPlayer(p,state,players,dt);
   resolvePlayerCollisions(state,players);
   state.elapsed+=dt;
   if(state.elapsed>=state.moveSeconds)evaluateSurvivors(state,players);
 }else if(state.phase==='collapse'){
   state.elapsed+=dt;
   if(state.elapsed>=state.collapseSeconds){
     if(state.pendingWinner){state.winnerId=state.pendingWinner;state.finished=true;return;}
     if(state.pendingTie){state.winnerId=null;state.finished=true;return;}
     const entrants=living(players).map(p=>p.id);
     state.nextEntrants=entrants;setPhase(state,'rebuild');
   }
 }else if(state.phase==='rebuild'){
   state.elapsed+=dt;
   if(state.elapsed>=.85)newMemorize(state,players,state.nextEntrants);
 }
 // Movement and punches during reveal, but neither while hiding nor rebuilding.
 if(state.phase==='memorize'){
   for(const p of players)stepPlayer(p,state,players,dt);
   resolvePlayerCollisions(state,players);
 }
 // A disconnect must not block victory forever.
 if(state.phase==='memorize'||state.phase==='move'){
   const remaining=living(players);
   if(remaining.length===0){state.winnerId=null;state.finished=true;}
   else if(remaining.length===1&&state.startCount>1&&state.rounds>0){
     state.winnerId=remaining[0].id;state.finished=true;
   }
 }
}
function update(dt,round,players){
 const state=round.fruitMemory;
 if(!state||state.finished)return state?.finished?'winner':null;
 if(round.phase!=='playing')return null;
 state.accumulator=Math.min(.15,state.accumulator+clamp(dt,0,.1));
 while(state.accumulator>=FIXED&&!state.finished){
   step(state,players,FIXED);state.accumulator-=FIXED;
 }
 round.remaining=state.phase==='move'?Math.max(0,state.moveSeconds-state.elapsed):null;
 return state.finished?'winner':null;
}
function hud(players,round){
 const state=round.fruitMemory;
 return {survivors:living(players).length,remaining:round.remaining||0,
   phase:state?.phase||'countdown',fruit:state?.target||null};
}
function drawTile(ctx,state,t,time){
 const r=tileRect(state,t),pad=3,correct=t.fruitType===state.target;
 const collapsing=state.phase==='collapse',falling=collapsing&&!correct;
 const rebuilding=state.phase==='rebuild'&&t.collapseState==='falling';
 const fallProgress=falling?clamp((state.elapsed-.12)/(state.collapseSeconds-.2),0,1):
   rebuilding?1-clamp(state.elapsed/.85,0,1):0;
 if((falling||rebuilding)&&fallProgress>0.98)return;
 let revealed=false,flipping=1;
 if(state.phase==='memorize'){
   const batch=state.revealTimeline[state.revealCursor];
   if(batch){
     const within=state.elapsed-batch.start;
     revealed=batch.ids.includes(t.tileId)&&within>.12&&within<batch.duration-.17;
     if(revealed){
       const edge=Math.min(within-.12,batch.duration-.17-within);
       flipping=clamp(edge/.17,0,1);
     }
   }
 }else if(collapsing)revealed=true;
 const yOffset=fallProgress*220,alpha=(falling||rebuilding)?1-fallProgress*.85:1;
 ctx.save();ctx.globalAlpha=alpha;ctx.translate(r.x+r.w/2,r.y+r.h/2+yOffset);
 if(falling||rebuilding){ctx.rotate(fallProgress*.12*(t.column%2?1:-1));ctx.scale(1-fallProgress*.19,1-fallProgress*.19);}
 const w=(r.w-pad*2)*(revealed?Math.max(.06,flipping):1),h=r.h-pad*2;
 // Only revealed cards get fruit-specific colors. Hidden cards remain identical.
 const face=revealed?TILE_COLORS[t.fruitType]:'#68648d';
 ctx.fillStyle='#302e4f';ctx.beginPath();ctx.roundRect(-w/2,-h/2+5,w,h,8);ctx.fill();
 ctx.fillStyle=face;ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h-3,8);ctx.fill();
 ctx.strokeStyle=revealed?'#fff2c9':'#b7b1d2';ctx.lineWidth=2;
 ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle='#ffffff1a';ctx.beginPath();ctx.roundRect(-w/2+5,-h/2+5,w-10,7,3);ctx.fill();
 if(revealed&&flipping>.56){
   const icon=fruitImage(t.fruitType);
   const size=Math.min(w*.65,h*.78,54);
   if(icon?.complete&&icon.naturalWidth>0)ctx.drawImage(icon,-size/2,-size/2-1,size,size);
   else{
     ctx.fillStyle=FRUIT_BY_ID[t.fruitType].color;
     ctx.beginPath();ctx.arc(0,0,size*.28,0,TAU);ctx.fill();
   }
 }else if(!revealed){
   ctx.fillStyle='#b5afcf';ctx.font='900 '+Math.round(Math.min(h*.65,44))+'px sans-serif';
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',0,0);
 }
 if(collapsing&&correct){
   ctx.strokeStyle='#d5ffac';ctx.lineWidth=4;
   ctx.beginPath();ctx.roundRect(-w/2+3,-h/2+3,w-6,h-9,6);ctx.stroke();
 }

 ctx.restore();
}
function drawPlayer(ctx,p,state,time){
 if(!p.active)return;
 const entry=state.fallEntries.find(e=>e.id===p.id);
 const falling=state.phase==='collapse'&&entry&&!entry.survive;
 // Only losses from the CURRENT wave fall; earlier losses stay invisible.
 if(!p.fruitAlive&&!falling)return;
 const progress=falling?clamp((state.elapsed-.15)/(state.collapseSeconds-.15),0,1):0;
 if(falling&&progress>=1)return;
 ctx.save();ctx.translate(p.x,p.y+progress*180);
 ctx.globalAlpha=1-progress*.85;ctx.scale(1-progress*.65,1-progress*.65);
 window.PartyCharacters.draw(ctx,p,{local:true,time,
   color:p.color,attacking:Combat.isAttacking(p)});
 ctx.restore();
}
// Both screens share one phase snapshot; neither changes gameplay state.
function drawSideDisplays(ctx,state,round,players){
 const b=state.board,w=146,h=Math.min(350,b.h-30),y=b.y+(b.h-h)/2;
 const target=FRUIT_BY_ID[state.target];
 const showTarget=!!target&&['target','move','collapse'].includes(state.phase)&&round.phase!=='countdown';
 let opened=state.revealedTileIds.size;
 const batch=state.revealTimeline[state.revealCursor];
 if(state.phase==='memorize'&&batch&&state.elapsed-batch.start>.12)
   opened=new Set([...state.revealedTileIds,...batch.ids]).size;
 const seconds=state.phase==='move'?Math.ceil(Math.max(0,state.moveSeconds-state.elapsed)):state.moveSeconds;
 for(const x of [b.x-38-w,b.x+b.w+38]){
   ctx.save();ctx.translate(x,y);
   ctx.fillStyle='#342c50';ctx.beginPath();ctx.roundRect(0,6,w,h,12);ctx.fill();
   ctx.fillStyle='#8662af';ctx.strokeStyle='#d7b9ee';ctx.lineWidth=3;
   ctx.beginPath();ctx.roundRect(0,0,w,h,12);ctx.fill();ctx.stroke();
   ctx.fillStyle='#f5b64f';ctx.beginPath();ctx.roundRect(8,9,w-16,h-18,7);ctx.fill();
   ctx.fillStyle='#ffe09a';ctx.fillRect(15,17,w-30,4);
   // Clip all labels to the panel's inner rectangle. Some iPad browsers
   // misposition Thai glyphs when centered with maxWidth; anchor Thai left.
   ctx.beginPath();ctx.roundRect(9,10,w-18,h-20,6);ctx.clip();
   ctx.textBaseline='middle';
   const label=(value,yy,size=16,color='#493153')=>{
     ctx.textAlign='left';ctx.fillStyle=color;
     ctx.font='800 '+size+'px Tahoma, sans-serif';
     ctx.fillText(value,17,yy,w-34);
   };
   const number=(value,yy,size=58,color='#493153')=>{
     ctx.textAlign='center';ctx.fillStyle=color;
     ctx.font='900 '+size+'px system-ui,sans-serif';
     ctx.fillText(String(value),w/2,yy,w-34);
   };
   const progress=value=>{
     const ratio=clamp(value/state.tiles.length,0,1);
     ctx.fillStyle='#ad743c';ctx.fillRect(17,262,w-34,6);
     ctx.fillStyle='#fff4c7';ctx.fillRect(17,262,(w-34)*ratio,6);
   };
   label('FRUIT MEMORY',42,12);
   if(round.phase==='countdown'){
     label('เตรียมจำผลไม้',95,15);
     number(Math.max(0,Math.ceil(round.countdown||0)),169,60);
     label('เริ่มใน',240,16);label('วินาที',263,16);
   }else if(showTarget){
     label(state.phase==='collapse'?'ผลไม้ที่รอด':'วิ่งไปที่',90,17);
     if(state.phase!=='collapse')label('ผลไม้นี้',112,16);
     const img=fruitImage(state.target),size=76;
     ctx.fillStyle='#fff2c9';ctx.beginPath();ctx.arc(w/2,178,43,0,TAU);ctx.fill();
     if(img?.complete&&img.naturalWidth)ctx.drawImage(img,(w-size)/2,140,size,size);
     label(target.name,239,16);
     if(state.phase==='collapse')label('รอด '+living(players).length+' คน',287,16);
     else{number(seconds,290,44,seconds<=3?'#a62b3c':'#493153');label('วินาที',326,14);}
   }else if(state.phase==='memorize'||state.phase==='hide'){
     label('เปิดแล้ว',92,19);
     number(opened,165,62);
     label('/ '+state.tiles.length+' ช่อง',225,18);
     progress(opened);
     label(state.phase==='hide'?'เตรียมดู':'จำตำแหน่ง',302,16);
     label(state.phase==='hide'?'ผลไม้':'ให้ดี',326,16);
   }else{
     label('รอบถัดไป',99,19);
     label('เตรียมจำใหม่',175,17);
     label('ผู้รอด '+living(players).length+' คน',273,16);
   }
   ctx.restore();
 }
}
function draw(ctx,time,round,players){
 const state=round.fruitMemory;if(!state)return;
 ctx.save();ctx.clearRect(0,0,960,540);
 window.PartyArenaArt.draw(ctx,'orchard',state);
 for(const tile of state.tiles)drawTile(ctx,state,tile,time);
 for(const p of players)drawPlayer(ctx,p,state,time);
 drawSideDisplays(ctx,state,round,players);
 ctx.restore();
}
window.FruitMemory=Object.freeze({setup,update,draw,hud,generateGrid,buildRevealSchedule,memoryPace,
 calculateFootSupport,evaluateSurvivors,chooseTargetFruit,resolvePlayerCollisions,drawPlayer,drawSideDisplays,constants:C,fruitTypes:FRUITS.map(f=>f.id)});
})();
