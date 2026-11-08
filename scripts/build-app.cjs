/* GAME-FRIENDS app assembler: keep one lexical closure while splitting authoring
 * into independently syntax-valid source modules; no eval or browser bundler.
 * app.js is a generated compatibility artifact required by legacy harnesses. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.env.GAME_BUILD_ROOT||path.join(__dirname,'..'));
const output=path.join(root,'app.js'),manifestFile=path.join(root,'src/app/modules.json');
function assemble({write=false}={}){
 const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 assert.equal(manifest.schema,1);
 assert.ok(Array.isArray(manifest.parts)&&manifest.parts.length>=4);
 const paths=new Set(),contents=[];
 for(const item of manifest.parts){
  assert.ok(/^src\\/app\\/[a-z0-9_/-]+\\.js$/.test(item),'invalid source chunk '+item);
  assert.ok(!paths.has(item),'duplicate source chunk: '+item);paths.add(item);
  const filename=path.resolve(root,item);
  assert.ok(filename.startsWith(path.join(root,'src','app')+path.sep),'invalid source boundary');
  contents.push(fs.readFileSync(filename,'utf8'));
 }
 const assembled="(() => {\n'use strict';\n\n"+contents.join('')+'})();\n';
 if(write)fs.writeFileSync(output,assembled);
 else assert.equal(fs.readFileSync(output,'utf8'),assembled,
  'app.js differs from modular sources: node scripts/build-app.cjs --write');
 return {parts:manifest.parts,bytes:Buffer.byteLength(assembled)};
}
if(require.main===module){
 const arg=process.argv[2];
 if(arg&&arg!=='--check'&&arg!=='--write')throw Error('Usage: node scripts/build-app.cjs [--check|--write]');
 const result=assemble({write:arg==='--write'});
 console.log('Modular app bundle verified:',result.parts.length,'source modules,',result.bytes,'bytes');
}
module.exports={assemble};
