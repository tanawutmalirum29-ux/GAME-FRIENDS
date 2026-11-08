'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=name=>fs.readFileSync(new URL('../'+name,'file://'+__filename),'utf8');
const artCode=read('farm-ice-art.js');

test('all three ice/farm games choose full-width HOST rendering',()=>{
 const expected=[
  ['boulder-bash.js',/FarmIceArt\.beginScene\(g,'#d3f2ee',\{fullWidth:true\}\)/],
  ['chickens.js',/FarmIceArt\.beginScene\(ctx,'#91c631',\{fullWidth:true\}\)/],
  ['snow-brawl.js',/FarmIceArt\.beginScene\(ctx,'#1165c8',\{fullWidth:true\}\)/]
 ];
 for(const [path,re] of expected)assert.match(read(path),re,path);
});

test('HOST viewport occupies horizontal edges while preserving vertical HUD clearance',()=>{
 const canvas={};
 const doc={getElementById:id=>id==='arena'?canvas:null};
 const window={PartyArenaScenes:{badgeBottomY:()=>60}};
 const vmContext={window,document:doc};
 vm.runInNewContext(artCode,vmContext,{filename:'farm-ice-art.js'});
 const art=window.FarmIceArt;
 const moves=[];
 const ctx={canvas,
  clearRect(){},fillRect(){},
  translate(x,y){moves.push(['translate',x,y]);},
  scale(x,y){moves.push(['scale',x,y]);}
 };
 const y=66,scale=(540-y)/540;
 for(const mode of ['BOULDER BASH','CHICKENS','SNOW BRAWL']){
  moves.length=0;
  art.beginScene(ctx,'#ffffff',{fullWidth:true});
  assert.equal(moves.length,2,mode+' has one translate and scale');
  assert.deepEqual(moves[0],['translate',0,y],mode+' starts at the screen left');
  assert.deepEqual(moves[1],['scale',1,scale],mode+' fills x=0..960 exactly');
 }
 // Other game scenes preserve their old, uniform letterboxed view.
 moves.length=0;
 art.beginScene(ctx,'#ffffff');
 assert.deepEqual(moves[0],['translate',(960-960*scale)/2,y]);
 assert.deepEqual(moves[1],['scale',scale,scale]);
 // Gallery or offline rendering has no host-player HUD, so the transform
 // is a complete identity: no artificial padding or letterbox is applied.
 const gallery={clearRect(){},fillRect(){},translate(){throw Error('gallery translate');},
  scale(){throw Error('gallery scale');}};
 art.beginScene(gallery,'#ffffff',{fullWidth:true});
});

test('BOULDER BASH ice and bank backdrop has no internal vertical left wall',()=>{
 const s=read('farm-ice-art.js');
 const begin=s.indexOf('function paintBoulder(g,s){');
 const end=s.indexOf('function boulder(g,s){',begin);
 assert.ok(begin>=0&&end>begin);
 const painter=s.slice(begin,end);
 assert.match(painter,/g\.fillRect\(0,0,960,540\)/);
 assert.match(painter,/g\.fillRect\(0,0,960,top\)/);
 assert.match(painter,/g\.fillRect\(0,bottom,960,540-bottom\)/);
 assert.doesNotMatch(painter,/Green shoulder|line\(g,\{x:left,y:top\}/,
  'old green shoulder and visible inner left wall are removed');
});
