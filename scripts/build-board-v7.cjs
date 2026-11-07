/* Restore original, audited BOARD PARTY v7 Phase-5 source for static builds.
 * This is a source-code packaging step, NOT runtime eval or remote code.
 * Edited sources are stored as zlib-base64 for connector-safe transfer.
 * Run: node scripts/build-board-v7.cjs
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const ASSETS=[
 ['board-v7-design.deflate.b64','board-v7-design.js','fd545e971edd8e89c4ca41d36e1ed97663c8c676f846d83baabc7a386fbb55c8'],
 ['board-v7-art.deflate.b64','board-v7-art.js','12d178158c218556059a093b89a88006e2c710851cceb854c96ecfa1f4ac6401']
];
for(const [asset,destination,expected] of ASSETS){
 const location=path.join(root,'board-v7-source',asset);
 const packed=fs.readFileSync(location,'utf8').trim();
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(packed))throw Error('Invalid v7 source payload '+asset);
 const data=zlib.inflateSync(Buffer.from(packed,'base64'));
 const hash=createHash('sha256').update(data).digest('hex');
 if(hash!==expected)throw Error('v7 source checksum mismatch: '+asset);
 fs.writeFileSync(path.join(root,destination),data);
}
process.stdout.write('BOARD v7 Phase 5 assets verified and restored\n');
