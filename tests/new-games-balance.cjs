/* Scoped regression: imported game ZIPs, stronger UFO collisions and matching scoop colours. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=process.env.GAME_BUILD_ROOT||path.resolve(__dirname,'..');
const games=path.join(root,'src/games');
globalThis.window={PartyCharacters:{
 activate(players){for(const p of players)p.active=true;},
 control(input={}){const x=Number(input.axisX)||0,y=Number(input.axisY)||0,m=Math.hypot(x,y);return m>1?{x:x/m,y:y/m}:{x,y};}
}};
const participants=(n,colors)=>Array.from({length:n},(_,i)=>({
 id:'p'+i,name:'P'+i,active:false,isBot:i>0,color:colors?.[i]||'#ff4477',
 input:{axisX:0,axisY:0,action:false}
}));
async function load(slug){
 const dir=path.join(games,slug);
 const m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
 assert.equal(m.enabled,true);assert.deepEqual(m.modes,['normal','board']);
 assert.deepEqual(m.legacyScripts,[]);assert.equal(m.players.max,12);
 const plugin=(await import(pathToFileURL(path.join(dir,'game.js')).href)).default;
 for(const k of ['setup','update','draw','hud','getResult'])assert.equal(typeof plugin[k],'function',slug+'.'+k);
 return plugin;
}
(async()=>{
 for(const slug of ['dino-panic','cowboy-crossfire']){
  const plugin=await load(slug);
  for(const n of [1,2,6,7,12]){
   const players=participants(n),round={phase:'playing',paused:false,dinoSeed:8317,crossfireSeed:8317};
   const state=plugin.setup(round,players);
   assert.ok(state&&players.every(p=>p.active),slug+' '+n+' setup');
   for(let t=0;t<120;t++)plugin.update(1/60,round,players);
   assert.equal(plugin.getResult(round,players).length,n,slug+' '+n+' results');
   for(const p of players)assert.ok(Number.isFinite(p.x+p.y),slug+' position');
  }
 }
 const ufo=await load('ufo-arena');
 assert.equal(ufo.config.impactMultiplier,1.25,'UFO collisions must dissipate energy rather than chain-accelerate');
 assert.ok(ufo.config.ufoRest>.75&&ufo.config.ufoRest<1,'restore springy single hits while conserving/dissipating energy');
 assert.ok(ufo.config.wallRest>.6,'ordinary walls should visibly bounce');
 assert.equal(ufo.config.spike.maxLiveFrac,.5);
 const up=participants(2),ur={phase:'playing',paused:false,ufoArenaSeed:20261110},us=ufo.setup(ur,up);
 assert.equal(us.zones.length,24,'small UFO arena should contain 24 spike holes');
 for(let t=0;t<102;t++)ufo.update(1/60,ur,up);
 const live=us.zones.filter(z=>z.state==='warn'||z.state==='active');
 assert.equal(live.length,12,'twelve of the twenty-four spike holes must deploy per wave');
 const scoop=await load('scoop-rush');
 const colors=['#12ab45','#d087ef','#a120ff','#4377cc','#ed6633','#278fba',
  '#d11277','#aabb23','#7a2b99','#01bef2','#c95321','#e78caf'];
 for(const n of [1,6,12]){
  const players=participants(n,colors),round={phase:'playing',paused:false,scoopRushSeed:1234},s=scoop.setup(round,players);
  for(const p of players)assert.equal(p.sr.flavor,p.color,'scoops must inherit player palette');
  assert.equal(s.scoops.length,n*5,'each player starts with five scoops');
  for(let tick=0;tick<240;tick++)scoop.update(1/120,round,players);
  for(const p of players)assert.ok(Number.isFinite(p.x+p.y));
 }
 // Ice-cream circles (including physics contacts) are now exactly 1.5x.
 // Verify seed-robust capacity/clearance in both arenas for all 1–12 seats.
 assert.equal(scoop.config.baseR,33,'scoop visual and collision base radii increase 50%');
 for(const n of Array.from({length:12},(_,i)=>i+1)){
  for(const seed of [11,1234,20261113]){
   const ps=participants(n,colors),round={phase:'playing',paused:false,scoopRushSeed:seed};
   const s=scoop.setup(round,ps);
   assert.equal(s.scoops.length,n*5,'full scoop capacity for '+n+' players');
   for(const sc of s.scoops){
    assert.equal(sc.r,33,'initial scoop render and hitbox must match');
    const b=s.world.bounds;
    assert.ok(sc.x>=b.x+sc.r-1e-5&&sc.x<=b.x+b.w-sc.r+1e-5);
    assert.ok(sc.y>=b.y+sc.r-1e-5&&sc.y<=b.y+b.h-sc.r+1e-5);
   }
   for(let i=0;i<s.scoops.length;i++)for(let j=0;j<i;j++){
    const a=s.scoops[i],b=s.scoops[j];
    assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=a.r+b.r-.01,
      'scaled scoops must never spawn overlapping ('+n+' players)');
   }
  }
 }
 // 5 bots must continue translating across the arena after the first few
 // merges. Repeated left/right steering near a scoop previously made them
 // rotate almost in place for the rest of the round.
 {
  const ps=participants(5,colors);for(const p of ps)p.isBot=true;
  const round={phase:'playing',paused:false,scoopRushSeed:20261113};
  const state=scoop.setup(round,ps);
  let last=ps.map(p=>({x:p.x,y:p.y})),windows=0;
  for(let tick=0;tick<2400&&!state.finished;tick++){
   scoop.update(1/120,round,ps);
   if((tick+1)%600===0){
    windows++;
    for(let i=0;i<ps.length;i++){
     assert.ok(Math.hypot(ps[i].x-last[i].x,ps[i].y-last[i].y)>20,
       'bot '+i+' must move over each 5-second interval, not orbit in place');
    }
    last=ps.map(p=>({x:p.x,y:p.y}));
   }
  }
  assert.equal(windows,4,'bots remain in active play through the 20s regression');
  assert.ok(state.merges>=8,'five bots must keep merging scoops after early rounds');
 }
 // Deterministic bot-only race: the new target commitment must actually
 // merge five scattered ice-cream balls, not just stop visibly spinning.
 {
  const player=participants(1,['#abc123'])[0];player.isBot=true;
  const round={phase:'playing',paused:false,scoopRushSeed:20261110};
  const state=scoop.setup(round,[player]);
  for(let tick=0;tick<3600&&!state.finished;tick++)scoop.update(1/120,round,[player]);
  assert.equal(state.finished,true,'solo AI must merge all five scoops within 30s');
  assert.ok(state.merges>=4,'bot must execute four real scoop merges');
  assert.equal(player.sr.flavor,'#abc123');
 }
 console.log('TWO NEW PARTY GAMES, UFO 12/24 SPIKES AND SCOOP COLOURS PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
