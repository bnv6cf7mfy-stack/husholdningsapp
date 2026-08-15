self.addEventListener("push", (event) => {
  const fallback = {
    title: "Husholdningsapp",
    body: "Du har en ny oppdatering.",
    url: "/dashboard"
  };

  let data = fallback;

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = {
        ...fallback,
        ...parsed
      };
    } catch {
      data = fallback;
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      data: {
        url: data.url
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});