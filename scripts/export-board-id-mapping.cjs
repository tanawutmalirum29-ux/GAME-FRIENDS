'use strict';
/* Generate the complete reviewed old/internal/display ID table on demand. */
const fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({window:{},Math,Date,console});
for(const file of ['src/board-party/runtime/board-map.js','src/board-party/runtime/board-v7-design.js','src/board-party/runtime/board-branch-naming.js','src/board-party/runtime/board-v7-adapter.js'])
 vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
const map=ctx.window.BoardMap.create(0),rows=map.idMigration;
if(!rows?.length)throw Error('Missing board path-ID migration');
if(process.argv.includes('--json'))console.log(JSON.stringify({
 version:map.version,removed:ctx.window.BoardMap.GRAPH_MIGRATION,
 mapping:rows,collisions:map.pathIdCollisions
},null,2));
else{console.log('old_id,internal_id,display_path_id,source_branch,terminal_branch');
 const quote=s=>'"'+String(s??'').replace(/"/g,'""')+'"';
 const source=ctx.window.BoardBranchNaming.fromGraph(map);
 const byNode=new Map(source.mapping.map(item=>[item.internalId,item]));
 for(const row of rows){
  const desc=byNode.get(row.internalId);
  console.log([row.oldId,row.internalId,row.displayId,desc?.parentId??'n',
   desc?.terminalBranchId??'n'].map(quote).join(','));
 }
}
