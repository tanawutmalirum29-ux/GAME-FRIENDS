/* AWS Lambda / API Gateway adapter for coturn REST temporary credentials.
 * Deploy separately with env TURN_SHARED_SECRET, TURN_URLS,
 * TURN_ALLOWED_ORIGIN. Keep the signing secret OUT of static Amplify assets.
 * Protect the public endpoint with API Gateway throttling and WAF rate limits.
 */
import {createHmac,randomBytes} from 'node:crypto';

function readSettings(env=process.env){
 const secret=env.TURN_SHARED_SECRET;
 const urls=(env.TURN_URLS||'').split(',').map(s=>s.trim()).filter(Boolean);
 const origin=env.TURN_ALLOWED_ORIGIN;
 const seconds=Math.max(120,Math.min(1800,Number(env.TURN_TTL_SECONDS)||600));
 if(typeof secret!=='string'||secret.length<24||
    urls.length===0||urls.length>4||urls.some(s=>!/^turns?:[^\s]{4,240}$/i.test(s))||
    !/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/i.test(origin||'')){
  throw Error('TURN backend configuration incomplete or unsafe');
 }
 return {secret,urls,origin,seconds};
}

export function mintTurnCredentials(env=process.env,now=Date.now()){
 const settings=readSettings(env);
 const expiresAt=now+settings.seconds*1000;
 const username=Math.floor(expiresAt/1000)+':'+randomBytes(12).toString('hex');
 const credential=createHmac('sha1',settings.secret).update(username).digest('base64');
 return {expiresAt,iceServers:[{urls:settings.urls,username,credential}]};
}
export async function handler(event={},context={}){
 let settings;
 try{settings=readSettings();}catch(_){
  return {statusCode:503,headers:{'cache-control':'no-store'},
   body:JSON.stringify({error:'TURN relay is not configured'})};
 }
 const requestOrigin=event.headers?.origin||event.headers?.Origin||'';
 const headers={'cache-control':'no-store, private','vary':'Origin',
   'content-type':'application/json','access-control-allow-origin':settings.origin,
   'access-control-allow-methods':'GET, OPTIONS',
   'access-control-allow-headers':'Content-Type'};
 if(requestOrigin!==settings.origin){
  return {statusCode:403,headers:{'cache-control':'no-store'},
   body:JSON.stringify({error:'origin not allowed'})};
 }
 const method=event.requestContext?.http?.method||event.httpMethod||'GET';
 if(method==='OPTIONS')return {statusCode:204,headers,body:''};
 if(method!=='GET')return {statusCode:405,headers,body:JSON.stringify({error:'method not allowed'})};
 return {statusCode:200,headers,body:JSON.stringify(mintTurnCredentials())};
}
