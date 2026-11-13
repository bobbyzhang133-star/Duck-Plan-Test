(function installDuckPlanApp() {
  const installRow = document.querySelector("#install-app-settings");
  const installButton = document.querySelector("#install-app-button");
  const installCopy = document.querySelector("#install-app-copy");
  const standaloneQuery = window.matchMedia("(display-mode: standalone)");
  const isStandalone = () => standaloneQuery.matches || window.navigator.standalone === true;
  const serviceWorkerSupported = !window.DuckNativeAlarms && "serviceWorker" in navigator;
  let installPrompt = null;

  const ready = serviceWorkerSupported
    ? navigator.serviceWorker.register("./service-worker.js", { scope: "./" })
      .then(() => navigator.serviceWorker.ready)
      .catch((error) => { console.warn("DuckPlan app shell unavailable:", error.message); return null; })
    : Promise.resolve(null);

  window.DuckPlanApp = { ready, serviceWorkerSupported, isStandalone };

  function renderInstallState() {
    if (!installRow) return;
    if (window.DuckNativeAlarms) {
      installCopy.textContent = window.DuckNativeCloud
        ? 'DuckPlan iPhone app. Sign in below to sync tasks. Ringing alarms are scheduled on this device.'
        : 'DuckPlan iPhone app. Tasks and ringing alarms are saved on this device.';
      installButton.hidden = true;
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isStandalone()) {
      installCopy.textContent = "DuckPlan is installed. It opens in its own app window and keeps the planner shell available offline.";
      installButton.hidden = true;
      return;
    }
    if (installPrompt) {
      installCopy.textContent = "Install DuckPlan for an app icon, standalone window, and offline access to the planner shell.";
      installButton.textContent = "Install app";
      installButton.hidden = false;
      return;
    }
    installButton.hidden = true;
    installCopy.textContent = ios
      ? "To install on iPhone or iPad, open Share and choose Add to Home Screen."
      : "Use your browser's Install DuckPlan or Add to Home Screen action when it appears.";
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    renderInstallState();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    renderInstallState();
  });
  standaloneQuery.addEventListener?.("change", renderInstallState);

  installButton?.addEventListener("click", async () => {
    if (!installPrompt) return;
    installButton.disabled = true;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      renderInstallState();
    } finally {
      installButton.disabled = false;
    }
  });

  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event.data?.type !== "duckplan-notification-open") return;
    window.dispatchEvent(new CustomEvent("duckplan:notification-open", { detail: event.data }));
  });

  renderInstallState();
})();
