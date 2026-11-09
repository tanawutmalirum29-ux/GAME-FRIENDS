'use strict';
// Prove source assets rebuild from a truly empty checkout-like temp tree.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gf-board-fresh-'));
const digests={
 'board-v7-design.js':'fd545e971edd8e89c4ca41d36e1ed97663c8c676f846d83baabc7a386fbb55c8',
 'board-v7-art.js':'12d178158c218556059a093b89a88006e2c710851cceb854c96ecfa1f4ac6401'
};
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run=()=>execFileSync(process.execPath,['scripts/build-board-v7.cjs'],
 {cwd:tmp,encoding:'utf8'});
try{
 fs.mkdirSync(path.join(tmp,'scripts'));
 fs.mkdirSync(path.join(tmp,'board-v7-source'));
 fs.copyFileSync(path.join(root,'scripts/build-board-v7.cjs'),
  path.join(tmp,'scripts/build-board-v7.cjs'));
 for(const name of fs.readdirSync(path.join(root,'board-v7-source'))){
  if(!/^(board-v7-design|board-v7-art)\.deflate\.b64\.part\d+$/.test(name))continue;
  fs.copyFileSync(path.join(root,'board-v7-source',name),
   path.join(tmp,'board-v7-source',name));
 }
 for(const file of Object.keys(digests))
  assert.ok(!fs.existsSync(path.join(tmp,file)),'fresh tree must not have prebuilt '+file);
 run();
 for(const [file,expected] of Object.entries(digests)){
  const output=path.join(tmp,file);
  assert.equal(sha(output),expected,'fresh restore checksum '+file);
  fs.utimesSync(output,new Date(0),new Date(0));
 }
 run();
 for(const [file,expected] of Object.entries(digests)){
  const output=path.join(tmp,file);
  assert.equal(fs.statSync(output).mtime.getTime(),0,
   'valid generated artifact must not be rewritten: '+file);
  assert.equal(sha(output),expected);
 }
 fs.writeFileSync(path.join(tmp,'board-v7-design.js'),'invalid build output');
 run();
 assert.equal(sha(path.join(tmp,'board-v7-design.js')),digests['board-v7-design.js'],
  'stale generated artifact must be rebuilt');
 console.log('FRESH BOARD BUILD PASS: restore, checksum, no-op repeat, and stale repair');
}finally{
 fs.rmSync(tmp,{recursive:true,force:true});
}
