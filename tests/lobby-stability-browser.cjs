/* Party Plaza lobby regression: 0..12 bot slots and overlays never resize or
 * reposition the full-screen 960x540 world in Chromium or WebKit. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const { [process.env.BOARD_BROWSER||'chromium']: browserType }=require('playwright');
const engine=process.env.BOARD_BROWSER||'chromium';
const root=path.resolve(__dirname,'..');
const out='/tmp/game-friends-board/lobby-stability';
const server=http.createServer((req,res)=>{
 const target=path.resolve(root,'.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));
 if(!target.startsWith(root+path.sep)||!fs.existsSync(target)){res.writeHead(404).end();return;}
 const ext=path.extname(target),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.b64':'text/plain','.png':'image/png'};
 res.writeHead(200,{'content-type':types[ext]||'application/octet-stream'});res.end(fs.readFileSync(target));
});
function closeEnough(a,b,label){
 for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<=1,
  label+': geometry shifted at dimension '+i+' from '+a[i]+' to '+b[i]);
}
async function geometry(page){
 return page.evaluate(()=>{
  const rect=id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();
   return [r.left,r.top,r.width,r.height].map(n=>Math.round(n*4)/4);};
  return {
   host:rect('hostLobby'),canvas:rect('plazaCanvas'),bar:rect('plazaRoomToggle'),
   slots:document.querySelectorAll('#roster .roster-item').length,
   bots:document.querySelectorAll('#roster .roster-item:not(.roster-empty)').length,
   loaded:document.getElementById('hostLobby').classList.contains('plaza-loaded'),
   code:document.getElementById('roomCode').textContent,
   scroll:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1
  };
 });
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await browserType.launch({headless:true,
  executablePath:engine==='chromium'?(process.env.CHROME_PATH||'/usr/bin/chromium'):undefined,
  args:engine==='chromium'?['--no-sandbox']:[]});
 try{
  fs.mkdirSync(out,{recursive:true});
  for(const viewport of [{width:1473,height:1024},{width:844,height:390},{width:390,height:780}]){
   const context=await browser.newContext({viewport,deviceScaleFactor:2});
   await context.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
   // Freeze animation only after first rAF, to avoid touching the game clock.
   await context.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/?host=1');
   await page.locator('#offlineBtn').click();
   assert.equal(await page.locator('#plazaCanvas').isVisible(),true,'scene visible');
   await page.locator('#plazaRoomToggle').click();
   assert.equal(await page.locator('#plazaRoomToggle').getAttribute('aria-expanded'),'true');
   await page.locator('#plazaRosterToggle').click();
   assert.equal(await page.locator('#roster').isVisible(),true,
    JSON.stringify(await page.evaluate(()=>{
     const h=document.getElementById('hostLobby'),r=document.getElementById('plazaRosterPanel'),
      roster=document.getElementById('roster'),btn=document.getElementById('plazaRosterToggle');
     const dump=x=>({style:getComputedStyle(x).display,visibility:getComputedStyle(x).visibility,
      rect:[x.getBoundingClientRect().width,x.getBoundingClientRect().height],
      classes:x.className,inline:x.getAttribute('style')});
     return {hostClasses:h.className,button:btn.getAttribute('aria-expanded'),
      panel:dump(r),roster:dump(roster)};
    })));
   assert.equal(await page.locator('#plazaRoomPanel').isVisible(),false,
    'opening roster closes the QR popup instead of layering both');
   assert.equal(await page.locator('#plazaRoomToggle').getAttribute('aria-expanded'),'false');
   assert.equal(await page.locator('#plazaRosterToggle').getAttribute('aria-expanded'),'true');
   assert.equal(await page.locator('#plazaCanvas').evaluate(e=>[e.width,e.height].every(n=>n>=540)),true,'DPR-backed canvas');
   // Remove offline demo bots via their original, preserved DOM actions.
   while(await page.locator('#roster .roster-item:not(.roster-empty)').count())
    await page.locator('#roster .roster-item:not(.roster-empty) button[aria-label^="เอา"]').last().click();
   const baseline=await geometry(page);
   assert.equal(baseline.loaded,true);assert.equal(baseline.bots,0);assert.equal(baseline.slots,12);
   // Exercise real host-authoritative lobby walking, Arcade wall collision,
   // and zone targeting: the old static roster never covered these mechanics.
   const walking=await page.evaluate(()=>{
    const api=window.PartyPlaza;
    const player={id:'walk-qa',name:'Walk QA',color:'#ef507b',isBot:false,
     conn:{open:true},input:{axisX:1,axisY:0,action:false,alt:false}};
    api.sync([player]);
    const x0=player.plazaX;
    api.tick(.1,[player]);
    const x1=player.plazaX;
    player.plazaX=400;player.plazaY=154;
    player.input.axisX=0;player.input.axisY=-1;
    api.tick(.1,[player]);
    const yWall=player.plazaY;
    player.plazaX=480;player.plazaY=457;
    const zone=api.zoneAt(player)?.id;
    player.plazaX=144;player.plazaY=437;
    const colorZone=api.zoneAt(player)?.id;
    const shop=api.getLayout().obstacles.find(o=>o.id==='color-studio-shop');
    player.plazaX=144;player.plazaY=420;
    player.input.axisX=0;player.input.axisY=-1;
    api.tick(.35,[player]);
    const shopWallY=player.plazaY;
    player.plazaX=144;player.plazaY=437;
    const stillReachable=api.zoneAt(player)?.id==='color_studio';
    api.sync([]);
    return {x0,x1,yWall,zone,colorZone,hasShop:!!shop,shopWallY,stillReachable};
   });
   assert.ok(walking.x1>walking.x0+5,'connected phone joystick moves the lobby avatar');
   assert.ok(walking.yWall>=153,'avatar cannot walk through the real Arcade wall');
   assert.equal(walking.zone,'ready_area','READY area interaction comes from JSON zone geometry');
   assert.equal(walking.colorZone,'color_studio','unused left-bottom PLAY CORNER becomes B color zone');
   assert.ok(walking.hasShop,'Color Studio is now a physical building zone');
   assert.ok(walking.shopWallY>=410,'player cannot walk through the Color Studio storefront');
   assert.equal(walking.stillReachable,true,'the B-button color zone remains accessible in front of the shop');
   const stable=async label=>{
    const now=await geometry(page);
    assert.equal(now.slots,12,label+' 12 reserved slots');
    assert.equal(now.scroll,false,label+' document scrolling');
    closeEnough(baseline.host,now.host,label+' host');
    closeEnough(baseline.canvas,now.canvas,label+' scene');
    closeEnough(baseline.bar,now.bar,label+' header');
   };
   for(let i=1;i<=12;i++){
    // Open Settings, click the actual bot button, close Settings. Its overlay
    // does not relayout the map or move the visible player/QR panels.
    await page.locator('#plazaSettingsToggle').click();
    await page.locator('#addLocalBtn').click();
    await page.locator('#plazaSettingsToggle').click();
    assert.equal((await geometry(page)).bots,i);
    await stable(i+' bots');
   }
   await page.locator('#plazaRoomToggle').click();await stable('hide QR');
   await page.locator('#plazaRoomToggle').click();await stable('restore QR');
   await page.locator('#plazaRosterToggle').click();await stable('hide roster');
   await page.locator('#plazaRosterToggle').click();await stable('restore roster');
   for(const mode of ['endless','board','queue']){
    await page.locator('#plazaSettingsToggle').click();
    await page.locator('[data-session-mode="'+mode+'"]').click();
    await page.locator('#plazaSettingsToggle').click();
    await stable('mode '+mode);
   }
   // Only one Plaza popup stays open. Restore the roster after the mode
   // settings loop before clicking per-player remove buttons.
   await page.locator('#plazaRosterToggle').click();
   assert.equal(await page.locator('#roster').isVisible(),true,
    'bot removal actions must be visible inside the restored roster popup');
   while(await page.locator('#roster .roster-item:not(.roster-empty)').count()){
    await page.locator('#roster .roster-item:not(.roster-empty) button[aria-label^="เอา"]').last().click();
    await stable('remove bot');
   }
   // Post-UI host-authoritative B-zone probe. A disconnected or out-of-zone
   // controller never receives a stale action, and reconnect resends it.
   const bActions=await page.evaluate(()=>{
    const api=window.PartyPlaza,actions=[];
    api.configure({
      zoneBAction:(p,z)=>['wardrobe','color_studio'].includes(z?.id)?z.id:null,
      notifyZoneB:(p,action)=>actions.push(action)
    });
    const p={id:'b-zone-probe',name:'Probe',isBot:false,color:'#3cb44b',
      conn:{open:true},input:{axisX:0,axisY:0,action:false,alt:false},
      plazaX:480,plazaY:300};
    const visit=(x,y)=>{p.plazaX=x;p.plazaY=y;api.tick(.016,[p]);};
    visit(480,300);visit(151,190);visit(151,190);
    visit(144,437);visit(480,300);
    p.conn={open:true};visit(144,437);
    api.sync([]);
    return actions;
   });
   assert.deepEqual(bActions,[null,'wardrobe','color_studio',null,'color_studio'],
    'host sends B actions only on true zone transitions and reconnects');
   await page.screenshot({path:path.join(out,engine+'-'+viewport.width+'x'+viewport.height+'.png')});
   assert.deepEqual(errors,[],'zero JavaScript errors');
   await context.close();
  }
  console.log('PARTY PLAZA LOBBY '+engine+': world and overlays stable for 0–12 joins, mode changes and two panel states');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
