/* Discover BOARD systems from folders at build time, never via HTTP listing. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(process.env.GAME_BUILD_ROOT||path.join(__dirname,'..'));
const rootDir=path.join(root,'src','board-party','plugins');
const categories=['items','spaces','events'];
const idPattern=/^[a-z][a-z0-9-]*$/;
const reserved={
 items:new Set(['potion','ufo','rocket','bomber','car','shield']),
 spaces:new Set(['start','finish','movement','lucky','healing','danger','event','sword','milestone']),
 events:new Set()
};
function fail(message){throw Error('BOARD system: '+message);}
function collect(folder,prefix=''){
 const out=[];
 for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
  const name=path.posix.join(prefix,entry.name);
  if(entry.isSymbolicLink())fail('symlink '+name);
  if(entry.isDirectory())out.push(...collect(path.join(folder,entry.name),name));
  else if(entry.isFile())out.push(name);
  else fail('unsupported file '+name);
 }
 return out.sort();
}
function build({write=false,coreHash}={}){
 const hash=coreHash||require('./build-game-catalog.cjs').coreHash();
 if(!/^[a-f0-9]{20}$/.test(hash))fail('invalid core fingerprint');
 const systems=[];
 for(const category of categories){
  const directory=path.join(rootDir,category);
  if(!fs.existsSync(directory))continue;
  for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   if(!entry.isDirectory()){if(!['README.md','.gitkeep'].includes(entry.name))fail('unexpected '+category+'/'+entry.name);continue;}
   const id=entry.name,folder=path.join(directory,id),files=collect(folder);
   if(!idPattern.test(id)||reserved[category].has(id))fail('invalid or reserved ID '+category+'/'+id);
   if(!files.includes('manifest.json'))fail('missing manifest '+category+'/'+id);
   const m=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
   if(m.id!==id||m.category!==category||m.apiVersion!==1||
      typeof m.enabled!=='boolean'||
      typeof m.name!=='string'||!m.name.trim()||m.name.length>80)fail('invalid manifest '+category+'/'+id);
   if(typeof m.entry!=='string'||!m.entry.startsWith('./')||m.entry.includes('..')||
      m.entry.includes('\\')||!m.entry.endsWith('.js')||!files.includes(m.entry.slice(2)))
      fail('missing/unsafe entry '+category+'/'+id);
   const digest=crypto.createHash('sha256');
   for(const file of files){digest.update(file+'\0');digest.update(fs.readFileSync(path.join(folder,file)));}
   const assetHash=digest.digest('hex').slice(0,24),asset='board-system-assets/'+category+'/'+id+'/' +assetHash+'/';
   if(write){
    for(const file of files){
     const destination=path.join(root,asset,file);
     fs.mkdirSync(path.dirname(destination),{recursive:true});
     fs.copyFileSync(path.join(folder,file),destination);
    }
   }
   systems.push({category,id,name:m.name,apiVersion:1,enabled:m.enabled,
    hash:assetHash,entryUrl:'/'+asset+m.entry.slice(2)});
  }
 }
 const result={schema:1,coreHash:hash,systems};
 if(write)fs.writeFileSync(path.join(root,'board-system-catalog.json'),JSON.stringify(result,null,2)+'\n');
 return result;
}
if(require.main===module){
 const mode=process.argv[2];
 if(mode&&!['--check','--write'].includes(mode))fail('usage: [--check|--write]');
 const result=build({write:mode==='--write'});
 process.stdout.write('BOARD systems validated: '+result.systems.length+' plug-ins\n');
}
module.exports={build};
