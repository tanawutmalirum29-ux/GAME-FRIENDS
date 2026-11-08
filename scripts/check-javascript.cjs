/* Fast source-wide syntax check. Automatically includes new JS and test files. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const exclude=new Set(['.git','node_modules','.cache','dist','build','coverage','.next']);
const files=[];
function walk(relative=''){
 for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){
  if(entry.isSymbolicLink())continue;
  const name=path.posix.join(relative,entry.name);
  if(entry.isDirectory()){
   if(!exclude.has(entry.name))walk(name);
  }else if(entry.isFile()&&/\.(?:cjs|mjs|js)$/.test(entry.name)){
   files.push(name);
  }
 }
}
walk();
if(!files.length)throw Error('No JavaScript files discovered');
let failures=0;
for(const file of files.sort()){
 const result=cp.spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});
 if(result.status!==0){
  failures++;
  console.error('SYNTAX FAILURE: '+file+'\n'+result.stderr);
 }
}
console.log('Dynamic syntax validation: '+files.length+' JavaScript files, '+failures+' failures');
if(failures)process.exitCode=1;
