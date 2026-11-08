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
function generateGrid(count,selected,previous=[]){
 const cols=count<=6?4:5,kindsCount=cols;
 const kinds=selected||shuffle(FRUITS.map(f=>f.id)).slice(0,kindsCount);
 // Every variety occurs at least cols-1 times. The extra cols cards
 // are independently assigned across the selected varieties, not evenly split.
 const positions=shuffle(Array.from({length:cols*cols},(_,i)=>i));
 const remaining=Object.fromEntries(kinds.map(id=>[id,cols-1]));
 for(let i=0;i<cols;i++)remaining[kinds[Math.floor(Math.random()*kinds.length)]]++;
 const assigned=Array(cols*cols);
 function fill(index){
   if(index===positions.length)return true;
   const pos=positions[index];
   const options=shuffle(kinds.filter(id=>remaining[id]>0&&id!==previous[pos]))
     .sort((a,b)=>remaining[b]-remaining[a]);
   for(const id of options){
     remaining[id]--;assigned[pos]=id;
     if(fill(index+1))return true;
     remaining[id]++;
   }
   return false;
 }
 if(!fill(0))throw Error('Unable to generate a non-repeating Fruit Memory layout');
 return assigned.map((fruitType,i)=>({tileId:i,row:Math.floor(i/cols),column:i%cols,
   fruitType,revealState:'closed',collapseState:'solid',fall:0}));
}
function buildRevealSchedule(tiles,cardsPerBatch,previous=[]){
 const ids=tiles.map(t=>t.tileId),count=cardsPerBatch,groupCount=4;
 if(!Number.isInteger(count)||count<1||count>ids.length)throw Error('Invalid reveal batch size');
 for(let attempt=0;attempt<12;attempt++){
   const unseen=new Set(ids),groups=[];
   for(let group=0;group<groupCount;group++){
     const remainingGroups=groupCount-group;
     const required=Math.max(0,unseen.size-(remainingGroups-1)*count);
     const fresh=group===0?count:Math.min(count,Math.max(required,Math.ceil(unseen.size/remainingGroups)));
     const picked=shuffle([...unseen]).slice(0,fresh);
     for(const id of picked)unseen.delete(id);
     const extras=shuffle(ids.filter(id=>!picked.includes(id))).slice(0,count-picked.length);
     groups.push(shuffle([...picked,...extras]));
   }
   if(unseen.size)throw Error('Not every Fruit Memory card was scheduled');
   if(groups.some(batch=>batch.length!==count||new Set(batch).size!==count))
     throw Error('Invalid Fruit Memory reveal batch');
   if(groups.map(g=>g.join(',')).join('|')!==previous.map(g=>g.join(',')).join('|'))return groups;
 }
 throw Error('Cannot create a fresh Fruit Memory reveal pattern');
}
function memoryPace(roundNumber,large){
 const wave=Math.max(1,Math.floor(Number(roundNumber)||1));
 const memorizeSeconds=[13,11,9,6,4,2][Math.min(5,wave-1)];
 const moveSeconds=large?Math.max(3.5,7-.5*Math.max(0,wave-6)):
   Math.max(2.5,5-.5*Math.max(0,wave-6));
 return {memorizeSeconds,revealFactor:memorizeSeconds/13,moveSeconds};
}
function buildRevealTimeline(groups,memorizeSeconds){
 // Wave 1: 13 seconds / 4 reveals = ~3.25 seconds per reveal.
 // The same four-batch plan compresses into later memorization windows.
 const each=memorizeSeconds/groups.length;
 return groups.map((ids,i)=>({ids,start:i*each,end:(i+1)*each,duration:each}));
}
function configureBoard(state){
 // Square play field, with room for two fully visible side screens.
 const side=400;
 state.board={x:(960-side)/2,y:104,w:side,h:side};
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
 const kinds=pickFruitKinds(state);
 const previous=firstRound?[]:state.tiles.map(t=>t.fruitType);
 const generated=generateGrid(state.startCount,kinds,previous);
 if(firstRound){
   state.tiles=generated;
   state.revealCount=state.big?(Math.random()<.5?10:11):(Math.random()<.5?8:9);
 }else{
   for(let i=0;i<state.tiles.length;i++){
     const tile=state.tiles[i];
     tile.fruitType=generated[i].fruitType;
     tile.revealState='closed';tile.collapseState='solid';tile.fall=0;
   }
 }
 state.activeFruitKinds=kinds;
 state.revealedTileIds=new Set();
 state.revealGroups=buildRevealSchedule(state.tiles,state.revealCount,state.previousRevealGroups||[]);
 state.previousRevealGroups=state.revealGroups.map(group=>[...group]);
 const nextRound=state.rounds+1,pace=memoryPace(nextRound,state.big);
 state.revealFactor=pace.revealFactor;state.memorizeSeconds=pace.memorizeSeconds;
 state.moveSeconds=pace.moveSeconds;
 state.revealTimeline=buildRevealTimeline(state.revealGroups,pace.memorizeSeconds);
 state.revealCursor=0;state.revealDuration=pace.memorizeSeconds;
 state.target=null;state.rounds=nextRound;
 state.fallEntries=[];state.pendingWinner=null;state.botTargets={};state.botMemories={};
 state.botRoamTargets={};
 state.pendingTie=false;state.tieIds=[];
 for(const p of players){
   p.fruitAlive=entrants.includes(p.id)&&p.active;
   p.fruitFall=0;p.fruitStun=0;p.fruitAttack=null;p.fruitCooldown=0;p.fruitPunchPressed=false;
   p.stun=0;p.punchCooldown=0;Combat.reset(p);
   if(p.isBot&&p.fruitAlive)state.botMemories[p.id]={};
 }
 const active=living(players);
 if(firstRound){
   // Spawn only once; survivors never teleport between waves.
   const spawns=shuffle(state.tiles);
   for(let i=0;i<active.length;i++){
     const p=active[i],tile=spawns[i];
     p.x=state.board.x+(tile.column+.5)*state.tileW;
     p.y=state.board.y+(tile.row+.5)*state.tileH;
     p.dir={x:1,y:0};p.vx=0;p.vy=0;
   }
 }else for(const p of active){p.vx=0;p.vy=0;}
 state.previousEntrants=[...entrants];
 setPhase(state,'memorize');
}
function pickFruitKinds(state){
 const length=state.big?5:4,all=FRUITS.map(f=>f.id);
 const previous=state.activeFruitKinds||[];
 for(let tries=0;tries<100;tries++){
   const kinds=shuffle(all).slice(0,length);
   if(state.firstFruitKinds&&kinds.every(id=>state.firstFruitKinds.includes(id)))continue;
   if(previous.length&&kinds.every(id=>previous.includes(id)))continue;
   if(!state.firstFruitKinds)state.firstFruitKinds=[...kinds];
   return kinds;
 }
 throw Error('Fruit Memory cannot select a fresh fruit set');
}
function setup(round,players){
 const startCount=clamp(players.length,1,12);
 const large=startCount>6;
 const state={startCount,big:large,cols:large?5:4,rows:large?5:4,
   moveSeconds:large?7:5,collapseSeconds:large?1.8:1.5,
   tiles:[],elapsed:0,accumulator:0,rounds:0,phase:'memorize',previousTarget:null,
   winnerId:null,finished:false,totalElapsed:0,pendingTie:false,tieIds:[],firstTarget:null,targetHistory:[]};
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
 const eligible=ids.filter(id=>id!==state.previousTarget&&id!==state.firstTarget);
 const unused=eligible.filter(id=>!state.targetHistory.includes(id));
 const candidates=unused.length?unused:eligible;
 state.target=shuffle(candidates.length?candidates:ids)[0];
 if(!state.firstTarget)state.firstTarget=state.target;
 state.previousTarget=state.target;
 state.targetHistory.push(state.target);
 state.botTargets={};
}
function botWanderVector(p,state){
 // Bots move naturally during the shared 3-second start countdown and card
 // memorization. They have no information about hidden fruit or the target.
 const goals=state.botRoamTargets||(state.botRoamTargets={});
 const now=state.totalElapsed;
 let goal=goals[p.id];
 if(!goal||now>=goal.until||Math.hypot(goal.x-p.x,goal.y-p.y)<12){
   const spots=state.tiles.map(t=>({
     x:state.board.x+(t.column+.5)*state.tileW,
     y:state.board.y+(t.row+.5)*state.tileH
   }));
   const choices=spots.filter(q=>{
     const d=Math.hypot(q.x-p.x,q.y-p.y);
     return d>state.tileW*.8&&d<state.board.w*.78;
   });
   const pool=choices.length?choices:spots;
   if(!pool.length)return {x:0,y:0};
   const q=pool[Math.floor(Math.random()*pool.length)];
   const d=Math.hypot(q.x-p.x,q.y-p.y);
   goal={x:q.x,y:q.y,until:now+Math.max(1.1,d/C.speed)+.35+Math.random()*.45};
   goals[p.id]=goal;
 }
 const dx=goal.x-p.x,dy=goal.y-p.y,d=Math.hypot(dx,dy);
 return d<6?{x:0,y:0}:{x:dx/d,y:dy/d};
}
function botVector(p,state){
 if(state.phase==='memorize')return botWanderVector(p,state);
 if(state.phase!=='move'||!state.target)return {x:0,y:0};
 if(!state.botTargets[p.id]){
   // Only cards shown in completed reveal batches enter bot memory.
   const memory=state.botMemories[p.id]||{};
   let options=state.tiles.filter(t=>memory[t.tileId]===state.target);
   if(!options.length){
     const remembered=state.tiles.filter(t=>Object.hasOwn(memory,t.tileId));
     options=remembered.length?remembered:state.tiles;
   }
   const targets=options.map(t=>({t,x:tileRect(state,t).x+state.tileW*.5,
     y:tileRect(state,t).y+state.tileH*.5})).sort((a,b)=>
     Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
   state.botTargets[p.id]=targets[Math.floor(Math.random()*Math.min(3,targets.length))]||targets[0];
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
     for(const id of batch.ids){
       state.revealedTileIds.add(id);
       for(const p of players)if(p.fruitAlive&&p.isBot){
         const memory=state.botMemories[p.id];if(!memory)continue;
         const actual=state.tiles[id].fruitType;
         const accuracy=clamp(.94-.045*(state.rounds-1),.56,.94);
         memory[id]=Math.random()<accuracy?actual:
           shuffle(state.activeFruitKinds.filter(f=>f!==actual))[0];
       }
     }
   }
   if(state.revealCursor===state.revealTimeline.length&&
      state.revealedTileIds.size===state.tiles.length)setPhase(state,'hide');
 }else if(state.phase==='hide'){
   state.elapsed+=dt;if(state.elapsed>=.16){chooseTargetFruit(state);setPhase(state,'target');}
 }else if(state.phase==='target'){
   state.elapsed+=dt;if(state.elapsed>=.28)setPhase(state,'move');
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
 if(round.paused||!['countdown','playing'].includes(round.phase))return null;
 state.accumulator=Math.min(.15,state.accumulator+clamp(dt,0,.1));
 while(state.accumulator>=FIXED&&!state.finished){
   if(round.phase==='countdown'){
     // Pre-game is free movement, not memorization: don't advance the reveal
     // clock, target selection, wave number or bot observations.
     state.totalElapsed+=FIXED;
     for(const p of players)stepPlayer(p,state,players,FIXED);
     resolvePlayerCollisions(state,players);
   }else step(state,players,FIXED);
   state.accumulator-=FIXED;
 }
 round.remaining=null; // Fruit Memory uses side-screen memorization countdown only.
 return state.finished?'winner':null;
}
function hud(players,round){
 const state=round.fruitMemory;
 return {survivors:living(players).length,remaining:null,
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
     const flip=Math.min(.12,batch.duration*.14);
     revealed=batch.ids.includes(t.tileId)&&within>=flip&&within<=batch.duration-flip;
     if(revealed){
       const edge=Math.min(within-flip,batch.duration-flip-within);
       flipping=clamp(edge/Math.max(.03,flip),0,1);
     }
   }
 }else if(collapsing)revealed=true;
 const yOffset=fallProgress*220,alpha=(falling||rebuilding)?1-fallProgress*.85:1;
 ctx.save();ctx.globalAlpha=alpha;ctx.translate(r.x+r.w/2,r.y+r.h/2+yOffset);
 if(falling||rebuilding){ctx.rotate(fallProgress*.12*(t.column%2?1:-1));ctx.scale(1-fallProgress*.19,1-fallProgress*.19);}
 const w=(r.w-pad*2)*(revealed?Math.max(.06,flipping):1),h=r.h-pad*2;
 // Only revealed cards get fruit-specific colors. Hidden cards remain identical.
 const face=revealed?TILE_COLORS[t.fruitType]:'#68648d';
 ctx.shadowColor='#174d1c77';ctx.shadowBlur=10;ctx.shadowOffsetY=7;
 ctx.fillStyle='#302e4f';ctx.beginPath();ctx.roundRect(-w/2,-h/2+5,w,h,8);ctx.fill();
 ctx.shadowBlur=0;ctx.shadowOffsetY=0;
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

const panelCache={};
function screenImage(tint){
 if(panelCache[tint])return panelCache[tint];
 if(typeof Image==='undefined')return null;
 const warm=tint==='timer',light=warm?'#ffe456':(TILE_COLORS[tint]||'#76e8e3');
 const mid=warm?'#ff982e':(FRUIT_BY_ID[tint]?.color||'#23cdea');
 const svg=[
 '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 440">',
 '<defs><linearGradient id="metal"><stop stop-color="#3b2676"/><stop offset=".3" stop-color="#bb7ef2"/><stop offset=".65" stop-color="#683ca8"/><stop offset="1" stop-color="#301e72"/></linearGradient>',
 '<linearGradient id="glass" x2=".85" y2="1"><stop stop-color="'+light+'"/><stop offset=".48" stop-color="'+mid+'"/><stop offset="1" stop-color="'+light+'"/></linearGradient>',
 '<linearGradient id="shine" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".55"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>',
 '<ellipse cx="76" cy="426" rx="65" ry="10" fill="#1a5b22" opacity=".3"/>',
 '<rect x="31" y="41" width="16" height="361" rx="7" fill="url(#metal)" stroke="#42277e" stroke-width="3"/>',
 '<rect x="103" y="41" width="16" height="361" rx="7" fill="url(#metal)" stroke="#42277e" stroke-width="3"/>',
 '<g fill="none" stroke="#dbffe8" stroke-width="4"><path d="M28 55q-25 14 0 28t0 28t0 28M122 55q25 14 0 28t0 28t0 28"/>',
 '<path d="M28 306q-25 14 0 28t0 28t0 28M122 306q25 14 0 28t0 28t0 28"/></g>',
 '<rect x="22" y="29" width="106" height="381" rx="17" fill="#311c72" stroke="#bd8cf3" stroke-width="6"/>',
 '<rect x="28" y="36" width="94" height="365" rx="12" fill="url(#metal)" stroke="#e7b8ff" stroke-width="2"/>',
 '<rect x="8" y="111" width="21" height="219" rx="6" fill="#f59c3d" stroke="#a25180" stroke-width="4"/>',
 '<rect x="121" y="111" width="21" height="219" rx="6" fill="#f59c3d" stroke="#a25180" stroke-width="4"/>',
 '<rect x="34" y="69" width="82" height="307" rx="7" fill="#261d5a" stroke="#281463" stroke-width="6"/>',
 '<rect x="41" y="78" width="68" height="287" rx="3" fill="url(#glass)" stroke="#ffe1a0" stroke-width="2"/>',
 '<rect x="41" y="78" width="68" height="287" rx="3" fill="url(#shine)"/>',
 '<g opacity=".18" stroke="#fff" stroke-width="2"><path d="M42 128 109 195M42 210l67 67M42 293l67 67"/></g>',
 '<g fill="#fffaab" stroke="#79538c" stroke-width="3"><circle cx="20" cy="155" r="5"/><circle cx="20" cy="183" r="5"/><circle cx="131" cy="272" r="5"/><circle cx="131" cy="299" r="5"/></g>',
 '<rect x="34" y="65" width="82" height="13" rx="5" fill="#ae7af0" stroke="#58349b" stroke-width="2"/>',
 '<rect x="34" y="366" width="82" height="13" rx="5" fill="#ae7af0" stroke="#58349b" stroke-width="2"/>',
 '<g transform="rotate(-7 75 29)"><rect x="41" y="9" width="68" height="39" rx="18" fill="#392276" stroke="#ae74e5" stroke-width="5"/>',
 '<rect x="46" y="15" width="58" height="26" rx="13" fill="'+(warm?'#f3ce3c':'#2dc4f4')+'" stroke="#fff0a8" stroke-width="2"/></g>',
 '<g transform="rotate(7 75 411)"><rect x="41" y="393" width="68" height="39" rx="18" fill="#392276" stroke="#ae74e5" stroke-width="5"/>',
 '<rect x="46" y="399" width="58" height="26" rx="13" fill="'+(warm?'#eb4d51':'#50d869')+'" stroke="#fff0a8" stroke-width="2"/></g>',
 '</svg>'
 ].join('');
 const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
 panelCache[tint]=img;return img;
}
function drawSideScreens(ctx,state,round){
 // Keep both SVG monitor housings visible from the first countdown frame.
 // The orange screens stay blank until the shared host countdown ends;
 // only then does the independent memorize timer begin displaying numbers.
 const prestart=round?.phase==='countdown';
 const target=!prestart&&['target','move','collapse'].includes(state.phase)&&!!state.target;
 const img=screenImage(target?state.target:'timer');
 const seconds=String(Math.max(1,Math.ceil(state.memorizeSeconds-state.elapsed)));
 for(const right of [false,true]){
   const x=right?686:124,y=64;
   ctx.save();ctx.translate(x+(right?150:0),y);
   if(right)ctx.scale(-1,1);
   if(img?.complete&&img.naturalWidth>0)ctx.drawImage(img,0,0,150,440);
   ctx.restore();
   if(prestart||(state.phase!=='memorize'&&!target))continue;
   ctx.save();ctx.translate(x+75,y+221);ctx.rotate(right?Math.PI/2:-Math.PI/2);
   if(target){
     const fruitImg=fruitImage(state.target),fruit=FRUIT_BY_ID[state.target];
     if(fruitImg?.complete&&fruitImg.naturalWidth>0)ctx.drawImage(fruitImg,-46,-46,92,92);
     else if(fruit){ctx.fillStyle=fruit.color;ctx.beginPath();ctx.arc(0,0,33,0,TAU);ctx.fill();}
   }else{
     ctx.font='900 76px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
     ctx.lineWidth=5;ctx.strokeStyle='#e09128';if(ctx.strokeText)ctx.strokeText(seconds,0,2);
     ctx.fillStyle='#fff';ctx.fillText(seconds,0,0);
   }
   ctx.restore();
 }
}
function draw(ctx,time,round,players){
 const state=round.fruitMemory;if(!state)return;
 ctx.save();ctx.clearRect(0,0,960,540);
 window.PartyArenaArt.draw(ctx,'orchard',state);
 drawSideScreens(ctx,state,round);
 for(const tile of state.tiles)drawTile(ctx,state,tile,time);
 for(const p of players)drawPlayer(ctx,p,state,time);
 ctx.restore();
}
window.FruitMemory=Object.freeze({setup,update,draw,hud,generateGrid,buildRevealSchedule,memoryPace,
 calculateFootSupport,evaluateSurvivors,chooseTargetFruit,resolvePlayerCollisions,drawPlayer,drawSideScreens,constants:C,fruitTypes:FRUITS.map(f=>f.id)});
})();
