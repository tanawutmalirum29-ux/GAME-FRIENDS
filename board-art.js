/* Original vector winter scenery: ground, scenery, paths, actors, FX, then HUD. */
(() => {
'use strict';
const TAU=Math.PI*2,sceneHeight=s=>Number(s?.camera?.viewHeight)||540,mapBottom=s=>sceneHeight(s)-88,sceneOffset=s=>(sceneHeight(s)-540)/2,colors={start:'#45c4d9',finish:'#ffca63',movement:'#54acc5',healing:'#59ad91',danger:'#cf7180',event:'#9b84bd',key:'#c49b63',milestone:'#d9b862',neutral:'#9cabb7',sword:'#63748c',lucky:'#8660ad'};
// Keep one bounded terrain surface. Replays explicitly release the old pixels
// instead of waiting for mobile Safari to collect detached canvases.
let terrain=null;
function path(g,points,fill,stroke=null,width=2){g.beginPath();points.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}}
function circle(g,x,y,r,fill,stroke=null,w=2){g.beginPath();g.arc(x,y,r,0,TAU);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=w;g.stroke();}}
function box(g,x,y,w,h,r,fill,stroke=null){g.beginPath();g.roundRect(x,y,w,h,r);g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=1;g.stroke();}}
function label(g,text,x,y,size=14,color='#e9f9ff',align='left',weight=700,maxWidth=null){
 const content=String(text);
 g.font=weight+' '+size+'px "Noto Sans Thai", sans-serif';
 g.textBaseline='middle';g.fillStyle=color;
 // iOS WebKit may anchor Thai / mixed Thai-Latin canvas text to the given
 // coordinate even with textAlign='center'. Compute a PHYSICAL left edge
 // from actual shaped metrics instead, so the visual box stays centered on x.
 // The maxWidth cap matches Canvas fillText's horizontal compression.
 const centeredThai=align==='center'&&/[\u0E00-\u0E7F]/.test(content);
 const measured=centeredThai?g.measureText?.(content)?.width:null;
 const usable=Number.isFinite(measured)&&measured>0;
 const width=usable?(maxWidth>0?Math.min(measured,maxWidth):measured):0;
 const drawX=centeredThai&&usable?x-width/2:x;
 g.textAlign=centeredThai&&usable?'left':align;
 if(maxWidth)g.fillText(content,drawX,y,maxWidth);
 else g.fillText(content,drawX,y);
}
function line(g,x,y,a,b,color,w=2){g.strokeStyle=color;g.lineWidth=w;g.lineCap='round';g.beginPath();g.moveTo(x,y);g.lineTo(a,b);g.stroke();}
function star(g,x,y,r,fill){path(g,Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,d=i%2?r*.45:r;return[x+Math.cos(a)*d,y+Math.sin(a)*d];}),fill);}
function icon(g,kind,x,y,size=20,color='#fff'){
 // Source of truth is the same detailed Christmas SVG as the phone UI.
 // Canvas vector fallback stays available while Safari decodes the image.
 if(['potion','ufo','rocket','bomber','car','shield'].includes(kind)&&
    window.PartyUiArt?.draw?.(g,kind,x,y,size*2.05))return;
 g.save();g.translate(x,y);g.scale(size/20,size/20);g.lineJoin='round';
 if(kind==='bag'){window.PartyUiArt?.draw(g,'bag',0,0,34);}
 else if(kind==='healing'||kind==='potion'){
  if(kind==='potion'){box(g,-10,-10,20,26,6,'#aaf0df','#fff');box(g,-5,-17,10,7,2,'#d09c65');}
  line(g,-7,0,7,0,color,4);line(g,0,-7,0,7,color,4);
 }else if(kind==='sword'){
  // Each blade has a point, fuller, crossguard, grip and pommel.
  for(const tilt of [-Math.PI/4,Math.PI/4]){
   g.save();g.rotate(tilt);
   path(g,[[0,-20],[3.8,-11],[3,3],[-3,3],[-3.8,-11]],'#ebf4ff','#3b5264',1.6);
   line(g,0,-15,0,2,'#fff',1.2);
   path(g,[[-11,4],[-3,2],[3,2],[11,4],[9,8],[0,6],[-9,8]],'#edc777','#755d46',1.3);
   box(g,-2.5,7,5,11,1,'#956a49','#f3dc9a');
   circle(g,0,19,3,'#ffdf8f','#826247',1.2);
   g.restore();
  }
 }else if(kind==='danger'){
  circle(g,0,-3,10,color);box(g,-6,2,12,9,2,color);circle(g,-4,-3,2.7,'#924454');circle(g,4,-3,2.7,'#924454');line(g,-2,7,-2,11,'#924454');line(g,3,7,3,11,'#924454');
 }else if(kind==='event')star(g,0,0,12,color);
 else if(kind==='lucky'){star(g,0,0,15,'#ffda59');circle(g,0,0,3,'#fff1ad');}
 else if(kind==='key'){circle(g,-6,-3,6,null,color,3);line(g,-1,1,10,10,color,4);line(g,6,7,9,4,color,3);}
 else if(kind==='milestone'||kind==='finish'){path(g,[[-9,-11],[9,-11],[6,2],[0,6],[-6,2]],color);line(g,0,4,0,12,color,3);line(g,-6,12,6,12,color,3);g.strokeStyle=color;g.lineWidth=3;g.beginPath();g.arc(-9,-6,5,Math.PI/2,Math.PI*1.5);g.stroke();g.beginPath();g.arc(9,-6,5,-Math.PI/2,Math.PI/2);g.stroke();}
 else if(kind==='ufo'){
  g.fillStyle='#9de5ff';g.beginPath();g.ellipse(0,-4,8,9,0,0,TAU);g.fill();g.fillStyle='#6c83b1';g.beginPath();g.ellipse(0,2,18,7,0,0,TAU);g.fill();for(let i=-1;i<=1;i++)circle(g,i*10,3,2,'#ffe49b');
 }else if(kind==='rocket'){
  path(g,[[-6,7],[-10,15],[-9,0],[-5,-5]],'#ef6e7e');path(g,[[6,7],[10,15],[9,0],[5,-5]],'#ef6e7e');path(g,[[-6,10],[-6,-7],[0,-18],[6,-7],[6,10]],'#effcff','#669ab3');circle(g,0,-4,3.5,'#5fcbe5');path(g,[[-4,11],[0,22],[4,11]],'#ffcd6c');
 }else if(kind==='bomber'){
  path(g,[[0,-18],[5,-3],[20,6],[19,11],[4,6],[3,15],[10,20],[-10,20],[-3,15],[-4,6],[-19,11],[-20,6],[-5,-3]],'#f5c969','#8f683c');line(g,0,-9,0,12,'#fff2c4',3);
 }else if(kind==='car'){
  box(g,-12,-13,5,9,2,'#263c55');box(g,7,-13,5,9,2,'#263c55');box(g,-12,6,5,9,2,'#263c55');box(g,7,6,5,9,2,'#263c55');box(g,-8,-15,16,32,5,'#ed8398','#fff');circle(g,0,2,6,'#314860');line(g,0,-4,4,-9,'#f5d783',2);
 }else if(kind==='shield'){
  path(g,[[-12,-14],[0,-18],[12,-14],[11,1],[7,10],[0,17],[-7,10],[-11,1]],'#6fc9ee','#e3faff',2);
  path(g,[[0,-14],[9,-11],[8,0],[5,7],[0,12]],'#3a8cbc');line(g,-5,0,-1,5,'#fff',3);line(g,-1,5,6,-5,'#fff',3);
 }else if(kind==='neutral')circle(g,0,0,4,color);
 else {path(g,[[-9,-4],[1,-4],[1,-9],[11,0],[1,9],[1,4],[-9,4]],color);}
 g.restore();
}
function dice(g,value,x,y,size=42,rolling=false,t=0,index=0,lowDetail=false){
  // Scene art is Canvas vector-based; the shared renderer projects rotating 3D
  // cube geometry and all six pip layouts, independent of rule RNG.
  window.BoardDiceRenderer?.draw(g,value,x,y,size,rolling?t:Infinity,index,lowDetail);
}
function pine(g,x,y,scale=1,festive=false){
 g.save();g.translate(x,y);g.scale(scale,scale);
 g.fillStyle='#35687930';g.beginPath();g.ellipse(8,8,36,13,0,0,TAU);g.fill();box(g,-5,-7,10,21,3,'#795d56');
 for(let i=0;i<3;i++){const y=-i*24,w=36-i*8;path(g,[[-w,y],[0,y-54],[w,y]],festive?'#397e76':'#5d9f9f','#406e81');path(g,[[-w+4,y-4],[0,y-54],[w-4,y-4],[w*.4,y-13],[0,y-6],[-w*.4,y-13]],'#e1f9ff');}
 if(festive){star(g,0,-108,10,'#ffdb88');for(let j=0;j<8;j++){const yy=-18-j*10,xx=Math.sin(j*2)*Math.max(5,26-j*3);circle(g,xx,yy,3.2,j%2?'#ffb9c4':'#ffe8a2');}}
 g.restore();
}
function gift(g,x,y,s=1){g.save();g.translate(x,y);g.scale(s,s);box(g,-13,-15,26,24,4,'#d77fa6','#fcdaeb');box(g,-15,-20,30,8,3,'#e6a6c6');line(g,0,-20,0,8,'#ffe9b1',5);g.strokeStyle='#ffe9b1';g.lineWidth=3;g.beginPath();g.ellipse(-5,-24,6,3,.5,0,TAU);g.ellipse(5,-24,6,3,-.5,0,TAU);g.stroke();g.restore();}
function rock(g,x,y,s=1){g.save();g.translate(x,y);g.scale(s,s);path(g,[[-30,10],[-24,-17],[-4,-42],[13,-24],[31,5],[19,20],[-17,22]],'#72b9d2','#bceef8');path(g,[[-24,-17],[-4,-42],[13,-24],[17,-7],[3,-12],[-7,-5]],'#effcff');path(g,[[-4,-33],[-7,15],[22,9],[12,-17]],'#b5eaf4');g.restore();}
const regionPalette={
 start:['#effeff','#c0e3e9','#5f9dac'],crossroads:['#f2fcff','#c5dcea','#789aac'],
 sword:['#eaf3ff','#b6cada','#657e99'],risk:['#f0f2ff','#c7c6e8','#817fa7'],
 reward:['#ecfff9','#b3e2da','#619e9b'],final:['#fffaf0','#dcdfd6','#8e9eaa'],
 finish:['#fffaf0','#dcdfd6','#8e9eaa']
};
const themeAliases={camp:'start',grove:'crossroads',frost:'risk',aurora:'crossroads',lucky:'reward',crown:'finish',village:'start',comet:'reward'};
function regionTheme(zone){return themeAliases[zone.theme]||zone.theme;}
function regionColors(zone){return regionPalette[regionTheme(zone)]||regionPalette.crossroads;}
function contour(g,points,dy=0,inset=1,center={x:0,y:0}){
 const p=points.map(v=>({x:center.x+(v.x-center.x)*inset,y:center.y+(v.y-center.y)*inset+dy}));
 g.beginPath();g.moveTo((p[0].x+p[p.length-1].x)/2,(p[0].y+p[p.length-1].y)/2);
 for(let i=0;i<p.length;i++){const next=p[(i+1)%p.length];g.quadraticCurveTo(p[i].x,p[i].y,(p[i].x+next.x)/2,(p[i].y+next.y)/2);}g.closePath();
}
function inside(point,outline){
 let hit=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){
  const a=outline[i],b=outline[j];if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
 }return hit;
}
function island(g,zone,lite=false){
 const p=zone.outline,c=zone.center,colors=regionColors(zone);
 contour(g,p,44,1.035,c);g.fillStyle='#062a4655';g.fill();
 contour(g,p,27,1,c);g.fillStyle='#2d5a76';g.fill();
 contour(g,p,17,1,c);g.fillStyle=colors[2];g.fill();
 contour(g,p,6,1.005,c);g.fillStyle='#9bd2e0';g.fill();
 contour(g,p,0,1,c);
 const frost=g.createLinearGradient(c.x-200,c.y-300,c.x+200,c.y+300);frost.addColorStop(0,colors[0]);frost.addColorStop(.65,'#e0f3f5');frost.addColorStop(1,colors[1]);
 g.fillStyle=frost;g.fill();g.strokeStyle='#f5ffff';g.lineWidth=8;g.stroke();
 if(lite)return;
 // Snow ledges catch the light; facets on the lower edge establish depth.
 for(let i=0;i<p.length;i++){
  const a=p[i],b=p[(i+1)%p.length],x=(a.x+b.x)/2,y=(a.y+b.y)/2;
  if(y<c.y)continue;
  path(g,[[x-12,y+8],[x+14,y+7],[x+5,y+34]],i%2?'#b5e7ec':'#77b6cc');
 }
 g.save();contour(g,p,0,.91,c);g.clip();
 for(let j=0;j<8;j++){const yy=c.y-230+j*69;g.beginPath();g.moveTo(c.x-540,yy);g.bezierCurveTo(c.x-160,yy-35,c.x+110,yy+40,c.x+540,yy-14);g.strokeStyle=j%2?'#ffffff72':'#89bdce18';g.lineWidth=j%2?5:2;g.stroke();}g.restore();
}
function bridge(g,a,b,kind='wood'){
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
 g.save();g.translate(a.x,a.y);g.rotate(angle);
 line(g,12,15,len+12,15,'#082c4566',110);
 if(kind==='ice'){
  line(g,0,0,len,0,'#508ca9',102);line(g,0,0,len,0,'#c3f4fb',90);
  for(let x=10;x<len;x+=45){path(g,[[x,-38],[Math.min(x+35,len),-30],[Math.min(x+12,len),31]],'#eaffff88');line(g,x,-41,Math.min(x+22,len),40,'#73bdce',2);}
  line(g,0,-44,len,-44,'#e7ffff',4);line(g,0,44,len,44,'#89d6e6',4);
 }else if(kind==='stone'||kind==='arched'){
  line(g,0,0,len,0,'#526d83',108);line(g,0,0,len,0,'#a7bdcc',90);
  for(let x=0;x<len;x+=30){line(g,x,-44,x,44,'#6d8b9f',2);line(g,x,-40,Math.min(x+25,len),-40,'#e1f2f5',4);}
  line(g,0,-50,len,-50,'#dfebee',12);line(g,0,50,len,50,'#768d9d',12);
  if(kind==='arched')for(let x=35;x<len-35;x+=100){g.beginPath();g.arc(x,53,27,0,Math.PI);g.strokeStyle='#22445a';g.lineWidth=9;g.stroke();}
  for(let x=0;x<=len;x+=76){box(g,x-7,-60,14,21,3,'#dcebef','#687f95');box(g,x-7,39,14,21,3,'#b6d2dc','#687f95');}
 }else{
  line(g,0,-34,len,-34,'#573d38',13);line(g,0,34,len,34,'#573d38',13);
  for(let x=0;x<len;x+=17){box(g,x,-43,Math.min(15,len-x),86,2,Math.floor(x/17)%2?'#bc9773':'#c8aa86','#735847');line(g,x+3,-36,x+3,35,'#e1c6a022',1);}
  for(const y of [-50,50]){
   if(kind==='rope'){
    g.beginPath();g.moveTo(0,y);g.quadraticCurveTo(len/2,y+Math.sign(y)*20,len,y);
    g.strokeStyle='#e6cf9e';g.lineWidth=5;g.stroke();
   }else{line(g,0,y,len,y,'#674c42',4);line(g,0,y-4,len,y-4,'#e1c49b',2);}
  }
  for(let x=0;x<=len;x+=60){for(const y of [-49,49]){box(g,x-4,y-9,8,18,2,'#70554a');line(g,x-5,y-9,x+5,y-9,'#effaff',3);}}
 }
 g.restore();
}
function lantern(g,x,y,s=1){
 g.save();g.translate(x,y);g.scale(s,s);line(g,0,8,0,-43,'#4a6170',4);line(g,0,-42,15,-42,'#4a6170',3);
 box(g,7,-42,16,22,3,'#fff0af','#6c6c69');path(g,[[5,-42],[15,-50],[25,-42]],'#587282');line(g,15,-40,15,-22,'#dfbd68',2);g.restore();
}
function fence(g,x,y){
 line(g,x,y,x+65,y-6,'#9b7961',6);line(g,x,y+12,x+65,y+6,'#c2a186',5);
 for(const k of [0,32,65]){line(g,x+k,y+19,x+k,y-17,'#7f6352',7);line(g,x+k-4,y-18,x+k+4,y-18,'#f5ffff',5);}
}
function landmark(g,zone){
 const p=zone.landmark;if(!p)return;const x=p.x,y=p.y,theme=regionTheme(zone);
 g.save();g.translate(x,y);g.fillStyle='#3768782e';g.beginPath();g.ellipse(5,23,90,23,0,0,TAU);g.fill();
 if(theme==='sword'){
  // Snowbound watchtower and crossed swords identify the shared territory.
  box(g,-57,-53,114,76,7,'#778a9f','#455c76');box(g,-64,-65,128,20,3,'#b2c4d6','#61778f');
  for(let i=0;i<5;i++)box(g,-62+i*27,-81,18,22,3,'#e4eff7','#7c94aa');
  for(let j=0;j<3;j++)line(g,-55,-36+j*22,54,-36+j*22,'#627b91',2);
  box(g,-13,-21,26,44,12,'#2e4c66');icon(g,'sword',0,-104,42);
  for(const xx of [-79,79]){line(g,xx,23,xx,-88,'#526b81',5);path(g,[[xx,-88],[xx+31,-83],[xx+27,-46],[xx,-52]],'#887bc0','#dddafa');}
 }else if(theme==='risk'){
  for(const [xx,yy,ss]of [[-55,6,1.1],[5,-15,1.6],[66,10,.9]])rock(g,xx,yy,ss);
  line(g,-34,34,35,34,'#759cb2',9);path(g,[[-25,32],[0,-9],[25,32]],'#b6a2d7','#e7e5ff',3);icon(g,'danger',0,16,13,'#45516e');
 }else if(theme==='reward'){
  pine(g,0,0,1.05,true);gift(g,-48,22,1.4);gift(g,51,24,1);lantern(g,84,20,1);
 }else if(theme==='finish'||theme==='final'){
  box(g,-63,-90,126,110,5,'#c8e2ec','#7e9db2');
  for(const xx of [-84,0,84]){
   box(g,xx-19,-128,38,145,4,'#b9d8e7','#6e91a9');
   path(g,[[xx-27,-126],[xx,-176],[xx+27,-126]],'#eafaff','#7da8c0',3);
   box(g,xx-7,-105,14,23,5,'#547e9b');
   line(g,xx,-172,xx,-198,'#738eab',3);path(g,[[xx,-198],[xx+29,-190],[xx,-181]],'#dca8bc');
  }
  box(g,-16,-28,32,48,13,'#365b78','#fbebbc');
  for(const xx of [-64,64]){box(g,xx-12,-85,24,107,5,'#b6cbd7','#728ca1');box(g,xx-17,-91,34,13,4,'#fff7db','#bcac7b');}
  path(g,[[-83,-93],[0,-132],[83,-93],[72,-78],[0,-109],[-72,-78]],'#f4d78a','#9b8b66',3);
  icon(g,'finish',0,-76,36,'#be9758');box(g,-68,15,136,14,4,'#ebf4f7','#9bb6c4');
 }else if(theme==='start'){
  box(g,-47,-44,94,66,5,'#ba9474','#6b635a');path(g,[[-64,-42],[0,-99],[64,-42]],'#789eaa','#526f80',4);path(g,[[-63,-46],[0,-103],[63,-46],[36,-51],[0,-85],[-36,-51]],'#f2ffff');
  box(g,-13,-15,27,37,6,'#5e737c');box(g,-37,-27,17,20,3,'#fff0b4','#6a8490');box(g,20,-27,17,20,3,'#fff0b4','#6a8490');lantern(g,-78,20,1);
 }else{
  pine(g,-35,20,.9);rock(g,33,17,.9);line(g,0,27,0,-56,'#816954',7);box(g,-47,-61,91,23,4,'#bfa17d','#776652');label(g,'EXPLORE',-2,-49,12,'#fff7d8','center');
 }
 g.restore();
}
function decoration(g,d){
 const {kind,x,y,scale:s=1}=d;
 if(kind==='pine')return pine(g,x,y,s,true);
 if(kind==='gift')return gift(g,x,y,s);
 if(kind==='rock')return rock(g,x,y,s);
 if(kind==='lantern')return lantern(g,x,y,s);
 if(kind==='fence')return fence(g,x,y);
 g.save();g.translate(x,y);g.scale(s,s);
 if(kind==='house')landmark(g,{theme:'camp',landmark:{x:0,y:0}});
 else if(kind==='mountain'){
  path(g,[[-100,25],[-65,-55],[-15,-160],[35,-77],[105,25]],'#78a5bc','#547e99',4);
  path(g,[[-15,-160],[35,-77],[12,-88],[-2,-65],[-22,-98],[-45,-84]],'#f4ffff');
  path(g,[[-15,-147],[-8,25],[105,25],[35,-77]],'#adcfdc');
  path(g,[[-15,-147],[35,-77],[12,-88],[-2,-65]],'#fff');
 }else if(kind==='cave'){
  path(g,[[-65,24],[-50,-38],[0,-75],[50,-38],[65,24]],'#a0cbd9','#58869d',3);
  g.beginPath();g.ellipse(0,14,29,40,0,Math.PI,TAU);g.fillStyle='#1c4964';g.fill();
  for(const x of [-20,0,20])path(g,[[x-7,-26],[x+7,-26],[x,-3]],'#e4ffff');
 }else if(kind==='lake'){
  g.beginPath();g.ellipse(0,0,135,95,-.2,0,TAU);g.fillStyle='#81bacf';g.fill();g.strokeStyle='#f9ffff';g.lineWidth=14;g.stroke();
  g.beginPath();g.ellipse(0,-5,120,78,-.2,0,TAU);g.fillStyle='#afdfeb';g.fill();
  line(g,-75,-23,65,-42,'#e7ffff',6);line(g,-45,21,87,0,'#d7f8ff',4);
  path(g,[[-100,15],[-50,5],[-25,22],[20,13]],null,'#72b6cc',2);
 }
 g.restore();
}
function decorations(g,s){
 const c=s.camera,z=Math.max(.04,c.zoom),halfW=480/z+300,halfH=(mapBottom(s)-94)/2/z+300;
 const visible=p=>Math.abs(p.x-c.x)<halfW&&Math.abs(p.y-c.y)<halfH;
 // Authored placements, drawn sharply at follow zoom; no seed and no spawning.
 for(const zone of s.map.islands){
  for(const d of zone.decorations)if(visible(d))decoration(g,d);
  if(visible(zone.landmark))landmark(g,zone);
 }
}
function scenery(g,map){
 g.fillStyle='#183e5d';g.fillRect(0,0,map.width,map.height);
 // Ocean texture is fixed too; gameplay RNG never enters the renderer.
 for(let i=0;i<160;i++){const x=(i*977+143)%map.width,y=(i*661+71)%map.height;line(g,x,y,x+52,y-5,'#81d9df16',2);}
 for(const zone of map.islands)island(g,zone);
 const bridgeKeys=new Set(map.bridges.map(([a,b])=>a+'>'+b));
 for(const n of Object.values(map.nodes))for(const id of n.nextNodes){if(bridgeKeys.has(n.id+'>'+id))continue;const p=map.nodes[id].position;line(g,n.position.x,n.position.y,p.x,p.y,'#7da9b733',101);line(g,n.position.x,n.position.y,p.x,p.y,'#f9ffff',92);line(g,n.position.x,n.position.y,p.x,p.y,'#bdd9df',68);line(g,n.position.x,n.position.y,p.x,p.y,'#dbeef0',61);}
 for(const [a,b]of map.bridges)bridge(g,map.nodes[a].position,map.nodes[b].position,map.bridgeStyles[a+'>'+b]);
}
// Allocation failure keeps the same island silhouette and walkable connections;
// ornaments share the same culled vector pass. Memory stays bounded.
function sceneryLite(g,s){
 const map=s.map,c=s.camera,zoom=Math.max(.06,c.zoom||1),width=480/zoom+220,height=(mapBottom(s)-(94))/2/zoom+220;
 const intersects=(a,b)=>Math.max(a.x,b.x)>=c.x-width&&Math.min(a.x,b.x)<=c.x+width&&Math.max(a.y,b.y)>=c.y-height&&Math.min(a.y,b.y)<=c.y+height;
 g.fillStyle='#183e5d';g.fillRect(0,0,map.width,map.height);
 for(const zone of map.islands||[]){const p=zone.outline;if(intersects({x:Math.min(...p.map(v=>v.x)),y:Math.min(...p.map(v=>v.y))},{x:Math.max(...p.map(v=>v.x)),y:Math.max(...p.map(v=>v.y))}))island(g,zone,true);}
 const bridges=new Set(map.bridges.map(([a,b])=>a+'>'+b));
 for(const n of Object.values(map.nodes))for(const id of n.nextNodes){const a=n.position,b=map.nodes[id].position;if(!intersects(a,b)||bridges.has(n.id+'>'+id))continue;line(g,a.x,a.y,b.x,b.y,'#f9ffff',92);line(g,a.x,a.y,b.x,b.y,'#bdd9df',65);}
 for(const [from,to] of map.bridges){const a=map.nodes[from].position,b=map.nodes[to].position;if(intersects(a,b))bridge(g,a,b,map.bridgeStyles?.[from+'>'+to]||'wood');}
}
function ambience(g,s,t){
 if(s.camera.lowDetail)return;
 for(const zone of s.map.islands||[]){const p=zone.landmark;if(!p||Math.abs(p.x-s.camera.x)>550/s.camera.zoom||Math.abs(p.y-s.camera.y)>(mapBottom(s)-(94))/2/s.camera.zoom)continue;
  const shimmer=.35+.35*Math.sin(t*1.7+zone.center.x);g.save();g.globalAlpha=shimmer;star(g,p.x+72,p.y-95,5,'#e7faff');star(g,p.x-84,p.y-22,3,'#ffe7a4');g.restore();
 }
}
function ground(g,s){
 if(terrain?.map!==s.map){
  if(terrain?.canvas){terrain.canvas.width=1;terrain.canvas.height=1;}
  terrain={map:s.map,canvas:null};
  if(typeof document!=='undefined'){
   const c=document.createElement('canvas'),scale=Math.min(2,Math.sqrt(3500000/(s.map.width*s.map.height)));
   try{
    c.width=Math.floor(s.map.width*scale);c.height=Math.floor(s.map.height*scale);
    const ctx=c.getContext('2d',{alpha:false});
    if(ctx){ctx.scale(c.width/s.map.width,c.height/s.map.height);scenery(ctx,s.map);terrain.canvas=c;}
   }catch(_){/* Direct vector drawing remains available under canvas memory pressure. */}
   if(!terrain.canvas){c.width=1;c.height=1;}
  }
 }
 const layer=terrain.canvas;
 if(layer){
  const c=s.camera,halfW=480/c.zoom,halfH=(mapBottom(s)-(94))/2/c.zoom;
  const x=Math.max(0,c.x-halfW-2),y=Math.max(0,c.y-halfH-2),w=Math.min(s.map.width-x,halfW*2+4),h=Math.min(s.map.height-y,halfH*2+4);
  const sx=layer.width/s.map.width,sy=layer.height/s.map.height;
  g.drawImage(layer,x*sx,y*sy,w*sx,h*sy,x,y,w,h);
 }else sceneryLite(g,s);
}
const regionLabelCache=new WeakMap();
function regionLabelPositions(map,zoom){
 const bucket=Math.max(3,Math.ceil(zoom*20)),scale=Math.max(1,.64/(bucket/20));
 let cached=regionLabelCache.get(map);if(!cached){cached=new Map();regionLabelCache.set(map,cached);}if(cached.has(bucket))return cached.get(bucket);
 const hw=65*scale,hh=13*scale,edges=Object.values(map.nodes).flatMap(n=>n.nextNodes.map(id=>[n.position,map.nodes[id].position])),chosen=[];
 function hit(a,b,r){
  let low=0,high=1;for(const key of ['x','y']){const d=b[key]-a[key],min=key==='x'?r.x-hw-49:r.y-hh-49,max=key==='x'?r.x+hw+49:r.y+hh+49;
   if(Math.abs(d)<.001){if(a[key]<min||a[key]>max)return false;continue;}
   let t1=(min-a[key])/d,t2=(max-a[key])/d;if(t1>t2)[t1,t2]=[t2,t1];low=Math.max(low,t1);high=Math.min(high,t2);if(low>high)return false;
  }return true;
 }
 for(const zone of map.islands||[]){
  const anchor=zone.theme==='camp'?map.nodes[map.startId].position:zone.theme==='crown'?map.nodes[map.finishId].position:zone.landmark||zone.center,candidates=[{x:anchor.x,y:anchor.y+60}];
  for(let ring=1;ring<=15;ring++)for(let j=0;j<20;j++){const angle=Math.PI/2+j*TAU/20;candidates.push({x:anchor.x+Math.cos(angle)*ring*62,y:anchor.y+60+Math.sin(angle)*ring*62});}
  const pos=candidates.find(p=>p.x-hw>20&&p.x+hw<map.width-20&&p.y-hh>20&&p.y+hh<map.height-20&&
   !edges.some(([a,b])=>hit(a,b,p))&&!chosen.some(q=>Math.abs(q.x-p.x)<hw*2+30&&Math.abs(q.y-p.y)<hh*2+20)&&
   !map.islands.some(i=>{const q=i.landmark||i.center;return p.x+hw>q.x-95&&p.x-hw<q.x+95&&p.y+hh>q.y-132&&p.y-hh<q.y+30;}));
  if(pos)chosen.push({...pos,zone,scale,anchor});
 }
 cached.set(bucket,chosen);return chosen;
}
function regionLabels(g,s){
 const c=s.camera;
 for(const {x,y,zone,scale,anchor}of regionLabelPositions(s.map,c.zoom)){
  if(Math.abs(x-c.x)>550/c.zoom||Math.abs(y-c.y)>340/c.zoom)continue;
  if(Math.hypot(x-anchor.x,y-anchor.y)>130){line(g,anchor.x,anchor.y+28,x,y,'#7ba7b58c',1.5/c.zoom);circle(g,anchor.x,anchor.y+28,3/c.zoom,'#b6d8df');}
  g.save();g.translate(x,y);g.scale(scale,scale);
  box(g,-65,-13,130,27,7,'#173c53ed','#92b7c4');
  const theme=regionTheme(zone),kind=theme==='sword'?'sword':theme==='risk'?'danger':theme==='reward'?'lucky':theme==='finish'?'finish':'movement';
  icon(g,kind,-51,0,8,theme==='finish'?'#ffe0a0':'#b9e5ee');
  const title=c.zoom<.4?(zone.theme==='camp'?'START • NOEL':zone.theme==='crown'?'FINISH • CROWN':zone.name.replace(' HARBOR','').replace(' RIDGE','').replace(' GARDEN','').replace(' REACH','')):zone.name;
  label(g,title,-37,0,11,zone.theme==='crown'?'#ffe4a5':'#e1f3f8','left',700,95);g.restore();
 }
}
function nodes(g,s){
 regionLabels(g,s);
 // Most of the 47+ tiles are off-screen. Skip both far-away nodes and paths
 // to reduce Canvas calls substantially on low-FPS phones/tablets.
 const c=s.camera,zoom=Math.max(.06,c.zoom||1);
 const halfW=480/zoom+95;
 const halfH=(mapBottom(s)-(94))/2/zoom+95;
 const visible=(x,y,r=0)=>Math.abs(x-c.x)<=halfW+r&&Math.abs(y-c.y)<=halfH+r;
 const edgeVisible=(a,b)=>Math.max(a.x,b.x)>=c.x-halfW&&
   Math.min(a.x,b.x)<=c.x+halfW&&Math.max(a.y,b.y)>=c.y-halfH&&
   Math.min(a.y,b.y)<=c.y+halfH;
 for(const n of Object.values(s.map.nodes))for(const id of n.nextNodes){const a=n.position,b=s.map.nodes[id].position;
  if(!edgeVisible(a,b))continue;
  const branch=s.map.branches.find(v=>v.nodeIds.includes(id));
  const tint=branch?.kind==='risky'?'#b78964':branch?'#6e9d91':'#5c8ea5';
  g.save();g.translate(a.x+(b.x-a.x)*.52,a.y+(b.y-a.y)*.52);g.rotate(Math.atan2(b.y-a.y,b.x-a.x));
  for(const shift of [-5,5])path(g,[[shift-4,-5],[shift+2,0],[shift-4,5]],null,tint,2.5);g.restore();
  if(branch&&id===branch.nodeIds[0]&&c.zoom>.55){
   const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),x=(a.x+b.x)/2-dy/d*58,y=(a.y+b.y)/2+dx/d*58;
   box(g,x-44,y-10,88,20,6,'#edf9f8ef',tint);label(g,branch.kind==='risky'?'ลัด • เสี่ยง':'อ้อม • ฮีล / โชค',x,y,9,'#36596c','center',700,80);
  }
 }
 for(const n of Object.values(s.map.nodes)){
  const {x,y}=n.position;
  if(!visible(x,y,75))continue;
  const owner=n.type==='sword'?s.players.find(p=>p.id===s.map.territories[n.territoryId]?.ownerId):null;
  const tileColor=owner?.color||colors[n.type]||colors.neutral;
  const pulse=s.camera.lowDetail?0:Math.sin(s.time*3)*1.5;
  if(n.type==='lucky')circle(g,x,y,49+pulse,'#ffd66a25','#d4b867',2);
  if(n.nextNodes.length>1){circle(g,x,y,53,null,'#b9985b',3);for(let j=0;j<4;j++)circle(g,x+Math.cos(j*Math.PI/2)*53,y+Math.sin(j*Math.PI/2)*53,3,'#ffe6aa');}
  // Ceramic playing pieces, inset emblem and a shaded rim sit above the trail.
  circle(g,x+2,y+8,45,'#35577140');circle(g,x,y+4,44,'#47687b');
  const bevel=g.createLinearGradient(x-25,y-43,x+20,y+42);bevel.addColorStop(0,'#faffff');bevel.addColorStop(.45,'#c8e2e9');bevel.addColorStop(1,'#7eafc0');
  circle(g,x,y,44,bevel,n.type==='lucky'?'#d2b66c':'#648a9e',1.5);
  circle(g,x,y,38,tileColor,'#ffffffb0',2);circle(g,x,y-1,33,null,'#ffffff45',1);
  g.save();g.beginPath();g.arc(x,y,35,Math.PI*1.08,Math.PI*1.78);g.strokeStyle='#ffffff66';g.lineWidth=3;g.stroke();g.restore();
  g.save();g.translate(x,y);
  if(n.type==='movement'||n.type==='start'){const q=s.map.nodes[n.nextNodes[0]];if(q)g.rotate(Math.atan2(q.position.y-y,q.position.x-x));}
  icon(g,n.type,0,0,n.type==='sword'?25:n.type==='lucky'?23:20,'#f7ffff');g.restore();
   if(c.debugNodes){
    g.save();g.translate(x,y-53);g.scale(1/c.zoom,1/c.zoom);
    box(g,-27,-9,54,18,4,'#0a2a43e9','#72b1cf');
    label(g,c.zoom<.2?n.id.replace(/^n/,''):n.id,0,0,9,'#fff','center',800,50);
    g.restore();
   }
  if(owner){box(g,x-38,y+27,76,16,7,'#173b50e6');label(g,owner.name,x,y+35,10,owner.color,'center',800,68);}
  if(n.type==='start'||n.type==='finish'){
   if(c.zoom>.4){box(g,x-56,y-72,112,25,9,'#163b54');label(g,n.type==='start'?'START':'FINISH',x,y-59,12,'#fff','center');}
   if(n.type==='finish'){line(g,x-40,y-45,x-40,y+10,'#eefaff',5);line(g,x+40,y-45,x+40,y+10,'#eefaff',5);box(g,x-43,y-50,86,14,3,'#fff');for(let j=0;j<8;j++)box(g,x-40+j*10,y-49+(j%2)*7,10,7,0,'#234d62');}
  }
 }
 if(s.phase==='branch'||s.phase==='move_ready'){
  const p=window.BoardParty.current(s),a=s.map.nodes[p.currentNodeId].position;
  const choices=s.phase==='branch'?s.branch:{options:s.map.nodes[p.currentNodeId].nextNodes,selected:s.map.nodes[p.currentNodeId].nextNodes[0]};
  for(const id of choices.options){const b=s.map.nodes[id].position,selected=id===choices.selected;line(g,a.x,a.y,b.x,b.y,selected?'#ffe38b':'#75acc4',selected?8:3);circle(g,b.x,b.y,34,null,selected?'#ffe59a':'#fff8',selected?5:2);if(!s.players.some(q=>q.currentNodeId===id))label(g,s.move.kind==='walk'?'ชี้จอยทางนี้':selected?'A • ทางนี้':'เลือกทาง',b.x,b.y+59,10,'#173b53','center');}
 }
}
// Facing is visual state only: keep a stopped explorer looking along their last
// direction without writing to the authoritative board player or graph.
const actorFacing=new WeakMap();
function actors(g,s,t){
 const I=window.BoardItems,active=window.BoardParty.current(s);
 const list=s.players.map(p=>({p,pos:I.position(s,p)})).sort((a,b)=>a.pos.y-b.pos.y);
 for(const {p,pos}of list){
  const dead=p.death&&s.time-p.death.at<1.2,xy=dead?p.death.position:pos;
  g.save();if(window.BoardParty.isProtected(s,p)){circle(g,xy.x,xy.y,29,'#8cddf42d',p.blockedUntil>s.time?'#fff':'#8bd8f1',p.blockedUntil>s.time?5:2);icon(g,'shield',xy.x-22,xy.y-25,10);}
  if(p.id===active?.id){circle(g,xy.x,xy.y,29+Math.sin(t*4)*2,null,'#ffdc83',3);path(g,[[xy.x-6,xy.y-48],[xy.x+6,xy.y-48],[xy.x,xy.y-39]],'#ffcf76');}
  if(dead){g.globalAlpha=Math.max(.1,1-(s.time-p.death.at)/1.2);g.translate(xy.x,xy.y);g.rotate((s.time-p.death.at)*2);g.translate(-xy.x,-xy.y);}
  const moving=s.move?.playerId===p.id&&s.move.to,from=moving?s.map.nodes[s.move.from].position:null,to=moving?s.map.nodes[s.move.to].position:null;
  const joystick=window.BoardParty.axes(s,p.id);
  const freeWalking=s.move?.kind==='walk'&&s.move.playerId===p.id&&Math.hypot(joystick.x,joystick.y)>.12;
  const facing=freeWalking?joystick:moving?{x:to.x-from.x,y:to.y-from.y}:actorFacing.get(p)||{x:0,y:-1};
  if(Math.hypot(facing.x,facing.y)>.001)actorFacing.set(p,{x:facing.x,y:facing.y});
  const shake=p.hurtUntil>s.time?Math.sin(t*50)*3:0;
  window.PartyPlayerAvatar.draw(g,{...p,x:xy.x+shake,y:xy.y,vx:freeWalking?joystick.x*90:moving&&s.move.walking?40:0,vy:freeWalking?joystick.y*90:0,
    dir:facing},{time:t,scale:.86,label:false,holding:s.effect?.kind==='heal'&&s.effect.targets.includes(p.id)});
  const crowded=s.players.filter(q=>q.currentNodeId===p.currentNodeId).length>1;
  if(!crowded||p.id===active?.id||p.id===s.skill?.targetId){box(g,xy.x-42,xy.y+25,84,18,7,'#15394cda');label(g,p.name,xy.x,xy.y+34,10,p.color,'center',700,78);}
  else {circle(g,xy.x+17,xy.y+16,8,'#15394c');label(g,(s.order.indexOf(p.id)+1)||s.players.indexOf(p)+1,xy.x+17,xy.y+16,9,p.color,'center');}
  g.restore();
  if(s.move?.kind==='rocket'&&s.move.playerId===p.id){g.save();g.translate(pos.x,pos.y+20);if(from)g.rotate(Math.atan2(to.y-from.y,to.x-from.x)+Math.PI/2);icon(g,'rocket',0,0,25);g.restore();}
 }
}
function effects(g,s,t){
 const I=window.BoardItems,sk=s.skill;
 if(sk){
  if(sk.kind==='bomber'){
   for(const p of I.bombs(sk)){
    circle(g,p.x,p.y,I.blastRadius,'#da59721a','#e6a7ba',2);
    circle(g,p.x,p.y,7,'#b6475f','#ffe7a7',2);
    star(g,p.x,p.y,3.5,'#fff4c7');
   }
   g.save();g.translate(sk.x,sk.y-16);g.rotate(sk.angle+Math.PI/2);
   icon(g,'bomber',0,0,44);g.restore();
  }else if(sk.kind==='ufo'){
   circle(g,sk.x,sk.y,I.ufoRadius+I.radius,'#9beef32b',sk.targetId?'#b5ffb8':'#9eefff',3);icon(g,'ufo',sk.x,sk.y-38,33);
   if(sk.targetId){const p=s.players.find(p=>p.id===sk.targetId);label(g,window.BoardParty.isProtected(s,p)?'โล่ป้องกัน • '+p.name:'A • '+p.name,sk.x,sk.y+46,16,'#163c53','center');}
  }else {
   const n=s.map.nodes[sk.nodeId];if(!sk.step&&n.nextNodes.length>1)for(const id of n.nextNodes){const q=s.map.nodes[id].position;line(g,n.position.x,n.position.y,q.x,q.y,id===sk.selectedNext?'#ffe1a0':'#91b8c7',id===sk.selectedNext?6:2);}
   icon(g,'car',sk.x,sk.y,23);
  }
 }
 const fx=s.effect;
 if(fx){const f=Math.min(1,(s.time-fx.at)/fx.duration);
  for(const p of fx.points){
   if(fx.kind==='car'){circle(g,p.x,p.y,I.blastRadius*(.3+.7*f),'#ffc97655','#fff0b8',3);for(let i=0;i<10;i++){const a=i*TAU/10;circle(g,p.x+Math.cos(a)*f*I.blastRadius,p.y+Math.sin(a)*f*I.blastRadius,12*(1-f)+2,i%2?'#ffb971':'#fff1bb');}}
   else if(fx.kind==='ufo'){path(g,[[p.x-36,p.y],[p.x+36,p.y],[p.x+12,p.y-120],[p.x-12,p.y-120]],'#b0f4ff66');icon(g,'ufo',p.x,p.y-120,32);}
   else if(fx.kind==='shield'){circle(g,p.x,p.y,25+f*35,null,'#a2e8ff',4);icon(g,'shield',p.x,p.y-40-f*20,23);}
   else if(fx.kind==='heal'){circle(g,p.x,p.y,25+f*35,null,'#73e4b5',4);icon(g,'healing',p.x,p.y-35-f*30,18,'#3fbd8b');}
    else if(fx.kind==='luckyReward'){
     circle(g,p.x,p.y,32+f*25,null,'#ffd976',4);
     icon(g,fx.item,p.x,p.y-59-f*22,25);
     label(g,'ได้รับ: '+IName(fx.item),p.x,p.y-103-f*25,15,'#ffe39a','center',900,235);
    }
   else if(fx.kind==='hurt'||fx.kind==='swordHit'||fx.kind==='death')circle(g,p.x,p.y,30+f*35,null,'#ee6c88',4);
   else if(fx.kind==='swordClaim'||fx.kind==='swordSafe'){
    circle(g,p.x,p.y,32+f*26,null,fx.ownerColor||'#fce2ae',4);
    icon(g,'sword',p.x,p.y-55-f*24,27,'#fff8da');
    label(g,fx.kind==='swordClaim'?'ยึดพื้นที่ทั้ง 2 ช่อง!':'พื้นที่ของคุณ',p.x,p.y-90-f*20,16,'#fff5cb','center',900,160);
   }
  }
  if(fx.kind==='bomber'){
   const flight=I.bomberFlight(fx.points,s.time-fx.at);
   if(flight){
    // Dropped ordnance and its expanding snowy blast only appear AFTER the
    // plane has physically passed their individual marker (never all at t=0).
    for(const shot of flight.bombs){
     if(shot.phase==='carried'||shot.phase==='spent')continue;
     if(shot.phase==='falling'){
      const altitude=84*(1-shot.fall),px=shot.x,py=shot.y-altitude;
      circle(g,shot.x,shot.y,8+shot.fall*5,'#1c344b26');
      g.save();g.translate(px,py);
      const twirl=(s.time-fx.at-shot.drop)*5;
      g.rotate(twirl);
      path(g,[[-7,-10],[7,-10],[9,6],[0,13],[-9,6]],'#a94354','#f8e7c0',1.6);
      path(g,[[-5,-8],[3,-8],[5,4],[0,9]],'#e88b86');
      box(g,-4,-14,8,5,2,'#e5d6aa','#fff5d7');
      line(g,-2,-8,-2,6,'#ffeec5',1.8);
      g.restore();
      line(g,px-6,py-19,px-9,py-34,'#e3f6f6a0',1.8);
     }else if(shot.phase==='exploding'){
      const pulse=Math.min(1,shot.age/.24),fade=Math.max(0,1-shot.age/.54);
      circle(g,shot.x,shot.y,I.blastRadius*(.16+.84*pulse),
       '#f8b45e38','#fff1c9',Math.max(.5,3*fade));
      circle(g,shot.x,shot.y,17+26*pulse,'#fff5d6'+(fade>.4?'7a':'23'));
      for(let i=0;i<12;i++){
       const angle=(i*TAU/12)+shot.index*.45,range=(19+55*pulse);
       const x=shot.x+Math.cos(angle)*range,y=shot.y+Math.sin(angle)*range;
       circle(g,x,y,Math.max(1,4*fade),i%3===0?'#fffefd':i%3===1?'#cdeefe':'#f8d29c');
      }
     }
    }
    if(flight.plane.visible){
     const aircraft=flight.plane,direction=aircraft.angle;
     g.save();g.translate(aircraft.x,aircraft.y-57);g.rotate(direction+Math.PI/2);
     // Swift white motion streaks and a broad fuselage silhouette make the
     // flight unmistakable even at an island-scale camera zoom.
     for(let i=-1;i<=1;i++){
      line(g,i*15,53,i*15,83+i*3,'#d3f5ff83',3);
     }
     icon(g,'bomber',0,0,62);
     g.restore();
    }
   }
  }
 }
 for(const heal of s.heals||[]){
   const age=s.time-heal.at;if(age<0||age>1.4)continue;
   label(g,'+'+heal.amount+' HP',heal.position.x,heal.position.y-65-age*25,19,'#95f5c7','center',900,150);
  }
  for(const hit of s.hits||[]){
  const age=s.time-hit.at;
  if(age<0||age>1.25)continue;
  label(g,'-'+hit.amount,hit.position.x,hit.position.y-55-age*33,22,'#ffe6e7','center',900,65);
 }
 if(s.phase==='finished'){const p=s.map.nodes[s.map.finishId].position;icon(g,'milestone',p.x,p.y-65,40,'#f8d884');for(let i=0;i<40;i++){const a=i*2.4,r=(s.time-s.phaseAt)*80;circle(g,p.x+Math.cos(a)*r,p.y-30+Math.sin(a)*r,3,i%2?'#fce2a1':'#78d9e8');}}
 // No trophy milestone cells or special reward displays.
}
// The name's VISIBLE span and its HP bar share the exact same reference width.
// Clipping never changes the name stored in player/game/network state.
function nameWidth(g,fontSize=11){
 g.save();g.font='700 '+fontSize+'px "Noto Sans Thai", sans-serif';
 const measured=g.measureText('บอท 12')?.width;
 g.restore();
 return Number.isFinite(measured)&&measured>0?measured:fontSize*3.8;
}
function clippedPlayerName(g,name,x,y,fontSize,color,maxWidth){
 g.save();g.beginPath();g.rect(x,y-fontSize*.7,maxWidth,fontSize*1.65);g.clip();
 label(g,name,x,y,fontSize,color,'left',800);
 g.restore();
}
// Two vector footprints; the alternating heights show two actual walking steps.
function footsteps(g,x,y,size=36,color='#79c8f5'){
 g.save();g.translate(x,y);g.scale(size/36,size/36);g.fillStyle=color;
 for(const [dx,dy,a] of [[-8,7,-.24],[8,-5,.24]]){
  g.save();g.translate(dx,dy);g.rotate(a);
  g.beginPath();g.ellipse(0,4,5.7,9.1,0,0,TAU);g.fill();
  for(let i=0;i<4;i++){
   const a=i*Math.PI/4-.82;
   circle(g,Math.sin(a)*5.6,-7.4-Math.cos(a)*2.6,2.3-i*.22,color);
  }
  g.restore();
 }
 g.restore();
}
function hud(g,s){
 // A single compact rail fits every player from 1 through 12 on ONE row.
 const n=s.players.length,cols=n,gap=n>=10?3:5,w=(936-gap*(cols-1))/cols,active=window.BoardParty.current(s);
 box(g,0,0,960,94,0,'#102d43f2');
 label(g,'BOARD PARTY',16,19,13,'#e9faff');label(g,'WINTER ISLANDS',142,19,8,'#8bbccc','left',500);
 label(g,'ROUND '+String(s.roundNumber).padStart(2,'0'),325,19,10,'#ffdf9d','right');
 const ids=s.order.length?s.order:s.players.map(p=>p.id);
 ids.forEach((id,i)=>{
  const p=s.players.find(q=>q.id===id);
  if(!p)return;
  const x=12+i*(w+gap),y=37,turn=p.id===active?.id,compact=n>=9;
  box(g,x,y,w,42,6,turn?'#2e5267':'#1b3a50',turn?'#edce82':'#33566a');
  box(g,x,y,3,42,2,p.color);
  const fontSize=compact?9:11,rankW=i>=9?23:18,nameX=x+rankW;
  label(g,(i+1)+'.',x+5,y+14,compact?9:10,p.color,'left',700,rankW-5);
  const limit=Math.max(8,Math.min(w-rankW-5,nameWidth(g,fontSize)));
  clippedPlayerName(g,p.name,nameX,y+14,fontSize,p.color,limit);
  const hpRatio=Math.max(0,Math.min(1,p.hp/window.BoardParty.MAX_HP));
  const hpX=x+7,hpW=Math.min(w-16,nameWidth(g,fontSize));
  box(g,hpX,y+29,hpW,6,3,'#0b2537');
  if(hpRatio>0)box(g,hpX,y+29,hpW*hpRatio,6,3,p.color);
  if(window.BoardParty.isProtected(s,p))icon(g,'shield',x+w-10,y+31,8);
 });
 const footerY=sceneHeight(s)-80;
 box(g,12,footerY,936,68,16,'#102e44f5','#53758a');
 const p=active;
 if(s.phase==='overview'||s.camera.overview){
  label(g,'WINTER ISLANDS',30,footerY+18,14,'#ffe4a5');
  label(g,(s.map.islands?.length||9)+' เกาะ • '+s.map.length+' ช่วง • A เริ่มทอยเมื่อพร้อม',30,footerY+40,10,'#b9d9e7','left',500,302);
  const legend=[['sword','ยึดพื้นที่'],['healing','ฟื้น HP'],['danger','อันตราย'],['lucky','ไอเทม']];
  legend.forEach(([type,name],i)=>{const x=410+i*135;circle(g,x,footerY+22,12,colors[type]);icon(g,type,x,footerY+22,type==='sword'?9:8);label(g,name,x,footerY+48,9,'#d6eaf2','center',600,100);});
 }else if(p){
  window.PartyPlayerAvatar.drawFront(g,p,48,footerY+34,44);
  clippedPlayerName(g,p.name,82,footerY+19,16,p.color,nameWidth(g,16));
  // Numeric HP is intentionally shown on the active player's lower card only.
  const hpWidth=162,hpRatio=Math.max(0,Math.min(1,p.hp/window.BoardParty.MAX_HP));
  label(g,p.hp+'/'+window.BoardParty.MAX_HP,82,footerY+41,11,'#cce6f5','left',800,100);
  box(g,82,footerY+53,hpWidth,6,3,'#0a2539');
  if(hpRatio>0)box(g,82,footerY+53,hpWidth*hpRatio,6,3,p.color);
  const stock=window.BoardItems.counts(p),kinds=['roll',...window.BoardItems.ids];
  const selected=Math.max(0,Math.min(kinds.length-1,Math.trunc(p.actionIndex||0)));
  const canSelect=s.phase==='ready';
  const stripX=274,stripW=554,gap=8,cardW=(stripW-gap*(kinds.length-1))/kinds.length,cardY=footerY+6,cardH=56;
  kinds.forEach((kind,i)=>{
   const x=stripX+i*(cardW+gap),amount=kind==='roll'?null:stock[kind]||0;
   const locked=kind!=='roll'&&p.usedRound===s.roundNumber;
   const empty=amount===0,dimmed=empty||locked;
   const chosen=canSelect&&selected===i&&!dimmed;
   g.save();g.translate(x+cardW/2,cardY+cardH/2);
   if(chosen)g.scale(1.055,1.065);
   if(chosen){g.shadowColor='#ffe29a';g.shadowBlur=12;}
   box(g,-cardW/2,-cardH/2,cardW,cardH,9,
    chosen?'#3f5a6a':dimmed?'#202d39':'#1c435b',
    chosen?'#ffe0a1':dimmed?'#43515e':'#527c91');
   g.shadowBlur=0;
   if(chosen){g.strokeStyle='#ffd777';g.lineWidth=1.7;g.strokeRect(-cardW/2+2,-cardH/2+2,cardW-4,cardH-4);}
   if(dimmed)g.globalAlpha=.27;
   if(kind==='roll'){
    dice(g,1,-10,-10,20,false,0,0,true);
    dice(g,2,11,-10,20,false,0,1,true);
   }else icon(g,kind,0,-9,20);
   g.globalAlpha=1;
   const shortName=kind==='roll'?'ทอย':{potion:'ยา',ufo:'UFO',rocket:'จรวด',bomber:'เครื่องบิน',car:'รถระเบิด',shield:'โล่'}[kind]||kind;
   label(g,shortName,-4,16,10,dimmed?'#6f8491':chosen?'#ffe9b0':'#e4f2fa','center',800,cardW-26);
   if(amount!==null){
    box(g,cardW/2-18,cardH/2-18,15,15,5,
      dimmed?'#394550':'#e4c77c',dimmed?'#596674':'#fff1bc');
    label(g,String(amount),cardW/2-10.5,cardH/2-10.5,10,dimmed?'#93a1ad':'#3e3023','center',900,12);
   }
   g.restore();
  });
  // Replace the old "steps remaining" caption with two small footprint glyphs.
  footsteps(g,855,footerY+32,35,'#86d3f5');
  label(g,window.BoardParty.remainingSteps(s,p.id),916,footerY+32,29,'#ffe3a1','right',900,36);
 }
 const timed=Number.isFinite(s.deadline)&&(['aim','car','rocket'].includes(s.phase)||(['move_ready','branch'].includes(s.phase)&&s.move?.kind!=='walk'));
 if(timed){box(g,886,footerY-32,60,25,8,'#173c53e8');label(g,Math.max(0,Math.ceil(s.deadline-s.time))+'s',933,footerY-19,12,'#e4f5fc','right');}
}

const IName=id=>window.BoardItems.names[id]||'ไม่มีไอเทม';
// Same eased horizontal item carousel as the normal minigame roulette.
function luckyRoulette(g,s){
 if(s.phase!=='lucky_roulette'||!s.lucky)return;
 const prize=s.lucky,items=window.BoardItems.ids;
 const time=Math.max(0,s.time-s.phaseAt),progress=Math.min(1,time/prize.spinDuration);
 const eased=1-Math.pow(1-progress,4),winningIndex=9,cardW=126,gap=16,step=cardW+gap;
 box(g,0,0,960,540,0,'#0c2341dc');
 label(g,'LUCKY STAR',480,100,30,'#ffda77','center',900);
 label(g,'สุ่มไอเทม 1 ชิ้น • เข้ากระเป๋าสะสมได้ไม่จำกัด',480,132,14,'#d4eaf7','center');
 box(g,96,183,768,164,18,'#1e3a56ee','#bd98e5');
 g.save();g.beginPath();g.rect(106,194,748,142);g.clip();
 for(let i=0;i<12;i++){
  const kind=i===winningIndex?prize.item:items[(i*7+3)%items.length];
  const x=480+(i*step)-(winningIndex*step*eased)-cardW/2,y=205;
  if(x<-cardW||x>960)continue;
  const selected=progress>=1&&i===winningIndex;
  box(g,x,y,cardW,112,13,selected?'#6741a0':'#30526c',selected?'#ffe18e':'#6799b8');
  icon(g,kind,x+cardW/2,y+41,33);
  label(g,IName(kind),x+cardW/2,y+89,10,selected?'#fff0b3':'#e4f5ff','center',700,cardW-10);
 }
 g.restore();
 // Marker points at the winning item once the reel settles.
 box(g,477,180,6,170,3,'#ffe6a0');
 if(progress>=1){
  label(g,'ได้รับ: '+IName(prize.item),480,401,24,'#ffe49e','center',900,620);
  const owner=s.players.find(p=>p.id===prize.playerId);
  label(g,(owner?.name||'ผู้เล่น')+' • เพิ่มเข้ากระเป๋าแล้ว',480,438,14,'#d5effd','center');
 }else label(g,'กำลังสุ่มไอเทม...',480,412,18,'#d5effd','center');
}
function overlay(g,s){
 const order=['order','order_result'].includes(s.phase),results=['standings','rewards'].includes(s.phase);
 if(!order&&!results)return;
 box(g,0,0,960,sceneHeight(s),0,'#0e2a40ed');
 label(g,'WINTER SNOW ADVENTURE',480,30,11,'#93c8d6','center',500);
 label(g,order?(s.phase==='order'?'ทอยลูกเต๋าเพื่อจัดลำดับ':'ลำดับการเดินพร้อมแล้ว'):'สรุปผลมินิเกมและรางวัล',480,63,25,'#eefbff','center');
 label(g,order?'A หรือ B • จัดลำดับเริ่มเดิน':'อันดับการแข่งขันและสิทธิ์รางวัล • ไอเทมเข้ากระเป๋าอัตโนมัติ • ไม่สุ่มซ้ำ',480,96,12,'#adccdc','center',500);
 const ids=order?(s.phase!=='order'?s.order:s.players.map(p=>p.id)):s.results.map(r=>r.id);
 const cols=order?(ids.length<=4?2:sceneHeight(s)>800&&ids.length>=9?3:4):ids.length<=4?1:ids.length<=8?2:3;
 const rows=Math.ceil(ids.length/cols),w=cols===1?700:cols===2?392:cols===3?286:211;
 const h=sceneHeight(s)>540?
   Math.min(170,(sceneHeight(s)-205-(rows-1)*10)/rows):Math.min(108,310/rows);
 const left=(960-(cols*w+(cols-1)*12))/2;
 const cardTop=127,contentDy=Math.max(0,(h-108)/2);
 ids.forEach((id,i)=>{
  const p=s.players.find(p=>p.id===id);
  const x=left+(i%cols)*(w+12),y=cardTop+Math.floor(i/cols)*(h+10),r=s.results.find(q=>q.id===id);
  if(!p)return;
  if(order){
   box(g,x,y,w,h,12,'#203f55',p.color+'99');
   g.save();g.beginPath();g.roundRect(x+1,y+1,w-2,h-2,11);g.clip();
   box(g,x,y,4,h,3,p.color);
   window.PartyPlayerAvatar.drawFront(g,p,x+27,y+29+contentDy,38);
   label(g,p.name,x+53,y+23+contentDy,13,p.color,'left',700,w-108);
   const elapsed=p.dice?Math.max(0,s.time-p.rollAt):Infinity;
   const rolled=p.dice&&elapsed>=window.BoardDice.TIMING.throw;
   dice(g,p.dice?.[0],x+57,y+72+contentDy,30,!!p.dice,elapsed,0,s.camera.lowDetail);
   dice(g,p.dice?.[1],x+98,y+72+contentDy,30,!!p.dice,elapsed,1,s.camera.lowDetail);
   label(g,rolled?'= '+p.dice.reduce((a,b)=>a+b,0):p.dice?'กำลังทอย':'รอทอย',
     x+127,y+61+contentDy,16,'#f3e2b7','left',700,80);
   const badgeW=88,badgeH=20,badgeX=x+w-badgeW-10,badgeY=y+h-badgeH-9;
   box(g,badgeX,badgeY,badgeW,badgeH,6,s.phase==='order_result'?'#355266':'#17384c');
   g.save();g.beginPath();g.rect(badgeX+4,badgeY+2,badgeW-8,badgeH-4);g.clip();
   label(g,s.phase==='order_result'?'ลำดับ '+(i+1):p.dice?'ทอยแล้ว':'A / B',
     badgeX+8,badgeY+badgeH/2,10,'#d5e9f3','left',700,badgeW-16);
   g.restore();
   g.restore(); // outer order-card clipping scope
   return;
  }
  // Result banner is the player's actual color regardless of finishing rank.
  const tint=g.createLinearGradient(x,y,x+w,y+h);
  tint.addColorStop(0,p.color);tint.addColorStop(.65,p.color);
  tint.addColorStop(1,'#29264a');
  box(g,x,y,w,h,12,tint,r.rank===1?'#ffe5a5':'#fff7');
  g.save();g.beginPath();g.roundRect(x+1,y+1,w-2,h-2,11);g.clip();
  g.save();
  g.shadowColor='#ffe5a3';g.shadowBlur=8;
  g.beginPath();g.arc(x+41,y+contentDy+contentDy+Math.min(46,h/2),32,0,Math.PI*2);
  g.fillStyle='#ffda79';g.fill();
  g.shadowBlur=0;g.lineWidth=2;g.strokeStyle='#fff0b8';g.stroke();
  g.beginPath();g.arc(x+41,y+Math.min(46,h/2),27,0,Math.PI*2);
  g.fillStyle='#86cfee';g.fill();
  g.restore();
  window.PartyPlayerAvatar.drawFront(g,p,x+41,y+Math.min(46,h/2),54);
  const rank=r.rank,suffix=rank%100>=11&&rank%100<=13?'TH':rank%10===1?'ST':rank%10===2?'ND':rank%10===3?'RD':'TH';
  const medal=rank===1?'#ffdf72':rank===2?'#eff5ff':rank===3?'#ffac69':'#ffe0b2';
  const tied=s.results.filter(q=>q.rank===rank).length>1;
  label(g,rank+suffix,x+w-12,y+contentDy+Math.min(54,h*.64),cols===2?32:24,medal,'right',900,cols===2?100:61);
  label(g,p.name,x+83,y+24+contentDy,cols===2?16:13,'#ffffff','left',900,w-(cols===2?190:155));
  label(g,r.label+(tied?' • อันดับร่วม':''),x+83,y+48+contentDy,cols===2?12:10,'#ffffff','left',700,w-(cols===2?190:155));
  if(r.reward){
   // The reward was assigned ONCE by BoardParty.minigameEnded.
   // Never cycle fake item icons or hide the actual reward until another phase.
   const ry=y+contentDy+Math.min(96,Math.min(h-12,76));
   icon(g,r.reward,x+94,ry,19);
   label(g,'ได้รับ: '+IName(r.reward),x+110,ry,cols===2?12:10,'#fff4be','left',800,w-(cols===2?220:160));
  }else{
   label(g,'ไม่มีไอเทมรางวัล',x+85,y+contentDy+Math.min(h-12,76),10,'#ffffff','left',600,w-163);
  }
  g.restore(); // outer result-card clipping scope
 });

 label(g,order?'รอผู้เล่นทุกคนกด A หรือ B เพื่อทอย':Math.max(0,Math.ceil(s.deadline-s.time))+' วินาที • ดำเนินต่ออัตโนมัติ',480,sceneHeight(s)-37,13,'#b8dce9','center',500);
}
// Clear, color-coded controller hints. These are drawn in game-space rather
// than relying on external HTML labels, so split-screen/iPhone layouts share
// the same touch-free HUD and text remains legible on large stages.
function controlBadge(g,x,y,code,caption,color,boxWidth=153){
 box(g,x,y,boxWidth,37,9,'#16384be9','#67899b');
 box(g,x+5,y+4,29,29,8,color,'#e8eff1');
 label(g,code,x+19.5,y+18.5,16,'#fffdfa','center',900);
 label(g,caption,x+40,y+18.5,13,'#eefaff','left',800,boxWidth-45);
}
function aimControls(g,s){
 if(s.phase!=='aim'||!s.skill||!['bomber','ufo'].includes(s.skill.kind))return;
 const bomber=s.skill.kind==='bomber',x=14,y=100,w=294,h=162;
 box(g,x,y,w,h,12,'#102b41f5','#d9c890');
 box(g,x+9,y+8,w-18,26,7,'#21485b','#688ea1');
 label(g,bomber?'เล็งเป้า • เครื่องบินรบ':'เล็งเป้า • UFO',x+17,y+21,15,'#ffedb7','left',850,w-35);
 const rows=bomber?[
  ['A','ยืนยันโจมตี','#318268'],
  ['B','หมุนทิศ 45° • 8 ทิศ','#427bb4'],
  ['C','ยกเลิกการใช้','#b34e5d']
 ]:[
  ['A','ยืนยันสลับตำแหน่ง','#318268'],
  ['B','ไม่ใช้ในโหมดนี้','#49677d'],
  ['C','ยกเลิกการใช้','#b34e5d']
 ];
 rows.forEach(([key,description,color],i)=>{
  const yy=y+41+i*31;
  box(g,x+9,yy,w-18,28,6,'#214258ed','#486c81');
  box(g,x+15,yy+3,25,22,6,color,'#adc3c4');
  label(g,key,x+27.5,yy+14,13,'#ffffff','center',900);
  label(g,description,x+48,yy+14,13,'#ecf7ff','left',800,w-65);
 });
 label(g,bomber?
  'B หมุนทิศได้ 8 แบบ • A ยิงจริง':
  'ขยับจอยเพื่อเล็งก่อนกด A',x+14,y+148,11,'#b6def0','left',700,w-27);
}
function turnDice(g,s){
 if(!['ready','dice'].includes(s.phase))return;
 const p=window.BoardParty.current(s);if(!p)return;
 const cx=480,top=168,width=348,height=232,left=cx-width/2;
 const elapsed=Math.max(0,s.time-s.phaseAt);
 const active=s.phase==='dice',settled=active&&elapsed>=window.BoardDice.TIMING.throw;
 // All coordinates derive from the same center and remain clipped to the panel.
 box(g,left,top,width,height,19,'#12364ef6','#D4AB57');
 g.save();g.beginPath();g.roundRect(left+4,top+4,width-8,height-8,15);g.clip();
 label(g,p.name,cx,top+28,18,p.color,'center',800,width-35);
 if(!active&&Number(p.actionIndex)>0){
  const item=window.BoardItems.ids[Math.trunc(p.actionIndex)-1];
  if(item){
   icon(g,item,cx,top+102,53);
   label(g,IName(item),cx,top+162,17,'#ffe7a8','center',800,width-30);
   const aimItem=item==='bomber'||item==='ufo';
   controlBadge(g,left+14,top+185,'A',aimItem?'เล็งเป้า':'ใช้ไอเทม','#2d906e',154);
   controlBadge(g,left+178,top+185,'B','เปลี่ยนไอเทม','#4583ba',156);
  }
 }else{
  const distance=59;
  dice(g,s.moveDice?.[0],cx-distance,top+113,64,active,elapsed,0,s.camera.lowDetail);
  dice(g,s.moveDice?.[1],cx+distance,top+113,64,active,elapsed,1,s.camera.lowDetail);
  label(g,'+',cx,top+112,22,'#d7b878','center',800);
  const a=s.moveDice?.[0],b=s.moveDice?.[1];
  label(g,settled?a+' + '+b+' = '+s.die+' ก้าว':active?'กำลังทอย…':'ทอยลูกเต๋า',
    cx,top+175,22,'#ffe8b5','center',800,width-24);
  if(active){
   label(g,settled?'ผลทอยพร้อมแล้ว • เตรียมเดิน':'รอลูกเต๋าหยุดก่อนเริ่มเดิน',
     cx,top+204,13,'#c9e9f6','center',750,width-25);
  }else{
   controlBadge(g,left+14,top+185,'A','ทอยลูกเต๋า','#2d906e',154);
   controlBadge(g,left+178,top+185,'B',
     p.usedRound===s.roundNumber?'ใช้ไอเทมครบแล้ว':'เปลี่ยนไอเทม',
     '#4583ba',156);
  }
 }
 g.restore();
}
function intermissionNotice(g,s){
 if(s.phase!=='returning'&&s.phase!=='round_order')return;
 const returning=s.phase==='returning';
 const first=s.players.find(p=>p.id===s.order[0])||s.players[0];
 const title=returning?'กำลังกลับเข้าสู่กระดาน':'เริ่มรอบที่ '+s.roundNumber+' • '+first.name+' เดินก่อน';
 const detail=returning?'สรุปผลและแจกไอเทมเสร็จแล้ว':'ลำดับการเดินใหม่แสดงในแถบผู้เล่นด้านบน';
 box(g,230,174,500,77,15,'#16394de9','#93bed0');
 label(g,title,480,201,19,'#fff3c8','center',800,480);
 label(g,detail,480,230,12,'#cbebf4','center',500,475);
}
function canPan(s){
 return !!(s?.phase==='overview'||s?.camera?.paused||s?.camera?.overview||
  (s?.camera?.explore&&s.move?.kind==='walk'&&!s.move.started&&
  !s.move.to&&['move_ready','branch'].includes(s.phase)));
}
function pan(s,dx,dy){
 if(!canPan(s)||!Number.isFinite(dx)||!Number.isFinite(dy))return false;
 const c=s.camera,top=94,halfW=480/c.zoom,halfH=(mapBottom(s)-top)/2/c.zoom,b=bounds(s);
 c.x=clampCamera(c.x-dx/c.zoom,halfW,b.minX,b.maxX);
 c.y=clampCamera(c.y-dy/c.zoom,halfH,b.minY,b.maxY);c.panned=true;
 return true;
}
function bounds(s){return s.map.bounds||{minX:0,minY:0,maxX:s.map.width,maxY:s.map.height};}
function clampCamera(value,half,min,max){return half>=(max-min)/2?(min+max)/2:Math.max(min+half,Math.min(max-half,value));}
function fitZoom(s){const h=mapBottom(s)-(94),b=bounds(s);return Math.min(916/(b.maxX-b.minX),(h-22)/(b.maxY-b.minY));}
function overview(s){const c=s.camera,b=bounds(s);c.overview=true;c.explore=true;c.manualZoom=fitZoom(s);
 c.zoom=c.manualZoom;c.x=(b.minX+b.maxX)/2;c.y=(b.minY+b.maxY)/2;c.panned=false;return true;}
function follow(s){if(s.phase==='overview')return false;const c=s.camera;c.overview=false;c.explore=false;c.manualZoom=null;c.panned=false;return true;}
function zoom(s,scale){
 if(!canPan(s)||!Number.isFinite(scale)||scale<=0)return false;
 const c=s.camera,b=bounds(s);c.zoom=Math.max(fitZoom(s),Math.min(2.2,c.zoom*scale));
 c.x=clampCamera(c.x,480/c.zoom,b.minX,b.maxX);
 c.y=clampCamera(c.y,(mapBottom(s)-(94))/2/c.zoom,b.minY,b.maxY);
 c.manualZoom=c.zoom;c.panned=true;return true;
}
function toggleDebug(s){s.camera.debugNodes=!s.camera.debugNodes;return s.camera.debugNodes;}
function inspect(s,x,y){
 if(!s.camera.debugNodes)return null;
 const top=94,viewH=mapBottom(s)-top,c=s.camera;
 if(y<top||y>mapBottom(s))return null;
 const wx=c.x+(x-480)/c.zoom,wy=c.y+(y-(top+viewH/2))/c.zoom;
 let best=null,distance=Infinity;
 for(const n of Object.values(s.map.nodes)){const d=Math.hypot(n.position.x-wx,n.position.y-wy);
  if(d<distance){best=n;distance=d;}}
 if(distance>Math.max(50,22/c.zoom))return null;
 c.selectedId=best.id;
 return {id:best.id,type:best.type,islandId:best.islandId,bridgeId:best.bridgeId||null,mapVersion:s.map.version,progress:best.progress,
  next:[...best.nextNodes],previous:[...best.previousNodes],
  x:best.position.x,y:best.position.y,
  owner:s.map.territories[best.territoryId]?.ownerId||null,
  hp:best.effects.hp||0};
}
function branchFrame(s){
 const p=window.BoardParty.current(s);
 if(s.phase!=='branch'||!p)return null;
 const points=[window.BoardItems.position(s,p),...s.map.nodes[p.currentNodeId].nextNodes.map(id=>s.map.nodes[id].position)];
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs)-75,maxX=Math.max(...xs)+75,minY=Math.min(...ys)-75,maxY=Math.max(...ys)+95;
 return {x:(minX+maxX)/2,y:(minY+maxY)/2,zoom:Math.min(1,860/(maxX-minX),(mapBottom(s)-94-20)/(maxY-minY))};
}
function draw(g,t,s){
 // The first screen must render without allocating or painting the world map.
 if(['order','order_result','standings','rewards'].includes(s.phase)&&!s.camera.overview){
  g.fillStyle='#102e43';g.fillRect(0,0,960,sceneHeight(s));overlay(g,s);return;
 }
 const top=94,bottom=mapBottom(s),viewH=bottom-top;
 const p=window.BoardParty.current(s)||s.players[0],
   bombing=s.phase==='effect'&&s.effect?.kind==='bomber';
 const fork=branchFrame(s),pos=fork|| (bombing?s.effect.points[2]:s.skill||window.BoardItems.position(s,p));
 const wide=s.phase==='aim',overviewMode=s.phase==='overview'||s.camera.overview;
 const introZoom=s.phase==='intro_zoom';
 const zoomTarget=overviewMode?(s.camera.manualZoom||fitZoom(s)):
   s.camera.paused?(s.camera.manualZoom||s.camera.zoom):
   bombing?.72:canPan(s)?(s.camera.manualZoom||.65):wide?.65:fork?fork.zoom:1;
 const c=s.camera,dt=Math.min(.05,Math.max(.001,t-(c.lastRenderTime??t-.016)));c.lastRenderTime=t;
 if(introZoom){
  // Use the authoritative board clock rather than render-frame smoothing.
  // Reach START 1.5s after the player ends their map exploration.
  const from=c.introFrom||{x:c.x,y:c.y,zoom:c.zoom};
  const progress=Math.max(0,Math.min(1,(s.time-s.phaseAt)/1.5));
  const ease=progress*progress*(3-2*progress);
  const start=s.map.nodes[s.players[0]?.currentNodeId]?.position||s.map.nodes.n0.position;
  c.zoom=from.zoom+(1-from.zoom)*ease;
  c.x=from.x+(start.x-from.x)*ease;
  c.y=from.y+(start.y-from.y)*ease;
 }else{
  if(!canPan(s))c.manualZoom=null;
  c.zoom+=(zoomTarget-c.zoom)*(1-Math.exp(-dt*5));
 }
 const halfW=480/c.zoom,halfH=viewH/2/c.zoom,b=bounds(s);
 if(!introZoom&&!canPan(s)){
  const targetX=clampCamera(pos.x,halfW,b.minX,b.maxX),targetY=clampCamera(pos.y,halfH,b.minY,b.maxY);
  c.x+=(targetX-c.x)*(1-Math.exp(-dt*6));c.y+=(targetY-c.y)*(1-Math.exp(-dt*6));
 }
 c.x=clampCamera(c.x,halfW,b.minX,b.maxX);c.y=clampCamera(c.y,halfH,b.minY,b.maxY);
 g.clearRect(0,0,960,sceneHeight(s));g.fillStyle='#183e5d';g.fillRect(0,top,960,viewH);g.save();g.beginPath();g.rect(0,top,960,viewH);g.clip();g.translate(480,top+viewH/2);g.scale(c.zoom,c.zoom);g.translate(-c.x,-c.y);
 ground(g,s);decorations(g,s);if(typeof ambience==='function'&&!c.lowDetail)ambience(g,s,t);nodes(g,s);actors(g,s,t);effects(g,s,t);g.restore();
 // Snow is a screen overlay; never modifies hitboxes or graph state.
 g.save();g.beginPath();g.rect(0,top,960,viewH);g.clip();for(let i=0;i<(c.lowDetail?0:35);i++){const x=(i*137.3+Math.sin(t*.3+i)*20)%960,y=top+(i*71+t*(12+i%7))%viewH;circle(g,x,y,1+i%3*.45,'#ffffff8c');}g.restore();
 hud(g,s);
 if(!overviewMode&&!c.paused){
  // The A/B/C guide sits directly below scoreboard player #1 on the left.
  aimControls(g,s);
  g.save();g.translate(0,sceneOffset(s));
  turnDice(g,s);intermissionNotice(g,s);luckyRoulette(g,s);
  g.restore();overlay(g,s);
 }
 if(s.camera.debugNodes&&s.camera.selectedId){
  const n=s.map.nodes[s.camera.selectedId],t=s.map.territories[n.territoryId];
  box(g,207,bottom-49,546,57,8,'#0a2a43f5','#91cde7');
  label(g,n.id+' • '+n.type+' • progress '+n.progress+' • HP '+(n.effects.hp||0),
   221,bottom-31,12,'#ffe9a1','left',800,512);
  label(g,'ก่อน: '+n.previousNodes.join(',')+'  ต่อ: '+n.nextNodes.join(',')+
    '  x='+Math.round(n.position.x)+' y='+Math.round(n.position.y)+'  พื้นที่: '+(n.islandId||n.bridgeId)+
    (t?'  เจ้าของ: '+(t.ownerId||'ไม่มี'):''),
    221,bottom-10,10,'#d6efff','left',700,513);
 }
 if(canPan(s)&&!overviewMode&&!c.debugNodes){
  box(g,305,bottom-29,350,30,9,'#133b50d9','#6cafc3');
  label(g,c.paused?'หยุดเกม • ลากสำรวจ / กดเล่นต่อเมื่อพร้อม':'ลากสำรวจ • ขยับจอยหรือ A เพื่อเริ่มเดิน',480,bottom-13,11,'#e9faff','center',700,335);
 }
}
window.BoardArt=Object.freeze({draw,icon,dice,colors,turnDice,canPan,pan,overview,follow,zoom,toggleDebug,inspect,fitZoom,branchFrame});
})();
