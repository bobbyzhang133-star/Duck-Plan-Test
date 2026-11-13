// Cloud sync settings for this copy of DuckPlan. Left empty, the planner stays in local-only mode
// (tasks saved in this browser), which is what Netlify and the python preview serve.
// When the DuckPlan Worker (cloudflare/) serves the site, it answers this file itself with
// `apiUrl: "/api"`, so cloud sync turns on only where the backend actually exists.
window.DUCKPLAN_CLOUD = {
  apiUrl: "",
  native: false,
};
// Xcode's bundled main frame receives this restricted native transport at startup.
if (window.DuckNativeCloud) {
  window.DUCKPLAN_CLOUD = { apiUrl: window.DuckNativeCloud.apiUrl, native: true };
}
