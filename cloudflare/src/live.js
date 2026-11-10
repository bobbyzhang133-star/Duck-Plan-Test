// Live sync between a user's devices (replaces Supabase Realtime). There is one PlannerLive
// Durable Object per user. Browsers hold a WebSocket to it; after every write the Worker posts the
// changed row here and the object forwards it to every socket. Hibernation keeps idle sockets free.
//
// Messages to the browser:  { table: "items" | "classes", row }   one row changed (soft deletes
//                                                                  arrive as a row with deleted_at)
//                           { reload: true }                       many rows changed; reload everything

export function liveStub(env, userId) {
  return env.LIVE.get(env.LIVE.idFromName(userId));
}

export async function broadcast(env, userId, message) {
  if (!env.LIVE) return;
  try {
    await liveStub(env, userId).fetch("https://live/broadcast", { method: "POST", body: JSON.stringify(message) });
  } catch (error) {
    // Devices still catch up when they reconnect or regain focus.
    console.warn("live broadcast failed", error?.message || error);
  }
}

export class PlannerLive {
  constructor(state) {
    this.state = state;
    if (typeof WebSocketRequestResponsePair === "function") {
      state.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/broadcast" && request.method === "POST") {
      const message = await request.text();
      for (const socket of this.state.getWebSockets()) {
        try { socket.send(message); } catch { /* socket already closing */ }
      }
      return new Response(null, { status: 204 });
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("Expected a WebSocket.", { status: 426 });
    const [client, server] = Object.values(new WebSocketPair());
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  // Browsers only listen; anything they send other than the auto-answered "ping" is ignored.
  webSocketMessage() {}

  webSocketClose(socket, code) {
    try { socket.close(code === 1005 ? 1000 : code, "closed"); } catch { /* already closed */ }
  }
}
