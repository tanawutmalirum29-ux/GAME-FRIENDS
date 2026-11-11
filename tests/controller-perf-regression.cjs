'use strict';
// Controller/network rendering regression: pure configuration, video state
// and iOS VisualViewport scheduling, without emulating WebRTC connectivity.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=path=>fs.readFileSync(path,'utf8');
const runtime=read('src/app/core/runtime.js');
const controller=read('src/app/controller/connection.js');
const host=read('src/app/host/room.js');
const css=read('style.css');
const start=runtime.indexOf('function partyPeerOptions(){');
const end=runtime.indexOf("const HOST_SESSION=",start);
assert.ok(start>=0&&end>start);
const ice=runtime.slice(start,end);
const runIce=servers=>vm.runInNewContext(ice+'\npartyPeerOptions()',{
 window:servers===undefined?{}:{GF_ICE_SERVERS:servers}
});
assert.equal(runIce().debug,0,'PeerJS remains usable without TURN credentials');
assert.equal(runIce().config,undefined,'default PeerJS ICE config stays intact');
const valid=[{urls:'turn:relay.example.test:3478',username:'temporary',credential:'ephemeral'}];
assert.equal(runIce(valid).config.iceServers[0].credential,'ephemeral');
assert.equal(runIce([{urls:'https://untrusted.example.test'}]).config,undefined,
 'Reject invalid ICE protocols');
assert.match(host,/new Peer\('gf-party-'\+code,partyPeerOptions\(\)\)/);
assert.match(controller,/new Peer\(undefined,partyPeerOptions\(\)\)/);

const marker='function activateControllerVideoIfReady(call){';
const begin=controller.indexOf(marker),finish=controller.indexOf('function showControllerVideo(',begin);
assert.ok(begin>=0&&finish>begin);
const video={paused:true,readyState:0,videoWidth:0,
 classList:{add(){},remove(name){if(name==='hidden')video.shown=true;}}};
const img={classList:{add(name){if(name==='hidden')img.hidden=true;}}};
const placeholder={classList:{add(){}}};
const button={classList:{add(){}}};
const elements={controllerPreviewVideo:video,controllerPreviewImage:img,
 controllerPreviewPlaceholder:placeholder,videoStartBtn:button};
const call={metadata:{quality:'low'}},sent=[];
const playback={controllerMediaCall:call,controllerPreviewEnabled:true,videoStreamActive:false,
 controllerVideoWatchdog:null,$:id=>elements[id],send:(_conn,packet)=>sent.push(packet),
 controllerConn:{},clearTimeout:()=>{}};
vm.runInNewContext(controller.slice(begin,finish)+'\nthis.activate=activateControllerVideoIfReady;',playback);
assert.equal(playback.activate(call),false,'paused video must not suppress JPEG');
assert.equal(sent.length,0,'do not claim stream readiness before first frame');
video.paused=false;video.readyState=2;video.videoWidth=256;
assert.equal(playback.activate(call),true,'decoded video can become active');
assert.equal(sent.length,1);
assert.equal(sent[0].t,'video-ready');
assert.equal(playback.videoStreamActive,true);
assert.equal(img.hidden,true);

const viewportStart=controller.indexOf('let controllerViewportFrame=0');
const viewportEnd=controller.indexOf('// iOS fires visualViewport.resize',viewportStart);
assert.ok(viewportStart>=0&&viewportEnd>viewportStart);
const props=new Map(),pending=[];
const layout={
 window:{visualViewport:{width:844,height:390,offsetLeft:0,offsetTop:0}},
 document:{body:{classList:{contains:name=>name==='controller-playing'}}},
 $:()=>({style:{setProperty:(name,value)=>props.set(name,value)}}),
 isPortraitScreen:()=>false,
 requestAnimationFrame:cb=>{pending.push(cb);return pending.length;}
};
vm.runInNewContext(controller.slice(viewportStart,viewportEnd)+
 '\nthis.updateViewport=syncControllerVisibleViewport;',layout);
layout.updateViewport();layout.updateViewport();
assert.equal(pending.length,1,'viewport events coalesce into one animation frame');
pending.shift()();
assert.equal(props.get('--gf-controller-face-size'),'102px');
assert.equal(props.get('--gf-controller-stage-scale'),'1.000000');
layout.window.visualViewport.width=422;layout.window.visualViewport.height=195;
layout.updateViewport();pending.shift()();
assert.equal(props.get('--gf-controller-face-size'),'102px','fixed reference button never double-scales');
assert.equal(props.get('--gf-controller-stage-scale'),'0.500000','entire stage halves at 422×195');
assert.match(css,/var\(--gf-controller-face-size,102px\)/);
assert.match(css,/backdrop-filter:none!important/);
assert.match(css,/width:844px!important;height:390px!important/);
assert.match(css,/portrait-fallback #controller #controllerActive.controller-active/);
assert.match(css,/controllerBoardMinimap/);
assert.match(controller,/function queueAnalogInput\(/);
assert.match(controller,/zone\.classList\.add\('has-used'\)/,'stick marks first touch');
assert.match(css,/has-used:not\(\.is-active\)/,'stick hidden after release');
assert.match(read('index.html'),/<div id="controllerPreviewOff"[^>]*><\/div>/,
 'preview disabled has no explanatory text');
assert.match(host,/t:'input-ack'/);
assert.match(controller,/data\.t==='input-ack'/);
assert.match(read('src/board-party/runtime/board-art.js'),/const boardPaintCache=new WeakMap\(\)/);
assert.match(read('src/app/rounds/render.js'),/function updateAdaptiveBoardDetail/);
console.log('CONTROLLER PERFORMANCE PASS: ICE config, first-frame fallback, viewport batching and diagnostics');
