const RESULT_ACTION_GRACE_MS=3000;
function resultWaitSeconds(){
 if(!round||!['results','summary'].includes(round.phase))return 0;
 return Math.ceil(Math.max(0,(Number(round.resultActionsUnlockAt)||0)-Date.now())/1000);
}
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
    voteWaitSeconds:resultWaitSeconds(),
    // The same authoritative 7-second auto-next timer drives the host button
    // and each connected phone's A label. Votes do not pause or reset it.
    autoNextSeconds:round.phase==='results'&&round.autoNextRemaining>0?Math.ceil(round.autoNextRemaining):null};
}
function renderResultVotes(sendUpdate=false){
  const v=resultVoteSnapshot();if(!v)return;
  const seconds=v.autoNextSeconds!==null?' • อีก '+v.autoNextSeconds+' วิ':'';
  const wait=v.voteWaitSeconds>0?' • กด A/B ได้ใน '+v.voteWaitSeconds+' วิ':'';
  // Align A/B on the left, action text in the center and votes on the right.
  // The accessibility label contains the full sentence for screen readers.
  const next=$('replayBtn'),back=$('backBtn');
  next.textContent=v.nextLabel+seconds+wait;
  next.disabled=v.voteWaitSeconds>0;
  back.disabled=v.voteWaitSeconds>0;
  next.dataset.action='A';next.dataset.votes=v.next+'/'+v.total;
  next.setAttribute('aria-label','A '+next.textContent+' '+next.dataset.votes);
  back.textContent=v.backLabel;
  back.dataset.action='B';back.dataset.votes=v.lobby+'/'+v.total;
  back.setAttribute('aria-label','B '+v.backLabel+' '+back.dataset.votes);
  // Only broadcast when the displayed second changes or a vote changes;
  // never spam all controllers on every animation frame.
  if(sendUpdate||round.lastBroadcastAutoNextSeconds!==v.autoNextSeconds||
     round.lastBroadcastResultWaitSeconds!==v.voteWaitSeconds){
    round.lastBroadcastAutoNextSeconds=v.autoNextSeconds;
    round.lastBroadcastResultWaitSeconds=v.voteWaitSeconds;
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
  if(['results','summary'].includes(round?.phase)&&resultWaitSeconds()>0)return;
  if(round?.phase==='summary'){returnToLobby();return;}
  if(round?.phase==='results'&&tournament?.endless){
    showCumulativeScores();return;
  }
  returnToLobby();
}
function beginResultVoting(){
  layoutFinalResults();
  // Set a fresh, Host-authoritative A/B lock for each result/summary screen.
  // Held buttons from the minigame cannot skip ranking before it is readable.
  round.resultActionsUnlockAt=Date.now()+RESULT_ACTION_GRACE_MS;
  round.resultVotes={next:new Set(),lobby:new Set()};
  renderResultVotes(true);
}
function castResultVote(conn,choice){
  if(!round||!['results','summary'].includes(round.phase)||!['next','lobby'].includes(choice))return;
  if(resultWaitSeconds()>0)return;
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
// All game-specific score calculations live in the owning engine's getResult API.
function endPluginRound(){
 const engine=round.pluginEngine,results=engine.getResult(round,players);
 const active=players.filter(p=>p.active);
 if(!Array.isArray(results)||results.length!==active.length)throw Error('Incomplete plugin result');
 const scores=new Map();
 for(const item of results){
  if(!item||typeof item.id!=='string'||scores.has(item.id)||
   typeof item.value!=='number'||Number.isNaN(item.value))
   throw Error('Invalid plugin result');
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
 const customTitle=engine.getResultHeading?.(round,ranked,winners);
 $('results').querySelector('h2').textContent=typeof customTitle==='string'&&customTitle?
  customTitle:winners.length===1?'ผู้ชนะ: '+winners[0].name:'เสมอ • อันดับ 1 ร่วม';
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
 // A finite party shows ONE aggregate scoreboard after the last game, not
 // another copy of all round rows. New plug-ins get this behavior for free.
 if(tournament&&!tournament.endless&&tournament.index===tournament.schedule.length-1&&ranked.length){
  const overall=ranked.slice().sort((a,b)=>
   (b.total||0)-(a.total||0)||String(a.id).localeCompare(String(b.id)));
  list.replaceChildren();
  const topScore=overall[0].total||0,leaders=overall.filter(p=>(p.total||0)===topScore);
  const heading=document.createElement('div');heading.className='tournament-header';
  heading.textContent=leaders.length===1?'ผู้ชนะรวม: '+leaders[0].name:
   'คะแนนรวมเสมอ: '+leaders.map(p=>p.name).join(', ');
  list.append(heading);
  for(const p of overall){
   const ranking=1+overall.filter(q=>(q.total||0)>(p.total||0)).length;
   const row=document.createElement('div');row.className='result-player';
   const name=document.createElement('div');name.style.color=p.color;
   name.textContent='อันดับ '+ranking+' • '+p.name;
   const detail=document.createElement('span');detail.textContent=(p.total||0)+' คะแนนรวม';
   row.append(name,detail);list.append(row);
  }
 }
 $('results').classList.remove('hidden');$('gameBanner').textContent='';
 beginResultVoting();renderLeaderboard();
}

function endRound(){
 if(!round||round.phase==='results')return;
 if(boardSession?.phase==='minigame'){
  const ranking=window.BoardMinigame.ranking(round,players);
  if(window.BoardParty.minigameEnded(boardSession,ranking))showBoard();
  return;
 }
 if(boardSession&&round.mode==='board')return;
 // Always use the exact pinned engine for the current round. A hot-patched
 // game is activated only for its next round, not in the middle of results.
 const engine=round.pluginEngine||gameEngine(round.mode);
 if(!engine||typeof engine.getResult!=='function'){
  console.error('Missing minigame getResult provider',round.mode);
  showToast('ระบบอันดับของมินิเกมยังไม่พร้อม',true);
  return;
 }
 round.pluginEngine=engine;
 endPluginRound();
}

