function resultVoters(){
  return players.filter(p=>p.type==='remote'&&p.active&&p.conn?.open&&p.conn.playerId===p.id);
}
function resultNextLabel(){
  if(!tournament)return 'เล่นอีกครั้ง';
  if(tournament.endless)return 'เกมถัดไป';
  return tournament.index+1<tournament.schedule.length?'เกมถัดไป':'สุ่มชุดใหม่จากตัวเลือกเดิม';
}
// Rank 1 earns 11, rank 2 earns 10 and rank 12 earns 0, always using
// twelve as the fixed scale (even if a room has fewer players).
function pointsForRank(rank,count){
  return tournament?.endless?Math.max(0,MAX_PLAYERS-rank):Math.max(1,count-rank+1);
}
function awardRoundPoints(ordered,rankOf){
  if(!tournament)return;
  for(const p of ordered){
    const points=pointsForRank(rankOf(p),ordered.length);
    p.total=(p.total||0)+points;
    p.lastRoundPoints=points;
  }
}
function totalScoreNote(p){
  if(!tournament)return '';
  return tournament.endless?' • +'+(p.lastRoundPoints||0)+' แต้ม • รวม '+p.total+' คะแนน':
    ' • รวม '+p.total+' คะแนน';
}
function canAutoAdvanceResults(){
  return !!(tournament&&(tournament.endless||tournament.index+1<tournament.schedule.length)&&$('autoNext').checked);
}
function resultBackLabel(){
  if(round?.phase==='summary')return 'กลับล็อบบี้';
  return tournament?.endless?'สรุปคะแนน':'กลับล็อบบี้';
}
function resultVoteSnapshot(){
  if(!round||!['results','summary'].includes(round.phase))return null;
  if(!round.resultVotes)round.resultVotes={next:new Set(),lobby:new Set()};
  const valid=new Set(resultVoters().map(p=>p.id));
  for(const name of ['next','lobby'])
    for(const id of round.resultVotes[name])if(!valid.has(id))round.resultVotes[name].delete(id);
  return {t:'result-votes',
    next:round.resultVotes.next.size,lobby:round.resultVotes.lobby.size,
    total:valid.size,nextLabel:resultNextLabel(),backLabel:resultBackLabel(),
    // The same authoritative 7-second auto-next timer drives the host button
    // and each connected phone's A label. Votes do not pause or reset it.
    autoNextSeconds:round.phase==='results'&&round.autoNextRemaining>0?Math.ceil(round.autoNextRemaining):null};
}
function renderResultVotes(sendUpdate=false){
  const v=resultVoteSnapshot();if(!v)return;
  const seconds=v.autoNextSeconds!==null?' • อีก '+v.autoNextSeconds+' วิ':'';
  // Align A/B on the left, action text in the center and votes on the right.
  // The accessibility label contains the full sentence for screen readers.
  const next=$('replayBtn'),back=$('backBtn');
  next.textContent=v.nextLabel+seconds;
  next.dataset.action='A';next.dataset.votes=v.next+'/'+v.total;
  next.setAttribute('aria-label','A '+next.textContent+' '+next.dataset.votes);
  back.textContent=v.backLabel;
  back.dataset.action='B';back.dataset.votes=v.lobby+'/'+v.total;
  back.setAttribute('aria-label','B '+v.backLabel+' '+back.dataset.votes);
  // Only broadcast when the displayed second changes or a vote changes;
  // never spam all controllers on every animation frame.
  if(sendUpdate||round.lastBroadcastAutoNextSeconds!==v.autoNextSeconds){
    round.lastBroadcastAutoNextSeconds=v.autoNextSeconds;
    broadcast(v);
  }
}

function layoutFinalResults(){
  // Keep legacy label/score nodes first: voting, accessibility and game engines
  // consume those. The new vector portrait and rank plaque are decorative.
  const list=$('resultList');
  const children=Array.from(list.children);
  const rows=children.filter(el=>String(el.className||'').split(/\s+/).includes('result-player'));
  const hasHeading=children.some(el=>String(el.className||'').split(/\s+/).includes('tournament-header'));
  const width=Number(window.innerWidth)||960;
  // Fill full rows from the BOTTOM. Any short row belongs at the TOP and
  // is centered, so 5 players become [1] / [2 3 4 5] rather than leaving
  // 3 dead slots beside the fifth-place card. Two micro-tracks per card make
  // a 1/2/3-card top row mathematically centered without resizing cards.
  const maxColumns=rows.length<=4?
    Math.max(1,Math.min(rows.length-1,width>=620?3:2)):
    width>=1060?4:width>=620?3:2;
  const columns=Math.max(1,Math.min(rows.length||1,maxColumns));
  const lines=Math.max(1,Math.ceil(rows.length/columns));
  const topCount=rows.length%columns||columns;
  list.style.setProperty('--result-cols',String(columns));
  list.style.setProperty('--result-tracks',String(columns*2));
  list.style.setProperty('--result-rows',String(lines));
  list.dataset.count=String(rows.length);
  list.dataset.cols=String(columns);
  list.dataset.topCount=String(topCount);
  list.classList.toggle('has-heading',hasHeading);
  const roster=round?.mode==='board'&&boardSession?boardSession.players:players;
  rows.forEach((row,index)=>{
    // Rank order in DOM is untouched for screen readers and result voting.
    // Only its CSS position changes. The header occupies grid row 1.
    const top=index<topCount;
    const visualRow=top?0:1+Math.floor((index-topCount)/columns);
    const slot=top?index:(index-topCount)%columns;
    const track=1+2*slot+(top?columns-topCount:0);
    row.style.gridColumn=track+' / span 2';
    row.style.gridRow=String(visualRow+1+(hasHeading?1:0));
    row.style.setProperty('--rank-delay',String(index));

    const label=row.children[0],detail=row.children[1];
    // Result engines still supply the original rank/name label. Preserve it as
    // metadata so repeated responsive layouts never lose the real competition
    // rank after we display only the player's name on the plaque.
    const name=String(row.dataset.rankSource||label?.textContent||'');
    if(!row.dataset.rankSource)row.dataset.rankSource=name;
    const color=label?.style?.color||'#9fb9da';
    const match=name.match(/อันดับ\s*(\d+)|(?:^|\s)(\d+)\.\s*/);
    const rank=Number(match?.[1]||match?.[2]||index+1);
    row.dataset.rank=String(rank);
    row.classList.toggle('is-winner',rank===1);
    row.classList.toggle('is-podium',rank<=3);
    row.style.setProperty('--result-accent',color);
    // Distinct player-owned banner colors, NEVER fixed purple/silver/green by rank.
    const playerName=(name.includes(' • ')?name.split(' • ').pop():
      name.replace(/^(?:ผู้ชนะ\s*)?อันดับ\s*\d+(?:\s*ร่วม)?\s*[.\-–]?\s*/, '')).trim();
    // The shiny 1ST/2ND/3RD ordinal already communicates position. The text
    // line should be just "บอท 4", never "อันดับ 1 • บอท 4".
    if(label){label.textContent=playerName;label.title=playerName;}
    const p=roster.find(q=>q.name===playerName&&q.color===color)||
      roster.find(q=>q.name===playerName)||{color};
    row.dataset.playerId=String(p.id||'');
    let portrait=Array.from(row.children).find(x=>x.className==='result-avatar');
    if(!portrait){
      portrait=document.createElement('div');
      portrait.className='result-avatar';portrait.setAttribute('aria-hidden','true');
      row.append(portrait);
    }
    // The SVG is locally authored, colors strictly match the validated player.
    portrait.innerHTML=window.PartyPlayerAvatar?.svgForFront(p.color)||'';
    let badge=Array.from(row.children).find(x=>x.className==='result-ordinal');
    if(!badge){
      badge=document.createElement('div');
      badge.className='result-ordinal';badge.setAttribute('aria-hidden','true');
      row.append(badge);
    }
    const suffix=rank%100>=11&&rank%100<=13?'TH':rank%10===1?'ST':rank%10===2?'ND':rank%10===3?'RD':'TH';
    badge.textContent=String(rank)+suffix;
    row.title=name+' • '+(detail?.textContent||'');
    row.setAttribute('aria-label',row.title);
  });
}


function showCumulativeScores(){
  if(!tournament?.endless||!round||round.phase!=='results')return false;
  // The player requested a scoreboard: stop auto-advance while it is open.
  round.autoNextRemaining=0;
  round.phase='summary';
  round.paused=false;
  const list=$('resultList');list.replaceChildren();
  const ranked=players.filter(p=>p.active).sort((a,b)=>
    (b.total||0)-(a.total||0)||String(a.id).localeCompare(String(b.id)));
  const heading=document.createElement('div');heading.className='tournament-header';
  heading.textContent='คะแนนสะสมหลังจบ '+(tournament.roundsPlayed+1)+' เกม • อันดับร่วมได้คะแนนเท่ากัน';
  list.append(heading);
  for(const p of ranked){
    const rank=1+ranked.filter(q=>(q.total||0)>(p.total||0)).length;
    const tied=ranked.filter(q=>(q.total||0)===(p.total||0)).length>1;
    const row=document.createElement('div');row.className='result-player';
    const label=document.createElement('div');
    label.style.color=p.color;
    label.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
    const score=document.createElement('span');
    score.textContent=(p.total||0)+' คะแนนสะสม • เกมล่าสุด +'+(p.lastRoundPoints||0);
    row.append(label,score);list.append(row);
  }
  $('results').querySelector('.eyebrow').textContent='ALL GAMES • SCOREBOARD';
  $('results').querySelector('h2').textContent='ตารางคะแนนรวม';
  $('results').classList.remove('hidden');
  broadcastRoster();
  beginResultVoting();
  return true;
}
function onResultBack(){
  if(round?.phase==='summary'){returnToLobby();return;}
  if(round?.phase==='results'&&tournament?.endless){
    showCumulativeScores();return;
  }
  returnToLobby();
}
function beginResultVoting(){
  layoutFinalResults();
  round.resultVotes={next:new Set(),lobby:new Set()};
  renderResultVotes(true);
}
function castResultVote(conn,choice){
  if(!round||!['results','summary'].includes(round.phase)||!['next','lobby'].includes(choice))return;
  const voter=resultVoters().find(p=>p.id===conn.playerId&&p.conn===conn);
  if(!voter)return;
  const votes=round.resultVotes||(round.resultVotes={next:new Set(),lobby:new Set()});
  for(const name of ['next','lobby'])votes[name].delete(voter.id);
  votes[choice].add(voter.id);
  const snapshot=resultVoteSnapshot();
  renderResultVotes(true);
  // Unanimity acts instantly. Host buttons and the countdown still work.
  if(snapshot.total>0&&snapshot[choice]===snapshot.total){
    if(choice==='next')advanceParty();
    else onResultBack();
  }
}
function endPluginRound(){
 const results=round.pluginEngine.getResult(round,players),active=players.filter(p=>p.active);
 if(!Array.isArray(results)||results.length!==active.length)throw Error('Incomplete plugin result');
 const scores=new Map();
 for(const item of results){
  if(!item||typeof item.id!=='string'||scores.has(item.id)||
   typeof item.value!=='number'||Number.isNaN(item.value))throw Error('Invalid plugin result');
  scores.set(item.id,item);
 }
 if(active.some(p=>!scores.has(p.id)))throw Error('Result missing a participant');
 const value=p=>scores.get(p.id).value;
 const ranked=active.slice().sort((a,b)=>value(b)-value(a)||String(a.id).localeCompare(String(b.id)));
 const rank=p=>1+ranked.filter(q=>value(q)>value(p)).length;
 awardRoundPoints(ranked,rank);
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 const winners=ranked.filter(p=>rank(p)===1);
 $('results').querySelector('h2').textContent=winners.length===1?'ผู้ชนะ: '+winners[0].name:'เสมอ • อันดับ 1 ร่วม';
 const list=$('resultList');list.replaceChildren();
 for(const p of ranked){
  const item=scores.get(p.id),row=document.createElement('div');
  row.className='result-player';
  const label=document.createElement('div');label.style.color=p.color;
  label.textContent='อันดับ '+rank(p)+(winners.length>1&&rank(p)===1?' ร่วม':'')+' • '+p.name;
  const detail=document.createElement('span');
  detail.textContent=(typeof item.label==='string'?item.label:
    value(p)===Infinity?'ผู้รอดชีวิต':value(p)+' คะแนน')+totalScoreNote(p);
  row.append(label,detail);list.append(row);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endRound(){
  if(!round||round.phase==='results')return;
  if(boardSession?.phase==='minigame'){
    const ranking=window.BoardMinigame.ranking(round,players);
    // Ignore duplicate end notifications: board state accepts one result only.
    if(window.BoardParty.minigameEnded(boardSession,ranking))showBoard();
    return;
  }
  // After returning to the board, any delayed minigame "end" callback must
  // not open the normal results page a second time.
  if(boardSession&&round.mode==='board')return;
  if(round.pluginEngine?.getResult&&round.mode!=='ghost'){endPluginRound();return;}
   if(round.mode==='color_claim'){endColorClaimRound();return;}
   if(round.mode==='snow_brawl'){endSnowBrawlRound();return;}
   if(round.mode==='boulder_bash'){endBoulderBashRound();return;}
    if(round.mode==='gladiators'){endGladiatorsRound();return;}
    if(round.mode==='witching_snake'){endWitchingSnakeRound();return;}

   if(round.mode==='lawn_mower'){endLawnMowerRound();return;}
   if(round.mode==='ice_race'){endShoppingTimeRound();return;}
   if(round.mode==='shopping_time'){endShoppingTimeRound();return;}
   if(round.mode==='pizza_time'){endPizzaTimeRound();return;}
   if(round.mode==='knight_match'){endKnightMatchRound();return;}
   if(round.mode==='color_switch'){endColorSwitchRound();return;}
  if(round.mode==='chickens'){endChickensRound();return;}
  if(round.mode==='fruit_memory'){endFruitMemoryRound();return;}
   if(round.mode==='shockwave'){endShockwaveRound();return;}
  round.phase='results';round.paused=false;resetInputs();broadcastRoster();
  $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
  // Same infection frame OR same 0.1-second score -> shared competition rank.
  // When all humans are infected, winnerId is a fallback, not proof of a solo winner.
  const finishValue=p=>!p.ghost?Infinity:
    Math.floor((Number.isFinite(p.infectedAt)?p.infectedAt:
      Number.isFinite(p.survival)?p.survival:0)*10+1e-7);
  const ranked=players.filter(p=>p.active).sort((a,b)=>
    finishValue(b)-finishValue(a)||String(a.id).localeCompare(String(b.id)));
  const rankOf=p=>1+ranked.filter(q=>finishValue(q)>finishValue(p)).length;
  const first=ranked.filter(p=>rankOf(p)===1);
  $('results').querySelector('h2').textContent=first.length>1?
    'เสมอ! อันดับ 1 ร่วม':first[0]&&!first[0].ghost?
      'ผู้รอดคนสุดท้าย!':'อยู่รอดนานที่สุด!';
  awardRoundPoints(ranked,rankOf);
  round.autoNextRemaining=canAutoAdvanceResults()?7:0;
  const list=$('resultList');list.replaceChildren();
  ranked.forEach(p=>{
    const rank=rankOf(p),tied=ranked.filter(q=>rankOf(q)===rank).length>1;
    const row=document.createElement('div');row.className='result-player';
    const label=document.createElement('div');
    label.textContent=(rank===1?'ผู้ชนะ ':'')+'อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
    label.style.color=p.color;
    const detail=document.createElement('span');
    detail.textContent=(p.ghost?'ตกรอบ':'ผู้รอดคนสุดท้าย')+
      (p.ghost&&Number.isFinite(p.infectedAt)?' • '+p.infectedAt.toFixed(1)+' วิ':'')+
      totalScoreNote(p);
    row.append(label,detail);list.append(row);
  });
  if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
    const overall=[...ranked].sort((a,b)=>b.total-a.total);
    list.replaceChildren();
    overall.forEach(p=>{
      const row=document.createElement('div');row.className='result-player';
      const rank=1+overall.filter(q=>q.total>p.total).length;
      const name=document.createElement('div');name.textContent='อันดับ '+rank+'. '+p.name;
      name.style.color=p.color;
      const score=document.createElement('span');score.textContent=p.total+' คะแนนรวม';
      row.append(name,score);list.append(row);
    });
    const heading=document.createElement('div');heading.className='tournament-header';
    const top=overall.filter(p=>p.total===overall[0].total);
    heading.textContent=top.length===1?'ผู้ชนะรวม: '+top[0].name:
      'คะแนนรวมเสมอ: '+top.map(p=>p.name).join(', ');list.prepend(heading);
  }
  $('results').classList.remove('hidden');$('gameBanner').textContent='';
  beginResultVoting();
  renderLeaderboard();
}

function endColorClaimRound(){
 const state=round.colorClaim;
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const value=p=>state.counts[p.cc?.slot]||0;
 const ranked=players.filter(p=>p.active).slice().sort((a,b)=>value(b)-value(a)||String(a.id).localeCompare(String(b.id)));
 const rankOf=p=>1+ranked.filter(q=>value(q)>value(p)).length;
 awardRoundPoints(ranked,rankOf);
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 const winners=ranked.filter(p=>rankOf(p)===1);
 $('results').querySelector('h2').textContent=winners.length===1?
  'ผู้ชนะ: '+winners[0].name:'เสมอ! อันดับ 1 ร่วม';
 const list=$('resultList');list.replaceChildren();
 const render=(people,totals=false)=>{
  const score=p=>totals?(p.total||0):value(p);
  for(const p of people){
   const rank=1+people.filter(q=>score(q)>score(p)).length;
   const tied=people.filter(q=>score(q)===score(p)).length>1;
   const row=document.createElement('div');row.className='result-player';
   const label=document.createElement('div');label.style.color=p.color;
   label.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
   const detail=document.createElement('span');
   detail.textContent=totals?p.total+' คะแนนรวม':
    p.score.toFixed(2)+'% ของสนาม'+(p.cc?.eliminated?' • พื้นที่หมด • ตกรอบถาวร':'')+totalScoreNote(p);
   row.append(label,detail);list.append(row);
  }
 };
 render(ranked);
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
  const overall=ranked.slice().sort((a,b)=>b.total-a.total||String(a.id).localeCompare(String(b.id)));
  list.replaceChildren();render(overall,true);
  const joint=overall.filter(p=>p.total===overall[0].total);
  const head=document.createElement('div');head.className='tournament-header';
  head.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:
   'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
  list.prepend(head);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endGladiatorsRound(){
 const s=round.gladiators;
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const value=p=>p.gladiator?.alive?Infinity:(p.gladiator?.eliminatedTick??-1);
 const ranked=players.filter(p=>p.active).slice().sort((a,b)=>value(b)-value(a)||String(a.id).localeCompare(String(b.id)));
 const rankOf=p=>1+ranked.filter(q=>value(q)>value(p)).length;
 awardRoundPoints(ranked,rankOf);
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 const top=ranked.filter(p=>rankOf(p)===1);
 $('results').querySelector('h2').textContent=ranked.length===1?
  (top[0]?.gladiator?.alive?'รอดชีวิตครบ 60 วินาที!':'เอาตัวรอดไม่สำเร็จ'):
  top.length>1?'เสมอ! อันดับ 1 ร่วม':
  top[0]?.gladiator?.alive?'ผู้ชนะ: '+top[0].name:'อยู่รอดนานที่สุด: '+top[0]?.name;
 const list=$('resultList');list.replaceChildren();
 const show=(people,useTotal=false)=>{
  const get=p=>useTotal?p.total:value(p);
  for(const p of people){
   const rank=1+people.filter(q=>get(q)>get(p)).length;
   const tied=people.some(q=>q!==p&&get(q)===get(p));
   const row=document.createElement('div');row.className='result-player';
   const label=document.createElement('div');label.style.color=p.color;
   label.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
   const detail=document.createElement('span');
   detail.textContent=useTotal?p.total+' คะแนนรวม':
    (p.gladiator?.alive?'ผู้รอดชีวิต':'ตกรอบ')+' • '+
     (p.gladiator?.eliminatedAt??s.clock).toFixed(1)+' วิ'+totalScoreNote(p);
   row.append(label,detail);list.append(row);
  }
 };
 show(ranked);
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
  list.replaceChildren();const overall=ranked.slice().sort((a,b)=>b.total-a.total);
  show(overall,true);
  const leaders=overall.filter(p=>p.total===overall[0].total);
  const title=document.createElement('div');title.className='tournament-header';
  title.textContent=leaders.length>1?'คะแนนรวมเสมอ: '+leaders.map(p=>p.name).join(', '):
   'ผู้ชนะรวม: '+leaders[0].name;list.prepend(title);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endWitchingSnakeRound(){
 const state=round.witchingSnake;
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const ranked=players.filter(p=>p.active).slice().sort((a,b)=>
  Number(!!b.ws?.alive)-Number(!!a.ws?.alive)||
  (b.ws?.eliminatedTick??0)-(a.ws?.eliminatedTick??0)||
  String(a.id).localeCompare(String(b.id)));
 const value=p=>p.ws?.alive?Infinity:(p.ws?.eliminatedTick??0);
 const rankOf=p=>1+ranked.filter(q=>value(q)>value(p)).length;
 awardRoundPoints(ranked,rankOf);
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 const top=ranked.filter(p=>rankOf(p)===1);
 $('results').querySelector('h2').textContent=ranked.length===1?
  (top[0]?.ws?.alive?'เอาตัวรอดครบ 60 วินาที!':'เอาตัวรอดไม่สำเร็จ'):
  top.length>1?'เสมอ! อันดับ 1 ร่วม':
  top[0]?.ws?.alive?'ผู้ชนะ: '+top[0].name:'อยู่รอดนานที่สุด: '+top[0]?.name;
 const list=$('resultList');list.replaceChildren();
 const show=(people,useTotal=false)=>{
  const get=q=>useTotal?q.total:value(q);
  for(const p of people){
   const rank=1+people.filter(q=>get(q)>get(p)).length;
   const tied=people.filter(q=>get(q)===get(p)).length>1;
   const row=document.createElement('div');row.className='result-player';
   const label=document.createElement('div');label.style.color=p.color;
   label.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
   const detail=document.createElement('span');
   detail.textContent=useTotal?p.total+' คะแนนรวม':
    (p.ws?.alive?'รอดชีวิต':'ตกรอบ')+' • '+(p.ws?.eliminatedAt??state.clock).toFixed(1)+
    ' วิ • ดาว '+(p.ws?.stars||0)+totalScoreNote(p);
   row.append(label,detail);list.append(row);
  }
 };
 show(ranked);
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
  list.replaceChildren();const overall=ranked.slice().sort((a,b)=>b.total-a.total);
  show(overall,true);
  const first=overall.filter(p=>p.total===overall[0].total);
  const header=document.createElement('div');header.className='tournament-header';
  header.textContent=first.length===1?'ผู้ชนะรวม: '+first[0].name:
   'คะแนนรวมเสมอ: '+first.map(p=>p.name).join(', ');
  list.prepend(header);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endShockwaveRound(){
 const s=round.shockwave;round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const winners=new Set(s.winnerIds?.length?s.winnerIds:(s.winnerId?[s.winnerId]:[]));
 const value=p=>winners.has(p.id)?Infinity:(p.shockEliminatedAt||0);
 const ranked=players.filter(p=>p.active).sort((a,b)=>
   value(b)-value(a)||String(a.id).localeCompare(String(b.id)));
 const rankOf=p=>1+ranked.filter(q=>value(q)>value(p)).length;
 if(tournament){
   awardRoundPoints(ranked,rankOf);
   $('replayBtn').textContent=tournament.index===tournament.schedule.length-1?
     'สุ่มชุดใหม่จากตัวเลือกเดิม':'เกมถัดไป ('+(tournament.index+2)+'/'+tournament.schedule.length+')';
 }else $('replayBtn').textContent='เล่นอีกครั้ง';
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 const firstPlace=ranked.filter(p=>winners.has(p.id));
 $('results').querySelector('h2').textContent=firstPlace.length>1?
   'ผู้ชนะร่วม: '+firstPlace.map(p=>p.name).join(' / '):
   firstPlace.length?'ผู้ชนะ: '+firstPlace[0].name:'ไม่มีผู้ชนะ';
 const list=$('resultList');list.replaceChildren();
 ranked.forEach(p=>{
   const row=document.createElement('div');row.className='result-player';
   const name=document.createElement('div');name.style.color=p.color;
   name.textContent='อันดับ '+rankOf(p)+' • '+p.name;
   const detail=document.createElement('span');
   detail.textContent=(winners.has(p.id)?(firstPlace.length>1?'อันดับ 1 ร่วม':'ผู้รอดคนสุดท้าย'):'ตกรอบ Wave '+(p.shockEliminatedWave||s.wave))+
     totalScoreNote(p);
   row.append(name,detail);list.append(row);
 });
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
   const overall=[...ranked].sort((a,b)=>b.total-a.total);list.replaceChildren();
   overall.forEach((p,i)=>{
     const row=document.createElement('div');row.className='result-player';
     const name=document.createElement('div');name.textContent='อันดับ '+(1+overall.filter(q=>q.total>p.total).length)+' • '+p.name;name.style.color=p.color;
     const score=document.createElement('span');score.textContent=p.total+' คะแนนรวม';
     row.append(name,score);list.append(row);
   });
   const joint=overall.filter(p=>p.total===overall[0].total);
   const heading=document.createElement('div');heading.className='tournament-header';
   heading.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
   list.prepend(heading);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
  beginResultVoting();
  renderLeaderboard();
}
function endSnowBrawlRound(){
 const state=round.snowBrawl,byId=new Map(state.ranking.map(x=>[x.id,x]));
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const ranked=players.filter(p=>p.active).sort((a,b)=>
  (byId.get(a.id)?.rank||99)-(byId.get(b.id)?.rank||99)||
  String(a.id).localeCompare(String(b.id)));
 const winners=ranked.filter(p=>state.winnerIds.includes(p.id));
 awardRoundPoints(ranked,p=>byId.get(p.id)?.rank||ranked.length);
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 $('results').querySelector('h2').textContent=winners.length===1?'ผู้ชนะ: '+winners[0].name:
  winners.length>1?'เสมอ • อันดับ 1 ร่วม':'ไม่มีผู้รอดชีวิต';
 const list=$('resultList');list.replaceChildren();
 const render=(people,useTotal=false)=>{
  const value=p=>useTotal?(p.total||0):-(byId.get(p.id)?.rank||people.length);
  for(const p of people){
   const rank=1+people.filter(q=>value(q)>value(p)).length;
   const tied=people.filter(q=>value(q)===value(p)).length>1;
   const row=document.createElement('div');row.className='result-player';
   const name=document.createElement('div');name.style.color=p.color;
   name.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
   const detail=document.createElement('span');
   detail.textContent=useTotal?p.total+' คะแนนรวม':
     (p.snow?.alive?'รอดชีวิต':(p.snow?.eliminatedAt||0).toFixed(1)+' วินาที')+totalScoreNote(p);
   row.append(name,detail);list.append(row);
  }
 };
 render(ranked);
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
  list.replaceChildren();const overall=[...ranked].sort((a,b)=>b.total-a.total);
  render(overall,true);
  const joint=overall.filter(p=>p.total===overall[0].total);
  const heading=document.createElement('div');heading.className='tournament-header';
  heading.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:
   'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
  list.prepend(heading);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endBoulderBashRound(){
 const s=round.boulderBash,byId=new Map(s.ranking.map(r=>[r.id,r]));
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const ranked=players.filter(p=>p.active).sort((a,b)=>(byId.get(a.id)?.rank||99)-(byId.get(b.id)?.rank||99));
 const winners=ranked.filter(p=>s.winnerIds.includes(p.id));
 awardRoundPoints(ranked,p=>byId.get(p.id)?.rank||ranked.length);
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 $('results').querySelector('h2').textContent=winners.length===1?'ผู้ชนะ: '+winners[0].name:
   winners.length>1?'เสมอ • อันดับ 1 ร่วม':'ไม่มีผู้รอดชีวิต';
 const list=$('resultList');list.replaceChildren();
 const render=(people,useTotal=false)=>{
   const score=p=>useTotal?p.total:-(byId.get(p.id)?.rank||ranked.length);
   for(const p of people){
     const rank=1+people.filter(q=>score(q)>score(p)).length;
     const tied=people.some(q=>q!==p&&score(q)===score(p));
     const row=document.createElement('div');row.className='result-player';
     const name=document.createElement('div');name.style.color=p.color;
     name.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
     const note=document.createElement('span');
     note.textContent=useTotal?p.total+' คะแนนรวม':
       (p.bb?.alive?'รอดชีวิต':(p.bb?.eliminatedAt||0).toFixed(1)+' วินาที')+totalScoreNote(p);
     row.append(name,note);list.append(row);
   }
 };
 render(ranked);
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
   list.replaceChildren();const overall=[...ranked].sort((a,b)=>b.total-a.total);
   render(overall,true);
   const joint=overall.filter(p=>p.total===overall[0].total);
   const heading=document.createElement('div');heading.className='tournament-header';
   heading.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
   list.prepend(heading);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endColorSwitchRound(){
 const s=round.colorSwitch;
 window.ColorSwitch.calculateFinalRanking(s,players);
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const byId=new Map(s.ranking.map(r=>[r.id,r]));
 const ranked=players.filter(p=>p.active).sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));
 const winners=ranked.filter(p=>s.winnerIds.includes(p.id));
 if(tournament){
   awardRoundPoints(ranked,p=>byId.get(p.id)?.rank||ranked.length);
   $('replayBtn').textContent=tournament.index===tournament.schedule.length-1?
     'สุ่มชุดใหม่จากตัวเลือกเดิม':'เกมถัดไป ('+(tournament.index+2)+'/'+tournament.schedule.length+')';
 }else $('replayBtn').textContent='เล่นอีกครั้ง';
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 $('results').querySelector('h2').textContent=winners.length===1?'ผู้ชนะ: '+winners[0].name:'คะแนนเสมอ!';
 const list=$('resultList');list.replaceChildren();
 ranked.forEach(p=>{
   const row=document.createElement('div');row.className='result-player';
   const name=document.createElement('div');name.style.color=p.color;
   const rank=byId.get(p.id)?.rank||1;
    const tied=ranked.filter(q=>(byId.get(q.id)?.rank||1)===rank).length>1;
    name.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
   const score=document.createElement('span');
   score.textContent=p.score+' คะแนน'+totalScoreNote(p);
   row.append(name,score);list.append(row);
 });
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
   const overall=[...ranked].sort((a,b)=>b.total-a.total||String(a.id).localeCompare(String(b.id)));
   list.replaceChildren();
   overall.forEach(p=>{
     const row=document.createElement('div');row.className='result-player';
     const name=document.createElement('div');name.textContent='อันดับ '+(1+overall.filter(q=>q.total>p.total).length)+' • '+p.name;name.style.color=p.color;
     const score=document.createElement('span');score.textContent=p.total+' คะแนนรวม';
     row.append(name,score);list.append(row);
   });
   const joint=overall.filter(p=>p.total===overall[0].total);
   const heading=document.createElement('div');heading.className='tournament-header';
   heading.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
   list.prepend(heading);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
  beginResultVoting();
  renderLeaderboard();
}
function endKnightMatchRound(){
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const ranked=players.filter(p=>p.active).sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));
 const top=ranked[0]?.score??0,winners=ranked.filter(p=>p.score===top);
 awardRoundPoints(ranked,p=>1+ranked.filter(q=>q.score>p.score).length);
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 $('results').querySelector('h2').textContent=winners.length===1?'ผู้ชนะ: '+winners[0].name:'คะแนนเสมอ • อันดับ 1 ร่วม';
 const list=$('resultList');list.replaceChildren();
 const show=(people,useTotal=false)=>people.forEach(p=>{
  const value=q=>useTotal?q.total:q.score;
  const rank=1+people.filter(q=>value(q)>value(p)).length;
  const row=document.createElement('div');row.className='result-player';
  const label=document.createElement('div');label.style.color=p.color;
  label.textContent='อันดับ '+rank+(people.filter(q=>value(q)===value(p)).length>1?' ร่วม':'')+' • '+p.name;
  const score=document.createElement('span');score.textContent=value(p)+(useTotal?' คะแนนรวม':' คะแนน')+(useTotal?'':totalScoreNote(p));
  row.append(label,score);list.append(row);
 });
 show(ranked);
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
  list.replaceChildren();
  const overall=[...ranked].sort((a,b)=>b.total-a.total||String(a.id).localeCompare(String(b.id)));
  show(overall,true);
  const first=overall.filter(p=>p.total===overall[0].total);
  const title=document.createElement('div');title.className='tournament-header';
  title.textContent=first.length===1?'ผู้ชนะรวม: '+first[0].name:'คะแนนรวมเสมอ: '+first.map(p=>p.name).join(', ');
  list.prepend(title);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endLawnMowerRound(){
  endShoppingTimeRound();
}
function endShoppingTimeRound(){
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const ranked=players.filter(p=>p.active).sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));
 const top=ranked[0]?.score??0,winners=ranked.filter(p=>p.score===top);
 awardRoundPoints(ranked,p=>1+ranked.filter(q=>q.score>p.score).length);
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 $('results').querySelector('h2').textContent=winners.length===1?'ผู้ชนะ: '+winners[0].name:'คะแนนเสมอ • อันดับ 1 ร่วม';
 const list=$('resultList');list.replaceChildren();
 const show=(people,useTotal=false)=>people.forEach(p=>{
   const value=q=>useTotal?q.total:q.score;
   const rank=1+people.filter(q=>value(q)>value(p)).length;
   const tied=people.filter(q=>value(q)===value(p)).length>1;
   const row=document.createElement('div');row.className='result-player';
   const label=document.createElement('div');label.style.color=p.color;
   label.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
   const score=document.createElement('span');
   score.textContent=useTotal?p.total+' คะแนนรวม':p.score+' คะแนน'+totalScoreNote(p);
   row.append(label,score);list.append(row);
 });
 show(ranked);
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
   list.replaceChildren();
   const overall=[...ranked].sort((a,b)=>b.total-a.total||String(a.id).localeCompare(String(b.id)));
   show(overall,true);
   const first=overall.filter(p=>p.total===overall[0].total);
   const title=document.createElement('div');title.className='tournament-header';
   title.textContent=first.length===1?'ผู้ชนะรวม: '+first[0].name:'คะแนนรวมเสมอ: '+first.map(p=>p.name).join(', ');
   list.prepend(title);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endPizzaTimeRound(){
 round.phase='results';round.paused=false;resetInputs();broadcastRoster();
 $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 const ranked=players.filter(p=>p.active).sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));
 const top=ranked[0]?.score??0,winners=ranked.filter(p=>p.score===top);
 awardRoundPoints(ranked,p=>1+ranked.filter(q=>q.score>p.score).length);
 round.autoNextRemaining=canAutoAdvanceResults()?7:0;
 $('results').querySelector('h2').textContent=winners.length===1?'ผู้ชนะ: '+winners[0].name:'คะแนนเสมอ • อันดับ 1 ร่วม';
 const list=$('resultList');list.replaceChildren();
 const show=(people,useTotal=false)=>people.forEach(p=>{
   const value=q=>useTotal?q.total:q.score;
   const rank=1+people.filter(q=>value(q)>value(p)).length;
   const tied=people.filter(q=>value(q)===value(p)).length>1;
   const row=document.createElement('div');row.className='result-player';
   const label=document.createElement('div');label.style.color=p.color;
   label.textContent='อันดับ '+rank+(tied?' ร่วม':'')+' • '+p.name;
   const score=document.createElement('span');
   score.textContent=useTotal?p.total+' คะแนนรวม':p.score+' ออร์เดอร์'+totalScoreNote(p);
   row.append(label,score);list.append(row);
 });
 show(ranked);
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
   list.replaceChildren();
   const overall=[...ranked].sort((a,b)=>b.total-a.total||String(a.id).localeCompare(String(b.id)));
   show(overall,true);
   const first=overall.filter(p=>p.total===overall[0].total);
   const title=document.createElement('div');title.className='tournament-header';
   title.textContent=first.length===1?'ผู้ชนะรวม: '+first[0].name:'คะแนนรวมเสมอ: '+first.map(p=>p.name).join(', ');
   list.prepend(title);
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}
function endChickensRound(){
  round.phase='results';round.paused=false;resetInputs();broadcastRoster();
  $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
  const ranked=players.filter(p=>p.active).sort((a,b)=>b.score-a.score);
  const best=ranked[0]?.score??0;
  const winners=ranked.filter(p=>p.score===best);
  if(tournament){
    awardRoundPoints(ranked,p=>1+ranked.filter(q=>q.score>p.score).length);
    $('replayBtn').textContent=tournament.index===tournament.schedule.length-1?
      'สุ่มชุดใหม่จากตัวเลือกเดิม':
      'เกมถัดไป ('+(tournament.index+2)+'/'+tournament.schedule.length+')';
  }else $('replayBtn').textContent='เล่นอีกครั้ง';
  round.autoNextRemaining=canAutoAdvanceResults()?7:0;
  $('results').querySelector('h2').textContent=winners.length===1?
    'ผู้ชนะ: '+winners[0].name:'คะแนนเสมอ!';
  const list=$('resultList');list.replaceChildren();
  ranked.forEach((p,i)=>{
    const row=document.createElement('div');row.className='result-player';
    const name=document.createElement('div');name.style.color=p.color;
    const rank=1+ranked.filter(q=>q.score>p.score).length;
    name.textContent='อันดับ '+rank+
      (ranked.filter(q=>q.score===p.score).length>1?' ร่วม':'')+' • '+p.name;
    const score=document.createElement('span');
    score.textContent=p.score+' ไก่'+totalScoreNote(p);
    row.append(name,score);list.append(row);
  });
  if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
    const overall=[...ranked].sort((a,b)=>b.total-a.total);
    list.replaceChildren();
    overall.forEach((p,i)=>{
      const row=document.createElement('div');row.className='result-player';
      const name=document.createElement('div');name.style.color=p.color;
      name.textContent='อันดับ '+(1+overall.filter(q=>q.total>p.total).length)+' • '+p.name;
      const score=document.createElement('span');score.textContent=p.total+' คะแนนรวม';
      row.append(name,score);list.append(row);
    });
    const joint=overall.filter(p=>p.total===overall[0].total);
    const heading=document.createElement('div');heading.className='tournament-header';
    heading.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
    list.prepend(heading);
  }
  $('results').classList.remove('hidden');$('gameBanner').textContent='';
  beginResultVoting();
  renderLeaderboard();
}
function endFruitMemoryRound(){
  const s=round.fruitMemory;
  round.phase='results';round.paused=false;resetInputs();broadcastRoster();
  $('pauseMenu').classList.add('hidden');$('pauseBtn').classList.add('hidden');
  const winnerId=s.winnerId;
  // Competition ranking: people who fell together share a rank, and players
  // eliminated in earlier memory rounds always place below later survivors.
  const finishWave=p=>p.id===winnerId?Infinity:
    (p.fruitEliminatedRound||p.fruitRounds||0);
  const ranked=players.filter(p=>p.active).sort((a,b)=>
    finishWave(b)-finishWave(a)||String(a.id).localeCompare(String(b.id)));
  const rankOf=p=>1+ranked.filter(q=>finishWave(q)>finishWave(p)).length;
  if(tournament){
    awardRoundPoints(ranked,rankOf);
    $('replayBtn').textContent=tournament.index===tournament.schedule.length-1?
      'สุ่มชุดใหม่จากตัวเลือกเดิม':
      'เกมถัดไป ('+(tournament.index+2)+'/'+tournament.schedule.length+')';
  }else $('replayBtn').textContent='เล่นอีกครั้ง';
  round.autoNextRemaining=canAutoAdvanceResults()?7:0;
  const winner=ranked.find(p=>p.id===winnerId);
  $('results').querySelector('h2').textContent=winner?
    'ผู้ชนะ: '+winner.name:s.tieIds?.length?'เสมอ! ไม่มีผู้รอด':'ไม่มีผู้ชนะ';
  const list=$('resultList');list.replaceChildren();
  ranked.forEach(p=>{
    const row=document.createElement('div');row.className='result-player';
    const name=document.createElement('div');name.style.color=p.color;
    name.textContent='อันดับ '+rankOf(p)+' • '+p.name;
    const detail=document.createElement('span');
    const tied=!winnerId&&s.tieIds?.includes(p.id);
    detail.textContent=(p.id===winnerId?'ผู้รอดคนสุดท้าย':
      tied?'อันดับร่วม • ตกรอบพร้อมกัน รอบ '+(p.fruitEliminatedRound||s.rounds):
      'ตกรอบ รอบ '+(p.fruitEliminatedRound||s.rounds))+
      totalScoreNote(p);
    row.append(name,detail);list.append(row);
  });
  if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
    const overall=[...ranked].sort((a,b)=>b.total-a.total||String(a.id).localeCompare(String(b.id)));
    // The old design appended twelve more total rows after the twelve
    // round rows (24 rows), hiding some names on compact screens. Show the
    // complete final tournament ranking instead, as every other mode does.
    list.replaceChildren();
    const heading=document.createElement('div');heading.className='tournament-header';
    const joint=overall.filter(p=>p.total===overall[0].total);
    heading.textContent=joint.length===1?'ผู้ชนะรวม: '+joint[0].name:
      'คะแนนรวมเสมอ: '+joint.map(p=>p.name).join(', ');
    list.prepend(heading);
    overall.forEach((p,i)=>{
      const row=document.createElement('div');row.className='result-player';
      const name=document.createElement('div');name.style.color=p.color;
      const competitionRank=1+overall.filter(q=>q.total>p.total).length;
      name.textContent='อันดับ '+competitionRank+' • '+p.name;
      const score=document.createElement('span');score.textContent=p.total+' คะแนนรวม';
      row.append(name,score);list.append(row);
    });
  }
  $('results').classList.remove('hidden');$('gameBanner').textContent='';
  beginResultVoting();
  renderLeaderboard();
}
