const test = require("node:test");
const assert = require("node:assert/strict");
const Model = require("../landing/planner-model.js");
const Store = require("../landing/planner-store.js");

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data, full: false,
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { if (this.full) throw new Error("Quota exceeded"); data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
  };
}
const defaultClasses = () => [
  { id: "local-math", name: "Mathematics", color: "#538fc5", code: "M" },
  { id: "local-science", name: "Science", color: "#338855", code: "S" },
];
function localStore(storage = memoryStorage(), options = {}) {
  return Store.createPlannerStore({ storage, model: Model, defaultClasses, defaultTasks: () => [], documentRef: null, ...options });
}
async function cloudHarness({ storage = memoryStorage(), legacyPlanner = false } = {}) {
  const [{ handleRequest }, { createFakeEnv, createCtx, ORIGIN }] = await Promise.all([
    import("../cloudflare/src/index.js"), import("./support/fake-cloudflare.mjs"),
  ]);
  const fake = createFakeEnv(), ctx = createCtx(), jar = { value: null }, requests = [], sockets = [], network = {};
  class Socket {
    constructor(url) { this.url = url; sockets.push(this); }
    send() {}
    close() { this.closed = true; }
    receive(message) { if (!this.closed) this.onmessage({ data: JSON.stringify(message) }); }
  }
  const fetchImpl = async (url, init = {}) => {
    const target = new URL(url, ORIGIN);
    const request = { path: target.pathname, method: init.method || "GET", body: init.body ? JSON.parse(init.body) : undefined };
    requests.push(request);
    const headers = { ...init.headers, Origin: ORIGIN };
    if (jar.value) headers.Cookie = jar.value;
    if (network.intercept) {
      const replacement = await network.intercept(request);
      if (replacement) return replacement;
    }
    const response = await handleRequest(new Request(target, { ...init, headers }), fake.env, ctx);
    await ctx.settle();
    const cookie = response.headers.get("set-cookie");
    if (cookie?.startsWith("duckplan_session=")) jar.value = cookie.includes("Max-Age=0") ? null : cookie.split(";")[0];
    if (legacyPlanner && target.pathname === "/api/planner" && response.ok) {
      const { classes, items } = await response.json();
      return new Response(JSON.stringify({ classes, items }), { headers: { "Content-Type": "application/json" } });
    }
    return response;
  };
  const makeStore = () => localStore(storage, { config: { apiUrl: "/api" }, fetchImpl, WebSocketImpl: Socket, locationRef: { href: `${ORIGIN}/#calendar` } });
  const store = makeStore();
  await store.init();
  return { ...fake, ctx, jar, requests, sockets, storage, store, makeStore, network };
}

test("local templates and class resources survive editing/reload and stay empty after their last deletion", async () => {
  const storage = memoryStorage(), store = localStore(storage);
  await store.init();
  assert.equal(store.supportsOrganization, true);
  const template = await store.upsertTemplate({ title: "Reading response", classId: "local-math", durationMinutes: 30, priority: "High", notes: "Use evidence", reminderChoice: "60" });
  const resource = await store.upsertResource({ title: "Textbook", classId: "local-science", url: "https://school.test/book", category: "Reading", description: "Unit 2", sortOrder: 4 });
  await store.upsertResource({ title: "Math guide", classId: "local-math", url: "https://school.test/math" });
  await store.upsertTemplate({ ...template, title: "Reading reflection", classId: null, durationMinutes: 60 });
  await store.upsertResource({ ...resource, title: "New textbook", classId: "local-math", sortOrder: 0 });
  const reloaded = localStore(storage);
  await reloaded.init();
  assert.deepEqual(reloaded.listTemplates().map(({ title, classId, durationMinutes, notes }) => [title, classId, durationMinutes, notes]), [["Reading reflection", null, 60, "Use evidence"]]);
  assert.equal(reloaded.listResources({ classId: "local-science" }).length, 0);
  assert.equal(reloaded.listResources({ classId: "local-math" }).length, 2);
  await reloaded.deleteTemplate(template.id);
  for (const item of reloaded.listResources()) await reloaded.deleteResource(item.id);
  const empty = localStore(storage);
  await empty.init();
  assert.deepEqual(empty.listTemplates(), []);
  assert.deepEqual(empty.listResources(), []);
  await assert.rejects(empty.upsertTemplate({ title: "Foreign", classId: "not-in-planner" }), /Choose a class/);
  await assert.rejects(empty.upsertResource({ title: "No class", url: "https://school.test" }), /Choose a class/);
  await assert.rejects(empty.upsertResource({ title: "Script", classId: "local-math", url: "javascript:alert(1)" }), /http/);
});

test("local urgency preferences accept both range boundaries and reject invalid changes without altering the saved value", async () => {
  const storage = memoryStorage(), store = localStore(storage);
  await store.init();
  assert.deepEqual(store.organizationPreferences(), { urgencyDays: 2 });
  for (const urgencyDays of [0, 30, 6]) {
    await store.saveOrganizationPreferences({ urgencyDays });
    const reloaded = localStore(storage);
    await reloaded.init();
    assert.deepEqual(reloaded.organizationPreferences(), { urgencyDays });
  }
  const detached = store.organizationPreferences();
  detached.urgencyDays = 100;
  assert.equal(store.organizationPreferences().urgencyDays, 6);
  for (const urgencyDays of [-1, 31, 1.5, "invalid"]) await assert.rejects(store.saveOrganizationPreferences({ urgencyDays }), /0 to 30/);
  assert.equal(store.organizationPreferences().urgencyDays, 6);
});

test("task organization metadata round-trips through row conversion, reload and completion", async () => {
  const storage = memoryStorage(), store = localStore(storage);
  await store.init();
  const task = await store.upsertItem({ title: "Quiz revision", classId: "local-math", importance: "important", urgency: "not_urgent", dueDate: "2026-11-15", scheduledStart: "2026-11-13T16:00", durationMinutes: 60 });
  const row = Store.taskToRow(task), restored = Store.rowToTask(row);
  assert.deepEqual([row.importance, row.urgency, restored.importance, restored.urgency], ["important", "not_urgent", "important", "not_urgent"]);
  await store.toggleComplete(task.id, true);
  const reloaded = localStore(storage);
  await reloaded.init();
  assert.deepEqual(reloaded.listItems().map((item) => [item.importance, item.urgency, item.completed]), [["important", "not_urgent", true]]);
  await reloaded.toggleComplete(task.id, false);
  assert.equal(reloaded.listItems()[0].urgency, "not_urgent");
  await assert.rejects(reloaded.upsertItem({ ...task, importance: "maybe" }), /valid importance/);
  await assert.rejects(reloaded.upsertItem({ ...task, urgency: "tomorrow" }), /valid importance/);
  assert.equal(Store.rowToTask({ id: "old", title: "Old" }).importance, null);
  assert.equal(Store.rowToTask({ id: "old", title: "Old" }).urgency, "auto");
});

test("local import maps class names once and assigns fresh IDs to tasks, templates and resources", () => {
  let next = 0;
  const plan = Store.planLocalImport({
    localClasses: defaultClasses(), cloudClasses: [{ id: "cloud-math", name: "mathematics" }],
    localTasks: [{ id: "task-old", title: "Review", classId: "local-math", importance: "not_important", urgency: "urgent" }],
    localTemplates: [{ id: "template-old", title: "Lab", classId: "local-science", durationMinutes: 90, priority: "Low", notes: "Report", reminderChoice: "15" }],
    localResources: [{ id: "resource-old", title: "Guide", classId: "local-science", url: "https://school.test", category: "Guide", sortOrder: 3 }],
    localOrganization: { urgencyDays: 0 }, makeId: () => `fresh-${++next}`,
  });
  assert.deepEqual(plan.classRows.map((row) => [row.id, row.name]), [["fresh-1", "Science"]]);
  assert.deepEqual([plan.itemRows[0].id, plan.templateRows[0].id, plan.resourceRows[0].id], ["fresh-2", "fresh-3", "fresh-4"]);
  assert.deepEqual([plan.itemRows[0].class_id, plan.templateRows[0].class_id, plan.resourceRows[0].class_id], ["cloud-math", "fresh-1", "fresh-1"]);
  assert.deepEqual([plan.itemRows[0].importance, plan.itemRows[0].urgency, plan.templateRows[0].reminder_choice], ["not_important", "urgent", "15"]);
  assert.deepEqual(plan.organization, { urgency_days: 0 });
});

test("storage exhaustion rejects template/resource/preference/task writes and rolls back the visible planner", async () => {
  const storage = memoryStorage(), store = localStore(storage);
  await store.init();
  const template = await store.upsertTemplate({ title: "Saved template" });
  const resource = await store.upsertResource({ title: "Saved resource", classId: "local-math", url: "https://school.test" });
  const task = await store.upsertItem({ title: "Saved task", importance: "important", urgency: "urgent" });
  const before = structuredClone({ templates: store.listTemplates(), resources: store.listResources(), tasks: store.listItems(), preferences: store.organizationPreferences() });
  const events = [];
  store.subscribe(({ reason }) => events.push(reason));
  storage.full = true;
  for (const attempt of [
    () => store.upsertTemplate({ ...template, title: "Unsaved" }), () => store.deleteTemplate(template.id),
    () => store.upsertResource({ ...resource, title: "Unsaved" }), () => store.deleteResource(resource.id),
    () => store.saveOrganizationPreferences({ urgencyDays: 10 }), () => store.toggleComplete(task.id, true),
  ]) await assert.rejects(attempt(), /Couldn't save/);
  assert.deepEqual({ templates: store.listTemplates(), resources: store.listResources(), tasks: store.listItems(), preferences: store.organizationPreferences() }, before);
  assert.deepEqual(events, Array.from({ length: 6 }, () => ["local", "error"]).flat());
  storage.full = false;
  const reloaded = localStore(storage);
  await reloaded.init();
  assert.deepEqual(reloaded.listTemplates(), before.templates);
  assert.deepEqual(reloaded.listResources(), before.resources);
  assert.equal(reloaded.listItems()[0].completed, false);
});

test("cloud organization CRUD uses the real API row mappings and reloads persisted organization data", async () => {
  const app = await cloudHarness(), { store } = app;
  await store.signUp("cloud@store.test", "planner test password");
  assert.equal(store.supportsOrganization, true);
  const subject = await store.upsertClass({ name: "Mathematics", color: "#538fc5" });
  const template = await store.upsertTemplate({ title: "Study block", classId: subject.id, durationMinutes: 90, priority: "Low", notes: "Practice", reminderChoice: "15" });
  const resource = await store.upsertResource({ title: "Class guide", classId: subject.id, url: "https://school.test/guide", description: "Exam work", category: "Revision", sortOrder: 2 });
  const task = await store.upsertItem({ title: "Review", classId: subject.id, importance: "not_important", urgency: "urgent" });
  await store.saveOrganizationPreferences({ urgencyDays: 0 });
  assert.deepEqual(app.requests.find((request) => request.path === `/api/task-templates/${template.id}`).body, { id: template.id, class_id: subject.id, title: "Study block", duration_minutes: 90, priority: "low", notes: "Practice", reminder_choice: "15" });
  assert.deepEqual(app.requests.find((request) => request.path === `/api/class-resources/${resource.id}`).body, { id: resource.id, class_id: subject.id, title: "Class guide", url: "https://school.test/guide", description: "Exam work", category: "Revision", sort_order: 2 });
  assert.deepEqual(app.requests.find((request) => request.path === "/api/organization-preferences").body, { urgency_days: 0 });
  await store.refresh();
  assert.deepEqual(store.listTemplates(), [template]);
  assert.deepEqual(store.listResources({ classId: subject.id }), [resource]);
  assert.deepEqual(store.organizationPreferences(), { urgencyDays: 0 });
  await store.toggleComplete(task.id, true);
  await store.refresh();
  assert.deepEqual([store.listItems()[0].importance, store.listItems()[0].urgency, store.listItems()[0].completed], ["not_important", "urgent", true]);
  await store.deleteTemplate(template.id);
  await store.deleteResource(resource.id);
  await store.refresh();
  assert.deepEqual(store.listTemplates(), []);
  assert.deepEqual(store.listResources(), []);
});

test("cloud import preserves local library data with remapped classes and fresh identifiers", async () => {
  const app = await cloudHarness(), { store } = app;
  const template = await store.upsertTemplate({ title: "Local study", classId: "local-math", reminderChoice: "off" });
  const resource = await store.upsertResource({ title: "Local guide", classId: "local-science", url: "https://school.test/science" });
  const task = await store.upsertItem({ title: "Local task", classId: "local-math", importance: "important", urgency: "not_urgent" });
  await store.saveOrganizationPreferences({ urgencyDays: 5 });
  await store.signUp("import@store.test", "planner test password");
  const existingMath = await store.upsertClass({ name: "MATHEMATICS", color: "#538fc5" });
  assert.equal(await store.localImportOffer(), 4, "offer includes the task, template, resource and configured preferences");
  assert.equal(await store.importLocalTasks(), 1);
  assert.equal(await store.localImportOffer(), 0);
  const importedTemplate = store.listTemplates()[0], importedResource = store.listResources()[0], importedTask = store.listItems()[0];
  for (const [before, after] of [[template, importedTemplate], [resource, importedResource], [task, importedTask]]) assert.notEqual(after.id, before.id);
  assert.equal(importedTemplate.classId, existingMath.id);
  assert.equal(importedTask.classId, existingMath.id);
  assert.equal(store.classById(importedResource.classId).name, "Science");
  assert.deepEqual([importedTask.importance, importedTask.urgency, importedTemplate.reminderChoice], ["important", "not_urgent", "off"]);
  assert.deepEqual(store.organizationPreferences(), { urgencyDays: 5 });
  const reloaded = app.makeStore();
  await reloaded.init();
  assert.deepEqual(reloaded.listTemplates(), store.listTemplates());
  assert.deepEqual(reloaded.listResources(), store.listResources());
});

test("a full import-marker store does not turn a committed import into failure or duplicate its rows on reload/retry", async () => {
  const app = await cloudHarness(), { store, storage } = app;
  await store.upsertItem({ title: "Local task", classId: "local-math", importance: "important" });
  await store.upsertTemplate({ title: "Local template", classId: "local-math" });
  await store.upsertResource({ title: "Local resource", classId: "local-science", url: "https://school.test" });
  await store.saveOrganizationPreferences({ urgencyDays: 4 });
  await store.signUp("quota@store.test", "planner test password");
  storage.full = true;
  assert.equal(await store.importLocalTasks(), 1, "server success remains successful when the browser cannot write its marker");
  assert.equal(await store.localImportOffer(), 0, "this session remembers the successful import in memory");
  assert.equal(storage.getItem(`duckplan-local-import-v1:${store.user.id}`), null);
  const originalIds = [store.listItems()[0].id, store.listTemplates()[0].id, store.listResources()[0].id];
  const reloaded = app.makeStore();
  await reloaded.init();
  assert.equal(await reloaded.localImportOffer(), 4, "a new session cannot read an unwritten local marker");
  assert.equal(await reloaded.importLocalTasks(), 1);
  assert.deepEqual([reloaded.listItems().length, reloaded.listTemplates().length, reloaded.listResources().length], [1, 1, 1]);
  assert.deepEqual([reloaded.listItems()[0].id, reloaded.listTemplates()[0].id, reloaded.listResources()[0].id], originalIds);
  const attempts = app.requests.filter((request) => request.path === "/api/import");
  assert.equal(attempts.length, 2);
  assert.match(attempts[0].body.idempotencyKey, /^[0-9a-f]{64}$/);
  assert.equal(attempts[1].body.idempotencyKey, attempts[0].body.idempotencyKey);
  assert.notEqual(attempts[1].body.itemRows[0].id, attempts[0].body.itemRows[0].id, "receipt prevents duplication even after fresh-ID remapping");
});

test("live library rows update and remove entries, while account switching clears private cloud data", async () => {
  const app = await cloudHarness(), { store } = app;
  await store.signUp("first@store.test", "planner test password");
  const subject = await store.upsertClass({ name: "Private class", color: "#538fc5" });
  const socket = app.sockets.at(-1);
  const template = { id: "remote-template", class_id: subject.id, title: "From phone", duration_minutes: 60, priority: "high", notes: "Private notes", reminder_choice: "60" };
  const resource = { id: "remote-resource", class_id: subject.id, title: "From tablet", url: "https://school.test/private", category: "Private", sort_order: 3 };
  socket.receive({ table: "task_templates", row: template });
  socket.receive({ table: "class_resources", row: resource });
  socket.receive({ table: "planner_preferences", row: { urgency_days: 8 } });
  assert.equal(store.listTemplates()[0].priority, "High");
  assert.equal(store.listResources()[0].classId, subject.id);
  assert.deepEqual(store.organizationPreferences(), { urgencyDays: 8 });
  socket.receive({ table: "task_templates", row: { ...template, deleted_at: "2026-11-12T12:00:00Z" } });
  socket.receive({ table: "class_resources", row: { ...resource, deleted_at: "2026-11-12T12:00:00Z" } });
  assert.deepEqual(store.listTemplates(), []);
  assert.deepEqual(store.listResources(), []);
  await store.upsertTemplate({ title: "First account only", classId: subject.id });
  await store.upsertResource({ title: "First private resource", classId: subject.id, url: "https://school.test/first" });
  await store.signOut();
  assert.equal(socket.closed, true);
  assert.deepEqual(store.listTemplates(), []);
  assert.deepEqual(store.listResources(), []);
  await store.signUp("second@store.test", "planner test password");
  socket.onmessage({ data: JSON.stringify({ table: "class_resources", row: resource }) });
  assert.deepEqual(store.listTemplates(), []);
  assert.deepEqual(store.listResources(), [], "queued callbacks from the retired account socket cannot inject its private resource");
  assert.deepEqual(store.organizationPreferences(), { urgencyDays: 2 });
  await assert.rejects(store.upsertTemplate({ title: "Wrong class", classId: subject.id }), /Choose a class/);
});

test("a delayed failed library write from the previous account cannot restore its private snapshot after an account switch", async () => {
  for (const kind of ["template", "resource"]) {
    const app = await cloudHarness(), { store } = app;
    await store.signUp(`first-${kind}@store.test`, "planner test password");
    const subject = await store.upsertClass({ name: "First private class", color: "#538fc5" });
    const original = kind === "template"
      ? await store.upsertTemplate({ title: "First private template", classId: subject.id })
      : await store.upsertResource({ title: "First private resource", classId: subject.id, url: "https://school.test/private" });
    let releaseWrite, announceStarted, blockReloads = false;
    const started = new Promise((resolve) => { announceStarted = resolve; });
    const delayedFailure = new Promise((resolve) => { releaseWrite = resolve; });
    const route = `/api/${kind === "template" ? "task-templates" : "class-resources"}/${original.id}`;
    app.network.intercept = (request) => {
      if (request.path === route && request.method === "PUT") { announceStarted(); return delayedFailure; }
      if (blockReloads && request.path === "/api/planner") return new Response(JSON.stringify({ error: "Reload failed" }), { status: 503 });
      return null;
    };
    const write = kind === "template" ? store.upsertTemplate({ ...original, title: "Pending change" }) : store.upsertResource({ ...original, title: "Pending change" });
    const failed = assert.rejects(write, /write failed/);
    await started;
    await store.signOut();
    await store.signUp(`second-${kind}@store.test`, "planner test password");
    const secondUser = store.user.id;
    blockReloads = true;
    releaseWrite(new Response(JSON.stringify({ error: "Old write failed" }), { status: 503 }));
    await failed;
    assert.equal(store.user.id, secondUser);
    assert.deepEqual(store.listTemplates(), [], kind);
    assert.deepEqual(store.listResources(), [], kind);
    assert.deepEqual(store.listClasses(), [], "a failed old-account write cannot restore its private classes");
  }
});

test("a failed new-account planner load clears the previous account's private data before reporting failure", async () => {
  const app = await cloudHarness(), { store } = app;
  await store.signUp("loaded@store.test", "planner test password");
  const subject = await store.upsertClass({ name: "Private class", color: "#538fc5" });
  await store.upsertItem({ title: "Private task", classId: subject.id, importance: "important" });
  await store.upsertTemplate({ title: "Private template", classId: subject.id });
  await store.upsertResource({ title: "Private resource", classId: subject.id, url: "https://school.test/private" });
  await store.saveOrganizationPreferences({ urgencyDays: 9 });
  const events = [];
  store.subscribe(({ reason }) => events.push(reason));
  app.network.intercept = (request) => request.path === "/api/planner"
    ? new Response(JSON.stringify({ error: "New account load failed" }), { status: 503 }) : null;
  await assert.rejects(store.signUp("unloaded@store.test", "planner test password"), /New account load failed/);
  assert.equal(store.user.email, "unloaded@store.test");
  assert.ok(events.includes("context"), "the UI is notified as soon as its account context changes");
  assert.deepEqual([store.listItems(), store.listClasses(), store.listTemplates(), store.listResources()], [[], [], [], []]);
  assert.deepEqual(store.organizationPreferences(), { urgencyDays: 2 });
});

test("a stale session refresh cannot reactivate the previous account after a newer sign-in", async () => {
  const app = await cloudHarness(), { store } = app;
  await store.signUp("old-session@store.test", "planner test password");
  const previousUser = structuredClone(store.user);
  let release, announceStarted, held = false;
  const response = new Promise((resolve) => { release = resolve; });
  const started = new Promise((resolve) => { announceStarted = resolve; });
  app.network.intercept = (request) => {
    if (!held && request.path === "/api/session") { held = true; announceStarted(); return response; }
    return null;
  };
  const refresh = store.refresh();
  await started;
  await store.signOut();
  await store.signUp("new-session@store.test", "planner test password");
  const newUser = store.user.id;
  await store.upsertTemplate({ title: "New account template" });
  release(new Response(JSON.stringify({ user: previousUser, providers: { password: true, google: true } })));
  await refresh;
  assert.equal(store.user.id, newUser);
  assert.equal(store.providers.google, false, "the retired session cannot overwrite current provider state either");
  assert.deepEqual(store.listTemplates().map((item) => item.title), ["New account template"]);
});

test("pending initialization and its failure fallback cannot overwrite a newer account activation", async () => {
  for (const phase of ["session", "planner"]) {
    const app = await cloudHarness();
    await app.store.signUp(`original-${phase}@store.test`, "planner test password");
    const previousUser = structuredClone(app.store.user);
    const store = app.makeStore();
    let release, announceStarted, held = false;
    const response = new Promise((resolve) => { release = resolve; });
    const started = new Promise((resolve) => { announceStarted = resolve; });
    app.network.intercept = (request) => {
      if (!held && request.path === `/api/${phase}`) { held = true; announceStarted(); return response; }
      return null;
    };
    const initialization = store.init();
    await started;
    await store.signUp(`newer-${phase}@store.test`, "planner test password");
    const newUser = store.user.id;
    await store.upsertTemplate({ title: "Newer account template" });
    release(phase === "session"
      ? new Response(JSON.stringify({ user: previousUser, providers: { password: true, google: false } }))
      : new Response(JSON.stringify({ error: "Old planner load failed" }), { status: 503 }));
    await initialization;
    assert.equal(store.mode, "cloud", phase);
    assert.equal(store.user.id, newUser, phase);
    assert.deepEqual(store.listTemplates().map((item) => item.title), ["Newer account template"], phase);
  }
});

test("delayed password/recovery responses cannot expose the previous account's recovery code after switching accounts", async () => {
  for (const method of ["changePassword", "newRecoveryCode"]) {
    const app = await cloudHarness(), { store } = app;
    await store.signUp(`old-${method}@store.test`, "planner test password");
    let release, announceStarted;
    const response = new Promise((resolve) => { release = resolve; });
    const started = new Promise((resolve) => { announceStarted = resolve; });
    const route = method === "changePassword" ? "/api/auth/password" : "/api/auth/recovery-code";
    app.network.intercept = (request) => {
      if (request.path === route) { announceStarted(); return response; }
      return null;
    };
    const operation = method === "changePassword"
      ? store.changePassword("planner test password", "replacement password") : store.newRecoveryCode("planner test password");
    const rejected = assert.rejects(operation, /account changed/i);
    await started;
    await store.signOut();
    await store.signUp(`new-${method}@store.test`, "planner test password");
    const currentUser = structuredClone(store.user);
    release(new Response(JSON.stringify({ recoveryCode: "OLD-ACCOUNT-RECOVERY-CODE" })));
    await rejected;
    assert.deepEqual(store.user, currentUser, `${method} must neither return the old credential nor change the new account's flags`);
  }
});

test("late sign-up/sign-in/recovery responses cannot activate an old owner or return its recovery code", async () => {
  for (const method of ["signUp", "signIn", "recoverAccount"]) {
    const app = await cloudHarness(), { store } = app;
    await store.signUp(`previous-${method}@store.test`, "planner test password");
    const previousUser = structuredClone(store.user);
    let release, announceStarted, held = false;
    const response = new Promise((resolve) => { release = resolve; });
    const started = new Promise((resolve) => { announceStarted = resolve; });
    const route = { signUp: "/api/auth/sign-up", signIn: "/api/auth/sign-in", recoverAccount: "/api/auth/recover" }[method];
    app.network.intercept = (request) => {
      if (!held && request.path === route) { held = true; announceStarted(); return response; }
      return null;
    };
    const operation = method === "signUp" ? store.signUp("delayed-signup@store.test", "planner test password")
      : method === "signIn" ? store.signIn(previousUser.email, "planner test password")
        : store.recoverAccount(previousUser.email, "fake-code-for-delayed-response", "replacement password");
    const rejected = assert.rejects(operation, /account changed/i);
    await started;
    await store.signOut();
    await store.signUp(`current-${method}@store.test`, "planner test password");
    const currentUser = store.user.id;
    await store.upsertTemplate({ title: "Current private template" });
    release(new Response(JSON.stringify({ user: previousUser, recoveryCode: "PREVIOUS-ACCOUNT-RECOVERY-CODE" })));
    await rejected;
    assert.equal(store.user.id, currentUser, method);
    assert.deepEqual(store.listTemplates().map((item) => item.title), ["Current private template"], method);
  }
});

test("auth activation finishing after an account switch cannot return a stale sign-up/recovery result", async () => {
  for (const method of ["signUp", "signIn", "recoverAccount"]) {
    const app = await cloudHarness(), { store } = app;
    const email = `previous-activation-${method}@store.test`;
    const recoveryCode = await store.signUp(email, "planner test password");
    let release, announceStarted, held = false;
    const response = new Promise((resolve) => { release = resolve; });
    const started = new Promise((resolve) => { announceStarted = resolve; });
    app.network.intercept = (request) => {
      if (!held && request.path === "/api/planner") { held = true; announceStarted(); return response; }
      return null;
    };
    const operation = method === "signUp" ? store.signUp("delayed-activation@store.test", "planner test password")
      : method === "signIn" ? store.signIn(email, "planner test password")
        : store.recoverAccount(email, recoveryCode, "replacement password");
    const rejected = assert.rejects(operation, /account changed/i);
    await started;
    await store.signOut();
    await store.signUp(`current-activation-${method}@store.test`, "planner test password");
    const currentUser = store.user.id;
    await store.upsertTemplate({ title: "New account template" });
    release(new Response(JSON.stringify({ classes: [], items: [], templates: [{ id: "previous-template", title: "Previous private template" }], resources: [], organization: { urgency_days: 9 } })));
    await rejected;
    assert.equal(store.user.id, currentUser, method);
    assert.deepEqual(store.listTemplates().map((item) => item.title), ["New account template"], method);
    assert.deepEqual(store.organizationPreferences(), { urgencyDays: 2 }, method);
  }
});

test("a delayed Axis response or its planner reload cannot overwrite a newer account's planner", async () => {
  for (const phase of ["sync", "reload"]) {
    const app = await cloudHarness(), { store } = app;
    await store.signUp(`old-axis-${phase}@store.test`, "planner test password");
    await store.upsertItem({ title: "Previous private assignment", importance: "important", reminderChoice: "15", actualMinutes: 35 });
    const oldPlanner = {
      classes: store.listClasses().map(Store.classToRow), items: store.listItems().map(Store.taskToRow),
      templates: [], resources: [], organization: { urgency_days: 2 },
    };
    let release, announceStarted, held = false;
    const response = new Promise((resolve) => { release = resolve; });
    const started = new Promise((resolve) => { announceStarted = resolve; });
    app.network.intercept = (request) => {
      if (request.path === "/api/axis" && request.method === "POST") {
        if (phase === "sync") { held = true; announceStarted(); return response; }
        return new Response(JSON.stringify({ added: 0, updated: 1 }));
      }
      if (phase === "reload" && !held && request.path === "/api/planner") { held = true; announceStarted(); return response; }
      return null;
    };
    const sync = store.invokeAxis({ mode: "sync" });
    const rejected = assert.rejects(sync, /account changed/i);
    await started;
    await store.signOut();
    await store.signUp(`new-axis-${phase}@store.test`, "planner test password");
    const newUser = store.user.id;
    await store.upsertItem({ title: "Current assignment", importance: "not_important" });
    release(new Response(JSON.stringify(phase === "sync" ? { added: 0, updated: 1 } : oldPlanner)));
    await rejected;
    assert.equal(store.user.id, newUser, phase);
    assert.deepEqual(store.listItems().map((item) => item.title), ["Current assignment"], phase);
  }
});

test("old-server capability detection blocks organization writes and local imports without discarding local data", async () => {
  for (const kind of ["template", "resource", "metadata", "preferences"]) {
    const app = await cloudHarness({ legacyPlanner: true }), { store } = app;
    if (kind === "template") await store.upsertTemplate({ title: "Keep template" });
    if (kind === "resource") await store.upsertResource({ title: "Keep resource", classId: "local-math", url: "https://school.test" });
    if (kind === "metadata") await store.upsertItem({ title: "Keep overrides", importance: "important", urgency: "urgent" });
    if (kind === "preferences") await store.saveOrganizationPreferences({ urgencyDays: 9 });
    await store.signUp(`${kind}@store.test`, "planner test password");
    assert.equal(store.supportsOrganization, false);
    await assert.rejects(store.upsertTemplate({ title: "Unsupported" }), /available/);
    await assert.rejects(store.saveOrganizationPreferences({ urgencyDays: 3 }), /available/);
    await assert.rejects(store.importLocalTasks(), /server.*import|server.*support/i, kind);
    assert.equal(app.requests.some((request) => request.path === "/api/import"), false, kind);
    await store.signOut();
    if (kind === "template") assert.equal(store.listTemplates()[0].title, "Keep template");
    if (kind === "resource") assert.equal(store.listResources()[0].title, "Keep resource");
    if (kind === "metadata") assert.equal(store.listItems()[0].importance, "important");
    if (kind === "preferences") assert.equal(store.organizationPreferences().urgencyDays, 9);
  }
});
