const test = require("node:test");
const assert = require("node:assert/strict");
const Library = require("../landing/planner-library.js");

const template = Object.freeze({ id: "template-1", title: "Weekly reading", classId: "class-1", durationMinutes: 35, priority: "High", notes: "Read chapters 1–2", reminderChoice: "60" });

test("each template use creates an independent unscheduled assignment without changing the template", () => {
  let sequence = 0;
  const makeId = () => `new-task-${++sequence}`;
  const first = Library.instantiateTemplate(template, { makeId });
  const second = Library.instantiateTemplate(template, { makeId });
  assert.notEqual(first.id, second.id);
  assert.equal(first.id, "new-task-1");
  assert.equal(first.type, "assignment");
  assert.equal(first.classId, template.classId);
  assert.equal(first.notes, template.notes);
  assert.equal(first.reminderChoice, "60");
  assert.equal(first.durationMinutes, 35);
  assert.equal(first.dueDate, "");
  assert.equal(first.dueTime, "");
  assert.equal(first.scheduledStart, null);
  assert.equal(first.scheduledEnd, null);
  assert.equal(first.completed, false);
  first.title = "A different assignment";
  assert.equal(second.title, template.title);
  assert.equal(template.id, "template-1");
  assert.equal(template.title, "Weekly reading");
});

test("a scheduling draft retains reusable fields but no template identity, deadline or completion state", () => {
  const draft = Library.templateDraft({ ...template, dueDate: "2026-11-12", scheduledStart: "2026-11-12T09:00", completed: true });
  assert.deepEqual(draft, { title: "Weekly reading", classId: "class-1", durationMinutes: 35, priority: "High", notes: "Read chapters 1–2", reminderChoice: "60", type: "assignment" });
});

test("template validation rejects missing names, unsupported values and invalid duration boundaries", () => {
  for (const durationMinutes of [0, 4, 1441, 5.5, "no", Infinity]) {
    assert.throws(() => Library.normalizeTemplate({ ...template, durationMinutes }), error => error.field === "durationMinutes");
  }
  for (const durationMinutes of [5, 1440, "35"]) assert.equal(Library.normalizeTemplate({ ...template, durationMinutes }).durationMinutes, Number(durationMinutes));
  assert.throws(() => Library.normalizeTemplate({ title: "   " }), error => error.field === "title");
  assert.throws(() => Library.normalizeTemplate({ ...template, title: "x".repeat(81) }), error => error.field === "title");
  assert.throws(() => Library.normalizeTemplate({ ...template, priority: "urgent" }), error => error.field === "priority");
  assert.throws(() => Library.normalizeTemplate({ ...template, reminderChoice: "5" }), error => error.field === "reminderChoice");
  assert.throws(() => Library.normalizeTemplate({ ...template, notes: "x".repeat(5001) }), error => error.field === "notes");
  assert.deepEqual(Library.normalizeTemplate({ title: "  New work  " }), { title: "New work", classId: null, durationMinutes: 45, priority: "Medium", notes: "", reminderChoice: "default" });
});

test("saved resource links accept absolute HTTP(S) URLs and reject executable, relative or credential links", () => {
  assert.equal(Library.safeResourceUrl(" https://EXAMPLE.com/study?q=1#part "), "https://example.com/study?q=1#part");
  assert.equal(Library.safeResourceUrl("http://example.com"), "http://example.com/");
  for (const url of ["javascript:alert(1)", "data:text/html,test", "file:///tmp/test", "/study", "//example.com", "https://user:password@example.com", "https://example.com/has space", "https://exa\nmple.com", "", "https://example.com/" + "a".repeat(2048)]) {
    assert.equal(Library.safeResourceUrl(url), null, url);
  }
});

test("resource validation requires class ownership and enforces server-compatible limits", () => {
  const resource = { id: "resource-1", classId: "class-1", title: "  Class guide ", url: "https://EXAMPLE.com/guide", description: " Read first ", category: " Handout ", sortOrder: "2" };
  assert.deepEqual(Library.normalizeResource(resource), { id: "resource-1", classId: "class-1", title: "Class guide", url: "https://example.com/guide", description: "Read first", category: "Handout", sortOrder: 2 });
  assert.equal(resource.title, "  Class guide ");
  for (const [field, value] of [["classId", null], ["title", ""], ["title", "x".repeat(121)], ["description", "x".repeat(2001)], ["category", "x".repeat(61)], ["sortOrder", -1], ["sortOrder", 10001], ["sortOrder", 1.5], ["url", "javascript:alert(1)"]]) {
    assert.throws(() => Library.normalizeResource({ ...resource, [field]: value }), error => error.field === field);
  }
});

test("library labels are escaped independently of safe link handling", () => {
  assert.equal(Library.escapeHtml('<img src=x onerror="alert(1)"> & \'title\''), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;title&#39;");
  assert.equal(Library.escapeHtml(null), "");
  const resource = Library.normalizeResource({ classId: "class-1", title: '<b>Study "guide"</b>', url: "https://example.com/?x=1&y=2" });
  assert.equal(resource.title, '<b>Study "guide"</b>');
  assert.equal(Library.escapeHtml(resource.url), "https://example.com/?x=1&amp;y=2");
});

test("an old account's pending template copy cannot report errors or clear the new owner's pending guard", async () => {
  const listeners = new Map();
  const document = { querySelector: () => null, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) };
  let owner = "A";
  const requests = [];
  const toasts = [];
  const errors = [];
  const store = {
    mode: "cloud", get user() { return { id: owner }; },
    listTemplates: () => [{ ...template, id: "shared-test-id", title: `${owner} private template` }],
    upsertItem: () => new Promise((resolve, reject) => requests.push({ owner, resolve, reject })),
  };
  const library = Library.create({ store, document, showToast: message => toasts.push(message), reportError: error => errors.push(error) });
  const control = { disabled: false, getAttribute: () => null, dataset: { libraryAction: "add-template", libraryId: "shared-test-id" } };
  const click = () => listeners.get("click")({ target: { closest: selector => selector === "[data-library-action]" ? control : null } });
  const settle = () => new Promise(resolve => setImmediate(resolve));
  click();
  assert.equal(requests.length, 1);
  owner = "B";
  library.render();
  click();
  assert.equal(requests.length, 2);
  requests[0].reject(new Error("A private failure"));
  await settle();
  click();
  assert.equal(requests.length, 2, "A's finally must not clear B's pending operation with the same ID");
  assert.equal(errors.length, 0);
  assert.equal(toasts.length, 0);
  requests[1].resolve();
  await settle();
  assert.equal(toasts.length, 1);
  assert.equal(errors.length, 0);
  library.destroy();
});
