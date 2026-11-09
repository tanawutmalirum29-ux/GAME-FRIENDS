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
 {id:'basil',name:'ใบโหระพา',color:'#4fbf6d'},
 {id:'olive',name:'มะกอก',color:'#768b48'},
 {id:'corn',name:'ข้าวโพด',color:'#f1c854'}
]);
const bound=(x,a,b)=>Math.max(a,Math.min(b,x));
const hyp=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const active=ps=>ps.filter(p=>p.active);
function random(s){let n=s.seed|0;n^=n<<13;n^=n>>>17;n^=n<<5;s.seed=n||1234567;return (s.seed>>>0)/4294967296;}
const worldSize=n=>n<=3?{w:960,h:540}:n<=6?{w:1200,h:675}:n<=9?{w:1440,h:810}:{w:1600,h:900};
// Physical worktops contain exactly two ingredient slots each.
const tableCount=n=>n<=4?2:n<=6?3:n<=9?4:5;
function tableLayout(s){
 const count=tableCount(s.players);
 // Every visible ingredient slot must have a unique type for this match.
 // Sample without replacement; never duplicate an ingredient across counters.
 // Keep the layout at five worktops for 10–12 players (10 distinct types).
 const available=INGREDIENTS.map(item=>item.id);
 if(count*2>available.length)
   throw Error('PIZZA TIME needs at least '+(count*2)+' unique ingredients for this map');
 for(let i=available.length-1;i>0;i--){
   const j=Math.floor(random(s)*(i+1));
   [available[i],available[j]]=[available[j],available[i]];
 }
 const kinds=available.slice(0,count*2);
 if(new Set(kinds).size!==kinds.length)
   throw Error('PIZZA TIME cannot assign duplicate ingredients to a single match');
 // Authored kitchen aisles, in 960x540 design units. The room widens for
 // more cooks; sprites, trays and walking clearance retain their screen scale.
 const plans={
  2:[[344,270],[616,270]],
  3:[[268,276],[480,264],[692,276]],
  4:[[228,262],[396,278],[564,262],[732,278]],
  5:[[124,270],[302,256],[480,284],[658,256],[836,270]]
 };
 const u=s.unit,halfW=(count>=4?48:52)*u,halfH=36*u;
 s.worktops=plans[count].map(([x,y],id)=>({id,x:x*u,y:y*u,halfW,halfH}));
 s.tables=[];
 for(const w of s.worktops)for(let slot=0;slot<2;slot++){
  const ingredient=kinds[w.id*2+slot],sign=slot===0?-1:1;
  s.tables.push({id:w.id*2+slot,worktopId:w.id,ingredient,
   x:w.x+sign*23*u,y:w.y+sign*12*u,
   pick:{x:w.x+sign*23*u,y:w.y+sign*(w.halfH+s.bodyRadius+9*u)}
  });
 }
 // Ovens are real furniture too. Four-player kitchens have the reference's
 // third oven in the central aisle; crowded kitchens leave that lane open.
 const ovenCenters=[[s.arena.x/u-6,270],[((s.arena.x+s.arena.w)/u)+6,270]];
 if(count===2)ovenCenters.push([480,270]);
 s.ovens=ovenCenters.map(([x,y],id)=>({id,x:(x-34)*u,y:(y-39)*u,w:68*u,h:78*u}));
}
function stationLayout(s,ps){
 const n=ps.length,u=s.unit,b=s.arena;
 let stations=[];
 if(n<=4){
  const corners=[{cx:342,top:true,left:true},{cx:618,top:true,left:false},
   {cx:342,top:false,left:true},{cx:618,top:false,left:false}];
  const order=n===1?[0]:n===2?[0,3]:n===3?[0,1,2]:[0,1,2,3];
  stations=order.map(i=>({...corners[i],width:174}));
 }else{
  for(const top of [true,false]){
   const count=top?Math.ceil(n/2):Math.floor(n/2),span=b.w/u;
   const stride=span/count,width=Math.min(178,stride-16);
   for(let i=0;i<count;i++)stations.push({cx:b.x/u+stride*(i+.5),top,left:i<(count/2),width});
  }
 }
 s.chefs=ps.map((p,i)=>{
  const q=stations[i],sign=q.top?1:-1,cx=q.cx*u;
  const bounds={x:cx-q.width*u/2,y:(q.top?36:404)*u,w:q.width*u,h:100*u};
  const counter={x:bounds.x,y:(q.top?91:404)*u,w:bounds.w,h:45*u};
  const x=bounds.x+(q.left?30:q.width-30)*u,y=(q.top?65:475)*u;
  const deliver={x:cx,y:(q.top?154:386)*u};
  const spawn={x:cx+(i%2?-38:38)*u,y:deliver.y+sign*8*u};
  const card={x:bounds.x+(q.left?62:6)*u,y:(q.top?43:455)*u,w:(q.width-68)*u,h:39*u};
  const trays=[-22,22].map(dx=>({x:cx+dx*u,y:(q.top?111:429)*u}));
  return {id:i,ownerId:p.id,color:p.color,x,y,cx,top:q.top,bounds,counter,trays,
   deliver,spawn,orderCard:card,figureBounds:{x:x-27*u,y:y-27*u,w:54*u,h:54*u},
   facing:{x:0,y:sign}};
 });
 s.chefById=new Map(s.chefs.map(c=>[c.ownerId,c]));
 s.solids=[...s.worktops.map(t=>({x:t.x-t.halfW,y:t.y-t.halfH,w:t.halfW*2,h:t.halfH*2})),
  ...s.ovens,...s.chefs.map(c=>c.bounds)];
}
function blocked(s,x,y,r=s.bodyRadius){
 const b=s.arena;
 if(x<b.x+r||y<b.y+r||x>b.x+b.w-r||y>b.y+b.h-r)return true;
 return s.solids.some(t=>Math.hypot(x-bound(x,t.x,t.x+t.w),y-bound(y,t.y,t.y+t.h))<r);
}
function grid(s){
 const cell=22*s.unit,cols=Math.ceil(s.world.w/cell),rows=Math.ceil(s.world.h/cell);
 s.nav={cell,cols,rows};s.passable=new Uint8Array(cols*rows);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)
  s.passable[y*cols+x]=blocked(s,(x+.5)*cell,(y+.5)*cell,s.bodyRadius+1.5*s.unit)?0:1;
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
function aStar(s,a,b,needPath=false,traffic=[]){
 const start=navNode(s,a),end=navNode(s,b),{cols,rows,cell}=s.nav;
 if(start===end)return {distance:hyp(a,b),points:needPath?[b]:[]};
 const n=cols*rows,g=new Float64Array(n),f=new Float64Array(n),prev=new Int32Array(n),seen=new Uint8Array(n),open=[start];
 g.fill(Infinity);f.fill(Infinity);prev.fill(-1);g[start]=0;
 // Only live bot navigation pays for traffic. Menu costs remain static, so
 // another player's position cannot change the ingredients a chef requests.
 const congestion=new Float64Array(n),clearance=s.bodyRadius*2.7;
 for(const actor of traffic)for(let node=0;node<n;node++){
  if(!s.passable[node])continue;
  const d=hyp(actor,navPoint(s,node));
  if(d<clearance)congestion[node]+=(1-d/clearance)*cell*1.5;
 }
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
    const cost=g[cur]+(xx&&yy?Math.SQRT2:1)*cell+congestion[next];
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
 const world=worldSize(count),unit=world.w/960;
 const width=count<=4?536:count<=6?704:count<=9?836:868;
 const s={world,unit,bodyRadius:17.5*unit,actorScale:1.12*unit,
   arena:{x:(960-width)/2*unit,y:36*unit,w:width*unit,h:468*unit},
   center:{x:world.w/2,y:world.h/2},players:count,
   roster:ps,seed:(Number(round.pizzaSeed)||(Date.now()^0x4b1a8d7))>>>0||1,
   elapsed:0,duration:60,remaining:60,accumulator:0,clock:0,finished:false,
   tables:[],worktops:[],chefs:[],chefById:new Map(),chefRouteCache:new Map(),
   pairs:[],pathCostCache:new Map(),ranking:[],winnerIds:[],effects:[]};
 round.pizzaTime=s;round.remaining=60;
 tableLayout(s);stationLayout(s,people);grid(s);planOrderCards(s);
 window.PizzaKitchenArt?.preload(s);window.PizzaIngredientArt?.preload();
 s.pairs=makePairs(s);
 people.forEach(p=>{
   const chef=s.chefById.get(p.id);
   p.x=chef.spawn.x;p.y=chef.spawn.y;
   p.dir={...chef.facing};p.vx=0;p.vy=0;p.score=0;
   p.pizza={chefId:chef.id,held:null,order:[],delivered:[],
     lastDish:null,assignedTotal:0,lastCost:0,orderSerial:0,menuHistory:[],menuCounts:{},
     blockTarget:null,botPath:[],botGoal:null,repath:0};
 });
 resolvePlayerCollisions(s,people);
 chooseFirstOrders(s,people);
 return s;
}

function projectPizzaPlayer(s,p,x,y,r){
 // Reject solid prep tables; preserve free tangential movement while pushing.
 const b=s.arena,minX=b.x+r,maxX=b.x+b.w-r,minY=b.y+r,maxY=b.y+b.h-r;
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
   radius:s.bodyRadius,iterations:8,playersSolid:true,
   bounds:s.arena,
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
   pizza.botPath=aStar(s,p,point,true,s.roster.filter(q=>q.active&&q!==p)).points;
   pizza.botGoal=goal;pizza.repath=.72;
 }
 while(pizza.botPath.length&&hyp(p,pizza.botPath[0])<15*s.unit)pizza.botPath.shift();
 const next=pizza.botPath[0]||point,dx=next.x-p.x,dy=next.y-p.y,len=Math.hypot(dx,dy);
 return {x:len>3*s.unit?dx/len:0,y:len>3*s.unit?dy/len:0};
}
function collect(s,p){
 const pizza=p.pizza;
 const near=s.tables.filter(t=>hyp(p,t.pick)<(p.isBot?21:23)*s.unit);
 for(const t of near){
  const id=t.ingredient;
  if(!pizza.order.includes(id)||pizza.delivered.includes(id)||pizza.held===id)continue;
  pizza.held=id;pizza.botGoal=null;
  if(p.isBot)pizza.botPause=.20;
  s.effects.push({x:p.x,y:p.y,kind:'pickup',life:.24,total:.24,color:p.color});
  break;
 }
}
function deliver(s,p){
 const pizza=p.pizza;
 const chef=s.chefById.get(p.id);
 if(!chef||!pizza.held||hyp(p,chef.deliver)>(p.isBot?21:23)*s.unit)return;
 const id=pizza.held;
 if(!pizza.order.includes(id)||pizza.delivered.includes(id)){pizza.held=null;return;}
 pizza.lastDish=null;pizza.delivered.push(id);pizza.held=null;pizza.botGoal=null;
 if(p.isBot)pizza.botPause=.27;
 const tray=chef.trays[pizza.order.indexOf(id)];
 s.effects.push({x:tray.x,y:tray.y,kind:'deliver',life:.35,total:.35,color:p.color});
 if(pizza.delivered.length===2){
   pizza.lastDish={ingredients:[...pizza.order],at:s.clock};
   p.score+=1;s.effects.push({x:chef.cx,y:chef.counter.y,text:'+1',life:1,color:'#fff4a0'});
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
 // The speech cards live beside the chef, within each raised booth. They never
 // float over a walking lane or another cook, even at six stations per row.
 s.orderCards=new Map(s.chefs.map(c=>[c.ownerId,{...c.orderCard}]));
 return s.orderCards;
}
function draw(ctx,time,round,ps){
 const s=round.pizzaTime;if(!s)return;
 const art=window.PizzaKitchenArt;
 ctx.save();ctx.clearRect(0,0,960,540);ctx.scale(960/s.world.w,540/s.world.h);
 art.drawScene(ctx,s);
 for(const chef of s.chefs)art.drawStation(ctx,s,chef,s.roster.find(p=>p.id===chef.ownerId));
 for(const p of active(ps)){
  window.PartyCharacters.draw(ctx,p,{time:s.clock,holding:true,scale:s.actorScale,label:false});
  art.drawCarried(ctx,s,p);
 }
 for(const fx of s.effects){
  ctx.save();ctx.globalAlpha=bound(fx.life/(fx.total||.5),0,1);
  if(fx.text){
   ctx.strokeStyle='#613e28';ctx.lineWidth=3*s.unit;
   ctx.font='900 '+(20*s.unit)+'px system-ui';ctx.textAlign='center';
   const y=fx.y-(1-fx.life)*20*s.unit;ctx.strokeText(fx.text,fx.x,y);
   ctx.fillStyle=fx.color;ctx.fillText(fx.text,fx.x,y);
  }else{
   ctx.strokeStyle=fx.color;ctx.lineWidth=2*s.unit;
   ctx.beginPath();ctx.arc(fx.x,fx.y,(12+(1-fx.life/fx.total)*12)*s.unit,0,TAU);ctx.stroke();
  }
  ctx.restore();
 }
 ctx.restore(); // Clock is drawn centrally by app.js.
}
window.PizzaTime=Object.freeze({setup,update,draw,hud,playerStatus,drawIngredient,
  worldSize,tableCount,pairCost,aStar,fairnessCandidates,ingredients:INGREDIENTS,
  planOrderCards,rectanglesOverlap});
})();
