'use strict';
/* Run with: node tests/color-switch.test.js */
const nodeAssert=require('node:assert/strict');
global.window={};
require('../combat-motion.js');
require('../character-system.js');
require('../color-switch-mayan.js');
require('../color-switch.js');
const E=global.window.ColorSwitch;

let passed=0;
function ok(condition,description){if(!condition)throw Error(description);passed++;}
function eq(actual,want,description){ok(Object.is(actual,want),description+' expected '+want+' got '+actual);}
function player(id,bot=false){return {id,color:['#ff6655','#55bbff','#ffe25d','#b288ee'][id%4],name:'P'+id,
 active:true,isBot:bot,input:{axisX:0,axisY:0,action:false,alt:false}};}
function make(count=2){const ps=Array.from({length:count},(_,i)=>player(i+1)),round={phase:'playing',paused:false,colorSeed:12345};E.setup(round,ps);return {ps,round,s:round.colorSwitch};}
function center(s,row,col){return {x:s.board.x+(col+.5)*s.size,y:s.board.y+(row+.5)*s.size};}
{
 const {ps,s}=make(6);
 eq(s.cols,11,'small width');eq(s.rows,9,'small height');eq(s.tiles.length,99,'small tiles');
 ok(s.tiles.every(t=>t.ownerId===null),'tiles begin neutral');
 eq(s.duration,60,'small timer');
 ok(ps.every(p=>p.score===0),'scores reset');
 ok(ps.every(p=>p.cs.bankedScore===0&&p.cs.territoryScore===0),'score banks reset');
 ok(ps.every(p=>p.active),'everyone active');
}
{
 const {s,ps}=make(7);
 eq(s.cols,12,'large width');eq(s.rows,10,'large height');eq(s.tiles.length,120,'large tiles');
 eq(s.duration,75,'large timer');ok(ps.every(p=>p.cs),'7 players initialized');
}
{
 const {s,ps}=make(12);
 eq(s.tiles.length,120,'12 player large map');
 ok(new Set(ps.map(p=>p.x+','+p.y)).size===12,'spawn positions unique');
 ok(ps.every(p=>p.x>=s.board.x+14&&p.x<=s.board.x+s.board.w-14),'valid spawn x');
 ok(ps.every(p=>p.y>=s.board.y+14&&p.y<=s.board.y+s.board.h-14),'valid spawn y');
}
{
 const {s,ps}=make();
 const t=s.tiles[10];
 ok(E.captureTile(s,t,ps[0],ps),'first capture');
 eq(ps[0].score,1,'first score');
 ok(!E.captureTile(s,t,ps[0],ps),'own tile no recapture');
 eq(ps[0].score,1,'no double score');
 ok(E.captureTile(s,t,ps[1],ps),'steal captured tile');
 eq(ps[0].score,0,'previous owner loses score');eq(ps[1].score,1,'new owner gains score');
 eq(t.ownerId,ps[1].id,'owner identifier');
 E.captureTile(s,t,ps[0],ps);eq(ps[0].score,1,'reclaim is allowed');eq(ps[1].score,0,'reclaim subtracts');
 const a=center(s,2,1),b=center(s,2,7);
 ps[0].x=b.x;ps[0].y=b.y;
 E.capturePathTiles(s,ps[0],ps,a.x,a.y);
 ok(s.tiles.slice(2*s.cols+1,2*s.cols+8).every(t=>t.ownerId===ps[0].id),'sweep includes each intermediate tile');
 const sum=ps.reduce((v,p)=>v+p.score,0);
 eq(sum,s.tiles.filter(t=>t.ownerId!==null).length,'score equals owned tiles');
 ok(sum<=s.tiles.length,'score cannot exceed grid');
 const counts=E.updateTerritoryScores(s,ps);
 eq(counts.get(ps[0].id),ps[0].score,'recalculate points');
}

// Footprint painting: touching the line between TWO cells captures both,
// even without movement, rather than only the tile under the avatar center.
{
 const {s,ps}=make();
 const p=ps[0],row=4,seamCol=5;
 p.x=s.board.x+seamCol*s.size;p.y=center(s,row,seamCol).y;
 const events=s.eventCounter;
 E.capturePathTiles(s,p,ps,p.x,p.y);
 eq(s.tiles[row*s.cols+seamCol-1].ownerId,p.id,'left seam tile painted');
 eq(s.tiles[row*s.cols+seamCol].ownerId,p.id,'right seam tile painted simultaneously');
 eq(p.score,2,'two touching tiles score twice');
 eq(s.eventCounter,events+2,'each tile captures once');
 E.capturePathTiles(s,p,ps,p.x,p.y);
 eq(p.score,2,'standing still does not repeatedly score owned tiles');
 eq(s.eventCounter,events+2,'stationary repeat has no paint events');
 eq(s.tiles[(row-1)*s.cols+seamCol].ownerId,null,'a distant row stays neutral');
}
// A footprint covering the intersection of FOUR tiles captures all four.
{
 const {s,ps}=make();
 const p=ps[0],row=5,col=4;
 p.x=s.board.x+col*s.size;p.y=s.board.y+row*s.size;
 E.capturePathTiles(s,p,ps,p.x,p.y);
 for(const r of [row-1,row])for(const c of [col-1,col]){
  eq(s.tiles[r*s.cols+c].ownerId,p.id,'corner overlap colors all four tiles');
 }
 eq(p.score,4,'four overlapping cells award four ownership points');
 eq(ps[1].score,0,'other player does not receive accidental points');
}
// Diagonal travel paints both side tiles at a crossed tile corner, not just
// the skinny chain of cells visited by the center of the player.
{
 const {s,ps}=make();
 const p=ps[0],from=center(s,1,1),to=center(s,6,6);
 p.x=to.x;p.y=to.y;
 E.capturePathTiles(s,p,ps,from.x,from.y);
 const touched=[[1,1],[1,2],[2,1],[2,2],[3,3],[4,4],[5,6],[6,5],[6,6]];
 for(const [r,c] of touched)
  eq(s.tiles[r*s.cols+c].ownerId,p.id,'diagonal swept disk covers '+r+','+c);
 eq(s.tiles[0*s.cols+8].ownerId,null,'distant diagonal cell remains neutral');
 eq(ps.reduce((v,q)=>v+q.score,0),
    s.tiles.filter(tile=>tile.ownerId!==null).length,'diagonal scoring equals painted cells');
}
// Swept collision detects a middle tile even if the old and new positions
// are both far outside it (prevents fast-moving gaps).
{
 const {s,ps}=make();
 const p=ps[0],from=center(s,3,1),to=center(s,3,9);
 p.x=to.x;p.y=to.y;
 E.capturePathTiles(s,p,ps,from.x,from.y);
 for(let col=1;col<=9;col++)
  eq(s.tiles[3*s.cols+col].ownerId,p.id,'continuous sweep paints intermediate col '+col);
 eq(s.tiles[7*s.cols+5].ownerId,null,'non-crossed row remains untouched');
}
// The real 60fps movement tick also captures both sides of a seam at once.
{
 const {s,ps,round}=make();
 const p=ps[0],col=5,row=4;
 p.x=s.board.x+col*s.size-2;p.y=center(s,row,col).y;
 ps[1].x=s.board.x+s.board.w-25;ps[1].y=s.board.y+24;
 p.input.axisX=1;
 E.update(1/60,round,ps);
 eq(s.tiles[row*s.cols+col-1].ownerId,p.id,'live step paints left tile');
 eq(s.tiles[row*s.cols+col].ownerId,p.id,'live step paints right tile in same frame');
 ok(p.x>s.board.x+col*s.size-2,'walking continues through seam without stopping');
}
{
 const {s,ps}=make();
 Object.assign(ps[0],center(s,4,5));Object.assign(ps[1],center(s,4,6));
 const ids=E.calculateBlastCells(s,ps[0]);
 eq(ids.length,9,'3x3 exactly nine cells');
 ok(E.activateColorBlast(s,ps[0],ps),'normal B works');
 eq(ps[0].score,9,'normal B scores 9');
 eq(ps[1].cs.stunRemaining,0,'normal B never stuns');
 eq(ps[0].cs.blastCooldown,2.8,'B cooldown begins');
 ok(!E.activateColorBlast(s,ps[0],ps),'cannot reuse B during cooldown');
 ps[0].cs.blastCooldown=0;ps[0].cs.castRemaining=0;
 ps[0].dir={x:1,y:1};
 const stillNormal=E.calculateBlastCells(s,ps[0],true);
 eq(stillNormal.length,9,'4x4 boost is removed');
 ok(E.activateColorBlast(s,ps[0],ps),'B recasts normally');
 eq(ps[1].cs.stunRemaining,0,'old 4x4 stun is removed');
}
{
 const {s,ps}=make();
 Object.assign(ps[0],center(s,4,5));Object.assign(ps[1],center(s,4,6));
 ps[0].dir={x:1,y:0};
 ok(E.startPunch(ps[0]),'punch starts');
 ok(!E.startPunch(ps[0]),'punch cooldown blocks spam');
 E.resolvePunchHit(ps[0],ps);
 eq(ps[1].cs.stunRemaining,.8,'all standard punches apply 0.8-second stun');
  eq(ps[1].stunColor,ps[0].color,'punch stun uses attacker color');
 ps[1].cs.stunRemaining=0;ps[1].cs.stunImmunity=0;
 ps[0].dir={x:-1,y:0};ps[0].attackFacing={x:-1,y:0};E.resolvePunchHit(ps[0],ps);
 eq(ps[1].cs.stunRemaining,0,'punch cannot hit behind');
 ps[0].dir={x:1,y:0};ps[0].attackFacing={x:1,y:0};ps[1].x+=120;E.resolvePunchHit(ps[0],ps);
 eq(ps[1].cs.stunRemaining,0,'punch cannot hit out of range');
}
{
 const {s,ps}=make();
 s.elapsed=11;
 ok(E.spawnPowerBox(s,ps,'score_bank'),'first bank box spawned');
 ok(E.spawnPowerBox(s,ps,'rocket'),'second rocket box spawned alongside first');
 ok(E.spawnPowerBox(s,ps,'score_bank'),'third box spawned without a cap');
 eq(s.boxes.length,3,'small map permits more than two concurrent boxes');
 const box=s.boxes[0];
 const tile=s.tiles[10];E.captureTile(s,tile,ps[0],ps);
 ps[0].x=box.x;ps[0].y=box.y;
 E.collectPowerBox(s,ps);
 eq(ps[0].cs.bankedScore,1,'box banks owned tile');
 eq(ps[0].cs.territoryScore,0,'bank clears live score');
 eq(ps[0].score,1,'bank maintains total score');
 eq(tile.ownerId,null,'bank clears color');
 eq(s.boxes.length,2,'only claimed bank box removed; others stay on map');
 E.collectPowerBox(s,ps);
 eq(ps[0].cs.bankedScore,1,'cannot collect same box twice');
 E.captureTile(s,tile,ps[0],ps);
 eq(ps[0].score,2,'repainting banked tile earns new active point');
}
{
 const {s,ps}=make(7);s.elapsed=10;
 for(let i=0;i<5;i++)ok(E.spawnPowerBox(s,ps),'large map spawns extra box '+i);
 eq(s.boxes.length,5,'large map allows five concurrent boxes without a fixed cap');
 ok(new Set(s.boxes.map(box=>box.id)).size===5,'concurrent boxes have distinct IDs');
}
{
 const {round,ps,s}=make();
 E.update(1/60,round,ps);
 const sec=s.remaining,own=ps.map(p=>p.score),before=s.elapsed;
 round.paused=true;
 for(let i=0;i<60;i++)E.update(1/60,round,ps);
 eq(s.remaining,sec,'pause freezes match remaining');
 eq(s.elapsed,before,'pause freezes simulation time');
 ok(ps.every((p,i)=>p.score===own[i]),'pause freezes captures');
 round.paused=false;E.update(1/60,round,ps);
 ok(s.elapsed>before,'resume advances simulation');
}
{
 const {round,ps,s}=make();
 const t=s.tiles[11];E.captureTile(s,t,ps[0],ps);
 const ranked=E.calculateFinalRanking(s,ps);
 eq(ranked[0].id,ps[0].id,'higher territory wins');
 eq(ranked[0].rank,1,'rank one');
 eq(ranked[1].rank,2,'rank two');
 eq(s.winnerIds[0],ps[0].id,'winner selected');
 E.captureTile(s,s.tiles[12],ps[1],ps);
 E.calculateFinalRanking(s,ps);
 eq(s.winnerIds.length,2,'tie has both winners');
 ok(s.ranking.every(p=>p.rank===1),'tied players share first place');
 s.duration=.05;
 for(let i=0;i<6;i++)E.update(1/60,round,ps);
 ok(s.finished,'timer ends round');eq(round.remaining,0,'timer freezes at zero');
 eq(E.update(1/60,round,ps),'winner','completed round returns winner');
}
{
 const {round,ps,s}=make();
 ps[0].input.axisX=1;
 ps[0].x=s.board.x+s.board.w-14;ps[0].y=s.board.y+14;
 for(let i=0;i<180;i++)E.update(1/60,round,ps);
 ok(ps[0].x<=s.board.x+s.board.w-14,'no out of bounds movement');
}
{
 const {ps,round,s}=make(12);
 for(const p of ps)p.isBot=true;
 for(let i=0;i<1800;i++){
  E.update(1/60,round,ps);
  if(i%50===0){
   const counts=ps.reduce((n,p)=>n+(p.cs?.territoryScore||0),0);
   eq(counts,s.tiles.filter(t=>t.ownerId!=null).length,'stress score consistency at tick '+i);
   ok(ps.every(p=>p.score===p.cs.bankedScore+p.cs.territoryScore),'banked total consistency '+i);
   ok(counts<=120,'stress no duplicate tile ownership at tick '+i);
  }
 }
 ok(ps.some(p=>p.score>0),'bots capture tiles');
 ok(ps.some(p=>p.cs.punchCooldown>0||p.cs.blastCooldown>0)||s.totalCaptures>80,'bots act strategically');
 ok(s.boxes.length<=2*Math.floor(s.elapsed/E.constants.boxSpawnInterval),'box count cannot exceed emitted waves');
 ok(s.effects.length<=32,'effects bounded');
}


{
 const {ps,s}=make();const [p,q]=ps;
 for(const t of s.tiles.slice(0,5))E.captureTile(s,t,p,ps);
 for(const t of s.tiles.slice(5,8))E.captureTile(s,t,q,ps);
 eq(E.bankTerritory(s,p),5,'bank five current tiles');
 eq(p.cs.bankedScore,5,'permanent bank tracks five');
 eq(p.cs.territoryScore,0,'active territory resets');
 eq(p.score,5,'HUD total unchanged after bank');
 eq(q.score,3,'opponent score untouched');
 ok(s.tiles.slice(0,5).every(t=>t.ownerId===null),'only banker tiles cleared');
 ok(s.tiles.slice(5,8).every(t=>t.ownerId===q.id),'opponent tiles untouched');
 eq(E.bankTerritory(s,p),0,'empty bank awards zero');
 E.captureTile(s,s.tiles[0],p,ps);eq(p.score,6,'repaint new active territory');
 E.captureTile(s,s.tiles[0],q,ps);eq(p.score,5,'stealing cannot reduce bank');
 E.captureTile(s,s.tiles[1],p,ps);
 E.bankTerritory(s,p);eq(p.score,6,'second bank adds only new paint');
 E.updateTerritoryScores(s,ps);eq(p.score,6,'recalculation preserves bank');
 const rank=E.calculateFinalRanking(s,ps);
 eq(rank[0].id,p.id,'winner uses bank plus current territory');
}
{
 const {ps,s,round}=make(2);const [p,q]=ps;
 const box={id:777,type:'rocket',x:s.board.x+s.size*5.5,y:s.board.y+s.size*4.5,
  active:true,expireTime:99};
 s.boxes=[box];p.x=box.x;p.y=box.y;
 q.x=box.x+115;q.y=box.y;
 E.collectPowerBox(s,ps);
 eq(s.rockets.length,8,'exactly eight rockets launch');
 eq(new Set(s.rockets.map(r=>Math.round(Math.atan2(r.vy,r.vx)*180/Math.PI))).size,8,'eight different directions');
 ok(s.rockets.every(r=>Math.abs(Math.hypot(r.vx,r.vy)-E.constants.rocketSpeed)<1e-7),'equal rocket speed');
 eq(s.boxes.length,0,'rocket box consumed once');
 for(let k=0;k<25;k++)E.updateRockets(s,ps,1/60);
 eq(q.cs.stunRemaining,1.5,'rocket stuns opponent for 1.5 seconds');
 eq(p.cs.stunRemaining,0,'rocket owner immune to own rockets');
 eq(s.rockets.filter(r=>r.id===8).length,0,'rocket removed on collision');
 E.updateRockets(s,ps,4);eq(s.rockets.length,0,'projectiles expire');
 eq(s.rocketHits.size,0,'burst collision cache cleaned');
 E.fireRocketBurst(s,{x:p.x,y:p.y},p);
 eq(s.rockets.length,8,'can fire another burst');
 E.finishMatch(s,round,ps);eq(s.rockets.length,0,'finish clears rocket projectiles');
}
{
 const {ps,s}=make(3);const p=ps[0],q=ps[1],r=ps[2];
 p.x=s.board.x+100;p.y=s.board.y+100;
 q.x=p.x+80;q.y=p.y+43;r.x=p.x+58;r.y=p.y+95;
 E.fireRocketBurst(s,{x:p.x,y:p.y},p);
 // Targets lie away from all 8 straight collision corridors.
 for(let i=0;i<10;i++)E.updateRockets(s,ps,1/60);
 eq(q.cs.stunRemaining,0,'off-axis target is not hit');
 eq(r.cs.stunRemaining,0,'second off-axis target not hit');
}
{
 const {ps,s}=make(2);const p=ps[0],q=ps[1];
 E.captureTile(s,s.tiles[9],p,ps);
 const box={id:900,type:'score_bank',x:p.x,y:p.y,active:true,expireTime:99};
 s.boxes=[box];q.x=box.x;q.y=box.y;
 E.collectPowerBox(s,ps);
 eq(p.cs.bankedScore,1,'simultaneous pickup deterministic first player');
 eq(q.cs.bankedScore,0,'other player receives no bank');
 eq(s.boxes.length,0,'box taken only once');
}


{
 // Every 12 seconds spawn exactly two fresh boxes, one rocket and one bank,
 // whether or not any old boxes have been collected. There is no timed expiry.
 for(const count of [2,6,7,12]){
  const {ps,s,round}=make(count);
  eq(s.nextBoxSpawn,12,'first wave is at 12 seconds for '+count+' players');
  let expected=0;
  for(const when of [12,24,36,48,60,72]){
   if(when>=s.duration)break;
   s.elapsed=when-1/60;s.clock=s.elapsed;
   E.update(1/60,round,ps);
   expected+=2;
   eq(s.boxes.length,expected,'uncollected boxes persist; total '+expected+' at '+when+' s with '+count+' players');
   const wave=s.boxes.slice(-2);
   eq(wave.filter(box=>box.type==='rocket').length,1,'wave has exactly one rocket at '+when+' s');
   eq(wave.filter(box=>box.type==='score_bank').length,1,'wave has exactly one bank at '+when+' s');
   ok(s.boxes.every(box=>box.active),'uncollected boxes remain active');
   ok(s.boxes.every((box,i)=>s.boxes.every((other,j)=>i===j||
       Math.hypot(box.x-other.x,box.y-other.y)>s.size*.99)),
      'boxes never overlap at '+when+' s');
   ok(new Set(s.boxes.map(box=>box.id)).size===expected,'all box ids unique at '+when+' s');
  }
 }
}
{
 // A bot must target tiles identically with or without a distant rocket or bank.
 const plain=make(2),withBoxes=make(2);
 plain.ps[0].isBot=true;withBoxes.ps[0].isBot=true;
 const field=withBoxes.s;
 field.boxes.push({id:101,type:'rocket',x:field.board.x+field.size*1.5,
  y:field.board.y+field.size*1.5,active:true,spawnTime:0});
 field.boxes.push({id:102,type:'score_bank',x:field.board.x+field.size*9.5,
  y:field.board.y+field.size*7.5,active:true,spawnTime:0});
 for(let i=0;i<20;i++){E.update(1/60,plain.round,plain.ps);E.update(1/60,withBoxes.round,withBoxes.ps);}
 eq(plain.ps[0].cs.botTarget,withBoxes.ps[0].cs.botTarget,'distant boxes do not override painting target');
 eq(plain.ps[0].x,withBoxes.ps[0].x,'bot movement not redirected by boxes');
 eq(plain.ps[0].y,withBoxes.ps[0].y,'bot path stays territory-focused');
}
{
 const {ps,round,s}=make();
 const bot=ps[0],enemy=ps[1];bot.isBot=true;
 bot.x=s.board.x+s.size*4;bot.y=s.board.y+s.size*4;
 enemy.x=bot.x+29;enemy.y=bot.y;
 bot.dir={x:1,y:0};
 ok(bot.cs.botNextPunch>=8&&bot.cs.botNextPunch<=15,'bot starts by painting, not punching');
 bot.cs.botNextPunch=0;
 E.update(1/60,round,ps);
 const delay=bot.cs.botNextPunch-s.clock;
 eq(E.constants.botPunchRate,.084,'80 percent previous bot punch reduction retained');
 ok(delay>=1.15/.084-1e-6,'defensive bot punch has reduced interval lower bound');
 ok(delay<=1.6/.084+1e-6,'defensive bot punch has reduced interval upper bound');
}
console.log('COLOR SWITCH: '+passed+' assertions passed');
