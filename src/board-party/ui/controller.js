function snapshot(s){M().assertCompatible(s.map);return JSON.parse(JSON.stringify({mapId:s.map.id,map:s.map,players:s.players,order:s.order,roundNumber:s.roundNumber,turnIndex:s.turnIndex}));}
function controls(s,id){
 const p=s.players.find(p=>p.id===id),mine=current(s)?.id===id;
 if(s.phase==='overview')return{a:'เริ่มทอยลำดับ',b:'',help:'ลากและซูมสำรวจแผนที่ • กด A เมื่อพร้อม'};
 if(s.phase==='intro_zoom')return{a:'',b:'',help:'กำลังซูมไปจุดเริ่มต้น • เตรียมทอยลูกเต๋าหาคนเริ่ม'};
 if(s.phase==='order')return{a:'ทอย',b:'ทอย',help:p?.dice?'ทอยแล้ว • รอเพื่อน':'A หรือ B ทอยลำดับ'};
 if(s.phase==='rewards')return{a:'',b:'',help:'ได้รับไอเทมรางวัลแล้ว'};
 if(s.phase==='lucky_roulette')return{a:'',b:'',help:'LUCKY STAR • กำลังสุ่มไอเทมเข้ากระเป๋า'};
 if(!mine)return{a:'',b:'',help:'รอตาของคุณ • '+(current(s)?.name||'สรุปผล')};
 if(s.phase==='ready'){
  const selected=Math.min(I().ids.length,Math.max(0,Math.trunc(p.actionIndex||0)));
  const kind=selected===0?null:I().ids[selected-1];
  const name=selected===0?'ทอยลูกเต๋า':I().names[kind];
  const a=selected===0?'ทอยลูกเต๋า':['ufo','bomber'].includes(kind)?'เล็งเป้า':'ใช้ไอเทม';
  const b=p.usedRound===s.roundNumber?'ใช้ไอเทมครบแล้ว':'เปลี่ยนไอเทม';
  return{a,b,c:'',help:'เลือก: '+name+' • A '+a+' • B '+b+
   (p.bagMessage?' • '+p.bagMessage:'')};
 }
 if(s.move?.kind==='walk')return{a:s.camera.explore?'เริ่มเดิน':'',b:'',
   help:(s.camera.explore?'ลากจอดูแผนที่หรือซูมสำรวจ • A หรือขยับจอยเพื่อเริ่มเดิน':
     'ลากจอยเดิน / ปล่อยเพื่อหยุด • หน้าจอหลักยังเลื่อนและซูมแผนที่ได้ตลอด')+
     ' • เหลือ '+s.move.remaining+' ก้าว'};
 if(s.phase==='rocket')return{a:'',b:'',help:'จรวด '+Math.max(0,s.move.expires-s.time).toFixed(1)+'s • คุมอนาล็อกไปข้างหน้า ไม่มีจำกัดช่อง'};
  if(s.phase==='branch')return{a:'',b:'',help:'ชี้ทิศทางที่แยกด้วยอนาล็อก'};
 if(s.phase==='aim')return s.skill.kind==='bomber'?
  {a:'ยืนยันโจมตี',b:'หมุน 45°',c:'ยกเลิก',
   help:'กำลังเล็งเครื่องบิน • ทิศ '+(Math.round(s.skill.angle/(Math.PI/4))%8+1)+'/8 • A ยืนยันโจมตี / B หมุนทิศ / C ยกเลิก'}:
  {a:'ยืนยันสลับ',b:'ไม่ใช้',c:'ยกเลิก',
   help:!s.skill.targetId?'ขยับจอยเพื่อเล็ง UFO • A ยืนยันเมื่อเลือกได้ / B ไม่ใช้ / C ยกเลิก':
    'เป้าหมาย: '+(s.players.find(q=>q.id===s.skill.targetId)?.name||'ผู้เล่น')+
    ' • A ยืนยันสลับ / B ไม่ใช้ / C ยกเลิก'};
 if(s.phase==='car')return{a:'',b:'',help:'อนาล็อกขับตามลูกศร • ระเบิดเมื่อชนหรือครบ 6 วินาที'};
 
 return{a:'',b:'',help:'กำลังดำเนินตา'};
}
const api={create,beginOrder,startOrder:beginIntroZoom,updateRocket,MAX_HP,DAMAGE,HEAL,phase,current,axes,ready,startTurn,endTurn,effect,isProtected,blockHarm,damage,win,land,beginMove,step,roll,action,input,update,minigameStarted,minigameEnded,minigameCancelled,snapshot,controls,remainingSteps};
window.BoardParty=Object.freeze(api);
