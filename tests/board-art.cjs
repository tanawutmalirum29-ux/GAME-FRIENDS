'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const surfaces=[],labels=[];let denyTerrain=false;
function brush(main=false){return new Proxy({globalAlpha:1},{get(target,key){
 if(key in target)return target[key];
 if(key==='createLinearGradient')return()=>({addColorStop(){}});
 if(key==='fillText')return text=>{if(main)labels.push(text);};
 return()=>{};
},set(target,key,value){target[key]=value;return true;}});}
const ctx=vm.createContext({window:{PartyPlayerAvatar:{draw(){},costumeFor(){return 'crown';}}},console,document:{createElement(tag){
 assert.equal(tag,'canvas');const surface={width:0,height:0,getContext(){
  assert.ok(this.width*this.height<=3500000,'terrain allocation stays below the mobile budget');
  return denyTerrain?null:brush();
 }};surfaces.push(surface);return surface;
}}});
for(const name of ['board-map','board-dice','board-items','board-minigame','board-party','board-art'])vm.runInContext(fs.readFileSync(name+'.js','utf8'),ctx,{filename:name+'.js'});
const {BoardParty:P,BoardArt:A}=ctx.window,g=brush(true);
function game(seed){return P.create(Array.from({length:12},(_,i)=>({id:'p'+i,name:'Player '+i,color:'#66aacc'})),{seed});}
const s=game(1);A.draw(g,0,s);assert.equal(surfaces.length,0,'initial order screen does not allocate the world');assert.ok(labels.includes('ทอยลูกเต๋าเพื่อจัดลำดับ'));
s.order=s.players.map(p=>p.id);P.startTurn(s);A.draw(g,0,s);assert.equal(surfaces.length,1);const old=surfaces[0];
assert.ok(old.width*old.height>1000000);const snapshot=JSON.stringify(s.players);
for(let i=0;i<60;i++)A.draw(g,i/60,s);assert.equal(surfaces.length,1,'terrain is reused');assert.equal(JSON.stringify(s.players),snapshot);
const t=game(2);t.order=t.players.map(p=>p.id);P.startTurn(t);denyTerrain=true;A.draw(g,0,t);
assert.equal(old.width,1);assert.equal(old.height,1,'previous match pixels are released');assert.equal(surfaces.length,2);
assert.equal(surfaces[1].width,1,'failed allocation is released too');assert.ok(labels.includes('A • ทอยลูกเต๋า'));
for(let i=0;i<10;i++)A.draw(g,i,t);assert.equal(surfaces.length,2,'allocation failure falls back without a retry loop');
console.log('BOARD ART PASS: immediate order screen, bounded/reused terrain, replay release and null-context vector fallback');
