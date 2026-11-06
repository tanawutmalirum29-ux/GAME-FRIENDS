/* BOARD PARTY projected 3D ivory dice. Pure vector Canvas renderer: no RNG, DOM or timers.
 * Input results and elapsed time are supplied by the host-authoritative game state. */
(() => {
'use strict';
const PI=Math.PI,TAU=PI*2,DURATION=window.BoardDice.TIMING.throw,HOLD=window.BoardDice.TIMING.hold;
const PIPS=Object.freeze({
  1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],
  4:[[-1,-1],[1,-1],[-1,1],[1,1]],
  5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],
  6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]
});
const FACES=Object.freeze([
  {value:1,n:[0,0,1],u:[1,0,0],v:[0,1,0]},
  {value:6,n:[0,0,-1],u:[-1,0,0],v:[0,1,0]},
  {value:2,n:[1,0,0],u:[0,0,-1],v:[0,1,0]},
  {value:5,n:[-1,0,0],u:[0,0,1],v:[0,1,0]},
  {value:3,n:[0,1,0],u:[1,0,0],v:[0,0,-1]},
  {value:4,n:[0,-1,0],u:[1,0,0],v:[0,0,1]}
]);
function alignment(value){
  switch(value){
   case 2:return [0,-PI/2];
   case 3:return [PI/2,0];
   case 4:return [-PI/2,0];
   case 5:return [0,PI/2];
   case 6:return [0,PI];
   default:return [0,0];
  }
}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=t=>t*t*(3-2*t);
function bounce(t,start,end,peak){if(t<start||t>=end)return 0;const u=(t-start)/(end-start);return peak*4*u*(1-u);}
function pose(value,elapsed=Infinity,index=0){
 const t=Number.isFinite(elapsed)?Math.max(0,elapsed):DURATION;
 const k=clamp(t/DURATION,0,1),spin=1-smooth(k),side=index%2?1:-1;
 const rise=t<1.18?62*4*(t/1.18)*(1-t/1.18):0;
 const height=Math.max(0,rise)+bounce(t,1.18,1.48,14)+bounce(t,1.48,DURATION,4);
 return {
  targetFace:value,animationState:t>=DURATION?'settled':'throwing',
  positionX:side*(8*(1-k)),positionY:(1-k)*11,height,
  rotationX:spin*(side*(2.2*TAU)+1.35),
  rotationY:spin*((index%2?2.5:-2.7)*TAU-.72),
  rotationZ:spin*((index%2?-1.7:1.9)*TAU+.48),
  angularVelocity:t>=DURATION?0:spin*TAU*3,
  velocity:t<1.18?62*4*(1-2*t/1.18)/1.18:0,
  settled:t>=DURATION,glint:clamp((t-DURATION)/.12,0,1)*clamp((DURATION+HOLD-t)/.16,0,1)
 };
}
// Rotate a point in real 3D before projecting with a perspective divide.
// Face alignment is composed BEFORE the same camera tilt for every result.
function rotate(v,p){
 let [x,y,z]=v;
 const rotateX=a=>{const c=Math.cos(a),s=Math.sin(a),yy=y*c-z*s;z=y*s+z*c;y=yy;};
 const rotateY=a=>{const c=Math.cos(a),s=Math.sin(a),xx=x*c+z*s;z=-x*s+z*c;x=xx;};
 const rotateZ=a=>{const c=Math.cos(a),s=Math.sin(a),xx=x*c-y*s;y=x*s+y*c;x=xx;};
 rotateX(p.rotationX);rotateY(p.rotationY);rotateZ(p.rotationZ);
 const [ax,ay]=alignment(p.targetFace);
 rotateX(ax);rotateY(ay);
 rotateX(.27);rotateY(-.26);
 return [x,y,z];
}
function project(v,size){
 const perspective=3.6/(3.6-v[2]*.60);
 return [v[0]*size*perspective,-v[1]*size*perspective];
}
function at(face,u,v,depth=.5){
 return [face.n[0]*depth+face.u[0]*u+face.v[0]*v,
   face.n[1]*depth+face.u[1]*u+face.v[1]*v,
   face.n[2]*depth+face.u[2]*u+face.v[2]*v];
}
function path(g,pts){g.beginPath();pts.forEach((p,i)=>{if(i)g.lineTo(p[0],p[1]);else g.moveTo(p[0],p[1]);});g.closePath();}
function projectedFace(face,p,size){
 const n=rotate(face.n,p),normal=n[2];
 const corners=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([u,v])=>project(rotate(at(face,u,v),p),size));
 const depth=rotate(at(face,0,0),p)[2];
 return {face,normal,corners,depth};
}
function frontFace(value,elapsed=Infinity,index=0){
 const p=pose(value,elapsed,index);
 return FACES.map(f=>({value:f.value,z:rotate(f.n,p)[2]})).sort((a,b)=>b.z-a.z)[0].value;
}
function shadow(g,x,y,size,p,lowDetail){
 const altitude=p.height/Math.max(1,size),radius=1+.26*altitude;
 g.save();
 g.globalAlpha=(lowDetail?.13:.22)/(1+.66*altitude);
 g.fillStyle='#1a2935';g.beginPath();
 g.ellipse(x,y+size*.68,size*.50*radius,size*.17*radius,0,0,TAU);g.fill();
 g.restore();
}
function sparkle(g,x,y,size,p){
 if(p.glint<=0)return;
 g.save();g.strokeStyle='#fff3c6';g.globalAlpha=p.glint*.8;g.lineCap='round';
 for(const [sx,sy,f] of [[-.62,-.58,1],[.66,-.34,.7]]){
  const xx=x+sx*size,yy=y+sy*size,r=size*.11*f;
  g.lineWidth=Math.max(.7,size*.014);g.beginPath();
  g.moveTo(xx-r,yy);g.lineTo(xx+r,yy);g.moveTo(xx,yy-r);g.lineTo(xx,yy+r);g.stroke();
 }
 g.restore();
}
function draw(g,value,x,y,size=60,elapsed=Infinity,index=0,lowDetail=false){
 if(!g)return;
 const hasResult=Number.isInteger(value)&&value>=1&&value<=6;
 const target=hasResult?value:1,p=pose(target,hasResult?elapsed:Infinity,index);
 shadow(g,x+p.positionX,y+size*.09,size,p,lowDetail);
 g.save();g.translate(x+p.positionX,y+p.positionY-p.height);
 const surfaces=FACES.map(face=>projectedFace(face,p,size)).filter(f=>f.normal>0.012).sort((a,b)=>a.depth-b.depth);
 for(const surface of surfaces){
  const face=surface.face,won=hasResult&&p.settled&&face.value===target;
  const light=surface.normal>.66,top=won?'#FFF4CC':light?'#fffcf0':'#f5eedf';
  const bottom=won?'#F6DF9B':light?'#E8DEC8':'#cfc1a8';
  const xs=surface.corners.map(v=>v[0]),ys=surface.corners.map(v=>v[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  path(g,surface.corners);
  if(!lowDetail&&typeof g.createLinearGradient==='function'){
   const grad=g.createLinearGradient(minX,minY,maxX+.001,maxY+.001);
   grad.addColorStop(0,top);grad.addColorStop(1,bottom);g.fillStyle=grad;
  }else g.fillStyle=won?'#F6DF9B':light?'#fdf5e5':'#E8DEC8';
  g.fill();g.lineJoin='round';g.strokeStyle='#D4AB57';g.lineWidth=Math.max(.65,size*.025);g.stroke();
  // Pips are mapped to the same rotated plane as their own face, NEVER swapped.
  if(hasResult){
   for(const [pu,pv] of PIPS[face.value]){
    const u=pu*.26,v=-pv*.26,r=.068;
    const ring=[],dot=[];
    const samples=lowDetail?8:12;
    for(let i=0;i<samples;i++){
     const a=i*TAU/samples;
     ring.push(project(rotate(at(face,u+Math.cos(a)*r*1.20,v+Math.sin(a)*r*1.20,.51),p),size));
     dot.push(project(rotate(at(face,u+Math.cos(a)*r,v+Math.sin(a)*r,.514),p),size));
    }
    path(g,ring);g.fillStyle=won?'#d9b66a':'#e1d3b7';g.fill();
    path(g,dot);g.fillStyle='#4A3823';g.fill();
   }
  }
  if(!lowDetail&&surface.normal>.25){
   const a=project(rotate(at(face,-.39,.36,.516),p),size);
   const b=project(rotate(at(face,.20,.36,.516),p),size);
   g.strokeStyle=won?'#fff9df':'#ffffffa8';g.lineWidth=Math.max(.5,size*.018);
   g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();
  }
 }
 if(!hasResult){
  g.font='700 '+Math.round(size*.46)+'px sans-serif';g.textAlign='center';
  g.textBaseline='middle';g.fillStyle='#796447';g.fillText('?',0,0);
 }
 g.restore();
 if(!lowDetail&&hasResult)sparkle(g,x+p.positionX,y+p.positionY-p.height,size,p);
}
window.BoardDiceRenderer=Object.freeze({draw,pose,frontFace,DURATION,HOLD,PIPS,FACES});
})();