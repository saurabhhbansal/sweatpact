/* SweatPact service worker for Web Push notifications.
   Handles push events (display the notification) and notificationclick
   (open or focus the relevant page). Activates immediately on install. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    if (event.data) payload = event.data.json();
  } catch (e) {
    payload = { title: "SweatPact", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "SweatPact";
  const options = {
    body: payload.body || "",
    tag: payload.tag || "sweatpact",
    data: { url: payload.url || "/notifications", ...payload.data },
    requireInteraction: false,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus an existing tab pointing at our origin if we have one.
      for (const client of clientList) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            return client.focus().then((focused) => {
              if ("navigate" in focused) {
                return focused.navigate(target);
              }
              return focused;
            });
          }
        } catch (e) {
          // ignore
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
