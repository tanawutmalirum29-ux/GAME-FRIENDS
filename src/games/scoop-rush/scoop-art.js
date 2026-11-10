/* SCOOP RUSH — art helpers (native ES module).
   Backdrop is a detailed SVG rasterised once per world size; scoops, polar bears and
   effects are drawn procedurally on the Host canvas in WORLD units. */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// 12 clearly distinct flavours (one per player slot).
export const FLAVORS=Object.freeze([
 '#ff6f9f','#e5262f','#ff8a1a','#ffd21f','#8fd630','#17b868',
 '#18c8e6','#3b5bff','#8e44ff','#e23fd1','#7a4a2a','#f3e8cb'
]);

function rgb(c){const n=parseInt(c.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
export function mix(a,b,t){
 const A=rgb(a),B=rgb(b);
 return 'rgb('+A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(',')+')';
}
function rng32(seed){
 let a=seed>>>0;
 return()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
}

/* ------------------------------ geometry for the SVG ------------------------------ */
function perimeter(x,y,w,h,r,step){
 const L=[];
 const line=(x1,y1,x2,y2)=>{const n=Math.max(1,Math.round(Math.hypot(x2-x1,y2-y1)/step));for(let i=0;i<n;i++)L.push([x1+(x2-x1)*i/n,y1+(y2-y1)*i/n]);};
 const arc=(cx,cy,a0,a1)=>{const n=Math.max(2,Math.round(r*Math.abs(a1-a0)/step));for(let i=0;i<n;i++){const a=a0+(a1-a0)*i/n;L.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}};
 line(x+r,y,x+w-r,y);arc(x+w-r,y+r,-Math.PI/2,0);
 line(x+w,y+r,x+w,y+h-r);arc(x+w-r,y+h-r,0,Math.PI/2);
 line(x+w-r,y+h,x+r,y+h);arc(x+r,y+h-r,Math.PI/2,Math.PI);
 line(x,y+h-r,x,y+r);arc(x+r,y+r,Math.PI,Math.PI*1.5);
 return L;
}
function rrPath(x,y,w,h,r){
 return `M${x+r} ${y}H${x+w-r}A${r} ${r} 0 0 1 ${x+w} ${y+r}V${y+h-r}A${r} ${r} 0 0 1 ${x+w-r} ${y+h}H${x+r}A${r} ${r} 0 0 1 ${x} ${y+h-r}V${y+r}A${r} ${r} 0 0 1 ${x+r} ${y}Z`;
}
const f1=v=>v.toFixed(1);

function pine(x,y,s){
 const o=[`<g transform="translate(${f1(x)} ${f1(y)}) scale(${s.toFixed(2)})">`,
  '<ellipse cx="0" cy="3" rx="24" ry="5" fill="#7f9fc4" opacity=".35"/>',
  '<rect x="-4" y="-8" width="8" height="12" rx="1.5" fill="#6b4a32"/>'];
 [[-8,30,26],[-26,25,24],[-44,19,22]].forEach(([by,hw,ht],i)=>{
  o.push(`<path d="M${-hw} ${by}L0 ${by-ht}L${hw} ${by}Z" fill="${i%2?'#1f7a4d':'#176a42'}"/>`);
  o.push(`<path d="M${-hw} ${by}L0 ${by-ht}L${hw} ${by}Q0 ${by-6} ${-hw} ${by}Z" fill="#0f4f31" opacity=".35"/>`);
  o.push(`<path d="M0 ${by-ht}L${-hw*.55} ${by-ht*.45}Q${-hw*.25} ${by-ht*.56} 0 ${by-ht*.4}Q${hw*.25} ${by-ht*.56} ${hw*.55} ${by-ht*.45}Z" fill="#f4f9ff"/>`);
 });
 o.push('<circle cx="0" cy="-67" r="2.6" fill="#ffd54a"/></g>');
 return o.join('');
}
function penguin(x,y,s,scarf){
 return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s.toFixed(2)})">`+
  '<ellipse cx="0" cy="2" rx="11" ry="3.5" fill="#6b8cb0" opacity=".35"/>'+
  '<ellipse cx="-4" cy="1" rx="4" ry="2" fill="#ff9d2e"/><ellipse cx="4" cy="1" rx="4" ry="2" fill="#ff9d2e"/>'+
  '<ellipse cx="0" cy="-12" rx="9.5" ry="13" fill="#1d2b44"/><ellipse cx="0" cy="-9" rx="5.8" ry="9.6" fill="#f6fbff"/>'+
  '<ellipse cx="-9" cy="-10" rx="2.6" ry="7" fill="#16223a" transform="rotate(14 -9 -10)"/><ellipse cx="9" cy="-10" rx="2.6" ry="7" fill="#16223a" transform="rotate(-14 9 -10)"/>'+
  '<circle cx="-3.2" cy="-20" r="1.9" fill="#fff"/><circle cx="3.2" cy="-20" r="1.9" fill="#fff"/><circle cx="-3" cy="-20" r=".9" fill="#111"/><circle cx="3" cy="-20" r=".9" fill="#111"/>'+
  '<path d="M-2.6 -17.5L0 -14.6L2.6 -17.5Z" fill="#ff9d2e"/>'+
  `<rect x="-8" y="-15" width="16" height="3.4" rx="1.7" fill="${scarf}"/><rect x="3" y="-13" width="3.6" height="7" rx="1.5" fill="${scarf}"/></g>`;
}
function gift(x,y,s,c1,c2){
 return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s.toFixed(2)})"><ellipse cx="0" cy="1" rx="14" ry="3" fill="#6b8cb0" opacity=".3"/>`+
  `<rect x="-11" y="-16" width="22" height="16" rx="2" fill="${c1}"/><rect x="-2" y="-16" width="4" height="16" fill="${c2}"/>`+
  `<rect x="-12" y="-21" width="24" height="6" rx="2" fill="${c1}"/><rect x="-2" y="-21" width="4" height="6" fill="${c2}"/>`+
  `<path d="M0 -21Q-9 -32 -4 -26Q0 -22 0 -21Q0 -22 4 -26Q9 -32 0 -21Z" fill="${c2}"/></g>`;
}

export function backdropSVG(world){
 const {w,h,bounds:b}=world,rnd=rng32(w*131+h*7),u=w/960;
 const pad=34,bank=18;
 const lights=[],P=[];
 P.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`);
 P.push(`<defs>
<linearGradient id="gnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9d3ee"/><stop offset=".5" stop-color="#d9eafb"/><stop offset="1" stop-color="#c3daf2"/></linearGradient>
<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#1b3f73" stop-opacity="0"/><stop offset="1" stop-color="#1b3f73" stop-opacity=".38"/></radialGradient>
<linearGradient id="ice" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9efff"/><stop offset=".45" stop-color="#8fd2f8"/><stop offset="1" stop-color="#6ebdf0"/></linearGradient>
<radialGradient id="sheen" cx=".28" cy=".22" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="snowB" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dcecfb"/></radialGradient>
<filter id="blur6" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="blur2"><feGaussianBlur stdDeviation="1.6"/></filter>
<clipPath id="rink"><path d="${rrPath(b.x,b.y,b.w,b.h,b.rc)}"/></clipPath>
</defs>`);
 P.push(`<rect width="${w}" height="${h}" fill="url(#gnd)"/>`);
 // drifting snow mounds + sparkle
 for(let i=0;i<9;i++){const x=rnd()*w,y=rnd()*h,r=(30+rnd()*70)*u;P.push(`<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r)}" ry="${f1(r*.28)}" fill="#fff" opacity=".35"/>`);}
 for(let i=0;i<70;i++){P.push(`<circle cx="${f1(rnd()*w)}" cy="${f1(rnd()*h)}" r="${(.8+rnd()*1.6).toFixed(1)}" fill="#fff" opacity="${(.5+rnd()*.5).toFixed(2)}"/>`);}
 // trees behind the bank: top row, side columns
 const tS=()=>u*(.78+rnd()*.34);
 for(let x=b.x-20*u;x<b.x+b.w+30*u;x+=(92+rnd()*50)*u)P.push(pine(x,b.y-pad*.55+rnd()*8,tS()));
 const rows=Math.max(2,Math.round(b.h/(110*u)));
 for(let i=0;i<rows;i++){
  const y=b.y+28*u+i*((b.h-30*u)/rows)+rnd()*14;
  P.push(pine((b.x-pad-14*u)*.62+rnd()*8,y,tS()));
  P.push(pine(w-(b.x-pad-14*u)*.62-rnd()*8,y+16,tS()));
 }
 // snow bank (fluffy ring), rim, ice
 const ring=perimeter(b.x-bank,b.y-bank,b.w+bank*2,b.h+bank*2,b.rc+bank,18);
 P.push(`<path d="${rrPath(b.x-pad,b.y-pad,b.w+pad*2,b.h+pad*2,b.rc+pad)}" fill="#6f95bd" opacity=".45" filter="url(#blur6)" transform="translate(0 7)"/>`);
 for(const [x,y] of ring)P.push(`<circle cx="${f1(x)}" cy="${f1(y+4)}" r="${f1(17+rnd()*4)}" fill="#a8c6e3"/>`);
 for(const [x,y] of ring)P.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(16+rnd()*4)}" fill="url(#snowB)"/>`);
 P.push(`<path d="${rrPath(b.x-5,b.y-5,b.w+10,b.h+10,b.rc+5)}" fill="#b6d9f3"/>`);
 P.push(`<path d="${rrPath(b.x,b.y,b.w,b.h,b.rc)}" fill="url(#ice)"/>`);
 // ice detail (clipped to the rink)
 P.push('<g clip-path="url(#rink)">');
 P.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="url(#sheen)"/>`);
 for(let i=0;i<3;i++){
  const x0=b.x+b.w*(.12+i*.3+rnd()*.1),wd=b.w*(.05+rnd()*.05);
  P.push(`<path d="M${f1(x0)} ${b.y}L${f1(x0+wd)} ${b.y}L${f1(x0+wd-b.h*.45)} ${b.y+b.h}L${f1(x0-b.h*.45)} ${b.y+b.h}Z" fill="#fff" opacity="${(.07+rnd()*.06).toFixed(2)}"/>`);
 }
 for(let i=0;i<34;i++){
  const x=b.x+rnd()*b.w,y=b.y+rnd()*b.h,a=rnd()*TAU,l=(30+rnd()*110)*u,cx=x+Math.cos(a+1)*l*.3,cy=y+Math.sin(a+1)*l*.3;
  P.push(`<path d="M${f1(x)} ${f1(y)}Q${f1(cx)} ${f1(cy)} ${f1(x+Math.cos(a)*l)} ${f1(y+Math.sin(a)*l)}" fill="none" stroke="${rnd()<.8?'#fff':'#4a9ad6'}" stroke-width="${(.5+rnd()*.9).toFixed(2)}" opacity="${(.2+rnd()*.35).toFixed(2)}"/>`);
 }
 for(let i=0;i<5;i++){
  const x=b.x+rnd()*b.w,y=b.y+rnd()*b.h,l=(26+rnd()*40)*u;
  P.push(`<path d="M${f1(x)} ${f1(y)}l${f1(l*.4)} ${f1(l*.2)}l${f1(l*.2)} ${f1(-l*.1)}l${f1(l*.3)} ${f1(l*.35)}" fill="none" stroke="#e9f8ff" stroke-width="1" opacity=".45"/>`);
 }
 P.push(`<path d="${rrPath(b.x,b.y,b.w,b.h,b.rc)}" fill="none" stroke="#2a78b8" stroke-opacity=".35" stroke-width="12"/>`);
 P.push('</g>');
 P.push(`<path d="${rrPath(b.x,b.y,b.w,b.h,b.rc)}" fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-width="1.6"/>`);
 // fairy lights on the bank
 const wire=rrPath(b.x-pad+4,b.y-pad+4,b.w+(pad-4)*2,b.h+(pad-4)*2,b.rc+pad-4);
 P.push(`<path d="${wire}" fill="none" stroke="#27435f" stroke-width="1.4" opacity=".75"/>`);
 const cols=['#ff4d6d','#ffd23a','#4dd2ff','#7dff6b','#c77dff','#ff9a3d'];
 perimeter(b.x-pad+4,b.y-pad+4,b.w+(pad-4)*2,b.h+(pad-4)*2,b.rc+pad-4,26*Math.max(1,u*.9)).forEach(([x,y],i)=>{
  const c=cols[i%cols.length];lights.push({x,y,c});
  P.push(`<circle cx="${f1(x)}" cy="${f1(y+2)}" r="4.6" fill="${c}"/><circle cx="${f1(x-1.2)}" cy="${f1(y)}" r="1.4" fill="#fff" opacity=".85"/>`);
 });
 // penguins + presents in the margins
 const sc=Math.max(1,u*1.05);
 P.push(penguin(34*u,h-26*u,sc,'#ff4d6d'));P.push(penguin(w-40*u,h-22*u,sc,'#4dd2ff'));
 P.push(penguin(26*u,h*.5,sc*.95,'#ffd23a'));P.push(penguin(w-28*u,h*.38,sc*.95,'#7dff6b'));
 P.push(penguin(b.x+b.w*.28,h-14*u,sc*.8,'#c77dff'));
 P.push(gift(b.x+b.w*.62,h-12*u,sc*.75,'#e5262f','#ffe08a'));P.push(gift(w-70*u,h-18*u,sc*.7,'#3b5bff','#fff'));
 P.push(`<rect width="${w}" height="${h}" fill="url(#vig)"/>`);
 P.push('</svg>');
 return {svg:P.join(''),lights};
}

export function preload(world){
 const L={ready:false,failed:false,img:null,lights:[],world};
 const out=backdropSVG(world);L.lights=out.lights;
 if(typeof Image!=='undefined'){
  const img=new Image();
  img.onload=()=>{L.ready=true;};img.onerror=()=>{L.failed=true;};
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(out.svg);
  L.img=img;
 }
 return L;
}
export function drawBackdrop(g,world,L,t){
 if(L&&L.ready)g.drawImage(L.img,0,0,world.w,world.h);
 else{
  g.fillStyle='#c9def4';g.fillRect(0,0,world.w,world.h);
  const b=world.bounds;g.fillStyle='#8fd2f8';g.beginPath();g.roundRect?g.roundRect(b.x,b.y,b.w,b.h,b.rc):g.rect(b.x,b.y,b.w,b.h);g.fill();
 }
 if(L){
  g.save();
  for(let i=0;i<L.lights.length;i++){
   const q=L.lights[i],a=.18+.2*(.5+.5*Math.sin(t*3+i*1.3));
   g.globalAlpha=a;g.fillStyle=q.c;g.beginPath();g.arc(q.x,q.y,9,0,TAU);g.fill();
  }
  g.restore();
 }
}

/* ------------------------------ scoops ------------------------------ */
export function drawGround(g,sc,c){
 const R=Math.max(3,sc.drawR);
 g.save();
 g.fillStyle='rgba(18,64,120,.30)';
 g.beginPath();g.ellipse(sc.x+R*.14,sc.y+R*.9,R*.96,R*.36,0,0,TAU);g.fill();
 // mirrored reflection on the ice
 const ry=sc.y+R*1.7,grd=g.createLinearGradient(0,sc.y+R*.9,0,ry+R*.8);
 grd.addColorStop(0,c);grd.addColorStop(1,'rgba(255,255,255,0)');
 g.globalAlpha=.2;g.fillStyle=grd;
 g.beginPath();g.ellipse(sc.x,ry-R*.1,R*.86,R*.72,0,0,TAU);g.fill();
 g.restore();
}
export function drawScoop(g,sc,c,t){
 const R=Math.max(3,sc.drawR),sq=sc.squash||0;
 const wob=Math.sin(t*26+sc.id*1.7)*.17*sq,pop=1+.1*sq;
 g.save();g.translate(sc.x,sc.y);g.scale((1+wob)*pop,(1-wob)*pop);
 const body=g.createRadialGradient(-R*.38,-R*.42,R*.08,0,0,R*1.08);
 body.addColorStop(0,mix(c,'#ffffff',.62));body.addColorStop(.38,mix(c,'#ffffff',.12));
 body.addColorStop(.82,c);body.addColorStop(1,mix(c,'#000000',.4));
 g.fillStyle=body;g.beginPath();g.arc(0,0,R,0,TAU);g.fill();
 // rolling ice-cream texture
 g.save();g.beginPath();g.arc(0,0,R-.5,0,TAU);g.clip();g.rotate(sc.rot||0);g.lineCap='round';
 for(let i=0;i<3;i++){
  g.strokeStyle='rgba(255,255,255,'+(.2-i*.045)+')';g.lineWidth=Math.max(1,R*.11);
  g.beginPath();g.arc(0,0,R*(.34+i*.23),i*2.1,i*2.1+2.3);g.stroke();
 }
 g.strokeStyle='rgba(0,0,0,.10)';g.lineWidth=Math.max(.8,R*.07);
 for(let i=0;i<2;i++){g.beginPath();g.arc(0,0,R*(.5+i*.25),i*3.3+.7,i*3.3+2.2);g.stroke();}
 for(const q of sc.spk){
  g.fillStyle=q.l?'rgba(255,255,255,.55)':'rgba(40,10,10,.22)';
  g.beginPath();g.ellipse(Math.cos(q.a)*q.d*R,Math.sin(q.a)*q.d*R,q.r*R,q.r*R*.7,q.a,0,TAU);g.fill();
 }
 g.restore();
 g.globalAlpha=.55;g.strokeStyle=mix(c,'#000000',.5);g.lineWidth=1.3;g.beginPath();g.arc(0,0,R,0,TAU);g.stroke();g.globalAlpha=1;
 g.fillStyle='rgba(255,255,255,.72)';g.beginPath();g.ellipse(-R*.36,-R*.42,R*.27,R*.15,-.7,0,TAU);g.fill();
 g.fillStyle='rgba(255,255,255,.25)';g.beginPath();g.arc(R*.4,R*.42,R*.11,0,TAU);g.fill();
 if(sc.flash>0){g.globalAlpha=clamp(sc.flash,0,1)*.6;g.fillStyle='#fff';g.beginPath();g.arc(0,0,R,0,TAU);g.fill();g.globalAlpha=1;}
 g.restore();
 if(sc.mass>=2){
  g.save();g.font='900 '+Math.round(R*.95)+'px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';
  g.lineWidth=Math.max(2,R*.18);g.strokeStyle='rgba(20,30,60,.65)';g.fillStyle='#fff';
  g.strokeText(String(sc.mass),sc.x,sc.y+R*.06);g.fillText(String(sc.mass),sc.x,sc.y+R*.06);g.restore();
 }
}

/* ------------------------------ polar bear mount ------------------------------ */
export function drawBear(g,p,c,t,moving){
 const f=p.face<0?-1:1,ph=t*14+(p.x+p.y)*.03,bob=moving?Math.sin(ph)*1.1:0;
 g.save();g.translate(p.x,p.y+3);
 g.fillStyle='rgba(18,64,120,.30)';g.beginPath();g.ellipse(0,11,18,5.5,0,0,TAU);g.fill();
 g.globalAlpha=.8;g.strokeStyle=c;g.lineWidth=2.4;g.beginPath();g.ellipse(0,10.5,16.5,5,0,0,TAU);g.stroke();g.globalAlpha=1;
 g.scale(f,1);
 const leg=(x,y,k)=>{g.fillStyle='#e4eef8';g.strokeStyle='#9db8d4';g.lineWidth=.8;g.beginPath();g.ellipse(x,y+(moving?Math.sin(ph+k)*1.8:0),3.4,3.8,0,0,TAU);g.fill();g.stroke();};
 leg(-10,8,0);leg(-4,9,Math.PI);leg(6,9,0);leg(12,8,Math.PI);
 g.translate(0,bob);
 const body=g.createLinearGradient(0,-8,0,13);body.addColorStop(0,'#ffffff');body.addColorStop(1,'#cfe0f1');
 g.fillStyle=body;g.strokeStyle='#9db8d4';g.lineWidth=1;g.beginPath();g.ellipse(0,3,16.5,10.5,0,0,TAU);g.fill();g.stroke();
 g.fillStyle='#fff';g.beginPath();g.arc(-16.5,1.5,3,0,TAU);g.fill();g.stroke();
 // saddle in the player's flavour colour
 g.fillStyle=c;g.strokeStyle=mix(c,'#000000',.45);g.lineWidth=1;g.beginPath();g.ellipse(0,-3,8.5,3.6,0,0,TAU);g.fill();g.stroke();
 // head
 g.fillStyle='#fff';g.strokeStyle='#9db8d4';g.lineWidth=1;
 g.beginPath();g.arc(14,-1,7,0,TAU);g.fill();g.stroke();
 g.beginPath();g.arc(11,-7,2.6,0,TAU);g.fill();g.stroke();g.beginPath();g.arc(18,-6.6,2.6,0,TAU);g.fill();g.stroke();
 g.fillStyle='#f1f7fd';g.beginPath();g.ellipse(19.6,1.4,3.6,2.9,0,0,TAU);g.fill();g.stroke();
 g.fillStyle='#1b2433';g.beginPath();g.arc(22,.6,1.3,0,TAU);g.fill();g.beginPath();g.arc(16.4,-2,.95,0,TAU);g.fill();
 g.restore();
}

/* ------------------------------ effects ------------------------------ */
export function drawFx(g,e){
 const a=clamp(e.life/e.max,0,1);
 g.save();
 if(e.k==='ring'){
  g.globalAlpha=a*.9;g.strokeStyle=e.color;g.lineWidth=1+4*a;
  g.beginPath();g.arc(e.x,e.y,e.r0+e.grow*(1-a),0,TAU);g.stroke();
 }else if(e.k==='drop'){
  g.globalAlpha=a;g.fillStyle=e.color;g.beginPath();g.arc(e.x,e.y,e.r*(.55+.45*a),0,TAU);g.fill();
  g.fillStyle='rgba(255,255,255,.7)';g.beginPath();g.arc(e.x-e.r*.25,e.y-e.r*.3,e.r*.25,0,TAU);g.fill();
 }else if(e.k==='puff'){
  g.globalAlpha=a*.55;g.fillStyle='#fff';g.beginPath();g.arc(e.x,e.y,e.r0+e.grow*(1-a),0,TAU);g.fill();
 }else if(e.k==='spark'){
  g.globalAlpha=a;g.strokeStyle='#fff';g.lineWidth=1.4;const r=e.r*(.6+.4*a);
  g.beginPath();g.moveTo(e.x-r,e.y);g.lineTo(e.x+r,e.y);g.moveTo(e.x,e.y-r);g.lineTo(e.x,e.y+r);g.stroke();
 }else if(e.k==='text'){
  g.globalAlpha=Math.min(1,a*1.6);g.font='900 '+(e.size||16)+'px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';
  g.lineWidth=4;g.strokeStyle='rgba(20,30,60,.8)';g.fillStyle=e.color;
  g.strokeText(e.text,e.x,e.y);g.fillText(e.text,e.x,e.y);
 }
 g.restore();
}

export default Object.freeze({FLAVORS,mix,preload,drawBackdrop,drawGround,drawScoop,drawBear,drawFx});
