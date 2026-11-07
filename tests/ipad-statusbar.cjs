'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const index=fs.readFileSync('index.html','utf8');
const host=fs.readFileSync('host.html','utf8');
const style=fs.readFileSync('style.css','utf8');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
for(const [name,html] of [['index.html',index],['host.html',host]]){
 assert.match(html,/<meta name="apple-mobile-web-app-capable" content="yes">/,'PWA remains installable: '+name);
 assert.match(html,/<meta name="apple-mobile-web-app-status-bar-style" content="black">/,
  'iPadOS must reserve the status bar outside app content: '+name);
 assert.doesNotMatch(html,/apple-mobile-web-app-status-bar-style" content="black-translucent"/,
  'transparent OS overlay must not obscure host header: '+name);
 assert.match(html,/viewport-fit=cover/,'existing safe-area viewport remains configured: '+name);
}
assert.equal(manifest.display,'standalone',
 'Do not claim full OS bar hiding: WebKit cannot reliably honor fullscreen manifest on iPadOS 26');
for(const selector of [
 'html.ipad-native-fullscreen #hostLobby',
 'html.ipad-native-fullscreen #game .game-toolbar',
 'html.ipad-native-fullscreen #game .game-pause-btn',
 'html.ipad-native-fullscreen #game .game-name',
 'html.ipad-native-fullscreen body.controller-playing .gamepad-hud',
 'html.ipad-native-fullscreen body:not(.controller-playing) #controller.controller-page'
])assert.ok(style.includes(selector),'fullscreen status-bar clearance missing for '+selector);
assert.match(style,/padding-top:max\(28px,env\(safe-area-inset-top,0px\)\)/,
 'When iPadOS reports 0px safe inset, manually reserve top strip');
assert.match(style,/body:has\(#home:not\(\.hidden\)\) \.topbar/,
 'host entry must avoid overlap without adding a second scrollable viewport');
// Exercise the actual inline iPad fullscreen-detection script, including exit.
const script=index.match(/<script>\s*(\/\/ WebKit on iPadOS 26[\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'iPadOS fullscreen guard script must be present in HTML');
const events={},classes=new Set();
const ctx={
 navigator:{userAgent:'Mozilla/5.0 (iPad; CPU OS 26_6_1 like Mac OS X)',platform:'iPad',maxTouchPoints:5},
 document:{
  fullscreenElement:null,webkitFullscreenElement:null,
  documentElement:{classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);}}},
  addEventListener(type,fn){events[type]=fn;}
 }
};
vm.runInNewContext(script,ctx,{filename:'ipad-webapp-statusbar.inline.js'});
assert.ok(!classes.has('ipad-native-fullscreen'),'PWA standalone must not get duplicate top padding');
ctx.document.fullscreenElement={};
events.fullscreenchange();
assert.ok(classes.has('ipad-native-fullscreen'),'native fullscreen should gain OS bar clearance');
ctx.document.fullscreenElement=null;
events.fullscreenchange();
assert.ok(!classes.has('ipad-native-fullscreen'),'native fullscreen exit clears temporary padding');
ctx.document.webkitFullscreenElement={};
events.webkitfullscreenchange();
assert.ok(classes.has('ipad-native-fullscreen'),'webkit fullscreen event is supported');
console.log('iPadOS STATUS BAR PASS: opaque PWA status layout, fullscreen CSS clearance and lifecycle');
