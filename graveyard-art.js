(function graveyardArt(){
  'use strict';
  // Canvas scenes consume cached SVG images; sprites are not rebuilt per frame.
  // Graveyard retains its established SVG sprites. Egyptian props are entirely
  // separate so gameplay and the game's selection cover never change.
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
  // A distinctly Egyptian flying spirit: nemes crown, gold uraeus cobra,
  // spectral mummy wraps, lapis/gold collar and animated floating shroud.
  // Unlike cemetery spirits, the player's individual tint stays visible.
  function pharaohGhostSVG(color,pose='float0'){
    const wave=pose==='float1'?5:pose==='float2'?-5:0;
    const hover=pose==='float1'?-2:pose==='float2'?2:0;
    return svg(`
      <defs>
        <linearGradient id="phantom" x1="0" y1="0" x2=".7" y2="1">
          <stop offset="0" stop-color="#f9f4cb"/>
          <stop offset=".52" stop-color="${color}"/>
          <stop offset="1" stop-color="#2d6677"/>
        </linearGradient>
        <linearGradient id="nemes" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#277db7"/>
          <stop offset=".5" stop-color="#143b77"/>
          <stop offset="1" stop-color="#08294c"/>
        </linearGradient>
        <linearGradient id="gold" x1="0" y1="0" x2=".8" y2="1">
          <stop offset="0" stop-color="#fff0a8"/>
          <stop offset=".6" stop-color="#ecc45e"/>
          <stop offset="1" stop-color="#9c6b29"/>
        </linearGradient>
      </defs>
      <g data-actor="pharaoh-ghost">
        <ellipse cx="50" cy="94" rx="24" ry="4.5" fill="#122533" opacity=".28"/>
        <path d="M50 22 C26 19 22 38 23 57 L20 76
          Q18 ${86+wave} 30 79 Q38 ${91-wave} 44 82
          Q50 94 56 82 Q64 ${91+wave} 71 79
          Q82 ${86-wave} 80 75 L77 53 C76 35 67 22 50 22Z"
          fill="url(#phantom)" stroke="#214555" stroke-width="3.8" stroke-linejoin="round"/>
        <path d="M28 51 Q${13+wave} 55 21 ${69+wave}
          M72 51 Q${87-wave} 55 79 ${69-wave}"
          fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/>
        <path d="M30 65 Q45 69 57 65 M38 73Q50 77 64 71
          M31 81Q42 85 48 83" fill="none" stroke="#f6deb0"
          stroke-width="3" opacity=".65"/>
        <path d="M23 43 L24 25 Q26 10 50 9 Q74 10 76 25 L77 44
          L88 65 L73 61 L64 46 L36 46 L27 61 L12 65Z"
          fill="url(#nemes)" stroke="#dfba5d" stroke-width="3.6"
          stroke-linejoin="round"/>
        <path d="M21 50 L34 47 M16 60L29 56
          M66 47L79 50 M71 56L84 60" stroke="#ffdb72"
          stroke-width="5" stroke-linecap="round"/>
        <path d="M29 25 Q38 16 50 19 Q62 16 71 25
          L69 41 Q63 54 50 55 Q37 54 31 41Z"
          fill="#e5dfbd" stroke="#1a405b" stroke-width="3"/>
        <path d="M31 28 Q37 20 50 23 Q63 20 69 28" fill="none"
          stroke="#ffe6a3" stroke-width="3.5"/>
        <path d="M39 34 L45 34 M55 34 L61 34"
          stroke="#163c54" stroke-width="4" stroke-linecap="round"/>
        <circle cx="42" cy="${35+hover}" r="2.8" fill="#42ffdb"/>
        <circle cx="58" cy="${35+hover}" r="2.8" fill="#42ffdb"/>
        <path d="M47 43 Q50 45 53 43" fill="none"
          stroke="#615343" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M43 48 L50 59 L57 48Z"
          fill="url(#gold)" stroke="#163c54" stroke-width="2"/>
        <path d="M33 54 Q50 67 67 54 M34 60 Q50 72 66 60"
          fill="none" stroke="#f6cd67" stroke-width="3.5"/>
        <path d="M48 13 Q42 7 49 4 Q55 3 56 12
          M50 10 L50 20" fill="none" stroke="#ecca5e"
          stroke-width="4" stroke-linecap="round"/>
        <circle cx="50" cy="13" r="3.5" fill="#55d6c0" stroke="#f9dd87" stroke-width="2"/>
        <path d="M28 73 Q25 68 23 72 M74 72Q76 68 80 73"
          stroke="#fff6c9" stroke-width="2" fill="none" opacity=".55"/>
        <g fill="${color}" opacity=".8">
          <circle cx="12" cy="28" r="2"/>
          <circle cx="87" cy="34" r="2.5"/>
          <circle cx="18" cy="14" r="1.5"/>
        </g>
      </g>
    `);
  }
  function actorSVG(ghost,color,pose='idle',theme='graveyard'){
    color=accent(color);
    if(ghost&&theme==='egypt')return pharaohGhostSVG(color,pose);
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
    if(EGYPT_KINDS.includes(kind))return egyptObstacleSVG(kind,variant);
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
  function egyptObstacleSVG(kind,variant=0){
    const sandstone=['#d6b477','#e5c98c','#bda06f'][variant];
    const highlight=['#ffe5ab','#fff0be','#ecd39b'][variant];
    const shade=['#936d40','#a67e47','#80623e'][variant];
    const ink='#213f4b',gold='#f5cc6a',turquoise='#43bfb6';
    const base='<ellipse cx="50" cy="93" rx="42" ry="5" fill="#281c19" opacity=".38"/>';
    const defs=`<defs><linearGradient id="sand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${highlight}"/>
      <stop offset=".55" stop-color="${sandstone}"/>
      <stop offset="1" stop-color="${shade}"/></linearGradient>
      <linearGradient id="lapis" x1="0" y1="0" x2=".8" y2="1">
      <stop offset="0" stop-color="#57c9bd"/>
      <stop offset=".55" stop-color="#176f92"/>
      <stop offset="1" stop-color="#132f61"/></linearGradient></defs>`;
    const lines=`<path d="M37 60h26m-21 8h16m-22 7h28" stroke="${shade}"
      stroke-width="3" stroke-linecap="round" opacity=".7"/>`;
    if(kind==='sarcophagus')return svg(defs+base+`
      <path d="M34 6 Q50 1 66 6 L79 24 L76 77 L66 91 H34 L24 77 L21 24Z"
       fill="#583a29" stroke="#132d39" stroke-width="4"/>
      <path d="M36 10 Q50 6 64 10 L73 27 L70 75 L63 85 H37 L30 75 L27 27Z"
       fill="url(#sand)" stroke="${gold}" stroke-width="3"/>
      <path d="M33 31 L40 16 L60 16 L67 31 L59 41 H41Z"
       fill="url(#lapis)" stroke="${gold}" stroke-width="2.5"/>
      <ellipse cx="50" cy="31" rx="10" ry="11" fill="#e2bd7b" stroke="#704f33" stroke-width="2"/>
      <path d="M43 30h4m7 0h4m-12 8q4 3 8 0" stroke="${ink}" stroke-width="2"
       fill="none" stroke-linecap="round"/>
      <path d="M37 46l13 7 13-7m-25 15h24m-25 8h24m-18 8h16"
       stroke="${turquoise}" stroke-width="3" fill="none"/>
      <path d="M28 43l7 5m37-5l-7 5" stroke="${gold}" stroke-width="4"/>
      `);
    if(kind==='egypt-obelisk')return svg(defs+base+`
      <path d="M50 5 L70 29 L67 83 H33 L30 29Z"
        fill="url(#sand)" stroke="${ink}" stroke-width="4"/>
      <path d="M50 5 V83 H67 L70 29Z" fill="${shade}" opacity=".27"/>
      <path d="M41 37h18M41 48h18M41 59h18M45 69h10"
        stroke="${ink}" stroke-width="2.5" opacity=".65"/>
      <circle cx="50" cy="24" r="4" fill="${turquoise}" stroke="${gold}" stroke-width="2"/>
      <path d="M25 83h50v10H25z" fill="${shade}" stroke="${ink}" stroke-width="3"/>
      `);
    if(kind==='ankh-stele')return svg(defs+base+`
      <path d="M21 85 V31 Q22 11 50 9 Q78 11 79 31 V85Z"
        fill="url(#sand)" stroke="${ink}" stroke-width="4"/>
      <path d="M29 78 V32Q30 21 50 19Q70 21 71 32V78" fill="none"
        stroke="${highlight}" stroke-width="3"/>
      <ellipse cx="50" cy="39" rx="10" ry="13" fill="none" stroke="${ink}" stroke-width="4"/>
      <path d="M50 51V73M35 59h30" stroke="${ink}" stroke-width="5"
        stroke-linecap="round"/>
      <path d="M26 79h48v10H26z" fill="${shade}" stroke="${ink}" stroke-width="2.5"/>
      `);
    if(kind==='sandstone-pillar')return svg(defs+base+`
      <path d="M25 11h50l8 10H17Z" fill="${shade}" stroke="${ink}" stroke-width="3"/>
      <path d="M31 21h38v61H31Z" fill="url(#sand)" stroke="${ink}" stroke-width="3"/>
      <path d="M39 25v53m11-53v53m11-53v53" stroke="${shade}"
        stroke-width="3" opacity=".55"/>
      <path d="M22 82h56v11H22z" fill="${sandstone}" stroke="${ink}" stroke-width="3"/>
      <path d="M21 12h58v8H21z" fill="${highlight}" stroke="${ink}" stroke-width="3"/>
      <path d="M35 46h30m-30 9h30" stroke="${turquoise}" stroke-width="2.5"/>
      `);
    if(kind==='canopic-jar')return svg(defs+base+`
      <path d="M29 34L26 68Q28 86 50 87Q72 86 74 68L71 34Z"
        fill="url(#sand)" stroke="${ink}" stroke-width="4"/>
      <path d="M29 37h42v9H29Z" fill="url(#lapis)" stroke="${gold}" stroke-width="2"/>
      <path d="M34 25Q34 10 50 11Q66 10 66 25L75 35Q50 40 25 35Z"
        fill="url(#sand)" stroke="${ink}" stroke-width="3"/>
      <path d="M43 25h5m7 0h5" stroke="${ink}" stroke-width="3"/>
      <path d="M34 56h32m-27 10h22" stroke="${turquoise}" stroke-width="3"/>
      `);
    if(kind==='pharaoh-bust')return svg(defs+base+`
      <path d="M20 86l7-35 23-13 23 13 7 35Z" fill="url(#sand)"
        stroke="${ink}" stroke-width="3.5"/>
      <path d="M27 27l12-15 22 0 12 15 8 31-18-5-13-12-13 12-18 5Z"
        fill="url(#lapis)" stroke="${gold}" stroke-width="3"/>
      <path d="M40 25Q50 19 60 25L61 48L50 59L39 48Z"
        fill="#e1b66e" stroke="${ink}" stroke-width="2"/>
      <path d="M42 39h5m7 0h5m-12 9h7" stroke="${ink}" stroke-width="2.5"/>
      <path d="M50 10v13" stroke="${gold}" stroke-width="5"/>
      <path d="M26 65h48M27 76h46" stroke="${turquoise}" stroke-width="3"/>
      <path d="M15 85h70v9H15Z" fill="${shade}" stroke="${ink}" stroke-width="3"/>
      `);
    if(kind==='scarab-marker')return svg(defs+base+`
      <path d="M22 20L78 20L83 82H17Z" fill="url(#sand)"
        stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
      <ellipse cx="50" cy="51" rx="13" ry="18" fill="url(#lapis)"
        stroke="${gold}" stroke-width="3"/>
      <path d="M50 34v35M37 49l-13-10m13 19l-14 8m40-17l13-10m-13 19l14 8"
        stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="50" cy="33" r="7" fill="${turquoise}" stroke="${gold}" stroke-width="2"/>
      <path d="M18 82h64v11H18z" fill="${shade}" stroke="${ink}" stroke-width="3"/>
      `);
    return svg(defs+base+`
      <path d="M30 36l10-23 35 4-5 67H30Z" fill="url(#sand)"
        stroke="${ink}" stroke-width="4"/>
      <path d="M23 65l20-14 20 9-10 24H25Z" fill="${sandstone}"
        stroke="${ink}" stroke-width="3"/>
      <path d="M45 26l11 12-8 14m13 16l-9 9" fill="none"
        stroke="${shade}" stroke-width="3"/>
      ${lines}
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
  function ready(img){return !!(img&&img.complete&&img.naturalWidth>0);}
  function preload(players=[],theme='graveyard'){
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
    for(const p of players)getActorImage(false,p.color,'idle',theme);
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
  function drawActor(ctx,p,color,isGhost,time,theme='graveyard'){
    const movement=Math.hypot(p.vx||0,p.vy||0);
    const pose=isGhost?`float${Math.floor(time*3.3)%3}`:
      p.attackRemaining>0?'attack':movement>18?
        `walk${Math.floor(time*9)%4}`:'idle';
    const img=getActorImage(isGhost,color,pose,theme);
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
  window.GhostCemeteryArt=Object.freeze({KINDS,THEMES,GRAVEYARD_KINDS,
    EGYPT_KINDS,kindsForTheme,themeLabel,pickTheme,actorSVG,pharaohGhostSVG,obstacleSVG,
    lootSVG,getLootImage,drawLootBox,getActorImage,getObstacleImage,
    drawActor,drawObstacle,preload});
})();
