'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const timers=[],statuses=[],state={room:'ABC123',players:['p1'],board:{hp:75,inventory:['shield'],turn:4}};
 let id=0;
 const setTimeout=(fn,ms)=>{const t={id:++id,fn,ms,cancelled:false};timers.push(t);return t.id;};
 const clearTimeout=id=>{const t=timers.find(t=>t.id===id);if(t)t.cancelled=true;};
 const peer={open:false,disconnected:true,destroyed:false,reconnectCount:0,
  disconnect(){this.disconnected=true;this.onDisconnect?.();},
  reconnect(){
   if(!this.disconnected||this.destroyed)throw Error('PeerJS reconnect precondition');
   this.disconnected=false;this.reconnectCount++;
  }};
 const deterministicMath=Object.create(Math);deterministicMath.random=()=>0;
 const ctx=vm.createContext({window:{},Math:deterministicMath,peer,
  hostPeer:peer,onlineHost:true,hostOpenAttempt:7,setTimeout,clearTimeout,
  setStatus:(msg)=>statuses.push(msg)});
 vm.runInContext(fs.readFileSync('src/app/core/host-reconnect.js','utf8'),ctx);
 function call(expr){return vm.runInContext(expr,ctx);}
 peer.onDisconnect=()=>call('recoverHostSignal(peer,7)');
 const fireTimer=()=>{
  const t=timers.find(t=>!t.cancelled&&!t.executed);
  assert.ok(t,'expected pending recovery timer');
  t.executed=true;t.fn();return t.ms;
 };
 const pending=()=>timers.filter(t=>!t.cancelled&&!t.executed);
 return {ctx,peer,timers,statuses,state,call,fireTimer,pending};
}
{
 const f=fixture(),before=JSON.stringify(f.state);
 f.call('recoverHostSignal(peer,7)');
 f.call('recoverHostSignal(peer,7)');
 assert.equal(f.pending().length,1,'repeated disconnected event cannot duplicate timer');
 assert.equal(f.fireTimer(),1000);
 assert.equal(f.peer.reconnectCount,1);
 assert.equal(f.pending().length,1,'one watchdog follows a reconnect attempt');
 assert.equal(f.fireTimer(),5000,'unanswered handshake triggers finite watchdog');
 assert.equal(f.pending().length,1,'watchdog schedules exactly one further attempt');
 assert.equal(f.fireTimer(),2000);
 assert.equal(f.peer.reconnectCount,2);
 f.peer.open=true;f.call('resetHostReconnect()');
 assert.equal(f.pending().length,0,'open clears watchdog and retry timer');
 assert.equal(f.call('hostReconnectTries'),0);
 assert.equal(JSON.stringify(f.state),before,'room, player identity and Board state stay intact');
}
{
 const f=fixture();f.call('recoverHostSignal(peer,7)');
 const backoffs=[];
 for(let i=0;i<8;i++){
  backoffs.push(f.fireTimer());
  assert.equal(f.peer.reconnectCount,i+1);
  f.peer.disconnected=true;
  f.call('recoverHostSignal(peer,7)');
 }
 assert.deepEqual(backoffs,[1000,2000,4000,8000,16000,16000,16000,16000]);
 assert.equal(f.pending().length,0,'eight attempts stop without infinite timers');
 assert.match(f.statuses.at(-1),/ห้องยังอยู่/);
 assert.equal(f.peer.destroyed,false,'existing peer never destroyed by recovery manager');
}
{
 const f=fixture();f.call('recoverHostSignal(peer,7)');
 const t=f.pending()[0];
 f.call('stopHostReconnect()');
 assert.equal(t.cancelled,true);
 t.fn();
 assert.equal(f.peer.reconnectCount,0,'a closed room never reconnects from an old timer');
}
console.log('HOST RECONNECT PASS: 8 backoff intervals, watchdog, one timer, stopped teardown, immutable room state');
