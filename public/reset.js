(async () => {
  const status = document.getElementById("status");
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    status.textContent = "Done. Taking you back to Daybreak…";
  } catch {
    status.textContent = "Couldn't clear everything — reloading anyway.";
  }
  setTimeout(() => location.replace("/"), 800);
})();
