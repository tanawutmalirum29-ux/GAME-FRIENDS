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
const id=getCommit();
fs.writeFileSync(path.join(root,'version.json'),JSON.stringify({version:id})+'\n');
fs.writeFileSync(path.join(root,'build-version.js'),
  'window.GAME_BUILD_VERSION='+JSON.stringify(id)+';\n');
const indexPath=path.join(root,'index.html');
let html=fs.readFileSync(indexPath,'utf8');
const assets=['style.css','arena-art.js','graveyard-art.js','combat-motion.js',
 'player-avatar.js','character-system.js','party-ui-art.js','ghost-attack.js','chickens.js','fruit-memory.js','shockwave.js','color-switch-mayan.js','color-switch.js','pizza-ingredient-art.js','pizza-time.js','app.js','auto-update.js','build-version.js',
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
fs.writeFileSync(indexPath,html);
process.stdout.write('Static deploy '+id.slice(0,12)+'\n');
