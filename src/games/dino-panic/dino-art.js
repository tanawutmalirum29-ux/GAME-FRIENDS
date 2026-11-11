/* DINO PANIC — SVG art (built from code, cached as Images). Local to this game folder. */
import {mkRng,TAU} from './config.js';
const cache=new Map();
const f1=n=>Math.round(n*10)/10;
const BAKE=2; // raster scale: each SVG is rasterised ONCE at 2x its native size, then drawn as a plain bitmap every frame
function bakeImage(img,k){
 try{
  const w=img.naturalWidth,h=img.naturalHeight,c=document.createElement('canvas');
  c.width=Math.round(w*k);c.height=Math.round(h*k);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  c.lw=w;c.lh=h;                              // logical (world) size: callers always draw with explicit sizes
  return c;
 }catch(err){return img;}
}
export function svgImage(key,build,bake=BAKE){
 if(typeof Image==='undefined')return null;
 let e=cache.get(key);
 if(!e){
  const img=new Image();img.decoding='async';
  e={img,out:null};cache.set(key,e);
  img.onload=()=>{if(!e.out&&img.naturalWidth)e.out=bakeImage(img,bake);};   // each bake runs in its own task → no single big hitch
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(build());
 }
 if(e.out)return e.out;
 if(e.img.complete&&e.img.naturalWidth){e.out=bakeImage(e.img,bake);return e.out;}
 return null;
}
export function clearArt(){cache.clear();}

/* ───────── dinosaur (head tip at the RIGHT edge of each image) ───────── */
export function bodySVG(){
 const r=mkRng(77),W=600,Hh=380;let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}"><defs>
<linearGradient id="sk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2c5f9c"/><stop offset=".55" stop-color="#3f86cc"/><stop offset="1" stop-color="#5aa6dc"/></linearGradient>
<radialGradient id="pl" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#fffaf0"/><stop offset=".6" stop-color="#e9d8bf"/><stop offset="1" stop-color="#b99f82"/></radialGradient>
<radialGradient id="sp" cx=".4" cy=".25" r=".9"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#cdb89c"/></radialGradient>
<linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b2a4d" stop-opacity=".55"/><stop offset=".25" stop-color="#0b2a4d" stop-opacity="0"/><stop offset=".75" stop-color="#0b2a4d" stop-opacity="0"/><stop offset="1" stop-color="#0b2a4d" stop-opacity=".55"/></linearGradient></defs>`;
 const edge=(x,top)=>{const u=(x-380)/230,y=26+48*u*u*(x<380?1.5:1);return top?y:Hh-y;};
 // tail club
 s+=`<path d="M0 168 Q-4 190 0 212 L58 222 L62 158 Z" fill="#244f86" stroke="#173a66" stroke-width="3"/>`;
 // spikes (behind the body rim)
 for(let x=150;x<=590;x+=44){for(const top of[true,false]){const y=edge(x,top),d=top?-1:1,h=34+r()*14,w=15+r()*5;
  s+=`<path d="M${f1(x-w)} ${f1(y)} L${f1(x+4)} ${f1(y+d*h)} L${f1(x+w)} ${f1(y)} Z" fill="url(#sp)" stroke="#8a7762" stroke-width="2.2" stroke-linejoin="round"/>`;}}
 // body
 s+=`<path d="M600 92 C560 40 470 20 380 24 C300 28 230 40 170 70 L44 148 Q8 170 8 190 Q8 210 44 232 L170 310 C230 340 300 352 380 356 C470 360 560 340 600 288 Z" fill="url(#sk)" stroke="#173a66" stroke-width="5" stroke-linejoin="round"/>`;
 // skin speckles & scale texture
 for(let i=0;i<150;i++){const x=40+r()*540,y=40+r()*300,rad=2+r()*4;s+=`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(rad)}" fill="${r()<.5?'#1e4d85':'#7bc0ee'}" opacity="${f1(.12+r()*.2)}"/>`;}
 // armour plates: symmetric rows along the spine
 const cols=[205,282,359,436,513],rows=[[0,50],[1,118],[2,172]];
 for(const[ci,x0]of cols.map((x,i)=>[i,x])){
  for(const[,off]of rows){for(const sg of[-1,1]){
   const w=(off>150?40:62)+r()*8,h=(off>150?30:50)+r()*8,cx=x0+(r()-.5)*8,cy=190+sg*off+(r()-.5)*6;
   s+=`<ellipse cx="${f1(cx+3)}" cy="${f1(cy+5)}" rx="${f1(w/2)}" ry="${f1(h/2)}" fill="#12305a" opacity=".35"/>`;
   s+=`<rect x="${f1(cx-w/2)}" y="${f1(cy-h/2)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(Math.min(w,h)*.42)}" fill="url(#pl)" stroke="#7d6a56" stroke-width="2.6"/>`;
   s+=`<path d="M${f1(cx-w*.28)} ${f1(cy-h*.12)} Q${f1(cx)} ${f1(cy-h*.3)} ${f1(cx+w*.28)} ${f1(cy-h*.12)}" fill="none" stroke="#fff" stroke-width="2.4" opacity=".7" stroke-linecap="round"/>`;
   if(r()<.5)s+=`<path d="M${f1(cx-w*.2)} ${f1(cy+h*.1)} l${f1(w*.18)} ${f1(h*.15)} l${f1(w*.2)} ${f1(-h*.1)}" fill="none" stroke="#9b8670" stroke-width="1.6"/>`;
  }}
 }
 // centre ridge of small plates
 for(let x=90;x<=560;x+=36)s+=`<ellipse cx="${x}" cy="190" rx="${f1(10+r()*3)}" ry="${f1(9+r()*3)}" fill="url(#pl)" stroke="#7d6a56" stroke-width="2"/>`;
 s+=`<path d="M600 92 C560 40 470 20 380 24 C300 28 230 40 170 70 L44 148 Q8 170 8 190 Q8 210 44 232 L170 310 C230 340 300 352 380 356 C470 360 560 340 600 288 Z" fill="url(#sh)"/>`;
 return s+`</svg>`;
}
export function headSVG(){
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 230 210" width="230" height="210"><defs>
<linearGradient id="hd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3f7fc4"/><stop offset=".38" stop-color="#6d6fc0"/><stop offset=".75" stop-color="#b863b9"/><stop offset="1" stop-color="#e58fb0"/></linearGradient>
<radialGradient id="hb" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#c4ae93"/></radialGradient>
<radialGradient id="ey" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff59a"/><stop offset="1" stop-color="#e8a317"/></radialGradient></defs>
<g fill="url(#hb)" stroke="#7d6a56" stroke-width="2.4" stroke-linejoin="round">
<path d="M60 18 L84 -4 L100 20 Z M112 20 L138 0 L150 24 Z M60 192 L84 214 L100 190 Z M112 190 L138 210 L150 186 Z"/></g>
<path d="M0 36 C12 14 62 8 112 12 C172 16 218 48 230 105 C218 162 172 194 112 198 C62 202 12 196 0 174 Z" fill="url(#hd)" stroke="#432a6b" stroke-width="5" stroke-linejoin="round"/>
<g fill="url(#hb)" stroke="#7d6a56" stroke-width="2.2">
<rect x="22" y="70" width="46" height="70" rx="20"/><rect x="76" y="78" width="40" height="54" rx="18"/><rect x="124" y="86" width="32" height="38" rx="14"/></g>
<g fill="#5b2a6e" opacity=".55"><circle cx="170" cy="70" r="5"/><circle cx="184" cy="94" r="4"/><circle cx="182" cy="118" r="4"/><circle cx="170" cy="142" r="5"/><circle cx="150" cy="105" r="3.5"/></g>
<path d="M196 105 Q214 105 228 105" stroke="#4a1f5e" stroke-width="3" fill="none" stroke-linecap="round"/>
<ellipse cx="208" cy="88" rx="6" ry="9" fill="#2a1038"/><ellipse cx="208" cy="122" rx="6" ry="9" fill="#2a1038"/>
<g><circle cx="146" cy="44" r="17" fill="#432a6b"/><circle cx="146" cy="44" r="13" fill="url(#ey)"/><ellipse cx="149" cy="44" rx="3.2" ry="10" fill="#111"/><circle cx="141" cy="39" r="3" fill="#fff" opacity=".9"/>
<circle cx="146" cy="166" r="17" fill="#432a6b"/><circle cx="146" cy="166" r="13" fill="url(#ey)"/><ellipse cx="149" cy="166" rx="3.2" ry="10" fill="#111"/><circle cx="141" cy="161" r="3" fill="#fff" opacity=".9"/></g>
<path d="M0 36 C12 14 62 8 112 12 C172 16 218 48 230 105 C218 162 172 194 112 198 C62 202 12 196 0 174 Z" fill="none" stroke="#fff" stroke-width="2" opacity=".25" transform="translate(0 2)"/></svg>`;
}
export function footSVG(){
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 100" width="90" height="100"><defs>
<radialGradient id="ft" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#6f8f9a"/><stop offset="1" stop-color="#2f4a55"/></radialGradient></defs>
<g stroke="#1c2e36" stroke-width="3" stroke-linejoin="round">
<ellipse cx="38" cy="50" rx="30" ry="34" fill="url(#ft)"/>
<ellipse cx="72" cy="22" rx="13" ry="10" fill="url(#ft)"/><ellipse cx="78" cy="50" rx="13" ry="11" fill="url(#ft)"/><ellipse cx="72" cy="78" rx="13" ry="10" fill="url(#ft)"/></g>
<g fill="#f2e6d0" stroke="#8a7762" stroke-width="2"><path d="M82 14 L96 22 L82 29 Z"/><path d="M88 41 L102 50 L88 59 Z"/><path d="M82 71 L96 78 L82 86 Z"/></g>
<g fill="#fff" opacity=".18"><ellipse cx="28" cy="36" rx="14" ry="10"/></g></svg>`;
}

/* ───────── arena ───────── */
export function dirtSVG(h){
 const r=mkRng(31+h),W=512;let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}"><defs>
<linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a86d3e"/><stop offset=".12" stop-color="#cf9760"/><stop offset=".5" stop-color="#dba76f"/><stop offset=".88" stop-color="#cf9760"/><stop offset="1" stop-color="#a86d3e"/></linearGradient></defs><rect width="${W}" height="${h}" fill="url(#d)"/>`;
 const wrap=(fn,x=0,rad=1e9)=>{for(const o of[-W,0,W])if(x+o+rad>0&&x+o-rad<W)fn(o);};
 for(let i=0;i<26;i++){const y=14+r()*(h-28),x=r()*W,len=70+r()*170,a=.05+r()*.09,col=r()<.5?'#8d5a2f':'#f1c78f';
  wrap(o=>{s+=`<path d="M${f1(x+o)} ${f1(y)} q${f1(len/2)} ${f1((r()-.5)*8)} ${f1(len)} ${f1((r()-.5)*5)}" stroke="${col}" stroke-width="${f1(2+r()*4)}" opacity="${f1(a)}" fill="none" stroke-linecap="round"/>`;});}
 for(let i=0;i<70;i++){const x=r()*W,y=10+r()*(h-20),rad=1.4+r()*3.4,c=r()<.5?'#8d5a2f':'#f4d7a8';
  wrap(o=>{s+=`<ellipse cx="${f1(x+o)}" cy="${f1(y)}" rx="${f1(rad)}" ry="${f1(rad*.75)}" fill="${c}" opacity="${f1(.25+r()*.3)}"/>`;});}
 for(let i=0;i<9;i++){const x=r()*W,y=20+r()*(h-40),rad=4+r()*5;
  wrap(o=>{s+=`<ellipse cx="${f1(x+o)}" cy="${f1(y+1.5)}" rx="${f1(rad)}" ry="${f1(rad*.7)}" fill="#6f4222" opacity=".28"/><ellipse cx="${f1(x+o)}" cy="${f1(y)}" rx="${f1(rad)}" ry="${f1(rad*.7)}" fill="#9a9086" stroke="#6b625a" stroke-width="1.2"/>`;});}
 for(let i=0;i<5;i++){const x=r()*W,y=20+r()*(h-40);wrap(o=>{s+=`<path d="M${f1(x+o)} ${f1(y)} l12 5 l9 -3 l11 7" stroke="#7b4b26" stroke-width="1.6" fill="none" opacity=".35"/>`;});}
 return s+`</svg>`;
}
export function forestSVG(h,seed){
 const r=mkRng(seed),W=512;let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}"><defs>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f6a24"/><stop offset="1" stop-color="#5f9a32"/></linearGradient>
<radialGradient id="c" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#7cc03e"/><stop offset=".6" stop-color="#4d9a2a"/><stop offset="1" stop-color="#2b6a1f"/></radialGradient>
<radialGradient id="rk" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#d8bf9a"/><stop offset=".6" stop-color="#a98a66"/><stop offset="1" stop-color="#6b5640"/></radialGradient>
<linearGradient id="sd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a1a0c" stop-opacity=".45"/></linearGradient></defs>
<rect width="${W}" height="${h}" fill="url(#g)"/>`;
 const wrap=(fn,x=0,rad=1e9)=>{for(const o of[-W,0,W])if(x+o+rad>0&&x+o-rad<W)fn(o);};
 for(let i=0;i<130;i++){const x=r()*W,y=r()*h,l=8+r()*10,a=-1.2+r()*.5;
  wrap(o=>{s+=`<path d="M${f1(x+o)} ${f1(y)} l${f1(Math.cos(a)*l)} ${f1(Math.sin(a)*l)}" stroke="${r()<.5?'#a6d85a':'#2a6020'}" stroke-width="2.2" opacity=".5" stroke-linecap="round"/>`;},x,20);}
 // broad leafy canopies
 const trees=Math.max(5,Math.round(h/12));
 for(let i=0;i<trees;i++){const x=(i+.5)*W/trees+(r()-.5)*40,y=r()*(h-30),R=30+r()*34;
  wrap(o=>{s+=`<ellipse cx="${f1(x+o+6)}" cy="${f1(y+9)}" rx="${f1(R)}" ry="${f1(R*.9)}" fill="#142e0e" opacity=".35"/>`;
   for(let k=0;k<8;k++){const a=k*TAU/8+r()*.4;s+=`<ellipse cx="${f1(x+o+Math.cos(a)*R*.55)}" cy="${f1(y+Math.sin(a)*R*.55)}" rx="${f1(R*.55)}" ry="${f1(R*.28)}" transform="rotate(${f1(a*57.3)} ${f1(x+o+Math.cos(a)*R*.55)} ${f1(y+Math.sin(a)*R*.55)})" fill="url(#c)" stroke="#1f4f17" stroke-width="1.6"/>`;}
   s+=`<circle cx="${f1(x+o)}" cy="${f1(y)}" r="${f1(R*.32)}" fill="#8fd04a" opacity=".85"/>`;},x,R*1.3);}
 // ferns and flowers
 for(let i=0;i<22;i++){const x=r()*W,y=r()*h,L=14+r()*14;
  wrap(o=>{for(let k=0;k<6;k++){const a=-2.4+k*.55;s+=`<path d="M${f1(x+o)} ${f1(y)} q${f1(Math.cos(a)*L*.6)} ${f1(Math.sin(a)*L*.6-4)} ${f1(Math.cos(a)*L)} ${f1(Math.sin(a)*L)}" stroke="#9bd45a" stroke-width="3" fill="none" stroke-linecap="round"/>`;}},x,L+4);}
 for(let i=0;i<16;i++){const x=r()*W,y=r()*h;wrap(o=>{s+=`<g transform="translate(${f1(x+o)} ${f1(y)})">${[0,1,2,3,4].map(k=>`<ellipse cx="${f1(Math.cos(k*1.256)*4)}" cy="${f1(Math.sin(k*1.256)*4)}" rx="3.2" ry="2" transform="rotate(${k*72})" fill="${r()<.5?'#ff9a2a':'#ffd23a'}"/>`).join('')}<circle r="2" fill="#8a3d10"/></g>`;},x,8);}
 // vines
 for(let i=0;i<4;i++){const x=r()*W,y=r()*h*.6;wrap(o=>{s+=`<path d="M${f1(x+o)} ${f1(y)} c${f1(20+r()*30)} ${f1(10+r()*30)} ${f1(-10+r()*40)} ${f1(30+r()*40)} ${f1(30+r()*50)} ${f1(40+r()*30)}" stroke="#244d19" stroke-width="3.5" fill="none" opacity=".55" stroke-linecap="round"/>`;},x,100);}
 // boulders hugging the corridor edge (bottom of the strip)
 for(let x=10;x<W;x+=34+r()*40){const w=30+r()*30,y=h-4-r()*8,hh=w*.55;
  wrap(o=>{s+=`<ellipse cx="${f1(x+o+4)}" cy="${f1(y+4)}" rx="${f1(w/2)}" ry="${f1(hh/2)}" fill="#2a1a0c" opacity=".35"/><path d="M${f1(x+o-w/2)} ${f1(y)} q${f1(w*.05)} ${f1(-hh)} ${f1(w*.35)} ${f1(-hh*.9)} q${f1(w*.4)} ${f1(-hh*.2)} ${f1(w*.65)} ${f1(hh*.9)} Z" fill="url(#rk)" stroke="#5a4733" stroke-width="2.4" stroke-linejoin="round"/><path d="M${f1(x+o-w*.2)} ${f1(y-hh*.55)} l${f1(w*.25)} ${f1(hh*.2)}" stroke="#fff" stroke-width="2" opacity=".35"/>`;},x,w);}
 s+=`<rect y="${h-18}" width="${W}" height="18" fill="url(#sd)"/>`;
 return s+`</svg>`;
}
export function crateSVG(v){
 const planks=[0,1,2,3].map(i=>`<rect x="${6+i*11}" y="6" width="11" height="44" fill="${i%2?'#c98a48':'#d89a58'}" stroke="#7a4a22" stroke-width="1.4"/>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect x="2" y="2" width="52" height="52" rx="3" fill="#8a5428" stroke="#4a2c12" stroke-width="2.5"/>${planks}
<path d="M8 8 L48 48 M48 8 L8 48" stroke="#a9702f" stroke-width="5" opacity=".55"/>
<rect x="3" y="3" width="50" height="50" rx="2" fill="none" stroke="#3d6bb0" stroke-width="5"/>
${[[6,6],[50,6],[6,50],[50,50]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3" fill="#9fc0ee" stroke="#233f6e" stroke-width="1.2"/>`).join('')}
<path d="M4 4 H52" stroke="#fff" stroke-width="1.5" opacity=".25"/></svg>`;
}
export function rockSVG(v){
 const r=mkRng(500+v);let pts=[];const n=9;
 for(let i=0;i<n;i++){const a=i*TAU/n,rad=26+r()*5;pts.push([32+Math.cos(a)*rad,32+Math.sin(a)*rad*.92]);}
 const d=pts.map((p,i)=>(i?'L':'M')+f1(p[0])+' '+f1(p[1])).join(' ')+'Z';
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><defs><radialGradient id="r" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#cbb9a3"/><stop offset=".55" stop-color="#8f8070"/><stop offset="1" stop-color="#524739"/></radialGradient></defs>
<path d="${d}" fill="url(#r)" stroke="#3c3329" stroke-width="3" stroke-linejoin="round"/>
<path d="M18 26 L30 22 L40 28 M26 44 L34 36 L46 40" stroke="#4b4034" stroke-width="2" fill="none" opacity=".6"/>
<path d="M20 20 Q30 12 42 18" stroke="#fff" stroke-width="3" fill="none" opacity=".3" stroke-linecap="round"/>
<path d="M36 46 q4 -6 8 -2 q-3 5 -8 2Z" fill="#7fb04a" opacity=".85"/></svg>`;
}
