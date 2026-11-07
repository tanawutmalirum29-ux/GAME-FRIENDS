(function graveyardArt(){
  'use strict';
  // Canvas scenes consume cached SVG images; sprites are not rebuilt per frame.
  // Both prop families use overhead slabs matched to their collision rectangles.
  const GRAVEYARD_KINDS=['headstone','broken','cross','obelisk','coffin','plaque','slab','grave'];
  const EGYPT_KINDS=['sarcophagus','egypt-obelisk','ankh-stele','sandstone-pillar',
    'canopic-jar','pharaoh-bust','scarab-marker','broken-column'];
  const THEMES=Object.freeze({
    graveyard:Object.freeze({label:'สุสานผี',kinds:GRAVEYARD_KINDS}),
    egypt:Object.freeze({label:'อียิปต์ฟาโรห์',kinds:EGYPT_KINDS})
  });
  const KINDS=[...GRAVEYARD_KINDS,...EGYPT_KINDS];
  function kindsForTheme(theme){
    return THEMES[theme]?.kinds||GRAVEYARD_KINDS;
  }
  function themeLabel(theme){
    return THEMES[theme]?.label||THEMES.graveyard.label;
  }
  function pickTheme(previous='',rng=Math.random){
    const pool=Object.keys(THEMES).filter(theme=>theme!==previous);
    const choices=pool.length?pool:Object.keys(THEMES);
    const n=Number(rng());
    return choices[Math.min(choices.length-1,
      Math.max(0,Math.floor((Number.isFinite(n)?n:0)*choices.length)))];
  }
  const imageCache=new Map();
  const accent=value=>/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):'#80dff2';
  function svg(inner){
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>`;
  }
  // Match the overhead camera used for the shared player avatar.
  function topDownSpecterSVG(color,pose='float0',theme='graveyard'){
    color=accent(color);
    const egypt=theme==='egypt',wobble=pose==='float1'?4:pose==='float2'?-4:0;
    const crown=egypt?
      '<path d="M29 46 L22 30 Q32 12 50 13 Q68 12 78 30 L71 46 Q65 24 50 23 Q35 24 29 46Z" fill="url(#nemes)" stroke="#e7c36a" stroke-width="3.8"/>'+
      '<path d="M33 31 L22 38 M67 31 L78 38" stroke="#efc569" stroke-width="4"/>'+
      '<path d="M50 15 L50 30" stroke="#ffe7a0" stroke-width="4"/>'+
      '<circle cx="50" cy="16" r="4" fill="#38f4d2" stroke="#ffe7a0" stroke-width="2"/>':
      '<path d="M36 35 Q50 21 64 35" fill="none" stroke="#ffffff" stroke-width="5" opacity=".62"/>'+
      '<path d="M34 54 Q50 62 66 54" fill="none" stroke="#d6fcff" stroke-width="4" opacity=".5"/>';
    return svg(
      '<defs><radialGradient id="spectralTop">'+
      '<stop stop-color="#f6feff"/><stop offset=".65" stop-color="'+color+'"/>'+
      '<stop offset="1" stop-color="#436d8a"/></radialGradient>'+
      '<linearGradient id="nemes" x1="0" y1="0" x2="1" y2="1">'+
      '<stop stop-color="#267bb6"/><stop offset=".55" stop-color="#163c77"/>'+
      '<stop offset="1" stop-color="#08294c"/></linearGradient></defs>'+
      '<g data-actor="'+(egypt?'pharaoh-ghost':'cemetery-ghost')+'" data-view="top-down">'+
      '<ellipse cx="50" cy="51" rx="29" ry="25" fill="#06182b" opacity=".25"/>'+
      '<path d="M50 '+(22+wobble)+' C69 18 84 31 79 50 Q90 63 77 70 Q64 '+(82+wobble)+
      ' 50 75 Q36 85 23 70 Q10 63 21 50 C16 30 31 18 50 '+(22+wobble)+'Z"'+
      ' fill="url(#spectralTop)" stroke="#1d4158" stroke-width="3.4"/>'+
      '<circle cx="50" cy="44" r="20" fill="'+color+'" stroke="#20435a" stroke-width="3"/>'+
      '<ellipse cx="50" cy="42" rx="13" ry="15" fill="#ffffff" opacity=".18"/>'+
      crown+'<path d="M36 36 Q50 29 64 36" fill="none" stroke="#1e475c" stroke-width="5" stroke-linecap="round"/>'+
      '<ellipse cx="43" cy="35" rx="2.5" ry="3.5" fill="#fff"/><ellipse cx="57" cy="35" rx="2.5" ry="3.5" fill="#fff"/></g>'
    );
  }
  function pharaohGhostSVG(color,pose='float0'){
    return topDownSpecterSVG(color,pose,'egypt');
  }
  function actorSVG(ghost,color,pose='idle',theme='graveyard'){
    color=accent(color);
    if(ghost&&theme==='egypt')return pharaohGhostSVG(color,pose);
    if(ghost)return topDownSpecterSVG(color,pose,'graveyard');
    const sharedPose=pose==='walk0'||pose==='walk1'?'walk':
      pose==='walk2'||pose==='walk3'?'walk2':pose;
    return window.PartyPlayerAvatar.svgFor(color,sharedPose);
  }

  function obstacleSVG(kind,variant=0){
    const n=Math.abs(Math.floor(Number(variant)||0))%3,egypt=EGYPT_KINDS.includes(kind);
    const top=egypt?['#dcb77b','#e8c68b','#cda56c'][n]:['#7d8ca8','#8997ad','#71839e'][n];
    const side=egypt?'#87623e':'#394762',rim=egypt?'#ffe0a0':'#bbc8d9';
    const ink=egypt?'#855a37':'#485575',accent=egypt?'#3a9b9e':'#768f83';
    const coffin=kind==='coffin'||kind==='sarcophagus';
    const round=kind==='sandstone-pillar'||kind==='broken-column'||kind==='canopic-jar';
    const obelisk=kind==='obelisk'||kind==='egypt-obelisk';
    let carving='';
    if(coffin){
      carving=egypt?'<path d="M34 31 Q34 16 50 16 Q66 16 66 31 L62 43 H38Z" fill="#285375" stroke="'+rim+'" stroke-width="2"/>'+
        '<ellipse cx="50" cy="30" rx="8" ry="10" fill="#edcc87"/><path d="M35 50 L65 63 M65 50 L35 63 M38 73 H62" stroke="'+accent+'" stroke-width="5"/>':
        '<path d="M50 28 V67 M36 42 H64" stroke="'+rim+'" stroke-width="5" stroke-linecap="round"/>';
    }else if(kind==='cross'||kind==='ankh-stele'){
      carving=(egypt?'<ellipse cx="50" cy="30" rx="9" ry="11" fill="none" stroke="'+ink+'" stroke-width="4"/>':'')+
        '<path d="M50 40 V72 M34 49 H66" stroke="'+ink+'" stroke-width="6"/>';
    }else if(kind==='scarab-marker'||kind==='pharaoh-bust'){
      carving='<ellipse cx="50" cy="47" rx="13" ry="18" fill="'+accent+'" stroke="'+rim+'" stroke-width="3"/><path d="M50 29 V65 M37 41 L25 33 M63 41 L75 33 M37 54 L25 64 M63 54 L75 64" stroke="'+ink+'" stroke-width="3"/>';
      if(kind==='pharaoh-bust')carving+='<path d="M30 28 L50 15 L70 28" fill="none" stroke="'+rim+'" stroke-width="5"/>';
    }else if(obelisk){
      carving='<path d="M24 73 L50 20 L76 73Z" fill="'+ink+'"/><path d="M50 20 V73 H24Z" fill="'+rim+'" opacity=".8"/>';
    }else if(round){
      carving='<circle cx="50" cy="46" r="23" fill="'+side+'" stroke="'+rim+'" stroke-width="4"/><circle cx="47" cy="42" r="17" fill="'+top+'"/>';
      if(kind==='broken-column')carving+='<path d="M36 28 L53 42 L43 53 L60 64" fill="none" stroke="'+ink+'" stroke-width="4"/>';
      if(kind==='canopic-jar')carving+='<circle cx="47" cy="42" r="9" fill="'+accent+'" stroke="'+rim+'" stroke-width="2"/>';
    }else{
      carving='<path d="M35 46 H65 M39 55 H61 M36 64 H64" stroke="'+ink+'" stroke-width="4" stroke-linecap="round"/>'+
        '<path d="M42 27 Q50 18 58 27 V37 H42Z" fill="'+ink+'"/><path d="M46 28 V31 M54 28 V31" stroke="'+rim+'" stroke-width="2"/>';
    }
    if(kind==='broken')carving+='<path d="M28 13 L42 27 L31 38 L40 48" stroke="'+side+'" stroke-width="3" fill="none"/>';
    const shape=coffin?'M27 7 H73 L88 25 L80 85 H20 L12 25Z':'M13 10 H87 V85 H13Z';
    return svg('<g data-view="top-down" data-prop="'+kind+'" stroke-linejoin="round">'+
      '<path d="'+shape+'" transform="translate(3 6)" fill="'+side+'" stroke="#222d43" stroke-width="5"/>'+
      '<path d="'+shape+'" fill="'+top+'" stroke="#29334b" stroke-width="3"/>'+
      '<path d="M22 76 V23 H78" stroke="'+rim+'" stroke-width="3" fill="none" opacity=".75"/>'+carving+
      (egypt?'':'<path d="M15 73 L23 69 L29 78 M74 12 L81 19" stroke="'+accent+'" stroke-width="4" fill="none"/>')+'</g>');
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
  function getActorImage(ghost,color,pose='idle',theme='graveyard'){
    const safe=accent(color);
    // Human art is shared. Ghost caches must be separated by theme.
    const skin=ghost&&theme==='egypt'?'egypt': 'graveyard';
    const key=`actor/${ghost?'ghost':'human'}/${skin}/${safe}/${pose}`;
    return getImage(key,actorSVG(ghost,safe,pose,skin));
  }
  function getObstacleImage(kind,variant=0){
    const type=KINDS.includes(kind)?kind:'headstone';
    const n=Math.abs(Number(variant)||0)%3;
    return getImage(`grave/${type}/${n}`,obstacleSVG(type,n));
  }

  // Render GY-07 as ONE large overhead coffin, never repeated stone tiles.
  function singleLargeCoffinSVG(){
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 77 133">'+
      '<defs><linearGradient id="lid" x1="0" y1="0" x2="1" y2="1">'+
      '<stop stop-color="#d9e4ee"/><stop offset=".44" stop-color="#8d9db5"/>'+
      '<stop offset="1" stop-color="#526982"/></linearGradient></defs>'+
      '<g data-art="single-large-coffin" data-view="top-down">'+
      '<path d="M23 6 H54 L72 32 L65 119 L12 119 L5 32 Z"'+
      ' transform="translate(1 6)" fill="#18283d" opacity=".78"/>'+
      '<path d="M23 5 H54 L71 30 L64 121 L13 121 L6 30 Z"'+
      ' fill="#455872" stroke="#d8e2ef" stroke-width="3" stroke-linejoin="round"/>'+
      '<path d="M25 12 H52 L64 34 L58 112 L19 112 L13 34 Z"'+
      ' fill="url(#lid)" stroke="#283c57" stroke-width="3"/>'+
      '<path d="M28 19 H49 L57 39 L53 103 L24 103 L20 39 Z"'+
      ' fill="#b5c5d7" opacity=".62" stroke="#f1f5fc" stroke-width="1.8"/>'+
      '<path d="M38.5 31 V90 M24 54 H53" stroke="#304865" stroke-width="10"'+
      ' stroke-linecap="round"/>'+
      '<path d="M38.5 31 V90 M24 54 H53" stroke="#f5f1e0" stroke-width="5"'+
      ' stroke-linecap="round"/>'+
      '<circle cx="17" cy="37" r="2.4" fill="#f2daa2"/>'+
      '<circle cx="60" cy="37" r="2.4" fill="#f2daa2"/>'+
      '<circle cx="25" cy="109" r="2.4" fill="#f2daa2"/>'+
      '<circle cx="52" cy="109" r="2.4" fill="#f2daa2"/>'+
      '</g></svg>';
  }
  // GY-08: six genuinely raised soil mounds, each with a headstone ABOVE
  // (towards the top of the board). Stone, dirt and grass are distinct.
  function burialMoundsSVG(){
    let plots='';
    for(let row=0;row<3;row++)for(let col=0;col<2;col++){
      const x=col===0?29:87,y=42+row*70;
      plots+=
        '<g data-grave-plot="raised-mound" transform="translate('+x+' '+y+')">'+
        '<ellipse cx="0" cy="14" rx="24" ry="29" fill="#172b30" opacity=".5"/>'+
        '<ellipse cx="0" cy="9" rx="23" ry="28" fill="#4c5b3f" stroke="#203c36" stroke-width="2.6"/>'+
        '<ellipse cx="0" cy="4" rx="19" ry="24" fill="#786c4c" stroke="#9da37a" stroke-width="1.5"/>'+
        '<ellipse cx="-4" cy="-2" rx="10" ry="15" fill="#b1a47c" opacity=".62"/>'+
        '<path d="M-12 6 Q-1 15 12 4" stroke="#4a5945" stroke-width="2" fill="none"/>'+
        '<path d="M-13 -26 Q-13 -37 0 -37 Q13 -37 13 -26 V-17 H-13 Z"'+
        ' fill="#9aabb8" stroke="#30445b" stroke-width="2.5"/>'+
        '<path d="M-8 -28 H8 M-7 -23 H7" stroke="#435872" stroke-width="1.8"/>'+
        '<path d="M-14 -17 H14" stroke="#d1dce4" stroke-width="2"/>'+
        '</g>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 116 228">'+
      '<g data-art="burial-mounds" data-view="top-down">'+
      '<rect x="1" y="1" width="114" height="226" rx="5" fill="#394b3e"'+
      ' fill-opacity=".25" stroke="#637b67" stroke-opacity=".55" stroke-width="2"/>'+
      plots+'</g></svg>';
  }
  function specialObstacleSVG(type){
    if(type==='single-large-coffin')return singleLargeCoffinSVG();
    if(type==='burial-mounds')return burialMoundsSVG();
    return null;
  }
  function getSpecialObstacleImage(type){
    const content=specialObstacleSVG(type);
    return content?getImage('grave/special/'+type+'/v1',content):null;
  }
  function ready(img){return !!(img&&img.complete&&img.naturalWidth>0);}
  function preload(players=[],theme='graveyard'){
    if(theme==='graveyard'){
      getSpecialObstacleImage('single-large-coffin');
      getSpecialObstacleImage('burial-mounds');
    }
    for(const kind of kindsForTheme(theme))
      for(let v=0;v<3;v++)getObstacleImage(kind,v);
    getLootImage(theme);
    // Decode all three pharaoh floating frames before countdown ends,
    // including each participant's colored ghost form.
    const ghostColors=['#f5faff',...players.map(p=>p.color)];
    if(theme==='egypt'){
      for(const color of ghostColors)
        for(const pose of ['float0','float1','float2'])
          getActorImage(true,color,pose,theme);
    }else getActorImage(true,'#f5faff','float0',theme);
    window.PartyPlayerAvatar.preload(players);
  }
  function lootSVG(theme='graveyard'){
    if(theme==='egypt')return svg(`
      <defs><linearGradient id="chest" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffdc86"/><stop offset="1" stop-color="#9d6d30"/>
      </linearGradient></defs>
      <path d="M18 23L82 23L89 85L11 85Z" fill="#382c29" stroke="#102b39" stroke-width="7"/>
      <path d="M20 24L80 24L85 80L15 80Z" fill="url(#chest)" stroke="#ffe39a" stroke-width="4"/>
      <path d="M24 37H77M25 64H76" stroke="#13566f" stroke-width="7"/>
      <path d="M50 30V73" stroke="#f7e6b4" stroke-width="4"/>
      <ellipse cx="50" cy="53" rx="10" ry="12" fill="#176f8a" stroke="#ffe6a8" stroke-width="3"/>
      <path d="M43 51L50 59L57 51" stroke="#fff4c9" stroke-width="3" fill="none"/>
      <circle cx="50" cy="49" r="2" fill="#fff4c9"/>
      `);
    return svg(`
      <path d="M18 20H82L88 83H12Z" fill="#5b3d24" stroke="#222a30" stroke-width="6"/>
      <path d="M20 22H80L84 80H16Z" fill="#ad7c44" stroke="#f4d59a" stroke-width="4"/>
      <path d="M22 41H78M46 24V79M24 68H78" stroke="#774c29" stroke-width="6"/>
      <path d="M44 53Q41 45 50 44Q59 45 56 53L51 60V64"
        stroke="#fff1bd" stroke-width="5" stroke-linecap="round" fill="none"/>
      <circle cx="51" cy="73" r="3" fill="#fff1bd"/>
      `);
  }
  function getLootImage(theme='graveyard'){
    const safe=THEMES[theme]?theme:'graveyard';
    return getImage('loot/'+safe,lootSVG(safe));
  }
  function drawLootBox(ctx,box,t,theme='graveyard'){
    const img=getLootImage(theme);
    ctx.save();ctx.translate(box.x,box.y);ctx.rotate(Math.sin(t*2+box.x)*.06);
    ctx.shadowColor=theme==='egypt'?'#f5c86a':'#e9cf84';
    ctx.shadowBlur=12;
    if(ready(img))ctx.drawImage(img,-17,-17,34,34);
    else{
      ctx.fillStyle=theme==='egypt'?'#e1bb6f':'#ae824c';
      ctx.strokeStyle='#fff0bd';ctx.lineWidth=2;
      ctx.fillRect(-14,-14,28,28);ctx.strokeRect(-14,-14,28,28);
      ctx.fillStyle='#173c50';ctx.font='bold 18px system-ui';
      ctx.textAlign='center';ctx.fillText('?',0,6);
    }
    ctx.restore();
  }
  function drawActor(ctx,p,color,isGhost,time,theme='graveyard',scale=1){
    if(!isGhost){window.PartyPlayerAvatar.draw(ctx,p,{time,color,label:false,attacking:p.attackRemaining>0});return;}
    const movement=Math.hypot(p.vx||0,p.vy||0);
    const pose=isGhost?'float'+(Math.floor(time*3.3)%3):
      p.attackRemaining>0?'attack':movement>18?
        'walk'+(Math.floor(time*9)%4):'idle';
    const img=getActorImage(isGhost,color,pose,theme);
    // The sprite is centered on the same (x,y) used by physics.
    const d=p.dir||{x:0,y:-1};
    const angle=Math.hypot(d.x||0,d.y||0)>.001?
      Math.atan2(d.y,d.x)+Math.PI/2:0;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);
    // Display-only size: maintain the original position, collisions and movement.
    ctx.scale(Number.isFinite(scale)&&scale>0?scale:1,Number.isFinite(scale)&&scale>0?scale:1);
    if(ready(img))ctx.drawImage(img,-27,-27,54,54);
    else{
      ctx.fillStyle=color;ctx.strokeStyle='#173d52';ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.arc(0,-7,12,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
    ctx.restore();
  }
  function drawObstacle(ctx,o){
    const kind=KINDS.includes(o.kind)?o.kind:KINDS[Math.abs(o.style||0)%KINDS.length];
    const special=o.artType?getSpecialObstacleImage(o.artType):null;
    const img=special||getObstacleImage(kind,o.variant||0);
    ctx.save();
    if(o.artType&&special){
      // Dedicated artwork spans the same rectangle as the obstacle hitbox.
      // No tiling: GY-07 is one coffin; GY-08 has raised soil and headstones.
      if(ready(img))ctx.drawImage(img,o.x,o.y,o.w,o.h);
      else{
        ctx.fillStyle='#536b73';ctx.fillRect(o.x,o.y,o.w,o.h);
        ctx.strokeStyle='#a8c4cc';ctx.lineWidth=2;
        ctx.strokeRect(o.x+1,o.y+1,o.w-2,o.h-2);
      }
      ctx.restore();return;
    }
    if(o.monumentGroup){
      // Large solid monuments must not look like a single tombstone enlarged
      // to several times its normal proportions. Render tiled stone slabs
      // inside the SAME rectangle used for real collisions and bot routing.
      ctx.fillStyle='#34425e';ctx.fillRect(o.x,o.y+4,o.w,o.h);
      ctx.fillStyle='#687992';ctx.fillRect(o.x,o.y,o.w,o.h-4);
      ctx.lineWidth=3;ctx.strokeStyle='#b8c8d7';ctx.strokeRect(o.x+1.5,o.y+1.5,o.w-3,o.h-6);
      const inset=8,innerW=o.w-2*inset,innerH=o.h-2*inset;
      const cols=Math.max(1,Math.round(innerW/52)),rows=Math.max(1,Math.round(innerH/52));
      const tileW=innerW/cols,tileH=innerH/rows;
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
        const x=o.x+inset+col*tileW,y=o.y+inset+row*tileH;
        if(ready(img))ctx.drawImage(img,x+2,y+2,tileW-4,tileH-4);
        else{ctx.fillStyle='#899bb0';ctx.fillRect(x+3,y+3,tileW-6,tileH-6);}
      }
      ctx.restore();return;
    }
    ctx.fillStyle='#05162280';
    ctx.beginPath();ctx.ellipse(o.x+o.w*.52,o.y+o.h*.55,o.w*.5,o.h*.49,0,0,Math.PI*2);ctx.fill();
    if(ready(img))ctx.drawImage(img,o.x,o.y,o.w,o.h);
    else{
      ctx.fillStyle='#7e929a';ctx.strokeStyle='#1a3442';ctx.lineWidth=3;
      ctx.beginPath();ctx.roundRect(o.x,o.y,o.w,o.h,6);ctx.fill();ctx.stroke();
    }
    if(!EGYPT_KINDS.includes(kind)){
      for(const [x,y] of [[o.x+o.w*.18,o.y+o.h*.2],[o.x+o.w*.82,o.y+o.h*.74]]){
        ctx.shadowColor='#ffc5a4';ctx.shadowBlur=10;
        ctx.fillStyle='#fff4d9';ctx.fillRect(x-1.8,y-1.8,3.6,3.6);
      }
    }
    ctx.restore();
  }
  window.GhostCemeteryArt=Object.freeze({KINDS,THEMES,GRAVEYARD_KINDS,
    EGYPT_KINDS,kindsForTheme,themeLabel,pickTheme,actorSVG,pharaohGhostSVG,obstacleSVG,
    lootSVG,getLootImage,drawLootBox,getActorImage,getObstacleImage,
    specialObstacleSVG,getSpecialObstacleImage,drawActor,drawObstacle,preload});
})();
