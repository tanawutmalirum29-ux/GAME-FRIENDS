'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context=vm.createContext({Intl,Date,Math,window:{}});
vm.runInContext(fs.readFileSync('src/app/core/player-name.js','utf8'),context);
function run(expr){return vm.runInContext(expr,context);}
assert.equal(run("cleanName('   ')"),'เพื่อนใหม่');
assert.equal(run("uniquePlayerName('เพื่อนใหม่',[{name:'เพื่อนใหม่'}])"),'เพื่อนใหม่ 2');
assert.equal(run("uniquePlayerName('เพื่อนใหม่',[{name:'เพื่อนใหม่'},{name:'เพื่อนใหม่ 2'}])"),'เพื่อนใหม่ 3');
assert.equal(run("uniquePlayerName('เพื่อนใหม่',[{name:'เพื่อนใหม่'}],['เพื่อนใหม่','เพื่อนใหม่ 2'])"),'เพื่อนใหม่ 3',
 'restoring duplicate names must reserve another player’s existing suffixed name');
assert.equal(run("uniquePlayerName('เพื่อนใหม่ 2',[{name:'เพื่อนใหม่'}],['เพื่อนใหม่','เพื่อนใหม่ 2'])"),'เพื่อนใหม่ 2',
 'restoring a unique suffixed name must preserve it');
assert.equal(run("Array.from(uniquePlayerName('abcdefghijklmn',[{name:'abcdefghijklmn'}])).length"),14);
assert.equal(run("cleanName('AB<CD>EF')"),'ABCDEF');
assert.equal(run("cleanName('abcdefghijklmno')"),'abcdefghijklmn');
assert.equal(run("clipGraphemes('ก้'.repeat(15),14)"),'ก้'.repeat(14));
assert.equal(run("clipGraphemes('👨‍👩‍👧‍👦'.repeat(15),14)"),'👨‍👩‍👧‍👦'.repeat(14));
assert.equal(run("clipGraphemes('👍🏽'.repeat(15),14)"),'👍🏽'.repeat(14));
assert.equal(run("clipGraphemes('👩🏾‍💻'.repeat(15),14)"),'👩🏾‍💻'.repeat(14));
assert.equal(run("clipGraphemes('é'.repeat(15),14)"),'é'.repeat(14));
const savedIntl=context.Intl;
context.Intl={};
for(const sample of ['👨‍👩‍👧‍👦','👩🏾‍💻','👍🏽','ก้','🇹🇭']){
 assert.equal(run('clipGraphemes('+JSON.stringify(sample.repeat(16))+',14)'),sample.repeat(14),
  'fallback preserves grapheme '+sample);
}
context.Intl=savedIntl;
console.log('UNICODE NAMES PASS: Thai combining marks, ZWJ families, skin tones, fallback, sanitization');
