/* LAWN MOWER — host-authoritative timed lawn-cutting race.
   Every clump is independently cuttable once, and only the Host awards suns. */
(() => {
'use strict';
const TAU=Math.PI*2, STEP=1/60, CELL=24;
const CONFIG=Object.freeze({small:{w:960,h:540},large:{w:1280,h:720},
  speed:50.75,bodyRadius:17,mowerHalfWidth:22,mowerHalfLength:31,
  bladeHalfWidth:15,bladeStart:16,bladeDepth:28,
  smallDuration:30,largeDuration:60,sunValue:5});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const active=ps=>ps.filter(p=>p.active);
const rand=s=>{let v=s.seed|0;v^=v<<13;v^=v>>>17;v^=v<<5;s.seed=v||0x324a8b37;return (s.seed>>>0)/4294967296;};
const random=(s,a,b)=>a+(b-a)*rand(s);
function size(n){return n<=6?{...CONFIG.small,kind:'small'}:{...CONFIG.large,kind:'large'};}
function plot(s){return {x:Math.round(s.w*.26),y:Math.round(s.h*.105),w:Math.round(s.w*.493),h:Math.round(s.h*.79)};}
function key(x,y){return x+':'+y;}
function cell(s,x,y){return key(Math.floor((x-s.field.x)/CELL),Math.floor((y-s.field.y)/CELL));}
function generateGrass(s){
 const f=s.field;
 const gap=15.5;
 for(let y=f.y+9;y<f.y+f.h-7;y+=gap)for(let x=f.x+8;x<f.x+f.w-6;x+=gap){
  const px=clamp(x+random(s,-7,7),f.x+3,f.x+f.w-3);
  const py=clamp(y+random(s,-7,7),f.y+3,f.y+f.h-3);
  const tuft={id:s.grass.length,x:px,y:py,cut:false,variant:Math.floor(rand(s)*5),
    rotation:rand(s)*TAU,size:random(s,8,12)};
  s.grass.push(tuft);
  const id=cell(s,px,py),bucket=s.grid.get(id)||[];
  bucket.push(tuft.id);s.grid.set(id,bucket);
 }
}
function spawnPositions(s,n){
 const cx=s.field.x+s.field.w/2,cy=s.field.y+s.field.h/2;
 return Array.from({length:n},(_,i)=>{
  const a=-Math.PI/2+i*TAU/n,rx=n===1?0:s.field.w*.33,ry=n===1?0:s.field.h*.29;
  return {x:cx+Math.cos(a)*rx,y:cy+Math.sin(a)*ry,heading:a+Math.PI/2};
 });
}
function setup(round,players){
 if(players.length<1||players.length>12)throw Error('LAWN MOWER supports 1–12 players');
 window.PartyCharacters.activate(players);
 const ps=active(players),world=size(ps.length),duration=ps.length<=6?CONFIG.smallDuration:CONFIG.largeDuration;
 const seed=(Number(round.lawnSeed)||(Date.now()^0x62b72d))>>>0||1;
 const s={w:world.w,h:world.h,kind:world.kind,field:null,roster:ps,grass:[],grid:new Map(),
  seed,duration,remaining:duration,elapsed:0,accumulator:0,finished:false,
  effects:[],ranking:[],winnerIds:[],dirty:new Set(),tileCache:new Map(),background:null};
 s.field=plot(s);
 generateGrass(s);
 const starts=spawnPositions(s,ps.length);
 ps.forEach((p,i)=>{
  const at=starts[i];p.x=at.x;p.y=at.y;p.vx=0;p.vy=0;p.score=0;
  p.dir={x:Math.cos(at.heading),y:Math.sin(at.heading)};p.face=p.dir.x<0?-1:1;
  p.mower={heading:at.heading,moving:false,cutCount:0,suns:0,botTarget:null,
    botReplan:0,botStuck:0,previousX:p.x,previousY:p.y,velocity:0};
 });
 round.lawnMower=s;round.remaining=duration;
 return s;
}
function award(s,p,tuft){
 const q=p.mower; q.cutCount++;
 // Probability bands: 55% nothing, 20% one sun, 15% two, 10% three.
 const r=rand(s),amount=r<.55?0:r<.75?1:r<.90?2:3;
 if(amount>0){
  p.score+=amount*CONFIG.sunValue;q.suns+=amount;
  if(s.effects.length>36)s.effects.shift();
  s.effects.push({x:tuft.x,y:tuft.y,life:.76,maxLife:.76,count:amount,color:p.color});
 }
 return amount;
}
function cutTuft(s,p,tuft){
 if(tuft.cut)return false;
 tuft.cut=true;s.cutTotal=(s.cutTotal||0)+1;
 if(s.cutTotal===s.grass.length)s.grassExhausted=true;
 // A blade may change leaves that straddle a cached tile boundary.
 for(const ox of [-13,0,13])for(const oy of [-13,0,13])
  s.dirty.add(tileId(s,tuft.x+ox,tuft.y+oy));
 award(s,p,tuft);return true;
}
function nearby(s,minX,minY,maxX,maxY){
 const f=s.field,out=new Set(),a=Math.floor((minX-f.x)/CELL),b=Math.floor((maxX-f.x)/CELL);
 const c=Math.floor((minY-f.y)/CELL),d=Math.floor((maxY-f.y)/CELL);
 for(let cy=c;cy<=d;cy++)for(let cx=a;cx<=b;cx++){
  const ids=s.grid.get(key(cx,cy));if(ids)for(const id of ids)out.add(id);
 }
 return out;
}
function cutSwath(s,p,fromX,fromY){
 const q=p.mower,dx=p.x-fromX,dy=p.y-fromY;
 if(Math.hypot(dx,dy)<.025)return 0;
 const h=q.heading,c=Math.cos(h),t=Math.sin(h);
 const minX=Math.min(p.x,fromX)-48,maxX=Math.max(p.x,fromX)+48;
 const minY=Math.min(p.y,fromY)-48,maxY=Math.max(p.y,fromY)+48;
 let n=0;
 for(const id of nearby(s,minX,minY,maxX,maxY)){
  const tuft=s.grass[id];if(!tuft||tuft.cut)continue;
  // The blade is a narrow strip at the FRONT of the rendered mower deck.
  // Previously the 42px-wide, 29px-deep sweep cleared grass across most
  // of the chassis, so crowds could mow an entire lawn far too quickly.
  // A tuft may be cut only when the moving blade actually passes over it.
  const l2=dx*dx+dy*dy;
  const u=clamp(((tuft.x-fromX)*dx+(tuft.y-fromY)*dy)/l2,0,1);
  const vx=tuft.x-(fromX+u*dx),vy=tuft.y-(fromY+u*dy);
  const along=vx*c+vy*t,side=-vx*t+vy*c;
  if(along>=CONFIG.bladeStart&&along<=CONFIG.bladeDepth&&Math.abs(side)<=CONFIG.bladeHalfWidth){
   if(cutTuft(s,p,tuft))n++;
  }
 }
 return n;
}
function angleDiff(a,b){return Math.atan2(Math.sin(b-a),Math.cos(b-a));}
function chooseBot(s,p){
 const q=p.mower,others=s.roster.filter(t=>t!==p&&t.active);
 let best=null,bestScore=-Infinity,tries=0;
 // Scan uncut clumps, score nearby clusters and avoid neighbours already mowing
 // the same patch. No knowledge of unrevealed sun rewards is used.
 for(const grass of s.grass){
  if(grass.cut)continue;
  if((grass.id+q.cutCount)%3!==0)continue;
  const d=Math.hypot(grass.x-p.x,grass.y-p.y);
  let crowd=0;
  for(const other of others){const od=Math.hypot(grass.x-other.x,grass.y-other.y);if(od<52)crowd+=(52-od)*.42;}
  let density=0;
  for(const id of nearby(s,grass.x-26,grass.y-26,grass.x+26,grass.y+26))
   if(!s.grass[id].cut)density++;
  const score=density*4.4-d*.13-crowd+((grass.id*17)%23)*.05;
  if(score>bestScore){bestScore=score;best=grass;}
  if(++tries>2100)break;
 }
 q.botTarget=best?.id??null;q.botReplan=.9+rand(s)*.35;
}
function botControl(s,p,dt){
 const q=p.mower;q.botReplan-=dt;
 const target=s.grass[q.botTarget];
 if(q.botReplan<=0||!target||target.cut)chooseBot(s,p);
 const g=s.grass[q.botTarget];if(!g)return {x:0,y:0};
 let x=g.x-p.x,y=g.y-p.y;
 // Keep steering away from directly overlapping cars, don't tunnel through.
 for(const other of s.roster){
  if(other===p||!other.active)continue;
  const vx=p.x-other.x,vy=p.y-other.y,d=Math.hypot(vx,vy);
  if(d>0&&d<46){x+=vx/d*(46-d)*3;y+=vy/d*(46-d)*3;}
 }
 const f=s.field,pad=30;
 if(p.x<f.x+pad)x+=((f.x+pad)-p.x)*3;
 if(p.x>f.x+f.w-pad)x-=((p.x)-(f.x+f.w-pad))*3;
 if(p.y<f.y+pad)y+=((f.y+pad)-p.y)*3;
 if(p.y>f.y+f.h-pad)y-=((p.y)-(f.y+f.h-pad))*3;
 const d=Math.hypot(x,y);
 return d>2?{x:x/d,y:y/d}:{x:0,y:0};
}
function steer(p,input,dt){
 const q=p.mower,strength=Math.min(1,Math.hypot(input.x,input.y));
 q.moving=strength>.075;
 if(!q.moving)return {x:0,y:0};
 const direction=Math.atan2(input.y,input.x);
 q.heading+=clamp(angleDiff(q.heading,direction),-dt*10,dt*10);
 return {x:Math.cos(q.heading)*strength,y:Math.sin(q.heading)*strength};
}
/* Physical chassis is 44x62 world units, matching the rendered mower/wheels.
   Resolve both players and their machines, never only their center circles. */
function mowerAxes(p){
 const h=p.mower.heading,fx=Math.cos(h),fy=Math.sin(h);
 return {fx,fy,sx:-fy,sy:fx};
}
function mowerExtents(p){
 const v=mowerAxes(p),l=CONFIG.mowerHalfLength,w=CONFIG.mowerHalfWidth;
 return {x:Math.abs(v.fx)*l+Math.abs(v.sx)*w,
         y:Math.abs(v.fy)*l+Math.abs(v.sy)*w};
}
function constrainMower(s,p,x,y){
 const e=mowerExtents(p),f=s.field;
 return {x:clamp(x,f.x+e.x,f.x+f.w-e.x),
         y:clamp(y,f.y+e.y,f.y+f.h-e.y)};
}
function mowerOverlap(a,b){
 const av=mowerAxes(a),bv=mowerAxes(b),dx=b.x-a.x,dy=b.y-a.y;
 const axes=[[av.fx,av.fy],[av.sx,av.sy],[bv.fx,bv.fy],[bv.sx,bv.sy]];
 let best=null,minimum=Infinity;
 for(const [x,y] of axes){
  const ra=CONFIG.mowerHalfLength*Math.abs(av.fx*x+av.fy*y)+
           CONFIG.mowerHalfWidth*Math.abs(av.sx*x+av.sy*y);
  const rb=CONFIG.mowerHalfLength*Math.abs(bv.fx*x+bv.fy*y)+
           CONFIG.mowerHalfWidth*Math.abs(bv.sx*x+bv.sy*y);
  const projection=dx*x+dy*y,overlap=ra+rb-Math.abs(projection);
  if(overlap<=1e-7)return null;
  if(overlap<minimum){
   const sign=projection<0?-1:1;
   minimum=overlap;best={nx:x*sign,ny:y*sign,depth:overlap};
  }
 }
 return best;
}
function resolveMowerCollisions(s,people){
 const cars=people.filter(p=>p.active&&p.mower).slice()
  .sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 let contacts=0;
 for(let pass=0;pass<18;pass++){
  let worst=0;
  for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){
   const a=cars[i],b=cars[j],hit=mowerOverlap(a,b);
   if(!hit)continue;
   const {nx,ny,depth}=hit;
   worst=Math.max(worst,depth);contacts++;
   const full=depth+.012;
   const move=(p,d)=>{
    const beforeX=p.x,beforeY=p.y;
    const q=constrainMower(s,p,p.x+nx*d,p.y+ny*d);
    p.x=q.x;p.y=q.y;
    return (p.x-beforeX)*nx+(p.y-beforeY)*ny;
   };
   const aMove=move(a,-full*.5),bMove=move(b,full*.5);
   let remaining=full-(bMove-aMove);
   if(remaining>.0001){
    remaining+=move(a,-remaining);
    if(remaining>.0001)move(b,remaining);
   }
  }
  if(worst<.00005)break;
 }
 return contacts;
}
function step(dt,round,ps){
 const s=round.lawnMower;if(!s||s.finished)return;
 dt=Math.min(Math.max(0,dt),s.remaining);
 if(!dt){finish(s,round,ps);return;}
 s.elapsed+=dt;s.remaining=Math.max(0,s.duration-s.elapsed);round.remaining=s.remaining;
 const people=active(ps),from=new Map();
 for(const p of people){
  from.set(p.id,{x:p.x,y:p.y});
  const input=p.isBot?botControl(s,p,dt):window.PartyCharacters.control(p.input);
  const dir=steer(p,input,dt);
  const center=constrainMower(s,p,p.x,p.y);p.x=center.x;p.y=center.y;
  window.PartyCharacters.move(p,dir,dt,{speed:CONFIG.speed,radius:CONFIG.bodyRadius,
   bounds:s.field,boundaryRadius:0,constrain:(car,x,y)=>constrainMower(s,car,x,y),
   lockHeading:true});
  p.dir={x:Math.cos(p.mower.heading),y:Math.sin(p.mower.heading)};
  p.face=p.dir.x<0?-1:1;
 }
 resolveMowerCollisions(s,people);
 for(const p of people){
  const v=from.get(p.id),q=p.mower;
  p.vx=(p.x-v.x)/dt;p.vy=(p.y-v.y)/dt;
  q.velocity=Math.hypot(p.vx,p.vy);
  const advancing=(p.x-v.x)*Math.cos(q.heading)+(p.y-v.y)*Math.sin(q.heading);
  if(q.moving&&q.velocity>1&&advancing>.035)cutSwath(s,p,v.x,v.y);
  q.previousX=p.x;q.previousY=p.y;
 }
 for(const e of s.effects)e.life-=dt;
 s.effects=s.effects.filter(e=>e.life>0);
 if(s.grassExhausted||s.cutTotal===s.grass.length)finish(s,round,people,'cleared');
 else if(s.remaining<=1e-8)finish(s,round,people,'timeout');
}
function update(dt,round,ps){
 const s=round.lawnMower;if(!s)return null;
 if(s.finished)return 'winner';
 if(round.paused||round.phase!=='playing')return null;
 s.accumulator=Math.min(.26,s.accumulator+clamp(Number(dt)||0,0,.26));
 for(let n=0;s.accumulator>=STEP-1e-9&&n<16&&!s.finished;n++){
  step(STEP,round,ps);s.accumulator-=STEP;
 }
 return s.finished?'winner':null;
}
function finish(s,round,ps,reason){
 if(s.finished)return;
 s.finished=true;s.finishReason=reason||((s.cutTotal||0)>=s.grass.length?'cleared':'timeout');
 s.remaining=0;round.remaining=0;
 const people=active(ps).sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));
 s.ranking=people.map(p=>({id:p.id,score:p.score,rank:1+people.filter(t=>t.score>p.score).length}));
 const top=people[0]?.score??0;s.winnerIds=people.filter(p=>p.score===top).map(p=>p.id);
}
function hud(ps,round){
 const s=round.lawnMower;return {survivors:active(ps).length,remaining:s?.remaining||0,
  scores:active(ps).map(p=>({id:p.id,score:p.score||0})),winnerIds:s?.winnerIds||[]};
}
function playerStatus(p){
 return p.mower?{mode:'lawn_mower',id:p.id,score:p.score||0,suns:p.mower.suns||0}:null;
}
function rect(g,x,y,w,h,fill){g.fillStyle=fill;g.fillRect(x,y,w,h);}
function disk(g,x,y,r,fill){g.fillStyle=fill;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();}
function path(g,points,fill,stroke,width){
 g.beginPath();g.moveTo(points[0][0],points[0][1]);
 for(let i=1;i<points.length;i++)g.lineTo(points[i][0],points[i][1]);
 g.closePath();
 if(fill){g.fillStyle=fill;g.fill();}
 if(stroke){g.strokeStyle=stroke;g.lineWidth=width||1;g.stroke();}
}
function drawGrass(g,tuft,short=false){
 if(window.ReferenceArenaArt?.grass(g,tuft,short))return;
 const x=tuft.x,y=tuft.y,size=tuft.size*(short?.28:1);
 const tones=short?['#78ad35','#91bc48','#6c9d35']:['#1f6928','#328b29','#3caa27','#58be31','#79d83c'];
 g.save();g.translate(x,y);g.rotate(tuft.rotation);
 // Multiple tapered leaves give each clump texture instead of a flat stamp.
 for(let i=0;i<(short?3:8);i++){
  const a=i*TAU/(short?3:8)+tuft.variant*.11;
  const len=size*(.76+((i*3+tuft.variant)%5)*.12);
  const ox=Math.cos(a),oy=Math.sin(a);
  g.beginPath();g.moveTo(-ox*2,-oy*2);
  g.quadraticCurveTo(-oy*len*.26+ox*len*.65,ox*len*.26+oy*len*.65,ox*len,oy*len);
  g.quadraticCurveTo(oy*len*.18+ox*len*.5,-ox*len*.18+oy*len*.5,0,0);
  g.fillStyle=tones[(tuft.variant+i)%tones.length];g.fill();
 }
 g.restore();
}
const TILE=128;
function tileId(s,x,y){return key(Math.floor((x-s.field.x)/TILE),Math.floor((y-s.field.y)/TILE));}
function tileData(s,id){
 const parts=id.split(':').map(Number);
 const x=s.field.x+parts[0]*TILE,y=s.field.y+parts[1]*TILE;
 const w=Math.min(TILE,s.field.x+s.field.w-x),h=Math.min(TILE,s.field.y+s.field.h-y);
 return {x,y,w,h};
}
function canvas(w,h){
 if(typeof document==='undefined'||!document.createElement)return null;
 const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c;
}
function grassTile(s,id){
 const tile=tileData(s,id),off=canvas(tile.w,tile.h);
 if(!off)return null;
 const g=off.getContext('2d');if(!g)return null;
 g.translate(-tile.x,-tile.y);
 rect(g,tile.x,tile.y,tile.w,tile.h,'#408e26');
 // Blending short turf and dark sod under cropped plants.
 for(const id of nearby(s,tile.x-14,tile.y-14,tile.x+tile.w+14,tile.y+tile.h+14)){
  const tuft=s.grass[id];
  if(tuft.x<tile.x-14||tuft.x>tile.x+tile.w+14||tuft.y<tile.y-14||tuft.y>tile.y+tile.h+14)continue;
  if(tuft.cut){disk(g,tuft.x,tuft.y,9,'#65a934');drawGrass(g,tuft,true);}
  else{disk(g,tuft.x+1,tuft.y+2,5,'#286a27');drawGrass(g,tuft);}
 }
 return off;
}
function drawLawn(g,s){
 // Replace the first-frame canvas fallback once the SVG atlas has loaded.
 const revision=window.ReferenceArenaArt?.grassRevision||0;
 if(s.svgGrassRevision!==revision){s.tileCache.clear();s.svgGrassRevision=revision;}
 const f=s.field;
 rect(g,f.x-5,f.y-5,f.w+10,f.h+10,'#426923');
 rect(g,f.x,f.y,f.w,f.h,'#408e26');
 const cols=Math.ceil(f.w/TILE),rows=Math.ceil(f.h/TILE);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  const id=key(x,y),tile=tileData(s,id);
  if(!s.tileCache.has(id)||s.dirty.has(id)){s.tileCache.set(id,grassTile(s,id));s.dirty.delete(id);}
  const off=s.tileCache.get(id);
  if(off)g.drawImage(off,tile.x,tile.y);
  else{for(const tuft of s.grass)if(tuft.x>=tile.x&&tuft.x<tile.x+tile.w&&tuft.y>=tile.y&&tuft.y<tile.y+tile.h)drawGrass(g,tuft,tuft.cut);}
 }
}
function drawBackground(g,s){
 const w=s.w,h=s.h,f=s.field,houseW=f.x-39;
 rect(g,0,0,w,h,'#568f30');
 // Neighbouring garden, tree canopy and soil under the turf.
 rect(g,f.x-12,f.y-15,f.w+27,f.h+30,'#755d32');
 for(let i=0;i<25;i++){
  const x=(i*.123456789%1)*w,y=i%2?h-15:14;
  disk(g,x,y,25+(i%4)*7,i%2?'#2c7c2e':'#4a9a2c');
  disk(g,x-11,y-3,15,'#5ea52d');
 }
 // Old brick home at left; walls, wooden roof and veranda.
 rect(g,10,40,houseW-12,h-79,'#cfb484');
 rect(g,20,49,houseW-28,h-100,'#7c4936');
 for(let y=59;y<h-58;y+=21){
  g.strokeStyle='#543528';g.lineWidth=2;g.beginPath();g.moveTo(21,y);g.lineTo(houseW-10,y);g.stroke();
  for(let x=25+(Math.floor(y/21)%2)*13;x<houseW-20;x+=43){
   g.beginPath();g.moveTo(x,y-19);g.lineTo(x,y);g.stroke();
  }
 }
 rect(g,houseW-40,h*.28,48,h*.46,'#e3d2a1');
 rect(g,houseW-34,h*.32,32,h*.36,'#90512e');
 for(let y=h*.33;y<h*.65;y+=18)rect(g,houseW-33,y,30,3,'#c99452');
 path(g,[[0,36],[houseW-8,24],[houseW+4,66],[0,82]],'#a86c4e','#e2b98a',4);
 for(let i=0;i<14;i++)rect(g,(i*21)%houseW,45+(i%2)*3,18,3,'#71412d');
 // Cobblestone strip in front of the home.
 const pathX=houseW+5,pathW=f.x-pathX;
 rect(g,pathX,33,pathW,h-65,'#b8a983');
 for(let i=0;i<Math.ceil((h-80)/38);i++){
  const y=44+i*38,x=pathX+((i%2)*10);
  rect(g,x+2,y,Math.max(6,pathW-8),31,i%3?'#dbd3ac':'#c7c4a0');
  g.strokeStyle='#93896f';g.lineWidth=1.5;g.strokeRect(x+2,y,Math.max(6,pathW-8),31);
 }
 // Right walkway is narrow; street gives the scene depth and clear boundaries.
 const stoneX=f.x+f.w+5,stoneW=w*.078;
 rect(g,stoneX,31,stoneW,h-62,'#c7bca0');
 for(let y=35,i=0;y<h-45;y+=64,i++){
  rect(g,stoneX+4,y,stoneW-8,59,i%2?'#dfd7b9':'#e9e0c6');
  g.strokeStyle='#9b957a';g.lineWidth=1.7;g.strokeRect(stoneX+4,y,stoneW-8,59);
  disk(g,stoneX+18+i%3*13,y+24,5,'#bbb49a');
 }
 const roadX=stoneX+stoneW+2;
 rect(g,roadX,0,w-roadX,h,'#b8c3bb');
 for(let i=0;i<6;i++){
  g.strokeStyle=i%2?'#9daea3':'#c9d0c8';g.lineWidth=1;
  g.beginPath();g.moveTo(roadX+(w-roadX)*i/6,0);g.lineTo(roadX+(w-roadX)*i/6,h);g.stroke();
 }
 rect(g,w-16,0,16,h,'#e9e8d9');
 for(let y=7;y<h;y+=100)rect(g,w-16,y,16,48,'#e55048');

}

// Patio furniture and flowerbeds OVERLAP the lawn edge. Paint them *after*
// the grass tiles, or the opaque tile/background rectangles conceal them.
function drawGardenDecorations(g,s){
 if(window.ReferenceArenaArt?.lawn(g,s,true))return;
 const w=s.w,h=s.h,f=s.field,houseW=f.x-39;
 // Patio umbrella: foreground above grass, not below the tile cache.
 const ux=houseW+13,uy=h-40;
 disk(g,ux,uy,66,'#b33832');
 for(let k=0;k<8;k++){
  const a=k*TAU/8;
  path(g,[[ux,uy],[ux+65*Math.cos(a),uy+65*Math.sin(a)],[ux+65*Math.cos(a+TAU/8),uy+65*Math.sin(a+TAU/8)]],
   k%2===0?'#fff3d7':'#eb4942');
 }
 disk(g,ux,uy,5,'#a6442a');
 // Small flowers along the edging, never part of the score system.
 for(let i=0;i<16;i++){
  const x=f.x+10+(i*173%Math.floor(f.w-20));
  const y=i%2?f.y-9:f.y+f.h+9;
  disk(g,x,y,5,'#4b992e');for(let a=0;a<5;a++)disk(g,x+5*Math.cos(a*TAU/5),y+5*Math.sin(a*TAU/5),2.5,'#fce87c');
  disk(g,x,y,2.3,'#e98b3c');
 }
}
function background(s){
 if(!s.background){s.background=canvas(s.w,s.h);if(s.background){const g=s.background.getContext('2d');if(g)drawBackground(g,s);}}
 return s.background;
}
function drawMower(g,p,time){
 const m=p.mower;if(!m)return;
 if(window.ReferenceArenaArt?.mower(g,p,time))return;
 const color=p.color||'#4de0aa';
 g.save();g.translate(p.x,p.y);g.rotate(m.heading+Math.PI/2);
 g.fillStyle='rgba(18,44,16,.27)';g.beginPath();g.ellipse(3,5,22,29,.1,0,TAU);g.fill();
 for(const sx of [-1,1])for(const sy of [-1,1]){
  rect(g,sx*16-5,sy*17-8,9,16,'#262e36');rect(g,sx*16-3,sy*17-5,5,9,'#777e80');
 }
 rect(g,-16,-26,32,27,'#283f32');rect(g,-15,-25,30,25,color);
 rect(g,-12,-25,24,8,'#e0e9b5');
 disk(g,0,-12,8,'#274133');disk(g,0,-12,5,'#a5bd9c');
 rect(g,-12,2,24,21,'#253b33');rect(g,-11,3,22,19,color);
 rect(g,-10,4,20,5,'#eff0cf');
 g.strokeStyle='#394344';g.lineWidth=4;g.beginPath();g.moveTo(-12,18);g.lineTo(-14,30);g.lineTo(14,30);g.lineTo(12,18);g.stroke();
 // Driver's head and arms visible above the machine.
 disk(g,0,12,11,'#f4ca9e');
 disk(g,-3,10,1.4,'#304338');disk(g,3,10,1.4,'#304338');
 rect(g,-9,18,18,7,color);
 g.fillStyle='#fff';g.font='bold 10px system-ui';g.textAlign='center';
 g.fillText(String(p.name||'').slice(0,11),0,-37);
 if(m.moving){
  g.strokeStyle='#dceab9';g.lineWidth=1.3;g.globalAlpha=.35+.2*Math.sin(time*16);
  g.beginPath();g.moveTo(-12,-32);g.lineTo(-17,-37);g.moveTo(12,-32);g.lineTo(18,-38);g.stroke();
 }
 g.restore();
}
function drawSun(g,x,y,r){
 if(window.ReferenceArenaArt?.sun(g,x,y,r))return;
 g.save();g.translate(x,y);g.fillStyle='#f8b62d';
 for(let i=0;i<10;i++){const a=i*TAU/10;g.save();g.rotate(a);rect(g,-1.8,-r-6,3.6,7,'#ffe16d');g.restore();}
 disk(g,0,0,r+2,'#d68c1a');disk(g,0,0,r,'#ffd94f');disk(g,-r*.21,-r*.21,r*.24,'#fff4a2');
 g.restore();
}
function draw(ctx,time,round,ps){
 const s=round.lawnMower;if(!s)return;
 ctx.save();ctx.scale(960/s.w,540/s.h);
 if(!window.ReferenceArenaArt?.lawn(ctx,s)){
  const off=background(s);if(off)ctx.drawImage(off,0,0);else drawBackground(ctx,s);
 }
 drawLawn(ctx,s);
 drawGardenDecorations(ctx,s);
 for(const p of active(ps))drawMower(ctx,p,time);
 for(const e of s.effects){
  const t=1-e.life/e.maxLife;
  ctx.save();ctx.globalAlpha=clamp(e.life*1.8,0,1);
  for(let k=0;k<e.count;k++)drawSun(ctx,e.x+(k-(e.count-1)/2)*18,
    e.y-16-t*30-4*Math.sin(t*Math.PI),6.5);
  ctx.fillStyle='#fffce4';ctx.textAlign='center';ctx.font='bold 12px system-ui';
  ctx.fillText('+'+(e.count*5),e.x,e.y-32-t*30);ctx.restore();
 }
 // Arena size is reflected by the field itself; no top-left status panel.
 ctx.restore();
}
window.LawnMower=Object.freeze({resultTitle:"ผู้สะสมพระอาทิตย์มากที่สุด!",countdownSeconds:3,setup,update,draw,hud,playerStatus,step,finish,cutSwath,cutTuft,
  spawnPositions,generateGrass,botControl,size,mowerOverlap,mowerExtents,constrainMower,resolveMowerCollisions,config:CONFIG});
})();
