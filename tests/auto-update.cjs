'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const watcher=fs.readFileSync(path.join(root,'auto-update.js'),'utf8');

function buildTest(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gf-auto-build-'));
  try{
    fs.cpSync(root,dir,{recursive:true,filter:source=>{
      const parts=path.relative(root,source).split(path.sep);
      return !parts.some(part=>['.git','node_modules','game-assets','coverage'].includes(part));
    }});
    const first='a'.repeat(40),second='b'.repeat(40);
    for(const rev of [first,second]){
      execFileSync(process.execPath,[path.join(dir,'scripts/build-static.cjs')],{
        env:{...process.env,GAME_BUILD_ROOT:dir,AWS_COMMIT_ID:rev},
        encoding:'utf8'
      });
      assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'version.json'),'utf8')).version,rev);
      assert.match(fs.readFileSync(path.join(dir,'build-version.js'),'utf8'),
        new RegExp('GAME_BUILD_VERSION="'+rev+'"'));
      const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
      const versions=[...html.matchAll(/\b(?:src|href)="\.\/([^"?]+)\?v=([a-f0-9]{40})"/g)];
      assert.ok(versions.length>10,'actual HTML bootstrap assets must be revision pinned');
      for(const match of versions){
        assert.equal(match[2],rev,'every referenced asset uses this deploy revision: '+match[1]);
        assert.ok(fs.existsSync(path.join(dir,match[1])),'referenced asset exists: '+match[1]);
      }
      assert.doesNotMatch(html,/src="\.\/src\/games\//,'game engines must be lazy-loaded');
      assert.ok(!html.includes('?v='+ (rev===second?first:second)),
        'old deployment revision is removed');
    }
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

function session(loaded,server,initialSafe=true,initialUrl='https://game.example/?join=ABC123'){
  const events={},docEvents={},requests=[],intervals=[],delays=[];
  let can=initialSafe,notify=0;
  const location={
    href:initialUrl,
    replace(url){this.redirected=url;}
  };
  const win={
    GAME_BUILD_VERSION:loaded,
    GAME_CAN_AUTO_RELOAD:()=>can,
    GAME_NOTIFY_UPDATE:()=>{notify++;},
    location,
    addEventListener(name,fn){(events[name]??=[]).push(fn);}
  };
  const doc={
    hidden:false,
    addEventListener(name,fn){(docEvents[name]??=[]).push(fn);}
  };
  const context={window:win,document:doc,URL,Date,
    fetch:async (url,opts)=>{
      requests.push({url,opts});
      return {ok:true,json:async()=>({version:server})};
    },
    setInterval(fn,ms){intervals.push({fn,ms});return intervals.length;},
    setTimeout(fn,ms){delays.push({fn,ms});return delays.length;}
  };
  vm.runInNewContext(watcher,context,{filename:'auto-update.js'});
  return {win,doc,events,docEvents,requests,intervals,delays,
    setSafe(value){can=value;},get notices(){return notify;}};
}

async function main(){
  buildTest();
  const old='a'.repeat(40),newVersion='b'.repeat(40);
  // Up-to-date clients don't reload or show update notice.
  const same=session(old,old,true);
  assert.equal(await same.win.GameAutoUpdate.check(),false);
  assert.equal(same.win.location.redirected,undefined);
  assert.equal(same.notices,0);
  assert.equal(same.requests[0].opts.cache,'no-store');
  assert.ok(same.requests[0].url.includes('/version.json?'));

  // Idle host/controller automatically reload on detection.
  const idle=session(old,newVersion,true);
  assert.equal(await idle.win.GameAutoUpdate.check(),true);
  assert.ok(idle.win.location.redirected);
  const redirected=new URL(idle.win.location.redirected);
  assert.equal(redirected.searchParams.get('join'),'ABC123',
    'invitation URL is preserved');
  assert.equal(redirected.searchParams.get('_gf_build'),newVersion);
  assert.equal(idle.notices,0);

  // Refuse to reload when application state could not be safely persisted.
  const veto=session(old,newVersion,true);
  let preparations=0;
  veto.win.GAME_PREPARE_AUTO_RELOAD=()=>{preparations++;return false;};
  assert.equal(await veto.win.GameAutoUpdate.check(),true);
  assert.equal(preparations,1);
  assert.equal(veto.win.location.redirected,undefined,
    'a room must not reload if its recovery handoff cannot be saved');
  veto.win.GAME_PREPARE_AUTO_RELOAD=()=>true;
  assert.equal(veto.win.GameAutoUpdate.onSafePoint(),true);

  // Live PeerJS rooms never reload automatically or discard room IDs.
  const busy=session(old,newVersion,false);
  assert.equal(await busy.win.GameAutoUpdate.check(),true);
  assert.equal(busy.win.location.redirected,undefined);
  assert.equal(busy.win.GameAutoUpdate.getPendingVersion(),newVersion);
  assert.equal(busy.notices,1);
  assert.equal(await busy.win.GameAutoUpdate.check(),true);
  assert.equal(busy.notices,1,'no repeated update notifications');
  busy.setSafe(true);
  assert.equal(busy.win.GameAutoUpdate.onSafePoint(),true);
  assert.equal(new URL(busy.win.location.redirected).searchParams.get('_gf_build'),newVersion);

  // Cache inconsistencies must not create endless redirect loops.
  const stale=session(old,newVersion,true,'https://game.example/?_gf_build='+newVersion);
  await stale.win.GameAutoUpdate.check();
  assert.equal(stale.win.location.redirected,undefined);
  assert.equal(stale.notices,1);

  // Background tabs cannot request version until they become visible.
  const hidden=session(old,newVersion,true);
  hidden.doc.hidden=true;
  assert.equal(await hidden.win.GameAutoUpdate.check(),false);
  assert.equal(hidden.requests.length,0);
  hidden.doc.hidden=false;
  for(const fn of hidden.docEvents.visibilitychange||[])fn();
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(hidden.win.location.redirected);
  assert.equal(hidden.intervals[0].ms,45000);
  assert.ok(hidden.delays[0].ms>0);
  console.log('AUTO UPDATE PASS: versioned deploy assets, idle refresh, safe room deferral, loop protection');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
