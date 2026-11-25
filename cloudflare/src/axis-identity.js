// Exact source snapshots bridge regenerated Axis UIDs. No title-only/fuzzy matches.
// A separate slot per simultaneous identical event preserves feed multiplicity.
async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function resolveAxisIdentities({ feed, existingItems, existingClasses, existingKeys }) {
  const byId = new Map(existingItems.map(row => [row.id, row]));
  const byUid = new Map(existingItems.map(row => [row.axis_uid, row]));
  const classes = new Map(existingClasses.map(row => [row.id, row.axis_key]));
  const signature = item => JSON.stringify([item.classKey ?? null, item.title, item.type, item.dueDate, item.dueTime ?? null, item.notes || ""]);
  const hashes = new Map();
  async function snapshot(item) {
    const text = signature(item);
    if (!hashes.has(text)) hashes.set(text, digest(text));
    return "snapshot:" + await hashes.get(text);
  }
  const keys = new Map(existingKeys.map(row => [row.identity_key, row.item_id]));
  const recordedIds = new Set(existingKeys.map(row => row.item_id));
  const links = new Map();
  const slots = new Map();
  function addSlot(base, key, id) {
    if (!slots.has(base)) slots.set(base, []);
    slots.get(base).push({ key, id });
  }
  for (const [key, id] of keys) {
    if (key.startsWith("snapshot:") && byId.has(id)) addSlot(key.slice(0, key.lastIndexOf(":")), key, id);
  }
  function allocate(base, id) {
    const available = slots.get(base) || [];
    const old = available.find(slot => slot.id === id);
    if (old) return old.key;
    let index = 0;
    while (keys.has(`${base}:${index}`)) index += 1;
    const key = `${base}:${index}`;
    keys.set(key, id);
    addSlot(base, key, id);
    return key;
  }
  // Upgrade legacy rows conservatively from their current exact values. Only
  // selected matches need new keys: a large old duplicate backlog must not cause
  // thousands of database writes. Completed/deleted rows prevent resurrection.
  const legacy = new Map();
  for (const row of [...existingItems].sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")) || a.id.localeCompare(b.id))) {
    if (recordedIds.has(row.id)) continue;
    const base = await snapshot({ classKey: classes.get(row.class_id) ?? null, title: row.title, type: row.type, dueDate: row.due_date, dueTime: row.due_time, notes: row.notes });
    if (!legacy.has(base)) legacy.set(base, []);
    legacy.get(base).push(row);
  }
  const entries = await Promise.all(feed.items.map(async item => {
    const base = await snapshot(item);
    const uidKey = "uid:" + await digest(item.axisUid);
    return { item, base, uidKey, known: byUid.get(item.axisUid) || byId.get(keys.get(uidKey)) };
  }));
  // Reserve known identities first, regardless of the order of feed events.
  const claimed = new Set(entries.filter(entry => entry.known).map(entry => entry.known.id));
  const emitted = new Set(), items = [], insertKeys = new Map();
  for (const { item, base, uidKey, known } of entries) {
    const candidate = known || byId.get((slots.get(base) || []).find(slot => !claimed.has(slot.id))?.id)
      || (legacy.get(base) || []).find(row => !claimed.has(row.id));
    const id = candidate?.id || "new:" + item.axisUid;
    claimed.add(id);
    const key = allocate(base, id);
    const axisUid = candidate?.axis_uid || item.axisUid;
    for (const identityKey of [key, uidKey]) links.set(identityKey, { identity_key: identityKey, axis_uid: axisUid, snapshot_key: key });
    if (emitted.has(id)) continue;
    emitted.add(id);
    items.push({ ...item, axisUid });
    insertKeys.set(axisUid, key);
  }
  return { feed: { ...feed, items }, links: [...links.values()], insertKeys };
}
