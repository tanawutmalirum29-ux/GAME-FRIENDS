/* Original vector winter scenery: ground, scenery, paths, actors, FX, then HUD. */
(() => {
'use strict';
const TAU=Math.PI*2,colors={start:'#45c4d9',finish:'#ffca63',movement:'#36c9e7',healing:'#68cf93',danger:'#ef6981',event:'#aa83e9',key:'#efad63',milestone:'#edc45b',neutral:'#94acba'};
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
 }else if(kind==='danger'){
  circle(g,0,-3,10,color);box(g,-6,2,12,9,2,color);circle(g,-4,-3,2.7,'#924454');circle(g,4,-3,2.7,'#924454');line(g,-2,7,-2,11,'#924454');line(g,3,7,3,11,'#924454');
 }else if(kind==='event')star(g,0,0,12,color);
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
function island(g,x,y,w,h){
 for(const [dy,fill]of [[18,'#397d9e'],[9,'#8ed0e5'],[0,'#d4f4fc']]){
  g.beginPath();g.moveTo(x-w/2,y+dy);g.bezierCurveTo(x-w*.55,y-h*.7+dy,x-w*.2,y-h*.5+dy,x,y-h*.45+dy);g.bezierCurveTo(x+w*.35,y-h*.65+dy,x+w*.56,y-h*.25+dy,x+w*.5,y+dy);g.bezierCurveTo(x+w*.55,y+h*.55+dy,x+w*.15,y+h*.6+dy,x,y+h*.4+dy);g.bezierCurveTo(x-w*.4,y+h*.65+dy,x-w*.55,y+h*.3+dy,x-w/2,y+dy);if(dy===0){const snow=g.createLinearGradient(x,y-h/2,x,y+h/2);snow.addColorStop(0,'#f2fcff');snow.addColorStop(.6,'#d4f4fc');snow.addColorStop(1,'#abdbe9');g.fillStyle=snow;}else g.fillStyle=fill;g.fill();
 }
 g.fillStyle='#edfaff';g.beginPath();g.ellipse(x-w*.08,y-h*.12,w*.36,h*.23,-.03,0,TAU);g.fill();
}
function bridge(g,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
 g.save();g.translate(a.x,a.y);g.rotate(angle);line(g,0,-30,len,-30,'#6b5751',5);line(g,0,30,len,30,'#6b5751',5);
 for(let x=0;x<len;x+=14)box(g,x,-27,12,54,2,x%28?'#bc9976':'#c8ac86','#9a7b64');
 for(let x=0;x<=len;x+=50){line(g,x,-34,x,-24,'#786053',6);line(g,x,24,x,34,'#786053',6);}g.restore();
}
function scenery(g,map){
 const grad=g.createLinearGradient(0,0,900,1450);grad.addColorStop(0,'#23647f');grad.addColorStop(1,'#10344f');g.fillStyle=grad;g.fillRect(0,0,map.width,map.height);
 const rng=window.BoardMap.random(map.seed+47);
 for(let i=0;i<100;i++){const x=rng()*1800,y=rng()*1450;line(g,x,y,x+25,y-7,'#8cd4e719',2);}
 for(let row=0;row<4;row++)island(g,865,320+row*310,1580,245);
 for(const id of Object.keys(map.nodes).filter(id=>id[0]==='b')){const p=map.nodes[id].position;island(g,p.x,p.y,170,130);}
 for(const n of Object.values(map.nodes))for(const id of n.nextNodes){const p=map.nodes[id].position;line(g,n.position.x,n.position.y,p.x,p.y,'#a5dce9',50);line(g,n.position.x,n.position.y,p.x,p.y,'#e8faff',40);}
 for(const [a,b]of map.bridges)bridge(g,map.nodes[a].position,map.nodes[b].position);
 // Props are placed away from all path segments and avatar centres.
 const edges=Object.values(map.nodes).flatMap(n=>n.nextNodes.map(id=>[n.position,map.nodes[id].position]));
 for(let i=0;i<155;i++){
  const x=130+rng()*1500,y=155+rng()*1180,p={x,y};
  if(Math.min(...[0,1,2,3].map(row=>Math.abs(y-(320+row*310))))>105||edges.some(([a,b])=>window.BoardItems.segmentDistance(p,a,b)<85))continue;
  if(i%5===0)rock(g,x,y,.6+rng()*.5);else if(i%5===1)gift(g,x,y,.7);else pine(g,x,y,.55+rng()*.45,i%3===0);
 }
 for(let r=0;r<4;r++)for(let i=0;i<4;i++){
  const x=390+i*270,y=425+r*310;
  if(edges.some(([a,b])=>window.BoardItems.segmentDistance({x,y},a,b)<60))continue;
  line(g,x,y,x+75,y-8,'#91766a',7);for(const k of [0,38,75]){line(g,x+k,y+5,x+k,y-18,'#80695e',7);line(g,x+k-3,y-18,x+k+3,y-18,'#f1fcff',5);}
 }
}
// Low-memory Safari fallback: only paint visible snow and paths. Repainting the
// entire 155-prop terrain every animation frame can itself freeze the browser
// when an offscreen Canvas cannot be allocated.
function sceneryLite(g,s){
 const map=s.map,c=s.camera,zoom=Math.max(.35,c.zoom||1);
 const width=480/zoom+220,height=(452-(s.players.length>6?145:94))/2/zoom+220;
 const intersects=(a,b)=>Math.max(a.x,b.x)>=c.x-width&&Math.min(a.x,b.x)<=c.x+width&&
   Math.max(a.y,b.y)>=c.y-height&&Math.min(a.y,b.y)<=c.y+height;
 g.fillStyle='#23647f';g.fillRect(0,0,map.width,map.height);
 for(let row=0;row<4;row++){
   const y=320+row*310;
   if(Math.abs(y-c.y)<height+125)island(g,865,y,1580,245);
 }
 for(const [id,n] of Object.entries(map.nodes)){
   if(id[0]==='b'&&Math.abs(n.position.x-c.x)<width+100&&
     Math.abs(n.position.y-c.y)<height+100)
     island(g,n.position.x,n.position.y,170,130);
 }
 for(const n of Object.values(map.nodes))for(const id of n.nextNodes){
   const a=n.position,b=map.nodes[id].position;
   if(!intersects(a,b))continue;
   line(g,a.x,a.y,b.x,b.y,'#a5dce9',50);
   line(g,a.x,a.y,b.x,b.y,'#e8faff',40);
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
function nodes(g,s){
 // Most of the 47+ tiles are off-screen. Skip both far-away nodes and paths
 // to reduce Canvas calls substantially on low-FPS phones/tablets.
 const c=s.camera,zoom=Math.max(.35,c.zoom||1);
 const halfW=480/zoom+95;
 const halfH=(452-(s.players.length>6?145:94))/2/zoom+95;
 const visible=(x,y,r=0)=>Math.abs(x-c.x)<=halfW+r&&Math.abs(y-c.y)<=halfH+r;
 const edgeVisible=(a,b)=>Math.max(a.x,b.x)>=c.x-halfW&&
   Math.min(a.x,b.x)<=c.x+halfW&&Math.max(a.y,b.y)>=c.y-halfH&&
   Math.min(a.y,b.y)<=c.y+halfH;
 for(const n of Object.values(s.map.nodes))for(const id of n.nextNodes){const a=n.position,b=s.map.nodes[id].position;
  if(!edgeVisible(a,b))continue;
  g.save();g.translate(a.x+(b.x-a.x)*.55,a.y+(b.y-a.y)*.55);g.rotate(Math.atan2(b.y-a.y,b.x-a.x));path(g,[[-5,-6],[3,0],[-5,6]],null,'#4b9db4',2);g.restore();}
 for(const n of Object.values(s.map.nodes)){
  const {x,y}=n.position;
  if(!visible(x,y,75))continue;
  const c=colors[n.type];circle(g,x,y+5,28,'#407b9355');circle(g,x,y,27,c,'#fff6',3);circle(g,x,y-2,23,null,'#ffffff60',1);
  g.save();g.translate(x,y);
  if(n.type==='movement'||n.type==='start'){const q=s.map.nodes[n.nextNodes[0]];if(q)g.rotate(Math.atan2(q.position.y-y,q.position.x-x));}
  icon(g,n.type,0,0,17,'#f3fdff');g.restore();
  if(n.type==='start'||n.type==='finish'){
   box(g,x-56,y-72,112,25,9,'#163b54');label(g,n.type==='start'?'START':'FINISH',x,y-59,12,'#fff','center');
   if(n.type==='finish'){line(g,x-40,y-45,x-40,y+10,'#eefaff',5);line(g,x+40,y-45,x+40,y+10,'#eefaff',5);box(g,x-43,y-50,86,14,3,'#fff');for(let j=0;j<8;j++)box(g,x-40+j*10,y-49+(j%2)*7,10,7,0,'#234d62');}
  }
 }
 if(s.phase==='branch'||s.phase==='move_ready'){
  const p=window.BoardParty.current(s),a=s.map.nodes[p.currentNodeId].position;
  const choices=s.phase==='branch'?s.branch:{options:s.map.nodes[p.currentNodeId].nextNodes,selected:s.map.nodes[p.currentNodeId].nextNodes[0]};
  for(const id of choices.options){const b=s.map.nodes[id].position,selected=id===choices.selected;line(g,a.x,a.y,b.x,b.y,selected?'#ffe38b':'#75acc4',selected?8:3);circle(g,b.x,b.y,34,null,selected?'#ffe59a':'#fff8',selected?5:2);label(g,s.move.kind==='walk'?'เดินอิสระ • ชี้ทางนี้':selected?'A • ทางนี้':'เลือกทาง',b.x,b.y+48,11,'#173b53','center');}
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
   else if(fx.kind==='hurt'||fx.kind==='death')circle(g,p.x,p.y,30+f*35,null,'#ee6c88',4);
  }
  if(fx.kind==='bomber'){const a=fx.points[0],b=fx.points[4];g.save();g.translate(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f-45);g.rotate(Math.atan2(b.y-a.y,b.x-a.x)+Math.PI/2);icon(g,'bomber',0,0,34);g.restore();}
 }
 if(s.phase==='finished'){const p=s.map.nodes[s.map.finishId].position;icon(g,'milestone',p.x,p.y-65,40,'#f8d884');for(let i=0;i<40;i++){const a=i*2.4,r=(s.time-s.phaseAt)*80;circle(g,p.x+Math.cos(a)*r,p.y-30+Math.sin(a)*r,3,i%2?'#fce2a1':'#78d9e8');}}
 if(s.milestone&&s.time-s.milestone.at<1.5){const p=s.milestone.position;icon(g,'milestone',p.x,p.y-50-(s.time-s.milestone.at)*20,24,'#eebf4e');}
}
function hud(g,s){
 const n=s.players.length,cols=n>4?6:n,w=(932-(cols-1)*6)/cols,active=window.BoardParty.current(s);
 box(g,0,0,960,n>6?145:94,0,'#102d43f2');
 label(g,'BOARD PARTY',16,19,13,'#e9faff');label(g,'WINTER SNOW ADVENTURE',154,19,9,'#8bbccc', 'left',500);
 label(g,'ROUND '+String(s.roundNumber).padStart(2,'0'),940,19,12,'#ffdf9d','right');
 const ids=s.order.length?s.order:s.players.map(p=>p.id);
 ids.forEach((id,i)=>{const p=s.players.find(p=>p.id===id),x=14+(i%cols)*(w+6),y=36+Math.floor(i/cols)*51,turn=p.id===active?.id;
  box(g,x,y,w,45,8,turn?'#2e5267':'#1b3a50',turn?'#edce82':'#33566a');box(g,x,y,3,45,2,p.color);
  label(g,(i+1)+'. '+p.name,x+10,y+12,11,p.color,'left',700,w-38);
  const bagItems=p.bag||[];
  if(bagItems.length){icon(g,'bag',x+w-20,y+13,11);label(g,String(bagItems.length),x+w-6,y+14,9,'#ffe1a3','right');}
  box(g,x+10,y+26,w-53,5,2,'#0b2537');box(g,x+10,y+26,(w-53)*p.hp/3,5,2,p.color);
  label(g,p.hp+'/3',x+w-12,y+29,10,'#d6eef7','right',500);
  label(g,turn?'เหลือ '+window.BoardParty.remainingSteps(s,p.id)+' ก้าว':Math.round(s.map.nodes[p.currentNodeId].progress/36*100)+'% • รอ',x+10,y+39,9,turn?'#ffe3a1':'#b9d9e7','left',turn?800:500);
  if(p.shieldTurns>0){icon(g,'shield',x+w-15,y+39,7);label(g,'โล่ '+p.shieldTurns+' ตา',x+w-26,y+39,7,'#9de6fc','right');}
 });
 box(g,12,460,936,68,16,'#102e44f5','#53758a');
 const p=active,c=p?window.BoardParty.controls(s,p.id):{help:'เตรียมการแข่งขัน'};
 if(p){
  window.PartyPlayerAvatar.draw(g,{...p,x:47,y:494},{scale:.85,label:false});
  label(g,p.name,83,480,17,p.color,'left',700,265);label(g,c.help,83,507,11,'#d1e9f4','left',500,495);
  const bagItems=p.bag||[];
  icon(g,'bag',607,490,21);
  label(g,'กระเป๋า '+bagItems.length+' ชิ้น',632,486,13,'#ffe5aa');
  label(g,p.bagOpen?'A เลือก / B ใช้หรือปิด':p.usedRound===s.roundNumber?'ใช้แล้วในรอบนี้':'B เปิดกระเป๋า',632,506,10,'#abcddd','left',500);
  label(g,window.BoardParty.remainingSteps(s,p.id),885,487,30,'#ffe3a1','center');label(g,'ก้าวที่เหลือ',885,512,10,'#c8e6f3','center');
  if(p.shieldTurns>0)icon(g,'shield',775,490,16);
 }
 const timed=['ready','move_ready','branch','aim','car'].includes(s.phase);if(timed){box(g,886,428,60,25,8,'#173c53e8');label(g,Math.max(0,Math.ceil(s.deadline-s.time))+'s',933,441,12,'#e4f5fc','right');}
}
const IName=id=>window.BoardItems.names[id]||'ไม่มีไอเทม';
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
   label(g,s.phase==='order_result'?'ลำดับ '+(i+1):p.dice?'ทอยแล้ว':'A / B',x+w-12,y+22,10,'#a8cbdc','right');
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
function draw(g,t,s){
 // The first screen must render without allocating or painting the world map.
 if(['order','order_result','standings','rewards'].includes(s.phase)){
  g.fillStyle='#102e43';g.fillRect(0,0,960,540);overlay(g,s);return;
 }
 const top=s.players.length>6?145:94,bottom=452,viewH=bottom-top;
 const p=window.BoardParty.current(s)||s.players[0],pos=s.skill||window.BoardItems.position(s,p);
 const wide=s.phase==='aim',zoom=wide?.65:s.phase==='branch'?.83:1;
 const c=s.camera,dt=Math.min(.05,Math.max(.001,s.time-(c.lastTime||0)));c.lastTime=s.time;
 c.zoom+=(zoom-c.zoom)*(1-Math.exp(-dt*5));
 const halfW=480/c.zoom,halfH=viewH/2/c.zoom;
 const targetX=Math.max(halfW,Math.min(s.map.width-halfW,pos.x)),targetY=Math.max(halfH,Math.min(s.map.height-halfH,pos.y));
 c.x+=(targetX-c.x)*(1-Math.exp(-dt*6));c.y+=(targetY-c.y)*(1-Math.exp(-dt*6));
 c.x=Math.max(halfW,Math.min(s.map.width-halfW,c.x));c.y=Math.max(halfH,Math.min(s.map.height-halfH,c.y));
 g.clearRect(0,0,960,540);g.save();g.beginPath();g.rect(0,top,960,viewH);g.clip();g.translate(480,top+viewH/2);g.scale(c.zoom,c.zoom);g.translate(-c.x,-c.y);
 ground(g,s);nodes(g,s);actors(g,s,t);effects(g,s,t);g.restore();
 // Snow is a screen overlay; never modifies hitboxes or graph state.
 g.save();g.beginPath();g.rect(0,top,960,viewH);g.clip();for(let i=0;i<55;i++){const x=(i*137.3+Math.sin(t*.3+i)*20)%960,y=top+(i*71+t*(12+i%7))%viewH;circle(g,x,y,1+i%3*.45,'#ffffff8c');}g.restore();
 hud(g,s);turnDice(g,s);backpackOverlay(g,s);intermissionNotice(g,s);overlay(g,s);
}
window.BoardArt=Object.freeze({draw,icon,dice,colors,turnDice});
})();
