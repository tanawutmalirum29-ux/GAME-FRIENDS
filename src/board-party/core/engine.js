const M=()=>window.BoardMap,D=()=>window.BoardDice,I=()=>window.BoardItems;
const MAX_HP=100;
const INTRO_OVERVIEW_SECONDS=2,INTRO_ZOOM_SECONDS=1.5;
const LUCKY_SPIN_SECONDS=2,LUCKY_HOLD_SECONDS=1.4; // Previous .6-second result hold + .8 seconds.
const DAMAGE=Object.freeze({sword:12,car:18,bomber:26,skull:35,event:14});
const HEAL=Object.freeze({tile:20,event:15,potion:50});
let serial=0;
function create(roster,{seed=Date.now(),rng=Math.random}={}){
 if(!roster.length||roster.length>12)throw Error('BOARD PARTY needs 1–12 players');
 const s={id:'board-'+seed+'-'+(++serial),map:M().create(seed),rng,players:roster.map(p=>({id:p.id,name:p.name,color:p.color,costume:window.PartyPlayerAvatar?.costumeFor(p)||p.costume,isBot:!!p.isBot,currentNodeId:'n0',hp:MAX_HP,item:null,bag:[],bagOpen:false,bagIndex:0,actionIndex:0,bagMessage:'',usedRound:0,shieldTurns:0,shieldRound:null,shieldBrokenAt:null,dice:null,rollAt:0})),order:[],turnIndex:0,roundNumber:1,time:0,revision:0,turnId:'',inputs:{},lastActions:{},phase:'',deadline:0,rolled:false,move:null,skill:null,effect:null,lucky:null,luckyGrantKey:null,results:[],pendingItems:{},winnerIds:[],hits:[],heals:[],swordRewards:[],camera:{x:900,y:1400,zoom:.2,explore:true,overview:true},lastMinigame:null};
 s.camera.x=s.map.width/2;s.camera.y=s.map.height/2;
 phase(s,'overview',Infinity);return s;
}
function beginOrder(s){
 if(s.phase!=='intro_zoom'||s.time+1e-6<s.deadline)return false;
 s.camera.overview=false;s.camera.explore=false;
 s.camera.introFrom=null;
 phase(s,'order',Infinity);return true;
}
function beginIntroZoom(s){
 if(s.phase!=='overview')return false;
 const c=s.camera;
 c.introFrom={x:c.x,y:c.y,zoom:c.zoom};
 c.overview=false;c.explore=false;c.manualZoom=null;c.panned=false;
 phase(s,'intro_zoom',INTRO_ZOOM_SECONDS);
 return true;
}
function phase(s,name,duration=0){s.phase=name;s.phaseAt=s.time;s.deadline=s.time+duration;s.turnId=s.id+':'+(++s.revision);}
// A continuous walk owns one input token until it lands; holding the stick
// across a node must not wait for a network round trip or require another tap.
function movePhase(s,name,duration=8){
 if(s.move?.kind!=='walk'){phase(s,name,duration);return;}
 // Manual walking, pausing and choosing a branch cannot trigger an autoplay timer.
 s.phase=name;s.phaseAt=s.time;s.deadline=Infinity;
}
const current=s=>s.players.find(p=>p.id===s.order[s.turnIndex]);
function axes(s,id){const a=s.inputs[id];return a&&s.time-a.at<.9?{x:a.x,y:a.y}:{x:0,y:0};}
