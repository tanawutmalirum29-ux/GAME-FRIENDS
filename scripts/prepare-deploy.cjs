/* Assemble a deliberately small static artifact for Amplify Hosting.
 * Build/test source, CI files, docs and server implementation stay in the repo,
 * while only assets the browser can request are copied into dist/. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const DEFAULT_ROOT=path.resolve(process.env.GAME_BUILD_ROOT||path.join(__dirname,'..'));
const ROOT_FILES=[
 'index.html','host.html','app.js','app-controller.js','style.css',
 'runtime-config.js','deployment.json','manifest.webmanifest','host.webmanifest',
 'sw.js','auto-update.js','arena-scale.js','arena-art.js','combat-motion.js',
 'cosmetic-system.js','player-avatar.js','character-system.js','party-ui-art.js',
 'party-arena-scenes.js','reference-arena-art.js','game-cover-art.js'
];
const ROOT_DIRS=[
 'assets',
 'src/board-party/runtime',
 'src/lobby',
 'src/platform',
 'src/shared',
 'game-assets',
 'board-map-assets',
 'board-system-assets'
];
const CATALOG_FILES=[
 'game-catalog.json','board-map-catalog.json','board-system-catalog.json'
];
// Some generated asset families are empty until their first optional plug-in exists.
const OPTIONAL_DIRS=new Set(['board-system-assets']);
function inside(parent,child){
 const relative=path.relative(parent,child);
 return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);
}
function copyFile(root,dist,relative){
 const source=path.resolve(root,relative);
 if(!inside(root,source)||!fs.existsSync(source)||!fs.statSync(source).isFile())
  throw Error('Missing or unsafe public file: '+relative);
 const target=path.resolve(dist,relative);
 if(!inside(dist,target))throw Error('Unsafe deploy target: '+relative);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.copyFileSync(source,target);
}
function copyTree(root,dist,relative){
 const source=path.resolve(root,relative);
 if(!fs.existsSync(source)&&OPTIONAL_DIRS.has(relative))return;
 if(!inside(root,source)||!fs.existsSync(source)||!fs.statSync(source).isDirectory())
  throw Error('Missing or unsafe public directory: '+relative);
 const walk=(directory,local)=>{
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
   if(entry.isSymbolicLink())throw Error('Symlink forbidden in public artifact: '+path.join(local,entry.name));
   const child=path.posix.join(local,entry.name),full=path.join(directory,entry.name);
   if(entry.isDirectory())walk(full,child);
   else if(entry.isFile()){
    // Artwork handoff notes and design documentation are repository-only;
    // only browser-readable assets enter the hosting artifact.
    if(/\.(?:md|mdx)$/i.test(entry.name))continue;
    copyFile(root,dist,child);
   }else throw Error('Unsupported public artifact entry: '+child);
  }
 };
 walk(source,relative);
}
function resolvePublicOrigin(env=process.env){
 const configured=String(env.PUBLIC_SITE_URL||'').trim();
 if(configured){
  let url;
  try{url=new URL(configured);}catch(_){throw Error('PUBLIC_SITE_URL must be a valid HTTPS URL');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)
   throw Error('PUBLIC_SITE_URL must be a valid HTTPS URL origin without credentials, query or fragment');
  return url.origin;
 }
 // AWS Amplify exposes both values for each connected branch. The default
 // branch URL uses <branch>.<app-id>.amplifyapp.com; use it for social cards
 // unless a custom canonical URL is configured above.
 const branch=String(env.AWS_BRANCH||'').trim().toLowerCase();
 const appId=String(env.AWS_APP_ID||'').trim().toLowerCase();
 if(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(branch)&&/^[a-z0-9]{6,32}$/.test(appId))
  return 'https://'+branch+'.'+appId+'.amplifyapp.com';
 return null;
}
function rewriteSocialImage(dist,env=process.env){
 const origin=resolvePublicOrigin(env);
 if(!origin)return false;
 const filename=path.join(dist,'index.html');
 const image=origin+'/assets/game-friends-social.png';
 let html=fs.readFileSync(filename,'utf8');
 const before=html;
 html=html.replace(/(<meta\s+property=["']og:image["']\s+content=["'])[^"']*(["'][^>]*>)/i,'$1'+image+'$2');
 html=html.replace(/(<meta\s+name=["']twitter:image["']\s+content=["'])[^"']*(["'][^>]*>)/i,'$1'+image+'$2');
 if(html===before)throw Error('Social image metadata tags are missing from index.html');
 if(!fs.existsSync(path.join(dist,'assets','game-friends-social.png')))
  throw Error('Social preview image is missing from the public artifact');
 fs.writeFileSync(filename,html);
 return true;
}
function validateHtml(root,dist,file){
 const html=fs.readFileSync(path.join(dist,file),'utf8');
 const refs=[...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map(m=>m[1]);
 for(const raw of refs){
  if(/^(?:https?:|data:|blob:|#|mailto:|tel:|javascript:)/i.test(raw))continue;
  let url;
  try{url=new URL(raw,'https://deploy.invalid/'+file);}catch(_){throw Error('Invalid HTML URL in '+file+': '+raw);}
  if(url.origin!=='https://deploy.invalid'||!url.pathname.startsWith('/'))continue;
  const relative=decodeURIComponent(url.pathname.slice(1));
  if(!relative||relative.endsWith('/'))continue;
  const target=path.resolve(dist,relative);
  if(!inside(dist,target)||!fs.existsSync(target)||!fs.statSync(target).isFile())
   throw Error('Public HTML references missing deploy file: '+file+' -> '+raw);
 }
}
function validateManifest(dist,file){
 const manifest=JSON.parse(fs.readFileSync(path.join(dist,file),'utf8'));
 for(const icon of manifest.icons||[]){
  if(typeof icon.src!=='string')throw Error('Invalid icon src in '+file);
  const target=path.resolve(dist,icon.src.replace(/^\//,''));
  if(!inside(dist,target)||!fs.existsSync(target)||!fs.statSync(target).isFile())
   throw Error('Manifest icon missing from deploy output: '+file+' -> '+icon.src);
 }
}
function build({root=DEFAULT_ROOT}={}){
 root=path.resolve(root);
 const dist=path.join(root,'dist');
 if(!inside(root,dist))throw Error('Deploy output must be inside the build root');
 fs.rmSync(dist,{recursive:true,force:true});
 fs.mkdirSync(dist,{recursive:true});
 for(const file of [...ROOT_FILES,...CATALOG_FILES])copyFile(root,dist,file);
 for(const directory of ROOT_DIRS)copyTree(root,dist,directory);
 rewriteSocialImage(dist);
 for(const file of ['index.html','host.html'])validateHtml(root,dist,file);
 for(const file of ['manifest.webmanifest','host.webmanifest'])validateManifest(dist,file);
 for(const forbidden of ['tests','scripts','docs','server','.github','ci','tools','src/app','src/games']){
  if(fs.existsSync(path.join(dist,forbidden)))throw Error('Non-runtime source leaked into public artifact: '+forbidden);
 }
 let files=0,bytes=0;
 const count=directory=>{
  for(const item of fs.readdirSync(directory,{withFileTypes:true})){
   const filename=path.join(directory,item.name);
   if(item.isDirectory())count(filename);
   else if(item.isFile()){files++;bytes+=fs.statSync(filename).size;}
  }
 };
 count(dist);
 if(!fs.existsSync(path.join(dist,'index.html'))||!fs.existsSync(path.join(dist,'sw.js'))||
    !fs.existsSync(path.join(dist,'app.js'))||!fs.existsSync(path.join(dist,'app-controller.js')))
  throw Error('Required public entry points missing from deploy output');
 return {dist,files,bytes};
}
if(require.main===module){
 const result=build();
 process.stdout.write('Public deploy artifact: '+result.files+' files, '+result.bytes+
  ' bytes -> dist/ (non-runtime repository files excluded)\n');
}
module.exports={build,resolvePublicOrigin,rewriteSocialImage};
