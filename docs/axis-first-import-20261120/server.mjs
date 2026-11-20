// Local-only acceptance fixture: real Worker/D1/API, synthetic upstream feed.
// This entry is never used by either production Wrangler configuration.
import { handleRequest, PlannerLive } from "../../cloudflare/src/index.js";
export { PlannerLive };
let stage = "initial";
const NOW = Date.parse("2026-11-20T20:00:00Z");
const event = (uid, when, title) => `BEGIN:VEVENT\nUID:${uid}\nDTSTART${when.includes("T") ? ":" : ";VALUE=DATE:"}${when}\nSUMMARY:Physics QA - 1: ${title}\nEND:VEVENT`;
function feed() {
  const entries = [event("old", "20261119", "Past assignment"), event("earlier", "20261120T115900", "Earlier today"), event("today", "20261120", "Due today"), event("future", "20261121", "Future assignment")];
  if (stage === "later") entries.push(event("late-new", "20261101", "New overdue assignment"));
  return `BEGIN:VCALENDAR\nVERSION:2.0\n${stage === "empty" ? "" : entries.join("\n")}\nEND:VCALENDAR`;
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return new Response("Loopback QA only", { status: 403 });
    if (url.pathname === "/__axis-qa") {
      if (request.method === "POST") {
        if (request.headers.get("Origin") && request.headers.get("Origin") !== url.origin) return new Response("Same origin required", { status: 403 });
        const body = await request.json();
        if (!["initial", "later", "invalid", "empty"].includes(body.stage)) return new Response("Invalid fixture stage", { status: 400 });
        stage = body.stage;
        await env.DB.prepare("UPDATE axis_connections SET last_attempted_at = NULL").run();
      }
      return Response.json({ stage, evaluationTime: new Date(NOW).toISOString(), syntheticUpstream: true });
    }
    return handleRequest(request, env, ctx, {
      now: () => NOW,
      fetchImpl: async address => {
        const target = new URL(address);
        if (target.hostname !== "fixture.myschoolapp.com" || target.searchParams.get("z") !== "synthetic-axis-fixture") return new Response("Only the synthetic fixture is allowed", { status: 403 });
        return new Response(stage === "invalid" ? "invalid fixture feed" : feed(), { headers: { "Content-Type": "text/calendar" } });
      },
    });
  },
};
