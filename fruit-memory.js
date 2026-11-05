/* FRUIT MEMORY: host-authoritative survival game. Deliberately independent of GhostAttack/Chickens. */
(() => {
'use strict';
const TAU=Math.PI*2, FIXED=1/60;
const C=Object.freeze({speed:207,radius:13,footRadius:10,punchRange:53,windup:.15,hit:.10,recovery:.15,cooldown:1.2,stun:.55});
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
function buildRevealSchedule(tiles){
 // Random groups of 2-4; never leave one lone card for the final flip.
 const pending=shuffle(tiles.map(t=>t.tileId)),groups=[];
 while(pending.length){
   const possible=[2,3,4].filter(n=>n<=pending.length&&pending.length-n!==1);
   const count=possible[Math.floor(Math.random()*possible.length)];
   if(!count)throw Error('Cannot schedule remaining Fruit Memory cards');
   groups.push(pending.splice(0,count));
 }
 return groups;
}
function buildRevealTimeline(groups){
 let start=0;
 return groups.map(ids=>{
   // The full memorization phase has NO fixed countdown. Each batch gets
   // time to turn over, be seen, and close before the next batch starts.
   const duration=1.15+ids.length*.13+Math.random()*.33;
   const item={ids,start,end:start+duration,duration};
   start=item.end;
   return item;
 });
}
function configureBoard(state){
 const large=state.big;
 state.board={x:large?140:250,y:large?150:170,w:large?660:500,h:large?330:300};
 state.tileW=state.board.w/state.cols;state.tileH=state.board.h/state.rows;
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
 state.revealGroups=buildRevealSchedule(state.tiles);
 state.revealTimeline=buildRevealTimeline(state.revealGroups);
 state.revealCursor=0;
 state.revealDuration=state.revealTimeline.at(-1).end;
 state.target=null;state.rounds++;
 state.fallEntries=[];state.pendingWinner=null;state.botTargets={};
 for(const p of players){
   p.fruitAlive=entrants.includes(p.id)&&p.active;
   p.fruitFall=0;p.fruitStun=0;p.fruitAttack=null;p.fruitCooldown=0;p.fruitPunchPressed=false;
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
   winnerId:null,finished:false,totalElapsed:0};
 configureBoard(state);
 round.fruitMemory=state;
 for(const p of players){p.active=true;p.score=0;p.fruitRounds=0;}
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
 p.fruitAttack={elapsed:0,hitIds:new Set()};
 p.fruitCooldown=C.cooldown;
}
function resolvePunchHits(attacker,players){
 const dir=attacker.dir||{x:1,y:0},a=attacker.fruitAttack;
 if(!a)return;
 for(const target of living(players)){
   if(target===attacker||a.hitIds.has(target.id))continue;
   const dx=target.x-attacker.x,dy=target.y-attacker.y,d=Math.hypot(dx,dy);
   if(d>C.punchRange+C.radius||d<.01)continue;
   if((dx*dir.x+dy*dir.y)/d<.55)continue;
   target.fruitStun=Math.max(target.fruitStun,C.stun);
   target.fruitHitFlash=.45;a.hitIds.add(target.id);
 }
}
function stepPlayer(p,state,players,dt){
 if(!p.active||!p.fruitAlive)return;
 p.fruitCooldown=Math.max(0,(p.fruitCooldown||0)-dt);
 p.fruitStun=Math.max(0,(p.fruitStun||0)-dt);
 p.fruitHitFlash=Math.max(0,(p.fruitHitFlash||0)-dt);
 const input=p.input||{},pressed=!!input.action;
 if(pressed&&!p.fruitPunchPressed&&p.fruitCooldown<=0&&p.fruitStun<=0&&!p.fruitAttack)
   startPunch(p);
 p.fruitPunchPressed=pressed;
 if(p.fruitAttack){
   const before=p.fruitAttack.elapsed;
   p.fruitAttack.elapsed+=dt;
   if(before<C.windup&&p.fruitAttack.elapsed>=C.windup)resolvePunchHits(p,players);
   if(p.fruitAttack.elapsed>=C.windup+C.hit+C.recovery)p.fruitAttack=null;
 }
 const motion=p.isBot?botVector(p,state):inputVector(input);
 if(Math.hypot(motion.x,motion.y)>.14&&!p.fruitAttack&&p.fruitStun<=0)p.dir={x:motion.x,y:motion.y};
 const allowed=(state.phase==='memorize'||state.phase==='move');
 const canWalk=allowed&&!p.fruitAttack&&p.fruitStun<=0;
 p.vx=canWalk?motion.x*C.speed:0;p.vy=canWalk?motion.y*C.speed:0;
 p.x+=p.vx*dt;p.y+=p.vy*dt;
 const b=state.board;
 p.x=clamp(p.x,b.x+C.radius,b.x+b.w-C.radius);
 p.y=clamp(p.y,b.y+C.radius,b.y+b.h-C.radius);
}
function resolvePlayerCollisions(state,players){
 const ps=living(players),b=state.board,r=C.radius;
 // Symmetric pair corrections, multiple iterations for crowded 12-person lobbies.
 for(let pass=0;pass<8;pass++)for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){
   const a=ps[i],c=ps[j];let dx=c.x-a.x,dy=c.y-a.y;
   let d=Math.hypot(dx,dy);
   if(d>=2*r-1e-6)continue;
   if(d<1e-5){const angle=(i*29+j*17)*1.618;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
   const push=(2*r-d)/2,nx=dx/d,ny=dy/d;
   a.x-=nx*push;a.y-=ny*push;c.x+=nx*push;c.y+=ny*push;
   for(const p of [a,c]){
     p.x=clamp(p.x,b.x+r,b.x+b.w-r);p.y=clamp(p.y,b.y+r,b.y+b.h-r);
   }
 }
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
 if(!survivors.size){
   // True simultaneous wipe: replay the tie-break only among this round's entrants.
   state.replayEntrants=entrants.map(p=>p.id);state.pendingWinner=null;
 }else{
   state.replayEntrants=null;
   for(const p of entrants){
     p.fruitAlive=survivors.has(p.id);
     if(p.fruitAlive){p.fruitRounds++;p.score=p.fruitRounds;}
   }
   const remaining=living(players);
   state.pendingWinner=remaining.length===1?remaining[0].id:null;
 }
 for(const t of state.tiles)t.collapseState=t.fruitType===state.target?'safe':'falling';
 setPhase(state,'collapse');
}
function step(state,players,dt){
 state.totalElapsed+=dt;
 if(!living(players).length){state.winnerId=null;state.finished=true;return;}
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
     const entrants=state.replayEntrants||living(players).map(p=>p.id);
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
 ctx.shadowColor='#000a';ctx.shadowBlur=8;ctx.shadowOffsetY=7;
 ctx.fillStyle=revealed?'#fff2d6':'#244563';
 if(collapsing&&correct)ctx.fillStyle='#438e77';
 ctx.fillRect(-w/2,-h/2,w,h);ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 ctx.strokeStyle=revealed?'#dfc68b':'#6189a8';ctx.lineWidth=2;
 ctx.strokeRect(-w/2,-h/2,w,h);
 if(revealed&&flipping>.56){
   const icon=fruitImage(t.fruitType);
   const size=Math.min(w*.55,h*.70,70);
   if(icon?.complete&&icon.naturalWidth>0)ctx.drawImage(icon,-size/2,-size/2,size,size);
   else{
     ctx.fillStyle=FRUIT_BY_ID[t.fruitType].color;
     ctx.beginPath();ctx.arc(0,0,size*.28,0,TAU);ctx.fill();
   }
 }else if(!revealed){
   ctx.fillStyle='#46718e';ctx.globalAlpha*=.8;
   ctx.beginPath();ctx.arc(0,0,Math.min(w,h)*.12,0,TAU);ctx.fill();
 }
 if(collapsing&&correct){
   ctx.strokeStyle='#83ffba';ctx.lineWidth=3;ctx.strokeRect(-w/2+2,-h/2+2,w-4,h-4);
 }
 ctx.restore();
}
function drawPlayer(ctx,p,state,time){
 if(!p.active||(!p.fruitAlive&&state.phase!=='collapse'))return;
 const entry=state.fallEntries.find(e=>e.id===p.id);
 const falling=state.phase==='collapse'&&entry&&!entry.survive;
 // A simultaneous wipe replays on the SAME positions: rise back with the
 // floor instead of abruptly disappearing and respawning elsewhere.
 const rising=state.phase==='rebuild'&&state.replayEntrants?.includes(p.id)&&
   entry&&!entry.survive;
 const progress=falling?clamp((state.elapsed-.15)/(state.collapseSeconds-.15),0,1):
   rising?1-clamp(state.elapsed/.85,0,1):0;
 if((falling||rising)&&progress>=1)return;
 ctx.save();ctx.translate(p.x,p.y+progress*180);
 ctx.globalAlpha=1-progress*.85;ctx.scale(1-progress*.65,1-progress*.65);
 const direction=p.dir||{x:1,y:0};
 ctx.fillStyle='#00152580';ctx.beginPath();ctx.ellipse(0,0,C.footRadius,5,0,0,TAU);ctx.fill();
 ctx.fillStyle=p.fruitHitFlash>0?'#ffe86b':p.color;
 ctx.strokeStyle=p.fruitStun>0?'#ffe88b':p.color;
 ctx.lineWidth=5;ctx.lineCap='round';
 const walking=Math.sin(time*13)*Math.min(3,Math.hypot(p.vx||0,p.vy||0)/C.speed*3);
 ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(0,13);
 ctx.moveTo(0,9);ctx.lineTo(-9,19+walking);
 ctx.moveTo(0,9);ctx.lineTo(10,19-walking);
 if(p.fruitAttack){ctx.moveTo(0,-3);ctx.lineTo(direction.x*25, -6+direction.y*20);}
 else{ctx.moveTo(0,-3);ctx.lineTo(-12,5);ctx.moveTo(0,-3);ctx.lineTo(11,5);}
 ctx.stroke();
 ctx.beginPath();ctx.arc(0,-16,10,0,TAU);ctx.fill();
 ctx.lineWidth=2;ctx.strokeStyle='#172337';ctx.stroke();
 if(p.fruitStun>0){ctx.fillStyle='#ffe477';for(let a=0;a<3;a++){
   const x=Math.cos(time*9+a*TAU/3)*17,y=-27+Math.sin(time*9+a*TAU/3)*6;
   ctx.beginPath();ctx.arc(x,y,3,0,TAU);ctx.fill();
 }}
 ctx.font='bold 12px system-ui,sans-serif';ctx.textAlign='center';
 ctx.lineWidth=3;ctx.strokeStyle='#122437';ctx.fillStyle='#fff';
 ctx.strokeText(p.name||'',0,-31);ctx.fillText(p.name||'',0,-31);
 ctx.restore();
}
function draw(ctx,time,round,players){
 const state=round.fruitMemory;if(!state)return;
 ctx.save();ctx.clearRect(0,0,960,540);
 const bg=ctx.createLinearGradient?.(0,0,0,540);
 if(bg){bg.addColorStop(0,'#0c2135');bg.addColorStop(1,'#20455e');ctx.fillStyle=bg;}
 else ctx.fillStyle='#17364f';
 ctx.fillRect(0,0,960,540);
 const b=state.board;
 ctx.fillStyle='#07192a';ctx.fillRect(b.x-10,b.y-10,b.w+20,b.h+20);
 ctx.strokeStyle='#5e91ab';ctx.lineWidth=3;ctx.strokeRect(b.x-10,b.y-10,b.w+20,b.h+20);
 for(const tile of state.tiles)drawTile(ctx,state,tile,time);
 for(const p of players)drawPlayer(ctx,p,state,time);
 // Compact HUD above the playfield; never overlaps the grid.
 ctx.fillStyle='#102e44';ctx.fillRect(16,30,250,42);
 ctx.strokeStyle='#5d8da6';ctx.lineWidth=1.4;ctx.strokeRect(16,30,250,42);
 ctx.textAlign='left';ctx.fillStyle='#fff';ctx.font='bold 13px system-ui,sans-serif';
 ctx.fillText('FRUIT MEMORY',27,47);
 ctx.font='bold 13px system-ui,sans-serif';
 const phase=round.phase==='countdown'?'เริ่มใน '+Math.ceil(round.countdown)+' วิ':
   state.phase==='memorize'?'จำผลไม้ • '+state.revealedTileIds.size+'/'+state.tiles.length+' ช่อง':
   state.phase==='hide'?'คว่ำบล็อกทั้งหมด':
   state.phase==='target'||state.phase==='move'?'ไปที่ '+FRUIT_BY_ID[state.target].name+' • '+(state.phase==='move'?Math.ceil(Math.max(0,state.moveSeconds-state.elapsed)):'เตรียมตัว')+' วิ':
   state.phase==='collapse'?'รอด '+(state.replayEntrants?'0':living(players).length)+' คน':
   'เตรียมรอบถัดไป';
 ctx.fillStyle=state.phase==='move'&&state.moveSeconds-state.elapsed<3?'#ffcd77':'#b7f4d3';
 ctx.fillText(phase,27,64,(state.phase==='target'||state.phase==='move')?190:222);
 if((state.phase==='target'||state.phase==='move')&&state.target){
   const img=fruitImage(state.target);if(img?.complete&&img.naturalWidth)
     ctx.drawImage(img,226,40,22,22);
 }
 ctx.restore();
}
window.FruitMemory=Object.freeze({setup,update,draw,hud,generateGrid,buildRevealSchedule,
 calculateFootSupport,evaluateSurvivors,chooseTargetFruit,resolvePlayerCollisions,constants:C,fruitTypes:FRUITS.map(f=>f.id)});
})();