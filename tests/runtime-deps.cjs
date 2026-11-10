'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/platform/runtime-deps.js'),'utf8');
function fixture({failFirst=false}={}){
 const window={},tags=[],pending=[];
 const document={
  createElement(kind){assert.equal(kind,'script');return {};},
  head:{append(tag){
   tags.push(tag);
   const type=tag.src.includes('peerjs@')?'peer':'qr';
   pending.push(()=>{
    if(failFirst&&tags.length===1){tag.onerror();return;}
    if(type==='peer')window.Peer=function Peer(){};
    else window.QRCode=function QRCode(){};
    tag.onload();
   });
  }}
 };
 vm.runInNewContext(source,{window,document,console});
 return {window,tags,flush(){const queue=pending.splice(0);for(const fn of queue)fn();}};
}
async function success(){
 const f=fixture();
 assert.equal(f.tags.length,0,'offline and join screen bootstrap require no network');
 assert.equal(f.window.GameRuntimeDeps.ready('peer'),false);
 const first=f.window.GameRuntimeDeps.ensureController();
 const duplicate=f.window.GameRuntimeDeps.ensureController();
 assert.equal(f.tags.length,1,'concurrent controller requests dedupe PeerJS');
 assert.ok(f.tags[0].src.includes('peerjs@1.5.5'));
 assert.equal(f.tags.some(t=>t.src.includes('qrcodejs@')),false);
 f.flush();
 await Promise.all([first,duplicate]);
 assert.equal(f.window.GameRuntimeDeps.ready('peer'),true);
 const host=f.window.GameRuntimeDeps.ensureHost();
 await host;
 assert.equal(f.tags.length,1,'Host signaling starts without QR library');
 assert.equal(f.window.GameRuntimeDeps.ready('qr'),false);
 const qr=f.window.GameRuntimeDeps.ensureQr();
 const duplicateQr=f.window.GameRuntimeDeps.ensureQr();
 assert.equal(f.tags.length,2,'QR is requested on demand, once');
 assert.ok(f.tags[1].src.includes('qrcodejs@1.0.0'));
 await f.window.GameRuntimeDeps.ensureHost();
 assert.equal(f.tags.length,2,'opening the room does not wait on QR');
 f.flush();await Promise.all([qr,duplicateQr]);
 assert.equal(f.window.GameRuntimeDeps.ready('qr'),true);
 await f.window.GameRuntimeDeps.ensureQr();
 assert.equal(f.tags.length,2,'cached libraries are not downloaded again');
}
async function recover(){
 const f=fixture({failFirst:true});
 const failed=f.window.GameRuntimeDeps.ensureController();
 f.flush();
 await assert.rejects(failed,/Unable to download peer/);
 const retry=f.window.GameRuntimeDeps.ensureController();
 assert.equal(f.tags.length,2,'failed script is retryable');
 f.flush();await retry;
 assert.equal(f.window.GameRuntimeDeps.ready('peer'),true);
}
Promise.resolve().then(success).then(recover).then(()=>
 console.log('RUNTIME DEPS PASS: instant signaling after PeerJS, optional deduped QR and failed-download recovery')
).catch(error=>{console.error(error);process.exitCode=1;});
