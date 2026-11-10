/* DINO PANIC — shared constants (world units; physics never uses screen pixels). */
export const STEP=1/60,TAU=Math.PI*2;
export const C=Object.freeze({
 R:15,                // body hit radius (PartyCharacters default). Sprite is 52 wide and is NOT a hit circle.
 speed:150,           // max walking speed of EVERY runner and the constant speed of the dinosaur (units/s)
 gap0:440,            // distance from dinosaur front to the first spawn column
 colGap:34,           // extra column spacing when 10–12 runners need two spawn columns
 firstGap:520,        // free run between the last spawn column and the first obstacle chunk
 endRun:380,          // free run between the last chunk and the finish line
 endZone:340,         // finish area behind the line (finished runners park here)
 cell:8,              // path-validation / bot grid cell
 crate:22,            // crate half size
 tiers:Object.freeze([
  Object.freeze({maxPlayers:6,name:'small',top:120,bottom:420,runSeconds:45,cumOverhead:.022,chunkOverhead:26}),
  Object.freeze({maxPlayers:12,name:'large',top:80,bottom:460,runSeconds:60,cumOverhead:.022,chunkOverhead:28})
 ])
});
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const mkRng=seed=>{let x=(seed>>>0)||1;return()=>{x=(x^(x<<13))>>>0;x=(x^(x>>>17))>>>0;x=(x^(x<<5))>>>0;return x/4294967296;};};
export function hash01(a,b){let h=(a^Math.imul(b+1,2654435761))>>>0;h^=h>>>15;h=Math.imul(h,2246822519);h^=h>>>13;h=Math.imul(h,3266489917);h^=h>>>16;return(h>>>0)/4294967296;}
export function tierFor(count){
 if(typeof window!=='undefined'&&window.PartyArenaScale?.tier)return window.PartyArenaScale.tier(count,C.tiers);
 return C.tiers.find(t=>count<=t.maxPlayers)||C.tiers[C.tiers.length-1];
}
/* binary min-heap shared by the path validator and the bots */
export class Heap{
 constructor(){this.k=[];this.v=[];}
 get size(){return this.k.length;}
 push(key,val){const k=this.k,v=this.v;let i=k.length;k.push(key);v.push(val);
  while(i>0){const p=(i-1)>>1;if(k[p]<=key)break;k[i]=k[p];v[i]=v[p];i=p;}k[i]=key;v[i]=val;}
 pop(){const k=this.k,v=this.v,rk=k[0],rv=v[0],lk=k.pop(),lv=v.pop(),n=k.length;
  if(n>0){let i=0;for(;;){let c=2*i+1;if(c>=n)break;if(c+1<n&&k[c+1]<k[c])c++;if(k[c]>=lk)break;k[i]=k[c];v[i]=v[c];i=c;}k[i]=lk;v[i]=lv;}
  this.rk=rk;return rv;}
}
export const NB=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.4142],[1,-1,1.4142],[-1,1,1.4142],[-1,-1,1.4142]];
