// Cloud sync settings for this copy of DuckPlan. Left empty, the planner stays in local-only mode
// (tasks saved in this browser), which is what Netlify and the python preview serve.
// When the DuckPlan Worker (cloudflare/) serves the site, it answers this file itself with
// `apiUrl: "/api"`, so cloud sync turns on only where the backend actually exists.
window.DUCKPLAN_CLOUD = {
  apiUrl: "",
};

// The bundled main frame uses the restricted native URLSession transport.
window.DUCKPLAN_CLOUD.native = false;
if (window.DuckNativeCloud) {
  window.DUCKPLAN_CLOUD = { apiUrl: window.DuckNativeCloud.apiUrl, native: true };
}
