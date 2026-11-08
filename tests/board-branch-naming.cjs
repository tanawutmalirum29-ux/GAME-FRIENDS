'use strict';
const assert=require('node:assert/strict');
const {alphabet,assign}=require('../board-branch-naming.js');
assert.deepEqual([0,1,25,26,27,51,52].map(alphabet),['a','b','z','aa','ab','az','ba']);
const records=[
 {internalId:'root-b',parentId:'n',sourceOrder:20,nodeIds:['b1'],terminalBranchId:'n'},
 {internalId:'deep',parentId:'child-first',sourceOrder:2,nodeIds:['z1'],terminalBranchId:'n'},
 {internalId:'child-second',parentId:'root-a',sourceOrder:7,nodeIds:['q1'],terminalBranchId:'root-b'},
 {internalId:'root-a',parentId:'n',sourceOrder:10,nodeIds:['a1'],terminalBranchId:'n'},
 {internalId:'child-first',parentId:'root-a',sourceOrder:2,nodeIds:['p1'],terminalBranchId:'root-a'}
];
const labels=x=>Object.fromEntries(x.mapping.map(v=>[v.internalId,v.displayId]));
const basic=assign(records);
assert.deepEqual(labels(basic),{b1:'b_0',z1:'aaa_0',q1:'abb_0',a1:'a_0',p1:'aa_0'});
assert.equal(basic.collisions.length,0);
const moved=assign(records.map(x=>({...x,terminalBranchId:
 x.internalId==='root-a'||x.internalId==='child-first'?'root-b':x.terminalBranchId})));
assert.equal(labels(moved).a1,'ab_0');
assert.equal(labels(moved).p1,'aab_0');
assert.equal(labels(moved).q1,'abb_0');
assert.equal(labels(moved).z1,'aaa_0');
const conflict=assign(records.map(x=>({...x,terminalBranchId:
 x.internalId==='root-a'?'root-b':x.internalId==='child-second'?'n':x.terminalBranchId})));
assert.deepEqual(conflict.collisions.map(x=>x.displayId),['ab_0']);
assert.equal(conflict.collisions[0].internalIds.length,2);
assert.deepEqual(assign([...records].reverse()).mapping,assign(records).mapping);
assert.throws(()=>assign([...records,records[0]]),/Duplicate/);
assert.throws(()=>assign([{internalId:'x',sourceOrder:0,parentId:'x',nodeIds:['x1']}]),/cyclic|Unreachable/i);
assert.throws(()=>assign([{internalId:'x',sourceOrder:0,nodeIds:['x1']},
 {internalId:'y',sourceOrder:0,nodeIds:['y1']}]),/Ambiguous branch order/);
console.log('BOARD branch naming PASS');
