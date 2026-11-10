'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os');
const path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const watcher=fs.readFileSync(path.join(root,'auto-update.js'),'utf8');
function buildTest(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gf-deploy-test-'));
 try{
  fs.cpSync(root,dir,{recursive:true,filter:source=>{
   const parts=path.relative(root,source).split(path.sep);
   return !parts.some(part=>['.git','node_modules','game-assets','coverage'].includes(part));
  }});
  for(const deploy of ['a'.repeat(40),'b'.repeat(40)]){
   execFileSync(process.execPath,[path.join(dir,'scripts/build-static.cjs')],{
    env:{...process.env,GAME_BUILD_ROOT:dir,AWS_COMMIT_ID:deploy},encoding:'utf8'
   });
   assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'deployment.json'),'utf8')).deployId,deploy);
   assert.match(fs.readFileSync(path.join(dir,'runtime-config.js'),'utf8'),
    new RegExp('GAME_DEPLOY_ID="'+deploy+'"'));
   const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
   assert.doesNotMatch(html,/\?v=/,'HTML resources must use canonical names without revisions');
   const refs=[...html.matchAll(/\b(?:src|href)="\.\/([^"?]+)"/g)].map(x=>x[1]);
   assert.ok(refs.length>10);
   for(const ref of refs)assert.ok(fs.existsSync(path.join(dir,ref)),'Referenced asset missing: '+ref);
   assert.doesNotMatch(html,/src="\.\/src\/games\//,'engines must load from catalog only');
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
function session(loaded,deployed,safeOn=true,remember=null,url='https://game.example/?join=ABC123'){
 const events={},docEvents={},requests=[],intervals=[],delays=[],stored=new Map();
 if(remember)stored.set('gf-reloaded-deploy',remember);
 let can=safeOn,notify=0;
 const location={href:url,replace(next){this.redirected=next;}};
 const win={GAME_DEPLOY_ID:loaded,GAME_CAN_AUTO_RELOAD:()=>can,
  GAME_NOTIFY_UPDATE:()=>{notify++;},location,
  addEventListener(name,fn){(events[name]??=[]).push(fn);}};
 const doc={hidden:false,addEventListener(name,fn){(docEvents[name]??=[]).push(fn);}};
 const storage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)};
 const ctx={window:win,document:doc,sessionStorage:storage,URL,Date,
  fetch:async (link,opts)=>{
   requests.push({url:link,opts});
   return {ok:true,json:async()=>({deployId:deployed})};
  },
  setInterval(fn,ms){intervals.push({fn,ms});return intervals.length;},
  setTimeout(fn,ms){delays.push({fn,ms});return delays.length;}};
 vm.runInNewContext(watcher,ctx,{filename:'auto-update.js'});
 return {win,doc,events,docEvents,requests,intervals,delays,stored,
  setSafe:v=>{can=v;},get notices(){return notify;}};
}
async function main(){
 buildTest();
 const old='a'.repeat(40),next='b'.repeat(40);
 const same=session(old,old);
 assert.equal(await same.win.GameAutoUpdate.check(),false);
 assert.equal(same.win.location.redirected,undefined);
 assert.equal(same.requests[0].opts.cache,'no-store');
 assert.equal(new URL(same.requests[0].url).pathname,'/deployment.json');
 assert.equal(new URL(same.requests[0].url).search,'');
 const idle=session(old,next);
 assert.equal(await idle.win.GameAutoUpdate.check(),true);
 assert.equal(idle.win.location.redirected,'https://game.example/?join=ABC123');
 assert.equal(idle.stored.get('gf-reloaded-deploy'),next);
 assert.equal(idle.notices,0);
 const veto=session(old,next);
 let saves=0;veto.win.GAME_PREPARE_AUTO_RELOAD=()=>{saves++;return false;};
 assert.equal(await veto.win.GameAutoUpdate.check(),true);
 assert.equal(saves,1);
 assert.equal(veto.win.location.redirected,undefined);
 veto.win.GAME_PREPARE_AUTO_RELOAD=()=>true;
 assert.equal(veto.win.GameAutoUpdate.onSafePoint(),true);
 const busy=session(old,next,false);
 assert.equal(await busy.win.GameAutoUpdate.check(),true);
 assert.equal(busy.win.location.redirected,undefined);
 assert.equal(busy.win.GameAutoUpdate.getPendingDeployment(),next);
 assert.equal(busy.notices,1);
 await busy.win.GameAutoUpdate.check();assert.equal(busy.notices,1);
 busy.setSafe(true);assert.equal(busy.win.GameAutoUpdate.onSafePoint(),true);
 assert.equal(busy.win.location.redirected,'https://game.example/?join=ABC123');
 const stale=session(old,next,true,next);
 await stale.win.GameAutoUpdate.check();
 assert.equal(stale.win.location.redirected,undefined);
 assert.equal(stale.notices,1);
 const hidden=session(old,next);
 hidden.doc.hidden=true;
 assert.equal(await hidden.win.GameAutoUpdate.check(),false);
 assert.equal(hidden.requests.length,0);
 hidden.doc.hidden=false;
 for(const fn of hidden.docEvents.visibilitychange||[])fn();
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(hidden.win.location.redirected);
 assert.equal(hidden.intervals[0].ms,45000);
 assert.ok(hidden.delays[0].ms>0);
 console.log('AUTO UPDATE PASS: stable deployment URLs, safe reload, live-room deferral, no redirect loop');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
