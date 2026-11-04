/* GAME-FRIENDS original top-down mini-games. Host is authoritative; controllers only send button states. */
(() => {
  'use strict';
  const MODES = ['tanks','soccer','rally','paint'];
  const W=960,H=540;
  const rand=(a,b)=>a+Math.random()*(b-a);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const hit=(a,b,r)=>Math.hypot(a.x-b.x,a.y-b.y)<r;
  const pressed=(p,k)=>!!(p.input&&p.input[k]);
  const v2=(p)=>{
    let dx=Number(pressed(p,'right'))-Number(pressed(p,'left'));
    let dy=Number(pressed(p,'down'))-Number(pressed(p,'jump'));
    const length=Math.hypot(dx,dy)||1;return {x:dx/length,y:dy/length};
  };
  const active=(players)=>players.filter(p=>p.active);
  const inside=(x,y,rect)=>x>=rect.x&&x<=rect.x+rect.w&&y>=rect.y&&y<=rect.y+rect.h;
  const arena={x:48,y:65,w:864,h:425};
  const tankBlocks=[
    {x:250,y:155,w:90,h:60},{x:620,y:325,w:90,h:60},
    {x:420,y:210,w:120,h:120},{x:155,y:333,w:90,h:55},{x:705,y:155,w:90,h:55}
  ];
  const track={outer:{x:124,y:69,w:712,h:420},inner:{x:278,y:189,w:404,h:180}};
  const raceGates=[
    {x:690,y:230,w:135,h:82},{x:405,y:78,w:140,h:100},
    {x:135,y:230,w:130,h:82},{x:405,y:377,w:140,h:102}
  ];
  function spawn(p,i,count){
    const a=(i/count)*Math.PI*2;
    p.x=480+Math.cos(a)*205;p.y=275+Math.sin(a)*151;
    p.vx=0;p.vy=0;p.hp=3;p.alive=true;p.invulnerable=1;p.cooldown=0;
    p.face=1;p.angle=a+Math.PI;
  }
  function setup(round,players){
    const mode=round.mode;
    round.mini={mode,bullets:[],teamScores:[0,0],ball:{x:480,y:275,vx:0,vy:0},grid:[],pulse:0};
    const ps=active(players);
    ps.forEach((p,i)=>{
      spawn(p,i,Math.max(1,ps.length));p.raceGate=0;p.laps=0;p.paintClock=0;p.raceBoost=0;
      p.team=i%2;
      if(mode==='rally'){
        p.x=380+(i%6)*38;p.y=421+Math.floor(i/6)*24;
        p.angle=0;
      }
    });
    if(mode==='paint')round.mini.grid=Array(20*10).fill(null);
  }
  function movePlayer(p,dt,speed,rect=arena){
    const v=v2(p);const x=p.x,y=p.y;
    p.x=clamp(x+v.x*speed*dt,rect.x+13,rect.x+rect.w-13);
    p.y=clamp(y+v.y*speed*dt,rect.y+13,rect.y+rect.h-13);
    if(v.x||v.y)p.angle=Math.atan2(v.y,v.x);
    return {x,y,v};
  }
  function updateTanks(dt,round,players){
    const m=round.mini;
    const ps=active(players);
    for(const p of ps){
      p.cooldown=Math.max(0,p.cooldown-dt);
      p.invulnerable=Math.max(0,p.invulnerable-dt);
      if(!p.alive){p.respawn-=dt;if(p.respawn<=0){const index=ps.indexOf(p);spawn(p,index,ps.length);}continue;}
      const prev=movePlayer(p,dt,195);
      if(tankBlocks.some(b=>p.x>b.x-19&&p.x<b.x+b.w+19&&p.y>b.y-19&&p.y<b.y+b.h+19)){p.x=prev.x;p.y=prev.y;}
      if(pressed(p,'action')&&p.cooldown<=0){
        p.cooldown=.48;
        m.bullets.push({x:p.x+Math.cos(p.angle)*27,y:p.y+Math.sin(p.angle)*27,
          vx:Math.cos(p.angle)*430,vy:Math.sin(p.angle)*430,owner:p.id,life:1.75});
      }
    }
    for(let i=m.bullets.length-1;i>=0;i--){
      const b=m.bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
      if(b.life<=0||!inside(b.x,b.y,arena)||tankBlocks.some(o=>inside(b.x,b.y,o))){m.bullets.splice(i,1);continue;}
      const victim=ps.find(p=>p.id!==b.owner&&p.alive&&p.invulnerable<=0&&hit(p,b,22));
      if(victim){
        victim.hp--;victim.invulnerable=.72;
        const shooter=ps.find(p=>p.id===b.owner);
        if(shooter)shooter.score+=1;
        if(victim.hp<=0){
          victim.alive=false;victim.respawn=1.7;
          if(shooter)shooter.score+=2;
        }
        m.bullets.splice(i,1);
      }
    }
  }
  function resetSoccer(round,players){
    round.mini.ball={x:480,y:275,vx:0,vy:0};
    const ps=active(players);
    ps.forEach((p,i)=>{
      const team=i%2;
      p.team=team;p.x=team===0?280:680;
      p.y=160+(Math.floor(i/2)+1)*310/(Math.ceil(ps.length/2)+1);
      p.cooldown=0;p.angle=team===0?0:Math.PI;
    });
  }
  function updateSoccer(dt,round,players){
    const m=round.mini,b=m.ball,ps=active(players);
    const field={x:62,y:86,w:836,h:380};
    for(const p of ps){
      p.cooldown=Math.max(0,p.cooldown-dt);
      movePlayer(p,dt,215,field);
      const delta=Math.hypot(b.x-p.x,b.y-p.y);
      if(delta<37&&delta>0.001){
        const ux=(b.x-p.x)/delta,uy=(b.y-p.y)/delta;
        b.x=p.x+ux*37;b.y=p.y+uy*37;
        b.vx+=ux*48;b.vy+=uy*48;
      }
      if(pressed(p,'action')&&p.cooldown<=0){
        p.cooldown=.38;
        if(Math.hypot(b.x-p.x,b.y-p.y)<75){
          const dx=b.x-p.x,dy=b.y-p.y,len=Math.hypot(dx,dy)||1;
          b.vx=dx/len*520;b.vy=dy/len*520;
          p.score+=.15;
        }
      }
    }
    b.x+=b.vx*dt;b.y+=b.vy*dt;
    b.vx*=Math.pow(.974,dt*60);b.vy*=Math.pow(.974,dt*60);
    if(b.y<field.y+13){b.y=field.y+13;b.vy=Math.abs(b.vy)*.83;}
    if(b.y>field.y+field.h-13){b.y=field.y+field.h-13;b.vy=-Math.abs(b.vy)*.83;}
    const goalY=b.y>210&&b.y<330;
    if((b.x<field.x+8||b.x>field.x+field.w-8)&&goalY){
      const scoringTeam=b.x<field.x+8?1:0;
      m.teamScores[scoringTeam]++;
      ps.filter(p=>p.team===scoringTeam).forEach(p=>p.score+=3);
      resetSoccer(round,players);
    }else{
      if(b.x<field.x+12){b.x=field.x+12;b.vx=Math.abs(b.vx)*.8;}
      if(b.x>field.x+field.w-12){b.x=field.x+field.w-12;b.vx=-Math.abs(b.vx)*.8;}
    }
  }
  function onRoad(x,y){
    return inside(x,y,track.outer)&&!inside(x,y,track.inner);
  }
  function updateRally(dt,round,players){
    for(const p of active(players)){
      p.cooldown=Math.max(0,p.cooldown-dt);
      p.raceBoost=Math.max(0,p.raceBoost-dt);
      if(pressed(p,'action')&&p.cooldown<=0){p.raceBoost=.55;p.cooldown=2.2;}
      const dir=v2(p),oldX=p.x,oldY=p.y;
      const speed=(p.raceBoost>0?330:220);
      p.x=clamp(p.x+dir.x*speed*dt,140,820);
      p.y=clamp(p.y+dir.y*speed*dt,84,475);
      if(dir.x||dir.y)p.angle=Math.atan2(dir.y,dir.x);
      if(!onRoad(p.x,p.y)){p.x=oldX;p.y=oldY;}
      const gate=raceGates[p.raceGate];
      if(inside(p.x,p.y,gate)){
        p.raceGate=(p.raceGate+1)%raceGates.length;
        if(p.raceGate===0){p.laps++;p.score+=1;}
      }
    }
  }
  function takeTile(round,players,p,c,r){
    const m=round.mini;
    if(c<0||c>=20||r<0||r>=10)return;
    const index=r*20+c,old=m.grid[index];
    if(old===p.id)return;
    m.grid[index]=p.id;
    const previous=players.find(a=>a.id===old);
    if(previous)previous.score=Math.max(0,previous.score-1);
    p.score+=1;
  }
  function updatePaint(dt,round,players){
    const field={x:60,y:76,w:840,h:420};
    for(const p of active(players)){
      p.cooldown=Math.max(0,p.cooldown-dt);
      movePlayer(p,dt,235,field);
      p.paintClock-=dt;
      if(p.paintClock<=0){
        const c=clamp(Math.floor((p.x-field.x)/42),0,19),r=clamp(Math.floor((p.y-field.y)/42),0,9);
        takeTile(round,players,p,c,r);p.paintClock=.11;
        if(pressed(p,'action')&&p.cooldown<=0){
          for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)takeTile(round,players,p,c+dx,r+dy);
          p.cooldown=.95;
        }
      }
    }
  }
  function update(dt,round,players){
    if(!round.mini)return;
    switch(round.mode){
      case 'tanks':updateTanks(dt,round,players);break;
      case 'soccer':updateSoccer(dt,round,players);break;
      case 'rally':updateRally(dt,round,players);break;
      case 'paint':updatePaint(dt,round,players);break;
    }
  }
  function background(g,a='#16324e',b='#102239'){
    const grad=g.createLinearGradient(0,0,W,H);
    grad.addColorStop(0,a);grad.addColorStop(1,b);
    g.fillStyle=grad;g.fillRect(0,0,W,H);
    g.strokeStyle='#ffffff09';g.lineWidth=1;
    for(let x=0;x<W;x+=40){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();}
    for(let y=0;y<H;y+=40){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}
  }
  function label(g,text,x,y,color='#fff',size=14){
    g.fillStyle=color;g.font='bold '+size+'px system-ui';g.textAlign='center';g.fillText(text,x,y);
  }
  function figure(g,p,t,kind='human'){
    if(!p.alive)return;
    g.save();g.translate(p.x,p.y);g.rotate(p.angle||0);
    const color=p.color||'#fff';
    if(kind==='tank'){
      g.fillStyle='#152338';g.fillRect(-27,-22,54,44);
      g.fillStyle=color;g.fillRect(-21,-18,42,36);
      g.fillStyle='#22344b';g.fillRect(-5,-10,37,20);
      g.fillStyle=color;g.beginPath();g.arc(0,0,14,0,Math.PI*2);g.fill();
      g.fillStyle='#faf9db';g.fillRect(3,-4,12,8);
      g.fillStyle='#142132';g.fillRect(-29,-25,58,6);g.fillRect(-29,19,58,6);
    }else if(kind==='car'){
      g.fillStyle='#10192b';g.fillRect(-22,-14,47,29);
      g.fillStyle=color;g.fillRect(-24,-11,48,22);
      g.fillStyle='#8bdafa';g.fillRect(0,-8,11,16);g.fillRect(-16,-8,6,16);
      g.fillStyle='#10192b';g.fillRect(-16,-17,11,5);g.fillRect(-16,12,11,5);
      g.fillRect(11,-17,11,5);g.fillRect(11,12,11,5);
    }else{
      g.strokeStyle='#192336';g.lineWidth=9;g.lineCap='round';
      g.beginPath();g.moveTo(-19,0);g.lineTo(19,0);g.moveTo(0,-19);g.lineTo(0,19);g.stroke();
      g.strokeStyle=color;g.lineWidth=6;g.stroke();
      g.fillStyle=color;g.beginPath();g.arc(0,0,15,0,Math.PI*2);g.fill();
      g.fillStyle='#111a2d';g.beginPath();g.arc(8,-4,3,0,Math.PI*2);g.arc(8,4,3,0,Math.PI*2);g.fill();
    }
    if(p.invulnerable>0&&Math.sin(t*26)>0){
      g.strokeStyle='#f8f6a2';g.lineWidth=3;g.beginPath();g.arc(0,0,32,0,Math.PI*2);g.stroke();
    }
    g.restore();
    label(g,p.name,p.x,p.y-32,colorize('#fff'),13);
  }
  function colorize(c){return c;}
  function drawTanks(g,t,round,players){
    background(g,'#17444f','#102433');
    g.fillStyle='#375953';g.fillRect(arena.x,arena.y,arena.w,arena.h);
    for(let x=arena.x;x<arena.x+arena.w;x+=50)for(let y=arena.y;y<arena.y+arena.h;y+=50){
      g.fillStyle=(x+y)%100===0?'#31564d':'#35564f';g.fillRect(x+3,y+3,43,43);
    }
    tankBlocks.forEach(b=>{
      g.fillStyle='#172938';g.fillRect(b.x+6,b.y+7,b.w,b.h);
      g.fillStyle='#b6aa8a';g.fillRect(b.x,b.y,b.w,b.h);
      g.fillStyle='#847f6c';g.fillRect(b.x+7,b.y+7,b.w-14,b.h-14);
    });
    round.mini.bullets.forEach(b=>{
      g.fillStyle='#ffe6a1';g.shadowColor='#f9a946';g.shadowBlur=18;
      g.beginPath();g.arc(b.x,b.y,7,0,Math.PI*2);g.fill();g.shadowBlur=0;
    });
    active(players).forEach(p=>figure(g,p,t,'tank'));
    label(g,'TANK BLAST • เล็งด้วยทิศทาง • กด HIT เพื่อยิง',480,34,'#e0fbff',19);
  }
  function drawSoccer(g,t,round,players){
    background(g,'#163a38','#122c35');
    const f={x:62,y:86,w:836,h:380};
    g.fillStyle='#34865c';g.fillRect(f.x,f.y,f.w,f.h);
    for(let i=0;i<10;i++){g.fillStyle=i%2?'#34845b':'#398a5f';g.fillRect(f.x+i*f.w/10,f.y,f.w/10,f.h);}
    g.strokeStyle='#ffffffc9';g.lineWidth=3;g.strokeRect(f.x,f.y,f.w,f.h);
    g.beginPath();g.moveTo(480,f.y);g.lineTo(480,f.y+f.h);g.stroke();
    g.beginPath();g.arc(480,276,75,0,Math.PI*2);g.stroke();
    g.strokeRect(62,192,115,167);g.strokeRect(783,192,115,167);
    g.fillStyle='#ffd35a';g.fillRect(45,207,17,137);
    g.fillStyle='#ff6c94';g.fillRect(898,207,17,137);
    const b=round.mini.ball;
    g.fillStyle='#fff';g.beginPath();g.arc(b.x,b.y,14,0,Math.PI*2);g.fill();
    g.fillStyle='#26334c';g.beginPath();g.arc(b.x+2,b.y-2,5,0,Math.PI*2);g.fill();
    active(players).forEach(p=>figure(g,p,t));
    label(g,round.mini.teamScores[0]+'  :  '+round.mini.teamScores[1],480,55,'#ffe9a3',32);
    label(g,'FOOTBALL • เดินเข้าหาบอล แล้วกด HIT เตะ',480,520,'#e7fff2',16);
  }
  function drawRally(g,t,round,players){
    background(g,'#17434c','#13343d');
    g.fillStyle='#2b7b58';g.fillRect(90,45,780,460);
    g.fillStyle='#394558';g.fillRect(track.outer.x,track.outer.y,track.outer.w,track.outer.h);
    g.fillStyle='#458b5c';g.fillRect(track.inner.x,track.inner.y,track.inner.w,track.inner.h);
    g.strokeStyle='#f5eecc';g.lineWidth=4;g.strokeRect(131,76,698,407);
    g.strokeRect(270,181,420,196);
    g.setLineDash([14,20]);g.strokeStyle='#f2efb080';g.lineWidth=3;g.strokeRect(202,133,552,302);g.setLineDash([]);
    g.fillStyle='#f8f5df';g.fillRect(480,376,8,106);
    for(let i=0;i<9;i++){g.fillStyle=i%2?'#111a2d':'#fff';g.fillRect(480,377+i*12,27,12);}
    raceGates.forEach((gate,i)=>{
      g.fillStyle='rgba(108,222,241,0.09)';g.fillRect(gate.x,gate.y,gate.w,gate.h);
      label(g,String(i+1),gate.x+gate.w/2,gate.y+gate.h/2,'#d8faff',15);
    });
    active(players).forEach(p=>{figure(g,p,t,'car');label(g,'LAP '+p.laps,p.x,p.y+43,'#fff',12);});
    label(g,'MICRO RALLY • ผ่านช่อง 1 → 2 → 3 → 4 • HIT เพื่อบูสต์',480,34,'#e2f8ff',18);
  }
  function drawPaint(g,t,round,players){
    background(g,'#1a294e','#162441');
    const owners=new Map(players.map(p=>[p.id,p.color]));
    for(let r=0;r<10;r++)for(let c=0;c<20;c++){
      const id=round.mini.grid[r*20+c];
      g.fillStyle=id?(owners.get(id)||'#68728b'):'#2b3b60';
      g.fillRect(60+c*42+1,76+r*42+1,40,40);
      g.fillStyle='#ffffff0f';g.fillRect(60+c*42+2,77+r*42+2,38,4);
    }
    active(players).forEach(p=>figure(g,p,t));
    label(g,'COLOR CLASH • วิ่งยึดพื้นที่ • HIT ระบายรอบตัว',480,43,'#fff',18);
    label(g,'ยึดช่องสีให้ได้มากที่สุดก่อนหมดเวลา',480,522,'#b9d6f6',15);
  }
  function draw(g,t,round,players){
    if(!round.mini)return;
    switch(round.mode){
      case 'tanks':drawTanks(g,t,round,players);break;
      case 'soccer':drawSoccer(g,t,round,players);break;
      case 'rally':drawRally(g,t,round,players);break;
      case 'paint':drawPaint(g,t,round,players);break;
    }
    if(round.phase==='results'){g.fillStyle='#09132b91';g.fillRect(0,0,W,H);}
  }
  window.PartyMiniGames={modes:MODES,setup,update,draw};
})();
