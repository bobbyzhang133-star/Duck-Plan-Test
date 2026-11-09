import { HttpError, json, readJson } from './http.js';

// Send payload-free RFC 8030 pushes. The service worker fetches task text over
// the authenticated same-origin API; task titles never go to push providers.
export function validPushEndpoint(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash
      && (url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com'
        || url.hostname === 'web.push.apple.com' || url.hostname.endsWith('.push.apple.com')
        || url.hostname === 'wns.windows.com' || url.hostname.endsWith('.notify.windows.com'));
  } catch { return false; }
}
const encode = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const segment = (value) => encode(new TextEncoder().encode(JSON.stringify(value)));
export async function pushAuthorization(env, endpoint, now) {
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const input = `${segment({ typ: 'JWT', alg: 'ES256' })}.${segment({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 3600, sub: env.VAPID_SUBJECT })}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(input));
  return `vapid t=${input}.${encode(new Uint8Array(signature))}, k=${env.VAPID_PUBLIC_KEY}`;
}
export function pushConfigured(env) {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_JWK && /^mailto:|^https:\/\//.test(env.VAPID_SUBJECT || ''));
}
export async function handleAlarms(request, env, path, user) {
  if (!path.startsWith('/api/alarms') && !path.startsWith('/api/push/')) return null;
  if (path === '/api/push/config' && request.method === 'GET') return json({ available: pushConfigured(env), publicKey: env.VAPID_PUBLIC_KEY || null });
  if (path === '/api/push/devices') {
    const body = await readJson(request, 4096);
    const endpoint = body.endpoint;
    if (!validPushEndpoint(endpoint) || endpoint.length > 2048) throw new HttpError(400, 'Unsupported push service.');
    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM push_devices WHERE endpoint = ? AND user_id = ?').bind(endpoint, user.id).run();
      return json({ ok: true });
    }
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    if (!pushConfigured(env)) throw new HttpError(503, 'Device alarms are awaiting server activation.');
    const owner = await env.DB.prepare('SELECT user_id FROM push_devices WHERE endpoint = ?').bind(endpoint).first();
    if (owner && owner.user_id !== user.id) throw new HttpError(409, 'Disable alarms on the previous account on this device first.');
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_devices WHERE user_id = ?').bind(user.id).first();
    if (!owner && count.n >= 10) throw new HttpError(400, 'Limit of ten alarm devices reached.');
    await env.DB.prepare('INSERT OR IGNORE INTO push_devices(endpoint,user_id,created_at) VALUES(?,?,?)').bind(endpoint,user.id,Date.now()).run();
    return json({ ok: true });
  }
  if (path === '/api/push/inbox' && request.method === 'POST') {
    const { endpoint } = await readJson(request, 4096);
    const now = Date.now();
    const { results } = await env.DB.prepare(`SELECT a.id, a.item_id, i.title FROM task_alarms a
      JOIN items i ON i.id=a.item_id JOIN push_devices p ON p.user_id=a.user_id
      JOIN alarm_deliveries d ON d.alarm_id=a.id AND d.endpoint=p.endpoint
      WHERE a.user_id=? AND p.endpoint=? AND a.fire_at<=? AND a.fire_at>=?
      AND i.completed=0 AND i.deleted_at IS NULL AND d.shown_at IS NULL LIMIT 100`).bind(user.id,endpoint,now,now-900000).all();
    return json({ alarms: results });
  }
  if (path === '/api/push/ack' && request.method === 'POST') {
    const { endpoint, id } = await readJson(request,4096);
    await env.DB.prepare(`UPDATE alarm_deliveries SET shown_at=? WHERE alarm_id=? AND endpoint=?
      AND EXISTS(SELECT 1 FROM task_alarms WHERE id=? AND user_id=?)`).bind(Date.now(),id,endpoint,id,user.id).run();
    return json({ ok:true });
  }
  if (path === '/api/alarms' && request.method === 'GET') {
    const { results } = await env.DB.prepare(`SELECT a.* FROM task_alarms a JOIN items i ON i.id=a.item_id
      WHERE a.user_id=? AND i.deleted_at IS NULL AND i.completed=0`).bind(user.id).all();
    return json({ alarms:results });
  }
  const match = /^\/api\/alarms\/([^/]+)$/.exec(path);
  if (!match) throw new HttpError(404,'Not found.');
  const itemId = decodeURIComponent(match[1]);
  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM task_alarms WHERE item_id=? AND user_id=?').bind(itemId,user.id).run();
    return json({ok:true});
  }
  if (request.method !== 'PUT') throw new HttpError(405,'Method not allowed.');
  const item = await env.DB.prepare('SELECT id FROM items WHERE id=? AND user_id=? AND completed=0 AND deleted_at IS NULL').bind(itemId,user.id).first();
  if (!item) throw new HttpError(404,'Task is unavailable.');
  const body = await readJson(request,4096);
  const fireAt = Number(body.fireAt);
  if (!Number.isSafeInteger(fireAt) || fireAt < Date.now()+5000 || fireAt > Date.now()+366*86400000) throw new HttpError(400,'Choose an alarm between now and one year ahead.');
  if (typeof body.timeZone !== 'string' || body.timeZone.length>100) throw new HttpError(400,'Choose a valid time zone.');
  try { new Intl.DateTimeFormat('en',{ timeZone:body.timeZone }).format(); } catch { throw new HttpError(400,'Choose a valid time zone.'); }
  const id = crypto.randomUUID();
  // A new occurrence gets a new id, so rescheduling cannot inherit old receipts.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM task_alarms WHERE item_id=? AND user_id=?').bind(itemId,user.id),
    env.DB.prepare('INSERT INTO task_alarms(id,user_id,item_id,fire_at,time_zone) VALUES(?,?,?,?,?)').bind(id,user.id,itemId,fireAt,body.timeZone),
  ]);
  return json({ alarm:{id,item_id:itemId,fire_at:fireAt,time_zone:body.timeZone} });
}

export async function dispatchAlarms(env, { now=Date.now(), fetchImpl=fetch }={}) {
  if (!pushConfigured(env)) return { accepted:0 };
  const { results } = await env.DB.prepare(`SELECT a.id, p.endpoint FROM task_alarms a
    JOIN items i ON i.id=a.item_id JOIN push_devices p ON p.user_id=a.user_id
    LEFT JOIN alarm_deliveries d ON d.alarm_id=a.id AND d.endpoint=p.endpoint
    WHERE a.fire_at<=? AND a.fire_at>=? AND i.completed=0 AND i.deleted_at IS NULL
    AND d.accepted_at IS NULL AND (d.claimed_at IS NULL OR d.claimed_at<?) LIMIT 100`).bind(now,now-900000,now-120000).all();
  let accepted=0;
  const grouped=new Map();
  for (const alarm of results) {
    const claim = await env.DB.prepare(`INSERT INTO alarm_deliveries(alarm_id,endpoint,claimed_at) VALUES(?,?,?)
      ON CONFLICT(alarm_id,endpoint) DO UPDATE SET claimed_at=excluded.claimed_at
      WHERE accepted_at IS NULL AND claimed_at<?`).bind(alarm.id,alarm.endpoint,now,now-120000).run();
    if (!claim.meta.changes) continue;
    if(!grouped.has(alarm.endpoint)) grouped.set(alarm.endpoint,[]);
    grouped.get(alarm.endpoint).push(alarm.id);
  }
  for (const [endpoint,ids] of grouped) {
    try {
      if (!validPushEndpoint(endpoint)) continue;
      const response = await fetchImpl(endpoint,{method:'POST',redirect:'error',headers:{
        Authorization:await pushAuthorization(env,endpoint,now),TTL:'900',Urgency:'high',
      }, signal:AbortSignal.timeout(10000)});
      if (response.status===404 || response.status===410) await env.DB.prepare('DELETE FROM push_devices WHERE endpoint=?').bind(endpoint).run();
      else if (response.ok) {
        await env.DB.batch(ids.map(id=>env.DB.prepare('UPDATE alarm_deliveries SET accepted_at=? WHERE alarm_id=? AND endpoint=?').bind(now,id,endpoint)));
        accepted+=ids.length;
      }
    } catch { /* bounded retry on a later cron; never log private endpoints */ }
  }
  await env.DB.prepare('DELETE FROM task_alarms WHERE fire_at<?').bind(now-7*86400000).run();
  return {accepted};
}
