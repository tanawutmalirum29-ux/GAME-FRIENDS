/* Seeded xorshift. Gameplay RNG (rng) and cosmetic RNG (fxr) are separate streams,
   so visuals can never desync spawn positions between devices. */
export function rng(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x||0x3c6ef372;return(s.seed>>>0)/4294967296;}
export function fxr(s){let x=s.fxSeed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.fxSeed=x||0x1b873593;return(s.fxSeed>>>0)/4294967296;}
export function rr(s,a,b){return a+(b-a)*rng(s);}
