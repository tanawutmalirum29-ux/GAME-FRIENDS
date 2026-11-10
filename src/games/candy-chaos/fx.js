/* Pooled particles + floating score text. Capped, so low-end phones stay smooth. */
import {C,TAU} from './config.js';
import {fxr} from './rng.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function addFx(s,o){
 if(s.fx.length>=C.maxFx)s.pool.fx.push(s.fx.shift());
 const e=s.pool.fx.pop()||{};
 e.k=o.k;e.x=o.x;e.y=o.y;e.vx=o.vx||0;e.vy=o.vy||0;e.life=o.life;e.max=o.life;
 e.r=o.r||3;e.grow=o.grow||0;e.alpha=o.alpha===undefined?1:o.alpha;e.color=o.color||'#fff';
 e.rot=o.rot||0;e.drag=o.drag===undefined?2.4:o.drag;
 s.fx.push(e);return e;
}
export function floatText(s,x,y,text,color){
 if(s.floats.length>=C.maxFloats)s.pool.float.push(s.floats.shift());
 const f=s.pool.float.pop()||{};
 f.x=x;f.y=y;f.text=text;f.color=color;f.life=.95;f.max=.95;
 s.floats.push(f);
}
export function sparkle(s,x,y,color){
 addFx(s,{k:'ring',x,y,life:.35,r:6,grow:22,color});
 for(let i=0;i<9;i++){
  const a=fxr(s)*TAU,v=60+fxr(s)*120;
  addFx(s,{k:'spark',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.4+fxr(s)*.25,r:3+fxr(s)*2,color:i%3?color:'#ffffff',rot:fxr(s)*TAU});
 }
}
export function blast(s,x,y){
 addFx(s,{k:'blast',x,y,life:.55});
 addFx(s,{k:'ring',x,y,life:.5,r:10,grow:52,color:'#ffb43a'});
 for(let i=0;i<10;i++){
  const a=fxr(s)*TAU,v=40+fxr(s)*90;
  addFx(s,{k:'puff',x:x+Math.cos(a)*5,y:y+Math.sin(a)*5,vx:Math.cos(a)*v,vy:Math.sin(a)*v,
   life:.9+fxr(s)*.6,r:6,grow:18+fxr(s)*10,alpha:.5,color:i%3?'#7b6a8f':'#4d4062'});
 }
 for(let i=0;i<14;i++){
  const a=fxr(s)*TAU,v=90+fxr(s)*190;
  addFx(s,{k:'spark',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.45+fxr(s)*.3,r:3.4,color:i%2?'#ffb43a':'#fff0a8',rot:fxr(s)*TAU});
 }
}
export function poof(s,x,y){
 for(let i=0;i<5;i++){
  const a=fxr(s)*TAU,v=20+fxr(s)*40;
  addFx(s,{k:'puff',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.5,r:4,grow:10,alpha:.4,color:'#9a88b8'});
 }
}
export function updateFx(s,dt){
 let w=0;
 for(let i=0;i<s.fx.length;i++){
  const e=s.fx[i];e.life-=dt;
  if(e.life<=0){s.pool.fx.push(e);continue;}
  if(e.vx||e.vy){e.x+=e.vx*dt;e.y+=e.vy*dt;const f=Math.exp(-e.drag*dt);e.vx*=f;e.vy*=f;}
  s.fx[w++]=e;
 }
 s.fx.length=w;w=0;
 for(let i=0;i<s.floats.length;i++){
  const f=s.floats[i];f.life-=dt;
  if(f.life<=0){s.pool.float.push(f);continue;}
  f.y-=42*dt;s.floats[w++]=f;
 }
 s.floats.length=w;
 s.shake=Math.max(0,s.shake-dt*2.4);
}
export function drawFx(g,s,below){
 for(const e of s.fx){
  const isPuff=e.k==='puff';
  if(below!==isPuff)continue;
  const t=clamp(e.life/e.max,0,1),prog=1-t;
  g.save();
  if(e.k==='puff'){
   g.globalAlpha=e.alpha*t;g.fillStyle=e.color;
   g.beginPath();g.arc(e.x,e.y,e.r+e.grow*prog,0,TAU);g.fill();
  }else if(e.k==='spark'){
   const r=e.r*(.4+.6*t);
   g.translate(e.x,e.y);g.rotate(e.rot+prog*5);g.globalAlpha=Math.min(1,t*1.6);
   g.fillStyle=e.color;g.beginPath();
   g.moveTo(0,-r*1.5);g.lineTo(r*.5,-r*.5);g.lineTo(r*1.5,0);g.lineTo(r*.5,r*.5);
   g.lineTo(0,r*1.5);g.lineTo(-r*.5,r*.5);g.lineTo(-r*1.5,0);g.lineTo(-r*.5,-r*.5);
   g.closePath();g.fill();
  }else if(e.k==='ring'){
   g.globalAlpha=t;g.strokeStyle=e.color;g.lineWidth=2+3*t;
   g.beginPath();g.arc(e.x,e.y,e.r+e.grow*prog,0,TAU);g.stroke();
  }else if(e.k==='blast'){
   g.globalAlpha=t;
   g.fillStyle='#ff8a2a';g.beginPath();g.arc(e.x,e.y,14+44*prog,0,TAU);g.fill();
   g.fillStyle='#fff3a8';g.beginPath();g.arc(e.x,e.y,8+26*prog,0,TAU);g.fill();
  }
  g.restore();
 }
}
export function drawFloats(g,s){
 const px=Math.round(20*s.unit);
 g.save();g.textAlign='center';g.textBaseline='middle';g.font='900 '+px+'px system-ui,sans-serif';
 g.lineJoin='round';g.lineWidth=Math.max(3,4*s.unit);
 for(const f of s.floats){
  const t=clamp(f.life/f.max,0,1);
  g.globalAlpha=Math.min(1,t*2);g.strokeStyle='rgba(40,12,70,.9)';g.fillStyle=f.color;
  g.strokeText(f.text,f.x,f.y);g.fillText(f.text,f.x,f.y);
 }
 g.restore();
}
