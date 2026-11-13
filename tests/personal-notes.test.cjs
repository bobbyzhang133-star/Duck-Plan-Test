const test = require("node:test");
const assert = require("node:assert/strict");
const Notes = require("../landing/personal-notes.js");

test("notes preserve multiline writing and custom categories without treating text as markup", () => {
  const note = Notes.normalizeNote({ id: "note-1", title: "  Lab ideas  ", category: "Revision", body: "First line\n<script>plain text</script>" });
  assert.deepEqual(note, { id: "note-1", title: "Lab ideas", category: "Revision", body: "First line\n<script>plain text</script>" });
  assert.throws(() => Notes.normalizeNote({ title: "   " }), /title/);
  assert.throws(() => Notes.normalizeNote({ title: "A", body: "a".repeat(5001) }), /5,000/);
  assert.equal(Notes.normalizeNote({ title: "Empty note" }).body, "");
});

test("note search finds saved body/category text and orders by latest edit without changing source order", () => {
  const items = [
    { id: "a", title: "Older", category: "Class notes", body: "Study waves", updatedAt: "2026-11-11T12:00:00Z" },
    { id: "b", title: "Newer", category: "Ideas", body: "Sketch a planner", updatedAt: "2026-11-12T12:00:00Z" },
  ];
  assert.deepEqual(Notes.filterNotes(items, " WAVES ").map(item => item.id), ["a"]);
  assert.deepEqual(Notes.filterNotes(items, "ideas").map(item => item.id), ["b"]);
  assert.deepEqual(Notes.filterNotes(items, "").map(item => item.id), ["b", "a"]);
  assert.deepEqual(items.map(item => item.id), ["a", "b"]);
  assert.equal(Notes.wordCount("  one\n two\tthree "), 3);
  assert.equal(Notes.wordCount("   "), 0);
});
