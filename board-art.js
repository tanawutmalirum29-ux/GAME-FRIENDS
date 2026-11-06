/* Original vector winter scenery: ground, scenery, paths, actors, FX, then HUD. */
(() => {
'use strict';
const TAU=Math.PI*2,colors={start:'#45c4d9',finish:'#ffca63',movement:'#54acc5',healing:'#59ad91',danger:'#cf7180',event:'#9b84bd',key:'#c49b63',milestone:'#d9b862',neutral:'#9cabb7',sword:'#63748c',lucky:'#8660ad'};
// Keep one bounded terrain surface. Replays explicitly release the old pixels
// instead of waiting for mobile Safari to collect detached canvases.
let terrain=null;
function path(g,points,fill,stroke=null,width=2){g.beginPath();points.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}}
function circle(g,x,y,r,fill,stroke=null,w=2){g.beginPath();g.arc(x,y,r,0,TAU);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=w;g.stroke();}}
function box(g,x,y,w,h,r,fill,stroke=null){g.beginPath();g.roundRect(x,y,w,h,r);g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=1;g.stroke();}}
function label(g,text,x,y,size=14,color='#e9f9ff',align='left',weight=700,maxWidth=null){g.font=weight+' '+size+'px "Noto Sans Thai", sans-serif';g.textAlign=align;g.textBaseline='middle';g.fillStyle=color;if(maxWidth)g.fillText(String(text),x,y,maxWidth);else g.fillText(String(text),x,y);}
function line(g,x,y,a,b,color,w=2){g.strokeStyle=color;g.lineWidth=w;g.lineCap='round';g.beginPath();g.moveTo(x,y);g.lineTo(a,b);g.stroke();}
function star(g,x,y,r,fill){path(g,Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,d=i%2?r*.45:r;return[x+Math.cos(a)*d,y+Math.sin(a)*d];}),fill);}
function icon(g,kind,x,y,size=20,color='#fff'){
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
function dice(g,value,x,y,size=42,rolling=false,t=0){
 g.save();g.translate(x,y);if(rolling)g.rotate(Math.sin(t*30)*.16);
 box(g,-size/2,-size/2+3,size,size,size*.2,'#a7cbd6');box(g,-size/2,-size/2,size,size,size*.2,'#f8fdff','#c4e1e8');
 const v=rolling?1+Math.floor(t*19)%6:value;
 const dots={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]};
 for(const [a,b]of dots[v]||[])circle(g,a*size*.22,b*size*.22,size*.065,'#23516a');g.restore();
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
const themeAliases={camp:'start',grove:'crossroads',frost:'risk',aurora:'crossroads',lucky:'reward',crown:'finish'};
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
 }else if(kind==='stone'){
  line(g,0,0,len,0,'#526d83',108);line(g,0,0,len,0,'#a7bdcc',90);
  for(let x=0;x<len;x+=30){line(g,x,-44,x,44,'#6d8b9f',2);line(g,x,-40,Math.min(x+25,len),-40,'#e1f2f5',4);}
  line(g,0,-50,len,-50,'#dfebee',12);line(g,0,50,len,50,'#768d9d',12);
  for(let x=0;x<=len;x+=76){box(g,x-7,-60,14,21,3,'#dcebef','#687f95');box(g,x-7,39,14,21,3,'#b6d2dc','#687f95');}
 }else{
  line(g,0,-34,len,-34,'#573d38',13);line(g,0,34,len,34,'#573d38',13);
  for(let x=0;x<len;x+=17){box(g,x,-43,Math.min(15,len-x),86,2,Math.floor(x/17)%2?'#bc9773':'#c8aa86','#735847');line(g,x+3,-36,x+3,35,'#e1c6a022',1);}
  for(const y of [-50,50]){line(g,0,y,len,y,'#674c42',4);line(g,0,y-4,len,y-4,'#e1c49b',2);}
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
function scenery(g,map){
 g.fillStyle='#183e5d';g.fillRect(0,0,map.width,map.height);
 const rng=window.BoardMap.random(map.seed+47);
 for(let i=0;i<160;i++){const x=rng()*map.width,y=rng()*map.height;line(g,x,y,x+28+rng()*52,y-5,'#81d9df16',2);}
 for(const zone of map.islands||[])island(g,zone);
 const bridgeKeys=new Set(map.bridges.map(([a,b])=>a+'>'+b));
 for(const n of Object.values(map.nodes))for(const id of n.nextNodes){if(bridgeKeys.has(n.id+'>'+id))continue;const p=map.nodes[id].position;line(g,n.position.x,n.position.y,p.x,p.y,'#7da9b733',101);line(g,n.position.x,n.position.y,p.x,p.y,'#f9ffff',92);line(g,n.position.x,n.position.y,p.x,p.y,'#bdd9df',68);line(g,n.position.x,n.position.y,p.x,p.y,'#dbeef0',61);}
 for(const [a,b]of map.bridges)bridge(g,map.nodes[a].position,map.nodes[b].position,map.bridgeStyles?.[a+'>'+b]||'wood');
 const edges=Object.values(map.nodes).flatMap(n=>n.nextNodes.map(id=>[n.position,map.nodes[id].position]));
 for(const zone of map.islands||[]){
  const xs=zone.outline.map(p=>p.x),ys=zone.outline.map(p=>p.y),loX=Math.min(...xs),hiX=Math.max(...xs),loY=Math.min(...ys),hiY=Math.max(...ys);
  const placements=[];
  for(let i=0;i<110;i++){
   const x=loX+rng()*(hiX-loX),y=loY+rng()*(hiY-loY),p={x,y};
   if(!inside(p,zone.outline)||!inside({x:x-47,y:y-80},zone.outline)||!inside({x:x+47,y:y+24},zone.outline)||edges.some(([a,b])=>window.BoardItems.segmentDistance(p,a,b)<145)||placements.some(q=>Math.hypot(q.x-x,q.y-y)<95)||zone.landmark&&Math.hypot(zone.landmark.x-x,zone.landmark.y-y)<140)continue;
   placements.push(p);
   if(i%8===0)fence(g,x,y);else if(i%6===0)lantern(g,x,y,.8);else if(i%5===0)gift(g,x,y,.8);else if(i%4===0)rock(g,x,y,.65+rng()*.3);else pine(g,x,y,.6+rng()*.4,regionTheme(zone)==='reward'&&i%3===0);
  }
  landmark(g,zone);
 }
}
// Allocation failure keeps the same island silhouette and walkable connections;
// only ornamentation is omitted. Visible-region culling bounds per-frame work.
function sceneryLite(g,s){
 const map=s.map,c=s.camera,zoom=Math.max(.06,c.zoom||1),width=480/zoom+220,height=(452-(s.players.length>6?145:94))/2/zoom+220;
 const intersects=(a,b)=>Math.max(a.x,b.x)>=c.x-width&&Math.min(a.x,b.x)<=c.x+width&&Math.max(a.y,b.y)>=c.y-height&&Math.min(a.y,b.y)<=c.y+height;
 g.fillStyle='#183e5d';g.fillRect(0,0,map.width,map.height);
 for(const zone of map.islands||[]){const p=zone.outline;if(intersects({x:Math.min(...p.map(v=>v.x)),y:Math.min(...p.map(v=>v.y))},{x:Math.max(...p.map(v=>v.x)),y:Math.max(...p.map(v=>v.y))}))island(g,zone,true);}
 const bridges=new Set(map.bridges.map(([a,b])=>a+'>'+b));
 for(const n of Object.values(map.nodes))for(const id of n.nextNodes){const a=n.position,b=map.nodes[id].position;if(!intersects(a,b)||bridges.has(n.id+'>'+id))continue;line(g,a.x,a.y,b.x,b.y,'#f9ffff',92);line(g,a.x,a.y,b.x,b.y,'#bdd9df',65);}
 for(const [from,to] of map.bridges){const a=map.nodes[from].position,b=map.nodes[to].position;if(intersects(a,b))bridge(g,a,b,map.bridgeStyles?.[from+'>'+to]||'wood');}
}
function ambience(g,s,t){
 if(s.camera.lowDetail)return;
 for(const zone of s.map.islands||[]){const p=zone.landmark;if(!p||Math.abs(p.x-s.camera.x)>550/s.camera.zoom||Math.abs(p.y-s.camera.y)>300/s.camera.zoom)continue;
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
  const c=s.camera,halfW=480/c.zoom,halfH=(452-(s.players.length>6?145:94))/2/c.zoom;
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
  const title=c.zoom<.4?(zone.theme==='camp'?'START • SNOWFALL':zone.theme==='crown'?'FINISH • CROWN':zone.name.replace(' HARBOR','').replace(' RIDGE','').replace(' GARDEN','').replace(' REACH','')):zone.name;
  label(g,title,-37,0,11,zone.theme==='crown'?'#ffe4a5':'#e1f3f8','left',700,95);g.restore();
 }
}
function nodes(g,s){
 regionLabels(g,s);
 // Most of the 47+ tiles are off-screen. Skip both far-away nodes and paths
 // to reduce Canvas calls substantially on low-FPS phones/tablets.
 const c=s.camera,zoom=Math.max(.06,c.zoom||1);
 const halfW=480/zoom+95;
 const halfH=(452-(s.players.length>6?145:94))/2/zoom+95;
 const visible=(x,y,r=0)=>Math.abs(x-c.x)<=halfW+r&&Math.abs(y-c.y)<=halfH+r;
 const edgeVisible=(a,b)=>Math.max(a.x,b.x)>=c.x-halfW&&
   Math.min(a.x,b.x)<=c.x+halfW&&Math.max(a.y,b.y)>=c.y-halfH&&
   Math.min(a.y,b.y)<=c.y+halfH;
 for(const n of Object.values(s.map.nodes))for(const id of n.nextNodes){const a=n.position,b=s.map.nodes[id].position;
  if(!edgeVisible(a,b))continue;
  const branch=id[0]==='b'?s.map.branches.find(v=>id.startsWith('b'+v.a+'_')):null;
  const tint=branch?.kind==='risky'?'#b78964':branch?'#6e9d91':'#5c8ea5';
  g.save();g.translate(a.x+(b.x-a.x)*.52,a.y+(b.y-a.y)*.52);g.rotate(Math.atan2(b.y-a.y,b.x-a.x));
  for(const shift of [-5,5])path(g,[[shift-4,-5],[shift+2,0],[shift-4,5]],null,tint,2.5);g.restore();
  if(branch&&id==='b'+branch.a+'_1'&&c.zoom>.55){
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
function actors(g,s,t){
 const I=window.BoardItems,active=window.BoardParty.current(s);
 const list=s.players.map(p=>({p,pos:I.position(s,p)})).sort((a,b)=>a.pos.y-b.pos.y);
 for(const {p,pos}of list){
  const dead=p.death&&s.time-p.death.at<1.2,xy=dead?p.death.position:pos;
  g.save();if(p.shieldTurns>0){circle(g,xy.x,xy.y,29,'#8cddf42d',p.blockedUntil>s.time?'#fff':'#8bd8f1',p.blockedUntil>s.time?5:2);icon(g,'shield',xy.x-22,xy.y-25,10);}
  if(p.id===active?.id){circle(g,xy.x,xy.y,29+Math.sin(t*4)*2,null,'#ffdc83',3);path(g,[[xy.x-6,xy.y-48],[xy.x+6,xy.y-48],[xy.x,xy.y-39]],'#ffcf76');}
  if(dead){g.globalAlpha=Math.max(.1,1-(s.time-p.death.at)/1.2);g.translate(xy.x,xy.y);g.rotate((s.time-p.death.at)*2);g.translate(-xy.x,-xy.y);}
  const moving=s.move?.playerId===p.id&&s.move.to,from=moving?s.map.nodes[s.move.from].position:null,to=moving?s.map.nodes[s.move.to].position:null;
  const joystick=window.BoardParty.axes(s,p.id);
  const freeWalking=s.move?.kind==='walk'&&s.move.playerId===p.id&&Math.hypot(joystick.x,joystick.y)>.12;
  const shake=p.hurtUntil>s.time?Math.sin(t*50)*3:0;
  window.PartyPlayerAvatar.draw(g,{...p,x:xy.x+shake,y:xy.y,vx:freeWalking?joystick.x*90:moving&&s.move.walking?40:0,vy:freeWalking?joystick.y*90:0,
    dir:freeWalking?joystick:moving?{x:to.x-from.x,y:to.y-from.y}:{x:0,y:-1}},{time:t,scale:.86,label:false,holding:s.effect?.kind==='heal'&&s.effect.targets.includes(p.id)});
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
   for(const p of I.bombs(sk)){circle(g,p.x,p.y,I.blastRadius,'#f36b7a25','#ec6679',2);circle(g,p.x,p.y,5,'#f26c81');}
   g.save();g.translate(sk.x,sk.y);g.rotate(sk.angle+Math.PI/2);icon(g,'bomber',0,0,29);g.restore();
  }else if(sk.kind==='ufo'){
   circle(g,sk.x,sk.y,26,'#9beef326',sk.targetId?'#b5ffb8':'#9eefff',3);icon(g,'ufo',sk.x,sk.y-33,33);
   if(sk.targetId){const p=s.players.find(p=>p.id===sk.targetId);label(g,p.shieldTurns?'โล่ป้องกัน • '+p.name:'A • '+p.name,sk.x,sk.y+46,16,'#163c53','center');}
  }else {
   const n=s.map.nodes[sk.nodeId];if(!sk.step&&n.nextNodes.length>1)for(const id of n.nextNodes){const q=s.map.nodes[id].position;line(g,n.position.x,n.position.y,q.x,q.y,id===sk.selectedNext?'#ffe1a0':'#91b8c7',id===sk.selectedNext?6:2);}
   icon(g,'car',sk.x,sk.y,23);
  }
 }
 const fx=s.effect;
 if(fx){const f=Math.min(1,(s.time-fx.at)/fx.duration);
  for(const p of fx.points){
   if(fx.kind==='bomber'||fx.kind==='car'){circle(g,p.x,p.y,I.blastRadius*(.3+.7*f),'#ffc97655','#fff0b8',3);for(let i=0;i<10;i++){const a=i*TAU/10;circle(g,p.x+Math.cos(a)*f*I.blastRadius,p.y+Math.sin(a)*f*I.blastRadius,12*(1-f)+2,i%2?'#ffb971':'#fff1bb');}}
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
  if(fx.kind==='bomber'){const a=fx.points[0],b=fx.points[4];g.save();g.translate(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f-45);g.rotate(Math.atan2(b.y-a.y,b.x-a.x)+Math.PI/2);icon(g,'bomber',0,0,34);g.restore();}
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
function hud(g,s){
 const n=s.players.length,cols=n>4?6:n,w=(932-(cols-1)*6)/cols,active=window.BoardParty.current(s);
 box(g,0,0,960,n>6?145:94,0,'#102d43f2');
 label(g,'BOARD PARTY',16,19,13,'#e9faff');label(g,'WINTER ISLANDS',142,19,8,'#8bbccc', 'left',500);
 label(g,'ROUND '+String(s.roundNumber).padStart(2,'0'),325,19,10,'#ffdf9d','right');
 const ids=s.order.length?s.order:s.players.map(p=>p.id);
 ids.forEach((id,i)=>{const p=s.players.find(p=>p.id===id),x=14+(i%cols)*(w+6),y=36+Math.floor(i/cols)*51,turn=p.id===active?.id;
  box(g,x,y,w,45,8,turn?'#2e5267':'#1b3a50',turn?'#edce82':'#33566a');box(g,x,y,3,45,2,p.color);
  label(g,(i+1)+'. '+p.name,x+10,y+12,11,p.color,'left',700,w-38);
  const bagItems=p.bag||[];
  if(bagItems.length){icon(g,'bag',x+w-20,y+13,11);label(g,String(bagItems.length),x+w-6,y+14,9,'#ffe1a3','right');}
  box(g,x+10,y+26,w-73,5,2,'#0b2537');box(g,x+10,y+26,(w-73)*p.hp/window.BoardParty.MAX_HP,5,2,p.color);
  label(g,p.hp+'/'+window.BoardParty.MAX_HP,x+w-12,y+29,10,'#d6eef7','right',500);
  label(g,turn?'เหลือ '+window.BoardParty.remainingSteps(s,p.id)+' ก้าว':Math.round(s.map.nodes[p.currentNodeId].progress/s.map.length*100)+'% • รอ',x+10,y+39,9,turn?'#ffe3a1':'#b9d9e7','left',turn?800:500);
  if(p.shieldTurns>0){icon(g,'shield',x+w-15,y+39,7);label(g,'โล่ '+p.shieldTurns+' ตา',x+w-26,y+39,7,'#9de6fc','right');}
 });
 box(g,12,460,936,68,16,'#102e44f5','#53758a');
 const p=active,c=p?window.BoardParty.controls(s,p.id):{help:'เตรียมการแข่งขัน'};
 if(s.phase==='overview'||s.camera.overview){
  label(g,'WINTER ISLANDS',30,478,14,'#ffe4a5');
  label(g,(s.map.islands?.length||7)+' เกาะ • เดินตามลูกศร • เลือกทางที่ทางแยก',30,500,10,'#b9d9e7','left',500,302);
  const legend=[['sword','ยึดพื้นที่'],['healing','ฟื้น HP'],['danger','อันตราย'],['lucky','ไอเทม'],['event','สุ่มเหตุการณ์']];
  legend.forEach(([type,name],i)=>{const x=385+i*109;circle(g,x,482,12,colors[type]);icon(g,type,x,482,type==='sword'?9:8);label(g,name,x,508,9,'#d6eaf2','center',600,100);});
 }else if(p){
  window.PartyPlayerAvatar.draw(g,{...p,x:47,y:494},{scale:.85,label:false});
  label(g,p.name,83,480,17,p.color,'left',700,235);
  const region=s.map.islands?.find(i=>i.id===s.map.nodes[p.currentNodeId].islandId);
  if(region)label(g,region.name,330,480,10,'#9fc5d3','left',600,243);
  label(g,c.help,83,507,11,'#d1e9f4','left',500,495);
  const bagItems=p.bag||[];
  icon(g,'bag',607,490,21);
  label(g,'กระเป๋า '+bagItems.length+' ชิ้น',632,486,13,'#ffe5aa');
  label(g,p.bagOpen?'A เลือก / B ใช้หรือปิด':p.usedRound===s.roundNumber?'ใช้แล้วในรอบนี้':'B เปิดกระเป๋า',632,506,10,'#abcddd','left',500);
  label(g,window.BoardParty.remainingSteps(s,p.id),885,487,30,'#ffe3a1','center');label(g,'ก้าวที่เหลือ',885,512,10,'#c8e6f3','center');
  if(p.shieldTurns>0)icon(g,'shield',775,490,16);
 }
 const timed=['ready','aim','car','rocket'].includes(s.phase)||(['move_ready','branch'].includes(s.phase)&&s.move?.kind!=='walk');if(timed){box(g,886,428,60,25,8,'#173c53e8');label(g,Math.max(0,Math.ceil(s.deadline-s.time))+'s',933,441,12,'#e4f5fc','right');}
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
 box(g,0,0,960,540,0,'#0e2a40ed');
 label(g,'WINTER SNOW ADVENTURE',480,30,11,'#93c8d6','center',500);
 label(g,order?(s.phase==='order'?'ทอยลูกเต๋าเพื่อจัดลำดับ':'ลำดับการเดินพร้อมแล้ว'):'สรุปผลมินิเกมและรางวัล',480,63,25,'#eefbff','center');
 label(g,order?'A หรือ B • ทอย 2 ลูก • คะแนนมากเริ่มก่อน':'อันดับการแข่งขันและสิทธิ์รางวัล • ไอเทมเข้ากระเป๋าอัตโนมัติ • ไม่สุ่มซ้ำ',480,96,12,'#adccdc','center',500);
 const ids=order?(s.phase!=='order'?s.order:s.players.map(p=>p.id)):s.results.map(r=>r.id);
 const cols=ids.length<=4?2:4,rows=Math.ceil(ids.length/cols),w=cols===2?392:211,h=Math.min(108,310/rows),left=(960-(cols*w+(cols-1)*12))/2;
 ids.forEach((id,i)=>{
  const p=s.players.find(p=>p.id===id),x=left+(i%cols)*(w+12),y=127+Math.floor(i/cols)*(h+10),r=s.results.find(r=>r.id===id);
  box(g,x,y,w,h,12,'#203f55',p.color+'99');box(g,x,y,4,h,3,p.color);
  window.PartyPlayerAvatar.draw(g,{...p,x:x+27,y:y+29},{scale:.72,label:false});label(g,p.name,x+53,y+23,13,p.color,'left',700,w-108);
  if(s.phase==='round_order'){
   label(g,'ตาที่ '+(i+1),x+15,y+66,25,'#ffe3a1','left',800,88);
   const tied=s.results.filter(q=>q.rank===r.rank).length>1;
   label(g,'อันดับ '+r.rank+(tied?' ร่วม':''),x+112,y+59,12,'#cee5f2','left',700,w-125);label(g,r.label,x+112,y+80,10,'#a8cfdf','left',500,w-125);
  }else if(order){
   const rolled=p.dice&&s.time-p.rollAt>=.85;
   dice(g,p.dice?.[0],x+57,y+65,31,!!p.dice&&!rolled,s.time);dice(g,p.dice?.[1],x+98,y+65,31,!!p.dice&&!rolled,s.time+.2);
   label(g,rolled?'= '+p.dice.reduce((a,b)=>a+b,0):'รอทอย',x+127,y+65,17,'#f3e2b7');
   // Show rank/status inside the bottom-right corner, away from names and dice.
   // Clip the text to the badge so it cannot spill into the next player card.
   const badgeW=88,badgeH=20,badgeX=x+w-badgeW-10,badgeY=y+h-badgeH-9;
   box(g,badgeX,badgeY,badgeW,badgeH,6,s.phase==='order_result'?'#355266':'#17384c');
   g.save();
   g.beginPath();g.rect(badgeX+4,badgeY+2,badgeW-8,badgeH-4);g.clip();
   label(g,s.phase==='order_result'?'ลำดับ '+(i+1):p.dice?'ทอยแล้ว':'A / B',
     badgeX+8,badgeY+badgeH/2,10,'#d5e9f3','left',700,badgeW-16);
   g.restore();
  }else{
   const tied=s.results.filter(q=>q.rank===r.rank).length>1;
   label(g,'#'+r.rank+(tied?' ร่วม':''),x+13,y+61,22,'#ffe2a1');label(g,r.label,x+90,y+51,11,'#cce5f3');
   if(r.reward&&s.phase!=='standings'){
    const pending=s.pendingItems[id],rolling=s.time-s.phaseAt<1.1;icon(g,rolling?window.BoardItems.ids[Math.floor(s.time*15)%window.BoardItems.ids.length]:r.reward,pending?x+w-25:x+103,y+78,15);
    if(pending)label(g,IName(r.reward),x+13,y+89,9,'#ffe3a2');
    else label(g,rolling?'กำลังสุ่ม...':IName(r.reward)+' • เข้ากระเป๋า',x+125,y+79,9,'#f9dda6');
   }else label(g,r.reward?'ได้รับสิทธิ์ไอเทม':'ไม่ได้รับไอเทม',x+90,y+77,10,r.reward?'#8de4c4':'#8faebf');
  }
 });
 label(g,Math.max(0,Math.ceil(s.deadline-s.time))+' วินาที • ดำเนินต่ออัตโนมัติ',480,503,13,'#b8dce9','center',500);
}
// SVG-only backpack selector, drawn above the dice until the owner closes it.
// Five visible slots keep every item selectable even with many rewards.
function backpackOverlay(g,s){
 if(s.phase!=='ready')return;
 const p=window.BoardParty.current(s);if(!p?.bagOpen)return;
 const bag=window.BoardItems.bag(p),total=bag.length+1;
 const selected=Math.max(0,Math.min(total-1,p.bagIndex||0));
 const windowStart=Math.max(0,Math.min(selected-2,total-5));
 const visible=Math.min(5,total-windowStart),cardW=138,gap=10;
 box(g,104,148,752,246,18,'#102d43f8','#86bfd2');
 icon(g,'bag',159,181,25);
 label(g,p.name+' • กระเป๋าไอเทม ('+bag.length+' ชิ้น)',193,180,18,p.color);
 label(g,'A เลื่อนรายการ    B ใช้ไอเทมหรือปิดกระเป๋า',480,216,14,'#d3eff6','center');
 for(let i=0;i<visible;i++){
  const index=windowStart+i,item=bag[index],close=index===bag.length;
  const x=(960-(visible*cardW+(visible-1)*gap))/2+i*(cardW+gap),y=241,chosen=index===selected;
  box(g,x,y,cardW,103,12,chosen?'#2c6174':'#1d4355',chosen?'#ffe18b':'#426c7e');
  if(close){label(g,'ปิด',x+cardW/2,y+45,22,chosen?'#fff4c2':'#d0e6ee','center');}
  else {icon(g,item,x+cardW/2,y+32,28);
    label(g,IName(item),x+cardW/2,y+75,10,chosen?'#ffe7ac':'#d6eef8','center',700,cardW-12);}
  if(chosen)label(g,'เลือกอยู่',x+cardW/2,y+93,9,'#ffe2a0','center');
 }
 label(g,p.bagMessage||('ตำแหน่ง '+(selected+1)+' / '+total),480,367,12,p.bagMessage?'#ffb2a7':'#a9cfdd','center');
}
function turnDice(g,s){
 if(!['ready','dice'].includes(s.phase))return;
 const p=window.BoardParty.current(s);if(!p)return;
 const rolling=s.phase==='dice'&&s.time-s.phaseAt<.85,settled=s.phase==='dice'&&!rolling;
 box(g,320,170,320,200,20,'#12364ef5','#8ac5d8');
 label(g,p.name+' • ทอย 2 ลูก',480,194,16,p.color,'center',700,280);
 dice(g,s.moveDice?.[0],428,258,70,rolling,s.time);
 dice(g,s.moveDice?.[1],532,258,70,rolling,s.time+.23);
 label(g,'+',480,257,22,'#a9d8e8','center');
 label(g,settled?s.die+' ก้าว':rolling?'กำลังทอย…':'A • ทอยลูกเต๋า',480,321,24,'#ffe4a4','center');
 label(g,s.phase==='dice'?'ลากจอยเพื่อเดินและเลี้ยว • ปล่อยเพื่อหยุด':'B • ใช้ไอเทมก่อนทอย',480,349,11,'#bcdfed','center',500);
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
 const c=s.camera,top=s.players.length>6?145:94,halfW=480/c.zoom,halfH=(452-top)/2/c.zoom,b=bounds(s);
 c.x=clampCamera(c.x-dx/c.zoom,halfW,b.minX,b.maxX);
 c.y=clampCamera(c.y-dy/c.zoom,halfH,b.minY,b.maxY);c.panned=true;
 return true;
}
function bounds(s){return s.map.bounds||{minX:0,minY:0,maxX:s.map.width,maxY:s.map.height};}
function clampCamera(value,half,min,max){return half>=(max-min)/2?(min+max)/2:Math.max(min+half,Math.min(max-half,value));}
function fitZoom(s){const h=452-(s.players.length>6?145:94),b=bounds(s);return Math.min(916/(b.maxX-b.minX),(h-22)/(b.maxY-b.minY));}
function overview(s){const c=s.camera,b=bounds(s);c.overview=true;c.explore=true;c.manualZoom=fitZoom(s);
 c.zoom=c.manualZoom;c.x=(b.minX+b.maxX)/2;c.y=(b.minY+b.maxY)/2;c.panned=false;return true;}
function follow(s){if(s.phase==='overview')return false;const c=s.camera;c.overview=false;c.explore=false;c.manualZoom=null;c.panned=false;return true;}
function zoom(s,scale){
 if(!canPan(s)||!Number.isFinite(scale)||scale<=0)return false;
 const c=s.camera,b=bounds(s);c.zoom=Math.max(fitZoom(s),Math.min(2.2,c.zoom*scale));
 c.x=clampCamera(c.x,480/c.zoom,b.minX,b.maxX);
 c.y=clampCamera(c.y,(452-(s.players.length>6?145:94))/2/c.zoom,b.minY,b.maxY);
 c.manualZoom=c.zoom;c.panned=true;return true;
}
function toggleDebug(s){s.camera.debugNodes=!s.camera.debugNodes;return s.camera.debugNodes;}
function inspect(s,x,y){
 if(!s.camera.debugNodes)return null;
 const top=s.players.length>6?145:94,viewH=452-top,c=s.camera;
 if(y<top||y>452)return null;
 const wx=c.x+(x-480)/c.zoom,wy=c.y+(y-(top+viewH/2))/c.zoom;
 let best=null,distance=Infinity;
 for(const n of Object.values(s.map.nodes)){const d=Math.hypot(n.position.x-wx,n.position.y-wy);
  if(d<distance){best=n;distance=d;}}
 if(distance>Math.max(50,22/c.zoom))return null;
 c.selectedId=best.id;
 return {id:best.id,type:best.type,progress:best.progress,
  next:[...best.nextNodes],previous:[...best.previousNodes],
  x:best.position.x,y:best.position.y,
  owner:s.map.territories[best.territoryId]?.ownerId||null,
  hp:best.effects.hp||0};
}
function draw(g,t,s){
 // The first screen must render without allocating or painting the world map.
 if(['order','order_result','standings','rewards'].includes(s.phase)&&!s.camera.overview){
  g.fillStyle='#102e43';g.fillRect(0,0,960,540);overlay(g,s);return;
 }
 const top=s.players.length>6?145:94,bottom=452,viewH=bottom-top;
 const p=window.BoardParty.current(s)||s.players[0],pos=s.skill||window.BoardItems.position(s,p);
 const wide=s.phase==='aim',overviewMode=s.phase==='overview'||s.camera.overview;
 const zoomTarget=overviewMode?(s.camera.manualZoom||fitZoom(s)):
   s.camera.paused?(s.camera.manualZoom||s.camera.zoom):
   canPan(s)?(s.camera.manualZoom||.65):wide?.65:s.phase==='branch'?.83:1;
 const c=s.camera,dt=Math.min(.05,Math.max(.001,t-(c.lastRenderTime??t-.016)));c.lastRenderTime=t;
 if(!canPan(s))c.manualZoom=null;
 c.zoom+=(zoomTarget-c.zoom)*(1-Math.exp(-dt*5));
 const halfW=480/c.zoom,halfH=viewH/2/c.zoom,b=bounds(s);
 if(!canPan(s)){
  const targetX=clampCamera(pos.x,halfW,b.minX,b.maxX),targetY=clampCamera(pos.y,halfH,b.minY,b.maxY);
  c.x+=(targetX-c.x)*(1-Math.exp(-dt*6));c.y+=(targetY-c.y)*(1-Math.exp(-dt*6));
 }
 c.x=clampCamera(c.x,halfW,b.minX,b.maxX);c.y=clampCamera(c.y,halfH,b.minY,b.maxY);
 g.clearRect(0,0,960,540);g.fillStyle='#183e5d';g.fillRect(0,top,960,viewH);g.save();g.beginPath();g.rect(0,top,960,viewH);g.clip();g.translate(480,top+viewH/2);g.scale(c.zoom,c.zoom);g.translate(-c.x,-c.y);
 ground(g,s);if(typeof ambience==='function'&&!c.lowDetail)ambience(g,s,t);nodes(g,s);actors(g,s,t);effects(g,s,t);g.restore();
 // Snow is a screen overlay; never modifies hitboxes or graph state.
 g.save();g.beginPath();g.rect(0,top,960,viewH);g.clip();for(let i=0;i<(c.lowDetail?0:35);i++){const x=(i*137.3+Math.sin(t*.3+i)*20)%960,y=top+(i*71+t*(12+i%7))%viewH;circle(g,x,y,1+i%3*.45,'#ffffff8c');}g.restore();
 hud(g,s);if(!overviewMode&&!c.paused){turnDice(g,s);backpackOverlay(g,s);intermissionNotice(g,s);overlay(g,s);luckyRoulette(g,s);}
 if(s.camera.debugNodes&&s.camera.selectedId){
  const n=s.map.nodes[s.camera.selectedId],t=s.map.territories[n.territoryId];
  box(g,207,403,546,57,8,'#0a2a43f5','#91cde7');
  label(g,n.id+' • '+n.type+' • progress '+n.progress+' • HP '+(n.effects.hp||0),
   221,421,12,'#ffe9a1','left',800,512);
  label(g,'ก่อน: '+n.previousNodes.join(',')+'  ต่อ: '+n.nextNodes.join(',')+
    '  x='+Math.round(n.position.x)+' y='+Math.round(n.position.y)+
    (t?'  เจ้าของ: '+(t.ownerId||'ไม่มี'):''),
    221,442,10,'#d6efff','left',700,513);
 }
 if(canPan(s)&&!overviewMode&&!c.debugNodes){
  box(g,305,423,350,30,9,'#133b50d9','#6cafc3');
  label(g,c.paused?'หยุดเกม • ลากสำรวจ / กดเล่นต่อเมื่อพร้อม':'ลากสำรวจ • ขยับจอยหรือ A เพื่อเริ่มเดิน',480,439,11,'#e9faff','center',700,335);
 }
}
window.BoardArt=Object.freeze({draw,icon,dice,colors,turnDice,canPan,pan,overview,follow,zoom,toggleDebug,inspect,fitZoom});
})();
