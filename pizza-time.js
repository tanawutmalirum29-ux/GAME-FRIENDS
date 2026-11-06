/* PIZZA TIME — host-authoritative two-trip cooking race. */
(() => {
'use strict';
const TAU=Math.PI*2, STEP=1/60;
const INGREDIENTS=Object.freeze([
 {id:'tomato',name:'มะเขือเทศ',color:'#ec4c42'},
 {id:'cheese',name:'ชีส',color:'#f5c545'},
 {id:'mushroom',name:'เห็ด',color:'#dec7aa'},
 {id:'pepperoni',name:'เปปเปอโรนี',color:'#ca6052'},
 {id:'pepper',name:'พริกหวาน',color:'#58bd70'},
 {id:'onion',name:'หัวหอม',color:'#d8aaef'},
 {id:'pineapple',name:'สับปะรด',color:'#efdb60'},
 {id:'basil',name:'ใบโหระพา',color:'#4fbf6d'}
]);
const byId=Object.fromEntries(INGREDIENTS.map(x=>[x.id,x]));
const bound=(x,a,b)=>Math.max(a,Math.min(b,x));
const hyp=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const active=ps=>ps.filter(p=>p.active);
function random(s){let n=s.seed|0;n^=n<<13;n^=n>>>17;n^=n<<5;s.seed=n||1234567;return (s.seed>>>0)/4294967296;}
const worldSize=n=>n<=3?{w:960,h:540}:n<=6?{w:1200,h:675}:n<=9?{w:1440,h:810}:{w:1600,h:900};
// Physical worktops contain exactly two ingredient slots each.
const tableCount=n=>n<=4?2:n<=6?3:n<=9?4:5;
const dims=s=>({w:s.world.w,h:s.world.h});
function tableLayout(s){
 const count=tableCount(s.players);
 // Larger maps repeat ingredient types across DIFFERENT counters. Each of
 // the two slots on the same physical worktop must always differ.
 const kinds=Array.from({length:count*2},(_,i)=>INGREDIENTS[i%INGREDIENTS.length].id);
 for(let i=kinds.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[kinds[i],kinds[j]]=[kinds[j],kinds[i]];}
 for(let i=0;i<kinds.length;i+=2)if(kinds[i]===kinds[i+1]){
   const swapAt=kinds.findIndex((id,j)=>j!==i&&j!==i+1&&id!==kinds[i]&&
     (j%2===0?kinds[j+1]!==kinds[i+1]:kinds[j-1]!==kinds[i]));
   if(swapAt>=0)[kinds[i+1],kinds[swapAt]]=[kinds[swapAt],kinds[i+1]];
 }
 if(kinds.some((id,i)=>!id||(i%2===0&&id===kinds[i+1])))
   throw Error('PIZZA TIME could not create two distinct ingredients per worktop');
 const locations=[];
 if(count<=3){
   for(let i=0;i<count;i++)locations.push({
     x:s.center.x+(i-(count-1)/2)*Math.min(185,s.world.w*.152),y:s.center.y
   });
 }else{
   const top=Math.ceil(count/2),bottom=count-top;
   for(let row=0;row<2;row++){
     const n=row===0?top:bottom;
     for(let i=0;i<n;i++)locations.push({
       x:s.center.x+(i-(n-1)/2)*Math.min(225,s.world.w*.18),
       y:s.center.y+(row===0?-s.world.h*.13:s.world.h*.13)
     });
   }
 }
 s.worktops=locations.map((pos,i)=>({
   id:i,x:pos.x,y:pos.y,halfW:56,halfH:43
 }));
 // Ingredient illustrations sit ON the counter. Pickup pads are directly
 // above/below that SAME counter, reachable without walking through furniture.
 s.tables=[];
 for(const w of s.worktops)for(let slot=0;slot<2;slot++){
   const ingredient=kinds[w.id*2+slot];
   s.tables.push({
     id:w.id*2+slot,worktopId:w.id,ingredient,
     x:w.x+(slot===0?-25:25),y:w.y,
     pick:{x:w.x+(slot===0?-25:25),y:w.y+(slot===0?-71:71)}
   });
 }
}
function stationLayout(s,ps){
 const n=ps.length;
 // Four chefs occupy the four reference corners. Larger lobbies distribute
 // one PERSONAL chef station per player across the upper/lower boundary.
 let positions=[];
 if(n<=4){
   const slots=[
     {x:.155,y:.165},{x:.845,y:.165},
     {x:.155,y:.835},{x:.845,y:.835}
   ];
   const order=n===1?[0]:n===2?[0,3]:n===3?[0,1,2]:[0,1,2,3];
   positions=order.map(i=>slots[i]);
 }else{
   // More than four: create small personal-chef clusters around the SAME four
   // corners, rather than advantaging middle-edge stations.
   const corners=[
     {x:.155,y:.165},{x:.845,y:.165},
     {x:.155,y:.835},{x:.845,y:.835}
   ];
   const counts=[0,0,0,0],placed=[0,0,0,0];
   for(let i=0;i<n;i++)counts[i%4]++;
   for(let i=0;i<n;i++){
     const corner=i%4,q=corners[corner],index=placed[corner]++;
     positions.push({x:q.x+(index-(counts[corner]-1)/2)*.09,y:q.y});
   }
 }
 s.chefs=ps.map((p,i)=>{
   const q=positions[i],x=q.x*s.world.w,y=q.y*s.world.h;
   const dx=s.center.x-x,dy=s.center.y-y;
   const magnitude=Math.hypot(dx,dy)||1,ux=dx/magnitude,uy=dy/magnitude;
   const deliver={x:x+ux*55,y:y+uy*55};
   const spawn={x:x+ux*78,y:y+uy*78};
   return {id:i,ownerId:p.id,color:p.color,x,y,deliver,spawn,
     bubbleX:x+(q.x<.5?76:-76),bubbleY:y-(q.y<.5?8:-8),facing:{x:ux,y:uy}};
 });
 s.chefById=new Map(s.chefs.map(c=>[c.ownerId,c]));
}
function blocked(s,x,y,r=14){
 if(x<24+r||y<24+r||x>s.world.w-24-r||y>s.world.h-24-r)return true;
 return s.worktops.some(t=>Math.abs(x-t.x)<t.halfW+r&&Math.abs(y-t.y)<t.halfH+r);
}
function grid(s){
 const cell=27,cols=Math.ceil(s.world.w/cell),rows=Math.ceil(s.world.h/cell);
 s.nav={cell,cols,rows};
 s.passable=new Uint8Array(cols*rows);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)
   s.passable[y*cols+x]=blocked(s,(x+.5)*cell,(y+.5)*cell,15)?0:1;
}
function navNode(s,pos){
 const {cell,cols,rows}=s.nav;
 const x=bound(Math.floor(pos.x/cell),0,cols-1),y=bound(Math.floor(pos.y/cell),0,rows-1);
 if(s.passable[y*cols+x])return y*cols+x;
 // Pickup pads and live player coordinates can land near cell borders.
 for(let radius=1;radius<=4;radius++)for(let dy=-radius;dy<=radius;dy++)
  for(let dx=-radius;dx<=radius;dx++){
   const nx=x+dx,ny=y+dy;
   if(nx>=0&&ny>=0&&nx<cols&&ny<rows&&s.passable[ny*cols+nx])return ny*cols+nx;
  }
 return y*cols+x;
}
function navPoint(s,node){
 return {x:(node%s.nav.cols+.5)*s.nav.cell,
 y:(Math.floor(node/s.nav.cols)+.5)*s.nav.cell};
}
function aStar(s,a,b,needPath=false){
 const start=navNode(s,a),end=navNode(s,b),{cols,rows,cell}=s.nav;
 if(start===end)return {distance:hyp(a,b),points:needPath?[b]:[]};
 const n=cols*rows,g=new Float64Array(n),f=new Float64Array(n),prev=new Int32Array(n),seen=new Uint8Array(n),open=[start];
 g.fill(Infinity);f.fill(Infinity);prev.fill(-1);g[start]=0;
 const heuristic=(i)=>Math.hypot((i%cols)-(end%cols),Math.floor(i/cols)-Math.floor(end/cols))*cell;
 f[start]=heuristic(start);
 let loops=0;
 while(open.length&&loops++<n){
  let best=0;
  for(let k=1;k<open.length;k++)if(f[open[k]]<f[open[best]])best=k;
  const cur=open.splice(best,1)[0];
  if(cur===end){
    const path=[];let node=end;
    if(needPath){while(node!==start&&node!==-1){path.push(navPoint(s,node));node=prev[node]}path.reverse();path.push(b);}
    return {distance:g[end]+hyp(a,navPoint(s,start))+hyp(b,navPoint(s,end)),points:path};
  }
  if(seen[cur])continue;seen[cur]=1;
  const cx=cur%cols,cy=Math.floor(cur/cols);
  for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++){
    if(!xx&&!yy)continue;
    const nx=cx+xx,ny=cy+yy;
    if(nx<0||ny<0||nx>=cols||ny>=rows)continue;
    const next=ny*cols+nx;if(!s.passable[next]||seen[next])continue;
    if(xx&&yy&&(!s.passable[cy*cols+nx]||!s.passable[ny*cols+cx]))continue;
    const cost=g[cur]+(xx&&yy?Math.SQRT2:1)*cell;
    if(cost>=g[next])continue;
    g[next]=cost;prev[next]=cur;f[next]=cost+heuristic(next);
    if(!open.includes(next))open.push(next);
  }
 }
 return {distance:Infinity,points:[]};
}
function approachCost(s,start,table){
 const key=navNode(s,start)+'-'+table.id;
 if(s.pathCostCache.has(key))return s.pathCostCache.get(key);
 const cost=aStar(s,start,table.pick).distance;
 s.pathCostCache.set(key,cost);
 return cost;
}
function makePairs(s){
 const ids=[...new Set(s.tables.map(t=>t.ingredient))];
 const pairs=[];
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)pairs.push([ids[i],ids[j]]);
 return pairs;
}
function tableOptions(s,ingredient){
 return s.tables.filter(t=>t.ingredient===ingredient);
}
function chefRoute(s,chef,table){
 const key=chef.id+'-'+table.id;
 if(!s.chefRouteCache.has(key))
  s.chefRouteCache.set(key,aStar(s,table.pick,chef.deliver).distance);
 return s.chefRouteCache.get(key);
}
function pairCost(s,start,pair,chef){
 const station=chef||s.chefById.get(start.id);
 if(!station)return Infinity;
 const src=start.pizza?start:start;
 const landing=station.deliver;
 let shortest=Infinity;
 for(const firstId of pair)for(const first of tableOptions(s,firstId)){
   const otherId=pair.find(id=>id!==firstId);
   const firstDist=approachCost(s,src,first)+chefRoute(s,station,first);
   const secondDist=Math.min(...tableOptions(s,otherId).map(t=>
     approachCost(s,landing,t)+chefRoute(s,station,t)));
   shortest=Math.min(shortest,firstDist+secondDist);
 }
 return shortest;
}
function fairnessCandidates(s,p){
 return s.pairs.map(pair=>({pair,distance:pairCost(s,p,pair,s.chefById.get(p.id))}))
  .filter(x=>Number.isFinite(x.distance)).sort((a,b)=>a.distance-b.distance);
}
// Compare difficulty across the same player's own four successive menus.
// Other players' orders, scores, and distances never enter this selection.
const menuKey=pair=>[...pair].sort().join('|');
function selectOrder(s,p){
 const pizza=p.pizza,options=fairnessCandidates(s,p);
 if(!options.length)return null;
 if(pizza.orderSerial%4===0||!Number.isFinite(pizza.blockTarget))
  pizza.blockTarget=options[Math.floor(options.length/2)].distance;
 const target=pizza.blockTarget;
 const ranked=[...options].sort((a,b)=>Math.abs(a.distance-target)-Math.abs(b.distance-target));
 const fair=ranked.filter(o=>Math.abs(o.distance-target)<=Math.max(1,target*.20));
 const pool=fair.length>=Math.min(4,ranked.length)?fair:
  ranked.slice(0,Math.min(4,ranked.length));
 const recent=new Set(pizza.menuHistory.slice(-3).map(h=>h.key));
 const fresh=pool.filter(o=>!recent.has(menuKey(o.pair)));
 const choices=fresh.length?fresh:pool;
 const times=entry=>pizza.menuCounts[menuKey(entry.pair)]||0;
 const minCount=Math.min(...choices.map(times));
 const leastUsed=choices.filter(o=>times(o)===minCount);
 const inBlock=pizza.menuHistory.slice(-(pizza.orderSerial%4));
 const ingredientCount=id=>inBlock.reduce((count,h)=>count+Number(h.pair.includes(id)),0);
 return leastUsed.map(entry=>({
  entry,
  score:Math.abs(entry.distance-target)/Math.max(1,target)*2+
   (ingredientCount(entry.pair[0])+ingredientCount(entry.pair[1]))*.08+random(s)*.24
 })).sort((a,b)=>a.score-b.score)[0].entry;
}
function assignPair(s,p,entry){
 if(!entry)return false;
 const pizza=p.pizza,key=menuKey(entry.pair);
 pizza.order=[...entry.pair];pizza.delivered=[];pizza.held=null;
 pizza.assignedTotal+=entry.distance;
 pizza.lastCost=entry.distance;pizza.orderSerial++;
 pizza.menuCounts[key]=(pizza.menuCounts[key]||0)+1;
 pizza.menuHistory.push({key,pair:[...entry.pair],distance:entry.distance,target:pizza.blockTarget});
 pizza.botPath=[];pizza.botGoal=null;return true;
}
function chooseFirstOrders(s,ps){
 for(const p of ps)assignPair(s,p,selectOrder(s,p));
}
function nextOrder(s,p){
 // The only fairness comparison is against this chef's own past menu cycle.
 return assignPair(s,p,selectOrder(s,p));
}
function setup(round,ps){
 // The lobby initializes everyone with active=false. Activate entrants BEFORE
 // filtering, exactly as the existing minigame engines do; otherwise the
 // entire Pizza Time match starts with zero characters (including all bots).
 window.PartyCharacters.activate(ps);
 const people=active(ps),count=Math.max(1,people.length);
 const world=worldSize(count),s={world,center:{x:world.w/2,y:world.h/2},players:count,
   roster:ps,seed:(Number(round.pizzaSeed)||(Date.now()^0x4b1a8d7))>>>0||1,
   elapsed:0,duration:60,remaining:60,accumulator:0,clock:0,finished:false,
   tables:[],worktops:[],chefs:[],chefById:new Map(),chefRouteCache:new Map(),
   pairs:[],pathCostCache:new Map(),ranking:[],winnerIds:[],effects:[]};
 round.pizzaTime=s;round.remaining=60;
 tableLayout(s);stationLayout(s,people);grid(s);planOrderCards(s);
 s.pairs=makePairs(s);
 people.forEach(p=>{
   const chef=s.chefById.get(p.id);
   p.x=chef.spawn.x;p.y=chef.spawn.y;
   p.dir={...chef.facing};p.vx=0;p.vy=0;p.score=0;
   p.pizza={chefId:chef.id,held:null,order:[],delivered:[],
     assignedTotal:0,lastCost:0,orderSerial:0,menuHistory:[],menuCounts:{},
     blockTarget:null,botPath:[],botGoal:null,repath:0};
 });
 resolvePlayerCollisions(s,people);
 chooseFirstOrders(s,people);
 return s;
}
const PLAYER_RADIUS=15;
function projectPizzaPlayer(s,p,x,y,r){
 // Reject solid prep tables; preserve free tangential movement while pushing.
 const minX=25+r,maxX=s.world.w-25-r,minY=25+r,maxY=s.world.h-25-r;
 x=bound(x,minX,maxX);y=bound(y,minY,maxY);
 if(!blocked(s,x,y,r))return {x,y};
 // Prefer whichever tangential slide matches the intended joystick direction.
 // The old horizontal-first rule made vertical turns snag on prep counters.
 const horizontal=!blocked(s,x,p.y,r),vertical=!blocked(s,p.x,y,r);
 if(horizontal&&vertical)
  return Math.abs(y-p.y)>Math.abs(x-p.x)?{x:p.x,y}:{x,y:p.y};
 if(horizontal)return{x,y:p.y};
 if(vertical)return{x:p.x,y};
 return {x:p.x,y:p.y};
}
function pizzaCharacterRules(s){
 return {
   radius:PLAYER_RADIUS,iterations:8,playersSolid:true,
   bounds:{x:25,y:25,w:s.world.w-50,h:s.world.h-50},
   constrain:(p,x,y,r)=>projectPizzaPlayer(s,p,x,y,r)
 };
}
function resolvePlayerCollisions(s,players){
 return window.PartyCharacters.resolve(players,pizzaCharacterRules(s));
}
function input(p){
 return window.PartyCharacters.control(p.input);
}
function nearestWanted(s,p){
 const chef=s.chefById.get(p.id),pending=p.pizza.order.filter(id=>!p.pizza.delivered.includes(id));
 const targets=pending.flatMap(id=>tableOptions(s,id));
 return targets.map(t=>({table:t,distance:approachCost(s,p,t)+chefRoute(s,chef,t)}))
   .sort((a,b)=>a.distance-b.distance)[0]?.table||null;
}
function botInput(s,p,dt){
 const pizza=p.pizza,chef=s.chefById.get(p.id);
 if((pizza.botPause||0)>0){pizza.botPause=Math.max(0,pizza.botPause-dt);return {x:0,y:0};}
 const target=pizza.held?chef.deliver:nearestWanted(s,p);
 if(!target)return {x:0,y:0};
 const point=target.pick||target,goal=(target.id??'chef')+'-'+pizza.orderSerial+'-'+(pizza.held||'');
 pizza.repath-=dt;
 if(pizza.botGoal!==goal||pizza.repath<=0||pizza.botPath.length===0){
   pizza.botPath=aStar(s,p,point,true).points;pizza.botGoal=goal;pizza.repath=.72;
 }
 while(pizza.botPath.length&&hyp(p,pizza.botPath[0])<21)pizza.botPath.shift();
 const next=pizza.botPath[0]||point,dx=next.x-p.x,dy=next.y-p.y,len=Math.hypot(dx,dy);
 return {x:len>3?dx/len:0,y:len>3?dy/len:0};
}
function collect(s,p){
 const pizza=p.pizza;
 const near=s.tables.filter(t=>hyp(p,t.pick)<(p.isBot?40:48));
 for(const t of near){
  const id=t.ingredient;
  if(!pizza.order.includes(id)||pizza.delivered.includes(id)||pizza.held===id)continue;
  pizza.held=id;pizza.botGoal=null;
  if(p.isBot)pizza.botPause=.20;
  s.effects.push({x:p.x,y:p.y-24,text:'รับ '+byId[id].name,life:.55,color:p.color});
  break;
 }
}
function deliver(s,p){
 const pizza=p.pizza;
 const chef=s.chefById.get(p.id);
 if(!chef||!pizza.held||hyp(p,chef.deliver)>(p.isBot?41:49))return;
 const id=pizza.held;
 if(!pizza.order.includes(id)||pizza.delivered.includes(id)){pizza.held=null;return;}
 pizza.delivered.push(id);pizza.held=null;pizza.botGoal=null;
 if(p.isBot)pizza.botPause=.27;
 s.effects.push({x:p.x,y:p.y-25,text:'ส่ง '+byId[id].name,life:.65,color:'#fff6a2'});
 if(pizza.delivered.length===2){
   p.score+=1;s.effects.push({x:p.x,y:p.y-40,text:'+1',life:1,color:'#fff4a0'});
   nextOrder(s,p);
 }
}
function finish(s,round,ps){
 s.finished=true;s.remaining=0;round.remaining=0;
 s.ranking=active(ps).slice().sort((a,b)=>b.score-a.score).map((p,_,sorted)=>
  ({id:p.id,score:p.score,rank:1+sorted.filter(q=>q.score>p.score).length}));
 const top=s.ranking[0]?.score??0;s.winnerIds=s.ranking.filter(x=>x.score===top).map(x=>x.id);
}
function step(dt,round,ps){
 const s=round.pizzaTime;s.clock+=dt;s.elapsed=Math.min(s.duration,s.elapsed+dt);
 s.remaining=Math.max(0,s.duration-s.elapsed);round.remaining=s.remaining;
 const rules=pizzaCharacterRules(s);
 for(const p of active(ps)){
   if(!p.pizza)continue;
   const v=p.isBot?botInput(s,p,dt):input(p);
   // Give human players responsive low-stick steering; bots still pathfind,
   // but walk roughly 30% slower and hesitate at pickups/deliveries.
   if(!p.isBot){
    const strength=Math.hypot(v.x,v.y);
    if(strength>.10&&strength<1){
     const assisted=Math.min(1,.34+.66*strength);
     v.x*=assisted/strength;v.y*=assisted/strength;
    }
   }
   window.PartyCharacters.move(p,v,dt,{...rules,speed:s.world.h*(p.isBot?.215:.335)});
 }
 // Default character collision/pushing is applied BEFORE food pickup and chef
 // delivery, so characters cannot pass through each other at busy counters.
 resolvePlayerCollisions(s,ps);
 for(const p of active(ps)){
   if(!p.pizza)continue;
   collect(s,p);deliver(s,p);
 }
 for(const fx of s.effects)fx.life-=dt;
 s.effects=s.effects.filter(fx=>fx.life>0).slice(-32);
 if(s.remaining<=0)finish(s,round,ps);
}
function update(dt,round,ps){
 const s=round.pizzaTime;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.25,s.accumulator+bound(dt,0,.25));
 let ticks=0;
 while(s.accumulator>=STEP&&ticks++<15&&!s.finished){
  step(STEP,round,ps);s.accumulator-=STEP;
 }
 return s.finished?'winner':null;
}
function hud(ps,round){
 const s=round.pizzaTime;
 return {survivors:active(ps).length,remaining:s?.remaining||0,
  scores:active(ps).map(p=>({id:p.id,score:p.score||0})),winnerIds:s?.winnerIds||[]};
}
function playerStatus(p){
 const x=p.pizza;if(!x)return null;
 return {id:p.id,mode:'pizza_time',chefId:x.chefId,order:[...x.order],delivered:[...x.delivered],
  held:x.held,score:p.score||0};
}
// All on-field ingredient illustrations use the same original SVG assets as
// the HUD. No fonts/emoji/Canvas approximation for ingredients.
function drawIngredient(ctx,id,x,y,size=19){
 return window.PizzaIngredientArt.draw(ctx,id,x,y,size);
}
function rectanglesOverlap(a,b,margin=0){
 return a.x<b.x+b.w+margin&&a.x+a.w+margin>b.x&&
   a.y<b.y+b.h+margin&&a.y+a.h+margin>b.y;
}
function planOrderCards(s){
 const width=s.players>=10?118:s.players>=5?128:138, height=45;
 const border=8,room=s.world;
 const chefZones=s.chefs.map(c=>({
   x:c.x-65,y:c.y-49,w:130,h:105
 }));
 const spawnZones=s.chefs.map(c=>({
   x:c.spawn.x-26,y:c.spawn.y-26,w:52,h:52
 }));
 const placed=[];
 s.orderCards=new Map();
 for(let i=0;i<s.chefs.length;i++){
  const chef=s.chefs[i],x=chef.x,y=chef.y;
  const above={x:x-width/2,y:y-height-61,w:width,h:height};
  const below={x:x-width/2,y:y+62,w:width,h:height};
  const sideRight={x:x+75,y:y-height/2,w:width,h:height};
  const sideLeft={x:x-width-75,y:y-height/2,w:width,h:height};
  const diagonalRight={x:x+68,y:y-height-60,w:width,h:height};
  const diagonalLeft={x:x-width-68,y:y-height-60,w:width,h:height};
  const diagonalBottomRight={x:x+68,y:y+62,w:width,h:height};
  const diagonalBottomLeft={x:x-width-68,y:y+62,w:width,h:height};
  const top=x=>x; // candidate positions are evaluated, never clamped through a chef
  const preferred=y<room.h/2?
   [above,sideRight,sideLeft,diagonalRight,diagonalLeft,below,diagonalBottomRight,diagonalBottomLeft]:
   [below,sideRight,sideLeft,diagonalBottomRight,diagonalBottomLeft,above,diagonalRight,diagonalLeft];
  let best=null,bestScore=Infinity;
  for(const [order,c] of preferred.entries()){
   if(c.x<border||c.y<border||c.x+c.w>room.w-border||c.y+c.h>room.h-border)continue;
   const touchesChef=chefZones.some(z=>rectanglesOverlap(c,z,5));
   if(touchesChef)continue;
   const overlapsCard=placed.some(z=>rectanglesOverlap(c,z,5));
   if(overlapsCard)continue;
   const touchesSpawn=spawnZones.some(z=>rectanglesOverlap(c,z,5));
   const score=order*10+(touchesSpawn?200:0);
   if(score<bestScore){best=c;bestScore=score;}
  }
  // Last resort for tightly-packed 12-player maps: select smallest available
  // rectangle, still preferring cards completely away from chef bodies.
  if(!best){
   let candidates=[];
   for(const yPos of [8,room.h-height-8,Math.max(8,y-112),Math.min(room.h-height-8,y+75)]){
    for(let xPos=10;xPos<=room.w-width-10;xPos+=Math.max(20,width/3)){
     const c={x:xPos,y:yPos,w:width,h:height};
     let penalty=chefZones.filter(z=>rectanglesOverlap(c,z,3)).length*100000+
       placed.filter(z=>rectanglesOverlap(c,z,2)).length*50000+
       spawnZones.filter(z=>rectanglesOverlap(c,z,2)).length*400;
     penalty+=Math.hypot(c.x+c.w/2-chef.x,c.y+c.h/2-chef.y)/100;
     candidates.push({c,penalty});
    }
   }
   candidates.sort((a,b)=>a.penalty-b.penalty);
   best=candidates[0]?.c||{x:10,y:8,w:width,h:height};
  }
  placed.push(best);s.orderCards.set(chef.ownerId,best);
 }
 return s.orderCards;
}
function rounded(ctx,x,y,w,h,r=9){
 r=Math.min(Math.max(0,r),w/2,h/2);
 ctx.beginPath();
 if(typeof ctx.roundRect==='function'){ctx.roundRect(x,y,w,h,r);return;}
 ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
 ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
 ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
 ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
function drawChef(ctx,chef,player){
 const p=chef;
 ctx.save();ctx.translate(p.x,p.y);
 // Individual chef station, mirroring reference counters in each corner.
 ctx.fillStyle='#44291f66';rounded(ctx,-63,-39,126,80,12);ctx.fill();
 ctx.fillStyle='#805038';rounded(ctx,-63,-44,126,77,10);ctx.fill();
 ctx.fillStyle='#b27a52';rounded(ctx,-57,-40,114,69,8);ctx.fill();
 ctx.fillStyle='#d8ab74';ctx.fillRect(-46,19,34,10);ctx.fillRect(12,19,34,10);
 // Distinct colored uniform and chef hat (no image load dependency).
 ctx.fillStyle=p.color||'#53cedd';
 ctx.beginPath();ctx.ellipse(0,2,22,22,0,0,TAU);ctx.fill();
 ctx.fillStyle='#f6e9d5';ctx.beginPath();ctx.arc(0,-5,17,0,TAU);ctx.fill();
 ctx.fillStyle='#eaf8ff';
 ctx.beginPath();ctx.arc(-13,-22,12,0,TAU);ctx.arc(0,-27,14,0,TAU);ctx.arc(14,-22,12,0,TAU);ctx.fill();
 ctx.fillStyle='#dae8ef';rounded(ctx,-20,-23,40,13,4);ctx.fill();
 ctx.fillStyle='#2e333c';ctx.beginPath();ctx.arc(-6,-6,1.7,0,TAU);ctx.arc(6,-6,1.7,0,TAU);ctx.fill();
 ctx.strokeStyle='#997059';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(0,1,6,.1,Math.PI-.1);ctx.stroke();
 ctx.restore();
 // Personal chef pickup/delivery area and player ownership.
 ctx.lineWidth=3;ctx.strokeStyle=p.color;
 ctx.beginPath();ctx.arc(p.deliver.x,p.deliver.y,36,0,TAU);ctx.stroke();
 ctx.fillStyle='#304556de';rounded(ctx,p.x-47,p.y+31,94,19,7);ctx.fill();
 ctx.fillStyle='#fff9ed';ctx.font='bold 12px system-ui';ctx.textAlign='center';
 ctx.fillText((player?.name||'ผู้เล่น').slice(0,10),p.x,p.y+45);
}
function orderBubble(ctx,chef,player,s){
 if(!player?.pizza)return;
 const c=s.orderCards?.get(chef.ownerId);
 if(!c)return;
 const q=player.pizza;
 ctx.fillStyle='#fffaf2f5';rounded(ctx,c.x,c.y,c.w,c.h,13);ctx.fill();
 ctx.strokeStyle=chef.color;ctx.lineWidth=2;ctx.stroke();
 ctx.fillStyle='#334054';ctx.font='bold 11px system-ui';ctx.textAlign='left';
 ctx.fillText('ออร์เดอร์ '+(q.delivered.length||0)+'/2',c.x+8,c.y+13);
 const firstX=c.x+c.w*.31,secondX=c.x+c.w*.70,y=c.y+30;
 q.order.forEach((id,i)=>{
   const cx=i===0?firstX:secondX;
   drawIngredient(ctx,id,cx,y,12);
   if(q.delivered.includes(id)){
     ctx.fillStyle='#28aa6b';ctx.beginPath();ctx.arc(cx+13,y-10,8,0,TAU);ctx.fill();
     ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.beginPath();
     ctx.moveTo(cx+9,y-10);ctx.lineTo(cx+12,y-7);ctx.lineTo(cx+17,y-13);ctx.stroke();
   }
 });
}
function scene(ctx,s){
 const {w,h}=dims(s),tile=48;
 ctx.fillStyle='#4b9850';ctx.fillRect(0,0,w,h);
 // Garden / river accent outside the working room, matching visual reference.
 ctx.fillStyle='#72c3a4';ctx.fillRect(0,0,w,25);ctx.fillRect(w-23,0,23,h);
 ctx.fillStyle='#aa7b5d';ctx.fillRect(22,22,w-44,h-44);
 ctx.fillStyle='#edc5ad';ctx.fillRect(30,30,w-60,h-60);
 for(let yy=30,row=0;yy<h-30;yy+=tile,row++)
  for(let xx=30,col=0;xx<w-30;xx+=tile,col++){
   ctx.fillStyle=(row+col)%2?'#edcbb8':'#f6dac7';
   ctx.fillRect(xx,yy,Math.min(tile-1,w-30-xx),Math.min(tile-1,h-30-yy));
  }
 ctx.strokeStyle='#815c43';ctx.lineWidth=7;ctx.strokeRect(30,30,w-60,h-60);
 // Lightweight decorative oven housings on sides; not collision objects.
 for(const oven of [{x:56,y:h*.50},{x:w-56,y:h*.50}]){
   ctx.fillStyle='#976944';rounded(ctx,oven.x-30,oven.y-35,60,70,8);ctx.fill();
   ctx.fillStyle='#e4bc76';ctx.beginPath();ctx.arc(oven.x,oven.y,26,0,TAU);ctx.fill();
   ctx.fillStyle='#6b4033';ctx.beginPath();ctx.arc(oven.x,oven.y,18,0,TAU);ctx.fill();
   ctx.fillStyle='#edc65f';ctx.beginPath();ctx.arc(oven.x,oven.y,10,0,TAU);ctx.fill();
 }
 // Every worktop visibly holds TWO DIFFERENT ingredients.
 for(const top of s.worktops){
  ctx.save();ctx.translate(top.x,top.y);
  ctx.fillStyle='#33231f77';rounded(ctx,-60,-46,120,98,12);ctx.fill();
  ctx.fillStyle='#835137';rounded(ctx,-61,-51,122,98,9);ctx.fill();
  ctx.fillStyle='#ae7650';rounded(ctx,-56,-46,112,88,8);ctx.fill();
  ctx.fillStyle='#d9a875';rounded(ctx,-48,-39,96,73,7);ctx.fill();
  ctx.strokeStyle='#a36c46';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-35);ctx.lineTo(0,30);ctx.stroke();
  const left=s.tables[top.id*2],right=s.tables[top.id*2+1];
  ctx.fillStyle='#f5dfb3';
  rounded(ctx,-44,-31,40,57,6);ctx.fill();
  rounded(ctx,4,-31,40,57,6);ctx.fill();
  drawIngredient(ctx,left.ingredient,-25,-3,20);
  drawIngredient(ctx,right.ingredient,25,-3,20);
  ctx.restore();
  // Small pick markers near BOTH reachable table ends.
  for(const slot of s.tables.slice(top.id*2,top.id*2+2)){
   ctx.fillStyle='#fff2c9';ctx.beginPath();ctx.arc(slot.pick.x,slot.pick.y,19,0,TAU);ctx.fill();
   ctx.strokeStyle='#a77c4f';ctx.lineWidth=2;ctx.stroke();
   drawIngredient(ctx,slot.ingredient,slot.pick.x,slot.pick.y,9);
  }
 }
 for(const chef of s.chefs){
   drawChef(ctx,chef,s.roster.find(p=>p.id===chef.ownerId));
 }
 for(const chef of s.chefs){
   orderBubble(ctx,chef,s.roster.find(p=>p.id===chef.ownerId),s);
 }
}
function draw(ctx,time,round,ps){
 const s=round.pizzaTime;if(!s)return;
 ctx.save();ctx.clearRect(0,0,960,540);
 ctx.scale(960/s.world.w,540/s.world.h);
 scene(ctx,s);
 for(const p of active(ps)){
  window.PartyCharacters.draw(ctx,p,{time:s.clock,holding:!!p.pizza?.held,scale:s.players>=10?1.15:1});
  if(!p.pizza)continue;
  if(p.pizza.held){
   ctx.fillStyle='#fff8df';ctx.beginPath();ctx.arc(p.x+19,p.y-38,17,0,TAU);ctx.fill();
   drawIngredient(ctx,p.pizza.held,p.x+19,p.y-38,12);
  }
 }
 for(const fx of s.effects){
   ctx.save();ctx.globalAlpha=bound(fx.life*1.6,0,1);
   ctx.fillStyle=fx.color;ctx.font='900 20px system-ui';ctx.textAlign='center';
   ctx.fillText(fx.text,fx.x,fx.y-(1-fx.life)*15);ctx.restore();
 }
 ctx.fillStyle='#2e342de6';rounded(ctx,13,10,206,52,10);ctx.fill();
 ctx.fillStyle='#fff7e6';ctx.font='900 22px system-ui';ctx.textAlign='left';
 ctx.fillText('PIZZA TIME',24,33);ctx.font='bold 15px system-ui';
 ctx.fillText(round.phase==='countdown'?'เริ่มใน '+Math.ceil(round.countdown):
   'เหลือ '+Math.ceil(s.remaining)+' วินาที',24,54);
 ctx.restore();
}
window.PizzaTime=Object.freeze({setup,update,draw,hud,playerStatus,drawIngredient,
  worldSize,tableCount,pairCost,aStar,fairnessCandidates,ingredients:INGREDIENTS,
  planOrderCards,rectanglesOverlap});
})();