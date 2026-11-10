/* The original authored 960x540 Neon Club SVG, losslessly gzip-compressed.
 * Load once per room; no raster downscaling or replacement art. */
(() => {
'use strict';
let url=null,pending=null;
function sceneUrl(){
 if(url)return Promise.resolve(url);
 if(pending)return pending;
 pending=(async()=>{
  if(typeof DecompressionStream!=='function')throw Error('Browser gzip decompression unavailable');
  const chunks=await Promise.all(Array.from({length:5},(_,i)=>
   fetch('./src/lobby/art/scene-'+String(i+1).padStart(2,'0')+'.b64',{cache:'force-cache'}).then(r=>{
    if(!r.ok)throw Error('Missing Party Plaza art: '+r.status);
    return r.text();
   })
  ));
  const encoded=chunks.map(x=>x.trim()).join('');
  if(encoded.length!==18048)throw Error('Incomplete Party Plaza art');
  const compressed=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  const svg=await new Response(new Blob([compressed]).stream().pipeThrough(
   new DecompressionStream('gzip'))).text();
  if(!svg.includes('<svg')||!svg.includes('viewBox="0 0 960 540"'))
   throw Error('Party Plaza original SVG invalid');
  // A self-contained data URL survives WebKit's rapid room-to-game
  // transition without asynchronous blob access-control errors on reload.
  // The decoded SVG paths remain byte-for-byte unchanged (no rasterization).
  url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  return url;
 })().catch(e=>{pending=null;throw e;});
 return pending;
}
window.PartyPlazaArt=Object.freeze({sceneUrl});
})();