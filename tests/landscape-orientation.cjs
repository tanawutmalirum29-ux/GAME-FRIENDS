'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const runtime=read('src/app/core/runtime.js');
const controller=read('src/app/controller/connection.js');
const css=read('style.css');
for(const path of ['host.webmanifest','manifest.webmanifest'])
 assert.equal(JSON.parse(read(path)).orientation,'landscape',path+' advertises native landscape');
assert.match(runtime,/function syncLandscapePresentation\(/);
assert.match(runtime,/isStandaloneWebApp\(\)\|\|currentView==='hostLobby'\|\|currentView==='game'/);
assert.match(css,/body\.gf-virtual-landscape\.host-playing #game\.game-page/);
assert.match(css,/#controller #rotateNotice,[\s\S]*?display:none!important/);
assert.match(read('index.html'),/id="rotateNotice"[^>]*hidden aria-hidden="true"/);
assert.match(controller,/followDeviceOrientation\(\); \/\/ automatic/);

// Test real inverse mapping of the 90 degree rotated SCREEN rectangle to the
// untransformed landscape canvas. 390×844 handset visual bounds; 844×390 game.
const begin=runtime.indexOf('function arenaIsRotated()');
const end=runtime.indexOf('// Host map gestures:',begin);
assert.ok(begin>=0&&end>begin);
let portrait=true;
const gameCanvas={clientWidth:844,clientHeight:390,getBoundingClientRect:()=>
 ({left:0,top:0,right:390,bottom:844,width:390,height:844})};
const world={canvas:gameCanvas,physicalPortrait:()=>portrait,currentView:'game',
 round:null,boardSession:null};
vm.createContext(world);
vm.runInContext(runtime.slice(begin,end)+
 '\nthis.point=arenaPointer;this.content=arenaContentRect;',world);
const mid=world.point({clientX:195,clientY:422});
assert.ok(Math.abs(mid.x-480)<.01&&Math.abs(mid.y-270)<.01,
 'the centered physical portrait tap must hit the logical world center');
// The 844x390 viewport letterboxes a 960x540 world by ~75px on each side.
const content=world.content(gameCanvas.getBoundingClientRect());
const corner=world.point({clientX:390,clientY:content.left});
assert.ok(Math.abs(corner.x)<.01&&Math.abs(corner.y)<.01,
 'the rotated map content origin must map to world (0,0), not its letterbox');
const edge=world.point({clientX:0,clientY:844-content.left});
assert.ok(Math.abs(edge.x-960)<.01&&Math.abs(edge.y-540)<.01);
portrait=false;
gameCanvas.clientWidth=960;gameCanvas.clientHeight=540;
gameCanvas.getBoundingClientRect=()=>({left:0,top:0,right:960,bottom:540,width:960,height:540});
const landscape=world.point({clientX:480,clientY:270});
assert.ok(Math.abs(landscape.x-480)<.01&&Math.abs(landscape.y-270)<.01,
 'physical landscape must remain unchanged');
portrait=true;
world.round={mode:'board'};world.boardSession={camera:{viewHeight:540}};
gameCanvas.clientWidth=960;gameCanvas.clientHeight=680;
gameCanvas.getBoundingClientRect=()=>({left:0,top:0,right:680,bottom:960,width:680,height:960});
const board=world.content(gameCanvas.getBoundingClientRect());
assert.equal(board.height,680,'BOARD view height comes from unrotated layout');
const boardCenter=world.point({clientX:340,clientY:480});
assert.ok(Math.abs(boardCenter.x-480)<.01&&Math.abs(boardCenter.y-340)<.01);

// The joined controller must automatically use CSS fallback in a portrait WEB
// but not double-rotate the whole-shell fallback of an installed app.
const sectionStart=controller.indexOf('function clearPortraitFallback(){');
const sectionEnd=controller.indexOf('// Request landscape from both',sectionStart);
assert.ok(sectionStart>=0&&sectionEnd>sectionStart);
const flags=new Set(),classes={contains:x=>flags.has(x),
 add:x=>flags.add(x),remove:x=>flags.delete(x),
 toggle(x,active){if(active)flags.add(x);else flags.delete(x);}};
let virtual=false,portraitPhone=true,viewportCalls=0,stops=0;
const cont={
 controllerReady:true,isPortraitScreen:()=>portraitPhone,
 usesVirtualLandscape:()=>virtual,
 document:{body:{classList:classes}},window:{addEventListener(){}},
 releaseStick:()=>{stops++;},syncControllerVisibleViewport:()=>{viewportCalls++;},
 lastControllerViewport:'cached', $:()=>({classList:{add(){}}})
};
vm.createContext(cont);
vm.runInContext(controller.slice(sectionStart,sectionEnd)+
 '\nthis.follow=followDeviceOrientation;',cont);
cont.follow();
assert.equal(flags.has('portrait-fallback'),true,'portrait web joins rotate immediately');
assert.equal(stops,1,'reset the stick exactly once on rotation');
cont.follow();assert.equal(stops,1,'no repeated release on resize without a rotation change');
virtual=true;cont.follow();assert.equal(flags.has('portrait-fallback'),false,
 'installed app rotates the shell, never the controller a second time');
portraitPhone=false;virtual=false;cont.follow();
assert.equal(flags.has('portrait-fallback'),false,'native landscape clears fallback');
// The camera must use native physical viewport coordinates even while the
// installed controller PWA normally rotates its shell on portrait devices.
const startLandscape=runtime.indexOf('const physicalPortrait=()=>{');
const endLandscape=runtime.indexOf('let hostFullscreenWasEntered=false;',startLandscape);
assert.ok(startLandscape>=0&&endLandscape>startLandscape);
const uiFlags=new Set(),rootFlags=new Set(),scannerFlags=new Set(['hidden']);
const cls=set=>({contains:name=>set.has(name),
 toggle(name,on){if(on)set.add(name);else set.delete(name);}});
let repaint=0;
const ui={
 window:{matchMedia:()=>({matches:true})},navigator:{},currentView:'controller',
 controllerReady:false,isStandaloneWebApp:()=>true,
 markArenaResolutionDirty:()=>{repaint++;},
 document:{body:{classList:cls(uiFlags)},
  documentElement:{classList:cls(rootFlags)},
  getElementById:id=>id==='roomScannerPanel'?{classList:cls(scannerFlags)}:null}
};
vm.createContext(ui);
vm.runInContext(runtime.slice(startLandscape,endLandscape)+
 '\\nthis.updateLandscape=syncLandscapePresentation;',ui);
ui.updateLandscape();
assert.equal(uiFlags.has('gf-virtual-landscape'),true,
 'installed PWA uses landscape fallback when no scanner is open');
scannerFlags.delete('hidden');ui.updateLandscape();
assert.equal(uiFlags.has('gf-virtual-landscape'),false,
 'opening QR camera suspends the rotated PWA shell');
assert.equal(rootFlags.has('gf-landscape-screen'),false,
 'scanner uses native portrait coordinates rather than rotated viewport');
scannerFlags.add('hidden');ui.updateLandscape();
assert.equal(uiFlags.has('gf-virtual-landscape'),true,
 'closing the camera restores virtual landscape for the controller');
assert.ok(repaint>=2,'switching scan and game views invalidates cached layout');

assert.match(controller,/syncLandscapePresentation\\(\\);[\\s\\S]*?await releaseQrSession\\(session\\)/,
 'closing the scanner restores the original orientation');
assert.match(controller,/session\\.reader\\.start\\(\\{facingMode:'environment'\\},\\{/);
assert.match(controller,/qrbox:\\(width,height\\)=>/,
 'camera scan region must adapt to real sensor dimensions');
assert.match(css,/#roomScannerPanel #roomQrReader video\\{[\\s\\S]*?height:auto!important/,
 'scanner video keeps intrinsic aspect rather than stretching to its parent');
console.log('LANDSCAPE ORIENTATION PASS: physical QR camera, PWA native/fallback switching, world touch, BOARD map and controller fallback');
