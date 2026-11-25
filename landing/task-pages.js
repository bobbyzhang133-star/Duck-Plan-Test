(function taskPagesFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckTaskPages = api;
})(typeof window !== "undefined" ? window : globalThis, function buildTaskPages() {
  "use strict";
  function create({ size = 40 } = {}) {
    if (!Number.isInteger(size) || size < 1) throw new Error("Choose a positive task page size.");
    const positions = new Map();
    function range(total, key) {
      const count = Math.max(1, Math.ceil(total / size));
      const page = Math.max(0, Math.min(positions.get(key)?.page || 0, count - 1));
      if (!positions.has(key) && positions.size >= 100) positions.delete(positions.keys().next().value);
      positions.set(key, { page, count });
      return { key, page, count, total, start: page * size, end: Math.min(total, (page + 1) * size) };
    }
    function slice(rows, key) {
      const meta = range(rows.length, key);
      return { ...meta, items: rows.slice(meta.start, meta.end) };
    }
    function groups(values, key) {
      const meta = range(values.reduce((n, group) => n + group.tasks.length, 0), key);
      let offset = 0;
      const visible = [];
      for (const group of values) {
        const from = Math.max(0, meta.start - offset), to = Math.min(group.tasks.length, meta.end - offset);
        if (to > from) visible.push({ ...group, totalCount: group.tasks.length, tasks: group.tasks.slice(from, to) });
        offset += group.tasks.length;
        if (offset >= meta.end) break;
      }
      return { ...meta, groups: visible };
    }
    function move(key, direction) {
      if (![1, -1].includes(direction)) return false;
      const position = positions.get(key);
      if (!position) return false;
      const page = Math.max(0, Math.min(position.count - 1, position.page + direction));
      if (page === position.page) return false;
      position.page = page;
      return true;
    }
    return Object.freeze({ slice, groups, move, clear: () => positions.clear() });
  }
  return Object.freeze({ create });
});
