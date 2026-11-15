/* Shared real-time combat timing and VFX.
 * Any future minigame can call PartyCombatMotion.startAttack / stepAttack,
 * applyStun / drawAttack / drawStun. No Ghost Attack dependencies. */
(() => {
'use strict';
const ATTACK=Object.freeze({windup:.18,active:.1,recovery:.2,cooldown:1.05});
const NORMAL_STUN=.8;
const TOTAL=ATTACK.windup+ATTACK.active+ATTACK.recovery;
const TAU=Math.PI*2;
function reset(entity){
  entity.attackRemaining=0;entity.attackHit=false;
  entity.stunColor=null;
}
function startAttack(entity){
  if(!entity||entity.stun>0||entity.punchCooldown>0||entity.attackRemaining>0)return false;
  entity.attackRemaining=TOTAL;
  entity.attackHit=false;
  const dir=entity.dir||{x:1,y:0};
  entity.attackFacing={x:dir.x||1,y:dir.y||0};
  entity.punchCooldown=ATTACK.cooldown;
  entity.vx=0;entity.vy=0;
  return true;
}
function stepAttack(entity,dt,onImpact){
  const before=entity.attackRemaining||0;
  if(before<=0)return false;
  entity.attackRemaining=Math.max(0,before-dt);
  const threshold=ATTACK.active+ATTACK.recovery;
  if(!entity.attackHit&&before>threshold&&entity.attackRemaining<=threshold){
    entity.attackHit=true;
    if(typeof onImpact==='function')onImpact();
  }
  return true; // The attacker stays planted for the whole animation.
}
function isAttacking(entity){return !!entity&&entity.attackRemaining>0;}
function cancelAttack(entity){
  if(!entity)return;
  entity.attackRemaining=0;entity.attackHit=false;
}
function applyStun(entity,seconds,color='#ffe28a'){
  if(!entity||seconds<=0)return false;
  entity.stun=Math.max(entity.stun||0,seconds);
  entity.stunColor=color;
  cancelAttack(entity);
  return true;
}
// Only this module decides what a NORMAL punch means: one 0.8-second
// stun, colored after the attacker, and a cancelled windup for the victim.
// Game-specific boosts, traps and hazards may still have their own durations.
function applyNormalPunch(victim,attacker,opts={}){
  if(!victim||!attacker||victim===attacker||victim.id===attacker.id)return false;
  if(typeof opts.canHit==='function'&&!opts.canHit(victim))return false;
  const color=attacker.color||'#ffe28a';
  applyStun(victim,NORMAL_STUN,color);
  if(victim.cs){
    victim.cs.stunRemaining=Math.max(victim.cs.stunRemaining||0,NORMAL_STUN);
    victim.cs.punchState=null;
  }
  if('fruitStun' in victim){
    victim.fruitStun=Math.max(victim.fruitStun||0,NORMAL_STUN);
    victim.fruitAttack=null;
    victim.fruitHitFlash=Math.max(victim.fruitHitFlash||0,.3);
  }
  if(typeof opts.onHit==='function')opts.onHit(victim,attacker);
  return true;
}
function hitPlayers(attacker,players,opts={}){
  if(!attacker||!attacker.active)return [];
  const facing=attacker.attackFacing||attacker.dir||{x:1,y:0};
  const n=Math.hypot(facing.x||0,facing.y||0)||1;
  const range=Number.isFinite(opts.range)?opts.range:53;
  const coneCos=Number.isFinite(opts.coneCos)?opts.coneCos:.45;
  const maxHits=Number.isFinite(opts.maxHits)?Math.max(0,opts.maxHits):Infinity;
  const hits=(players||[]).filter(p=>p&&p.active&&p!==attacker&&p.id!==attacker.id)
    .map(p=>{
      const dx=p.x-attacker.x,dy=p.y-attacker.y,d=Math.hypot(dx,dy);
      return {player:p,distance:d,forward:d>0?(dx*facing.x+dy*facing.y)/(d*n):1};
    })
    .filter(q=>q.distance>0&&q.distance<=range&&q.forward>=coneCos)
    .sort((a,b)=>a.distance-b.distance||String(a.player.id).localeCompare(String(b.player.id)));
  const struck=[];
  for(const candidate of hits){
    if(struck.length>=maxHits)break;
    if(applyNormalPunch(candidate.player,attacker,opts))struck.push(candidate.player);
  }
  return struck;
}
function star(ctx,x,y,r,color,rotation=0){
  ctx.beginPath();
  for(let i=0;i<10;i++){
    const angle=rotation-Math.PI/2+i*Math.PI/5;
    const d=i%2===0?r:r*.44;
    const sx=x+Math.cos(angle)*d,sy=y+Math.sin(angle)*d;
    if(i===0)ctx.moveTo(sx,sy);else ctx.lineTo(sx,sy);
  }
  ctx.closePath();ctx.fillStyle=color;ctx.fill();
}
function stunTime(entity){
  if(!entity)return 0;
  if(entity.cs)return entity.cs.stunRemaining||0;
  if('fruitStun' in entity)return entity.fruitStun||0;
  return entity.stun||0;
}
function drawStun(ctx,entity,time,opts={}){
  if(!(stunTime(entity)>0))return;
  const color=entity.stunColor||'#ffe28a';
  const x0=opts.local?0:entity.x,y0=opts.local?0:entity.y;
  const t=Number.isFinite(time)?time:0;
  ctx.save();
  ctx.shadowBlur=12;ctx.shadowColor=color;
  // Colored shimmer/halo above the head, with the same attacker-colored
  // rotating stars and sparkles in EVERY minigame.
  ctx.globalAlpha=.65+.25*Math.sin(t*9);
  ctx.strokeStyle=color;ctx.lineWidth=2.2;
  ctx.beginPath();ctx.ellipse(x0,y0-43,15+Math.sin(t*8)*2,5,0,0,TAU);ctx.stroke();
  ctx.globalAlpha=1;
  for(let i=0;i<3;i++){
    const a=t*6+i*TAU/3;
    const x=x0+Math.cos(a)*22,y=y0-46+Math.sin(a)*8;
    star(ctx,x,y,5.8,color,a);
    ctx.beginPath();ctx.arc(x-Math.cos(a)*7,y-Math.sin(a)*4,2,0,TAU);
    ctx.fillStyle=color;ctx.fill();
    // Four-point sparkle flashes around the star orbit, tinted by hitter.
    const sx=x0+Math.cos(a+1.1)*12,sy=y0-45+Math.sin(a+1.1)*10;
    ctx.strokeStyle=color;ctx.lineWidth=1.4;ctx.beginPath();
    ctx.moveTo(sx-3,sy);ctx.lineTo(sx+3,sy);
    ctx.moveTo(sx,sy-3);ctx.lineTo(sx,sy+3);ctx.stroke();
  }
  ctx.restore();
}
function drawAttack(ctx,entity){
  if(!isAttacking(entity))return;
  // The canonical SVG punch has its own two-joint strike arm and fist.
  // Consume the render marker rather than drawing the legacy line over it.
  // Custom game renderers without PartyPlayerAvatar keep their old VFX.
  if(window.PartyPlayerAvatar?.consumePunchDrawn?.(entity))return;
  const elapsed=TOTAL-entity.attackRemaining;
  const progress=elapsed/TOTAL;
  const dir=entity.attackFacing||entity.dir||{x:1,y:0};
  const a=Math.atan2(dir.y,dir.x);
  ctx.save();ctx.translate(entity.x,entity.y);ctx.rotate(a);
  ctx.strokeStyle=entity.color||'#ffe6ab';
  ctx.lineCap='round';
  ctx.lineWidth=progress<ATTACK.windup/TOTAL?4:6;
  // Visible windup and forward strike, rather than an instant stun.
  const reach=progress<ATTACK.windup/TOTAL?
    10+progress*19:progress<.65?30:25-(progress-.65)*24;
  ctx.beginPath();ctx.moveTo(9,-1);ctx.lineTo(reach,-2);ctx.stroke();
  if(progress>=ATTACK.windup/TOTAL&&progress<.78){
    ctx.strokeStyle='#fff2bc';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(reach,0,15,-.7,.8);ctx.stroke();
  }
  ctx.restore();
}
window.PartyCombatMotion=Object.freeze({ATTACK,TOTAL,NORMAL_STUN,reset,startAttack,stepAttack,
  isAttacking,cancelAttack,applyStun,applyNormalPunch,hitPlayers,stunTime,drawAttack,drawStun});
})();