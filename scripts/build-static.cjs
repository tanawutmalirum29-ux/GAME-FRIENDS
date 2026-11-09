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
// Restore and integrity-check the committed v7 source bundle first.
require('./build-board-v7.cjs');
// Derive controller-only BOARD metadata from the authoritative game rules.
if(fs.existsSync(path.join(root,'board-items.js')))
 require('./build-board-item-brief.cjs').build({write:true});
// Generate Host and Controller bundles from maintainable source modules.
if(fs.existsSync(path.join(root,'src','app','modules.json')))
 require('./build-app.cjs').assemble({write:true});
const id=getCommit();
const turnUrl=String(process.env.GF_TURN_CREDENTIALS_ENDPOINT||'').trim();
if(turnUrl&&(!/^https:\/\/[^\s]+$/i.test(turnUrl)||turnUrl.length>512))
 throw Error('GF_TURN_CREDENTIALS_ENDPOINT must be a short HTTPS URL');
const gameCatalog=fs.existsSync(path.join(root,'src','games'))?
  require('./build-game-catalog.cjs').build({write:true}):null;
fs.writeFileSync(path.join(root,'version.json'),JSON.stringify({version:id})+'\n');
fs.writeFileSync(path.join(root,'build-version.js'),
  'window.GAME_BUILD_VERSION='+JSON.stringify(id)+';\n'+
  (turnUrl?'window.GF_TURN_CREDENTIALS_ENDPOINT='+JSON.stringify(turnUrl)+';\n':'')+
  (gameCatalog?'window.GAME_CORE_VERSION='+JSON.stringify(gameCatalog.coreHash)+';\n'+
   'window.GAME_GAME_HASHES='+JSON.stringify(Object.fromEntries(gameCatalog.games.map(g=>[g.id,g.hash])))+';\n':''));
const indexPath=path.join(root,'index.html');
let html=fs.readFileSync(indexPath,'utf8');
const assets=['style.css','arena-scale.js','arena-art.js','src/shared/graveyard-art.js','combat-motion.js',
 'player-avatar.js','character-system.js','board-controller-camera.js','party-ui-art.js','src/games/ghost-attack/ghost-attack.js','src/shared/farm-ice-art.js','src/games/chickens/chickens.js','src/games/fruit-memory/fruit-memory.js','src/games/shockwave/shockwave.js','src/games/color-switch/color-switch-mayan.js','src/games/color-switch/color-switch.js','src/games/pizza-time/pizza-ingredient-art.js','src/games/pizza-time/pizza-kitchen-art.js','src/games/pizza-time/pizza-time.js','party-arena-scenes.js','game-cover-art.js','src/games/shopping-time/shopping-time.js','src/games/knight-match/knight-match.js','src/games/boulder-bash/boulder-bash.js','src/games/snow-brawl/snow-brawl.js','src/games/witching-snake/witching-snake.js','reference-arena-art.js','src/games/lawn-mower/lawn-mower.js','src/games/color-claim/color-claim.js','src/games/ice-race/ice-race.js','src/games/gladiators/gladiators-art.js','src/games/gladiators/gladiators.js','board-map.js','board-v7-design.js','board-v7-art.js','board-branch-naming.js','board-v7-adapter.js','board-dice.js','board-dice-renderer.js','board-items.js','board-bots.js','board-minigame.js','board-party.js','board-art.js','app.js','auto-update.js','build-version.js','src/platform/board-items-brief.js','src/platform/runtime-deps.js','src/platform/host-runtime.js','src/platform/main-loader.js','src/platform/game-platform.js','src/platform/board-runtime.js',
 'assets/game-friends-cover.svg','assets/game-friends-icon.svg',
 'assets/game-friends-touch-icon.png','manifest.webmanifest'];
const seen=new Set();
html=html.replace(/\b(src|href)="(\.\/[^"?]+)(?:\?v=[^"]*)?"/g,
 (raw,attr,url)=>{
  const asset=url.slice(2);
  if(!assets.includes(asset))return raw;
  seen.add(asset);
  return attr+'="'+url+'?v='+encodeURIComponent(id)+'"';
 });
for(const asset of assets)if(!seen.has(asset))throw Error('Missing build asset: '+asset);
if(gameCatalog){
 const lazy=require('./lazy-game-scripts.cjs');
 html=lazy.pruneGameCover(lazy.pruneAppBoot(lazy.pruneHostCore(lazy.pruneExternal(lazy.pruneBoardCore(lazy.pruneLegacy(html,gameCatalog))))));
}
fs.writeFileSync(indexPath,html);
process.stdout.write('Static deploy '+id.slice(0,12)+'\n');
