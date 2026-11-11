/* Version each AWS Amplify deployment (not only this commit). */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(process.env.GAME_BUILD_ROOT||path.join(__dirname,'..'));
function getCommit(){
  const candidate=String(process.env.AWS_COMMIT_ID||process.env.GITHUB_SHA||'').trim();
  if(/^[a-z0-9._-]{7,64}$/i.test(candidate))return candidate;
  try{
    const sha=execFileSync('git',['rev-parse','HEAD'],{
      cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']
    }).trim();
    if(/^[a-f0-9]{40}$/i.test(sha))return sha;
  }catch(_){}
  throw Error('Unable to identify build: AWS_COMMIT_ID is required');
}
// Restore and integrity-check canonical BOARD scenery and design assets.
require('./build-board-assets.cjs');
// Derive controller-only BOARD metadata from the authoritative game rules.
if(fs.existsSync(path.join(root,'src/board-party/runtime/board-items.js')))
 require('./build-board-item-brief.cjs').build({write:true});
// Build BOARD logic from maintainable source fragments without changing runtime behavior.
if(fs.existsSync(path.join(root,'src','board-party','modules.json')))
 require('./build-board-party.cjs').assemble({write:true});
// Generate Host and Controller bundles from maintainable source modules.
if(fs.existsSync(path.join(root,'src','app','modules.json')))
 require('./build-app.cjs').assemble({write:true});
const id=getCommit();
const turnUrl=String(process.env.GF_TURN_CREDENTIALS_ENDPOINT||'').trim();
if(turnUrl&&(!/^https:\/\/[^\s]+$/i.test(turnUrl)||turnUrl.length>512))
 throw Error('GF_TURN_CREDENTIALS_ENDPOINT must be a short HTTPS URL');
const gameCatalog=fs.existsSync(path.join(root,'src','games'))?
  require('./build-game-catalog.cjs').build({write:true}):null;
// Detect BOARD item/space/event plugins by their own manifests.
require('./build-board-system-catalog.cjs').build({write:true,coreHash:gameCatalog?.coreHash});
// Discover BOARD maps at build time. Do not eagerly fetch map engines.
const boardCatalog=fs.existsSync(path.join(root,'src','board-party','maps'))?
 require('./build-board-map-catalog.cjs').build({write:true,coreHash:gameCatalog?.coreHash}):null;
fs.writeFileSync(path.join(root,'deployment.json'),JSON.stringify({deployId:id})+'\n');
fs.writeFileSync(path.join(root,'runtime-config.js'),
  'window.GAME_DEPLOY_ID='+JSON.stringify(id)+';\n'+
  (turnUrl?'window.GF_TURN_CREDENTIALS_ENDPOINT='+JSON.stringify(turnUrl)+';\n':'')+
  (gameCatalog?'window.GAME_CORE_HASH='+JSON.stringify(gameCatalog.coreHash)+';\n'+
   'window.GAME_GAME_HASHES='+JSON.stringify(Object.fromEntries(gameCatalog.games.map(g=>[g.id,g.hash])))+';\n':'')+
  (boardCatalog?'window.GAME_DEFAULT_BOARD_MAP_HASH='+JSON.stringify(
   boardCatalog.maps.find(m=>m.id==='winter-expedition')?.hash||'')+';\n':''));
const indexPath=path.join(root,'index.html');
let html=fs.readFileSync(indexPath,'utf8');
// Validate every local file referenced by HTML without rewriting its URL. No game names,
// artwork, or new app entrypoints belong in a hand-maintained asset allowlist.
const deployAsset=/\.(?:js|css|svg|png|webp|jpe?g|ico|woff2?|webmanifest)$/i;
html=html.replace(/\b(src|href)="(\.\/[^"?]+)(?:\?v=[^"]*)?"/g,
 (raw,attr,url)=>{
  const asset=url.slice(2);
  if(!deployAsset.test(asset))return raw; // navigation, anchors, non-assets
  if(asset.includes('..')||asset.includes('\\'))
   throw Error('Unsafe deployment asset: '+asset);
  const filename=path.resolve(root,asset);
  if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename)||
     !fs.statSync(filename).isFile())
   throw Error('Missing build asset: '+asset);
  return attr+'="'+url+'"';
 });
if(gameCatalog){
 const lazy=require('./lazy-game-scripts.cjs');
 html=lazy.pruneGameCover(lazy.pruneAppBoot(lazy.pruneHostCore(lazy.pruneExternal(lazy.pruneBoardCore(lazy.pruneLegacy(html,gameCatalog))))));
}
fs.writeFileSync(indexPath,html);
process.stdout.write('Static deploy '+id.slice(0,12)+'\n');
