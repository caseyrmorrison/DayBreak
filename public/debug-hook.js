// Temporary diagnostics: reports page boot and any JS errors to the
// local server log so stuck clients can be debugged. Remove once the
// loading-screen issue is resolved.
(() => {
  const send = (payload) => {
    try {
      navigator.sendBeacon("/api/log", JSON.stringify(payload));
    } catch {
      // diagnostics must never break the app
    }
  };
  addEventListener("error", (event) =>
    send({
      type: "error",
      message: String((event.error && event.error.stack) || event.message),
      source: `${event.filename || "?"}:${event.lineno || 0}`,
    }),
  );
  addEventListener("unhandledrejection", (event) =>
    send({ type: "rejection", message: String(event.reason) }),
  );
  send({
    type: "boot",
    url: location.href,
    userAgent: navigator.userAgent,
    hasServiceWorker: "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller),
  });
})();
