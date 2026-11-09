(() => {
'use strict';
const roll=(rng=Math.random)=>1+Math.min(5,Math.floor(rng()*6));
function shuffle(list,rng=Math.random){const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function order(players,rng=Math.random){
 // Shuffle within equal totals only; distinct scores can never change places.
 const groups=new Map();for(const p of players){const total=p.dice.reduce((a,b)=>a+b,0);if(!groups.has(total))groups.set(total,[]);groups.get(total).push(p.id);}
 return [...groups.keys()].sort((a,b)=>b-a).flatMap(total=>shuffle(groups.get(total),rng));
}
const TIMING=Object.freeze({throw:1.75,hold:.4});
window.BoardDice=Object.freeze({roll,shuffle,order,TIMING});
})();
