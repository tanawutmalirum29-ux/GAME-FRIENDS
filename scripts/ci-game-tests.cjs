'use strict';
// Discovery of game-owned Node regressions without editing workflow YAML for each game.
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const testDir=path.join(root,'tests');
function testFilesForGame(slug,files=fs.readdirSync(testDir)) {
 if(!/^[a-z0-9-]+$/.test(slug))throw Error('Unsafe game slug: '+slug);
 return files.filter(file=>file.startsWith(slug) &&
   (file[slug.length]==='-' || file[slug.length]==='.' ) &&
   /(?:\.cjs|\.test\.js)$/.test(file) &&
   !file.endsWith('-browser.cjs')).map(file=>'tests/'+file).sort();
}
function impactedGames(impact){
 if(impact.full || impact.mode!=='targeted')return [];
 return [...new Set(impact.areas.filter(a=>a.startsWith('game:')).map(a=>a.slice(5)))].sort();
}
function main(){
 const raw=process.env.QA_IMPACT_JSON;
 if(!raw)throw Error('Missing trusted QA_IMPACT_JSON; cannot selectively run game tests');
 const impact=JSON.parse(raw);
 const games=impactedGames(impact);
 if(!games.length){console.log('No game-specific Node tests required');return;}
 const existing=new Set(fs.readdirSync(path.join(root,'src/games'),{withFileTypes:true})
   .filter(e=>e.isDirectory()).map(e=>e.name));
 let ran=0,failed=0;
 for(const game of games){
   if(!existing.has(game))throw Error('Changed game folder missing: '+game);
   const files=testFilesForGame(game);
   if(!files.length){
     console.log('WARN: '+game+' has no named game-owned Node regression; platform + smoke remain required');
     continue;
   }
   for(const file of files){
     console.log('::group::'+file);
     const result=cp.spawnSync(process.execPath,[file],{
       cwd:root,stdio:'inherit',timeout:180000,env:process.env
     });
     ran++;
     if(result.status!==0||result.error){
       console.error('FAILED '+file, result.error || result.signal || result.status);
       failed++;
     }
     console.log('::endgroup::');
   }
 }
 console.log('AUTO-GAME QA: '+ran+' tests, '+failed+' failed ('+games.join(', ')+')');
 if(failed)process.exitCode=1;
}
if(require.main===module){
 try{main();}catch(error){console.error(error.stack||error);process.exitCode=1;}
}
module.exports={testFilesForGame,impactedGames};
