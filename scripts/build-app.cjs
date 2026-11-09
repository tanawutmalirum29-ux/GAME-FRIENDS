/* GAME-FRIENDS app assembler: keep one lexical closure while splitting authoring
 * into independently syntax-valid source modules; no eval or browser bundler.
 * app.js is a generated compatibility artifact required by legacy harnesses. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.env.GAME_BUILD_ROOT||path.join(__dirname,'..'));
const output=path.join(root,'app.js'),controllerOutput=path.join(root,'app-controller.js'),
 manifestFile=path.join(root,'src/app/modules.json');
const HOST_ONLY=new Set(['src/app/rounds/engine.js','src/app/rounds/results.js']);
function assemble({write=false}={}){
 const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 assert.equal(manifest.schema,1);
 assert.ok(Array.isArray(manifest.parts)&&manifest.parts.length>=4);
 const paths=new Set(),contents=[],controllerContents=[];
 for(const item of manifest.parts){
  assert.ok(typeof item==='string'&&item.startsWith('src/app/')&&item.endsWith('.js')&&
   item.split('/').every(segment=>/^[a-z0-9_.-]+$/.test(segment))&&
   !item.includes('..'),'invalid source chunk '+item);
  assert.ok(!paths.has(item),'duplicate source chunk: '+item);paths.add(item);
  const filename=path.resolve(root,item);
  assert.ok(filename.startsWith(path.join(root,'src','app')+path.sep),'invalid source boundary');
  const content=fs.readFileSync(filename,'utf8');
  contents.push(content);
  if(!HOST_ONLY.has(item))controllerContents.push(content);
 }
 for(const item of HOST_ONLY)assert.ok(paths.has(item),'Missing host-only module '+item);
 const prefix="(() => {\n'use strict';\n\n",suffix='})();\n';
 const assembled=prefix+contents.join('')+suffix;
 const controller=prefix+controllerContents.join('')+suffix;
 if(write){
  fs.writeFileSync(output,assembled);
  fs.writeFileSync(controllerOutput,controller);
 }else{
  assert.equal(fs.readFileSync(output,'utf8'),assembled,
   'app.js differs from modular sources: node scripts/build-app.cjs --write');
  assert.equal(fs.readFileSync(controllerOutput,'utf8'),controller,
   'app-controller.js differs from modular sources: node scripts/build-app.cjs --write');
 }
 return {parts:manifest.parts,bytes:Buffer.byteLength(assembled),
  controllerBytes:Buffer.byteLength(controller)};
}
if(require.main===module){
 const arg=process.argv[2];
 if(arg&&arg!=='--check'&&arg!=='--write')throw Error('Usage: node scripts/build-app.cjs [--check|--write]');
 const result=assemble({write:arg==='--write'});
 console.log('Modular app bundles verified:',result.parts.length,'source modules,',
  result.bytes,'host bytes,',result.controllerBytes,'controller bytes');
}
module.exports={assemble};
