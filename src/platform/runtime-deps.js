/* On-demand online network stack. Offline bots, static lobby and controller
 * join form must work without downloading PeerJS/QRCode. */
(()=>{
'use strict';
const pending=new Map(),sources=Object.freeze({
 peer:{url:'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js',integrity:'sha512-XEKeWX+mI3Ov+tg2evDlVQFzVOIp4T8J3cNcCEPaEUGpxJV3eZaN8rHuvnFPvQpGJBHPmrozJDMpm2xcDvtmyQ==',ready:()=>typeof window.Peer==='function'},
 qr:{url:'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',integrity:'sha512-CNgIRecGo7nphbeZ04Sc13ka07paqdeTu0WR1IM4kNcpmBAUSHSQX0FslNhTDadL4O5SAGapGt4FodqL8My0mA==',ready:()=>typeof window.QRCode==='function'}
});
function load(kind){
 const asset=sources[kind];
 if(!asset)return Promise.reject(Error('Unsupported runtime dependency: '+kind));
 if(asset.ready())return Promise.resolve();
 if(pending.has(kind))return pending.get(kind);
 const job=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src=asset.url;script.async=true;script.integrity=asset.integrity;script.crossOrigin='anonymous';
  script.onload=()=>asset.ready()?resolve():reject(Error(kind+' library did not expose its API'));
  script.onerror=()=>reject(Error('Unable to download '+kind));
  document.head.append(script);
 }).catch(error=>{pending.delete(kind);throw error;});
 pending.set(kind,job);
 return job;
}
window.GameRuntimeDeps=Object.freeze({
 ensureController:()=>load('peer'),
 ensureHost:()=>load('peer'),
 ensureQr:()=>load('qr'),
 ready:kind=>Boolean(sources[kind]?.ready())
});
})();
