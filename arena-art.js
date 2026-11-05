/* Decorative overhead scenery. All geometry comes from the game's real arena.
   Static details are deterministic and cached per round, never in physics/RNG. */
(() => {
'use strict';
const TAU=Math.PI*2,backgrounds=new WeakMap();
const noise=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
function oval(c,x,y,rx,ry,fill){
 c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();
}
function box(c,x,y,w,h,r,fill,stroke){
 c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();
 if(stroke){c.strokeStyle=stroke;c.stroke();}
}
function polygon(c,x,y,r,n,fill,angle=0){
 c.beginPath();for(let i=0;i<n;i++){
  const a=angle+i*TAU/n;c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);
 }c.closePath();c.fillStyle=fill;c.fill();
}
function tree(c,x,y,r,purple=false){
 oval(c,x+7,y+10,r,r*.83,'#15293e40');
 const colors=purple?['#382c62','#594180','#78539c']:['#376b3d','#528d43','#80b54c'];
 for(let level=0;level<3;level++){
  const size=r*(1-level*.23);
  polygon(c,x-level*3,y-level*4,size,9,colors[level],level*.25);
  for(let i=0;i<6;i++){
   const a=i*TAU/6;oval(c,x+Math.cos(a)*size*.58-level*3,y+Math.sin(a)*size*.58-level*4,size*.35,size*.3,colors[level]);
  }
 }
 oval(c,x-7,y-12,r*.24,r*.13,purple?'#ac80cc55':'#c9e57c66');
}
function grass(c,w,h){
 const g=c.createLinearGradient(0,0,w,h);
 g.addColorStop(0,'#afcf57');g.addColorStop(.5,'#7fb84a');g.addColorStop(1,'#509647');
 c.fillStyle=g;c.fillRect(0,0,w,h);
 for(let i=0;i<260;i++){
  const x=noise(i)*w,y=noise(i+700)*h;
  oval(c,x,y,4+noise(i+9)*11,3+noise(i+99)*6,i%3?'#d4e97e20':'#32673816');
  if(i%4===0){
   c.strokeStyle='#3d813d55';c.lineWidth=1.5;
   c.beginPath();c.moveTo(x-3,y);c.lineTo(x-5,y-4);c.moveTo(x,y);c.lineTo(x+2,y-6);c.stroke();
  }
 }
}
function farm(c,s,w,h){
 grass(c,w,h);
 const {x,y}=s.center,r=s.radius;
 oval(c,x+4,y+9,r+10,r+10,'#294f3a40');
 oval(c,x,y,r+7,r+7,'#63442c');
 const dirt=c.createRadialGradient(x-r*.3,y-r*.4,r*.1,x,y,r);
 dirt.addColorStop(0,'#d6ab6c');dirt.addColorStop(1,'#b5824e');
 oval(c,x,y,r,r,dirt);
 c.save();c.beginPath();c.arc(x,y,r-3,0,TAU);c.clip();
 // Low contrast irregular earth patches, without suggesting extra obstacles.
 for(let i=0;i<150;i++){
  const px=x-r+noise(i+310)*r*2,py=y-r+noise(i+510)*r*2;
  polygon(c,px,py,8+noise(i+99)*23,6,i%3?'#ecc48b15':'#81573313',i);
  if(i%9===0)oval(c,px,py,4,2,'#eace9a66');
 }
 c.restore();
 // Fence rails stop at the existing gate openings. No decorative closed gate.
 const steps=96;
 for(let i=0;i<steps;i++){
  const a=i*TAU/steps,b=(i+1)*TAU/steps,mid=(a+b)/2;
  const gate=s.pens.some(p=>Math.abs(Math.atan2(Math.sin(mid-p.angle),Math.cos(mid-p.angle)))*r<p.gateWidth/2+7);
  if(gate)continue;
  c.lineCap='round';c.lineWidth=6;c.strokeStyle='#76502d';c.beginPath();
  c.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);c.lineTo(x+Math.cos(b)*r,y+Math.sin(b)*r);c.stroke();
  c.lineWidth=2;c.strokeStyle='#f1c980';c.stroke();
  if(i%4===0){
   const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;
   box(c,px-4,py-4,8,9,2,'#956334','#563f2d');box(c,px-3,py-4,6,3,1,'#ebbc72');
  }
 }
 // Trees occupy only the wide side margins, away from every pen and player.
 for(const side of [0,1])for(let i=0;i<3;i++){
  const tx=side?w-65-i%2*38:65+i%2*38,ty=h*(.18+i*.32);
  tree(c,tx,ty,34+(i%2)*8);
  oval(c,tx+48,ty+32,7,5,'#718064');oval(c,tx+46,ty+30,6,4,'#c5c8a1');
 }
}
function masonry(c,w,h,egypt){
 const g=c.createLinearGradient(0,0,w,h);
 g.addColorStop(0,egypt?'#bd8750':'#474374');g.addColorStop(1,egypt?'#8c5e3b':'#282e52');
 c.fillStyle=g;c.fillRect(0,0,w,h);
 const z=egypt?56:62;
 for(let row=0;row<h/z;row++)for(let col=-1;col<w/z;col++){
  const x=col*z+(row%2)*z/2,y=row*z,v=noise(row*103+col);
  c.lineWidth=1;box(c,x+2,y+2,z-4,z-4,3,egypt?(v>.5?'#dba2641b':'#593a2812'):(v>.5?'#aaa0cf0b':'#101c341a'),egypt?'#69482e30':'#151e3b30');
  if(v>.83){c.strokeStyle=egypt?'#f4ca8e30':'#9c9bc422';c.beginPath();c.moveTo(x+8,y+7);c.lineTo(x+26,y+7);c.stroke();}
 }
 const cx=w/2,cy=h/2;
 // A floor engraving, not a raised collision object.
 c.save();c.translate(cx,cy);c.strokeStyle=egypt?'#f1c17948':'#a9a3df1c';c.lineWidth=4;
 for(const r of [92,108]){c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();}
 if(egypt){
  oval(c,0,0,27,38,'#66442935');
  c.beginPath();c.moveTo(0,-38);c.lineTo(0,38);
  for(const sign of [-1,1])for(let i=0;i<3;i++){
   c.moveTo(sign*24,-18+i*18);c.lineTo(sign*(52+i*8),-36+i*32);
  }c.stroke();oval(c,0,-46,11,10,'#edbe7640');
 }else{
  for(let i=0;i<8;i++){const a=i*TAU/8;polygon(c,Math.cos(a)*100,Math.sin(a)*100,5,4,'#a99bd042');}
 }
 c.restore();
 // Boundary masonry stays within the existing 16px world margin.
 c.lineWidth=2;
 for(let x=0;x<w;x+=32)for(const y of [0,h-14]){
  box(c,x+1,y,30,14,2,egypt?'#cb9a58':'#64758b',egypt?'#765332':'#32465d');
  c.fillStyle=egypt?'#f7d592':'#9dacc0';c.fillRect(x+3,y+2,25,3);
 }
 for(let y=16;y<h-16;y+=32)for(const x of [0,w-14]){
  box(c,x,y,14,30,2,egypt?'#ca9958':'#64758b',egypt?'#765332':'#32465d');
  c.fillStyle=egypt?'#f7d592':'#9dacc0';c.fillRect(x+2,y+3,3,24);
 }
 // Small clipped corner canopies/column capitals sit outside playable space.
 for(const x of [0,w])for(const y of [0,h]){
  if(egypt){polygon(c,x,y,22,8,'#66442d');polygon(c,x-2,y-2,17,8,'#e5b871');polygon(c,x-4,y-4,9,8,'#f6d596');}
  else tree(c,x,y,34,true);
 }
}
function boardFrame(c,b,stone=false){
 const dark=stone?'#4b3631':'#463956',edge=stone?'#a88857':'#9e77b3',light=stone?'#dac28a':'#e1c9e8';
 c.lineWidth=3;
 box(c,b.x-13,b.y-9,b.w+26,b.h+24,8,'#14253955');
 box(c,b.x-12,b.y-12,b.w+24,b.h+24,7,dark,edge);
 c.strokeStyle=light;c.lineWidth=2;
 c.strokeRect(b.x-7,b.y-7,b.w+14,b.h+14);
 for(const x of [b.x-7,b.x+b.w+7])for(const y of [b.y-7,b.y+b.h+7]){
  polygon(c,x,y,6,4,light,Math.PI/4);
 }
}
function orchard(c,s,w,h){
 grass(c,w,h);
 const b=s.board;
 // Decorative bunting belongs to the top margin; cards and HUD stay unobscured.
 c.strokeStyle='#567644';c.lineWidth=2;c.beginPath();c.moveTo(300,24);c.quadraticCurveTo(610,87,910,24);c.stroke();
 const flags=['#f9cd62','#ac86d4','#76c8c2','#ee9485'];
 for(let i=0;i<18;i++){
  const x=313+i*33,u=(x-300)/610,y=24+126*u*(1-u);
  c.fillStyle=flags[i%4];c.beginPath();c.moveTo(x,y);c.lineTo(x+16,y+2);c.lineTo(x+7,y+19);c.closePath();c.fill();
 }
 for(const x of [6,w-6])for(const y of [125,310,490]){
  tree(c,x,y,28);
  for(let i=0;i<3;i++)oval(c,x-12+i*12,y-5+(i%2)*9,4,4,i%2?'#f8be58':'#eb8a61');
 }
 boardFrame(c,b);
 c.fillStyle='#203749';c.fillRect(b.x,b.y,b.w,b.h);
}
function lava(c,s,w,h){
 const g=c.createRadialGradient(w/2,h/2,70,w/2,h/2,w*.65);
 g.addColorStop(0,'#ffce59');g.addColorStop(.6,'#ef8535');g.addColorStop(1,'#a34530');
 c.fillStyle=g;c.fillRect(0,0,w,h);
 for(let i=0;i<24;i++){
  const y=i*29-40;c.beginPath();c.moveTo(-30,y);
  for(let x=0;x<=w+60;x+=60)c.lineTo(x,y+Math.sin(x*.013+i)*18);
  c.strokeStyle=i%3?'#ffdc7045':'#ffe9a477';c.lineWidth=3+i%4*2;c.stroke();
 }
 for(let i=0;i<45;i++){
  const x=noise(i+62)*w,y=noise(i+93)*h;
  oval(c,x,y,8+noise(i)*14,3+noise(i+7)*4,'#ffec9733');
 }
 // Dark volcanic banks frame the lava, outside the solid 5x5 platform.
 for(const side of [0,1])for(let i=0;i<9;i++){
  const x=side?w+5-noise(i)*48:-5+noise(i)*48,y=i*75-15;
  polygon(c,x+5,y+9,53,7,'#713f35',i);
  polygon(c,x,y,49,7,'#493735',i);polygon(c,x-8,y-9,30,5,'#685047',i);
 }
 boardFrame(c,s.board,true);
}
const painters={farm,graveyard:(c,s,w,h)=>masonry(c,w,h,false),egypt:(c,s,w,h)=>masonry(c,w,h,true),orchard,lava};
function draw(ctx,theme,state,w=960,h=540){
 const painter=painters[theme];if(!painter)return;
 // Keep up to 2x detail for Retina hosts without recreating scenery every frame.
 const transform=ctx.getTransform?.();
 const density=transform?Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d)):1;
 const ratio=density>1.25?2:1;
 const key=[theme,w,h,ratio,state.radius,state.board?.x,state.board?.y,state.board?.w,state.board?.h].join('/');
 let entry=backgrounds.get(state);
 if(!entry||entry.key!==key){
  const surface=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w*ratio,h*ratio):
    typeof document!=='undefined'?document.createElement('canvas'):null;
  const context=surface?.getContext('2d');
  if(context){
   surface.width=w*ratio;surface.height=h*ratio;context.scale(ratio,ratio);
   painter(context,state,w,h);entry={key,surface};backgrounds.set(state,entry);
  }else{painter(ctx,state,w,h);return;}
 }
 ctx.drawImage(entry.surface,0,0,w,h);
}
window.PartyArenaArt=Object.freeze({draw});
})();
