// Test doubles for the Cloudflare bindings the Worker uses. The D1 stand-in runs the real
// migration SQL on Node's built-in SQLite, so schema rules, triggers, and every query are exercised.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../..");

const toSqlite = (value) => (typeof value === "boolean" ? Number(value) : value === undefined ? null : value);
const plain = (row) => (row ? { ...row } : row);

export function createFakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;"); // D1 always enforces foreign keys
  // Match D1's tighter limits so SQL that works here also works on Cloudflare.
  db.limits.likePatternLength = 50;
  db.limits.variableNumber = 100;
  const migrations = path.join(repoRoot, "cloudflare/migrations");
  fs.readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort().forEach((name) => db.exec(fs.readFileSync(path.join(migrations, name), "utf8")));

  function execute(sql, params) {
    const results = db.prepare(sql).all(...params).map(plain);
    const changes = db.prepare("SELECT changes() AS n").get().n;
    return { results, success: true, meta: { changes } };
  }
  class Statement {
    constructor(sql, params = []) { this.sql = sql; this.params = params; }
    bind(...params) { return new Statement(this.sql, params.map(toSqlite)); }
    async all() { return execute(this.sql, this.params); }
    async run() { const { success, meta } = execute(this.sql, this.params); return { success, meta }; }
    async first(column) {
      const row = execute(this.sql, this.params).results[0];
      if (!row) return null;
      return column ? row[column] : row;
    }
  }
  return {
    raw: db,
    prepare: (sql) => new Statement(sql),
    // Like D1, a batch is one transaction: it all applies or none of it does.
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const results = statements.map((statement) => execute(statement.sql, statement.params));
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    async exec(sql) { db.exec(sql); },
  };
}

export function createFakeEnv(overrides = {}) {
  const broadcasts = [];
  const emails = [];
  const env = {
    DB: createFakeD1(),
    EMAIL_FROM: "sign-in@duckplan.test",
    EMAIL: { async send(message) { emails.push(message); return { messageId: `m${emails.length}` }; } },
    LIVE: {
      idFromName: (name) => name,
      get: (id) => ({
        async fetch(input, init = {}) {
          const url = typeof input === "string" ? input : input.url;
          if (url.endsWith("/broadcast")) { broadcasts.push({ userId: id, message: JSON.parse(init.body) }); return new Response(null, { status: 204 }); }
          return new Response(`live socket for ${id}`, { status: 200 });
        },
      }),
    },
    ...overrides,
  };
  return { env, broadcasts, emails };
}

export function createCtx() {
  const pending = [];
  return { pending, waitUntil: (promise) => pending.push(promise), settle: () => Promise.all(pending.splice(0)) };
}

export const ORIGIN = "https://duckplan.test";
