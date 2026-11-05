/* Mayan COLOR SWITCH: alternate-side skull turrets and hand-drawn ruins.
   Only the host simulates hazards; the phone receives the usual video preview. */
(() => {
'use strict';
const TAU=Math.PI*2;
const C=Object.freeze({warning:.55,stun:1,bulletSpeed:338,bulletRadius:9,
 minInterval:2.9,intervalJitter:1.05});
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
function setup(s,random=Math.random){
 const b=s.board,skulls=[];
 for(let row=0;row<s.rows;row++){
  const side=row%2===0?'left':'right';
  skulls.push({row,side,
   x:side==='left'?b.x-s.size/2:b.x+b.w+s.size/2,
   y:b.y+(row+.5)*s.size});
 }
 s.mayan={skulls,warning:null,bullets:[],nextSide:'left',
  nextVolleyAt:3.15+random(s)*.75,shots:0,hits:0,volleyHistory:[]};
 return s.mayan;
}
function beginWarning(s,random=Math.random){
 const m=s.mayan;if(!m||m.warning)return false;
 const side=m.nextSide,pool=m.skulls.filter(skull=>skull.side===side);
 if(!pool.length)return false;
 const selected=[];
 for(let i=0;i<Math.min(2,pool.length);i++){
  selected.push(pool.splice(Math.floor(random(s)*pool.length),1)[0]);
 }
 m.warning={side,rows:selected.map(skull=>skull.row),remaining:C.warning};
 return true;
}
function fireWarning(s,random=Math.random){
 const m=s.mayan,v=m?.warning;if(!v)return false;
 const b=s.board,dir=v.side==='left'?1:-1;
 for(const row of v.rows){
  m.bullets.push({row,side:v.side,x:dir===1?b.x-12:b.x+b.w+12,
   y:b.y+(row+.5)*s.size,dir,radius:C.bulletRadius});
 }
 m.shots+=v.rows.length;m.volleyHistory.push(v.side);
 if(m.volleyHistory.length>24)m.volleyHistory.shift();
 m.nextSide=v.side==='left'?'right':'left';
 m.nextVolleyAt=s.clock+C.minInterval+random(s)*C.intervalJitter;
 m.warning=null;
 return true;
}
// Segment-to-circle distance avoids passing through players at 60 FPS.
function bulletHitsPlayer(shot,oldX,player,playerRadius=14){
 const near=clamp(player.x,Math.min(oldX,shot.x),Math.max(oldX,shot.x));
 return Math.hypot(player.x-near,player.y-shot.y)<=playerRadius+shot.radius;
}
function update(dt,s,players,stun,random=Math.random){
 const m=s.mayan;if(!m||s.finished)return;
 if(m.warning){
  m.warning.remaining-=dt;
  if(m.warning.remaining<=0)fireWarning(s,random);
 }else if(s.clock>=m.nextVolleyAt)beginWarning(s,random);
 const next=[];
 for(const bullet of m.bullets){
  const lastX=bullet.x;bullet.x+=bullet.dir*C.bulletSpeed*dt;
  const target=players.find(player=>player.active&&bulletHitsPlayer(bullet,lastX,player));
  if(target){stun(target,C.stun);m.hits++;continue;}
  if(bullet.x<s.board.x-30||bullet.x>s.board.x+s.board.w+30)continue;
  next.push(bullet);
 }
 m.bullets=next;
}
function stone(ctx,x,y,size=48,angle=0){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);
 ctx.fillStyle='#333e33';ctx.fillRect(-size/2+5,-size/2+7,size,size);
 ctx.fillStyle='#b1b49b';ctx.fillRect(-size/2,-size/2,size,size);
 ctx.fillStyle='#d7d8b6';ctx.fillRect(-size/2+3,-size/2+2,size-7,6);
 ctx.strokeStyle='#66736a';ctx.lineWidth=3;
 ctx.strokeRect(-size*.3,-size*.3,size*.6,size*.6);
 ctx.strokeRect(-size*.13,-size*.13,size*.26,size*.26);ctx.restore();
}
function palm(ctx,x,y,size=1,rotation=0){
 ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.scale(size,size);
 ctx.fillStyle='#334d2b';ctx.beginPath();ctx.arc(0,4,9,0,TAU);ctx.fill();
 for(let i=0;i<9;i++){
  ctx.save();ctx.rotate(i*TAU/9);
  ctx.fillStyle=i%2?'#5fa630':'#a6ca4b';
  ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(20,-18,49,1);
  ctx.quadraticCurveTo(25,2,0,7);ctx.fill();
  ctx.strokeStyle='#d4db73';ctx.lineWidth=.9;
  ctx.beginPath();ctx.moveTo(2,2);ctx.lineTo(46,1);ctx.stroke();ctx.restore();
 }ctx.restore();
}
function drawGround(ctx,s){
 const b=s.board;
 ctx.fillStyle='#548d1f';ctx.fillRect(0,0,960,540);
 for(let i=0;i<95;i++){
  const x=(i*131+35)%960,y=(i*79+13)%540;
  ctx.fillStyle=i%3?'#649f2b':'#3d7f23';
  ctx.beginPath();ctx.arc(x,y,5+i%7,0,TAU);ctx.fill();
 }
 for(const a of [[65,145,59,-.14],[888,128,65,.21],[73,445,50,.25],[898,423,60,-.1]])
  stone(ctx,...a);
 for(const a of [[31,24,1.12,.15],[193,2,.9,-.3],[935,23,1.2,.4],
   [23,514,1.3,-.2],[940,511,1.17,.2],[788,545,.8,.45]])palm(ctx,...a);
 ctx.fillStyle='#333a31';ctx.fillRect(b.x-10,b.y-9,b.w+20,b.h+18);
 ctx.fillStyle='#c2b392';ctx.fillRect(b.x-7,b.y-7,b.w+14,b.h+14);
 ctx.fillStyle='#5c5446';ctx.fillRect(b.x-3,b.y-3,b.w+6,b.h+6);
 ctx.fillStyle='#ddc599';
 for(let col=0;col<s.cols;col++){
  ctx.fillRect(b.x+col*s.size+5,b.y-7,s.size-10,3);
  ctx.fillRect(b.x+col*s.size+5,b.y+b.h+4,s.size-10,3);
 }
}
function skull(ctx,x,y,flashing){
 ctx.save();ctx.translate(x,y);
 if(flashing){ctx.fillStyle='#ffb04388';ctx.beginPath();ctx.arc(0,0,23,0,TAU);ctx.fill();}
 ctx.fillStyle='#2c302b';ctx.fillRect(-17,-15,35,33);
 ctx.fillStyle='#f1ecda';ctx.beginPath();ctx.moveTo(-18,-7);
 ctx.quadraticCurveTo(-19,-22,0,-22);ctx.quadraticCurveTo(20,-22,19,-7);
 ctx.lineTo(13,13);ctx.lineTo(-13,13);ctx.closePath();ctx.fill();
 ctx.fillStyle='#152024';ctx.beginPath();
 ctx.arc(-8,-5,6,0,TAU);ctx.arc(8,-5,6,0,TAU);ctx.fill();
 ctx.beginPath();ctx.moveTo(0,1);ctx.lineTo(-4,7);ctx.lineTo(4,7);ctx.closePath();ctx.fill();
 ctx.fillStyle='#eee6d0';ctx.fillRect(-12,11,24,8);
 ctx.strokeStyle='#344239';ctx.lineWidth=1.2;
 for(let x=-7;x<=8;x+=5){ctx.beginPath();ctx.moveTo(x,12);ctx.lineTo(x,19);ctx.stroke();}
 ctx.restore();
}
function drawDevices(ctx,s){
 const m=s.mayan,b=s.board,z=s.size;
 if(!m)return;
 for(let row=0;row<s.rows;row++)for(const side of ['left','right']){
  const x=side==='left'?b.x-z:b.x+b.w,y=b.y+row*z;
  const turret=m.skulls.find(k=>k.side===side&&k.row===row);
  ctx.fillStyle=turret?'#b64836':'#bbd43b';
  ctx.fillRect(x,y,z,z);
  ctx.fillStyle='#3f442e';ctx.fillRect(x+2,y+z-5,z-4,3);
  ctx.strokeStyle='#d5db9b';ctx.lineWidth=1;ctx.strokeRect(x+5,y+5,z-10,z-10);
  if(turret)skull(ctx,turret.x,turret.y,
    m.warning?.side===side&&m.warning.rows.includes(row));
 }
 if(m.warning){
  const amount=1-clamp(m.warning.remaining/C.warning,0,1);
  ctx.save();ctx.globalAlpha=.18+amount*.6;
  for(const row of m.warning.rows){
   const y=b.y+(row+.5)*z;
   ctx.fillStyle='#fff1a0';ctx.fillRect(b.x,y-3,b.w,6);
   ctx.fillStyle='#ff612d';ctx.fillRect(b.x,y-1,b.w,2);
  }ctx.restore();
 }
}
function drawBullets(ctx,s){
 if(!s.mayan)return;
 for(const bullet of s.mayan.bullets){
  ctx.save();ctx.translate(bullet.x,bullet.y);
  ctx.fillStyle='#ff763b77';ctx.beginPath();ctx.arc(0,0,C.bulletRadius+7,0,TAU);ctx.fill();
  ctx.fillStyle='#fff2ad';ctx.beginPath();ctx.arc(0,0,C.bulletRadius,0,TAU);ctx.fill();
  ctx.fillStyle='#e57924';ctx.beginPath();ctx.arc(-bullet.dir*3,2,C.bulletRadius*.5,0,TAU);ctx.fill();
  ctx.restore();
 }
}
window.ColorSwitchMayan=Object.freeze({setup,beginWarning,fireWarning,bulletHitsPlayer,
 update,drawGround,drawDevices,drawBullets,constants:C});
})();