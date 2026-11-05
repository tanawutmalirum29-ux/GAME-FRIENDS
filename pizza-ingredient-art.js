/* Original hand-drawn SVG ingredient artwork shared by PIZZA TIME Canvas + DOM.
   No emoji glyphs or external image assets. */
(() => {
'use strict';
const shapes=Object.freeze({
 tomato:'<circle cx="24" cy="26" r="18" fill="#d73530" stroke="#8f2527" stroke-width="2"/><ellipse cx="19" cy="19" rx="9" ry="6" fill="#f56b58" opacity=".65"/><path d="M24 14c-5-9-6-8-7-5 0 0-4-3-6 1l9 7-7 5 11-3 10 3-6-6 10-6-11 3-3-9-3 10Z" fill="#4a9b47" stroke="#367d3d" stroke-width="1.4"/><path d="M24 13v-8" stroke="#31743e" stroke-width="3" stroke-linecap="round"/>',
 cheese:'<path d="M7 37 26 7 42 36Q42 41 36 41H11Q7 41 7 37Z" fill="#f6c748" stroke="#b77a22" stroke-width="2"/><path d="M7 37 26 7 27 22 42 36Z" fill="#ffe583"/><circle cx="25" cy="30" r="4.4" fill="#db9e30"/><ellipse cx="15" cy="35" rx="3.6" ry="2.7" fill="#dc9c2a"/><circle cx="28" cy="19" r="2.9" fill="#deaa37"/><path d="M12 38h25" stroke="#d49f2c" stroke-width="2" opacity=".8"/>',
 mushroom:'<path d="M18 23h12l-1 16H19Z" fill="#f3debd" stroke="#ad8d72" stroke-width="2"/><path d="M5 23C6 10 14 6 24 6c12 0 19 7 20 17H5Z" fill="#a87662" stroke="#704b48" stroke-width="2"/><path d="M7 23q17 12 35 0" fill="#e7bc9e"/><circle cx="17" cy="15" r="4.6" fill="#f7d6b0" opacity=".8"/><ellipse cx="33" cy="18" rx="3.8" ry="3" fill="#f3ccad" opacity=".8"/>',
 pepperoni:'<circle cx="24" cy="24" r="18" fill="#ac3a36" stroke="#752d2f" stroke-width="2"/><path d="M14 10Q22 6 31 10" fill="none" stroke="#d45f4b" stroke-width="3"/><g fill="#ec997c"><circle cx="16" cy="18" r="4"/><circle cx="31" cy="16" r="3.8"/><circle cx="33" cy="31" r="4.5"/><circle cx="16" cy="32" r="3.8"/><circle cx="24" cy="25" r="2.5"/></g><g fill="#7f2b2a"><circle cx="21" cy="14" r="1.7"/><circle cx="37" cy="23" r="1.5"/><circle cx="24" cy="37" r="1.4"/></g>',
 pepper:'<path d="M24 11Q14 8 11 18C5 32 14 42 22 42c5-1 4-1 8 0 13-1 17-16 9-25-4-8-11-7-15-6Z" fill="#4cb95c" stroke="#278043" stroke-width="2"/><path d="M23 10q3-7 8-7" fill="none" stroke="#428b43" stroke-width="4" stroke-linecap="round"/><path d="M24 12Q17 21 20 40M29 12Q37 26 30 40" stroke="#83d27a" stroke-width="2.5" fill="none"/><ellipse cx="15" cy="22" rx="3" ry="8" fill="#a3e48f" opacity=".45"/>',
 onion:'<path d="M24 5Q12 15 10 25C8 39 16 44 24 44s16-5 14-19C36 15 27 9 24 5Z" fill="#ce98d6" stroke="#8f64b8" stroke-width="2"/><path d="M24 11c-11 13-13 26 0 32M25 11c11 13 13 26 0 32" fill="none" stroke="#f4d6f4" stroke-width="2.5"/><path d="M20 5q4-3 8 0" fill="none" stroke="#8d60a8" stroke-width="2.5"/><ellipse cx="17" cy="22" rx="3" ry="7" fill="#fff" opacity=".18"/>',
 pineapple:'<path d="M24 13 10 6l8 1L17 2l9 10 5-10-1 8 9-5-9 12Z" fill="#448e3b" stroke="#2f6e37" stroke-width="1.5"/><path d="M12 17Q15 11 24 12q11-1 13 7l-2 17Q30 43 24 43t-11-7Z" fill="#e9bf40" stroke="#ad822d" stroke-width="2"/><g fill="none" stroke="#bc9136" stroke-width="2"><path d="m12 21 23 17m-21-24 23 20M12 35l24-18M16 41l20-19"/></g><g fill="#ffe67b"><circle cx="23" cy="25" r="2"/><circle cx="29" cy="30" r="2"/></g>',
 basil:'<path d="M24 42V7" fill="none" stroke="#326e40" stroke-width="3" stroke-linecap="round"/><path d="M24 35C8 37 5 25 9 15c11-1 15 9 15 20ZM24 30c0-16 7-22 18-21 0 14-6 20-18 21Z" fill="#4bac6c" stroke="#287f46" stroke-width="2"/><path d="M24 36 12 19M24 30l13-16" stroke="#98df9b" stroke-width="2"/><path d="M25 18c-6-10-2-14 1-15 6 6 7 10-1 15Z" fill="#55b75b"/>'
});
const SVG_NS='http://www.w3.org/2000/svg';
const names=Object.freeze({
 tomato:'มะเขือเทศ',cheese:'ชีส',mushroom:'เห็ด',pepperoni:'เปปเปอโรนี',
 pepper:'พริกหวาน',onion:'หัวหอม',pineapple:'สับปะรด',basil:'ใบโหระพา'
});
const cache=new Map();
function svg(id,opts={}){
 const body=shapes[id];
 if(!body)return '';
 const done=opts.done===true;
 const marks=done?'<circle cx="38" cy="38" r="9" fill="#2ba66a" stroke="#fff" stroke-width="2"/><path d="m33 38 3.5 3.5L43 34" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>':'';
 return '<svg xmlns="'+SVG_NS+'" viewBox="0 0 48 48" fill="none" class="pizza-ingredient-svg" focusable="false" aria-hidden="true">'+body+marks+'</svg>';
}
function imageFor(id){
 if(!shapes[id]||typeof Image==='undefined')return null;
 if(cache.has(id))return cache.get(id);
 const image=new Image();image.decoding='async';
 image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(id));
 cache.set(id,image);return image;
}
function preload(){for(const id of Object.keys(shapes))imageFor(id);}
function draw(ctx,id,x,y,size=20){
 const img=imageFor(id);
 if(img&&img.complete&&img.naturalWidth>0&&typeof ctx.drawImage==='function'){
   const w=Math.max(1,Number(size)||20)*2.15;
   ctx.drawImage(img,x-w/2,y-w/2,w,w);
   return true;
 }
 return false;
}
function item(doc,id,{done=false,size=18,showName=false}={}){
 if(!shapes[id]||!doc?.createElement)return null;
 const node=doc.createElement('span');node.className='pizza-ingredient-icon'+(done?' is-delivered':'');
 node.style.setProperty('--pizza-icon-size',Math.max(12,Math.min(48,size))+'px');
 node.innerHTML=svg(id,{done});
 node.title=names[id]+(done?' • ส่งแล้ว':'');
 node.setAttribute('aria-label',node.title);
 if(showName){
   const title=doc.createElement('span');title.className='pizza-ingredient-label';title.textContent=names[id];
   node.append(title);
 }
 return node;
}
function appendRow(container,ids,delivered=[],{size=18,showName=false}={}){
 if(!container)return;
 const doc=container.ownerDocument||(typeof document!=='undefined'?document:null);
 container.replaceChildren();
 for(const id of ids||[]){
   const icon=item(doc,id,{done:(delivered||[]).includes(id),size,showName});
   if(icon)container.append(icon);
 }
}
preload();
window.PizzaIngredientArt=Object.freeze({svg,draw,item,appendRow,preload,ids:Object.freeze(Object.keys(shapes)),names});
})();