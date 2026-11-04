(function graveyardArt(){
  'use strict';
  // Canvas scenes consume cached SVG images; sprites are not rebuilt per frame.
  const KINDS=['headstone','broken','cross','obelisk','coffin','plaque','slab','grave'];
  const imageCache=new Map();
  const accent=value=>/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):'#80dff2';
  function svg(inner){
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>`;
  }
  function actorSVG(ghost,color,pose='idle'){
    color=accent(color);
    if(ghost){
      const drift=pose==='float1'?3:pose==='float2'?-2:0;
      const wave=pose==='float1'?5:pose==='float2'?-4:0;
      return svg(`
        <defs><linearGradient id="specter" x1="0" y1="0" x2=".8" y2="1">
          <stop offset="0" stop-color="#ffffff"/><stop offset=".54" stop-color="${color}"/>
          <stop offset="1" stop-color="#4e7598"/></linearGradient></defs>
        <ellipse cx="50" cy="91" rx="23" ry="4" fill="#09182a" opacity=".28"/>
        <path d="M50 12 C26 12 18 35 18 54 L18 77 Q20 88 29 79
          Q37 ${88+wave} 44 81 Q50 93 57 81 Q68 ${88-wave} 74 81 Q83 87 83 74
          L83 49 C82 27 68 12 50 12 Z"
          fill="url(#specter)" stroke="#233952" stroke-width="3.8" stroke-linejoin="round"/>
        <path d="M23 52 Q10 ${56+wave} 19 69 M79 53 Q91 ${56-wave} 81 69"
          fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/>
        <path d="M27 45 Q32 22 50 22" fill="none" stroke="#ffffff" stroke-width="4" opacity=".52"/>
        <ellipse cx="39" cy="${47+drift}" rx="5.7" ry="7.6" fill="#16263e"/>
        <ellipse cx="62" cy="${47+drift}" rx="5.7" ry="7.6" fill="#16263e"/>
        <circle cx="41" cy="${45+drift}" r="2" fill="#ffffff"/>
        <circle cx="64" cy="${45+drift}" r="2" fill="#ffffff"/>
        <path d="M45 ${64+drift} Q51 ${71+drift} 57 ${64+drift}"
          fill="none" stroke="#22374b" stroke-width="3" stroke-linecap="round"/>
        <g fill="#ffffff" opacity=".65"><circle cx="23" cy="18" r="2"/>
        <circle cx="76" cy="26" r="2.8"/><circle cx="84" cy="16" r="1.5"/></g>
      `);
    }
    const stride=pose==='walk0'?8:pose==='walk1'?4:pose==='walk2'?-7:pose==='walk3'?-3:0;
    const attack=pose==='attack';
    const fistX=attack?91:75-stride*.6;
    const fistY=attack?48:61+stride*.55;
    const otherX=attack?20:25+stride*.6;
    const otherY=attack?57:60-stride*.55;
    return svg(`
      <defs><linearGradient id="jacket" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#26425c"/></linearGradient>
        <linearGradient id="face" x1="0" y1="0" x2=".8" y2="1">
        <stop offset="0" stop-color="#fff0d7"/><stop offset="1" stop-color="#d4ab8d"/></linearGradient></defs>
      <ellipse cx="50" cy="94" rx="24" ry="4" fill="#041523" opacity=".3"/>
      <path d="M42 72 L${38-stride*.6} ${87-stride*.6} L${30-stride*.8} 90"
        stroke="#1c3550" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M58 72 L${62+stride*.6} ${87+stride*.6} L${70+stride*.8} 90"
        stroke="#1c3550" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M${30-stride*.8} 90 l-3 2 M${70+stride*.8} 90 l3 2"
        fill="none" stroke="#b9ddf6" stroke-width="6" stroke-linecap="round"/>
      <path d="M34 45 L${otherX} ${otherY}"
        fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"/>
      <path d="M66 45 L${fistX} ${fistY}"
        fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"/>
      <circle cx="${otherX}" cy="${otherY}" r="6" fill="#f2caaa" stroke="#183348" stroke-width="2"/>
      <circle cx="${fistX}" cy="${fistY}" r="6.4" fill="#f2caaa" stroke="#183348" stroke-width="2"/>
      <path d="M33 42 Q50 35 67 42 L68 75 Q50 84 32 74 Z"
        fill="url(#jacket)" stroke="#14273d" stroke-width="3.6"/>
      <path d="M43 47 L50 57 L57 47" fill="none" stroke="#d9f6ff" stroke-width="2.8" opacity=".75"/>
      <path d="M35 70 Q50 74 65 70" fill="none" stroke="#10293b" stroke-width="3"/>
      <circle cx="50" cy="27" r="20" fill="url(#face)" stroke="#15293d" stroke-width="3.5"/>
      <path d="M31 26 Q30 9 45 10 Q58 3 69 19 L71 29 Q66 21 59 22
        Q48 18 43 25 Q36 23 31 30Z"
        fill="#23394e" stroke="#13283b" stroke-width="2"/>
      <path d="M35 19 Q40 11 50 15" fill="none" stroke="#91bed1" stroke-width="3" opacity=".42"/>
      <circle cx="42" cy="30" r="2.2" fill="#1b2d41"/>
      <circle cx="58" cy="30" r="2.2" fill="#1b2d41"/>
      <path d="M46 37 Q50 40 54 37" fill="none" stroke="#8b655e" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M29 48 Q20 54 24 67" fill="none" stroke="#79aace" stroke-width="3" opacity=".33"/>
    `);
  }
  function obstacleSVG(kind,variant=0){
    variant=Math.abs(Number(variant)||0)%3;
    const stone=['#889cab','#9ca9a9','#7e93a5'][variant];
    const dark=['#465a6b','#566b70','#475669'][variant];
    const edging='#172c3d';
    const moss=variant===1?'#83a98e':'#618b85';
    const base=`<ellipse cx="50" cy="91" rx="43" ry="6" fill="#051a23" opacity=".4"/>`;
    const inscription=`<path d="M39 53 H61 M42 61 H58 M38 69 H62" fill="none"
      stroke="${dark}" stroke-width="3.4" stroke-linecap="round"/>`;
    if(kind==='coffin'){
      return svg(base+`
        <path d="M33 5 L67 5 L88 26 L83 77 L68 91 L32 91 L17 77 L12 26Z"
          fill="#342921" stroke="#101e28" stroke-width="4" stroke-linejoin="round"/>
        <path d="M35 12 L65 12 L80 28 L76 75 L65 83 L35 83 L24 75 L20 28Z"
          fill="${variant===1?'#745644':'#8d6546'}" stroke="#c79e70" stroke-width="3"/>
        <path d="M35 16 L66 16 M27 32 L75 32 M28 72 L73 72"
          stroke="#e0b27a" stroke-width="2" opacity=".55"/>
        <path d="M50 34 V65 M38 46 H62" stroke="#e2c48c" stroke-width="5"
          stroke-linecap="round"/>
        <circle cx="21" cy="41" r="3.5" fill="#b7c3cf"/><circle cx="79" cy="41" r="3.5" fill="#b7c3cf"/>
        <path d="M13 50 L21 50 M79 50 L87 50" stroke="#d3b87d" stroke-width="4"/>
      `);
    }
    if(kind==='cross'){
      return svg(base+`
        <path d="M42 12 H58 V33 H77 V51 H58 V86 H42 V51 H23 V33 H42Z"
          fill="${stone}" stroke="${edging}" stroke-width="4" stroke-linejoin="round"/>
        <path d="M47 18 H53 V39 H70 M47 55 V77" fill="none"
          stroke="#d9e7e4" stroke-width="2.5" opacity=".7"/>
        <path d="M27 85 Q48 77 75 85 L83 93 H17Z"
          fill="${dark}" stroke="${edging}" stroke-width="3"/>
        <path d="M20 86 l-7 -5 m67 3 l8 -7" stroke="${moss}" stroke-width="3"/>
      `);
    }
    if(kind==='obelisk'){
      return svg(base+`
        <path d="M48 7 L69 29 L68 83 H32 L31 29Z"
          fill="${stone}" stroke="${edging}" stroke-width="4"/>
        <path d="M48 7 L48 78 H65 L66 31Z" fill="${dark}" opacity=".32"/>
        <path d="M39 40 H61 M41 51 H59 M40 62 H60"
          stroke="#d2e0e2" stroke-width="2.5" opacity=".7"/>
        <path d="M24 83 H77 V92 H24Z" fill="${dark}" stroke="${edging}" stroke-width="3"/>
        <circle cx="49" cy="34" r="3" fill="${moss}"/>
      `);
    }
    if(kind==='plaque'){
      return svg(base+`
        <path d="M20 33 L80 30 L82 77 L18 80Z"
          fill="#6d503c" stroke="#182934" stroke-width="5" stroke-linejoin="round"/>
        <path d="M24 37 L76 35 L77 72 L23 75Z"
          fill="#ab8662" stroke="#f0d2a2" stroke-width="2"/>
        <path d="M29 45 H71 M35 53 H65 M30 62 H70"
          stroke="#614432" stroke-width="3" stroke-linecap="round"/>
        <circle cx="29" cy="42" r="3" fill="#d2bb8d"/><circle cx="72" cy="42" r="3" fill="#d2bb8d"/>
        <path d="M29 79 V92 M72 78 V92" stroke="#483b32" stroke-width="8" stroke-linecap="round"/>
        <path d="M13 92 q8 -11 18 -5 M71 91 q10 -9 18 0"
          fill="none" stroke="${moss}" stroke-width="4"/>
      `);
    }
    if(kind==='slab'){
      return svg(base+`
        <path d="M10 45 L22 25 H78 L90 45 L83 84 H18Z"
          fill="${dark}" stroke="${edging}" stroke-width="4"/>
        <path d="M17 46 L29 32 H72 L83 46 L77 74 H23Z"
          fill="${stone}" stroke="#d9e5e5" stroke-width="3"/>
        <path d="M36 46 H64 M32 56 H68 M39 65 H61"
          fill="none" stroke="${dark}" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M15 72 l16 -5 M71 72 l15 -5" stroke="${moss}" stroke-width="4"/>
      `);
    }
    if(kind==='broken'){
      return svg(base+`
        <path d="M25 87 V30 Q27 12 48 11 L59 16 L57 29 L71 33 L76 48 V87Z"
          fill="${stone}" stroke="${edging}" stroke-width="4" stroke-linejoin="round"/>
        <path d="M58 15 L51 33 L64 44 L48 54 L53 73" fill="none"
          stroke="${edging}" stroke-width="3" stroke-linejoin="round"/>
        ${inscription}
        <path d="M20 86 Q43 79 80 86 L84 93 H16Z"
          fill="${dark}" stroke="${edging}" stroke-width="3"/>
        <path d="M29 25 L39 19" stroke="#dae5e9" stroke-width="3"/>
      `);
    }
    if(kind==='grave'){
      return svg(base+`
        <path d="M10 81 Q34 56 56 67 Q75 63 91 83 L89 92 H9Z"
          fill="${moss}" stroke="${edging}" stroke-width="4"/>
        <path d="M25 65 V34 Q24 17 40 17 Q60 17 60 35 V66Z"
          fill="${stone}" stroke="${edging}" stroke-width="4"/>
        <path d="M31 43 H53 M35 52 H49" stroke="${dark}" stroke-width="3.5"/>
        <path d="M65 71 l9 -19 m-9 19 l-15 -12" stroke="#8fac84" stroke-width="3"/>
        <circle cx="75" cy="63" r="4" fill="#e1c6af"/>
      `);
    }
    return svg(base+`
      <path d="M21 88 V34 Q23 11 50 11 Q77 11 79 34 V88Z"
        fill="${stone}" stroke="${edging}" stroke-width="4"/>
      <path d="M29 80 V34 Q31 19 50 19 Q69 19 71 34 V80"
        fill="none" stroke="#dceaf0" stroke-width="3" opacity=".65"/>
      ${inscription}
      <path d="M17 86 H83 V93 H17Z" fill="${dark}" stroke="${edging}" stroke-width="3"/>
      <path d="M24 37 Q28 29 39 28" fill="none" stroke="${moss}" stroke-width="5"/>
    `);
  }
  function getImage(key,content){
    if(typeof Image==='undefined')return null;
    if(!imageCache.has(key)){
      const img=new Image();
      img.decoding='async';
      img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(content);
      imageCache.set(key,img);
    }
    return imageCache.get(key);
  }
  function getActorImage(ghost,color,pose='idle'){
    const safe=accent(color);
    const key=`actor/${ghost?'ghost':'human'}/${safe}/${pose}`;
    return getImage(key,actorSVG(ghost,safe,pose));
  }
  function getObstacleImage(kind,variant=0){
    const type=KINDS.includes(kind)?kind:'headstone';
    const n=Math.abs(Number(variant)||0)%3;
    return getImage(`grave/${type}/${n}`,obstacleSVG(type,n));
  }
  function ready(img){return !!(img&&img.complete&&img.naturalWidth>0);}
  function preload(players=[]){
    for(const kind of KINDS)for(let v=0;v<3;v++)getObstacleImage(kind,v);
    getActorImage(true,'#e6f6ff','float0');
    for(const p of players)getActorImage(false,p.color,'idle');
  }
  function drawActor(ctx,p,color,isGhost,time){
    const movement=Math.hypot(p.vx||0,p.vy||0);
    const pose=isGhost?`float${Math.floor(time*3.3)%3}`:
      p.attackRemaining>0?'attack':movement>18?
        `walk${Math.floor(time*9)%4}`:'idle';
    const img=getActorImage(isGhost,color,pose);
    const bob=isGhost?Math.sin(time*3.9+(p.x||0)*.02)*2.5:
      movement>18?Math.abs(Math.sin(time*9))*1.2:0;
    ctx.save();
    ctx.translate(p.x,p.y+bob);
    if((p.dir?.x||0)<-.2)ctx.scale(-1,1);
    if(ready(img))ctx.drawImage(img,-28,-54,56,77);
    else{
      // Visible first frame while an SVG is decoding.
      ctx.fillStyle=color;ctx.strokeStyle='#172f41';ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(0,-20,14,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.roundRect(-11,-7,22,25,8);ctx.fill();ctx.stroke();
    }
    ctx.restore();
  }
  function drawObstacle(ctx,o){
    const kind=KINDS.includes(o.kind)?o.kind:KINDS[Math.abs(o.style||0)%KINDS.length];
    const img=getObstacleImage(kind,o.variant||0);
    ctx.save();
    ctx.fillStyle='#05162280';
    ctx.beginPath();ctx.ellipse(o.x+o.w*.52,o.y+o.h*.91,o.w*.54,Math.max(4,o.h*.16),0,0,Math.PI*2);ctx.fill();
    if(ready(img))ctx.drawImage(img,o.x-5,o.y-7,o.w+10,o.h+15);
    else{
      ctx.fillStyle='#7e929a';ctx.strokeStyle='#1a3442';ctx.lineWidth=3;
      ctx.beginPath();ctx.roundRect(o.x,o.y,o.w,o.h,6);ctx.fill();ctx.stroke();
    }
    ctx.restore();
  }
  window.GhostCemeteryArt=Object.freeze({KINDS,actorSVG,obstacleSVG,
    getActorImage,getObstacleImage,drawActor,drawObstacle,preload});
})();
