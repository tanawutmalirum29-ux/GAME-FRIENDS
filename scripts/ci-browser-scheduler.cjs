/* Adaptive, deterministic QA sharding for a growing game catalog.
 * Commands: --matrix | --plan | --run shard-01
 * Pure planning functions are also exported for CI self-tests. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const manifestPath=path.join(root,'ci','browser-tests.json');
const browserFiles=/^[a-z0-9-]+-browser\.cjs$/;
function assert(condition,message){if(!condition)throw Error('Browser QA registry: '+message);}
function readManifest(){
 return JSON.parse(fs.readFileSync(manifestPath,'utf8'));
}
function validateManifest(m,options={}){
 assert(m&&m.version===1,'unsupported schema version');
 for(const name of ['targetSecondsPerShard','minShards','maxShards'])
  assert(Number.isInteger(m[name])&&m[name]>0&&m[name]<=900,'invalid '+name);
 assert(m.minShards<=m.maxShards,'minShards exceeds maxShards');
 assert(m.maxShards<=16,'maxShards must stay bounded (<=16)');
 assert(Array.isArray(m.tests)&&m.tests.length>0,'no browser tests registered');
 const seen=new Set();
 for(const t of m.tests){
  assert(t&&typeof t.file==='string'&&/^tests\/[a-z0-9-]+\.cjs$/.test(t.file),'invalid test path');
  assert(!seen.has(t.file),'duplicate test '+t.file);
  seen.add(t.file);
  assert(t.browsers&&typeof t.browsers==='object'&&!Array.isArray(t.browsers),'missing browsers '+t.file);
  assert(Array.isArray(t.areas)&&t.areas.length>0&&
    t.areas.every(area=>typeof area==='string'&&/^[a-z0-9:-]+$/.test(area)),
    'missing/invalid impact areas for '+t.file);
  assert(new Set(t.areas).size===t.areas.length,'duplicate impact area '+t.file);
  const names=Object.keys(t.browsers);
  assert(names.length>0,'no supported browser for '+t.file);
  assert(names.every(v=>['chromium','webkit'].includes(v)),'unsupported browser in '+t.file);
  for(const b of names)
   assert(Number.isInteger(t.browsers[b])&&t.browsers[b]>=1&&t.browsers[b]<=900,
    'invalid estimated seconds for '+t.file+' '+b);
  if(!names.includes('webkit'))assert(typeof t.chromiumOnlyReason==='string'&&
    t.chromiumOnlyReason.length>=15,'missing Chromium-only justification for '+t.file);
  if(names.includes('webkit'))assert(!t.chromiumOnlyReason,
    'remove outdated Chromium-only justification from '+t.file);
  if(options.checkFiles!==false)
   assert(fs.existsSync(path.join(root,t.file)),'registered file is absent: '+t.file);
 }
 if(options.checkFiles!==false){
  const disk=fs.readdirSync(path.join(root,'tests'))
    .filter(f=>browserFiles.test(f)).map(f=>'tests/'+f);
  for(const f of disk)assert(seen.has(f),'new browser test must be registered: '+f);
  assert(seen.has('tests/board-startup.cjs'),'BOARD PARTY start/zoom test must remain');
  assert(seen.has('tests/map-scale-browser.cjs'),'1–12-player map scale checks must remain');
 }
 return m;
}
function expandTasks(m){
 return m.tests.flatMap(t=>Object.entries(t.browsers).map(([browser,seconds])=>({
  id:t.file+'@'+browser,file:t.file,browser,seconds
 })));
}
function selectManifest(m,impact={full:true}){
 if(impact.full===true)return m;
 assert(impact&&Array.isArray(impact.areas)&&
    ['targeted','docs'].includes(impact.mode),'invalid QA impact plan');
 return {...m,tests:m.tests.filter(t=>t.areas.some(area=>impact.areas.includes(area))||
   impact.areas.includes('test:'+t.file))};
}
function createPlan(m,impact={full:true}){
 const tasks=expandTasks(selectManifest(m,impact));
 if(!tasks.length)return []; // Docs-only PR still produces a successful stable gate.
 const total=tasks.reduce((s,t)=>s+t.seconds,0);
 const count=Math.min(m.maxShards,tasks.length,
  Math.max(m.minShards,Math.ceil(total/m.targetSecondsPerShard)));
 const bins=Array.from({length:count},(_,i)=>({
  shard:'shard-'+String(i+1).padStart(2,'0'),seconds:0,tasks:[]
 }));
 const ordered=[...tasks].sort((a,b)=>b.seconds-a.seconds||a.id.localeCompare(b.id));
 for(const task of ordered){
  bins.sort((a,b)=>a.seconds-b.seconds||a.tasks.length-b.tasks.length||
    a.shard.localeCompare(b.shard));
  bins[0].tasks.push(task);bins[0].seconds+=task.seconds;
 }
 bins.sort((a,b)=>a.shard.localeCompare(b.shard));
 assert(bins.every(b=>b.tasks.length),'empty shard found');
 return bins;
}
function matrix(m,impact={full:true}){
 const selected=createPlan(m,impact);
 return {include:selected.length?
   selected.map(b=>({shard:b.shard,skip:false})):
   [{shard:'no-browser-impact',skip:true}]};
}
// A hung Playwright browser can outlive its Node test process. Give each test
// its own process group so the timeout removes browsers as well as the test.
const TASK_TIMEOUT_MS=4*60*1000;
function terminateTree(child){
 if(!child || !child.pid)return;
 try{
  if(process.platform==='win32')child.kill('SIGKILL');
  else process.kill(-child.pid,'SIGKILL');
 }catch(e){
  if(e.code!=='ESRCH')console.error('BROWSER QA cleanup:',e.message);
 }
}
function runBrowserProcess(command,args,options={}){
 const timeoutMs=options.timeoutMs===undefined?TASK_TIMEOUT_MS:options.timeoutMs;
 assert(Number.isInteger(timeoutMs)&&timeoutMs>0,'invalid browser task timeout');
 const label=options.label||args.join(' ');
 const quiet=options.quiet===true;
 return new Promise(resolve=>{
  const begin=Date.now();
  let error=null,timedOut=false;
  const child=cp.spawn(command,args,{
   cwd:options.cwd||root,env:options.env||process.env,
   stdio:options.stdio||'inherit',
   detached:process.platform!=='win32'
  });
  const heartbeat=setInterval(()=>{
   if(!quiet)console.log('BROWSER QA HEARTBEAT '+label+': '+
    Math.floor((Date.now()-begin)/1000)+'s elapsed / '+Math.ceil(timeoutMs/1000)+'s limit');
  },options.heartbeatMs||30000);
  const deadline=setTimeout(()=>{
   timedOut=true;
   if(!quiet)console.error('BROWSER QA TIMEOUT '+label+': '+
    Math.ceil(timeoutMs/1000)+'s deadline exceeded; killing test and browser process group');
   terminateTree(child);
  },timeoutMs);
  // GitHub cancellation must not leave orphan Chromium or WebKit processes.
  const onTerm=()=>{terminateTree(child);process.exit(143);};
  const onInt=()=>{terminateTree(child);process.exit(130);};
  process.once('SIGTERM',onTerm);
  process.once('SIGINT',onInt);
  child.on('error',e=>{error=e;});
  child.on('close',(exitCode,signal)=>{
   clearInterval(heartbeat);
   clearTimeout(deadline);
   process.off('SIGTERM',onTerm);
   process.off('SIGINT',onInt);
   terminateTree(child); // Clean up grandchildren even when the test exits normally.
   const elapsedMs=Date.now()-begin;
   const status=timedOut?'timed_out':exitCode===0&&!error?'passed':'failed';
   if(!quiet)console.log('BROWSER QA FINISH '+label+': '+status+
    ' in '+(elapsedMs/1000).toFixed(1)+'s');
   resolve({status,exitCode,signal,error:error?String(error):null,
    timedOut,elapsedMs,timeoutMs});
  });
 });
}
async function runShard(m,shard,impact={full:true}){
 const bins=createPlan(m,impact),bin=bins.find(x=>x.shard===shard);
 assert(bin,'unknown shard '+shard);
 const base=path.join('/tmp/game-friends-board','ci-metrics');
 fs.mkdirSync(base,{recursive:true});
 const metricsFile=path.join(base,shard+'.json');
 const metrics={shard,startedAt:new Date().toISOString(),tasks:[],failed:0};
 const save=()=>fs.writeFileSync(metricsFile,JSON.stringify(metrics,null,2)+'\n');
 // Require Playwright only when executing browser QA, not for matrix planning.
 const executable=require('playwright').chromium.executablePath();
 for(const task of bin.tasks){
  const heading=task.id+' (estimated '+task.seconds+'s, hard limit '+
   Math.ceil(TASK_TIMEOUT_MS/1000)+'s)';
  process.stdout.write('::group::'+heading+'\n');
  metrics.running=task.id;
  save();
  const env={...process.env,BOARD_BROWSER:task.browser,CHROME_PATH:executable};
  const result=await runBrowserProcess(process.execPath,[path.join(root,task.file)],{
   cwd:root,env,label:task.id,timeoutMs:TASK_TIMEOUT_MS
  });
  metrics.tasks.push({id:task.id,file:task.file,browser:task.browser,
   expectedSeconds:task.seconds,actualSeconds:+(result.elapsedMs/1000).toFixed(2),
   timeoutSeconds:result.timeoutMs/1000,status:result.status,
   exitCode:result.exitCode,signal:result.signal,error:result.error});
  if(result.status!=='passed'){
   metrics.failed++;
   console.error('::error::BROWSER QA FAILED: '+task.id+' ('+result.status+
    ', exit='+result.exitCode+', signal='+result.signal+')');
  }
  delete metrics.running;
  save(); // Preserve each completed test even if a later test gets stuck.
  process.stdout.write('::endgroup::\n');
 }
 metrics.completedAt=new Date().toISOString();
 save();
 console.log('BROWSER SHARD: '+shard+' '+(bin.tasks.length-metrics.failed)+'/'+bin.tasks.length+
  ' checks passed; '+Math.round(bin.seconds)+'s estimated. Durations saved to artifacts.');
 if(metrics.failed)process.exitCode=1;
}
async function main(args){
 const m=validateManifest(readManifest());
 const impact=process.env.QA_IMPACT_JSON ? JSON.parse(process.env.QA_IMPACT_JSON) : {full:true};
 if(args[0]==='--matrix'&&args.length===1){
  console.log('matrix='+JSON.stringify(matrix(m,impact)));
 }else if(args[0]==='--plan'&&args.length===1){
  const plan=createPlan(m,impact);
  console.log('Dynamic browser QA: '+expandTasks(selectManifest(m,impact)).length+' checks / '+plan.length+
   ' shards (target '+m.targetSecondsPerShard+'s, cap '+m.maxShards+').');
  for(const bin of plan)console.log(bin.shard+' '+bin.seconds+'s: '+
   bin.tasks.map(t=>t.id).join(', '));
 }else if(args[0]==='--run'&&args.length===2){
  await runShard(m,args[1],impact);
 }else{
  throw Error('Usage: node scripts/ci-browser-scheduler.cjs --matrix | --plan | --run shard-01');
 }
}
if(require.main===module){
 main(process.argv.slice(2)).catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
}
module.exports={readManifest,validateManifest,expandTasks,selectManifest,createPlan,matrix,runBrowserProcess};
