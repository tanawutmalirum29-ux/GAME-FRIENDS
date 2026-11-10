'use strict';
// Prove canonical BOARD assets regenerate in a fresh checkout and recover corrupted outputs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const os=require('node:os'),{execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gf-board-fresh-'));
const names=['board-design.js','board-scenery.js'];
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run=()=>execFileSync(process.execPath,['scripts/build-board-assets.cjs'],{cwd:tmp,encoding:'utf8'});
const output=name=>path.join(tmp,'src/board-party/runtime',name);
try{
 fs.mkdirSync(path.join(tmp,'scripts'));
 fs.mkdirSync(path.join(tmp,'src/board-party/source'),{recursive:true});
 fs.copyFileSync(path.join(root,'scripts/build-board-assets.cjs'),path.join(tmp,'scripts/build-board-assets.cjs'));
 for(const name of fs.readdirSync(path.join(root,'src/board-party/source'))){
  if(!/^(board-design|board-scenery)\.deflate\.b64\.part\d+$/.test(name))continue;
  fs.copyFileSync(path.join(root,'src/board-party/source',name),path.join(tmp,'src/board-party/source',name));
 }
 for(const name of names)assert.ok(!fs.existsSync(output(name)));
 run();
 const digests=Object.fromEntries(names.map(name=>[name,sha(output(name))]));
 for(const name of names){
  assert.ok(fs.statSync(output(name)).size>1000);
  fs.utimesSync(output(name),new Date(0),new Date(0));
 }
 run();
 for(const name of names){
  assert.equal(sha(output(name)),digests[name]);
  assert.equal(fs.statSync(output(name)).mtime.getTime(),0,'unchanged asset must not be rewritten');
 }
 fs.writeFileSync(output(names[0]),'invalid output');
 run();
 for(const name of names)assert.equal(sha(output(name)),digests[name]);
 for(const name of names)assert.ok(!fs.existsSync(path.join(tmp,name)),'no BOARD output in project root');
 console.log('BOARD ASSET BUILD PASS: fresh source, verified inputs, idempotency and repair');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
