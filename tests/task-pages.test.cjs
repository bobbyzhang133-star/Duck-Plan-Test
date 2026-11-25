const test = require("node:test");
const assert = require("node:assert/strict");
const Pages = require("../landing/task-pages.js");

test("9119 tasks stay accessible through bounded pages without mutating or dropping records", () => {
  const rows = Array.from({ length: 9119 }, (_, id) => ({ id })), pages = Pages.create(), seen = [];
  do { const page = pages.slice(rows, "overdue"); assert.ok(page.items.length <= 40); seen.push(...page.items); }
  while (pages.move("overdue", 1));
  assert.deepEqual(seen, rows); assert.equal(new Set(seen.map(r => r.id)).size, 9119);
  const last = pages.slice(rows, "overdue"); assert.equal(last.end, 9119); assert.equal(last.items.length, 39);
});
test("grouped pages span group boundaries, retain global counts and bound even thousands of classes", () => {
  const pages = Pages.create({ size: 3 });
  const groups = [{ key: "a", tasks: [1,2,3,4] }, { key: "b", tasks: [5,6] }];
  assert.deepEqual(pages.groups(groups,"tasks").groups, [{ key: "a", totalCount: 4, tasks: [1,2,3] }]);
  pages.move("tasks",1);
  assert.deepEqual(pages.groups(groups,"tasks").groups, [{ key: "a", totalCount: 4, tasks: [4] }, { key: "b", totalCount: 2, tasks: [5,6] }]);
  const many = Array.from({ length: 9119 }, (_, id) => ({ key: id, tasks: [id] }));
  assert.equal(pages.groups(many,"classes").groups.length, 3);
});
test("shrinking lists clamp the current page and clearing owner context resets all positions", () => {
  const pages=Pages.create({ size: 2 }); const rows=[1,2,3,4,5];
  pages.slice(rows,"a"); pages.move("a",1); pages.move("a",1);
  assert.deepEqual(pages.slice([1,2,3],"a").items,[3]);
  assert.equal(pages.slice([],"a").page,0); assert.equal(pages.move("a",1),false);
  pages.slice(rows,"b");pages.move("b",1);pages.clear();assert.deepEqual(pages.slice(rows,"b").items,[1,2]);
});
test("filters and dates keep independent positions; invalid moves cannot broaden a page", () => {
  const pages=Pages.create({ size: 1 }); pages.slice([1,2],"all"); pages.move("all",1);
  assert.deepEqual(pages.slice([3,4],"search").items,[3]); assert.equal(pages.move("all",2000),false); assert.equal(pages.move("missing",1),false);
  assert.deepEqual(pages.slice([1,2],"all").items,[2]);
});
