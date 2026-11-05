/* PIZZA TIME — host-authoritative two-trip cooking race. */
(() => {
'use strict';
const TAU=Math.PI*2, STEP=1/60;
const INGREDIENTS=Object.freeze([
 {id:'tomato',name:'มะเขือเทศ',icon:'🍅',color:'#ec4c42'},
 {id:'cheese',name:'ชีส',icon:'🧀',color:'#f5c545'},
 {id:'mushroom',name:'เห็ด',icon:'🍄',color:'#dec7aa'},
 {id:'pepperoni',name:'เปปเปอโรนี',icon:'🥓',color:'#ca6052'},
 {id:'pepper',name:'พริกหวาน',icon:'🫑',color:'#58bd70'},
 {id:'onion',name:'หัวหอม',icon:'🧅',color:'#d8aaef'},
 {id:'pineapple',name:'สับปะรด',icon:'🍍',color:'#efdb60'},
 {id:'basil',name:'ใบโหระพา',icon:'🌿',color:'#4fbf6d'}
]);
const byId=Object.fromEntries(INGREDIENTS.map(x=>[x.id,x]));
const bound=(x,a,b)=>Math.max(a,Math.min(b,x));
const hyp=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const active=ps=>ps.filter(p=>p.active);
function random(s){let n=s.seed|0;n^=n<<13;n^=n>>>17;n^=n<<5;s.seed=n||1234567;return (s.seed>>>0)/4294967296;}
const worldSize=n=>n<=3?{w:960,h:540}:n<=6?{w:1200,h:675}:n<=9?{w:1440,h:810}:{w:1600,h:900};
const tableCount=n=>n<=3?4:n<=6?6:n<=9?8:10;
const dims=s=>({w:s.world.w,h:s.world.h});
function tableLayout(s){
 const count=tableCount(s.players);
 const ids=INGREDIENTS.slice(0,s.players<=3?4:s.players<=6?5:s.players<=9?6:8).map(x=>x.id);
 for(let i=ids.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
 s.tables=Array.from({length:count},(_,i)=>{
   const theta=-Math.PI/2+TAU*i/count;
   const x=s.center.x+Math.cos(theta)*s.world.w*.365;
   const y=s.center.y+Math.sin(theta)*s.world.h*.34;
   // Pickup pad faces the chef; table bodies are solid but pickups remain reachable.
   const dx=s.center.x-x,dy=s.center.y-y,len=Math.hypot(dx,dy)||1;
   return {id:i,ingredient:ids[i%ids.length],x,y,
     pick:{x:x+dx/len*69,y:y+dy/len*69},size:38};
 });
}
function blocked(s,x,y,r=14){
 if(x<25+r||y<25+r||x>s.world.w-25-r||y>s.world.h-25-r)return true;
 return s.tables.some(t=>Math.abs(x-t.x)<t.size+r&&Math.abs(y-t.y)<t.size+r);
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
function cheapestTable(s,ingredient,start){
 let best=null,cost=Infinity;
 for(const t of tableOptions(s,ingredient)){
   const route=approachCost(s,start,t);
   if(route<cost){best=t;cost=route;}
 }
 return {table:best,distance:cost};
}
function pairCost(s,start,pair){
 const first=pair.map(id=>cheapestTable(s,id,start));
 const costs=first.map((o,i)=>{
   if(!o.table)return Infinity;
   const second=pair[1-i],back=s.toChef.get(o.table.id);
   const toOther=Math.min(...tableOptions(s,second).map(t=>s.toChef.get(t.id)*2));
   return o.distance+back+toOther;
 });
 return Math.min(...costs);
}
function fairnessCandidates(s,p){
 return s.pairs.map(pair=>({pair,distance:pairCost(s,p,pair)}))
  .filter(x=>Number.isFinite(x.distance)).sort((a,b)=>a.distance-b.distance);
}
function chooseFirstOrders(s,ps){
 const pools=new Map(ps.map(p=>[p.id,fairnessCandidates(s,p)]));
 // Search common target distance instead of independently choosing easiest jobs.
 const targets=[...new Set([...pools.values()].flat().map(o=>Math.round(o.distance/8)*8))].sort((a,b)=>a-b);
 let best=null;
 for(const target of targets){
  const selected=ps.map(p=>{
   const list=pools.get(p.id),offset=(Number(p.id)||0)%Math.max(1,list.length);
   return [...list].sort((a,b)=>Math.abs(a.distance-target)-Math.abs(b.distance-target)||
     Number(a.pair[0]===s.lastIngredient.get(p.id))-Number(b.pair[0]===s.lastIngredient.get(p.id)))[0];
  });
  if(selected.some(x=>!x))continue;
  const values=selected.map(x=>x.distance),min=Math.min(...values),max=Math.max(...values);
  const spread=max-min,avg=values.reduce((a,b)=>a+b,0)/values.length;
  const score=spread+Math.abs(avg-s.world.h*1.2)*.015;
  if(!best||score<best.score)best={score,selected,spread,avg};
  if(best&&spread<=avg*.02)break;
 }
 if(!best)return;
 s.targetDistance=best.avg;
 s.firstSpread=best.spread;
 ps.forEach((p,i)=>assignPair(s,p,best.selected[i]));
}
function assignPair(s,p,entry){
 const pizza=p.pizza;
 pizza.order=[...entry.pair];pizza.delivered=[];pizza.held=null;
 pizza.assignedTotal+=entry.distance;
 pizza.lastCost=entry.distance;pizza.orderSerial++;
 s.lastIngredient.set(p.id,entry.pair[0]);pizza.botPath=[];pizza.botGoal=null;
}
function nextOrder(s,p){
 const options=fairnessCandidates(s,p);if(!options.length)return;
 const live=active(s.roster);
 const mean=live.reduce((a,x)=>a+(x.pizza?.assignedTotal||0),0)/Math.max(1,live.length);
 const fairTarget=s.targetDistance+bound((mean-p.pizza.assignedTotal)*.20,-s.targetDistance*.20,s.targetDistance*.20);
 const best=[...options].sort((a,b)=>
  Math.abs(a.distance-fairTarget)-Math.abs(b.distance-fairTarget)||
  Number(a.pair.includes(s.lastIngredient.get(p.id)))-Number(b.pair.includes(s.lastIngredient.get(p.id))))[0];
 assignPair(s,p,best);
}
function setup(round,ps){
 const people=active(ps),count=Math.max(1,people.length);
 const world=worldSize(count),s={world,center:{x:world.w/2,y:world.h/2},players:count,
   roster:ps,seed:(Number(round.pizzaSeed)||Date.now()^0x4b1a8d7)>>>0||1,
   elapsed:0,duration:60,remaining:60,accumulator:0,clock:0,finished:false,
   tables:[],pairs:[],toChef:new Map(),pathCostCache:new Map(),lastIngredient:new Map(),targetDistance:0,
   firstSpread:0,ranking:[],winnerIds:[],effects:[]};
 round.pizzaTime=s;round.remaining=60;
 tableLayout(s);grid(s);
 for(const t of s.tables)s.toChef.set(t.id,aStar(s,t.pick,s.center).distance);
 s.pairs=makePairs(s);
 people.forEach((p,i)=>{
   const angle=-Math.PI/2+TAU*i/count;
   p.x=s.center.x+Math.cos(angle)*world.w*.06;
   p.y=s.center.y+Math.sin(angle)*world.h*.070435;
   p.dir={x:Math.cos(angle),y:Math.sin(angle)};p.vx=0;p.vy=0;p.score=0;
   p.pizza={held:null,order:[],delivered:[],assignedTotal:0,lastCost:0,orderSerial:0,
     botPath:[],botGoal:null,repath:0};
 });
 chooseFirstOrders(s,people);
 return s;
}
function safeMove(s,p,dx,dy){
 const r=13;
 const nx=bound(p.x+dx,25+r,s.world.w-25-r);
 if(!blocked(s,nx,p.y,r))p.x=nx;
 const ny=bound(p.y+dy,25+r,s.world.h-25-r);
 if(!blocked(s,p.x,ny,r))p.y=ny;
}
function input(p){
 const k=p.input||{},x=(Number(k.axisX)||0)+(k.right?1:0)-(k.left?1:0);
 const y=(Number(k.axisY)||0)+(k.down?1:0)-(k.jump?1:0);
 const len=Math.hypot(x,y);return {x:len>1?x/len:x,y:len>1?y/len:y};
}
function nearestWanted(s,p){
 const remaining=p.pizza.order.filter(id=>!p.pizza.delivered.includes(id));
 const targets=remaining.flatMap(id=>tableOptions(s,id));
 return targets.map(t=>({table:t,dist:approachCost(s,p,t)}))
   .sort((a,b)=>(a.dist+s.toChef.get(a.table.id))-(b.dist+s.toChef.get(b.table.id)))[0]?.table||null;
}
function botInput(s,p,dt){
 const pizza=p.pizza;
 const target=pizza.held?s.center:nearestWanted(s,p);
 if(!target)return {x:0,y:0};
 const point=target.pick||target,goal=(target.id??'chef')+'-'+pizza.orderSerial+'-'+(pizza.held||'');
 pizza.repath-=dt;
 if(pizza.botGoal!==goal||pizza.repath<=0||pizza.botPath.length===0){
   pizza.botPath=aStar(s,p,point,true).points;pizza.botGoal=goal;pizza.repath=.40;
 }
 while(pizza.botPath.length&&hyp(p,pizza.botPath[0])<21)pizza.botPath.shift();
 const next=pizza.botPath[0]||point,dx=next.x-p.x,dy=next.y-p.y,len=Math.hypot(dx,dy);
 return {x:len>3?dx/len:0,y:len>3?dy/len:0};
}
function collect(s,p){
 const pizza=p.pizza;
 const near=s.tables.filter(t=>hyp(p,t.pick)<40);
 for(const t of near){
  const id=t.ingredient;
  if(!pizza.order.includes(id)||pizza.delivered.includes(id)||pizza.held===id)continue;
  pizza.held=id;pizza.botGoal=null;
  s.effects.push({x:p.x,y:p.y-24,text:'รับ '+byId[id].name,life:.55,color:p.color});
  break;
 }
}
function deliver(s,p){
 const pizza=p.pizza;
 if(!pizza.held||hyp(p,s.center)>57)return;
 const id=pizza.held;
 if(!pizza.order.includes(id)||pizza.delivered.includes(id)){pizza.held=null;return;}
 pizza.delivered.push(id);pizza.held=null;pizza.botGoal=null;
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
 for(const p of active(ps)){
  if(!p.pizza)continue;
  const v=p.isBot?botInput(s,p,dt):input(p);
  const magnitude=Math.hypot(v.x,v.y),speed=s.world.h*.305;
  safeMove(s,p,v.x*speed*dt,v.y*speed*dt);
  if(magnitude>.12)p.dir={x:v.x/magnitude,y:v.y/magnitude};
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
 return {id:p.id,mode:'pizza_time',order:[...x.order],delivered:[...x.delivered],
  held:x.held,score:p.score||0};
}
function drawIngredient(ctx,id,x,y,size=19){
 const item=byId[id];if(!item)return;
 ctx.save();ctx.translate(x,y);const k=size/19;ctx.scale(k,k);
 ctx.shadowColor='#39231c77';ctx.shadowBlur=3;ctx.shadowOffsetY=2;
 if(id==='cheese'){
  ctx.fillStyle='#f6cd54';ctx.beginPath();ctx.moveTo(-16,11);ctx.lineTo(5,-15);ctx.lineTo(16,12);ctx.closePath();ctx.fill();
  ctx.fillStyle='#e4a93c';for(const [a,b] of [[1,3],[-5,7],[8,9]]){ctx.beginPath();ctx.arc(a,b,2.5,0,TAU);ctx.fill();}
 }else if(id==='tomato'){
  ctx.fillStyle='#e73e35';ctx.beginPath();ctx.arc(0,2,14,0,TAU);ctx.fill();
  ctx.fillStyle='#67ba45';for(let i=0;i<5;i++){ctx.save();ctx.rotate(i*TAU/5);ctx.beginPath();ctx.moveTo(0,-2);ctx.lineTo(-4,-13);ctx.lineTo(4,-12);ctx.fill();ctx.restore();}
 }else if(id==='mushroom'){
  ctx.fillStyle='#f6dfb2';ctx.fillRect(-5,-1,10,15);ctx.beginPath();ctx.arc(0,-3,14,Math.PI,0);ctx.fill();
  ctx.fillStyle='#9b6f65';ctx.beginPath();ctx.ellipse(0,-4,14,7,0,Math.PI,TAU);ctx.fill();
 }else if(id==='pepperoni'){
  ctx.fillStyle='#b44036';ctx.beginPath();ctx.arc(0,0,14,0,TAU);ctx.fill();
  ctx.fillStyle='#f49c75';for(const [a,b] of [[-5,-5],[5,-2],[1,7],[-8,6]]){ctx.beginPath();ctx.arc(a,b,2.8,0,TAU);ctx.fill();}
 }else if(id==='pepper'){
  ctx.fillStyle='#56b966';ctx.beginPath();ctx.ellipse(-4,3,8,13,-.3,0,TAU);ctx.ellipse(5,3,8,13,.3,0,TAU);ctx.fill();
  ctx.strokeStyle='#2d7b42';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(4,-15);ctx.stroke();
 }else if(id==='onion'){
  ctx.fillStyle='#d7a4e6';ctx.beginPath();ctx.ellipse(0,1,12,15,0,0,TAU);ctx.fill();
  ctx.strokeStyle='#a076bb';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,1,7,10,0,0,TAU);ctx.stroke();
 }else if(id==='pineapple'){
  ctx.fillStyle='#ecce4f';ctx.beginPath();ctx.ellipse(0,3,10,13,0,0,TAU);ctx.fill();
  ctx.strokeStyle='#b58f33';ctx.lineWidth=1.5;for(let i=-8;i<12;i+=7){ctx.beginPath();ctx.moveTo(-8,i);ctx.lineTo(8,i+6);ctx.stroke();}
  ctx.strokeStyle='#427d3a';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(-7,-17);ctx.moveTo(0,-10);ctx.lineTo(8,-18);ctx.stroke();
 }else{
  ctx.fillStyle='#46b96d';ctx.beginPath();ctx.ellipse(-6,-2,7,14,-.5,0,TAU);ctx.ellipse(6,-2,7,14,.5,0,TAU);ctx.fill();
  ctx.strokeStyle='#337c4a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,13);ctx.lineTo(0,-12);ctx.stroke();
 }
 ctx.restore();
}
function rounded(ctx,x,y,w,h,r=9){
 ctx.beginPath();ctx.roundRect(x,y,w,h,r);
}
function scene(ctx,s){
 const {w,h}=dims(s),tile=46;
 ctx.fillStyle='#589d56';ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#e2bca7';ctx.fillRect(25,25,w-50,h-50);
 for(let yy=25,row=0;yy<h-25;yy+=tile,row++)for(let xx=25,col=0;xx<w-25;xx+=tile,col++){
  ctx.fillStyle=(row+col)%2?'#eac8b4':'#f4d8c4';ctx.fillRect(xx,yy,tile-1,tile-1);
 }
 ctx.strokeStyle='#7d503d';ctx.lineWidth=8;ctx.strokeRect(25,25,w-50,h-50);
 // Decorative counters are outside the movement area.
 ctx.fillStyle='#7d4d36';ctx.fillRect(w*.35,15,w*.30,32);ctx.fillRect(w*.35,h-47,w*.30,32);
 for(const t of s.tables){
  ctx.save();ctx.translate(t.x,t.y);
  ctx.fillStyle='#4a342e66';rounded(ctx,-42,-37,87,83,12);ctx.fill();
  ctx.fillStyle='#925d3f';rounded(ctx,-42,-43,84,82,10);ctx.fill();
  ctx.fillStyle='#c98b5c';rounded(ctx,-35,-36,70,66,7);ctx.fill();
  ctx.fillStyle='#f7e1b8';rounded(ctx,-29,-30,58,54,6);ctx.fill();
  drawIngredient(ctx,t.ingredient,0,-1,25);
  ctx.restore();
 }
 // Chef collection counter in the center.
 const c=s.center;
 ctx.fillStyle='#734b33';rounded(ctx,c.x-52,c.y-45,104,90,16);ctx.fill();
 ctx.fillStyle='#e9c68f';rounded(ctx,c.x-43,c.y-39,86,78,14);ctx.fill();
 ctx.fillStyle='#fff3d3';ctx.beginPath();ctx.arc(c.x,c.y,18,0,TAU);ctx.fill();
 ctx.fillStyle='#293b45';ctx.font='900 15px system-ui';ctx.textAlign='center';
 ctx.fillText('CHEF',c.x,c.y+5);
 ctx.strokeStyle='#ffd777';ctx.lineWidth=3;ctx.setLineDash([9,7]);ctx.beginPath();ctx.arc(c.x,c.y,59,0,TAU);ctx.stroke();ctx.setLineDash([]);
}
function draw(ctx,time,round,ps){
 const s=round.pizzaTime;if(!s)return;
 ctx.save();ctx.clearRect(0,0,960,540);
 ctx.scale(960/s.world.w,540/s.world.h);
 scene(ctx,s);
 for(const p of active(ps)){
  if(window.PartyPlayerAvatar?.draw)window.PartyPlayerAvatar.draw(ctx,p,{time:s.clock});
  else{ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,14,0,TAU);ctx.fill();}
  const pizza=p.pizza;if(!pizza)continue;
  if(pizza.held){
    ctx.fillStyle='#fff9e9';ctx.beginPath();ctx.arc(p.x+20,p.y-29,16,0,TAU);ctx.fill();
    drawIngredient(ctx,pizza.held,p.x+20,p.y-29,11);
  }
  // Compact order card above avatar: crossed-off ONLY when physically delivered.
  const ox=p.x,oy=p.y-65;
  ctx.fillStyle='#fffaf0f0';rounded(ctx,ox-33,oy-16,66,30,10);ctx.fill();
  pizza.order.forEach((id,i)=>{
    drawIngredient(ctx,id,ox-15+i*31,oy-1,10);
    if(pizza.delivered.includes(id)){
      ctx.strokeStyle='#1f9b54';ctx.lineWidth=3;ctx.beginPath();
      ctx.moveTo(ox-24+i*31,oy+1);ctx.lineTo(ox-17+i*31,oy+8);ctx.lineTo(ox-7+i*31,oy-7);ctx.stroke();
    }
  });
 }
 for(const fx of s.effects){
  ctx.save();ctx.globalAlpha=bound(fx.life*1.6,0,1);ctx.fillStyle=fx.color;
  ctx.font='900 19px system-ui';ctx.textAlign='center';ctx.fillText(fx.text,fx.x,fx.y-(1-fx.life)*15);ctx.restore();
 }
 ctx.fillStyle='#2c302cdd';rounded(ctx,14,11,218,52,12);ctx.fill();
 ctx.fillStyle='#fff7e6';ctx.font='900 23px system-ui';ctx.textAlign='left';
 ctx.fillText('PIZZA TIME',26,34);
 ctx.font='bold 16px system-ui';
 ctx.fillText(round.phase==='countdown'?'เริ่มใน '+Math.ceil(round.countdown):
    'เหลือ '+Math.ceil(s.remaining)+' วินาที',26,53);
 ctx.restore();
}
window.PizzaTime=Object.freeze({setup,update,draw,hud,playerStatus,drawIngredient,
  worldSize,tableCount,pairCost,aStar,fairnessCandidates,ingredients:INGREDIENTS});
})();