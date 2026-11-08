/* Build-time auto-discovery of version-pinned static game plug-ins.
 * No directory listing or game-name editing in index.html/app.js is needed. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(process.env.GAME_BUILD_ROOT||path.join(__dirname,'..'));
const gamesRoot=path.join(root,'src','games');
const schema=1;
const safeId=/^[a-z][a-z0-9_]*$/;
const safeName=/^[a-z][a-z0-9-]*$/;
function inside(parent,file){
 const relative=path.relative(parent,file);
 return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);
}
function source(relative){
 if(typeof relative!=='string'||relative.startsWith('/')||relative.includes('\\'))throw Error('Unsafe asset path: '+relative);
 const abs=path.resolve(root,relative);
 if(!inside(root,abs)||!fs.statSync(abs).isFile())throw Error('Missing or unsafe asset: '+relative);
 return abs;
}
function list(dir,relative=''){
 let found=[];
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(entry.isSymbolicLink())throw Error('Symlink not allowed: '+entry.name);
  const name=path.posix.join(relative,entry.name);
  if(entry.isDirectory())found=found.concat(list(path.join(dir,entry.name),name));
  else if(entry.isFile())found.push(name);
 }
 return found.sort();
}
function coreHash(){
 const h=crypto.createHash('sha256');
 for(const relative of ['index.html','app.js','board-minigame.js','board-party.js','board-map.js',
  'player-avatar.js','character-system.js','combat-motion.js','arena-scale.js','arena-art.js',
  'party-arena-scenes.js','party-ui-art.js','game-cover-art.js']){
  if(fs.existsSync(path.join(root,relative))){
   h.update(relative+'\0');h.update(fs.readFileSync(path.join(root,relative)));
  }
 }
 return h.digest('hex').slice(0,20);
}
function build({write=false}={}){
 if(!fs.existsSync(gamesRoot))throw Error('Missing src/games plug-in directory');
 const dirs=fs.readdirSync(gamesRoot,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort();
 if(!dirs.length)throw Error('No game plug-ins discovered');
 const ids=new Set(),out=[];
 for(const slug of dirs){
  if(!safeName.test(slug))throw Error('Invalid plug-in folder '+slug);
  const folder=path.join(gamesRoot,slug),manifestPath=path.join(folder,'manifest.json');
  if(!fs.existsSync(manifestPath))throw Error('Missing manifest for '+slug);
  const meta=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  if(!safeId.test(meta.id)||ids.has(meta.id))throw Error('Invalid/duplicate game ID: '+meta.id);
  ids.add(meta.id);
  if(typeof meta.name!=='string'||!meta.name.trim()||meta.name.length>80)throw Error('Invalid name: '+slug);
  if(!/^\\d+\\.\\d+\\.\\d+$/.test(meta.version)||meta.apiVersion!==1||typeof meta.enabled!=='boolean')throw Error('Unsupported version/API: '+slug);
  if(!meta.players||!Number.isInteger(meta.players.min)||!Number.isInteger(meta.players.max)||meta.players.min<1||meta.players.max>12||meta.players.min>meta.players.max)throw Error('Invalid players: '+slug);
  if(!Array.isArray(meta.modes)||!meta.modes.length||meta.modes.some(m=>!['normal','board'].includes(m))||new Set(meta.modes).size!==meta.modes.length)throw Error('Invalid modes: '+slug);
  if(!Array.isArray(meta.controls)||meta.controls.some(x=>!['joystick','A','B','C'].includes(x)))throw Error('Invalid controls: '+slug);
  if(typeof meta.entry!=='string'||!meta.entry.startsWith('./')||meta.entry.includes('..')||!meta.entry.endsWith('.js'))throw Error('Invalid entry: '+slug);
  const entry=meta.entry.slice(2),local=list(folder);
  if(!local.includes(entry))throw Error('Missing game entry: '+slug);
  if(!Array.isArray(meta.legacyScripts)||meta.legacyScripts.some(x=>typeof x!=='string'||!x.endsWith('.js')))throw Error('Invalid legacyScripts: '+slug);
  if(meta.global!==undefined&&(!/^[A-Za-z_$][\\w$]*$/.test(meta.global)||!meta.legacyScripts.length))throw Error('Invalid legacy global: '+slug);
  const legacy=meta.legacyScripts.map(x=>{const abs=source(x);return {name:x,abs};});
  const hash=crypto.createHash('sha256');
  for(const relative of local){hash.update('local:'+relative+'\0');hash.update(fs.readFileSync(path.join(folder,relative)));}
  for(const {name,abs} of legacy){hash.update('legacy:'+name+'\0');hash.update(fs.readFileSync(abs));}
  const fingerprint=hash.digest('hex').slice(0,24);
  const base='game-assets/'+meta.id+'/'+fingerprint+'/';
  if(write){
   const target=path.join(root,base);
   for(const relative of local){
    const dest=path.join(target,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.copyFileSync(path.join(folder,relative),dest);
   }
   for(const {name,abs} of legacy){
    const dest=path.join(target,'legacy',name);fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.copyFileSync(abs,dest);
   }
  }
  out.push({id:meta.id,name:meta.name,version:meta.version,apiVersion:1,
   enabled:meta.enabled,players:meta.players,modes:meta.modes,controls:meta.controls,
   hash:fingerprint,entryUrl:'/'+base+entry,
   legacyUrls:legacy.map(x=>'/'+base+'legacy/'+x.name),global:meta.global||null});
 }
 const catalog={schema,coreHash:coreHash(),games:out};
 if(write)fs.writeFileSync(path.join(root,'game-catalog.json'),JSON.stringify(catalog,null,2)+'\n');
 return catalog;
}
if(require.main===module){
 const cmd=process.argv[2];
 if(cmd&&cmd!=='--write'&&cmd!=='--check')throw Error('Usage: node scripts/build-game-catalog.cjs [--check|--write]');
 const catalog=build({write:cmd==='--write'});
 process.stdout.write('Game catalog validated: '+catalog.games.length+' plug-ins, core '+catalog.coreHash+'\n');
}
module.exports={build,coreHash};
