/* Shared real-time combat timing and VFX.
 * Any future minigame can call PartyCombatMotion.startAttack / stepAttack,
 * applyStun / drawAttack / drawStun. No Ghost Attack dependencies. */
(() => {
'use strict';
const ATTACK=Object.freeze({windup:.18,active:.1,recovery:.2,cooldown:1.05});
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
function applyStun(entity,seconds,color='#ffe28a'){
  if(!entity||seconds<=0)return;
  entity.stun=Math.max(entity.stun||0,seconds);
  entity.stunColor=color;
  entity.attackRemaining=0;entity.attackHit=false;
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
function drawStun(ctx,entity,time){
  if(!(entity.stun>0))return;
  const color=entity.stunColor||'#ffe28a';
  ctx.save();
  ctx.shadowBlur=8;ctx.shadowColor=color;
  // Orbit above the head; use attacker color for stars and trailing sparkles.
  for(let i=0;i<3;i++){
    const a=time*5+i*TAU/3;
    const x=entity.x+Math.cos(a)*22;
    const y=entity.y-47+Math.sin(a)*7;
    star(ctx,x,y,4.8,color,a);
    ctx.beginPath();ctx.arc(x-Math.cos(a)*7,y-Math.sin(a)*4,1.5,0,TAU);
    ctx.fillStyle=color;ctx.fill();
  }
  ctx.restore();
}
function drawAttack(ctx,entity){
  if(!isAttacking(entity))return;
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
window.PartyCombatMotion=Object.freeze({ATTACK,TOTAL,reset,startAttack,stepAttack,
  isAttacking,applyStun,drawAttack,drawStun});
})();