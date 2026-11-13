'use strict';
// Shared character contract. Run: node tests/character-system.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const context=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(root,'character-system.js'),'utf8'),
  context,{filename:'character-system.js'});
const rules=context.window.PartyCharacters;
assert.ok(rules&&rules.activate&&rules.control&&rules.move&&rules.resolve&&rules.draw);
assert.equal(rules.DEFAULTS.playersSolid,true,'solid is the global default');
const make=(id,x,y)=>({id,active:false,color:'#66ccff',name:String(id),x,y,
  vx:0,vy:0,input:{axisX:0,axisY:0}});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
{
 const a=make('a',200,200),b=make('b',201,200);
 rules.activate([a,b]);
 assert.equal(a.active,true);assert.equal(b.active,true);
 const result=rules.resolve([a,b]);
 assert.equal(result.enabled,true);
 assert.ok(result.contacts>0);
 assert.ok(distance(a,b)>29.99,'default resolution must separate overlapping players');
}
{
 const a=make('a',200,200),b=make('b',200,200);
 rules.activate([a,b]);
 rules.resolve([a,b],{iterations:8});
 assert.ok(Number.isFinite(a.x)&&Number.isFinite(b.x)&&Number.isFinite(a.y)&&Number.isFinite(b.y),
  'exact-overlap must not overflow coordinates');
 assert.ok(distance(a,b)>29.9,'identical positions must resolve deterministically');
}
{
 const a=make('a',200,200),b=make('b',205,200);
 rules.activate([a,b]);
 const before=distance(a,b);
 const disabled=rules.resolve([a,b],{playersSolid:false});
 assert.equal(disabled.enabled,false);
 assert.equal(distance(a,b),before,'pass-through needs an explicit override');
}
{
 const a=make('a',200,200),b=make('b',214,200);
 rules.activate([a,b]);
 a.vx=150;b.vx=0;
 rules.resolve([a,b],{iterations:1});
 assert.ok(b.x-214>200-a.x,
  'moving player should exert more pressure and push resting player');
}
{
 const a=make('a',24,50),b=make('b',25,50);
 rules.activate([a,b]);
 rules.resolve([a,b],{radius:14,bounds:{x:0,y:0,w:100,h:100},iterations:6});
 assert.ok(a.x>=14&&b.x>=14,'players stay inside rectangular map bounds');
}
{
 const a=make('a',50,50),b=make('b',55,50);
 rules.activate([a,b]);
 rules.resolve([a,b],{radius:14,iterations:3,
  constrain:(p,x,y)=>({x:Math.min(85,Math.max(15,x)),y:Math.min(85,Math.max(15,y))})});
 assert.ok(a.x>=15&&b.x<=85,'map-specific obstacle projection is preserved');
}
{
 const p=make('m',20,20);p.active=true;p.input={axisX:1,axisY:1};
 const v=rules.control(p.input);
 assert.ok(Math.abs(Math.hypot(v.x,v.y)-1)<1e-6,'input is normalized');
 rules.move(p,v,1/60,{speed:120,bounds:{x:0,y:0,w:100,h:100}});
 assert.ok(p.x>20&&p.y>20&&Number.isFinite(p.vx));
 assert.ok(p.dir&&p.face===1,'central move also initializes facing direction');
}
{
 const ctx={drawn:0,save(){},restore(){}};
 context.window.PartyPlayerAvatar={draw(c,p){c.drawn++}};
 rules.draw(ctx,make('m',20,20));
 assert.equal(ctx.drawn,1,'central character rendering delegates to the shared avatar');
}
// One nameplate per actor. A crowded label shifts above its neighbour rather
// than covering it, and no name is drawn while a parent mount is rotating.
{
 const painted=[],plates=[],outlines=[];
 const canvas={save(){},restore(){},beginPath(){},roundRect(x,y,w,h){plates.push({x,y,w,h});},
  rect(){},clip(){},fill(){},
  measureText(t){return{width:Array.from(t).length*7}},
  getTransform(){return{a:1,b:0,c:0,d:1,e:0,f:0}},
  fillText(...args){const [t,x,y]=args;painted.push({t,x,y,args,align:this.textAlign});},
  strokeText(...args){outlines.push(args);}};
 const a=make('a',180,200),b=make('b',180,200);
 a.name='ผู้เล่น A';b.name='บอท B';
 rules.beginNameFrame(canvas);
 rules.drawName(canvas,a);
 rules.drawName(canvas,b);
 assert.equal(painted.length,2,'every player gets a label');
 assert.ok(painted.every(q=>q.y<a.y-30),'labels sit above the character, not on its body');
 assert.notEqual(painted[0].y,painted[1].y,'crowded labels never overlap one another');
 // A screenshot on iPad Safari exposed text beginning at the plate centre.
 // Explicit text-left placement keeps Thai glyphs INSIDE the black rounded box
 // irrespective of the browser's textAlign/maxWidth behaviour.
 for(let i=0;i<painted.length;i++){
  const text=painted[i],plate=plates[i],glyphWidth=canvas.measureText(text.t).width;
  assert.equal(text.align,'left','do not depend on Safari centred text anchors');
  assert.equal(text.args.length,3,'never pass maxWidth to fillText on iPad');
  assert.equal(outlines[i].length,3,'stroke and fill use identical arguments');
  assert.equal(outlines[i][1],text.x,'text stroke is not offset from fill');
  assert.ok(text.x>=plate.x+4,'label starts INSIDE its background');
  assert.ok(text.x+glyphWidth<=plate.x+plate.w-4,'label ends INSIDE its background');
  assert.ok(Math.abs(text.x+glyphWidth/2-(plate.x+plate.w/2))<1e-9,
   'glyph centre matches the rectangle centre exactly');
 }
 assert.equal(painted[0].t,'ผู้เล่น A','Thai name text is preserved');
 rules.beginNameFrame(canvas);painted.length=0;
 rules.drawName(canvas,a,{nameTag:false});
 assert.equal(painted.length,0,'specific game HUD can suppress a redundant label');
}
// All shipped modes must explicitly invoke the shared physics resolver; no
// minigame should silently replace the global default with pass-through.
for(const filename of ['src/games/ghost-attack/ghost-attack.js','src/games/chickens/chickens.js','src/games/fruit-memory/fruit-memory.js',
 'src/games/shockwave/shockwave.js','src/games/color-switch/color-switch.js','src/games/pizza-time/pizza-time.js']){
 const text=fs.readFileSync(path.join(root,filename),'utf8');
 assert.match(text,/window\.PartyCharacters\.resolve\(/,filename+' must use the central rule');
 assert.doesNotMatch(text,/playersSolid\s*:\s*false/,filename+' cannot disable collisions without an approved rule');
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const assets=fs.readFileSync(path.join(root,'scripts/build-static.cjs'),'utf8');
assert.ok(html.indexOf('src="./character-system.js"')>html.indexOf('src="./player-avatar.js"'));
assert.doesNotMatch(html,/src="\.\/src\/games\//,'game engine must load lazily after shared character core');
assert.match(assets,/const deployAsset=/,'build must auto-version all HTML references');
console.log('Shared character system PASS: solid default, pushing, exact overlaps, bounds, input, avatar and all 6 maps');
