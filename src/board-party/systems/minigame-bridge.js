function minigameStarted(s,mode){if(s.phase!=='minigame_pending')return false;s.lastMinigame=mode;phase(s,'minigame');return true;}
function minigameEnded(s,ranking){
 M().assertCompatible(s.map);
 if(s.phase!=='minigame')return false;
 // Reject incomplete/duplicate outcomes rather than award arbitrary array order.
 if(ranking.length!==s.players.length||new Set(ranking.map(r=>r.id)).size!==s.players.length||ranking.some(r=>!s.players.some(p=>p.id===r.id)))throw Error('Incomplete BOARD PARTY outcome');
 const rewarded=window.BoardMinigame.rewards(ranking,s.players.length,s.rng);
 s.results=ranking.map(r=>({...r,reward:rewarded.includes(r.id)?I().ids[Math.floor(s.rng()*I().ids.length)]:null}));
 // Competition ranks remain unchanged; tied players retain their prior relative order.
 const ranks=new Map(ranking.map(r=>[r.id,r.rank]));
 s.nextOrder=[...s.order].sort((a,b)=>ranks.get(a)-ranks.get(b));
 s.pendingItems={};s.rewardGrantRound=null;phase(s,'standings',3);return true;
}
// If a new or updated plug-in cannot load, keep the BOARD PARTY session.
 // The failed game grants no random items or advantage, and the original
 // turn order, node positions and HP remain untouched.
function minigameCancelled(s){
 M().assertCompatible(s.map);
 if(s.phase!=='minigame')return false;
 s.results=s.players.map(p=>({id:p.id,rank:1,value:0,
  label:'ข้ามมินิเกมที่ไม่พร้อมเล่น',reward:null}));
 s.nextOrder=[...s.order];
 s.pendingItems={};s.rewardGrantRound=null;
 phase(s,'standings',3);
 return true;
}
function grant(s){
 // A single minigame can never add rewards twice even if a stale render/update
 // repeats a transition. State and awarded count are owned by this round.
 if(s.rewardGrantRound===s.roundNumber)return false;
 s.rewardGrantRound=s.roundNumber;
 // Rewards are collected, never silently discarded or forcibly substituted.
 // Multiple identical item types may coexist and are consumed individually.
 for(const r of s.results){
  if(!r.reward)continue;
  const p=s.players.find(p=>p.id===r.id);
  if(p)I().add(p,r.reward);
 }
 s.pendingItems={};
 phase(s,'rewards',4.5);
 return true;
}
