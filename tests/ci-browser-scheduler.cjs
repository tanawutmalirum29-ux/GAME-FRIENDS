'use strict';
const assert=require('node:assert/strict');
const {
 readManifest,validateManifest,expandTasks,createPlan,matrix
}=require('../scripts/ci-browser-scheduler.cjs');
const config=validateManifest(readManifest());
function verifyPlan(m){
 const a=createPlan(m),b=createPlan(m);
 assert.deepEqual(a,b,'sharding must be deterministic on any GitHub runner');
 assert.equal(a.length,Math.min(m.maxShards,expandTasks(m).length,
  Math.max(m.minShards,Math.ceil(expandTasks(m).reduce((n,t)=>n+t.seconds,0)/m.targetSecondsPerShard))));
 const expected=expandTasks(m).map(t=>t.id).sort();
 const actual=a.flatMap(x=>x.tasks.map(t=>t.id)).sort();
 assert.deepEqual(actual,expected,'every browser task must run exactly once');
 assert.ok(a.every(b=>b.tasks.length),'no empty shards');
 assert.ok(new Set(a.map(b=>b.shard)).size===a.length,'stable unique shard keys');
 assert.deepEqual(matrix(m).include.map(x=>x.shard),a.map(x=>x.shard));
 return a;
}
const base=verifyPlan(config);
assert.ok(base.length>=2&&base.length<=config.maxShards);
assert.ok(expandTasks(config).length>=18,'previous Chromium/WebKit tests plus avatar must be covered');
for(const count of [10,20,40,80,160]){
 const bigger={...config,tests:[
  ...config.tests,
  ...Array.from({length:count},(_,i)=>({
   file:'tests/future-game-'+i+'.cjs',browsers:{chromium:36,webkit:42}
  }))
 ]};
 const plan=verifyPlan(bigger);
 assert.ok(plan.length>=base.length,'more work should not reduce shard count');
 assert.ok(plan.length<=config.maxShards,'growth is bounded by runner budget');
 if(count===160)assert.equal(plan.length,config.maxShards,'large future builds use the configured cap');
}
for(const bad of [
 {...config,maxShards:0},
 {...config,maxShards:18},
 {...config,minShards:9,maxShards:8},
 {...config,tests:[...config.tests,config.tests[0]]},
 {...config,tests:[...config.tests,{file:'tests/../../unsafe.cjs',browsers:{chromium:10,webkit:10}}]}
]){
 assert.throws(()=>validateManifest(bad,{checkFiles:false}),
  'invalid manifest must fail safely');
}
console.log('SCALABLE BROWSER SCHEDULER PASS: deterministic coverage, 10–160 future suites, adjustable 2–8 shard growth, no duplicate/unsafe tasks');
