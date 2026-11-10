/* UFO ARENA — art layer. Static arena = one detailed SVG rasterised once per round;
   spikes, UFOs, hearts and effects are drawn live on the host canvas. World units only. */
const TAU=Math.PI*2;
const f1=v=>(Math.round(v*10)/10).toString();
const pts=a=>a.map(p=>f1(p.x)+','+f1(p.y)).join(' ');
export const EDGE_COLORS={cyan:'#17b8ff',green:'#35d12b',red:'#ff2020',yellow:'#ffc400'};

/* convex polygon (clockwise, y-down) pushed outward by d */
export function offsetPoly(v,d){
 const n=v.length,L=[];
 for(let i=0;i<n;i++){
  const a=v[i],b=v[(i+1)%n],dx=b.x-a.x,dy=b.y-a.y,m=Math.hypot(dx,dy)||1;
  L.push({px:a.x+dy/m*d,py:a.y-dx/m*d,dx:dx/m,dy:dy/m});
 }
 return v.map((_,i)=>{
  const A=L[(i+n-1)%n],B=L[i],den=A.dx*B.dy-A.dy*B.dx;
  if(Math.abs(den)<1e-9)return{x:B.px,y:B.py};
  const t=((B.px-A.px)*B.dy-(B.py-A.py)*B.dx)/den;
  return{x:A.px+A.dx*t,y:A.py+A.dy*t};
 });
}
function lcg(seed){let s=seed>>>0||1;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}

export function backdropSVG(geo){
 const {w,h,u,cx,cy,W,H,T,verts,edges,zones,bumper}=geo;
 const out=offsetPoly(verts,T),rim=offsetPoly(verts,T+9*u);
 const r=lcg(0x5eed1234),P=[];
 P.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w*1.5}" height="${h*1.5}" viewBox="0 0 ${w} ${h}">`);
 P.push(`<defs>
<linearGradient id="sp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1a74"/><stop offset=".55" stop-color="#150f52"/><stop offset="1" stop-color="#0a0a33"/></linearGradient>
<radialGradient id="fl" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${W*1.08}"><stop offset="0" stop-color="#2f7bff"/><stop offset=".4" stop-color="#1237c9"/><stop offset=".8" stop-color="#0a1a86"/><stop offset="1" stop-color="#050d48"/></radialGradient>
<radialGradient id="gl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9fe0ff" stop-opacity=".55"/><stop offset="1" stop-color="#9fe0ff" stop-opacity="0"/></radialGradient>
<linearGradient id="gy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9a7cc"/><stop offset="1" stop-color="#5b5887"/></linearGradient>
<radialGradient id="pd" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#9aa3d6"/><stop offset="1" stop-color="#3a3f73"/></radialGradient>
<filter id="b3" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${3*u}"/></filter>
<filter id="b8" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${8*u}"/></filter>
<clipPath id="fc"><polygon points="${pts(verts)}"/></clipPath>
</defs>`);
 // deep space with stars
 P.push(`<rect width="${w}" height="${h}" fill="url(#sp)"/>`);
 for(let i=0;i<170;i++){
  const x=r()*w,y=r()*h,s=(.5+r()*1.5)*u,c=r()<.2?'#9fd8ff':r()<.15?'#ffb8f0':'#fff';
  P.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s)}" fill="${c}" opacity="${f1(.25+r()*.65)}"/>`);
 }
 for(let i=0;i<14;i++){
  const x=r()*w,y=r()*h,s=(4+r()*5)*u;
  P.push(`<path d="M${f1(x)} ${f1(y-s)}L${f1(x+s*.22)} ${f1(y-s*.22)}L${f1(x+s)} ${f1(y)}L${f1(x+s*.22)} ${f1(y+s*.22)}L${f1(x)} ${f1(y+s)}L${f1(x-s*.22)} ${f1(y+s*.22)}L${f1(x-s)} ${f1(y)}L${f1(x-s*.22)} ${f1(y-s*.22)}Z" fill="#b8e8ff" opacity=".7"/>`);
 }
 // rim shadow + wall body
 P.push(`<polygon points="${pts(rim)}" fill="#000" opacity=".45" filter="url(#b8)"/>`);
 P.push(`<polygon points="${pts(out)}" fill="#3b3866" stroke="#1d1a40" stroke-width="${2*u}"/>`);
 // floor
 P.push(`<polygon points="${pts(verts)}" fill="url(#fl)"/>`);
 P.push(`<g clip-path="url(#fc)">`);
 for(let arm=0;arm<4;arm++){
  const d=[];
  for(let i=0;i<64;i++){const th=arm*Math.PI/2+i*.17,rr=(5+i*5.4)*u;d.push((i?'L':'M')+f1(cx+Math.cos(th)*rr*1.3)+' '+f1(cy+Math.sin(th)*rr*.95));}
  P.push(`<path d="${d.join('')}" fill="none" stroke="#8fd0ff" stroke-opacity=".17" stroke-width="${9*u}" stroke-linecap="round" filter="url(#b3)"/>`);
  P.push(`<path d="${d.join('')}" fill="none" stroke="#bfe8ff" stroke-opacity=".12" stroke-width="${2*u}" stroke-linecap="round"/>`);
 }
 for(let i=1;i<=6;i++)P.push(`<ellipse cx="${cx}" cy="${cy}" rx="${f1(i*W*.17)}" ry="${f1(i*H*.17)}" fill="none" stroke="#7ec4ff" stroke-opacity=".07" stroke-width="${2*u}"/>`);
 P.push(`<ellipse cx="${cx}" cy="${cy}" rx="${W*.45}" ry="${H*.45}" fill="url(#gl)"/>`);
 for(let i=0;i<46;i++)P.push(`<circle cx="${f1(cx-W+r()*W*2)}" cy="${f1(cy-H+r()*H*2)}" r="${f1((.6+r()*1.2)*u)}" fill="#cfeaff" opacity="${f1(.15+r()*.4)}"/>`);
 P.push(`<polygon points="${pts(verts)}" fill="none" stroke="#00041f" stroke-opacity=".55" stroke-width="${34*u}" filter="url(#b8)"/>`);
 P.push(`</g>`);
 // wall bands
 edges.forEach((e,i)=>{
  const a=verts[i],b=verts[(i+1)%verts.length],oa=out[i],ob=out[(i+1)%verts.length];
  const col=EDGE_COLORS[e.kind];
  if(col){
   P.push(`<polygon points="${pts([a,b,ob,oa])}" fill="${col}" stroke="#12122e" stroke-opacity=".6" stroke-width="${1.5*u}"/>`);
   const ia={x:a.x+(oa.x-a.x)*.22,y:a.y+(oa.y-a.y)*.22},ib={x:b.x+(ob.x-b.x)*.22,y:b.y+(ob.y-b.y)*.22};
   P.push(`<line x1="${f1(ia.x)}" y1="${f1(ia.y)}" x2="${f1(ib.x)}" y2="${f1(ib.y)}" stroke="#fff" stroke-opacity=".38" stroke-width="${3*u}"/>`);
   P.push(`<polygon points="${pts([{x:oa.x+(a.x-oa.x)*.2,y:oa.y+(a.y-oa.y)*.2},{x:ob.x+(b.x-ob.x)*.2,y:ob.y+(b.y-ob.y)*.2},ob,oa])}" fill="#000" opacity=".25"/>`);
   const cnt=Math.max(3,Math.round(e.len/(30*u)));
   for(let k=0;k<cnt;k++){
    const s=(k+.5)/cnt,mx=a.x+(b.x-a.x)*s,my=a.y+(b.y-a.y)*s,ox=oa.x+(ob.x-oa.x)*s,oy=oa.y+(ob.y-oa.y)*s;
    const px=mx+(ox-mx)*.62,py=my+(oy-my)*.62,ang=Math.atan2(e.d.y,e.d.x)*180/Math.PI;
    P.push(`<ellipse cx="${f1(px)}" cy="${f1(py)}" rx="${f1(7*u)}" ry="${f1(3.4*u)}" transform="rotate(${f1(ang)} ${f1(px)} ${f1(py)})" fill="#000" opacity=".38"/>`);
   }
  }else{
   P.push(`<polygon points="${pts([a,b,ob,oa])}" fill="url(#gy)" stroke="#12122e" stroke-opacity=".6" stroke-width="${1.5*u}"/>`);
   P.push(`<line x1="${f1(a.x+(oa.x-a.x)*.08)}" y1="${f1(a.y+(oa.y-a.y)*.08)}" x2="${f1(b.x+(ob.x-b.x)*.08)}" y2="${f1(b.y+(ob.y-b.y)*.08)}" stroke="#fff" stroke-opacity=".4" stroke-width="${2*u}"/>`);
   const cnt=Math.max(2,Math.round(e.len/(46*u)));
   for(let k=0;k<cnt;k++){
    const s=(k+.5)/cnt,px=a.x+(b.x-a.x)*s+(oa.x-a.x)*.82,py=a.y+(b.y-a.y)*s+(oa.y-a.y)*.82;
    P.push(`<circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(1.7*u)}" fill="#2d2a55"/><circle cx="${f1(px-.5*u)}" cy="${f1(py-.5*u)}" r="${f1(.7*u)}" fill="#c9c7ee"/>`);
   }
   if(e.kind==='gray'&&(i===2||i===6)){
    const p0={x:a.x+(oa.x-a.x)*.5+e.d.x*14*u,y:a.y+(oa.y-a.y)*.5+e.d.y*14*u},p1={x:b.x+(ob.x-b.x)*.5-e.d.x*14*u,y:b.y+(ob.y-b.y)*.5-e.d.y*14*u};
    P.push(`<line x1="${f1(p0.x)}" y1="${f1(p0.y)}" x2="${f1(p1.x)}" y2="${f1(p1.y)}" stroke="#ff2a55" stroke-width="${9*u}" stroke-linecap="round" opacity=".75" filter="url(#b3)"/>`);
    P.push(`<line x1="${f1(p0.x)}" y1="${f1(p0.y)}" x2="${f1(p1.x)}" y2="${f1(p1.y)}" stroke="#ffd23a" stroke-width="${4*u}" stroke-linecap="round"/>`);
   }
  }
 });
 // spike housings (always visible so players learn where spikes can appear)
 for(const z of zones){
  const e=edges[z.edge],a=e.a,t0=z.s0,t1=z.s1,o0=T*.04,o1=T*.40;
  const q=(s,o)=>({x:a.x+e.d.x*s-e.n.x*o,y:a.y+e.d.y*s-e.n.y*o});
  P.push(`<polygon points="${pts([q(t0,o0),q(t1,o0),q(t1,o1),q(t0,o1)])}" fill="#0b0a24" opacity=".72"/>`);
 }
 // inner lip
 P.push(`<polygon points="${pts(verts)}" fill="none" stroke="#e8f0ff" stroke-opacity=".5" stroke-width="${1.6*u}"/>`);
 // corner turbines
 for(const sx of[-1,1])for(const sy of[-1,1]){
  const px=cx+sx*(W+T*.12),py=cy+sy*(H+T*.12),R=32*u;
  P.push(`<g transform="translate(${f1(px)} ${f1(py)})"><circle r="${f1(R+3*u)}" fill="#000" opacity=".35" cx="${f1(3*u)}" cy="${f1(4*u)}"/>`);
  P.push(`<circle r="${f1(R)}" fill="url(#pd)" stroke="#23265a" stroke-width="${2.2*u}"/><circle r="${f1(R*.8)}" fill="#1c2257" stroke="#6f7bd0" stroke-width="${1.4*u}"/>`);
  for(let k=0;k<8;k++)P.push(`<ellipse rx="${f1(4.6*u)}" ry="${f1(10.5*u)}" cy="${f1(-13*u)}" transform="rotate(${k*45})" fill="#33b0ff" stroke="#c8f0ff" stroke-width="${.9*u}"/>`);
  P.push(`<circle r="${f1(7*u)}" fill="#d8f6ff" stroke="#4aa8e8" stroke-width="${1.4*u}"/>`);
  for(let k=0;k<6;k++){const an=k*Math.PI/3+.3;P.push(`<circle cx="${f1(Math.cos(an)*R*.9)}" cy="${f1(Math.sin(an)*R*.9)}" r="${f1(1.6*u)}" fill="#c8cdf5"/>`);}
  P.push(`</g>`);
 }
 // centre bumper
 const rb=bumper.r,bx=bumper.x,by=bumper.y;
 P.push(`<ellipse cx="${f1(bx+4*u)}" cy="${f1(by+7*u)}" rx="${f1(rb*1.12)}" ry="${f1(rb*.98)}" fill="#000" opacity=".4" filter="url(#b3)"/>`);
 P.push(`<circle cx="${bx}" cy="${by}" r="${f1(rb+7*u)}" fill="#8f98c6" stroke="#2a2f66" stroke-width="${2.2*u}"/>`);
 const W4=[['#ffc400',`M${bx} ${by}L${bx-rb} ${by}A${rb} ${rb} 0 0 1 ${bx} ${by-rb}Z`],['#17b8ff',`M${bx} ${by}L${bx} ${by-rb}A${rb} ${rb} 0 0 1 ${bx+rb} ${by}Z`],['#ff2020',`M${bx} ${by}L${bx} ${by+rb}A${rb} ${rb} 0 0 1 ${bx-rb} ${by}Z`],['#35d12b',`M${bx} ${by}L${bx+rb} ${by}A${rb} ${rb} 0 0 1 ${bx} ${by+rb}Z`]];
 for(const[c,d]of W4)P.push(`<path d="${d}" fill="${c}" stroke="#1a1a3c" stroke-width="${1.6*u}"/>`);
 P.push(`<circle cx="${bx}" cy="${by}" r="${f1(rb*.55)}" fill="#10279c" stroke="#7fc0ff" stroke-width="${2*u}"/>`);
 const k=rb*.34;
 P.push(`<path d="M${f1(bx-k)} ${f1(by+k*.6)}L${f1(bx-k*.9)} ${f1(by-k*.5)}L${f1(bx-k*.45)} ${f1(by)}L${bx} ${f1(by-k*.8)}L${f1(bx+k*.45)} ${f1(by)}L${f1(bx+k*.9)} ${f1(by-k*.5)}L${f1(bx+k)} ${f1(by+k*.6)}Z" fill="#3f8dff" stroke="#bfe0ff" stroke-width="${1.2*u}"/>`);
 P.push(`<ellipse cx="${f1(bx-rb*.28)}" cy="${f1(by-rb*.55)}" rx="${f1(rb*.38)}" ry="${f1(rb*.14)}" fill="#fff" opacity=".35" transform="rotate(-20 ${bx} ${by})"/>`);
 P.push('</svg>');
 return P.join('');
}

/* ------------------------------ runtime art handle ------------------------------ */
export function makeArt(geo){
 const art={img:null,ready:false,geo};
 if(typeof Image==='undefined')return art;
 try{
  const img=new Image();img.decoding='async';
  img.onload=()=>{art.ready=true;};
  img.onerror=()=>{art.ready=false;};
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(backdropSVG(geo));
  art.img=img;
 }catch(e){art.img=null;}
 return art;
}
export function releaseArt(art){
 if(!art)return;
 if(art.img){art.img.onload=null;art.img.onerror=null;try{art.img.removeAttribute('src');}catch(e){}art.img=null;}
 art.ready=false;
}
function polyPath(g,p){g.beginPath();p.forEach((q,i)=>i?g.lineTo(q.x,q.y):g.moveTo(q.x,q.y));g.closePath();}
export function drawBackdrop(g,art,geo){
 if(art&&art.ready&&art.img){g.drawImage(art.img,0,0,geo.w,geo.h);return;}
 // lightweight fallback while the SVG decodes (or after release)
 g.fillStyle='#0d0a3a';g.fillRect(0,0,geo.w,geo.h);
 polyPath(g,offsetPoly(geo.verts,geo.T));g.fillStyle='#4a4778';g.fill();
 polyPath(g,geo.verts);g.fillStyle='#10309e';g.fill();
 geo.edges.forEach((e,i)=>{
  const c=EDGE_COLORS[e.kind];if(!c)return;
  g.strokeStyle=c;g.lineWidth=geo.T*.8;g.beginPath();g.moveTo(e.a.x,e.a.y);g.lineTo(e.b.x,e.b.y);g.stroke();
 });
 g.beginPath();g.arc(geo.bumper.x,geo.bumper.y,geo.bumper.r,0,TAU);g.fillStyle='#2a63ff';g.fill();
}

/* ------------------------------ spikes ------------------------------ */
export function drawZoneWarning(g,geo,z,clock,spikeLen){
 const e=geo.edges[z.edge],u=geo.u,pulse=.5+.5*Math.sin(clock*26);
 const q=(s,o)=>({x:e.a.x+e.d.x*s+e.n.x*o,y:e.a.y+e.d.y*s+e.n.y*o});
 const D=spikeLen*1.15;
 g.save();
 const g0=q((z.s0+z.s1)/2,0),g1=q((z.s0+z.s1)/2,D);
 const gr=g.createLinearGradient(g0.x,g0.y,g1.x,g1.y);
 gr.addColorStop(0,'rgba(255,60,40,'+(.55+.25*pulse)+')');gr.addColorStop(1,'rgba(255,60,40,0)');
 g.fillStyle=gr;polyPath(g,[q(z.s0,0),q(z.s1,0),q(z.s1,D),q(z.s0,D)]);g.fill();
 g.strokeStyle='rgba(255,230,120,'+(.5+.5*pulse)+')';g.lineWidth=2.2*u;
 g.beginPath();g.moveTo(q(z.s0,1.2*u).x,q(z.s0,1.2*u).y);g.lineTo(q(z.s1,1.2*u).x,q(z.s1,1.2*u).y);g.stroke();
 // warning sign
 const m=q((z.s0+z.s1)/2,D+10*u);
 g.translate(m.x,m.y);g.globalAlpha=.6+.4*pulse;
 g.fillStyle='#ffd23a';g.strokeStyle='#5a1208';g.lineWidth=2*u;
 g.beginPath();g.moveTo(0,-9*u);g.lineTo(9*u,7*u);g.lineTo(-9*u,7*u);g.closePath();g.fill();g.stroke();
 g.fillStyle='#5a1208';g.font='900 '+f1(10*u)+'px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('!',0,2.5*u);
 g.restore();
}
export function drawZoneSpikes(g,geo,z,clock,spikeLen){
 const e=geo.edges[z.edge],u=geo.u,ext=z.ext;
 if(ext<=.01)return;
 const len=z.s1-z.s0,cnt=Math.max(2,Math.floor(len/(21*u))),sp=len/cnt,bw=Math.min(sp*.86,17*u),hh=spikeLen*ext;
 const ang=Math.atan2(e.n.y,e.n.x);
 g.save();
 const hot=z.state==='active';
 if(hot){
  const m={x:e.a.x+e.d.x*(z.s0+z.s1)/2+e.n.x*hh*.5,y:e.a.y+e.d.y*(z.s0+z.s1)/2+e.n.y*hh*.5};
  const gl=g.createRadialGradient(m.x,m.y,0,m.x,m.y,len*.6);
  gl.addColorStop(0,'rgba(255,70,50,.28)');gl.addColorStop(1,'rgba(255,70,50,0)');
  g.fillStyle=gl;g.beginPath();g.arc(m.x,m.y,len*.6,0,TAU);g.fill();
 }
 for(let k=0;k<cnt;k++){
  const s=z.s0+sp*(k+.5),bx=e.a.x+e.d.x*s,by=e.a.y+e.d.y*s;
  g.save();g.translate(bx,by);g.rotate(ang);
  g.fillStyle='rgba(0,0,30,.35)';g.beginPath();g.moveTo(0,-bw/2+2*u);g.lineTo(hh,2*u);g.lineTo(0,bw/2+2*u);g.closePath();g.fill();
  const gr=g.createLinearGradient(0,-bw/2,0,bw/2);
  gr.addColorStop(0,'#fafcff');gr.addColorStop(.5,'#c4cde0');gr.addColorStop(1,'#7f89a6');
  g.fillStyle=gr;g.strokeStyle='#2b2f55';g.lineWidth=1.1*u;
  g.beginPath();g.moveTo(0,-bw/2);g.lineTo(hh,0);g.lineTo(0,bw/2);g.closePath();g.fill();g.stroke();
  g.fillStyle='rgba(255,255,255,.7)';g.beginPath();g.moveTo(1*u,-bw*.28);g.lineTo(hh*.7,-bw*.03);g.lineTo(1*u,-bw*.05);g.closePath();g.fill();
  if(hot){g.fillStyle='rgba(255,60,40,.55)';g.beginPath();g.arc(hh,0,2.3*u,0,TAU);g.fill();}
  g.restore();
 }
 g.restore();
}

/* ------------------------------ UFO ------------------------------ */
export function drawUFO(g,x,y,o){
 const u=o.u,t=o.time,bob=Math.sin(t*3.2+o.phase)*1.5*u;
 g.save();
 g.globalAlpha=o.alpha??1;
 // ground shadow (shrinks while the craft rises)
 g.fillStyle='rgba(0,0,40,.38)';g.beginPath();g.ellipse(x+3*u,y+10*u-bob*.4,17*u-bob*.5,11*u,0,0,TAU);g.fill();
 g.translate(x,y-5*u+bob);
 // thruster plume opposite to acceleration
 if(o.thrust>.08){
  const a=Math.atan2(-o.ty,-o.tx),L=(10+16*o.thrust)*u*(.85+.15*Math.sin(t*50+o.phase));
  g.save();g.rotate(a);
  const gr=g.createLinearGradient(12*u,0,12*u+L,0);
  gr.addColorStop(0,'rgba(255,255,230,.95)');gr.addColorStop(.35,'rgba(255,190,60,.85)');gr.addColorStop(1,'rgba(255,90,30,0)');
  g.fillStyle=gr;g.beginPath();g.moveTo(10*u,-6*u);g.quadraticCurveTo(12*u+L,0,10*u,6*u);g.closePath();g.fill();
  g.restore();
 }
 // bumper balls
 for(let k=0;k<6;k++){
  const an=k*TAU/6+t*.9,bx=Math.cos(an)*15*u,by=Math.sin(an)*15*u;
  g.fillStyle=o.color;g.beginPath();g.arc(bx,by,4.3*u,0,TAU);g.fill();
  g.fillStyle='rgba(0,0,0,.28)';g.beginPath();g.arc(bx+.8*u,by+.9*u,3.4*u,0,TAU);g.fill();
  g.fillStyle='rgba(255,255,255,.65)';g.beginPath();g.arc(bx-1.3*u,by-1.4*u,1.4*u,0,TAU);g.fill();
 }
 // saucer
 g.fillStyle='#262a52';g.beginPath();g.arc(0,0,14.2*u,0,TAU);g.fill();
 g.fillStyle=o.color;g.beginPath();g.arc(0,0,12.6*u,0,TAU);g.fill();
 const sh=g.createRadialGradient(-4*u,-5*u,1*u,0,0,14*u);
 sh.addColorStop(0,'rgba(255,255,255,.55)');sh.addColorStop(.55,'rgba(255,255,255,0)');sh.addColorStop(1,'rgba(0,0,0,.35)');
 g.fillStyle=sh;g.beginPath();g.arc(0,0,12.6*u,0,TAU);g.fill();
 for(let k=0;k<8;k++){
  const an=k*TAU/8-t*1.6,on=((k+Math.floor(t*4))%2)===0;
  g.fillStyle=on?'#fff6a8':'rgba(255,255,255,.35)';g.beginPath();g.arc(Math.cos(an)*10.6*u,Math.sin(an)*10.6*u,1.15*u,0,TAU);g.fill();
 }
 // dome + face
 g.fillStyle='rgba(210,245,255,.92)';g.strokeStyle='rgba(20,30,70,.75)';g.lineWidth=1.2*u;
 g.beginPath();g.arc(0,0,7.2*u,0,TAU);g.fill();g.stroke();
 const fx=o.dx,fy=o.dy,px=-fy,py=fx;
 g.fillStyle='#16204a';
 for(const sd of[-1,1]){g.beginPath();g.ellipse(fx*2.2*u+px*sd*2.7*u,fy*2.2*u+py*sd*2.7*u,1.35*u,1.9*u,Math.atan2(fy,fx),0,TAU);g.fill();}
 g.strokeStyle='#16204a';g.lineWidth=1.1*u;
 g.beginPath();g.moveTo(fx*3.6*u-px*4.6*u,fy*3.6*u-py*4.6*u);g.lineTo(fx*1.6*u-px*1.4*u,fy*1.6*u-py*1.4*u);
 g.moveTo(fx*3.6*u+px*4.6*u,fy*3.6*u+py*4.6*u);g.lineTo(fx*1.6*u+px*1.4*u,fy*1.6*u+py*1.4*u);g.stroke();
 g.fillStyle='rgba(255,255,255,.7)';g.beginPath();g.ellipse(-2.6*u,-3.4*u,2.6*u,1.3*u,-.5,0,TAU);g.fill();
 if(o.flash>0){
  g.fillStyle=(Math.floor(t*30)%2)?'rgba(255,40,40,'+Math.min(.7,o.flash*1.6)+')':'rgba(255,255,255,'+Math.min(.7,o.flash*1.6)+')';
  g.beginPath();g.arc(0,0,17*u,0,TAU);g.fill();
 }
 g.restore();
}
export function drawHeart(g,x,y,s,fill,stroke){
 g.beginPath();
 g.moveTo(x,y+s*.9);
 g.bezierCurveTo(x-s*1.5,y-s*.1,x-s*.8,y-s*1.1,x,y-s*.35);
 g.bezierCurveTo(x+s*.8,y-s*1.1,x+s*1.5,y-s*.1,x,y+s*.9);
 g.closePath();
 if(fill){g.fillStyle=fill;g.fill();}
 if(stroke){g.strokeStyle=stroke;g.lineWidth=Math.max(1,s*.2);g.stroke();}
}
export function drawHearts(g,cx,cy,hp,max,s,color){
 const gap=s*2.45,x0=cx-gap*(max-1)/2;
 g.save();
 for(let i=0;i<max;i++){
  const x=x0+i*gap;
  if(i<hp){drawHeart(g,x,cy,s,color,'rgba(255,255,255,.9)');g.fillStyle='rgba(255,255,255,.55)';g.beginPath();g.ellipse(x-s*.45,cy-s*.35,s*.28,s*.16,-.6,0,TAU);g.fill();}
  else drawHeart(g,x,cy,s,'rgba(8,10,40,.55)','rgba(255,255,255,.28)');
 }
 g.restore();
}
