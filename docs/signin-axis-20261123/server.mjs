// Loopback-only UI acceptance fixture. Never used by a deployment configuration.
import { handleRequest, PlannerLive } from "../../cloudflare/src/index.js";
export { PlannerLive };
let invalidFeed = false;
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return new Response("Loopback only", { status: 403 });
    if (url.pathname === "/__connection-qa" && request.method === "POST") {
      if (request.headers.get("Origin") !== url.origin) return new Response("Same origin required", { status: 403 });
      invalidFeed = Boolean((await request.json()).invalidFeed);
      return Response.json({ syntheticFeed: true, invalidFeed });
    }
    return handleRequest(request, env, ctx, {
      now: () => Date.parse("2026-11-23T20:00:00Z"),
      fetchImpl: async address => {
        const feed = new URL(address);
        if (feed.hostname !== "fixture.myschoolapp.com" || feed.searchParams.get("z") !== "connection-ui-fixture") return new Response("Synthetic feed only", { status: 403 });
        return new Response(invalidFeed ? "not a calendar" : "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:connection-ui-homework\r\nDTSTART;VALUE=DATE:20261125\r\nSUMMARY:Physics - 1: Review motion notes\r\nEND:VEVENT\r\nEND:VCALENDAR", { headers: { "Content-Type": "text/calendar" } });
      },
    });
  },
};
