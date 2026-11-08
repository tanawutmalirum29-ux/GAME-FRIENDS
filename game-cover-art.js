/* Original, text-free cover illustrations. Shared scene props keep lobby,
   phone, roulette and bulk bot picker art consistent with the actual games. */
(() => {
'use strict';
let serial=0,propSerial=0;
const palette=['#ef688b','#50c9e6','#f2cf55','#80c857'];
const rect=(x,y,w,h,color,r=0,stroke='none',sw=1)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>`;
const circle=(x,y,r,color,stroke='none',sw=1)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>`;
const ellipse=(x,y,rx,ry,color)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${color}"/>`;
const path=(d,fill,stroke='none',sw=1)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
const group=(x,y,a,s,body)=>`<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})">${body}</g>`;
function scope(markup,prefix){return markup.replace(/id="([^"]+)"/g,(_,id)=>`id="${prefix}${id}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#${prefix}${id})`);}
function embed(markup,x,y,w,h){
 if(!markup)return '';
 return scope(markup.replace(/<svg\b[^>]*>/,tag=>tag.replace(/\b(?:width|height)="[^"]*"/g,'').replace('<svg ',`<svg x="${x}" y="${y}" width="${w}" height="${h}" `)),`p${++propSerial}-`);
}
const prop=(id,x,y,w,h,color)=>embed(window.PartyArenaScenes.assetSVG(id,color),x,y,w,h);
const food=(id,x,y,size)=>embed(window.PartyArenaScenes.productSVG(id),x,y,size,size);
function avatar(x,y,color,a=0,s=1,chef=false){
 return group(x,y,a,s,ellipse(2,8,18,13,'#152b403c')+ellipse(-17,4,5,8,color)+ellipse(17,4,5,8,color)+
  path('M-11 9-8 18H8L11 9Z','#334052')+circle(0,0,17,color,'#334052',1.5)+
  path('M-13 0Q0-5 13 0V8Q0 19-13 8Z','#f7dbba')+ellipse(-5,4,1.8,2.6,'#384253')+ellipse(5,4,1.8,2.6,'#384253')+
  path('M-4 11Q0 14 4 11','none','#b47767',1.4)+path('M-10-9Q-3-16 7-11','none','#ffffff66',3)+
  (chef?path('M-14-12Q-23-25-10-28Q-8-39 3-34Q16-38 18-25Q27-16 13-12V-5H-13Z','#fff9e9','#c4cbd0',1.4):''));
}
function grass(){
 let art=rect(0,0,320,180,'url(#grass)');
 for(let i=0;i<38;i++){const x=(i*61)%320,y=(i*43)%180;art+=path(`M${x} ${y}l-3-5m3 5 3-7`,'none','#d1e37755',1.5);}
 return art;
}
const tree=(x,y,s=1,golden=false)=>prop(golden?'golden':'tree',x,y,110*s,110*s);
function star(x,y,s,color='#ffe190'){return group(x,y,0,s,path('M0-10 3-3 11-2 5 3 7 11 0 7-7 11-5 3-11-2-3-3Z',color,'#b79058',.8));}
function balloon(x,y,color,r=16){
 return path(`M${x} ${y+r}q-9 12 1 22t-2 15`,'none','#eee3be',1.2)+ellipse(x+3,y+r+9,r*.65,5,'#61482d33')+
  ellipse(x,y,r,r*1.15,color)+ellipse(x,y,r,r*1.15,'url(#balloonLight)')+ellipse(x-r*.35,y-r*.45,r*.24,r*.35,'#ffffffa0')+
  path(`M${x} ${y+r}l-3 6h7Z`,color);
}
function ghostScene(){
 let a=rect(0,0,320,180,'url(#night)')+path('M25 26H295V158H25Z','#343f67','#86a4a1',5);
 for(let i=0;i<14;i++)a+=rect(23+i*20,20,10,13,'#8ba5a3',1)+rect(23+i*20,151,10,13,'#829e9c',1);
 for(const [x,y,ang] of [[77,48,-12],[202,102,14],[246,40,-19]])a+=group(x,y,ang,1,ellipse(3,19,21,12,'#111c3a55')+rect(-17,-24,34,51,'#283959',3,'#63819b',2)+rect(-12,-20,24,36,'#475c7a',2)+path('M-6-6H6M0-12V6','none','#8499af',3)+circle(18,22,5,'#ffe5b0')+circle(18,22,10,'#ffc27322'));
 a+=path('M117 116Q140 100 155 81','none','#6ae4ef30',18)+avatar(105,122,palette[0],-38,.98);
 a+=group(162,78,-12,1,path('M-26 18Q-37-23 0-31Q36-29 28 16L17 8 9 23-2 13-14 23-17 10Z','#adf5ed','#e4ffef',2)+ellipse(-9,-8,4,7,'#45697a')+ellipse(9,-8,4,7,'#45697a')+ellipse(0,7,5,7,'#6ba4ae')+path('M-22-8Q-11-25 3-24','none','#ffffff99',4));
 a+=avatar(242,130,palette[1],20,.85)+path('M270 18q7-7 13 0l-6 4Zm-242 113q7-7 13 0l-6 4Z','#111b34');
 return a;
}
function chickenScene(){
 let a=grass()+path('M47 161Q20 66 122 31Q237 3 291 137Z','#b2c957')+rect(220,15,64,49,'#ac6941',3,'#785334',3)+path('M211 24 253 1 294 24Z','#b94747','#7c3c39',2)+rect(240,35,23,29,'#483b31',4);
 for(let i=0;i<6;i++)a+=rect(12+i*23,138,5,31,'#e4c98d',1)+rect(16+i*23,145,20,5,'#b79260',1);
 a+=avatar(82,72,palette[1],25,1.05)+avatar(245,128,palette[0],-30,.95);
 for(const [x,y,s] of [[157,94,1.3],[194,54,.65],[156,151,.65]])a+=group(x,y,-10,s,ellipse(1,13,22,12,'#536b3333')+path('M-12 4-29-9-23 13Z','#e8cf9f')+ellipse(0,0,21,17,'#fff1cf')+ellipse(-6,3,12,9,'#e9d5a7')+circle(14,-9,13,'#fff8dd','#d3b480',1)+path('M10-21Q6-31 13-30Q18-36 22-27L20-20Z','#df5650')+path('M25-11 36-5 25 0Z','#f3b44c')+circle(18,-10,2.3,'#493f35')+path('M-9 16v8m0-1-5 3m20-10v8m0-1 5 3','none','#b67a35',2.5));
 return a+tree(-36,-41,1.1)+tree(265,101,.85);
}
function memoryScene(){
 let a=rect(0,0,320,180,'url(#sea)');
 const fruits=['apple','banana','watermelon','juice','apple','banana'];
 for(let y=0;y<2;y++)for(let x=0;x<3;x++){
  const px=49+x*78,py=26+y*67;
  a+=rect(px+2,py+7,69,59,'#194a69',6)+rect(px,py,69,59,'#77bad0',6,'#caebdf',2)+rect(px+5,py+5,59,47,'#4f9dba',4);
  a+=food(fruits[y*3+x],px+15,py+5,39);
 }
 return a+avatar(79,129,palette[0],-18,.85)+avatar(231,55,palette[1],35,.8)+star(28,51,.7)+star(285,131,.9);
}
function shockScene(){
 let a=rect(0,0,320,180,'#31263f')+path('M0 157Q60 81 118 142T320 98V180H0Z','url(#lava)');
 for(let y=0;y<3;y++)for(let x=0;x<5;x++){
  const px=24+x*55,py=21+y*46,broken=x===3&&y===2;
  a+=rect(px+3,py+8,48,37,broken?'#943d37':'#233d56',3)+rect(px,py,48,37,broken?'#df6b42':'#5f9baf',3,broken?'#ffcf70':'#afd9d6',1.5);
  if(broken)a+=path(`M${px+8} ${py+1}l16 12-8 8 17 15`,'none','#ffe2a2',3);
 }
 a+=ellipse(159,89,69,36,'none').replace('/>',' stroke="#d6f8e9" stroke-width="3"/>')+ellipse(159,89,88,48,'none').replace('/>',' stroke="#bdebe366" stroke-width="3"/>');
 return a+avatar(159,82,palette[2],0,1.1)+avatar(57,47,palette[1],-20,.7)+avatar(255,117,palette[0],30,.75)+star(159,37,.65);
}
function colorScene(){
 let a=grass()+rect(44,12,234,158,'#6f513a',5,'#ddc691',4);
 for(let y=0;y<4;y++)for(let x=0;x<6;x++){
  const color=['#60cbbb','#df758e','#9c7bcd','#e1bf66'][(x*3+y*5)%4];
  a+=rect(51+x*36,20+y*35,33,32,color,2,'#665c5e',1)+path(`M${55+x*36} ${25+y*35}h24`,'none','#fff8d544',1.5);
 }
 a+=group(162,77,0,1.2,path('M-22-3Q-22-28 0-28Q24-27 23-3L15 6V21H-15V6Z','#e2d0a0','#5d6152',2)+rect(-16,-17,12,13,'#4d5960',3)+rect(5,-17,12,13,'#4d5960',3)+path('M0-6 5 3H-5Z','#6a7463')+path('M-8 10v10M0 10v10M8 10v10','none','#9c9777',2));
 return a+avatar(90,121,palette[1],-20,.85)+avatar(245,53,palette[0],20,.8)+tree(-54,38,.9)+tree(274,95,.9)+star(230,124,.7);
}
function pizzaScene(){
 let a=grass()+rect(38,13,244,153,'#d3b490',3,'#eee2b4',3);
 for(let y=0;y<5;y++)for(let x=0;x<8;x++)a+=rect(43+x*29,18+y*29,28,28,(x+y)%2?'#f0d4af':'#e6c49c');
 for(const [x,y,c] of [[57,42,palette[0]],[236,102,palette[1]]])a+=rect(x-7,y+15,54,38,'#704c36',4)+rect(x-7,y+8,54,37,c,4,'#f8e6b9',3)+avatar(x+19,y,c,0,.85,true);
 a+=group(161,94,-12,1.1,ellipse(3,8,41,33,'#744f3d44')+circle(0,0,39,'#f2eee0','#b8bbb7',2)+circle(0,0,32,'#d9913d','#f4c877',5)+circle(0,0,27,'#edc75e'));
 for(const [x,y] of [[145,80],[177,91],[155,114],[169,72]])a+=circle(x,y,6,'#ce4e42','#9b3e37',1)+path(`M${x-3} ${y-2}h3`,'none','#f28a63',1.5);
 a+=path('M143 95q8-8 10 2m10 1 9 8m-16-27 4 7','none','#5a9f50',4);
 return a+tree(-47,80,1.1)+tree(267,-37,.95)+food('greens',58,121,32)+food('apple',215,27,31);
}
function knightScene(){
 let a=grass()+circle(160,93,78,'#b78650','#765232',5)+circle(160,93,74,'url(#dirt)');
 for(let i=0;i<24;i++){const r=i*Math.PI/12,x=160+Math.cos(r)*80,y=93+Math.sin(r)*80;a+=rect(x-2,y-5,4,10,'#b78d55',1,'#6f5136');}
 a+=group(49,39,-32,1,prop('tent',-48,-36,96,72,palette[2]))+group(274,137,-32,1,prop('tent',-48,-36,96,72,palette[3]));
 a+=balloon(205,62,palette[0],18)+balloon(104,52,palette[1],13)+balloon(202,133,palette[2],12);
 a+=group(144,106,-30,1,prop('horse',-44,-26,88,56,palette[0])+path('M0 14H59','none','#ead2a3',5)+path('M56 8 70 14 56 20Z','#edf4e9','#869e9d',1)+avatar(-5,0,palette[0],90,1.07));
 return a+avatar(230,158,palette[3],30,.7)+tree(-46,103,.9)+tree(270,-38,.8);
}
function boulderScene(){
 let a=rect(0,0,320,180,'url(#sea)')+path('M22 19 299 29 302 152 30 166Z','#6a9bb2')+path('M17 10 294 20 297 143 25 157Z','url(#ice)','#e5fff4',3);
 a+=path('M33 25v114','none','#587f98',9)+path('M56 43q74 36 160 19M70 132q85-48 164-19','none','#8ebcd166',3);
 a+=group(231,78,15,1,ellipse(5,27,43,26,'#1e4c6644')+path('M-37-24-5-42 30-25 42 8 23 38-16 43-42 16Z','#708a9f','#dbe9de',3)+path('M-37-24-9-9-16 25-42 16M-9-9 13-31 30-25M-9-9 23 8 42 8M23 8 23 38-16 43-16 25Z','none','#465f79',3)+path('M-26-26-7-36 7-32','none','#b7ccd5',4));
 return a+avatar(103,69,palette[0],-80,1)+avatar(142,127,palette[1],-35,.9)+path('M171 66h-20m22 13h-28m34 14h-19','none','#6a93b6',3)+star(39,12,.45);
}
function snowScene(){
 let a=rect(0,0,320,180,'url(#sea)')+ellipse(159,105,135,67,'#164661')+path('M30 82Q49 20 158 23Q267 12 291 86L281 118Q185 174 56 140Z','#73a7bf')+ellipse(159,83,132,63,'url(#ice)')+ellipse(159,83,126,58,'#e4f8ed');
 a+=path('M50 103q38-25 75-3m52-51 63 16','none','#a5d2db',2);
 a+=group(196,88,0,1,ellipse(6,21,36,20,'#70a4c24c')+circle(0,0,33,'url(#ice)','#afcfd4',2)+path('M-25 5Q-21-19 4-24M-13 25Q23 27 29-8','none','#9fc9d8',3)+path('M-16-17Q-1-25 13-16','none','#fffdf2',5));
 return a+avatar(139,110,palette[0],-90,1)+avatar(92,57,palette[1],25,.85)+path('M153 108h-14m19 11h-12','none','#90b9ca',2)+star(267,39,.6);
}
function shoppingScene(){
 let a=grass()+rect(32,8,256,165,'#ecd4ab',2)+rect(43,15,117,152,'#e5b797')+rect(160,15,117,152,'#94b5d6');
 for(let y=0;y<5;y++)for(let x=0;x<8;x++)if((x+y)%2)a+=rect(43+x*29,15+y*30,29,30,x<4?'#f1cfb1':'#b9cee2');
 a+=rect(101,6,119,168,'#756b53',2);
 for(let i=0;i<4;i++){
  a+=rect(105+i*28,13,24,151,i%2?'#3f435d':'#4c516a');
  for(let j=0;j<4;j++)a+=group(117+i*28,28+j*37,i%2?0:180,1,path('M-4-3 0 1 4-3','none','#bdc0cb55',2));
 }
 a+=rect(101,7,119,8,'#e3c261',1)+rect(101,163,119,8,'#d7ab45',1)+rect(43,54,23,73,'#d25159',4,'#fff1d0',2)+rect(254,54,23,73,'#5082c3',4,'#fff1d0',2)+rect(47,59,15,60,'#30334e',3)+rect(258,59,15,60,'#30334e',3)+prop('register',45,71,18,24)+prop('register',257,80,18,24);
 a+=food('banana',104,38,27)+food('watermelon',159,112,28)+food('juice',188,43,28)+food('bomb',132,135,28);
 a+=group(101,107,65,1,prop('cart',-19,-23,38,45,palette[0])+food('apple',-12,-18,17)+food('milk',1,-6,17)+avatar(0,35,palette[0],0,.88));
 return a+avatar(238,37,palette[1],30,.75)+tree(-54,93,.85)+tree(275,-45,.9);
}
function witchScene(){
 let a=rect(0,0,320,180,'url(#night)')+tree(-44,23,1.15,true)+tree(251,53,1.15,true);
 a+=group(71,20,-25,1,prop('roof',-43,-32,86,64,palette[2]))+group(250,148,-25,1,prop('roof',-43,-32,86,64,palette[3]));
 a+=path('M85 29 230 29 273 64 273 121 230 157 85 157 48 121 48 64Z','#394872','#687989',8)+path('M85 29 230 29 273 64 273 121 230 157 85 157 48 121 48 64Z','none','#ed8c89',2.5);
 for(let i=0;i<5;i++)a+=rect(91+i*30,25,7,9,'#b6c0ad',1)+rect(91+i*30,153,7,9,'#b6c0ad',1);
 a+=path('M80 76Q133 32 167 75T241 104','none','#50c9e63c',13)+path('M80 76Q133 32 167 75T241 104','none','#66cde0',5)+path('M106 135Q157 116 164 93','none','#efa08c',5);
 a+=group(240,103,-22,1,prop('broom',-40,-9,73,27)+avatar(0,0,palette[1],70,.83))+group(162,93,-78,1,prop('broom',-32,-8,64,24)+avatar(0,0,palette[0],80,.72));
 return a+star(217,61,.7)+star(77,118,.5);
}
function lawnScene(){
 let a=grass()+rect(15,13,290,154,'#d4d3a8',4)+rect(23,21,274,138,'#7bb544',3)+rect(36,21,22,138,'#8e5343')+rect(266,21,20,138,'#9eaaa2');
 a+=path('M55 139H128V68H220','none','#b5d768',35);
 for(let y=0;y<6;y++)for(let x=0;x<9;x++){
  const px=64+x*22,py=31+y*22;
  if((px<145&&py>121)||(px>110&&px<145&&py>55)||(px>113&&px<235&&py>51&&py<85))continue;
  a+=path(`M${px} ${py+12}l-4-15 8 10 5-16-2 21Z`,(x+y)%2?'#418b3f':'#519e3e');
 }
 a+=group(218,67,90,1,ellipse(2,6,20,23,'#2b613633')+rect(-21,-18,7,13,'#394449',2)+rect(14,-18,7,13,'#394449',2)+rect(-21,10,7,13,'#394449',2)+rect(14,10,7,13,'#394449',2)+rect(-17,-21,34,44,'#d9534e',7,'#873c3b',2)+rect(-11,-17,22,17,'#ed8c70',3)+path('M-7-13h14m-14 4h14m-14 4h14','none','#853d3d',2)+path('M-13 18v18H13V18','none','#bbc5ad',3)+avatar(0,52,palette[1],0,.8));
 for(const [x,y] of [[193,108],[242,37],[84,93]])a+=circle(x,y,11,'#f4bc34','#ffe79c',2)+circle(x,y,7,'#eaa231','#f9d368',1)+path(`M${x} ${y-4}v8`,'none','#ffe8a1',2);
 return a+tree(-49,-43,.8)+tree(271,128,.8);
}
function gladiatorsScene(){
 let a=rect(0,0,320,180,'#844c39');
 for(let i=0;i<10;i++){a+=rect(0,i*18,320,12,i%2?'#d59560':'#aa684d')+path('M0 '+(i*18+12)+'H320','none','#633a33',2);}
 a+=rect(22,20,276,140,'#e4c585',9,'#6b493c',7);
 a+=rect(29,27,262,126,'#e9b96c',7,'#90a7a2',5);
 a+=circle(160,90,42,'#93513a','#f6d08e',9);
 a+=circle(160,90,32,'#bd6548','#d89967',3);
 a+=path('M137 104L146 70 163 61 182 76 176 103 160 119Z','#e9c17a','#55383a',3);
 for(const [x,y,c] of [[97,65,palette[0]],[213,112,palette[1]]]){
  a+=circle(x,y,13,c,'#283440',3);
  const bx=x+(x<160?44:-44),by=y+(x<160?23:-22);
  a+=path('M'+x+' '+y+'L'+bx+' '+by,'none','#555d67',4);
  a+=circle(bx,by,17,'#5d6373','#1c2836',3);
  for(let i=0;i<8;i++){const t=i*Math.PI/4;
   a+=path('M'+(bx+Math.cos(t)*14)+' '+(by+Math.sin(t)*14)+'L'+(bx+Math.cos(t)*24)+' '+(by+Math.sin(t)*24),'none','#d5d5cb',4);
  }
 }
 return a;
}
const scenes=Object.freeze({gladiators:gladiatorsScene,ghost:ghostScene,chickens:chickenScene,fruit_memory:memoryScene,shockwave:shockScene,color_switch:colorScene,pizza_time:pizzaScene,knight_match:knightScene,boulder_bash:boulderScene,snow_brawl:snowScene,shopping_time:shoppingScene,witching_snake:witchScene,lawn_mower:lawnScene});
const templates=new Map();
function svg(mode){
 if(!Object.hasOwn(scenes,mode))return '';
 if(!templates.has(mode))templates.set(mode,`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180" class="mode-cover-svg" aria-hidden="true" focusable="false" data-cover="${mode}"><defs>
 <linearGradient id="grass" x2=".3" y2="1"><stop stop-color="#6a9a47"/><stop offset="1" stop-color="#bdd569"/></linearGradient>
 <linearGradient id="night" x2=".2" y2="1"><stop stop-color="#484474"/><stop offset="1" stop-color="#182d4d"/></linearGradient>
 <linearGradient id="sea" x2=".6" y2="1"><stop stop-color="#36738c"/><stop offset="1" stop-color="#123c59"/></linearGradient>
 <linearGradient id="ice" x2=".7" y2="1"><stop stop-color="#fffdf0"/><stop offset=".4" stop-color="#d9f1eb"/><stop offset="1" stop-color="#9cc9db"/></linearGradient>
 <linearGradient id="lava" x2=".3" y2="1"><stop stop-color="#d85446"/><stop offset="1" stop-color="#ffbc62"/></linearGradient>
 <radialGradient id="dirt" cx=".4" cy=".3"><stop stop-color="#cda66a"/><stop offset="1" stop-color="#ad7c4d"/></radialGradient>
 <radialGradient id="balloonLight" cx=".35" cy=".3"><stop stop-color="#ffffff88"/><stop offset=".5" stop-color="#ffffff00"/><stop offset="1" stop-color="#40213c44"/></radialGradient>
 <clipPath id="frame"><rect width="320" height="180" rx="10"/></clipPath></defs><g clip-path="url(#frame)">${scenes[mode]()}</g>${rect(1,1,318,178,'none',10,'#ffffff30',2)}</svg>`);
 // A game can appear several times in the same page. Every inline SVG owns
 // its gradients and clip paths, including nested props and ingredients.
 return scope(templates.get(mode),`gc${++serial}-`);
}
window.PartyGameCovers=Object.freeze({svg,ids:Object.freeze(Object.keys(scenes))});
})();
