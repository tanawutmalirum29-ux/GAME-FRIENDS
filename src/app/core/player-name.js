/* Shared by the generated host and controller bundles. Keep grapheme clipping here. */
function clipGraphemes(value,maxLength=14){
 const text=String(value??''),limit=Math.max(0,Math.floor(Number(maxLength)||0));
 if(typeof Intl!=='undefined'&&typeof Intl.Segmenter==='function'){
  const segments=new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text);
  const out=[];for(const part of segments){if(out.length>=limit)break;out.push(part.segment);}
  return out.join('');
 }
 // Code-point fallback: never slice UTF-16 surrogate pairs. Group common
 // combining marks, VS, ZWJ emoji, skin-tone modifiers and regional flags.
 const points=Array.from(text),out=[];
 let cluster='',joinNext=false,flagCount=0;
 for(const cp of points){
  const mark=/\p{Mark}/u.test(cp)||/^[\uFE00-\uFE0F]$/u.test(cp);
  const modifier=/^[\u{1F3FB}-\u{1F3FF}]$/u.test(cp);
  const flag=/^[\u{1F1E6}-\u{1F1FF}]$/u.test(cp);
  const link=cp==='\u200d';
  const attach=!!cluster&&(mark||modifier||link||joinNext||(flag&&flagCount%2===1));
  if(!attach){if(cluster)out.push(cluster);cluster=cp;flagCount=flag?1:0;}
  else{cluster+=cp;flagCount=flag?flagCount+1:0;}
  joinNext=link;
  if(out.length>=limit)break;
 }
 if(out.length<limit&&cluster)out.push(cluster);
 return out.slice(0,limit).join('');
}
function cleanName(value){
 return clipGraphemes(String(value??'').trim().replace(/[<>]/g,''),14)||'เพื่อนใหม่';
}
function uniquePlayerName(value,roster=[]){
 const base=cleanName(value);
 const names=new Set((Array.isArray(roster)?roster:[]).map(item=>
  typeof item==='string'?item:item?.name).filter(name=>typeof name==='string'));
 if(!names.has(base))return base;
 for(let index=2;index<100;index++){
  const suffix=' '+index;
  const candidate=clipGraphemes(base,Math.max(0,14-Array.from(suffix).length))+suffix;
  if(!names.has(candidate))return candidate;
 }
 return clipGraphemes(base,9)+' '+String(names.size+1);
}
