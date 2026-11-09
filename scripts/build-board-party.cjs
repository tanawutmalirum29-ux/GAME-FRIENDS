/* BOARD source assembler: exact lexical compatibility with src/board-party/runtime/board-party.js. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(process.env.GAME_BUILD_ROOT||path.join(__dirname,'..'));
const prefix="/* Host-authoritative session state, separate from every minigame's player data. */\n(() => {\n'use strict';\n";
const suffix="})();\n";
function assemble({write=false,check=false}={}){
 const file=path.join(root,'src','board-party','modules.json');
 const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 if(manifest.schema!==1||!Array.isArray(manifest.parts)||!manifest.parts.length)
  throw Error('Invalid BOARD source manifest');
 const seen=new Set();
 const contents=manifest.parts.map(part=>{
  if(typeof part!=='string'||!/^src\/board-party\/(?:core|systems|ui)\/[a-z0-9/-]+\.js$/.test(part)||
    part.includes('..')||seen.has(part))throw Error('Unsafe or duplicate BOARD source: '+part);
  seen.add(part);
  return fs.readFileSync(path.join(root,part),'utf8');
 });
 const result=prefix+contents.join('')+suffix;
 const output=path.join(root,'src/board-party/runtime/board-party.js');
 if(check&&fs.readFileSync(output,'utf8')!==result)
  throw Error('Generated src/board-party/runtime/board-party.js differs from src/board-party/modules.json; run --write');
 if(write){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,result);}
 return result;
}
if(require.main===module){
 const mode=process.argv[2];
 if(!['--write','--check'].includes(mode))throw Error('Use --write or --check');
 assemble({write:mode==='--write',check:mode==='--check'});
 console.log('BOARD PARTY source modules: '+mode+' OK');
}
module.exports={assemble};
