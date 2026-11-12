'use strict';
/* Wardrobe regression: real asset paths, color binding, render mounts and
 * one-press-per-change behavior without requiring a browser download. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const catalog=JSON.parse(read('assets/cosmetics/wardrobe-assets.json'));
class FakeImage{
 constructor(){this.complete=false;this.naturalWidth=0;}
 set src(value){this._src=value;this.complete=true;this.naturalWidth=64;}
 get src(){return this._src;}
}
const scope=vm.createContext({window:{},Image:FakeImage,Math,console});
vm.runInContext(read('cosmetic-system.js'),scope,{filename:'cosmetic-system.js'});
const C=scope.window.PartyCosmetics;
assert.deepEqual(Array.from(C.IDS),catalog.cycle,'catalog and runtime use the same order');
assert.equal(C.next('paper-bag-mask'),'none','wardrobe cycles back to no outfit');
assert.equal(C.next('none'),'white-rope-wrap');
assert.equal(C.next('bad-value'),'white-rope-wrap','invalid persisted values cannot load paths');
assert.equal(C.randomBot(()=>0),'white-rope-wrap');
assert.equal(C.randomBot(()=>.999999),'paper-bag-mask');
assert.ok(!Array.from({length:100},(_,i)=>C.randomBot(()=>i/100)).includes('none'),
 'every freshly spawned bot receives a random visible outfit');
const colors=[
 'c62222','36d9e5','215a94','d7b000','f53695','f57a00',
 '36d595','000094','009400','b800f5','008484','94004a'
];
const imageCalls=[];
const ctx={drawImage:(image,...args)=>imageCalls.push({src:image.src,args})};
for(const item of catalog.items.filter(x=>x.id!=='none')){
 const data=JSON.parse(read('assets/cosmetics/'+item.id+'/asset.json'));
 assert.equal(data.id,item.id);
 const spec=C.ASSETS[item.id];
 assert.ok(spec,'known runtime overlay for '+item.id);
 for(const [view,projection] of [['front',data.projections.front],['top',data.projections.topDown]]){
  const mainFile='assets/cosmetics/'+item.id+'/'+projection.file;
  assert.ok(fs.existsSync(path.join(__dirname,'..',mainFile)),mainFile);
  const svg=read(mainFile);
  assert.match(svg,/<svg\s/);
  assert.doesNotMatch(svg,/<script\s|<foreignObject\s|\bonload\s*=/i);
  const p={cosmetic:item.id,color:'#36d9e5'};
  const before=imageCalls.length;
  if(view==='top')assert.equal(C.drawTop(ctx,p),true);
  else assert.equal(C.drawFront(ctx,p,200,100,96),true);
  assert.equal(imageCalls.length,before+1,'selected outfit rendered');
  const draw=imageCalls.at(-1);
  assert.equal(draw.args.length,4,'overlay uses authored padded viewBox');
  if(view==='front')assert.deepEqual(draw.args,
   [200+spec.front[0],100+spec.front[1],spec.front[2],spec.front[3]]);
  else assert.deepEqual(draw.args,Array.from(spec.top));
  if(spec.color){
   for(const color of colors){
    const file='assets/cosmetics/'+item.id+'/colors/'+view+'-'+color+'.svg';
    assert.ok(fs.existsSync(path.join(__dirname,'..',file)),file);
   }
   assert.ok(draw.src.endsWith('/colors/'+view+'-36d9e5.svg'));
  }else assert.ok(draw.src.endsWith('/'+projection.file));
 }
}
assert.equal(C.drawTop(ctx,{cosmetic:'none',color:'#c62222'}),false);
assert.equal(C.drawTop(ctx,{cosmetic:'../../../attack',color:'#c62222'}),false);
vm.runInContext(read('player-avatar.js'),scope,{filename:'player-avatar.js'});
const calls=[];
const canvas=new Proxy({},{
 get(target,key){
  if(key==='drawImage')return(img,...rect)=>calls.push({src:img.src,rect});
  if(key==='createRadialGradient'||key==='createLinearGradient')return()=>({addColorStop(){}});
  return target[key]??(()=>{});
 },
 set(target,key,value){target[key]=value;return true;}
});
const player={id:'p1',name:'P1',cosmetic:'pirate-hat',color:'#36d9e5',
 x:100,y:200,dir:{x:0,y:-1},vx:0,vy:0};
scope.window.PartyPlayerAvatar.draw(canvas,player,{label:false});
assert.ok(calls.some(c=>c.src.endsWith('pirate-hat/colors/top-36d9e5.svg')),
 'overhead renderer composites player outfit after the body');
calls.length=0;
scope.window.PartyPlayerAvatar.drawFront(canvas,player,120,90,60);
assert.ok(calls.some(c=>c.src.endsWith('pirate-hat/colors/front-36d9e5.svg')),
 'BOARD/lobby portrait renderer composites the same outfit');
const host=read('app.js'),plaza=read('src/lobby/party-plaza.js');
assert.match(host,/p\.cosmetic=cosmetics\.next\(p\.cosmetic\)/);
assert.match(host,/cosmetic:type==='local'\?\(window\.PartyCosmetics\?\.randomBot/);
assert.match(host,/bp\.cosmetic=window\.PartyCosmetics/);
assert.match(plaza,/if\(b&&!p\.plazaBPressed\)/);
assert.match(plaza,/zone\?\.id==='wardrobe'/);
assert.match(plaza,/callbacks\.changeCosmetic\?\.\(p\)/);
assert.match(plaza,/p\.plazaBPressed=b/);
console.log('COSMETICS PASS: catalog, 120 variants, outfit scaling, portrait/overhead, B edge, bot and BOARD sync');
