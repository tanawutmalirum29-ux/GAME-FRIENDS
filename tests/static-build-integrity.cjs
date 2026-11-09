'use strict';
// Run the actual production builder in an isolated fresh checkout snapshot.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const target=fs.mkdtempSync(path.join(os.tmpdir(),'gf-static-fresh-'));
const version='f'.repeat(40);
try{
 fs.cpSync(root,target,{recursive:true,filter:source=>{
  const parts=path.relative(root,source).split(path.sep);
  return !parts.some(part=>['.git','node_modules','game-assets'].includes(part));
 }});
 for(const file of ['board-v7-design.js','board-v7-art.js','game-catalog.json'])
  fs.rmSync(path.join(target,file),{force:true});
 execFileSync(process.execPath,['scripts/build-static.cjs'],{
  cwd:target,env:{...process.env,GAME_BUILD_ROOT:target,AWS_COMMIT_ID:version},
  encoding:'utf8',stdio:['ignore','pipe','pipe']
 });
 const exists=file=>assert.ok(fs.statSync(path.join(target,file)).isFile(),
  'static deploy missing file: '+file);
 for(const file of ['index.html','version.json','build-version.js',
  'app.js','app-controller.js','board-v7-design.js','board-v7-art.js',
  'game-catalog.json','sw.js'])exists(file);
 assert.equal(JSON.parse(fs.readFileSync(path.join(target,'version.json'),'utf8')).version,version);
 const html=fs.readFileSync(path.join(target,'index.html'),'utf8');
 assert.ok(html.includes('src="./src/platform/board-runtime.js?v='+version+'"'),
  'production still loads lazy BOARD runtime');
 for(const [,ref] of html.matchAll(/\b(?:src|href)="\.\/([^"?]+)(?:\?[^"]*)?"/g)){
  const local=path.resolve(target,ref);
  assert.ok(local.startsWith(target+path.sep)&&fs.existsSync(local),
   'production HTML has missing relative dependency: '+ref);
 }
 const catalog=JSON.parse(fs.readFileSync(path.join(target,'game-catalog.json'),'utf8'));
 assert.equal(catalog.schema,1);
 assert.ok(catalog.games.length>=17,'game discovery must produce all current plug-ins');
 for(const game of catalog.games){
  assert.match(game.hash,/^[a-f0-9]{24}$/);
  for(const url of [game.entryUrl,game.coverUrl,...game.legacyUrls]){
   if(!url)continue;
   assert.ok(url.startsWith('/game-assets/'+game.id+'/'+game.hash+'/'));
   exists(url.slice(1));
  }
 }
 execFileSync(process.execPath,['scripts/build-app.cjs','--check'],{cwd:target,
  env:{...process.env,GAME_BUILD_ROOT:target},stdio:'pipe'});
 console.log('FRESH STATIC BUILD PASS: '+catalog.games.length+
  ' game manifests, all versioned plugin files, BOARD modules and HTML references');
}finally{
 fs.rmSync(target,{recursive:true,force:true});
}
