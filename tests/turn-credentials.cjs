'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const module=await import(pathToFileURL(path.resolve('server/turn-credentials.mjs')).href);
 const settings={
   TURN_SHARED_SECRET:'test-only-not-a-production-secret-123456789',
   TURN_URLS:'turn:relay.example.test:3478,turns:relay.example.test:5349',
   TURN_ALLOWED_ORIGIN:'https://games.example.test',
   TURN_TTL_SECONDS:'600'
 };
 const at=1760000000000;
 const issued=module.mintTurnCredentials(settings,at);
 assert.equal(issued.iceServers.length,1);
 assert.equal(issued.expiresAt,at+600000);
 assert.ok(issued.iceServers[0].username.startsWith(String(Math.floor(issued.expiresAt/1000))+':'));
 const digest=crypto.createHmac('sha1',settings.TURN_SHARED_SECRET)
   .update(issued.iceServers[0].username).digest('base64');
 assert.equal(issued.iceServers[0].credential,digest);
 assert.ok(!JSON.stringify(issued).includes(settings.TURN_SHARED_SECRET),'shared secret never exposed');

 const keys=Object.keys(settings),saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  Object.assign(process.env,settings);
  const req={headers:{origin:settings.TURN_ALLOWED_ORIGIN},httpMethod:'GET'};
  const response=await module.handler(req);
  assert.equal(response.statusCode,200);
  assert.equal(response.headers['cache-control'],'no-store, private');
  assert.equal(JSON.parse(response.body).iceServers[0].urls.length,2);
  assert.equal((await module.handler({...req,headers:{origin:'https://attacker.test'}})).statusCode,403);
  assert.equal((await module.handler({...req,httpMethod:'POST'})).statusCode,405);
  assert.equal((await module.handler({...req,httpMethod:'OPTIONS'})).statusCode,204);
  process.env.TURN_SHARED_SECRET='';
  assert.equal((await module.handler(req)).statusCode,503);
 }finally{
  for(const k of keys){
   if(saved[k]===undefined)delete process.env[k];
   else process.env[k]=saved[k];
  }
 }
 console.log('TURN CREDENTIALS PASS: temporary HMAC-SHA1 coturn credentials, no-store, origin checks and invalid configuration');
})().catch(e=>{console.error(e);process.exitCode=1;});
