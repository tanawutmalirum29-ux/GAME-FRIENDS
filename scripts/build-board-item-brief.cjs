/* Derive compact BOARD labels from authoritative board-items.js at build time. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(process.env.GAME_BUILD_ROOT||path.join(__dirname,'..'));
const source=path.join(root,'board-items.js');
const output=path.join(root,'src/platform/board-items-brief.js');
function build({write=false}={}){
 const context={window:{}};
 vm.runInNewContext(fs.readFileSync(source,'utf8'),context,{filename:'board-items.js',timeout:1500});
 const api=context.window.BoardItems;
 assert.ok(api&&api.names&&Array.isArray(api.ids)&&api.ids.length>0);
 const names=Object.fromEntries(api.ids.map(id=>{
  assert.ok(/^[a-z][a-z0-9_]*$/.test(id),'invalid board item ID');
  const label=api.names[id];
  assert.ok(typeof label==='string'&&label.length>0&&label.length<=80,'invalid board item name');
  return [id,label];
 }));
 const payload='/* Auto-generated from board-items.js; do not edit manually. */\n'+
  '(()=>{\n"use strict";\nconst names=Object.freeze('+JSON.stringify(names)+');\n'+
  'window.PartyBoardItemMeta=Object.freeze({names,ids:Object.freeze(Object.keys(names))});\n})();\n';
 if(write){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,payload);}
 else assert.equal(fs.readFileSync(output,'utf8'),payload,
  'BOARD item brief is not synchronized with board-items.js');
 return {ids:Object.keys(names),bytes:Buffer.byteLength(payload)};
}
if(require.main===module){
 const arg=process.argv[2];
 if(arg&&arg!=='--check'&&arg!=='--write')throw Error('Usage: node scripts/build-board-item-brief.cjs [--check|--write]');
 const result=build({write:arg==='--write'});
 console.log('BOARD item brief verified:',result.ids.length,'items,',result.bytes,'bytes');
}
module.exports={build};
