/* Handcrafted winter expedition, v6. All coordinates, edges, terrain, bridges,
 * tile roles and decoration placements below are authored, never seeded.
 * Version v6 relocates a Lucky Star and adds two sword territory pairs; reject stale rooms. */
(()=>{
'use strict';
function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const MAIN_LENGTH=152,
 SWORD_PAIRS=Object.freeze([
  Object.freeze({id:'sword-territory-14',nodeIds:Object.freeze(['n14','n15'])}),
  Object.freeze({id:'sword-territory-43',nodeIds:Object.freeze(['n43','n44'])}),
  Object.freeze({id:'sword-territory-b33_9',nodeIds:Object.freeze(['b33_9','b33_10'])}),
  Object.freeze({id:'sword-territory-27',nodeIds:Object.freeze(['n27','n28'])}),
  Object.freeze({id:'sword-territory-59',nodeIds:Object.freeze(['n59','n60'])}),
  Object.freeze({id:'sword-territory-69',nodeIds:Object.freeze(['n69','n70'])}),
  Object.freeze({id:'sword-territory-85',nodeIds:Object.freeze(['n85','n86'])}),
  Object.freeze({id:'sword-territory-c76_10',nodeIds:Object.freeze(['c76_10','c76_11'])}),
  Object.freeze({id:'sword-territory-103',nodeIds:Object.freeze(['n103','n104'])}),
  Object.freeze({id:'sword-territory-124',nodeIds:Object.freeze(['n124','n125'])}),
  Object.freeze({id:'sword-territory-137',nodeIds:Object.freeze(['n137','n138'])})
 ]),
 SWORD_TILES=Object.freeze(SWORD_PAIRS.flatMap(pair=>pair.nodeIds)),TERRITORY_ID=SWORD_PAIRS[0].id;
function neighbors(map,id){const n=map.nodes[id];return [...n.nextNodes,...n.previousNodes];}
function adjacentType(map,id,type){return neighbors(map,id).some(k=>map.nodes[k]?.type===type);}
const FIXED_MAP={
  "version": "winter-expedition-152-v6",
  "nodes": {
    "n0": {"id":"n0","position":{"x":650,"y":4750},"type":"start","nextNodes":["n1"],"previousNodes":[],"islandId":"village","progress":0,"effects":{},"remainingSteps":140,"longestRemainingSteps":174},
    "n1": {"id":"n1","position":{"x":800,"y":4800},"type":"movement","nextNodes":["n2"],"previousNodes":["n0"],"islandId":"village","progress":1,"effects":{},"remainingSteps":139,"longestRemainingSteps":173},
    "n2": {"id":"n2","position":{"x":960,"y":4800},"type":"movement","nextNodes":["n3"],"previousNodes":["n1"],"islandId":"village","progress":2,"effects":{},"remainingSteps":138,"longestRemainingSteps":172},
    "n3": {"id":"n3","position":{"x":1120,"y":4750},"type":"movement","nextNodes":["n4","b3_1"],"previousNodes":["n2"],"islandId":"village","progress":3,"effects":{},"remainingSteps":137,"longestRemainingSteps":171},
    "n4": {"id":"n4","position":{"x":1270,"y":4650},"type":"movement","nextNodes":["n5"],"previousNodes":["n3"],"islandId":"village","progress":4,"effects":{},"remainingSteps":138,"longestRemainingSteps":170},
    "n5": {"id":"n5","position":{"x":1400,"y":4500},"type":"danger","nextNodes":["n6"],"previousNodes":["n4"],"islandId":"village","progress":5,"effects":{"hp":-35},"remainingSteps":137,"longestRemainingSteps":169},
    "n6": {"id":"n6","position":{"x":1400,"y":4320},"type":"lucky","nextNodes":["n7"],"previousNodes":["n5"],"islandId":"village","progress":6,"effects":{"item":true},"remainingSteps":136,"longestRemainingSteps":168},
    "n7": {"id":"n7","position":{"x":1260,"y":4190},"type":"movement","nextNodes":["n8"],"previousNodes":["n6"],"islandId":"village","progress":7,"effects":{},"remainingSteps":135,"longestRemainingSteps":167},
    "n8": {"id":"n8","position":{"x":1080,"y":4190},"type":"movement","nextNodes":["n9"],"previousNodes":["n7"],"islandId":"village","progress":8,"effects":{},"remainingSteps":134,"longestRemainingSteps":166},
    "n9": {"id":"n9","position":{"x":920,"y":4300},"type":"movement","nextNodes":["n10"],"previousNodes":["n8","b3_3"],"islandId":"village","progress":9,"effects":{},"remainingSteps":133,"longestRemainingSteps":165},
    "n10": {"id":"n10","position":{"x":750,"y":4340},"type":"movement","nextNodes":["n11"],"previousNodes":["n9"],"islandId":"village","progress":10,"effects":{},"remainingSteps":132,"longestRemainingSteps":164},
    "n11": {"id":"n11","position":{"x":580,"y":4250},"type":"movement","nextNodes":["n12"],"previousNodes":["n10"],"islandId":"village","progress":11,"effects":{},"remainingSteps":131,"longestRemainingSteps":163},
    "n12": {"id":"n12","position":{"x":500,"y":4060},"type":"healing","nextNodes":["n13"],"previousNodes":["n11"],"islandId":"village","progress":12,"effects":{"hp":20},"remainingSteps":130,"longestRemainingSteps":162},
    "n13": {"id":"n13","position":{"x":550,"y":3870},"type":"movement","nextNodes":["n14"],"previousNodes":["n12"],"islandId":"village","progress":13,"effects":{},"remainingSteps":129,"longestRemainingSteps":161},
    "n14": {"id":"n14","position":{"x":720,"y":3750},"type":"sword","nextNodes":["n15"],"previousNodes":["n13"],"islandId":"village","progress":14,"effects":{},"remainingSteps":128,"longestRemainingSteps":160,"territoryId":"sword-territory-14","ownerId":null},
    "n15": {"id":"n15","position":{"x":920,"y":3720},"type":"sword","nextNodes":["n16"],"previousNodes":["n14"],"islandId":"village","progress":15,"effects":{},"remainingSteps":127,"longestRemainingSteps":159,"territoryId":"sword-territory-14","ownerId":null},
    "n16": {"id":"n16","position":{"x":1080,"y":3810},"type":"movement","nextNodes":["n17"],"previousNodes":["n15"],"islandId":"village","progress":16,"effects":{},"remainingSteps":126,"longestRemainingSteps":158},
    "n17": {"id":"n17","position":{"x":1230,"y":3900},"type":"lucky","nextNodes":["n18"],"previousNodes":["n16"],"islandId":"village","progress":17,"effects":{"item":true},"remainingSteps":125,"longestRemainingSteps":157},
    "n18": {"id":"n18","position":{"x":1410,"y":3890},"type":"movement","nextNodes":["n19"],"previousNodes":["n17"],"islandId":"village","progress":18,"effects":{},"remainingSteps":124,"longestRemainingSteps":156},
    "n19": {"id":"n19","position":{"x":1570,"y":3790},"type":"movement","nextNodes":["n20"],"previousNodes":["n18"],"islandId":"village","progress":19,"effects":{},"remainingSteps":123,"longestRemainingSteps":155},
    "n20": {"id":"n20","position":{"x":1640,"y":3610},"type":"movement","nextNodes":["n21"],"previousNodes":["n19"],"islandId":"village","progress":20,"effects":{},"remainingSteps":122,"longestRemainingSteps":154},
    "n21": {"id":"n21","position":{"x":1580,"y":3430},"type":"movement","nextNodes":["n22"],"previousNodes":["n20"],"islandId":"village","progress":21,"effects":{},"remainingSteps":121,"longestRemainingSteps":153},
    "n22": {"id":"n22","position":{"x":1400,"y":3350},"type":"movement","nextNodes":["n23"],"previousNodes":["n21"],"islandId":"village","progress":22,"effects":{},"remainingSteps":120,"longestRemainingSteps":152},
    "n23": {"id":"n23","position":{"x":1200,"y":3350},"type":"movement","nextNodes":["n24"],"previousNodes":["n22"],"islandId":"village","progress":23,"effects":{},"remainingSteps":119,"longestRemainingSteps":151},
    "n24": {"id":"n24","position":{"x":1000,"y":3360},"type":"healing","nextNodes":["n25"],"previousNodes":["n23"],"islandId":"village","progress":24,"effects":{"hp":20},"remainingSteps":118,"longestRemainingSteps":150},
    "n25": {"id":"n25","position":{"x":800,"y":3300},"type":"movement","nextNodes":["n26"],"previousNodes":["n24"],"islandId":"village","progress":25,"effects":{},"remainingSteps":117,"longestRemainingSteps":149},
    "n26": {"id":"n26","position":{"x":800,"y":3000},"type":"movement","nextNodes":["n27"],"previousNodes":["n25"],"islandId":null,"progress":26,"effects":{},"bridgeId":"harbor-out","remainingSteps":116,"longestRemainingSteps":148},
    "n27": {"id":"n27","position":{"x":800,"y":2700},"type":"sword","nextNodes":["n28"],"previousNodes":["n26"],"islandId":null,"progress":27,"effects":{},"bridgeId":"harbor-out","remainingSteps":115,"longestRemainingSteps":147,"territoryId":"sword-territory-27","ownerId":null},
    "n28": {"id":"n28","position":{"x":800,"y":2400},"type":"sword","nextNodes":["n29"],"previousNodes":["n27"],"islandId":null,"progress":28,"effects":{},"bridgeId":"harbor-out","remainingSteps":114,"longestRemainingSteps":146,"territoryId":"sword-territory-27","ownerId":null},
    "n29": {"id":"n29","position":{"x":800,"y":2130},"type":"movement","nextNodes":["n30"],"previousNodes":["n28"],"islandId":"grove","progress":29,"effects":{},"remainingSteps":113,"longestRemainingSteps":145},
    "n30": {"id":"n30","position":{"x":600,"y":2040},"type":"movement","nextNodes":["n31"],"previousNodes":["n29"],"islandId":"grove","progress":30,"effects":{},"remainingSteps":112,"longestRemainingSteps":144},
    "n31": {"id":"n31","position":{"x":480,"y":1880},"type":"lucky","nextNodes":["n32"],"previousNodes":["n30"],"islandId":"grove","progress":31,"effects":{"item":true},"remainingSteps":111,"longestRemainingSteps":143},
    "n32": {"id":"n32","position":{"x":480,"y":1680},"type":"movement","nextNodes":["n33"],"previousNodes":["n31"],"islandId":"grove","progress":32,"effects":{},"remainingSteps":110,"longestRemainingSteps":142},
    "n33": {"id":"n33","position":{"x":600,"y":1510},"type":"movement","nextNodes":["n34","b33_1"],"previousNodes":["n32"],"islandId":"grove","progress":33,"effects":{},"remainingSteps":109,"longestRemainingSteps":141},
    "n34": {"id":"n34","position":{"x":800,"y":1460},"type":"movement","nextNodes":["n35"],"previousNodes":["n33"],"islandId":"grove","progress":34,"effects":{},"remainingSteps":109,"longestRemainingSteps":140},
    "n35": {"id":"n35","position":{"x":980,"y":1520},"type":"healing","nextNodes":["n36"],"previousNodes":["n34"],"islandId":"grove","progress":35,"effects":{"hp":20},"remainingSteps":108,"longestRemainingSteps":139},
    "n36": {"id":"n36","position":{"x":1120,"y":1680},"type":"movement","nextNodes":["n37"],"previousNodes":["n35"],"islandId":"grove","progress":36,"effects":{},"remainingSteps":107,"longestRemainingSteps":138},
    "n37": {"id":"n37","position":{"x":1280,"y":1790},"type":"movement","nextNodes":["n38","b37_1"],"previousNodes":["n36"],"islandId":"grove","progress":37,"effects":{},"remainingSteps":106,"longestRemainingSteps":137},
    "n38": {"id":"n38","position":{"x":1480,"y":1790},"type":"movement","nextNodes":["n39"],"previousNodes":["n37"],"islandId":"grove","progress":38,"effects":{},"remainingSteps":105,"longestRemainingSteps":132},
    "n39": {"id":"n39","position":{"x":1650,"y":1670},"type":"movement","nextNodes":["n40"],"previousNodes":["n38"],"islandId":"grove","progress":39,"effects":{},"remainingSteps":104,"longestRemainingSteps":131},
    "n40": {"id":"n40","position":{"x":1690,"y":1480},"type":"danger","nextNodes":["n41"],"previousNodes":["n39"],"islandId":"grove","progress":40,"effects":{"hp":-35},"remainingSteps":103,"longestRemainingSteps":130},
    "n41": {"id":"n41","position":{"x":1590,"y":1320},"type":"movement","nextNodes":["n42"],"previousNodes":["n40","b37_7"],"islandId":"grove","progress":41,"effects":{},"remainingSteps":102,"longestRemainingSteps":129},
    "n42": {"id":"n42","position":{"x":1410,"y":1260},"type":"lucky","nextNodes":["n43"],"previousNodes":["n41"],"islandId":"grove","progress":42,"effects":{"item":true},"remainingSteps":101,"longestRemainingSteps":128},
    "n43": {"id":"n43","position":{"x":1220,"y":1200},"type":"sword","nextNodes":["n44"],"previousNodes":["n42"],"islandId":"grove","progress":43,"effects":{},"remainingSteps":100,"longestRemainingSteps":127,"territoryId":"sword-territory-43","ownerId":null},
    "n44": {"id":"n44","position":{"x":1090,"y":1040},"type":"sword","nextNodes":["n45"],"previousNodes":["n43"],"islandId":"grove","progress":44,"effects":{},"remainingSteps":99,"longestRemainingSteps":126,"territoryId":"sword-territory-43","ownerId":null},
    "n45": {"id":"n45","position":{"x":1090,"y":840},"type":"movement","nextNodes":["n46"],"previousNodes":["n44","b33_10"],"islandId":"grove","progress":45,"effects":{},"remainingSteps":98,"longestRemainingSteps":125},
    "n46": {"id":"n46","position":{"x":1230,"y":680},"type":"movement","nextNodes":["n47"],"previousNodes":["n45"],"islandId":"grove","progress":46,"effects":{},"remainingSteps":97,"longestRemainingSteps":124},
    "n47": {"id":"n47","position":{"x":1440,"y":630},"type":"movement","nextNodes":["n48"],"previousNodes":["n46"],"islandId":"grove","progress":47,"effects":{},"remainingSteps":96,"longestRemainingSteps":123},
    "n48": {"id":"n48","position":{"x":1640,"y":680},"type":"healing","nextNodes":["n49"],"previousNodes":["n47"],"islandId":"grove","progress":48,"effects":{"hp":20},"remainingSteps":95,"longestRemainingSteps":122},
    "n49": {"id":"n49","position":{"x":1840,"y":800},"type":"danger","nextNodes":["n50"],"previousNodes":["n48"],"islandId":"grove","progress":49,"effects":{"hp":-35},"remainingSteps":94,"longestRemainingSteps":121},
    "n50": {"id":"n50","position":{"x":1990,"y":970},"type":"movement","nextNodes":["n51"],"previousNodes":["n49"],"islandId":"grove","progress":50,"effects":{},"remainingSteps":93,"longestRemainingSteps":120},
    "n51": {"id":"n51","position":{"x":2060,"y":1170},"type":"movement","nextNodes":["n52"],"previousNodes":["n50"],"islandId":"grove","progress":51,"effects":{},"remainingSteps":92,"longestRemainingSteps":119},
    "n52": {"id":"n52","position":{"x":2070,"y":1390},"type":"movement","nextNodes":["n53"],"previousNodes":["n51"],"islandId":"grove","progress":52,"effects":{},"remainingSteps":91,"longestRemainingSteps":118},
    "n53": {"id":"n53","position":{"x":2050,"y":1600},"type":"lucky","nextNodes":["n54"],"previousNodes":["n52"],"islandId":"grove","progress":53,"effects":{"item":true},"remainingSteps":90,"longestRemainingSteps":117},
    "n54": {"id":"n54","position":{"x":2020,"y":1810},"type":"movement","nextNodes":["n55"],"previousNodes":["n53"],"islandId":"grove","progress":54,"effects":{},"remainingSteps":89,"longestRemainingSteps":116},
    "n55": {"id":"n55","position":{"x":1950,"y":2010},"type":"danger","nextNodes":["n56"],"previousNodes":["n54"],"islandId":"grove","progress":55,"effects":{"hp":-35},"remainingSteps":88,"longestRemainingSteps":115},
    "n56": {"id":"n56","position":{"x":1810,"y":2150},"type":"movement","nextNodes":["n57"],"previousNodes":["n55"],"islandId":"grove","progress":56,"effects":{},"remainingSteps":87,"longestRemainingSteps":114},
    "n57": {"id":"n57","position":{"x":1810,"y":2440},"type":"movement","nextNodes":["n58"],"previousNodes":["n56"],"islandId":null,"progress":57,"effects":{},"bridgeId":"harbor-return","remainingSteps":86,"longestRemainingSteps":113},
    "n58": {"id":"n58","position":{"x":1810,"y":2740},"type":"movement","nextNodes":["n59"],"previousNodes":["n57"],"islandId":null,"progress":58,"effects":{},"bridgeId":"harbor-return","remainingSteps":85,"longestRemainingSteps":112},
    "n59": {"id":"n59","position":{"x":1810,"y":3040},"type":"sword","nextNodes":["n60"],"previousNodes":["n58"],"islandId":null,"progress":59,"effects":{},"bridgeId":"harbor-return","remainingSteps":84,"longestRemainingSteps":111,"territoryId":"sword-territory-59","ownerId":null},
    "n60": {"id":"n60","position":{"x":1850,"y":3350},"type":"sword","nextNodes":["n61"],"previousNodes":["n59"],"islandId":"village","progress":60,"effects":{},"remainingSteps":83,"longestRemainingSteps":110,"territoryId":"sword-territory-59","ownerId":null},
    "n61": {"id":"n61","position":{"x":1980,"y":3500},"type":"lucky","nextNodes":["n62"],"previousNodes":["n60"],"islandId":"village","progress":61,"effects":{"item":true},"remainingSteps":82,"longestRemainingSteps":109},
    "n62": {"id":"n62","position":{"x":2040,"y":3700},"type":"movement","nextNodes":["n63"],"previousNodes":["n61"],"islandId":"village","progress":62,"effects":{},"remainingSteps":81,"longestRemainingSteps":108},
    "n63": {"id":"n63","position":{"x":2020,"y":3910},"type":"healing","nextNodes":["n64"],"previousNodes":["n62"],"islandId":"village","progress":63,"effects":{"hp":20},"remainingSteps":80,"longestRemainingSteps":107},
    "n64": {"id":"n64","position":{"x":1900,"y":4090},"type":"movement","nextNodes":["n65"],"previousNodes":["n63"],"islandId":"village","progress":64,"effects":{},"remainingSteps":79,"longestRemainingSteps":106},
    "n65": {"id":"n65","position":{"x":1840,"y":4300},"type":"danger","nextNodes":["n66"],"previousNodes":["n64"],"islandId":"village","progress":65,"effects":{"hp":-35},"remainingSteps":78,"longestRemainingSteps":105},
    "n66": {"id":"n66","position":{"x":1950,"y":4470},"type":"movement","nextNodes":["n67"],"previousNodes":["n65"],"islandId":"village","progress":66,"effects":{},"remainingSteps":77,"longestRemainingSteps":104},
    "n67": {"id":"n67","position":{"x":2330,"y":4470},"type":"movement","nextNodes":["n68"],"previousNodes":["n66"],"islandId":null,"progress":67,"effects":{},"bridgeId":"market-channel","remainingSteps":76,"longestRemainingSteps":103},
    "n68": {"id":"n68","position":{"x":2660,"y":4470},"type":"movement","nextNodes":["n69"],"previousNodes":["n67"],"islandId":null,"progress":68,"effects":{},"bridgeId":"market-channel","remainingSteps":75,"longestRemainingSteps":102},
    "n69": {"id":"n69","position":{"x":2990,"y":4470},"type":"sword","nextNodes":["n70"],"previousNodes":["n68"],"islandId":null,"progress":69,"effects":{},"bridgeId":"market-channel","remainingSteps":74,"longestRemainingSteps":101,"territoryId":"sword-territory-69","ownerId":null},
    "n70": {"id":"n70","position":{"x":3320,"y":4470},"type":"sword","nextNodes":["n71"],"previousNodes":["n69"],"islandId":"lake","progress":70,"effects":{},"remainingSteps":73,"longestRemainingSteps":100,"territoryId":"sword-territory-69","ownerId":null},
    "n71": {"id":"n71","position":{"x":3350,"y":4680},"type":"movement","nextNodes":["n72"],"previousNodes":["n70"],"islandId":"lake","progress":71,"effects":{},"remainingSteps":72,"longestRemainingSteps":99},
    "n72": {"id":"n72","position":{"x":3490,"y":4830},"type":"movement","nextNodes":["n73","b72_1"],"previousNodes":["n71"],"islandId":"lake","progress":72,"effects":{},"remainingSteps":71,"longestRemainingSteps":98},
    "n73": {"id":"n73","position":{"x":3700,"y":4890},"type":"movement","nextNodes":["n74"],"previousNodes":["n72"],"islandId":"lake","progress":73,"effects":{},"remainingSteps":70,"longestRemainingSteps":93},
    "n74": {"id":"n74","position":{"x":3900,"y":4840},"type":"movement","nextNodes":["n75"],"previousNodes":["n73","b72_5"],"islandId":"lake","progress":74,"effects":{},"remainingSteps":69,"longestRemainingSteps":92},
    "n75": {"id":"n75","position":{"x":4040,"y":4690},"type":"movement","nextNodes":["n76"],"previousNodes":["n74"],"islandId":"lake","progress":75,"effects":{},"remainingSteps":68,"longestRemainingSteps":91},
    "n76": {"id":"n76","position":{"x":4070,"y":4480},"type":"movement","nextNodes":["n77","b76_1","c76_1"],"previousNodes":["n75"],"islandId":"lake","progress":76,"effects":{},"remainingSteps":67,"longestRemainingSteps":90},
    "n77": {"id":"n77","position":{"x":4000,"y":4290},"type":"movement","nextNodes":["n78"],"previousNodes":["n76"],"islandId":"lake","progress":77,"effects":{},"remainingSteps":73,"longestRemainingSteps":87},
    "n78": {"id":"n78","position":{"x":3830,"y":4170},"type":"danger","nextNodes":["n79"],"previousNodes":["n77"],"islandId":"lake","progress":78,"effects":{"hp":-35},"remainingSteps":72,"longestRemainingSteps":86},
    "n79": {"id":"n79","position":{"x":3650,"y":4090},"type":"movement","nextNodes":["n80"],"previousNodes":["n78"],"islandId":"lake","progress":79,"effects":{},"remainingSteps":71,"longestRemainingSteps":85},
    "n80": {"id":"n80","position":{"x":3500,"y":3940},"type":"healing","nextNodes":["n81"],"previousNodes":["n79"],"islandId":"lake","progress":80,"effects":{"hp":20},"remainingSteps":70,"longestRemainingSteps":84},
    "n81": {"id":"n81","position":{"x":3470,"y":3750},"type":"movement","nextNodes":["n82"],"previousNodes":["n80"],"islandId":"lake","progress":81,"effects":{},"remainingSteps":69,"longestRemainingSteps":83},
    "n82": {"id":"n82","position":{"x":3550,"y":3560},"type":"movement","nextNodes":["n83"],"previousNodes":["n81"],"islandId":"lake","progress":82,"effects":{},"remainingSteps":68,"longestRemainingSteps":82},
    "n83": {"id":"n83","position":{"x":3720,"y":3430},"type":"lucky","nextNodes":["n84"],"previousNodes":["n82"],"islandId":"lake","progress":83,"effects":{"item":true},"remainingSteps":67,"longestRemainingSteps":81},
    "n84": {"id":"n84","position":{"x":3940,"y":3390},"type":"movement","nextNodes":["n85"],"previousNodes":["n83"],"islandId":"lake","progress":84,"effects":{},"remainingSteps":66,"longestRemainingSteps":80},
    "n85": {"id":"n85","position":{"x":4160,"y":3430},"type":"sword","nextNodes":["n86"],"previousNodes":["n84"],"islandId":"lake","progress":85,"effects":{},"remainingSteps":65,"longestRemainingSteps":79,"territoryId":"sword-territory-85","ownerId":null},
    "n86": {"id":"n86","position":{"x":4340,"y":3550},"type":"sword","nextNodes":["n87"],"previousNodes":["n85"],"islandId":"lake","progress":86,"effects":{},"remainingSteps":64,"longestRemainingSteps":78,"territoryId":"sword-territory-85","ownerId":null},
    "n87": {"id":"n87","position":{"x":4510,"y":3620},"type":"movement","nextNodes":["n88"],"previousNodes":["n86","b76_3","c76_12"],"islandId":"lake","progress":87,"effects":{},"remainingSteps":63,"longestRemainingSteps":77},
    "n88": {"id":"n88","position":{"x":4690,"y":3570},"type":"danger","nextNodes":["n89"],"previousNodes":["n87"],"islandId":"lake","progress":88,"effects":{"hp":-35},"remainingSteps":62,"longestRemainingSteps":76},
    "n89": {"id":"n89","position":{"x":4810,"y":3410},"type":"lucky","nextNodes":["n90"],"previousNodes":["n88"],"islandId":"lake","progress":89,"effects":{"item":true},"remainingSteps":61,"longestRemainingSteps":75},
    "n90": {"id":"n90","position":{"x":4790,"y":3210},"type":"movement","nextNodes":["n91"],"previousNodes":["n89"],"islandId":"lake","progress":90,"effects":{},"remainingSteps":60,"longestRemainingSteps":74},
    "n91": {"id":"n91","position":{"x":4790,"y":2910},"type":"movement","nextNodes":["n92"],"previousNodes":["n90"],"islandId":null,"progress":91,"effects":{},"bridgeId":"glacier-out","remainingSteps":59,"longestRemainingSteps":73},
    "n92": {"id":"n92","position":{"x":4790,"y":2610},"type":"movement","nextNodes":["n93"],"previousNodes":["n91"],"islandId":null,"progress":92,"effects":{},"bridgeId":"glacier-out","remainingSteps":58,"longestRemainingSteps":72},
    "n93": {"id":"n93","position":{"x":4790,"y":2310},"type":"movement","nextNodes":["n94"],"previousNodes":["n92"],"islandId":null,"progress":93,"effects":{},"bridgeId":"glacier-out","remainingSteps":57,"longestRemainingSteps":71},
    "n94": {"id":"n94","position":{"x":4790,"y":2010},"type":"movement","nextNodes":["n95"],"previousNodes":["n93"],"islandId":"frost","progress":94,"effects":{},"remainingSteps":56,"longestRemainingSteps":70},
    "n95": {"id":"n95","position":{"x":4590,"y":2090},"type":"movement","nextNodes":["n96"],"previousNodes":["n94"],"islandId":"frost","progress":95,"effects":{},"remainingSteps":55,"longestRemainingSteps":69},
    "n96": {"id":"n96","position":{"x":4390,"y":2070},"type":"healing","nextNodes":["n97"],"previousNodes":["n95"],"islandId":"frost","progress":96,"effects":{"hp":20},"remainingSteps":54,"longestRemainingSteps":68},
    "n97": {"id":"n97","position":{"x":4220,"y":1940},"type":"movement","nextNodes":["n98"],"previousNodes":["n96"],"islandId":"frost","progress":97,"effects":{},"remainingSteps":53,"longestRemainingSteps":67},
    "n98": {"id":"n98","position":{"x":4150,"y":1760},"type":"danger","nextNodes":["n99"],"previousNodes":["n97"],"islandId":"frost","progress":98,"effects":{"hp":-35},"remainingSteps":52,"longestRemainingSteps":66},
    "n99": {"id":"n99","position":{"x":4220,"y":1570},"type":"movement","nextNodes":["n100"],"previousNodes":["n98"],"islandId":"frost","progress":99,"effects":{},"remainingSteps":51,"longestRemainingSteps":65},
    "n100": {"id":"n100","position":{"x":4390,"y":1450},"type":"lucky","nextNodes":["n101"],"previousNodes":["n99"],"islandId":"frost","progress":100,"effects":{"item":true},"remainingSteps":50,"longestRemainingSteps":64},
    "n101": {"id":"n101","position":{"x":4490,"y":1280},"type":"movement","nextNodes":["n102"],"previousNodes":["n100"],"islandId":"frost","progress":101,"effects":{},"remainingSteps":49,"longestRemainingSteps":63},
    "n102": {"id":"n102","position":{"x":4440,"y":1080},"type":"movement","nextNodes":["n103"],"previousNodes":["n101"],"islandId":"frost","progress":102,"effects":{},"remainingSteps":48,"longestRemainingSteps":62},
    "n103": {"id":"n103","position":{"x":4280,"y":950},"type":"sword","nextNodes":["n104"],"previousNodes":["n102"],"islandId":"frost","progress":103,"effects":{},"remainingSteps":47,"longestRemainingSteps":61,"territoryId":"sword-territory-103","ownerId":null},
    "n104": {"id":"n104","position":{"x":4080,"y":920},"type":"sword","nextNodes":["n105"],"previousNodes":["n103"],"islandId":"frost","progress":104,"effects":{},"remainingSteps":46,"longestRemainingSteps":60,"territoryId":"sword-territory-103","ownerId":null},
    "n105": {"id":"n105","position":{"x":3880,"y":960},"type":"movement","nextNodes":["n106","b105_1"],"previousNodes":["n104"],"islandId":"frost","progress":105,"effects":{},"remainingSteps":45,"longestRemainingSteps":59},
    "n106": {"id":"n106","position":{"x":3700,"y":1090},"type":"movement","nextNodes":["n107"],"previousNodes":["n105"],"islandId":"frost","progress":106,"effects":{},"remainingSteps":46,"longestRemainingSteps":58},
    "n107": {"id":"n107","position":{"x":3540,"y":1020},"type":"healing","nextNodes":["n108"],"previousNodes":["n106"],"islandId":"frost","progress":107,"effects":{"hp":20},"remainingSteps":45,"longestRemainingSteps":57},
    "n108": {"id":"n108","position":{"x":3430,"y":860},"type":"movement","nextNodes":["n109"],"previousNodes":["n107"],"islandId":"frost","progress":108,"effects":{},"remainingSteps":44,"longestRemainingSteps":56},
    "n109": {"id":"n109","position":{"x":3470,"y":670},"type":"movement","nextNodes":["n110"],"previousNodes":["n108"],"islandId":"frost","progress":109,"effects":{},"remainingSteps":43,"longestRemainingSteps":55},
    "n110": {"id":"n110","position":{"x":3650,"y":540},"type":"movement","nextNodes":["n111"],"previousNodes":["n109","b105_2"],"islandId":"frost","progress":110,"effects":{},"remainingSteps":42,"longestRemainingSteps":54},
    "n111": {"id":"n111","position":{"x":3870,"y":500},"type":"movement","nextNodes":["n112","b111_1"],"previousNodes":["n110"],"islandId":"frost","progress":111,"effects":{},"remainingSteps":41,"longestRemainingSteps":53},
    "n112": {"id":"n112","position":{"x":4090,"y":520},"type":"movement","nextNodes":["n113"],"previousNodes":["n111"],"islandId":"frost","progress":112,"effects":{},"remainingSteps":40,"longestRemainingSteps":49},
    "n113": {"id":"n113","position":{"x":4310,"y":570},"type":"movement","nextNodes":["n114"],"previousNodes":["n112"],"islandId":"frost","progress":113,"effects":{},"remainingSteps":39,"longestRemainingSteps":48},
    "n114": {"id":"n114","position":{"x":4520,"y":650},"type":"movement","nextNodes":["n115"],"previousNodes":["n113","b111_5"],"islandId":"frost","progress":114,"effects":{},"remainingSteps":38,"longestRemainingSteps":47},
    "n115": {"id":"n115","position":{"x":4720,"y":750},"type":"movement","nextNodes":["n116"],"previousNodes":["n114"],"islandId":"frost","progress":115,"effects":{},"remainingSteps":37,"longestRemainingSteps":46},
    "n116": {"id":"n116","position":{"x":4900,"y":880},"type":"danger","nextNodes":["n117"],"previousNodes":["n115"],"islandId":"frost","progress":116,"effects":{"hp":-35},"remainingSteps":36,"longestRemainingSteps":45},
    "n117": {"id":"n117","position":{"x":5060,"y":1050},"type":"movement","nextNodes":["n118","b117_1"],"previousNodes":["n116"],"islandId":"frost","progress":117,"effects":{},"remainingSteps":35,"longestRemainingSteps":44},
    "n118": {"id":"n118","position":{"x":5190,"y":1240},"type":"movement","nextNodes":["n119"],"previousNodes":["n117"],"islandId":"frost","progress":118,"effects":{},"remainingSteps":34,"longestRemainingSteps":34},
    "n119": {"id":"n119","position":{"x":5240,"y":1450},"type":"healing","nextNodes":["n120"],"previousNodes":["n118"],"islandId":"frost","progress":119,"effects":{"hp":20},"remainingSteps":33,"longestRemainingSteps":33},
    "n120": {"id":"n120","position":{"x":5240,"y":1670},"type":"danger","nextNodes":["n121"],"previousNodes":["n119"],"islandId":"frost","progress":120,"effects":{"hp":-35},"remainingSteps":32,"longestRemainingSteps":32},
    "n121": {"id":"n121","position":{"x":5210,"y":1890},"type":"movement","nextNodes":["n122"],"previousNodes":["n120","b117_12"],"islandId":"frost","progress":121,"effects":{},"remainingSteps":31,"longestRemainingSteps":31},
    "n122": {"id":"n122","position":{"x":5150,"y":2100},"type":"movement","nextNodes":["n123"],"previousNodes":["n121"],"islandId":"frost","progress":122,"effects":{},"remainingSteps":30,"longestRemainingSteps":30},
    "n123": {"id":"n123","position":{"x":5330,"y":2400},"type":"movement","nextNodes":["n124"],"previousNodes":["n122"],"islandId":null,"progress":123,"effects":{},"bridgeId":"glacier-return","remainingSteps":29,"longestRemainingSteps":29},
    "n124": {"id":"n124","position":{"x":5450,"y":2700},"type":"sword","nextNodes":["n125"],"previousNodes":["n123"],"islandId":null,"progress":124,"effects":{},"bridgeId":"glacier-return","remainingSteps":28,"longestRemainingSteps":28,"territoryId":"sword-territory-124","ownerId":null},
    "n125": {"id":"n125","position":{"x":5480,"y":3000},"type":"sword","nextNodes":["n126"],"previousNodes":["n124"],"islandId":null,"progress":125,"effects":{},"bridgeId":"glacier-return","remainingSteps":27,"longestRemainingSteps":27,"territoryId":"sword-territory-124","ownerId":null},
    "n126": {"id":"n126","position":{"x":5350,"y":3300},"type":"movement","nextNodes":["n127"],"previousNodes":["n125"],"islandId":"lake","progress":126,"effects":{},"remainingSteps":26,"longestRemainingSteps":26},
    "n127": {"id":"n127","position":{"x":5400,"y":3530},"type":"lucky","nextNodes":["n128"],"previousNodes":["n126"],"islandId":"lake","progress":127,"effects":{"item":true},"remainingSteps":25,"longestRemainingSteps":25},
    "n128": {"id":"n128","position":{"x":5400,"y":3760},"type":"movement","nextNodes":["n129"],"previousNodes":["n127"],"islandId":"lake","progress":128,"effects":{},"remainingSteps":24,"longestRemainingSteps":24},
    "n129": {"id":"n129","position":{"x":5360,"y":3990},"type":"healing","nextNodes":["n130"],"previousNodes":["n128"],"islandId":"lake","progress":129,"effects":{"hp":20},"remainingSteps":23,"longestRemainingSteps":23},
    "n130": {"id":"n130","position":{"x":5260,"y":4200},"type":"movement","nextNodes":["n131"],"previousNodes":["n129"],"islandId":"lake","progress":130,"effects":{},"remainingSteps":22,"longestRemainingSteps":22},
    "n131": {"id":"n131","position":{"x":5100,"y":4380},"type":"danger","nextNodes":["n132"],"previousNodes":["n130"],"islandId":"lake","progress":131,"effects":{"hp":-35},"remainingSteps":21,"longestRemainingSteps":21},
    "n132": {"id":"n132","position":{"x":4900,"y":4500},"type":"movement","nextNodes":["n133"],"previousNodes":["n131"],"islandId":"lake","progress":132,"effects":{},"remainingSteps":20,"longestRemainingSteps":20},
    "n133": {"id":"n133","position":{"x":4870,"y":4730},"type":"movement","nextNodes":["n134"],"previousNodes":["n132"],"islandId":"lake","progress":133,"effects":{},"remainingSteps":19,"longestRemainingSteps":19},
    "n134": {"id":"n134","position":{"x":5100,"y":4850},"type":"movement","nextNodes":["n135"],"previousNodes":["n133"],"islandId":"lake","progress":134,"effects":{},"remainingSteps":18,"longestRemainingSteps":18},
    "n135": {"id":"n135","position":{"x":5550,"y":4770},"type":"movement","nextNodes":["n136"],"previousNodes":["n134"],"islandId":null,"progress":135,"effects":{},"bridgeId":"crown-approach","remainingSteps":17,"longestRemainingSteps":17},
    "n136": {"id":"n136","position":{"x":5900,"y":4700},"type":"movement","nextNodes":["n137"],"previousNodes":["n135"],"islandId":null,"progress":136,"effects":{},"bridgeId":"crown-approach","remainingSteps":16,"longestRemainingSteps":16},
    "n137": {"id":"n137","position":{"x":6200,"y":4700},"type":"sword","nextNodes":["n138"],"previousNodes":["n136"],"islandId":"crown","progress":137,"effects":{},"remainingSteps":15,"longestRemainingSteps":15,"territoryId":"sword-territory-137","ownerId":null},
    "n138": {"id":"n138","position":{"x":6400,"y":4750},"type":"sword","nextNodes":["n139"],"previousNodes":["n137"],"islandId":"crown","progress":138,"effects":{},"remainingSteps":14,"longestRemainingSteps":14,"territoryId":"sword-territory-137","ownerId":null},
    "n139": {"id":"n139","position":{"x":6600,"y":4700},"type":"lucky","nextNodes":["n140"],"previousNodes":["n138"],"islandId":"crown","progress":139,"effects":{"item":true},"remainingSteps":13,"longestRemainingSteps":13},
    "n140": {"id":"n140","position":{"x":6750,"y":4560},"type":"movement","nextNodes":["n141"],"previousNodes":["n139"],"islandId":"crown","progress":140,"effects":{},"remainingSteps":12,"longestRemainingSteps":12},
    "n141": {"id":"n141","position":{"x":6780,"y":4350},"type":"movement","nextNodes":["n142"],"previousNodes":["n140"],"islandId":"crown","progress":141,"effects":{},"remainingSteps":11,"longestRemainingSteps":11},
    "n142": {"id":"n142","position":{"x":6660,"y":4190},"type":"movement","nextNodes":["n143"],"previousNodes":["n141"],"islandId":"crown","progress":142,"effects":{},"remainingSteps":10,"longestRemainingSteps":10},
    "n143": {"id":"n143","position":{"x":6460,"y":4130},"type":"danger","nextNodes":["n144"],"previousNodes":["n142"],"islandId":"crown","progress":143,"effects":{"hp":-35},"remainingSteps":9,"longestRemainingSteps":9},
    "n144": {"id":"n144","position":{"x":6260,"y":4020},"type":"movement","nextNodes":["n145"],"previousNodes":["n143"],"islandId":"crown","progress":144,"effects":{},"remainingSteps":8,"longestRemainingSteps":8},
    "n145": {"id":"n145","position":{"x":6180,"y":3840},"type":"healing","nextNodes":["n146"],"previousNodes":["n144"],"islandId":"crown","progress":145,"effects":{"hp":20},"remainingSteps":7,"longestRemainingSteps":7},
    "n146": {"id":"n146","position":{"x":6240,"y":3660},"type":"movement","nextNodes":["n147"],"previousNodes":["n145"],"islandId":"crown","progress":146,"effects":{},"remainingSteps":6,"longestRemainingSteps":6},
    "n147": {"id":"n147","position":{"x":6410,"y":3530},"type":"movement","nextNodes":["n148"],"previousNodes":["n146"],"islandId":"crown","progress":147,"effects":{},"remainingSteps":5,"longestRemainingSteps":5},
    "n148": {"id":"n148","position":{"x":6630,"y":3510},"type":"danger","nextNodes":["n149"],"previousNodes":["n147"],"islandId":"crown","progress":148,"effects":{"hp":-35},"remainingSteps":4,"longestRemainingSteps":4},
    "n149": {"id":"n149","position":{"x":6840,"y":3610},"type":"movement","nextNodes":["n150"],"previousNodes":["n148"],"islandId":"crown","progress":149,"effects":{},"remainingSteps":3,"longestRemainingSteps":3},
    "n150": {"id":"n150","position":{"x":6970,"y":3780},"type":"lucky","nextNodes":["n151"],"previousNodes":["n149"],"islandId":"crown","progress":150,"effects":{"item":true},"remainingSteps":2,"longestRemainingSteps":2},
    "n151": {"id":"n151","position":{"x":6990,"y":3990},"type":"movement","nextNodes":["n152"],"previousNodes":["n150"],"islandId":"crown","progress":151,"effects":{},"remainingSteps":1,"longestRemainingSteps":1},
    "n152": {"id":"n152","position":{"x":6900,"y":4180},"type":"finish","nextNodes":[],"previousNodes":["n151"],"islandId":"crown","progress":152,"effects":{},"remainingSteps":0,"longestRemainingSteps":0},
    "b3_1": {"id":"b3_1","position":{"x":1130,"y":4580},"type":"danger","nextNodes":["b3_2"],"previousNodes":["n3"],"islandId":"village","progress":4.5,"effects":{"hp":-35},"remainingSteps":136,"longestRemainingSteps":168},
    "b3_2": {"id":"b3_2","position":{"x":1080,"y":4430},"type":"movement","nextNodes":["b3_3"],"previousNodes":["b3_1"],"islandId":"village","progress":6.0,"effects":{},"remainingSteps":135,"longestRemainingSteps":167},
    "b3_3": {"id":"b3_3","position":{"x":940,"y":4490},"type":"movement","nextNodes":["n9"],"previousNodes":["b3_2"],"islandId":"village","progress":7.5,"effects":{},"remainingSteps":134,"longestRemainingSteps":166},
    "b33_1": {"id":"b33_1","position":{"x":400,"y":1300},"type":"movement","nextNodes":["b33_2"],"previousNodes":["n33"],"islandId":null,"progress":34.0909,"effects":{},"bridgeId":"bells-in","remainingSteps":108,"longestRemainingSteps":135},
    "b33_2": {"id":"b33_2","position":{"x":240,"y":1050},"type":"danger","nextNodes":["b33_3"],"previousNodes":["b33_1"],"islandId":"bells","progress":35.1818,"effects":{"hp":-35},"remainingSteps":107,"longestRemainingSteps":134},
    "b33_3": {"id":"b33_3","position":{"x":180,"y":880},"type":"movement","nextNodes":["b33_4"],"previousNodes":["b33_2"],"islandId":"bells","progress":36.2727,"effects":{},"remainingSteps":106,"longestRemainingSteps":133},
    "b33_4": {"id":"b33_4","position":{"x":180,"y":690},"type":"movement","nextNodes":["b33_5"],"previousNodes":["b33_3"],"islandId":"bells","progress":37.3636,"effects":{},"remainingSteps":105,"longestRemainingSteps":132},
    "b33_5": {"id":"b33_5","position":{"x":240,"y":510},"type":"movement","nextNodes":["b33_6"],"previousNodes":["b33_4"],"islandId":"bells","progress":38.4545,"effects":{},"remainingSteps":104,"longestRemainingSteps":131},
    "b33_6": {"id":"b33_6","position":{"x":420,"y":420},"type":"danger","nextNodes":["b33_7"],"previousNodes":["b33_5"],"islandId":"bells","progress":39.5455,"effects":{"hp":-35},"remainingSteps":103,"longestRemainingSteps":130},
    "b33_7": {"id":"b33_7","position":{"x":620,"y":450},"type":"movement","nextNodes":["b33_8"],"previousNodes":["b33_6"],"islandId":"bells","progress":40.6364,"effects":{},"remainingSteps":102,"longestRemainingSteps":129},
    "b33_8": {"id":"b33_8","position":{"x":740,"y":600},"type":"movement","nextNodes":["b33_9"],"previousNodes":["b33_7"],"islandId":"bells","progress":41.7273,"effects":{},"remainingSteps":101,"longestRemainingSteps":128},
    "b33_9": {"id":"b33_9","position":{"x":760,"y":800},"type":"sword","nextNodes":["b33_10"],"previousNodes":["b33_8"],"islandId":"bells","progress":42.8182,"effects":{},"remainingSteps":100,"longestRemainingSteps":127,"territoryId":"sword-territory-b33_9","ownerId":null},
    "b33_10": {"id":"b33_10","position":{"x":920,"y":820},"type":"sword","nextNodes":["n45"],"previousNodes":["b33_9"],"islandId":null,"progress":43.9091,"effects":{},"bridgeId":"bells-out","remainingSteps":99,"longestRemainingSteps":126,"territoryId":"sword-territory-b33_9","ownerId":null},
    "b37_1": {"id":"b37_1","position":{"x":1200,"y":1980},"type":"healing","nextNodes":["b37_2"],"previousNodes":["n37"],"islandId":"grove","progress":37.5,"effects":{"hp":20},"remainingSteps":109,"longestRemainingSteps":136},
    "b37_2": {"id":"b37_2","position":{"x":1360,"y":2100},"type":"movement","nextNodes":["b37_3"],"previousNodes":["b37_1"],"islandId":"grove","progress":38.0,"effects":{},"remainingSteps":108,"longestRemainingSteps":135},
    "b37_3": {"id":"b37_3","position":{"x":1560,"y":2100},"type":"lucky","nextNodes":["b37_4"],"previousNodes":["b37_2"],"islandId":"grove","progress":38.5,"effects":{"item":true},"remainingSteps":107,"longestRemainingSteps":134},
    "b37_4": {"id":"b37_4","position":{"x":1710,"y":1980},"type":"movement","nextNodes":["b37_5"],"previousNodes":["b37_3"],"islandId":"grove","progress":39.0,"effects":{},"remainingSteps":106,"longestRemainingSteps":133},
    "b37_5": {"id":"b37_5","position":{"x":1810,"y":1760},"type":"movement","nextNodes":["b37_6"],"previousNodes":["b37_4"],"islandId":"grove","progress":39.5,"effects":{},"remainingSteps":105,"longestRemainingSteps":132},
    "b37_6": {"id":"b37_6","position":{"x":1850,"y":1540},"type":"healing","nextNodes":["b37_7"],"previousNodes":["b37_5"],"islandId":"grove","progress":40.0,"effects":{"hp":20},"remainingSteps":104,"longestRemainingSteps":131},
    "b37_7": {"id":"b37_7","position":{"x":1790,"y":1350},"type":"movement","nextNodes":["n41"],"previousNodes":["b37_6"],"islandId":"grove","progress":40.5,"effects":{},"remainingSteps":103,"longestRemainingSteps":130},
    "b72_1": {"id":"b72_1","position":{"x":3490,"y":5110},"type":"movement","nextNodes":["b72_2"],"previousNodes":["n72"],"islandId":null,"progress":72.3333,"effects":{},"bridgeId":"star-in","remainingSteps":74,"longestRemainingSteps":97},
    "b72_2": {"id":"b72_2","position":{"x":3550,"y":5350},"type":"healing","nextNodes":["b72_3"],"previousNodes":["b72_1"],"islandId":"star","progress":72.6667,"effects":{"hp":20},"remainingSteps":73,"longestRemainingSteps":96},
    "b72_3": {"id":"b72_3","position":{"x":3720,"y":5450},"type":"lucky","nextNodes":["b72_4"],"previousNodes":["b72_2"],"islandId":"star","progress":73.0,"effects":{"item":true},"remainingSteps":72,"longestRemainingSteps":95},
    "b72_4": {"id":"b72_4","position":{"x":3890,"y":5350},"type":"movement","nextNodes":["b72_5"],"previousNodes":["b72_3"],"islandId":"star","progress":73.3333,"effects":{},"remainingSteps":71,"longestRemainingSteps":94},
    "b72_5": {"id":"b72_5","position":{"x":3910,"y":5110},"type":"movement","nextNodes":["n74","b72_6"],"previousNodes":["b72_4"],"islandId":null,"progress":73.6667,"effects":{},"bridgeId":"star-out","remainingSteps":70,"longestRemainingSteps":93},
    "b72_6": {"id":"b72_6","position":{"x":4170,"y":4840},"type":"movement","nextNodes":["c76_2"],"previousNodes":["b72_5"],"islandId":"lake","progress":75.8,"effects":{},"remainingSteps":75,"longestRemainingSteps":89},
    "b76_1": {"id":"b76_1","position":{"x":4270,"y":4260},"type":"danger","nextNodes":["b76_2"],"previousNodes":["n76"],"islandId":"lake","progress":78.75,"effects":{"hp":-35},"remainingSteps":66,"longestRemainingSteps":80},
    "b76_2": {"id":"b76_2","position":{"x":4390,"y":4060},"type":"danger","nextNodes":["b76_3"],"previousNodes":["b76_1"],"islandId":"lake","progress":81.5,"effects":{"hp":-35},"remainingSteps":65,"longestRemainingSteps":79},
    "b76_3": {"id":"b76_3","position":{"x":4410,"y":3820},"type":"movement","nextNodes":["n87"],"previousNodes":["b76_2"],"islandId":"lake","progress":84.25,"effects":{},"remainingSteps":64,"longestRemainingSteps":78},
    "c76_1": {"id":"c76_1","position":{"x":4290,"y":4620},"type":"healing","nextNodes":["c76_2"],"previousNodes":["n76"],"islandId":"lake","progress":76.8462,"effects":{"hp":20},"remainingSteps":75,"longestRemainingSteps":89},
    "c76_2": {"id":"c76_2","position":{"x":4490,"y":4730},"type":"movement","nextNodes":["c76_3"],"previousNodes":["c76_1","b72_6"],"islandId":"lake","progress":77.6923,"effects":{},"remainingSteps":74,"longestRemainingSteps":88},
    "c76_3": {"id":"c76_3","position":{"x":4650,"y":4620},"type":"lucky","nextNodes":["c76_4"],"previousNodes":["c76_2"],"islandId":"lake","progress":78.5385,"effects":{"item":true},"remainingSteps":73,"longestRemainingSteps":87},
    "c76_4": {"id":"c76_4","position":{"x":4640,"y":4430},"type":"movement","nextNodes":["c76_5"],"previousNodes":["c76_3"],"islandId":"lake","progress":79.3846,"effects":{},"remainingSteps":72,"longestRemainingSteps":86},
    "c76_5": {"id":"c76_5","position":{"x":4780,"y":4290},"type":"movement","nextNodes":["c76_6"],"previousNodes":["c76_4"],"islandId":"lake","progress":80.2308,"effects":{},"remainingSteps":71,"longestRemainingSteps":85},
    "c76_6": {"id":"c76_6","position":{"x":4950,"y":4150},"type":"healing","nextNodes":["c76_7"],"previousNodes":["c76_5"],"islandId":"lake","progress":81.0769,"effects":{"hp":20},"remainingSteps":70,"longestRemainingSteps":84},
    "c76_7": {"id":"c76_7","position":{"x":5080,"y":3970},"type":"movement","nextNodes":["c76_8"],"previousNodes":["c76_6"],"islandId":"lake","progress":81.9231,"effects":{},"remainingSteps":69,"longestRemainingSteps":83},
    "c76_8": {"id":"c76_8","position":{"x":5160,"y":3770},"type":"movement","nextNodes":["c76_9"],"previousNodes":["c76_7"],"islandId":"lake","progress":82.7692,"effects":{},"remainingSteps":68,"longestRemainingSteps":82},
    "c76_9": {"id":"c76_9","position":{"x":5170,"y":3550},"type":"lucky","nextNodes":["c76_10"],"previousNodes":["c76_8"],"islandId":"lake","progress":83.6154,"effects":{"item":true},"remainingSteps":67,"longestRemainingSteps":81},
    "c76_10": {"id":"c76_10","position":{"x":5050,"y":3380},"type":"sword","nextNodes":["c76_11"],"previousNodes":["c76_9"],"islandId":"lake","progress":84.4615,"effects":{},"remainingSteps":66,"longestRemainingSteps":80,"territoryId":"sword-territory-c76_10","ownerId":null},
    "c76_11": {"id":"c76_11","position":{"x":4950,"y":3590},"type":"sword","nextNodes":["c76_12"],"previousNodes":["c76_10"],"islandId":"lake","progress":85.3077,"effects":{},"remainingSteps":65,"longestRemainingSteps":79,"territoryId":"sword-territory-c76_10","ownerId":null},
    "c76_12": {"id":"c76_12","position":{"x":4800,"y":3770},"type":"healing","nextNodes":["n87"],"previousNodes":["c76_11"],"islandId":"lake","progress":86.1538,"effects":{"hp":20},"remainingSteps":64,"longestRemainingSteps":78},
    "b105_1": {"id":"b105_1","position":{"x":3790,"y":790},"type":"danger","nextNodes":["b105_2"],"previousNodes":["n105"],"islandId":"frost","progress":106.6667,"effects":{"hp":-35},"remainingSteps":44,"longestRemainingSteps":56},
    "b105_2": {"id":"b105_2","position":{"x":3720,"y":650},"type":"movement","nextNodes":["n110"],"previousNodes":["b105_1"],"islandId":"frost","progress":108.3333,"effects":{},"remainingSteps":43,"longestRemainingSteps":55},
    "b111_1": {"id":"b111_1","position":{"x":3940,"y":320},"type":"movement","nextNodes":["b111_2"],"previousNodes":["n111"],"islandId":null,"progress":111.5,"effects":{},"bridgeId":"comet-in","remainingSteps":43,"longestRemainingSteps":52},
    "b111_2": {"id":"b111_2","position":{"x":4070,"y":150},"type":"healing","nextNodes":["b111_3"],"previousNodes":["b111_1"],"islandId":"comet","progress":112.0,"effects":{"hp":20},"remainingSteps":42,"longestRemainingSteps":51},
    "b111_3": {"id":"b111_3","position":{"x":4250,"y":150},"type":"movement","nextNodes":["b111_4"],"previousNodes":["b111_2"],"islandId":"comet","progress":112.5,"effects":{},"remainingSteps":41,"longestRemainingSteps":50},
    "b111_4": {"id":"b111_4","position":{"x":4420,"y":240},"type":"lucky","nextNodes":["b111_5"],"previousNodes":["b111_3"],"islandId":"comet","progress":113.0,"effects":{"item":true},"remainingSteps":40,"longestRemainingSteps":49},
    "b111_5": {"id":"b111_5","position":{"x":4500,"y":430},"type":"movement","nextNodes":["n114"],"previousNodes":["b111_4"],"islandId":null,"progress":113.5,"effects":{},"bridgeId":"comet-out","remainingSteps":39,"longestRemainingSteps":48},
    "b117_1": {"id":"b117_1","position":{"x":5400,"y":1050},"type":"movement","nextNodes":["b117_2"],"previousNodes":["n117"],"islandId":null,"progress":117.3077,"effects":{},"bridgeId":"aurora-in","remainingSteps":43,"longestRemainingSteps":43},
    "b117_2": {"id":"b117_2","position":{"x":5700,"y":1100},"type":"movement","nextNodes":["b117_3"],"previousNodes":["b117_1"],"islandId":null,"progress":117.6154,"effects":{},"bridgeId":"aurora-in","remainingSteps":42,"longestRemainingSteps":42},
    "b117_3": {"id":"b117_3","position":{"x":6000,"y":1150},"type":"healing","nextNodes":["b117_4"],"previousNodes":["b117_2"],"islandId":"aurora","progress":117.9231,"effects":{"hp":20},"remainingSteps":41,"longestRemainingSteps":41},
    "b117_4": {"id":"b117_4","position":{"x":6200,"y":1200},"type":"movement","nextNodes":["b117_5"],"previousNodes":["b117_3"],"islandId":"aurora","progress":118.2308,"effects":{},"remainingSteps":40,"longestRemainingSteps":40},
    "b117_5": {"id":"b117_5","position":{"x":6360,"y":1350},"type":"lucky","nextNodes":["b117_6"],"previousNodes":["b117_4"],"islandId":"aurora","progress":118.5385,"effects":{"item":true},"remainingSteps":39,"longestRemainingSteps":39},
    "b117_6": {"id":"b117_6","position":{"x":6400,"y":1550},"type":"movement","nextNodes":["b117_7"],"previousNodes":["b117_5"],"islandId":"aurora","progress":118.8462,"effects":{},"remainingSteps":38,"longestRemainingSteps":38},
    "b117_7": {"id":"b117_7","position":{"x":6330,"y":1750},"type":"healing","nextNodes":["b117_8"],"previousNodes":["b117_6"],"islandId":"aurora","progress":119.1538,"effects":{"hp":20},"remainingSteps":37,"longestRemainingSteps":37},
    "b117_8": {"id":"b117_8","position":{"x":6150,"y":1850},"type":"movement","nextNodes":["b117_9"],"previousNodes":["b117_7"],"islandId":"aurora","progress":119.4615,"effects":{},"remainingSteps":36,"longestRemainingSteps":36},
    "b117_9": {"id":"b117_9","position":{"x":5980,"y":1720},"type":"lucky","nextNodes":["b117_10"],"previousNodes":["b117_8"],"islandId":"aurora","progress":119.7692,"effects":{"item":true},"remainingSteps":35,"longestRemainingSteps":35},
    "b117_10": {"id":"b117_10","position":{"x":5900,"y":1530},"type":"movement","nextNodes":["b117_11"],"previousNodes":["b117_9"],"islandId":"aurora","progress":120.0769,"effects":{},"remainingSteps":34,"longestRemainingSteps":34},
    "b117_11": {"id":"b117_11","position":{"x":5700,"y":1650},"type":"movement","nextNodes":["b117_12"],"previousNodes":["b117_10"],"islandId":null,"progress":120.3846,"effects":{},"bridgeId":"aurora-out","remainingSteps":33,"longestRemainingSteps":33},
    "b117_12": {"id":"b117_12","position":{"x":5510,"y":1780},"type":"movement","nextNodes":["n121"],"previousNodes":["b117_11"],"islandId":null,"progress":120.6923,"effects":{},"bridgeId":"aurora-out","remainingSteps":32,"longestRemainingSteps":32}
  },
  "startId": "n0",
  "finishId": "n152",
  "length": 152,
  "width": 7350,
  "height": 5800,
  "bridges": [
    ["n25","n26"],
    ["n26","n27"],
    ["n27","n28"],
    ["n28","n29"],
    ["n56","n57"],
    ["n57","n58"],
    ["n58","n59"],
    ["n59","n60"],
    ["n66","n67"],
    ["n67","n68"],
    ["n68","n69"],
    ["n69","n70"],
    ["n90","n91"],
    ["n91","n92"],
    ["n92","n93"],
    ["n93","n94"],
    ["n122","n123"],
    ["n123","n124"],
    ["n124","n125"],
    ["n125","n126"],
    ["n134","n135"],
    ["n135","n136"],
    ["n136","n137"],
    ["n33","b33_1"],
    ["b33_1","b33_2"],
    ["b33_9","b33_10"],
    ["b33_10","n45"],
    ["n72","b72_1"],
    ["b72_1","b72_2"],
    ["b72_4","b72_5"],
    ["b72_5","n74"],
    ["b72_5","b72_6"],
    ["n111","b111_1"],
    ["b111_1","b111_2"],
    ["b111_4","b111_5"],
    ["b111_5","n114"],
    ["n117","b117_1"],
    ["b117_1","b117_2"],
    ["b117_2","b117_3"],
    ["b117_10","b117_11"],
    ["b117_11","b117_12"],
    ["b117_12","n121"]
  ],
  "bridgeStyles": {"n25>n26":"wood","n26>n27":"wood","n27>n28":"wood","n28>n29":"wood","n56>n57":"rope","n57>n58":"rope","n58>n59":"rope","n59>n60":"rope","n66>n67":"arched","n67>n68":"arched","n68>n69":"arched","n69>n70":"arched","n90>n91":"ice","n91>n92":"ice","n92>n93":"ice","n93>n94":"ice","n122>n123":"rope","n123>n124":"rope","n124>n125":"rope","n125>n126":"rope","n134>n135":"stone","n135>n136":"stone","n136>n137":"stone","n33>b33_1":"rope","b33_1>b33_2":"rope","b33_9>b33_10":"wood","b33_10>n45":"wood","n72>b72_1":"wood","b72_1>b72_2":"wood","b72_4>b72_5":"ice","b72_5>n74":"ice","b72_5>b72_6":"ice","n111>b111_1":"ice","b111_1>b111_2":"ice","b111_4>b111_5":"rope","b111_5>n114":"rope","n117>b117_1":"arched","b117_1>b117_2":"arched","b117_2>b117_3":"arched","b117_10>b117_11":"rope","b117_11>b117_12":"rope","b117_12>n121":"rope"},
  "bridgeRoutes": [
    {"id":"harbor-out","style":"wood","nodeIds":["n25","n26","n27","n28","n29"]},
    {"id":"harbor-return","style":"rope","nodeIds":["n56","n57","n58","n59","n60"]},
    {"id":"market-channel","style":"arched","nodeIds":["n66","n67","n68","n69","n70"]},
    {"id":"glacier-out","style":"ice","nodeIds":["n90","n91","n92","n93","n94"]},
    {"id":"glacier-return","style":"rope","nodeIds":["n122","n123","n124","n125","n126"]},
    {"id":"crown-approach","style":"stone","nodeIds":["n134","n135","n136","n137"]},
    {"id":"bells-in","style":"rope","nodeIds":["n33","b33_1","b33_2"]},
    {"id":"bells-out","style":"wood","nodeIds":["b33_9","b33_10","n45"]},
    {"id":"star-in","style":"wood","nodeIds":["n72","b72_1","b72_2"]},
    {"id":"star-out","style":"ice","nodeIds":["b72_4","b72_5","n74"]},
    {"id":"star-spur","style":"ice","nodeIds":["b72_4","b72_5","b72_6"],"sharedBridgeId":"star-out"},
    {"id":"comet-in","style":"ice","nodeIds":["n111","b111_1","b111_2"]},
    {"id":"comet-out","style":"rope","nodeIds":["b111_4","b111_5","n114"]},
    {"id":"aurora-in","style":"arched","nodeIds":["n117","b117_1","b117_2","b117_3"]},
    {"id":"aurora-out","style":"rope","nodeIds":["b117_10","b117_11","b117_12","n121"]}
  ],
  "branches": [
    {"id":"b3","a":3,"b":9,"count":3,"kind":"risky","nodeIds":["b3_1","b3_2","b3_3"]},
    {"id":"b33","a":33,"b":45,"count":10,"kind":"risky","nodeIds":["b33_1","b33_2","b33_3","b33_4","b33_5","b33_6","b33_7","b33_8","b33_9","b33_10"]},
    {"id":"b37","a":37,"b":41,"count":7,"kind":"scenic","nodeIds":["b37_1","b37_2","b37_3","b37_4","b37_5","b37_6","b37_7"]},
    {"id":"b72","a":72,"b":74,"count":5,"kind":"scenic","nodeIds":["b72_1","b72_2","b72_3","b72_4","b72_5"]},
    {"id":"b76","a":76,"b":87,"count":3,"kind":"risky","nodeIds":["b76_1","b76_2","b76_3"]},
    {"id":"c76","a":76,"b":87,"count":12,"kind":"scenic","nodeIds":["c76_1","c76_2","c76_3","c76_4","c76_5","c76_6","c76_7","c76_8","c76_9","c76_10","c76_11","c76_12"]},
    {"id":"b105","a":105,"b":110,"count":2,"kind":"risky","nodeIds":["b105_1","b105_2"]},
    {"id":"b111","a":111,"b":114,"count":5,"kind":"scenic","nodeIds":["b111_1","b111_2","b111_3","b111_4","b111_5"]},
    {"id":"b117","a":117,"b":121,"count":12,"kind":"scenic","nodeIds":["b117_1","b117_2","b117_3","b117_4","b117_5","b117_6","b117_7","b117_8","b117_9","b117_10","b117_11","b117_12"]}
  ],
  "territories": {"sword-territory-14":{"id":"sword-territory-14","nodeIds":["n14","n15"],"ownerId":null},"sword-territory-27":{"id":"sword-territory-27","nodeIds":["n27","n28"],"ownerId":null},"sword-territory-59":{"id":"sword-territory-59","nodeIds":["n59","n60"],"ownerId":null},"sword-territory-69":{"id":"sword-territory-69","nodeIds":["n69","n70"],"ownerId":null},"sword-territory-85":{"id":"sword-territory-85","nodeIds":["n85","n86"],"ownerId":null},"sword-territory-c76_10":{"id":"sword-territory-c76_10","nodeIds":["c76_10","c76_11"],"ownerId":null},"sword-territory-103":{"id":"sword-territory-103","nodeIds":["n103","n104"],"ownerId":null},"sword-territory-124":{"id":"sword-territory-124","nodeIds":["n124","n125"],"ownerId":null},"sword-territory-137":{"id":"sword-territory-137","nodeIds":["n137","n138"],"ownerId":null},"sword-territory-43":{"id":"sword-territory-43","nodeIds":["n43","n44"],"ownerId":null},"sword-territory-b33_9":{"id":"sword-territory-b33_9","nodeIds":["b33_9","b33_10"],"ownerId":null}},
  "luckyTileIds": [
    "n6",
    "n17",
    "n31",
    "n42",
    "n53",
    "n61",
    "n83",
    "n89",
    "n100",
    "n127",
    "n139",
    "n150",
    "b37_3",
    "b72_3",
    "c76_3",
    "c76_9",
    "b111_4",
    "b117_5",
    "b117_9"
  ],
  "islands": [
    {"id":"village","name":"NOEL VILLAGE","theme":"camp","center":{"x":1250,"y":4100},"outline":[{"x":320,"y":3890},{"x":480,"y":3650},{"x":650,"y":3590},{"x":660,"y":3190},{"x":990,"y":3150},{"x":1450,"y":3190},{"x":1760,"y":3170},{"x":2050,"y":3290},{"x":2200,"y":3650},{"x":2170,"y":4050},{"x":2070,"y":4250},{"x":2180,"y":4550},{"x":1970,"y":4710},{"x":1680,"y":4680},{"x":1500,"y":4880},{"x":1120,"y":4990},{"x":700,"y":5000},{"x":440,"y":4750},{"x":350,"y":4370}],"landmark":{"x":1050,"y":4050},"nodeIds":["n0","n1","n2","n3","n4","n5","n6","n7","n8","n9","n10","n11","n12","n13","n14","n15","n16","n17","n18","n19","n20","n21","n22","n23","n24","n25","n60","n61","n62","n63","n64","n65","n66","b3_1","b3_2","b3_3"],"decorations":[{"kind":"house","x":800,"y":4600,"scale":1},{"kind":"house","x":1630,"y":4450,"scale":1.2},{"kind":"pine","x":1660,"y":4210,"scale":1.3},{"kind":"gift","x":1460,"y":4160,"scale":1},{"kind":"lantern","x":930,"y":3960,"scale":1},{"kind":"fence","x":1140,"y":3570,"scale":1},{"kind":"house","x":1370,"y":3640,"scale":1},{"kind":"pine","x":780,"y":3560,"scale":1},{"kind":"gift","x":1810,"y":3750,"scale":1}]},
    {"id":"grove","name":"LANTERN FOREST","theme":"grove","center":{"x":1430,"y":1500},"outline":[{"x":310,"y":1610},{"x":430,"y":1390},{"x":740,"y":1310},{"x":950,"y":1310},{"x":970,"y":1110},{"x":930,"y":930},{"x":970,"y":630},{"x":1170,"y":480},{"x":1490,"y":450},{"x":1840,"y":580},{"x":2110,"y":820},{"x":2240,"y":1180},{"x":2230,"y":1660},{"x":2140,"y":2030},{"x":1890,"y":2330},{"x":1500,"y":2310},{"x":1200,"y":2250},{"x":1030,"y":2140},{"x":790,"y":2310},{"x":510,"y":2180},{"x":340,"y":1960}],"landmark":{"x":1410,"y":1510},"nodeIds":["n29","n30","n31","n32","n33","n34","n35","n36","n37","n38","n39","n40","n41","n42","n43","n44","n45","n46","n47","n48","n49","n50","n51","n52","n53","n54","n55","n56","b37_1","b37_2","b37_3","b37_4","b37_5","b37_6","b37_7"],"decorations":[{"kind":"pine","x":680,"y":1840,"scale":1.5},{"kind":"pine","x":850,"y":1930,"scale":1.2},{"kind":"pine","x":940,"y":1770,"scale":1},{"kind":"fence","x":690,"y":1660,"scale":1},{"kind":"pine","x":1320,"y":1010,"scale":1.7},{"kind":"pine","x":1520,"y":1080,"scale":1.4},{"kind":"lantern","x":1810,"y":1150,"scale":1},{"kind":"pine","x":1740,"y":1080,"scale":1.1},{"kind":"gift","x":1490,"y":1980,"scale":0.9}]},
    {"id":"frost","name":"FROSTFANG MASSIF","theme":"frost","center":{"x":4260,"y":1360},"outline":[{"x":3250,"y":700},{"x":3430,"y":470},{"x":3780,"y":360},{"x":4170,"y":370},{"x":4510,"y":470},{"x":4900,"y":670},{"x":5190,"y":930},{"x":5400,"y":1230},{"x":5430,"y":1740},{"x":5350,"y":2180},{"x":5100,"y":2300},{"x":4730,"y":2230},{"x":4300,"y":2250},{"x":3980,"y":2090},{"x":3600,"y":2000},{"x":3320,"y":1770},{"x":3210,"y":1430},{"x":3260,"y":1200}],"landmark":{"x":3870,"y":1530},"nodeIds":["n94","n95","n96","n97","n98","n99","n100","n101","n102","n103","n104","n105","n106","n107","n108","n109","n110","n111","n112","n113","n114","n115","n116","n117","n118","n119","n120","n121","n122","b105_1","b105_2"],"decorations":[{"kind":"mountain","x":3680,"y":1530,"scale":1.8},{"kind":"mountain","x":3910,"y":1830,"scale":1.3},{"kind":"rock","x":4800,"y":1390,"scale":2},{"kind":"rock","x":4810,"y":1740,"scale":1.4},{"kind":"lantern","x":4620,"y":1170,"scale":1},{"kind":"pine","x":3550,"y":1260,"scale":1.1},{"kind":"cave","x":3640,"y":1770,"scale":1}]},
    {"id":"lake","name":"MIRRORFROST LAKE","theme":"lake","center":{"x":4400,"y":4190},"outline":[{"x":3160,"y":4370},{"x":3300,"y":4110},{"x":3270,"y":3690},{"x":3400,"y":3420},{"x":3730,"y":3210},{"x":4160,"y":3260},{"x":4500,"y":3370},{"x":4630,"y":3110},{"x":4910,"y":3060},{"x":5090,"y":3200},{"x":5450,"y":3160},{"x":5600,"y":3480},{"x":5580,"y":3910},{"x":5450,"y":4300},{"x":5270,"y":4600},{"x":5300,"y":4930},{"x":5030,"y":5060},{"x":4590,"y":4880},{"x":4160,"y":4980},{"x":3900,"y":5070},{"x":3520,"y":5030},{"x":3250,"y":4850}],"landmark":{"x":3860,"y":3770},"nodeIds":["n70","n71","n72","n73","n74","n75","n76","n77","n78","n79","n80","n81","n82","n83","n84","n85","n86","n87","n88","n89","n90","n126","n127","n128","n129","n130","n131","n132","n133","n134","b76_1","b76_2","b76_3","c76_1","c76_2","c76_3","c76_4","c76_5","c76_6","c76_7","c76_8","c76_9","c76_10","c76_11","c76_12","b72_6"],"decorations":[{"kind":"lake","x":3940,"y":3830,"scale":1.5},{"kind":"pine","x":3660,"y":4650,"scale":1.5},{"kind":"pine","x":3530,"y":4510,"scale":1},{"kind":"pine","x":4650,"y":4180,"scale":1},{"kind":"gift","x":4540,"y":4500,"scale":1},{"kind":"rock","x":4930,"y":3880,"scale":1},{"kind":"lantern","x":5210,"y":4580,"scale":1}]},
    {"id":"crown","name":"CROWN SNOW CASTLE","theme":"crown","center":{"x":6600,"y":4100},"outline":[{"x":6030,"y":3650},{"x":6240,"y":3380},{"x":6600,"y":3330},{"x":6890,"y":3450},{"x":7120,"y":3700},{"x":7180,"y":4060},{"x":7270,"y":4450},{"x":7090,"y":4410},{"x":6970,"y":4630},{"x":6740,"y":4870},{"x":6420,"y":4940},{"x":6110,"y":4840},{"x":5970,"y":4610},{"x":6050,"y":4240},{"x":6020,"y":3910}],"landmark":{"x":7000,"y":4470},"nodeIds":["n137","n138","n139","n140","n141","n142","n143","n144","n145","n146","n147","n148","n149","n150","n151","n152"],"decorations":[{"kind":"house","x":6440,"y":4470,"scale":1.3},{"kind":"pine","x":6280,"y":4360,"scale":1.2},{"kind":"gift","x":6720,"y":3830,"scale":1.1},{"kind":"lantern","x":6650,"y":3990,"scale":1},{"kind":"fence","x":6280,"y":3840,"scale":1}]},
    {"id":"bells","name":"BELL HAMLET","theme":"village","center":{"x":460,"y":740},"outline":[{"x":80,"y":580},{"x":200,"y":330},{"x":430,"y":280},{"x":700,"y":320},{"x":850,"y":500},{"x":860,"y":840},{"x":730,"y":1000},{"x":410,"y":1180},{"x":170,"y":1170},{"x":70,"y":950}],"landmark":{"x":480,"y":790},"nodeIds":["b33_2","b33_3","b33_4","b33_5","b33_6","b33_7","b33_8","b33_9"],"decorations":[{"kind":"house","x":420,"y":700,"scale":1},{"kind":"gift","x":590,"y":920,"scale":1},{"kind":"lantern","x":580,"y":600,"scale":1}]},
    {"id":"aurora","name":"AURORA OUTPOST","theme":"aurora","center":{"x":6180,"y":1500},"outline":[{"x":5790,"y":1120},{"x":5980,"y":1010},{"x":6280,"y":1050},{"x":6470,"y":1240},{"x":6550,"y":1540},{"x":6460,"y":1830},{"x":6210,"y":2000},{"x":5960,"y":1900},{"x":5760,"y":1640},{"x":5800,"y":1370}],"landmark":{"x":6180,"y":1550},"nodeIds":["b117_3","b117_4","b117_5","b117_6","b117_7","b117_8","b117_9","b117_10"],"decorations":[{"kind":"pine","x":6100,"y":1450,"scale":1.2},{"kind":"gift","x":6220,"y":1670,"scale":1},{"kind":"lantern","x":6020,"y":1330,"scale":1}]},
    {"id":"comet","name":"COMET KEY","theme":"comet","center":{"x":4240,"y":190},"outline":[{"x":3930,"y":100},{"x":4070,"y":50},{"x":4310,"y":50},{"x":4520,"y":160},{"x":4510,"y":330},{"x":4270,"y":350},{"x":4040,"y":280}],"landmark":{"x":4250,"y":270},"nodeIds":["b111_2","b111_3","b111_4"],"decorations":[]},
    {"id":"star","name":"STARLIGHT KEY","theme":"lucky","center":{"x":3720,"y":5370},"outline":[{"x":3410,"y":5290},{"x":3550,"y":5200},{"x":3780,"y":5210},{"x":4010,"y":5290},{"x":4000,"y":5500},{"x":3770,"y":5600},{"x":3500,"y":5520}],"landmark":{"x":3740,"y":5300},"nodeIds":["b72_2","b72_3","b72_4"],"decorations":[]}
  ],
  "bounds": {"minX":0,"minY":0,"maxX":7350,"maxY":5800}
};
function assertCompatible(map){
 if(map?.version!==FIXED_MAP.version)throw Error('Incompatible BOARD PARTY map '+(map?.version||'unversioned')+'; start a new game ('+FIXED_MAP.version+')');
 return true;
}
function create(seed=Date.now()){
 const instance=JSON.parse(JSON.stringify(FIXED_MAP));
 instance.seed=seed; // Gameplay RNG only. Scenery does not read this field.
 return instance;
}
function validate(map){
 assertCompatible(map);
 const entries=Object.entries(map.nodes),ids=new Set(entries.map(([,n])=>n.id));
 if(ids.size!==entries.length||entries.some(([id,n])=>id!==n.id))throw Error('Duplicate or mismatched node ID');
 if(map.length!==MAIN_LENGTH||map.startId!=='n0'||map.finishId!=='n'+MAIN_LENGTH)throw Error('Invalid main route');
 if(map.nodes[map.startId]?.type!=='start'||map.nodes[map.finishId]?.type!=='finish'||map.nodes[map.finishId].nextNodes.length)throw Error('Invalid endpoints');
 const visiting=new Set(),done=new Set(),distances=new Map();
 function visit(id){
  if(visiting.has(id))throw Error('Board cycle at '+id);
  if(done.has(id))return;
  const n=map.nodes[id];if(!n)throw Error('Missing node '+id);
  if(id!==map.finishId&&!n.nextNodes.length)throw Error('Dead end '+id);
  if(new Set(n.nextNodes).size!==n.nextNodes.length||new Set(n.previousNodes).size!==n.previousNodes.length)throw Error('Duplicate edge '+id);
  if(!Number.isFinite(n.progress))throw Error('Invalid progress '+id);
  visiting.add(id);
  for(const next of n.nextNodes){
   const q=map.nodes[next];
   if(!q||q.progress<=n.progress||!q.previousNodes.includes(id))throw Error('Invalid forward edge '+id);
   visit(next);
  }
  for(const prev of n.previousNodes)if(!map.nodes[prev]?.nextNodes.includes(id))throw Error('Invalid previous edge '+id);
  const min=n.nextNodes.length?1+Math.min(...n.nextNodes.map(k=>distances.get(k).min)):0;
  const max=n.nextNodes.length?1+Math.max(...n.nextNodes.map(k=>distances.get(k).max)):0;
  if(n.remainingSteps!==min||n.longestRemainingSteps!==max)throw Error('Invalid graph distance '+id);
  distances.set(id,{min,max});visiting.delete(id);done.add(id);
 }
 visit(map.startId);
 if(done.size!==entries.length||!done.has(map.finishId))throw Error('Unreachable board node');
 for(let i=0;i<MAIN_LENGTH;i++)if(!map.nodes['n'+i]?.nextNodes.includes('n'+(i+1)))throw Error('Broken main route '+i);
 const regions=new Map(map.islands.map(i=>[i.id,i])),bridgeKeys=new Set(map.bridges.map(([a,b])=>a+'>'+b));
 if(regions.size!==map.islands.length||bridgeKeys.size!==map.bridges.length)throw Error('Duplicate island or bridge');
 const routeIds=new Set(),routeEdges=new Set();
 for(const r of map.bridgeRoutes){
  if(routeIds.has(r.id)||r.nodeIds.length<2)throw Error('Invalid bridge route '+r.id);routeIds.add(r.id);
  const first=map.nodes[r.nodeIds[0]],last=map.nodes[r.nodeIds.at(-1)];
  if(!first?.islandId||!last?.islandId||first.islandId===last.islandId)throw Error('Bridge must join two islands '+r.id);
  for(let i=0;i<r.nodeIds.length-1;i++){
   const a=r.nodeIds[i],b=r.nodeIds[i+1],key=a+'>'+b;
   if(!map.nodes[a]?.nextNodes.includes(b)||!bridgeKeys.has(key)||map.bridgeStyles[key]!==r.style)throw Error('Invalid bridge edge '+key);
   routeEdges.add(key);
  }
  for(const id of r.nodeIds.slice(1,-1)){
   const checkpoint=map.nodes[id],shared=r.sharedBridgeId&&checkpoint.bridgeId===r.sharedBridgeId;
   // A bridge can fork mid-span and reuse its original ice segment, but
   // each water checkpoint still belongs to a declared primary bridge.
   if((checkpoint.bridgeId!==r.id&&!shared)||checkpoint.islandId!==null)
    throw Error('Invalid bridge checkpoint '+id);
  }
 }
 if(routeEdges.size!==bridgeKeys.size||Object.keys(map.bridgeStyles).length!==bridgeKeys.size)throw Error('Orphan bridge edge');
 const assigned=new Set();
 for(const island of map.islands){
  if(!island.nodeIds.length||island.outline.length<3)throw Error('Empty island '+island.id);
  for(const id of island.nodeIds){if(assigned.has(id)||map.nodes[id]?.islandId!==island.id)throw Error('Invalid island membership '+id);assigned.add(id);}
  for(const p of [...island.outline,...island.decorations,island.landmark])if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>map.width||p.y>map.height)throw Error('Invalid island geometry '+island.id);
 }
 for(const [,n] of entries){
  const p=n.position;
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>map.width||p.y<0||p.y>map.height)throw Error('Invalid position '+n.id);
  if(n.islandId?!assigned.has(n.id):!routeIds.has(n.bridgeId))throw Error('Invalid surface '+n.id);
  for(const next of n.nextNodes){const q=map.nodes[next],key=n.id+'>'+next;
   if((!n.islandId||!q.islandId||n.islandId!==q.islandId)!==bridgeKeys.has(key))throw Error('Missing island connector '+key);
  }
  if(!['start','finish','movement','healing','danger','lucky','sword'].includes(n.type))throw Error('Unsupported tile '+n.id);
  if(['lucky','healing'].includes(n.type)&&adjacentType(map,n.id,n.type))throw Error('Adjacent '+n.type+' tiles at '+n.id);
 }
 // Every pair is a separate linked territory. Stepping on EITHER sword tile
 // captures both; rivals take 12 HP on either member of the pair.
 const actualSwordIds=entries.filter(([,n])=>n.type==='sword').map(([id])=>id);
 if(actualSwordIds.length!==SWORD_TILES.length||
    actualSwordIds.some(id=>!SWORD_TILES.includes(id))||
    Object.keys(map.territories).length!==SWORD_PAIRS.length)
   throw Error('Sword territory set does not match fixed map');
 for(const pair of SWORD_PAIRS){
  const territory=map.territories[pair.id], [a,b]=pair.nodeIds;
  if(!territory||territory.id!==pair.id||
     territory.nodeIds.length!==2||
     territory.nodeIds[0]!==a||territory.nodeIds[1]!==b||
     !map.nodes[a]?.nextNodes.includes(b))
    throw Error('Linked sword route invalid: '+pair.id);
  for(const id of pair.nodeIds){
   const node=map.nodes[id];
   if(node.type!=='sword'||node.territoryId!==pair.id||
      node.ownerId!==territory.ownerId)
    throw Error('Linked sword ownership invalid: '+id);
  }
 }
 if(entries.some(([id,n])=>n.type!=='sword'&&(n.territoryId!==undefined||n.ownerId!==undefined)))
  throw Error('Stale sword metadata on ordinary tile');
 for(const b of map.branches){
  const path=['n'+b.a,...b.nodeIds,'n'+b.b];
  if(!b.count||b.count!==b.nodeIds.length||path.some((id,i)=>i<path.length-1&&!map.nodes[id]?.nextNodes.includes(path[i+1])))throw Error('Branch disconnected '+b.id);
  const types=b.nodeIds.map(id=>map.nodes[id].type);
  if(b.count+1>b.b-b.a&&!types.some(t=>t==='healing'||t==='lucky'))throw Error('Long branch missing rewards '+b.id);
  if(b.count+1<b.b-b.a&&!types.includes('danger'))throw Error('Shortcut missing risk '+b.id);
 }
 return true;
}
function choose(map,id,x,y,allowed=null){
 const n=map.nodes[id],options=allowed?allowed.filter(k=>neighbors(map,id).includes(k)):n.nextNodes;
 if(!options.length)return null;
 if(Math.hypot(x,y)<.25)return options[0];
 return [...options].sort((a,b)=>{
  const dot=k=>{const p=map.nodes[k].position,dx=p.x-n.position.x,dy=p.y-n.position.y;return(dx*x+dy*y)/Math.hypot(dx,dy);};
  return dot(b)-dot(a);
 })[0];
}
// Fail at script load, then clone the validated literal once per game.
validate(FIXED_MAP);
window.BoardMap=Object.freeze({create,validate,assertCompatible,choose,neighbors,random,MAIN_LENGTH,SWORD_PAIRS,SWORD_TILES,TERRITORY_ID,MAP_VERSION:FIXED_MAP.version});
})();
