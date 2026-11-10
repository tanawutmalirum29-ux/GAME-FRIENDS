/* Restore original, audited BOARD PARTY scenery and layout source for static builds.
 * This is a source-code packaging step, NOT runtime eval or remote code.
 * Edited sources are stored as zlib-base64 for connector-safe transfer.
 * Run: node scripts/build-board-assets.cjs
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const ASSETS=[
 ['board-design.deflate.b64','src/board-party/runtime/board-design.js','fd545e971edd8e89c4ca41d36e1ed97663c8c676f846d83baabc7a386fbb55c8'],
 ['board-scenery.deflate.b64','src/board-party/runtime/board-scenery.js','12d178158c218556059a093b89a88006e2c710851cceb854c96ecfa1f4ac6401']
];
for(const [asset,destination,expected] of ASSETS){
 const target=path.join(root,destination);
 const location=path.join(root,'src/board-party/source',asset);
 const packed=fs.readdirSync(path.dirname(location))
  .filter(name=>name.startsWith(asset+'.part'))
  .sort().map(name=>fs.readFileSync(path.join(path.dirname(location),name),'utf8').trim()).join('');
 if(!packed)throw Error('Missing layout source payload '+asset);
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(packed))throw Error('Invalid layout source payload '+asset);
 const data=zlib.inflateSync(Buffer.from(packed,'base64'));
 const hash=createHash('sha256').update(data).digest('hex');
 if(hash!==expected)throw Error('layout source checksum mismatch: '+asset);
 const normalized=data.toString('utf8')
  .replaceAll('BOARD_PARTY_V7_DESIGN','BOARD_DESIGN')
  .replaceAll('BOARD_PARTY_V7_ART','BOARD_SCENERY');
 if(fs.existsSync(target)&&fs.readFileSync(target,'utf8')===normalized)continue;
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,normalized);
}
process.stdout.write('BOARD layout and scenery assets verified\n');
