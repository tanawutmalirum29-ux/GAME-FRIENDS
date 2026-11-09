/* Per-DataConnection ingress protection. Controller sends 10 Hz heartbeat
 * plus pointer/touch updates; retain a generous 180/s refill, 260 burst.
 * Reject malformed packets before any Host/gameplay dispatch. */
function createControllerIngressGuard(clock=()=>Date.now()){
 const MAX_BYTES=4096,MAX_NODES=100,MAX_DEPTH=5,RATE=180,BURST=260;
 const types=new Set(['join','leave','video-ready','preview-toggle',
  'board-camera-mode','board-camera-gesture','board-camera-zoom',
  'video-quality','pick','lobby-ready','result-vote','target-cycle','input']);
 let tokens=BURST,last=clock(),closed=false;
 function bounded(packet){
  const pending=[{value:packet,depth:0}],seen=new Set();
  let bytes=0,nodes=0;
  while(pending.length){
   const {value,depth}=pending.pop();
   if(++nodes>MAX_NODES||depth>MAX_DEPTH)return false;
   if(value===null){bytes+=4;continue;}
   if(typeof value==='string'){bytes+=value.length*4+2;continue;}
   if(typeof value==='number'){if(!Number.isFinite(value))return false;bytes+=24;continue;}
   if(typeof value==='boolean'){bytes+=5;continue;}
   if(typeof value!=='object'||Array.isArray(value)||seen.has(value))return false;
   const proto=Object.getPrototypeOf(value);
   if(proto!==null&&Object.getPrototypeOf(proto)!==null)return false;
   seen.add(value);
   for(const [k,v] of Object.entries(value)){
    bytes+=k.length*4+4;
    pending.push({value:v,depth:depth+1});
    if(bytes>MAX_BYTES||pending.length>MAX_NODES)return false;
   }
  }
  return bytes<=MAX_BYTES;
 }
 function valid(msg){
  if(!msg||typeof msg!=='object'||Array.isArray(msg)||typeof msg.t!=='string'||!types.has(msg.t))return false;
  if(!bounded(msg))return false;
  switch(msg.t){
   case 'join':return typeof msg.name==='string'&&msg.name.length<=256&&
    (msg.clientToken===undefined||(typeof msg.clientToken==='string'&&msg.clientToken.length<=100))&&
    (msg.protocolVersion===undefined||msg.protocolVersion===1)&&
    (msg.coreHash===undefined||(typeof msg.coreHash==='string'&&/^[a-f0-9]{20}$/.test(msg.coreHash)));
   case 'input':{
    const keys=msg.keys;
    if(!keys||typeof keys!=='object'||Array.isArray(keys))return false;
    for(const [k,v] of Object.entries(keys)){
     if(['left','right','jump','down','action','alt','cancel'].includes(k)){
      if(typeof v!=='boolean')return false;
     }else if(k==='axisX'||k==='axisY'){
      if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1.01)return false;
     }else return false;
    }
    return (msg.actionId===undefined||(Number.isSafeInteger(msg.actionId)&&msg.actionId>=0))&&
     (msg.clientAt===undefined||(Number.isFinite(msg.clientAt)&&msg.clientAt>=0&&msg.clientAt<1e10))&&
     (msg.turnId===undefined||msg.turnId===null||typeof msg.turnId==='string'||Number.isSafeInteger(msg.turnId))&&
     (msg.mapVersion===undefined||msg.mapVersion===null||
      (typeof msg.mapVersion==='string'&&msg.mapVersion.length<=80));
   }
   case 'board-camera-gesture':return ['pan','pinch'].includes(msg.kind)&&
    (msg.kind==='pan'?Number.isFinite(msg.dx)&&Number.isFinite(msg.dy):
     Number.isFinite(msg.scale));
   case 'board-camera-zoom':return msg.direction===1||msg.direction===-1;
   case 'board-camera-mode':case 'preview-toggle':return typeof msg.enabled==='boolean';
   case 'target-cycle':return msg.direction===1||msg.direction===-1;
   case 'pick':return typeof msg.mode==='string'&&msg.mode.length<=80;
   case 'result-vote':return typeof msg.choice==='string'&&msg.choice.length<=40;
   case 'video-ready':return typeof msg.quality==='string'&&msg.quality.length<=20;
   case 'video-quality':return typeof msg.quality==='string'&&msg.quality.length<=20;
   default:return true;
  }
 }
 return {
  accept(packet){
   if(closed)return false;
   // Charge ALL attempts before parsing/validating: malformed floods must
   // consume the same ingress budget as valid joystick packets.
   const now=clock(),elapsed=Math.max(0,Math.min(60000,now-last));
   last=now;tokens=Math.min(BURST,tokens+elapsed*RATE/1000);
   if(tokens<1)return false;
   tokens--;
   try{return valid(packet);}catch(_){return false;}
  },
  dispose(){closed=true;tokens=0;}
 };
}


/* Dedicated analog ingress, never shared with reliable A/B/C commands.
 * Unordered messages must be monotone and rate limited per authenticated
 * data connection. A leaked/forged channel cannot grant action permissions. */
function createFastAxisIngressGuard(clock=()=>Date.now()){
 let tokens=60,lastTime=clock(),lastSeq=-1,closed=false;
 return {
  accept(msg){
   if(closed)return false;
   const now=clock(),elapsed=Math.max(0,Math.min(1000,now-lastTime));
   lastTime=now;tokens=Math.min(60,tokens+elapsed*40/1000);
   if(tokens<1)return false;tokens--;
   if(!msg||typeof msg!=='object'||Array.isArray(msg)||
      Object.keys(msg).some(k=>!['t','seq','x','y','turnId','mapVersion'].includes(k))||
      msg.t!=='axis'||!Number.isSafeInteger(msg.seq)||msg.seq<0||
      msg.seq<=lastSeq||!Number.isFinite(msg.x)||!Number.isFinite(msg.y)||
      Math.abs(msg.x)>1.01||Math.abs(msg.y)>1.01||
      (msg.turnId!==null&&msg.turnId!==undefined&&
        !(typeof msg.turnId==='string'&&msg.turnId.length<=128))||
      (msg.mapVersion!==null&&msg.mapVersion!==undefined&&
        !(typeof msg.mapVersion==='string'&&msg.mapVersion.length<=80)))return false;
   lastSeq=msg.seq;return true;
  },
  dispose(){closed=true;tokens=0;}
 };
}
