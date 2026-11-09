/* Browser-only compatibility fixture. Production and source index.html never
 * preload an individual game; older visual regressions intentionally do.
 * Generate the preload list from the SAME game manifests and ES entry imports
 * instead of maintaining a second manually named list of engines. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
function withLegacyGameFixtures(html){
 assert.equal(typeof html,'string');
 const scripts=['game-cover-art.js'];
 const games=path.join(root,'src/games');
 for(const entry of fs.readdirSync(games,{withFileTypes:true})){
  if(!entry.isDirectory())continue;
  const dir=path.join(games,entry.name);
  const meta=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
  if(!meta.global)continue; // Native plug-ins are always loaded by GamePlatform
  for(const dep of meta.legacyScripts||[])scripts.push(dep);
  const module=fs.readFileSync(path.join(dir,meta.entry.slice(2)),'utf8');
  const local=[...module.matchAll(/^\s*import\s+['"]\.\/([^'"]+\.js)['"];?/gm)].map(m=>m[1]);
  assert.ok(local.length,'Legacy plug-in must declare local engine imports: '+meta.id);
  for(const asset of local)scripts.push('src/games/'+entry.name+'/'+asset);
 }
 const unique=[...new Set(scripts)];
 for(const script of unique)assert.ok(fs.statSync(path.join(root,script)).isFile(),
  'Missing game fixture asset: '+script);
 const marker='  <script defer src="./app.js"></script>';
 assert.ok(html.includes(marker),'Missing source app entrypoint for legacy fixture');
 return html.replace(marker,unique.map(s=>'  <script defer src="./'+s+'"></script>').join('\n')+'\n'+marker);
}
module.exports={withLegacyGameFixtures};
