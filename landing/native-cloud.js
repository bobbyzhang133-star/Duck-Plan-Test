// Native networking keeps the local bundle and its AlarmKit bridge in place.
// Ordinary browser builds keep their existing same-origin fetch and cookie behavior.
(() => {
  const native = window.DuckNativeCloud;
  if (!native) return;
  const api = new URL(native.apiUrl);
  const browserFetch = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
    const address = String(input);
    const url = address.startsWith("/api/") ? new URL(address, api.origin) : new URL(address, location.href);
    if (url.origin !== api.origin || !url.pathname.startsWith("/api/")) return browserFetch(input, options);
    const result = await native.request({
      url: url.href,
      method: String(options.method || "GET").toUpperCase(),
      ...(options.body === undefined ? {} : { body: options.body }),
    });
    return new Response(result.body, { status: result.status, headers: { "Content-Type": "application/json" } });
  };
})();
