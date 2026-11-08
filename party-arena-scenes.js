/* Original vector scenery and props for the market, jousting fair and witch
   courtyard. All positions come from engine geometry; painting consumes no RNG. */
(() => {
'use strict';
const TAU=Math.PI*2,images=new Map(),backdrops=new WeakMap();
const safeColor=value=>/^#[a-f\d]{6}$/i.test(value||'')?value:'#54c4db';
const shade=(value,amount)=>{const v=safeColor(value).slice(1);return '#'+[0,2,4].map(i=>Math.max(0,Math.min(255,parseInt(v.slice(i,i+2),16)+amount)).toString(16).padStart(2,'0')).join('');};
const noise=n=>{const v=Math.sin(n*137.2+73.1)*37149.31;return v-Math.floor(v);};
const svg=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const oval=(g,x,y,rx,ry,fill)=>{g.beginPath();g.ellipse(x,y,rx,ry,0,0,TAU);g.fillStyle=fill;g.fill();};
function box(g,x,y,w,h,r,fill,stroke){g.beginPath();g.roundRect(x,y,w,h,r);g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.stroke();}}
function line(g,x1,y1,x2,y2,color,width=1){g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.strokeStyle=color;g.lineWidth=width;g.stroke();}
const ready=img=>!!(img&&img.complete&&img.naturalWidth>0);
function imageFor(key,markup){
 if(images.has(key))return images.get(key);
 if(typeof Image==='undefined')return null;
 const image=new Image();image.decoding='async';image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(markup());images.set(key,image);return image;
}
const productIds=Object.freeze(['banana','watermelon','soda','juice','chips','milk','greens','can','apple','bomb']);
function productSVG(id){
 const body={
  banana:`<path d="M8 20Q18 35 36 12Q41 31 24 39Q7 45 4 27Z" fill="#d79b18" stroke="#886026" stroke-width="1.5"/><path d="M9 15Q17 31 32 12Q37 31 21 35Q7 37 6 22Z" fill="#ffe149" stroke="#e6b323" stroke-width="1.3"/><path d="M15 10Q18 22 28 10Q30 23 20 27Q11 26 12 15Z" fill="#fff26f"/><path d="m28 10 3-5 4 1-3 7M4 25l-2 4 4 3" fill="#70552b"/><path d="M10 20Q17 35 30 20" stroke="#fff6a2" stroke-width="2" fill="none"/>`,
  watermelon:`<path d="M6 7 43 24 12 43Q-1 25 6 7Z" fill="#31894c" stroke="#235d3c" stroke-width="1.5"/><path d="M8 9 40 24 13 40Q2 24 8 9Z" fill="#d7ed9c"/><path d="M10 12 37 24 14 36Q7 25 10 12Z" fill="#f2565a"/><path d="M12 14 34 24 15 32" fill="#ff7974"/><g fill="#563a37"><ellipse cx="15" cy="21" rx="1.3" ry="2.2" transform="rotate(-30 15 21)"/><ellipse cx="20" cy="28" rx="1.3" ry="2.2" transform="rotate(30 20 28)"/><ellipse cx="27" cy="24" rx="1.2" ry="2" transform="rotate(80 27 24)"/></g>`,
  soda:`<path d="M13 9Q24 4 35 9L36 39Q24 46 12 39Z" fill="url(#red)" stroke="#922e3b" stroke-width="1.5"/><ellipse cx="24" cy="9" rx="11" ry="4" fill="#d8dfdd" stroke="#85999e"/><ellipse cx="24" cy="9" rx="8" ry="2" fill="#9caeb1"/><rect x="22" y="7" width="5" height="3" rx="1" fill="#ecf0e3"/><path d="M14 25Q20 17 25 23T35 20V29Q30 36 24 30T13 34Z" fill="#fff8e6"/><path d="M14 38Q24 42 34 38" stroke="#ffd2b6" stroke-width="2" fill="none"/><path d="M16 13v8" stroke="#ffaca3" stroke-width="3" stroke-linecap="round"/>`,
  juice:`<path d="M19 3h10v10Q37 18 36 40Q24 45 12 40Q11 18 19 13Z" fill="url(#green)" stroke="#668c22" stroke-width="1.5"/><rect x="18" y="3" width="12" height="6" rx="2" fill="#c7e447"/><path d="M14 25h20v12H14Z" fill="#fff9cb"/><ellipse cx="25" cy="30" rx="6" ry="5" fill="#efc53c"/><path d="M24 25q4-5 7-2" stroke="#4d9638" stroke-width="2" fill="none"/><path d="M18 16q-3 4-3 8" stroke="#e6f59b" stroke-width="3" stroke-linecap="round" fill="none"/>`,
  chips:`<path d="m11 5 4 2 4-2 4 2 4-2 4 2 5-2-1 13 3 25-5-1-4 2-5-2-4 2-4-2-5 1 2-24Z" fill="url(#orange)" stroke="#c47724" stroke-width="1.5"/><path d="M14 10h20M14 39h20" stroke="#e7a439" stroke-width="2"/><ellipse cx="24" cy="25" rx="11" ry="9" fill="#fff0ac"/><ellipse cx="21" cy="24" rx="5" ry="7" transform="rotate(-25 21 24)" fill="#eab74c"/><ellipse cx="29" cy="27" rx="5" ry="7" transform="rotate(25 29 27)" fill="#f7cf68"/><path d="M20 20v8M28 23v8" stroke="#ffe9a0" fill="none"/>`,
  milk:`<path d="m13 12 7-8h13l4 9v28H11V14Z" fill="#f4f5e9" stroke="#a3bec4" stroke-width="1.5"/><path d="M20 4v8h17L33 4Z" fill="#79c8de"/><path d="M11 15h26v19H11Z" fill="#4c9dc5"/><path d="m16 25 6-7 8 5-3 7h-8Z" fill="#f9fbec"/><path d="M32 14v26" stroke="#d1e5e2" stroke-width="3"/><path d="M14 37h14" stroke="#8ebfc9" stroke-width="2"/>`,
  greens:`<path d="M23 44 18 28 31 27 29 44Z" fill="#e7f2b0" stroke="#82a862" stroke-width="1.4"/><path d="M21 34Q3 34 7 20Q-1 9 14 8Q20-3 27 8Q41 3 41 17Q49 30 34 34Z" fill="url(#green)" stroke="#448b47" stroke-width="1.8"/><path d="M24 38Q20 18 10 16M25 38Q27 19 37 12M24 30V10" fill="none" stroke="#d3ed9e" stroke-width="2"/><path d="M11 10Q5 13 9 19" stroke="#d6ee9a" stroke-width="2" fill="none"/>`,
  can:`<path d="M11 9h26v30Q24 45 11 39Z" fill="#a8bdc4" stroke="#6d8994" stroke-width="1.5"/><path d="M12 15h24v19H12Z" fill="#87b36b"/><path d="M14 17h20v15H14Z" fill="#f4e7bb"/><ellipse cx="24" cy="9" rx="13" ry="5" fill="#dbe4dc" stroke="#8b9fa3"/><ellipse cx="24" cy="9" rx="9" ry="2.8" fill="none" stroke="#a0b3b1"/><g fill="#65a55b"><circle cx="21" cy="24" r="4"/><circle cx="28" cy="25" r="4"/><circle cx="24" cy="29" r="3"/></g><path d="M13 38q11 4 22 0" stroke="#eff3df" stroke-width="2" fill="none"/>`,
  apple:`<path d="M24 12C9 3 1 20 8 35Q15 46 24 40Q34 46 41 31Q47 8 28 12Z" fill="url(#red)" stroke="#9f3540" stroke-width="1.6"/><path d="M24 13Q21 7 25 3" stroke="#6a5532" stroke-width="3" fill="none"/><path d="M25 8Q35-1 40 7Q34 15 25 8Z" fill="#75b957" stroke="#4c8d42"/><path d="M14 16Q8 22 12 28" stroke="#ffb3a2" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  bomb:`<path d="M25 14Q22 6 31 4" stroke="#81632f" stroke-width="3" fill="none"/><path d="m31 1 2 5 5-1-3 4 3 4-5-1-3 5-1-6-5-2 6-2Z" fill="#ffe98c"/><circle cx="24" cy="29" r="16" fill="url(#red)" stroke="#6b2936" stroke-width="2"/><rect x="18" y="12" width="12" height="6" rx="2" fill="#733842"/><path d="M16 26Q16 19 24 19T32 26L29 31V35H19V31Z" fill="#fff2d5"/><circle cx="21" cy="27" r="2.6" fill="#713440"/><circle cx="28" cy="27" r="2.6" fill="#713440"/><path d="m24 29 2 3h-4Z" fill="#713440"/><path d="M15 20Q10 27 13 31" stroke="#ff8b76" stroke-width="2.5" fill="none"/>`
 }[id];
 if(!body)return '';
 return svg(48,48,`<defs><linearGradient id="red" x2="1" y2="1"><stop stop-color="#ff7868"/><stop offset=".5" stop-color="#e84346"/><stop offset="1" stop-color="#af2a3c"/></linearGradient><linearGradient id="green" x2="1" y2="1"><stop stop-color="#cee95f"/><stop offset=".5" stop-color="#8fca40"/><stop offset="1" stop-color="#49954e"/></linearGradient><linearGradient id="orange" x2="1" y2="1"><stop stop-color="#ffd45f"/><stop offset=".5" stop-color="#f3a03e"/><stop offset="1" stop-color="#d67528"/></linearGradient></defs><g data-product="${id}">${body}</g>`);
}
function treeSVG(golden=false){
 let foliage='';
 if(golden){
  for(let i=0;i<44;i++){
   const a=i*2.39996,len=43+noise(i)*30,x=78+Math.cos(a)*len,y=76+Math.sin(a)*len*.88;
   const midX=78+Math.cos(a-.13)*len*.5,midY=76+Math.sin(a-.13)*len*.47;
   foliage+=`<path d="M77 87Q${midX-13} ${midY+9} ${x} ${y}Q${midX+13} ${midY-8} 77 87Z" fill="${['#815c24','#a97726','#bf8e2d','#d2a03a'][i%4]}" stroke="#725221" stroke-width=".7"/><path d="M77 87Q${midX} ${midY} ${x} ${y}" fill="none" stroke="#f0c85b" stroke-opacity=".22"/>`;
  }
 }else{
  for(let layer=0;layer<3;layer++)for(let i=0;i<9;i++){
   const a=i*TAU/9+layer*.37,r=44-layer*13,cx=78+Math.cos(a)*r,cy=75+Math.sin(a)*r*.78-layer*4;
   foliage+=`<ellipse cx="${cx}" cy="${cy}" rx="${28-layer*3}" ry="${25-layer*2}" fill="${['#39803e','#5d9f3b','#81b742'][layer]}" stroke="${['#32703c','#4c9039','#79aa3c'][layer]}" stroke-width="2"/><path d="M${cx-16} ${cy-8}q11-13 23-6" stroke="#c3dc6590" stroke-width="2" fill="none"/>`;
  }
  foliage+='<ellipse cx="75" cy="62" rx="26" ry="22" fill="#91bf49"/><ellipse cx="65" cy="53" rx="9" ry="5" fill="#c3d95e" opacity=".7"/>';
 }
 return svg(160,160,`<ellipse cx="85" cy="100" rx="67" ry="51" fill="#18372c" opacity=".32"/><path d="M71 135 75 74h15l3 61Z" fill="#685030"/><g data-prop="${golden?'golden-grove':'garden-tree'}">${foliage}</g>`);
}
function tentSVG(color){
 color=safeColor(color);let stripes='';
 for(let i=0;i<5;i++)stripes+=`<path d="M19 ${25+i*20}H161V${45+i*20}H19Z" fill="${i%2?shade(color,-16):color}"/><path d="M22 ${27+i*20}H158" stroke="${shade(color,35)}" stroke-opacity=".5"/>`;
 return svg(180,154,`<g data-prop="fair-canopy"><path d="M11 31h159v110H11Z" fill="#384323" opacity=".25"/><g fill="#765036" stroke="#4f382c" stroke-width="2"><path d="M6 10h10v134H6ZM164 10h10v134h-10Z"/><path d="M0 20h180v9H0ZM0 124h180v9H0Z"/></g><path d="M18 25H162V126H18Z" fill="${shade(color,-40)}"/>${stripes}<path d="M19 25H161M19 25V124" fill="none" stroke="${shade(color,60)}" stroke-width="3"/><path d="M19 124H161" stroke="${shade(color,-55)}" stroke-width="4"/><g fill="#b18450"><rect x="4" y="17" width="14" height="13" rx="2"/><rect x="162" y="17" width="14" height="13" rx="2"/><rect x="4" y="121" width="14" height="13" rx="2"/><rect x="162" y="121" width="14" height="13" rx="2"/></g></g>`);
}
function roofSVG(color){
 color=safeColor(color);let tiles='';
 for(let row=0;row<6;row++)for(let col=0;col<8;col++){
  const x=13+col*22+(row%2?9:0),y=14+row*19;
  if(x>179)continue;
  tiles+=`<path d="M${x} ${y}h19l-1 18-10 3-9-3Z" fill="${shade(color,(row+col)%3*9-10)}" stroke="${shade(color,-45)}" stroke-width="1.3"/><path d="M${x+2} ${y+3}h14" stroke="${shade(color,55)}" stroke-opacity=".55"/>`;
 }
 return svg(210,162,`<defs><radialGradient id="lantern" cx=".35" cy=".3"><stop stop-color="#fff2b0"/><stop offset=".4" stop-color="#e8b15a"/><stop offset="1" stop-color="#946137"/></radialGradient></defs><g data-prop="witch-shrine"><path d="M9 14h191v139H9Z" fill="#111c35"/><path d="M14 20h181v130H14Z" fill="#666b6b"/><path d="M20 32h170v109H20Z" fill="#354940"/><path d="M6 10 100 0 202 11 192 139 109 150 11 137Z" fill="${shade(color,-30)}" stroke="#91836a" stroke-width="4"/>${tiles}<path d="M7 11 101 2 200 12" fill="none" stroke="${shade(color,60)}" stroke-width="4"/><g fill="url(#lantern)" stroke="#966b36" stroke-width="2"><circle cx="172" cy="39" r="25"/><circle cx="140" cy="19" r="16"/></g><g fill="#ffe0a0" opacity=".75"><circle cx="163" cy="29" r="5"/><circle cx="184" cy="34" r="5"/><circle cx="173" cy="51" r="5"/><circle cx="135" cy="13" r="4"/></g></g>`);
}
function cashierSVG(color){
 color=safeColor(color);
 return svg(80,80,`<defs><radialGradient id="cap" cx=".35" cy=".25"><stop stop-color="${shade(color,48)}"/><stop offset=".7" stop-color="${color}"/><stop offset="1" stop-color="${shade(color,-45)}"/></radialGradient></defs><ellipse cx="42" cy="43" rx="28" ry="27" fill="#302d3044"/><path d="M17 38Q40 22 63 38L58 61H22Z" fill="${color}" stroke="${shade(color,-55)}" stroke-width="2"/><ellipse cx="17" cy="46" rx="8" ry="11" fill="${color}"/><ellipse cx="63" cy="46" rx="8" ry="11" fill="${color}"/><circle cx="18" cy="55" r="6" fill="#f3d5ac"/><circle cx="62" cy="55" r="6" fill="#f3d5ac"/><ellipse cx="40" cy="42" rx="18" ry="19" fill="#efcda1"/><path d="M19 37Q17 13 40 10Q64 12 62 37Q40 46 19 37Z" fill="url(#cap)" stroke="${shade(color,-50)}" stroke-width="2"/><path d="M23 37Q40 43 58 36Q64 44 46 49Q34 48 23 43Z" fill="${shade(color,-22)}" stroke="${shade(color,-50)}"/><ellipse cx="34" cy="48" rx="2" ry="2.6" fill="#41403b"/><ellipse cx="47" cy="48" rx="2" ry="2.6" fill="#41403b"/><path d="M35 56q5 4 11-1" fill="none" stroke="#9b7058" stroke-width="1.5"/><rect x="34" y="23" width="14" height="5" rx="2" fill="#fff4ce"/>`);
}
function registerSVG(){
 let keys='';for(let r=0;r<4;r++)for(let c=0;c<4;c++)keys+=`<rect x="${15+c*8}" y="${33+r*7}" width="6" height="5" rx="1" fill="${['#71bc8e','#e6c96b','#d77e76','#7ba6c5'][(r+c)%4]}"/>`;
 return svg(64,80,`<path d="M8 19h48v53H8Z" fill="#33485b55"/><path d="M8 13h44l5 52H4Z" fill="#d8ded6" stroke="#7b929c" stroke-width="2"/><path d="M12 17h36v15H12Z" fill="#799aab"/><path d="M15 19h30v10H15Z" fill="#81cce0"/><path d="M17 20h4v7h-4Z" fill="#e8fcf6"/><path d="M25 20h14" stroke="#caf6ef" stroke-width="2"/>${keys}<path d="M6 62h49v10H6Z" fill="#e9eee3" stroke="#899da4"/><path d="M13 66h33" stroke="#778b92" stroke-width="2"/><path d="M47 7h11v19H47Z" fill="#f6f2d9" stroke="#bdc7be"/><path d="M49 10h6m-6 4h6m-6 4h6" stroke="#a9b7b3"/>`);
}
function cartSVG(color){
 color=safeColor(color);let mesh='';
 for(let i=0;i<5;i++)mesh+=`<path d="M${15+i*8} 10v36M13 ${13+i*8}h38" stroke="${shade(color,-35)}" stroke-opacity=".6" stroke-width="1.4"/>`;
 return svg(64,76,`<g data-prop="shopping-cart"><ellipse cx="34" cy="39" rx="25" ry="24" fill="#21303e44"/><g fill="#414c55" stroke="#29323c"><rect x="6" y="8" width="7" height="13" rx="3"/><rect x="51" y="8" width="7" height="13" rx="3"/><rect x="7" y="43" width="7" height="13" rx="3"/><rect x="50" y="43" width="7" height="13" rx="3"/></g><path d="M11 7h42l-3 43H14Z" fill="${shade(color,-20)}" stroke="${shade(color,-65)}" stroke-width="2"/><path d="M15 11h34l-3 35H18Z" fill="${shade(color,5)}"/>${mesh}<path d="M12 7h40M12 9l3 39" fill="none" stroke="${shade(color,65)}" stroke-width="3"/><path d="M17 49v10h30V49" fill="none" stroke="#c4d8d5" stroke-width="3"/><path d="M18 59h28" stroke="${shade(color,-35)}" stroke-width="6" stroke-linecap="round"/><path d="M19 57h26" stroke="${shade(color,50)}" stroke-width="2"/></g>`);
}
function horseSVG(color){
 color=safeColor(color);
 return svg(110,70,`<defs><linearGradient id="coat" y2="1" x2=".3"><stop stop-color="#d69a62"/><stop offset=".55" stop-color="#ae7048"/><stop offset="1" stop-color="#784c35"/></linearGradient></defs><g data-prop="horse"><ellipse cx="55" cy="41" rx="39" ry="22" fill="#42312644"/><path d="M29 31Q12 16 5 28Q20 28 26 39" fill="#5b382b"/><path d="M29 25 36 10 45 14 40 29M65 24 71 10 80 13 77 30M31 43 37 58 46 55 41 40M65 43 72 58 81 54 76 38" fill="#77462e" stroke="#5a382c" stroke-width="2"/><ellipse cx="51" cy="34" rx="31" ry="19" fill="url(#coat)" stroke="#784d34" stroke-width="1.5"/><path d="M64 22Q81 12 94 22L102 32 94 45Q79 53 65 43Z" fill="url(#coat)" stroke="#784d34" stroke-width="1.5"/><path d="m79 19-1-11 10 9M80 47l-1 10 10-12" fill="#985d3d" stroke="#694331"/><path d="M65 23Q74 33 66 45" stroke="#4f332a" stroke-width="7" fill="none"/><path d="M90 23v21" stroke="#e3c39b" stroke-width="3"/><ellipse cx="97" cy="34" rx="7" ry="10" fill="#c99573"/><circle cx="88" cy="25" r="2" fill="#392d27"/><circle cx="88" cy="43" r="2" fill="#392d27"/><path d="M35 19h25v30H35Z" fill="${color}" stroke="${shade(color,-50)}" stroke-width="2"/><path d="M38 22h19v24H38Z" fill="none" stroke="#f7dca5" stroke-width="2"/></g>`);
}
function broomSVG(){
 return svg(100,38,`<path d="M18 24h71" stroke="#25273a44" stroke-width="7" stroke-linecap="round"/><path d="M20 19H94" stroke="#805435" stroke-width="5" stroke-linecap="round"/><path d="M26 17h66" stroke="#d7ac6a" stroke-width="2"/><path d="M32 12Q17 2 3 7L7 15 1 20 7 24 3 30Q18 35 32 25Z" fill="#e0c98a" stroke="#96825d" stroke-width="1.5"/><path d="M30 15 8 10M30 18 5 18M30 21 8 26M27 23 13 29" stroke="#fff3ca" stroke-width="1.5"/><path d="M31 12v14M35 14v10" stroke="#a17b4b" stroke-width="2.5"/>`);
}
function assetSVG(kind,color){
 return kind==='tree'?treeSVG():kind==='golden'?treeSVG(true):kind==='tent'?tentSVG(color):kind==='roof'?roofSVG(color):kind==='cashier'?cashierSVG(color):kind==='register'?registerSVG():kind==='cart'?cartSVG(color):kind==='horse'?horseSVG(color):kind==='broom'?broomSVG():'';
}
function sprite(g,kind,color,x,y,w,h,angle=0){
 const img=imageFor(kind+'/'+safeColor(color),()=>assetSVG(kind,color));
 g.save();g.translate(x,y);if(angle)g.rotate(angle);
 if(ready(img))g.drawImage(img,-w/2,-h/2,w,h);
 else oval(g,0,0,w*.32,h*.32,kind==='tree'?'#639d40':kind==='golden'?'#ad812e':safeColor(color));
 g.restore();
}
function product(g,id,x,y,size,angle=0){
 const img=imageFor('product/'+id,()=>productSVG(id));
 g.save();g.translate(x,y);g.rotate(angle);
 oval(g,1,4,size*.33,size*.2,'#222c3545');
 if(ready(img))g.drawImage(img,-size/2,-size/2,size,size);
 else oval(g,0,0,size*.28,size*.28,id==='bomb'?'#c44943':'#f0cf62');g.restore();
}
function preload(mode,s){
 const add=(kind,color)=>imageFor(kind+'/'+safeColor(color),()=>assetSVG(kind,color));
 add(mode==='witch'?'golden':'tree');
 if(mode==='shopping'){
  add('register');for(const c of s.checkouts)add('cashier',c.color);
  for(const p of s.roster)add('cart',p.color);
  for(const id of productIds)imageFor('product/'+id,()=>productSVG(id));
 }
 if(mode==='knight'){for(const p of s.roster)add('horse',p.color);}
 if(mode==='witch')add('broom');
 if(mode!=='shopping')for(const c of ['#edc934','#32b9e6','#e34c44','#63c83f'])add(mode==='knight'?'tent':'roof',c);
}
function grass(g,dark=false){
 const fill=g.createLinearGradient(0,0,960,540);
 fill.addColorStop(0,dark?'#303b55':'#85b937');fill.addColorStop(1,dark?'#1c2943':'#a7cb42');
 g.fillStyle=fill;g.fillRect(0,0,960,540);
 for(let i=0;i<190;i++){
  const x=noise(i)*960,y=noise(i+600)*540;
  oval(g,x,y,4+noise(i+100)*9,2+noise(i+300)*4,dark?'#64759016':'#dbed7938');
 }
}
function cache(g,s,kind,paint){
 const tr=g.getTransform?.(),density=tr?Math.max(Math.hypot(tr.a,tr.b),Math.hypot(tr.c,tr.d)):1;
 const w=s.world?.w||s.w,h=s.world?.h||s.h;
 const ratio=density>1.25&&w*h*4<=3000000?2:1;
 const complete=[...images.values()].every(ready),key=kind+'/'+ratio+'/'+complete;
 let entry=backdrops.get(s);
 if(!entry||entry.key!==key){
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w*ratio,h*ratio):typeof document!=='undefined'?document.createElement('canvas'):null;
  const ctx=canvas?.getContext?.('2d');
  if(ctx){canvas.width=w*ratio;canvas.height=h*ratio;ctx.scale(ratio,ratio);paint(ctx,s);entry={canvas,key};backdrops.set(s,entry);}
  else{paint(g,s);return;}
 }
 g.drawImage(entry.canvas,0,0,w,h);
}
// Shared on-canvas HUD baseline: clear of the iPad roster and host safe area.
// Reused by every minigame, regardless of whether it draws its own scene.
const HUD_BADGE_DROP=45;
function clock(g,value,accent='#e8d2a1'){
 g.save();g.translate(0,HUD_BADGE_DROP);g.lineWidth=1.5;box(g,450,5,60,25,5,'#25323ce8',accent);
 g.strokeStyle='#fff7dc';g.lineWidth=1.4;g.beginPath();g.arc(463,17.5,6,0,TAU);g.stroke();
 line(g,463,13,463,17.5,'#fff7dc',1.4);line(g,463,17.5,467,20,'#fff7dc',1.4);
 g.font='800 17px system-ui';g.textAlign='center';g.fillStyle='#fff8e9';g.fillText(String(Math.ceil(value)),490,23);g.restore();
}
/* Embedded SVG asset, reused for all player-count badges across minigames. */
const personIconSVG=()=>svg(24,24,
 '<circle cx="12" cy="6.5" r="3.8" fill="#fff7dc"/><path d="M3.1 21v-1.3c0-4.5 3.8-7.1 8.9-7.1s8.9 2.6 8.9 7.1V21Z" fill="#fff7dc"/>');
/* Shared headcount badge for survival modes without a countdown clock. */
function playerCount(g,value){
 g.save();g.translate(0,HUD_BADGE_DROP);
 g.lineWidth=1.5;box(g,450,5,60,25,5,'#25323ce8','#e8d2a1');
 g.strokeStyle='#fff7dc';g.fillStyle='#fff7dc';g.lineWidth=1.2;
 // Rasterized by the canvas browser engine from a real, cached SVG asset.
 const icon=imageFor('hud:player-count',personIconSVG);
 if(ready(icon))g.drawImage(icon,454,7,18,19);
 else{
  // First paint while SVG decodes: visually identical vector fallback.
  g.beginPath();g.arc(463,12.8,3.4,0,TAU);g.fill();
  g.beginPath();g.moveTo(456,23);g.lineTo(456,21);g.quadraticCurveTo(456,16,463,16);
  g.quadraticCurveTo(470,16,470,21);g.lineTo(470,23);g.closePath();g.fill();
 }
 g.font='800 17px system-ui';g.textAlign='center';
 g.fillText(String(Math.max(0,Math.floor(Number(value)||0))),490,23);
 g.restore();
}
// Scene painters below use 960x540 design coordinates, with world geometry
// explicitly normalized. Static and interactive boundaries are the same data.
function paintShopping(g,s){
 const u=s.unit,b=s.arena,left=b.x/u,right=(b.x+b.w)/u;
 g.save();g.scale(u,u);grass(g);
 for(const x of [left-112,right+112])for(const y of [70,270,470])sprite(g,'tree',null,x,y,158,158);
 box(g,left-62,22,right-left+124,498,3,'#47723755');
 box(g,left-58,20,right-left+116,500,2,'#f1e3ba','#bdba94');
 for(let side=0;side<2;side++){
  const from=side?480:left,to=side?right:480;
  g.fillStyle=side?'#9db9dc':'#eac8ae';g.fillRect(from,34,to-from,472);
  for(let row=0,y=34;y<506;y+=32,row++)for(let col=0,x=from;x<to;x+=32,col++){
   g.fillStyle=(row+col)%2?(side?'#b7cae6':'#f4d8bc'):(side?'#91acd5':'#e5bba0');
   g.fillRect(x,y,Math.min(32,to-x),Math.min(32,506-y));
  }
  const edge=side?right:left,stripX=side?edge:edge-40,color=side?'#336db6':'#c33756';
  // Continuous raised shopfront defines the physical walking boundary.
  g.fillStyle=shade(color,-28);g.fillRect(stripX,34,40,472);
  for(let y=38;y<500;y+=31){g.fillStyle=color;g.fillRect(stripX+3,y,34,27);line(g,stripX+4,y+2,stripX+35,y+2,shade(color,25),2);}
  line(g,edge,34,edge,506,'#ffefc5',3);
  const railX=side?edge+45:edge-45;
  for(const y of [102,434]){
   box(g,railX-13,y-32,26,64,7,'#75543d','#b6a173');
   for(let i=0;i<6;i++)oval(g,railX+(i%2?5:-5),y-23+i*9,9,8,['#438345','#79ad48','#c4c053'][i%3]);
  }
 }
 for(const z of s.checkouts){
  const r=z.counter,side=z.side==='left'?-1:1,edge=side<0?left:right;
  box(g,r.x/u+4,r.y/u+6,r.w/u,r.h/u,10,'#29384c55');
  box(g,r.x/u,r.y/u,r.w/u,r.h/u,9,z.color,'#fff9de');
  box(g,r.x/u+5,r.y/u+6,r.w/u-10,r.h/u-12,7,'#242b49');
  box(g,z.x/u-z.halfW/u,z.y/u-z.halfH/u,z.halfW/u*2,z.halfH/u*2,2,side<0?'#ecd445':'#62b747');
  oval(g,z.x/u,z.y/u,17,17,side<0?'#d5b62b':'#47a84b');
  g.save();g.translate(z.x/u,z.y/u);g.rotate(side*Math.PI/2);
  g.strokeStyle='#ffffff88';g.lineWidth=3;g.beginPath();g.arc(0,0,8,-.8,3.9);g.stroke();line(g,0,-12,0,12,'#ffffff88',2);g.restore();
  // Wooden service bench and cashier face toward the accessible payment mat.
  const benchX=edge+side*69;box(g,benchX-12,173,24,194,3,'#774c35','#bb8150');
  for(let x=benchX-9;x<=benchX+9;x+=6)line(g,x,177,x,363,'#d89450',3);
  sprite(g,'cashier',z.color,z.cashier.x/u,z.cashier.y/u,53,53,side<0?-Math.PI/2:Math.PI/2);
  sprite(g,'register',null,(r.x+r.w/2)/u,(r.y+r.h*.57)/u,31,39,side<0?0:Math.PI);
 }
 const beltX=s.beltLeft/u,beltW=(s.beltRight-s.beltLeft)/u;
 box(g,beltX-7,26,beltW+14,488,2,'#665d53','#9c8b58');
 for(const lane of s.lanes){
  g.fillStyle=lane.id%2?'#3e405b':'#474a64';g.fillRect((lane.x-lane.width/2)/u,34,lane.width/u,472);
  line(g,(lane.x-lane.width/2)/u,34,(lane.x-lane.width/2)/u,506,'#898269',2);
 }
 for(const y of [19,506]){
  box(g,beltX-8,y,beltW+16,15,3,'#bb8c29','#6e5734');
  const gold=g.createLinearGradient(beltX,y,beltX,y+15);gold.addColorStop(0,'#ffe68b');gold.addColorStop(.5,'#d9b239');gold.addColorStop(1,'#a47b22');
  g.fillStyle=gold;g.fillRect(beltX-5,y+1,beltW+10,12);
  for(let i=0;i<=4;i++)box(g,beltX+i*beltW/4-4,y,8,15,2,'#80745b');
 }
 g.restore();
}
function shopping(g,s){
 cache(g,s,'shopping',paintShopping);const u=s.unit;
 for(const l of s.lanes){
  const offset=(s.clock*s.metrics.conveyorSpeed)%(72*u);
  for(let y=s.beltTop-72*u;y<s.beltBottom+72*u;y+=72*u){
   const at=y+l.dir*offset;if(at<s.beltTop+12*u||at>s.beltBottom-12*u)continue;
   g.beginPath();g.moveTo(l.x-8*u,at-l.dir*3*u);g.lineTo(l.x,at+l.dir*3*u);g.lineTo(l.x+8*u,at-l.dir*3*u);
   g.strokeStyle='#bec1cd36';g.lineWidth=3*u;g.stroke();
  }
 }
 g.save();g.beginPath();g.rect(s.beltLeft,s.beltTop,s.beltRight-s.beltLeft,s.beltBottom-s.beltTop);g.clip();
 for(const o of s.objects)if(o.active)product(g,o.type,o.x,o.y,(o.kind==='bomb'?41:38)*u,Math.sin(o.phase+o.y*.008)*.18);
 g.restore();
}
function shoppingCart(g,s,p){
 const q=p.shopping,u=s.unit;
 // SVG basket center (32,28) coincides with the authoritative cart hit circle.
 const img=imageFor('cart/'+safeColor(p.color),()=>cartSVG(p.color));
 g.save();g.translate(q.cartX,q.cartY);g.rotate(q.angle+Math.PI/2);
 if(ready(img))g.drawImage(img,-28*u,-24.5*u,56*u,66.5*u);
 else box(g,-17*u,-17*u,34*u,34*u,3*u,p.color,'#e2eff2');
 const slots=[[-8,-8],[8,-8],[-8,6],[8,6],[0,-1]];
 q.basket.forEach((id,i)=>{const pt=slots[i];if(pt)product(g,id,pt[0]*u,pt[1]*u,18*u,(i%2?1:-1)*.25);});
 for(let i=0;i<5;i++)oval(g,(-10+i*5)*u,19*u,1.5*u,1.5*u,i<q.basket.length?'#fff2b4':'#33455099');
 g.restore();
}
function paintKnight(g,s){
 const u=s.world.w/960,c={x:s.center.x/u,y:s.center.y/u},r=s.radius/u;
 g.save();g.scale(u,u);grass(g);
 for(const [x,y,size] of [[112,77,177],[838,67,177],[138,532,181],[853,457,187]])sprite(g,'tree',null,x,y,size,size);
 oval(g,c.x+4,c.y+9,r+13,r+13,'#4a612848');
 oval(g,c.x,c.y,r+12,r+12,'#739638');oval(g,c.x,c.y,r+5,r+5,'#775131');
 const dirt=g.createRadialGradient(c.x-r*.25,c.y-r*.3,10,c.x,c.y,r*1.15);
 dirt.addColorStop(0,'#bf945f');dirt.addColorStop(.6,'#b98a55');dirt.addColorStop(1,'#a97547');
 oval(g,c.x,c.y,r,r,dirt);
 g.save();g.beginPath();g.arc(c.x,c.y,r-1,0,TAU);g.clip();
 for(let i=0;i<210;i++){
  const a=noise(i)*TAU,d=Math.sqrt(noise(i+300))*r,x=c.x+Math.cos(a)*d,y=c.y+Math.sin(a)*d;
  if(i<24){
   oval(g,x,y,12+noise(i+90)*22,6+noise(i+700)*12,'#8e9e3d35');
   for(let k=0;k<4;k++)line(g,x+k*5-8,y+2,x+k*5-7,y-3,'#96ae4650',2);
  }else if(i<90){
   g.strokeStyle='#80582e24';g.lineWidth=1;g.beginPath();g.moveTo(x-7,y);g.lineTo(x-4,y-5);g.lineTo(x+4,y-5);g.lineTo(x+8,y+2);g.stroke();
  }else oval(g,x,y,1+noise(i+9)*2,1,'#f4c78d35');
 }
 g.restore();
 // Every timber rail follows the same circular edge used by the engine.
 for(let i=0;i<40;i++){
  const a=i*TAU/40,b=(i+1)*TAU/40,rad=r+5;
  const x1=c.x+Math.cos(a)*rad,y1=c.y+Math.sin(a)*rad,x2=c.x+Math.cos(b)*rad,y2=c.y+Math.sin(b)*rad;
  line(g,x1+2,y1+5,x2+2,y2+5,'#57472d66',7);
  line(g,x1,y1,x2,y2,'#705035',7);line(g,x1,y1-2,x2,y2-2,'#c19356',2.5);
  if(i%2===0){box(g,x1-3,y1-7,6,12,1,'#785332','#c49a61');}
  if(i%5===0)for(let k=0;k<3;k++)oval(g,x1+k*3-3,y1+k*3,4,2.8,'#6d953b');
 }
 // Four sloping tournament canopies are outside the collision circle.
 const corners=[[-3*Math.PI/4,'#edc934'],[-Math.PI/4,'#32b9e6'],[3*Math.PI/4,'#e34c44'],[Math.PI/4,'#63c83f']];
 for(const [angle,color] of corners){
  const distance=r+64;
  sprite(g,'tent',color,c.x+Math.cos(angle)*distance,c.y+Math.sin(angle)*distance,130,111,angle+Math.PI/2);
 }
 // Hay bales, practice target, supply crate and a brazier live beyond the rail.
 g.save();g.translate(c.x-r-64,c.y-70);g.rotate(.4);
 box(g,-29,-20,58,40,3,'#b2863c','#7a6138');box(g,-27,-21,54,35,3,'#e0bd69','#edd48e');
 for(let i=0;i<8;i++)line(g,-24+i*7,-17,-23+i*7,10,'#f6d889',1.5);
 line(g,-12,-21,-12,17,'#90713e',3);line(g,13,-21,13,17,'#90713e',3);g.restore();
 g.save();g.translate(c.x-r-61,c.y-3);g.rotate(.28);
 line(g,0,-27,0,37,'#705036',7);oval(g,0,-3,20,31,'#be4c37');oval(g,0,-4,16,26,'#f1d39c');oval(g,0,-4,10,18,'#ce543d');oval(g,0,-4,5,9,'#efd59d');g.restore();
 g.save();g.translate(c.x-r-125,c.y+104);g.rotate(-.15);
 box(g,-27,-21,54,42,2,'#815438','#533b2e');
 for(let i=0;i<5;i++)line(g,-23+i*11,-19,-23+i*11,19,'#b5804c',2);
 line(g,-23,-18,23,18,'#c09a62',5);line(g,-23,18,23,-18,'#69452e',4);g.restore();
 const bx=c.x+r+74,by=c.y-5;
 for(let i=0;i<7;i++)oval(g,bx+Math.cos(i*TAU/7)*25,by+Math.sin(i*TAU/7)*23,7,6,'#747a6c');
 oval(g,bx+3,by+7,25,30,'#4d503c44');oval(g,bx,by,22,27,'#775036');oval(g,bx,by-8,23,21,'#a47c52');oval(g,bx,by-10,18,16,'#3f4546');
 for(let i=0;i<3;i++)oval(g,bx+(i-1)*10,by-13+(i%2)*6,7,6,'#a2b5ae');
 g.fillStyle='#f4b84d';g.beginPath();g.moveTo(bx-14,by+16);g.quadraticCurveTo(bx-19,by+4,bx-5,by+2);g.quadraticCurveTo(bx,by-8,bx+8,by+4);g.quadraticCurveTo(bx+20,by+8,bx+12,by+18);g.closePath();g.fill();
 g.restore();
}
function knight(g,s){cache(g,s,'knight',paintKnight);}
function knightHorse(g,s,p,riderScale,extension){
 const q=p.km;
 g.save();g.translate(p.x,p.y);g.rotate(q.angle);g.scale(riderScale,riderScale);
 const stride=Math.sin(s.clock*13+String(p.id).length)*3;
 for(const x of [-13,15])for(const y of [-14,14])oval(g,x+(x<0?-stride:stride),y,8,4.5,'#684631');
 const img=imageFor('horse/'+safeColor(p.color),()=>horseSVG(p.color));
 if(ready(img))g.drawImage(img,-53,-37.5,118,75);
 else oval(g,0,0,27,17,'#ac774f');
 // These local tip coordinates are also used by KnightMatch.lanceTip.
 line(g,2,13,45+extension,13,'#e2c896',5);
 for(let i=0;i<5;i++)line(g,10+i*8+extension*.75,10,15+i*8+extension*.75,16,i%2?p.color:'#fff8dc',3);
 g.fillStyle='#e9f3ed';g.strokeStyle='#9cafa8';g.lineWidth=.8;
 g.beginPath();g.moveTo(45+extension,7);g.lineTo(59+extension,13);g.lineTo(45+extension,19);g.closePath();g.fill();g.stroke();g.restore();
 // A readable overhead rider replaces the former tiny silver dot. The horse,
 // lance reach and swept tip remain in their original authoritative scale.
 if(window.PartyCharacters?.draw)window.PartyCharacters.draw(g,p,{time:s.clock,scale:1.15,label:false,holding:true,combat:false});
 else oval(g,p.x,p.y,19,19,p.color);
 if(q.stun>0)for(let i=0;i<3;i++){const a=s.clock*6+i*TAU/3;oval(g,p.x+Math.cos(a)*23,p.y-25+Math.sin(a)*6,3.5,3.5,'#ffe99b');}
}
function trace(g,points){g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();}
function paintWitch(g,s){
 const u=s.w/960,poly=s.boundary.map(p=>({x:p.x/u,y:p.y/u})),rx=s.rx/u,ry=s.ry/u;
 g.save();g.scale(u,u);grass(g,true);
 for(const x of [480-rx-105,480+rx+105])for(const [y,size] of [[168,192],[381,184]])sprite(g,'golden',null,x,y,size,size);
 const corners=[[-1,-1,'#edc934'],[1,-1,'#32b9e6'],[-1,1,'#e34c44'],[1,1,'#63c83f']];
 for(const [dx,dy,color] of corners){
  const x=480+dx*(rx*.78+30),y=270+dy*(ry*.83+26);
  sprite(g,'roof',color,x,y,175,135,-dx*dy*.39);
  for(let i=0;i<5;i++)oval(g,x-dx*54+i*7,y-dy*40+i*4,5,4,'#6e9c4966');
 }
 trace(g,poly);g.strokeStyle='#0f1729';g.lineWidth=21;g.stroke();
 const floor=g.createLinearGradient(200,40,750,510);floor.addColorStop(0,'#414f7f');floor.addColorStop(.55,'#3d4976');floor.addColorStop(1,'#34416b');
 trace(g,poly);g.fillStyle=floor;g.fill();
 g.save();trace(g,poly);g.clip();
 const patches=[[480-rx*.57,270-ry*.42],[480+rx*.13,270-ry*.48],[480-rx*.48,270+ry*.5],[480+rx*.4,270+ry*.46]];
 for(const [i,pt] of patches.entries())for(let row=0;row<4;row++)for(let col=0;col<4;col++){
  const x=pt[0]+col*24-42+(row%2?5:0),y=pt[1]+row*24-36;
  if((row*3+col+i)%7===0)continue;
  box(g,x,y,22,21,2,(row+col)%3===0?'#657f9d25':'#233a562d');
 }
 for(let i=0;i<70;i++)oval(g,480+(noise(i)-.5)*rx*2,270+(noise(i+211)-.5)*ry*2,1.8,1.1,'#9fb2c21a');
 g.restore();
 // The inside of this rail is exactly the same polygon as fatal collision.
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],dx=b.x-a.x,dy=b.y-a.y,n=Math.ceil(Math.hypot(dx,dy)/43);
  line(g,a.x,a.y+4,b.x,b.y+4,'#142136aa',16);
  line(g,a.x,a.y,b.x,b.y,'#444f5d',13);line(g,a.x,a.y,b.x,b.y,'#8a8e81',9);
  line(g,a.x,a.y,b.x,b.y,'#914765',6);line(g,a.x,a.y,b.x,b.y,'#ef7a79',3.7);line(g,a.x,a.y,b.x,b.y,'#ffd784',1.2);
  for(let j=0;j<n;j++){
   const x=a.x+dx*j/n,y=a.y+dy*j/n;
   g.save();g.translate(x,y);g.rotate(Math.atan2(dy,dx));
   box(g,-5,-9,10,18,2,'#455364','#182c41');box(g,-3,-7,6,13,1,'#818d91');line(g,-2,-6,2,-6,'#bbcac3',1.5);g.restore();
  }
 }
 for(const p of poly){oval(g,p.x+1,p.y+2,8,8,'#283a50');oval(g,p.x,p.y-1,6,6,'#a4b9b6');oval(g,p.x-2,p.y-3,2.4,2.4,'#e8ecce');}
 g.restore();
}
function witch(g,s){cache(g,s,'witch',paintWitch);}
function witchRider(g,s,p,time){
 const q=p.ws;if(!q.alive&&q.fade<=0)return;
 g.save();g.globalAlpha=q.alive?1:q.fade/.95;
 oval(g,p.x+3,p.y+8,17,10,'#15213c66');
 sprite(g,'broom',null,p.x-7*Math.cos(q.heading),p.y-7*Math.sin(q.heading),59,22,q.heading);
 if(window.PartyCharacters?.draw)window.PartyCharacters.draw(g,p,{time,scale:.76,label:false,holding:true,combat:false});
 else oval(g,p.x,p.y,12,12,p.color);
 g.restore();
}
window.PartyArenaScenes=Object.freeze({preload,shopping,shoppingCart,knight,knightHorse,witch,witchRider,clock,playerCount,product,productSVG,productIds,assetSVG,
 treeSVG,tentSVG,roofSVG,horseSVG,broomSVG,cache,grass,sprite,oval,box,line,noise});
})();
