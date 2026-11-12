'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=path.join(__dirname,'..','src','games','color-claim');
const ctx=vm.createContext({window:{},console,Math,Float32Array,Float64Array,Int16Array,Uint8Array});
for(const name of ['territory-geometry.js','color-claim.js'])vm.runInContext(fs.readFileSync(path.join(src,name),'utf8'),ctx,{filename:name});
const G=ctx.window.ColorClaimGeometry,E=ctx.window.ColorClaim;
const checks=[],check=(name,run)=>checks.push({name,run});
const rect=(x,y,w,h)=>[x,y,x+w,y,x+w,y+h,x,y+h];
const region=(r)=>G.makeRegion([r]);
const make=(n=2,bots=false)=>{
 const ps=Array.from({length:n},(_,i)=>({id:'p'+i,name:'Player '+i,color:'#ff3366',isBot:bots,active:true,input:{axisX:0,axisY:0}}));
 const round={mode:'color_claim',phase:'playing',paused:false,colorClaimSeed:152991};
 const s=E.setup(round,ps);
 return{ps,round,s};
};
const points=list=>list.map((p,i)=>({x:p[0],y:p[1],d:i}));
const tick=(z,n)=>{for(let i=0;i<n;i++)E.step(1/60,z.round,z.ps)};
check('game plugin loads geometry before engine and exposes one entry',()=>{
 const entry=fs.readFileSync(path.join(src,'game.js'),'utf8');
 const geo=entry.indexOf("import './territory-geometry.js'"),engine=entry.indexOf("import './color-claim.js'");
 assert.ok(geo>=0&&engine>geo,'geometry must be loaded before ColorClaim engine');
 assert.ok(entry.includes('export default engine;'));
});
check('non-grid closed gameplay trail captures its physical interior and clears trail',()=>{
 const z=make(1),p=z.ps[0],s=z.s,x=p.x,y=p.y;
 const before=s.areas[0];
 p.cc.trail=points([[x,y],[x+95.3,y],[x+100.2,y+67.5],[x+0.1,y+67.5],[x,y]]);
 E.applyCaptures(s,[p],z.ps);
 assert.ok(s.areas[0]>before+5000,'closed polygon must gain its enclosed world-space area');
 assert.equal(p.cc.trail.length,0);
 assert.ok(s.terr[0].rings.some(r=>[...r].some(v=>v%10!==0)),'boundary has fractional vertices');
 const scored=s.areas[0]/(s.field.w*s.field.h)*100;
 assert.ok(Math.abs(p.score-scored)<1e-6);
});
check('hole topology is kept instead of pixel-fill flattening',()=>{
 const outer=rect(0.3,0.2,100.6,90.4),hole=rect(38.25,30.75,12.25,12.25);
 const rings=G.combine([[outer],[hole]],w=>w[0]!==0&&w[1]===0);
 const R=G.makeRegion(rings);
 assert.ok(R.area<100.6*90.4&&R.area>8900);
 assert.equal(G.inside(R,44,35),false);
 assert.equal(G.inside(R,22,22),true);
});
check('kernel polygon exact area and ownership without 10px rasterization',()=>{
 const A=rect(1.21,2.43,26.7,40.4),B=rect(22.3,11.35,15.1,26.1);
 const r=G.combine([ [A], [B] ],w=>w[0]!==0||w[1]!==0);
 assert.ok(r?.length>0);
 const R=G.makeRegion(r);assert.ok(R.area>1000&&R.area<1600);
 assert.ok(G.inside(R,1.9,3.1));assert.ok(G.inside(R,36.6,12.5));assert.equal(G.inside(R,45,50),false);
 const d=G.combine([[A],[B]],w=>w[0]!==0&&w[1]===0);
 assert.ok(G.makeRegion(d).area<G.makeRegion([A]).area);
 const diag=G.makeRegion([[1.12,1.53,37.61,4.64,37.14,12.28,1.12,5.03]]);
 assert.ok([...diag.rings[0]].some(x=>x%10!==0));
});
check('all tiers spawn in bounds, nonoverlapping, equal starting area',()=>{
 for(const n of Array.from({length:12},(_,i)=>i+1)){
  const z=make(n),s=z.s;
  assert.equal(s.w,n<=6?960:1280);assert.equal(s.h,n<=6?540:720);
  assert.equal(z.round.remaining,n<=6?40:60);
  assert.equal(new Set(z.ps.map(p=>p.cc.slot)).size,n);
  assert.ok(z.ps.every(p=>E.owned(s,p,p.x,p.y)));
  assert.ok(z.ps.every(p=>p.x>s.field.x&&p.x<s.field.x+s.field.w));
  assert.ok(s.terr.every(t=>t.area>0));
  assert.ok(Math.max(...s.areas)-Math.min(...s.areas)<1,'equal starts');
  assert.ok(z.ps.reduce((x,p)=>x+p.score,0)<=100.000001);
 }
});
check('claimDisk transfers true-area ownership without overlap and scores in px2',()=>{
 const z=make(2),[a,b]=z.ps,s=z.s;
 s.terr[0]=region(rect(120.2,120.1,30.2,30.3));
 s.terr[1]=region(rect(150.4,120.1,30.3,30.3));
 a.x=130;a.y=132;b.x=170;b.y=132;
 E.recount(s,z.ps);
 const oldA=s.terr[0].area,oldB=s.terr[1].area;
 E.claimDisk(s,0,150.5,135.2,12.3);E.recount(s,z.ps);
 assert.ok(s.terr[0].area>oldA);
 assert.ok(s.terr[1].area<oldB);
 assert.equal(E.ownerAt(s,153,133),0);
 assert.ok(!G.inside(s.terr[1],153,133));
 assert.ok(Math.abs(a.score-s.areas[0]/(s.field.w*s.field.h)*100)<1e-8);
 assert.ok(z.ps.reduce((sum,p)=>sum+p.score,0)<=100.0001);
});
check('derived owner raster is not used to authorize territory',()=>{
 const z=make(1);const {s,ps}=z;
 const before=s.terr[0].area,point={x:44.7,y:39.1};
 const owner=s.owner;owner.fill(0);
 assert.equal(s.terr[0].area,before);
 assert.equal(E.owned(s,ps[0],point.x,point.y),G.inside(s.terr[0],point.x,point.y));
});
check('connected components retain largest without deleting thin real geometry',()=>{
 const big=rect(35.24,47.13,92.75,34.25),small=rect(260.5,100.3,15.6,15.4);
 const parts=G.splitParts([big,small]);
 assert.equal(parts.length,2);
 const max=parts.reduce((a,b)=>a.area>b.area?a:b);
 assert.ok(Math.abs(max.area-92.75*34.25)<1);
 const thin=region(rect(11.25,22.75,2.34,140.56));
 assert.ok(thin.area>300&&G.inside(thin,12,100));
});
check('open unclosed trail never gives credit',()=>{
 const z=make(1);let v=z.s.areas[0];
 const p=z.ps[0];p.cc.trail=points([[p.x,p.y],[p.x+91.33,p.y+3.4],[p.x+118.5,p.y+83.2]]);
 E.recount(z.s,z.ps);assert.equal(z.s.areas[0],v);
});
check('same-cell fractional boundaries and cuts are captured as geometry',()=>{
 const a=region(rect(10.2,10.1,64.15,56.12)),b=region(rect(40.44,19.93,19.5,12.2));
 assert.ok(a.area>0&&b.area>0);
 const cut=G.combine([a.rings,b.rings],w=>w[0]!==0&&w[1]===0);
 const reduced=G.makeRegion(cut).area;
 assert.ok(reduced<a.area-220&&reduced>a.area-270);
 const sample=G.makeRegion(cut);
 assert.equal(G.inside(sample,42,22),false);
 assert.equal(G.inside(sample,62,43),true);
});
check('draw and scoring use continuous polygon vertices, not raster source',()=>{
 const z=make(2),s=z.s;
 const g=new Proxy({getTransform:()=>({a:1,b:0}),quadraticCurveTo(){},fillRect(){}},{get(target,key){return key in target?target[key]:()=>{}},set(){return true}});
 E.draw(g,0,z.round,z.ps);
 const first=s.geoVersion;
 E.claimDisk(s,0,z.ps[0].x+28.15,z.ps[0].y+2,17.34);
 E.recount(s,z.ps);E.draw(g,0,z.round,z.ps);
 assert.ok(s.geoVersion>first);
 assert.ok(s.terr[0].rings.some(r=>[...r].some(v=>v%10!==0)));
});
check('freeze starts and ends, and timed match produces a rank for each player',()=>{
 const z=make(2),[a,b]=z.ps,s=z.s;
 s.nextItem=999;s.item={x:a.x,y:a.y};tick(z,1);
 assert.equal(s.freeze.ownerId,a.id);
 let oldX=b.x;b.input.axisX=1;tick(z,120);assert.equal(b.x,oldX);
 tick(z,122);assert.equal(s.freeze,null);tick(z,3);assert.ok(b.x>oldX);
 E.finish(s,z.round,z.ps);assert.equal(s.finished,true);
 assert.equal(s.ranking.length,2);
 assert.ok(E.getResult(z.round,z.ps).length===2);
});
check('bots simulate full 40/60 second rounds without NaN or more than 100% land',()=>{
 for(const n of [1,5,7,12]){
  const z=make(n,true),s=z.s;
  let steps=0;
  while(!s.finished&&steps<s.duration*60+3){E.step(1/60,z.round,z.ps);steps++}
  assert.ok(s.finished,'bots should reach timeout n='+n);
  assert.equal(s.ranking.length,n);
  assert.ok(z.ps.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.score)));
  assert.ok(z.ps.reduce((sum,p)=>sum+p.score,0)<=100.00001);
 }
});
let passed=0;
for(const t of checks)try{t.run();passed++;console.log('PASS '+t.name)}catch(e){console.error('FAIL '+t.name,e);process.exitCode=1}
console.log(passed+'/'+checks.length+' COLOR CLAIM Polygon checks passed');
