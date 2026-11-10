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
function runShard(m,shard,impact={full:true}){
 const bins=createPlan(m,impact),bin=bins.find(x=>x.shard===shard);
 assert(bin,'unknown shard '+shard);
 const base=path.join('/tmp/game-friends-board','ci-metrics');
 fs.mkdirSync(base,{recursive:true});
 const metrics={shard,startedAt:new Date().toISOString(),tasks:[]};
 let failed=0;
 // Require Playwright only when actually executing browser QA, not in the
 // lightweight matrix planning and Node regression jobs.
 const executable=require('playwright').chromium.executablePath();
 for(const task of bin.tasks){
  const heading=task.id+' (estimated '+task.seconds+'s)';
  process.stdout.write('::group::'+heading+'\n');
  const begin=Date.now();
  const env={...process.env,BOARD_BROWSER:task.browser,CHROME_PATH:executable};
  const result=cp.spawnSync(process.execPath,[path.join(root,task.file)],{
   cwd:root,stdio:'inherit',env,timeout:300000
  });
  const status=result.status===0&&!result.error?'passed':'failed';
  metrics.tasks.push({id:task.id,file:task.file,browser:task.browser,
   expectedSeconds:task.seconds,actualSeconds:+((Date.now()-begin)/1000).toFixed(2),
   status,signal:result.signal||null,error:result.error?String(result.error):null});
  if(status==='failed'){failed++;console.error('BROWSER QA FAILED: '+task.id,
    'exit='+result.status,'error='+String(result.error||''));}
  process.stdout.write('::endgroup::\n');
 }
 metrics.completedAt=new Date().toISOString();
 metrics.failed=failed;
 fs.writeFileSync(path.join(base,shard+'.json'),JSON.stringify(metrics,null,2)+'\n');
 console.log('BROWSER SHARD: '+shard+' '+(bin.tasks.length-failed)+'/'+bin.tasks.length+
  ' checks passed; '+Math.round(bin.seconds)+'s estimated. Durations saved to artifacts.');
 if(failed)process.exitCode=1;
}
function main(args){
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
  runShard(m,args[1],impact);
 }else{
  throw Error('Usage: node scripts/ci-browser-scheduler.cjs --matrix | --plan | --run shard-01');
 }
}
if(require.main===module){
 try{main(process.argv.slice(2));}catch(e){console.error(e.stack||String(e));process.exitCode=1;}
}
module.exports={readManifest,validateManifest,expandTasks,selectManifest,createPlan,matrix};
