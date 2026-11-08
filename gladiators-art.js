/* Original 2.5D colosseum illustration based on the supplied composition.
   The playable rectangle is always distinct from decorative stands. */
(() => {
'use strict';
const PI=Math.PI,TAU=2*PI;
function fillRect(g,x,y,w,h,color){g.fillStyle=color;g.fillRect(x,y,w,h);}
function stroke(g,color,width){g.strokeStyle=color;g.lineWidth=width;g.stroke();}
function poly(g,pts,color,line,width=1){
 g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();
 g.fillStyle=color;g.fill();if(line)stroke(g,line,width);
}
function line(g,pts,color,width=1){
 g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));
 g.strokeStyle=color;g.lineWidth=width;g.stroke();
}
function circle(g,x,y,r,color,lineColor=null,lw=1){
 g.beginPath();g.arc(x,y,r,0,TAU);g.fillStyle=color;g.fill();
 if(lineColor){g.strokeStyle=lineColor;g.lineWidth=lw;g.stroke();}
}
function flag(g,x,y,size,color,flip=false){
 g.save();g.translate(x,y);if(flip)g.scale(-1,1);
 g.strokeStyle='#42312b';g.lineWidth=5;g.beginPath();g.moveTo(0,-size*.6);g.lineTo(0,size*.6);g.stroke();
 g.fillStyle=color;g.beginPath();g.moveTo(2,-size*.59);
 g.bezierCurveTo(size*.40,-size*.7,size*.52,-size*.34,size*.83,-size*.48);
 g.lineTo(size*.83,size*.24);g.bezierCurveTo(size*.45,size*.15,size*.20,size*.35,2,size*.21);
 g.closePath();g.fill();
 g.fillStyle='#fff6';g.beginPath();g.moveTo(18,-size*.2);g.lineTo(25,0);g.lineTo(18,size*.2);g.closePath();g.fill();g.restore();
}
function stone(g,x,y,w,h,variant){
 const colors=['#d3935d','#a76745','#e7b077','#b87c55','#f0c48d'];
 fillRect(g,x,y,w,h,colors[variant%colors.length]);
 stroke(g,'#693f30aa',1);g.strokeRect(x+1,y+1,w-2,h-2);
 fillRect(g,x+3,y+3,w-6,2,'#f7d2a04d');
 if(variant%7===0)line(g,[[x+w*.4,y+h*.1],[x+w*.48,y+h*.5],[x+w*.37,y+h*.9]],'#7d5a474d',1.5);
}
function tribune(g,w,h,b){
 const grad=g.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#653f37');grad.addColorStop(.5,'#c88a58');grad.addColorStop(1,'#583c38');
 fillRect(g,0,0,w,h,grad);
 const rows=5;
 for(let row=0;row<rows;row++){
  const upper=row<2,y=upper?8+row*21:h-50+(row-2)*21;
  if(y<0||y>h)continue;
  fillRect(g,0,y,w,17,row%2?'#9b644b':'#d4935e');
  fillRect(g,0,y+13,w,5,'#684335');
  for(let x=7;x<w;x+=44)stone(g,x,y,40,12,Math.floor(x/44)+row);
 }
 for(let side=0;side<2;side++){
  const left=side===0,x=left?5:w-87;
  fillRect(g,x,0,82,h,'#3d2b2c');
  for(let y=25;y<h-25;y+=80){
   fillRect(g,x+5,y,72,57,'#aa744d');fillRect(g,x+12,y+7,58,43,'#171a21');
   g.beginPath();g.ellipse(x+41,y+16,29,17,0,PI,TAU);
   g.fillStyle='#171a21';g.fill();
   stroke(g,'#e8b277',5);g.strokeRect(x+9,y+7,62,50);
  }
  // A 2.5D stone balustrade across the grandstands.
  for(let y=5;y<h;y+=52){
   poly(g,[[x+3,y],[x+18,y-12],[x+76,y-12],[x+88,y],[x+88,y+14],[x+3,y+14]],
    '#dba56b','#7a5145',2);
   fillRect(g,x+13,y+14,69,5,'#6a4438');
  }
 }
 // The gate at the top and bottom, between banner arrangements.
 for(const yy of [8,h-54]){
  const x=w/2-82;
  fillRect(g,x,yy,164,45,'#734632');
  for(let i=0;i<3;i++){
   fillRect(g,x+i*56+6,yy+5,46,34,'#21242b');
   stroke(g,'#bf9369',3);g.strokeRect(x+i*56+6,yy+5,46,34);
   fillRect(g,x+i*56+15,yy+8,5,28,'#543b36');
  }
 }
 // Gradient cast shadows from the raised arena walls.
 const top=g.createLinearGradient(0,b.y-25,0,b.y+30);
 top.addColorStop(0,'#241f24a8');top.addColorStop(1,'#241f2400');
 fillRect(g,b.x-9,b.y-27,b.right-b.x+18,60,top);
 const bottom=g.createLinearGradient(0,b.bottom-25,0,b.bottom+36);
 bottom.addColorStop(0,'#251f2300');bottom.addColorStop(1,'#251f23ab');
 fillRect(g,b.x-9,b.bottom-25,b.right-b.x+18,60,bottom);
 for(let i=0;i<4;i++){
  flag(g,b.x-57+(i%2)*18,i<2?b.y-29:b.bottom+28,64,
   ['#d64e34','#3779ad','#e5ac40','#6d57a1'][i],i%2===1);
  flag(g,b.right+50-(i%2)*18,i<2?b.y-29:b.bottom+28,64,
   ['#347fb7','#c9402c','#a280cf','#55a67d'][i],i%2===0);
 }
}
function ruinFloor(g,s){
 const b=s.bounds,w=b.right-b.x,h=b.bottom-b.y;
 fillRect(g,b.x-13,b.y-13,w+26,h+26,'#5a514e');
 fillRect(g,b.x-7,b.y-7,w+14,h+14,'#e8d7a9');
 const bg=g.createRadialGradient(b.w/2,b.h/2,35,b.w/2,b.h/2,b.w*.55);
 bg.addColorStop(0,'#f8d68c');bg.addColorStop(.72,'#d7a867');bg.addColorStop(1,'#be864f');
 fillRect(g,b.x,b.y,w,h,bg);
 for(let i=0;i<130;i++){
  const x=b.x+((i*197+31)%Math.floor(w)),y=b.y+((i*157+47)%Math.floor(h));
  if(i%3===0){
   line(g,[[x-10,y-5],[x-4,y],[x+5,y-7],[x+14,y-4]],'#83563628',1.4);
  }else{
   circle(g,x,y,1+i%3,i%2?'#9d714332':'#fff0ca54');
  }
 }
 // Geometric Greek-key tiles around the pit.
 for(const y of [b.y-13,b.bottom+2]){
  for(let x=b.x-10;x<b.right;x+=22){
   fillRect(g,x,y,20,11,'#c6cdb9');
   stroke(g,'#4c8986',2);
   g.beginPath();g.moveTo(x+3,y+8);g.lineTo(x+3,y+3);
   g.lineTo(x+16,y+3);g.lineTo(x+16,y+8);
   g.lineTo(x+8,y+8);g.lineTo(x+8,y+5);g.stroke();
  }
 }
 for(const x of [b.x-13,b.right+2]){
  for(let y=b.y;y<b.bottom;y+=22){
   fillRect(g,x,y,11,20,'#c5cdb6');
   stroke(g,'#568783',1.6);g.strokeRect(x+2,y+3,7,13);
  }
 }
 // Authentic carved stone relief rather than a borrowed superhero emblem.
 const cx=b.w/2,cy=b.h/2,r=Math.min(w,h)*.27;
 circle(g,cx+3,cy+7,r+12,'#7c513440');
 circle(g,cx,cy,r+10,'#9e653e','#f4cf8a',4);
 circle(g,cx,cy,r,'#b37a48','#64433b',2);
 for(let i=0;i<48;i++){
  const a=i*TAU/48;
  circle(g,cx+Math.cos(a)*(r-6),cy+Math.sin(a)*(r-6),2.3,'#f5c56e');
 }
 circle(g,cx,cy,r*.81,'#8c3328','#f1c16b',3);
 // A unique bronze gladiator helmet, plumes and crossed spears.
 g.save();g.translate(cx,cy);
 poly(g,[[-36,-1],[-29,-30],[-12,-46],[21,-46],[40,-23],[33,12],[9,40],[-11,40],[-33,13]],
  '#d7a34d','#573e36',3);
 poly(g,[[-27,-8],[-4,-22],[12,-21],[30,-8],[18,1],[-18,1]],'#2a3336','#f2cb78',2);
 line(g,[[0,-29],[0,37]],'#643c2d',5);
 for(let i=0;i<6;i++)line(g,[[-21+i*8,-47],[-26+i*8,-59-Math.sin(i)*8]],'#eec16c',5);
 g.rotate(-.55);line(g,[[-60,60],[62,-60]],'#f0d6a5',5);
 g.rotate(1.1);line(g,[[-60,-60],[60,60]],'#f0d6a5',5);g.restore();
 // Fine cracked sandstone, never obstacle geometry.
 for(let i=0;i<12;i++){
  const x=b.x+31+i*65,y=b.y+25+((i*53)%Math.max(1,h-50));
  line(g,[[x,y],[x+11,y+6],[x+16,y-2],[x+24,y+11],[x+29,y+8]],'#75533838',1.3);
 }
}
function columns(g,s){
 const b=s.bounds;
 for(let side=0;side<2;side++){
  for(let i=0;i<3;i++){
   const x=side===0?b.x-25:b.right+25,y=b.y+48+i*(b.bottom-b.y-96)/2;
   g.save();g.translate(x,y);
   circle(g,5,9,17,'#201c203e');circle(g,0,0,15,'#c99a69','#765039',3);
   circle(g,0,0,10,'#f5d09a','#bb8459',2);g.restore();
  }
 }
 for(const [x,y] of [[b.x-10,b.y-8],[b.right+10,b.y-8],[b.x-10,b.bottom+8],[b.right+10,b.bottom+8]]){
  circle(g,x+2,y+5,20,'#1a17184f');circle(g,x,y,17,'#e4b777','#85573b',4);
  circle(g,x,y,9,'#f5d39a','#b17850',2);
 }
}
function staticDraw(g,s){
 const b=s.bounds;
 tribune(g,b.w,b.h,b);
 ruinFloor(g,s);
 columns(g,s);
}
function draw(g,s,time){
 if(window.ReferenceArenaArt?.gladiators(g,s))return;
 const b=s.bounds;
 if(!s.arenaCache&&typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=b.w;canvas.height=b.h;
  const ctx=canvas.getContext('2d');
  if(ctx){staticDraw(ctx,s);s.arenaCache=canvas;}
 }
 if(s.arenaCache)g.drawImage(s.arenaCache,0,0);
 else staticDraw(g,s);
}
window.GladiatorsArt=Object.freeze({draw,staticDraw});
})();
