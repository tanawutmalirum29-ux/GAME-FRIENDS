'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('src/app/board/integration.js','utf8');
const boundary=source.indexOf('function boardRegistry()');
assert.ok(boundary>0,'minimap functions must remain before BOARD registration');
const packets=[];
const player={id:'p1',color:'#f02a55',worldPosition:{x:1000,y:700}};
const rival={id:'p2',color:'#2cf0b3',worldPosition:{x:1200,y:740}};
const session={id:'board-test-123',turnId:'b:1',map:{
 id:'winter-expedition',width:3000,height:2000,
 nodes:{a:{position:{x:900,y:680},nextNodes:['b']},
  b:{position:{x:1050,y:720},nextNodes:['c']},
  c:{position:{x:1300,y:780},nextNodes:[]}}
 },players:[player,rival]};
const ctx2d=new Proxy({},{
 get(target,key){
  if(key==='canvas')return {width:480,height:270};
  if(['beginPath','moveTo','lineTo','stroke','fill','fillRect','arc','fillText'].includes(key))return ()=>{};
  return target[key];
 },
 set(target,key,val){target[key]=val;return true;}
});
const canvas={width:480,height:270,
 classList:{hidden:true,toggle(_name,state){this.hidden=state;}},
 getContext:()=>ctx2d};
const classes={add(){},remove(){},toggle(){}};
const elements={controllerBoardMinimap:canvas,
 controllerPreviewImage:{classList:classes},controllerPreviewVideo:{classList:classes},
 controllerPreviewPlaceholder:{classList:classes}};
const conn={open:true,playerId:'p1',previewEnabled:true,boardMinimapCapable:true};
const scope={boardSession:session,round:{mode:'board'},hostConnections:new Set([conn]),
 window:{BoardParty:{current:()=>player},BoardItems:{position:(_s,p)=>p.worldPosition}},
 controllerPreviewEnabled:true,controllerGameMode:'board',controllerId:'p1',
 $:id=>elements[id],send:(c,p)=>packets.push(p),Math,console};
vm.createContext(scope);
vm.runInContext(source.slice(0,boundary),scope);
scope.sendBoardMiniMap=vm.runInContext('sendBoardMiniMap',scope);
scope.receivePhoneMiniMapMap=vm.runInContext('receivePhoneMiniMapMap',scope);
scope.receivePhoneMiniMapPositions=vm.runInContext('receivePhoneMiniMapPositions',scope);
scope.sendBoardMiniMap(conn);
assert.deepEqual(packets.map(p=>p.t),['board-minimap-map','board-minimap-positions']);
assert.equal(packets[0].mapId,'winter-expedition','minimap topology uses canonical map ID');
scope.sendBoardMiniMap(conn);
assert.equal(packets.filter(p=>p.t==='board-minimap-map').length,1,
 'static topology should not be transmitted on every position tick');
assert.equal(packets.filter(p=>p.t==='board-minimap-positions').length,2);
scope.receivePhoneMiniMapMap(packets[0]);
scope.receivePhoneMiniMapPositions(packets[1]);
assert.equal(canvas.classList.hidden,false,'minimap appears when toggled on');
assert.equal(vm.runInContext('phoneMiniMapPositions.players.length',scope),2);
scope.receivePhoneMiniMapPositions({...packets[1],players:[['p1',NaN,2,'#f02a55']]});
assert.equal(vm.runInContext('phoneMiniMapPositions.players.length',scope),2,
 'malformed positions must not replace the good snapshot');
conn.previewEnabled=false;
scope.sendBoardMiniMap(conn);
assert.equal(packets.length,3,'preview off never streams topology or positions');
const ctrl=fs.readFileSync('src/app/controller/connection.js','utf8');
const host=fs.readFileSync('src/app/host/room.js','utf8');
assert.match(ctrl,/function startControllerFastAxis/);
assert.match(ctrl,/maxRetransmits!==0/);
assert.match(ctrl,/reliable:false,serialization:'json'/);
assert.match(host,/function acceptFastAxisConnection/);
assert.match(host,/createFastAxisIngressGuard/);
assert.match(host,/boardCameraGestureToken===board.turnId/);
// PeerJS 1.5.5 omits maxRetransmits:0 by default: scope the native
// createDataChannel override to exactly our labeled axis connection.
const start=ctrl.indexOf('function connectControllerZeroRetryAxis(');
const end=ctrl.indexOf('function startControllerFastAxis(',start);
assert.ok(start>=0&&end>start);
function PeerConnectionMock(){}
const created=[];
PeerConnectionMock.prototype.createDataChannel=function(label,opts){
 created.push({label,opts});return{label,opts};
};
const native=PeerConnectionMock.prototype.createDataChannel;
const axisScope={window:{RTCPeerConnection:PeerConnectionMock}};
vm.createContext(axisScope);
vm.runInContext(ctrl.slice(start,end)+'\nthis.openFast=connectControllerZeroRetryAxis;',axisScope);
const mockPeer={connect:(_target,opts)=>{
 const pc=new PeerConnectionMock();
 pc.createDataChannel('unrelated',{ordered:true});
 return pc.createDataChannel(opts.label,{ordered:false});
}};
const channel=axisScope.openFast(mockPeer,'host',{label:'gf-axis-v1'});
assert.equal(channel.opts.maxRetransmits,0);
assert.equal(channel.opts.ordered,false);
assert.equal(created[0].opts.maxRetransmits,undefined,'regular PeerJS channels are untouched');
assert.equal(PeerConnectionMock.prototype.createDataChannel,native,
 'native method must always be restored after synchronous PeerJS negotiation');
console.log('CONTROLLER MINIMAP PASS: map-once, positions, preview toggle, secure fast path integration');
