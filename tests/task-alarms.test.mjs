import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeEnv } from './support/fake-cloudflare.mjs';
import { handleAlarms, dispatchAlarms, validPushEndpoint, pushAuthorization } from '../cloudflare/src/alarms.js';

async function setup() {
  const {env}=createFakeEnv();
  env.DB.raw.exec(`INSERT INTO users(id,email) VALUES('a','a@test.dev'),('b','b@test.dev');
    INSERT INTO items(id,user_id,title) VALUES('task-a','a','Study calculus'),('task-b','b','Read notes');`);
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  env.VAPID_PRIVATE_JWK=JSON.stringify(await crypto.subtle.exportKey('jwk',keys.privateKey));
  env.VAPID_PUBLIC_KEY=Buffer.from(await crypto.subtle.exportKey('raw',keys.publicKey)).toString('base64url');
  env.VAPID_SUBJECT='mailto:admin@duckplan.test';
  const call=async(user,path,method='GET',body)=>handleAlarms(new Request('https://duckplan.test'+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),env,path,{id:user});
  return {env,call};
}
test('alarms enforce ownership, future time, valid zone and replacement receipts',async()=>{
  const {env,call}=await setup();
  const fireAt=Date.now()+120000;
  await assert.rejects(call('b','/api/alarms/task-a','PUT',{fireAt,timeZone:'UTC'}),/unavailable/);
  await assert.rejects(call('a','/api/alarms/task-a','PUT',{fireAt:Date.now()-1000,timeZone:'UTC'}),/Choose an alarm/);
  await assert.rejects(call('a','/api/alarms/task-a','PUT',{fireAt}),/time zone/);
  const first=await (await call('a','/api/alarms/task-a','PUT',{fireAt,timeZone:'UTC'})).json();
  const other=await (await call('b','/api/alarms')).json();
  assert.equal(other.alarms.length,0);
  const second=await (await call('a','/api/alarms/task-a','PUT',{fireAt:fireAt+60000,timeZone:'UTC'})).json();
  assert.notEqual(first.alarm.id,second.alarm.id);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM task_alarms').get().n,1);
  await call('b','/api/alarms/task-a','DELETE');
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM task_alarms').get().n,1);
});
test('dispatcher sends once per device, suppresses completed tasks, and prunes dead devices',async()=>{
  const {env,call}=await setup();
  const endpoint='https://fcm.googleapis.com/fcm/send/test';
  await call('a','/api/push/devices','POST',{endpoint});
  await assert.rejects(call('b','/api/push/devices','POST',{endpoint}),/previous account/);
  await call('a','/api/alarms/task-a','PUT',{fireAt:Date.now()+60000,timeZone:'UTC'});
  const now=Date.now()+61000;
  let sent=0;
  const fetchImpl=async(url,init)=>{sent++;assert.equal(url,endpoint);assert.match(init.headers.Authorization,/^vapid t=/);assert.equal(init.body,undefined);return new Response(null,{status:201});};
  await dispatchAlarms(env,{now,fetchImpl});
  await dispatchAlarms(env,{now,fetchImpl});
  assert.equal(sent,1);
  await call('a','/api/alarms/task-a','PUT',{fireAt:Date.now()+60000,timeZone:'UTC'});
  env.DB.raw.exec("UPDATE items SET completed=1 WHERE id='task-a'");
  await dispatchAlarms(env,{now,fetchImpl});assert.equal(sent,1);
  env.DB.raw.exec("UPDATE items SET completed=0 WHERE id='task-a'");
  await dispatchAlarms(env,{now,fetchImpl:async()=>new Response(null,{status:410})});
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM push_devices').get().n,0);
});
test('VAPID signature verifies and endpoint validation blocks redirects and private targets',async()=>{
  const {env}=await setup();
  for(const endpoint of ['http://localhost/test','https://evil.test/','https://fcm.googleapis.com.evil.test/x','https://fcm.googleapis.com:8443/test']) assert.equal(validPushEndpoint(endpoint),false);
  const auth=await pushAuthorization(env,'https://fcm.googleapis.com/test',Date.now());
  const token=auth.slice(8).split(',')[0];const [header,payload,signature]=token.split('.');
  const jwk=JSON.parse(env.VAPID_PRIVATE_JWK); delete jwk.d; jwk.key_ops=['verify'];
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  assert.equal(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,Buffer.from(signature,'base64url'),new TextEncoder().encode(`${header}.${payload}`)),true);
  assert.equal(JSON.parse(Buffer.from(payload,'base64url')).aud,'https://fcm.googleapis.com');
});

test('inbox is account-scoped, acknowledged alarms disappear, transient pushes retry',async()=>{
  const {env,call}=await setup();
  const endpoint='https://web.push.apple.com/test';
  await call('a','/api/push/devices','POST',{endpoint});
  const {alarm}=await (await call('a','/api/alarms/task-a','PUT',{fireAt:Date.now()+60000,timeZone:'UTC'})).json();
  env.DB.raw.prepare('UPDATE task_alarms SET fire_at=? WHERE id=?').run(Date.now()-1000,alarm.id);
  let sent=0;
  await dispatchAlarms(env,{fetchImpl:async()=>{sent++;return new Response(null,{status:503});}});
  await dispatchAlarms(env,{fetchImpl:async()=>{sent++;return new Response(null,{status:201});}});
  assert.equal(sent,1,'active claim prevents an immediate duplicate');
  env.DB.raw.exec('UPDATE alarm_deliveries SET claimed_at=0');
  await dispatchAlarms(env,{fetchImpl:async()=>{sent++;return new Response(null,{status:201});}});
  assert.equal(sent,2);
  assert.equal((await (await call('b','/api/push/inbox','POST',{endpoint})).json()).alarms.length,0);
  const inbox=await (await call('a','/api/push/inbox','POST',{endpoint})).json();
  assert.equal(inbox.alarms[0].title,'Study calculus');
  await call('a','/api/push/ack','POST',{endpoint,id:alarm.id});
  assert.equal((await (await call('a','/api/push/inbox','POST',{endpoint})).json()).alarms.length,0);
});
