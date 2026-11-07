/* Integration properties specific to the authored expedition, not screen proximity. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({window:{PartyPlayerAvatar:{draw(){},drawFront(){},costumeFor(){return null;}}},console});
for(const f of ['board-map','board-dice','board-items','board-bots','board-minigame','board-party','board-art'])vm.runInContext(fs.readFileSync(f+'.js','utf8'),ctx);
const {BoardMap:M,BoardParty:P,BoardArt:A,BoardBots:B,BoardItems:I}=ctx.window;
const game=()=>{const s=P.create([{id:'p1',name:'Explorer',color:'#ffc76e'}],{seed:23});s.order=['p1'];P.startTurn(s);return s;};
const map=M.create(0),nodes=Object.values(map.nodes);
assert.ok(!map.islands.find(i=>i.id==='lake').decorations.some(d=>d.kind==='fence'&&d.x===4240),
 'the fence at the b72_6 junction has been removed to clear the new walk lane');
const g=new Proxy({}, {get(o,k){if(k==='createLinearGradient')return()=>({addColorStop(){}});return k in o?o[k]:()=>{};},set(o,k,v){o[k]=v;return true;}});
// Every checkpoint can be followed at readable zoom, even after a geographic reversal.
for(const height of [540,720]){
 const s=game();s.camera.viewHeight=height;
 A.overview(s);
 for(const i of s.map.islands)for(const p of i.outline){
  assert.ok(Math.abs(p.x-s.camera.x)*s.camera.zoom<=480);
  assert.ok(Math.abs(p.y-s.camera.y)*s.camera.zoom<=(height-88-94)/2);
 }
 for(const n of nodes){
  s.players[0].currentNodeId=n.id;delete s.players[0].worldPosition;
  s.phase='moving';s.move=null;A.follow(s);
  for(let j=0;j<85;j++)A.draw(g,(s.time+=.05),s);
  assert.ok(s.camera.zoom>.95,'follow does not shrink actors with world size');
  const x=480+(n.position.x-s.camera.x)*s.camera.zoom,y=(94+height-88)/2+(n.position.y-s.camera.y)*s.camera.zoom;
  assert.ok(x>=30&&x<=930&&y>=94+25&&y<=height-88-25,'camera reaches '+n.id);
 }
 for(const n of nodes.filter(n=>n.nextNodes.length>1)){
  s.players[0].currentNodeId=n.id;P.beginMove(s,s.players[0],1);s.camera.explore=false;
  const frame=A.branchFrame(s);assert.ok(frame&&frame.zoom>=.55,'route geometry remains valid');
  assert.equal(A.canPan(s),true,'fork camera gestures remain enabled');
  for(let j=0;j<100;j++)A.draw(g,(s.time+=.05),s);
  // The WALK camera now follows the avatar instead of jumping to the
  // entire fork and zooming out. The other routes can remain off-screen:
  // scrolling/pinching is always available if the host wants to inspect.
  assert.ok(s.camera.zoom>.95,'no automatic fork zoom-out while manually walking');
  const pos=I.position(s,s.players[0]);
  const x=480+(pos.x-s.camera.x)*s.camera.zoom;
  const y=(94+height-88)/2+(pos.y-s.camera.y)*s.camera.zoom;
  assert.ok(x>30&&x<930&&y>94+25&&y<height-88-25,
   'active walker remains visible at '+n.id+' without forced route framing');
 }
}
// Nearest-looking pads and incoming arrows never create outgoing walking edges.
for(const n of nodes.filter(n=>n.nextNodes.length)){
 const s=game(),p=s.players[0];p.currentNodeId=n.id;P.beginMove(s,p,2);
 const near=nodes.filter(q=>q.id!==n.id&&!n.nextNodes.includes(q.id)).sort((a,b)=>Math.hypot(a.position.x-n.position.x,a.position.y-n.position.y)-Math.hypot(b.position.x-n.position.x,b.position.y-n.position.y))[0];
 assert.equal(P.step(s,near.id),false);assert.equal(s.move.remaining,2);
 for(const prev of n.previousNodes)assert.equal(P.step(s,prev),false);
 for(const hp of [15,55,100]){p.hp=hp;assert.ok(n.nextNodes.includes(B.chooseNext(s,p)));}
}
const s=game(),p=s.players[0];p.currentNodeId='n76';p.hp=15;
assert.equal(B.chooseNext(s,p),'c76_1','low HP values the safe healing detour at the three-way fork');
p.hp=100;assert.equal(B.chooseNext(s,p),'b76_1','healthy bot can take a risky shortcut');
assert.equal(B.route(s,'b76_1','c76_1'),null,'sibling paths are not connected by nearby scenery');
assert.ok(B.route(s,'n56','n66'),'return to the same island is reachable using directed edges');
assert.equal(B.route(s,'n66','n56'),null,'island return cannot reverse graph progress');
// Version barriers cover update, input, start-turn, snapshots and minigame return.
const packet={turnId:s.turnId,mapVersion:'winter-fixed-120-v2',actionId:1,keys:{action:true}};
assert.equal(P.input(s,p.id,packet),false);assert.equal(P.snapshot(s).mapVersion,M.MAP_VERSION);
s.map.version='winter-fixed-120-v2';
for(const fn of [()=>P.update(s,.05),()=>P.input(s,p.id,packet),()=>P.startTurn(s),()=>P.snapshot(s),()=>P.minigameEnded(s,[])])assert.throws(fn,/Incompatible/);
// Decorations are part of the fixed definition, with safe footprints on actual snow.
const inside=(p,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
function smooth(poly){const result=[];for(let i=0;i<poly.length;i++){const p=poly[i],prev=poly[(i+poly.length-1)%poly.length],next=poly[(i+1)%poly.length],a={x:(prev.x+p.x)/2,y:(prev.y+p.y)/2},b={x:(next.x+p.x)/2,y:(next.y+p.y)/2};for(let j=0;j<16;j++){const t=j/16,u=1-t;result.push({x:u*u*a.x+2*u*t*p.x+t*t*b.x,y:u*u*a.y+2*u*t*p.y+t*t*b.y});}}return result;}
const boxes={pine:[-36,-120,36,22],gift:[-15,-30,15,10],rock:[-30,-42,31,22],lantern:[-4,-50,26,10],fence:[-5,-23,70,23],house:[-80,-103,64,30],mountain:[-100,-160,105,25],cave:[-65,-75,65,24],lake:[-150,-115,150,115]};
const edges=nodes.flatMap(n=>n.nextNodes.map(id=>[n.position,map.nodes[id].position]));
function hitsBox(a,b,r){
 let low=0,high=1;
 for(const key of ['x','y']){
  const d=b[key]-a[key],min=r[key+'0']-50,max=r[key+'1']+50;
  if(Math.abs(d)<.001){if(a[key]<min||a[key]>max)return false;continue;}
  let t1=(min-a[key])/d,t2=(max-a[key])/d;if(t1>t2)[t1,t2]=[t2,t1];
  low=Math.max(low,t1);high=Math.min(high,t2);if(low>high)return false;
 }
 return true;
}
for(const island of map.islands){
 const outline=smooth(island.outline);
 for(const id of island.nodeIds){const p=map.nodes[id].position;for(let j=0;j<16;j++){const a=j*Math.PI/8;assert.ok(inside({x:p.x+48*Math.cos(a),y:p.y+48*Math.sin(a)},outline),'tile remains on rendered curved coast: '+id);}}
 for(const d of island.decorations){
  const b=boxes[d.kind],k=d.scale||1;
  const r={x0:d.x+b[0]*k,y0:d.y+b[1]*k,x1:d.x+b[2]*k,y1:d.y+b[3]*k};
  assert.ok(!edges.some(([a,b])=>hitsBox(a,b,r)),'decoration clears walking lane: '+island.id+' '+d.kind+' '+d.x);
  for(const [x,y] of [[b[0],b[1]],[b[2],b[1]],[b[0],b[3]],[b[2],b[3]]])assert.ok(inside({x:d.x+x*k,y:d.y+y*k},outline),'decoration on snow: '+island.id+' '+d.kind+' '+d.x);
 }
}
console.log('EXPEDITION PASS: all '+nodes.length+' nodes followed at 2 aspect ratios, all fork choices framed, nearby non-edges blocked, graph-aware bots, old-version rejection, curved coast and fixed decoration containment');
