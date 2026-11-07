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
// Layered, pointed canopies surround the cemetery but never hide its lanes.
function nightPine(c,x,y,r,seed){
 oval(c,x+10,y+15,r,r*.9,'#100e2f70');
 const colors=['#2c2053','#412368','#5a2e86','#713b9d'];
 for(let layer=0;layer<4;layer++){
  const radius=r*(1-layer*.2),cx=x-layer*3,cy=y-layer*4;
  c.beginPath();
  for(let i=0;i<32;i++){
   const angle=i*TAU/32+seed*.31,rr=radius*(i%2?.57:1+noise(i+seed)*.14);
   c.lineTo(cx+Math.cos(angle)*rr,cy+Math.sin(angle)*rr*.88);
  }
  c.closePath();c.fillStyle=colors[layer];c.fill();
  c.strokeStyle='#ae6fc626';c.lineWidth=1.2;
  for(let i=0;i<8;i++){
   const angle=i*TAU/8+seed*.31;
   c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+Math.cos(angle)*radius*.85,cy+Math.sin(angle)*radius*.72);c.stroke();
  }
 }
}
function scarab(c,x,y,r,ink,shine){
 c.save();c.translate(x,y);c.scale(r/100,r/100);
 c.lineWidth=3;c.strokeStyle=shine;
 for(const radius of [91,98]){c.beginPath();c.arc(0,0,radius,0,TAU);c.stroke();}
 c.strokeStyle=ink;c.lineWidth=5;
 oval(c,0,-55,16,16,shine);oval(c,0,-13,24,33,ink);
 c.beginPath();c.moveTo(0,-44);c.lineTo(0,18);
 for(const side of [-1,1]){
  c.moveTo(side*21,-30);c.bezierCurveTo(side*76,-69,side*84,-34,side*39,-8);
  c.moveTo(side*22,-8);c.lineTo(side*65,10);c.lineTo(side*78,36);
  c.moveTo(side*17,11);c.lineTo(side*46,40);c.lineTo(side*36,64);
 }
 c.stroke();c.strokeStyle=shine;c.lineWidth=2;c.beginPath();c.moveTo(0,-40);c.lineTo(0,17);c.stroke();
 c.restore();
}
function templePlant(c,x,y){
 oval(c,x+3,y+6,13,10,'#201d2440');
 for(let i=0;i<7;i++){
  const angle=i*TAU/7;
  c.fillStyle=i%2?'#4a7860':'#2e635a';c.beginPath();c.moveTo(x,y);
  c.quadraticCurveTo(x+Math.cos(angle+.4)*13,y+Math.sin(angle+.4)*13,x+Math.cos(angle)*22,y+Math.sin(angle)*22);
  c.quadraticCurveTo(x+Math.cos(angle-.4)*12,y+Math.sin(angle-.4)*12,x,y);c.fill();
 }
 polygon(c,x,y,7,7,'#b99655');
}
function courtyardBorder(c,b,egypt){
 const {x,y,w,h}=b,right=x+w,bottom=y+h;
 const dark=egypt?'#67432b':'#34465d',top=egypt?'#d39a51':'#738f9a',light=egypt?'#ffce79':'#b0c1c0';
 // Everything raised is OUTSIDE the playable rectangle. Inner shadows are flat.
 c.lineWidth=1.5;
 for(const [bx,by,bw,bh] of [[x-22,y-22,w+44,22],[x-22,bottom,w+44,22],[x-22,y,22,h],[right,y,22,h]]){
  box(c,bx+5,by+7,bw,bh,1,'#10142e66');box(c,bx,by,bw,bh,1,dark);
  const horizontal=bw>bh,count=Math.ceil((horizontal?bw:bh)/32),step=(horizontal?bw:bh)/count;
  for(let i=0;i<count;i++){
   const px=bx+(horizontal?i*step:2),py=by+(horizontal?2:i*step);
   box(c,px+1,py+1,horizontal?step-2:17,horizontal?17:step-2,1,top,dark);
   c.fillStyle=light;c.fillRect(px+3,py+2,horizontal?step-6:3,horizontal?3:step-6);
  }
 }
 // Iron/gold rails and square piers sit on the outer edge of the stone coping.
 for(const yy of [y-28,bottom+24]){
  c.strokeStyle=dark;c.lineWidth=3;c.beginPath();c.moveTo(x-14,yy);c.lineTo(right+14,yy);c.stroke();
  for(let xx=x-12;xx<=right+12;xx+=13){
   c.strokeStyle=egypt?'#b69a57':'#829c9e';c.lineWidth=2;c.beginPath();c.moveTo(xx,yy-5);c.lineTo(xx,yy+6);c.stroke();
  }
 }
 for(const xx of [x-28,right+24]){
  c.strokeStyle=dark;c.lineWidth=3;c.beginPath();c.moveTo(xx,y);c.lineTo(xx,bottom);c.stroke();
  for(let yy=y;yy<=bottom;yy+=13){c.fillStyle=light;c.fillRect(xx-5,yy,10,2);}
 }
 const pier=(px,py)=>{
  box(c,px-12+4,py-12+5,24,24,2,'#15172960');
  if(egypt){
   polygon(c,px,py,18,8,'#9a642e',Math.PI/8);polygon(c,px-1,py-2,15,8,'#efb85c',Math.PI/8);
   polygon(c,px-2,py-3,10,8,'#ffda83',Math.PI/8);polygon(c,px-2,py-3,5,8,'#b77f3b',Math.PI/8);
  }else{
   box(c,px-11,py-11,22,22,2,dark);box(c,px-12,py-14,23,21,2,top,light);
   c.fillStyle='#a5baba';c.fillRect(px-9,py-12,16,4);
  }
 };
 for(let px=x-11;px<right+11;px+=96){pier(px,y-12);pier(px,bottom+12);}
 for(let py=y+50;py<bottom;py+=116){pier(x-12,py);pier(right+12,py);}
 pier(right+11,y-12);pier(right+11,bottom+12);
 if(egypt){
  // Wall-mounted braziers and papyrus never create unmarked floor obstacles.
  for(const px of [x-12,right+12])for(const py of [y+102,bottom-102]){
   const glow=c.createRadialGradient(px,py,1,px,py,45);
   glow.addColorStop(0,'#ffc76c55');glow.addColorStop(1,'#ffc76c00');oval(c,px,py,45,45,glow);
   polygon(c,px,py,9,8,'#785031');oval(c,px,py-2,5,7,'#ffd375');oval(c,px-1,py-3,2,4,'#fff2bc');
  }
  for(const px of [x-12,right+12])for(const py of [y+37,bottom-37])templePlant(c,px,py);
 }
}
function masonry(c,s,w,h,egypt){
 const b=s.arena||{x:34,y:34,w:w-68,h:h-68},right=b.x+b.w,bottom=b.y+b.h;
 const outer=c.createLinearGradient(0,0,w,h);
 outer.addColorStop(0,egypt?'#3b2925':'#241d4e');outer.addColorStop(.5,egypt?'#63402d':'#403169');outer.addColorStop(1,egypt?'#392b28':'#211c44');
 c.fillStyle=outer;c.fillRect(0,0,w,h);
 if(egypt){
  // Temple exterior: huge recessed reliefs distinguish walls from walkable tile.
  c.strokeStyle='#211b2040';c.lineWidth=3;
  for(let y=0;y<h;y+=70)for(const x of [0,right+30]){
   c.strokeRect(x,y,b.x-30,70);c.strokeRect(x+17,y+13,Math.max(12,b.x-64),44);
  }
  scarab(c,b.x/2,h/2,Math.max(32,b.x*.44),'#171c2240','#c3935530');
  scarab(c,right+(w-right)/2,h/2,Math.max(32,(w-right)*.44),'#171c2240','#c3935530');
 }else{
  for(const side of [0,1])for(let i=-1;i<9;i++){
   const margin=side?w-right:b.x;
   const x=side?w-margin*.42:margin*.42,y=i*91+25;
   nightPine(c,x,y,58+noise(i+20)*26,i+side*9+30);
   nightPine(c,side?w-8:8,y+34,51+noise(i+40)*15,i+53);
  }
 }
 // Courtyard paving covers exterior decoration exactly at the physical fence.
 const floor=c.createLinearGradient(b.x,b.y,right,bottom);
 floor.addColorStop(0,egypt?'#bd814b':'#3e3c69');floor.addColorStop(.55,egypt?'#a86a3e':'#35385f');floor.addColorStop(1,egypt?'#8c5335':'#282f50');
 c.fillStyle=floor;c.fillRect(b.x,b.y,b.w,b.h);
 c.save();c.beginPath();c.rect(b.x,b.y,b.w,b.h);c.clip();
 const z=egypt?58:48;
 for(let row=0;row<b.h/z;row++)for(let col=0;col<b.w/z;col++){
  const x=b.x+col*z,y=b.y+row*z,v=noise(row*103+col+7);
  if(egypt||v>.48){
   c.lineWidth=1.2;box(c,x+2,y+2,z-4,z-4,2,
    egypt?(v>.5?'#dc9c5a21':'#4c2b2415'):(v>.7?'#8193ae19':'#617c9612'),egypt?'#59392342':'#182b4225');
  }
  if(v>.87){
   c.strokeStyle=egypt?'#e8ad6b40':'#9ca9c524';c.lineWidth=1.5;
   c.beginPath();c.moveTo(x+5,y+22);c.lineTo(x+17,y+17);c.lineTo(x+23,y+5);c.stroke();
  }
  if(egypt&&row%2===1&&col%2===1){
   oval(c,x+z/2,y+z/2,8,8,'#d79d5920');
   c.strokeStyle='#71482c40';c.beginPath();c.arc(x+z/2,y+z/2,8,0,TAU);c.stroke();
  }
 }
 if(egypt){
  const cx=w/2,cy=h/2;
  oval(c,cx+5,cy+6,154,154,'#633e2826');
  scarab(c,cx,cy,150,'#633b2b88','#ecc08060');
  // Small lapis inlays lead around the central royal burial, not across it.
  for(const dx of [-184,184])for(const dy of [-98,0,98]){
   box(c,cx+dx-7,cy+dy-7,14,14,1,'#527a7c80','#d7ae7060');
  }
 }else{
  // Worn flagstone clusters, moss and cracks stay subtle under the actors.
  for(let i=0;i<30;i++){
   const x=b.x+noise(i+55)*b.w,y=b.y+noise(i+105)*b.h;
   oval(c,x,y,14+noise(i)*17,6+noise(i+9)*7,'#6c779214');
  }
 }
 c.restore();
 courtyardBorder(c,b,egypt);
 if(!egypt){
  // A few distant bats belong to the exterior only.
  for(let i=0;i<5;i++){
   const x=right+45+(i%2)*24,y=h*.68+i*24;
   c.fillStyle='#17152b';c.beginPath();c.moveTo(x-11,y-5);c.quadraticCurveTo(x-2,y-5,x,y+2);
   c.quadraticCurveTo(x+3,y-5,x+12,y-5);c.lineTo(x+7,y+3);c.lineTo(x+2,y+2);c.lineTo(x,y+6);c.lineTo(x-3,y+2);c.lineTo(x-7,y+3);c.fill();
  }
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
const painters={farm,graveyard:(c,s,w,h)=>masonry(c,s,w,h,false),egypt:(c,s,w,h)=>masonry(c,s,w,h,true),orchard,lava};
function draw(ctx,theme,state,w=960,h=540){
 const painter=painters[theme];if(!painter)return;
 // Keep up to 2x detail for Retina hosts without recreating scenery every frame.
 const transform=ctx.getTransform?.();
 const density=transform?Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d)):1;
 const ratio=density>1.25?2:1;
 const key=[theme,w,h,ratio,state.radius,state.board?.x,state.board?.y,state.board?.w,state.board?.h,
  state.mapId,state.arena?.x,state.arena?.y,state.arena?.w,state.arena?.h].join('/');
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
