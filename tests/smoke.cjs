'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('app.js','utf8');
// Expose test-only readers inside the existing private IIFE without changing
// production code or relying on internal globals.
const appForTest=source.replace('requestAnimationFrame(animate);\n})();',
  'window.__ghostTest={getBoard:()=>boardSession,updateBoard,updateRound,beginBoard,showBoard,finishBoard,returnToLobby,getRound:()=>round,getPlayers:()=>players,renderLeaderboard,endRound,layoutFinalResults,resultVoteSnapshot,castResultVote,advanceParty,showCumulativeScores,pointsForRank,pickRandomEndlessGame,beginGameSelection,updateGameSelection,startRound,getSelection:()=>gameSelection,getTournament:()=>tournament,setRound:r=>{round=r;},possessBot,releaseBotPossession,toggleInfiniteBotItems,renderBotTestPad};\nrequestAnimationFrame(animate);\n})();');
assert.notEqual(appForTest,source,'test injection must find the IIFE footer');
const arenaSource=fs.readFileSync('arena-art.js','utf8');
const avatarSource=fs.readFileSync('player-avatar.js','utf8');
const characterSource=fs.readFileSync('character-system.js','utf8');
const boardCameraSource=fs.readFileSync('board-controller-camera.js','utf8');
const uiArtSource=fs.readFileSync('party-ui-art.js','utf8');
const pizzaArtSource=fs.readFileSync('src/games/pizza-time/pizza-ingredient-art.js','utf8');
const pizzaSource=fs.readFileSync('src/games/pizza-time/pizza-time.js','utf8');
const pizzaKitchenSource=fs.readFileSync('src/games/pizza-time/pizza-kitchen-art.js','utf8');
const partyArenaSource=fs.readFileSync('party-arena-scenes.js','utf8');
const gameCoverSource=fs.readFileSync('game-cover-art.js','utf8');
const shoppingSource=fs.readFileSync('src/games/shopping-time/shopping-time.js','utf8');
const knightSource=fs.readFileSync('src/games/knight-match/knight-match.js','utf8');
const boulderSource=fs.readFileSync('src/games/boulder-bash/boulder-bash.js','utf8');
const snowSource=fs.readFileSync('src/games/snow-brawl/snow-brawl.js','utf8');
const witchSource=fs.readFileSync('src/games/witching-snake/witching-snake.js','utf8');
const lawnSource=fs.readFileSync('src/games/lawn-mower/lawn-mower.js','utf8');
const gladiatorsArtSource=fs.readFileSync('src/games/gladiators/gladiators-art.js','utf8');
const gladiatorsSource=fs.readFileSync('src/games/gladiators/gladiators.js','utf8');
const iceRaceSource=fs.readFileSync('src/games/ice-race/ice-race.js','utf8');
const claimSource=fs.readFileSync('src/games/color-claim/color-claim.js','utf8');
const ghostSource=fs.readFileSync('src/games/ghost-attack/ghost-attack.js','utf8');
const farmIceSource=fs.readFileSync('src/shared/farm-ice-art.js','utf8');
const chickensSource=fs.readFileSync('src/games/chickens/chickens.js','utf8');
const fruitSource=fs.readFileSync('src/games/fruit-memory/fruit-memory.js','utf8');
const shockwaveSource=fs.readFileSync('src/games/shockwave/shockwave.js','utf8');
const mayanSource=fs.readFileSync('src/games/color-switch/color-switch-mayan.js','utf8');
const colorSwitchSource=fs.readFileSync('src/games/color-switch/color-switch.js','utf8');
const artSource=fs.readFileSync('src/shared/graveyard-art.js','utf8');
const combatSource=fs.readFileSync('combat-motion.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('style.css','utf8');

// Top HUD must clear the iPad status strip (even when CSS safe-area=0)
// and finish immediately above the field, including a compact 12-player row.
assert.match(css,/body\.host-playing #game \.game-center-hud\{\s*top:max\(24px,env\(safe-area-inset-top,0px\)\)/,
 'host roster starts below the iPad time/battery strip');
assert.match(css,/body\.host-playing #game \.game-toolbar\{\s*height:max\(96px,/,
 'top background strip stays flush with the field beneath the roster');
assert.doesNotMatch(source,/const ENGINE_CLOCK_MODES=/,
 'no engine-specific clocks should bypass the one central HUD');
assert.match(source,/const seconds=hostClockValue\(round,engine\)/,
 'every minigame routes its time through the same HUD dispatcher');
const hostClockSource=source.slice(source.indexOf('function hostClockValue('),
 source.indexOf('function drawGame(t)'));
assert.doesNotMatch(hostClockSource,/shockwave|fruit_memory/,
 'the central badge dispatcher may not hardcode any game IDs');
assert.match(shockwaveSource,/hudBadge:\{duringCountdown:"players",duringPlay:"players"\}/,
 'SHOCKWAVE must declare its own player-count badge policy');
assert.match(source,/window\.PartyArenaScenes\?\.clock\?\.\(g,seconds\)/,
 'other timed minigames use the Shopping/Knight clock badge');
for(const [name,body] of [
 ['CHICKENS',chickensSource],['COLOR SWITCH',colorSwitchSource],
 ['LAWN MOWER',lawnSource],['BOULDER BASH',boulderSource],
 ['SNOW BRAWL',snowSource],['FRUIT MEMORY',fruitSource]
]){
 assert.doesNotMatch(body.slice(body.lastIndexOf('function draw(')),/fillText\([^;]*?(?:เริ่มใน|เวลา\s*\+|วินาที)/,
  name+' should not have duplicate plaintext countdowns over the shared clock');
}
const shockwaveDraw=shockwaveSource.slice(shockwaveSource.lastIndexOf('function draw('));
assert.doesNotMatch(shockwaveDraw,/safeCount|ระเบิดใน|ปลอดภัย|เริ่มใน/,
 'SHOCKWAVE canvas has no explicit blast timer or safe-area count');

const hostLauncher=fs.readFileSync('host.html','utf8');
const rail=html.slice(html.indexOf('class="gamepad-top-actions"'),html.indexOf('</div>',html.indexOf('class="gamepad-top-actions"')));
const railIds=['controllerBoardZoomInBtn','controllerBoardZoomOutBtn','videoPreviewToggleBtn','videoQualityBtn'];
const indexes=railIds.map(id=>rail.indexOf('id="'+id+'"'));
assert.ok(indexes.every((i,k)=>i>=0&&(k===0||i>indexes[k-1])),
 'phone top rail order is zoom+ / zoom− / preview / graphics');
assert.ok(css.includes('#controllerBoardZoomInBtn{order:-3}')&&css.includes('#controllerBoardZoomOutBtn{order:-2}'),
 'CSS preserves zoom button order');
assert.ok(source.includes("t:'board-camera-zoom',direction"),
 'phone zoom buttons send the host a dedicated board-camera packet');
assert.ok(source.includes('conn.lastBoardCameraZoomAt'),
 'the host rate-limits remote zoom packets');
assert.ok(source.includes("window.BoardParty.current(boardSession)?.id!==conn.playerId"),
 'remote zoom requires ownership of the active BOARD turn');
assert.ok(source.includes("controllerBoard?.canZoom===true"),
 'controller zoom buttons remain hidden for spectators');
assert.ok(source.includes("controllerBoard?.canZoom!==true"),
 'phone client refuses zoom when the host has not granted permission');
assert.ok(source.includes("hostCanControlBoardZoom()"),
 'host toolbar and pinch must honor local turn ownership');
assert.match(css,/html:has\(body\.host-playing\),html:has\(body\.controller-playing\)\{/,
 'root scroller is locked while playing');
assert.ok(source.includes("e.target?.closest?.('#game')"),
 'non-passive game swipe handler prevents in-document rubber-banding');

// Cover/social assets are checked into GitHub: no external hotlink or
// missing favicon fallback that browsers would otherwise show as a globe.
assert.match(html,/<link rel="icon" type="image\/svg\+xml" sizes="any" href="\.\/assets\/game-friends-icon\.svg">/);
assert.match(html,/<link rel="apple-touch-icon" sizes="180x180" href="\.\/assets\/game-friends-touch-icon\.png">/);
assert.match(html,/<link rel="manifest" href="\.\/manifest\.webmanifest">/);
assert.match(html,/<meta property="og:image" content="https:\/\/raw\.githubusercontent\.com\/tanawutmalirum29-ux\/GAME-FRIENDS\/main\/assets\/game-friends-social\.png">/);
assert.match(html,/<meta property="og:image:width" content="1200">/);
assert.match(html,/<meta property="og:image:height" content="630">/);
assert.match(html,/name="twitter:card" content="summary_large_image"/);
assert.match(html,/<img class="hero-cover" src="\.\/assets\/game-friends-cover\.svg"/);
assert.match(css,/#home \.hero-cover\{/);
assert.match(html,/<section class="hero">\s*<div class="hero-content">/,
 'home text and actions must be grouped separately from the cover');
assert.match(html,/<\/div>\s*<img class="hero-cover" src="\.\/assets\/game-friends-cover\.svg"/,
 'cover must be its own sized grid item, not appended to a tall text column');
assert.match(css,/body:has\(#home:not\(\.hidden\)\) \.app\{[\s\S]*?height:100dvh;[\s\S]*?overflow:hidden!important;/,
 'home page must fit a single dynamic browser viewport with no document scroll');
assert.match(css,/#home\.party-entry\{[\s\S]*?flex:1 1 0;[\s\S]*?min-height:0;/,
 'home grid must shrink within height left by browser top bar and footer');

assert.match(css,/#home\.party-entry\{[\s\S]*?grid-template-rows:minmax\(0,1fr\);[\s\S]*?align-content:stretch;/,
 'homepage row must stretch to fill available viewport rather than retain auto height at the top');
assert.match(css,/#home\.party-entry \.hero:has\(\.hero-cover\)\{[\s\S]*?height:100%;[\s\S]*?overflow:hidden!important;/,
 'hero fills its expanded viewport grid row without requiring scrolling');
assert.match(css,/@media \(min-width:1120px\) and \(min-height:580px\)\{[\s\S]*?grid-template-columns:minmax\(0,\.81fr\) minmax\(0,1\.29fr\);/,
 'large landscape screens devote extra width to the fully visible cover');

assert.match(css,/#home\.party-entry \.hero:has\(\.hero-cover\)\{[\s\S]*?grid-template-columns:minmax\(0,\.94fr\) minmax\(0,1\.16fr\);[\s\S]*?grid-template-rows:minmax\(0,1fr\);/,
 'landscape host page uses bounded side-by-side cover instead of an overflowing image below actions');
assert.match(css,/#home\.party-entry \.hero \.hero-cover\{[\s\S]*?height:100%;[\s\S]*?max-height:100%;[\s\S]*?object-fit:contain;/,
 'entire six-game cover must be contained without any cropping');
assert.match(css,/@media\(orientation:portrait\) and \(max-width:1100px\), \(max-width:620px\)\{[\s\S]*?grid-template-rows:auto minmax\(0,1fr\);/,
 'portrait devices allocate leftover viewport height to the cover below controls');
assert.match(css,/@media\(orientation:landscape\) and \(max-width:620px\)\{[\s\S]*?grid-template-columns:minmax\(0,\.95fr\) minmax\(0,1\.05fr\);/,
 'short narrow landscape keeps a side-by-side arrangement');

const coverSvg=fs.readFileSync('assets/game-friends-cover.svg','utf8');
const iconSvg=fs.readFileSync('assets/game-friends-icon.svg','utf8');
assert.match(coverSvg,/<svg[^>]*viewBox="0 0 1200 630"/);
assert.match(coverSvg,/GAME FRIENDS/);
assert.match(coverSvg,/FRUIT MEMORY/);
assert.match(coverSvg,/COLOR SWITCH/);
assert.match(coverSvg,/PIZZA TIME/);
assert.match(iconSvg,/<svg[^>]*viewBox="0 0 64 64"/);
const sharePng=fs.readFileSync('assets/game-friends-social.png');
assert.equal(sharePng.subarray(0,8).toString('hex'),'89504e470d0a1a0a','social preview must be valid PNG');
assert.equal(sharePng.readUInt32BE(16),1200,'social preview has 1200px width');
assert.equal(sharePng.readUInt32BE(20),630,'social preview has 630px height');
const touchPng=fs.readFileSync('assets/game-friends-touch-icon.png');
assert.equal(touchPng.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
assert.equal(touchPng.readUInt32BE(16),180);
assert.equal(touchPng.readUInt32BE(20),180);
const appManifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
assert.equal(appManifest.short_name,'GAME FRIENDS');
assert.equal(appManifest.start_url,'./','controller install still starts at the normal root');
const hostManifest=JSON.parse(fs.readFileSync('host.webmanifest','utf8'));
assert.equal(hostManifest.id,'./host.html','HOST is a separate installable Web App');
assert.equal(hostManifest.start_url,'./host.html','HOST icon opens the stable launch document');
assert.equal(hostManifest.display,'standalone');
assert.notEqual(new URL(hostManifest.start_url,'https://game.example/').href,
 new URL(appManifest.start_url,'https://game.example/').href,
 'controller and host installed shortcuts may not launch the same URL');
assert.match(hostLauncher,/rel="manifest" href="\.\/host\.webmanifest"/);
assert.match(hostLauncher,/id="openHostBtn" href="\.\/\?host=1"/);
assert.match(hostLauncher,/navigator\.standalone===true/,'installed iPad host launches directly');
assert.match(html,/get\('host'\)==='1'[\s\S]*host\.webmanifest/,
 'direct /?host=1 install also selects the HOST manifest');
const hostInline=hostLauncher.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(hostInline,'host installation has a standalone-launch bootstrap');
function hostLaunch(standalone,pathname='/host.html'){
 const href='https://game.example'+pathname,redirects=[];
 const location={href,search:new URL(href).search,replace(u){redirects.push(u);}};
 vm.runInNewContext(hostInline,{
  navigator:{standalone},location,URL,URLSearchParams,
  matchMedia:q=>({matches:standalone&&q.includes('standalone')})
 });
 return redirects;
}
assert.deepEqual(hostLaunch(false),[],'regular Safari stays on /host.html for Add to Home Screen');
assert.deepEqual(hostLaunch(true),['https://game.example/?host=1'],
 'installed HOST icon navigates straight into the real host room');
assert.deepEqual(hostLaunch(false,'/host.html?launch=1'),['https://game.example/?host=1'],
 'explicit launch also enters the host without visiting the controller');
assert.ok(appManifest.icons.some(icon=>icon.src==='./assets/game-friends-icon.svg'));
assert.ok(appManifest.icons.some(icon=>icon.src==='./assets/game-friends-touch-icon.png'));

// Source HTML only bootstraps the registry. Games and the phone picker are
// discovered from their own manifests, never enumerated as HTML script tags.
assert.match(html,/id="phoneGameChoices"/);
assert.match(html,/src="\.\/src\/platform\/game-platform\.js"/);
assert.doesNotMatch(html,/data-pick="/,'phone picker buttons must be runtime-created');
assert.doesNotMatch(html,/src="\.\/src\/games\//,
 'minigame engines must download only when selected');
assert.doesNotMatch(html,/src="\.\/src\/shared\/(?:farm-ice-art|graveyard-art)\.js"/,
 'shared game scenery is a pinned per-game asset, not an eager dependency');
assert.doesNotMatch(html,/src="\.\/game-cover-art\.js"/,'legacy cover art must not load on boot');
assert.match(source,/button\.dataset\.pick=id/,
 'the app must render buttons directly from the discovered game metadata');
assert.match(artSource,/window\.GhostCemeteryArt=Object\.freeze/);
assert.match(html,/src="\.\/combat-motion\.js"/,'shared combat runtime remains in the Host shell');
assert.match(combatSource,/window\.PartyCombatMotion=/);
assert.doesNotMatch(html,/src="\.\/minigames\.js"/);
assert.equal(fs.existsSync('minigames.js'),false,'delete legacy game engine');
assert.doesNotMatch(source,/window\.PartyMiniGames|function spawnStar|function drawBackdrop/);
const legacyManifests=fs.readdirSync('src/games',{withFileTypes:true})
 .filter(entry=>entry.isDirectory())
 .map(entry=>JSON.parse(fs.readFileSync('src/games/'+entry.name+'/manifest.json','utf8')))
 .filter(game=>typeof game.global==='string'&&game.global.length>0);
const legacyModeNames=Object.fromEntries(legacyManifests.map(game=>[game.id,game.name]));
assert.equal(legacyManifests.length,15,'all original games retain their own manifest');
assert.match(source,/const LEGACY_GAME_DATA=Object\.freeze\(\{/);
assert.match(source,/const MODES=Object\.fromEntries\(Object\.entries\(LEGACY_GAME_DATA\)/,
 'game picker must obtain labels from compiled game-owned metadata');
for(const game of legacyManifests){
 assert.ok(source.includes(JSON.stringify(game.id)),'compiled metadata includes '+game.id);
 assert.ok(source.includes(JSON.stringify(game.name)),'compiled metadata keeps '+game.id+' title');
}
assert.match(source,/const MAX_PLAYERS = 12;/);
assert.match(source,/window\.GamePlatform\?\.descriptor\(mode\)\?\.coverUrl/);
assert.match(source,/window\.PartyGameCovers\?\.svg\?\.\(mode\)/,'development keeps SVG fallback');
assert.match(css,/\.mode-cover img\{display:block;width:100%;height:100%;object-fit:contain;\}/);
assert.doesNotMatch(gameCoverSource,/<(?:text|tspan)\b/i,'SVG cover art never duplicates game names');
assert.match(source,/label\.textContent=MODES\[mode\]/,'game title remains outside each illustration');
const pauseMarkup=html.match(/<button id="pauseBtn"[\s\S]*?<\/button>/)?.[0];
assert.ok(pauseMarkup,'host pause control is present');
assert.match(pauseMarkup,/<svg\b/,'host pause button retains its SVG icon');
assert.match(pauseMarkup,/aria-label="หยุดเกม"/,'icon-only pause remains screen-reader accessible');
assert.doesNotMatch(pauseMarkup,/<span\b|หยุดเกม<\/span>/,'pause control has no visible caption');
assert.ok(css.includes('span.leader-item-slot:not(.leader-held-icon):not(.pizza-order-icons)'),
 'text status slots are not restricted to the 23px item icon');
assert.match(css,/body\.host-playing #game \.leader-chip span\.leader-held-icon\{[\s\S]*?width:23px;/,
 'actual item SVG badges keep their compact dimensions');

assert.match(html,/data-session-mode="queue"/);
assert.match(html,/data-session-mode="endless"/);
assert.match(html,/เล่นทุกเกมไปเรื่อยๆ/);
assert.match(html,/id="cycleAllBotsBtn"/);
assert.match(html,/id="bulkBotPicker"[^>]*role="dialog"/);
assert.match(html,/id="bulkBotPickerChoices"/);
assert.match(html,/id="bulkBotPickerClose"/);
assert.match(css,/#bulkBotPicker \.bulk-bot-picker-choices\{/);
assert.match(css,/#bulkBotPicker \.bulk-bot-game-choice\{/);
assert.doesNotMatch(html,/id="iosFullscreenBtn"/,'no obsolete iOS fake fullscreen button');
assert.match(html,/apple-mobile-web-app-capable/,'standalone iPad Web App metadata is required');
assert.doesNotMatch(source,/avoidIOSNativeFullscreen|canUseNativeHostFullscreen|iosNativeFullscreenEnabled|IOS_FULLSCREEN_PREF/);
assert.match(css,/#hostLobby \.lobby-section-title \.bulk-bot-switch\{/);
assert.match(html,/id="uiModal"/);
assert.doesNotMatch(source,/\b(?:alert|confirm)\(/);
assert.match(css,/#hostLobby #hostQueue\{display:none!important\}/);
assert.match(css,/#hostLobby \.lobby-roster \.roster-pick\.picked\{[\s\S]*?display:flex;/);
// All minigames use the host's single shared centre badge, never a solid
// top-left obstacle or a second engine-specific text overlay.
assert.doesNotMatch(html,/id="gameMode"|id="timer"|class="game-name"/);
assert.doesNotMatch(source,/\$\('gameMode'\)|\$\('timer'\)/);
assert.doesNotMatch(ghostSource,/function drawCornerHud\(ctx,round,players,state\)/);
assert.doesNotMatch(ghostSource,/kind:'hud-blocker'/);
assert.match(partyArenaSource,/function hudBadgeDrop\(\)/);
assert.match(css,/body\.host-playing #game \.leader-chip\{[\s\S]*?grid-template-rows:17px 16px 18px/);
assert.match(css,/body\.host-playing #game \.leaderboard\{[\s\S]*?height:58px!important/);
assert.match(css,/body\.host-playing #game \.leader-chip span\.leader-held-icon\{/);
assert.match(ghostSource,/itemSlot\.classList\.add\('leader-held-icon'\)/);
assert.doesNotMatch(source,/leader-held-item/);
assert.doesNotMatch(css,/leader-held-item/);
assert.match(ghostSource,/function drawPickupNotice\(ctx,p,w,h\)/);
assert.match(ghostSource,/p\.pickupNoticeTime=2\.1/);
assert.match(source,/root\.style\.setProperty\('--leader-count'/);
assert.doesNotMatch(html,/กฎการจบเกม/,'remove redundant end rules panel');
assert.doesNotMatch(html,/id="duration"/);
assert.match(html,/id="controllerInventory"/);
assert.match(html,/<div class="gamepad-hud">[\s\S]*?<div id="controllerInventory" class="controller-inventory hidden"[\s\S]*?<div class="gamepad-top-actions">/,
  'game-specific inventory starts hidden and lives in the top header');
assert.equal([...html.matchAll(/id="controllerInventory"/g)].length,1);
assert.match(html,/<button[^>]*data-control="alt"[^>]*>[\s\S]*?<span class="face-button-letter">B<\/span><span id="buttonBLabel" class="face-caption">/);
assert.match(html,/<button[^>]*data-control="action"[^>]*>[\s\S]*?<span class="face-button-letter">A<\/span><span id="buttonALabel" class="face-caption">/);
assert.match(html,/<button[^>]*data-control="cancel"[^>]*>[\s\S]*?<span class="face-button-letter">C<\/span><span id="buttonCLabel" class="face-caption">/);
assert.ok(html.indexOf('class="face-button-wrap face-c"')>html.indexOf('class="face-button-wrap face-b"'),'C is after B in the phone controller');
assert.match(css,/\.controller-buttons\.board-bomber-aim:not\(\.shockwave-mode\) \.gamepad-face-buttons\{/);
assert.match(css,/\.gamepad-face-buttons \.face-c\{[\s\S]*?grid-row:3;/);
assert.match(css,/#controller #controllerActive #controllerInventory\.hidden\{\s*display:none!important/);
assert.match(css,/#controller #controllerActive \.gamepad-preview-column\{\s*transform:translateX\(clamp\(18px,3\.15vw,56px\)\)/,
  'preview is translated to the right without changing width or height');
assert.match(css,/#controller #controllerActive \.face-button \.face-caption\{[\s\S]*?position:static!important/);
assert.match(css,/--gf-controller-visible-width,100dvw/,'Safari controller uses the visual viewport bounds');
assert.match(css,/grid-template-columns:minmax\(0,1fr\) clamp\(92px,17vw,152px\)!important/);
assert.match(css,/width:min\(100%,var\(--gf-face-diameter\)\)!important/);
assert.match(source,/function syncControllerVisibleViewport\(/);
assert.match(source,/window\.visualViewport\?\.addEventListener\?\.\('resize',syncControllerVisibleViewport\)/);
assert.match(html,/id="targetCycleControls"/);
assert.match(html,/id="targetPrevBtn"/);
assert.match(html,/id="targetNextBtn"/);
assert.ok(html.indexOf('class="face-button-wrap face-b"')<html.indexOf('id="targetCycleControls"'),
  'slow target controls live after B in DOM');
assert.match(css,/#joystickZone\{[\s\S]*?grid-column:1 \/ -1;/);
assert.match(css,/#phoneGameChoices \.phone-game-choice\.selected\{/);
assert.match(css,/\.gamepad-face-buttons \.target-cycle-controls\{[\s\S]*?order:2;/);
assert.match(source,/const travel=64;/);
assert.match(css,/\.gamepad-face-buttons\{\s*pointer-events:none;/);
assert.match(css,/\.gamepad-face-buttons \.face-button\s*,[\s\S]*?pointer-events:auto;/);
assert.match(css,/\.gamepad-preview-column #videoStartBtn\{\s*pointer-events:auto;/);
assert.match(css,/#controllerActive \.target-cycle-controls/);
assert.match(css,/#controller #controllerInventory/);
assert.match(css,/body\.controller-playing #controllerActive #phoneGameChoices/);
assert.match(css,/html,body\{\s*height:100%;width:100%;margin:0;\s*overflow:hidden!important/);
assert.match(hostLauncher,/\?host=1/);
assert.match(html,/id="joinLandscapeBtn"/);
assert.match(source,/function tryLandscapeOrientation\(/);
assert.match(source,/request\.then\(tryLandscapeOrientation,tryLandscapeOrientation\)/);
assert.match(source,/width:256,height:256,correctLevel:QRCode\.CorrectLevel\.M/);
assert.match(css,/#hostLobby \.qr-share-stack \.qr-box\{\s*flex:0 0 auto;\s*aspect-ratio:1 \/ 1;/);
assert.match(css,/body\.host-playing #game\.game-page\{[\s\S]*?rotate\(90deg\)/);
assert.match(css,/#controller #joinForm \.join-orientation/);
assert.doesNotMatch(source,/document\.exitFullscreen\(/);
assert.match(source,/const root=document\.documentElement;/);

// Engine unit tests: deterministic rules are exercised without any browser.
const loadedImages=[];
class FakeSvgImage{
 constructor(){this.complete=false;this.naturalWidth=0;loadedImages.push(this);}
 set src(v){this._src=v;this.complete=true;this.naturalWidth=v.startsWith('data:image/svg+xml')?64:0;}
 get src(){return this._src;}
}
const ghostSandbox=vm.createContext({window:{},Image:FakeSvgImage});
vm.runInContext(arenaSource,ghostSandbox,{filename:'arena-art.js'});
vm.runInContext(combatSource,ghostSandbox,{filename:'combat-motion.js'});
vm.runInContext(artSource,ghostSandbox,{filename:'src/shared/graveyard-art.js'});
vm.runInContext(avatarSource,ghostSandbox,{filename:'player-avatar.js'});
vm.runInContext(characterSource,ghostSandbox,{filename:'character-system.js'});
vm.runInContext(uiArtSource,ghostSandbox,{filename:'party-ui-art.js'});
vm.runInContext(ghostSource,ghostSandbox,{filename:'src/games/ghost-attack/ghost-attack.js'});
const ghost=ghostSandbox.window.GhostAttack;
const art=ghostSandbox.window.GhostCemeteryArt;
// Both map variants render larger ghosts, while humans and physics retain
// their original dimensions. Red names apply to NPC ghosts and converted players.
assert.match(ghostSource,/GHOST_VISUAL_SCALE=1\.26/);
assert.match(ghostSource,/GHOST_NAME_COLOR='#ff454f'/);
assert.match(ghostSource,/ctx\.fillStyle=ghost\?GHOST_NAME_COLOR:'#fff'/);
assert.match(ghostSource,/name\.style\.color='#ff454f'/);
assert.match(ghostSource,/const PLAYER_BODY_RADIUS=16/);
for(const theme of ['graveyard','egypt']){
 const scales=[];
 const probe={save(){},restore(){},translate(){},rotate(){},drawImage(){},
   scale(x,y){scales.push([x,y]);}};
 art.drawActor(probe,{x:120,y:140,vx:0,vy:0,dir:{x:0,y:-1}},
   '#ff628c',true,1,theme,1.26);
 assert.deepEqual(scales,[[1.26,1.26]],'ghost sprite is 26% larger in '+theme);
}
const mkPlayers=n=>Array.from({length:n},(_,i)=>({
 id:'p'+i,name:'Tester '+i,color:['#ff628c','#3fe4ef','#ffcf62','#ae94ff'][i%4],
 type:'remote',active:true,input:{},alive:true,score:0
}));
const init=n=>{const players=mkPlayers(n),round={mode:'ghost',phase:'countdown'};
 ghost.setup(round,players);return {round,players,state:round.ghost};};
for(const n of [1,4,5,6,7,8,9,12]){
 const x=init(n);
 assert.equal(x.state.npcs.length,1,'one starting ghost at every player count');
 assert.equal(x.state.world.w,n<=6?1080:1280);
 assert.equal(x.state.world.h,n<=6?608:720);
 assert.equal(x.round.rules.viewMode,'topdown');
 assert.ok(x.state.obstacles.length>=5,'authored cemetery obstacles remain');
 assert.ok(!x.state.obstacles.some(o=>o.kind==='hud-blocker'),
   'removed upper-left HUD must have no invisible collision rectangle');
 assert.equal(x.state.hudBlocker,undefined,'obsolete HUD collision state is absent');
 assert.ok(['graveyard','egypt'].includes(x.state.theme));
 const kinds=art.kindsForTheme(x.state.theme);
 assert.ok(x.state.obstacles.every(o=>kinds.includes(o.kind)),
   'all visual props match the randomly selected arena theme');
 const signature=x.state.theme==='egypt'?'sarcophagus':'coffin';
 assert.equal(x.state.obstacles[0].kind,signature,
   'the first large monument makes the chosen theme obvious');
 assert.ok(x.state.obstacles.every(o=>o.x>=0&&o.y>=0));
 assert.equal(x.players.filter(p=>p.active&&!p.ghost).length,n);
 assert.ok(x.state.obstacles.every(o=>o.w>0&&o.h>0&&o.fixed),
  'monuments, fences and perimeter use authored collision bounds');
 assert.equal(x.state.obstacles.filter(o=>o.boundary).length,4);
 for(const p of x.players){
  assert.ok(p.x>0&&p.x<x.state.world.w&&p.y>0&&p.y<x.state.world.h);
  assert.equal(p.item,null);
  assert.ok(!x.state.obstacles.some(o=>o.kind==='hud-blocker'));
 }
}
{
 // The deleted left-side panel must not continue blocking steering or spawns.
 const x=init(9);
 assert.equal(x.state.hudBlocker,undefined);
 assert.ok(x.state.obstacles.every(o=>o.kind!=='hud-blocker'));
}
// GHOST ATTACK props are STATIC for the same theme/arena/tier. Every
// monument receives a stable ID matching the collision rectangle, while
// human/ghost spawns continue to be random.
for(const n of [1,4,5,6,7,8,9,12]){
 const signatures=new Map();
 for(let repeat=0;repeat<4;repeat++){
  const players=mkPlayers(n),round={mode:'ghost',phase:'countdown'};
  ghost.setup(round,players);
  const state=round.ghost,info=ghost.mapInfo(round);
  assert.ok(['สุสานผี','อียิปต์ฟาโรห์'].includes(info.name));
  assert.equal(info.width,n<=6?1080:1280);
  assert.equal(info.height,n<=6?608:720);
  assert.equal(info.id,state.mapId);
  assert.equal(info.count,state.obstacles.length);
  const signature=JSON.stringify(state.obstacles);
  if(signatures.has(info.theme))
   assert.equal(signature,signatures.get(info.theme),
    'same-themed and same-sized map must never reshuffle '+n+' players');
  else signatures.set(info.theme,signature);
  const ids=state.obstacles.map(o=>o.id);
  assert.equal(new Set(ids).size,ids.length,'every prop has one unique ID');
  assert.ok(!ids.includes('HUD-00'),'obsolete HUD-00 ID is gone');
  state.obstacles.forEach((o,index)=>{
   const prefix=info.theme==='egypt'?'EG':'GY';
   if(o.boundary)assert.match(o.id,new RegExp('^'+prefix+'-R[NSEW]$'));
   else assert.equal(o.id,prefix+'-'+String(index+1).padStart(2,'0'));
   const found=ghost.obstacleAt(round,o.x+o.w/2,o.y+o.h/2);
   assert.equal(found.id,o.id,'tap lookup hits the real collision rectangle');
   assert.equal(found.kind,o.kind);assert.equal(found.w,o.w);assert.equal(found.h,o.h);
  });
  assert.equal(ghost.obstacleAt(round,-10,-10),null);
  assert.equal(state.showObstacleIds,false,'normal players never see QA labels');
  assert.equal(state.selectedObstacleId,null);
 }
 assert.equal(signatures.size,2,'both ghost themes get stable layouts');
}
// The new v4 courtyards replace the previous annotated cemetery geometry.
// Detailed connectivity, collision and bot regressions live in ghost-courtyards.cjs.
{
 const x=init(6);
 assert.match(x.state.mapId,/-v4$/);
 const realProps=x.state.obstacles.filter(o=>!o.boundary&&o.kind!=='hud-blocker');
 const drawings=[];
 const ctx={save(){},restore(){},drawImage(image,x,y,w,h){drawings.push({x,y,w,h});},
  fillRect(){},strokeRect(){}};
 if(x.state.theme!=='graveyard'){ghost.setup(x.round,x.players);x.state=x.round.ghost;}
 const coffin=x.state.obstacles.find(o=>o.artType==='single-large-coffin');
 assert.ok(coffin,'authored cemetery contains full-length coffins');
 art.drawObstacle(ctx,coffin);
 assert.equal(drawings.length,1,'one coffin image, no tiling');
 assert.deepEqual(Object.values(drawings[0]),[coffin.x,coffin.y,coffin.w,coffin.h]);
 assert.ok(realProps.length>=13,'both themes include monuments and real barriers');
}

// No three-size legacy split: graveyard and Egypt share two stable arena sizes.
{
 const sizes=new Set();
 for(let n=1;n<=12;n++){
  const x=init(n),firstTheme=x.state.theme;
  sizes.add(x.state.world.w+'x'+x.state.world.h);
  assert.equal(x.state.tier,n<=6?1:2,'tier boundary is six players');
  assert.equal(x.state.world.w,n<=6?1080:1280);
  assert.equal(x.state.world.h,n<=6?608:720);
  ghost.setup(x.round,x.players);
  const alternate=x.round.ghost;
  assert.notEqual(firstTheme,alternate.theme,'alternating themes are both tested');
  assert.equal(alternate.world.w,n<=6?1080:1280);
  assert.equal(alternate.world.h,n<=6?608:720);
  assert.equal(alternate.tier,n<=6?1:2);
 }
 assert.equal(sizes.size,2,'exactly two supported GHOST ATTACK sizes');
 assert.ok(sizes.has('1080x608')&&sizes.has('1280x720'));
}
assert.equal(ghost.constants.humanSpeed,172);
assert.equal(ghost.constants.ghostSpeed,186,'modest ghost speed advantage');
assert.ok(ghost.constants.ghostSpeed>ghost.constants.humanSpeed);
assert.ok(ghost.constants.ghostSpeed/ghost.constants.humanSpeed<1.10,
  'ghosts must not become unfairly fast');
assert.equal(ghost.constants.cloakTime,2);
assert.equal(ghost.ITEM_NAMES.slow,'ยาสโลว์เพื่อน');
assert.equal(Object.keys(ghost.ITEM_SVG).length,5);
assert.equal(art.KINDS.length,20);
assert.equal(art.GRAVEYARD_KINDS.length,10);
assert.equal(art.EGYPT_KINDS.length,10);
assert.ok(art.KINDS.includes('coffin')&&art.KINDS.includes('plaque'));
assert.ok(art.EGYPT_KINDS.includes('sarcophagus')&&art.EGYPT_KINDS.includes('pharaoh-bust'));
assert.equal(art.pickTheme('',()=>0),'graveyard');
assert.equal(art.pickTheme('',()=>.9999),'egypt');
assert.equal(art.pickTheme('graveyard',()=>0),'egypt');
assert.equal(art.pickTheme('egypt',()=>0),'graveyard');
assert.equal(art.themeLabel('egypt'),'อียิปต์ฟาโรห์');
assert.notEqual(art.lootSVG('egypt'),art.lootSVG('graveyard'),
  'loot chests have their own art in each theme');
assert.match(art.actorSVG(false,'#ff628c','walk0'),/<svg/);
assert.notEqual(art.actorSVG(false,'#ff628c','walk0'),
  art.actorSVG(false,'#ff628c','walk2'),'moving legs use distinct SVG frames');
assert.match(art.actorSVG(true,'#f5faff','float0'),/<svg/);
const cemeteryGhost=art.actorSVG(true,'#ff628c','float0','graveyard');
const pharaohGhost=art.actorSVG(true,'#ff628c','float0','egypt');
assert.match(pharaohGhost,/data-actor="pharaoh-ghost"/,
  'Egyptian ghosts wear the pharaoh headdress');
assert.match(pharaohGhost,/url\(#nemes\)/,
  'Egyptian ghost crown uses lapis-blue nemes cloth');
assert.notEqual(cemeteryGhost,pharaohGhost,'themes have unique ghost art');
assert.notEqual(pharaohGhost,art.actorSVG(true,'#3fe4ef','float0','egypt'),
  'each converted player retains its character color');
assert.notEqual(pharaohGhost,art.actorSVG(true,'#ff628c','float1','egypt'),
  'pharaoh ghosts have independent animation frames');
assert.equal(art.getActorImage(true,'#ff628c','float0','egypt'),
  art.getActorImage(true,'#ff628c','float0','egypt'),
  'pharaoh ghost frame is cached');
assert.notEqual(art.getActorImage(true,'#ff628c','float0','egypt'),
  art.getActorImage(true,'#ff628c','float0','graveyard'),
  'image cache never mixes ghosts between themes');
assert.notEqual(art.obstacleSVG('coffin',0),art.obstacleSVG('headstone',0));
assert.match(art.obstacleSVG('sarcophagus',0),/<svg[\s>]/);
assert.match(art.obstacleSVG('egypt-obelisk',1),/<svg[\s>]/);
assert.notEqual(art.obstacleSVG('pharaoh-bust',1),
  art.obstacleSVG('sandstone-pillar',1));
assert.equal(art.getObstacleImage('coffin',0),art.getObstacleImage('coffin',0),
  'coffin SVG is cached');
assert.equal(art.getObstacleImage('sarcophagus',1),
  art.getObstacleImage('sarcophagus',1),'Egypt SVG is cached');
assert.equal(art.getLootImage('egypt'),art.getLootImage('egypt'),
  'Egypt-themed crate image stays cached');
assert.ok(loadedImages.length>=5,'preloaded item and cemetery art SVGs');
assert.equal(ghost.getItemIconImage('boost'),ghost.getItemIconImage('boost'));
{
 // Every new round changes the inner arena theme, but retains the same
 // fixed game mode, player capacity and unchanged external game cover.
 const first=init(9),second=init(9),third=init(9);
 assert.notEqual(second.state.theme,first.state.theme);
 assert.notEqual(third.state.theme,second.state.theme);
 for(const x of [first,second,third]){
  if(x.state.theme==='egypt'){
    // Egyptian actor images are preloaded in both the NPC and every user's
    // converted-ghost colors, preventing blank first frames in gameplay.
    const testNPC=art.getActorImage(true,'#f5faff','float0','egypt');
    assert.ok(testNPC.complete&&testNPC.naturalWidth>0);
    for(const p of x.players)
      for(const pose of ['float0','float1','float2'])
        assert.ok(art.getActorImage(true,p.color,pose,'egypt').complete);
  }
  assert.equal(x.state.npcs.length,1,'both themes start with one ghost');
  assert.equal(x.state.world.w,1280,'crowded arena size unchanged');
  const before=x.state.theme;
  x.round.phase='playing';x.state.npcs.forEach(n=>n.stun=999);
  ghost.update(.016,x.round,x.players);
  assert.equal(x.state.theme,before,'theme remains fixed during the round');
 }
}


// Hunting AI predicts paths and assigns distinct pack roles. Ghost bots
// continue to use the same velocity physics, with NO punch or teleporting.
{
 const x=init(4);x.round.phase='countdown';
 const [runner,botA,botB,remote]=x.players;
 x.state.obstacles=[];
 runner.x=500;runner.y=295;runner.vx=160;runner.vy=0;
 remote.x=900;remote.y=490;
 botA.isBot=true;botA.ghost=true;botA.stun=0;botA.botMind=null;
 botA.x=340;botA.y=300;
 botB.isBot=true;botB.ghost=true;botB.stun=0;botB.botMind=null;
 botB.x=285;botB.y=355;
 const npc=x.state.npcs[0];
 npc.x=295;npc.y=245;npc.stun=0;
 ghost.update(.016,x.round,x.players);
 const hunters=[npc,botA,botB];
 const roles=hunters.map(h=>h.huntRole);
 const chaseHunter=hunters.find(h=>h.huntRole==='chase');
 ghost.update(.45,x.round,x.players);
 assert.equal(chaseHunter.huntRole,'chase',
   'pack roles stay stable between pursuit plans');
 assert.ok(roles.includes('chase'),'one hunter presses from behind');
 assert.ok(roles.includes('intercept'),'another hunter runs to the exit');
 assert.ok(roles.includes('flank-left'),'the third cuts a side escape route');
 const cutOff=hunters.find(h=>h.huntRole==='intercept');
 assert.ok(cutOff.huntGoal.x>runner.x,
   'interceptor goes AHEAD of the moving survivor, not behind');
 assert.equal(botA.input.action,false,'converted bot ghost never punches');
 assert.equal(botB.input.action,false,'other converted ghost never punches');
}
{
 // Larger packs split into groups rather than piling all ghosts on one prey.
 const x=init(5);x.round.phase='countdown';x.state.obstacles=[];
 const [runnerA,runnerB,...bots]=x.players;
 runnerA.x=340;runnerA.y=240;runnerB.x=860;runnerB.y=475;
 const npc=x.state.npcs[0];npc.x=180;npc.y=220;npc.stun=0;
 bots.forEach((p,i)=>{
  p.isBot=true;p.ghost=true;p.stun=0;p.botMind=null;
  p.x=270+i*70;p.y=300+i*20;
 });
 ghost.update(.016,x.round,x.players);
 const targets=[npc,...bots].map(p=>p.huntTargetId);
 assert.equal(new Set(targets).size,2,'four ghosts split to intercept two survivors');
}
// Bots use threat-aware movement, activate speed items and seek loot.
{
 const x=init(3);x.round.phase='playing';x.state.ghostSpawned=true;
 const p=x.players[0];p.isBot=true;p.botMind=null;
 x.players[1].x=800;x.players[1].y=430;
 x.players[2].x=700;x.players[2].y=400;
 p.x=300;p.y=250;
 const npc=x.state.npcs[0];
 npc.x=385;npc.y=250;npc.stun=0;x.state.obstacles=[];
 p.item='boost';
 ghost.update(.016,x.round,x.players);
 assert.ok(p.input.axisX<0,'bot runs away from ghost');
 assert.equal(p.input.alt,true,'bot activates speed boost to flee');
 assert.equal(p.item,null,'used item is consumed');
 npc.stun=999;x.state.boxes=[{x:p.x+100,y:p.y,ttl:8,item:'cloak'}];
 ghost.update(.016,x.round,x.players);
 assert.ok(p.input.axisX>.4,'bot seeks loot when the ghost is stunned');
}
// Corridor escape: the AI must navigate around a solid wall, without
// frame-by-frame left/right oscillation.
{
 const x=init(3);x.round.phase='playing';x.state.ghostSpawned=true;
 const [p,q,r]=x.players;p.isBot=true;p.botMind=null;
 p.x=320;p.y=265;q.x=850;q.y=80;r.x=820;r.y=450;
 x.state.obstacles=[{x:355,y:145,w:85,h:250,style:0}];
 x.state.npcs.forEach(g=>g.stun=999);
 x.state.boxes=[{x:520,y:265,ttl:30,item:'cloak'}];
 let flips=0,lastX=0;
 for(let i=0;i<130;i++){
   ghost.update(.05,x.round,x.players);
   const sign=Math.sign(p.input.axisX||0);
   if(lastX&&sign&&sign!==lastX)flips++;
   if(sign)lastX=sign;
 }
 assert.ok(p.x>450||p.item==='cloak','bot reaches exit around wall');
 assert.ok(flips<16,'bot keeps path instead of jittering');
}
 // Movement starts while the three-second warning counts down.
{
 const x=init(2),p=x.players[0];
 p.x=x.state.spawn.x;p.y=x.state.spawn.y;
 const prev=p.x;p.input.axisX=1;
 ghost.update(.06,x.round,x.players);
 assert.ok(p.x>prev,'humans can move before the ghost spawns');
 assert.equal(x.round.phase,'countdown');
}
// Humans collide with props, but player-ghosts can move through them.
{
 const x=init(3);x.round.phase='playing';
 x.state.npcs.forEach(n=>n.stun=999);
 // Make this collision assertion independent from random obstacle placement
 // and from another player's random initial position.
 const obstacle={x:450,y:230,w:70,h:100,kind:'tombstone',solid:true};
 x.state.obstacles=[obstacle];
 const p=x.players[0];
 x.players[1].x=100;x.players[1].y=450;
 x.players[2].x=840;x.players[2].y=450;
 p.x=obstacle.x-16;p.y=obstacle.y+obstacle.h/2;
 p.input.axisX=1;
 const before=p.x;
 ghost.update(.1,x.round,x.players);
 assert.equal(p.x,before,'human cannot step into a solid object');
 p.ghost=true;p.stun=0;
 ghost.update(.1,x.round,x.players);
 assert.ok(p.x>before,'converted player ghosts pass through obstacles');
}
// Player bodies resist each other; drag strength pushes a resting player.
{
 const x=init(3),[a,b,c]=x.players;
 x.state.obstacles=[];x.round.phase='countdown';
 a.x=390;a.y=220;b.x=417;b.y=220;c.x=790;c.y=450;
 a.input.axisX=1;b.input.axisX=-1;
 const mid=(a.x+b.x)/2;
 ghost.update(.04,x.round,x.players);
 assert.ok(Math.hypot(b.x-a.x,b.y-a.y)>=31.9,'opposing humans cannot overlap');
 assert.ok(Math.abs((a.x+b.x)/2-mid)<1,'equal force holds the midpoint');
 a.x=390;b.x=423;a.input.axisX=1;b.input.axisX=0;
 ghost.update(.04,x.round,x.players);
 assert.ok(b.x>423,'a moving joystick pushes a resting player');
}
// Shared punch has windup, a locked movement animation and tinted impact.
{
 const Combat=ghostSandbox.window.PartyCombatMotion;
 assert.equal(Combat.ATTACK.windup,.18);
 assert.ok(Math.abs(Combat.TOTAL-.48)<1e-9);
 const x=init(3);x.round.phase='playing';
 x.state.npcs.forEach(n=>n.stun=999);
 x.state.obstacles=[]; // Attack test is for timing, not random map geometry.
 const [attacker,victim,far]=x.players;
 attacker.x=120;attacker.y=120;attacker.input.action=true;attacker.input.axisX=1;
 victim.x=157;victim.y=120;far.x=800;far.y=400;
 ghost.update(.016,x.round,x.players);
 assert.equal(victim.stun,0,'no instant punch');
 assert.equal(attacker.x,120,'start of strike freezes movement');
 assert.ok(attacker.punchCooldown>.9);
 ghost.update(.16,x.round,x.players);
 assert.equal(victim.stun,0,'windup is not done');
 assert.equal(attacker.x,120);
 ghost.update(.025,x.round,x.players);
 assert.ok(victim.stun>.35&&victim.stun<1,'punch impact after windup');
 assert.equal(victim.stunColor,attacker.color,'stun uses attacker color');
 assert.equal(attacker.x,120);
 ghost.update(.27,x.round,x.players);
 assert.equal(attacker.x,120,'recovery animation roots attacker');
 attacker.input.action=false;
 ghost.update(.03,x.round,x.players);
 ghost.update(.03,x.round,x.players);
 assert.ok(attacker.x>120,'movement resumes after attack finishes');
}
// Punch rights: only living humans can initiate and receive a punch.
// The facing cone ignores ghosts and players behind the attacker.
{
 const x=init(4);x.round.phase='playing';x.state.obstacles=[];
 x.state.npcs.forEach(n=>n.stun=999);
 const [attacker,friend,spirit,behind]=x.players;
 attacker.x=140;attacker.y=160;attacker.dir={x:1,y:0};
 friend.x=185;friend.y=160;
 spirit.x=172;spirit.y=122;spirit.ghost=true;
 behind.x=94;behind.y=160;
 attacker.input.action=true;
 ghost.update(.02,x.round,x.players);
 ghost.update(.19,x.round,x.players);
 assert.ok(friend.stun>0,'human punches another human in front');
 assert.equal(spirit.stun,0,'human punch does not stun a ghost');
 assert.equal(behind.stun,0,'punch does not hit behind attacker');
 attacker.ghost=true;attacker.stun=0;attacker.attackRemaining=0;
 attacker.punchCooldown=0;attacker.input.action=false;
 ghost.update(.02,x.round,x.players);
 attacker.input.action=true;
 ghost.update(.02,x.round,x.players);
 assert.equal(attacker.attackRemaining,0,'player ghost cannot punch');
 const bot=spirit;bot.isBot=true;bot.botMind=null;
 bot.input.action=false;
 ghost.update(.02,x.round,x.players);
 assert.equal(bot.input.action,false,'AI ghost never punches');
}
 // Ghosts must infect at the 32px body-collision radius, never push forever.
{
 const x=init(3),[human,spirit,far]=x.players;
 x.round.phase='playing';x.state.ghostSpawned=true;
 x.state.obstacles=[];x.state.npcs.forEach(n=>n.stun=999);
 human.x=300;human.y=290;human.input={};
 spirit.x=332.5;spirit.y=290;spirit.ghost=true;spirit.stun=0;spirit.input={};
 far.x=820;far.y=460;far.input={};
 ghost.update(.016,x.round,x.players);
 assert.equal(human.ghost,true,'ghost converts at real 32px collision boundary');
}
{
 const x=init(3),[human,far,other]=x.players;
 x.round.phase='playing';x.state.ghostSpawned=true;
 x.state.obstacles=[];human.x=330;human.y=280;
 far.x=730;far.y=400;other.x=840;other.y=420;
 const npc=x.state.npcs[0];npc.stun=0;
 npc.x=human.x+32.4;npc.y=human.y;
 npc.huntTargetId=human.id;npc.huntGoal={x:human.x,y:human.y};
 ghost.update(.016,x.round,x.players);
 assert.equal(human.ghost,true,'initial NPC converts on collision-sized touch');
}
{
 const x=init(3),[human,spirit,far]=x.players;
 x.round.phase='playing';x.state.ghostSpawned=true;
 x.state.obstacles=[];x.state.npcs.forEach(n=>n.stun=999);
 human.x=180;human.y=260;human.dir={x:1,y:0};
 spirit.x=217;spirit.y=260;spirit.ghost=true;spirit.stun=999;
 far.x=800;far.y=450;
 human.input.action=true;
 ghost.update(.016,x.round,x.players);
 assert.equal(human.attackRemaining,0,'A does not swing at former-human ghosts');
 assert.ok(spirit.stun>998,'former-human ghost cannot be punched');
}
{
 const x=init(4),[human,spirit,friend,far]=x.players;
 x.round.phase='playing';x.state.ghostSpawned=true;
 x.state.obstacles=[];x.state.npcs.forEach(n=>n.stun=999);
 human.x=180;human.y=260;human.dir={x:1,y:0};
 spirit.x=218;spirit.y=260;spirit.ghost=true;spirit.stun=999;
 friend.x=235;friend.y=260;far.x=800;far.y=450;
 human.input.action=true;
 ghost.update(.016,x.round,x.players);
 assert.equal(human.attackRemaining,0,'ghost in front blocks punching human behind');
 assert.equal(friend.stun,0,'cannot punch through converted ghosts');
}

// The render test observes exactly what spectators see over the collector.
const drawTexts=[],drawImages=[];
const drawProbe=new Proxy({},{
  get(_obj,key){
    if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
    if(key==='measureText')return v=>({width:String(v).length*8});
    if(key==='drawImage')return (...args)=>drawImages.push(args);
    if(key==='fillText')return (...args)=>drawTexts.push(args);
    return ()=>{};
  },
  set(){return true;}
});
// Renderer integration: BOTH the initial AI ghost and a converted
// participant must use Pharaoh sprites on Egyptian rounds, without changing
// player-specific color or leaking Pharaoh art into cemetery rounds.
{
 for(const theme of ['egypt','graveyard']){
  const x=init(3),player=x.players[0];
  x.state.theme=theme;x.state.ghostSpawned=true;
  player.ghost=true;player.stun=0;
  art.preload(x.players,theme);
  const pose='float0';
  const ai=art.getActorImage(true,'#f5faff',pose,theme);
  const converted=art.getActorImage(true,player.color,pose,theme);
  drawImages.length=0;
  ghost.draw(drawProbe,0,x.round,x.players);
  assert.ok(drawImages.some(args=>args[0]===ai),
    'AI ghost uses the '+theme+' themed sprite in the actual canvas draw');
  assert.ok(drawImages.some(args=>args[0]===converted),
    'converted player uses the '+theme+' themed sprite in the actual canvas draw');
  const wrong=theme==='egypt'?'graveyard':'egypt';
  assert.ok(!drawImages.some(args=>args[0]===
    art.getActorImage(true,'#f5faff',pose,wrong)),
    'ghost sprite from another map theme must not be drawn');
 }
}
// The host game engine must no longer paint its own corner HUD labels.
// Time/player-count belong exclusively to app.js's shared centre badge.
{
 const captures=[];
 const probe=new Proxy({}, {
  get(_target,key){
   if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
   if(key==='fillText')return text=>captures.push(String(text));
   return ()=>{};
  },set(){return true;}
 });
 for(const n of [1,9,12]){
  const x=init(n);
  captures.length=0;
  ghost.draw(probe,0,x.round,x.players);
  assert.ok(!captures.some(label=>/^(เริ่มใน|ผู้เล่น|กำลังแข่ง|\\d+ คน)$/.test(label)),
    'no redundant top-left time/player-count overlay at '+n+' players');
 }
}
// Five items, one carried at a time. B first arms slow targeting, second uses it.
for(const item of ['cloak','boost','stun','trap','slow']){
 const x=init(3);x.round.phase='playing';
 const [p,q,r]=x.players;
 x.state.npcs.forEach(n=>{n.stun=999;n.x=p.x+70;n.y=p.y;});
 q.x=x.state.world.w-90;q.y=90;r.x=90;r.y=x.state.world.h-90;
 x.state.boxes.push({x:p.x,y:p.y,ttl:20,item});
 ghost.update(.016,x.round,x.players);
 assert.equal(p.item,item,'pickup '+item);
 assert.equal(p.pickupNotice,ghost.ITEM_NAMES[item],'popup shows the actual item name');
 assert.equal(p.pickupNoticeItem,item);
 assert.ok(p.pickupNoticeTime>2,'popup starts immediately after a real pickup');
 drawTexts.length=0;drawImages.length=0;
 const originalX=p.x,originalY=p.y;
 p.x=400;p.y=240;
 ghost.draw(drawProbe,0,x.round,x.players);
 const itemText=drawTexts.find(args=>args[0]==='ได้รับ: '+ghost.ITEM_NAMES[item]);
 const nameText=drawTexts.find(args=>args[0]===p.name);
 assert.ok(itemText,'collector sees obtained item above the character: '+item);
 const iconDraw=drawImages.find(args=>args[0]===ghost.getItemIconImage(item));
 assert.ok(iconDraw,'loot icon rendered even with extra actor and prop SVGs');
 assert.ok(iconDraw[1]<itemText[1]);
 assert.ok(nameText&&itemText[2]<nameText[2],
   'item notification is vertically above the collector name');
 p.x=originalX;p.y=originalY; // Do not move the item-stun test out of range.
 // A second box is not collectible while already carrying something.
 x.state.boxes.push({x:p.x,y:p.y,ttl:20,item:'cloak'});
 ghost.update(.016,x.round,x.players);
 assert.equal(p.item,item);
 // Clear the optional second crate before consuming: after using an item,
 // collecting another available crate immediately is permitted.
 x.state.boxes=[];
 if(item==='stun')x.state.npcs[0].stun=0;
 p.input.alt=true;
 ghost.update(.016,x.round,x.players);
 if(item==='slow'){
  assert.equal(p.selecting,true);
  assert.equal(p.item,'slow');
  assert.equal(p.targetId,q.id);
  assert.equal(ghost.cycleTarget(x.state,x.players,p,1),true);
  assert.equal(p.targetId,r.id);
  const state=ghost.itemStatus(x.players).find(z=>z.id===p.id);
  assert.equal(state.targetName,r.name);
  p.input.alt=false;ghost.update(.016,x.round,x.players);
  p.input.alt=true;ghost.update(.016,x.round,x.players);
  assert.ok(r.slow>2,'the selected target receives slow');
  assert.equal(p.item,null);
  assert.equal(p.selecting,false);
 }else{
  assert.equal(p.item,null,'B consumes '+item);
  if(item==='cloak')assert.ok(p.cloak>1.8);
  if(item==='boost')assert.ok(p.boost>2.3);
  if(item==='stun')assert.ok(x.state.npcs[0].stun>1.3,
    'ghost is temporarily stunned by the item');
  if(item==='trap'){
   assert.equal(x.state.traps.length,1);
   assert.equal(p.stun,0,'trap does not instantly bite its owner');
   q.x=p.x;q.y=p.y;q.stun=0;
   ghost.update(.5,x.round,x.players);
   assert.ok(q.stun>0,'human stepping on armed trap is rooted');
  }
 }
}
// Cloak must protect from every infection source for its full duration.
{
 const x=init(3);x.round.phase='playing';x.state.ghostSpawned=true;
 const [human,spirit,other]=x.players;
 x.state.obstacles=[];x.state.npcs.forEach(g=>g.stun=999);
 human.x=310;human.y=260;human.cloak=1;
 spirit.x=human.x+3;spirit.y=human.y;spirit.ghost=true;spirit.stun=0;
 other.x=850;other.y=430;
 ghost.update(.016,x.round,x.players);
 assert.equal(human.ghost,false,'cloak prevents infected player touch');
 spirit.stun=999;
 const npc=x.state.npcs[0];npc.stun=0;npc.x=human.x+1;npc.y=human.y;
 ghost.update(.016,x.round,x.players);
 assert.equal(human.ghost,false,'cloak prevents NPC infection');
 human.cloak=0;npc.stun=999;spirit.stun=0;
 spirit.x=human.x+2;spirit.y=human.y; // Contact must be re-established after body push.
 ghost.update(.016,x.round,x.players);
 assert.equal(human.ghost,true,'infection resumes when cloak expires');
}
// Traps affect humans only. A ghost cannot trigger or consume the trap.
{
 const x=init(4);x.round.phase='playing';
 const [owner,human,spirit,far]=x.players;
 x.state.npcs.forEach(g=>g.stun=999);
 spirit.ghost=true;
 owner.x=260;owner.y=250;owner.cloak=5;
 human.x=600;human.y=430;far.x=850;far.y=80;
 spirit.x=owner.x;spirit.y=owner.y;
 owner.item='trap';owner.input.alt=true;
 ghost.update(.016,x.round,x.players);
 assert.equal(x.state.traps.length,1);
 ghost.update(.5,x.round,x.players);
 assert.equal(spirit.stun,0,'trap ignores ghost');
 assert.equal(x.state.traps.length,1,'ghost does not consume trap');
 spirit.stun=999;human.x=owner.x;human.y=owner.y;human.stun=0;
 ghost.update(.016,x.round,x.players);
 assert.ok(human.stun>0,'trap hits human');
 assert.equal(human.stunColor,owner.color,'trap sparkle has owner color');
}
// Slow can select only other human players, never converted ghosts.
{
 const x=init(3);x.round.phase='playing';
 const [owner,friend,spirit]=x.players;
 x.state.npcs.forEach(g=>g.stun=999);
 spirit.ghost=true;owner.item='slow';owner.input.alt=true;
 ghost.update(.016,x.round,x.players);
 assert.equal(owner.targetId,friend.id);
 assert.equal(ghost.cycleTarget(x.state,x.players,owner,1),true);
 assert.equal(owner.targetId,friend.id,'ghost is excluded from target rotation');
 owner.input.alt=false;ghost.update(.016,x.round,x.players);
 owner.input.alt=true;ghost.update(.016,x.round,x.players);
 assert.ok(friend.slow>0);
 assert.equal(spirit.slow,0);
}
// A pickup notice fades automatically; using an item does not replay pickup.
{
 const x=init(3);x.round.phase='playing';
 const p=x.players[0];x.state.npcs.forEach(n=>n.stun=999);
 x.state.boxes=[{x:p.x,y:p.y,ttl:8,item:'boost'}];
 ghost.update(.01,x.round,x.players);
 assert.equal(p.pickupNotice,'บูสต์สปีด');
 x.state.boxes=[];x.round.phase='countdown';
 ghost.update(2.5,x.round,x.players);
 assert.equal(p.pickupNoticeTime,0);
 drawTexts.length=0;
 ghost.draw(drawProbe,0,x.round,x.players);
 assert.ok(!drawTexts.some(args=>String(args[0]).startsWith('ได้รับ:')),
   'expired pickup announcement is no longer painted');
 const nextRound={mode:'ghost',phase:'countdown'};
 ghost.setup(nextRound,x.players);
 assert.equal(p.pickupNotice,null,'no stale item popup in a fresh round');
 assert.equal(p.pickupNoticeItem,null);
 assert.equal(p.pickupNoticeTime,0);
}
// AI target lock only changes for very close alternatives; conversion retains
// player control as a colored ghost, with a clear last-survivor winner.
{
 const x=init(3),[a,b,c]=x.players;x.round.phase='playing';
 x.state.npcs.forEach(n=>n.stun=0);
 const npc=x.state.npcs[0];
 a.x=npc.x+120;a.y=npc.y;
 // Keep B far enough that the AI's intentionally rare nearby-target
 // variation cannot select it before the switching test.
 b.x=npc.x+200;b.y=npc.y;
 c.x=npc.x+280;c.y=npc.y;
 ghost.update(.016,x.round,x.players);
 assert.equal(npc.targetId,a.id);
 b.x=npc.x+50;b.y=npc.y;
 ghost.update(.016,x.round,x.players);
 assert.equal(npc.targetId,b.id,'switch when alternative becomes much closer');
}
{
 const x=init(3),[a,b,c]=x.players;x.round.phase='playing';
 const npc=x.state.npcs[0];
 npc.stun=0;
 b.x=90;b.y=90;c.x=x.state.world.w-80;c.y=x.state.world.h-80;
 a.x=npc.x;a.y=npc.y;
 a.item='cloak';a.pickupNotice='ผ้าคลุมล่องหน';a.pickupNoticeTime=2.1;
 ghost.update(.016,x.round,x.players);
 assert.equal(a.ghost,true,'AI ghost touch infects a human');
 assert.equal(a.item,null,'infected player no longer holds an item');
 assert.equal(a.pickupNotice,null,'infection clears an outdated pickup notification');
 assert.equal(a.pickupNoticeItem,null);
 assert.equal(a.active,true,'infected human remains controllable');
 npc.stun=999;
 a.x=c.x-4;a.y=c.y;
 ghost.update(.2,x.round,x.players); // Freshly converted ghosts are briefly stunned.
 assert.equal(c.ghost,true,'player-ghost infects when initial stun wears off');
 assert.equal(x.state.winnerId,b.id,'the last human wins');
}

// Finish the 1.45s horizontal reel plus 1.18s center reveal in the test
// harness without wall-clock delays or accidental extra countdown ticks.
function finishReel(ui){
 const api=ui.scope.window.__ghostTest;
 assert.ok(api.getSelection(),'a centered roulette must exist before the game starts');
 for(let i=0;i<80&&api.getSelection();i++)api.updateGameSelection(.05);
 assert.equal(api.getSelection(),null,'the reel must finish within four seconds including the longer result reveal');
 assert.equal(ui.elements.get('gameRoulette').classList.contains('hidden'),true);
 assert.equal(api.getRound().phase,'countdown','engine starts only after roulette settles');
 return api.getRound();
}


const persistedNicknames=new Map();
function setup(url='https://game.example/?host=1',portrait=false,savedSession=null,arenaViewport=null,browserProfile=null) {
  const elements=new Map();
  const makeElement=(id='')=>{
    const handlers={},classes=new Set();
    return {
      id,style:{setProperty(name,value){this[name]=value;},removeProperty(name){delete this[name];}},dataset:{},children:[],value:'',textContent:'',disabled:false,
      classList:{
        add(c){classes.add(c);},remove(c){classes.delete(c);},
        toggle(c,flag){if(flag===undefined? !classes.has(c):flag)classes.add(c);else classes.delete(c);},
        contains(c){return classes.has(c);}
      },
      addEventListener(name,fn){(handlers[name]??=[]).push(fn);},
      fire(name,extra={}){for(const fn of handlers[name]||[])fn({preventDefault(){},pointerId:1,...extra});},
      append(...items){this.children.push(...items);if(id==='phoneGameChoices')for(const item of items){
        if(item.dataset?.pick&&!pickButtons.includes(item))pickButtons.push(item);
      }},
      replaceChildren(...items){this.children=items;this.textContent='';this.innerHTML='';},
      prepend(item){this.children.unshift(item);},
      setAttribute(name,value){this.attributes??={};this.attributes[name]=value;if(name==='content')this.content=value;},
      select(){},scrollIntoView(){},setPointerCapture(){},matches(){return false;},
      querySelector(selector){
         const key=id+'|'+selector;
         if(!elements.has(key))elements.set(key,makeElement(key));
         return elements.get(key);
       },
       getContext(){return context;},
      captureStream(...args){
        assert.equal(args.length,0,'quality must not set captureStream frameRate');
        return {
        width:this.width,height:this.height,
        getTracks(){return [{stop(){this.stopped=true;}}];}
      };},
      play(){this.played=true;return Promise.resolve();},
      pause(){this.paused=true;},
      toDataURL(mime){assert.equal(mime,'image/jpeg');return 'data:image/jpeg;base64,QUJDRA==';},
      getBoundingClientRect(){return id==='arena'&&arenaViewport?
        {left:0,top:0,...arenaViewport}:{left:0,top:0,width:200,height:200};},parentElement:null
    };
  };
  const canvasTransforms=[];
  const context=new Proxy({},{
    get(_,key){
      if(key==='setTransform')return (...args)=>{canvasTransforms.push(args);};
      if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
      // Used by the bounded Thai HUD label renderer.
      if(key==='measureText')return text=>({width:String(text).length*8});
      return ()=>{};
    },
    set(){return true;}
  });
  for(const [,id] of html.matchAll(/\bid="([^"]+)"/g))elements.set(id,makeElement(id));
  elements.get('bulkBotPicker').classList.add('hidden');
  elements.get('autoNext').checked=true;
  const sessionButtons=['queue','endless','board'].map(mode=>{
    const btn=makeElement('session-'+mode);btn.dataset.sessionMode=mode;return btn;
  });
  const pickButtons=[]; // Populated by the real renderModeChoices() DOM handler.
  const padButtons=Object.fromEntries(['action','alt','cancel'].map(key=>{
    const button=makeElement('pad-'+key);button.dataset.control=key;return [key,button];
  }));
  // Simulate the real DOM: a small visible button is nested in the enlarged
  // full-column touch region. Events on the circle bubble to that region.
  const padZones=Object.fromEntries(Object.entries(padButtons).map(([key,button])=>{
    const zone=makeElement('hit-zone-'+key);
    zone.classList.add('face-button-wrap');
    button.parentElement=zone;
    const buttonFire=button.fire.bind(button);
    button.fire=(type,props={})=>{
      buttonFire(type,props);
      if(['pointerdown','pointerup','pointercancel','lostpointercapture','contextmenu'].includes(type))
        zone.fire(type,props);
    };
    return [key,zone];
  }));
  const docHandlers={};
  const document={
    head:makeElement('head'),body:makeElement('body'),
    fire(name,props={}){
      const e={cancelable:true,defaultPrevented:false,
        preventDefault(){this.defaultPrevented=true;},...props};
      for(const fn of docHandlers[name]||[])fn(e);
      return e;
    },
    getElementById(id){assert(elements.has(id),'Missing ID: '+id);return elements.get(id);},
    createElement(tag){return makeElement(tag);},
    querySelectorAll(selector){
      if(selector==='[data-pick]')return pickButtons;
      if(selector==='[data-session-mode]')return sessionButtons;
      if(selector==='#controllerActive [data-control]')return Object.values(padButtons);
      return [];
    },
    addEventListener(name,fn){(docHandlers[name]??=[]).push(fn);},execCommand(){return true;}
  };
  // Browser Fullscreen belongs to the persistent document root on the host.
  // A controller can independently fullscreen its persistent #controller view.
  document.documentElement=makeElement('html');
  document.fullscreenElement=null;
  document.fullscreenRequests=0;
  document.fullscreenExits=0;
  document.documentElement.requestFullscreen=()=>{
    document.fullscreenRequests++;
    document.fullscreenElement=document.documentElement;
    return Promise.resolve();
  };
  document.exitFullscreen=()=>{
    document.fullscreenExits++;
    document.fullscreenElement=null;
    return Promise.resolve();
  };
  elements.get('controller').requestFullscreen=()=>{
    document.fullscreenRequests++;
    document.fullscreenElement=elements.get('controller');
    return Promise.resolve();
  };
  const instances=[];
  class FakeMediaCall{
    constructor(peer,stream,options={}){
      this.peer=peer;this.stream=stream;
      this.metadata=options.metadata||{};
      this.handlers={};this.open=false;this.closed=false;
    }
    on(name,fn){this.handlers[name]=fn;}
    answer(){this.open=true;this.answered=true;}
    fire(name,value){this.handlers[name]?.(value);}
    close(){
      if(this.closed)return;
      this.closed=true;this.open=false;this.handlers.close?.();
    }
  }
  class FakeConn{
    constructor(){this.handlers={};this.open=true;this.sent=[];this.peer='phone-'+instances.length;}
    on(name,fn){this.handlers[name]=fn;}
    send(value){this.sent.push(value);}
    close(){this.open=false;this.handlers.close?.();}
    fire(name,value){this.handlers[name]?.(value);}
  }
  class FakePeer{
    constructor(id){this.id=id;this.handlers={};this.disconnected=false;this.open=false;this.destroyed=false;this.reconnectCount=0;instances.push(this);}
    on(name,fn){this.handlers[name]=fn;}
    connect(){this.conn=new FakeConn();return this.conn;}
    call(peer,stream,options){
      const call=new FakeMediaCall(peer,stream,options);
      (this.mediaCalls??=[]).push(call);return call;
    }
    disconnect(){this.disconnected=true;this.open=false;this.fire('disconnected');}
    reconnect(){
      if(!this.disconnected||this.destroyed)throw Error('Invalid PeerJS reconnect');
      this.reconnectCount++;this.disconnected=false;
    }
    destroy(){this.destroyed=true;this.open=false;this.fire('close');}
    fire(name,value){
      if(name==='open'){this.open=true;this.disconnected=false;}
      if(name==='disconnected'){this.disconnected=true;this.open=false;}
      if(name==='close'){this.destroyed=true;this.open=false;}
      this.handlers[name]?.(value);
    }
  }
  let raf=null;
  const windowHandlers={};
  const sessionData=savedSession||new Map();
  const timers=[];
  const viewportHandlers={};
  const visualViewport=browserProfile?.platform==='iPhone'?{
    width:667,height:305,offsetLeft:0,offsetTop:0,
    addEventListener(name,fn){(viewportHandlers[name]??=[]).push(fn);},
    fire(name){for(const fn of viewportHandlers[name]||[])fn();}
  }:undefined;
  const win={
    location:new URL(url),crypto:webcrypto,portrait,visualViewport,
    screen:{width:360,height:800},devicePixelRatio:2,
    innerWidth:800,innerHeight:360,
    localStorage:{
      getItem(key){return persistedNicknames.get(key)||null;},
      setItem(key,value){persistedNicknames.set(key,String(value));}
    },
    matchMedia(query){return {matches:query.includes('display-mode: standalone')||query.includes('display-mode: fullscreen')?!!browserProfile?.standalone:this.portrait};},
    addEventListener(name,fn){(windowHandlers[name]??=[]).push(fn);},
    fire(name){for(const fn of windowHandlers[name]||[])fn();},
    scrollTo(){}
  };
  win.location.assign=function(url){this.href=url;};
  // History API mutates the current browser Location, preserving its methods.
  win.history={replaceState(_state,_title,next){win.location.href=next;}};
  const sessionStorage={
    getItem(key){return sessionData.get(key)||null;},
    setItem(key,value){sessionData.set(key,String(value));},
    removeItem(key){sessionData.delete(key);}
  };
  const globals={window:win,location:win.location,document,crypto:webcrypto,sessionStorage,
    navigator:browserProfile||{userAgent:'Test Browser',platform:'Linux x86_64',maxTouchPoints:0},Peer:FakePeer,URL,URLSearchParams,
    setInterval(){return 1;},
    setTimeout(fn,ms){timers.push({fn,ms,cancelled:false});return timers.length;},
    clearTimeout(id){if(timers[id-1])timers[id-1].cancelled=true;},
    requestAnimationFrame(fn){raf=fn;},alert(){},confirm(){return true;}};
  const scope=vm.createContext(globals);
  vm.runInContext(arenaSource,scope,{filename:'arena-art.js'});
  vm.runInContext(combatSource,scope,{filename:'combat-motion.js'});
  vm.runInContext(artSource,scope,{filename:'src/shared/graveyard-art.js'});
   vm.runInContext(avatarSource,scope,{filename:'player-avatar.js'});
  vm.runInContext(characterSource,scope,{filename:'character-system.js'});
   vm.runInContext(boardCameraSource,scope,{filename:'board-controller-camera.js'});
  vm.runInContext(uiArtSource,scope,{filename:'party-ui-art.js'});
  vm.runInContext(ghostSource,scope,{filename:'src/games/ghost-attack/ghost-attack.js'});
  vm.runInContext(farmIceSource,scope,{filename:'src/shared/farm-ice-art.js'});
  vm.runInContext(chickensSource,scope,{filename:'src/games/chickens/chickens.js'});
  vm.runInContext(fruitSource,scope,{filename:'src/games/fruit-memory/fruit-memory.js'});
   vm.runInContext(shockwaveSource,scope,{filename:'src/games/shockwave/shockwave.js'});
  vm.runInContext(mayanSource,scope,{filename:'src/games/color-switch/color-switch-mayan.js'});
  vm.runInContext(colorSwitchSource,scope,{filename:'src/games/color-switch/color-switch.js'});
  vm.runInContext(pizzaArtSource,scope,{filename:'src/games/pizza-time/pizza-ingredient-art.js'});
  vm.runInContext(pizzaKitchenSource,scope,{filename:'src/games/pizza-time/pizza-kitchen-art.js'});
  vm.runInContext(pizzaSource,scope,{filename:'src/games/pizza-time/pizza-time.js'});
  vm.runInContext(partyArenaSource,scope,{filename:'party-arena-scenes.js'});
  vm.runInContext(gameCoverSource,scope,{filename:'game-cover-art.js'});
  vm.runInContext(shoppingSource,scope,{filename:'src/games/shopping-time/shopping-time.js'});
  vm.runInContext(knightSource,scope,{filename:'src/games/knight-match/knight-match.js'});
   vm.runInContext(boulderSource,scope,{filename:'src/games/boulder-bash/boulder-bash.js'});
  vm.runInContext(snowSource,scope,{filename:'src/games/snow-brawl/snow-brawl.js'});
   vm.runInContext(witchSource,scope,{filename:'src/games/witching-snake/witching-snake.js'});
   vm.runInContext(lawnSource,scope,{filename:'src/games/lawn-mower/lawn-mower.js'});
   vm.runInContext(gladiatorsArtSource,scope,{filename:'src/games/gladiators/gladiators-art.js'});
   vm.runInContext(gladiatorsSource,scope,{filename:'src/games/gladiators/gladiators.js'});
   vm.runInContext(iceRaceSource,scope,{filename:'src/games/ice-race/ice-race.js'});
  vm.runInContext(claimSource,scope,{filename:'src/games/color-claim/color-claim.js'});
  for(const name of ['board-map','board-dice','board-dice-renderer','board-items','board-bots','board-minigame','board-party','board-art'])
    vm.runInContext(fs.readFileSync(name+'.js','utf8'),scope,{filename:name+'.js'});
  vm.runInContext(appForTest,scope,{filename:'app.js'});
  return {elements,pickButtons,sessionButtons,padButtons,padZones,instances,scope,sessionData,timers,canvasTransforms,
    mediaCall(peer){return new FakeMediaCall(peer);},
    step(ms){assert(raf);raf(ms);},
    click(id){elements.get(id).fire('click');},
    pick(mode){const button=pickButtons.find(x=>x.dataset.pick===mode);assert(button);button.fire('click');}
  };
}



// A game published after this app version must not be misidentified as a
// ghost/human. Dynamic plugins provide their own score and status labels.
{
 const host=setup();host.click('addLocalBtn');host.click('addLocalBtn');
 const api=host.scope.window.__ghostTest,ps=api.getPlayers();
 ps.forEach((p,i)=>{p.active=true;p.score=i;});
 api.setRound({mode:'meteor_dash',phase:'playing',paused:false,
   pluginEngine:{getRoster:(_r,roster)=>roster.filter(p=>p.active).map((p,i)=>({
    id:p.id,value:i===0?11:26,label:'ดาว '+(i+1),status:'พร้อมเล่น'
   }))}});
 api.renderLeaderboard();
 const rows=host.elements.get('leaderboard').children;
 assert.equal(rows.length,ps.length,'new plugin uses shared roster layout');
 assert.ok(rows[0].children[2].textContent.startsWith('ดาว'),'plugin supplies metric label');
 assert.equal(rows[0].children[3].textContent,'พร้อมเล่น');
 assert.ok(rows.every(row=>row.children[2].textContent!=='คน'&&row.children[2].textContent!=='ผี'));
}
// WITCHING SNAKE smoke: actual host engine boot and BOARD PARTY rank adapter.
{
 const witchHost=setup();witchHost.click('addLocalBtn');
 const api=witchHost.scope.window.__ghostTest;
 api.startRound('witching_snake');
 const round=api.getRound(),players=api.getPlayers();
 assert.equal(round.mode,'witching_snake');
 assert.ok(round.witchingSnake,'new survival engine boots inside the existing host');
 assert.ok(players.every(p=>p.ws&&p.ws.alive),'witches enter the game alive');
 const ranking=witchHost.scope.window.BoardMinigame.ranking(round,players);
 assert.equal(ranking.length,players.length);
 assert.ok(ranking.every(p=>p.rank===1),'all pre-start survivors are tied');
}
// Browser/controller integration: keep QR, multiplayer, native fullscreen and
// WebRTC video transport while replacing only the minigame implementation.
const bare=setup('https://game.example/');
assert.equal(bare.elements.get('controller').classList.contains('hidden'),false);
const host=setup();
host.click('addLocalBtn');
host.click('offlineBtn');
assert.equal(host.elements.get('hostLobby').classList.contains('hidden'),false);
assert.equal(host.elements.get('roster').children.length,12,'all slots exist with one player');
assert.equal(host.elements.get('roster').style['--roster-cols'],'3');
assert.equal(host.elements.get('roster').style['--roster-rows'],'4');
assert.equal(host.elements.get('roster').children[1].className,'roster-item roster-empty');
assert.equal(host.elements.get('roster').children[11].children[1].textContent,'ช่อง 12');
// Zero and partial occupancy must retain the identical twelve-slot grid.
const freshLobby=setup();
assert.equal(freshLobby.elements.get('roster').children.length,12,'new lobby reserves twelve slots');
assert.equal(freshLobby.elements.get('roster').children[0].className,'roster-item roster-empty');
assert.equal(freshLobby.elements.get('roster').style['--roster-rows'],'4');
const portraitLobby=setup('https://game.example/?host=1',true);
assert.equal(portraitLobby.elements.get('roster').children.length,12);
assert.equal(portraitLobby.elements.get('roster').style['--roster-cols'],'2');
assert.equal(portraitLobby.elements.get('roster').style['--roster-rows'],'6');
assert.match(css,/#hostLobby \.lobby-roster \.roster-pick\.picked\{[\s\S]*?flex-direction:column;/);
assert.match(css,/#hostLobby \.lobby-roster \.roster-pick\.picked \.mode-choice-title\{[\s\S]*?text-align:center;/);
assert.equal(host.elements.get('roster').children[0].children[1].textContent,'บอท 1');
assert.equal(host.elements.get('roster').children[0].children[3].children[1].textContent,'GHOST ATTACK');
assert.match(host.elements.get('roster').children[0].children[3].children[0].innerHTML,/<svg[\s>]/);
host.click('startBtn');
assert.equal(host.elements.get('game').classList.contains('hidden'),false);
assert.equal(host.scope.window.__ghostTest.getRound().phase,'roulette','first game shows reel before countdown');
finishReel(host);
assert.equal(host.scope.document.fullscreenElement,host.scope.document.documentElement);
let rr=host.scope.window.__ghostTest.getRound();
assert.equal(rr.phase,'countdown');assert.equal(rr.ghost.npcs.length,1);
for(let i=0;i<245;i++)host.step(i*16.667);
assert.equal(rr.ghost.ghostSpawned,true);
assert.equal(rr.phase,'results','one-player practice has a winner after ghost spawn');
assert.equal(rr.remaining,null,'there is no per-round time limit');
assert.equal(host.elements.get('leaderboard').children.length,1);
assert.equal(host.elements.get('leaderboard').style['--leader-count'],'1');
const matchPlayers=host.scope.window.__ghostTest.getPlayers();
// This UI assertion tests a human carrying an item, independent of the
// single-player AI round outcome (which may have converted the player).
matchPlayers[0].ghost=false;matchPlayers[0].stun=0;
matchPlayers[0].item='cloak';
host.scope.window.__ghostTest.renderLeaderboard();
let firstChip=host.elements.get('leaderboard').children[0];
assert.equal(firstChip.children[1].textContent,matchPlayers[0].name);
assert.equal(firstChip.children[2].textContent,'คน');
assert.equal(firstChip.children[3].className,'leader-item-slot');
assert.equal(firstChip.children[3].textContent,'');
assert.match(firstChip.children[3].innerHTML,/<svg[\s>]/);
assert.equal(firstChip.children[3].title,'ผ้าคลุมล่องหน');
assert.equal(firstChip.children[3].attributes['aria-label'],'ผ้าคลุมล่องหน');
matchPlayers[0].item=null;
host.scope.window.__ghostTest.renderLeaderboard();
firstChip=host.elements.get('leaderboard').children[0];
assert.equal(firstChip.children.length,4,'empty item keeps a stable visual row');
assert.equal(firstChip.children[3].textContent,'—');

const addedPlayers=mkPlayers(11).map((p,i)=>({...p,id:'extra-'+i,ghost:i%2===0}));
matchPlayers.push(...addedPlayers);
addedPlayers[1].item='boost';
host.scope.window.__ghostTest.renderLeaderboard();
assert.equal(host.elements.get('leaderboard').children.length,12);
const busyItemChip=host.elements.get('leaderboard').children.find(chip=>
 chip.children[1].textContent===addedPlayers[1].name);
assert.ok(busyItemChip,'held-item player remains visible after survivor/ghost sorting');
assert.equal(busyItemChip.children[2].textContent,'คน');
assert.equal(busyItemChip.children[3].textContent,'');
assert.match(busyItemChip.children[3].innerHTML,/<svg[\s>]/);
assert.equal(busyItemChip.children[3].title,'บูสต์สปีด');
assert.equal(host.elements.get('leaderboard').style['--leader-count'],'12',
  'twelve players use one fixed row instead of extending into the arena');
matchPlayers.splice(-11);host.scope.window.__ghostTest.renderLeaderboard();
assert.equal(host.elements.get('results').classList.contains('hidden'),false,
 'one player wins after the initial ghost spawn');
host.click('backBtn');
assert.equal(host.elements.get('hostLobby').classList.contains('hidden'),false);
assert.equal(host.scope.document.fullscreenElement,host.scope.document.documentElement);

// All devices that expose the browser Fullscreen API now request it
// automatically from a direct Start button gesture, including iPad/iPhone.
const ipadUA={userAgent:'Mozilla/5.0 (iPad; CPU OS 26_6 like Mac OS X) AppleWebKit CriOS/152',platform:'iPad',maxTouchPoints:5};
const tablet=setup('https://game.example/?host=1',false,null,null,ipadUA);
tablet.click('addLocalBtn');tablet.click('offlineBtn');tablet.click('startBtn');
assert.equal(tablet.elements.get('game').classList.contains('hidden'),false);
assert.equal(tablet.scope.document.fullscreenRequests,1,
  'iPad host automatically requests native fullscreen on Start');
assert.equal(tablet.scope.document.fullscreenElement,tablet.scope.document.documentElement);
assert.equal(tablet.elements.get('webAppHelpBtn').classList.contains('hidden'),false,
 'iPad browser shows how to play without Chrome bars');
tablet.click('webAppHelpBtn');
assert.equal(tablet.elements.get('webAppHelp').classList.contains('hidden'),false);
assert.equal(tablet.elements.get('webAppHelpBtn').attributes['aria-expanded'],'true');
tablet.click('webAppHelpBtn');
assert.equal(tablet.elements.get('webAppHelp').classList.contains('hidden'),true);
assert.equal(tablet.elements.get('webAppHelpBtn').attributes['aria-expanded'],'false');
// Browser first announces ENTER, then announces its native swipe EXIT.
tablet.scope.document.fire('fullscreenchange');
tablet.scope.document.fullscreenElement=null;
tablet.scope.document.fire('fullscreenchange');
assert.equal(tablet.elements.get('restoreHostFullscreenBtn').classList.contains('hidden'),false,
 'browser exiting native fullscreen exposes one-tap recovery');
tablet.click('restoreHostFullscreenBtn');
assert.equal(tablet.scope.document.fullscreenRequests,2,'user gesture re-enters fullscreen');
tablet.scope.document.fire('fullscreenchange');
assert.equal(tablet.elements.get('restoreHostFullscreenBtn').classList.contains('hidden'),true);
tablet.click('backBtn');
assert.equal(tablet.elements.get('hostLobby').classList.contains('hidden'),false);
assert.ok(source.includes("isStandaloneWebApp=()=>"),
  'iOS has a supported browser-free Home Screen Web App mode');
assert.match(html,/<meta name="apple-mobile-web-app-capable" content="yes">/);
assert.match(html,/<meta name="apple-mobile-web-app-status-bar-style" content="black">/,
    'iPad web app reserves the status bar instead of covering header and controls');
  assert.doesNotMatch(html,/apple-mobile-web-app-status-bar-style" content="black-translucent"/,
    'translucent status bar must not overlap home header');
assert.match(html,/<button id="webAppHelpBtn"[^>]*hidden/);
assert.match(html,/<button id="restoreHostFullscreenBtn"[^>]*hidden/);
assert.equal(tablet.elements.get('webAppHelpBtn').classList.contains('hidden'),true,
 'Web App guidance is hidden outside the game');
assert.equal(tablet.elements.get('restoreHostFullscreenBtn').classList.contains('hidden'),true,
 'fullscreen restore is hidden after returning to lobby');
const standaloneTablet=setup('https://game.example/?host=1',false,null,null,{...ipadUA,standalone:true});
standaloneTablet.click('addLocalBtn');standaloneTablet.click('offlineBtn');standaloneTablet.click('startBtn');
assert.equal(standaloneTablet.scope.document.fullscreenRequests,0,
 'installed Web App does not enter native fullscreen with a swipe-dismiss path');
assert.equal(standaloneTablet.elements.get('webAppHelpBtn').classList.contains('hidden'),true,
 'installed Home Screen Web App never displays irrelevant browser install instructions');
assert.equal(standaloneTablet.elements.get('restoreHostFullscreenBtn').classList.contains('hidden'),true);
const ipadController=setup('https://game.example/?room=ABC234',false,null,null,ipadUA);
ipadController.click('joinLandscapeBtn');
assert.equal(ipadController.scope.document.fullscreenRequests,1,
  'iPad controller requests fullscreen on landscape button');
ipadController.click('landscapeBtn');
assert.equal(ipadController.scope.document.fullscreenRequests,1,
  'the existing fullscreen controller does not request a second time');
for(const profile of [
 {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X)',platform:'iPhone',maxTouchPoints:5},
 {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit',platform:'MacIntel',maxTouchPoints:5},
 {userAgent:'Mozilla/5.0 (Linux; Android 16) Chrome',platform:'Linux armv8l',maxTouchPoints:5},
 {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari',platform:'MacIntel',maxTouchPoints:0}
]){
 const device=setup('https://game.example/?host=1',false,null,null,profile);
 device.click('addLocalBtn');device.click('offlineBtn');device.click('startBtn');
 assert.equal(device.scope.document.fullscreenRequests,1,
   'Start requests fullscreen on iPhone, iPad desktop UA, Android and Mac');
}
const online=setup();
online.click('hostBtn');online.instances[0].fire('open');
const conn=online.instances[0].connect();
online.instances[0].fire('connection',conn);
conn.fire('data',{t:'join',name:'Wut'});
assert.equal(online.elements.get('startBtn').disabled,true);
conn.fire('data',{t:'pick',mode:'ghost'});
assert.equal(online.elements.get('startBtn').disabled,false);
conn.fire('data',{t:'pick',mode:'stars'});
assert.equal(online.elements.get('roster').children[0].children[3].children[1].textContent,'GHOST ATTACK');
online.click('startBtn');
finishReel(online);
assert.equal((online.instances[0].mediaCalls||[]).length,0,'host must not stream before the phone opts in');
conn.fire('data',{t:'video-quality',quality:'medium'});
assert.equal((online.instances[0].mediaCalls||[]).length,0,'quality alone cannot enable video');
conn.fire('data',{t:'preview-toggle',enabled:true});
assert.equal(online.instances[0].mediaCalls.length,1,'opted-in phone receives WebRTC game stream');
assert.equal(online.instances[0].mediaCalls[0].stream.height,540);
const pair=online.instances[0].mediaCalls[0];
assert.ok(pair.stream.width===960);
assert.equal(pair.stream.fps,undefined);
conn.fire('data',{t:'preview-toggle',enabled:false});
assert.equal(pair.closed,true,'turning preview off closes the active host media call');
conn.fire('data',{t:'video-quality',quality:'high'});
assert.equal(online.instances[0].mediaCalls.length,1,'graphic changes while off do not restart the video');
assert.equal(online.scope.window.__ghostTest.getRound().ghost.npcs.length,1);
assert.equal(conn.sent.some(x=>x.t==='inventory'),true);
// A slow medicine target selection is always host authoritative.
const oround=online.scope.window.__ghostTest.getRound();
const owut=online.scope.window.__ghostTest.getPlayers()[0];
owut.item='slow';owut.selecting=true;owut.targetId='not-a-player';
conn.fire('data',{t:'target-cycle',direction:1});
assert.equal(owut.targetId,'not-a-player',
 'target controls are disabled during the pre-ghost countdown');
oround.phase='playing';
conn.fire('data',{t:'target-cycle',direction:1});
// With only one participant there is no valid target; no fabricated target ID.
assert.equal(owut.targetId,null);
online.click('pauseBtn');
assert.equal(online.elements.get('pauseMenu').classList.contains('hidden'),false);
online.click('exitBtn');
assert.equal(online.elements.get('hostLobby').classList.contains('hidden'),false);
assert.equal(online.scope.document.fullscreenExits,0);

// Bulk bot change now opens a twelve-cover modal, with explicit game choice.
{
 const bulk=setup(),overlay=bulk.elements.get('bulkBotPicker'),
   choices=bulk.elements.get('bulkBotPickerChoices');
 assert.equal(bulk.elements.get('cycleAllBotsBtn').disabled,true);
 bulk.click('offlineBtn');
 for(let i=0;i<7;i++)bulk.click('addLocalBtn');
 const local=bulk.scope.window.__ghostTest.getPlayers();
 assert.equal(local.length,9);
 assert.ok(local.every(p=>p.choice==='ghost'));
 assert.equal(bulk.elements.get('cycleAllBotsBtn').disabled,false);
 assert.equal(bulk.elements.get('roster').children.length,12);
 assert.match(bulk.elements.get('cycleAllBotsBtn').textContent,/เปลี่ยนเกม 9 ตัว/);
 bulk.click('cycleAllBotsBtn');
 assert.equal(overlay.classList.contains('hidden'),false);
 assert.equal(bulk.elements.get('cycleAllBotsBtn').attributes['aria-expanded'],'true');
 assert.equal(choices.children.length,15,'all registered modes shown once');
 assert.deepEqual(Array.from(choices.children,x=>x.dataset.mode),
   ['ghost','chickens','fruit_memory','shockwave','color_switch','pizza_time',
    'knight_match','boulder_bash','snow_brawl','shopping_time','witching_snake','lawn_mower','color_claim','ice_race','gladiators']);
 assert.ok(choices.children.every(x=>x.children[0].innerHTML.includes('<svg')),
   'all 15 game choices have SVG covers');
 assert.ok(choices.children.every(x=>x.children[1].textContent.length>0));
 assert.equal(choices.children[0].attributes['aria-pressed'],'true');
 assert.ok(local.every(p=>p.choice==='ghost'),'opening popup does not cycle games');
 choices.children[5].fire('click');
 assert.ok(local.every(p=>p.choice==='pizza_time'),'single choice directly selects PIZZA TIME');
 assert.equal(overlay.classList.contains('hidden'),true);
 assert.equal(bulk.elements.get('cycleAllBotsBtn').attributes['aria-expanded'],'false');
 assert.equal(bulk.elements.get('startBtn').disabled,false);
 // Clicking an individual bot card still cycles only that bot, independently.
 bulk.elements.get('roster').children[0].children[3].fire('click');
 assert.equal(local[0].choice,'knight_match');
 assert.ok(local.slice(1).every(p=>p.choice==='pizza_time'));
 bulk.click('cycleAllBotsBtn');
 assert.ok(choices.children.every(x=>x.attributes['aria-pressed']==='false'),
   'different current choices do not mark any option selected');
 bulk.click('bulkBotPickerClose');
 assert.equal(overlay.classList.contains('hidden'),true);
 assert.equal(local[0].choice,'knight_match','cancel does not change nominations');
 bulk.click('cycleAllBotsBtn');
 bulk.scope.document.fire('keydown',{key:'Escape'});
 assert.equal(overlay.classList.contains('hidden'),true,'Escape closes popup');
 bulk.click('cycleAllBotsBtn');
 overlay.fire('click',{target:overlay});
 assert.equal(overlay.classList.contains('hidden'),true,'backdrop closes popup');
 bulk.click('cycleAllBotsBtn');
 choices.children[10].fire('click');
 assert.ok(local.every(p=>p.choice==='witching_snake'),
   'one click synchronizes a mixed bot roster');
 bulk.click('startBtn');
 assert.equal(bulk.elements.get('game').classList.contains('hidden'),false);
 const before=local.map(p=>p.choice);
 bulk.click('cycleAllBotsBtn');
 assert.deepEqual(local.map(p=>p.choice),before,
   'bulk selection cannot mutate an active game');
 assert.equal(overlay.classList.contains('hidden'),true);
}
{
 const mixed=setup('https://game.example/?host=1');
 mixed.click('hostBtn');mixed.instances[0].fire('open');
 const remote=mixed.instances[0].connect();
 mixed.instances[0].fire('connection',remote);
 remote.fire('data',{t:'join',name:'Human'});
 remote.fire('data',{t:'pick',mode:'shockwave'});
 mixed.click('addLocalBtn');mixed.click('addLocalBtn');
 const players=mixed.scope.window.__ghostTest.getPlayers();
 assert.equal(players.filter(p=>!p.isBot).length,1);
 const remotePlayer=players.find(p=>!p.isBot);
 assert.equal(remotePlayer.choice,'shockwave');
 mixed.click('cycleAllBotsBtn');
 const options=mixed.elements.get('bulkBotPickerChoices').children;
 options.find(x=>x.dataset.mode==='lawn_mower').fire('click');
 assert.ok(players.filter(p=>p.isBot).every(p=>p.choice==='lawn_mower'));
 assert.equal(remotePlayer.choice,'shockwave',
   'bulk game choice does not change an actual controller player');
 assert.equal(mixed.elements.get('startBtn').disabled,false);
}

// Twelve is the HARD CAP. The large empty lobby panel is filled by its cards,
// without adding extra players and without changing Ghost Attack's ghost tiers.
const bigRoom=setup();
bigRoom.click('offlineBtn');
for(let i=0;i<10;i++)bigRoom.click('addLocalBtn');
assert.equal(bigRoom.scope.window.__ghostTest.getPlayers().length,12);
assert.equal(bigRoom.elements.get('rosterCount').textContent,'12/12');
assert.equal(bigRoom.elements.get('addLocalBtn').disabled,true);
bigRoom.click('addLocalBtn');
assert.equal(bigRoom.scope.window.__ghostTest.getPlayers().length,12,'cannot add player thirteen');
assert.equal(new Set(bigRoom.scope.window.__ghostTest.getPlayers().map(p=>p.color)).size,12);
assert.equal(bigRoom.scope.window.__ghostTest.getPlayers().every(p=>p.isBot),true);
assert.equal(bigRoom.elements.get('roster').style['--roster-rows'],'4');
assert.equal(bigRoom.elements.get('roster').children.length,12);
assert.equal(bigRoom.elements.get('roster').children.filter(x=>x.className.includes('roster-empty')).length,0);
bigRoom.sessionButtons[1].fire('click');
assert.equal(bigRoom.sessionButtons[1].classList.contains('active'),true);
bigRoom.sessionButtons[0].fire('click');
bigRoom.click('startBtn');
finishReel(bigRoom);
assert.equal(bigRoom.scope.window.__ghostTest.getRound().ghost.npcs.length,1);
assert.equal(bigRoom.elements.get('leaderboard').style['--leader-rows'],'1');
assert.equal(bigRoom.elements.get('leaderboard').style['--leader-cols'],'12');
assert.match(css,/#hostLobby \.lobby-roster\{[\s\S]*?grid-template-rows:repeat\(var\(--roster-rows,4\),minmax\(0,1fr\)\)/);
assert.match(css,/#hostLobby \.lobby-roster \.roster-item\{[\s\S]*?grid-template-rows:auto minmax\(0,1fr\)/);
assert.match(css,/#hostLobby \.lobby-roster \.roster-pick\.picked\{[\s\S]*?height:100%/);

// Regression: when everyone remaining falls at once, show a real draw with
// competition ranks (1, 1, 3) rather than inventing a single winner.
{
 const ui=setup();
 ui.click('offlineBtn');
 ui.click('addLocalBtn');
 const three=ui.scope.window.__ghostTest.getPlayers();
 assert.equal(three.length,3);
 for(let i=0;i<3;i++){
  three[i].active=true;three[i].fruitAlive=false;
  three[i].fruitEliminatedRound=i===2?1:2;
  three[i].fruitRounds=i===2?0:1;
 }
 ui.scope.window.__ghostTest.setRound({
  mode:'fruit_memory',phase:'playing',paused:false,
  fruitMemory:{winnerId:null,tieIds:[three[0].id,three[1].id],rounds:2}
 });
 ui.scope.window.__ghostTest.endRound();
 const heading=ui.elements.get('results').querySelector('h2');
 assert.match(heading.textContent,/เสมอ/);
 const rows=ui.elements.get('resultList').children;
 assert.equal(rows.length,3);
 assert.deepEqual(rows.map(r=>r.dataset.rank),['1','1','3']);
 assert.ok(rows.every(r=>!r.children[0].textContent.includes('อันดับ')),
  'plaque names do not repeat the metallic ranking number');
 assert.equal(rows[0].children[3].textContent,'1ST');
 assert.equal(rows[1].children[3].textContent,'1ST');
 assert.equal(rows[2].children[3].textContent,'3RD');
 assert.match(rows[0].children[1].textContent,/อันดับร่วม/);
 assert.match(rows[1].children[1].textContent,/อันดับร่วม/);
 assert.match(rows[2].children[1].textContent,/ตกรอบ รอบ 1/);
 assert.equal(ui.scope.window.__ghostTest.getRound().phase,'results');
}


// Result ranking: the exact same infection time gets the same competition rank.
{
 const ui=setup();
 ui.click('offlineBtn');ui.click('addLocalBtn');
 const three=ui.scope.window.__ghostTest.getPlayers();
 assert.equal(three.length,3);
 three.forEach(p=>{p.active=true;p.score=0;});
 three[0].ghost=false;three[0].survival=12;
 three[1].ghost=true;three[1].infectedAt=6.2;three[1].score=62;
 three[2].ghost=true;three[2].infectedAt=6.2;three[2].score=62;
 ui.scope.window.__ghostTest.setRound({
  mode:'ghost',phase:'playing',paused:false,autoNextRemaining:0,
  ghost:{winnerId:three[0].id}
 });
 ui.scope.window.__ghostTest.endRound();
 const rows=ui.elements.get('resultList').children;
 assert.equal(rows.length,3);
 assert.deepEqual(rows.map(r=>r.dataset.rank),['1','2','2']);
 assert.ok(rows.every(r=>!r.children[0].textContent.includes('อันดับ')),
  'ranking numbers appear only on the decorative ordinal');
 assert.equal(ui.elements.get('replayBtn').dataset.action,'A');
 assert.match(ui.elements.get('replayBtn').textContent,/^เล่นอีกครั้ง/);
 assert.equal(ui.elements.get('backBtn').dataset.action,'B');
 assert.equal(ui.elements.get('backBtn').textContent,'กลับล็อบบี้');
 // The engine's last-infected fallback winner must not break an exact tie.
 for(const p of three){p.ghost=true;p.infectedAt=6.2;p.score=62;}
 three[0].infectedAt=2.1;three[0].score=21;
 three[2].score=100000; // artificial fallback winner, same infection frame
 ui.scope.window.__ghostTest.setRound({
  mode:'ghost',phase:'playing',paused:false,autoNextRemaining:0,
  ghost:{winnerId:three[2].id}
 });
 ui.scope.window.__ghostTest.endRound();
 const simultaneous=ui.elements.get('resultList').children;
 assert.deepEqual(simultaneous.map(r=>r.dataset.rank),['1','1','3']);
 assert.ok(simultaneous.every(r=>!r.children[0].textContent.includes('อันดับ')));
 assert.match(ui.elements.get('results').querySelector('h2').textContent,/เสมอ/);
}
// Display all 12 COLOR SWITCH ranks in a 4×3 grid on a wide host screen.
// This detects the old min-height:0 / flex-basis:0 bug that hid the ENTIRE
// resultList even though the engine correctly generated 12 score rows.
{
 const ui=setup();
 ui.click('offlineBtn');
 for(let i=0;i<10;i++)ui.click('addLocalBtn');
 const people=ui.scope.window.__ghostTest.getPlayers();
 assert.equal(people.length,12,'twelve bots occupy the match');
 ui.click('cycleAllBotsBtn');
 ui.elements.get('bulkBotPickerChoices').children.find(x=>x.dataset.mode==='color_switch').fire('click');
 assert.ok(people.every(p=>p.choice==='color_switch'));
 ui.scope.window.innerWidth=1473; // reference: landscape tablet host
 ui.click('startBtn');
 const round=finishReel(ui);
 assert.equal(round.mode,'color_switch');
 const tiles=round.colorSwitch.tiles;
 let tileIndex=0;
 for(let rank=0;rank<12;rank++){
   for(let n=0;n<12-rank;n++)tiles[tileIndex++].ownerId=people[rank].id;
 }
 ui.scope.window.__ghostTest.endRound();
 const list=ui.elements.get('resultList');
 const rows=list.children.filter(row=>row.className==='result-player');
 assert.equal(rows.length,12,'all twelve result rows are present');
 assert.equal(list.dataset.count,'12','grid counts the full roster');
 assert.equal(list.dataset.cols,'4','tablet uses four columns');
 assert.equal(list.style['--result-cols'],'4','four columns set on resultList');
 assert.equal(list.style['--result-rows'],'3','twelve players fit in exactly three rows');
 rows.forEach((row,i)=>{
   assert.equal(row.children[0].textContent,people[i].name,
     'each card displays the complete player name, not an extra ranking label');
   assert.equal(row.dataset.rank,String(i+1),'each row exposes its competition rank');
   assert.ok(row.children[1].textContent.includes('คะแนน'),'each row shows total score');
 });
 assert.equal(rows[0].classList.contains('is-winner'),true,'first place is highlighted');
 assert.match(rows[0].children[2].innerHTML,/data-view="front"/,
   'result banner portrait uses the clean vector front-view mask');
 assert.equal(rows[0].children[3].textContent,'1ST',
   'large metallic ranking number appears beside the portrait');
 assert.equal(rows[1].children[3].textContent,'2ND');
 assert.equal(rows[2].children[3].textContent,'3RD');
 rows.forEach((row,i)=>assert.equal(row.style['--result-accent'],people[i].color,
   'every banner retains the player color, not a fixed podium color'));
 assert.equal(ui.elements.get('results').classList.contains('hidden'),false);
 assert.match(ui.elements.get('replayBtn').textContent,/อีก 7 วิ/,
   'ranking uses the existing next-game countdown');
 // Same data must reflow to three and two columns without hiding anyone.
 ui.scope.window.innerWidth=900;ui.scope.window.__ghostTest.layoutFinalResults();
 assert.equal(list.style['--result-cols'],'3');
 assert.equal(list.style['--result-rows'],'4');
 ui.scope.window.innerWidth=390;ui.scope.window.__ghostTest.layoutFinalResults();
 assert.equal(list.style['--result-cols'],'2');
 assert.equal(list.style['--result-rows'],'6');
 assert.equal(list.children.length,12,'mobile layout retains every player');
 // Competition ties keep the same rank without discarding either player.
 const s=round.colorSwitch;
 for(const tile of s.tiles)if(tile.ownerId===people[1].id)tile.ownerId=people[0].id;
 const tie=ui.scope.window.__ghostTest.getRound();
 assert.equal(tie.phase,'results','the existing result phase remains intact');
}
assert.match(css,/#game \.result-card\{[\s\S]*?height:min\(86dvh,690px\)/,
  'result card reserves a real nonzero height');
assert.match(css,/#game #resultList\{[\s\S]*?height:100%/,
  'result list stretches into the reserved grid row instead of collapsing');
// Ranking card names and result details wrap instead of being clipped with ellipses.
assert.match(css,/#game #resultList>\.result-player>div:first-child\{[\s\S]*?white-space:normal!important/);
assert.match(css,/#game #resultList>\.result-player>span:not\(\.result-avatar\),[\s\S]*?white-space:normal!important/);
assert.match(css,/grid-template-columns:repeat\(var\(--result-tracks,8\),minmax\(0,1fr\)\)/,
  'responsive ranking grid supports four landscape columns');

// The result grid fills from below, and centers the small top group.
// Verify all 1–12 counts, landscape/tablet/mobile breakpoints, header, ties,
// unique grid placement, and that visual ordering never rewrites DOM order.
{
 const ui=setup(),api=ui.scope.window.__ghostTest,doc=ui.scope.document,
  list=ui.elements.get('resultList');
 const sampleRows={
  5:[4,1],6:[4,2],7:[4,3],8:[4,4],
  9:[4,1],10:[4,2],11:[4,3],12:[4,4]
 };
 for(const width of [1473,900,390]){
  ui.scope.window.innerWidth=width;
  for(let count=1;count<=12;count++){
   for(const withHeading of [false,true]){
    const nodes=[];
    if(withHeading){
     const h=doc.createElement('div');h.className='tournament-header';
     h.textContent='ผู้ชนะรวม';nodes.push(h);
    }
    for(let i=0;i<count;i++){
     const card=doc.createElement('div');card.className='result-player';
     const label=doc.createElement('div'),detail=doc.createElement('span');
     const rank=i<2&&count===9?1:i+1;
     label.textContent='อันดับ '+rank+' • Bot '+(i+1);
     label.style.color='#63afed';detail.textContent=(count-i)+' คะแนน';
     card.append(label,detail);nodes.push(card);
    }
    list.replaceChildren(...nodes);api.layoutFinalResults();
    const cards=nodes.filter(e=>e.className==='result-player');
    const cols=Number(list.dataset.cols),lines=Number(list.style['--result-rows']),
      top=Number(list.dataset.topCount);
    const expectedCols=count<=4?Math.max(1,Math.min(count-1,width>=620?3:2)):
      width>=1060?4:width>=620?3:2;
    assert.equal(cols,expectedCols,'columns for '+count+' at '+width);
    assert.equal(lines,Math.ceil(count/cols));
    assert.equal(top,count%cols||cols);
    assert.equal(list.style['--result-tracks'],String(cols*2));
    const used=new Set(),positions=[];
    cards.forEach((card,index)=>{
     const row=Number(card.style.gridRow)-(withHeading?1:0);
     const [column,span]=card.style.gridColumn.split(' / span ').map(Number);
     assert.equal(span,2,'cards occupy two half-column tracks');
     assert.ok(row>=1&&row<=lines&&column>=1&&column+1<=cols*2);
     for(const slot of [column,column+1]){
      const key=row+':'+slot;assert.ok(!used.has(key),'overlapping result '+key);
      used.add(key);
     }
     positions.push({row,column});
     assert.equal(card.dataset.rank,String(index<2&&count===9?1:index+1),
      'result rank survives visual placement, including ties');
     assert.equal(card.children[0].textContent,'Bot '+(index+1),
      'player name remains visible after rank metadata extraction');
     assert.equal(card.children[3].textContent,
      index<2&&count===9?'1ST':String(index+1)+(index+1===1?'ST':
       index+1===2?'ND':index+1===3?'RD':'TH'));
    });
    assert.equal(positions[0].row,1,'rank 1 always on the top row');
    assert.equal(positions[0].column,cols-top+1,'top row centered');
    for(let i=0;i<top;i++){
     assert.deepEqual(positions[i],{row:1,column:cols-top+1+i*2});
    }
    for(let i=top;i<count;i++){
     assert.deepEqual(positions[i],
      {row:2+Math.floor((i-top)/cols),column:1+2*((i-top)%cols)},
      'lower rows fill every position in rank order');
    }
    if(width===1473&&sampleRows[count]){
     assert.deepEqual([cols,top],sampleRows[count]);
    }
    // Responsive re-layout must keep the original name and rank metadata.
    api.layoutFinalResults();
    cards.forEach((card,index)=>{
     assert.equal(card.children[0].textContent,'Bot '+(index+1));
     assert.equal(card.dataset.rank,String(index<2&&count===9?1:index+1));
     assert.match(card.dataset.rankSource,/อันดับ /);
    });
    assert.equal(list.children.length,count+(withHeading?1:0));
   }
  }
 }
}
// Endless mode draws a new truly randomized game EVERY round (never a
// predetermined six-game list). The 2.63-second sideways reel ends with the
// PRESELECTED winning game precisely at the center marker.
assert.match(html,/id="gameRoulette"/);
assert.match(html,/id="rouletteTrack"/);
assert.match(html,/id="rouletteHeading"/);
assert.match(css,/#game #gameRoulette \.roulette-track\{/);
assert.match(css,/#game #gameRoulette \.roulette-center-mark\{/);
assert.match(css,/#game #gameRoulette \.roulette-option\.is-selected\{/);
{
 const ui=setup();ui.click('offlineBtn');
 for(let i=0;i<10;i++)ui.click('addLocalBtn');
 const players=ui.scope.window.__ghostTest.getPlayers(),api=ui.scope.window.__ghostTest;
 assert.equal(players.length,12);
 ui.sessionButtons[1].fire('click');
 assert.equal(ui.sessionButtons[1].dataset.sessionMode,'endless');
 assert.match(ui.elements.get('startBtn').textContent,/^เริ่มเล่นทุกเกม ▶\s+\d+\/\d+$/);
 // A deterministic RNG probe proves next pick depends on a RANDOM draw.
 assert.equal(api.pickRandomEndlessGame(null,()=>0),'ghost');
 assert.equal(api.pickRandomEndlessGame('ghost',()=>0),'chickens',
   'previous game is excluded, not replayed at next spin');
 assert.equal(api.pickRandomEndlessGame('ghost',()=>.99999),'gladiators',
   'new random value changes the game instead of following fixed order');
 ui.click('startBtn');
 assert.equal(api.getTournament().endless,true);
 assert.equal(api.getTournament().schedule.length,15);
 const first=api.getSelection();
 assert.ok(first,'roulette appears immediately on start, before game engine');
 assert.equal(api.getRound().phase,'roulette');
 assert.equal(api.getRound().mode,first.mode);
 assert.equal(ui.elements.get('rouletteTrack').children.length,12,
   'the horizontal ribbon displays 12 candidate cards');
 assert.equal(ui.elements.get('rouletteTrack').children[first.winningIndex].dataset.mode,first.mode,
   'the selected game is physically centered when the animation stops');
 assert.ok(!ui.elements.get('gameRoulette').classList.contains('hidden'));
 assert.equal(ui.elements.get('rouletteHeading').textContent,'กำลังสุ่มเกม...');
 api.updateGameSelection(1.45);
 assert.equal(ui.elements.get('rouletteHeading').textContent,legacyModeNames[first.mode],
  'roulette title must match game-owned manifest metadata');
 assert.ok(first.winner.classList.contains('is-selected'));
 assert.equal(first.track.style.transform,'translate3d(-'+first.final.toFixed(2)+'px,0,0)',
   'winning card stops precisely in the middle');
 assert.equal(api.getRound().phase,'roulette','game does not begin until reveal hold');
 api.updateGameSelection(1.2);
 assert.equal(api.getSelection(),null);
 assert.equal(api.getRound().phase,'countdown');
 assert.equal(api.getRound().mode,first.mode,'actual engine matches the highlighted winner');
 assert.ok(ui.elements.get('gameRoulette').classList.contains('hidden'));
 const starting=first.mode;
 // Endlessly selecting is independent from the fixed mode ordering; players
 // do not lose points as game selection animation is shown.
 api.startRound('color_switch');
 const round=api.getRound(),tiles=round.colorSwitch.tiles;
 let cursor=0;
 for(let rank=0;rank<players.length;rank++)
   for(let amount=0;amount<12-rank;amount++)tiles[cursor++].ownerId=players[rank].id;
 api.endRound();
 assert.equal(round.phase,'results');
 assert.equal(round.autoNextRemaining,7,'seven-second result vote timer is unchanged');
 assert.equal(ui.elements.get('backBtn').textContent,'สรุปคะแนน');
 const ranked=[...players].sort((a,b)=>b.score-a.score);
 ranked.forEach((p,i)=>{
   assert.equal(p.lastRoundPoints,11-i,'rank '+(i+1)+' scores '+(11-i));
   assert.equal(p.total,11-i,'cumulative score equals first-round points');
 });
 const totals=new Map(players.map(p=>[p.id,p.total]));
 ui.click('backBtn');
 assert.equal(round.phase,'summary','B opens the cumulative standings');
 assert.equal(round.autoNextRemaining,0);
 const summary=ui.elements.get('resultList').children.filter(x=>x.className==='result-player');
 assert.equal(summary.length,12,'summary shows all twelve positions');
 summary.forEach((row,i)=>{
   assert.equal(row.children[0].textContent,ranked[i].name,'standings show only player name');
   assert.equal(row.dataset.rank,String(i+1));
   assert.ok(row.children[1].textContent.includes(String(11-i)+' คะแนนสะสม'));
 });
 ui.click('replayBtn');
 const after=api.getSelection();
 assert.ok(after,'summary A spins before playing another game');
 assert.notEqual(after.mode,starting,'new random game differs from previous random result');
 assert.equal(api.getRound().phase,'roulette');
 assert.equal(api.getTournament().roundsPlayed,1);
 assert.ok(players.every(p=>p.total===totals.get(p.id)),'roulette never resets points');
 finishReel(ui);
 assert.equal(api.getRound().mode,after.mode,'the second selected game starts');
 assert.equal(api.getRound().phase,'countdown');
 api.advanceParty();
 const third=api.getSelection();
 assert.ok(third&&third.mode!==after.mode,'every new draw excludes immediately preceding game');
 finishReel(ui);
 assert.equal(api.getTournament().roundsPlayed,2);
}
{
 const ui=setup();ui.click('offlineBtn');ui.sessionButtons[1].fire('click');
 ui.click('startBtn');
 const api=ui.scope.window.__ghostTest;
 finishReel(ui);
 api.startRound('color_switch');
 const ps=api.getPlayers(),s=api.getRound().colorSwitch;
 for(const tile of s.tiles)tile.ownerId=null;
 s.tiles[0].ownerId=ps[0].id;s.tiles[1].ownerId=ps[1].id;
 api.endRound();
 assert.equal(ps[0].lastRoundPoints,11,'joint first gets 11');
 assert.equal(ps[1].lastRoundPoints,11,'joint first ties get 11');
 ui.click('backBtn');
 const rows=ui.elements.get('resultList').children.filter(x=>x.className==='result-player');
 assert.equal(rows.length,2);
 assert.ok(rows.every(r=>r.dataset.rank==='1'&&!r.children[0].textContent.includes('อันดับ')),
  'tied winners show their names while rank remains on the metallic badge');
 ui.click('backBtn');
 assert.equal(ui.elements.get('hostLobby').classList.contains('hidden'),false);
 assert.equal(api.getTournament(),null,'leaving ends continuous session');
}
// Joystick B voting: result -> cumulative summary -> lobby, exactly as before.
{
 const ui=setup();ui.click('hostBtn');ui.instances[0].fire('open');
 const cons=[];
 for(const name of ['Alice','Bob']){
  const conn=ui.instances[0].connect();ui.instances[0].fire('connection',conn);
  conn.fire('data',{t:'join',name});cons.push(conn);
 }
 ui.sessionButtons[1].fire('click');
 assert.equal(ui.elements.get('startBtn').disabled,false);
 ui.click('startBtn');finishReel(ui);
 const api=ui.scope.window.__ghostTest;
 api.startRound('color_switch');
 const game=api.getRound();api.endRound();
 assert.equal(game.phase,'results');
 const packet=cons[0].sent.filter(x=>x.t==='result-votes').at(-1);
 assert.equal(packet.backLabel,'สรุปคะแนน');
 cons[0].fire('data',{t:'result-vote',choice:'lobby'});
 assert.equal(game.phase,'results');
 cons[1].fire('data',{t:'result-vote',choice:'lobby'});
 assert.equal(game.phase,'summary');
 assert.equal(cons[0].sent.filter(x=>x.t==='result-votes').at(-1).backLabel,'กลับล็อบบี้');
 cons[0].fire('data',{t:'result-vote',choice:'lobby'});
 assert.equal(game.phase,'summary');
 cons[1].fire('data',{t:'result-vote',choice:'lobby'});
 assert.equal(api.getRound(),null,'unanimous B exits summary');
 assert.ok(cons.every(c=>c.open),'room gamepads stay connected');
}

// Host counts ONLY the real joypads, rejects duplicate votes, lets players
// switch preferences, and launches the chosen action at unanimity.
function createVoteHost(){
 const ui=setup();ui.click('hostBtn');ui.instances[0].fire('open');
 const cons=[];
 for(const name of ['Alice','Bob']){
  const conn=ui.instances[0].connect();
  ui.instances[0].fire('connection',conn);
  conn.fire('data',{t:'join',name});
  conn.fire('data',{t:'pick',mode:'ghost'});
  cons.push(conn);
 }
 ui.click('startBtn');
 const round=finishReel(ui);
 assert.equal(round.phase,'countdown');
 ui.scope.window.__ghostTest.endRound();
 assert.equal(round.phase,'results');
 assert.equal(ui.elements.get('replayBtn').dataset.action,'A');
 assert.match(ui.elements.get('replayBtn').textContent,/^เกมถัดไป/);
 assert.doesNotMatch(ui.elements.get('replayBtn').textContent,/เกมถัดไป \(\d+\/\d+\)/);
 assert.equal(ui.elements.get('replayBtn').dataset.votes,'0/2');
 assert.equal(ui.elements.get('backBtn').dataset.votes,'0/2');
 assert.match(ui.elements.get('replayBtn').textContent,/อีก 7 วิ/,
   'host next-game action still displays the seven-second timer');
 assert.equal(cons[0].sent.filter(m=>m.t==='result-votes').at(-1).autoNextSeconds,7,
   'connected controller receives the original countdown in the vote packet');
 return {ui,cons,round};
}
{
 const {ui,cons,round}=createVoteHost();
 cons[0].fire('data',{t:'result-vote',choice:'next'});
 assert.equal(ui.elements.get('replayBtn').dataset.votes,'1/2');
 assert.equal(ui.elements.get('backBtn').dataset.votes,'0/2');
 cons[0].fire('data',{t:'result-vote',choice:'next'});
 assert.equal(round.resultVotes.next.size,1,'repeat presses do not duplicate votes');
 cons[1].fire('data',{t:'result-vote',choice:'lobby'});
 assert.equal(ui.elements.get('backBtn').dataset.votes,'1/2');
 cons[0].fire('data',{t:'result-vote',choice:'lobby'});
 assert.equal(ui.scope.window.__ghostTest.getRound(),null,'unanimous B goes directly to lobby');
 assert.equal(ui.elements.get('hostLobby').classList.contains('hidden'),false);
 assert.ok(cons.every(c=>c.open),'lobby vote keeps room and controllers connected');
}
{
 const {ui,cons,round}=createVoteHost();
 cons[0].fire('data',{t:'result-vote',choice:'next'});
 assert.equal(round.phase,'results','one vote does not trigger game');
 assert.equal(round.autoNextRemaining,7,'vote does not reset original countdown');
 cons[1].fire('data',{t:'result-vote',choice:'next'});
 const next=ui.scope.window.__ghostTest.getRound();
 assert.notEqual(next,round,'unanimous A creates a new round immediately');
 assert.equal(next.phase,'roulette','unanimous A immediately starts the short selection reel');
 assert.ok(ui.elements.get('gameRoulette').classList.contains('hidden')===false);
 finishReel(ui);
 assert.equal(ui.scope.window.__ghostTest.getRound().phase,'countdown','game starts after centered reveal');
 assert.equal(ui.elements.get('results').classList.contains('hidden'),true);
}


// The auto-next timer runs independently of the number or direction of votes.
{
 const {ui,cons,round}=createVoteHost();
 cons[0].fire('data',{t:'result-vote',choice:'next'});
 cons[1].fire('data',{t:'result-vote',choice:'lobby'});
 for(let tick=0;tick<27;tick++)ui.step(1000+tick*45);
 assert.ok(round.autoNextRemaining<7&&round.autoNextRemaining>5,
   'countdown continues with opposed votes');
 assert.match(ui.elements.get('replayBtn').textContent,/อีก 6 วิ/,
   'host button still shows the decreasing seconds and action label');
 assert.equal(ui.elements.get('replayBtn').dataset.votes,'1/2','A vote stays visible');
 assert.equal(ui.elements.get('backBtn').dataset.votes,'1/2','B vote stays visible');
 const packets=cons[0].sent.filter(m=>m.t==='result-votes');
 assert.equal(packets.at(-1).autoNextSeconds,6,
   'host synchronizes remaining seconds to controller');
 assert.equal(packets.at(-1).next,1,'countdown keeps next-vote count');
 assert.equal(packets.at(-1).lobby,1,'countdown keeps lobby-vote count');
 assert.ok(packets.length<15,'countdown broadcasts only once per displayed second');
 for(let tick=27;tick<175;tick++)ui.step(1000+tick*45);
 assert.notEqual(ui.scope.window.__ghostTest.getRound(),round,
   'automatic game advance still occurs at the original seven-second deadline');
 assert.equal(ui.scope.window.__ghostTest.getRound().phase,'roulette',
   'automatic next-game timer launches the reel immediately');
 finishReel(ui);
 assert.equal(ui.scope.window.__ghostTest.getRound().phase,'countdown');
}

// Explicit controller leave must remove the host seat immediately, with ack.
{
 const host=setup();host.click('hostBtn');host.instances[0].fire('open');
 const conn=host.instances[0].connect();host.instances[0].fire('connection',conn);
 conn.fire('data',{t:'join',name:'Leaving player'});
 assert.equal(host.scope.window.__ghostTest.getPlayers().length,1);
 conn.fire('data',{t:'leave'});
 assert.equal(host.scope.window.__ghostTest.getPlayers().length,0,'confirmed leave removes seat');
 assert.ok(conn.sent.some(m=>m.t==='leave-ack'),'host sends leave acknowledgment');
 assert.equal(conn.open,true,'do not close before ack delivery');
 const deadline=host.timers.find(timer=>timer.ms===300&&!timer.cancelled);
 assert.ok(deadline);deadline.fn();assert.equal(conn.open,false);
}
{
 // Safari landscape viewport regression: toolbar changes resize the visible
// area without changing the device's document/layout viewport.
const iphoneSafari={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X) AppleWebKit Safari',platform:'iPhone',maxTouchPoints:5};
const safari=setup('https://game.example/?join=ABCDE3',false,null,null,iphoneSafari);
safari.elements.get('nick').value='iPhone';
safari.click('joinBtn');
safari.instances[0].fire('open');
safari.instances[0].conn.fire('open');
safari.instances[0].conn.fire('data',{t:'welcome',id:'ios1',name:'iPhone',color:'#ff628c',
 mode:'ghost',phase:'playing'});
// Controller viewport writes are coalesced into the next paint.
safari.step(0);
assert.equal(safari.elements.get('controller').style['--gf-controller-visible-width'],'667px');
assert.equal(safari.elements.get('controller').style['--gf-controller-visible-height'],'305px');
safari.scope.window.visualViewport.width=640;
safari.scope.window.visualViewport.height=274;
safari.scope.window.visualViewport.offsetLeft=5;
safari.scope.window.visualViewport.offsetTop=16;
safari.scope.window.visualViewport.fire('resize');
safari.step(16);
assert.equal(safari.elements.get('controller').style['--gf-controller-visible-width'],'640px',
 'Safari toolbar resize must resize the controller without a page reload');
assert.equal(safari.elements.get('controller').style['--gf-controller-visible-height'],'274px');
assert.equal(safari.elements.get('controller').style['--gf-controller-visible-left'],'5px');
assert.equal(safari.elements.get('controller').style['--gf-controller-visible-top'],'16px');
safari.scope.window.visualViewport.offsetLeft=7;
safari.scope.window.visualViewport.fire('scroll');
safari.step(32);
assert.equal(safari.elements.get('controller').style['--gf-controller-visible-left'],'7px',
 'panning/visual offset updates must not clip the controller at either edge');
// The fixed right column must never overflow the viewport even on narrow phones.
for(const [width,height] of [[640,274],[667,305],[750,340],[844,390]]){
 const rail=Math.min(152,Math.max(92,width*.17));
 const diameter=height<=350?Math.min(95,Math.max(68,height*.25)):
   Math.min(136,Math.max(76,height*.28));
 assert.ok(rail>=diameter,'A/B visual circles must fit their allocated grid column');
}
const phone=setup('https://game.example/?join=ABCDE3');
 phone.elements.get('nick').value='Quitter';phone.click('joinBtn');
 phone.instances[0].fire('open');
 const conn=phone.instances[0].conn;conn.fire('open');
 conn.fire('data',{t:'welcome',id:'p1',name:'Quitter',color:'#ff628c',mode:'ghost',phase:'lobby'});
 phone.click('leaveBtn');phone.click('confirmLeaveBtn');
 assert.ok(conn.sent.some(m=>m.t==='leave'),'controller sends explicit leave packet');
 assert.equal(conn.open,true,'controller waits to close until ack');
 assert.equal(phone.elements.get('joinForm').classList.contains('hidden'),false);
 conn.fire('data',{t:'leave-ack',id:'p1'});
 assert.equal(conn.open,false,'ack safely closes controller');
 assert.equal(phone.elements.get('controllerActive').classList.contains('hidden'),true);
}

// A restored but not yet reopened HOST room must never show a ghost lobby.
{
 const saved=new Map([['gf-host-room-v2',JSON.stringify({
  code:'ABC234',players:[],nextId:1,selectedSessionMode:'board',autoNext:true
 })]]);
 const restore=setup('https://game.example/?host=1',false,saved);
 assert.equal(restore.instances.length,1,'stored HOST starts one room-restoration attempt');
 assert.equal(restore.instances[0].id,'gf-party-ABC234');
 assert.equal(restore.elements.get('home').classList.contains('hidden'),false,
  'during restoration the main screen remains visible, not a closed lobby');
 assert.equal(restore.elements.get('hostLobby').classList.contains('hidden'),true);
 restore.instances[0].fire('open');
 assert.equal(restore.elements.get('hostLobby').classList.contains('hidden'),false,
  'the lobby appears only after the signaling server confirms the room');
 assert.equal(restore.elements.get('hostRoomBadge').textContent,'ROOM ABC234');
}
{
 const saved=new Map([['gf-host-room-v2',JSON.stringify({
  code:'DEF456',players:[],nextId:1,selectedSessionMode:'queue',autoNext:true
 })]]);
 const failed=setup('https://game.example/?host=1',false,saved);
 const stalePeer=failed.instances[0];
 stalePeer.fire('error',{type:'network'});
 assert.equal(failed.elements.get('home').classList.contains('hidden'),false,
  'restoration remains at home until the original room code reconnects');
 assert.equal(failed.elements.get('hostLobby').classList.contains('hidden'),true);
 assert.equal(failed.sessionData.has('gf-host-room-v2'),true,
  'transient restore failure must retain the saved room snapshot');
 const retryTimer=failed.timers.find(t=>t.ms>=1000&&t.ms<=1200&&!t.cancelled);
 assert.ok(retryTimer,'network failure automatically retries original room');
 retryTimer.fn();
 assert.equal(failed.instances[1].id,'gf-party-DEF456',
  'recovered room preserves original code');
 stalePeer.fire('open');
 assert.equal(failed.elements.get('hostLobby').classList.contains('hidden'),true,
  'stale PeerJS cannot re-open the room');
 failed.instances[1].fire('open');
 assert.equal(failed.elements.get('hostLobby').classList.contains('hidden'),false,
  'restored HOST lobby returns after a successful retry');
}
{
 const lost=setup('https://game.example/?host=1');
 lost.click('hostBtn');const peer=lost.instances[0];peer.fire('open');
 const originalBadge=lost.elements.get('hostRoomBadge').textContent;
 peer.fire('disconnected');
 assert.equal(lost.elements.get('hostLobby').classList.contains('hidden'),false,
  'transient network disconnect must not kick a recoverable host');
 assert.equal(lost.elements.get('hostRoomBadge').textContent,originalBadge);
 const reconnects=lost.timers.filter(t=>t.ms>=1000&&t.ms<=1200&&!t.cancelled);
 assert.equal(reconnects.length,1,'disconnected event starts one scheduled reconnect');
 peer.fire('disconnected');
 assert.equal(lost.timers.filter(t=>t.ms>=1000&&t.ms<=1200&&!t.cancelled).length,1,
  'duplicate disconnected event cannot stack timers');
 reconnects[0].fn();
 assert.equal(peer.reconnectCount,1,'host calls peer.reconnect on same PeerJS instance');
 peer.fire('open');
 assert.equal(lost.elements.get('hostLobby').classList.contains('hidden'),false,
  'signal restoration must not navigate or restart an active lobby');
 peer.fire('close');
 assert.equal(lost.sessionData.has('gf-host-room-v2'),true,
  'a destroyed PeerJS must not silently erase the saved room');
 assert.equal(lost.elements.get('hostLobby').classList.contains('hidden'),false);
}
{
 const restoreSaved=new Map([['gf-host-room-v2',JSON.stringify({
  code:'FF2233',players:[],nextId:1,selectedSessionMode:'queue',autoNext:true
 })]]);
 const retry=setup('https://game.example/?host=1',false,restoreSaved);
 const firstPeer=retry.instances[0];
 firstPeer.fire('error',{type:'unavailable-id'});
 const pending=retry.timers.find(t=>t.ms>=1200&&!t.cancelled);
 assert.ok(pending,'occupied room code schedules a recoverable retry');
 retry.click('offlineBtn');
 assert.equal(pending.cancelled,true,
  'switching to offline cancels the pending room retry');
 assert.equal(retry.elements.get('hostRoomBadge').textContent,'OFFLINE');
 assert.equal(retry.elements.get('hostLobby').classList.contains('hidden'),false);
 pending.fn();
 assert.equal(retry.instances.length,1,
  'obsolete room retry cannot replace the new offline lobby');
}
// Per-connection PeerJS errors must not disconnect otherwise healthy signaling.
{
 const ui=setup();ui.click('hostBtn');
 const peer=ui.instances[0];peer.fire('open');
 const conn=peer.connect();peer.fire('connection',conn);
 conn.fire('data',{t:'join',name:'Protected phone'});
 const id=conn.sent.find(x=>x.t==='welcome')?.id;assert.ok(id);
 for(const type of ['peer-unavailable','webrtc','unexpected-peer-code']){
  peer.fire('error',{type});
  assert.equal(peer.disconnected,false,'non-signaling '+type+' cannot force a full host disconnect');
  assert.equal(peer.open,true,'other clients remain online after '+type);
  assert.equal(ui.scope.window.__ghostTest.getPlayers().length,1);
 }
 conn.fire('data',{t:'input',keys:{axisX:.5}});
 assert.equal(ui.scope.window.__ghostTest.getPlayers()[0].input.axisX,.5);
 peer.fire('error',{type:'invalid-id'});
 assert.equal(ui.elements.get('hostLobby').classList.contains('hidden'),false,
  'fatal PeerJS configuration error must not erase a running room');
 assert.equal(ui.sessionData.has('gf-host-room-v2'),true);
 assert.equal(conn.open,true,'fatal signaling error preserves existing DataConnection');
}
{
 const ui=setup();ui.click('hostBtn');
 const peer=ui.instances[0];peer.fire('open');
 peer.fire('error',{type:'socket-error'});
 assert.equal(peer.disconnected,true,'socket error enters signaling reconnection');
 const retry=ui.timers.find(t=>t.ms>=1000&&t.ms<=1200&&!t.cancelled);
 assert.ok(retry,'socket error schedules one reconnect');
 retry.fn();assert.equal(peer.reconnectCount,1);
 peer.fire('open');assert.equal(ui.elements.get('hostLobby').classList.contains('hidden'),false);
 peer.fire('disconnected');
 const pending=ui.timers.filter(t=>t.ms>=1000&&!t.cancelled);
 assert.ok(pending.length>0);
 // Explicit close is asserted separately by the reconnect-manager unit test.
}

// Closing an online room displays an in-app dialog; cancellation keeps peers.
const confirmHost=setup();
confirmHost.click('hostBtn');
confirmHost.instances[0].fire('open');
confirmHost.click('closeRoomBtn');
assert.equal(confirmHost.elements.get('uiModal').classList.contains('hidden'),false);
assert.equal(confirmHost.elements.get('hostLobby').classList.contains('hidden'),false);
confirmHost.click('uiCancelBtn');
assert.equal(confirmHost.elements.get('uiModal').classList.contains('hidden'),true);
assert.equal(confirmHost.elements.get('hostLobby').classList.contains('hidden'),false);

const phone=setup('https://game.example/?join=ABCDE3');
phone.elements.get('nick').value='Wut';phone.click('joinBtn');
phone.instances[0].fire('open');
const phoneConn=phone.instances[0].conn;
phoneConn.fire('open');
phoneConn.fire('data',{t:'welcome',id:'p1',name:'Wut',color:'#ff628c',
 mode:'ghost',phase:'lobby'});
assert.equal(phone.elements.get('videoPreviewToggleBtn').textContent,'จอปิด','controller starts with screen off');
assert.equal(phoneConn.sent.filter(m=>m.t==='preview-toggle').at(-1)?.enabled,false,
  'controller explicitly sends default OFF even before the first input packet');
assert.equal(phone.elements.get('controllerPreviewOff').classList.contains('hidden'),true,
  'the game selector remains visible in the lobby even while preview is off');
const unwantedVideo=phone.mediaCall('gf-party-ABCDE3');
phone.instances[0].fire('call',unwantedVideo);
assert.equal(unwantedVideo.closed,true,'disabled controller rejects incoming video without answering');
assert.equal(phone.elements.get('controller').classList.contains('hidden'),false);
assert.equal(phone.elements.get('phoneGamePicker').classList.contains('hidden'),false);
assert.equal(phone.elements.get('controllerInventory').classList.contains('hidden'),true,
  'joining room must not reveal role or items before gameplay');
assert.equal(phone.elements.get('buttonALabel').textContent,'');
assert.equal(phone.elements.get('buttonBLabel').textContent,'');
assert.equal(phone.elements.get('controllerModeName').textContent,'');
phoneConn.fire('data',{t:'inventory',id:'p1',mode:'ghost',phase:'playing',item:'slow',
 ghost:false,selecting:true,targetId:'p2',targetName:'Friend'});
assert.equal(phone.elements.get('controllerInventory').classList.contains('hidden'),true,
  'premature inventory messages must not render in lobby');
assert.equal(phone.elements.get('targetCycleControls').classList.contains('hidden'),true);
assert.equal(phone.pickButtons.length,15);
assert.equal(phone.pickButtons[13].dataset.pick,'ice_race');
assert.equal(phone.pickButtons[14].dataset.pick,'gladiators');
assert.equal(phone.pickButtons[4].dataset.pick,'color_switch');
assert.equal(phone.pickButtons[5].dataset.pick,'pizza_time');
assert.equal(phone.pickButtons[6].dataset.pick,'shopping_time');
 assert.equal(phone.pickButtons[7].dataset.pick,'knight_match');
assert.equal(phone.pickButtons[8].dataset.pick,'boulder_bash');
assert.equal(phone.pickButtons[9].dataset.pick,'snow_brawl');
 assert.equal(phone.pickButtons[10].dataset.pick,'witching_snake');
 assert.equal(phone.pickButtons[11].dataset.pick,'lawn_mower');
assert.equal(phone.pickButtons[12].dataset.pick,'color_claim');
assert.match(phone.pickButtons[9].children[0].innerHTML,/<svg[\s>]/);
assert.match(phone.pickButtons[4].children[0].innerHTML,/<svg[\s>]/);
assert.equal(phone.pickButtons[4].children[1].textContent,'COLOR SWITCH');
assert.equal(phone.pickButtons[2].dataset.pick,'fruit_memory');
assert.match(phone.pickButtons[2].children[0].innerHTML,/<svg[\s>]/);
assert.equal(phone.pickButtons[2].children[1].textContent,'FRUIT MEMORY');
assert.equal(phone.pickButtons[1].dataset.pick,'chickens');
assert.match(phone.pickButtons[1].children[0].innerHTML,/<svg[\s>]/);
assert.equal(phone.pickButtons[1].children[1].textContent,'CHICKENS');
assert.match(phone.pickButtons[0].children[0].innerHTML,/<svg[\s>]/);
assert.equal(phone.pickButtons[0].children[1].textContent,'GHOST ATTACK');
phone.pick('ghost');
assert.equal(phoneConn.sent.at(-1).mode,'ghost');
phoneConn.fire('data',{t:'roster',phase:'playing',mode:'ghost',
 players:[{id:'p1',active:true,choice:'ghost'}]});
assert.equal(phone.elements.get('phoneGamePicker').classList.contains('hidden'),true);
assert.equal(phone.elements.get('controllerPreviewOff').classList.contains('hidden'),false,
  'disabled preview shows a clear screen-off overlay during gameplay');
const previewFrame='data:image/jpeg;base64,QUJDRA==';
phoneConn.fire('data',{t:'preview',image:previewFrame});
assert.equal(phone.elements.get('controllerPreviewImage').src,'',
  'JPEG fallback is ignored while preview is disabled');
phone.click('videoPreviewToggleBtn');
assert.equal(phoneConn.sent.at(-1).t,'preview-toggle');
assert.equal(phoneConn.sent.at(-1).enabled,true);
assert.equal(phone.elements.get('videoPreviewToggleBtn').textContent,'จอเปิด');
assert.equal(phone.elements.get('controllerPreviewOff').classList.contains('hidden'),true);
phoneConn.fire('data',{t:'preview',image:previewFrame});
assert.equal(phone.elements.get('controllerPreviewImage').src,previewFrame,
  'opted-in controller can show JPEG fallback');
const activeVideo=phone.mediaCall('gf-party-ABCDE3');
activeVideo.metadata={type:'game-video',quality:'medium'};
phone.instances[0].fire('call',activeVideo);
assert.equal(activeVideo.answered,true,'opted-in controller answers host media calls');
const incomingStream={id:'test-stream'};
activeVideo.fire('stream',incomingStream);
assert.equal(phone.elements.get('controllerPreviewVideo').srcObject,incomingStream,
  'opted-in preview shows WebRTC stream');
phone.click('videoPreviewToggleBtn');
assert.equal(activeVideo.closed,true,'disabling preview closes WebRTC connection');
assert.equal(phone.elements.get('controllerPreviewVideo').srcObject,null);
assert.equal(phone.elements.get('controllerPreviewImage').src,'');
assert.equal(phoneConn.sent.at(-1).enabled,false,'host is asked to stop sending');
assert.equal(phone.elements.get('videoPreviewToggleBtn').textContent,'จอปิด');
assert.equal(phone.elements.get('controllerPreviewOff').classList.contains('hidden'),false);
phoneConn.fire('data',{t:'preview',image:previewFrame});
assert.equal(phone.elements.get('controllerPreviewImage').src,'','late frames are dropped while off');
assert.equal(phone.elements.get('controllerInventory').classList.contains('hidden'),false,
  'active Ghost Attack displays HUD in top rail');
assert.equal(phone.elements.get('buttonALabel').textContent,'ตีสตั้น');
assert.equal(phone.elements.get('buttonBLabel').textContent,'ใช้ไอเทม');
phoneConn.fire('data',{t:'inventory',id:'p1',mode:'rally',phase:'playing',
 item:'cloak',ghost:false,selecting:false});
assert.equal(phone.elements.get('inventoryItem').textContent,'',
  'inventory for the wrong minigame is ignored');
phoneConn.fire('data',{t:'inventory',id:'p1',mode:'ghost',phase:'playing',
 item:'slow',ghost:false,selecting:true,targetId:'p2',targetName:'Friend'});
assert.equal(phone.elements.get('inventoryItem').textContent,'ไอเทม: ยาสโลว์เพื่อน');
assert.equal(phone.elements.get('targetCycleControls').classList.contains('hidden'),false);
assert.equal(phone.elements.get('targetName').textContent,'Friend');
phone.click('targetPrevBtn');
assert.equal(phoneConn.sent.at(-1).direction,-1);
phone.click('targetNextBtn');
assert.equal(phoneConn.sent.at(-1).direction,1);
phoneConn.fire('data',{t:'inventory',id:'p1',mode:'ghost',phase:'playing',
 ghost:true,selecting:false,item:null});
assert.equal(phone.elements.get('targetCycleControls').classList.contains('hidden'),true);
assert.equal(phone.elements.get('controllerRole').textContent,'ผี');
phoneConn.fire('data',{t:'roster',phase:'results',mode:'ghost',
 players:[{id:'p1',active:true,choice:'ghost'}]});
assert.equal(phone.elements.get('controllerInventory').classList.contains('hidden'),true,
 'role and item must disappear as soon as a round ends');
assert.equal(phone.elements.get('inventoryItem').textContent,'');
assert.equal(phone.elements.get('buttonALabel').textContent,'เกมถัดไป 0/0');
assert.equal(phone.elements.get('buttonBLabel').textContent,'กลับล็อบบี้ 0/0');
phoneConn.fire('data',{t:'result-votes',next:1,lobby:0,total:2,nextLabel:'เกมถัดไป',autoNextSeconds:7});
assert.equal(phone.elements.get('buttonALabel').textContent,'เกมถัดไป • อีก 7 วิ 1/2',
  'the controller next-game action shows timer together with votes');
phoneConn.fire('data',{t:'result-votes',next:1,lobby:0,total:2,nextLabel:'เกมถัดไป',backLabel:'สรุปคะแนน',autoNextSeconds:6});
assert.equal(phone.elements.get('buttonALabel').textContent,'เกมถัดไป • อีก 6 วิ 1/2',
  'the controller countdown changes independently of the vote count');
assert.equal(phone.elements.get('buttonBLabel').textContent,'สรุปคะแนน 0/2');
phoneConn.fire('data',{t:'roster',phase:'summary',mode:'color_switch',players:[{id:'p1',active:true,choice:'color_switch'}]});
phoneConn.fire('data',{t:'result-votes',next:0,lobby:0,total:2,nextLabel:'เกมถัดไป',backLabel:'กลับล็อบบี้',autoNextSeconds:null});
assert.equal(phone.elements.get('buttonBLabel').textContent,'กลับล็อบบี้ 0/2','B changes to lobby on score summary');
phone.padButtons.action.fire('pointerdown');
assert.equal(phoneConn.sent.filter(m=>m.t==='result-vote').at(-1).choice,'next',
 'A joypad press votes to advance');
phone.padButtons.action.fire('pointerup');
phone.padButtons.alt.fire('pointerdown');
assert.equal(phoneConn.sent.filter(m=>m.t==='result-vote').at(-1).choice,'lobby',
 'B joypad press votes to return to lobby');
phone.padButtons.alt.fire('pointerup');
phoneConn.fire('data',{t:'inventory',id:'p1',mode:'ghost',phase:'playing',item:'slow',
 ghost:false,selecting:true,targetId:'p2',targetName:'Friend'});
assert.equal(phone.elements.get('controllerInventory').classList.contains('hidden'),true,
 'late packet from a finished game cannot bring the HUD back');
phoneConn.fire('data',{t:'roster',phase:'playing',mode:'new_future_game',
 players:[{id:'p1',active:true,choice:null}]});
assert.equal(phone.elements.get('controllerInventory').classList.contains('hidden'),true,
 'future minigames will never inherit Ghost Attack status');
phone.click('leaveBtn');phone.click('confirmLeaveBtn');
assert.equal(phone.elements.get('controller').classList.contains('hidden'),false);
assert.equal(phone.scope.window.location.search,'?controller=1');

// Full-size A/B touch zones use independent, exactly stacked grid tracks.
// A's rectangle NEVER reaches B's rectangle. Slow-item arrows get row three.
// The circles stay unchanged: touching blank space in a zone acts on its button.
assert.match(css,/BLIND-PLAY FACE TOUCH ZONES/);
assert.match(css,/grid-template-rows:repeat\(2,minmax\(0,1fr\)\)/,
  'two full-height, non-overlapping action regions');
assert.match(css,/\.gamepad-face-buttons \.face-a\{\s*grid-row:1;/,
  'A occupies only the top half');
assert.match(css,/\.gamepad-face-buttons \.face-b\{\s*grid-row:2;/,
  'B occupies only the bottom half');
assert.match(css,/\.gamepad-face-buttons \.target-cycle-controls\{[\s\S]*?grid-row:3;/,
  'slow item arrow controls remain below B in their own zone');
assert.match(css,/\.gamepad-face-buttons \.face-button\{[\s\S]*?pointer-events:none!important;/,
  'visual circles forward all pointer hit testing to the parent region');
assert.match(source,/const touchZone=btn.parentElement\?\.classList\?\.contains\('face-button-wrap'\)/,
  'pointer listeners are bound to full-size touch region, not just circle');
{
 const phone=setup('https://game.example/?join=TEST23');
 phone.elements.get('nick').value='Touch Test';
 phone.click('joinBtn');phone.instances[0].fire('open');
 const conn=phone.instances[0].conn;conn.fire('open');
 conn.fire('data',{t:'welcome',id:'p1',name:'Touch Test',color:'#ff628c',
  mode:'ghost',phase:'lobby'});
 conn.fire('data',{t:'roster',mode:'ghost',phase:'playing',
  players:[{id:'p1',active:true,choice:'ghost'}]});
 const lastKeys=()=>conn.sent.filter(x=>x.t==='input').at(-1).keys;
 // Touching blank space in the upper rectangle sends A, NOT B or joystick.
 phone.padZones.action.fire('pointerdown',{pointerId:101});
 assert.equal(lastKeys().action,true,'top touch zone maps to A');
 assert.equal(lastKeys().alt,false,'touching A never triggers B');
 assert.equal(phone.padButtons.action.classList.contains('pressed'),true,
  'the circular A button still animates when its surrounding rectangle is tapped');
 phone.padZones.action.fire('pointerdown',{pointerId:102});
 phone.padZones.action.fire('pointerup',{pointerId:101});
 assert.equal(lastKeys().action,true,'A stays pressed while second finger is down');
 phone.padZones.action.fire('pointerup',{pointerId:102});
 assert.equal(lastKeys().action,false,'A releases after the last pointer');
 // The lower rectangle is completely independent and can be held with A.
 phone.padZones.alt.fire('pointerdown',{pointerId:201});
 assert.equal(lastKeys().alt,true,'lower touch zone maps to B');
 assert.equal(lastKeys().action,false,'touching B never triggers A');
 assert.equal(phone.padButtons.alt.classList.contains('pressed'),true);
 phone.padZones.action.fire('pointerdown',{pointerId:301});
 assert.equal(lastKeys().action,true);
 assert.equal(lastKeys().alt,true,'both distinct zones support simultaneous touches');
 phone.padZones.action.fire('pointercancel',{pointerId:301});
 assert.equal(lastKeys().action,false,'cancelled A touch releases A only');
 assert.equal(lastKeys().alt,true,'cancelled A does not release B');
 phone.padZones.alt.fire('lostpointercapture',{pointerId:201});
 assert.equal(lastKeys().alt,false,'lost B capture safely releases B');
 // Disabled A must remain disabled even if tapped *outside* the circle.
 phone.padButtons.action.disabled=true;
 const before=conn.sent.filter(x=>x.t==='input').length;
 phone.padZones.action.fire('pointerdown',{pointerId:501});
 assert.equal(conn.sent.filter(x=>x.t==='input').length,before,
  'expanded touch zone does not bypass disabled state');
 assert.equal(phone.padButtons.action.classList.contains('pressed'),false);
}

// BOARD PARTY bomber: C appears below B only while the aiming preview is
// active; touch events send a separate cancel key and never mean A or B.
{
 const phone=setup('https://game.example/?join=BOMBER');
 phone.elements.get('nick').value='Pilot';
 phone.click('joinBtn');phone.instances[0].fire('open');
 const conn=phone.instances[0].conn;conn.fire('open');
 conn.fire('data',{t:'welcome',id:'pilot',name:'Pilot',color:'#ff628c',
  mode:'board',phase:'playing'});
 const frame={t:'board-state',phase:'playing',boardPhase:'aim',turnId:'aim-1',
  round:1,hp:100,stepsRemaining:0,bag:['bomber'],actionIndex:0,
  a:'โจมตี',b:'หมุน 45°',c:'ยกเลิก',help:'กำลังเล็งเครื่องบิน'};
 conn.fire('data',frame);
 assert.equal(phone.elements.get('controllerButtons').classList.contains('board-bomber-aim'),true);
 assert.equal(phone.elements.get('buttonC').disabled,false);
 assert.equal(phone.elements.get('buttonCLabel').textContent,'ยกเลิก');
 const last=()=>conn.sent.filter(m=>m.t==='input').at(-1).keys;
 phone.padZones.cancel.fire('pointerdown',{pointerId:311});
 assert.equal(last().cancel,true,'C sends its own cancellation key');
 assert.equal(last().alt,false,'C is independent from B rotation');
 assert.equal(last().action,false,'C never fires the bomber');
 phone.padZones.cancel.fire('pointerup',{pointerId:311});
 assert.equal(last().cancel,false,'releasing C clears the input');
 conn.fire('data',{...frame,boardPhase:'ready',turnId:'ready-2',
  c:'',a:'เรียกเครื่องบิน',b:'เปลี่ยนตัวเลือก'});
 assert.equal(phone.elements.get('controllerButtons').classList.contains('board-bomber-aim'),false);
 assert.equal(phone.elements.get('buttonC').disabled,true);
 // UFO shares the same C-cancel control and on-screen aim layout.
 conn.fire('data',{...frame,boardPhase:'aim',turnId:'ufo-aim-3',
  a:'ยืนยันสลับ',b:'',c:'ยกเลิก',help:'ลากจอยเลื่อน UFO ไปหาเป้าหมาย'});
 assert.equal(phone.elements.get('controllerButtons').classList.contains('board-bomber-aim'),true);
 assert.equal(phone.elements.get('buttonC').disabled,false,'C is visible for UFO aiming');
 assert.equal(phone.elements.get('buttonCLabel').textContent,'ยกเลิก');
 assert.match(phone.elements.get('buttonC').attributes['aria-label'],/เล็งไอเทม/);
 phone.padZones.cancel.fire('pointerdown',{pointerId:312});
 assert.equal(last().cancel,true,'UFO C sends cancel, not attack');
 assert.equal(last().action,false);
 phone.padZones.cancel.fire('pointerup',{pointerId:312});
 assert.equal(last().cancel,false);
 conn.fire('data',{...frame,boardPhase:'ready',turnId:'ufo-ready-4',
  c:'',a:'ใช้ไอเทม',b:'เปลี่ยนตัวเลือก'});
 assert.equal(phone.elements.get('buttonC').disabled,true,'C hides after UFO cancellation');
}
// BOARD PARTY after using an item: all six choices darken even if stock
// remains, only the Roll card stays active, and the real stock counts remain.
{
 const phone=setup('https://game.example/?join=LOCKED');
 phone.elements.get('nick').value='Inventory';
 phone.click('joinBtn');phone.instances[0].fire('open');
 const conn=phone.instances[0].conn;conn.fire('open');
 conn.fire('data',{t:'welcome',id:'locked',name:'Inventory',color:'#66aacc',mode:'board',phase:'playing'});
 const frame={t:'board-state',phase:'playing',boardPhase:'ready',turnId:'ready-locked',
  round:3,usedRound:3,hp:72,bag:['potion','shield','shield','rocket'],
  actionIndex:0,stepsRemaining:0,a:'ทอย',b:'เปลี่ยนตัวเลือก'};
 conn.fire('data',frame);
 const slots=phone.elements.get('inventoryItem').children;
 assert.equal(slots.length,7,'permanent roll + six item slots are rendered');
 assert.equal(slots[0].className.includes('is-selected'),true,'Roll stays bright/selectable');
 assert.equal(slots[0].className.includes('is-locked'),false);
 for(let i=1;i<7;i++)assert.equal(slots[i].className.includes('is-locked'),true,
  'all items are visibly locked after one item: slot '+i);
 assert.equal(slots[6].children.at(-1).textContent,'2','locked shield keeps the actual quantity');
 assert.match(phone.elements.get('inventoryGuide').textContent,/ทอยลูกเต๋าต่อ/);
 conn.fire('data',{...frame,turnId:'ready-next-round',round:4,usedRound:3});
 const unlocked=phone.elements.get('inventoryItem').children;
 assert.equal(unlocked[6].className.includes('is-locked'),false,
  'all stocked items unlock again when a NEW board round starts');
 assert.equal(unlocked[0].className.includes('is-selected'),true);
}
// Full room-preserving page refresh: same room, seat token, choice and color.
{
 const hostA=setup();
 hostA.click('hostBtn');hostA.instances[0].fire('open');
 const code=hostA.elements.get('roomCode').textContent;
 const token='controller-test-token-123456789';
 const peerA=hostA.instances[0],connA=peerA.connect();
 peerA.fire('connection',connA);
 connA.fire('data',{t:'join',name:'Resume Test',clientToken:token});
 const welcomeA=connA.sent.find(m=>m.t==='welcome');
 connA.fire('data',{t:'pick',mode:'fruit_memory'});
 const hostState=JSON.parse(hostA.sessionData.get('gf-host-room-v2'));
 assert.equal(hostState.code,code);
 assert.equal(hostState.players[0].choice,'fruit_memory');
 assert.equal(hostA.scope.window.GAME_CAN_AUTO_RELOAD(),false,
   'a connected Host lobby must retain PeerJS clients until the owner leaves');
 const hostB=setup('https://game.example/?host=1',false,hostA.sessionData);
 assert.equal(hostB.elements.get('home').classList.contains('hidden'),false,
  'restored HOST waits at home while signaling reconnects');
 assert.equal(hostB.elements.get('hostLobby').classList.contains('hidden'),true,
  'unconfirmed rooms never show a stale lobby');
 assert.equal(hostB.instances[0].id,'gf-party-'+code,'host restores the exact invite code');
 hostB.instances[0].fire('open');
 assert.equal(hostB.elements.get('hostLobby').classList.contains('hidden'),false,
  'lobby opens only after the saved room is confirmed');
 assert.equal(hostB.scope.window.__ghostTest.getPlayers().length,1);
 const peerB=hostB.instances[0],connB=peerB.connect();
 peerB.fire('connection',connB);
 connB.fire('data',{t:'join',name:'Resume Test',clientToken:token});
 assert.equal(connB.sent.find(m=>m.t==='welcome').id,welcomeA.id);
 assert.equal(connB.sent.find(m=>m.t==='welcome').color,welcomeA.color);
 assert.equal(connB.sent.find(m=>m.t==='welcome').choice,'fruit_memory');
 assert.equal(hostB.scope.window.__ghostTest.getPlayers().length,1,
   'reconnected controller reclaims its seat instead of duplicating');
 connB.close();
 assert.equal(hostB.scope.window.__ghostTest.getPlayers().length,1,
   'brief lost connection does not immediately kick the player');
 const connC=peerB.connect();peerB.fire('connection',connC);
 connC.fire('data',{t:'join',name:'Resume Test',clientToken:token});
 assert.equal(connC.sent.find(m=>m.t==='welcome').id,welcomeA.id);
 assert.equal(hostB.scope.window.__ghostTest.getPlayers().length,1);
 hostB.click('startBtn');
 assert.equal(hostB.scope.window.GAME_CAN_AUTO_RELOAD(),false,
   'a running match must NEVER be automatically refreshed');
 hostB.click('exitBtn');
 assert.equal(hostB.scope.window.GAME_CAN_AUTO_RELOAD(),false,
   'returning to an ONLINE lobby must not disconnect existing controllers');
 connC.fire('data',{t:'leave'});
 assert.equal(hostB.scope.window.__ghostTest.getPlayers().length,0,
   'intentional exit frees a player slot immediately');
}
{
 const oldPhone=setup('https://game.example/?join=ABCD23');
 oldPhone.elements.get('nick').value='Phone Resume';
 oldPhone.click('joinBtn');oldPhone.instances[0].fire('open');
 const first=oldPhone.instances[0].conn;first.fire('open');
 const firstJoin=first.sent.find(m=>m.t==='join');
 first.fire('data',{t:'welcome',id:'p3',name:'Phone Resume',color:'#ff628c',
   mode:'ghost',phase:'lobby',choice:'ghost',active:false});
 assert.equal(oldPhone.scope.window.GAME_CAN_AUTO_RELOAD(),false,
   'joined controller lobby must not reload its open PeerJS transport');
 assert.equal(JSON.parse(oldPhone.sessionData.get('gf-phone-room-v2')).code,'ABCD23');
 const newPhone=setup('https://game.example/?join=ABCD23',false,oldPhone.sessionData);
 assert.equal(newPhone.elements.get('controller').classList.contains('hidden'),false);
 const resume=newPhone.timers.find(t=>t.ms===250&&!t.cancelled);
 assert.ok(resume,'phone should retry the stored room after page refresh');
 resume.fn();
 assert.equal(newPhone.instances.length,1);
 newPhone.instances[0].fire('open');
 const next=newPhone.instances[0].conn;next.fire('open');
 const nextJoin=next.sent.find(m=>m.t==='join');
 assert.equal(nextJoin.clientToken,firstJoin.clientToken,'stable identity across reload');
 assert.equal(nextJoin.name,'Phone Resume');
 next.fire('data',{t:'welcome',id:'p3',name:'Phone Resume',color:'#ff628c',
   mode:'ghost',phase:'lobby',choice:'ghost',active:false});
 assert.equal(newPhone.elements.get('controllerActive').classList.contains('hidden'),false,
   'joined gamepad view restored automatically');
 next.fire('data',{t:'roster',phase:'playing',mode:'ghost',
   players:[{id:'p3',active:true,choice:'ghost'}]});
 assert.equal(newPhone.scope.window.GAME_CAN_AUTO_RELOAD(),false,
   'controller must not hot-reload while actually playing');
 next.fire('data',{t:'roster',phase:'lobby',mode:'ghost',
   players:[{id:'p3',active:false,choice:'ghost'}]});
 assert.equal(newPhone.scope.window.GAME_CAN_AUTO_RELOAD(),false,
   'even a controller showing the room lobby must remain connected');
}
{
 const offlineA=setup();offlineA.click('offlineBtn');
 const oldBotCount=offlineA.scope.window.__ghostTest.getPlayers().length;
 const offlineB=setup('https://game.example/?host=1',false,offlineA.sessionData);
 assert.equal(offlineB.elements.get('hostLobby').classList.contains('hidden'),false);
 assert.equal(offlineB.scope.window.__ghostTest.getPlayers().length,oldBotCount);
 assert.equal(offlineB.scope.window.GAME_CAN_AUTO_RELOAD(),true);
}
// The green roulette outline must share the card width, not exceed it.
// Its height is shared by CSS on landscape and short/mobile screens.
{
 const ui=setup();ui.click('offlineBtn');
 for(const width of [390,844,1473]){
  ui.scope.window.innerWidth=width;
  ui.scope.window.__ghostTest.beginGameSelection('ghost');
  const spin=ui.scope.window.__ghostTest.getSelection();
  assert.ok(spin);
  assert.equal(ui.elements.get('gameRoulette').style['--roulette-card-width'],
   spin.winner.style.width,'selected frame matches width at '+width);
  ui.scope.window.__ghostTest.updateGameSelection(spin.spinDuration);
  assert.equal(ui.elements.get('gameRoulette').classList.contains('is-selected'),true);
  ui.scope.window.__ghostTest.updateGameSelection(spin.holdDuration+.01);
  ui.scope.window.__ghostTest.returnToLobby();
 }
 assert.match(css,/width:var\(--roulette-card-width,190px\)/);
 assert.match(css,/height:var\(--roulette-card-height\)/);
 assert.match(css,/transform:translate\(-50%,-50%\)/);
}
{
 // QA controls must exist ONLY for all-bot GHOST ATTACK, never human rooms
 // or other modes. Tapping a prop provides its true stable world coordinates.
 const ui=setup('https://game.example/?host=1',false,null,
  {left:0,top:0,width:960,height:540});
 ui.click('offlineBtn');ui.scope.window.__ghostTest.startRound('ghost');
 const api=ui.scope.window.__ghostTest,r=api.getRound();
 assert.equal(r.mode,'ghost');
 assert.equal(ui.elements.get('botGhostIdsBtn').classList.contains('hidden'),false);
 assert.equal(ui.elements.get('ghostMapInspector').classList.contains('hidden'),true);
 assert.equal(r.ghost.showObstacleIds,false);
 const original=JSON.stringify(r.ghost.obstacles);
 ui.click('botGhostIdsBtn');
 assert.equal(r.ghost.showObstacleIds,true);
 assert.equal(ui.elements.get('ghostMapInspector').classList.contains('hidden'),false);
 assert.match(ui.elements.get('ghostMapName').textContent,/GHOST ATTACK/);
 assert.ok(ui.elements.get('ghostMapName').textContent.includes(
  ui.scope.window.GhostCemeteryArt.themeLabel(r.ghost.theme)));
 assert.ok(ui.elements.get('ghostMapDetails').textContent.includes(
  r.ghost.world.w+' × '+r.ghost.world.h));
 const prop=r.ghost.obstacles[1],x=(prop.x+prop.w/2)*960/r.ghost.world.w,
  y=(prop.y+prop.h/2)*540/r.ghost.world.h;
 const canvas=ui.elements.get('arena');
 canvas.fire('pointerdown',{pointerId:71,clientX:x,clientY:y});
 canvas.fire('pointerup',{pointerId:71,clientX:x,clientY:y});
 assert.equal(r.ghost.selectedObstacleId,prop.id);
 assert.ok(ui.elements.get('ghostObjectDetails').textContent.includes(prop.id));
 assert.ok(ui.elements.get('ghostObjectDetails').textContent.includes(prop.kind));
 assert.equal(JSON.stringify(r.ghost.obstacles),original,
  'inspection must never modify prop collision hitboxes');
 ui.click('botGhostIdsBtn');
 assert.equal(r.ghost.showObstacleIds,false);
 assert.equal(ui.elements.get('ghostMapInspector').classList.contains('hidden'),true);
 api.startRound('chickens');
 assert.equal(ui.elements.get('botGhostIdsBtn').classList.contains('hidden'),true);
 assert.equal(ui.elements.get('ghostMapInspector').classList.contains('hidden'),true);
}
{
 const ui=setup();ui.click('hostBtn');const peer=ui.instances[0];peer.fire('open');
 const conn=peer.connect();peer.fire('connection',conn);
 conn.fire('data',{t:'join',name:'Human'});
 ui.scope.window.__ghostTest.startRound('ghost');
 assert.equal(ui.elements.get('botGhostIdsBtn').classList.contains('hidden'),true,
  'human/phone rooms never expose private QA controls');
 ui.click('botGhostIdsBtn');
 assert.equal(ui.scope.window.__ghostTest.getRound().ghost.showObstacleIds,false);
}
// Host-only possession must NOT create a new player or touch other bot AI.
{
 const ui=setup();ui.click('offlineBtn');ui.click('addLocalBtn');
 ui.sessionButtons[2].fire('click');ui.click('startBtn');
 const api=ui.scope.window.__ghostTest,board=api.getBoard(),I=ui.scope.window.BoardItems,P=ui.scope.window.BoardParty;
 const bots=api.getPlayers(),count=bots.length,first=bots[0],second=bots[1];
 assert.equal(ui.elements.get('botTestPad').classList.contains('hidden'),false,'bots-only room shows a small host test control');
 ui.click('botPossessBtn');
 assert.equal(first.isBot,false);assert.equal(board.players[0].isBot,false);
 assert.equal(second.isBot,true,'only one bot is replaced by human controls');
 assert.equal(api.getPlayers().length,count,'possession never inserts another seat');
 const stick=ui.elements.get('botTestStick');
 stick.fire('pointerdown',{pointerId:17,clientX:135,clientY:100});
 assert.ok(first.input.axisX>.15,'touch joystick sends analog X instead of keyboard-only input');
 stick.fire('pointerup',{pointerId:17});
 assert.equal(first.input.axisX,0,'joystick pointer release does not drift');
 ui.elements.get('botTestA').fire('pointerdown',{pointerId:18});
 assert.equal(first.input.action,true,'A works while the stick can be held separately');
 ui.elements.get('botTestB').fire('pointerdown',{pointerId:19});
 assert.equal(first.input.alt,true,'A and B support simultaneous touches');
 ui.elements.get('botTestA').fire('pointerup',{pointerId:18});
 ui.elements.get('botTestB').fire('pointerup',{pointerId:19});
 assert.equal(first.input.action,false);assert.equal(first.input.alt,false);
 ui.click('botNextBtn');
 assert.equal(first.isBot,true,'previous bot returns to normal AI on switch');
 assert.equal(second.isBot,false,'next bot becomes the only player-controlled bot');
 assert.equal(board.players[0].isBot,true);assert.equal(board.players[1].isBot,false);
 ui.click('botUnlimitedBtn');
 let possessed=board.players[1];
 assert.equal(possessed.debugUnlimitedItems,true,'infinity is restricted to the possessed board bot');
 assert.equal(ui.elements.get('botUnlimitedBtn').attributes['aria-pressed'],'true');
 assert.deepEqual(Array.from(new Set(possessed.bag)),Array.from(I.ids),'debug bot has all six items without a huge inventory');
 assert.equal(board.players[0].debugUnlimitedItems,undefined,'other bot inventory is never modified');
 // Infinite stock still obeys the one-item-per-round rule. Potion
 // returns to Roll on the same owner's turn, never another item.
 board.order=[possessed.id,...board.players.filter(p=>p.id!==possessed.id).map(p=>p.id)];
 const initialRound=board.roundNumber;
 for(let k=0;k<2;k++){
  board.roundNumber=initialRound+k;board.turnIndex=0;P.startTurn(board);
  possessed.hp=20;
  possessed.actionIndex=I.ids.indexOf('potion')+1;
  assert.equal(P.action(board,possessed.id,'A'),true,'debug potion works in a new round');
  assert.equal(possessed.hp,70);
  assert.equal(possessed.bag.length,I.ids.length,'unlimited debug stock is not consumed');
  assert.equal(possessed.usedRound,board.roundNumber,'debug stock still respects one item per round');
  for(let t=0;t<22&&board.phase!=='ready';t++)P.update(board,.05);
  assert.equal(board.phase,'ready');
  assert.equal(P.current(board).id,possessed.id,'potion returns to the same player to roll');
  assert.equal(board.moveDice,null,'dice do not roll until player presses A');
  assert.deepEqual(Array.from(I.availableSlots(possessed,board.roundNumber)),[0]);
  possessed.actionIndex=I.ids.indexOf('potion')+1;
  assert.equal(P.action(board,possessed.id,'A'),false,'infinite stock cannot use twice in one round');
  possessed.actionIndex=0;
  assert.equal(P.action(board,possessed.id,'A'),true,'infinite-stock test player can manually roll');
  assert.equal(board.phase,'dice');
 }
 ui.click('botUnlimitedBtn');
 assert.equal(possessed.debugUnlimitedItems,false);
 assert.deepEqual(Array.from(possessed.bag),[],'turning off infinity restores original inventory');
 assert.equal(possessed.usedRound,0);
 ui.click('botReleaseBtn');
 assert.equal(first.isBot,true);assert.equal(second.isBot,true);
 assert.equal(board.players[1].isBot,true);
 assert.equal(ui.elements.get('botTestControls').classList.contains('hidden'),true);
 assert.equal(api.getPlayers().length,count);
 ui.click('exitBtn');
 assert.equal(ui.elements.get('botTestPad').classList.contains('hidden'),true,'pad is removed when returning to lobby');
}
// Rooms with a real remote player must not expose the host possession control.
{
 const ui=setup();ui.click('hostBtn');ui.instances[0].fire('open');
 const c=ui.instances[0].connect();ui.instances[0].fire('connection',c);
 c.fire('data',{t:'join',name:'Human'});c.fire('data',{t:'pick',mode:'chickens'});
 ui.click('startBtn');finishReel(ui);
 assert.equal(ui.elements.get('botTestPad').classList.contains('hidden'),true,'public rooms with a phone stay unaffected');
}

// Retina host-canvas regression. The CSS size, world coordinates and
// video-stream canvas remain unchanged while the backing bitmap gets sharper.
{
 const viewport={width:1024,height:576};
 const hi=setup('https://game.example/?host=1',false,null,viewport);
 hi.click('offlineBtn');hi.click('startBtn');
 finishReel(hi);
 const frame=hi.elements.get('arena');
 hi.step(16.667);
 assert.equal(frame.width,2048,'2x iPad DPR and 1024 CSS px must yield a 2048px backing');
 assert.equal(frame.height,1152,'the 16:9 backing ratio is preserved');
 assert.ok(Math.abs(hi.canvasTransforms.at(-1)[0]-2048/960)<1e-8);
 assert.ok(Math.abs(hi.canvasTransforms.at(-1)[3]-1152/540)<1e-8);
 const renderedAt=hi.canvasTransforms.length;
 hi.step(33.334);
 assert.equal(hi.canvasTransforms.length,renderedAt,
   'do not reallocate the canvas every animation frame');
 // Rotated host display is still rendered for the long side, not width alone.
 viewport.width=576;viewport.height=1024;
 hi.scope.window.fire('orientationchange');
 hi.step(50);
 assert.equal(frame.width,2048);
 assert.equal(frame.height,1152);
 // Desktop/4K-style displays never allocate an unbounded canvas.
 viewport.width=2500;viewport.height=1406.25;
 hi.scope.window.fire('resize');
 hi.step(66.667);
 assert.equal(frame.width,2880,'resolution is capped at 3x for GPU safety');
 assert.equal(frame.height,1620);
 // Shrink back to another valid size; no fixed-size/low-res canvas remains.
 viewport.width=640;viewport.height=360;
 hi.scope.window.fire('resize');
 hi.step(83.333);
 assert.equal(frame.width,1280);
 assert.equal(frame.height,720);
 assert.equal(hi.scope.window.__ghostTest.getRound().ghost.world.w,1080,
   'viewport resizing must not change the 1–6-player arena width');
 assert.equal(hi.scope.window.__ghostTest.getRound().ghost.world.h,608,
   'viewport resizing must not change the 1–6-player arena height');
}
// Tall iPad/Stage Manager viewports must no longer leave black bands above
// and below BOARD PARTY. Preserve an isometric 960-X logical world and cap GPU.
{
 const viewport={width:1024,height:768};
 const host=setup('https://game.example/?host=1',false,null,viewport);
 host.click('offlineBtn');
 host.sessionButtons[2].fire('click');host.click('startBtn');
 const board=host.scope.window.__ghostTest.getBoard(),frame=host.elements.get('arena');
 assert.ok(board,'a real BOARD PARTY game is active');
 host.step(16.667);
 assert.equal(board.camera.viewHeight,720,'4:3 physical view expands the virtual map height');
 assert.ok(Math.abs(frame.width/frame.height-1024/768)<.002,'bitmap fills 4:3 without letterboxing');
 const savedMap=board.map,savedTime=board.time;
 viewport.width=1024;viewport.height=1024;
 host.scope.window.fire('resize');host.step(33.334);
 assert.equal(board.camera.viewHeight,960,'1:1 Split View uses the whole available height');
 assert.ok(Math.abs(frame.width/frame.height-1)<.002);
 assert.ok(frame.width*frame.height<=3650000,'retina bitmap is bounded under split-screen GPU budget');
 assert.equal(board.map,savedMap,'resizing the host must not rebuild the game map');
 assert.ok(board.time>=savedTime,'resizing cannot reset the board simulation');
 viewport.width=1024;viewport.height=576;
 host.scope.window.fire('resize');host.step(50);
 assert.equal(board.camera.viewHeight,540,'normal 16:9 layout remains unchanged');
 assert.ok(Math.abs(frame.width/frame.height-16/9)<.002);
}
console.log('BOARD RESPONSIVE PASS: 16:9, 4:3 and square split-screen host canvas');
console.log('SMOKE PASS: 12-player cap, host/controller reconnect, and Retina 2x/3x host canvas scaling');

// All chicken gameplay rules run alongside the existing GHOST ATTACK regression suite.
require('./chickens.cjs');
require('./shockwave.cjs');


// A rejected new plug-in cannot eject everyone from an active BOARD session.
{
 const host=setup();host.click('offlineBtn');host.sessionButtons[2].fire('click');
 host.click('startBtn');
 const api=host.scope.window.__ghostTest,P=host.scope.window.BoardParty;
 const s=api.getBoard(),oldOrder=Array.from(s.order);
 const oldItems=s.players.map(p=>Array.from(p.bag||[]));
 const oldNodes=s.players.map(p=>p.currentNodeId);
 P.phase(s,'minigame_pending');
 assert.equal(P.minigameStarted(s,'ghost'),true);
 api.beginGameSelection('ghost');
 const reel=api.getSelection();
 assert.ok(reel,'BOARD roulette is active');
 reel.error=Error('broken-new-game');
 api.updateGameSelection(5);
 assert.equal(api.getBoard(),s,'a broken game cannot reset the board');
 assert.equal(api.getRound().mode,'board','host returns to the same BOARD screen');
 assert.equal(s.phase,'standings','skipped game enters a neutral standings transition');
 assert.deepEqual(Array.from(s.order),oldOrder);
 assert.deepEqual(s.players.map(p=>Array.from(p.bag||[])),oldItems);
 assert.deepEqual(s.players.map(p=>p.currentNodeId),oldNodes);
 assert.ok(s.results.every(item=>item.reward===null),'failed game grants no rewards');
}
// BOARD PARTY integration uses the real app dispatcher and all six real engines.
{
 const ui=setup();ui.click('offlineBtn');ui.sessionButtons[2].fire('click');
 delete ui.scope.window.BoardArt;ui.click('startBtn');
 assert.equal(ui.scope.window.__ghostTest.getBoard(),null);assert.equal(ui.scope.window.__ghostTest.getRound(),null);
 assert.equal(ui.elements.get('hostLobby').classList.contains('hidden'),false);
 assert.match(ui.elements.get('uiToast').textContent,/โหลด BOARD PARTY ไม่ครบ/,'incomplete assets leave a usable lobby instead of a blank game');
}
for(const count of [1,12]){
 const ui=setup();ui.click('offlineBtn');
 const api=ui.scope.window.__ghostTest,P=ui.scope.window.BoardParty;
 while(api.getPlayers().length<count)ui.click('addLocalBtn');
 if(count===1)api.getPlayers().splice(1);
 ui.sessionButtons[2].fire('click');ui.click('startBtn');
 const s=api.getBoard(),map=s.map;
 assert.equal(api.getRound().mode,'board');assert.equal(s.players.length,count);
 assert.equal(s.phase,'overview');
 assert.equal(s.deadline,Infinity,'exploration has no human timeout');
 api.updateBoard(1);api.updateBoard(.95);
 assert.equal(s.phase,'overview','full-map introduction remains visible before two seconds');
 assert.equal(ui.elements.get('boardStartDiceBtn').classList.contains('hidden'),true,'manual skip is hidden now that intro is timed');
 api.updateBoard(.05);
 assert.equal(s.phase,'intro_zoom','camera fly-in begins automatically at two seconds');
 assert.ok(Math.abs(s.deadline-s.phaseAt-1.5)<1e-9,'intro zoom lasts 1.5 seconds');
 assert.ok(s.camera.introFrom&&Number.isFinite(s.camera.introFrom.zoom),
   'camera captures the current overview framing before zooming');
 // Camera fly-in must interpolate toward the real starting node, not an arbitrary point.
 const start=s.map.nodes[s.players[0].currentNodeId].position;
 const beforeZoom=s.camera.introFrom.zoom;
 const beforeDistance=Math.hypot(s.camera.introFrom.x-start.x,s.camera.introFrom.y-start.y);
 api.updateBoard(.75);
 const drawCtx=new Proxy({}, {get(obj,key){if(key==='createLinearGradient'||key==='createRadialGradient')return()=>({addColorStop(){}});return key in obj?obj[key]:(obj[key]=()=>{});},set(obj,key,value){obj[key]=value;return true;}});
 ui.scope.window.BoardArt.draw(drawCtx,s.time,s);
 assert.ok(s.camera.zoom>beforeZoom&&s.camera.zoom<1,'zoom visibly interpolates during fly-in');
 assert.ok(Math.hypot(s.camera.x-start.x,s.camera.y-start.y)<beforeDistance,'camera moves toward the actual start position');
 api.updateBoard(.7);
 assert.equal(s.phase,'intro_zoom','order cannot start until the fly-in finishes');
 api.updateBoard(.05);
 assert.equal(s.phase,'order','dice ordering starts automatically after 3.5 seconds');
 assert.equal(ui.elements.has('boardStartDiceBtn'),true,'legacy element remains for accessibility but auto intro needs no click');
 for(let i=0;i<10000&&s.phase!=='minigame';i++)api.updateBoard(.05);
 assert.equal(s.phase,'minigame','every turn completes and starts the reel');
 assert.ok(api.getSelection());
 api.updateGameSelection(3.5); // BOARD reel: 2s spin + 1.4s result hold
 assert.equal(api.getSelection(),null);assert.notEqual(api.getRound().mode,'board');
 const saved=JSON.stringify(P.snapshot(s));
 for(const mode of ['ghost','chickens','fruit_memory','shockwave','color_switch','pizza_time','knight_match','boulder_bash','snow_brawl','shopping_time']){
  P.phase(s,'minigame');api.startRound(mode);
  for(let i=0;i<30000&&api.getRound().mode!=='board';i++)api.updateRound(.05);
  assert.equal(api.getRound().mode,'board',mode+' must finish via the normal engine outcome');
  assert.equal(s.phase,'standings');assert.equal(s.results.length,count);
  assert.equal(JSON.stringify(P.snapshot(s)),saved,mode+' cannot change board data');
  assert.equal(s.map,map);assert.equal(ui.elements.get('results').classList.contains('hidden'),true);
  assert.equal(api.resultVoteSnapshot(),null,'no NORMAL result vote in a board intermission');
 }
 // Complete results -> inventory -> original board, then real finish and replay.
 const expectedOrder=Array.from(s.order).sort((a,b)=>s.results.find(p=>p.id===a).rank-s.results.find(p=>p.id===b).rank);
 for(let i=0;i<400&&s.phase!=='ready';i++)api.updateBoard(.05);
 assert.equal(s.phase,'ready');assert.equal(s.roundNumber,2);assert.equal(s.map,map);
 assert.deepEqual(Array.from(s.order),expectedOrder,'actual minigame results determine the next board order');
 const p=P.current(s);p.isBot=false;
 const beforeFinish=s.map.nodes[s.map.finishId].previousNodes.find(id=>id.startsWith('n'));
 assert.ok(beforeFinish,'finish has a traversable main-route predecessor');
 p.currentNodeId=beforeFinish;delete p.worldPosition;P.beginMove(s,p,1);
 const from=s.map.nodes[beforeFinish].position,to=s.map.nodes[s.map.finishId].position,d=Math.hypot(to.x-from.x,to.y-from.y);
 // Real phones refresh held direction; a single packet expires after .9s.
 for(let i=0;i<Math.ceil(d/240/.05)+160&&api.getRound().phase!=='results';i++){
  P.input(s,p.id,{turnId:s.turnId,actionId:(s.lastActions[p.id]??0)+1,keys:{axisX:(to.x-from.x)/d,axisY:(to.y-from.y)/d}});
  api.updateBoard(.05);
 }
 assert.equal(s.phase,'finished');assert.equal(api.getRound().phase,'results');
 const winnerNote=ui.elements.get('resultList').children[0].children[1].textContent;
 assert.equal(winnerNote,'100% • HP '+p.hp+'/100','finish summary uses current map length and HP maximum');
 assert.ok(api.resultVoteSnapshot());ui.click('replayBtn');
 assert.notEqual(api.getBoard(),s);assert.notEqual(api.getBoard().map,map);assert.equal(api.getBoard().phase,'overview');assert.equal(api.getPlayers().length,count);
 ui.click('exitBtn');assert.equal(api.getBoard(),null);
 ui.sessionButtons[1].fire('click');ui.click('startBtn');finishReel(ui);assert.notEqual(api.getRound().mode,'board');assert.ok(api.getTournament().endless);
}
{
 const ui=setup();ui.click('hostBtn');ui.instances[0].fire('open');const peer=ui.instances[0];
 const conn=peer.connect();peer.fire('connection',conn);conn.fire('data',{t:'join',name:'Board phone',clientToken:'stable-board-token'});
 const api=ui.scope.window.__ghostTest,P=ui.scope.window.BoardParty;
 ui.sessionButtons[2].fire('click');assert.equal(ui.elements.get('startBtn').disabled,false,'no minigame nomination needed');ui.click('startBtn');
 const s=api.getBoard(),p=s.players[0];let state=conn.sent.filter(p=>p.t==='board-state').at(-1);
 assert.equal(s.phase,'overview');
 conn.fire('data',{t:'input',turnId:state.turnId,actionId:1,keys:{alt:true}});
 assert.equal(p.dice,null,'roll input rejected during map overview');
 api.updateBoard(1);api.updateBoard(1);
 assert.equal(s.phase,'intro_zoom','human overview automatically ends at two seconds');
 conn.fire('data',{t:'input',turnId:state.turnId,actionId:2,keys:{action:true}});
 assert.equal(s.phase,'intro_zoom','stale phone A cannot restart an automatic camera fly-in');
 state=conn.sent.filter(p=>p.t==='board-state').at(-1);
 conn.fire('data',{t:'input',turnId:state.turnId,actionId:3,keys:{alt:true}});
 assert.equal(p.dice,null,'roll input rejected while camera is zooming');
 api.updateBoard(1);api.updateBoard(.5);
 assert.equal(s.phase,'order','online game starts dice ordering automatically');
 state=conn.sent.filter(p=>p.t==='board-state').at(-1);
 conn.fire('data',{t:'input',turnId:state.turnId,actionId:4,keys:{alt:true}});assert.ok(p.dice,'B can roll order after fly-in');
 const dice=JSON.stringify(p.dice);conn.fire('data',{t:'input',turnId:state.turnId,actionId:3,keys:{alt:true}});assert.equal(JSON.stringify(p.dice),dice);
 for(let i=0;i<120;i++)api.updateBoard(.05);assert.equal(s.phase,'ready');
 conn.fire('data',{t:'input',turnId:state.turnId,actionId:2,keys:{action:true}});assert.equal(s.phase,'ready','old turn packet rejected');
 state=conn.sent.filter(p=>p.t==='board-state').at(-1);conn.fire('data',{t:'input',turnId:state.turnId,actionId:5,keys:{action:true}});assert.equal(s.phase,'dice');
 const id=p.id,node=p.currentNodeId;conn.close();
 const seat=ui.timers.findLast(t=>t.ms===60000&&!t.cancelled);assert.ok(seat);seat.fn();assert.equal(api.getPlayers().length,1);assert.equal(p.isBot,true);assert.equal(p.currentNodeId,node);
 const replacement=peer.connect();peer.fire('connection',replacement);replacement.fire('data',{t:'join',name:'Board phone',clientToken:'stable-board-token'});
 assert.equal(api.getPlayers()[0].id,id);assert.equal(p.isBot,false);assert.equal(p.currentNodeId,node);
 s.order=[id];P.startTurn(s);conn.fire('data',{t:'input',turnId:s.turnId,actionId:9999,keys:{action:true}});assert.equal(s.phase,'ready','superseded connection cannot inject commands');
 replacement.fire('data',{t:'input',turnId:s.turnId,actionId:1,keys:{action:true}});assert.equal(s.phase,'dice','reconnected phone has a fresh input sequence');
 const movementTotal=s.die;assert.equal(s.moveDice.length,2);
 for(let i=0;i<50;i++)api.updateBoard(.05);state=replacement.sent.filter(p=>p.t==='board-state').at(-1);
 assert.equal(state.stepsRemaining,movementTotal);assert.equal(state.boardPhase,'move_ready');assert.equal(state.a,'เริ่มเดิน');assert.match(state.help,/ดูแผนที่/);
 const beforeZoom=s.camera.zoom,controlToken=s.turnId;
 replacement.fire('data',{t:'board-camera-zoom',direction:1});
 assert.ok(s.camera.zoom>beforeZoom,'remote phone + magnifies the HOST board while walking');
 assert.equal(s.turnId,controlToken,'zoom cannot advance or steal a control turn');
 assert.equal(s.move.remaining,movementTotal,'camera zoom does not consume dice steps');
 const pressed=s.camera.zoom;
 replacement.fire('data',{t:'board-camera-zoom',direction:-1});
 assert.equal(s.camera.zoom,pressed,'zoom packet burst is throttled');
 replacement.fire('data',{t:'board-camera-zoom',direction:5});
 assert.equal(s.camera.zoom,pressed,'invalid remote zoom commands are ignored');
 const sendBoard=keys=>replacement.fire('data',{t:'input',turnId:s.turnId,actionId:(s.lastActions[id]??0)+1,keys});
 const a=s.map.nodes[p.currentNodeId].position,b=s.map.nodes.n1.position,d=Math.hypot(b.x-a.x,b.y-a.y);
 sendBoard({});
 for(let i=0;i<200&&p.currentNodeId!=='n1';i++){
  sendBoard({axisX:(b.x-a.x)/d,axisY:(b.y-a.y)/d});api.updateBoard(.05);
 }
 state=replacement.sent.filter(p=>p.t==='board-state').at(-1);
 assert.equal(state.stepsRemaining,movementTotal-1);assert.equal(p.currentNodeId,'n1');
 P.startTurn(s);p.bag=['shield'];p.item='shield';p.actionIndex=0;p.usedRound=0;
 sendBoard({alt:true});
 assert.equal(p.actionIndex,6,'B skips empty types to choose the shield slot');
 assert.equal(p.bagOpen,false,'there is no popup bag');
 sendBoard({});sendBoard({action:true});
 api.updateBoard(.05);state=replacement.sent.filter(p=>p.t==='board-state').at(-1);
 assert.equal(state.shieldTurns,1,'manually activated shield is active for this BOARD round');assert.equal(p.shieldRound,s.roundNumber);assert.equal(p.item,null);assert.equal(p.bag.length,0);
}
{
 // Pre-roll camera mode: a real remote player may hide the item selector,
// drag/zoom the board and double-tap back WITHOUT rolling or changing inventory.
{
 const ui=setup();ui.click('hostBtn');ui.instances[0].fire('open');
 const peer=ui.instances[0],owner=peer.connect();peer.fire('connection',owner);
 owner.fire('data',{t:'join',name:'Real board player',clientToken:'ready-camera-test'});
 const api=ui.scope.window.__ghostTest,P=ui.scope.window.BoardParty;
 ui.sessionButtons[2].fire('click');ui.click('startBtn');
 const s=api.getBoard(),p=s.players[0];
 s.order=[p.id];s.turnIndex=0;P.startTurn(s);
 p.bag=['potion'];p.item='potion';p.actionIndex=1;p.hp=45;
 api.updateBoard(.05);
 assert.equal(s.phase,'ready');
 assert.equal(owner.sent.filter(x=>x.t==='board-state').at(-1).canZoom,true,
  'the currently playing human may inspect the map before the first dice roll');
 const token={turnId:s.turnId,mapVersion:s.map.version};
 owner.fire('data',{t:'board-camera-mode',enabled:true,...token});
 assert.equal(owner.boardCameraGestureToken,s.turnId);
 assert.equal(s.camera.bagMapInspect,true,'host renderer hides item selection panel');
 const z=s.camera.zoom;
 owner.fire('data',{t:'board-camera-gesture',kind:'pinch',scale:1.2,...token});
 assert.ok(s.camera.zoom>z,'map can be zoomed during pre-roll selection');
 owner.fire('data',{t:'input',...token,actionId:1,keys:{action:true,alt:true,axisX:1,axisY:1}});
 assert.equal(s.phase,'ready','pressing A while exploring may not roll dice');
 assert.equal(p.actionIndex,1,'pressing B while exploring may not switch items');
 assert.deepEqual(p.bag,['potion']);
 assert.equal(p.hp,45,'no item was consumed during inspection');
 owner.fire('data',{t:'board-camera-mode',enabled:false,...token});
 assert.equal(s.camera.bagMapInspect,false,'double-tap back restores original selector');
 assert.equal(s.camera.panned,false);
}
// BOARD PARTY camera changes must be authorized by the current player on the
// host. Even a valid spectator data packet cannot steal the shared map zoom.
{
 const ui=setup();ui.click('hostBtn');ui.instances[0].fire('open');
 const peer=ui.instances[0],connect=name=>{
  const c=peer.connect();peer.fire('connection',c);
  c.fire('data',{t:'join',name,clientToken:'zoom-'+name});return c;
 };
 const owner=connect('Zoom owner'),spectator=connect('Zoom spectator');
 const api=ui.scope.window.__ghostTest,P=ui.scope.window.BoardParty;
 ui.sessionButtons[2].fire('click');ui.click('startBtn');
 const s=api.getBoard();assert.equal(s.players.length,2);
 const [first,second]=s.players;
 s.order=[first.id,second.id];s.turnIndex=0;P.startTurn(s);P.beginMove(s,first,3);
 api.updateBoard(.05);
 let one=owner.sent.filter(m=>m.t==='board-state').at(-1),
   two=spectator.sent.filter(m=>m.t==='board-state').at(-1);
 assert.equal(one.canZoom,true,'current player receives zoom permission');
 assert.equal(two.canZoom,false,'spectator receives no zoom permission');
 // Remote-only camera mode: owner may inspect; spectators never can.
 const cameraPacket={turnId:s.turnId,mapVersion:s.map.version};
 spectator.fire('data',{t:'board-camera-mode',enabled:true,...cameraPacket});
 spectator.fire('data',{t:'board-camera-gesture',kind:'pinch',scale:1.2,...cameraPacket});
 assert.equal(spectator.boardCameraGestureToken,null,'spectator camera activation rejected');
 const preModeZoom=s.camera.zoom;
 owner.fire('data',{t:'board-camera-gesture',kind:'pinch',scale:1.2,...cameraPacket});
 assert.equal(s.camera.zoom,preModeZoom,'gesture before double-tap mode rejected');
 owner.fire('data',{t:'board-camera-mode',enabled:true,...cameraPacket});
 assert.equal(owner.boardCameraGestureToken,s.turnId);
 assert.equal(s.camera.panned,true,'inspection mode suspends follow');
 const gestureInitial=s.camera.zoom;
 owner.fire('data',{t:'board-camera-gesture',kind:'pinch',scale:1.2,...cameraPacket});
 assert.ok(s.camera.zoom>gestureInitial,'pinch zooms host map');
 const gestureZoom=s.camera.zoom;
 const positionBefore=JSON.stringify(ui.scope.window.BoardItems.position(s,first));
 owner.fire('data',{t:'input',turnId:s.turnId,actionId:1,keys:{axisX:1,axisY:1}});
 api.updateBoard(.05);
 assert.equal(JSON.stringify(ui.scope.window.BoardItems.position(s,first)),positionBefore,
   'host rejects movement axes while controller is in map mode');
 owner.fire('data',{t:'board-camera-mode',enabled:false,...cameraPacket});
 assert.equal(s.camera.panned,false,'double-tap back resumes follow');
 assert.equal(s.camera.manualZoom,gestureZoom,'zoom remains unchanged when returning to walk');
 const afterExit=s.camera.zoom;
 owner.fire('data',{t:'board-camera-gesture',kind:'pinch',scale:1.2,...cameraPacket});
 assert.equal(s.camera.zoom,afterExit,'gestures rejected after switching back');
 const initial=s.camera.zoom;
 spectator.fire('data',{t:'board-camera-zoom',direction:1});
 assert.equal(s.camera.zoom,initial,'spectator zoom rejected by host');
 ui.click('boardZoomInBtn');
 assert.equal(s.camera.zoom,initial,'host screen cannot bypass a REMOTE current turn');
 owner.fire('data',{t:'board-camera-zoom',direction:1});
 assert.ok(s.camera.zoom>initial,'authorized current player can zoom');
 s.turnIndex=1;P.startTurn(s);P.beginMove(s,second,3);api.updateBoard(.05);
 one=owner.sent.filter(m=>m.t==='board-state').at(-1);
 two=spectator.sent.filter(m=>m.t==='board-state').at(-1);
 assert.equal(one.canZoom,false);assert.equal(two.canZoom,true,'permission follows turn rotation');
 const now=s.camera.zoom;
 owner.fire('data',{t:'board-camera-zoom',direction:-1});
 assert.equal(s.camera.zoom,now,'former owner loses zoom rights immediately');
 spectator.fire('data',{t:'board-camera-zoom',direction:-1});
 assert.ok(s.camera.zoom<now,'new owner may now zoom');
}
{
 const phone=setup('https://game.example/?join=CAMERA');
 phone.elements.get('nick').value='Phone owner';phone.click('joinBtn');phone.instances[0].fire('open');
 const conn=phone.instances[0].conn;conn.fire('open');
 conn.fire('data',{t:'welcome',id:'z',name:'Phone owner',color:'#66aacc',mode:'board',phase:'playing'});
 const frame={t:'board-state',phase:'playing',boardPhase:'move_ready',
  round:1,turnId:'z-1',hp:100,stepsRemaining:3,bag:[],canZoom:false,a:'',b:'',help:''};
 conn.fire('data',frame);
 assert.equal(phone.elements.get('controllerBoardZoomInBtn').classList.contains('hidden'),true);
 assert.equal(phone.elements.get('controllerBoardZoomInBtn').disabled,true);
 const before=conn.sent.filter(m=>m.t==='board-camera-zoom').length;
 phone.click('controllerBoardZoomInBtn');
 assert.equal(conn.sent.filter(m=>m.t==='board-camera-zoom').length,before,
  'spectator phone does not send camera commands');
 conn.fire('data',{...frame,turnId:'z-2',canZoom:true});
 assert.equal(phone.elements.get('controllerBoardZoomInBtn').classList.contains('hidden'),false);
 assert.equal(phone.elements.get('controllerBoardZoomInBtn').disabled,false);
 phone.click('controllerBoardZoomInBtn');
 assert.equal(conn.sent.filter(m=>m.t==='board-camera-zoom').length,before+1,
  'turn-owner phone can send the host zoom command');
 conn.fire('data',{...frame,turnId:'z-3',canZoom:false});
 assert.equal(phone.elements.get('controllerBoardZoomInBtn').disabled,true,'zoom permission is revoked');
}
// No timer ticks between taps: a new host token must immediately repair a
 // button release that was sent with the previous phase's token.
 const ui=setup('https://game.example/?join=ABCDE3');ui.elements.get('nick').value='Board phone';ui.click('joinBtn');ui.instances[0].fire('open');
 const conn=ui.instances[0].conn;conn.fire('open');conn.fire('data',{t:'welcome',id:'p1',name:'Board phone',color:'#66aacc',mode:'board',phase:'playing'});
 const P=ui.scope.window.BoardParty,s=P.create([{id:'p1',name:'Phone',color:'#66aacc'}],{seed:123});s.order=['p1'];P.startTurn(s);s.players[0].item='bomber';
 let sent=0;
 const forward=()=>{for(const msg of conn.sent.slice(sent))if(msg.t==='input')P.input(s,'p1',msg);sent=conn.sent.length;};
 const state=()=>conn.fire('data',{t:'board-state',phase:'playing',turnId:s.turnId,boardPhase:s.phase,round:1,hp:3,item:'Bomber Aircraft',stepsRemaining:0,shieldTurns:0,...P.controls(s,'p1')});
 state();forward();ui.padZones.alt.fire('pointerdown',{pointerId:1});forward();
 assert.equal(s.phase,'ready');assert.equal(s.players[0].actionIndex,4,'B chooses bomber in its fixed fourth item slot');
 ui.padZones.alt.fire('pointerup',{pointerId:1});forward();
 ui.padZones.action.fire('pointerdown',{pointerId:2});forward();assert.equal(s.phase,'aim','A uses selected bomber');
 ui.padZones.action.fire('pointerup',{pointerId:2});forward();assert.equal(s.inputs.p1.a,true,'old-token release is rejected');
 state();forward();assert.equal(s.inputs.p1.a,false,'fresh token immediately resends physical release');
 const count=conn.sent.length;state();assert.equal(conn.sent.length,count,'unchanged token does not echo inputs unnecessarily');
 ui.padZones.alt.fire('pointerdown',{pointerId:3});forward();assert.equal(s.skill.angle,Math.PI/4,'next B press rotates without waiting for a heartbeat');
}
console.log('BOARD INTEGRATION PASS: all ten actual engines at 1/12 players, return, finish/replay, normal regression, step/shield packets, remote tokens, immediate button releases and reconnect');

require('./ice-race.cjs');
