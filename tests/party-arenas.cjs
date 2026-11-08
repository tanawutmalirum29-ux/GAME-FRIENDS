/* Shared scene geometry, original SVG covers and actual 1–12-player rounds. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Image {
 constructor(){this.complete=true;this.naturalWidth=160;}
 set src(value){this.markup=decodeURIComponent(value.split(',').slice(1).join(','));}
}
const ctx=vm.createContext({window:{},Image,console});
for(const file of ['character-system.js','party-arena-scenes.js','game-cover-art.js','shopping-time.js','knight-match.js','witching-snake.js'])
 vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
const {PartyArenaScenes:art,PartyGameCovers:covers,ShoppingTime:shopping,KnightMatch:knight,WitchingSnake:witch}=ctx.window;
const colors=['#f44336','#36b7e3','#f2cc35','#57c542','#b685dc','#f1904a','#60c6b3','#eb87a5','#99b9f7','#d9df7f','#ba9c7f','#ed8e6d'];
const roster=n=>Array.from({length:n},(_,i)=>({id:'p'+i,color:colors[i],input:{},isBot:true,active:true}));
const close=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-8,message||`${a} != ${b}`);
function paint(){
 let m=[1,0,0,1,0,0],stack=[];
 const points=[],images=[],texts=[];
 const world=(x,y)=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
 const g=new Proxy({
  save(){stack.push(m.slice());},restore(){m=stack.pop();},
  translate(x,y){const p=world(x,y);m[4]=p.x;m[5]=p.y;},
  scale(x,y){m[0]*=x;m[1]*=x;m[2]*=y;m[3]*=y;},
  rotate(a){const [aa,b,c,d]=m,co=Math.cos(a),si=Math.sin(a);m[0]=aa*co+c*si;m[1]=b*co+d*si;m[2]=c*co-aa*si;m[3]=d*co-b*si;},
  getTransform(){return {a:m[0],b:m[1],c:m[2],d:m[3],e:m[4],f:m[5]};},
  moveTo(x,y){points.push(world(x,y));},lineTo(x,y){points.push(world(x,y));},
  drawImage(image,x,y,w,h){images.push({markup:image.markup,center:world(x+w/2,y+h/2),matrix:m.slice(),x,y,w,h});},
  fillText(t){texts.push(t);},
  createLinearGradient(){return {addColorStop(){}};},createRadialGradient(){return {addColorStop(){}};}
 },{get(o,k){return k in o?o[k]:()=>{};},set(o,k,v){o[k]=v;return true;}});
 return {g,points,images,texts};
}
const html=fs.readFileSync('index.html','utf8');
const modes=[...html.matchAll(/data-pick="([^"]+)"/g)].map(m=>m[1]);
assert.equal(covers.ids.length,13);
assert.deepEqual([...covers.ids].sort(),[...new Set(modes)].sort());
const allIDs=new Set();
for(let copy=0;copy<3;copy++)for(const mode of covers.ids){
 const svg=covers.svg(mode);
 assert.match(svg,/<svg[^>]*width="320" height="180"[^>]*viewBox="0 0 320 180"/);
 assert.doesNotMatch(svg,/<(?:text|tspan|image|script|foreignObject)\b|\son\w+=|(?:href|src)=/i);
 const ids=[...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,'no duplicate gradients inside '+mode);
 for(const id of ids){assert.equal(allIDs.has(id),false,'each card owns its SVG IDs');allIDs.add(id);}
 for(const ref of svg.matchAll(/url\(#([^)]+)\)/g))assert.ok(ids.includes(ref[1]),'resolved gradient/clip in '+mode);
 assert.ok(svg.length>4500,'complete scene illustration '+mode);
}
assert.equal(covers.svg('__proto__'),'');assert.equal(covers.svg('missing'),'');
assert.ok(html.indexOf('party-arena-scenes.js')<html.indexOf('game-cover-art.js'));
assert.ok(html.indexOf('game-cover-art.js')<html.indexOf('./app.js'));
console.log('PASS 13 original text-free covers, complete paths and isolated IDs across repeated cards');

for(let n=1;n<=12;n++){
 const ps=roster(n),round={phase:'playing',shoppingSeed:101},s=shopping.setup(round,ps),u=s.unit;
 close(s.actorScale/u,1.08);close(s.metrics.cartDistance/u,34);close(s.metrics.conveyorSpeed/u,65);
 close((s.beltRight-s.beltLeft)/u,277);
 for(const z of s.checkouts){
  assert.ok((z.cashier.x/u)-26.5>0&&(z.cashier.x/u)+26.5<960,'cashier fits at '+n+' players');
  assert.ok(z.counter.x+z.counter.w<=s.arena.x||z.counter.x>=s.arena.x+s.arena.w,'counter is outside walking area');
  const p=ps[0],q=p.shopping;q.cartX=z.x;q.cartY=z.y;q.basket=['apple','milk'];
  const before=p.score;assert.equal(shopping.checkoutPlayer(s,p),true);assert.equal(p.score,before+2);
  assert.equal(shopping.checkoutPlayer(s,p),false,'cannot pay twice for same groceries');
 }
 for(const p of ps){
  p.isBot=false;p.input={axisX:p.x<s.world.w/2?-1:1,axisY:0};
 }
 s.objects=[];s.lanes.forEach(l=>l.nextSpawn=999);
 for(let i=0;i<240;i++)shopping.step(1/60,round,ps);
 for(const p of ps){
  assert.ok(p.x>=s.arena.x+s.metrics.playerRadius-1e-6&&p.x<=s.arena.x+s.arena.w-s.metrics.playerRadius+1e-6);
  assert.ok(p.shopping.cartX>=s.arena.x+s.metrics.cartRadius-1e-6&&p.shopping.cartX<=s.arena.x+s.arena.w-s.metrics.cartRadius+1e-6);
 }
 const p=ps[0];p.shopping.basket=['banana','milk','apple'];
 for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  p.shopping.angle=angle;const trace=paint();art.shoppingCart(trace.g,s,p);
  const groceries=trace.images.map(i=>i.markup.match(/data-product="([^"]+)"/)?.[1]).filter(Boolean);
  assert.deepEqual(groceries,['banana','milk','apple'],'cart displays actual held product identities');
  const cart=trace.images.find(i=>i.markup.includes('data-prop="shopping-cart"'));
  const localX=cart.x+32/64*cart.w,localY=cart.y+28/76*cart.h;
  close(cart.matrix[0]*localX+cart.matrix[2]*localY+cart.matrix[4],p.shopping.cartX,'basket visual center matches hit circle');
  close(cart.matrix[1]*localX+cart.matrix[3]*localY+cart.matrix[5],p.shopping.cartY);
 }
}
console.log('PASS 1–12 market bounds, reachable cashiers, stable display scale and four-direction real basket contents');

for(const angle of [0,.7,Math.PI,-2.5]){
 const ps=roster(1),round={phase:'playing',knightSeed:52};knight.setup(round,ps);
 const s=round.knightMatch,p=ps[0];p.isBot=false;p.input={};p.km.angle=angle;s.balloons=[];
 knight.startAttack(s,p);
 for(let tick=0;tick<12;tick++){
  knight.step(1/60,round,ps);const trace=paint();art.knightHorse(trace.g,s,p,knight.scales.rider,p.km.visualExtension);
  assert.ok(trace.points.some(pt=>Math.hypot(pt.x-p.km.tip.x,pt.y-p.km.tip.y)<1e-7),'drawn silver tip equals the last authoritative swept tip, even after timer decrement');
 }
}
console.log('PASS visible lance tip matches the actual swept collision through each attack frame');

for(const [name,engine,key] of [['knight',knight,'knightMatch'],['witch',witch,'witchingSnake']]){
 for(let n=1;n<=12;n++){
  const ps=roster(n),round={phase:'playing',knightSeed:200+n,witchSeed:200+n};engine.setup(round,ps);
  const s=round[key];assert.ok(s,'valid round state '+key);
  for(let tick=0;tick<60*200&&!s.finished;tick++)engine.step(1/60,round,ps);
  assert.ok(s.finished,`${name} ${n} bots finish`);assert.equal(s.ranking.length,n);
  assert.ok(ps.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  const snapshot=JSON.stringify({s,ps},(_k,v)=>v instanceof Map?[...v]:v),trace=paint();
  engine.draw(trace.g,1.2,round,ps);engine.draw(trace.g,9.5,round,ps);
  assert.equal(JSON.stringify({s,ps},(_k,v)=>v instanceof Map?[...v]:v),snapshot,'draw leaves simulation and RNG untouched');
 }
 console.log(`PASS ${name} 1–12 bots finish and scene painting does not alter simulation`);
}
