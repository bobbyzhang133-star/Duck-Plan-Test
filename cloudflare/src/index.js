// DuckPlan Worker: serves landing/ as static assets and the planner backend under /api.
import { HttpError, assertSameOrigin, json } from "./http.js";
import { handleAuth, requireUser } from "./auth.js";
import { handlePlanner } from "./planner.js";
import { handleAxis, syncDueConnections } from "./axis.js";
import { PlannerLive, liveStub } from "./live.js";

export { PlannerLive };

// landing/cloud-config.js ships empty, so a copy of the site served anywhere else (Netlify, the
// python preview) stays local-only. When this Worker serves the site, it answers that file itself
// and turns cloud sync on against its own /api.
const CLOUD_CONFIG = "// Served by the DuckPlan Worker: cloud sync uses this site's own /api.\nwindow.DUCKPLAN_CLOUD = { apiUrl: \"/api\" };\n";

export async function handleRequest(request, env, ctx, options = {}) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/cloud-config.js") {
    return new Response(CLOUD_CONFIG, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache" } });
  }
  if (!path.startsWith("/api/")) return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });

  try {
    if (request.method !== "GET" && request.method !== "HEAD") assertSameOrigin(request);

    const authResponse = await handleAuth(request, env, path);
    if (authResponse) return authResponse;

    if (path === "/api/live") {
      // Browsers can't add headers to a WebSocket, but they do send Origin and the session cookie.
      assertSameOrigin(request);
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") throw new HttpError(426, "Expected a WebSocket.");
      const user = await requireUser(request, env);
      return liveStub(env, user.id).fetch(request);
    }

    const user = await requireUser(request, env);
    const response = (await handlePlanner(request, env, ctx, path, user)) || (await handleAxis(request, env, path, user, options));
    if (response) return response;
    throw new HttpError(404, "Not found.");
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error("api error", request.method, path, error?.message || error);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
}

export default {
  fetch: (request, env, ctx) => handleRequest(request, env, ctx),
  scheduled(controller, env, ctx) {
    ctx.waitUntil(syncDueConnections(env).then((summary) => console.log("axis cron", JSON.stringify(summary))));
  },
};
