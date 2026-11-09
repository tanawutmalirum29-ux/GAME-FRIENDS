/* Original PIZZA TIME garden kitchen artwork. Furniture and serving positions
   come from the authoritative arena; only the static background is cached. */
(() => {
'use strict';
const TAU=Math.PI*2,images=new Map(),scenes=new WeakMap();
const color=v=>/^#[a-f\d]{6}$/i.test(v||'')?v:'#65c9d8';
const noise=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const svg=(w,h,body)=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'">'+body+'</svg>';
function imageFor(key,make){
 if(images.has(key))return images.get(key);
 if(typeof Image==='undefined')return null;
 const image=new Image();image.decoding='async';image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(make());
 images.set(key,image);return image;
}
const ready=img=>!!(img&&img.complete&&img.naturalWidth>0);
function oval(c,x,y,rx,ry,fill){c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
function box(c,x,y,w,h,r,fill,stroke){
 c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();
 if(stroke){c.strokeStyle=stroke;c.stroke();}
}
function chefSVG(tint){
 tint=color(tint);
 return svg(96,96,`<defs><radialGradient id="hat" cx=".35" cy=".25" r=".8"><stop stop-color="#fff"/><stop offset=".65" stop-color="#f9fbf5"/><stop offset="1" stop-color="#c7d7d8"/></radialGradient><linearGradient id="apron" x2="1" y2="1"><stop stop-color="#fff9df"/><stop offset="1" stop-color="#ccdedc"/></linearGradient></defs>
 <g data-view="top-down" data-role="personal-chef"><ellipse cx="50" cy="53" rx="32" ry="30" fill="#362d2b" opacity=".3"/>
 <ellipse cx="48" cy="49" rx="29" ry="28" fill="${tint}" stroke="#39514a" stroke-width="2"/>
 <path d="M29 43Q48 33 67 43L64 70Q48 82 32 70Z" fill="url(#apron)" stroke="#a0b9b5" stroke-width="1.5"/>
 <ellipse cx="22" cy="59" rx="10" ry="13" fill="${tint}" stroke="#39514a" stroke-width="2"/><ellipse cx="74" cy="59" rx="10" ry="13" fill="${tint}" stroke="#39514a" stroke-width="2"/>
 <ellipse cx="23" cy="68" rx="7" ry="6" fill="#f1d2a3"/><ellipse cx="73" cy="68" rx="7" ry="6" fill="#f1d2a3"/>
 <ellipse cx="48" cy="55" rx="19" ry="19" fill="#eec99c" stroke="#b68a65" stroke-width="1.6"/>
 <ellipse cx="40" cy="63" rx="2.2" ry="3" fill="#3b3430"/><ellipse cx="56" cy="63" rx="2.2" ry="3" fill="#3b3430"/>
 <ellipse cx="48" cy="67" rx="4" ry="3" fill="#d7a473"/><path d="M41 71Q48 76 55 71" fill="none" stroke="#9b6344" stroke-width="1.6"/>
 <path d="M25 45Q11 31 23 20Q31 13 39 19Q47 5 59 17Q76 12 81 28Q86 41 70 47L67 55H29Z" fill="url(#hat)" stroke="#c2d4d5" stroke-width="1.8"/>
 <path d="M29 43Q48 48 68 43L66 56Q48 62 30 56Z" fill="#f9fcf5" stroke="#becfd0" stroke-width="1.4"/>
 <path d="M34 25Q29 33 35 40M49 21V41M65 25Q71 32 64 40M37 48V55M48 49V57M59 48V55" fill="none" stroke="#d8e5df" stroke-width="2" stroke-linecap="round"/>
 <path d="M43 77L48 81L53 77" fill="${tint}" stroke="#fff5db" stroke-width="1.5"/></g>`);
}
function woodSVG(w,h,prep=false){
 let planks='';
 const count=Math.ceil(w/28),step=w/count;
 for(let i=0;i<count;i++){
  const x=i*step;
  planks+=`<rect x="${x+1}" y="1" width="${step-2}" height="${h-6}" fill="${i%2?'#a85e3a':'#955232'}"/><path d="M${x+6} 5Q${x+step-4} ${h*.3} ${x+8} ${h*.5}T${x+9} ${h-10}M${x+step-5} 7Q${x+3} ${h*.5} ${x+step-5} ${h-9}" fill="none" stroke="#e3a265" stroke-opacity=".25" stroke-width="1.8"/>`;
 }
 let tools='';
 if(prep){
  for(const [x,y] of [[w/2-23,h/2-12],[w/2+23,h/2+12]])tools+=`<rect x="${x-17}" y="${y-16}" width="34" height="32" rx="3" fill="#c38a55" stroke="#efca8a" stroke-width="1.4"/><rect x="${x-14}" y="${y-13}" width="28" height="26" rx="2" fill="none" stroke="#dcac70" stroke-width="1"/>`;
  tools+=`<path d="M${w*.64} 13h22" stroke="#5a3930" stroke-width="4" stroke-linecap="round"/><path d="M${w*.64} 11h14v4h-14Z" fill="#c6d8d7"/><circle cx="18" cy="${h-17}" r="10" fill="#343e42" stroke="#172b33" stroke-width="2"/><circle cx="18" cy="${h-18}" r="7" fill="#414e50"/><path d="M11 ${h-10}l-6 7" stroke="#263537" stroke-width="4"/>`;
 }
 return svg(w,h,`<g data-prop="${prep?'prep-worktop':'chef-counter'}"><rect width="${w}" height="${h}" rx="3" fill="#573522"/>${planks}<path d="M2 2H${w-2}M2 3V${h-5}" stroke="#f4bc7a" stroke-opacity=".65" stroke-width="2"/><path d="M0 ${h-5}H${w}" stroke="#6d3d27" stroke-width="2"/>${tools}</g>`);
}
function ovenSVG(){
 return svg(96,110,`<defs><radialGradient id="embers"><stop stop-color="#fff6a0"/><stop offset=".46" stop-color="#ffc54c"/><stop offset=".8" stop-color="#dc742a"/><stop offset="1" stop-color="#703b29"/></radialGradient><linearGradient id="rim" x2="1" y2="1"><stop stop-color="#f2e1ac"/><stop offset=".48" stop-color="#b6b3a0"/><stop offset="1" stop-color="#696b67"/></linearGradient></defs>
 <g data-prop="brick-oven"><rect width="96" height="110" rx="4" fill="#744a30"/><rect x="2" y="2" width="92" height="101" rx="3" fill="#c28b52"/>
 <path d="M15 3V100M34 3V100M56 3V100M77 3V100" stroke="#915931" stroke-width="2"/><path d="M8 5Q22 40 9 95M62 5Q75 60 63 97" stroke="#e5b577" stroke-width="2" fill="none"/>
 <ellipse cx="50" cy="58" rx="42" ry="44" fill="#493d32" opacity=".5"/><ellipse cx="47" cy="49" rx="41" ry="44" fill="url(#rim)" stroke="#f0ddbc" stroke-width="2"/>
 <ellipse cx="47" cy="49" rx="33" ry="36" fill="#463830" stroke="#847964" stroke-width="3"/><ellipse cx="47" cy="48" rx="29" ry="32" fill="url(#embers)"/>
 <path d="M25 63Q20 49 31 34Q27 48 38 51Q34 33 46 21Q46 40 56 44Q56 32 65 34Q61 49 72 60L65 75H30Z" fill="#ffe67c" opacity=".85"/>
 <path d="M29 22V78M47 17V81M65 22V76" stroke="#624b35" stroke-width="5" stroke-linecap="round"/><path d="M28 22V75M46 18V78M64 23V74" stroke="#d7b170" stroke-width="2"/>
 <path d="M24 10L27 18M46 6V14M69 11L65 19M83 32L76 35M84 58L77 57M73 82L67 76M47 91V84M20 83L27 76M7 57L16 56M10 30L18 34" stroke="#6f756c" stroke-width="2"/>
 <path d="M34 101H63" stroke="#edc58b" stroke-width="3"/></g>`);
}
function preload(s){
 imageFor('oven',ovenSVG);
 for(const c of s.chefs){imageFor('chef/'+color(c.color),()=>chefSVG(c.color));imageFor('wood/'+c.counter.w/s.unit+'/45',()=>woodSVG(c.counter.w/s.unit,45));}
 for(const t of s.worktops)imageFor('prep/'+t.halfW*2/s.unit,()=>woodSVG(t.halfW*2/s.unit,72,true));
}
function canopy(c,x,y,r,seed){
 oval(c,x+7,y+12,r,r*.84,'#37562e44');
 for(let layer=0;layer<3;layer++){
  const size=r*(1-layer*.23),cx=x-layer*4,cy=y-layer*4;
  c.fillStyle=['#387a30','#569835','#79b338'][layer];
  c.beginPath();
  for(let i=0;i<10;i++){
   const angle=i*TAU/10,rr=size*(.91+noise(seed+i)*.15);
   const px=cx+Math.cos(angle)*rr,py=cy+Math.sin(angle)*rr*.88;
   if(i===0)c.moveTo(px,py);else c.quadraticCurveTo(cx+Math.cos(angle-.3)*size*1.16,cy+Math.sin(angle-.3)*size,px,py);
  }c.closePath();c.fill();
  for(let i=0;i<5;i++){const a=i*TAU/5+seed;oval(c,cx+Math.cos(a)*size*.58,cy+Math.sin(a)*size*.48,size*.29,size*.24,layer===2?'#9fc83d55':'#a0c64720');}
 }
}
function paintScene(c,s){
 const u=s.unit,b={x:s.arena.x/u,y:s.arena.y/u,w:s.arena.w/u,h:s.arena.h/u};
 c.save();c.scale(u,u);
 const grass=c.createLinearGradient(0,0,960,540);grass.addColorStop(0,'#7ca12e');grass.addColorStop(.45,'#7eb135');grass.addColorStop(1,'#5e992d');
 c.fillStyle=grass;c.fillRect(0,0,960,540);
 for(let i=0;i<170;i++){const x=noise(i)*960,y=noise(i+500)*540;oval(c,x,y,3+noise(i+90)*9,2+noise(i+20)*5,'#c7d94e28');}
 for(const side of [0,1]){
  const margin=side?960-b.x-b.w:b.x;
  for(let i=0;i<5;i++){
   const x=side?960-margin*.45:margin*.45,y=22+i*131;
   canopy(c,x+(i%2?14:-14),y,Math.max(30,Math.min(64,margin*.39)),i+side*9);
  }
  for(const y of [34,420]){
   const x=side?940:20;
   c.fillStyle='#635f49';c.beginPath();c.moveTo(x-22,y-5);c.lineTo(x+9,y-25);c.lineTo(x+32,y-2);c.lineTo(x+20,y+21);c.lineTo(x-15,y+27);c.closePath();c.fill();
   c.fillStyle='#a59c7d';c.beginPath();c.moveTo(x-22,y-5);c.lineTo(x+9,y-25);c.lineTo(x+22,y-3);c.lineTo(x+12,y+14);c.lineTo(x-17,y+17);c.closePath();c.fill();
   c.strokeStyle='#c3bda0';c.lineWidth=2;c.beginPath();c.moveTo(x-19,y-4);c.lineTo(x+8,y-20);c.lineTo(x+17,y-4);c.stroke();
  }
 }
 box(c,b.x-9,b.y-6,b.w+18,b.h+17,4,'#344c2c55');
 box(c,b.x-7,b.y-7,b.w+14,b.h+14,3,'#8a5940','#583f2b');
 c.fillStyle='#eac6ad';c.fillRect(b.x,b.y,b.w,b.h);
 for(let y=b.y,row=0;y<b.y+b.h;y+=32,row++)for(let x=b.x,col=0;x<b.x+b.w;x+=32,col++){
  c.fillStyle=(row+col)%2?'#dfb79f':'#f1d2ba';c.fillRect(x,y,Math.min(32,b.x+b.w-x),Math.min(32,b.y+b.h-y));
  c.fillStyle='#fff2de18';c.fillRect(x,y,Math.min(32,b.x+b.w-x),1);
 }
 // The entire checker-tile chef booth is a raised, solid platform.
 for(const chef of s.chefs){
  const q=chef.bounds,r=chef.counter,x=q.x/u,y=q.y/u,w=q.w/u,h=q.h/u;
  box(c,x+3,y+5,w,h,2,'#402d2945');box(c,x,y,w,h,1,'#78472e');
  for(let yy=y+3,row=0;yy<y+h-3;yy+=17,row++)for(let xx=x+3,col=0;xx<x+w-3;xx+=17,col++){
   c.fillStyle=(row+col)%2?'#dad7d1':'#a9a7b3';c.fillRect(xx,yy,Math.min(17,x+w-3-xx),Math.min(17,y+h-3-yy));
  }
  const wood=imageFor('wood/'+w+'/45',()=>woodSVG(w,45));
  if(ready(wood))c.drawImage(wood,r.x/u,r.y/u,r.w/u,r.h/u);else box(c,r.x/u,r.y/u,r.w/u,r.h/u,2,'#a86a42');
  for(const t of chef.trays){box(c,t.x/u-17,t.y/u-15,34,30,3,'#bd9058','#eed299');box(c,t.x/u-14,t.y/u-12,28,24,2,'#d4ad72','#e7c58c');}
  const awningY=chef.top?y-8:y+h-6;
  box(c,x,awningY+3,w,16,2,'#574b3540');
  for(let i=0;i<Math.ceil(w/20);i++)box(c,x+i*20,awningY,Math.min(20,w-i*20),14,2,i%2?'#fffbef':color(chef.color));
  c.fillStyle='#fff8df70';c.fillRect(x,awningY,w,2);
 }
 for(const t of s.worktops){
  const x=(t.x-t.halfW)/u,y=(t.y-t.halfH)/u,w=t.halfW*2/u,h=t.halfH*2/u;
  box(c,x+4,y+6,w,h,3,'#59423455');
  const img=imageFor('prep/'+w,()=>woodSVG(w,h,true));
  if(ready(img))c.drawImage(img,x,y,w,h);else box(c,x,y,w,h,3,'#a86a42');
 }
 for(const oven of s.ovens){
  box(c,oven.x/u+5,oven.y/u+6,oven.w/u,oven.h/u,3,'#3b342e55');
  const img=imageFor('oven',ovenSVG);
  if(ready(img))c.drawImage(img,oven.x/u,oven.y/u,oven.w/u,oven.h/u);else box(c,oven.x/u,oven.y/u,oven.w/u,oven.h/u,3,'#c18a51');
 }
 c.restore();
}
function drawScene(ctx,s){
 const transform=ctx.getTransform?.(),density=transform?Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d)):1,ratio=density>1.25?2:1;
 const complete=[...images.values()].every(ready),key=[s.world.w,s.world.h,ratio,complete].join('/');
 let scene=scenes.get(s);
 if(!scene||scene.key!==key){
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(s.world.w*ratio,s.world.h*ratio):typeof document!=='undefined'?document.createElement('canvas'):null;
  const c=canvas?.getContext('2d');
  if(c){canvas.width=s.world.w*ratio;canvas.height=s.world.h*ratio;c.scale(ratio,ratio);paintScene(c,s);scene={canvas,key};scenes.set(s,scene);}
  else paintScene(ctx,s);
 }
 if(scene)ctx.drawImage(scene.canvas,0,0,s.world.w,s.world.h);
 for(const table of s.tables)window.PizzaIngredientArt.draw(ctx,table.ingredient,table.x,table.y,14*s.unit);
}
function plate(ctx,x,y,r){
 oval(ctx,x+1,y+3,r,r*.94,'#4b3b3240');oval(ctx,x,y,r,r,'#e2e5e4');
 oval(ctx,x-.5,y-1,r*.86,r*.86,'#fffdf4');
 ctx.strokeStyle='#c6d1d4';ctx.lineWidth=Math.max(1,r*.07);ctx.beginPath();ctx.arc(x,y,r*.7,0,TAU);ctx.stroke();
}
function carryPose(s,p){
 const d=p.dir||{x:0,y:1},length=Math.hypot(d.x||0,d.y||0)||1,reach=28*s.unit;
 return {x:p.x+(d.x||0)/length*reach,y:p.y+(d.y||0)/length*reach,r:12*s.unit};
}
function drawCarried(ctx,s,p){
 const q=carryPose(s,p);plate(ctx,q.x,q.y,q.r);
 if(p.pizza?.held)window.PizzaIngredientArt.draw(ctx,p.pizza.held,q.x,q.y,13*s.unit);
}
function counterContents(s,p){
 const q=p?.pizza;if(!q)return {ingredients:[],pizza:null};
 const age=q.lastDish?s.clock-q.lastDish.at:Infinity;
 if(!q.delivered.length&&age>=0&&age<1.25){
  return age<.3?{ingredients:q.lastDish.ingredients.map((id,slot)=>({id,slot})),pizza:null}:
   {ingredients:[],pizza:q.lastDish.ingredients};
 }
 return {ingredients:q.delivered.map(id=>({id,slot:q.order.indexOf(id)})),pizza:null};
}
function drawStation(ctx,s,c,p){
 const u=s.unit,img=imageFor('chef/'+color(c.color),()=>chefSVG(c.color));
 ctx.save();ctx.translate(c.x,c.y);if(!c.top)ctx.rotate(Math.PI);
 if(ready(img))ctx.drawImage(img,-32*u,-32*u,64*u,64*u);
 else{oval(ctx,0,0,22*u,22*u,c.color);oval(ctx,0,-6*u,20*u,16*u,'#fff8ec');}
 ctx.restore();
 const content=counterContents(s,p);
 for(const {id,slot} of content.ingredients){const t=c.trays[slot];if(t)window.PizzaIngredientArt.draw(ctx,id,t.x,t.y,13.5*u);}
 if(content.pizza){
  const x=c.cx,y=(c.top?111:429)*u;plate(ctx,x,y,21*u);
  oval(ctx,x,y,18*u,18*u,'#b97a32');oval(ctx,x,y-1*u,16*u,16*u,'#edb658');oval(ctx,x,y-1*u,13*u,13*u,'#f8d57a');
  content.pizza.forEach((id,i)=>window.PizzaIngredientArt.draw(ctx,id,x+(i?-6:6)*u,y+(i?5:-5)*u,6*u));
 }
 // Ownership and score sit on the counter's front edge, away from food slots.
 const labelY=(c.top?133:412)*u;
 ctx.fillStyle='#fff4d4';ctx.strokeStyle='#593723';ctx.lineWidth=3*u;
 ctx.font='700 '+10*u+'px system-ui';ctx.textAlign='center';
 ctx.strokeText((p?.name||'CHEF').slice(0,9)+'  ·  '+(p?.score||0),c.cx,labelY,c.counter.w-8*u);
 ctx.fillText((p?.name||'CHEF').slice(0,9)+'  ·  '+(p?.score||0),c.cx,labelY,c.counter.w-8*u);
 const card=s.orderCards.get(c.ownerId);if(!card||!p?.pizza)return;
 ctx.lineWidth=1.5*u;box(ctx,card.x,card.y+2*u,card.w,card.h,10*u,'#583b3530');
 box(ctx,card.x,card.y,card.w,card.h,10*u,'#fffdf2',color(c.color));
 const size=Math.min(14,card.w/u*.175)*u;
 p.pizza.order.forEach((id,i)=>{
  const x=card.x+card.w*(i?.74:.26),y=card.y+card.h/2;
  window.PizzaIngredientArt.draw(ctx,id,x,y,size);
  if(p.pizza.delivered.includes(id)){
   oval(ctx,x+10*u,y-10*u,5.8*u,5.8*u,'#389d56');
   ctx.strokeStyle='#fff';ctx.lineWidth=1.7*u;ctx.beginPath();ctx.moveTo(x+7*u,y-10*u);ctx.lineTo(x+9.5*u,y-7.5*u);ctx.lineTo(x+13*u,y-12*u);ctx.stroke();
  }
 });
}
function drawClock(ctx,s,round){
 const u=s.unit,x=s.world.w/2;
 ctx.lineWidth=1.5*u;box(ctx,x-31*u,4*u,62*u,26*u,5*u,'#453d2eeb','#e6c996');
 ctx.strokeStyle='#fff2cd';ctx.lineWidth=1.4*u;ctx.beginPath();ctx.arc(x-17*u,17*u,6*u,0,TAU);ctx.stroke();
 ctx.beginPath();ctx.moveTo(x-17*u,13*u);ctx.lineTo(x-17*u,17*u);ctx.lineTo(x-14*u,19*u);ctx.stroke();
 ctx.font='800 '+18*u+'px system-ui';ctx.fillStyle='#fff9e4';ctx.textAlign='center';
 ctx.fillText(round.phase==='countdown'?Math.ceil(round.countdown):Math.ceil(s.remaining),x+8*u,23*u);
}
window.PizzaKitchenArt=Object.freeze({preload,drawScene,drawStation,drawCarried,drawClock,carryPose,counterContents,chefSVG,woodSVG,ovenSVG});
})();
