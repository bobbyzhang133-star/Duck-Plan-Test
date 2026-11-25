// Isolated loopback acceptance harness. Never a production entrypoint.
import { handleRequest, PlannerLive } from "../../cloudflare/src/index.js";
export { PlannerLive };
let sequence = 0;
function feed() {
  const version = ++sequence;
  return "BEGIN:VCALENDAR\n" + [
    ["Math - 1: Worksheet", "20261201", "Bring a pencil"],
    ["Math - 1: Worksheet", "20261201", "Bring a pencil"],
    ["Science - 2: Worksheet", "20261201", "Bring a pencil"],
    ["Math - 1: Past assignment", "20261101", "Old work"],
  ].map(([title, date, notes], i) => `BEGIN:VEVENT\nUID:rotating-${version}-${i}\nDTSTART;VALUE=DATE:${date}\nSUMMARY:${title}\nDESCRIPTION:${notes}\nEND:VEVENT`).join("\n") + "\nEND:VCALENDAR";
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return new Response("Loopback only", { status: 403 });
    if (url.pathname === "/__axis-qa" && request.method === "POST") {
      if (request.headers.get("Origin") !== url.origin) return new Response("Same origin required", { status: 403 });
      await env.DB.prepare("UPDATE axis_connections SET last_attempted_at=NULL").run();
      return Response.json({ syntheticUpstream: true, sequence });
    }
    return handleRequest(request, env, ctx, {
      now: () => Date.parse("2026-11-25T20:00:00Z"),
      fetchImpl: async address => {
        const target = new URL(address);
        return target.hostname === "fixture.myschoolapp.com" && target.searchParams.get("z") === "synthetic-axis-fixture"
          ? new Response(feed()) : new Response("Synthetic feed only", { status: 403 });
      },
    });
  },
};
