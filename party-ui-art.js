/* Original vector interface symbols shared across GAME-FRIENDS mini-games.
   Pictograms are hand-drawn SVG; never rely on emoji/system glyph fonts. */
(() => {
'use strict';
const SHAPES=Object.freeze({
 potion:'<rect x="18" y="3" width="12" height="8" rx="2" fill="#caac85"/><path d="M17 11h14v8c7 7 11 15 5 22H12c-6-7-2-15 5-22Z" fill="#79d5a9" stroke="#3a846d" stroke-width="2.4"/><path d="M13 30h23" stroke="#e7ffea" stroke-width="3"/><path d="M24 24v14m-7-7h14" stroke="#fff" stroke-width="3"/>',
 ufo:'<ellipse cx="24" cy="28" rx="21" ry="10" fill="#8593b4" stroke="#455c7e" stroke-width="2"/><path d="M13 25c0-16 5-20 11-20s12 5 12 20Z" fill="#a5e9ff" stroke="#4d8cab" stroke-width="2"/><ellipse cx="24" cy="27" rx="16" ry="5" fill="#b9c2de"/><circle cx="12" cy="30" r="2" fill="#ffe698"/><circle cx="24" cy="32" r="2" fill="#ffe698"/><circle cx="36" cy="30" r="2" fill="#ffe698"/>',
 coin:'<circle cx="24" cy="24" r="20" fill="#ffd36c" stroke="#9d6927" stroke-width="3"/><circle cx="24" cy="24" r="14.5" fill="none" stroke="#fff1b6" stroke-width="2.5"/><path d="M24 12v24m7-19c-9-6-17-2-17 3 0 8 20 2 20 11 0 6-10 9-20 3" fill="none" stroke="#b47429" stroke-width="3" stroke-linecap="round"/>',
 rocket:'<path d="M24 4C13 14 14 28 19 34h10C34 28 35 14 24 4Z" fill="#e7f7ff" stroke="#6889a9" stroke-width="2"/><circle cx="24" cy="21" r="5.5" fill="#59c2e5" stroke="#5b82a2" stroke-width="2"/><path d="M18 28 9 34l-1 10 12-7m10-9 9 6 1 10-12-7" fill="#ee708a" stroke="#ae445e" stroke-width="2"/><path d="M21 35 24 47l4-12Z" fill="#ffc05b"/>',
 bomber:'<path d="M24 3 29 19 45 29l-1 6-15-4-1 9 7 5H13l7-5-1-9-15 4-1-6 16-10Z" fill="#ebcf91" stroke="#94754e" stroke-width="2" stroke-linejoin="round"/><path d="M24 8v25" stroke="#fff2c8" stroke-width="3"/>',
 car:'<rect x="6" y="11" width="9" height="10" rx="3" fill="#35465d"/><rect x="33" y="11" width="9" height="10" rx="3" fill="#35465d"/><rect x="6" y="30" width="9" height="10" rx="3" fill="#35465d"/><rect x="33" y="30" width="9" height="10" rx="3" fill="#35465d"/><rect x="12" y="7" width="24" height="34" rx="7" fill="#e9899a" stroke="#a14469" stroke-width="2"/><rect x="17" y="13" width="14" height="11" rx="3" fill="#b8ecfa"/><circle cx="24" cy="32" r="5" fill="#334d62"/>',
 shield:'<path d="M24 3 42 10v15c0 9-8 17-18 21C14 42 6 34 6 25V10Z" fill="#7bd1ef" stroke="#2e80ab" stroke-width="2.5"/><path d="M24 9 36 14v12c0 6-5 11-12 14Z" fill="#4c9dc9"/><path d="m14 25 8 7 13-17" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
 close:'<circle cx="24" cy="24" r="19" fill="#ba5365" stroke="#ffcbd6" stroke-width="2.5"/><path d="M16 16 32 32M32 16 16 32" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>',
 bag:'<path d="M11 16h26l4 26H7l4-26Z" fill="#c18a5b" stroke="#6d453c" stroke-width="2.6" stroke-linejoin="round"/><path d="M17 16V13C17 3 31 3 31 13v3" fill="none" stroke="#ffe2aa" stroke-width="4" stroke-linecap="round"/><path d="M10 25h28M11 35h26" stroke="#f5c990" stroke-width="2" opacity=".85"/><path d="M24 24v12" stroke="#ffe1a1" stroke-width="3" stroke-linecap="round"/>',
 star:'<path d="m24 4 6.1 12.7 14 2-10.2 9.8 2.5 14-12.4-6.6-12.5 6.6 2.5-14L3.8 18.7l14-2Z" fill="#fbe178" stroke="#c89032" stroke-width="2.1" stroke-linejoin="round"/><path d="m24 10 4.4 9" stroke="#fff9d1" stroke-width="2.5" stroke-linecap="round"/>',
 sparkle:'<path d="M24 2 29 18 46 24 29 29 24 46 19 29 2 24 19 18Z" fill="#fff2ad" stroke="#d39b45" stroke-width="2" stroke-linejoin="round"/><circle cx="39" cy="8" r="3" fill="#fffae0"/><circle cx="9" cy="39" r="2.5" fill="#fff3bf"/>',
 check:'<circle cx="24" cy="24" r="20" fill="#299b67" stroke="#e7ffee" stroke-width="2"/><path d="m12 24 8.5 8L37 15" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'
});

/* High-detail Christmas / alpine winter SVG item artwork. The 3D facets,
   ice highlights, evergreen/red enamel and muted brass gradients are drawn
   as real SVG paths so the SAME assets work on the main stage and on phones. */
const HOLIDAY_DEFS=`<defs>
 <linearGradient id="gf-ice" x1="0" x2=".95" y1="0" y2="1"><stop stop-color="#ffffff"/><stop offset=".42" stop-color="#dff6fc"/><stop offset="1" stop-color="#79b3c8"/></linearGradient>
 <linearGradient id="gf-glass" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#ffffff" stop-opacity=".98"/><stop offset=".35" stop-color="#b3faff" stop-opacity=".95"/><stop offset="1" stop-color="#357c9c" stop-opacity=".96"/></linearGradient>
 <linearGradient id="gf-evergreen" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#72bd9b"/><stop offset=".42" stop-color="#18785c"/><stop offset="1" stop-color="#10443e"/></linearGradient>
 <linearGradient id="gf-crimson" x1="0" x2=".9" y1="0" y2="1"><stop stop-color="#ffb4a6"/><stop offset=".35" stop-color="#d64a5b"/><stop offset="1" stop-color="#742d4d"/></linearGradient>
 <linearGradient id="gf-brass" x1="0" x2=".9" y1="0" y2="1"><stop stop-color="#fff6d7"/><stop offset=".32" stop-color="#f2d88e"/><stop offset=".72" stop-color="#b48a47"/><stop offset="1" stop-color="#80613d"/></linearGradient>
 <linearGradient id="gf-shadow" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#466a83"/><stop offset="1" stop-color="#1f314b"/></linearGradient>
</defs>`;
const FESTIVE=Object.freeze({
 potion:`<ellipse cx="24" cy="44.5" rx="13" ry="2" fill="#173e4b" opacity=".24"/>
 <path d="M18 9h12v7l5 7 4 15c.8 4-3 6-7 6H15c-4 0-7-3-6-6l4-15 5-7Z" fill="url(#gf-shadow)" opacity=".55"/>
 <path d="M19 8h10v8l5 7 4 14c1 3-1 5-5 5H15c-4 0-6-2-5-5l4-14 5-7Z" fill="url(#gf-glass)" stroke="#37657b" stroke-width="1.4"/>
 <path d="M13 28c5-2 13-2 23 0l1.8 9c.5 2.8-2 4-5 4H15c-3.5 0-5-1.5-4-4Z" fill="url(#gf-evergreen)"/>
 <path d="M17 27c3-1 11-1 16 0" stroke="#e9ffff" stroke-width="1.7" opacity=".9"/>
 <rect x="18.5" y="6.4" width="11" height="6.5" rx="1.7" fill="url(#gf-brass)" stroke="#87673b" stroke-width="1"/>
 <path d="M17 6l1-3h12l1 3Z" fill="#fffafa" stroke="#e2f3ff" stroke-width=".8"/>
 <path d="M20 30h8v3h-8zm2.5-2.5h3v8h-3Z" fill="#fef3d4"/>
 <path d="M16 16c-3 8-4 14-3 21" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".78"/>
 <path d="M34 29l1 7" stroke="#98ebdb" stroke-width="1.5"/>
 <circle cx="32" cy="16" r="2.1" fill="#d75261" stroke="#fff0cb" stroke-width=".8"/>
 <path d="m33 12 3-2m-4 3-2-3" stroke="#38765c" stroke-width="1.4"/>`,
 ufo:`<ellipse cx="24" cy="43" rx="19" ry="2.1" fill="#0d3a53" opacity=".20"/>
 <path d="M14 25C14 12 18 5 24 5s10 8 10 20Z" fill="url(#gf-glass)" stroke="#4e849b" stroke-width="1.5"/>
 <path d="M17 23c0-9 3-15 7-16" stroke="#ffffff" stroke-width="2.5" fill="none" opacity=".78"/>
 <ellipse cx="24" cy="28" rx="22" ry="10.5" fill="url(#gf-shadow)" stroke="#d4f1f5" stroke-width="1.8"/>
 <path d="M2 27c6-5 16-7 22-7s17 2 22 7c-4 4-14 6-22 6s-17-2-22-6Z" fill="url(#gf-ice)" stroke="#517c91" stroke-width="1.2"/>
 <ellipse cx="24" cy="25.5" rx="13" ry="4" fill="url(#gf-glass)" stroke="#fff" stroke-width=".9"/>
 <path d="M6 31c11 8 25 8 36 0" fill="none" stroke="url(#gf-brass)" stroke-width="2.2"/>
 <circle cx="10" cy="32" r="2.25" fill="#dd5b66" stroke="#ffe9d0" stroke-width=".7"/>
 <circle cx="19" cy="35.6" r="2.25" fill="#f1d47f" stroke="#fff" stroke-width=".7"/>
 <circle cx="29" cy="35.6" r="2.25" fill="#4dc69d" stroke="#fff" stroke-width=".7"/>
 <circle cx="38" cy="32" r="2.25" fill="#dd5b66" stroke="#fff" stroke-width=".7"/>
 <path d="M19 5q5-4 10 0" stroke="#fff" stroke-width="2" fill="none"/>
 <path d="m22 12 2 3 2-3-2-3z" fill="#fff8de" opacity=".84"/>`,
 rocket:`<ellipse cx="24" cy="44" rx="12" ry="2" fill="#20465a" opacity=".2"/>
 <path d="m19 32-3 7 8 8 8-8-3-7" fill="url(#gf-brass)"/>
 <path d="m21 34-3 10 6-4 6 4-3-10" fill="#e9b870"/>
 <path d="M20 31 8 38 8 26 16 23ZM28 31l12 7V26l-8-3Z" fill="url(#gf-crimson)" stroke="#7b354f" stroke-width="1.2"/>
 <path d="M15 26c0-10 3-18 9-23 6 5 9 13 9 23v10H15Z" fill="url(#gf-ice)" stroke="#6388a0" stroke-width="1.5"/>
 <path d="M17 26c1-11 4-17 7-21" stroke="#fff" stroke-width="2.2" opacity=".86" fill="none"/>
 <path d="M16 31h16v4H16Z" fill="url(#gf-brass)"/>
 <path d="M18 27h12v3H18Z" fill="url(#gf-evergreen)"/>
 <circle cx="24" cy="21" r="5.5" fill="url(#gf-glass)" stroke="url(#gf-brass)" stroke-width="2"/>
 <circle cx="22.6" cy="19.8" r="1.8" fill="#ffffff" opacity=".86"/>
 <path d="M18 11q6-6 12 0" stroke="#ffffff" stroke-width="2.5" opacity=".88" fill="none"/>
 <path d="m19 38 5 9 5-9" fill="#ffc76f" opacity=".88"/>`,
 bomber:`<path d="M24 2 30 17 46 27 45 35 31 31 30 40 37 44 37 47H11v-3l7-4-1-9-14 4-1-8 16-10Z" fill="#122c3e" opacity=".36" transform="translate(0 .8)"/>
 <path d="M24 2 29 17 45 27 44 33 29 29 28 39 36 44H12l8-5-1-10-15 4-1-6 16-10Z" fill="url(#gf-evergreen)" stroke="#d5e5cf" stroke-width="1.25" stroke-linejoin="round"/>
 <path d="M24 3 28 16l1 24-5 4-5-4 1-24Z" fill="url(#gf-ice)" stroke="#45798c" stroke-width="1"/>
 <path d="M24 4 25 18l-1 19-2-18Z" fill="#fff" opacity=".8"/>
 <path d="m5 27 15-8 2 8-17 5zm38 0-15-8-2 8 17 5z" fill="url(#gf-crimson)" stroke="#873c51" stroke-width=".85"/>
 <path d="M7 29h12m10 0h12" stroke="url(#gf-brass)" stroke-width="2.5"/>
 <path d="M21 12c0-5 6-5 6 0v7h-6Z" fill="url(#gf-glass)" stroke="#507489" stroke-width="1"/>
 <path d="M22 13v4" stroke="#f9ffff" stroke-width="1.4"/>
 <rect x="10" y="23.5" width="5" height="7" rx="2" fill="url(#gf-shadow)" stroke="#fff3d1" stroke-width=".9"/>
 <rect x="33" y="23.5" width="5" height="7" rx="2" fill="url(#gf-shadow)" stroke="#fff3d1" stroke-width=".9"/>
 <circle cx="12.5" cy="27" r="1.7" fill="#f3d188"/><circle cx="35.5" cy="27" r="1.7" fill="#f3d188"/>
 <path d="M19 40h10l7 4H12Z" fill="url(#gf-crimson)" stroke="#f7e6c4" stroke-width="1.3"/>
 <path d="M23 30h2v9h-2Z" fill="url(#gf-brass)"/>
 <path d="m21 44 3-2 3 2-3 2Z" fill="#fff9dd"/>`,
 car:`<ellipse cx="24" cy="44" rx="18" ry="2.2" fill="#153448" opacity=".22"/>
 <path d="M7 13h8v10H7Zm26 0h8v10h-8ZM7 30h8v10H7Zm26 0h8v10h-8Z" fill="url(#gf-shadow)" stroke="#0b2839" stroke-width="1.8"/>
 <path d="M12 11 32 8 40 15l-1 26-23 3-8-9 1-18Z" fill="url(#gf-shadow)" stroke="#587a8d" stroke-width="1.3"/>
 <path d="M12 10 32 8 39 15 37 36l-22 5-7-9 1-16Z" fill="url(#gf-crimson)" stroke="#7e3a4a" stroke-width="1.4"/>
 <path d="M12 10 32 8 39 15 17 17 9 16Z" fill="#ffedf0" opacity=".63"/>
 <path d="m15 17 20-2-1 13-17 2Z" fill="url(#gf-glass)" stroke="#ffffff" stroke-width="1.2"/>
 <path d="M12 21 16 30l-1 10-6-8Z" fill="#9c394a" opacity=".6"/>
 <path d="M18 36 36 32" stroke="url(#gf-brass)" stroke-width="3"/>
 <circle cx="25" cy="34" r="4.5" fill="url(#gf-evergreen)" stroke="#f4deaa" stroke-width="1.2"/>
 <path d="m25 31 1 2 2.5.4-1.8 1.5.6 2.3-2.3-1.2-2.1 1.2.4-2.3-1.8-1.5 2.5-.4Z" fill="#ffefbd"/>
 <path d="M32 8 39 15" stroke="#fff" stroke-width="2" opacity=".85"/>
 <path d="m35 9 5-5" stroke="#334f66" stroke-width="1.4"/>
 <circle cx="41" cy="4" r="2.5" fill="#e85362" stroke="#fff3d3" stroke-width=".8"/>`,
 shield:`<path d="M24 3 42 10 40 27c-1 10-8 15-16 19C16 42 9 36 8 27L6 10Z" fill="url(#gf-shadow)" stroke="#7a693e" stroke-width="1.3"/>
 <path d="M24 3 41 10 39 27c-2 8-7 14-15 18C16 41 11 35 9 27L7 10Z" fill="url(#gf-brass)" stroke="#fff3c7" stroke-width="1.6"/>
 <path d="M24 7 37 13 35 27c-1 6-5 11-11 14-7-4-10-8-11-14l-2-14Z" fill="url(#gf-ice)" stroke="#43788e" stroke-width="1"/>
 <path d="M24 7 36 13l-1 14c-2 6-5 10-11 14V7Z" fill="#7fc2d5" opacity=".34"/>
 <path d="M14 12c4-2 8-3 11-5" stroke="#fff" stroke-width="2" opacity=".72"/>
 <path d="M24 17v18m-9-13 18 9m0-9-18 9" stroke="#f9ffff" stroke-width="2" stroke-linecap="round"/>
 <path d="M24 19 27 24l6 1-4.3 4.4L30 35l-6-3-6 3 1-5.6L15 25l6-1Z" fill="url(#gf-evergreen)" stroke="#fff2d6" stroke-width="1"/>
 <circle cx="24" cy="27" r="2.8" fill="#d74858" stroke="#fffbdd" stroke-width=".8"/>
 <circle cx="19" cy="14" r="1.5" fill="#d94b58"/><circle cx="29" cy="14" r="1.5" fill="#d94b58"/>`
});
const cache=new Map();
function svg(id){
 if(!Object.prototype.hasOwnProperty.call(SHAPES,id))return '';
 const festive=Object.prototype.hasOwnProperty.call(FESTIVE,id);
 return '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">'+
   (festive?HOLIDAY_DEFS+FESTIVE[id]:SHAPES[id])+'</svg>';
}
function imageFor(id){
 if(!SHAPES[id]||typeof Image==='undefined')return null;
 if(cache.has(id))return cache.get(id);
 const pic=new Image();pic.decoding='async';
 pic.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(id));
 cache.set(id,pic);
 return pic;
}
function draw(ctx,id,x,y,size=18){
 const pic=imageFor(id);
 if(!pic?.complete||!pic.naturalWidth||!ctx?.drawImage)return false;
 ctx.drawImage(pic,x-size/2,y-size/2,size,size);return true;
}
for(const id of Object.keys(SHAPES))imageFor(id);
window.PartyUiArt=Object.freeze({svg,draw,ids:Object.freeze(Object.keys(SHAPES))});
})();