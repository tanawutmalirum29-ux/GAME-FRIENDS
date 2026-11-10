'use strict';
// All original roster layouts remain game-owned, while brand-new IDs use getRoster.
// This tests the real extracted Core renderer with a tiny DOM harness.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),games=path.join(root,'src/games');
const legacyData=fs.readFileSync(path.join(root,'src/app/core/legacy-game-defaults.js'),'utf8');
const source=fs.readFileSync(path.join(root,'src/app/rounds/render.js'),'utf8');
const section=source.slice(0,source.indexOf('\n// All minigame clocks'));
assert.match(section,/engine\.renderRoster\(root,active,round\)/,'Core must call the pinned engine hook');
assert.match(section,/engine\.getRoster\(round,active\)/,'new plugins need generic fallback');
let moved=0;
for(const folder of fs.readdirSync(games)){
 const manifestPath=path.join(games,folder,'manifest.json');
 if(!fs.existsSync(manifestPath))continue;
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 if(!manifest.global||!legacyData.includes('  "'+manifest.id+'": {'))continue; // Native plugins need not follow original renderer signature.
 const body=fs.readFileSync(path.join(games,folder,folder+'.js'),'utf8');
 assert.match(body,/function renderRoster\(root,active,round\)/,
  'Legacy game must own its custom roster: '+manifest.id);
 assert.ok(body.includes('renderRoster,'),'Engine must export its roster hook: '+manifest.id);
 assert.ok(!section.includes("round.mode==='"+manifest.id+"'"),
  'The shared live scoreboard must not branch on '+manifest.id);
 moved++;
}
assert.equal(moved,15,'All original games own live scoreboard presentation');

function element(){
 return {children:[],style:{setProperty(){}},classList:{add(){}},append(...nodes){this.children.push(...nodes);},
  replaceChildren(){this.children=[];},setAttribute(){}};
}
const board=element();
const players=[
 {id:'a',active:true,name:'Alpha',color:'#ffaa11',score:0},
 {id:'b',active:true,name:'Beta',color:'#00aa44',score:0}
];
const round={mode:'never_seen_game',pluginEngine:{
 getRoster(_round,ps){return ps.map(p=>({
  id:p.id,value:p.id==='b'?5:2,label:p.id==='b'?'5 points':'2 points',
  status:p.id==='b'?'Active':'Eliminated',eliminated:p.id==='a'
 }));}
}};
const context={round,players,$:()=>board,document:{createElement:element},gameEngine:()=>round.pluginEngine};
vm.runInNewContext(section+'\nrenderLeaderboard();',context);
assert.equal(board.children.length,2,'Unknown plugin draws both players');
assert.equal(board.children[0].children[1].textContent,'Beta','Live metric orders roster by score');
assert.equal(board.children[0].children[2].textContent,'5 points','Plugin-owned labels appear');
assert.equal(board.children[0].children[3].textContent,'Active','Plugin-owned status appears');
let called=0;
round.pluginEngine={renderRoster(root,active,r){called++;assert.equal(root,board);
 assert.equal(active.length,2);assert.equal(r,round);}};
vm.runInNewContext(section+'\nrenderLeaderboard();',context);
assert.equal(called,1,'Live HUD delegates to pinned engine without Core game IDs');
assert.equal(board.children.length,0,'Core does not override game-owned visuals');
console.log('PLUGIN ROSTER OWNERSHIP PASS: '+moved+' game-owned renderers, dynamic unknown ID, getRoster labels, engine hook');
