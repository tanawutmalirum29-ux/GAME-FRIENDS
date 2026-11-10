/* CANDY CHAOS — all balance numbers live here (world units, seconds). */
export const STEP=1/60,TAU=Math.PI*2,EPS=1e-8;
export const C=Object.freeze({
 radius:15,maxSpeed:170,response:11,brake:14,knockDecay:3.2,restitution:.45,
 candyScore:35,bombPenalty:35,candyR:11,
 bombR:14,warnTime:.6,warnDraw:32,bombLife:6.5,bombFade:1,holdMax:.8,
 stun:1.2,stunGrace:.4,hitKnock:95,
 firstBomb:2,finishDelay:.9,
 predictMin:.6,predictMax:1.2,predictChance:.6,predictMinSpeed:35,
 playerGap:58,stunnedGap:92,bombGap:100,candyGap:38,clusterGap:27,edge:34,escapeDist:115,
 maxFx:180,maxFloats:24
});
const SMALL=Object.freeze({key:'small',large:false,w:960,h:540,
 bounds:Object.freeze({x:130,y:56,w:700,h:430}),duration:40,
 candy:Object.freeze([4,7]),bombs:Object.freeze([2,4])});
const LARGE=Object.freeze({key:'large',large:true,w:1280,h:720,
 bounds:Object.freeze({x:110,y:60,w:1060,h:600}),duration:60,
 candy:Object.freeze([7,12]),bombs:Object.freeze([4,7])});
// 1–6 players use the small arena, 7–12 the large one (the 6→7 step is the tier switch).
export function worldFor(n){return n>6?LARGE:SMALL;}
function lerpCount(n,w,range){
 const t=w.large?(n-7)/5:(n-1)/5;
 return Math.round(range[0]+(range[1]-range[0])*Math.max(0,Math.min(1,t)));
}
// candies on the field: random goal in [lo,hi], scaled with the player count inside the tier
export function candyBand(n,w){const hi=lerpCount(n,w,w.candy);return[Math.max(w.candy[0],hi-1),hi];}
export function bombCap(n,w){return lerpCount(n,w,w.bombs);}
